# CHANGE-045: FieldDefinitionSet 欄位類型區分與 Line Item 動態生成

> **日期**: 2026-02-25
> **狀態**: ⏳ 待實作
> **優先級**: High
> **類型**: Feature
> **影響範圍**: FieldDefinitionSet 模型/UI、Stage 3 提取服務、SourceFieldCombobox、Template Field Mapping、i18n
> **前置條件**: CHANGE-042（動態欄位定義集）已完成

---

## 變更背景

### 現況問題

1. **FieldDefinitionSet 無法區分欄位類型**: 目前 `FieldDefinitionEntry` 只有 `category` 屬性做邏輯分類，無法區分「標準欄位」（如 invoice_number）與「Line Item 費用欄位」（如 freight_charges, terminal_handling_charge）。

2. **li_* 偽欄位硬編碼，與 FieldDefinitionSet 脫節**: CHANGE-043 新增的 `LINE_ITEM_SUGGESTIONS` 是 12 個固定分類（ocean_freight, thc 等），完全不讀取用戶在 FieldDefinitionSet 中定義的費用欄位。用戶在 FieldDefinitionSet 定義了 `freight_charges`，但在 Template Field Mapping 的來源欄位選擇器中看到的卻是 `li_ocean_freight_total` — 兩者毫無關聯。

3. **extraCharges 造成 GPT 冗餘輸出**: Stage 3 Output Schema 中的 `extraCharges` 可選欄位導致 GPT 將 lineItems 的聚合摘要重複放入 extraCharges，增加了 Token 消耗且無實際業務價值。

### 用戶場景（以 CEVA 發票為例）

```
發票中的費用項目:
├─ Freight Charges                      → 13,731.45 HKD
├─ Terminal Handling Charge (2 行合計)  → 1,711.40 HKD
├─ Cleaning at Destination (2 行合計)   →   492.54 HKD
├─ Delivery Order Fee                   →   417.43 HKD
└─ Handling & Processing                →   125.25 HKD

用戶在 FieldDefinitionSet 中定義:
├─ freight_charges (Number)             ← 這是 Line Item 費用欄位
├─ terminal_handling_charge (Number)    ← 這是 Line Item 費用欄位
├─ cleaning_at_destionation (Number)    ← 這是 Line Item 費用欄位
├─ delivery_order_fee (Number)          ← 這是 Line Item 費用欄位
└─ handling_and_processing (Number)     ← 這是 Line Item 費用欄位

期望：
1. 這些欄位在 FieldDefinitionSet 中能被標記為 "lineItem" 類型
2. 在 Template Field Mapping 的來源欄位選擇器中，這些欄位出現在「Line Item 費用」分類下
3. Stage 3 不再輸出冗餘的 extraCharges
```

---

## 變更內容

### Phase 1: FieldDefinitionEntry 新增 `fieldType` 屬性

在 `FieldDefinitionEntry` 介面中新增 `fieldType` 欄位，區分標準欄位與 Line Item 費用欄位。

```typescript
// 新增欄位類型
type FieldDefinitionFieldType = 'standard' | 'lineItem';

interface FieldDefinitionEntry {
  key: string;
  label: string;
  category: string;
  dataType: 'string' | 'number' | 'date' | 'currency';
  required: boolean;
  description?: string;
  aliases?: string[];
  extractionHints?: string;
  fieldType?: FieldDefinitionFieldType;  // 新增，預設 'standard'
}
```

- **向後相容**: `fieldType` 為可選欄位，預設 `'standard'`
- **無需 DB 遷移**: `fields` 是 JSON 欄位，直接支援新屬性

### Phase 2: FieldDefinitionSet UI 支援欄位類型選擇

在 FieldDefinitionSet 編輯表單中新增 `fieldType` 選擇器：

```
┌──────────────────────────────────────────────────────────────┐
│  欄位定義                                                     │
│                                                                │
│  Key: freight_charges                                          │
│  Label: Freight Charges                                        │
│  Data Type: Number                                             │
│  Category: Basic Info                                          │
│  Field Type: ○ Standard  ● Line Item    ← 新增                │
│  Required: ☑                                                   │
└──────────────────────────────────────────────────────────────┘
```

### Phase 3: SourceFieldCombobox 動態生成 Line Item 選項

修改 `SourceFieldCombobox`，當 FieldDefinitionSet 存在 `fieldType: 'lineItem'` 的欄位時：
- 將這些欄位顯示在「Line Item 費用」分類下
- **隱藏**硬編碼的 `LINE_ITEM_SUGGESTIONS`（li_* 偽欄位）

```
修改前（硬編碼 li_*）:                   修改後（從 FieldDefinitionSet 動態生成）:
┌───────────────────────────┐           ┌───────────────────────────┐
│ Line Item Charges (li_*)  │           │ Line Item 費用            │
│ ├─ li_ocean_freight_total │           │ ├─ freight_charges        │
│ ├─ li_ocean_freight_count │           │ ├─ terminal_handling_chg  │
│ ├─ li_thc_total           │  ──────>  │ ├─ cleaning_at_dest      │
│ ├─ li_thc_count           │           │ ├─ delivery_order_fee     │
│ ├─ li_customs_brok_total  │           │ └─ handling_and_proc      │
│ └─ ... (24 個固定選項)    │           │   (來自 FieldDefinitionSet) │
└───────────────────────────┘           └───────────────────────────┘
```

**優先級邏輯**:
1. 若 FieldDefinitionSet 有 `fieldType: 'lineItem'` 的欄位 → 顯示這些，隱藏 li_*
2. 若 FieldDefinitionSet 無 lineItem 欄位 → 回退到硬編碼 `LINE_ITEM_SUGGESTIONS`

### Phase 4: 移除 Stage 3 Schema 中的 `extraCharges`

從 Stage 3 Output Schema 中移除 `extraCharges` 陣列，減少 GPT 冗餘輸出。

**移除範圍**:
- Stage 3 JSON Schema 定義（不再請求 GPT 輸出 extraCharges）
- `ExtraChargeV3` 類型定義（標記 deprecated 或移除）
- 下游消費者（術語記錄、聚合轉換、UI 選項）

---

## 技術設計

### 修改範圍

| 文件 | Phase | 變更內容 |
|------|-------|----------|
| `src/types/extraction-v3.types.ts` | 1,4 | 新增 `fieldType` 到 `FieldDefinitionEntry`；移除/deprecated `ExtraChargeV3` |
| `src/lib/validations/field-definition-set.schema.ts` | 1 | `fieldDefinitionEntrySchema` 新增 `fieldType` 驗證 |
| `src/components/features/field-definition-set/FieldDefinitionSetForm.tsx` | 2 | 新增 fieldType 選擇器 UI |
| `src/services/mapping/source-field.service.ts` | 3 | 新增從 FieldDefinitionEntry[] 篩選 lineItem 欄位的函數 |
| `src/components/features/formats/SourceFieldCombobox.tsx` | 3 | 優先顯示 FieldDefinitionSet lineItem 欄位，條件隱藏 li_* |
| `src/services/extraction-v3/stages/stage-3-extraction.service.ts` | 4 | 移除 `extraCharges` Schema 定義和 Prompt 注入 |
| `src/services/extraction-v3/extraction-v3.service.ts` | 4 | 移除 extraCharges 結果組裝 |
| `src/services/unified-processor/steps/term-recording.step.ts` | 4 | 移除 extraCharges 術語提取 |
| `src/services/transform/aggregate.transform.ts` | 4 | 移除 extraCharges 聚合源 |
| `src/components/features/template-field-mapping/TransformConfigEditor.tsx` | 4 | 移除 extraCharges SelectItem |

### i18n 影響

| 語言 | 文件 | 需要更新的 Key |
|------|------|---------------|
| en | `messages/en/fieldDefinitionSet.json` | `form.fieldType`, `form.fieldTypeStandard`, `form.fieldTypeLineItem` |
| zh-TW | `messages/zh-TW/fieldDefinitionSet.json` | 同上 |
| zh-CN | `messages/zh-CN/fieldDefinitionSet.json` | 同上 |
| en | `messages/en/templateFieldMapping.json` | 移除 `aggregate.sourceExtraCharges` |
| zh-TW | `messages/zh-TW/templateFieldMapping.json` | 同上 |
| zh-CN | `messages/zh-CN/templateFieldMapping.json` | 同上 |

### 資料庫影響

**無需 Prisma 遷移**。`FieldDefinitionSet.fields` 是 `Json` 欄位，直接存儲 `FieldDefinitionEntry[]`，新增 `fieldType` 屬性自動支援。

---

## 設計決策

1. **使用 `fieldType` 字串聯合型而非 `isLineItem` 布林值** — 未來可能擴展更多欄位類型（如 `summary`, `metadata`），字串聯合型更具擴展性

2. **`fieldType` 設為可選，預設 `'standard'`** — 向後相容現有的 FieldDefinitionSet 資料，無需 data migration

3. **優先級策略：FieldDefinitionSet lineItem > 硬編碼 li_*** — 當 FieldDefinitionSet 包含 lineItem 欄位時，完全取代硬編碼選項；無 lineItem 欄位時回退到 li_*，確保不影響未設定 FieldDefinitionSet 的用戶

4. **移除 extraCharges 而非改為條件性包含** — extraCharges 的資料在 lineItems 和 fields 中已完整涵蓋，沒有獨立價值。移除可節省 GPT Token 並避免混淆

---

## 影響範圍評估

### 文件影響清單

| 文件路徑 | 類型 | Phase | 說明 |
|----------|------|-------|------|
| `src/types/extraction-v3.types.ts` | 🔧 修改 | 1,4 | 新增 fieldType、deprecated ExtraChargeV3 |
| `src/lib/validations/field-definition-set.schema.ts` | 🔧 修改 | 1 | Zod schema 新增 fieldType |
| `src/components/features/field-definition-set/FieldDefinitionSetForm.tsx` | 🔧 修改 | 2 | 新增 fieldType 選擇器 |
| `src/services/mapping/source-field.service.ts` | 🔧 修改 | 3 | 新增 lineItem 欄位篩選 |
| `src/components/features/formats/SourceFieldCombobox.tsx` | 🔧 修改 | 3 | 條件顯示 lineItem 欄位 |
| `src/services/extraction-v3/stages/stage-3-extraction.service.ts` | 🔧 修改 | 4 | 移除 extraCharges Schema |
| `src/services/extraction-v3/extraction-v3.service.ts` | 🔧 修改 | 4 | 移除 extraCharges 組裝 |
| `src/services/unified-processor/steps/term-recording.step.ts` | 🔧 修改 | 4 | 移除 extraCharges 術語 |
| `src/services/transform/aggregate.transform.ts` | 🔧 修改 | 4 | 移除 extraCharges 源 |
| `src/components/features/template-field-mapping/TransformConfigEditor.tsx` | 🔧 修改 | 4 | 移除 UI 選項 |
| `messages/{en,zh-TW,zh-CN}/fieldDefinitionSet.json` | 🔧 修改 | 2 | 新增 fieldType 翻譯 |
| `messages/{en,zh-TW,zh-CN}/templateFieldMapping.json` | 🔧 修改 | 4 | 移除 extraCharges 翻譯 |

### 向後兼容性

- **Phase 1**: 完全向後相容 — `fieldType` 為可選，預設 `'standard'`，現有資料無需修改
- **Phase 2**: 向後相容 — UI 新增選項，不影響現有功能
- **Phase 3**: 向後相容 — 無 lineItem 欄位時回退到硬編碼 li_*
- **Phase 4**: **需注意** — 現有使用 `extraCharges` 作為聚合源的 Template Field Mapping 規則會失效。建議在 UI 中標記並通知用戶

---

## 實施計劃

### Phase 1: FieldDefinitionEntry 新增 fieldType（影響 2 文件）

1. 修改 `src/types/extraction-v3.types.ts` — `FieldDefinitionEntry` 新增 `fieldType`
2. 修改 `src/lib/validations/field-definition-set.schema.ts` — Zod schema 新增 `fieldType`
3. 驗證：`npm run type-check`

### Phase 2: UI 支援（影響 2 文件 + 3 i18n）

1. 修改 `FieldDefinitionSetForm.tsx` — 新增 fieldType 選擇器
2. 更新 i18n（3 語言 fieldDefinitionSet.json）
3. 驗證：瀏覽器中測試 FieldDefinitionSet 編輯

### Phase 3: 動態 Line Item 來源欄位（影響 2 文件）

1. 修改 `source-field.service.ts` — 新增 lineItem 欄位篩選函數
2. 修改 `SourceFieldCombobox.tsx` — 條件顯示 lineItem 欄位
3. 驗證：Template Field Mapping 頁面中確認來源欄位選項

### Phase 4: 移除 extraCharges（影響 6 文件 + 3 i18n）

1. 修改 Stage 3 extraction service — 移除 extraCharges Schema 和 Prompt
2. 修改 extraction-v3 service — 移除 extraCharges 組裝
3. 修改 term-recording step — 移除 extraCharges 術語提取
4. 修改 aggregate transform — 移除 extraCharges 源
5. 修改 TransformConfigEditor — 移除 UI 選項
6. 更新 i18n（3 語言 templateFieldMapping.json）
7. 修改類型定義 — deprecated ExtraChargeV3
8. 驗證：`npm run type-check` + `npm run lint` + 重新提取文件

---

## 驗收標準

| # | 驗收項目 | 驗收標準 | 優先級 |
|---|----------|----------|--------|
| 1 | fieldType 屬性 | FieldDefinitionEntry 可設定 `fieldType: 'standard' \| 'lineItem'`，預設 'standard' | High |
| 2 | UI 選擇器 | FieldDefinitionSet 編輯表單中可選擇欄位類型 | High |
| 3 | 動態 Line Item 選項 | 當 FieldDefinitionSet 有 lineItem 欄位時，SourceFieldCombobox 顯示這些欄位 | High |
| 4 | 隱藏硬編碼 li_* | 當 FieldDefinitionSet 有 lineItem 欄位時，不顯示 LINE_ITEM_SUGGESTIONS | High |
| 5 | 回退機制 | 無 FieldDefinitionSet lineItem 欄位時，仍顯示硬編碼 li_* | Medium |
| 6 | extraCharges 移除 | Stage 3 不再請求 GPT 輸出 extraCharges | Medium |
| 7 | 向後相容 | 現有 FieldDefinitionSet 資料正常運作 | High |
| 8 | TypeScript 編譯 | `npm run type-check` 通過 | High |

## 測試場景

| # | 場景 | 測試步驟 | 預期結果 |
|---|------|----------|----------|
| 1 | 新增 lineItem 欄位 | 在 FieldDefinitionSet 中新增一個 fieldType='lineItem' 的欄位 | 保存成功，API 返回包含 fieldType 的欄位 |
| 2 | 舊資料相容 | 讀取無 fieldType 的舊 FieldDefinitionSet | fieldType 預設為 'standard'，UI 正常顯示 |
| 3 | 來源欄位選擇器 | 打開有 lineItem 欄位的 FieldDefinitionSet 對應的 Template Field Mapping | SourceFieldCombobox 顯示 lineItem 欄位分類，不顯示 li_* |
| 4 | 回退到 li_* | 打開無 lineItem 欄位的 Template Field Mapping | SourceFieldCombobox 顯示硬編碼 li_* 選項 |
| 5 | 重新提取文件 | 使用修改後的 Stage 3 重新提取 CEVA 發票 | 結果中無 extraCharges，fields 正常提取 |

---

## 風險評估

| 風險 | 嚴重度 | 緩解措施 |
|------|--------|----------|
| 現有 Template Mapping 使用 extraCharges 聚合源 | 中 | Phase 4 實施前檢查是否有 Template 使用此功能 |
| GPT 可能在無 extraCharges Schema 時自行添加 | 低 | Structured Output 模式下 GPT 嚴格遵循 Schema |
| 術語記錄喪失 extraCharges 術語來源 | 低 | lineItems 的 classifiedAs 已覆蓋相同術語 |
| fieldType 導致現有 API 消費者問題 | 無 | 可選欄位，完全向後相容 |
