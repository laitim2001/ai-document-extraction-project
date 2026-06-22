# FIX-091: RecentDocumentsTable 引用不存在的 `invoice` namespace — 狀態欄顯示 Missing key

> **建立日期**: 2026-06-22
> **發現方式**: 程式碼審查（CHANGE-089 i18n 治理後續盤點）
> **影響頁面/功能**: 公司詳情頁近期文件表格（`RecentDocumentsTable`，路徑 `src/components/features/forwarders/RecentDocumentsTable.tsx`）
> **優先級**: 中
> **狀態**: ✅ 已修復（2026-06-22）— 在 `companies.json` `recentDocs` 下補 `status` 子物件（5 值 UPPER_SNAKE key，三語言同步），組件移除 `tInvoice` 改用 `t('recentDocs.status.<STATUS>')`；type-check / i18n:check 通過

---

## 問題描述

`RecentDocumentsTable.tsx` 第 71、173 行使用 `useTranslations('invoice')` 取 ``tInvoice(`status.${doc.status.toLowerCase()}`)``，但 `invoice` namespace **不存在**：

- 未註冊於 `src/i18n/request.ts` 的 `namespaces` 陣列。
- 無 `messages/{en,zh-TW,zh-CN}/invoice.json`。

結果：該表格「狀態」欄在 runtime 顯示 `[Missing: invoice.status.xxx]`（next-intl `getMessageFallback`，見 `src/i18n/request.ts:123-125`）。屬 pre-existing bug（非近期引入）。

---

## 根本原因

組件第 70 行已正確取得 `companies` namespace（`const t = useTranslations('companies')`），但第 71 行又額外宣告 `const tInvoice = useTranslations('invoice')`，並在第 173 行用它取狀態文字。`invoice` 命名空間從未建立，因此所有狀態值都 fallback。

### `doc.status` 的實際型別（關鍵釐清）

`RecentDocumentItem.status` 型別為 **`DocumentProcessingStatus`**（`src/types/forwarder.ts:273`），為**簡化的 5 值顯示狀態**：

```
'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'NEEDS_REVIEW'
```

**並非** Prisma 的 `DocumentStatus`（15 值，`prisma/schema.prisma:3342`）。`mapDocumentStatus()`（`forwarder.ts:314`）負責把 15 值 Prisma 狀態映射到這 5 個顯示值。`DOCUMENT_PROCESSING_STATUS_CONFIG`（`forwarder.ts:278`）亦以這 5 值為 key。

### 為何不直接複用 `documents.json` 的 `status`

`messages/{locale}/documents.json` 的 `status` 區塊以 **15 值 Prisma key**（`UPLOADING` / `OCR_PROCESSING` / `PENDING_REVIEW` …）建立，與本組件的 5 值顯示狀態**不對應**（`PENDING` / `PROCESSING` / `NEEDS_REVIEW` 在 `documents.json` 並無對應 key）。若改指向 `documents`，仍會再次產生 Missing key。

---

## 解決方案（最小改動）

採「在組件已使用的 `companies` namespace 內補狀態對照」，零新增 namespace、零 `request.ts` 變更，語意內聚（這是「近期文件表格」專屬的狀態顯示）。狀態 key 採 UPPER_SNAKE，對齊 `documents.json` status 與 `DOCUMENT_PROCESSING_STATUS_CONFIG` 的既有 pattern，並可省去 `.toLowerCase()`。

### 組件變更（`RecentDocumentsTable.tsx`）

1. 移除第 71 行 `const tInvoice = useTranslations('invoice')`。
2. 第 173 行 ``tInvoice(`status.${doc.status.toLowerCase()}`)`` → ``t(`recentDocs.status.${doc.status}`)``。

### i18n 變更（三語言同步）

在 `messages/{en,zh-TW,zh-CN}/companies.json` 的 `recentDocs` 區塊新增 `status` 子物件：

| key | en | zh-TW | zh-CN |
|-----|-----|-------|-------|
| `PENDING` | Pending | 待處理 | 待处理 |
| `PROCESSING` | Processing | 處理中 | 处理中 |
| `COMPLETED` | Completed | 已完成 | 已完成 |
| `FAILED` | Failed | 失敗 | 失败 |
| `NEEDS_REVIEW` | Needs Review | 待審核 | 待审核 |

（zh-TW 用語沿用 `DOCUMENT_PROCESSING_STATUS_CONFIG` 既有 label。）

---

## 修改的檔案

| 檔案 | 修改內容 |
|------|----------|
| `src/components/features/forwarders/RecentDocumentsTable.tsx` | 移除 `tInvoice`；狀態 Badge 改用 `t('recentDocs.status.<STATUS>')` |
| `messages/en/companies.json` | `recentDocs` 新增 `status`（5 key） |
| `messages/zh-TW/companies.json` | 同步新增 |
| `messages/zh-CN/companies.json` | 同步新增 |

---

## 範圍邊界（H3）

用戶曾建議「與 invoice→documents 狀態用語統一一併處理」。經評估：該統一涉及 `documents.json` 15 值對照標準化與多組件改動，且 5 值顯示狀態與 15 值 Prisma 狀態屬不同層級、無法簡單對齊，**超出本次最小 bug fix scope**。本 FIX 僅修復 Missing key，狀態用語統一另列 backlog。

---

## 測試驗證

- [ ] 公司詳情頁近期文件表格「狀態」欄正確顯示各語言文字，無 `[Missing: invoice.status.*]`（待瀏覽器驗證）
- [ ] `/en` 顯示英文、`/zh-TW` 繁中、`/zh-CN` 簡中，切換語言即時生效（待瀏覽器驗證）
- [x] `npm run i18n:check` 通過（2026-06-22，companies.json 整檔 219 leaf key 三語言一致）
- [x] `npm run type-check` 通過（2026-06-22，tsc --noEmit 無錯誤）

---

*文件建立日期: 2026-06-22*
*最後更新: 2026-06-22*
