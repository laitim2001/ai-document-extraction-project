# 架構設計分析：Line Item → Column Mapping（Pivot 模式）

> **建立日期**: 2026-02-25
> **評估類型**: 多 Agent 協作架構分析
> **參與者**: Business Analyst / Software Architect / Data Flow Analyst
> **前置文件**: `2026-02-25-ARCH-template-instance-line-item-expansion.md`（方案 A 已否決）
> **狀態**: 待決策

---

## 0. 背景：為什麼方案 A（展開為多行）被否決

### 用戶實際 Excel 模板格式

用戶使用的 Excel 模板是 **1 行 = 1 shipment**，費用類型作為固定列：

```
Shipment # | Date       | Custom fees 1 | Custom fees 2 | THC    | Ocean Freight | Insurance | ...
SHP-001    | 2026-01-15 | 120.00        | 80.00         | 200.00 | 500.00        | 70.00     | ...
SHP-002    | 2026-01-16 | 95.00         | 0             | 180.00 | 480.00        | 65.00     | ...
```

關鍵特性：
- **1 行 = 1 個 shipment**（可能對應 1 或多份 invoice）
- **費用類型是固定欄位**（Custom fees 1, THC, Ocean Freight 等是預定義的列名）
- **重複費用匯總**：如果同一 shipment 的多份 invoice 都有 THC，金額會被**求和**
- 每個客戶/公司可能有**不同的費用欄位佈局**

### 方案 A 的致命問題

方案 A（展開為多行）的輸出格式：

```
| Shipment # | Charge Description | Amount |
|------------|--------------------|--------|
| SHP-001    | Custom fees 1      | 120.00 |
| SHP-001    | THC                | 200.00 |
| SHP-001    | Ocean Freight      | 500.00 |
```

**問題**：
1. 用戶拿到此 Excel 後，還需手動建立 Pivot Table 轉換格式
2. 費用類型的命名不統一（GPT 可能輸出 "OCEAN FRT"、"O/F"、"Ocean Freight" 等變體）
3. 基本抵消了自動化的價值

### 使用場景佔比分析

| 模式 | 使用場景 | 預估佔比 |
|------|----------|----------|
| **Pivot（1行1shipment）** | SCM 日常費用管理、ERP 匯入、管理報表 | 80-90% |
| **展開（1行1lineItem）** | 審計追溯、費用明細核對、異常調查 | 10-20% |

---

## 1. 核心問題：lineItems 數據通路斷裂

### 1.1 數據流完整追蹤

```
GPT Stage 3 提取
  ├── standardFields ─→ fieldMappings (flat JSON) ─→ Template Matching ─→ Excel ✅
  ├── customFields ──→ fieldMappings (flat JSON) ─→ Template Matching ─→ Excel ✅
  ├── fields ────────→ fieldMappings (flat JSON) ─→ Template Matching ─→ Excel ✅
  │
  ├── lineItems ─────→ stage3Result (JSON) ────→ [DEAD END: 無消費者] ❌
  │                  → extractedData.lineItems → [僅用於前端顯示，且缺少 classifiedAs]
  │
  └── extraCharges ──→ stage3Result (JSON) ────→ [DEAD END: 無消費者] ❌
```

### 1.2 關鍵發現：classifiedAs 只存在於 stage3Result

`convertV3Result()` 在轉換到 V2 格式時，**丟棄了 lineItems 的 `classifiedAs`**：

```
extractedData.lineItems = [{description, quantity, unitPrice, amount}]  ← 沒有 classifiedAs！
stage3Result.lineItems  = [{description, classifiedAs, amount, ...}]   ← 完整保留 ✅
```

**結論**：只能從 `ExtractionResult.stage3Result` 讀取 lineItems（FIX-044 已確保完整存儲）。

### 1.3 Template Matching Engine 的數據盲區

```typescript
// loadDocuments() — 只讀 fieldMappings
select: { extractionResult: { select: { fieldMappings: true } } }
// ❌ 不讀 stage3Result → lineItems 完全不可見

// extractMappedFields() — 只提取 flat key-value
result[key] = fieldData.value ?? fieldData.rawValue ?? null;
// ❌ 無法處理陣列結構

// transformFields() — 只處理 flat fields
sourceValue = sourceFields[mapping.sourceField];
// ❌ 無法從 lineItems 陣列中聚合
```

---

## 2. 新方案分析

### 2.1 三方案對比表

| 維度 | 方案 X: 展開為多行 | 方案 Y: Pivot（推薦） | 方案 Z: Hybrid |
|------|-------------------|---------------------|----------------|
| **核心概念** | 1 Doc → N Rows | 1 Doc → 1 Row，lineItem 聚合到費用列 | DataTemplate 配置決定模式 |
| **用戶體驗** | 差（需 Pivot Table） | **好（直接使用）** | 最好（按需選擇） |
| **改動量** | ~8 文件 | **~10 文件** | ~14 文件 |
| **DB Migration** | 需要（唯一約束） | **不需要** | 需要（加 lineItemMode） |
| **通用性** | 中 | **高** | 最高 |
| **實現複雜度** | 低 | **中** | 高 |
| **向後相容** | 完全 | **完全** | 完全 |
| **匯出後處理** | 需要 pivot | **無需處理** | 取決於模式 |

### 2.2 方案 Z: Hybrid 詳細說明

**核心概念**：在 DataTemplate（數據模板）上新增設定欄位 `lineItemMode`，讓用戶**自己選擇**該模板要用哪種輸出格式。

#### 用戶操作流程

```
用戶建立 DataTemplate 時的選擇畫面:

┌───────────────────────────────────────────────────┐
│  建立數據模板                                       │
│                                                     │
│  模板名稱: [DHL 費用報表          ]                  │
│  公司:     [DHL                   ]                  │
│  格式:     [Commercial Invoice    ]                  │
│                                                     │
│  📊 Line Item 輸出模式:                              │
│  ┌─────────────────────────────────────────────┐    │
│  │ ○ Pivot（1文件=1行，費用作為列）  ← 80-90%  │    │
│  │ ○ Expand（1 lineItem=1行）       ← 10-20%  │    │
│  └─────────────────────────────────────────────┘    │
│                                                     │
│  [取消]                          [建立]              │
└───────────────────────────────────────────────────┘
```

#### 兩種模式的預期結果對比

**同一份文件 INV-001**:
```
lineItems:
  ├─ THC           $100
  ├─ THC           $50
  ├─ Ocean Freight $500
  └─ Insurance     $70
```

**模式 A: Pivot（1文件=1行）— 適用 SCM 日常費用管理**
```
匯出 Excel:
┌─────────┬────────────┬─────┬───────────────┬───────────┐
│ Doc #   │ Date       │ THC │ Ocean Freight │ Insurance │
├─────────┼────────────┼─────┼───────────────┼───────────┤
│ INV-001 │ 2026-01-15 │ 150 │ 500           │ 70        │
└─────────┴────────────┴─────┴───────────────┴───────────┘
← 1 行，THC 匯總為 150（同文件內重複 lineItem 聚合）
```

**模式 B: Expand（1 lineItem=1行）— 適用審計追溯**
```
匯出 Excel:
┌─────────┬────────────┬──────────────┬────────┐
│ Doc #   │ Date       │ Description  │ Amount │
├─────────┼────────────┼──────────────┼────────┤
│ INV-001 │ 2026-01-15 │ THC          │ 100    │
│ INV-001 │ 2026-01-15 │ THC          │ 50     │
│ INV-001 │ 2026-01-15 │ Ocean Freight│ 500    │
│ INV-001 │ 2026-01-15 │ Insurance    │ 70     │
└─────────┴────────────┴──────────────┴────────┘
← 4 行，每個 lineItem 獨立一行，適合逐筆核對
```

#### 系統數據流（方案 Z 完整流程）

```
                    ┌──────────────────┐
                    │   文件上傳提取    │
                    │  (GPT Stage 3)   │
                    └────────┬─────────┘
                             │
                    fieldMappings + stage3Result.lineItems
                             │
                    ┌────────▼─────────┐
                    │ Template Matching │
                    │    Engine         │
                    └────────┬─────────┘
                             │
                  讀取 DataTemplate.lineItemMode
                             │
               ┌─────────────┼─────────────┐
               │                           │
      lineItemMode='PIVOT'        lineItemMode='EXPAND'
               │                           │
    ┌──────────▼──────────┐    ┌───────────▼───────────┐
    │ extractMappedFields │    │  expandLineItems()     │
    │  + 展平 lineItems    │    │  每個 lineItem 一行    │
    │  按 classifiedAs SUM │    │  header 欄位複製到每行 │
    └──────────┬──────────┘    └───────────┬───────────┘
               │                           │
    ┌──────────▼──────────┐    ┌───────────▼───────────┐
    │ upsertRow()         │    │ upsertRow() × N       │
    │ 1 Doc = 1 Row       │    │ 1 Doc = N Rows        │
    │ rowKey = doc_number  │    │ rowKey = doc#_line#    │
    └──────────┬──────────┘    └───────────┬───────────┘
               │                           │
               └─────────────┬─────────────┘
                             │
                    ┌────────▼─────────┐
                    │  Excel 匯出       │
                    │ (邏輯不變，遍歷   │
                    │  fieldValues)     │
                    └──────────────────┘
```

#### DB Schema 變更（方案 Z 需要的）

```prisma
model DataTemplate {
  // ... 現有欄位 ...

  lineItemMode  String  @default("PIVOT")  // "PIVOT" | "EXPAND"
  //                     ↑ 新增欄位，需要 DB migration
}
```

#### 方案 Z 的額外工作量（相較方案 Y）

| 額外工作 | 說明 |
|----------|------|
| DB Migration | DataTemplate 加 `lineItemMode` 欄位 |
| DataTemplate UI | 新增模式選擇 radio button |
| `processBatch()` 分叉 | 根據 lineItemMode 走不同邏輯 |
| Expand 模式的 rowKey | 需要 `doc#_lineIndex` 複合鍵 |
| Expand 模式的 header 複製 | 每行都要帶 header 欄位 |
| 兩倍測試 | 每個功能都要測兩種模式 |

#### 方案 Z 與方案 Y 的演進關係

```
Phase 1: 展平策略（方案 Y 基礎） ← 現在做
    ↓
Phase 2: AGGREGATE TransformType（方案 Y 完整版）
    ↓
Phase 3: 加 lineItemMode 設定（升級為方案 Z）← 需要時再做
```

**結論**：方案 Z = 方案 Y（Pivot）+ 方案 X（Expand），用戶在模板設定中選擇模式。但因為 80-90% 用戶只需要 Pivot，先做方案 Y 即可，方案 Z 作為自然擴展路徑。

---

### 2.3 推薦：方案 Y（Pivot）+ 分階段實施

**推薦理由**：
1. 直接解決 80-90% 用戶的實際需求
2. 改動量適中，不需要 DB migration
3. 新增的 `AGGREGATE` TransformType 是通用能力，不是客製化
4. 自然的擴展路徑到方案 Z

---

## 3. 分階段實施設計

### 3.1 Phase 1：展平策略（快速驗證，1-2 天）

**目的**：以最小改動打通 lineItems 數據通路，驗證「1 shipment = 1 row + 費用列」概念。

**核心思路**：在 `extractMappedFields()` 階段，將 lineItems 按 `classifiedAs` 聚合後展平為 pseudo-fields。

**改動文件**：只需 `template-matching-engine.service.ts`（~25 行）

#### 改動 1: `loadDocuments()` 額外讀取 stage3Result

```typescript
// 現有:
select: { extractionResult: { select: { fieldMappings: true } } }

// 改為:
select: { extractionResult: { select: { fieldMappings: true, stage3Result: true } } }
```

#### 改動 2: `extractMappedFields()` 新增 lineItem 展平邏輯

```typescript
private extractMappedFields(
  fieldMappings: unknown,
  stage3Result?: unknown  // 新增參數
): Record<string, unknown> {
  // ... 現有邏輯（提取 header fields）不變 ...

  // 新增：展平 lineItems
  if (stage3Result && typeof stage3Result === 'object') {
    const s3 = stage3Result as { lineItems?: Array<{ classifiedAs?: string; description?: string; amount: number }> };
    if (s3.lineItems && Array.isArray(s3.lineItems)) {
      const grouped = new Map<string, { total: number; count: number }>();
      for (const item of s3.lineItems) {
        const key = item.classifiedAs || 'UNCLASSIFIED';
        const existing = grouped.get(key) || { total: 0, count: 0 };
        grouped.set(key, {
          total: existing.total + (item.amount || 0),
          count: existing.count + 1,
        });
      }
      for (const [category, agg] of grouped) {
        result[`li_${category}_total`] = agg.total;
        result[`li_${category}_count`] = agg.count;
      }
    }
  }

  return result;
}
```

#### 展平後的 sourceFields 範例

```typescript
// 原始 lineItems (from stage3Result):
[
  { description: "THC", classifiedAs: "THC", amount: 100 },
  { description: "THC DEST", classifiedAs: "THC", amount: 50 },
  { description: "OCEAN FREIGHT", classifiedAs: "OCEAN_FREIGHT", amount: 500 },
  { description: "Insurance", classifiedAs: "INSURANCE", amount: 70 },
]

// 展平後合併到 sourceFields:
{
  invoice_number: "INV-001",           // 原 header fields（不變）
  invoice_date: "2026-01-15",
  vendor_name: "DHL",
  total_amount: 720,
  // --- lineItem pivot fields（新增）---
  "li_THC_total": 150,                // SUM of amount WHERE classifiedAs = "THC"
  "li_THC_count": 2,                  // COUNT
  "li_OCEAN_FREIGHT_total": 500,
  "li_OCEAN_FREIGHT_count": 1,
  "li_INSURANCE_total": 70,
  "li_INSURANCE_count": 1,
}
```

#### Phase 1 使用方式

用戶在 TemplateFieldMapping 中配置：

| sourceField | targetField | transformType |
|-------------|-------------|---------------|
| `shipment_no` | Shipment # | DIRECT |
| `invoice_date` | Date | DIRECT |
| `li_THC_total` | THC | DIRECT |
| `li_OCEAN_FREIGHT_total` | Ocean Freight | DIRECT |
| `li_INSURANCE_total` | Insurance | DIRECT |

也可用 FORMULA 聚合多個類別：

| sourceField | targetField | transformType | transformParams |
|-------------|-------------|---------------|-----------------|
| `li_THC_total` | Combined Local | FORMULA | `{ formula: "{li_THC_total} + {li_DOC_FEE_total}" }` |

#### Phase 1 不改動的

- `transformFields()` — 不需要改（DIRECT/FORMULA 已支持 flat fields）
- `TransformExecutor` — 不需要改
- `TemplateFieldMappingRule` schema — 不需要改
- DB migration — 不需要
- Excel 匯出 — 不需要改（直接遍歷 fieldValues）
- `SourceFieldSelector.tsx` — Phase 1 可暫時讓用戶手動輸入 `li_*` key

#### Phase 1 總改動量

| 改動 | 行數 | 影響範圍 |
|------|------|----------|
| loadDocuments select | +1 行 | 僅 DB query |
| extractMappedFields 簽名 | +1 行 | 僅內部方法 |
| lineItem 展平邏輯 | ~20 行 | 新增邏輯 |
| 連接調用 | +1 行 | 方法調用 |
| **合計** | **~25 行** | **僅 1 個文件** |

---

### 3.2 Phase 2：AGGREGATE TransformType（正式方案，3-5 天）

**目的**：將 Phase 1 的硬編碼邏輯升級為配置化、可擴展的通用能力。

#### 新增 TransformType

```typescript
// src/types/template-field-mapping.ts
export type FieldTransformType =
  | 'DIRECT' | 'FORMULA' | 'LOOKUP' | 'CONCAT' | 'SPLIT' | 'CUSTOM'
  | 'AGGREGATE';  // 新增
```

**為什麼新增 AGGREGATE 而非擴展 FORMULA**：
- `FORMULA` 語意：「對 header 欄位做數學運算」，如 `{sea_freight} + {thc}`
- `AGGREGATE` 語意：「對 lineItem 集合做過濾 + 聚合」
- 分開保持單一職責，避免 FORMULA 過載
- 各自獨立演進

#### AggregateTransformParams 型別

```typescript
export interface AggregateTransformParams {
  /** 數據來源 */
  source: 'lineItems' | 'extraCharges';

  /** 過濾條件 — 支持多種匹配方式 */
  filter: {
    /** 精確匹配 classifiedAs */
    classifiedAs?: string;
    /** 匹配多個 classifiedAs（OR 邏輯）*/
    classifiedAsIn?: string[];
    /** 正則匹配 description（兜底）*/
    descriptionPattern?: string;
  };

  /** 聚合方式 */
  aggregation: 'SUM' | 'AVG' | 'COUNT' | 'FIRST' | 'LAST' | 'MAX' | 'MIN';

  /** 聚合的目標欄位（lineItem 內部哪個欄位）*/
  field: 'amount' | 'quantity' | 'unitPrice';

  /** 找不到匹配項時的預設值 */
  defaultValue?: number | null;
}
```

#### TransformContext 擴展

```typescript
// src/services/transform/types.ts
export interface TransformContext {
  row: Record<string, unknown>;       // header 欄位（不變）
  sourceField: string;                 // 不變
  targetField: string;                 // 不變
  lineItems?: LineItemV3[];            // 新增
  extraCharges?: ExtraChargeV3[];      // 新增
}
```

#### AggregateTransform 核心實現

```typescript
// src/services/transform/aggregate.transform.ts
export class AggregateTransform implements Transform {
  readonly type: FieldTransformType = 'AGGREGATE';

  async execute(
    _value: unknown,
    params: TransformParams,
    context: TransformContext
  ): Promise<unknown> {
    const aggParams = params as AggregateTransformParams;

    // 1. 選擇數據源
    const items = aggParams.source === 'lineItems'
      ? context.lineItems ?? []
      : context.extraCharges ?? [];

    // 2. 過濾
    const filtered = items.filter(item => {
      if (aggParams.filter.classifiedAs) {
        return item.classifiedAs === aggParams.filter.classifiedAs;
      }
      if (aggParams.filter.classifiedAsIn) {
        return aggParams.filter.classifiedAsIn.includes(item.classifiedAs ?? '');
      }
      if (aggParams.filter.descriptionPattern) {
        return new RegExp(aggParams.filter.descriptionPattern, 'i').test(item.description);
      }
      return false;
    });

    // 3. 無匹配項 → 返回預設值
    if (filtered.length === 0) {
      return aggParams.defaultValue ?? null;
    }

    // 4. 提取目標欄位值
    const values = filtered.map(item => {
      const val = item[aggParams.field];
      return typeof val === 'number' ? val : 0;
    });

    // 5. 聚合
    switch (aggParams.aggregation) {
      case 'SUM':   return values.reduce((a, b) => a + b, 0);
      case 'AVG':   return values.reduce((a, b) => a + b, 0) / values.length;
      case 'COUNT': return filtered.length;
      case 'FIRST': return values[0];
      case 'LAST':  return values[values.length - 1];
      case 'MAX':   return Math.max(...values);
      case 'MIN':   return Math.min(...values);
      default:      return aggParams.defaultValue ?? null;
    }
  }
}
```

#### Phase 2 映射規則配置範例

THC 費用映射：
```json
{
  "sourceField": "lineItems",
  "targetField": "THC",
  "transformType": "AGGREGATE",
  "transformParams": {
    "source": "lineItems",
    "filter": { "classifiedAs": "THC" },
    "aggregation": "SUM",
    "field": "amount",
    "defaultValue": 0
  },
  "isRequired": false,
  "order": 10
}
```

保險費（多種 classifiedAs）：
```json
{
  "sourceField": "lineItems",
  "targetField": "Insurance",
  "transformType": "AGGREGATE",
  "transformParams": {
    "source": "lineItems",
    "filter": { "classifiedAsIn": ["INSURANCE", "CARGO_INSURANCE", "MARINE_INSURANCE"] },
    "aggregation": "SUM",
    "field": "amount"
  },
  "order": 12
}
```

#### Phase 2 改動清單

| # | 文件 | 變更內容 | LOC |
|---|------|----------|-----|
| 1 | `src/types/template-field-mapping.ts` | 新增 `'AGGREGATE'`、`AggregateTransformParams`、更新 `TransformParams` 聯合類型 | 40 |
| 2 | `src/services/transform/types.ts` | `TransformContext` 新增 `lineItems?`、`extraCharges?` | 5 |
| 3 | `src/services/transform/aggregate.transform.ts` | **新建** AggregateTransform 類 | 80 |
| 4 | `src/services/transform/transform-executor.ts` | 註冊 AggregateTransform | 5 |
| 5 | `src/services/transform/index.ts` | 導出新類 | 2 |
| 6 | `src/services/template-matching-engine.service.ts` | loadDocuments 讀 stage3Result、transformFields 注入 lineItems 到 context | 40 |
| 7 | `src/validations/template-field-mapping.ts` | Zod schema 新增 AGGREGATE 驗證 | 30 |
| 8 | `src/components/features/template-field-mapping/SourceFieldSelector.tsx` | 新增 lineItem 欄位選擇（Header/LineItem Tab） | 60 |
| 9 | `src/components/features/template-field-mapping/MappingRuleEditor.tsx` | AGGREGATE 配置 UI | 40 |
| 10-15 | `messages/{en,zh-TW,zh-CN}/templateFieldMapping.json` × 2 | AGGREGATE 翻譯 | 30 |
| | **合計** | | **~330 LOC** |

---

### 3.3 Phase 3：雙模式支持（未來）

在 `DataTemplate` 加 `lineItemMode: 'PIVOT' | 'EXPAND'`：
- `PIVOT`（預設）：Phase 2 的 AGGREGATE 邏輯
- `EXPAND`：方案 A 的展開邏輯（每個 lineItem 一行）

Phase 2 已打通 lineItems 數據通路，Phase 3 只需在 `processBatch()` 中加模式分叉。

---

## 4. 完整數據流（Pivot 模式，方案 Y 實施後）

> **重要前提**：目前範圍是**單文件內** lineItem 匯總，不涉及跨文件合併。
> 1 份文件 = 1 個 ExtractionResult = 1 行 Row。

```
文件 INV-001 (DHL Invoice):
  header: { shipment_no: "SHP-001", date: "2026-01-15", vendor: "DHL" }
  lineItems: [
    { description: "THC",          classifiedAs: "THC",           amount: 100 },
    { description: "THC DEST",     classifiedAs: "THC",           amount: 50  },
    { description: "HANDLING FEE", classifiedAs: "HANDLING_FEE",  amount: 30  },
    { description: "HANDLING",     classifiedAs: "HANDLING_FEE",  amount: 20  },
    { description: "HANDLING CHG", classifiedAs: "HANDLING_FEE",  amount: 10  },
    { description: "OCEAN FRT",    classifiedAs: "OCEAN_FREIGHT", amount: 500 },
    { description: "Insurance",    classifiedAs: "INSURANCE",     amount: 70  },
  ]

    ↓ GPT Stage 3 提取（不變）

ExtractionResult (DB):
  fieldMappings: { shipment_no: "SHP-001", invoice_date: "2026-01-15", ... }
  stage3Result: { lineItems: [上述 7 筆], standardFields: {...} }

    ↓ Template Matching Engine（修改後）

loadDocuments()  → 讀取 fieldMappings + stage3Result
extractMappedFields() → 展平 lineItems（單文件內按 classifiedAs 聚合）:
  {
    shipment_no: "SHP-001",             // 原 header fields（不變）
    invoice_date: "2026-01-15",
    vendor_name: "DHL",
    total_amount: 780,
    // --- lineItem pivot fields（新增）---
    "li_THC_total": 150,                // 100 + 50 = 同文件內 classifiedAs="THC" 聚合
    "li_THC_count": 2,
    "li_HANDLING_FEE_total": 60,        // 30 + 20 + 10 = 同文件內 classifiedAs="HANDLING_FEE" 聚合
    "li_HANDLING_FEE_count": 3,
    "li_OCEAN_FREIGHT_total": 500,
    "li_OCEAN_FREIGHT_count": 1,
    "li_INSURANCE_total": 70,
    "li_INSURANCE_count": 1,
  }

transformFields() → 用 DIRECT mapping:
  {
    "Shipment #": "SHP-001",
    "Date": "2026-01-15",
    "THC": 150,                         // ← 單文件內 2 筆 THC 已匯總
    "Handling Fee": 60,                 // ← 單文件內 3 筆 HANDLING_FEE 已匯總
    "Ocean Freight": 500,
    "Insurance": 70,
  }

upsertRow() → rowKey = "SHP-001" → 寫入 1 行

    ↓ Excel 匯出（不變）

| Shipment # | Date       | THC | Handling Fee | Ocean Freight | Insurance |
|------------|------------|-----|--------------|---------------|-----------|
| SHP-001    | 2026-01-15 | 150 | 60           | 500           | 70        |
```

### 關鍵說明

- **匯總發生在 `extractMappedFields()` 階段**：同一文件的 lineItems 按 `classifiedAs` 分組求和
- **不需要修改 `mergeFieldValues()`**：因為每份文件獨立生成一行 Row，不涉及跨文件合併
- **不同 description 但相同 classifiedAs 會被正確匯總**：例如 "THC" 和 "THC DEST" 都被分類為 `classifiedAs: "THC"`，三層映射系統已處理命名變體
- **`upsertRow()` 和 Excel 匯出邏輯完全不需要改動**

---

## 5. 單文件內 lineItem 匯總機制

### 5.1 匯總範圍說明

> **澄清**：本方案的匯總範圍是**單一文件內**的 lineItem 聚合，**不涉及跨文件合併**。

典型場景：一份 invoice 內同一費用類型出現多次（不同描述但相同分類），需要聚合為一個總數。

```
單一文件 INV-001:
  ├─ "THC"           classifiedAs: "THC"    → $100 ─┐
  ├─ "THC DEST"      classifiedAs: "THC"    → $50  ─┤── SUM = $150
  ├─ "Handling Fee"   classifiedAs: "HANDLING_FEE" → $30 ─┐
  ├─ "Handling"       classifiedAs: "HANDLING_FEE" → $20 ─┤── SUM = $60
  ├─ "Handling Chg"   classifiedAs: "HANDLING_FEE" → $10 ─┘
  └─ "Ocean Freight"  classifiedAs: "OCEAN_FREIGHT" → $500 ── SUM = $500
```

### 5.2 為什麼不需要修改 mergeFieldValues

| 場景 | 是否需要修改 | 說明 |
|------|-------------|------|
| 同文件內 lineItem 聚合 | **不需要** | 在 `extractMappedFields()` 展平階段完成 |
| 1 文件 = 1 Row | **不需要** | `upsertRow()` 直接寫入，不觸發 merge |
| 跨文件合併（未來） | 未來考慮 | 目前不在範圍內，若需要再擴展 |

### 5.3 聚合由三層映射系統保障準確性

```
原始描述（GPT 提取）     三層映射系統分類            展平後的 key
─────────────────────   ──────────────────────    ──────────────────
"THC"                → classifiedAs: "THC"      → li_THC_total
"THC DEST"           → classifiedAs: "THC"      → li_THC_total（累加）
"TERMINAL HANDLING"  → classifiedAs: "THC"      → li_THC_total（累加）
"O/F"                → classifiedAs: "OCEAN_FREIGHT" → li_OCEAN_FREIGHT_total
"OCEAN FRT"          → classifiedAs: "OCEAN_FREIGHT" → li_OCEAN_FREIGHT_total（累加）
```

**核心依賴**：三層映射系統（Tier 1 通用 + Tier 2 公司特定 + Tier 3 LLM）確保不同描述變體被歸類為相同的 `classifiedAs`，展平邏輯只需按 `classifiedAs` 分組求和即可。

### 5.4 跨文件合併（未來考慮，不在當前範圍）

如果未來需要「多份 invoice → 同一 shipment 合併為 1 行」的功能：
- 需要擴展 `mergeFieldValues()` 支持 `li_*` 欄位的 SUM 合併策略
- 需要處理 header 欄位衝突（如不同 invoice 的 date、vendor 不同）
- 這是獨立的功能需求，與當前 Phase 1 無關

---

## 6. 關鍵設計問題（待決策）

### Q1: Phase 1 的 lineItem 聚合維度

| 選項 | 說明 | 推薦 |
|------|------|------|
| 按 `classifiedAs` | 三層映射系統已標準化的分類結果 | **推薦**（準確性高） |
| 按 `description` | 原始描述文字（可能不一致） | 不推薦（變體多） |
| 兩者都用 | classifiedAs 優先，fallback description | 可選 |

### Q2: 未映射的費用類型（classifiedAs 不在模板欄位中）

| 選項 | 說明 | 推薦 |
|------|------|------|
| 忽略 | lineItem 有 classifiedAs 但無對應 mapping → 不出現在 row 中 | Phase 1 推薦 |
| 匯總到 "Other" 欄位 | 模板預留 "Other Charges" 欄位 | Phase 2 實現 |
| 標記審核 | 寫入 validationErrors | Phase 2 實現 |

### Q3: extraCharges 如何處理

| 選項 | 說明 | 推薦 |
|------|------|------|
| 與 lineItems 合併處理 | extraCharges 也按 classifiedAs 展平為 `li_*` key | **推薦** |
| 分開處理 | 用 `ec_*` 前綴區分 | 更精確但更複雜 |
| 暫不處理 | Phase 2 再加 | 可接受 |

### Q4: SourceFieldSelector UI

| 選項 | 說明 | 推薦 |
|------|------|------|
| Phase 1 手動輸入 | 用戶直接輸入 `li_THC_total` | **Phase 1 推薦**（最簡單） |
| 動態列出可用 `li_*` key | 掃描已處理文件的 stage3Result 取得可用分類 | Phase 2 實現 |
| 預定義 lineItem 欄位清單 | 在 STANDARD_FIELDS 中預定義常見費用分類 | Phase 2 可考慮 |

### Q5: ~~跨 Invoice 合併策略~~ （已釐清：不在當前範圍）

> **已釐清**：Phase 1 範圍為單文件內 lineItem 匯總，不涉及跨文件合併。
> 匯總在 `extractMappedFields()` 展平階段完成，`mergeFieldValues()` 不需要修改。
> 跨文件合併為獨立的未來需求。

---

## 7. 風險評估

| 風險 | 嚴重度 | 機率 | 緩解措施 |
|------|--------|------|----------|
| `classifiedAs` 為空（`needsClassification=true`） | 中 | 中 | 用 `UNCLASSIFIED` 作為 fallback key |
| 同 classifiedAs 但不同含義（如不同公司的 "THC" 包含不同費用） | 中 | 低 | Tier 2 映射系統已處理公司特定分類 |
| stage3Result 結構變更 | 低 | 低 | 防禦性解析，null 安全 |
| `li_*` key 命名衝突（與 header field 衝突） | 低 | 極低 | `li_` 前綴避免衝突 |
| 同文件內 lineItem 數量過多（>100） | 低 | 極低 | 展平為 Map 結構，性能無問題 |
| AGGREGATE transform 配置錯誤 | 中 | 中 | Zod 驗證 + 至少一個 filter 條件 |

---

## 8. 未解決的業務問題

| # | 問題 | 優先級 | 備註 |
|---|------|--------|------|
| 1 | 負數費用（Credit Note）如何在 Pivot 模式中處理 | P1 | 影響聚合邏輯 |
| 2 | 費用拆分場景（一筆 lineItem 拆為多個 target 欄位） | P2 | Phase 2 考慮 |
| 3 | SourceFieldSelector 如何動態發現可用的 `li_*` key | P2 | Phase 2 實現 |
| 4 | 跨文件合併（多 invoice → 同 shipment 1 行）| P3 | 未來獨立需求 |
| 5 | 跨文件合併時 header 欄位衝突處理 | P3 | 依附於 #4 |
| 6 | 跨文件合併時匯率差異處理 | P3 | 依附於 #4 |

---

## 9. 附錄：關鍵代碼位置

### lineItem 數據路徑

| 功能 | 檔案路徑 | 行號 |
|------|----------|------|
| LineItemV3 型別 | `src/types/extraction-v3.types.ts` | 260-275 |
| ExtraChargeV3 型別 | `src/types/extraction-v3.types.ts` | 277-295 |
| Stage3ExtractionResult | `src/types/extraction-v3.types.ts` | 1192-1235 |
| convertV3Result lineItems 轉換 | `src/services/unified-processor/unified-document-processor.service.ts` | 345-371 |
| stage3Result 完整存儲 | `src/services/unified-processor/unified-document-processor.service.ts` | 477-486 |
| convertStandardFieldsToMappedFields | `src/services/unified-processor/unified-document-processor.service.ts` | 498-539 |

### Template Matching Engine

| 功能 | 檔案路徑 | 行號 |
|------|----------|------|
| loadDocuments() | `src/services/template-matching-engine.service.ts` | 586-618 |
| extractMappedFields() | `src/services/template-matching-engine.service.ts` | 635-653 |
| processBatch() | `src/services/template-matching-engine.service.ts` | 362-424 |
| transformFields() | `src/services/template-matching-engine.service.ts` | 436-473 |
| upsertRow() | `src/services/template-matching-engine.service.ts` | 486-548 |
| mergeFieldValues() | `src/services/template-matching-engine.service.ts` | 556-574 |

### Transform System

| 功能 | 檔案路徑 | 行號 |
|------|----------|------|
| FieldTransformType | `src/types/template-field-mapping.ts` | 35 |
| TransformParams 聯合類型 | `src/types/template-field-mapping.ts` | 119-125 |
| TemplateFieldMappingRule | `src/types/template-field-mapping.ts` | 135-170 |
| TransformContext | `src/services/transform/types.ts` | — |
| FORMULA transform | `src/services/transform/formula.transform.ts` | 40 |
| TransformExecutor 註冊 | `src/services/transform/transform-executor.ts` | — |
| Zod 驗證 | `src/validations/template-field-mapping.ts` | 114-182 |

### UI 組件

| 功能 | 檔案路徑 |
|------|----------|
| SourceFieldSelector | `src/components/features/template-field-mapping/SourceFieldSelector.tsx` |
| MappingRuleEditor | `src/components/features/template-field-mapping/MappingRuleEditor.tsx` |
| InstanceRowsTable | `src/components/features/template-instance/InstanceRowsTable.tsx` |

---

**文件建立日期**: 2026-02-25
**最後更新**: 2026-02-25（v1.1 — 修正匯總範圍為單文件內、補充方案 Z 完整說明）
**分析深度**: 多 Agent 協作（Business Analyst + Architect + Data Flow Analyst）
**前置條件**: FIX-044/045 已完成（stage3Result 保存完整 lineItems 數據）

### 變更記錄

| 版本 | 日期 | 變更內容 |
|------|------|----------|
| v1.0 | 2026-02-25 | 初版：三方案分析 + 分階段實施設計 |
| v1.1 | 2026-02-25 | §2 補充方案 Z 完整操作流程與數據流圖；§4-5 修正匯總範圍為「單文件內 lineItem 匯總」，移除跨 invoice 合併需求；§6 Q5 標記為不在範圍；§7-8 調整風險與未解決問題清單 |
