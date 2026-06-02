# FIX-060: 模板匹配測試精靈「現有文件」選項未實作（永遠顯示無文件）

> **建立日期**: 2026-06-02
> **發現方式**: 手動 UI 測試（Data Template 端到端實測 → 預覽步驟時發現）
> **影響頁面/功能**: `/admin/test/template-matching`（模板匹配整合測試精靈）步驟 1「選擇數據 → 現有文件」
> **優先級**: 低（僅 admin 開發測試工具，不影響正式 document → template 流程）
> **狀態**: 🚧 待修復

---

## 問題描述

模板匹配測試精靈（`/admin/test/template-matching`）步驟 1 提供「模擬數據」與「現有文件」兩種數據來源。選「現有文件」時，畫面**永遠顯示「沒有已處理的文件」**，即使 DB 中存在 `MAPPING_COMPLETED` 狀態的文件（本次實測 DB 有 3 份 Fairate 文件，仍顯示空）。

根因是該分支為**未完成的佔位符**——程式碼從未實作「從 API 載入文件」，而是直接渲染一段固定的「無文件」文字。`TestDataSelector.tsx` 第 188-203 行的註解自承此事：

```tsx
{/* 文件選擇（簡化版，實際應從 API 載入） */}
{testState.dataSource === 'documents' && (
  <Card>
    ...
    <CardContent>
      <p>{t('documents.noDocuments')}</p>   // ← 恆顯示「沒有已處理的文件」
    </CardContent>
  </Card>
)}
```

| # | 問題 | 嚴重度 | 影響位置 |
|---|------|--------|----------|
| BUG-1 | 「現有文件」分支從未實作 API 載入，恆顯示空 | 低-中 | `TestDataSelector.tsx` 第 188-203 行 |

---

## 重現步驟

1. 確保 DB 有至少一份 `MAPPING_COMPLETED`（已處理完成）文件。
2. 進入 `/admin/test/template-matching`。
3. 步驟 1「選擇測試數據」點選「現有文件」。
4. 觀察現象：卡片內容固定為「沒有已處理的文件」，無任何文件列表，無法勾選，精靈無法以真實文件繼續（只能退回用「模擬數據」）。

---

## 根本原因

`TestDataSelector.tsx` 的 `dataSource === 'documents'` 分支是 stub：

- `testState.selectedDocuments` 狀態欄位存在，但 documents 分支從未填充它。
- `getPreviewData()` 僅處理 `dataSource === 'mock'`，documents 一律回 `null`。
- 沒有任何 `useEffect` / fetch 去呼叫文件列表 API。

因此「真實文件」這條測試路徑形同未開通；要用真實文件做預覽/匹配，目前只能繞過 UI 直接呼叫 `/api/v1/template-matching/preview`（或於 `/documents` 頁批次匹配）。這也是 `template_instances` 長期為 0、此功能鏈缺乏真實資料演練的成因之一。

---

## 解決方案

在 `TestDataSelector.tsx` 的 documents 分支實作「載入已處理文件 + 勾選」，**可直接複用現成的 `AddFileDialog.tsx`**（該組件已正確實作從 `/api/documents` 載入文件清單並支援多選）：

1. 以 `useEffect` 呼叫 `GET /api/documents`（必要時 `?status=MAPPING_COMPLETED&pageSize=50`），載入已處理文件。
2. 渲染可勾選列表（檔名、城市、上傳時間、狀態 Badge），對齊 `AddFileDialog` 的呈現。
3. 勾選後 `onUpdate({ selectedDocuments })`，並補上 `onRecordResult`（與 mock 分支一致）。
4. 確認後續步驟（步驟 3「查看映射」、步驟 4「執行匹配」、步驟 5「檢視結果」）能消費 `selectedDocuments` 的 `documentId`（`preview` / `execute` API 皆已支援 `documentIds`）。

> 屬「補完既有未完成功能」，不偏離設計、不觸發 H1。

---

## 修改的檔案

| 檔案 | 修改內容 |
|------|----------|
| `src/app/[locale]/(dashboard)/admin/test/template-matching/components/TestDataSelector.tsx` | documents 分支實作 API 載入 + 勾選列表（複用 AddFileDialog 模式）；更新 `getPreviewData` 支援 documents 來源 |
| `src/app/[locale]/(dashboard)/admin/test/template-matching/types.ts`（如需） | 確認 `selectedDocuments` 型別涵蓋實際文件摘要欄位 |

---

## 測試驗證

修復完成後需驗證：

- [ ] 步驟 1 選「現有文件」能列出所有 `MAPPING_COMPLETED` 文件並可勾選
- [ ] 勾選文件後可進入步驟 2-5，預覽/匹配使用真實文件的提取資料
- [ ] 無已處理文件時才顯示「沒有已處理的文件」（空狀態正確）
- [ ] `type-check` / `lint` 通過

---

*文件建立日期: 2026-06-02*
*最後更新: 2026-06-02*
