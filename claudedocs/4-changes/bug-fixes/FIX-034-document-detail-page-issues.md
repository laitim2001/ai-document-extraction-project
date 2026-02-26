# FIX-034: 文件詳情頁面多項顯示問題

> **建立日期**: 2026-01-28
> **發現方式**: Playwright E2E 測試 (Phase 4 CHANGE-016)
> **影響頁面**: `/[locale]/invoices/[id]`
> **優先級**: 高
> **狀態**: 🚧 待修復
> **發現 commit**: `1c89dff`

---

## 問題描述

文件詳情頁面 (`/invoices/[id]`) 在統一處理管線 (Epic 15) 處理完成後，存在 7 項顯示問題和功能缺失。核心原因是詳情頁面 (Epic 13) 的 `getDocumentWithRelations()` 未完全對接統一處理管線的輸出格式，導致多個 UI 組件因缺少數據而顯示空白或預設值。

**涉及 7 個子問題**：

| # | 問題 | 嚴重度 | 組件位置 |
|---|------|--------|----------|
| BUG-1 | i18n 翻譯 key 不匹配 (processingPath) | 中 | `InvoiceDetailStats.tsx:119` |
| BUG-2 | Confidence 值顯示為 "-" | 中 | `InvoiceDetailStats.tsx:140-154` |
| BUG-3 | Extracted Fields 頁籤空白 | 高 | `InvoiceDetailTabs.tsx:169-183` |
| BUG-4 | Processing 頁籤空白 + 404 trace API | 中 | `ProcessingTimeline.tsx:143` |
| BUG-5 | Preview 顯示 "Unable to preview" | 中 | `InvoiceDetailTabs.tsx:143-162` |
| BUG-6 | Download 按鈕 Disabled | 低 | `InvoiceDetailHeader.tsx` |
| BUG-7 | Upload Info 用戶名顯示 "-" | 低 | `InvoiceDetailStats.tsx` |

---

## 重現步驟

1. 上傳文件（如 DHL 發票 PDF）至系統
2. 觸發統一處理管線，等待狀態變為 `MAPPING_COMPLETED`
3. 導航至 `/en/invoices/{document-id}` 文件詳情頁
4. 觀察以下現象：
   - Status 卡片下方顯示原始 key `invoices.processingPath.FULL_REVIEW`
   - Confidence 卡片顯示 `-`
   - Extracted Fields 頁籤顯示 "No extracted fields available"
   - Processing 頁籤完全空白，console 報 403/404 (`/documents/[id]/trace`)
   - Preview 頁籤顯示 "Unable to preview this file"
   - Download 按鈕為灰色不可點擊
   - Upload Info 用戶名顯示 `-`

---

## 根本原因

所有問題追溯到**一個核心原因**：

> `getDocumentWithRelations()` 函數未回傳統一處理管線所需的所有欄位和關聯。

統一處理管線（Epic 15）將數據寫入以下位置：
- `documents` 表：`status`, `processing_path`, `routing_decision`, `company_id`, `overall_confidence`
- `document_extracted_fields` 表：提取的欄位數據
- `ocr_results` 表：OCR 原始結果
- `audit_logs` 表：處理步驟追蹤

但文件詳情頁面（Epic 13）的 API 只讀取了 `documents` 基本欄位和部分關聯。

**各 BUG 具體根因**：

### BUG-1: i18n key 不匹配
- DB 存儲 UPPER_SNAKE_CASE enum 值：`FULL_REVIEW`, `AUTO_APPROVE`
- 翻譯文件使用 camelCase key：`fullReview`, `autoApprove`
- 組件直接拼接 DB 值：`t(\`processingPath.${document.processingPath}\`)`

### BUG-2: Confidence 缺失
- 組件期望 `document.overallConfidence`
- `getDocumentWithRelations()` 的 select 未包含此欄位

### BUG-3: Extracted Fields 空白
- Hook 請求 `?include=extractedFields`，但 API 未解析 `include` query parameter
- `getDocumentWithRelations()` 不包含 `extractedFields` 關聯

### BUG-4: Processing tab 空白
- `/api/documents/[id]/trace` 回應 403
- trace 數據可能未被統一處理管線寫入 `audit_logs`

### BUG-5: Preview 無法顯示
- 組件檢查 `document.blobUrl`，但 API 未回傳此欄位
- Document 模型有 `filePath` 和 `blobName`，但需生成 SAS URL 才能訪問

### BUG-6: Download disabled
- 與 BUG-5 同源，按鈕 disabled 條件依賴 `blobUrl`

### BUG-7: User name "-"
- 開發模式 `session.user.id = 'dev-user-1'` 不存在於 DB `users` 表
- **開發環境預期行為**，生產環境不受影響

---

## 解決方案

### BUG-1 修復：組件中轉換 enum 格式（推薦方案 A）

```typescript
// InvoiceDetailStats.tsx:119
// FULL_REVIEW → fullReview
const pathKey = document.processingPath
  ?.toLowerCase()
  .replace(/_([a-z])/g, (_, c) => c.toUpperCase());
{t(`processingPath.${pathKey}`)}
```

### BUG-2 修復：`getDocumentWithRelations()` 加入 overallConfidence

```typescript
// document.service.ts - getDocumentWithRelations()
select: {
  // ... 現有欄位
  overallConfidence: true,
  routingDecision: true,
}
```

### BUG-3 修復：API 解析 include query parameter

```typescript
// src/app/api/documents/[id]/route.ts
const searchParams = request.nextUrl.searchParams;
const includeParam = searchParams.get('include') || '';
const includeExtracted = includeParam.includes('extractedFields');

const document = await getDocumentWithRelations(id, {
  includeExtractedFields: includeExtracted,
});
```

### BUG-5 修復：API 生成 SAS URL

```typescript
// src/app/api/documents/[id]/route.ts
import { generateSignedUrl } from '@/lib/azure-blob';

let blobUrl = null;
if (document.blobName) {
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
  blobUrl = await generateSignedUrl(document.blobName, expiresAt);
}

return NextResponse.json({
  success: true,
  data: { ...document, blobUrl },
});
```

### BUG-4 修復：確認 trace API + 數據寫入

1. 確認 trace API 回應格式是否符合 `ProcessingTimeline` 的 `TraceResponse` interface
2. 確認統一處理管線是否在 `audit_logs` 中記錄處理步驟
3. 修正 403 權限問題（trace API 的 auth 檢查）

### BUG-6：隨 BUG-5 自動修復

### BUG-7：低優先級，可選在 seed 中建立 dev-user-1

---

## 修改的檔案

| 檔案 | 修改內容 |
|------|----------|
| `src/app/api/documents/[id]/route.ts` | 解析 include param、加入 blobUrl 生成 |
| `src/services/document.service.ts` | `getDocumentWithRelations()` 加入缺失欄位和關聯 |
| `src/components/features/invoice/detail/InvoiceDetailStats.tsx` | processingPath enum 格式轉換 |
| `messages/en/invoices.json` | 視方案可能需同步更新 |
| `messages/zh-TW/invoices.json` | 視方案可能需同步更新 |
| `messages/zh-CN/invoices.json` | 視方案可能需同步更新 |
| `src/app/api/documents/[id]/trace/route.ts` | 修正 403 權限問題 |
| `src/services/processing-result-persistence.service.ts` | 確認 trace 數據寫入 |

---

## 修復優先級

| 順序 | Bug | 修復複雜度 | 影響範圍 |
|------|-----|-----------|---------|
| 1 | BUG-1 (i18n key) | 低 | 翻譯文件 + 1 行代碼 |
| 2 | BUG-3 (Extracted Fields) | 中 | API + Service 層 |
| 3 | BUG-5 (Preview + Download) | 中 | API + SAS URL 生成 |
| 4 | BUG-2 (Confidence) | 低 | API select 欄位 |
| 5 | BUG-4 (Processing tab) | 高 | trace service + 數據寫入 + 權限 |
| 6 | BUG-7 (User name) | 低 | 僅開發環境 |

---

## 測試驗證

修復完成後需驗證：

- [ ] Status 卡片正確顯示 "Full Review"（非原始 key）
- [ ] Confidence 卡片顯示百分比數值
- [ ] Extracted Fields 頁籤顯示提取欄位列表
- [ ] Processing 頁籤顯示處理步驟時間線
- [ ] Preview 頁籤正確顯示 PDF 預覽
- [ ] Download 按鈕可點擊並下載文件
- [ ] 多語言切換後各項內容正確翻譯（en / zh-TW / zh-CN）

---

*文件建立日期: 2026-01-28*
*最後更新: 2026-01-28*
