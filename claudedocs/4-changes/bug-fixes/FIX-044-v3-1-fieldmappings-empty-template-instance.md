# FIX-044: V3.1 提取結果 fieldMappings 為空 — Template Instance 欄位值全為 "-"

> **建立日期**: 2026-02-24
> **發現方式**: Template Instance 頁面 UI 驗證
> **影響頁面/功能**: Template Instance 列表 + Template Matching 整條鏈路
> **優先級**: P0 (Critical)
> **狀態**: ✅ 已完成（代碼修改 + type-check 通過，待上傳文件驗證）
> **相關**: CHANGE-021（V3 純 GPT Vision 管線）、CHANGE-042（FieldDefinition 動態化）

---

## 問題描述

Template Instance 頁面中所有已處理文件的欄位值均顯示 "-"（空值）。經調查，`TemplateInstanceRow.fieldValues` 為 `{}`，追溯到 `ExtractionResult.fieldMappings` 也為 `{}`（空 JSON 物件）。

儘管 Stage 3 GPT 提取成功（`stage3Result` 有 `fieldCount: 8`, `overallConfidence: 93`），但提取出的 standardFields 數據在持久化過程中被丟失。

### 影響範圍

| 項目 | 影響 |
|------|------|
| Template Instance 頁面 | 所有 V3.1 處理的文件欄位值為空 |
| Template Matching | `extractMappedFields()` 讀取空 `fieldMappings`，無法產出有效匹配 |
| Template Export (Excel) | 匯出的 Excel 所有欄位為空 |
| 所有讀取 `fieldMappings` 的下游服務 | 均受影響 |

---

## 重現步驟

1. 上傳一張發票（觸發 V3.1 提取管線）
2. 確認 Stage 3 提取成功（Processing tab 顯示 COMPLETED）
3. 前往 Template Instance 頁面
4. 觀察：所有欄位值顯示 "-"

**DB 直接驗證**:
```sql
SELECT "fieldMappings" FROM "extraction_results" WHERE "document_id" = '...';
-- 結果: {}
```

---

## 根本原因

### 完整根因鏈

```
Upload Route (route.ts:383)
  → calls V2 persistProcessingResult()      ← 始終呼叫 V2 版本
    → reads result.mappedFields              ← V3.1 結果沒有填入此欄位！
      → result.mappedFields = undefined
        → convertMappedFieldsToJson([]) → {}
          → ExtractionResult.fieldMappings = {} ← 空！
```

### Bug 1（核心問題）: `convertV3Result()` 未填入 `mappedFields`

**位置**: `src/services/unified-processor/unified-document-processor.service.ts` line 308-474

`convertV3Result()` 負責將 V3.1 `ExtractionV3Output` 轉換為 `UnifiedProcessingResult`。它正確地將 `standardFields` 轉為 `extractedData`（用於前端即時顯示），但**從未填入** `mappedFields` 欄位（`MappedFieldValue[]`），導致後續 `persistProcessingResult()` 讀到空陣列。

### Bug 2（次要問題）: `stage3Result` 只存摘要

**位置**: 同文件 line 467-472

`stage3Result` 只保存 4 個摘要欄位（`success`, `fieldCount`, `lineItemCount`, `overallConfidence`），丟失了完整的 `standardFields`、`customFields`、`lineItems` 數據，使得事後回填變得困難。

### Bug 3（未呼叫的函數）: `persistV3_1ProcessingResult()` 已定義但從未被呼叫

**位置**: `src/services/processing-result-persistence.service.ts` line 458

此函數可正確處理 V3.1 結果（包含 `fieldMappings` 轉換邏輯），但 upload route 始終呼叫 V2 版本 `persistProcessingResult()`。

---

## 修復方案

### 選擇：方案 A — 在轉換層修復

在 `convertV3Result()` 中將 V3.1 `standardFields` 轉換為 V2 `MappedFieldValue[]` 格式並填入 `mappedFields`。

**優勢**:
- 改動最小（僅 1 個文件 1 個函數）
- 不改動呼叫鏈（upload route 不需修改）
- V2 `persistProcessingResult()` 自動得到正確數據
- `fieldMappings` 成為所有版本的統一數據出口
- 低耦合：下游不需知道資料來自 V2 或 V3.1

### 修改檔案

**僅修改 1 個檔案**: `src/services/unified-processor/unified-document-processor.service.ts`

### 修改內容

#### 1. 新增 `convertStandardFieldsToMappedFields()` private method

將 V3.1 `StandardFieldsV3`（`Record<string, FieldValue>`）轉為 V2 `MappedFieldValue[]` 格式。

每個 standardField entry 轉換邏輯：
```
{ key: "invoiceNumber", value: { value: "INV-001", confidence: 95 } }
  → { targetField: "invoiceNumber", value: "INV-001", sourceFields: ["invoiceNumber"],
      originalValues: ["INV-001"], transformType: "DIRECT", success: true }
```

#### 2. 在 `convertV3Result()` return 中加入 `mappedFields`

在已有的 `extractedData` 後面加入：
```typescript
mappedFields: this.convertStandardFieldsToMappedFields(result.standardFields, result.customFields),
```

#### 3. 修正 `stage3Result` 存儲完整數據（附帶修復）

將 `stage3Result` 從僅存 4 個摘要欄位改為保留完整 `standardFields`、`customFields`、`lineItems`。

---

## 修復後數據流

```
Upload Route (route.ts:383)
  → processor.processFile()
    → convertV3Result()
      → mappedFields = convertStandardFieldsToMappedFields(standardFields) ← 新增
  → persistProcessingResult()
    → result.mappedFields → [8 個 MappedFieldValue] ← 有數據了
      → convertMappedFieldsToJson() → { invoiceNumber: {...}, invoiceDate: {...}, ... }
        → ExtractionResult.fieldMappings = { invoiceNumber, invoiceDate, ... } ✅
```

Template Matching 自動生效：
```
autoTemplateMatchingService.autoMatch()
  → templateMatchingEngine.extractMappedFields()
    → ExtractionResult.fieldMappings → { invoiceNumber: "INV-001", ... } ✅
      → TemplateInstanceRow.fieldValues = { "Invoice Number": "INV-001", ... } ✅
```

---

## 驗證步驟

1. `npm run type-check` — TypeScript 編譯通過
2. 重新上傳/處理一張 DHL 發票
3. DB 驗證：`ExtractionResult.fieldMappings` 不再為 `{}`
4. Template Matching 驗證：`TemplateInstanceRow.fieldValues` 有數據
5. UI 驗證：Template Instance 頁面顯示實際欄位值

---

## 備註

- 已處理的 V3.1 文件需要**重新處理**才能填入 `fieldMappings`（無法自動 backfill）
- 日後可考慮將 upload route 切換至 `persistV3_1ProcessingResult()`，但非本次修復範圍
