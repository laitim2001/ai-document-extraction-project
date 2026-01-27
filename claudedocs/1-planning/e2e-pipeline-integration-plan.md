# 端到端管線整合計劃：上傳 → 統一處理 → 模版匹配

> **建立日期**: 2026-01-27
> **目的**: 打通從文件上傳到 Epic 19 模版匹配的完整資料流
> **涉及 Epics**: Epic 2 (上傳), Epic 15 (統一處理), Epic 19 (模版匹配)
> **狀態**: 📋 規劃階段 — 待用戶審核

---

## 1. 現狀診斷

### 1.1 資料流斷裂圖

```
 ┌────────────────────────────────────────────────────────────────────────────┐
 │ 目前的「上傳」流程 (Epic 2)                                                │
 │                                                                            │
 │   Upload API ──→ Azure Blob ──→ Document (UPLOADED)                        │
 │       │                                                                    │
 │       └──→ extractDocument() ──→ Python OCR ──→ OcrResult (OCR_COMPLETED)  │
 │                                                                            │
 │                               🔴 到此為止，後續全部斷開                     │
 └────────────────────────────────────────────────────────────────────────────┘
                                          ↓ (不存在的連接)
 ┌────────────────────────────────────────────────────────────────────────────┐
 │ 統一處理管線 (Epic 15) — 已建構，但從未被呼叫                               │
 │                                                                            │
 │   UnifiedDocumentProcessorService.processFile()                            │
 │       │                                                                    │
 │       ├── Step 1: FILE_TYPE_DETECTION                                      │
 │       ├── Step 2: SMART_ROUTING                                            │
 │       ├── Step 3: ISSUER_IDENTIFICATION ──→ companyId                      │
 │       ├── Step 4: FORMAT_MATCHING ──→ documentFormatId                     │
 │       ├── Step 5: CONFIG_FETCHING ──→ fieldMappingConfig + promptConfig    │
 │       ├── Step 6: AZURE_DI_EXTRACTION ──→ invoiceData                     │
 │       ├── Step 7: GPT_ENHANCED_EXTRACTION ──→ gptExtraction               │
 │       ├── Step 8: FIELD_MAPPING ──→ mappedFields[] + unmappedFields[]     │
 │       ├── Step 9: TERM_RECORDING ──→ recordedTerms[]                      │
 │       ├── Step 10: CONFIDENCE_CALCULATION ──→ overallConfidence            │
 │       └── Step 11: ROUTING_DECISION ──→ routingDecision                   │
 │                                                                            │
 │   🔴 結果 UnifiedProcessingResult 從未寫入資料庫                            │
 └────────────────────────────────────────────────────────────────────────────┘
                                          ↓ (不存在的連接)
 ┌────────────────────────────────────────────────────────────────────────────┐
 │ 模版匹配 (Epic 19) — 已建構，但缺少上游資料                                 │
 │                                                                            │
 │   Template Matching Engine:                                                │
 │       loadDocuments() ──→ 讀取 ExtractionResult.fieldMappings              │
 │                            🔴 ExtractionResult 表目前為空                   │
 │       ↓                                                                    │
 │       resolveMapping() ──→ TemplateFieldMapping 規則                       │
 │                            🔴 TemplateFieldMapping 表無 seed 數據           │
 │       ↓                                                                    │
 │       transformFields() + validateFields() + upsertRow()                   │
 │       ↓                                                                    │
 │       TemplateInstanceRow（結構化數據結果）                                  │
 │                                                                            │
 │   autoMatch() — 定義了但從未被任何流程呼叫                                  │
 └────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 缺口清單

| # | 缺口 | 嚴重度 | 位置 | 影響 |
|---|------|--------|------|------|
| G1 | Upload route 從未呼叫統一處理管線 | 🔴 CRITICAL | `src/app/api/documents/upload/route.ts:320-328` | 上傳後只做 OCR，不做完整處理 |
| G2 | 沒有任何 API 端點觸發統一處理管線 | 🔴 CRITICAL | 全部 API 路由 — 零引用 | 統一處理管線完全孤立 |
| G3 | Legacy adapter 是 stub（回傳 mock） | 🔴 CRITICAL | `adapters/legacy-processor.adapter.ts:73-87` | fallback 路徑回傳假數據 |
| G4 | `enableUnifiedProcessor` 硬編碼 false，無環境變數控制 | 🟡 HIGH | `constants/processing-steps.ts:153` | 無法在不改 code 的情況下啟用 |
| G5 | 統一處理結果從未寫入 `ExtractionResult` 表 | 🔴 CRITICAL | `ExtractionResult` model (schema:908) | Epic 19 引擎讀不到數據 |
| G6 | `extractDocument()` 只寫 `OcrResult`，不寫 `ExtractionResult` | 🟡 HIGH | `services/extraction.service.ts` | 即使做了 OCR 也缺少映射結果 |
| G7 | 處理完成後無 hook 呼叫 `autoMatch()` | 🟡 HIGH | `auto-template-matching.service.ts` | 需要手動觸發匹配 |
| G8 | 統一處理器需要 `fileBuffer`，但上傳流程只存 blob URL | 🟡 MEDIUM | `ProcessFileInput.fileBuffer` | 介面不匹配 |
| G9 | `TemplateFieldMapping` 表無 seed 數據 | 🟡 MEDIUM | `prisma/seed.ts` | 無法測試欄位映射轉換 |
| G10 | `Document.formatId` 未從處理結果回寫 | 🟢 LOW | `autoMatch()` line 351 | FORMAT 級別模版解析失效 |

---

## 2. 各缺口解決方案詳述

### G1 + G2：建立統一處理的觸發入口

#### 問題描述

`upload/route.ts` 第 320-328 行：
```typescript
// 目前的代碼 — 只觸發 Legacy OCR
if (autoExtract && uploaded.length > 0) {
  Promise.allSettled(
    uploaded.map((doc) => extractDocument(doc.id))
  ).catch((error) => {
    console.error('Auto-extract trigger error:', error)
  })
}
```

上傳後只呼叫 `extractDocument()`（Legacy OCR），從未呼叫 `UnifiedDocumentProcessorService`。
API CLAUDE.md 文檔提到 `/documents/[id]/process/` 端點但實際不存在。

#### 解決方案

**方案 A（推薦）：建立新的 `/api/documents/[id]/process` 端點**

```
新建文件: src/app/api/documents/[id]/process/route.ts

POST /api/documents/{id}/process

功能:
  1. 讀取 Document 記錄（取得 blobName）
  2. 從 Azure Blob Storage 下載 fileBuffer
  3. 建構 ProcessFileInput
  4. 呼叫 getUnifiedDocumentProcessor().processFile(input, options)
  5. 將結果寫入 ExtractionResult + 更新 Document 狀態
  6. （可選）觸發 autoMatch()

參數:
  - forceUnified?: boolean  // 強制使用統一處理器（忽略 feature flag）
  - skipAutoMatch?: boolean // 跳過自動匹配

回傳: UnifiedProcessingResult 的摘要
```

**方案 B：修改 upload route 直接呼叫統一處理器**

在 `upload/route.ts` 第 320 行替換 `extractDocument()` 為統一處理器呼叫。

**取捨分析**：

| 面向 | 方案 A（新端點） | 方案 B（修改上傳） |
|------|-----------------|-------------------|
| 向後相容 | ✅ 不影響現有上傳流程 | ❌ 改變現有行為 |
| 靈活性 | ✅ 可單獨重新處理文件 | ❌ 只在上傳時觸發 |
| 複雜度 | 中（新增一個 route） | 低（修改一行呼叫） |
| 測試友好 | ✅ 可獨立測試處理管線 | ❌ 必須從上傳開始 |
| 重試支援 | ✅ 可對已上傳文件重新處理 | ❌ 需要重新上傳 |

**建議**: 方案 A — 同時保留 `upload/route.ts` 的上傳後自動觸發（改為呼叫新端點），也允許手動對單一文件重新處理。

---

### G3：修復 Legacy Processor Adapter

#### 問題描述

`legacy-processor.adapter.ts` 第 73-87 行：
```typescript
private async callLegacyProcessor(input: ProcessFileInput): Promise<LegacyProcessingResult> {
  // TODO: 整合現有的 batch-processor.service.ts 和 processing-router.service.ts
  // 暫時返回模擬結果
  await new Promise((resolve) => setTimeout(resolve, 100));
  return {
    success: true, fileId: input.fileId,
    extractedData: {}, processingMethod: 'LEGACY', confidence: 0.5,
  };
}
```

#### 解決方案

**方案 A（推薦）：直接啟用統一處理器，不修 Legacy adapter**

如果我們的目標是全面啟用統一處理管線（`enableUnifiedProcessor = true`），那 Legacy adapter 永遠不會被呼叫。此方案下不需要修復 G3。

**方案 B：正式整合 Legacy adapter**

將 `callLegacyProcessor()` 改為呼叫 `extractDocument()`，將 `OcrResult` 轉換為 `LegacyProcessingResult`。適用於漸進式部署場景。

**建議**: 方案 A — 既然目標是完整測試，直接將 flag 設為 true。在未來需要 fallback 時再修復 Legacy adapter。

---

### G4：Feature Flag 環境變數化

#### 問題描述

`constants/processing-steps.ts` 第 153 行：
```typescript
enableUnifiedProcessor: false, // 硬編碼
```

#### 解決方案

```typescript
// 修改 processing-steps.ts
export const DEFAULT_PROCESSOR_FLAGS: UnifiedProcessorFlags = {
  enableUnifiedProcessor: process.env.ENABLE_UNIFIED_PROCESSOR === 'true',
  // ... 其他 flags 保持不變
};
```

```bash
# .env 新增
ENABLE_UNIFIED_PROCESSOR=true
```

**影響範圍**: 只改一行代碼 + 一個環境變數。低風險。

---

### G5：統一處理結果寫入 ExtractionResult

#### 問題描述

統一處理器產生 `UnifiedProcessingResult`，其中包含：
- `mappedFields: MappedFieldValue[]` — 映射後的欄位列表
- `unmappedFields: UnmappedField[]` — 未映射欄位
- `overallConfidence: number` — 整體信心度
- `companyId: string` — 識別的公司
- `extractedData: ExtractedDocumentData` — 原始提取數據

但從未有代碼將這些寫入 `ExtractionResult` 表。

而 Epic 19 的 `templateMatchingEngineService.loadDocuments()` 從 `ExtractionResult.fieldMappings` 讀取：
```typescript
// template-matching-engine.service.ts:571-599
const documents = await prisma.document.findMany({
  where: { id: { in: documentIds } },
  select: {
    id: true,
    extractionResult: {
      select: { fieldMappings: true },
    },
  },
});
```

#### 資料格式轉換

統一處理器的 `MappedFieldValue[]`:
```typescript
{
  targetField: "sea_freight",
  value: 500,
  sourceFields: ["ocean_freight"],
  transformType: "DIRECT",
  success: true,
  ruleId: "rule-123",
}
```

需要轉換為 `ExtractionResult.fieldMappings` 的 JSON 格式:
```json
{
  "sea_freight": {
    "value": 500,
    "rawValue": "500.00",
    "confidence": 95,
    "source": "tier1",
    "ruleId": "rule-123",
    "extractionMethod": "DIRECT"
  }
}
```

#### 解決方案

**建立結果持久化服務** `src/services/processing-result-persistence.service.ts`:

```
功能：
1. 接收 UnifiedProcessingResult
2. 轉換 mappedFields[] → ExtractionResult.fieldMappings JSON 格式
3. 計算統計數據（totalFields, mappedFields, unmappedFields）
4. Upsert ExtractionResult 記錄（以 documentId 為唯一鍵）
5. 更新 Document 的狀態（MAPPING_COMPLETED）、companyId、documentFormatId
6. （可選）同步寫入 OcrResult 以保持向後相容

呼叫時機：
  在 /api/documents/[id]/process 端點中，processFile() 完成後呼叫
```

**關鍵轉換邏輯**:
```
MappedFieldValue[] → Record<string, FieldMappingEntry>

for each mappedField in result.mappedFields:
  fieldMappings[mappedField.targetField] = {
    value: mappedField.value,
    rawValue: mappedField.originalValues[0],
    confidence: calculateFieldConfidence(mappedField, result),
    source: inferSource(mappedField.appliedConfig),  // tier1/tier2/tier3
    ruleId: mappedField.ruleId,
    extractionMethod: mappedField.transformType,
  }
```

---

### G6：extractDocument() 只產生 OcrResult

#### 問題描述

`extraction.service.ts` 的 `extractDocument()`:
1. 更新狀態 → OCR_PROCESSING
2. 呼叫 Python OCR → 取得 OCR 結果
3. 寫入 `OcrResult` 表
4. 更新狀態 → OCR_COMPLETED

沒有產生 `ExtractionResult`（含 `fieldMappings`）。

#### 解決方案

**如果啟用統一處理器**，`extractDocument()` 不再是主要路徑。新的 `/api/documents/[id]/process` 端點直接呼叫統一處理器，統一處理器的 Step 6 (AZURE_DI_EXTRACTION) 會自行處理 OCR。

**因此 G6 不需要獨立修復**，只要 G1+G5 解決了，OCR 會作為統一管線的一部分被執行。

但需要注意：
- 統一處理器的 Azure DI 步驟直接呼叫 `azure-di.service.ts`，**繞過** Python OCR 服務
- 如果需要保留 Python OCR 路徑，需要在統一處理器中做適配

#### 需要確認的問題
- **Q1**: 統一處理器的 Azure DI 步驟是直接用 Azure SDK 還是透過 Python 服務？
  - 如果是直接 Azure SDK：不需要 Python 服務
  - 如果是透過 Python 服務：需要確認 Python 服務運行

---

### G7：處理完成後觸發 autoMatch()

#### 問題描述

`autoTemplateMatchingService.autoMatch(documentId)` 已完整實現，但無任何流程在處理完成後呼叫它。

#### 解決方案

在 `/api/documents/[id]/process` 端點中，處理成功且結果寫入 DB 後，呼叫 autoMatch：

```
// 處理完成後
if (result.success && result.companyId && !skipAutoMatch) {
  // Fire-and-forget: 自動匹配不阻塞回應
  autoTemplateMatchingService.autoMatch(documentId)
    .catch(err => console.error('Auto-match failed:', err));
}
```

**前提條件**：
- Document 需要有 `companyId`（由統一處理器 Step 3 識別並在 G5 中寫入）
- 需要有 `Company.defaultTemplateId` 或全域預設模版配置
- 需要有 `TemplateFieldMapping` 規則（見 G9）

---

### G8：ProcessFileInput 需要 fileBuffer

#### 問題描述

`ProcessFileInput` 需要 `fileBuffer: Buffer`，但上傳流程已將文件存入 Azure Blob Storage，只保留了 `blobName`/`filePath`。

#### 解決方案

在 `/api/documents/[id]/process` 端點中：

```
1. 從 Document 記錄取得 blobName
2. 呼叫 Azure Blob Storage SDK 下載 buffer
3. 建構 ProcessFileInput：
   {
     fileId: document.id,
     fileName: document.fileName,
     fileBuffer: downloadedBuffer,
     mimeType: document.fileType,
     userId: session.user.id,
   }
```

Azure Blob 下載在專案中已有工具：`src/lib/azure-storage.ts` 應該有相關功能（需確認）。

---

### G9：TemplateFieldMapping Seed 數據

#### 問題描述

`prisma/seed.ts` 建立了 3 個 DataTemplate，但沒有建立任何 `TemplateFieldMapping` 規則。測試 Epic 19 需要至少一組映射規則。

#### 解決方案

在 `prisma/seed.ts` 新增 seed 數據：

```
為 erp-standard-import 模版建立 GLOBAL 級別的 TemplateFieldMapping：

mappings: [
  { sourceField: "invoice_number",   targetField: "invoice_number",    transformType: "DIRECT" },
  { sourceField: "invoice_date",     targetField: "invoice_date",      transformType: "DIRECT" },
  { sourceField: "vendor_name",      targetField: "vendor_name",       transformType: "DIRECT" },
  { sourceField: "total_amount",     targetField: "total_amount",      transformType: "DIRECT" },
  { sourceField: "currency",         targetField: "currency",          transformType: "DIRECT" },
  { sourceField: "shipment_no",      targetField: "shipment_number",   transformType: "DIRECT" },
  { sourceField: "sea_freight",      targetField: "shipping_cost",     transformType: "DIRECT" },
  { sourceField: "origin_port",      targetField: "origin",            transformType: "DIRECT" },
  { sourceField: "destination_port", targetField: "destination",       transformType: "DIRECT" },
  { sourceField: "etd",             targetField: "etd",               transformType: "DIRECT" },
  { sourceField: "eta",             targetField: "eta",               transformType: "DIRECT" },
  { sourceField: "weight",          targetField: "weight_kg",         transformType: "DIRECT" },
]
```

也可以通過 UI 在 Epic 19 的「Template Field Mapping」管理頁面建立，但 seed 更方便初始測試。

---

### G10：Document.formatId 回寫

#### 問題描述

統一處理器 Step 4 (FORMAT_MATCHING) 會產出 `documentFormatId`，但目前不會回寫到 `Document` 記錄。導致 `autoMatch()` 無法進行 FORMAT 級別的模版解析。

#### 解決方案

在 G5 的結果持久化服務中，一併更新：

```typescript
await prisma.document.update({
  where: { id: documentId },
  data: {
    companyId: result.companyId,
    // 如果 Document model 有 formatId 欄位，回寫之
    // documentFormatId: result.documentFormatId,
    status: 'MAPPING_COMPLETED',
  },
});
```

**注意**: 需要先確認 `Document` 模型是否有 `documentFormatId` 欄位，如果沒有需要新增 migration。

---

## 3. 實施順序與依賴關係

```
Phase 1: 基礎設施（無風險）
├── G4: 環境變數化 feature flag ──────────── 改 1 行代碼 + .env
├── G9: TemplateFieldMapping seed 數據 ──── 改 seed.ts
└── 確認: Azure DI / OpenAI 環境配置 ──── 檢查 .env

Phase 2: 核心整合（中等複雜度）
├── G8: Azure Blob 下載工具 ─────────────── 確認或建立下載函數
├── G5: 結果持久化服務 ──────────────────── 新建 service
│   └── 依賴 G8
├── G1+G2: /api/documents/[id]/process ──── 新建 API route
│   └── 依賴 G5, G8
└── G10: Document.formatId 回寫 ─────────── 含在 G5 中

Phase 3: 連接 Epic 19（低複雜度）
├── G7: 處理完成後觸發 autoMatch ─────────── 在 G1 的端點中新增
│   └── 依賴 Phase 2 完成
└── 修改 upload route（可選）─────────────── 上傳後自動觸發處理

Phase 4: 測試驗證
├── 手動測試完整流程
├── 驗證 ExtractionResult 數據
├── 驗證 TemplateInstance 行數據
└── UI 驗證
```

---

## 4. 新增/修改文件清單

| 操作 | 文件 | 說明 | Phase |
|------|------|------|-------|
| **新增** | `src/app/api/documents/[id]/process/route.ts` | 統一處理觸發端點 | 2 |
| **新增** | `src/services/processing-result-persistence.service.ts` | 結果持久化服務 | 2 |
| **修改** | `src/lib/azure-blob.ts` | 新增 `downloadBlob()` 下載函數 | 2 |
| **修改** | `src/constants/processing-steps.ts` | feature flag 環境變數化（1 行） | 1 |
| **修改** | `.env` / `.env.example` | 新增 `ENABLE_UNIFIED_PROCESSOR=true` | 1 |
| **修改** | `prisma/seed.ts` | 新增 TemplateFieldMapping + Company.defaultTemplateId seed | 1 |
| **修改** | `src/validations/template-matching.ts` | 修復 uuid → cuid 驗證 bug | 1 |
| **修改** | `src/app/api/documents/upload/route.ts` | （可選）上傳後自動觸發統一處理 | 3 |
| 不修改 | `src/services/unified-processor/` | 統一處理器本身不需要修改 | - |
| 不修改 | `src/services/template-matching-engine.service.ts` | 匹配引擎不需要修改 | - |
| 不修改 | `src/services/auto-template-matching.service.ts` | 自動匹配不需要修改 | - |
| **可選** | `prisma/schema.prisma` | 如需 FORMAT 級別 autoMatch：新增 Document.documentFormatId | 可推遲 |

---

## 5. 待確認問題（已調查完畢）

| # | 問題 | 答案 | 影響 |
|---|------|------|------|
| Q1 | 統一處理器 Step 6 是直接用 Azure SDK 還是透過 Python OCR 服務？ | ✅ **直接用 Azure SDK** — `processPdfWithAzureDI` from `@/services/azure-di.service.ts`。不需要 Python 服務。 | G6 不需要獨立修復 |
| Q2 | 是否有從 Blob 下載 buffer 的函數？ | ❌ **沒有** — `src/lib/azure-blob.ts` 只有 upload、delete、generateSasUrl。**需要新增 `downloadBlob()` 函數**。 | G8 需要新增下載函數 |
| Q3 | `Document` 模型是否有 `documentFormatId` 欄位？ | ❌ **沒有** — Document 有 `companyId` 和 `templateInstanceId` 但沒有 `documentFormatId`。**如需 FORMAT 級別 autoMatch 需要新增 migration**。 | G10 需要 migration（可推遲） |
| Q4 | `.env` 中 Azure DI 和 OpenAI 配置是否正確？ | ⏳ **由用戶確認** — 環境變數已定義（`AZURE_DI_ENDPOINT`, `AZURE_DI_KEY`, `AZURE_OPENAI_*`）| 需用戶確認值是否正確 |
| Q5 | `Company.defaultTemplateId` 是否在 seed 中設置？ | ❌ **沒有** — Company schema 有此欄位但 seed 未設置。**需要更新 seed 或手動配置**。 | autoMatch 找不到預設模版 |
| Q6 | `executeMatchRequestSchema` 的 ID 格式驗證是否有 bug？ | ✅ **確認為 Bug** — `templateInstanceId: z.string().uuid()` 但 TemplateInstance 用 `cuid()`。`batchMatch` 和 `singleMatch` 正確用了 `.cuid()`。**需修復為 `.cuid()`**。 | execute endpoint 會拒絕有效 ID |

### 新發現的 Bug

**Bug: `executeMatchRequestSchema` ID 格式不匹配**
- 位置: `src/validations/template-matching.ts:68`
- 問題: `templateInstanceId: z.string().uuid()` 但 TemplateInstance ID 是 CUID 格式
- 影響: `POST /api/v1/template-matching/execute` 會拒絕所有有效的 templateInstanceId
- 修復: 改為 `z.string().cuid()`
- 同樣問題也出現在: `documentIds` 和 `companyId`（使用 uuid 但實際可能是 cuid）

---

## 6. 風險評估

| 風險 | 可能性 | 影響 | 緩解措施 |
|------|--------|------|---------|
| Azure DI 配置不正確或服務不可用 | 中 | 🔴 阻塞 | 先用測試文件驗證 Azure DI 連線 |
| 統一處理器某些步驟有未發現的 bug | 中 | 🟡 延遲 | 逐步啟用各步驟，先跑最少步驟 |
| Prisma migration 衝突 | 低 | 🟡 延遲 | 如果需要新增 Document.formatId 欄位 |
| ExtractionResult 數據格式不匹配 | 低 | 🟡 延遲 | 仔細對齊兩端的 JSON 結構 |
| autoMatch 的模版解析找不到預設模版 | 中 | 🟢 可繞過 | 手動匹配作為 fallback |

---

## 7. 端到端測試流程（目標）

整合完成後，完整測試流程如下：

```
1. 確認環境
   ├── Docker 服務運行（PostgreSQL, Azurite）
   ├── .env 配置正確（Azure DI, OpenAI, ENABLE_UNIFIED_PROCESSOR=true）
   └── seed 數據已執行（DataTemplate + TemplateFieldMapping）

2. 上傳文件
   ├── 在 UI 上傳一個測試發票 PDF
   └── 確認文件狀態變為 UPLOADED

3. 觸發統一處理
   ├── 方式 A: 上傳流程自動觸發
   ├── 方式 B: 手動呼叫 POST /api/documents/{id}/process
   └── 預期：
       ├── Document.status → MAPPING_COMPLETED
       ├── Document.companyId → 識別的公司 ID
       ├── ExtractionResult 記錄已建立
       └── ExtractionResult.fieldMappings 包含結構化數據

4. 驗證 ExtractionResult
   ├── 在 DB 中查看 ExtractionResult 記錄
   └── 確認 fieldMappings 包含預期的欄位（invoice_number, total_amount, etc.）

5. 模版匹配（如果 autoMatch 已觸發）
   ├── 確認 Document.templateInstanceId 已設置
   ├── 確認 TemplateInstance 存在且狀態為 DRAFT
   └── 確認 TemplateInstanceRow 已建立

6. 手動模版匹配（如果 autoMatch 未觸發）
   ├── 在 UI 建立 TemplateInstance（選擇 ERP 標準匯入模版）
   ├── 呼叫 POST /api/v1/template-matching/execute
   └── 驗證匹配結果

7. UI 驗證
   ├── /template-instances/{id} 頁面顯示正確的統計資訊
   ├── InstanceRowsTable 顯示數據行
   ├── RowDetailDrawer 顯示正確的欄位值
   └── 導出功能正常
```

---

## 8. 結論

整合工作的核心在於建立兩個橋樑：

1. **上傳 → 統一處理**：一個新的 API 端點 + 結果持久化服務
2. **統一處理 → Epic 19**：在處理完成後呼叫 autoMatch()

統一處理管線本身（11 步驟）和 Epic 19 的匹配引擎本身都已經完整實現，不需要修改。只需要在它們之間建立「膠水代碼」將資料流串連起來。

預估需要：
- 新增 2 個文件（API route + persistence service）
- 修改 3 個文件（feature flag + .env + seed）
- 可選修改 1 個文件（upload route 自動觸發）

**下一步行動**: 待用戶確認方案後，解決 Q1-Q6 的待確認問題，然後開始實施。
