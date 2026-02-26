# CHANGE-043: Line Item Pivot 展平策略 — 單文件內 lineItem 聚合為費用列

> **日期**: 2026-02-25
> **狀態**: ✅ 已完成
> **完成日期**: 2026-02-25
> **優先級**: High
> **類型**: Feature / Pipeline Enhancement
> **影響範圍**: Template Matching Engine、Transform System、Template Field Mapping UI
> **前置分析**: `docs/05-analysis/2026-02-25-ARCH-line-item-pivot-design.md`
> **前置條件**: FIX-044/045 已完成（stage3Result 保存完整 lineItems 數據）
> **後續擴展**: CHANGE-044（方案 Z: Hybrid 雙模式）

---

## 變更背景

### 現有問題：lineItems 數據通路斷裂

GPT Stage 3 提取的 `lineItems`（含 `classifiedAs` 分類）被存入 `ExtractionResult.stage3Result`，但 Template Matching Engine **完全無法讀取**：

```
GPT Stage 3 提取
  ├── standardFields/fields → fieldMappings → Template Matching → Excel ✅
  ├── lineItems ────────────→ stage3Result  → [DEAD END: 無消費者] ❌
  └── extraCharges ─────────→ stage3Result  → [DEAD END: 無消費者] ❌
```

### 用戶實際需求

用戶的 Excel 模板是 **1 行 = 1 文件/shipment**，費用類型作為固定列（Pivot 模式）：

```
Shipment # | Date       | THC    | Handling Fee | Ocean Freight | Insurance
SHP-001    | 2026-01-15 | 150.00 | 60.00        | 500.00        | 70.00
```

同一文件內重複出現的費用類型（如 "THC" + "THC DEST" 都被分類為 `classifiedAs: "THC"`）需要**匯總為一個總數**。

### 匯總範圍

> **重要**：本 CHANGE 的匯總範圍是**單文件內** lineItem 聚合，**不涉及跨文件合併**。

---

## 變更內容

### Phase 1：展平策略（最小改動打通數據通路）

**核心思路**：在 `extractMappedFields()` 階段，從 `stage3Result` 讀取 lineItems，按 `classifiedAs` 聚合後展平為 `li_*` pseudo-fields，讓現有 DIRECT mapping 直接可用。

#### 1.1 `loadDocuments()` 額外讀取 stage3Result

擴展 Prisma `select` 語句，將 `stage3Result` 一併讀出。

#### 1.2 `extractMappedFields()` 新增 lineItem 展平邏輯

新增參數 `stage3Result`，在提取 header fields 之後，遍歷 `lineItems` 按 `classifiedAs` 分組求和：

```
原始 lineItems:
  THC        $100
  THC DEST   $50    ← classifiedAs 同為 "THC"
  Handling   $30
  Handling   $20    ← classifiedAs 同為 "HANDLING_FEE"
  Ocean Frt  $500

展平後追加到 sourceFields:
  li_THC_total: 150           // SUM(100+50)
  li_THC_count: 2
  li_HANDLING_FEE_total: 50   // SUM(30+20)
  li_HANDLING_FEE_count: 2
  li_OCEAN_FREIGHT_total: 500
  li_OCEAN_FREIGHT_count: 1
```

#### 1.3 extraCharges 合併處理

`extraCharges` 也按 `classifiedAs` 展平為 `li_*` key，與 lineItems 合併處理（使用相同前綴，因為對用戶而言都是費用項）。

---

### Phase 2：AGGREGATE TransformType（配置化升級）

**目的**：將 Phase 1 的展平邏輯升級為可配置的通用 Transform，支持更靈活的 filter + aggregation。

#### 2.1 新增 `AGGREGATE` TransformType

在 `FieldTransformType` 聯合類型中新增 `'AGGREGATE'`。

#### 2.2 新增 `AggregateTransformParams` 介面

```typescript
interface AggregateTransformParams {
  source: 'lineItems' | 'extraCharges';
  filter: {
    classifiedAs?: string;
    classifiedAsIn?: string[];
    descriptionPattern?: string;
  };
  aggregation: 'SUM' | 'AVG' | 'COUNT' | 'FIRST' | 'LAST' | 'MAX' | 'MIN';
  field: 'amount' | 'quantity' | 'unitPrice';
  defaultValue?: number | null;
}
```

#### 2.3 新增 `AggregateTransform` 類

實作 `Transform` 介面，執行：選擇數據源 → 過濾 → 聚合 → 返回結果。

#### 2.4 擴展 `TransformContext`

在 `TransformContext` 介面中新增 `lineItems?` 和 `extraCharges?` 欄位，讓 transform 可訪問原始行項目數據。

#### 2.5 `transformFields()` 注入 lineItems 到 context

在 Template Matching Engine 呼叫 `transformFields()` 時，從 `stage3Result` 讀取 lineItems 傳入 context。

#### 2.6 Zod Schema 驗證擴展

在 `fieldTransformTypeSchema` 中加入 `'AGGREGATE'`，並新增對應的 `transformParams` 驗證規則。

#### 2.7 SourceFieldSelector UI 增強

新增 Header / LineItem 分類 Tab，動態列出可用的 `li_*` 欄位。

#### 2.8 MappingRuleItem AGGREGATE 配置 UI

當 `transformType` 選為 `AGGREGATE` 時，顯示 filter 和 aggregation 配置面板。

---

## 技術設計

### 修改範圍

#### Phase 1（~25 LOC，僅 1 個文件）

| 文件 | 變更內容 | LOC |
|------|----------|-----|
| `src/services/template-matching-engine.service.ts` | `loadDocuments()` select 加 `stage3Result`（行 591-598）；`extractMappedFields()` 新增 `stage3Result` 參數 + lineItem 展平邏輯（行 635）；`loadDocuments()` 呼叫處傳入 stage3Result（行 616） | ~25 |

#### Phase 2（~330 LOC，~10 個文件）

| # | 文件 | 變更內容 | 類型 | LOC |
|---|------|----------|------|-----|
| 1 | `src/types/template-field-mapping.ts` | 新增 `'AGGREGATE'` 到 `FieldTransformType`（行 35）；新增 `AggregateTransformParams` 介面；更新 `TransformParams` 聯合類型（行 119-125） | 🔧 修改 | 40 |
| 2 | `src/services/transform/types.ts` | `TransformContext` 新增 `lineItems?`、`extraCharges?`（行 52） | 🔧 修改 | 5 |
| 3 | `src/services/transform/aggregate.transform.ts` | 新建 AggregateTransform 類（filter + aggregation 邏輯） | 🆕 新增 | 80 |
| 4 | `src/services/transform/transform-executor.ts` | 註冊 AggregateTransform（行 86-91 區域） | 🔧 修改 | 5 |
| 5 | `src/services/transform/index.ts` | 導出 AggregateTransform | 🔧 修改 | 2 |
| 6 | `src/services/template-matching-engine.service.ts` | `transformFields()` 注入 lineItems 到 TransformContext（行 436） | 🔧 修改 | 40 |
| 7 | `src/validations/template-field-mapping.ts` | `fieldTransformTypeSchema` 加 `'AGGREGATE'`（行 102-109）；新增 AGGREGATE 的 refine 驗證（行 135-182 區域） | 🔧 修改 | 30 |
| 8 | `src/components/features/template-field-mapping/SourceFieldSelector.tsx` | 新增 Header/LineItem 分類 Tab + li_* 欄位列出（行 79 groupedFields 區域） | 🔧 修改 | 60 |
| 9 | `src/components/features/template-field-mapping/MappingRuleItem.tsx` | AGGREGATE 選項 + 配置 UI（filter、aggregation 面板） | 🔧 修改 | 40 |
| 10-15 | `messages/{en,zh-TW,zh-CN}/templateFieldMapping.json` | AGGREGATE 相關翻譯 key | 🔧 修改 | 30 |
| | **合計** | | | **~330** |

### i18n 影響

| 語言 | 文件 | 需要更新的 Key |
|------|------|---------------|
| en | `messages/en/templateFieldMapping.json` | `transformType.AGGREGATE`、`aggregate.source`、`aggregate.filter.*`、`aggregate.aggregation.*`、`aggregate.field.*`、`sourceField.tabs.header`、`sourceField.tabs.lineItem` |
| zh-TW | `messages/zh-TW/templateFieldMapping.json` | 同上 |
| zh-CN | `messages/zh-CN/templateFieldMapping.json` | 同上 |

### 資料庫影響

**不需要 DB Migration** — lineItem 展平後的數據流經現有的 `TemplateInstanceRow.fieldValues`（JSON 類型），結構完全相容。

---

## 設計決策

1. **聚合維度用 `classifiedAs`（非 `description`）** — 三層映射系統已標準化分類結果，準確性高；`description` 有大量命名變體（如 "THC"、"THC DEST"、"TERMINAL HANDLING"）
2. **`li_` 前綴避免命名衝突** — lineItem 展平後的 pseudo-fields 統一使用 `li_` 前綴，不會與 header fields 衝突
3. **extraCharges 與 lineItems 合併處理** — 對用戶而言都是費用項，使用相同 `li_` 前綴簡化操作
4. **未映射的費用類型暫忽略** — Phase 1 lineItem 有 `classifiedAs` 但無對應 mapping → 不出現在 row 中（Phase 2 可實現 "Other Charges" 欄位）
5. **Phase 1 手動輸入 li_* key** — SourceFieldSelector 在 Phase 1 允許用戶手動輸入 `li_THC_total` 等 key；Phase 2 升級為動態列出
6. **新增 AGGREGATE 而非擴展 FORMULA** — 語義分離：FORMULA 是 header 欄位數學運算，AGGREGATE 是 lineItem 集合過濾 + 聚合，各自獨立演進
7. **不需要修改 `mergeFieldValues()`** — 匯總在 `extractMappedFields()` 展平階段完成，每份文件獨立生成一行 Row，不涉及跨文件合併

---

## 完整數據流（修改後）

```
文件 INV-001:
  header: { shipment_no: "SHP-001", invoice_date: "2026-01-15" }
  lineItems: [
    { description: "THC",      classifiedAs: "THC",          amount: 100 },
    { description: "THC DEST", classifiedAs: "THC",          amount: 50  },
    { description: "Handling",  classifiedAs: "HANDLING_FEE", amount: 30  },
    { description: "Handling",  classifiedAs: "HANDLING_FEE", amount: 20  },
    { description: "Ocean Frt", classifiedAs: "OCEAN_FREIGHT",amount: 500 },
  ]

    ↓ Stage 3 提取 → ExtractionResult (DB)

fieldMappings: { shipment_no: {...}, invoice_date: {...}, ... }
stage3Result:  { lineItems: [上述 5 筆], standardFields: {...} }

    ↓ Template Matching Engine

loadDocuments()       → 讀取 fieldMappings + stage3Result
extractMappedFields() → header fields + lineItem 展平:
  {
    shipment_no: "SHP-001",
    invoice_date: "2026-01-15",
    li_THC_total: 150,           // 100+50
    li_HANDLING_FEE_total: 50,   // 30+20
    li_OCEAN_FREIGHT_total: 500,
  }

transformFields()     → DIRECT/AGGREGATE mapping:
  {
    "Shipment #": "SHP-001",
    "THC": 150,
    "Handling Fee": 50,
    "Ocean Freight": 500,
  }

upsertRow()           → 1 文件 = 1 Row

    ↓ Excel 匯出（不變）

| Shipment # | Date       | THC | Handling Fee | Ocean Freight |
|------------|------------|-----|--------------|---------------|
| SHP-001    | 2026-01-15 | 150 | 50           | 500           |
```

---

## 影響範圍評估

### 文件影響清單

| 文件路徑 | 類型 | Phase | 說明 |
|----------|------|-------|------|
| `src/services/template-matching-engine.service.ts` | 🔧 修改 | 1+2 | 核心：展平邏輯 + context 注入 |
| `src/types/template-field-mapping.ts` | 🔧 修改 | 2 | 新增 AGGREGATE 類型 + 參數介面 |
| `src/services/transform/types.ts` | 🔧 修改 | 2 | TransformContext 擴展 |
| `src/services/transform/aggregate.transform.ts` | 🆕 新增 | 2 | AggregateTransform 類 |
| `src/services/transform/transform-executor.ts` | 🔧 修改 | 2 | 註冊新 transform |
| `src/services/transform/index.ts` | 🔧 修改 | 2 | 導出新類 |
| `src/validations/template-field-mapping.ts` | 🔧 修改 | 2 | Zod schema 擴展 |
| `src/components/features/template-field-mapping/SourceFieldSelector.tsx` | 🔧 修改 | 2 | Header/LineItem Tab |
| `src/components/features/template-field-mapping/MappingRuleItem.tsx` | 🔧 修改 | 2 | AGGREGATE 配置 UI |
| `messages/{en,zh-TW,zh-CN}/templateFieldMapping.json` | 🔧 修改 | 2 | i18n 翻譯 |

### 向後兼容性

- **完全向後兼容** — Phase 1 的展平邏輯是純新增，不影響現有 header fields 的處理
- **現有 Template Field Mapping 不受影響** — 只有新建的 AGGREGATE 映射才使用 lineItems
- **`li_` 前綴隔離** — 展平的 pseudo-fields 使用獨立前綴，與現有 sourceField 空間無交集
- **TransformContext 擴展是可選的** — 新增的 `lineItems?` 和 `extraCharges?` 是 optional，現有 transform 不受影響
- **Prisma 無 migration** — 所有數據走現有 JSON 欄位

---

## 實施計劃

```
Phase 1: 展平策略（快速驗證）
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Step 1: loadDocuments() 擴展 select
  └── 加入 stage3Result

Step 2: extractMappedFields() 展平邏輯
  ├── 新增 stage3Result 參數
  ├── lineItems 按 classifiedAs 分組 SUM
  ├── extraCharges 同樣處理
  └── 產出 li_* pseudo-fields

Step 3: 連接調用
  └── loadDocuments() 將 stage3Result 傳給 extractMappedFields()

Step 4: 驗證
  ├── TypeScript 編譯通過
  ├── 手動建立 DIRECT mapping（li_THC_total → THC）
  └── 確認 TemplateInstanceRow.fieldValues 有 lineItem 匯總數據

Phase 2: AGGREGATE TransformType（配置化升級）
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Step 5: 類型系統
  ├── FieldTransformType 加 'AGGREGATE'
  ├── 新增 AggregateTransformParams
  └── 更新 TransformParams 聯合類型

Step 6: Transform 實作
  ├── 新建 aggregate.transform.ts
  ├── 註冊到 transform-executor.ts
  ├── 擴展 TransformContext (lineItems?, extraCharges?)
  └── 導出

Step 7: Template Matching Engine 整合
  └── transformFields() 注入 lineItems 到 context

Step 8: Zod Schema 驗證
  ├── fieldTransformTypeSchema 加 'AGGREGATE'
  └── 新增 AGGREGATE 參數驗證 refine

Step 9: UI 組件
  ├── SourceFieldSelector — Header/LineItem Tab
  └── MappingRuleItem — AGGREGATE 配置面板

Step 10: i18n
  └── 3 語言 templateFieldMapping.json 新增 AGGREGATE 翻譯

Step 11: 完整驗證
  ├── npm run type-check
  ├── npm run lint
  ├── npm run i18n:check
  └── E2E: 建立 AGGREGATE mapping → 匹配 → 確認 fieldValues
```

---

## 風險評估

| 風險 | 嚴重度 | 機率 | 緩解措施 |
|------|--------|------|----------|
| `classifiedAs` 為空（`needsClassification=true`） | 中 | 中 | 用 `UNCLASSIFIED` 作為 fallback key |
| 同 classifiedAs 但不同含義（不同公司 "THC" 含義不同） | 中 | 低 | Tier 2 映射系統已處理公司特定分類 |
| stage3Result 結構變更 | 低 | 低 | 防禦性解析 + null 安全 |
| `li_*` key 與 header field 衝突 | 低 | 極低 | `li_` 前綴避免衝突 |
| AGGREGATE transform 配置錯誤 | 中 | 中 | Zod 驗證 + 至少一個 filter 條件 |
| 負數費用（Credit Note）的聚合 | 中 | 中 | SUM 天然支持負數；Phase 2 可加 ABS/NEGATE 選項 |

---

## 驗收標準

| # | 驗收項目 | 驗收標準 | 優先級 | Phase |
|---|----------|----------|--------|-------|
| 1 | lineItem 展平基礎 | `extractMappedFields()` 產出 `li_*` pseudo-fields | High | 1 |
| 2 | 單文件內匯總 | 同 `classifiedAs` 的 lineItems 金額正確 SUM | High | 1 |
| 3 | extraCharges 處理 | extraCharges 也被展平為 `li_*` key | Medium | 1 |
| 4 | DIRECT mapping 可用 | `li_THC_total` → `THC` 的 DIRECT mapping 正確輸出到 fieldValues | High | 1 |
| 5 | AGGREGATE 類型定義 | `FieldTransformType` 包含 `'AGGREGATE'` | High | 2 |
| 6 | AGGREGATE 執行 | filter by classifiedAs + SUM aggregation 正確運算 | High | 2 |
| 7 | Zod 驗證 | AGGREGATE 的 transformParams 通過驗證 | Medium | 2 |
| 8 | SourceFieldSelector | Header/LineItem Tab 正確顯示分類 | Medium | 2 |
| 9 | AGGREGATE 配置 UI | MappingRuleItem 顯示 filter + aggregation 面板 | Medium | 2 |
| 10 | i18n 同步 | 3 語言 AGGREGATE 翻譯完整 | Medium | 2 |
| 11 | TypeScript 編譯 | `npm run type-check` 通過 | High | 1+2 |
| 12 | 向後兼容 | 現有 DIRECT/FORMULA mapping 不受影響 | High | 1+2 |

---

## 測試場景

| # | 場景 | 測試步驟 | 預期結果 | Phase |
|---|------|----------|----------|-------|
| 1 | 單文件 lineItem 展平 | 上傳含 5 個 lineItems 的 invoice → 觸發 Template Match | `li_*` fields 出現在 sourceFields 中 | 1 |
| 2 | 同 classifiedAs 匯總 | 文件有 3 筆 classifiedAs="THC" 的 lineItem（$100+$50+$30） | `li_THC_total = 180` | 1 |
| 3 | UNCLASSIFIED fallback | lineItem 無 classifiedAs | `li_UNCLASSIFIED_total` 有值 | 1 |
| 4 | DIRECT mapping 完整流程 | 建立 `li_THC_total → THC` 的 DIRECT mapping → match | TemplateInstanceRow.fieldValues 含 `THC: 180` | 1 |
| 5 | AGGREGATE SUM | 建立 AGGREGATE mapping（filter: classifiedAs="THC", agg: SUM） | 結果等同 Phase 1 展平 | 2 |
| 6 | AGGREGATE COUNT | 同上，aggregation 改為 COUNT | 結果為 lineItem 筆數 | 2 |
| 7 | AGGREGATE classifiedAsIn | filter: classifiedAsIn=["THC","DOC_FEE"] | 合併兩類的 SUM | 2 |
| 8 | AGGREGATE defaultValue | filter 匹配不到任何 lineItem | 返回 defaultValue（如 0） | 2 |
| 9 | 現有 mapping 不受影響 | 已有 DIRECT/FORMULA mapping 的 template → match | 結果完全不變 | 1+2 |

---

## 相關文檔

| 文檔 | 路徑 |
|------|------|
| 架構設計分析（方案對比 + 分階段設計） | `docs/05-analysis/2026-02-25-ARCH-line-item-pivot-design.md` |
| 方案 A 影響評估（已否決） | `docs/05-analysis/2026-02-25-ARCH-template-instance-line-item-expansion.md` |
| FIX-044（stage3Result 完整存儲） | `claudedocs/4-changes/bug-fixes/FIX-044-v3-1-fieldmappings-empty-template-instance.md` |
| 後續擴展：方案 Z Hybrid 雙模式 | CHANGE-044（待建立） |

---

## 關鍵代碼位置

| 功能 | 檔案路徑 | 行號 |
|------|----------|------|
| loadDocuments() | `src/services/template-matching-engine.service.ts` | 586 |
| loadDocuments() select 語句 | 同上 | 591-598 |
| extractMappedFields() | 同上 | 635 |
| processBatch() | 同上 | 362 |
| transformFields() | 同上 | 436 |
| upsertRow() | 同上 | 486 |
| mergeFieldValues() | 同上 | 556 |
| FieldTransformType | `src/types/template-field-mapping.ts` | 35 |
| TransformParams 聯合類型 | 同上 | 119-125 |
| TransformContext | `src/services/transform/types.ts` | 52 |
| Transform 註冊 | `src/services/transform/transform-executor.ts` | 86-91 |
| fieldTransformTypeSchema | `src/validations/template-field-mapping.ts` | 102-109 |
| SourceFieldSelector | `src/components/features/template-field-mapping/SourceFieldSelector.tsx` | 66 |
| MappingRuleItem | `src/components/features/template-field-mapping/MappingRuleItem.tsx` | — |
| LineItemV3 型別 | `src/types/extraction-v3.types.ts` | 260-275 |
| ExtraChargeV3 型別 | `src/types/extraction-v3.types.ts` | 277-295 |

---

## 實施記錄

| Phase | Commit | 日期 | 說明 |
|-------|--------|------|------|
| Phase 1 | `0f8286c` | 2026-02-25 | lineItems 按 classifiedAs 聚合展平為 `li_*` pseudo-fields |
| Phase 2 | `c830c0d` | 2026-02-25 | AGGREGATE TransformType — 可配置 filter + aggregation（11 文件，588 行新增） |

---

*文件建立日期: 2026-02-25*
*完成日期: 2026-02-25*
