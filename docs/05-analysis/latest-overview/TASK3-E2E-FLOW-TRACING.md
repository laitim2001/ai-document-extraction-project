# Task 3: 端到端流程追蹤分析

> **分析日期**: 2026-02-27
> **分析方式**: 4 個 Explore Agent 並行深度代碼追蹤 + 3 輪驗證（Agent 交叉檢查 + Grep ground-truth 比對）
> **用途**: 作為最終報告中 ASCII 流程圖和端到端場景章節的核心數據來源
> **驗證狀態**: ✅ 已四輪驗證（第三輪 Grep ground truth + 第四輪命令行逐項驗證路徑/函數名/Prisma model）

---

## 分析摘要

| 場景 | 涉及步驟 | API 方法數 | Prisma Models | 核心服務 |
|------|---------|-----------|---------------|---------|
| **場景 1**: 文件上傳→提取→審核 | 30+ | 10+ | 17 | 15+ |
| **場景 2**: 規則學習循環 | 21 | 35 | 12+ | 12+ |
| **場景 3**: 批量處理 | 12 | 26 | 6 | 9+ |
| **場景 4**: 外部整合 | 14+14+14 | 36 | 18 | 10+ |

---

## 場景 1: 文件上傳 → AI 提取 → 審核（核心流程）

### 架構總覽

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          用戶上傳 PDF/Image                                 │
└────────────────────────────┬────────────────────────────────────────────────┘
                             ▼
              ┌──────────────────────────────┐
              │  Step 1: 檔案上傳與儲存       │
              │  FileUploader Component       │
              │  ↓ POST /api/documents/upload │
              └────────────┬─────────────────┘
                           ▼
              ┌──────────────────────────────┐
              │  Step 2: Azure Blob 儲存      │
              │  uploadFile()                 │
              │  ↓ Prisma Document.create()   │
              └────────────┬─────────────────┘
                           ▼
              ┌──────────────────────────────┐
              │  Step 3: V3.1 三階段提取      │
              │  Fire-and-Forget Pipeline     │
              │  ↓ Stage 1→2→3               │
              └────────────┬─────────────────┘
                           ▼
              ┌──────────────────────────────┐
              │  Step 4: 信心度計算與路由     │
              │  5-6 維度加權評分             │
              │  ↓ AUTO_APPROVE/REVIEW        │
              └────────────┬─────────────────┘
                           ▼
              ┌──────────────────────────────┐
              │  Step 5: 審核工作流           │
              │  （如需）                     │
              │  ↓ ReviewRecord.create()      │
              └────────────┬─────────────────┘
                           ▼
              ┌──────────────────────────────┐
              │  Step 6: 結果確認/修正        │
              │  ↓ Document.status = APPROVED │
              └──────────────────────────────┘
```

### 詳細步驟表

| 步驟 | 動作 | 文件路徑 | 函數名 | 輸入 | 輸出 | Prisma Model 操作 |
|------|------|---------|--------|------|------|-------------------|
| **1** | 前端拖放上傳 | `src/components/features/document/FileUploader.tsx` | `handleUpload()` | `File[]` | `uploadMutation.mutateAsync()` | N/A (client) |
| **2** | 提交 multipart/form-data | `src/app/api/documents/upload/route.ts` | `POST()` | `FormData: files[], cityCode` | `UploadResponse` | Document.create() |
| **2a** | 驗證文件（格式、大小） | `src/lib/upload/constants.ts` | `isAllowedType()`, `isAllowedSize()` | `file.type`, `file.size` | `boolean` | N/A |
| **2b** | 上傳到 Azure Blob | `src/lib/azure/index.ts` | `uploadFile()` | `buffer, fileName, options` | `{ blobUrl, blobName }` | N/A |
| **2c** | 建立 Document 記錄 | `src/app/api/documents/upload/route.ts` | `prisma.document.create()` | `fileName, fileSize, filePath, blobName, status, cityCode` | `Document{ id, status='UPLOADED' }` | **Document.create()** |
| **3** | Fire-and-Forget 觸發統一處理 | `src/app/api/documents/upload/route.ts` | `Promise.allSettled(documentsToProcess)` | `doc.id, doc.fileName, doc.blobName` | Promise (不阻塞) | N/A |
| **3a** | 下載 blob 檔案 | `src/lib/azure-blob.ts` | `downloadBlob()` | `blobName` | `Buffer` | N/A |
| **3b** | 呼叫統一處理器 | `src/services/unified-processor/index.ts` | `getUnifiedDocumentProcessor().processFile()` | `{ fileId, fileName, fileBuffer, mimeType, userId, cityCode }` | `ProcessingResult` | N/A |
| **3b-i** | 檔案準備（PDF 轉 Base64） | `src/services/extraction-v3/utils/pdf-converter.ts` | `PdfConverter.convert()` | `fileBuffer, mimeType` | `imageBase64Array[]` | N/A |
| **3b-ii** | **Stage 1: 公司識別** | `src/services/extraction-v3/stages/stage-1-company.service.ts` | `Stage1CompanyService.execute()` | `Stage1Input` | `Stage1CompanyResult` | Company.findMany() |
| **3b-ii-A** | GPT-5-nano 呼叫（識別） | `src/services/extraction-v3/stages/gpt-caller.service.ts` | `GptCallerService.call()` | `GptCallInput` | `GptCallResult` | N/A |
| **3b-iii** | **Stage 2: 格式識別** | `src/services/extraction-v3/stages/stage-2-format.service.ts` | `Stage2FormatService.execute()` | `Stage2Input` | `Stage2FormatResult` | DocumentFormat.findMany() |
| **3b-iii-A** | GPT-5-nano 呼叫（格式） | `src/services/extraction-v3/stages/gpt-caller.service.ts` | `GptCallerService.call()` | `GptCallInput` | `GptCallResult` | N/A |
| **3b-iv** | **Stage 3: 欄位提取** | `src/services/extraction-v3/stages/stage-3-extraction.service.ts` | `Stage3ExtractionService.execute()` | `Stage3Input` | `Stage3ExtractionResult` | N/A |
| **3b-iv-A** | 動態 Prompt 組裝 | `src/services/extraction-v3/prompt-assembly.service.ts` | `PromptAssemblyService.assemblePrompt()` | `stage1, stage2, fieldDefinitions, companyConfig` | `{ systemPrompt, userPrompt }` | PromptConfig.findMany() |
| **3b-iv-B** | GPT-5.2 呼叫（提取） | `src/services/extraction-v3/stages/gpt-caller.service.ts` | `GptCallerService.call()` | `GptCallInput` | `GptCallResult` | N/A |
| **3b-iv-C** | 參考編號匹配 (CHANGE-032) | `src/services/extraction-v3/stages/reference-number-matcher.service.ts` | `ReferenceNumberMatcherService.match()` | `{ extractedFields, companyId, ... }` | `ReferenceNumberMatchResult` | ReferenceNumber.findMany() |
| **3b-iv-D** | 匯率轉換 (CHANGE-032) | `src/services/extraction-v3/stages/exchange-rate-converter.service.ts` | `ExchangeRateConverterService.convert()` | `{ extractedFields, ... }` | `ExchangeRateConversionResult` | ExchangeRate.findMany() |
| **3b-v** | 結果驗證 | `src/services/extraction-v3/result-validation.service.ts` | `validate()` | `extractedData, schema` | `{ isValid, errors }` | N/A |
| **3b-vi** | **信心度計算（5 維度）** | `src/services/extraction-v3/confidence-v3-1.service.ts` | `ConfidenceV3_1Service.calculate()` | `stage1Result, stage2Result, stage3Result, historicalAccuracy` | `ConfidenceResultV3_1` | N/A |
| **3b-vii** | **路由決策** | `src/services/extraction-v3/confidence-v3-1.service.ts` | `generateRoutingDecision()` | `totalConfidence (0-100)` | `RoutingDecision` | N/A |
| **3c** | 持久化處理結果 | `src/services/processing-result-persistence.service.ts` | `persistProcessingResult()` | `{ documentId, result, userId }` | `{ success, extractionResultId }` | **ExtractionResult.create()** |
| **3d** | 術語記錄 | `src/services/unified-processor/adapters/term-recorder-adapter.ts` | `recordTerms()` | `TermRecordRequest` | `TermRecordResult` | **TermAggregationResult** 相關操作 |
| **3e** | 自動模版匹配 | `src/services/auto-template-matching.service.ts` | `autoMatch()` | `documentId` | Promise | **TemplateInstance** relations |
| **6a** | AUTO_APPROVE 自動確認 | `src/services/unified-processor/adapters/routing-decision-adapter.ts` | `RoutingDecisionAdapter` 路由邏輯 | `confidence score ≥ 90%` | `RoutingDecision.AUTO_APPROVE` | **Document.update(status='APPROVED')** |
| **6b** | QUICK_REVIEW 進入審核隊列 | `src/app/api/review/route.ts` | `GET /api/review` | `{ status, assignee }` | `{ reviewItems[] }` | **ProcessingQueue.findMany()** |
| **6c** | 用戶確認/修正 | `src/app/api/review/[id]/approve/route.ts` | `POST` | `{ confirmedFields, notes }` | `{ success }` | **ReviewRecord.create(), Document.update()** |
| **6c-i** | 修正並保存 | `src/app/api/review/[id]/correct/route.ts` | `PATCH` | `{ fieldCorrections, notes }` | `{ success }` | **Correction.create(), FieldCorrectionHistory.create()** |
| **7** | 審計日誌記錄 | `src/lib/audit/index.ts` | `logDocumentApproved()` | `{ documentId, userId }` | N/A | **AuditLog.create()** |

### 信心度計算 5-6 維度詳解

> **驗證注意**: 存在兩個信心度計算服務版本：
> - `confidence-v3.service.ts` (V3, CHANGE-021) — 5 維度，用於簡單文件/單次提取
> - `confidence-v3-1.service.ts` (V3.1, CHANGE-024) — 5-6 維度，用於三階段分離提取

**V3.1 基礎 5 維度**（confidence-v3-1.service.ts）:

```
總信心度 (0-100) =
  20% × STAGE_1_COMPANY      (公司識別精度)
+ 15% × STAGE_2_FORMAT       (格式識別精度)
+ 30% × STAGE_3_EXTRACTION   (欄位提取精度)
+ 20% × FIELD_COMPLETENESS   (必填欄位完整性)
+ 15% × CONFIG_SOURCE_BONUS  (配置來源加成)
```

**CHANGE-032 動態第 6 維度**（參考編號匹配啟用時）:

```
當 refMatchEnabled=true 時，權重自動調整：
  CONFIG_SOURCE_BONUS: 15% → 10%
  新增 REFERENCE_NUMBER_MATCH: 5%

調整後:
  20% × STAGE_1_COMPANY
+ 15% × STAGE_2_FORMAT
+ 30% × STAGE_3_EXTRACTION
+ 20% × FIELD_COMPLETENESS
+ 10% × CONFIG_SOURCE_BONUS     (降 5%)
+  5% × REFERENCE_NUMBER_MATCH  (新增)
```

**ConfigSourceBonus 分數**（src/types/extraction-v3.types.ts）:

```
ConfigSourceBonus 原始分數 (0-100):
  ├─ COMPANY_SPECIFIC: 100 分 (公司級配置最準)
  ├─ UNIVERSAL: 80 分 (通用配置)
  └─ LLM_INFERRED: 50 分 (AI 推斷)
```

### 路由決策閾值（V3.1）

```
if (confidence ≥ 90%)      → AUTO_APPROVE     (自動核准，無需人工)
else if (confidence ≥ 70%) → QUICK_REVIEW     (一鍵確認/修正)
else                        → FULL_REVIEW      (完整人工審核)
```

> **注意**: CLAUDE.md 中記載的 95%/80% 是舊版本（V3.0）閾值。V3.1 已更新為 90%/70%。

### V3.1 智能降級規則 (CHANGE-025)

```
自動降級規則（confidence-v3-1.service.ts 中的完整邏輯）:
├─ 新公司 + 新格式 → 強制 FULL_REVIEW
├─ 新公司 → 強制 FULL_REVIEW (即使高信心度)
├─ 新格式 → 強制 QUICK_REVIEW
├─ 超過 3 個需分類項目 → AUTO_APPROVE 降為 QUICK_REVIEW
└─ DEFAULT 配置來源 → 決策降一級 (AUTO→QUICK, QUICK→FULL)

異常處理:
├─ Stage 1 失敗 → 嘗試 fallback LLM 分類
├─ Stage 2 失敗 → 使用 Universal 欄位定義
├─ Stage 3 失敗 → 記錄 OCR_FAILED，轉 FULL_REVIEW
└─ GPT 超時 → 自動重試 3 次，最後轉 FULL_REVIEW
```

### 涉及的 API Routes

#### 上傳階段
| HTTP 方法 | 路徑 | 說明 |
|----------|------|------|
| POST | `/api/documents/upload` | 上傳並建立 Document |

#### 處理階段
| HTTP 方法 | 路徑 | 說明 |
|----------|------|------|
| POST | `/api/documents/[id]/process` | 觸發統一 V3 處理管線 |
| GET | `/api/documents` | 獲取文件列表 |
| GET | `/api/documents/[id]/progress` | 監控進度（SSE） |

#### 審核階段
| HTTP 方法 | 路徑 | 說明 |
|----------|------|------|
| GET | `/api/review` | 獲取審核隊列 |
| GET | `/api/review/[id]` | 獲取審核詳情 |
| POST | `/api/review/[id]/approve` | 確認審核 |
| PATCH | `/api/review/[id]/correct` | 修正並確認 |
| POST | `/api/review/[id]/escalate` | 升級問題 |
| GET | `/api/confidence/[id]` | 信心度詳情 |

### 涉及的 Prisma Models

#### 核心文件流程
- **Document** — 文件主體（status: UPLOADED → PROCESSING → OCR_COMPLETED → APPROVED/REJECTED）
- **ExtractionResult** — AI 提取結果
- **DocumentFormat** — 文件格式定義
- **Company** — 公司/Forwarder 主檔

#### 審核工作流
- **ReviewRecord** — 審核記錄
- **ProcessingQueue** — 處理隊列
- **Correction** — 修正記錄
- **FieldCorrectionHistory** — 欄位修正歷史
- **Escalation** — 升級記錄

#### AI 配置與映射
- **PromptConfig** — Prompt 配置（scope: GLOBAL/COMPANY/FORMAT）
- **MappingRule** — 三層映射規則
- **ReferenceNumber** — 參考編號主檔（Epic 20）
- **ExchangeRate** — 匯率記錄（Epic 21）

#### 系統追蹤
- **AuditLog** — 審計日誌
- **TermAggregationResult** — 術語聚合結果（注意：Prisma 無獨立 `Term` model）
- **TemplateInstance** — 模板實例（Epic 19）
- **FieldExtractionFeedback** — 欄位提取反饋（CHANGE-042），追蹤定義欄位 vs 提取欄位差異和覆蓋率

### 功能協同標註

| Epic | 功能模組 | 涉及步驟 | 關鍵文件 |
|------|----------|---------|---------|
| **Epic 2** | 手動上傳與 AI 處理 | Step 1-3b-vi | `FileUploader.tsx`, `extraction-v3/` |
| **Epic 3** | 審核與修正工作流 | Step 6b-c | `review/[id]/approve`, Correction |
| **Epic 4** | 映射規則管理 | Step 3b-iv-A | `prompt-assembly.service.ts` |
| **Epic 5** | 公司/Forwarder 管理 | Step 3b-ii | `stage-1-company.service.ts` |
| **Epic 7** | 報表與統計 | Step 8 | `dashboard-statistics.service.ts` |
| **Epic 8** | 審計與追蹤 | Step 7 | `logDocumentApproved()`, AuditLog |
| **Epic 14** | Prompt 配置管理 | Step 3b-iv-A | `prompt-assembly.service.ts` |
| **Epic 19** | 模板管理與匹配 | Step 3e | `auto-template-matching.service.ts` |
| **Epic 20** | 參考編號管理 | Step 3b-iv-C | `reference-number-matcher.service.ts` |
| **Epic 21** | 匯率管理 | Step 3b-iv-D | `exchange-rate-converter.service.ts` |
| **CHANGE-024** | V3.1 三階段架構 | Step 3b 核心 | `stage-orchestrator.service.ts` |
| **CHANGE-032** | 參考編號+匯率整合 | Step 3b-iv-C/D | matcher + converter services |

### 完整資料流圖

```
[FileUploader Component]
        ↓ (FormData: files[])
[POST /api/documents/upload]
        ├─ ✓ Validation (format, size)
        ├─ ✓ Azure Blob Upload
        └─ ✓ Document.create() → [Document]
                    ↓ (Fire-and-Forget)
        [downloadBlob → Buffer]
                    ↓
        [PdfConverter.convert() → Base64[]]
                    ↓
        [StageOrchestrator]
        ├─→ [Stage1: Company] → GPT-5-nano → [Stage1CompanyResult]
        │           ↓ (Company.findMany())
        │   [Company model accessed]
        │
        ├─→ [Stage2: Format] → GPT-5-nano → [Stage2FormatResult]
        │           ↓ (DocumentFormat.findMany())
        │   [DocumentFormat model accessed]
        │
        └─→ [Stage3: Extraction] → GPT-5.2
                    ├─ [PromptAssembly] → (PromptConfig.findMany())
                    ├─ [GPT Call] → raw fields
                    ├─ [RefNumberMatcher] → (ReferenceNumber.findMany())
                    ├─ [ExchangeRateConverter] → (ExchangeRate.findMany())
                    └─ [Stage3ExtractionResult]
                            ↓
        [ConfidenceV3_1Service.calculate()]
        ├─ Dim1: Stage1 Conf (20%)
        ├─ Dim2: Stage2 Conf (15%)
        ├─ Dim3: Stage3 Conf (30%)
        ├─ Dim4: Field Completeness (20%)
        └─ Dim5: ConfigSource Bonus (15%)
                    ↓ (Total Score 0-100)
        [RoutingDecision: AUTO/QUICK/FULL]
                    ↓
        [persistProcessingResult()]
        └─ ExtractionResult.create() → [ExtractionResult]

        [if confidence ≥ 90%]
            → auto-approve → Document.status = APPROVED

        [if 70% ≤ confidence < 90%]
            → ReviewRecord → User Review
                ├─ POST /api/review/[id]/approve
                └─ ReviewRecord.create(), Document.update()

        [if confidence < 70%]
            → FULL_REVIEW → Detailed Review
                ├─ Correction.create() (if edited)
                └─ Document.status = APPROVED
```

---

## 場景 2: 規則學習循環

### 架構總覽

```
┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│  人工修正         │ ──→ │  修正模式分析     │ ──→ │  規則建議生成     │
│  Correction       │     │  PatternAnalysis  │     │  RuleSuggestion   │
│  (即時記錄)       │     │  (定時日 1 次)    │     │  Generator        │
└──────────────────┘     └──────────────────┘     └──────────────────┘
                                                           ↓
┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│  自動回滾         │ ←── │  規則生效         │ ←── │  規則審核與批准   │
│  AutoRollback     │     │  FieldMapping     │     │  Super User       │
│  (定時檢查)       │     │  Engine           │     │  審核              │
└──────────────────┘     └──────────────────┘     └──────────────────┘
```

### 詳細步驟表

| 階段 | 步驟 | 動作 | 文件路徑 | 核心函數 | 輸入 | 輸出 | Prisma Model 操作 |
|------|------|------|---------|---------|------|------|-------------------|
| **修正記錄** | S1 | 用戶修正欄位 | `src/app/api/review/[id]/correct/route.ts` | PATCH | DocumentId, Field corrections | ExtractionResult updated | UPDATE `ExtractionResult` |
| 修正記錄 | S2 | 記錄修正 | `src/services/correction-recording.ts` | `recordCorrection()` | RecordCorrectionInput | CorrectionId | CREATE `Correction` |
| 修正記錄 | S3 | 觸發規則建議檢查 | `src/lib/learning/ruleSuggestionTrigger.ts` | `triggerRuleSuggestionCheck()` | CorrectionInput | Check result | Query `Correction` count |
| **模式分析** | S4 | 定時分析修正（日 1 次） | `src/services/pattern-analysis.ts` | `analyzeCorrections()` | None (batch) | AnalysisResult | Query pending `Correction` |
| 模式分析 | S5 | 識別相似模式 | `src/services/pattern-analysis.ts` | Prisma `groupBy()` 操作 | Corrections | GroupedCorrections | 按 companyId:fieldName 分組 |
| 模式分析 | S6 | 標記為 CANDIDATE（≥3次） | `src/services/pattern-analysis.ts` | `updatePatternStatus()` | patternHash, occurrenceCount | Pattern status | UPDATE `CorrectionPattern` status='CANDIDATE' |
| **建議生成** | S7 | 觸發建議生成 | `src/app/api/rules/suggestions/generate/route.ts` | POST | patternId | GenerationResult | Query `CorrectionPattern` (CANDIDATE) |
| 建議生成 | S8 | 推斷最佳規則 | `src/services/rule-suggestion-generator.ts` | `generateFromPattern()` | patternId | InferredRule | Query pattern + corrections |
| 建議生成 | S9 | 進行影響分析 | `src/services/impact-analysis.ts` | `analyze()` | suggestionId | ImpactAnalysisResult | Query 最近 90 天 documents |
| 建議生成 | S10 | 創建建議記錄 | `src/services/rule-suggestion-generator.ts` | CREATE | suggestion data | suggestionId | CREATE `RuleSuggestion` |
| 建議生成 | S11 | 通知 Super Users | `src/services/rule-suggestion-generator.ts` | `notifySuperUsers()` | suggestionId | notification sent | CREATE `Notification` |
| **規則審核** | S12 | 查看建議詳情 | `src/app/api/rules/suggestions/route.ts` | GET | filters | suggestion list | Query `RuleSuggestion` (PENDING) |
| 規則審核 | S13 | 批准規則建議 | `src/app/api/rules/suggestions/[id]/approve/route.ts` | POST | suggestionId, notes | ApprovalResult | UPDATE `RuleSuggestion` (APPROVED) |
| 規則審核 | S14 | 創建/更新 MappingRule | `src/services/rule-change.service.ts` | CREATE | suggestion data | ruleId | CREATE `MappingRule` |
| 規則審核 | S15 | 記錄規則版本 | (embedded in approval) | CREATE | rule data | versionId | CREATE `RuleVersion` |
| 規則審核 | S16 | 失效快取 | `src/services/rule-resolver.ts` | `invalidateCompanyCache()` / `invalidateAllRulesCache()` | companyId 或全局 | cache reset | UPDATE `RuleCacheVersion` |
| **規則生效** | S17 | 應用規則到新文件 | `src/services/mapping/field-mapping-engine.ts` | `applyRules()` | extractedFields, configs | mapped fields | Query `MappingRule` (ACTIVE) |
| **自動回滾** | S18 | 定時檢查準確率 | `src/services/auto-rollback.ts` | `checkAndRollback()` | ruleId | RollbackResult | Query `RuleApplication` |
| 自動回滾 | S19 | 計算準確率下降 | `src/services/rule-accuracy.ts` | `checkAccuracyDrop()` | ruleId | AccuracyDropResult | Query `Correction` + `ExtractionResult` |
| 自動回滾 | S20 | 執行回滾 | `src/services/auto-rollback.ts` | `executeRollback()` | ruleId, dropResult | RollbackResult | UPDATE `MappingRule` (INACTIVE), CREATE `RollbackLog` |
| 自動回滾 | S21 | 發送告警通知 | `src/services/auto-rollback.ts` | `sendAlerts()` | ruleId, dropResult | alert sent | CREATE `Notification` |

### 關鍵閾值邏輯

#### 三次修正 → CANDIDATE 轉變

```typescript
// src/types/pattern.ts
PATTERN_THRESHOLDS.CANDIDATE_THRESHOLD = 3

// src/services/pattern-analysis.ts
if (pattern.occurrenceCount >= THRESHOLD) {
  await prisma.correctionPattern.update({
    where: { id: pattern.id },
    data: { status: 'CANDIDATE', suggestedAt: now() }
  })
}
```

**重要規則**:
- 只有 NORMAL 類型修正才計入（EXCEPTION 類型直接標記 analyzedAt）
- 必須是同一 Company 和 fieldName 的相同值對
- 相似度必須達到 0.8+（Levenshtein distance）

#### 影響分析三維度

```typescript
// src/services/impact-analysis.ts
{
  statistics: {
    affectedDocuments: number,      // 過去 90 天影響的文件數
    estimatedImprovement: number,   // 預估準確率提升百分比
    currentAccuracy: number | null,
    predictedAccuracy: number       // 應用規則後的準確率
  },
  riskCases: RiskCase[],            // 高風險案例
  timeline: TimelineItem[]          // 時間序列分析
}
```

#### 回滾觸發條件

```typescript
// src/services/rule-accuracy.ts
const currentAccuracy = (correctlyExtractedDocs / totalDocsUsingRule) * 100
const accuracyDrop = previousAccuracy - currentAccuracy

if (accuracyDrop > ROLLBACK_THRESHOLD) {  // 預設 10% (DEFAULT_CONFIG.dropThreshold = 0.10)
  shouldRollback = true
}
```

### 涉及的 API Routes

#### 修正記錄相關 (4 個方法)
| 路由 | 方法 | 說明 |
|------|------|------|
| `/api/review/[id]/correct` | PATCH | 修正提取欄位 |
| `/api/corrections/patterns` | GET | 修正模式列表 |
| `/api/corrections/patterns/[id]` | GET, PATCH | 修正模式詳情與更新 |

> **注意**: `/api/corrections/route.ts` 和 `/api/corrections/[id]/route.ts` 路由文件不存在，修正記錄通過 review API 操作。

#### 規則建議相關 (9 個方法)
| 路由 | 方法 | 說明 |
|------|------|------|
| `/api/rules/suggestions/generate` | POST | 從模式生成建議 |
| `/api/rules/suggestions` | GET, POST | 建議列表與建立 |
| `/api/rules/suggestions/[id]` | GET, PATCH | 建議詳情與更新 |
| `/api/rules/suggestions/[id]/approve` | POST | 批准建議 |
| `/api/rules/suggestions/[id]/reject` | POST | 拒絕建議 |
| `/api/rules/suggestions/[id]/impact` | GET | 影響分析 |
| `/api/rules/suggestions/[id]/simulate` | POST | 規則模擬 |

#### 規則管理相關 (22 個方法)
| 路由 | 方法 | 說明 |
|------|------|------|
| `/api/companies/[id]/rules` | GET, POST | 公司規則列表與建立 |
| `/api/companies/[id]/rules/[ruleId]` | PUT | 更新公司規則 |
| `/api/rules/` | GET, POST | 全局規則列表與建立 |
| `/api/rules/[id]` | GET, PATCH | 單一規則查詢與更新 |
| `/api/rules/[id]/accuracy` | GET | 規則準確度查詢 |
| `/api/rules/[id]/metrics` | GET | 規則效果指標 |
| `/api/rules/[id]/test` | POST | 規則測試 |
| `/api/rules/[id]/preview` | POST | 規則預覽 |
| `/api/rules/[id]/versions` | GET | 規則版本列表 |
| `/api/rules/[id]/versions/rollback` | POST | 規則版本回滾 |
| `/api/rules/[id]/versions/compare` | GET | 版本比較 |
| `/api/rules/test` | POST | 全局規則測試 |
| `/api/rules/version` | GET | 版本查詢 |
| `/api/rules/bulk` | POST, PATCH, DELETE | 批量規則操作（建立/更新/刪除） |
| `/api/rules/bulk/undo` | GET, POST | 批量操作撤銷（查詢/執行） |
| `/api/rollback-logs` | GET | 回滾日誌 |

### 涉及的 Prisma Models

| 分類 | Model | 用途 |
|------|-------|------|
| 修正記錄 | `Correction` | 單次修正記錄（含 correctionType: NORMAL/EXCEPTION） |
| 修正記錄 | `CorrectionPattern` | 重複修正模式（status: DETECTED→CANDIDATE→SUGGESTED→PROCESSED） |
| 修正記錄 | `PatternAnalysisLog` | 模式分析審計日誌 |
| 修正記錄 | `FieldCorrectionHistory` | 欄位修正歷史 |
| 規則建議 | `RuleSuggestion` | 規則升級建議（status: PENDING→APPROVED/REJECTED→IMPLEMENTED） |
| 規則建議 | `SuggestionSample` | 建議樣本文件 |
| 規則管理 | `MappingRule` | 映射規則（status: ACTIVE/INACTIVE） |
| 規則管理 | `RuleVersion` | 規則版本歷史 |
| 規則管理 | `RuleChangeRequest` | 規則變更請求 |
| 規則管理 | `RuleApplication` | 規則應用記錄（追蹤哪些文件使用了哪些規則） |
| 回滾 | `RollbackLog` | 回滾日誌（trigger: AUTO/MANUAL） |

### 功能協同標註

| 功能模組 | 參與階段 | 責任 |
|----------|---------|------|
| **Review Workflow** (Epic 3) | S1-S3 | 審核和修正 UI |
| **Pattern Analysis** (Epic 4) | S4-S6 | 修正模式識別 |
| **Rule Suggestion** (Epic 4) | S7-S11 | 自動規則推斷 |
| **Impact Analysis** (Epic 4) | S9 | 規則影響評估 |
| **Rule Management** (Epic 4) | S12-S16 | 規則批准和發布 |
| **Field Mapping** (Epic 4, 13, 19) | S17 | 規則應用到提取 |
| **Auto Rollback** (Epic 4) | S18-S21 | 準確度監控和回滾 |
| **Notification** (System) | S11, S21 | 跨流程通知 |
| **Audit Logging** (Epic 8) | All | 變更審計 |
| **Pipeline Config** (CHANGE-032) | S17 | 管線功能開關（參考編號匹配/匯率轉換的動態啟用/停用） |

### 完整數據流範例

```
Day 1: 修正 Doc A 金額 "100000" → "1000.00"  → Correction #1
Day 2: 修正 Doc B 金額 "200000" → "2000.00"  → Correction #2
Day 3: 修正 Doc C 金額 "150000" → "1500.00"  → Correction #3 (達到閾值!)
         └─ CorrectionPattern status → CANDIDATE

Night: PatternAnalysis 掃描 → 識別金額提取模式 → 生成 RuleSuggestion
Day 4: RuleSuggestionGenerator → InferredRule (REGEX) → 影響分析 (5.2% 改善)
         └─ 通知 Super Users

Day 5: Super User 批准 → MappingRule.create(ACTIVE) → 快取失效 → 規則生效
Day 6+: 新發票自動套用規則 → 準確率 88% → 93.2% ✓

Day 20: 準確率回降到 82% → AutoRollback 偵測 (drop > 10%, DEFAULT_CONFIG.dropThreshold=0.10)
         → executeRollback() → MappingRule.INACTIVE → 激活上一版本
         → 通知 Super Users: "金額提取規則已自動回滾"
```

---

## 場景 3: 批量處理（歷史數據導入）

### 架構總覽

```
┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│  批量上傳         │ ──→ │  元數據檢測       │ ──→ │  批量處理隊列     │
│  Upload API       │     │  FileDetection    │     │  p-queue-compat   │
│  (Multipart)      │     │  Service          │     │  (concurrency=5)  │
└──────────────────┘     └──────────────────┘     └──────────────────┘
                                                           ↓
┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│  統計報告         │ ←── │  詞彙聚合         │ ←── │  並行提取         │
│  BatchProgress    │     │  TermAggregation  │     │  Unified          │
│  Service          │     │  Service          │     │  Processor        │
└──────────────────┘     └──────────────────┘     └──────────────────┘
        ↑
┌──────────────────┐
│  SSE 進度追蹤     │
│  ReadableStream   │
│  + EventSource    │
└──────────────────┘
```

### 詳細步驟表

| 步驟 | 動作 | 文件路徑 | 函數名 | 輸入 | 輸出 | Prisma Model 操作 |
|------|------|---------|--------|------|------|-------------------|
| 1 | 建立批次 | `src/app/api/admin/historical-data/batches/route.ts` | `POST` | CreateBatchSchema (name, description, config) | `HistoricalBatch` | CREATE `HistoricalBatch` |
| 2 | 上傳文件 | `src/app/api/admin/historical-data/upload/route.ts` | `POST` | Multipart FormData (batchId, files) | File list with status | CREATE `HistoricalFile` (PENDING) |
| 3 | 檢測文件類型 | `src/services/file-detection.service.ts` | `detectFileType()` | File Buffer + mimeType | `DetectedFileType` | UPDATE `HistoricalFile` |
| 4 | 開始批量處理 | `src/app/api/admin/historical-data/batches/[batchId]/process/route.ts` | `POST` | batchId | Status: PROCESSING | UPDATE `HistoricalBatch` + `HistoricalFile` |
| 5 | 並發文件處理 | `src/services/batch-processor.service.ts` | `processBatch()` | batchId, options | File results | UPDATE `HistoricalFile` per file |
| 5.1 | 路由決策 | `src/services/processing-router.service.ts` | `determineProcessingMethod()` | File metadata | ProcessingMethod | — |
| 5.2 | Azure DI 提取 | `src/services/azure-di.service.ts` | `processPdfWithAzureDI()` | File Buffer | OCR result | — |
| 5.3 | GPT Vision 提取 | `src/services/gpt-vision.service.ts` | `processImageWithVision()` | Image Buffer | Vision result | — |
| 5.4 | 公司識別 | `src/services/company-auto-create.service.ts` | `identifyCompaniesFromExtraction()` | Extraction result | Company match | CREATE/UPDATE `Company` |
| 5.5 | 發行方識別 | `src/services/document-issuer.service.ts` | `processFileIssuerIdentification()` | File + Extraction | Issuer result | CREATE `FileTransactionParty` |
| 5.6 | 格式識別 | `src/services/document-format.service.ts` | `processDocumentFormat()` | File + Extraction | Format result | CREATE/UPDATE `DocumentFormat` |
| 5.7 | 統一處理 (CHANGE-006) | `src/services/unified-processor/unified-document-processor.service.ts` | `process()` | ProcessFileInput (11 steps) | UnifiedProcessingResult | Multiple |
| 6 | 進度更新 (SSE) | `src/app/api/admin/historical-data/batches/[batchId]/progress/route.ts` | `GET` (SSE) | batchId | SSE events | READ `HistoricalBatch` + `HistoricalFile` |
| 7 | 聚合術語 | `src/services/batch-term-aggregation.service.ts` | `aggregateTermsForBatch()` | batchId | Term results | CREATE `TermAggregationResult` |
| 8 | 完成批次 | `src/services/batch-processor.service.ts` | (completion) | — | Final stats | UPDATE `HistoricalBatch` (COMPLETED) |

### SSE 實現細節

**技術棧**: WebAPI `ReadableStream` + `TextEncoder`（原生 Server-Sent Events）

```typescript
// 核心機制 (progress/route.ts)
const stream = new ReadableStream({
  async start(controller) {
    // 1. 發送 'connected' 事件
    // 2. 設置進度更新定時器 (1000ms)
    // 3. 設置心跳定時器 (15000ms)
    // 4. 設置最大連線時間 (5分鐘)
    progressIntervalId = setInterval(async () => {
      const progress = await getBatchProgress(batchId)
      controller.enqueue(encoder.encode(encodeSSEMessage('progress', progress)))
      if (isBatchCompleted(progress.status)) {
        controller.enqueue(encoder.encode(encodeSSEMessage('completed', ...)))
        controller.close()
      }
    }, 1000)
  }
})

return new Response(stream, {
  headers: {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
  }
})
```

**前端訂閱**: `src/hooks/use-batch-progress.ts` (EventSource 封裝)

**SSE 事件類型**:

| 事件 | 資料格式 | 描述 |
|------|---------|------|
| `connected` | `{ batchId, timestamp }` | 連線建立 |
| `progress` | `BatchProgress` | 進度更新（每 1 秒） |
| `heartbeat` | `{ timestamp }` | 心跳保活（每 15 秒） |
| `completed` | `{ status, timestamp }` | 處理完成 |
| `timeout` | `{ message, timestamp }` | 連線超時（5 分鐘） |
| `error` | `{ message, timestamp }` | 錯誤事件 |

### 並發控制策略

```typescript
// src/services/batch-processor.service.ts (p-queue-compat)
const DEFAULT_CONCURRENCY = 5                    // 同時處理 5 個文件
const DEFAULT_INTERVAL_CAP = 10                  // 每秒最多 10 個請求
const DEFAULT_INTERVAL_MS = 1000                 // 速率限制區間

const queue = new PQueue({
  concurrency: options.concurrency || DEFAULT_CONCURRENCY,
  intervalCap: options.intervalCap || DEFAULT_INTERVAL_CAP,
  interval: options.intervalMs || DEFAULT_INTERVAL_MS,
})

// 分塊處理以防止 async hooks 溢出
const chunks = chunk(filesToProcess, DEFAULT_CHUNK_SIZE) // 5 個/塊
for (const chunk of chunks) {
  await Promise.all(chunk.map(file => queue.add(() => processFile(file))))
  await delay(DEFAULT_CHUNK_DELAY_MS) // 2 秒延遲，讓 GC 清理
}
```

### 詞彙聚合算法

```typescript
// src/services/batch-term-aggregation.service.ts
// 1. 按公司分組術語
const companyTerms = Map<string, Term[]>

// 2. 識別通用術語（出現在 2+ 公司）
const universalTerms = terms.filter(
  term => companyTerms.size >= UNIVERSAL_TERM_THRESHOLD (2)
)

// 3. 相似度聚類（Levenshtein 距離）
const similarity = calculateSimilarity(term1, term2)
if (similarity >= termSimilarityThreshold (0.85)) {
  mergeSimilarTerms(term1, term2)
}

// 4. 可選 AI 自動分類
if (autoClassifyTerms) {
  const classification = await aiTermValidator.validateAndClassify(term)
}
```

### 進度百分比計算

```typescript
percentage = (processedFiles / totalFiles) * 100
processedFiles = completedFiles + failedFiles + skippedFiles

// 速率計算
processingRate = (processedFiles / elapsedSeconds) * 60  // files/minute
estimatedRemainingSeconds = (remainingFiles / processingRate) * 60
```

### 涉及的 API Routes

#### 批次管理 (16 個方法)
| 端點 | 方法 | 說明 |
|------|------|------|
| `/api/admin/historical-data/batches` | GET, POST | 批次列表與建立 |
| `/api/admin/historical-data/batches/[batchId]` | GET, PATCH, DELETE | 批次 CRUD |
| `/api/admin/historical-data/batches/[batchId]/process` | POST | **開始處理** |
| `/api/admin/historical-data/batches/[batchId]/progress` | GET | **SSE 進度串流** |
| `/api/admin/historical-data/batches/[batchId]/pause` | POST | 暫停 |
| `/api/admin/historical-data/batches/[batchId]/resume` | POST | 恢復 |
| `/api/admin/historical-data/batches/[batchId]/cancel` | POST | 取消 |
| `/api/admin/historical-data/batches/[batchId]/company-stats` | GET | 公司統計 |
| `/api/admin/historical-data/batches/[batchId]/term-stats` | GET, POST, DELETE | 術語統計（查詢/執行/清除） |
| `/api/admin/historical-data/batches/[batchId]/files/retry` | POST | 批次級別批量重試 |
| `/api/admin/historical-data/batches/[batchId]/files/skip` | POST | 批次級別批量跳過 |

#### 文件操作 (10 個方法)
| 端點 | 方法 | 說明 |
|------|------|------|
| `/api/admin/historical-data/upload` | POST | 上傳文件到批次 |
| `/api/admin/historical-data/files` | GET | 歷史文件列表 |
| `/api/admin/historical-data/files/bulk` | POST | 批量文件操作 |
| `/api/admin/historical-data/files/[id]` | GET, PATCH, DELETE | 文件 CRUD |
| `/api/admin/historical-data/files/[id]/detail` | GET | 文件詳細資訊 |
| `/api/admin/historical-data/files/[id]/result` | GET | 提取結果 |
| `/api/admin/historical-data/files/[id]/retry` | POST | 重試 |
| `/api/admin/historical-data/files/[id]/skip` | POST | 跳過 |

### 涉及的 Prisma Models

| Model | 操作 | 說明 |
|-------|------|------|
| `HistoricalBatch` | CREATE, UPDATE, READ | 批次主體（status: PENDING→PROCESSING→COMPLETED/FAILED） |
| `HistoricalFile` | CREATE, UPDATE, READ | 文件記錄（status: PENDING→DETECTING→PROCESSING→COMPLETED） |
| `TermAggregationResult` | CREATE, READ | 批次術語聚合結果 |
| `FileTransactionParty` | CREATE, READ | 文件交易對象 |
| `DocumentFormat` | CREATE/UPDATE | 格式識別結果 |
| `Company` | CREATE/UPDATE | 自動建立新公司 |

### 功能協同標註

| 功能模組 | 涉及步驟 | 責任 |
|----------|---------|------|
| **Story 0.1** | Step 1-2 | 批次建立與文件上傳 |
| **Story 0.4** | Step 6 | 進度追蹤（SSE） |
| **Story 0.6** | Step 5.4 | 公司自動識別 |
| **Story 0.7** | Step 7 | 批量術語聚合 |
| **Story 0.8** | Step 5.5 | 文件發行方識別 |
| **Story 0.9** | Step 5.6 | 格式識別 |
| **CHANGE-006** | Step 5.7 | UnifiedDocumentProcessor 11 步管道 |
| **CHANGE-010** | Step 5 | p-queue-compat 並發控制 |

### 服務分離設計

> **驗證補充**: 批量處理實際由兩個獨立服務協作：
> - **batch-processor.service.ts** — 執行處理邏輯（p-queue 並發控制）
> - **batch-progress.service.ts** — 進度查詢服務（被 SSE 端點調用，獨立追蹤統計）

### 暫停/恢復/跳過機制

批量處理支援完整的生命週期控制：
- `POST .../[batchId]/pause` — 暫停批次（設置中斷標記，當前文件完成後停止）
- `POST .../[batchId]/resume` — 恢復批次（清除中斷標記，繼續未處理文件）
- `POST .../[batchId]/cancel` — 取消批次（標記所有未處理文件為 SKIPPED）
- `POST .../files/[id]/skip` — 跳過單一失敗文件
- `POST .../files/[id]/retry` — 重試單一文件

### 限制與限額

| 項目 | 值 | 說明 |
|------|-----|------|
| 單個文件最大大小 | 50 MB | 上傳限制 |
| 批次最大文件數 | 500 | 單批次限制 |
| 並發處理數 | 5 | 同時處理文件數 |
| 速率限制 | 10 req/sec | Azure API 防護 |
| SSE 最大連線時間 | 5 分鐘 | 自動斷線 |
| 進度更新間隔 | 1000 ms | 1 秒更新 |
| 心跳保活間隔 | 15000 ms | 15 秒心跳 |
| 重試次數 | 2 次 | 1000ms 延遲 |

---

## 場景 4: 外部整合觸發（SharePoint / Outlook / n8n）

### 架構總覽

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          外部文件來源                                    │
├─────────────┬──────────────┬────────────────────────────────────────────┤
│ SharePoint  │   Outlook    │              n8n Webhook                   │
│ Graph API   │  Graph API   │         (三條子路徑)                       │
│ 下載文件    │  獲取附件    │  文件提交 / 狀態回報 / 工作流觸發           │
└──────┬──────┴──────┬───────┴──────────────┬─────────────────────────────┘
       │             │                      │
       ▼             ▼                      ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                     Azure Blob Storage                                   │
│                     uploadFile()                                         │
└─────────────────────────────┬────────────────────────────────────────────┘
                              ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                     Document + ProcessingQueue                           │
│                     → 統一處理器 / extraction-v3 管線                     │
└──────────────────────────────────────────────────────────────────────────┘
```

### 子流程 4A: SharePoint 整合

**流程**: 外部系統（如 n8n）呼叫 API → Graph API 下載文件 → Blob → Document → ProcessingQueue

#### 步驟表

| 步驟 | 動作 | 文件路徑 | 函數名 | 輸入 | 輸出 | Prisma Model 操作 |
|------|------|---------|--------|------|------|-------------------|
| 1 | API Key 驗證 | `src/app/api/documents/from-sharepoint/route.ts` | `ApiKeyService.verify()` | header: `x-api-key` | `ApiKeyValidationResult` | `ApiKey` READ |
| 2 | 權限檢查 | 同上 | `checkPermission()` | permissions, `SHAREPOINT_SUBMIT` | boolean | — |
| 3 | Zod 請求驗證 | 同上 | `RequestSchema.safeParse()` | `{ sharepointUrl, cityCode, originalFileName? }` | 驗證結果 | — |
| 4 | 查詢城市 | `src/services/sharepoint-document.service.ts` | `getCityByCode()` | cityCode | `{ id, code }` | `City` READ |
| 5 | 建立獲取日誌 | 同上 | `submitDocument()` | sharepointUrl, fileName | SharePointFetchLog | `SharePointFetchLog` CREATE (PENDING) |
| 6 | 取得 SharePoint 配置 | 同上 | `getSharePointConfig()` | cityId | SharePointConfig | `SharePointConfig` READ |
| 7 | 解密 Client Secret | `src/services/encryption.service.ts` | `decrypt()` | encrypted secret | plain secret | — |
| 8 | 初始化 Graph API | `src/services/microsoft-graph.service.ts` | constructor | GraphApiConfig | Graph Client | — |
| 9 | 獲取文件資訊 | `src/services/microsoft-graph.service.ts` | `getFileInfoFromUrl()` | sharepointUrl | `SharePointFileInfo` | — |
| 10 | 驗證文件 | `src/services/sharepoint-document.service.ts` | `validateFile()` | fileInfo | pass/throw | — |
| 11 | 檢查重複 | 同上 | `checkDuplicate()` | fileInfo.id, driveId | boolean | `Document` READ |
| 12 | 下載文件 | `src/services/microsoft-graph.service.ts` | `downloadFile()` | downloadUrl | Buffer | — |
| 13 | 計算 SHA-256 | `src/services/sharepoint-document.service.ts` | `createHash('sha256')` | buffer | hex string | — |
| 14 | 上傳 Azure Blob | `src/lib/azure/storage.ts` | `uploadFile()` | buffer, fileName | `{ blobUrl, blobName }` | — |
| 15 | 建立 Document | 同上 service | `prisma.document.create()` | sourceType='SHAREPOINT' | Document | `Document` CREATE |
| 16 | 建立處理隊列 | 同上 | `prisma.processingQueue.create()` | documentId | ProcessingQueue | `ProcessingQueue` CREATE |
| 17 | 更新日誌完成 | 同上 | `updateFetchLog()` | COMPLETED | void | `SharePointFetchLog` UPDATE |

#### SharePoint Graph API 端點

| Graph API Endpoint | 用途 |
|---|---|
| `GET /shares/{encodedUrl}/driveItem` | 通過 Shares API 獲取文件資訊 |
| `GET /sites/{hostname}:{sitePath}` | 獲取站點 ID |
| `GET /sites/{siteId}/drive/root:/{filePath}` | 路徑方式獲取文件 (fallback) |
| `GET /drives/{driveId}/items/{itemId}?$select=@microsoft.graph.downloadUrl` | 獲取下載 URL |
| `GET {downloadUrl}` (預簽名) | 下載文件內容（無需 auth） |
| `GET /organization` | 連線測試 |
| `GET /sites/{siteId}/drives` | 列出文件庫 |
| `GET /drives/{driveId}/items/{itemId}` | 按 ID 下載文件 (`downloadFileById()`) |

**MicrosoftGraphService 完整方法列表 (8 個)**: `getFileInfoFromUrl()`, `downloadFile()`, `downloadFileById()`, `testConnection()`, `testConnectionWithDetails()`, `getSiteInfo()`, `getDriveInfo()`, `listDrives()`

**認證方式**: Azure AD Client Credentials Flow (`ClientSecretCredential`)

**文件篩選**: MIME 白名單 (pdf, jpeg, png, tiff, gif) + 50MB 大小限制 + 重複檢測

---

### 子流程 4B: Outlook 整合

**流程**: 外部系統呼叫 API → 兩種模式（MESSAGE_ID / DIRECT_UPLOAD）→ 過濾規則 → 附件提取 → Blob → Document

#### 步驟表

| 步驟 | 動作 | 文件路徑 | 函數名 | 輸入 | 輸出 | Prisma Model 操作 |
|------|------|---------|--------|------|------|-------------------|
| 1 | API Key 驗證 | `src/app/api/documents/from-outlook/route.ts` | `ApiKeyService.verify()` | header: `x-api-key` | Result | `ApiKey` READ |
| 2 | Zod 請求驗證 | 同上 | `SubmitSchema.safeParse()` | `{ messageId?, attachments?, cityCode, senderEmail, subject }` | 驗證結果 | — |
| 3 | 查詢 Outlook 配置 | `src/services/outlook-document.service.ts` | `getOutlookConfig()` | cityId | OutlookConfig | `OutlookConfig` READ |
| 4 | 建立獲取日誌 | 同上 | create | messageId, subject, senderEmail | OutlookFetchLog | `OutlookFetchLog` CREATE (PENDING) |
| 5 | **過濾規則檢查** | 同上 | `checkFilterRules()` | request, cityId | `FilterCheckResult` | `OutlookFilterRule` READ |
| 6a | MESSAGE_ID: Graph 獲取附件 | `src/services/outlook-mail.service.ts` | `getAllAttachments()` | messageId | `ParsedAttachment[]` | — |
| 6b | DIRECT_UPLOAD: 解析 Base64 | `src/services/outlook-document.service.ts` | `parseDirectAttachments()` | Base64 data | `ParsedAttachment[]` | — |
| 7 | 逐一處理附件 | 同上 | `processAttachment()` | attachment | AttachmentResult | (per attachment) |
| 7a | 驗證 MIME + 大小 | 同上 | type/size check | contentType, size | skip/continue | — |
| 7b | 計算 SHA-256 | 同上 | `createHash()` | buffer | hex | — |
| 7c | 檢查重複 | 同上 | `prisma.document.findFirst()` | sourceType='OUTLOOK' | existing? | `Document` READ |
| 7d | 上傳 Blob | `src/lib/azure/storage.ts` | `uploadFile()` | buffer | `{ blobUrl, blobName }` | — |
| 7e | 建立 Document | 同上 service | `prisma.document.create()` | sourceType='OUTLOOK' | Document | `Document` CREATE |
| 7f | 建立處理隊列 | 同上 | `prisma.processingQueue.create()` | documentId | ProcessingQueue | `ProcessingQueue` CREATE |
| 8 | 更新獲取日誌 | 同上 | `updateFetchLog()` | COMPLETED/PARTIAL | void | `OutlookFetchLog` UPDATE |

#### Outlook 過濾規則引擎

| 規則類型 (`ruleType`) | 運算子 | 說明 |
|---|---|---|
| `SENDER_EMAIL` | EQUALS, CONTAINS, STARTS_WITH, ENDS_WITH, REGEX | 寄件者信箱 |
| `SENDER_DOMAIN` | EQUALS, CONTAINS | 寄件者域名 |
| `SUBJECT_KEYWORD` | CONTAINS, STARTS_WITH, ENDS_WITH | 主旨關鍵字 |
| `SUBJECT_REGEX` | REGEX | 主旨正則 |
| `ATTACHMENT_TYPE` | EQUALS, CONTAINS | 附件類型 |
| `ATTACHMENT_NAME` | CONTAINS, STARTS_WITH, ENDS_WITH, REGEX | 附件名稱 |

**白名單/黑名單**: `isWhitelist` 欄位。先檢查白名單（必須匹配至少一條），再檢查黑名單。

#### Outlook Graph API 端點

| Graph API Endpoint | 用途 |
|---|---|
| `GET /users/{mailbox}/messages/{id}?$expand=attachments` | 獲取郵件 + 附件列表 |
| `GET /users/{mailbox}/messages/{id}/attachments/{attachmentId}` | 獲取單一附件內容 |
| `GET /users/{mailbox}?$select=id,displayName,mail` | 測試郵箱存取 (`getMailboxInfo()`) |
| `GET /users/{mailbox}/messages?$filter=receivedDateTime ge {since}&$count=true` | 統計最近郵件 (`getRecentMailCount()`) |
| `GET /users/{mailbox}/mailFolders?$select=id,displayName,totalItemCount` | 列出資料夾 (`getMailFolders()`) |
| `GET /users/{mailbox}/mailFolders/{folderId}/childFolders` | 子資料夾 (`getChildFolders()`) |

**OutlookMailService 完整方法列表**: `getAllAttachments()`, `getMailInfo()`, `getMailboxInfo()`, `getRecentMailCount()`, `getMailFolders()`, `getChildFolders()`

**最大附件大小**: 30MB（src/types/outlook.ts `MAX_ATTACHMENT_SIZE`，與 SharePoint 50MB 不同）

---

### 子流程 4C: n8n Webhook 整合

**三條子路徑**:
- **4C-1**: n8n 提交文件到系統 (`POST /api/n8n/documents`)
- **4C-2**: n8n 入站 Webhook 狀態回報 (`POST /api/n8n/webhook`)
- **4C-3**: 系統手動觸發 n8n 工作流 (`POST /api/workflows/trigger`)

#### 4C-1: n8n 文件提交

| 步驟 | 動作 | 文件路徑 | 函數名 | 輸入 | 輸出 | Prisma Model 操作 |
|------|------|---------|--------|------|------|-------------------|
| 1 | n8n API Key 驗證 | `src/app/api/n8n/documents/route.ts` | `n8nApiMiddleware()` | `Authorization: Bearer` | authResult | `N8nApiKey` READ, `N8nApiCall` CREATE |
| 2 | Zod 驗證 | 同上 | `submitDocumentSchema.parse()` | `{ fileName, fileContent(base64), mimeType, cityCode, ... }` | validated | — |
| 3 | 解碼 Base64 | `src/services/n8n/n8n-document.service.ts` | `Buffer.from()` | base64 string | Buffer | — |
| 4 | 上傳至儲存 | 同上 | `uploadToStorage()` | buffer | blobUrl | **⚠️ Stub: 返回模擬 URL** |
| 5 | 查詢公司 | 同上 | `getForwarderIdByCode()` | companyCode | companyId | `Company` READ |
| 6 | 建立 Document | 同上 | `prisma.document.create()` | sourceType='N8N_WORKFLOW' | Document | `Document` CREATE |
| 7 | 觸發處理 | 同上 | `triggerProcessing()` | documentId | void | **⚠️ Stub: 只改 status** |
| 8 | 發送回調 | `src/services/n8n/n8n-webhook.service.ts` | `sendEvent()` | DOCUMENT_RECEIVED | delivery result | `N8nWebhookEvent` CREATE |

#### 4C-2: n8n 入站 Webhook

| 步驟 | 動作 | 文件路徑 | 函數名 | 輸入 | 輸出 | Prisma Model 操作 |
|------|------|---------|--------|------|------|-------------------|
| 1 | n8n API Key 驗證 | `src/app/api/n8n/webhook/route.ts` | `n8nApiMiddleware()` | request | authResult | `N8nApiKey` READ |
| 2 | Zod 驗證 | 同上 | `webhookEventSchema.parse()` | `{ event, workflowExecutionId, data }` | validated | — |
| 3 | 記錄入站 Webhook | 同上 | create | payload | N8nIncomingWebhook | `N8nIncomingWebhook` CREATE |
| 4 | 事件處理分派 | 同上 | `handleXxxEvent()` | event data | void | `WorkflowExecution` UPSERT/UPDATE |

**支援的事件類型**: `workflow.started`, `workflow.completed`, `workflow.failed`, `workflow.progress`, `document.status_changed`

#### 4C-3: 手動觸發工作流

| 步驟 | 動作 | 文件路徑 | 函數名 | 輸入 | 輸出 | Prisma Model 操作 |
|------|------|---------|--------|------|------|-------------------|
| 1 | Session 認證 | `src/app/api/workflows/trigger/route.ts` | `auth()` | session | user | — |
| 2 | 角色檢查 | 同上 | `hasAnyRole()` | roles | boolean | — |
| 3 | 獲取工作流定義 | `src/services/n8n/workflow-trigger.service.ts` | `getWorkflowDefinition()` | workflowId | def | `WorkflowDefinition` READ |
| 4 | 驗證參數 | 同上 | `validateParameters()` | params, schema | pass/fail | — |
| 5 | 建立執行記錄 | 同上 | create | workflowId, docs | execution | `WorkflowExecution` CREATE |
| 6 | 發送觸發請求 | 同上 | `sendTriggerRequest()` | triggerUrl, payload | executionId | — (HTTP to n8n) |
| 7 | 更新執行記錄 | 同上 | update | n8nExecutionId | void | `WorkflowExecution` UPDATE |

### n8n Webhook 格式

**入站 (n8n → 系統)**:
```json
{
  "event": "workflow.completed | workflow.started | workflow.failed | workflow.progress | document.status_changed",
  "workflowExecutionId": "exec-123",
  "documentId": "doc-456",
  "data": { "status": "success", "result": {...} },
  "timestamp": "2025-01-01T00:00:00.000Z"
}
```

**出站回調 (系統 → n8n)**:
```json
{
  "event": "DOCUMENT_RECEIVED | DOCUMENT_PROCESSING | DOCUMENT_COMPLETED | DOCUMENT_FAILED | WORKFLOW_STARTED | WORKFLOW_COMPLETED",
  "timestamp": "ISO-8601",
  "data": { ... },
  "metadata": { "traceId": "wh_xxx", "retryCount": 0, "cityCode": "TW" }
}
```

**回調重試策略**: 1 秒 → 5 秒 → 30 秒（最多 3 次），超過標記為 `EXHAUSTED`

### 涉及的 API Routes（全場景 4）

#### SharePoint (9 個)
| 端點 | 方法 | 說明 |
|------|------|------|
| `/api/documents/from-sharepoint` | POST | 提交 SharePoint 文件 |
| `/api/documents/from-sharepoint/status/[fetchLogId]` | GET | 查詢狀態 |
| `/api/admin/integrations/sharepoint/` | GET, POST | 配置管理 |
| `/api/admin/integrations/sharepoint/[id]` | GET, PUT, DELETE | 單一配置 |
| `/api/admin/integrations/sharepoint/[id]/test` | POST | 連線測試（已存配置） |
| `/api/admin/integrations/sharepoint/test` | POST | 連線測試（新配置，保存前驗證） |

#### Outlook (14 個)
| 端點 | 方法 | 說明 |
|------|------|------|
| `/api/documents/from-outlook` | POST | 提交郵件附件 |
| `/api/documents/from-outlook/status/[fetchLogId]` | GET | 查詢狀態 |
| `/api/admin/integrations/outlook/` | GET, POST | 配置管理 |
| `/api/admin/integrations/outlook/[id]` | GET, PUT, DELETE | 單一配置 |
| `/api/admin/integrations/outlook/[id]/test` | POST | 連線測試（已存配置） |
| `/api/admin/integrations/outlook/test` | POST | 連線測試（新配置，保存前驗證） |
| `/api/admin/integrations/outlook/[id]/rules` | GET, POST | 過濾規則列表與新增 |
| `/api/admin/integrations/outlook/[id]/rules/[ruleId]` | PUT, DELETE | 規則操作 |
| `/api/admin/integrations/outlook/[id]/rules/reorder` | POST | 重新排序過濾規則優先級 |

#### n8n (13 個方法)
| 端點 | 方法 | 說明 |
|------|------|------|
| `/api/n8n/documents` | POST | n8n 提交文件 |
| `/api/n8n/documents/[id]/status` | GET | 文件狀態 |
| `/api/n8n/documents/[id]/result` | GET | 處理結果 |
| `/api/n8n/webhook` | POST | 入站 Webhook |
| `/api/workflows/trigger` | POST | 手動觸發工作流 |
| `/api/workflows/triggerable` | GET | 可觸發工作流列表 |
| `/api/workflows/executions/[id]/retry` | POST | 重試 |
| `/api/workflows/executions/[id]/cancel` | POST | 取消 |
| `/api/workflows/executions/[id]/error` | GET | 錯誤詳情 |
| `/api/workflow-executions` | GET | 執行記錄列表 |
| `/api/workflow-executions/[id]` | GET | 執行詳情 |
| `/api/workflow-executions/running` | GET | 運行中 |
| `/api/workflow-executions/stats` | GET | 統計 |

### 涉及的 Prisma Models（全場景 4，共 18 個）

| Model | 子流程 | 用途 |
|-------|--------|------|
| `ApiKey` | 4A, 4B | API Key 驗證 |
| `City` | 4A, 4B | 城市查詢 |
| `SharePointConfig` | 4A | SharePoint 連線配置 |
| `SharePointFetchLog` | 4A | 獲取日誌（生命週期追蹤） |
| `OutlookConfig` | 4B | Outlook 連線配置 |
| `OutlookFilterRule` | 4B | 郵件過濾規則 |
| `OutlookFetchLog` | 4B | 獲取日誌 |
| `N8nApiKey` | 4C | n8n 獨立 API Key 體系 |
| `N8nApiCall` | 4C | API 呼叫記錄 |
| `N8nIncomingWebhook` | 4C-2 | 入站 Webhook 記錄 |
| `N8nWebhookEvent` | 4C-1 | 出站 Webhook 事件 |
| `WorkflowDefinition` | 4C-3 | 工作流定義 |
| `WorkflowExecution` | 4C-2, 4C-3 | 工作流執行追蹤 |
| `WebhookConfig` | 4C-3 | Webhook 連線配置 |
| `Document` | All | 文件記錄 |
| `ProcessingQueue` | 4A, 4B | 處理隊列 |
| `User` | 4A, 4B | 系統用戶 |
| `Company` | 4C-1 | 公司查詢 |
| `N8nApiCall` | 4C | 追蹤 n8n API 呼叫歷史 |

### 三條子流程關鍵差異對比

| 特性 | 4A SharePoint | 4B Outlook | 4C n8n |
|------|---------------|------------|--------|
| **認證方式** | ApiKey (`x-api-key`) | ApiKey (`x-api-key`) | N8nApiKey (獨立體系) |
| **文件獲取** | Graph API 下載 | Graph API/Base64 | Base64 直傳 |
| **Blob 上傳** | ✅ 真實 `uploadFile()` | ✅ 真實 `uploadFile()` | ⚠️ **Stub** (模擬 URL) |
| **處理觸發** | ✅ ProcessingQueue | ✅ ProcessingQueue | ⚠️ **Stub** (只改 status) |
| **過濾規則** | MIME + 大小 + 重複 | 白/黑名單引擎 + MIME + 大小 + 重複 | MIME + 大小 |
| **日誌 Model** | SharePointFetchLog | OutlookFetchLog | N8nApiCall + N8nIncomingWebhook |
| **回調通知** | ❌ 無 | ❌ 無 | ✅ callbackUrl → N8nWebhookEvent |
| **Graph API** | ✅ 使用 | ✅ 使用 | ❌ 不使用 |
| **最大文件大小** | 50MB | 30MB | 50MB |
| **來源類型** | `SHAREPOINT` | `OUTLOOK` | `N8N_WORKFLOW` |

### 功能協同標註（全場景 4）

| 功能模組 | 涉及子流程 | 責任 |
|----------|-----------|------|
| **Epic 9: SharePoint 整合** | 4A | SharePoint 配置管理 + 文件獲取 |
| **Epic 10: Outlook 整合** | 4B | Outlook 配置管理 + 郵件附件提取 |
| **Epic 11: n8n 工作流整合** | 4C | Webhook + 工作流觸發 |
| **Epic 2: 文件管理** | All | Document.create() + ProcessingQueue |
| **Epic 16: API Key 管理** | 4A, 4B | API Key 驗證 |
| **Microsoft Graph API** | 4A, 4B | 統一的 MicrosoftGraphService |
| **Azure Blob Storage** | 4A, 4B | 文件儲存 |
| **加密服務** | 4A, 4B, 4C | Client Secret / Auth Token 加解密 |

### ⚠️ Stub / 未完整實現

1. **n8n `uploadToStorage()`** — 目前返回模擬 URL，需整合 Azure Blob（SharePoint/Outlook 已有真實實現）
2. **n8n `triggerProcessing()`** — 只改 status，未真正觸發統一處理器
3. **n8n 未建立 ProcessingQueue** — 與 SharePoint/Outlook 流程不同
4. **SharePoint/Outlook 無主動監控** — 依賴外部系統（n8n）主動呼叫 API

---

## 跨場景功能映射矩陣

| 功能/服務 | 場景 1 | 場景 2 | 場景 3 | 場景 4A | 場景 4B | 場景 4C |
|-----------|--------|--------|--------|---------|---------|---------|
| Azure Blob Storage | ✅ | — | ✅ | ✅ | ✅ | ⚠️ Stub |
| Unified Processor | ✅ | — | ✅ | (via Queue) | (via Queue) | ⚠️ Stub |
| V3.1 三階段提取 | ✅ | — | — | — | — | — |
| 信心度路由 | ✅ | — | — | — | — | — |
| 審核工作流 | ✅ | ✅(起點) | — | — | — | — |
| 修正記錄 | ✅ | ✅(核心) | — | — | — | — |
| 規則學習 | — | ✅(核心) | — | — | — | — |
| SSE 串流 | ✅ | — | ✅ | — | — | — |
| 批量處理 | — | — | ✅(核心) | — | — | — |
| p-queue 並發 | — | — | ✅ | — | — | — |
| Microsoft Graph | — | — | — | ✅ | ✅ | — |
| API Key 驗證 | — | — | — | ✅ | ✅ | ✅(獨立) |
| 過濾規則引擎 | — | — | — | — | ✅ | — |
| Webhook 回調 | — | — | — | — | — | ✅ |
| AuditLog | ✅ | ✅ | — | — | — | — |
| ProcessingQueue | ✅ | — | — | ✅ | ✅ | ❌ |

---

## 完整 Prisma Model 參與統計

| Prisma Model | 場景 1 | 場景 2 | 場景 3 | 場景 4 | 總涉及場景 |
|--------------|--------|--------|--------|--------|-----------|
| Document | ✅ | ✅ | — | ✅ | 3 |
| ExtractionResult | ✅ | ✅ | — | — | 2 |
| Company | ✅ | ✅ | ✅ | ✅ | 4 |
| DocumentFormat | ✅ | — | ✅ | — | 2 |
| ReviewRecord | ✅ | — | — | — | 1 |
| ProcessingQueue | ✅ | — | — | ✅ | 2 |
| Correction | ✅ | ✅ | — | — | 2 |
| FieldCorrectionHistory | ✅ | ✅ | — | — | 2 |
| AuditLog | ✅ | ✅ | — | — | 2 |
| PromptConfig | ✅ | — | — | — | 1 |
| MappingRule | ✅ | ✅ | — | — | 2 |
| ReferenceNumber | ✅ | — | — | — | 1 |
| ExchangeRate | ✅ | — | — | — | 1 |
| TemplateInstance | ✅ | — | — | — | 1 |
| CorrectionPattern | — | ✅ | — | — | 1 |
| RuleSuggestion | — | ✅ | — | — | 1 |
| RuleVersion | — | ✅ | — | — | 1 |
| RuleApplication | — | ✅ | — | — | 1 |
| RollbackLog | — | ✅ | — | — | 1 |
| HistoricalBatch | — | — | ✅ | — | 1 |
| HistoricalFile | — | — | ✅ | — | 1 |
| TermAggregationResult | ✅ | — | ✅ | — | 2 |
| FileTransactionParty | — | — | ✅ | — | 1 |
| SharePointConfig | — | — | — | ✅ | 1 |
| SharePointFetchLog | — | — | — | ✅ | 1 |
| OutlookConfig | — | — | — | ✅ | 1 |
| OutlookFilterRule | — | — | — | ✅ | 1 |
| OutlookFetchLog | — | — | — | ✅ | 1 |
| N8nApiKey | — | — | — | ✅ | 1 |
| N8nApiCall | — | — | — | ✅ | 1 |
| N8nIncomingWebhook | — | — | — | ✅ | 1 |
| N8nWebhookEvent | — | — | — | ✅ | 1 |
| WorkflowDefinition | — | — | — | ✅ | 1 |
| WorkflowExecution | — | — | — | ✅ | 1 |
| WebhookConfig | — | — | — | ✅ | 1 |
| ApiKey | — | — | — | ✅ | 1 |
| City | — | — | — | ✅ | 1 |
| User | — | — | — | ✅ | 1 |
| **總計** | **17** | **12+** | **6** | **18** | **40+ 唯一 Models** |

---

## 驗證修正記錄

> 以下為交叉驗證後發現並修正的項目（4 個驗證 Agent 於 2026-02-27 執行）

### 場景 1 修正 (原準確度 ~90%)
| 修正項 | 原始描述 | 修正後 |
|--------|---------|--------|
| 信心度維度數 | 5 維度 | 5-6 維度（CHANGE-032 啟用時新增 REFERENCE_NUMBER_MATCH） |
| ConfigSourceBonus | +10/+5/0 points | 100/80/50 分（原始分數 0-100 scale） |
| ConfigSourceBonus 權重 | 固定 15% | 動態：15%（預設）或 10%（refMatch 啟用時） |
| 降級規則 | 只提 3 條 | 補充：新公司+新格式、>3 分類項目 |
| 閾值版本 | 未標明版本 | 標明 V3.1 閾值（90/70），區別於 CLAUDE.md 中 V3.0（95/80） |
| 遺漏 Model | — | 新增 FieldExtractionFeedback (CHANGE-042) |
| 信心度服務 | 只提 v3-1 | 補充：存在 v3 和 v3-1 兩個版本 |

### 場景 2 修正 (原準確度 ~95%)
| 修正項 | 原始描述 | 修正後 |
|--------|---------|--------|
| 回滾閾值 | ~5% | 10% (DEFAULT_CONFIG.dropThreshold = 0.10) |
| API 端點數 | 17 | 19（+impact, +simulate） |
| 遺漏規則管理 API | — | 新增 /versions/rollback, /accuracy |
| 遺漏功能 | — | Pipeline Config 功能開關（CHANGE-032） |

### 場景 3 修正 (原準確度 ~98.5%)
| 修正項 | 原始描述 | 修正後 |
|--------|---------|--------|
| API 端點數 | 18 | 19 |
| 遺漏服務分離 | — | batch-processor vs batch-progress 獨立服務 |
| 遺漏生命週期控制 | — | 暫停/恢復/跳過機制 |

### 場景 4 修正 (原準確度 ~92%)
| 修正項 | 原始描述 | 修正後 |
|--------|---------|--------|
| Outlook API 數 | 10 | 11（+rules/reorder） |
| 遺漏 Graph 方法 | 列 5 個 | 補充 3 個（testConnectionWithDetails, getSiteInfo, downloadFileById） |
| 遺漏 Outlook 方法 | 列 2 個 | 補充 4 個（getMailboxInfo, getRecentMailCount, getMailFolders, getChildFolders） |
| Prisma Models 數 | 18 | 19（+N8nApiCall） |

### 第二輪驗證修正 (2026-02-27)

> 以下為第二輪交叉驗證後發現並修正的項目（4 個驗證 Agent 於 2026-02-27 第二次執行）

#### 場景 2 修正 (第二輪，原準確度 ~75%)
| 修正項 | 原始描述 | 修正後 |
|--------|---------|--------|
| 修正 API 路由 | `/api/corrections` + `/api/corrections/[id]` 聲稱存在 | 這兩個路由不存在，已移除 |
| 建議批量生成 | `/api/rules/suggestions/generate/batch` 聲稱存在 | 不存在，已移除 |
| 修正相關端點計數 | 5 個 | 3 個（review/correct + patterns + patterns/[id]） |
| 規則建議端點計數 | 6+2=8 個 | 7 個（合併計算，移除 batch） |
| 規則管理端點 | 6 個 | 16 個（新增 [id] CRUD、metrics、test、preview、versions、compare、bulk 等） |

#### 場景 3 修正 (第二輪，原準確度 ~92%)
| 修正項 | 原始描述 | 修正後 |
|--------|---------|--------|
| 文件操作端點 | 7 個 | 9 個（新增 files/[id]/detail、files/bulk） |
| 批次管理端點 | 11 個 | 13 個（新增 batches/[batchId]/files/retry、files/skip） |
| 總 API 端點 | 19 個 | 22 個 |

#### 場景 4 修正 (第二輪，原準確度 ~82%)
| 修正項 | 原始描述 | 修正後 |
|--------|---------|--------|
| SharePoint [configId] HTTP 方法 | PATCH | PUT（系統性錯誤） |
| Outlook [configId] HTTP 方法 | PATCH | PUT（系統性錯誤） |
| Outlook rules/[ruleId] HTTP 方法 | PATCH | PUT（系統性錯誤） |
| MicrosoftGraphService 方法數 | 7 個 | 8 個（新增 testConnection()） |
| SharePoint 路由數 | 7 個 | 8 個（新增 /sharepoint/test POST） |
| Outlook 路由數 | 11 個 | 14 個（新增 /outlook/test POST、rules GET；PATCH→PUT） |
| n8n 路由數 | 12 個 | 14 個（新增 executions/[id]/error GET） |
| Prisma Models 標題 | 19 個 | 18 個（標題數字修正） |
| Outlook 過濾規則細節 | 6 種 ruleType 均可過濾 | ATTACHMENT_TYPE 和 ATTACHMENT_NAME 在郵件級別不生效，僅在附件級別由 processAttachment 處理 |

### 第三輪驗證修正 (2026-02-28)

> 第三輪使用 **Grep 從代碼反向建立 ground truth**，搜尋每個 route.ts 的 `export async function` 和 `export const` 匯出，逐一比對 HTTP 方法。此方法避免了前兩輪「從報告出發驗證」的偏差。

#### 驗證方法
```
Grep pattern: export async function (GET|POST|PATCH|PUT|DELETE)
Grep pattern: export const (GET|POST|PUT|PATCH|DELETE)
搜尋範圍: src/app/api/{rules,corrections,review,companies,rollback-logs,
          admin/historical-data,admin/integrations,n8n,workflows,
          workflow-executions,documents,confidence}/
```

#### 場景 2 修正 (第三輪)
| 修正項 | 第二輪描述 | 第三輪 ground truth |
|--------|-----------|-------------------|
| suggestions/[id]/impact | POST | **GET**（grep 確認 line 61） |
| corrections/patterns/[id] | 只列 GET | **GET, PATCH**（PATCH 在 line 239） |
| rules/suggestions | 只列 GET | **GET, POST**（POST 在 line 310） |
| rules/suggestions/[id] | 只列 GET | **GET, PATCH**（PATCH 在 line 292） |
| rules/ | 只列 GET | **GET, POST**（POST 在 line 359） |
| rules/[id] | GET,PATCH,DELETE | **GET, PATCH**（無 DELETE 匯出） |
| companies/[id]/rules | 只列 GET | **GET, POST**（POST 在 line 284） |
| companies/[id]/rules/[ruleId] | PATCH | **PUT**（PUT 在 line 99） |
| rules/[id]/versions/compare | GET/POST | **GET**（只有 GET 在 line 254） |
| rules/bulk | POST | **POST, PATCH, DELETE**（3 方法在 line 97/256/400） |
| rules/bulk/undo | POST | **GET, POST**（GET 在 line 66, POST 在 line 171） |

#### 場景 3 修正 (第三輪)
| 修正項 | 第二輪描述 | 第三輪 ground truth |
|--------|-----------|-------------------|
| batches/[batchId] | GET, PATCH | **GET, PATCH, DELETE**（DELETE 在 line 295） |
| batches/[batchId]/term-stats | GET | **GET, POST, DELETE**（POST line 154, DELETE line 229） |
| files/[id] | GET, DELETE | **GET, PATCH, DELETE**（PATCH 在 line 132） |

#### 場景 4 修正 (第三輪)
| 修正項 | 第二輪描述 | 第三輪 ground truth |
|--------|-----------|-------------------|
| n8n 端點標題數 | 14 個 | **13 個**（列表實際只有 13 條） |
| workflow-executions 匯出方式 | — | 使用 `export const GET = withCityFilter(...)` 而非 `export async function` |

### 第四輪驗證修正 (2026-02-28)

> 第四輪使用**直接命令行工具**（Glob 路徑驗證 + Grep 函數名搜尋）逐一驗證每個檔案路徑、函數名、Prisma model 和 API 端點計數。

#### 場景 1 修正 (第四輪，18 項修正)
| 修正項 | 原始描述 | 第四輪 ground truth |
|--------|---------|-------------------|
| step 3a 路徑 | `src/lib/azure-blob/index.ts` | **`src/lib/azure-blob.ts`**（單一文件非目錄） |
| step 3b-ii 函數名 | `Stage1CompanyService.identifyCompany()` | **`Stage1CompanyService.execute()`** |
| step 3b-iii 函數名 | `Stage2FormatService.identifyFormat()` | **`Stage2FormatService.execute()`** |
| step 3b-iv 函數名 | `Stage3ExtractionService.extractFields()` | **`Stage3ExtractionService.execute()`** |
| step 3b-ii-A/iii-A/iv-B | `callGpt()` | **`GptCallerService.call()`**（公開方法名） |
| step 3b-iv-C 函數名 | `matchReferenceNumbers()` | **`ReferenceNumberMatcherService.match()`** |
| step 3b-iv-D 函數名 | `convertExchangeRates()` | **`ExchangeRateConverterService.convert()`** |
| step 3d 路徑 | `extraction-v3.service.ts` | **`unified-processor/adapters/term-recorder-adapter.ts`** |
| step 3d Prisma model | `Term.create()` — `Term` model | **`Term` model 不存在**，Prisma 只有 `TermAggregationResult` |
| step 6a 路徑+函數 | `document.service.ts: autoApproveDocument()` | **函數不存在**，auto-approve 邏輯在 `routing-decision-adapter.ts` |
| step 6c-i HTTP 方法 | `POST /review/[id]/correct` | **PATCH**（步驟表 S1 已正確，但 API 路由表和步驟表 6c-i 寫錯） |
| API 路由表 line 189 | `POST /api/review/[id]/correct` | **PATCH** |

#### 場景 2 修正 (第四輪)
| 修正項 | 原始描述 | 第四輪 ground truth |
|--------|---------|-------------------|
| S4 函數名 | `analyzeUnanalyzedCorrections()` | **`analyzeCorrections()`** |
| S5 函數名 | `groupByForwarderAndField()` | 不存在為獨立方法，是 Prisma `groupBy()` 操作 |
| S16 函數名 | `invalidateCache()` | **`invalidateCompanyCache()`** / `invalidateAllRulesCache()` / `invalidateUniversalRulesCache()` |
| S17 路徑 | `stage-3-extraction.service.ts` | **`mapping/field-mapping-engine.ts`** |
| 規則管理 API 標題 | "19 個方法" | **22 個**（漏計 bulk PATCH/DELETE + undo GET） |
| 摘要表場景 2 API 數 | 33 | **35**（4+9+22） |

#### 場景 4 修正 (第四輪)
| 修正項 | 原始描述 | 第四輪 ground truth |
|--------|---------|-------------------|
| SharePoint API 標題 | "8 個" | **9 個**（漏計 `/sharepoint/test POST`） |

#### Prisma Model 統計修正
| 修正項 | 原始 | 修正後 |
|--------|------|--------|
| `Term` model | 場景 1 列出 `Term` | `Term` 不存在，合併到 `TermAggregationResult`（場景 1+3 共用） |

---

*分析日期: 2026-02-27*
*分析方式: 4 個 Agent 並行深度代碼追蹤 + 4 輪驗證（Agent 交叉×2 + Grep ground-truth + 命令行逐項驗證）*
*涉及檔案: 100+ 個核心檔案*
*涉及 Prisma Models: 40+ 個*
*涉及 API 方法: 105+ 個*
