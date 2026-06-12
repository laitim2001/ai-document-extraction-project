# FIX-062: 審核詳情頁 PDF 載入失敗 (CORS) 與英文版顯示中文 (i18n)

> **建立日期**: 2026-06-05
> **發現方式**: 手動測試 (E2E，於 `/en/review/[id]` 頁面)
> **影響頁面/功能**: 審核詳情頁 `/[locale]/review/[id]`
> **優先級**: 高 (BUG-1 阻斷核心審核功能) / 中 (BUG-2 體驗缺陷)
> **狀態**: ✅ 已修復 (2026-06-05)

---

## 問題描述

於 `http://localhost:3200/en/review/e9ba60af-5d98-4889-8706-d6623dfd7d2b` 測試時發現兩個缺陷：

| # | 問題 | 嚴重度 | 影響 |
|---|------|--------|------|
| BUG-1 | PDF 無法載入，畫面顯示「無法載入 PDF 文件」 | 高 | 審核人員無法檢視原始文件，核心審核流程中斷 |
| BUG-2 | 英文版 (`/en/...`) 頁面仍大量顯示中文字 | 中 | 違反 H5 (i18n)，英文用戶體驗破碎 |

### BUG-1 錯誤訊息

```
Access to fetch at 'http://127.0.0.1:10010/devstoreaccount1/documents/HKG/...signed.pdf'
from origin 'http://localhost:3200' has been blocked by CORS policy:
No 'Access-Control-Allow-Origin' header is present on the requested resource.

pdf.mjs:9901  GET http://127.0.0.1:10010/devstoreaccount1/documents/HKG/...signed.pdf
net::ERR_FAILED 200 (OK)

PDF load error: UnknownErrorException {message: 'Failed to fetch', ...}
```

### BUG-2 觀察現象

英文版頁面中：頁面標題「審核：」、審核面板的「Forwarder:」「整體信心度:」、欄位分組名「其他資訊」、操作按鈕「確認無誤 / 儲存修正 / 升級」、提示「快速審核模式：僅需確認需關注欄位」等皆顯示中文。
（對比：「Quick Review」badge 顯示英文，因 `ProcessingPathBadge` 已國際化，印證問題在於部分組件未接上翻譯。）

---

## 重現步驟

1. 啟動開發伺服器與 Docker (含 Azurite)
2. 上傳並處理一份文件，使其進入 QUICK_REVIEW / FULL_REVIEW 佇列
3. 以英文 locale 開啟審核詳情頁：`/en/review/{documentId}`
4. 觀察現象：
   - PDF 區域顯示「無法載入 PDF 文件」，Console 出現 CORS 錯誤 (BUG-1)
   - 頁面標題、審核面板、按鈕等顯示中文 (BUG-2)

---

## 根本原因

### BUG-1：瀏覽器端直接 fetch Azure/Azurite Blob URL

`src/app/[locale]/(dashboard)/review/[id]/page.tsx` 將 `data.document.fileUrl`（即 API 回傳的 `document.filePath`，本機為 Azurite Blob URL `http://127.0.0.1:10010/...`）直接傳給 `DynamicPdfViewer` → `react-pdf` 的 `<Document file={url}>`，PDF.js 在瀏覽器端跨 origin (`localhost:3200` → `127.0.0.1:10010`) 直接 fetch。Azurite（及生產環境 Azure Blob）預設未設定 CORS `Access-Control-Allow-Origin` header，請求被瀏覽器擋下。

> **既有正解**：專案已有 `/api/documents/[id]/blob` proxy 端點（CHANGE-018 建立，專為避免此 CORS 問題），由伺服器端串流 Blob 內容。`document-preview/PDFViewer` 已採用此範式，但較舊的 `review/PdfViewer`（Epic 3 / Story 3.2）仍直接吃 raw URL。

### BUG-2：審核詳情頁多數組件硬編碼中文，未接上 `review.json`

`review.json` 三語翻譯**部分已存在**（`page.*`、`approval.*`、`toast.*`、`dialog.*` 等），但審核詳情頁的頁面與子組件大量硬編碼中文字串，未呼叫 `useTranslations('review')`。部分組件（`ProcessingPathBadge`、`ConfidenceBadge`、`EscalationDialog`）已國際化，造成英文版「半中半英」。

**已國際化（不需修改）**：`ProcessingPathBadge`、`ConfidenceBadge`、`EscalationDialog`

**硬編碼待修（16 個組件）**：見下方「修改的檔案」。

---

## 解決方案

### BUG-1 修復：改走既有 Blob proxy 端點

`page.tsx` 將傳入 `DynamicPdfViewer` 的 `url` 由 raw Blob URL 改為同源 proxy 路徑：

```tsx
// Before
<DynamicPdfViewer url={data.document.fileUrl} pageCount={data.document.pageCount || 1} />

// After（同源、走認證 proxy，無 CORS）
<DynamicPdfViewer url={`/api/documents/${documentId}/blob`} pageCount={data.document.pageCount || 1} />
```

`documentId` 於頁面內已存在 (`resolvedParams.id`)。此為最小外科手術式改動，與 `document-preview` 模組範式一致。

### BUG-2 修復：接上 `review.json` 翻譯（三語同步）

1. 在 `messages/{en,zh-TW,zh-CN}/review.json` 補齊缺漏 key（新增 `panel.*`、`fieldGroups.*`、`fields.*`、`reviewActions.*`、`quickReview.*`、`correctionType.*`、`confidenceDetail.*`、`pdf.*`、`layout.*`、`fieldEditor.*` 等；`ApprovalConfirmDialog` 重用既有 `approval.*`）。
2. 各組件改用 `useTranslations('review')`，移除硬編碼中文（含 JSX 文字、`placeholder`、`title`、`aria-label`、`sr-only`、tooltip）。
3. 路由導航統一使用 `@/i18n/routing` 的 `Link`/`useRouter`（如有 `next/navigation` 殘留）。

**設計原則（Surgical / 不擴大 scope）**：
- `FieldRow` 的 `FIELD_LABELS`（30 個 camelCase 欄位名對照）原樣搬入 `review.json` `fields.*`，保留「命中則顯示對照、未命中 fallback 原始 fieldName」的既有行為，**不**修正其與實際 snake_case 資料對不上的既有問題（屬另一議題，超出本 FIX scope）。
- `ConfidenceTooltip` 的等級標籤/描述/因素標籤改用 `t()`（組件層），**不**改動 `@/lib/confidence` 函數簽名。

---

## 修改的檔案

### 功能修復 (BUG-1)

| 檔案 | 修改內容 |
|------|----------|
| `src/app/[locale]/(dashboard)/review/[id]/page.tsx` | PDF url 改走 `/api/documents/[id]/blob` proxy |

### i18n 翻譯 (BUG-2)

| 檔案 | 修改內容 |
|------|----------|
| `messages/en/review.json` | 補齊缺漏翻譯 key |
| `messages/zh-TW/review.json` | 補齊缺漏翻譯 key |
| `messages/zh-CN/review.json` | 補齊缺漏翻譯 key |

### i18n 組件接線 (BUG-2，16 個)

| 檔案 | 主要硬編碼字串 |
|------|----------------|
| `src/app/[locale]/(dashboard)/review/[id]/page.tsx` | 標題、載入失敗、找不到文件、未儲存對話框、toast、hook 訊息 |
| `src/components/features/review/ReviewPanel/ReviewPanel.tsx` | FIELD_GROUPS(7)、Forwarder、整體信心度、未識別、無欄位提示 |
| `src/components/features/review/ReviewPanel/ReviewActions.tsx` | 審核模式提示、確認無誤/儲存修正/升級、tooltip、未儲存提示 |
| `src/components/features/review/ReviewPanel/QuickReviewMode.tsx` | 快速審核模式、統計徽章、需要關注的欄位、確認全部欄位 |
| `src/components/features/review/ReviewPanel/FieldGroup.tsx` | 需要關注 |
| `src/components/features/review/ReviewPanel/FieldRow.tsx` | FIELD_LABELS(30)、來源位置/已修改 tooltip、空值 `—` |
| `src/components/features/review/ReviewPanel/FieldEditor.tsx` | 驗證失敗、儲存/取消 title+sr-only、（空） |
| `src/components/features/review/ApprovalConfirmDialog.tsx` | 重用既有 `approval.*` |
| `src/components/features/review/CorrectionTypeDialog.tsx` | 儲存修正類型、批量設定、正常/特例等 |
| `src/components/features/review/CorrectionTypeSelector.tsx` | 正常修正/特例修正說明、特例原因 |
| `src/components/features/review/ConfidenceTooltip.tsx` | 等級標籤/描述/因素標籤 |
| `src/components/features/review/ConfidenceIndicator.tsx` | aria-label 高/中/低信心度 |
| `src/components/features/review/LowConfidenceFilter.tsx` | 僅顯示低信心度欄位 |
| `src/components/features/review/PdfViewer/PdfViewer.tsx` | 無法載入 PDF 文件 |
| `src/components/features/review/PdfViewer/PdfToolbar.tsx` | 上/下一頁、放大/縮小 aria、重置 title |
| `src/components/features/review/ReviewDetailLayout.tsx` | PDF 檢視 / 審核欄位 (行動版 Tab) |

---

## 測試驗證

### 程式碼層驗證（已完成）

- [x] `npm run i18n:check` 三語同步通過 ✅
- [x] `npm run type-check`：本次改動的 20 個檔案**零** TypeScript 錯誤 ✅（全域僅 `src/components/reports/CityDetailPanel.tsx` recharts 類型 + `tests/**` 缺 `@types/jest`/`vitest` 等 pre-existing 錯誤，與本次無關）
- [x] ESLint（review 範圍）：**0 errors** ✅（唯一 warning 在 `ConfidenceBadge.tsx`，`git diff` 確認該檔未被本次改動，屬 pre-existing，依 §H3 未擴大 scope 處理）
- [x] Blob proxy endpoint `/api/documents/[id]/blob` 對未認證請求回 **401 Unauthorized** ✅（證明 endpoint 存在、auth wiring 正確，非 404 路由錯誤）

### 瀏覽器 runtime 驗證（待用戶於已登入瀏覽器確認）

> 註：Playwright 為獨立瀏覽器 context 無 session，且登入頁僅提供 Microsoft SSO / Email 密碼（無開發快速登入），無法自動完成受保護頁面的 runtime 驗證。請於**已登入**的瀏覽器 hard refresh（Ctrl+Shift+R 清快取）後確認：

- [ ] `/en/review/{id}`：PDF 正常載入，Console 無 CORS 錯誤
- [ ] `/en/review/{id}`：頁面與審核面板全部顯示英文，無殘留中文
- [ ] `/zh-TW/review/{id}`：顯示繁體中文，功能正常
- [ ] `/zh-CN/review/{id}`：顯示簡體中文
- [ ] 各互動正常：欄位編輯、低信心度篩選、確認無誤對話框、修正類型對話框、升級對話框

---

## 實作備註

- **執行方式**：主 session 統一寫 `review.json` 三語 + 改 `page.tsx`（含 CORS）；其餘 15 組件由 4 個並行 `code-implementer` agent 接線（各組獨立檔案，無衝突，皆唯讀 `review.json`）。
- **i18n-aware 路由**：`page.tsx` 一併把 `next/link`、`next/navigation` 換成 `@/i18n/routing` 的 `Link`/`useRouter`，修正 `router.push('/review')` 原本會丟失 locale 前綴的同類缺陷。
- **Surgical 原則落實**：`FieldRow` 改用 `t.has(\`fields.${fieldName}\`)` + fallback，保留「未命中即顯示原始 fieldName」的既有行為（未修正其與 snake_case 資料對不上的既有議題）；`ConfidenceTooltip` 於組件層改用 `t()`，未改動 `src/lib/confidence`。

---

*文件建立日期: 2026-06-05*
*最後更新: 2026-06-05*
