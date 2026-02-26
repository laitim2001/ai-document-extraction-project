# FIX-045: Template Matching 欄位 key 不匹配 — `fields` Record 在 V3.1 結果鏈中被丟棄

> **建立日期**: 2026-02-24
> **發現方式**: FIX-044 Phase 1 完成後，重新處理文件仍無法匹配
> **影響頁面/功能**: Template Instance 欄位值 → Template Field Mapping → Template Matching 整條鏈路
> **優先級**: P0 (Critical)
> **狀態**: ✅ 已完成
> **前置修復**: FIX-044（已 commit `23258a9`，`ExtractionResult.fieldMappings` 不再為空）
> **相關**: CHANGE-021（V3 管線）、CHANGE-042（FieldDefinitionSet 動態欄位）

---

## 問題描述

FIX-044 修復了 `ExtractionResult.fieldMappings` 為空的問題，現在 `fieldMappings` 有數據，但 **Template Instance 的 `fieldValues` 仍為 `{}`**。

原因是 FIX-044 使用 `standardFields`（camelCase key，如 `invoiceNumber`）建構 `mappedFields`，但 Template Field Mapping 的 `sourceField` 引用的是 FieldDefinitionSet 的原始 key（snake_case，如 `invoice_number`）。兩邊 key 命名不一致，導致 `transformFields()` 查找時全部返回 `undefined`。

### DB 驗證數據

以 template instance `cmm0powal0008zkxgafspq9l8` 為例：

```
ExtractionResult.fieldMappings keys (FIX-044 產出):
  → invoiceNumber, invoiceDate, dueDate, currency, vendorName  ← camelCase

TemplateFieldMapping.sourceField (用戶配置):
  → invoice_number, forwarder_name, document_type             ← snake_case (FieldDefinitionSet key)

template-matching-engine.ts transformFields():
  sourceFields["invoice_number"] = undefined  ← ❌ MISMATCH
```

### 影響範圍

| 項目 | 影響 |
|------|------|
| Template Instance fieldValues | 永遠為 `{}`，所有匹配欄位值為空 |
| Template Export (Excel) | 匯出欄位全為空 |
| 任何依賴 TemplateFieldMapping sourceField 查找 fieldMappings 的邏輯 | 均受影響 |

---

## 根本原因

### 設計時序衝突

兩個不同時期設計的子系統使用了不同的 key 命名慣例：

| 子系統 | 設計時間 | Key 格式 | 範例 | 定義位置 |
|--------|----------|----------|------|----------|
| `StandardFieldsV3` | CHANGE-021（早期） | camelCase，固定 8 欄位 | `invoiceNumber` | `extraction-v3.types.ts:236` |
| `FieldDefinitionSet` | CHANGE-042（後期） | 用戶自定義（通常 snake_case） | `invoice_number` | DB: `FieldDefinition.fieldKey` |

### 數據丟失點

CHANGE-042 在 `Stage3ExtractionResult` 中新增了 `fields: Record<string, FieldValue>`（保留 FieldDefinitionSet 原始 key），但這個 Record **在 `extraction-v3.service.ts:630` 被丟棄了**，因為下游的 `ValidatedExtractionResult`（繼承自 `UnifiedExtractionResult`）型別中沒有 `fields` 屬性。

### 完整數據流追蹤

```
[Stage 3: GPT 回傳]
  GPT output: { fields: { invoice_number: {value: "INV-001"}, ... } }
                        ↑ 保留 FieldDefinitionSet 的 key (snake_case)

[stage-3-extraction.service.ts:992 — parseExtractionResult()]
  Case 1 (有 fields key):
  ├── fields = { invoice_number: {...} }                      ← 原始 key ✅
  └── standardFields = buildStandardFieldsFromRecord(fields)
      = { invoiceNumber: {...} }                              ← 強制轉 camelCase

[Stage3ExtractionResult]  (extraction-v3.types.ts:1190)
  ├── fields?: Record<string, FieldValue>                     ← 原始 key 仍在 ✅
  ├── standardFields: StandardFieldsV3                        ← camelCase
  └── customFields?: Record<string, FieldValue>

[extraction-v3.service.ts:630 — 建構 V3.1 Output]
  result: {
    standardFields: stage3.standardFields,                    ← camelCase 被傳遞
    customFields: stage3.customFields,
    // ❌ stage3.fields 未被傳遞！在此被丟棄！
  }

[ValidatedExtractionResult]  (extraction-v3.types.ts:377)
  extends UnifiedExtractionResult (line 323):
  ├── standardFields: StandardFieldsV3                        ← 只有 camelCase
  ├── customFields?: Record<string, FieldValue>
  └── (沒有 fields 屬性)                                      ← ❌ 原始 key 已丟失

[unified-document-processor.service.ts — convertV3Result()]
  → convertStandardFieldsToMappedFields(result.standardFields)
  → mappedFields: [{ targetField: "invoiceNumber", ... }]     ← camelCase key

[processing-result-persistence.service.ts:107 — convertMappedFieldsToJson()]
  fieldMappings[field.targetField] = { value, rawValue, ... }
  → DB: ExtractionResult.fieldMappings = { invoiceNumber: {...} }  ← camelCase key

[template-matching-engine.service.ts:635 — extractMappedFields()]
  讀取 fieldMappings → sourceFields = { invoiceNumber: "INV-001" }  ← camelCase

[template-matching-engine.service.ts:436 — transformFields()]
  mapping.sourceField = "invoice_number"                       ← FieldDefinitionSet key
  sourceFields["invoice_number"] = undefined                   ← ❌ MISMATCH!
  → result = {} → TemplateInstanceRow.fieldValues = {}         ← 空！
```

---

## 修復方案

### 策略：補上 CHANGE-042 遺漏的 `fields` 數據通道

修復思路很簡單：讓 Stage 3 的 `fields` Record（保留原始 FieldDefinitionSet key）一路傳遞到 `convertStandardFieldsToMappedFields()`，使 `mappedFields` 使用原始 key 而非 camelCase。

### 修改檔案清單（3 個，每個改動很小）

| # | 檔案 | 改動內容 | 改動量 |
|---|------|----------|--------|
| 1 | `src/types/extraction-v3.types.ts` | `UnifiedExtractionResult` 加入 `fields?` 屬性 | +2 行 |
| 2 | `src/services/extraction-v3/extraction-v3.service.ts` | 傳遞 `stage3.fields` | +1 行 |
| 3 | `src/services/unified-processor/unified-document-processor.service.ts` | 修改 `convertStandardFieldsToMappedFields()` 優先使用 `fields` | ~10 行 |

### 詳細修改內容

#### 修改 1: `src/types/extraction-v3.types.ts`

**位置**: `UnifiedExtractionResult` interface（line 323）

在 `customFields` 之後新增可選的 `fields` 屬性：

```typescript
export interface UnifiedExtractionResult {
  issuerIdentification: IssuerIdentificationResultV3;
  formatIdentification: FormatIdentificationResultV3;
  standardFields: StandardFieldsV3;
  customFields?: Record<string, FieldValue>;
  /** FIX-045: Stage 3 原始欄位 Record（保留 FieldDefinitionSet key） */
  fields?: Record<string, FieldValue>;
  lineItems: LineItemV3[];
  extraCharges?: ExtraChargeV3[];
  overallConfidence: number;
  metadata: ExtractionMetadataV3;
}
```

**影響分析**:
- `fields` 是可選屬性（`?`），不影響任何現有的 `UnifiedExtractionResult` 或 `ValidatedExtractionResult` 使用者
- `Stage3ExtractionResult` 已有同名的 `fields?: Record<string, FieldValue>`（line 1204），保持一致

#### 修改 2: `src/services/extraction-v3/extraction-v3.service.ts`

**位置**: V3.1 結果建構（line 630）

在 `customFields` 之後新增一行：

```typescript
result: threeStageResult.stage3 ? {
  standardFields: threeStageResult.stage3.standardFields,
  customFields: threeStageResult.stage3.customFields,
  fields: threeStageResult.stage3.fields,        // ← FIX-045: 傳遞原始 key
  lineItems: threeStageResult.stage3.lineItems,
  // ... 其餘不變
} : undefined,
```

#### 修改 3: `src/services/unified-processor/unified-document-processor.service.ts`

**位置 A**: `convertV3Result()` 中呼叫 `convertStandardFieldsToMappedFields()`（line 418）

修改呼叫方式，優先傳遞 `result.fields`：

```typescript
// FIX-045: 優先使用 fields（保留 FieldDefinitionSet 原始 key），
// fallback 到 standardFields（camelCase，無 FieldDefinition 時）
mappedFields: this.convertStandardFieldsToMappedFields(
  result.fields ?? null,
  { ...result.standardFields },
  result.customFields ? { ...result.customFields } : undefined
),
```

**位置 B**: `convertStandardFieldsToMappedFields()` 函數簽名和邏輯（line 496）

修改為優先使用 `fields`，fallback 到 `standardFields`：

```typescript
/**
 * 將 V3.1 欄位轉為 V2 MappedFieldValue[] 格式
 * @private
 * @since FIX-044 (initial), FIX-045 (fields priority)
 * @description
 *   優先使用 Stage 3 的 fields Record（保留 FieldDefinitionSet 原始 key），
 *   如果不存在（無 FieldDefinition 配置時），fallback 到 standardFields（camelCase）。
 */
private convertStandardFieldsToMappedFields(
  fields: Record<string, { value: string | number | null; confidence: number }> | null,
  standardFields: Record<string, { value: string | number | null; confidence: number; source?: string }>,
  customFields?: Record<string, { value: string | number | null; confidence: number }> | undefined
): MappedFieldValue[] {
  const mappedFields: MappedFieldValue[] = [];

  // 優先使用 fields（原始 FieldDefinitionSet key）
  const primarySource = fields ?? standardFields;

  for (const [key, fieldValue] of Object.entries(primarySource)) {
    if (fieldValue && typeof fieldValue === 'object' && 'value' in fieldValue) {
      mappedFields.push({
        targetField: key,
        value: fieldValue.value,
        sourceFields: [key],
        originalValues: [fieldValue.value],
        transformType: 'DIRECT' as TransformType,
        success: fieldValue.value !== null && fieldValue.value !== undefined,
      });
    }
  }

  // 如果使用了 fields，則 customFields 已包含在內（Stage 3 的 fields 包含所有欄位）
  // 僅在 fallback 到 standardFields 時才需要額外處理 customFields
  if (!fields && customFields) {
    for (const [key, fieldValue] of Object.entries(customFields)) {
      if (fieldValue && typeof fieldValue === 'object' && 'value' in fieldValue) {
        mappedFields.push({
          targetField: key,
          value: fieldValue.value,
          sourceFields: [key],
          originalValues: [fieldValue.value],
          transformType: 'DIRECT' as TransformType,
          success: fieldValue.value !== null && fieldValue.value !== undefined,
        });
      }
    }
  }

  return mappedFields;
}
```

**位置 C**: `stage3Result` 儲存也加入 `fields`（line 474）

```typescript
stage3Result: v3Result.result ? {
  success: true,
  fieldCount: Object.keys(result.standardFields || {}).length,
  lineItemCount: result.lineItems?.length || 0,
  overallConfidence: result.overallConfidence,
  standardFields: { ...result.standardFields },
  customFields: result.customFields ? { ...result.customFields } : undefined,
  fields: result.fields ? { ...result.fields } : undefined,  // ← FIX-045
  lineItems: result.lineItems ? [...result.lineItems] : undefined,
} : undefined,
```

---

## 修復後數據流

```
[Stage 3: GPT 回傳]
  GPT output: { fields: { invoice_number: {value: "INV-001"}, ... } }

[parseExtractionResult()]
  ├── fields = { invoice_number: {...} }             ← 原始 key
  └── standardFields = { invoiceNumber: {...} }      ← camelCase（向下兼容）

[Stage3ExtractionResult]
  ├── fields: { invoice_number: {...} }              ← 原始 key ✅
  └── standardFields: { invoiceNumber: {...} }

[extraction-v3.service.ts — V3.1 Output]
  result: {
    standardFields: { invoiceNumber: {...} },
    fields: { invoice_number: {...} },               ← ✅ FIX-045: 現在傳遞了
  }

[convertV3Result()]
  extractedData ← 仍使用 standardFields                ← 前端顯示不變
  mappedFields ← 使用 fields（原始 key）                ← ✅ 修復點

[DB: ExtractionResult.fieldMappings]
  { invoice_number: {...}, vendor_name: {...} }      ← ✅ 原始 key

[template-matching-engine.ts — extractMappedFields()]
  sourceFields = { invoice_number: "INV-001" }       ← ✅ 原始 key

[transformFields()]
  mapping.sourceField = "invoice_number"              ← FieldDefinitionSet key
  sourceFields["invoice_number"] = "INV-001"          ← ✅ MATCH!
  → TemplateInstanceRow.fieldValues = { "Invoice Number": "INV-001" }  ← ✅
```

---

## 向下兼容分析

| 場景 | 影響 | 說明 |
|------|------|------|
| V3 模式（非 V3.1） | 無影響 | V3 不走 Stage 3，不產生 `fields` |
| V3.1 無 FieldDefinitionSet | 無影響 | `fields` 為 `null`，fallback 到 `standardFields`（camelCase） |
| V3.1 有 FieldDefinitionSet | ✅ 修復 | `fields` 有值，使用原始 key |
| 前端顯示（extractedData） | 無影響 | `extractedData` 仍使用 `standardFields` 建構 |
| 已存在的 DB 資料 | 無影響 | 舊資料仍為 camelCase，需**重新處理文件**才會更新 |

---

## 驗證步驟

### 自動驗證

```bash
npm run type-check     # TypeScript 編譯通過（確認新增的 fields 屬性向下兼容）
```

### 手動驗證

1. **重新處理文件**: 在 UI 上重新上傳或重新處理一張發票（確保有 FieldDefinitionSet 配置）
2. **DB 驗證 fieldMappings key**:
   ```sql
   SELECT "fieldMappings" FROM "extraction_results"
   WHERE "document_id" = '<新處理的文件 ID>';
   -- 預期: key 為 snake_case (invoice_number, vendor_name, ...)
   -- 而非 camelCase (invoiceNumber, vendorName, ...)
   ```
3. **Template Matching 驗證**:
   ```sql
   SELECT "fieldValues" FROM "template_instance_rows"
   WHERE "templateInstanceId" = '<對應的 instance ID>';
   -- 預期: 不再為 {}，包含實際欄位值
   ```
4. **UI 驗證**: Template Instance 頁面欄位值不再為 "-"

---

## 風險評估

| 風險 | 嚴重度 | 緩解措施 |
|------|--------|----------|
| `fields` 可選屬性，型別兼容性 | 極低 | `fields?` 不影響現有代碼 |
| V3.1 無 FieldDefinition 時 `fields` 為 null | 無 | fallback 到 `standardFields` |
| 已處理文件的 fieldMappings 仍為 camelCase | 低 | 重新處理文件即可更新，非 breaking change |
| `extractedData` 前端顯示受影響 | 無 | `extractedData` 建構邏輯完全不變 |

---

## 後續建議（非本次修復範圍）

1. **歷史數據回填**: 已用 FIX-044 處理過的文件，其 `fieldMappings` 仍為 camelCase key。可考慮寫一個 backfill script 從 `stage3Result.fields` 回填。
2. **StandardFieldsV3 定位重新審視**: 長期來看，`StandardFieldsV3`（固定 8 欄位 camelCase）的角色應逐步退化為「向下兼容層」，主要數據流應以 `fields`（動態 FieldDefinitionSet key）為主。
3. **`persistV3_1ProcessingResult()` 啟用**: `processing-result-persistence.service.ts:458` 已有專用的 V3.1 持久化函數但從未被呼叫，日後可考慮切換。
