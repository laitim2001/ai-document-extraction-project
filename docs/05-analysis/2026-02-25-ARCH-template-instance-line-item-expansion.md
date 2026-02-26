# 架構影響評估：Template Instance 行項目展開功能

> **建立日期**: 2026-02-25
> **評估類型**: 架構影響分析（需求階段，尚未規劃）
> **觸發原因**: FIX-044/045 完成後發現 — 1 Document = 1 TemplateInstanceRow，無法展開 line items
> **狀態**: 待決策

---

## 1. 問題描述

### 1.1 現狀

目前 Template Instance 系統的數據模型為 **1 Document = 1 TemplateInstanceRow**：

```
Invoice (含 5 行 line items: Ocean Freight, THC, Handling Fee, Documentation, Insurance)
    ↓
Stage 3 提取結果
    ├── fields/standardFields: { invoice_number, vendor_name, total_amount, ... }  ← 頭部欄位
    └── lineItems: [                                                               ← 陣列
         { description: "Ocean Freight", amount: 500, confidence: 95 },
         { description: "THC", amount: 200, confidence: 90 },
         { description: "Handling Fee", amount: 150, confidence: 88 },
         { description: "Documentation", amount: 80, confidence: 92 },
         { description: "Insurance", amount: 70, confidence: 85 },
       ]
    ↓
Template Matching → 1 TemplateInstanceRow
    fieldValues: {
      "Invoice Number": "INV-001",
      "Vendor": "DHL",
      "Total Amount": 1000
      // lineItems 不被處理，直接丟失或嵌套為 JSON
    }
```

### 1.2 業務需求

SCM 部門處理 Freight Invoice 時，核心數據在 **line items**（費用行）中：

- 一張發票可能有 3-20 行不同的費用項
- 費用類型多樣：Ocean Freight、THC、Handling Fee、Customs Clearance、Insurance、Demurrage 等
- 用戶需要將每一行費用**分別**提取出來，匯出到 Excel 供對帳使用

### 1.3 期望結果

```
用戶期望的 Template Instance + Excel 匯出:

| Row | Invoice# | Vendor | Charge Type     | Amount | Currency |
|-----|----------|--------|-----------------|--------|----------|
| 1   | INV-001  | DHL    | Ocean Freight   | 500    | USD      |
| 2   | INV-001  | DHL    | THC             | 200    | USD      |
| 3   | INV-001  | DHL    | Handling Fee    | 150    | USD      |
| 4   | INV-001  | DHL    | Documentation   | 80     | USD      |
| 5   | INV-001  | DHL    | Insurance       | 70     | USD      |
```

### 1.4 實際結果

```
目前的 Template Instance:

| Row | Invoice# | Vendor | Total Amount |
|-----|----------|--------|--------------|
| 1   | INV-001  | DHL    | 1000         |
← 只有 1 行，line items 被丟棄
```

---

## 2. 根因分析

### 2.1 設計時序

Epic 19（資料模板匹配與匯出）設計時，著重在 **頭部欄位** 的提取和匹配。Line items 在 V3 提取管線中已被提取，但模板系統未為其建立數據通道。

### 2.2 數據丟失點追蹤

```
[Stage 3: GPT 提取]
  lineItems: [{ description, amount, ... }, ...]     ← ✅ 有數據

[extraction-v3.service.ts — V3.1 結果建構]
  result.lineItems = stage3.lineItems                ← ✅ 已傳遞（FIX-045 後 fields 也傳遞）

[unified-document-processor.service.ts — convertV3Result()]
  extractedData 包含 lineItems                       ← ✅ 存在 extractedData JSON 中
  mappedFields 不包含 lineItems                      ← ❌ 只有 header 欄位

[processing-result-persistence.service.ts]
  ExtractionResult.extractedData (Json)              ← ✅ lineItems 在此 JSON 中
  ExtractionResult.fieldMappings (Json)              ← ❌ 只有 header 欄位的 key-value

[template-matching-engine.service.ts — extractMappedFields()]
  讀取 ExtractionResult.fieldMappings                ← ❌ 無 lineItems
  sourceFields = { invoice_number: "INV-001", ... }  ← 只有 header

[template-matching-engine.service.ts — transformFields()]
  1 Document → 1 set of transformedFields            ← ❌ 無 lineItem 展開
  → 1 TemplateInstanceRow                            ← ❌ 只有 1 行
```

### 2.3 核心缺口

| 缺口 | 位置 | 說明 |
|------|------|------|
| **mappedFields 不含 lineItems** | `convertStandardFieldsToMappedFields()` | 只轉換 fields/standardFields，不轉換 lineItems |
| **Template Field Mapping 無法指向 lineItem 欄位** | `TemplateFieldMappingRule.sourceField` | 只能指向 header 欄位 key |
| **Matching Engine 無展開邏輯** | `processBatch()` | 1 Doc = 1 Row，無 lineItem 迭代 |
| **TemplateInstanceRow 唯一約束** | `@@unique([templateInstanceId, rowKey])` | 同 rowKey 只能 1 行 |
| **SourceFieldSelector UI 無 lineItem 選項** | `SourceFieldSelector.tsx` | 只列出 header 欄位 |

---

## 3. 修復方案分析

### 3.1 方案概覽

| 方案 | 策略 | 改動量 | 向後相容 | 推薦 |
|------|------|--------|---------|------|
| **A** | 行項目展開為多行 | 大（~26 文件） | 需遷移 | 最完整 |
| **B** | 行項目作為嵌套欄位保存 | 中（~12 文件） | 良好 | 折衷 |
| **C** | 新建 LineItem 子表 | 大（~30 文件） | 最佳 | 最正規但成本高 |

---

### 3.2 方案 A：行項目展開為多行（推薦）

**核心思路**: 1 Document with N lineItems → N TemplateInstanceRows

每行包含 **頭部欄位（重複）+ 該行的 lineItem 欄位**。

```
Document INV-001 (3 lineItems)
    ↓ Template Matching (展開模式)
    ↓
Row 0: { invoice_number: "INV-001", vendor: "DHL", charge_desc: "Ocean Freight",  amount: 500 }
Row 1: { invoice_number: "INV-001", vendor: "DHL", charge_desc: "THC",            amount: 200 }
Row 2: { invoice_number: "INV-001", vendor: "DHL", charge_desc: "Handling Fee",   amount: 150 }
```

#### 3.2.1 資料模型修改

**Prisma Schema** (`prisma/schema.prisma`):

```prisma
model TemplateInstanceRow {
  id                 String                    @id @default(cuid())
  templateInstanceId String                    @map("template_instance_id")
  rowKey             String                    @map("row_key")
  rowIndex           Int                       @map("row_index")
  sourceDocumentIds  String[]                  @map("source_document_ids")
  fieldValues        Json                      @map("field_values")
  validationErrors   Json?                     @map("validation_errors")
  status             TemplateInstanceRowStatus @default(PENDING)

  // ====== 新增欄位 ======
  lineItemIndex      Int?                      @map("line_item_index")  // null = header-only 行
  isLineItemRow      Boolean                   @default(false) @map("is_line_item_row")

  // ====== 修改唯一約束 ======
  // 舊: @@unique([templateInstanceId, rowKey])
  // 新: 加入 lineItemIndex 區分同文件的多行
  @@unique([templateInstanceId, rowKey, lineItemIndex])
}
```

**向後相容**: `lineItemIndex` nullable，現有資料 = null，不影響唯一約束。

#### 3.2.2 Template Field Mapping 擴展

**TemplateFieldMappingRule** (`src/types/template-field-mapping.ts`):

```typescript
interface TemplateFieldMappingRule {
  id: string;
  sourceField: string;           // 現有：header 欄位 key (e.g., "invoice_number")
  targetField: string;           // 現有：模板欄位名 (e.g., "Invoice Number")
  transformType: TransformType;
  transformParams?: unknown;
  order: number;

  // ====== 新增 ======
  /** 來源類型：header = 頭部欄位, lineItem = 行項目欄位 */
  sourceType?: 'header' | 'lineItem';
  /** 行項目內的欄位路徑 (當 sourceType = 'lineItem' 時) */
  lineItemField?: string;  // e.g., "description", "amount", "classifiedAs"
}
```

**UI 影響**: `SourceFieldSelector.tsx` 需分組顯示：

```
Header Fields
  ├── invoice_number
  ├── invoice_date
  ├── vendor_name
  └── total_amount

Line Item Fields
  ├── description (描述)
  ├── amount (金額)
  ├── quantity (數量)
  ├── unitPrice (單價)
  └── classifiedAs (分類)
```

#### 3.2.3 Template Matching Engine 修改

**核心邏輯變更** (`template-matching-engine.service.ts` — `processBatch()`):

```
現有流程:
  FOR EACH document:
    sourceFields = extractMappedFields(doc)
    transformedFields = transformFields(sourceFields, mappings)
    upsertRow(transformedFields)  // 1 行

新流程:
  FOR EACH document:
    headerFields = extractMappedFields(doc)           // header 欄位
    lineItems = extractLineItems(doc)                 // line items 陣列

    hasLineItemMappings = mappings.some(m => m.sourceType === 'lineItem')

    IF hasLineItemMappings AND lineItems.length > 0:
      // 展開模式：每個 lineItem 產生 1 行
      FOR EACH (lineItem, index) IN lineItems:
        mergedSource = { ...headerFields, ...lineItem }
        transformedFields = transformFields(mergedSource, mappings)
        upsertRow(transformedFields, lineItemIndex: index)

    ELSE:
      // 原有模式：1 Document = 1 Row
      transformedFields = transformFields(headerFields, mappings)
      upsertRow(transformedFields, lineItemIndex: null)
```

#### 3.2.4 lineItems 數據源

目前 lineItems 存在 `ExtractionResult.extractedData` (Json) 中，但不在 `fieldMappings` 中。

**extractLineItems()** 需要從 `ExtractionResult` 讀取：

```typescript
private async extractLineItems(document: { id: string }): Promise<LineItemV3[]> {
  const extractionResult = await prisma.extractionResult.findFirst({
    where: { documentId: document.id },
    orderBy: { createdAt: 'desc' },
    select: { extractedData: true, stage3Result: true },
  });

  // 優先從 stage3Result 取得（FIX-044 已保存完整數據）
  const stage3 = extractionResult?.stage3Result as Record<string, unknown> | null;
  if (stage3?.lineItems && Array.isArray(stage3.lineItems)) {
    return stage3.lineItems as LineItemV3[];
  }

  // Fallback: 從 extractedData 取得
  const extracted = extractionResult?.extractedData as Record<string, unknown> | null;
  if (extracted?.lineItems && Array.isArray(extracted.lineItems)) {
    return extracted.lineItems as LineItemV3[];
  }

  return [];
}
```

#### 3.2.5 Excel 匯出修改

**現有流程**: 每個 TemplateInstanceRow → 1 Excel 行（不變）

**新流程**: 因為展開已在 matching 階段完成（每個 lineItem 已是獨立 Row），匯出邏輯**幾乎不需要修改**。每個 Row 的 `fieldValues` 已包含完整的 header + lineItem 欄位。

這是方案 A 的核心優勢 — **匯出層零改動**。

#### 3.2.6 影響文件清單

| # | 文件 | 修改內容 | LOC | 風險 |
|---|------|----------|-----|------|
| 1 | `prisma/schema.prisma` | 新增 lineItemIndex, isLineItemRow；修改唯一約束 | 10 | 低 |
| 2 | `src/types/template-field-mapping.ts` | 新增 sourceType, lineItemField | 15 | 低 |
| 3 | `src/types/template-instance.ts` | 新增 lineItemIndex, isLineItemRow | 10 | 低 |
| 4 | `src/types/unified-processor.ts` | 可能需調整 | 5 | 低 |
| 5 | `src/services/template-matching-engine.service.ts` | 核心：lineItem 展開邏輯 | 100-150 | **中** |
| 6 | `src/services/template-field-mapping.service.ts` | 支援 lineItem 欄位解析 | 30-50 | 低 |
| 7 | `src/services/auto-template-matching.service.ts` | 可能需傳遞 lineItem 選項 | 10-20 | 低 |
| 8 | `src/components/features/template-field-mapping/SourceFieldSelector.tsx` | 分組顯示 header/lineItem 欄位 | 40-60 | 低 |
| 9 | `src/components/features/template-instance/InstanceRowsTable.tsx` | 顯示 lineItemIndex 欄 | 20-30 | 低 |
| 10 | `messages/{en,zh-TW,zh-CN}/templateFieldMapping.json` | 新增翻譯 | 15 | 低 |
| 11 | `messages/{en,zh-TW,zh-CN}/templateInstance.json` | 新增翻譯 | 10 | 低 |
| 12 | DB Migration | Prisma migrate | 20 | 低 |
| **合計** | **~12 文件** | | **~300-400 LOC** | **中** |

---

### 3.3 方案 B：行項目作為嵌套欄位保存（折衷方案）

**核心思路**: 保持 1 Document = 1 Row，但在 `fieldValues` 中保存結構化的 lineItems 陣列，匯出時展開。

```
TemplateInstanceRow.fieldValues = {
  "Invoice Number": "INV-001",
  "Vendor": "DHL",
  "_lineItems": [
    { "Charge Type": "Ocean Freight", "Amount": 500 },
    { "Charge Type": "THC", "Amount": 200 },
  ]
}
```

**優勢**: 數據模型不變、向後完全相容
**劣勢**: 匯出時需要展開邏輯；UI 中不夠直觀；驗證複雜

| 影響 | 說明 |
|------|------|
| DB Schema | **不變** |
| Matching Engine | 中等改動（保存 lineItems 到 fieldValues） |
| Export | **大改動**（需展開嵌套陣列為多行） |
| UI | 中等改動（嵌套表格顯示） |
| 文件數 | ~10 |
| LOC | ~350-500 |

---

### 3.4 方案 C：新建 LineItem 子表（最正規）

**核心思路**: 建立 `TemplateInstanceLineItem` 模型，與 `TemplateInstanceRow` 為 1:N 關聯。

```prisma
model TemplateInstanceLineItem {
  id                    String  @id @default(uuid())
  templateInstanceRowId String
  itemIndex             Int
  fieldValues           Json
  status                TemplateInstanceRowStatus @default(PENDING)

  row TemplateInstanceRow @relation(...)
  @@unique([templateInstanceRowId, itemIndex])
}
```

**優勢**: 最規範的關聯模型、查詢/索引最佳
**劣勢**: 新增模型 + 關聯 + 全面 API/UI 改動；成本最高

| 影響 | 說明 |
|------|------|
| DB Schema | 新增 1 模型 + 關聯 |
| Matching Engine | 大改動（雙重寫入） |
| Export | 中等改動（JOIN 查詢） |
| UI | 大改動（嵌套 CRUD） |
| 文件數 | ~20-25 |
| LOC | ~600-900 |

---

## 4. 方案比較與推薦

| 維度 | 方案 A (展開為多行) | 方案 B (嵌套保存) | 方案 C (子表) |
|------|-------------------|------------------|--------------|
| **改動量** | 中 (~12 文件, 300-400 LOC) | 中 (~10 文件, 350-500 LOC) | 大 (~25 文件, 600-900 LOC) |
| **向後相容** | 良好 (nullable 欄位) | 最佳 (schema 不變) | 良好 (新表) |
| **匯出改動** | **零** (已展開) | 大 (需展開邏輯) | 中 (JOIN) |
| **UI 直觀性** | **最佳** (表格直接顯示) | 差 (嵌套不直觀) | 好 (子表格) |
| **查詢性能** | 好 (flat rows) | 差 (JSON 嵌套查詢) | 最佳 (索引) |
| **數據量影響** | 行數增加 3-10x | 不變 | 新表行數增加 |
| **未來擴展性** | 好 | 差 | 最佳 |

### 推薦：方案 A

理由：
1. **匯出層零改動** — 因為展開在 matching 階段完成，每個 Row 都是 flat record
2. **UI 最直觀** — 表格中每行都是獨立記錄，無需處理嵌套
3. **改動量適中** — 核心改動集中在 template-matching-engine.service.ts
4. **向後相容** — 無 lineItem mapping 的模板繼續 1 Doc = 1 Row

---

## 5. LineItemV3 現有結構（已被提取但未被使用）

Stage 3 已經在提取 lineItems，數據結構如下：

```typescript
// src/types/extraction-v3.types.ts:260
interface LineItemV3 {
  description: string;          // 費用描述 (e.g., "Ocean Freight")
  classifiedAs?: string;        // 術語分類 (e.g., "OCEAN_FREIGHT")
  quantity?: number;            // 數量
  unitPrice?: number;           // 單價
  amount: number;               // 金額
  confidence: number;           // 信心度 0-100
  needsClassification?: boolean;
}

// src/types/extraction-v3.types.ts:278
interface ExtraChargeV3 {
  description: string;
  classifiedAs?: string;
  amount: number;
  confidence: number;
  needsClassification?: boolean;
}
```

這些數據**已經存在**於：
- `ExtractionResult.extractedData` (Json) — GPT 提取的原始數據
- `ExtractionResult.stage3Result` (Json) — FIX-044 後保存的完整 Stage 3 數據

**可供 lineItem 映射的欄位**:

| lineItem 欄位 | 說明 | 典型值 |
|---------------|------|--------|
| `description` | 費用描述 | "Ocean Freight", "THC", "Handling" |
| `classifiedAs` | 術語分類 | "OCEAN_FREIGHT", "TERMINAL_HANDLING" |
| `quantity` | 數量 | 1, 2, 10 |
| `unitPrice` | 單價 | 500.00, 200.00 |
| `amount` | 金額 | 500.00, 200.00 |
| `confidence` | 信心度 | 95, 88 |

**可供 extraCharge 映射的欄位**:

| extraCharge 欄位 | 說明 | 典型值 |
|------------------|------|--------|
| `description` | 附加費描述 | "Insurance", "Surcharge" |
| `classifiedAs` | 術語分類 | "INSURANCE" |
| `amount` | 金額 | 70.00 |
| `confidence` | 信心度 | 90 |

---

## 6. 關鍵設計問題（待決策）

### Q1: extraCharges 如何處理？

`ExtraChargeV3` 和 `LineItemV3` 結構類似但獨立。選項：
- **A**: 將 extraCharges 也作為行項目展開（合併到 lineItems）
- **B**: 分開處理，用不同的 sourceType 區分
- **C**: 暫不處理 extraCharges

### Q2: 同一模板是否同時支援 header-only 和 lineItem 兩種模式？

- **A**: 每個模板一種模式（在 DataTemplate 級別設定 `expansionMode: 'HEADER' | 'LINE_ITEM'`）
- **B**: 由 field mapping 自動推斷（有 lineItem sourceType 就展開）

推薦 **B** — 更靈活，不需額外配置。

### Q3: 展開後的 header 欄位如何處理？

- 每行重複所有 header 欄位（如 Invoice#、Vendor 在每個 lineItem 行中重複）
- 這是 Excel 匯出的標準做法，也最易理解

### Q4: rowKey 衝突處理

現有唯一約束 `@@unique([templateInstanceId, rowKey])` 需修改為 `@@unique([templateInstanceId, rowKey, lineItemIndex])`。

- `lineItemIndex` 為 null 時 = header-only 行（現有行為）
- `lineItemIndex` 為 0, 1, 2... 時 = 展開的 lineItem 行

**注意**: PostgreSQL 對 nullable 唯一約束的行為：`(inst-1, "SHP-001", null)` 和 `(inst-1, "SHP-001", null)` **不衝突**（null != null）。這可能需要改用 partial unique index 或將 lineItemIndex 默認為 -1。

### Q5: FieldDefinitionSet 是否需要擴展？

目前 `FieldDefinitionSet` / `FieldDefinition` 只定義 header 欄位。是否需要擴展以支援 lineItem 欄位定義？

- **短期**: 不需要。lineItem 欄位結構固定（description, amount, quantity, unitPrice, classifiedAs），直接在 SourceFieldSelector 硬編碼即可。
- **長期**: 可能需要讓用戶自定義 lineItem 欄位結構（如自定義的 GPT prompt 提取不同的 lineItem 欄位）。

---

## 7. 深入影響評估（基於代碼審查 2026-02-25）

> 以下基於對所有相關文件的逐行代碼審查，精確標註行號和改動量。

### 7.1 分層影響總覽

```
┌─────────────────────────────────────────────────────────────────────┐
│ Layer 1: DB Schema + Types（基礎層）                                │
│   影響: 3 文件, ~40 LOC                                             │
│   風險: 低（nullable 新欄位 + 向後相容）                            │
├─────────────────────────────────────────────────────────────────────┤
│ Layer 2: Template Matching Engine（核心邏輯層）                      │
│   影響: 2 文件, ~180 LOC                                            │
│   風險: 中（processBatch 展開邏輯是最複雜的改動）                   │
├─────────────────────────────────────────────────────────────────────┤
│ Layer 3: Template Field Mapping（映射配置層）                        │
│   影響: 4 文件, ~120 LOC                                            │
│   風險: 低-中（UI 分組 + Zod 驗證）                                 │
├─────────────────────────────────────────────────────────────────────┤
│ Layer 4: UI 展示層                                                   │
│   影響: 2 文件, ~50 LOC                                              │
│   風險: 低                                                           │
├─────────────────────────────────────────────────────────────────────┤
│ Layer 5: Export（匯出層）                                            │
│   影響: 0 文件, 0 LOC                                                │
│   風險: 無 ← 核心優勢                                               │
├─────────────────────────────────────────────────────────────────────┤
│ Layer 6: Auto Matching + Cleanup                                     │
│   影響: 1 文件, ~20 LOC                                              │
│   風險: 低（cleanupRowsForDocument 已支援多行）                     │
├─────────────────────────────────────────────────────────────────────┤
│ Layer 7: i18n                                                        │
│   影響: 6 文件, ~40 LOC                                              │
│   風險: 低                                                           │
├─────────────────────────────────────────────────────────────────────┤
│ 合計: ~18 文件, ~450 LOC                                             │
└─────────────────────────────────────────────────────────────────────┘
```

---

### 7.2 Layer 1: DB Schema + Types

#### 7.2.1 `prisma/schema.prisma` — TemplateInstanceRow (L3152-3169)

**現狀**:
```prisma
model TemplateInstanceRow {
  id                 String                    @id @default(cuid())
  templateInstanceId String                    @map("template_instance_id")
  rowKey             String                    @map("row_key")
  rowIndex           Int                       @map("row_index")
  sourceDocumentIds  String[]                  @map("source_document_ids")
  fieldValues        Json                      @map("field_values")
  validationErrors   Json?                     @map("validation_errors")
  status             TemplateInstanceRowStatus @default(PENDING)
  createdAt          DateTime                  @default(now()) @map("created_at")
  updatedAt          DateTime                  @updatedAt @map("updated_at")
  templateInstance   TemplateInstance          @relation(...)

  @@unique([templateInstanceId, rowKey])           ← 需修改
  @@index([templateInstanceId])
  @@index([status])
  @@map("template_instance_rows")
}
```

**改動**:
```prisma
  // 新增欄位
  lineItemIndex      Int?                      @map("line_item_index")   // null = header-only
  isLineItemRow      Boolean                   @default(false) @map("is_line_item_row")

  // 修改唯一約束
  // 舊: @@unique([templateInstanceId, rowKey])
  // 新: 需要處理 nullable 唯一問題
```

**PostgreSQL nullable 唯一約束問題**:
- `(inst-1, "SHP-001", null)` + `(inst-1, "SHP-001", null)` → PostgreSQL 視為不同（null ≠ null）
- 這意味著修改為 `@@unique([templateInstanceId, rowKey, lineItemIndex])` 後，**header-only 行仍可重複**
- **解決方案**: 將 header-only 行的 `lineItemIndex` 設為 `-1`（而非 null），確保唯一約束生效

**LOC**: ~10 | **遷移**: 1 個 migration 文件

#### 7.2.2 `src/types/template-instance.ts` (L134-155)

新增:
```typescript
export interface TemplateInstanceRow {
  // ... 現有欄位 ...
  lineItemIndex?: number | null;  // 新增
  isLineItemRow: boolean;         // 新增
}
```

**LOC**: ~5

#### 7.2.3 `src/types/template-field-mapping.ts` (L135-170)

**現狀**:
```typescript
export interface TemplateFieldMappingRule {
  id: string;
  sourceField: string;           // ← 只支援 header 欄位字串
  targetField: string;
  transformType: FieldTransformType;
  transformParams?: TransformParams;
  isRequired: boolean;
  order: number;
  description?: string;
}
```

**改動**:
```typescript
export type SourceFieldType = 'header' | 'lineItem';

export interface TemplateFieldMappingRule {
  id: string;
  sourceField: string;
  sourceType?: SourceFieldType;    // 新增：default 'header'
  lineItemField?: string;          // 新增：lineItem 內欄位路徑
  targetField: string;
  transformType: FieldTransformType;
  transformParams?: TransformParams;
  isRequired: boolean;
  order: number;
  description?: string;
}
```

**LOC**: ~15

---

### 7.3 Layer 2: Template Matching Engine（核心改動）

#### 7.3.1 `template-matching-engine.service.ts` — processBatch() (L362-424)

**現有流程** (pseudocode):
```
FOR EACH doc IN documents:
  sourceFields = extractMappedFields(doc)         // L376-378
  rowKey = extractRowKey(sourceFields, keyField)   // L379
  transformed = transformFields(sourceFields, mappings)  // L382-385
  validation = validateRowData(transformed)        // L388-391
  upsertRow(instanceId, rowKey, transformed, ...)  // L394-400
```

**改動後流程**:
```
FOR EACH doc IN documents:
  headerFields = extractMappedFields(doc)         // 現有邏輯不變
  lineItems = extractLineItems(doc)               // 新增：從 stage3Result 讀取

  hasLineItemMappings = mappings.some(m => m.sourceType === 'lineItem')

  IF hasLineItemMappings AND lineItems.length > 0:
    FOR EACH (item, idx) IN lineItems:
      merged = { ...headerFields }
      // 將 lineItem 欄位加入 merged，使用 "li_" 前綴或 lineItemField 路徑
      FOR EACH mapping WHERE sourceType === 'lineItem':
        merged[mapping.sourceField] = item[mapping.lineItemField]
      rowKey = extractRowKey(merged, keyField) + `_LI${idx}`
      transformed = transformFields(merged, mappings)
      upsertRow(instanceId, rowKey, transformed, lineItemIndex=idx)

  ELSE:
    // 原有邏輯：1 Doc = 1 Row（完全不變）
    rowKey = extractRowKey(headerFields, keyField)
    transformed = transformFields(headerFields, mappings)
    upsertRow(instanceId, rowKey, transformed, lineItemIndex=-1)
```

**LOC**: ~100-120（含 extractLineItems 新方法）

#### 7.3.2 新增 `extractLineItems()` 方法

```typescript
private async extractLineItems(
  documentId: string
): Promise<LineItemV3[]> {
  const extractionResult = await prisma.extractionResult.findFirst({
    where: { documentId },
    orderBy: { createdAt: 'desc' },
    select: { extractedData: true, stage3Result: true },
  });

  // 優先 stage3Result（FIX-044/045 後有完整數據）
  const stage3 = extractionResult?.stage3Result as Record<string, unknown>;
  if (stage3?.lineItems && Array.isArray(stage3.lineItems)) {
    return stage3.lineItems as LineItemV3[];
  }

  // Fallback: extractedData
  const extracted = extractionResult?.extractedData as Record<string, unknown>;
  if (extracted?.lineItems && Array.isArray(extracted.lineItems)) {
    return extracted.lineItems as LineItemV3[];
  }

  return [];
}
```

**LOC**: ~30

#### 7.3.3 `upsertRow()` (L486-548) 修改

需支援 `lineItemIndex` 參數:
- Create 時寫入 `lineItemIndex` 和 `isLineItemRow`
- 唯一約束查詢需包含 `lineItemIndex`

**LOC**: ~20

#### 7.3.4 邊界條件

| 條件 | 處理方式 |
|------|----------|
| lineItems 為空陣列 | 走原有 header-only 路徑 |
| 部分 lineItem 缺少欄位 | transformFields 的降級策略已處理（使用原值或跳過） |
| 同 rowKey + 不同 lineItemIndex | 唯一約束允許（不同行） |
| 同 rowKey + 同 lineItemIndex | upsert 合併邏輯（新值覆蓋空值） |
| extraCharges 混入 | Q1 設計決策（見 §6） |

---

### 7.4 Layer 3: Template Field Mapping

#### 7.4.1 `src/validations/template-field-mapping.ts` (L114-182)

新增 Zod schema:
```typescript
export const sourceFieldTypeSchema = z.enum(['header', 'lineItem']);

// 修改 templateFieldMappingRuleInputSchema
sourceType: sourceFieldTypeSchema.optional().default('header'),
lineItemField: z.string().max(100).optional(),
// + refine: 當 sourceType='lineItem' 時 lineItemField 必填
```

**LOC**: ~20

#### 7.4.2 `src/services/template-field-mapping.service.ts` — mergeMappings() (L434-447)

**幾乎不需修改** — mergeMappings 按 targetField 去重，sourceType/lineItemField 作為規則的一部分自動跟隨。唯一需確認：JSON 持久化（DB 中 mappings 欄位為 Json 型別）能正確存儲新欄位。

**LOC**: ~5

#### 7.4.3 `src/components/features/template-field-mapping/SourceFieldSelector.tsx`

**現狀**:
- 從 `STANDARD_FIELDS` (60+ header 欄位) 取得欄位列表
- 按 `FieldCategory` 分組顯示（basic, vendor, logistics, charges...）
- Props: `value: string`, `onChange: (value: string) => void`

**改動**:
- 新增頂層 Tab/Toggle: "Header Fields" | "Line Item Fields"
- Line Item Fields 分組: description, classifiedAs, amount, quantity, unitPrice, confidence
- Props 擴展: 新增 `sourceType` 和 `onSourceTypeChange`

```
Header Fields (現有)
  ├── basic: invoice_number, invoice_date, ...
  ├── vendor: vendor_name, vendor_code, ...
  └── charges: total_amount, currency, ...

Line Item Fields (新增)
  ├── description (費用描述)
  ├── classifiedAs (術語分類)
  ├── amount (金額)
  ├── quantity (數量)
  ├── unitPrice (單價)
  └── confidence (信心度)
```

**LOC**: ~60

#### 7.4.4 `src/components/features/template-field-mapping/MappingRuleEditor.tsx`

新增規則時需包含 sourceType 選擇。

**LOC**: ~30

---

### 7.5 Layer 4: UI 展示層

#### 7.5.1 `src/components/features/template-instance/InstanceRowsTable.tsx` (L285-390)

**現有列**:
```
Checkbox | Index | RowKey | Field1 | Field2 | ... | Status | Actions
```

**改動**:
- 新增 `lineItemIndex` 列（當實例含 lineItem 行時顯示）
- 可選：按 rowKey 分組顯示（header 行 + 展開的 lineItem 行）
- 統計影響：totalRows 會增加（1 doc → N rows）

**LOC**: ~30

#### 7.5.2 `InstanceStatsOverview`

統計基於 row count，不需改動。展開後 totalRows 自然增加。

**LOC**: ~5（可能需調整 "documents processed" vs "rows generated" 標籤）

---

### 7.6 Layer 5: Export（零改動）

#### 已驗證：`src/services/template-export.service.ts`

**Excel 匯出邏輯** (L112-153):
```typescript
for (const row of rows) {
  const fieldValues = row.fieldValues as Record<string, unknown>;
  for (const field of selectedFields) {
    rowData[field.name] = this.formatValue(fieldValues[field.name], ...);
  }
  sheet.addRow(rowData);
}
```

**CSV 匯出邏輯** (L230-240): 相同模式。

**結論**: 匯出直接遍歷每個 Row 的 fieldValues，不關心行的來源。展開在 matching 階段已完成，每個 Row 都是 flat record，匯出**完全不需修改**。

---

### 7.7 Layer 6: Auto Matching + Cleanup

#### 7.7.1 `src/services/auto-template-matching.service.ts`

**autoMatch()** (L319-404): 調用 `matchDocuments([documentId])`，不需知道展開細節。

**tryAutoComplete()** (L707-719): 檢查整個實例所有行的驗證狀態，展開後自動適應。

**cleanupRowsForDocument()** (L733-762): 已使用 `sourceDocumentIds: { has: documentId }` 查詢，展開後每個行都帶有 sourceDocumentIds，清理邏輯**已正確支援多行**。

**改動**: 可能需傳遞 `lineItemExpansion` 選項到 matchDocuments。

**LOC**: ~20

#### 7.7.2 清理邏輯驗證

```
unmatch(documentId="doc-001")
  → cleanupRowsForDocument(instanceId, "doc-001")
    → 查詢所有 sourceDocumentIds 包含 "doc-001" 的行
    → 如果 doc-001 展開為 5 行 lineItems，全部 5 行都會被找到
    → 每行的 sourceDocumentIds 只有 ["doc-001"]
    → updatedIds.length === 0 → 全部 5 行刪除 ✓
```

---

### 7.8 Layer 7: i18n

需更新的命名空間:

| 文件 | 新增 key | 說明 |
|------|----------|------|
| `messages/{en,zh-TW,zh-CN}/templateFieldMapping.json` | `sourceType`, `lineItemFields.*` | 欄位類型標籤 |
| `messages/{en,zh-TW,zh-CN}/templateInstance.json` | `rows.columns.lineItemIndex`, `rows.lineItemBadge` | 表格列標題 |

**LOC**: ~40 (6 文件)

---

## 8. 完整檔案影響清單（精確版）

| # | 檔案 | 層級 | 改動內容 | LOC | 風險 |
|---|------|------|----------|-----|------|
| 1 | `prisma/schema.prisma` | DB | 新增 lineItemIndex, isLineItemRow; 修改唯一約束 | 10 | 低 |
| 2 | `prisma/migrations/YYYYMMDD_*/migration.sql` | DB | 自動生成 | — | 低 |
| 3 | `src/types/template-instance.ts` :134 | Types | 擴展 TemplateInstanceRow interface | 5 | 低 |
| 4 | `src/types/template-field-mapping.ts` :135 | Types | 新增 SourceFieldType, lineItemField | 15 | 低 |
| 5 | `src/validations/template-field-mapping.ts` :114 | Validation | Zod schema 擴展 | 20 | 低 |
| 6 | **`src/services/template-matching-engine.service.ts`** :362 | **Engine** | **processBatch 展開 + extractLineItems 新方法 + upsertRow 擴展** | **150** | **中** |
| 7 | `src/services/template-field-mapping.service.ts` :434 | Service | mergeMappings 微調（如需） | 5 | 低 |
| 8 | `src/services/auto-template-matching.service.ts` :371 | Service | matchDocuments 傳遞展開選項 | 20 | 低 |
| 9 | `src/components/features/template-field-mapping/SourceFieldSelector.tsx` | UI | 分組 Header/LineItem + 新欄位列表 | 60 | 低-中 |
| 10 | `src/components/features/template-field-mapping/MappingRuleEditor.tsx` | UI | sourceType 選擇 | 30 | 低 |
| 11 | `src/components/features/template-instance/InstanceRowsTable.tsx` :285 | UI | lineItemIndex 列 | 30 | 低 |
| 12 | `src/components/features/template-instance/InstanceStatsOverview.tsx` | UI | 調整標籤 | 5 | 低 |
| 13-18 | `messages/{en,zh-TW,zh-CN}/templateFieldMapping.json` + `templateInstance.json` | i18n | 新增翻譯 key | 40 | 低 |
| | **合計** | | | **~450** | |

---

## 9. 實施路線圖（方案 A 精確版）

### Phase 1: 數據模型 + 類型 (1 天)

1. `prisma/schema.prisma` — 新增 `lineItemIndex` (Int?, default null for existing), `isLineItemRow` (Boolean, default false); 修改唯一約束為 `@@unique([templateInstanceId, rowKey, lineItemIndex])`
2. `npx prisma migrate dev --name add_line_item_expansion`
3. `src/types/template-instance.ts` — 擴展 interface
4. `src/types/template-field-mapping.ts` — 新增 `SourceFieldType`, `lineItemField`
5. `src/validations/template-field-mapping.ts` — 擴展 Zod schema

**驗證**: `npm run type-check`

### Phase 2: Template Matching Engine (2-3 天)

1. `template-matching-engine.service.ts` — 新增 `extractLineItems()` private method
2. `processBatch()` — 加入 lineItem 展開分支（保留原有 header-only 路徑不變）
3. `upsertRow()` — 支援 `lineItemIndex` 參數
4. 唯一約束處理：header-only 行使用 `lineItemIndex = -1`

**驗證**: 單元測試 — header-only 回歸 + lineItem 展開新測試

### Phase 3: Template Field Mapping UI (1-2 天)

1. `SourceFieldSelector.tsx` — 新增 Header/LineItem Tab + lineItem 欄位清單
2. `MappingRuleEditor.tsx` — sourceType 選擇 UI
3. `MappingRuleItem.tsx` — 顯示 sourceType 標記

**驗證**: UI 手動測試 — 建立含 lineItem mapping 的規則

### Phase 4: Instance UI + i18n (1 天)

1. `InstanceRowsTable.tsx` — lineItemIndex 列（條件顯示）
2. `InstanceStatsOverview.tsx` — 標籤微調
3. i18n 翻譯（6 文件）
4. `npm run i18n:check`

**驗證**: E2E — 上傳含 lineItems 的發票，確認展開為多行，Excel 匯出正確

### Phase 5: 測試 + 回歸 (1 天)

1. 回歸: 無 lineItem mapping 的模板仍為 1 Doc = 1 Row
2. 回歸: unmatch/batchUnmatch 正確清理展開行
3. 新測: lineItem 展開 → InstanceRowsTable 顯示 → Excel 匯出含所有行

**總計: 6-8 天開發**

---

## 10. 風險評估（更新版）

| 風險 | 嚴重度 | 機率 | 影響 | 緩解措施 |
|------|--------|------|------|----------|
| 唯一約束遷移影響現有資料 | 高 | 低 | 現有行 lineItemIndex=null，不影響 | 遷移腳本設 default null；`lineItemIndex=-1` 策略可避免 null 唯一問題 |
| processBatch 展開邏輯複雜 | 中 | 中 | 核心邏輯，bug 影響所有新匹配 | 充分單元測試；保留 header-only 路徑不變 |
| 行數增加 3-10x 影響性能 | 中 | 中 | 分頁查詢、統計計數 | InstanceRowsTable 已有分頁；加 isLineItemRow 索引 |
| 現有模板行為被改變 | 高 | 極低 | 無 lineItem mapping = 走原有路徑 | `hasLineItemMappings` 判斷完全隔離 |
| SourceFieldSelector UI 過於複雜 | 低 | 低 | 欄位列表增加 6 個 lineItem 欄位 | Header/LineItem Tab 分組 |
| cleanupRowsForDocument 未清理所有展開行 | 高 | 極低 | 已驗證：`sourceDocumentIds: { has: docId }` 可找到所有行 | 已有正確邏輯 |
| stage3Result 中 lineItems 不完整 | 中 | 低 | FIX-044 已保存完整 stage3 數據 | extractLineItems fallback extractedData |

---

## 11. 不做此功能的影響

如果決定**不實施**此功能：

1. **Template Instance** 只能映射 header 欄位（Invoice#, Date, Vendor, Total）
2. **Line item 級別的費用明細** 無法自動提取到模板中
3. **Excel 匯出** 無法包含逐行費用明細
4. **用戶仍需手動** 從原始發票中提取 line item 數據
5. **自動化率受限** — header 欄位自動化容易，但業務核心在 line items
6. **現有 Stage 3 提取的 lineItems 數據浪費** — GPT 已花費 token 提取，但結果被丟棄

---

## 12. 附錄：關鍵代碼位置（精確行號版）

### A. 型別與 Schema

| 功能 | 檔案路徑 | 行號 |
|------|----------|------|
| LineItemV3 型別 | `src/types/extraction-v3.types.ts` | 260-275 |
| ExtraChargeV3 型別 | `src/types/extraction-v3.types.ts` | 278-284 |
| Stage3ExtractionResult | `src/types/extraction-v3.types.ts` | 1190-1235 |
| TemplateInstanceRow Schema | `prisma/schema.prisma` | 3152-3169 |
| TemplateInstanceRow 唯一約束 | `prisma/schema.prisma` | 3167 |
| TemplateInstanceRow TS 型別 | `src/types/template-instance.ts` | 134-155 |
| TemplateFieldMappingRule 型別 | `src/types/template-field-mapping.ts` | 135-170 |
| FieldTransformType | `src/types/template-field-mapping.ts` | 35 |
| Zod 驗證 Schema | `src/validations/template-field-mapping.ts` | 114-182 |
| STANDARD_FIELDS 常數 | `src/constants/standard-fields.ts` | 86-491 |

### B. 服務層

| 功能 | 檔案路徑 | 行號 |
|------|----------|------|
| matchDocuments() 主入口 | `src/services/template-matching-engine.service.ts` | 100-197 |
| processBatch() 批次處理 | `src/services/template-matching-engine.service.ts` | 362-424 |
| transformFields() 欄位轉換 | `src/services/template-matching-engine.service.ts` | 436-473 |
| upsertRow() 行寫入 | `src/services/template-matching-engine.service.ts` | 486-548 |
| mergeFieldValues() 欄位合併 | `src/services/template-matching-engine.service.ts` | 556-574 |
| extractMappedFields() 欄位讀取 | `src/services/template-matching-engine.service.ts` | 620-653 |
| extractRowKey() 行 Key 提取 | `src/services/template-matching-engine.service.ts` | 658-670 |
| loadDocuments() 文件載入 | `src/services/template-matching-engine.service.ts` | 586-618 |
| autoMatch() 自動匹配 | `src/services/auto-template-matching.service.ts` | 319-404 |
| tryAutoComplete() 自動完成 | `src/services/auto-template-matching.service.ts` | 707-719 |
| cleanupRowsForDocument() 清理 | `src/services/auto-template-matching.service.ts` | 733-762 |
| mergeMappings() 映射合併 | `src/services/template-field-mapping.service.ts` | 434-447 |
| Excel 匯出核心 | `src/services/template-export.service.ts` | 112-153 |
| CSV 匯出核心 | `src/services/template-export.service.ts` | 230-240 |
| convertStandardFieldsToMappedFields | `src/services/unified-processor/unified-document-processor.service.ts` | 496-533 |

### C. UI 組件

| 功能 | 檔案路徑 | 行號 |
|------|----------|------|
| SourceFieldSelector 欄位選擇 | `src/components/features/template-field-mapping/SourceFieldSelector.tsx` | 50-244 |
| MappingRuleEditor 規則編輯 | `src/components/features/template-field-mapping/MappingRuleEditor.tsx` | 33-93 |
| InstanceRowsTable 列定義 | `src/components/features/template-instance/InstanceRowsTable.tsx` | 285-298 |
| InstanceRowsTable 行渲染 | `src/components/features/template-instance/InstanceRowsTable.tsx` | 304-390 |
| TemplateInstanceDetail 頁面 | `src/components/features/template-instance/TemplateInstanceDetail.tsx` | 91-164 |
