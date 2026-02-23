# CHANGE-042: 三步閉環架構 — 欄位定義動態化 + Stage 3 提取管線改造

> **日期**: 2026-02-23
> **狀態**: 🚧 Phase 1+2 已完成
> **優先級**: Critical
> **類型**: Architecture / Pipeline Enhancement
> **影響範圍**: Stage 3 提取管線、類型系統、持久化、DB Schema
> **前置分析**: `docs/05-analysis/2026-02-23-ARCH-field-definition-closed-loop.md`
> **可行性分析**: `docs/05-analysis/2026-02-23-ARCH-field-definition-feasibility.md`

---

## 變更背景

### 現有問題：E2E 數據流斷裂

Stage 3 的 `loadFieldMappingConfig()` 是 stub，永遠只回傳 8 個硬編碼欄位 → `fieldMappings` 只存 8 個 key → Template Field Mapping 的 Source Field 找不到 `sea_freight`、`thc`、`origin_port` 等 90+ 貨運欄位 → **E2E 流程無法完成**。

### 根本原因

| # | 原因 | 代碼位置 |
|---|------|---------|
| 1 | `loadFieldMappingConfig()` 是 stub | `stage-3-extraction.service.ts:366` |
| 2 | `lineItems`/`extraCharges` 未被扁平化 | `processing-result-persistence.service.ts:527` |
| 3 | `persistV3_1` 直接存 `standardFields` | `processing-result-persistence.service.ts:577` |
| 4 | `invoice-fields.ts` 定義了 90+ 欄位但 Stage 3 未使用 | `src/types/invoice-fields.ts` |

---

## 架構決策（已確認）

| # | 決策 | 最終選擇 | 理由 |
|---|------|---------|------|
| 1 | DB 模型 | **建立新的 `FieldDefinitionSet` 模型** | 語義分離：「告訴 AI 提取什麼」vs「提取結果如何映射」 |
| 2 | StandardFieldsV3 動態化 | **全部動態化** `Record<string, FieldValue>` | 架構最乾淨，統一存取方式 |
| 3 | Prompt 生成策略 | **A+B 混合**（Phase 1 文字 / Phase 2 JSON Schema） | 文字注入零改動立即可用；Schema 作為可選增強 |
| 4 | parseExtractionResult | **基於 fieldDefinitions + aliases 的動態映射** | 復用 `invoice-fields.ts` 93 欄位 aliases |

---

## 變更內容

### Phase 1: 打通最小閉環（核心 MVP）

#### 1.1 新增 Prisma Model: `FieldDefinitionSet`

```prisma
model FieldDefinitionSet {
  id               String                @id @default(uuid())
  scope            FieldDefinitionScope  @default(GLOBAL)
  companyId        String?               @map("company_id")
  documentFormatId String?               @map("document_format_id")
  name             String                @db.VarChar(200)
  description      String?
  isActive         Boolean               @default(true) @map("is_active")
  version          Int                   @default(1)
  createdAt        DateTime              @default(now()) @map("created_at")
  updatedAt        DateTime              @updatedAt @map("updated_at")
  createdBy        String?               @map("created_by")

  // 欄位定義存為 JSON（靈活結構）
  fields           Json                  // FieldDefinitionEntry[]

  // Relations
  company          Company?              @relation(fields: [companyId], references: [id])
  documentFormat   DocumentFormat?       @relation(fields: [documentFormatId], references: [id])

  @@unique([scope, companyId, documentFormatId])
  @@index([companyId])
  @@index([documentFormatId])
  @@index([scope])
  @@index([isActive])
  @@map("field_definition_sets")
}

enum FieldDefinitionScope {
  GLOBAL
  COMPANY
  FORMAT
}
```

**`fields` JSON 結構**:

```typescript
interface FieldDefinitionEntry {
  key: string              // e.g. "sea_freight"
  label: string            // e.g. "Sea Freight"
  category: string         // e.g. "charges"
  dataType: string         // "string" | "number" | "date" | "currency"
  required: boolean
  description?: string
  aliases?: string[]       // 額外別名（補充 invoice-fields.ts）
  extractionHints?: string // 提取提示給 AI
}
```

#### 1.2 實作 `loadFieldMappingConfig()` → 從 DB 讀取

**檔案**: `src/services/extraction-v3/stages/stage-3-extraction.service.ts`

```
現狀 (stub):
  loadFieldMappingConfig(_companyId, _formatId)
  → return { standardFields: 8 個硬編碼欄位 }

改造後:
  loadFieldDefinitionSet(companyId, formatId)
  → DB 查詢: FORMAT scope > COMPANY scope > GLOBAL scope
  → 合併: GLOBAL fields ∪ COMPANY fields (COMPANY 優先)
  → return { id, fields: FieldDefinitionEntry[] }  // 30-90+ 欄位
```

**三層解析邏輯**:

```
1. 查 FORMAT scope (companyId + formatId)
2. 查 COMPANY scope (companyId, formatId=null)
3. 查 GLOBAL scope (companyId=null, formatId=null)
4. 合併: GLOBAL 為基底，COMPANY 覆蓋/追加
5. 如果 FORMAT 存在，FORMAT 再覆蓋/追加
6. 如果全部沒找到 → fallback 到 invoice-fields.ts 的 isRequired 欄位
```

#### 1.3 擴展 `buildFieldsSection()` 支援 N 欄位

**檔案**: `src/services/extraction-v3/stages/stage-3-extraction.service.ts`

現有的 `buildFieldsSection()` 已經支援 `FieldDefinition[]` 輸入，只需將更多欄位傳入即可。

改動：
- 接收從 DB 讀取的 `FieldDefinitionEntry[]` 而非硬編碼的 8 個
- 在 prompt 中明確要求 GPT 使用 `fields` 結構回傳

#### 1.4 類型系統改造: `StandardFieldsV3` → `ExtractedFieldsV4`

**檔案**: `src/types/extraction-v3.types.ts`

```typescript
// 新增: 完全動態的欄位結構
interface ExtractedFieldsV4 {
  /** 所有欄位統一為 key-value 結構 */
  fields: Record<string, FieldValue>
  /** lineItems 保留原始結構 */
  lineItems: LineItemV3[]
  /** extraCharges 保留原始結構 */
  extraCharges?: ExtraChargeV3[]
  /** 後設數據 */
  meta: {
    fieldDefinitionSetId?: string
    extractionVersion: string
    overallConfidence: number
    fieldCount: number
    nullCount: number
  }
}
```

#### 1.5 改造 `parseExtractionResult()` 為動態映射

**檔案**: `src/services/extraction-v3/stages/stage-3-extraction.service.ts`

```
GPT 回傳 JSON
     │
     ├── Case 1: 有 "fields" key（新格式）
     │   → 直接使用，對照 fieldDefinitions 正規化
     │
     ├── Case 2: 有 "standardFields" key（向下兼容）
     │   → 將 standardFields 展平為 fields Record
     │
     └── Case 3: 原始格式（GPT 直接回傳 key-value）
         → 用 fieldDefinitions + invoice-fields.ts aliases 動態查找
```

**aliases 搜索策略**:
1. 精確匹配: `raw["invoice_number"]`
2. camelCase: `raw["invoiceNumber"]`
3. PascalCase: `raw["InvoiceNumber"]`
4. aliases: `raw["inv no"]` ... (來自 `invoice-fields.ts`)
5. 嵌套搜索: `raw.invoice_metadata?.["invoice_number"]`

#### 1.6 改造 `persistV3_1ProcessingResult()` 存入全部 fields

**檔案**: `src/services/processing-result-persistence.service.ts`

```
現狀:
  fieldMappings = standardFields  // 只有 8 個 key

改造後:
  fieldMappings = extractedResult.fields  // 30-90+ 個 key
  // 每個 key 包含: { value, confidence, source? }
```

無需 DB migration — `ExtractionResult.fieldMappings` 已是 JSON 類型。

#### 1.7 改造信心度計算

**檔案**: `src/services/extraction-v3/stages/stage-3-extraction.service.ts`

```
現狀:
  calculateOverallConfidence(standardFields)
  → 假設固定 5 個核心欄位

改造後:
  calculateOverallConfidence(fields: Record<string, FieldValue>)
  → 動態計算所有非 null 欄位的平均信心度
  → 區分 required/optional 權重
```

同時改造 `buildEmptyStandardFields()` → `buildEmptyFields(fieldDefinitions)`。

---

### Phase 2: JSON Schema 精度強化（可選增強）

#### 2.1 實作 `generateOutputSchema()` 動態生成

**檔案**: `src/services/extraction-v3/stages/stage-3-extraction.service.ts`

```typescript
// 現狀: TODO stub
// 改造後: 根據 fieldDefinitions 動態生成 JSON Schema
private generateOutputSchema(fieldDefinitions: FieldDefinitionEntry[]): Record<string, unknown> {
  const fieldProperties: Record<string, unknown> = {};
  for (const def of fieldDefinitions) {
    fieldProperties[def.key] = {
      type: 'object',
      properties: {
        value: { type: mapDataTypeToJsonType(def.dataType) },
        confidence: { type: 'number', minimum: 0, maximum: 100 },
      },
    };
  }
  return {
    type: 'object',
    properties: {
      fields: { type: 'object', properties: fieldProperties },
      lineItems: { type: 'array' },
      extraCharges: { type: 'array' },
      overallConfidence: { type: 'number' },
    },
  };
}
```

#### 2.2 `GptCallerService` 支援 `response_format`

**檔案**: `src/services/extraction-v3/stages/gpt-caller.service.ts`

- 在 API 請求中加入 `response_format: { type: "json_schema", json_schema: schema }`
- 需驗證 Azure OpenAI GPT-5.2 部署是否支援此參數

---

### Phase 3: 管理介面（後續實施）

> Phase 3 不在本次 CHANGE 範圍內，記錄為後續工作。

| 功能 | 說明 |
|------|------|
| 欄位定義管理頁面 | `/field-definitions` — CRUD 管理介面，基於 invoice-fields.ts 候選清單 |
| Source Field 整合 | `SourceFieldCombobox` 從 FieldDefinitionSet 讀取候選 |
| 回饋機制 | 匹配報告 → 通知 → 建議調整欄位定義 |

---

## 修改的檔案

### Phase 1 (核心改動)

| 檔案 | 修改內容 | 類型 |
|------|----------|------|
| `prisma/schema.prisma` | 新增 `FieldDefinitionSet` model + `FieldDefinitionScope` enum | DB |
| `src/types/extraction-v3.types.ts` | 新增 `ExtractedFieldsV4`、`FieldDefinitionEntry`；保留 `StandardFieldsV3` 向下兼容 | Type |
| `src/services/extraction-v3/stages/stage-3-extraction.service.ts` | `loadFieldMappingConfig()` → `loadFieldDefinitionSet()`；`buildFieldsSection()` 支援 N 欄位；`parseExtractionResult()` 動態映射；`calculateOverallConfidence()` 動態化；`buildEmptyStandardFields()` 改造 | Service |
| `src/services/processing-result-persistence.service.ts` | `persistV3_1ProcessingResult()` 存入全部 `fields` 而非 `standardFields` | Service |
| `src/services/extraction-v3/utils/variable-replacer.ts` | `VariableContext` 新增 `fieldDefinitions` 變數 | Util |

### Phase 1 (間接影響 — 需檢查/調整)

| 檔案 | 修改內容 | 類型 |
|------|----------|------|
| `src/services/extraction-v3/confidence-v3-1.service.ts` | 適配 `ExtractedFieldsV4`，動態計算信心度 | Service |
| `src/services/extraction-v3/result-validation.service.ts` | 適配動態欄位驗證 | Service |
| `src/services/extraction-v3/extraction-v3.service.ts` | 入口服務適配新類型 | Service |
| `src/services/extraction-v3/stages/stage-orchestrator.service.ts` | 傳遞 `Stage3ExtractionResult` 新結構 | Service |
| `src/components/features/document/detail/*` | 前端顯示適配動態欄位 | Component |

### Phase 2 (可選增強)

| 檔案 | 修改內容 | 類型 |
|------|----------|------|
| `src/services/extraction-v3/stages/stage-3-extraction.service.ts` | `generateOutputSchema()` 從 stub 改為動態生成 | Service |
| `src/services/extraction-v3/stages/gpt-caller.service.ts` | API 請求加入 `response_format` | Service |

---

## 實施順序

```
Phase 1 (打通閉環) — 本次 CHANGE 範圍
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Step 1: DB Model + Migration
  ├── 新增 FieldDefinitionSet model
  ├── 新增 FieldDefinitionScope enum
  └── npx prisma migrate dev

Step 2: 類型系統
  ├── 新增 ExtractedFieldsV4 interface
  ├── 新增 FieldDefinitionEntry interface
  └── 保留 StandardFieldsV3（暫不刪除）

Step 3: Stage 3 核心改造
  ├── loadFieldDefinitionSet() — 從 DB 讀取 + 三層合併
  ├── buildFieldsSection() — 傳入 N 欄位
  ├── parseExtractionResult() — 三格式動態映射
  ├── calculateOverallConfidence() — 動態化
  └── buildEmptyFields() — 動態化

Step 4: 持久化改造
  └── persistV3_1ProcessingResult() — 存 fields 而非 standardFields

Step 5: 間接影響適配
  ├── confidence-v3-1.service.ts
  ├── result-validation.service.ts
  ├── extraction-v3.service.ts
  └── stage-orchestrator.service.ts

Step 6: 驗證
  ├── TypeScript 編譯通過
  ├── 手動在 DB 建立 FieldDefinitionSet 測試
  └── 確認 fieldMappings 存入完整欄位

Phase 2 (精度強化) — ✅ 已完成
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Step 7: ✅ generateOutputSchema() 動態 JSON Schema（基於 FieldDefinitionEntry[] 動態生成）
Step 8: ✅ GptCallerService response_format 支援（json_schema + json_object 自動回退）
```

---

## 向下兼容策略

| 面向 | 策略 |
|------|------|
| `StandardFieldsV3` 類型 | 保留不刪除，新代碼使用 `ExtractedFieldsV4` |
| `parseExtractionResult()` | Case 2 處理舊 `standardFields` 格式 |
| `fieldMappings` DB 欄位 | JSON 類型，新舊格式都能存 |
| 無 FieldDefinitionSet 時 | Fallback 到 `invoice-fields.ts` 的 required 欄位子集 |
| 前端顯示 | 動態渲染 `Record<string, FieldValue>` 而非固定 8 欄位 |

---

## 風險與注意事項

### 高風險

| 風險 | 影響 | 緩解措施 |
|------|------|----------|
| 下游引用 `standardFields.invoiceNumber` 寫法 | 大量 TypeScript 錯誤 | 搜索所有引用點，逐一改為 `fields["invoice_number"]` |
| `calculateOverallConfidence()` 假設固定 5 核心欄位 | 信心度計算可能不準 | 改為動態計算，required 欄位加權 |
| 兩條持久化路徑共存 | 行為不一致 | 確保 unified-processor 路徑和 v3.1 路徑都適配 |

### 中風險

| 風險 | 影響 | 緩解措施 |
|------|------|----------|
| GPT 回傳的 key 名與定義不完全一致 | 部分欄位丟失 | aliases 動態匹配 + Phase 2 JSON Schema 強制 |
| 45+ 欄位 prompt 過長 | Token 成本增加 | 監控 token 用量，必要時分批提取 |

### 低風險

| 風險 | 影響 | 緩解措施 |
|------|------|----------|
| 前端頁面需適配動態欄位 | UI 顯示不完整 | 用 `Object.entries(fields)` 動態渲染 |
| invoice-fields.ts aliases 不夠完整 | 少數欄位匹配不到 | FieldDefinitionEntry 支援自定義 aliases 補充 |

---

## 測試驗證

修復完成後需驗證：

- [ ] `FieldDefinitionSet` model 已建立，migration 成功
- [ ] GLOBAL scope 的 FieldDefinitionSet 可建立和查詢
- [ ] COMPANY scope 可覆蓋 GLOBAL 欄位定義
- [ ] `loadFieldDefinitionSet()` 正確執行三層合併
- [ ] Stage 3 prompt 包含完整欄位定義（N 個而非 8 個）
- [ ] `parseExtractionResult()` 正確處理三種 GPT 回傳格式
- [ ] `persistV3_1ProcessingResult()` 存入 N 個 key 到 `fieldMappings`
- [ ] `calculateOverallConfidence()` 正確計算動態欄位信心度
- [ ] 無 FieldDefinitionSet 時 fallback 正常
- [ ] TypeScript 編譯通過
- [ ] 現有功能不受影響（向下兼容）
- [ ] `generateOutputSchema()` 動態生成 JSON Schema（Phase 2）
- [ ] `GptCallerService` 支援 `json_schema` response_format（Phase 2）
- [ ] `json_schema` 不被支援時自動回退到 `json_object`（Phase 2）

---

## 相關文檔

| 文檔 | 路徑 |
|------|------|
| 架構設計 | `docs/05-analysis/2026-02-23-ARCH-field-definition-closed-loop.md` |
| 可行性分析 | `docs/05-analysis/2026-02-23-ARCH-field-definition-feasibility.md` |
| 標準欄位目錄 | `src/types/invoice-fields.ts` |
| Stage 3 服務 | `src/services/extraction-v3/stages/stage-3-extraction.service.ts` |
| 持久化服務 | `src/services/processing-result-persistence.service.ts` |
| 變數替換器 | `src/services/extraction-v3/utils/variable-replacer.ts` |

---

*文件建立日期: 2026-02-23*
*最後更新: 2026-02-23 (Phase 2 完成)*
