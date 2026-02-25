# 三步閉環架構：可行性分析與實施決策

> **建立日期**: 2026-02-23
> **類型**: 可行性分析 / 實施決策
> **狀態**: ✅ 決策已確認 → CHANGE-042
> **前置文件**: `2026-02-23-ARCH-field-definition-closed-loop.md`

---

## 目錄

- [1. 可行性結論](#1-可行性結論)
- [2. 已有基礎設施盤點](#2-已有基礎設施盤點)
- [3. 決策 1: 復用 FieldMappingConfig 還是建新模型？](#3-決策-1-復用-fieldmappingconfig-還是建新模型)
- [4. 決策 2: StandardFieldsV3 如何動態化？](#4-決策-2-standardfieldsv3-如何動態化)
- [5. 決策 3: Prompt 動態生成的策略](#5-決策-3-prompt-動態生成的策略)
- [6. 決策 4: parseExtractionResult 的改造](#6-決策-4-parseextractionresult-的改造)
- [7. 實施路徑建議](#7-實施路徑建議)
- [8. 風險與注意事項](#8-風險與注意事項)
- [附錄: 現有代碼關鍵位置](#附錄-現有代碼關鍵位置)

---

## 1. 可行性結論

**結論：比預期更容易實現。** 系統中已有大量基礎設施可以直接復用，核心瓶頸只有 3-4 個函數需要改造。

### 已有 vs 缺失一覽

```
已有 ✅                                    缺失的 ╳
──────                                    ────────

✅ FieldMappingConfig DB 模型              ╳ loadFieldMappingConfig() 是 stub
   (scope: GLOBAL/COMPANY/FORMAT)             只回傳 8 個硬編碼欄位
   (完整的三層範圍系統)

✅ FieldMappingRule 子模型                  ╳ Stage 3 prompt 不基於欄位定義生成
   (sourceFields, targetField,                只用固定 prompt
    transformType: DIRECT/FORMULA/LOOKUP)

✅ ConfigResolver 三層解析                   ╳ persistV3_1 直接存 standardFields
   (FORMAT > COMPANY > GLOBAL)                不扁平化 lineItems
   (已在 unified-processor 中運作)

✅ FieldMappingConfig CRUD API (11 個端點)   ╳ StandardFieldsV3 是固定 interface
   (/api/v1/field-mapping-configs/*)           只有 8 個欄位的 TypeScript 類型

✅ PromptConfig 系統 + 變數替換              ╳ parseExtractionResult 硬編碼欄位名
   (CHANGE-026 已整合)                        固定找 invoice_number 等

✅ invoice-fields.ts (93 個標準欄位)         ╳ 沒有管理介面連接到 Stage 3
   (完整分類 + aliases + validation)

✅ DocumentFormat.features.customFields
   (Stage 3 已有讀取邏輯)

✅ ExtractionResult.fieldMappings 是 JSON 類型
   (存更多欄位不需要 schema migration)
```

**關鍵發現：`FieldMappingConfig` 不需要新建，它已經存在且有完整的 CRUD API。** 架構文件中提到的 `FieldDefinitionSet` 其實就是現有的 `FieldMappingConfig`。

---

## 2. 已有基礎設施盤點

### 2.1 FieldMappingConfig Prisma Model

**位置**: `prisma/schema.prisma` (第 2922-2947 行)

```prisma
model FieldMappingConfig {
  id               String             @id @default(cuid())
  scope            FieldMappingScope  @default(GLOBAL)     // GLOBAL | COMPANY | FORMAT
  companyId        String?            @map("company_id")
  documentFormatId String?            @map("document_format_id")
  name             String             @db.VarChar(100)
  description      String?
  isActive         Boolean            @default(true) @map("is_active")
  version          Int                @default(1)
  createdAt        DateTime           @default(now()) @map("created_at")
  updatedAt        DateTime           @updatedAt @map("updated_at")
  createdBy        String?            @map("created_by")
  dataTemplateId   String?            @map("data_template_id")

  // Relations
  company          Company?           @relation(fields: [companyId], references: [id])
  dataTemplate     DataTemplate?      @relation(fields: [dataTemplateId], references: [id])
  documentFormat   DocumentFormat?    @relation(fields: [documentFormatId], references: [id])
  rules            FieldMappingRule[]

  @@unique([scope, companyId, documentFormatId])
  @@index([companyId])
  @@index([documentFormatId])
  @@index([scope])
  @@index([isActive])
  @@index([dataTemplateId])
  @@map("field_mapping_configs")
}
```

**子模型 FieldMappingRule** (第 2952-2971 行):

```prisma
model FieldMappingRule {
  id              String             @id @default(cuid())
  configId        String             @map("config_id")
  sourceFields    Json               @map("source_fields")     // JSON array of source field names
  targetField     String             @map("target_field") @db.VarChar(100)
  transformType   FieldTransformType @default(DIRECT)           // DIRECT|CONCAT|SPLIT|LOOKUP|CUSTOM|FORMULA
  transformParams Json?              @map("transform_params")
  priority        Int                @default(0)
  isActive        Boolean            @default(true) @map("is_active")
  description     String?            @db.VarChar(500)
  createdAt       DateTime           @default(now()) @map("created_at")
  updatedAt       DateTime           @updatedAt @map("updated_at")
  config          FieldMappingConfig @relation(fields: [configId], references: [id], onDelete: Cascade)
}
```

**可擴展性評估**:

- 具備完整的三層範圍系統 (GLOBAL/COMPANY/FORMAT)
- 已有 `dataTemplateId` 關聯，可以連結 DataTemplate
- 唯一約束 `@@unique([scope, companyId, documentFormatId])` 確保每個範圍組合只有一個配置
- 現有模型完全可以直接使用，不需要建新模型
- 但目前 Stage 3 的 `loadFieldMappingConfig` 是 stub，完全沒有真正讀取這個模型

### 2.2 ConfigResolver 三層解析

**位置**: `src/services/mapping/config-resolver.ts`

已實現 FORMAT > COMPANY > GLOBAL 優先級解析，從 DB 讀取 `FieldMappingConfig` + `FieldMappingRule[]` 並按優先級合併。可直接復用於 Stage 3。

### 2.3 FieldMappingConfig CRUD API

| API 路由 | 功能 |
|----------|------|
| `GET/POST /api/v1/field-mapping-configs/` | 列表+篩選+分頁 / 建立 |
| `GET/PATCH/DELETE /api/v1/field-mapping-configs/[id]` | 詳情含rules / 更新+樂觀鎖 / 級聯刪除 |
| `POST /api/v1/field-mapping-configs/[id]/rules` | 建立規則 |
| `PATCH/DELETE /api/v1/field-mapping-configs/[id]/rules/[ruleId]` | 規則操作 |
| `POST /api/v1/field-mapping-configs/[id]/rules/reorder` | 重排序 |
| `POST /api/v1/field-mapping-configs/[id]/test` | 測試配置 |
| `GET /api/v1/field-mapping-configs/[id]/export` | 匯出 JSON |
| `POST /api/v1/field-mapping-configs/import` | 匯入 JSON |

### 2.4 invoice-fields.ts 標準欄位目錄

**位置**: `src/types/invoice-fields.ts` (1127 行)

8 個分類，共約 93 個欄位:

| 分類 | 常數名 | 欄位數 | 範例欄位 |
|------|--------|--------|----------|
| **basic** | BASIC | 15 | invoice_number, invoice_date, currency, forwarder_name |
| **shipper** | SHIPPER | 12 | shipper_name, shipper_country, shipper_phone |
| **consignee** | CONSIGNEE | 12 | consignee_name, consignee_country |
| **shipping** | SHIPPING | 16 | tracking_number, ship_date, origin_code, container_number |
| **package** | PACKAGE | 10 | total_pieces, gross_weight, chargeable_weight |
| **charges** | CHARGES | 15 | freight_charge, fuel_surcharge, total_amount |
| **reference** | REFERENCE | 8 | po_number, booking_number, job_number |
| **payment** | PAYMENT | 6 | payment_terms, bank_name, swift_code |

每個欄位包含 `InvoiceFieldDefinition` 結構：`name`, `label`, `category`, `dataType`, `isRequired`, `description`, `aliases[]`, `validationPattern?`, `example?`

9 種資料類型: string, number, date, currency, address, phone, email, weight, dimension

Helper 函數：`getAllFieldNames()`, `getFieldsByCategory()`, `getRequiredFields()`, `getFieldDefinition()`, `findFieldByAlias()`, `getTotalFieldCount()`, `getCategoryStats()`

**關鍵發現**: 這 93 個欄位 vs Stage 3 的 8 個硬編碼欄位之間有巨大差距。`invoice-fields.ts` 定義了完整的發票領域知識，但 Stage 3 完全沒有使用它。

### 2.5 Stage 3 內部機制

#### loadFieldMappingConfig — 完整 stub

```typescript
// stage-3-extraction.service.ts:366
private async loadFieldMappingConfig(
    _companyId?: string,      // 參數前綴 _ 表示未使用
    _formatId?: string
): Promise<{
    id?: string;
    standardFields: FieldDefinition[];
}> {
    // TODO: Phase 2 - 從資料庫載入 FieldMappingConfig
    // 目前返回預設標準欄位
    return {
        standardFields: this.getDefaultStandardFieldDefinitions(),
    };
}
```

此方法：
- 接收 `companyId` 和 `formatId` 但完全忽略（`_` 前綴）
- 返回值不包含 `id`（因為沒有查 DB）
- 永遠返回那 8 個硬編碼欄位
- 明確標記 `TODO: Phase 2`

#### getDefaultStandardFieldDefinitions — 8 個硬編碼欄位

```
stage-3-extraction.service.ts:961-1007
```

| # | key | displayName | type | required |
|---|-----|-------------|------|----------|
| 1 | `invoiceNumber` | Invoice Number | string | true |
| 2 | `invoiceDate` | Invoice Date | date | true |
| 3 | `dueDate` | Due Date | date | false |
| 4 | `vendorName` | Vendor Name | string | true |
| 5 | `customerName` | Customer Name | string | false |
| 6 | `totalAmount` | Total Amount | currency | true |
| 7 | `subtotal` | Subtotal | currency | false |
| 8 | `currency` | Currency | string | true |

#### loadFormatCustomFields — 已實作但少用

```typescript
// stage-3-extraction.service.ts:433-467
private async loadFormatCustomFields(formatId: string): Promise<FieldDefinition[]> {
    const format = await this.prisma.documentFormat.findUnique({
        where: { id: formatId },
        select: { features: true },
    });
    if (featuresJson.customFields) {
        return Object.entries(featuresJson.customFields).map(([key, value]) => ({
            key, displayName: key, type: value.type || 'string',
            required: value.required || false,
            extractionHints: value.hints,
        }));
    }
    return [];
}
```

此方法已實作但很少被使用，因為大多數 `DocumentFormat.features` JSON 中不太可能有 `customFields` 結構。

### 2.6 PromptConfig 系統

**Prisma Model** (`prisma/schema.prisma` 第 2976-3004 行):

```prisma
model PromptConfig {
  id                 String          @id @default(cuid())
  promptType         PromptType      // STAGE_1_COMPANY_IDENTIFICATION
                                     // | STAGE_2_FORMAT_IDENTIFICATION
                                     // | STAGE_3_FIELD_EXTRACTION | ...
  scope              PromptScope     // GLOBAL | COMPANY | FORMAT
  name               String          @db.VarChar(100)
  systemPrompt       String
  userPromptTemplate String
  mergeStrategy      MergeStrategy   // OVERRIDE | APPEND | PREPEND
  variables          Json?           @default("[]")
  companyId          String?
  documentFormatId   String?
  isActive           Boolean         @default(true)
  version            Int             @default(1)
  // ... timestamps, company, documentFormat relations
  @@unique([promptType, scope, companyId, documentFormatId])
}
```

Stage 3 中的使用 — `loadPromptConfigHierarchical()` (第 285-361 行):

- 按 FORMAT > COMPANY > GLOBAL 優先級查找
- 找不到時返回硬編碼預設值
- CHANGE-026 加入了 `variable-replacer.ts` 支援 `${universalMappings}` 等變數替換

Prompt 管理架構（在 `src/services/` 中）:
- `prompt-resolver.service.ts` — 解析器
- `prompt-cache.service.ts` — 快取
- `prompt-merge-engine.service.ts` — 合併引擎 (OVERRIDE/APPEND/PREPEND)
- `prompt-variable-engine.service.ts` — 變數引擎
- `hybrid-prompt-provider.service.ts` — 混合提供者
- `static-prompts.ts` — 靜態預設 prompts
- API 端點: `/api/v1/prompt-configs/` (CRUD)

### 2.7 persistV3_1ProcessingResult 的數據路徑

**位置**: `src/services/processing-result-persistence.service.ts` (第 458-662 行)

```typescript
export async function persistV3_1ProcessingResult(input) {
    const { stage3Result } = input.result;

    // 直接從 Stage 3 取出 standardFields
    const standardFields = stage3Result?.standardFields ?? {};

    // 統計
    const standardFieldKeys = Object.keys(standardFields);
    const mappedFields = standardFieldKeys.filter(key => {
        const field = standardFields[key];
        return field?.value !== null && field?.value !== undefined && field?.value !== '';
    }).length;

    // Upsert ExtractionResult
    prisma.extractionResult.upsert({
        create: {
            fieldMappings: standardFields as unknown as Prisma.InputJsonValue,
            // ↑ 直接存 standardFields（只有 8 個 key）
            stage3Result: stage3Result as unknown as Prisma.InputJsonValue,
            // ...
        },
        update: {
            fieldMappings: standardFields as unknown as Prisma.InputJsonValue,
            // ↑ 同上
        },
    });
}
```

關鍵發現:
- `ExtractionResult.fieldMappings` 存的就是 `stage3Result.standardFields`
- `fieldMappings` 是 JSON 類型，存入更多欄位**不需要 schema migration**
- `stage3Result` 本身也被完整存為 JSON（lineItems 埋在這裡）

---

## 3. 決策 1: 復用 FieldMappingConfig 還是建新模型？

### 方案 A: 復用 FieldMappingConfig（推薦）

```
FieldMappingConfig 已有:
├── scope: GLOBAL / COMPANY / FORMAT     ← 完全對應三層
├── companyId / documentFormatId         ← 已有關聯
├── FieldMappingRule[]:
│   ├── sourceFields: Json               ← 可存欄位定義
│   ├── targetField: string              ← 目標欄位
│   └── transformType: DIRECT/FORMULA... ← 轉換方式
├── ConfigResolver 三層解析              ← 直接可用
└── 11 個 CRUD API 端點                  ← 直接可用

需要的調整:
├── 新增「欄位定義模式」(用於 Stage 3 提取定義)
│   vs 現有的「映射模式」(用於 Template 匹配)
└── 或增加一個 configType 欄位區分用途
```

### 方案 B: 建立新的 FieldDefinitionSet 模型

```
優點: 職責分離更清晰
缺點: 重複建設（三層解析、CRUD、API 都要重做）
```

### 語義問題

```
FieldMappingConfig + FieldMappingRule 的原始設計目的:
────────────────────────────────────────────────────
sourceFields: ["invoice_number"]  →  targetField: "發票號碼"
                                     transformType: DIRECT

它的語義是「提取出來的欄位 → 如何映射到目標」


而「欄位定義」的語義是:
────────────────────────────────────────────────────
key: "sea_freight"
label: "Sea Freight"
type: "currency"
required: false
extractionHints: ["海運費", "OCEAN FREIGHT"]

它的語義是「告訴 AI 要提取什麼欄位」
```

這是兩個不同的概念。需要決策：是復用現有模型（加 `configType` 區分），還是建一個語義更清晰的新模型？

---

## 4. 決策 2: StandardFieldsV3 如何動態化？

現在 `StandardFieldsV3` 是一個固定 interface:

```typescript
// 現狀: 寫死 8 個欄位
interface StandardFieldsV3 {
  invoiceNumber: FieldValue
  invoiceDate: FieldValue
  dueDate?: FieldValue
  vendorName: FieldValue
  customerName?: FieldValue
  totalAmount: FieldValue
  subtotal?: FieldValue
  currency: FieldValue
}
```

### 方案 A: 核心 + 動態（向下兼容）

```typescript
interface ExtractedFieldsV4 {
  // 核心欄位保留（向下兼容）
  core: {
    invoiceNumber: FieldValue
    invoiceDate: FieldValue
    vendorName: FieldValue
    totalAmount: FieldValue
    currency: FieldValue
  }
  // 動態欄位（新增）
  fields: Record<string, FieldValue>
  // 原始結構保留
  lineItems: LineItemV3[]
  extraCharges?: ExtraChargeV3[]
}
```

| 優點 | 缺點 |
|------|------|
| 不破壞現有下游代碼 | 有兩個地方存欄位（core + fields），可能混淆 |
| 漸進式遷移 | 需要決定哪些欄位算「核心」 |

### 方案 B: 全部動態化

```typescript
interface ExtractedFieldsV4 {
  // 所有欄位統一為動態結構
  fields: Record<string, FieldValue>
  lineItems: LineItemV3[]
  extraCharges?: ExtraChargeV3[]
}
```

| 優點 | 缺點 |
|------|------|
| 架構最乾淨 | 需要修改所有引用 `standardFields.invoiceNumber` 的地方 |
| 統一存取方式 | 改動範圍較大 |

---

## 5. 決策 3: Prompt 動態生成的策略

### 方案 A: 欄位定義注入到現有 PromptConfig 變數

利用 CHANGE-026 已有的 `variable-replacer.ts`:

```
systemPrompt 模版:
"請從以下文件提取這些欄位: ${fieldDefinitions}"

variable-replacer 動態替換 ${fieldDefinitions} 為:
"- invoice_number (Invoice Number, string, required)
 - sea_freight (Sea Freight, currency, optional)
 - thc (THC, currency, optional)
 ..."
```

| 優點 | 缺點 |
|------|------|
| 不需要改 PromptConfig 系統，只加一個新變數 | prompt 可能很長（45+ 欄位的文字描述） |
| 與現有架構無縫整合 | 文字描述可能不夠精確 |

### 方案 B: JSON Schema 模式（GPT structured output）

根據欄位定義動態生成 JSON Schema:

```json
{
  "type": "object",
  "properties": {
    "invoice_number": { "type": "string" },
    "sea_freight": { "type": "number" },
    "thc": { "type": "number" },
    "origin_port": { "type": "string" }
  }
}
```

傳給 GPT 的 `response_format` 參數，強制 GPT 回傳符合 schema 的 JSON。

| 優點 | 缺點 |
|------|------|
| GPT 回傳格式保證正確，不需要 parse 容錯 | 需要研究 GPT-5.2 的 structured output 支援度 |
| 更精確的類型控制 | Schema 太大可能影響效能 |

> **備註**: 目前 Stage 3 已經在用 JSON schema（`callGpt52` 有 schema 參數），所以方案 B 的基礎已存在。

---

## 6. 決策 4: parseExtractionResult 的改造

### 現狀

`convertRawResponseToStandardFormat()` 有大量硬編碼:

```typescript
// 現狀: 硬編碼欄位映射
const result = {
  invoiceNumber: findField(raw, 'invoice_number', 'invoiceNumber'),
  invoiceDate: findField(raw, 'invoice_date', 'invoiceDate'),
  vendorName: findField(raw, 'vendor_name', 'vendorName'),
  // ... 每個欄位都有 2-3 個別名
}
```

### 改造方向: 基於欄位定義的動態映射

```
欄位定義（來自 invoice-fields.ts 或 DB）:
  key: "invoice_number"
  aliases: ["invoiceNumber", "inv_no", "發票號碼"]

改造後的解析邏輯:
  for each fieldDef in definitions:
    value = findField(raw, fieldDef.key, ...fieldDef.aliases)
    result[fieldDef.key] = value
```

`invoice-fields.ts` 已經有 `aliases[]` 欄位，可以直接用於此目的。

---

## 7. 實施路徑建議

### 改動規模預估

```
🔴 核心改動 (打通斷裂)
├── loadFieldMappingConfig()         ← stub → 實作 DB 讀取
├── buildFieldsSection()             ← 8 欄位 → N 欄位
├── parseExtractionResult()          ← 硬編碼 → 基於定義的動態解析
└── persistV3_1ProcessingResult()    ← standardFields → 全部 fields

🟡 類型改動
├── StandardFieldsV3 → ExtractedFieldsV4
└── Stage3ExtractionResult 對應調整

🟢 可復用 (不需改動)
├── FieldMappingConfig DB 模型
├── ConfigResolver 三層解析
├── FieldMappingConfig CRUD API (11 端點)
├── PromptConfig + variable-replacer
├── invoice-fields.ts (93 欄位定義)
├── ExtractionResult.fieldMappings (JSON, 無需 migration)
└── SourceFieldCombobox (已支援動態欄位)
```

### 建議分階段實施

```
Phase 1: 打通最小閉環
──────────────────────
1. 實作 loadFieldMappingConfig() — 從 DB 讀取 FieldMappingConfig
2. 修改 buildFieldsSection() — 支援 N 個欄位
3. 修改 persistV3_1 — 存入全部 fields
4. 驗證: 手動在 DB 建一個 FieldMappingConfig，確認 Stage 3 能讀取並提取

Phase 2: 類型系統改造
──────────────────────
1. StandardFieldsV3 → ExtractedFieldsV4
2. 修改 parseExtractionResult() 為動態解析
3. 修改所有下游引用（信心度計算、前端顯示等）
4. 驗證: TypeScript 編譯通過 + 現有功能不 break

Phase 3: 管理介面
──────────────────────
1. 欄位定義管理頁面（基於現有 FieldMappingConfig API）
2. SourceFieldCombobox 從欄位定義讀取候選
3. 回饋機制（匹配報告 + 通知）
```

---

## 8. 風險與注意事項

### 8.1 StandardFieldsV3 類型是 hardcoded interface

如果要支援動態欄位，需要將其改為 `Record<string, FieldValue>` 或用 union type。這會影響下游所有引用該類型的地方：
- 信心度計算（`calculateOverallConfidence`）
- 結果驗證
- 前端顯示

### 8.2 buildEmptyStandardFields() 和 calculateOverallConfidence()

這兩個函數都假設 exactly 5 個核心欄位（invoiceNumber, invoiceDate, vendorName, totalAmount, currency）。動態化後需要重構。

### 8.3 parseExtractionResult 中的 convertRawResponseToStandardFormat()

(第 705-765 行) 有硬編碼的欄位提取邏輯（固定找 `invoice_number`, `vendor_name` 等），動態化後這些也需要改為基於配置的映射。

### 8.4 兩種持久化路徑共存

目前有兩種路徑：
- **Unified Processor** 路徑（`persistProcessingResult`）：把 `MappedFieldValue[]` 轉為 `Record<string, FieldMappingEntry>`
- **V3.1** 路徑（`persistV3_1ProcessingResult`）：直接把 `standardFields` 物件存入

改造時需要確保兩條路徑的行為一致，或決定是否統一為一條路徑。

---

## 附錄: 現有代碼關鍵位置

### Stage 3 核心

| 功能 | 檔案 | 行號 |
|------|------|------|
| Stage 3 入口 | `src/services/extraction-v3/stages/stage-3-extraction.service.ts` | `execute()` 153-225 |
| loadFieldMappingConfig (stub) | 同上 | 366-377 |
| loadFormatCustomFields | 同上 | 433-467 |
| buildExtractionPrompt | 同上 | 532-579 |
| buildFieldsSection | 同上 | 581-620 |
| convertRawResponseToStandardFormat | 同上 | 705-765 |
| getDefaultStandardFieldDefinitions | 同上 | 961-1007 |
| 預設 System Prompt | 同上 | 944-949 |

### 類型定義

| 功能 | 檔案 | 行號 |
|------|------|------|
| StandardFieldsV3 | `src/types/extraction-v3.types.ts` | ~1050 |
| Stage3ExtractionResult | 同上 | 1116 |
| FieldValue | 同上 | ~1040 |
| LineItemV3 | 同上 | ~1070 |
| InvoiceFieldDefinition | `src/types/invoice-fields.ts` | 全檔 |

### 持久化

| 功能 | 檔案 | 行號 |
|------|------|------|
| persistV3_1ProcessingResult | `src/services/processing-result-persistence.service.ts` | 458-662 |
| fieldMappings 寫入 | 同上 | 527, 577 |

### 配置解析

| 功能 | 檔案 |
|------|------|
| ConfigResolver 三層解析 | `src/services/mapping/config-resolver.ts` |
| PromptConfig 載入 | `stage-3-extraction.service.ts` 285-361 |
| variable-replacer | `src/services/extraction-v3/utils/variable-replacer.ts` |

### DB 模型

| 模型 | 檔案 | 行號 |
|------|------|------|
| FieldMappingConfig | `prisma/schema.prisma` | 2922-2947 |
| FieldMappingRule | 同上 | 2952-2971 |
| PromptConfig | 同上 | 2976-3004 |
| DocumentFormat | 同上 | 2874-2898 |
| ExtractionResult | 同上 | 554 |

### API 端點

| 功能 | 路徑 |
|------|------|
| FieldMappingConfig CRUD | `src/app/api/v1/field-mapping-configs/` (11 端點) |
| PromptConfig CRUD | `src/app/api/v1/prompt-configs/` |
| Extracted Fields 發現 | `src/app/api/v1/formats/[id]/extracted-fields/route.ts` |

### Source Field

| 功能 | 檔案 |
|------|------|
| Source Field 候選清單合併 | `src/services/mapping/source-field.service.ts` |
| Source Field Combobox UI | `src/components/features/formats/SourceFieldCombobox.tsx` |

---

## 決策結論（2026-02-23 確認）

| # | 決策 | 最終選擇 | 理由 |
|---|------|---------|------|
| 1 | DB 模型 | **方案 B: 建立新的 FieldDefinitionSet 模型** | 語義不同：「告訴 AI 提取什麼欄位」vs「提取結果如何映射到目標」，職責分離更清晰 |
| 2 | StandardFieldsV3 | **方案 B: 全部動態化** `Record<string, FieldValue>` | 架構最乾淨，統一存取方式，避免 core + fields 雙結構混淆 |
| 3 | Prompt 生成 | **方案 A+B 混合（文字 + Schema 雙軌）** | Phase 1 先用文字注入（零改動、立即可用）；Phase 2 加入 JSON Schema structured output 強化精度 |
| 4 | parseExtractionResult | **基於 fieldDefinitions + invoice-fields.ts aliases 的動態映射** | 復用現有 93 欄位 aliases，三種 GPT 回傳格式全覆蓋（fields / standardFields / raw），向下兼容 |

### 實施編號

**CHANGE-042**: 三步閉環架構 — 欄位定義動態化 + Stage 3 提取管線改造

---

*文件建立日期: 2026-02-23*
*最後更新: 2026-02-23（決策已確認）*
