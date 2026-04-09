# AI Document Extraction Project — 資料流與處理管線分析

> **分析日期**: 2026-02-13
> **版本**: V1.0
> **分析範圍**: 端到端資料處理流程
> **分析依據**: 原始碼靜態分析（`src/services/extraction-v3/`、`src/services/mapping/`、`src/services/pipeline-config.service.ts`、`prisma/schema.prisma` 等）

---

## 目錄

1. [端到端資料流概覽](#1-端到端資料流概覽)
2. [文件提取管線 V3 / V3.1](#2-文件提取管線-v3--v31)
3. [三層映射系統資料流](#3-三層映射系統資料流)
4. [信心度計算系統](#4-信心度計算系統)
5. [四層配置繼承資料流](#5-四層配置繼承資料流)
6. [審核流程資料流](#6-審核流程資料流)
7. [範本匹配系統資料流](#7-範本匹配系統資料流)
8. [外部服務整合資料流](#8-外部服務整合資料流)
9. [資料模型關係與流動](#9-資料模型關係與流動)
10. [效能瓶頸與優化點](#10-效能瓶頸與優化點)
11. [錯誤處理與容錯機制](#11-錯誤處理與容錯機制)

---

## 1. 端到端資料流概覽

整個系統從文件輸入到結果輸出的完整資料流如下：

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                           端到端資料流（End-to-End）                          │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   文件來源                  提取管線                      輸出                │
│  ┌─────────┐     ┌──────────────────────────┐     ┌──────────────┐          │
│  │ 手動上傳 │     │  V3.1 九步驟流程          │     │ 結構化資料   │          │
│  │ SharePt  │ ──> │  1.文件準備               │ ──> │ (DB 持久化)  │          │
│  │ Outlook  │     │  2.參考號碼匹配           │     │              │          │
│  │ n8n      │     │  3.公司識別 (GPT-5-nano)  │     │ 審核佇列     │          │
│  └─────────┘     │  4.格式識別 (GPT-5-nano)  │     │ (信心度路由) │          │
│                   │  5.欄位提取 (GPT-5.2)     │     │              │          │
│                   │  6.匯率轉換               │     │ 匯出報表     │          │
│                   │  7.術語記錄               │     │ (Excel/PDF)  │          │
│                   │  8.信心度計算              │     └──────────────┘          │
│                   │  9.路由決策               │                               │
│                   └──────────────────────────┘                               │
│                                                                              │
│   支援服務                                                                   │
│  ┌────────────────────────────────────────────────────────────────┐          │
│  │ 三層映射系統 | 四層配置繼承 | 範本匹配 | 匯率管理 | 參考號碼   │          │
│  └────────────────────────────────────────────────────────────────┘          │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 關鍵數據

| 指標 | 數量 |
|------|------|
| Prisma Models | 119 個 |
| Prisma Enums | 112 個 |
| API Route Files | 319 個（約 392 端點） |
| 提取服務檔案 | 19 個（`src/services/extraction-v3/`） |
| 映射服務檔案 | 7 個（`src/services/mapping/`） |
| 業務服務總計 | 182+ 個（`src/services/`） |
| 年處理量目標 | 450,000-500,000 張發票 |
| 自動化率目標 | 90-95% |

---

## 2. 文件提取管線 V3 / V3.1

### 2.1 V3 單階段架構（7 步管線）

V3 架構使用單次 GPT 呼叫完成所有識別與提取。

**入口**: `src/services/extraction-v3/extraction-v3.service.ts` → `ExtractionV3Service.processFileV3()`

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    V3 七步處理管線（單次 GPT）                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Step 1: FILE_PREPARATION                                               │
│  ├── 服務: PdfConverter (utils/pdf-converter.ts)                        │
│  ├── 輸入: fileBuffer (Buffer) + mimeType (string)                      │
│  ├── 輸出: imageBase64Array (string[]) + pageCount (number)             │
│  └── 支援: PDF, JPEG, PNG, TIFF, WEBP                                  │
│          │                                                              │
│          ▼                                                              │
│  Step 2: DYNAMIC_PROMPT_ASSEMBLY                                        │
│  ├── 服務: PromptAssemblyService (prompt-assembly.service.ts)           │
│  ├── 輸入: cityCode + existingCompanyId? + existingFormatId?            │
│  ├── 輸出: AssembledPrompt (系統提示 + 用戶提示 + 已知公司/格式列表)     │
│  └── 配置: 動態載入 PromptConfig (GLOBAL/COMPANY/FORMAT scope)          │
│          │                                                              │
│          ▼                                                              │
│  Step 3: UNIFIED_GPT_EXTRACTION                                         │
│  ├── 服務: UnifiedGptExtractionService (unified-gpt-extraction.service) │
│  ├── 輸入: AssembledPrompt + imageBase64Array                           │
│  ├── 輸出: UnifiedExtractionResult (標準欄位+行項目+附加費用)            │
│  └── API: Azure OpenAI GPT-5.2 Vision                                  │
│          │                                                              │
│          ▼                                                              │
│  Step 4: RESULT_VALIDATION                                              │
│  ├── 服務: ResultValidationService (result-validation.service.ts)       │
│  ├── 輸入: UnifiedExtractionResult + cityCode + PromptConfig            │
│  ├── 輸出: ValidatedExtractionResult                                    │
│  └── 動作: 驗證日期/金額格式、自動建立公司/格式(JIT)                     │
│          │                                                              │
│          ▼                                                              │
│  Step 5: TERM_RECORDING (可選)                                          │
│  ├── 功能: 記錄新出現的術語以供映射規則學習                              │
│  └── 輸出: newTermsCount + matchedTermsCount                            │
│          │                                                              │
│          ▼                                                              │
│  Step 6: CONFIDENCE_CALCULATION                                         │
│  ├── 服務: ConfidenceV3Service (confidence-v3.service.ts)               │
│  ├── 輸入: ValidatedExtractionResult                                    │
│  ├── 輸出: ConfidenceResultV3 (6 維度加權分數)                           │
│  └── 維度: fieldMapping, termMatching, formatRecognition,               │
│           dataCompleteness, ocrQuality, overallExtraction               │
│          │                                                              │
│          ▼                                                              │
│  Step 7: ROUTING_DECISION                                               │
│  ├── 輸入: ConfidenceResultV3                                           │
│  ├── 輸出: AUTO_APPROVE | QUICK_REVIEW | FULL_REVIEW                   │
│  └── 閾值: >=90 自動通過, 70-89 快速審核, <70 完整審核                   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.2 V3.1 三階段架構（CHANGE-024）

V3.1 將單次 GPT 呼叫拆分為三個階段，使用不同模型以優化成本與精度。

**入口**: `src/services/extraction-v3/extraction-v3.service.ts` → `ExtractionV3Service.processFileV3_1()`
**協調器**: `src/services/extraction-v3/stages/stage-orchestrator.service.ts` → `StageOrchestratorService.execute()`

```
┌─────────────────────────────────────────────────────────────────────────┐
│                 V3.1 九步驟流程（三階段 GPT 提取）                       │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Step 1: FILE_PREPARATION                                               │
│  ├── 同 V3                                                              │
│  ├── 輸入: fileBuffer + mimeType                                        │
│  └── 輸出: imageBase64Array[] + pageCount                               │
│          │                                                              │
│          ▼                                                              │
│  Step 2: REFERENCE_NUMBER_MATCHING (CHANGE-032)                         │
│  ├── 服務: ReferenceNumberMatcherService                                │
│  │         (stages/reference-number-matcher.service.ts)                  │
│  ├── 輸入: fileName + PipelineConfig                                    │
│  ├── 輸出: ReferenceNumberMatchResult                                   │
│  ├── 策略: DB-first substring 匹配 (PostgreSQL ILIKE)                   │
│  ├── 控制: PipelineConfig.refMatchEnabled (預設 false)                   │
│  └── 阻塞: 啟用時若 matchesFound=0 則中止 pipeline (FIX-036)            │
│          │                                                              │
│          ▼                                                              │
│  ┌───────────────────────────────────────────────────────┐              │
│  │  StageOrchestratorService (stages/stage-orchestrator)  │              │
│  │                                                        │              │
│  │  Step 3: STAGE_1_COMPANY_IDENTIFICATION                │              │
│  │  ├── 服務: Stage1CompanyService                        │              │
│  │  │         (stages/stage-1-company.service.ts)         │              │
│  │  ├── 模型: GPT-5-nano (成本最低)                       │              │
│  │  ├── 輸入: imageBase64Array + knownCompanies (max 50)  │              │
│  │  ├── 輸出: Stage1CompanyResult                         │              │
│  │  │   ├── companyId / companyName                       │              │
│  │  │   ├── identificationMethod                          │              │
│  │  │   │   (DB_EXACT|DB_FUZZY|LLM_INFERRED)             │              │
│  │  │   ├── confidence (0-100)                            │              │
│  │  │   ├── isNewCompany (boolean)                        │              │
│  │  │   └── aiDetails (prompt, response, tokenUsage)      │              │
│  │  └── JIT: 自動建立新公司 (autoCreateCompany=true)      │              │
│  │          │                                              │              │
│  │          ▼                                              │              │
│  │  Step 4: STAGE_2_FORMAT_IDENTIFICATION                  │              │
│  │  ├── 服務: Stage2FormatService                          │              │
│  │  │         (stages/stage-2-format.service.ts)           │              │
│  │  ├── 模型: GPT-5-nano                                   │              │
│  │  ├── 輸入: imageBase64Array + Stage1Result              │              │
│  │  ├── 輸出: Stage2FormatResult                           │              │
│  │  │   ├── formatId / formatName                          │              │
│  │  │   ├── configSource                                   │              │
│  │  │   │   (COMPANY_SPECIFIC|UNIVERSAL|LLM_INFERRED)      │              │
│  │  │   ├── confidence (0-100)                             │              │
│  │  │   ├── isNewFormat (boolean)                          │              │
│  │  │   └── aiDetails                                      │              │
│  │  └── JIT: 自動建立新格式 (autoCreateFormat=true)        │              │
│  │          │                                              │              │
│  │          ▼                                              │              │
│  │  Step 5: STAGE_3_FIELD_EXTRACTION                       │              │
│  │  ├── 服務: Stage3ExtractionService                      │              │
│  │  │         (stages/stage-3-extraction.service.ts)        │              │
│  │  ├── 模型: GPT-5.2 (最強推理能力)                       │              │
│  │  ├── GPT 呼叫: GptCallerService                         │              │
│  │  │         (stages/gpt-caller.service.ts)               │              │
│  │  ├── 輸入: imageBase64Array + Stage1Result + Stage2Result│              │
│  │  │         + 動態 Prompt (經 variable-replacer 處理)     │              │
│  │  ├── 輸出: Stage3ExtractionResult                       │              │
│  │  │   ├── standardFields (StandardFieldsV3)              │              │
│  │  │   │   invoiceNumber, invoiceDate, vendorName,        │              │
│  │  │   │   totalAmount, currency, subtotal...             │              │
│  │  │   ├── customFields (Record<string, FieldValue>)      │              │
│  │  │   ├── lineItems (LineItemV3[])                       │              │
│  │  │   ├── extraCharges (ExtraChargeV3[])                 │              │
│  │  │   └── overallConfidence (number)                     │              │
│  │  └── Prompt 工具:                                       │              │
│  │      ├── prompt-builder.ts (構建系統/用戶 Prompt)       │              │
│  │      ├── prompt-merger.ts (合併多層配置 CHANGE-026)     │              │
│  │      └── variable-replacer.ts (動態變數替換 CHANGE-026) │              │
│  │                                                         │              │
│  └─────────────────────────────────────────────────────────┘              │
│          │                                                              │
│          ▼                                                              │
│  Step 6: EXCHANGE_RATE_CONVERSION (CHANGE-032)                          │
│  ├── 服務: ExchangeRateConverterService                                 │
│  │         (stages/exchange-rate-converter.service.ts)                   │
│  ├── 輸入: Stage3Result + EffectivePipelineConfig                       │
│  ├── 輸出: ExchangeRateConversionResult                                 │
│  │   ├── conversions[] (FxConversionItem)                               │
│  │   │   field, originalAmount, originalCurrency,                       │
│  │   │   convertedAmount, targetCurrency, rate, path                    │
│  │   ├── sourceCurrency / targetCurrency                                │
│  │   └── warnings[]                                                     │
│  ├── 轉換範圍: totalAmount, subtotal, lineItems, extraCharges           │
│  ├── 策略: 快取匯率避免 N+1 查詢 (FIX-037)                              │
│  ├── 控制: PipelineConfig.fxConversionEnabled (預設 false)               │
│  └── 非阻塞: 失敗按 fxFallbackBehavior 處理 (skip|warn|error)           │
│          │                                                              │
│          ▼                                                              │
│  Step 7: TERM_RECORDING (可選)                                          │
│  ├── 同 V3                                                              │
│  └── 輸出: newTermsCount + matchedTermsCount                            │
│          │                                                              │
│          ▼                                                              │
│  Step 8: CONFIDENCE_CALCULATION (V3.1 五/六維度)                         │
│  ├── 服務: ConfidenceV3_1Service (confidence-v3-1.service.ts)           │
│  ├── 輸入: Stage1Result + Stage2Result + Stage3Result                   │
│  │         + refMatchResult? + refMatchEnabled?                         │
│  ├── 輸出: ConfidenceResultV3_1                                         │
│  └── 詳見: 第 4 節信心度計算                                             │
│          │                                                              │
│          ▼                                                              │
│  Step 9: ROUTING_DECISION                                               │
│  ├── 輸入: ConfidenceResultV3_1 + 智能路由標記                           │
│  ├── 輸出: AUTO_APPROVE | QUICK_REVIEW | FULL_REVIEW                   │
│  └── 智能路由: 新公司/新格式/LLM推斷配置 → 自動降級                      │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.3 V3 / V3.1 切換機制

```
ExtractionV3Service.processFile(input)
        │
        ├── shouldUseV3_1()
        │   ├── flags.useExtractionV3_1 = false → 使用 V3
        │   ├── flags.extractionV3_1Percentage < 100
        │   │   └── 灰度發布: Math.random() < percentage
        │   └── true → 使用 V3.1
        │
        ├── V3.1 失敗 + flags.fallbackToV3OnError = true
        │   └── 自動回退到 V3
        │
        └── Feature Flags 定義: ExtractionV3Flags
            ├── useExtractionV3_1: boolean
            ├── extractionV3_1Percentage: number (0-100)
            ├── fallbackToV3OnError: boolean
            ├── logPromptAssembly: boolean
            └── logGptResponse: boolean
```

**檔案**: `src/types/extraction-v3.types.ts` → `DEFAULT_EXTRACTION_V3_FLAGS`

### 2.4 V3.1 輸出資料結構

```typescript
// 最終輸出: ExtractionV3Output (as ExtractionV3_1Output)
{
  success: boolean;
  extractionVersion: 'v3.1';

  // 智能路由標記 (CHANGE-025)
  newCompanyDetected: boolean;
  newFormatDetected: boolean;
  needsConfigReview: boolean;
  configSource: 'FORMAT' | 'GLOBAL' | 'DEFAULT';

  // 提取結果
  result: {
    standardFields: StandardFieldsV3;
    customFields: Record<string, FieldValue>;
    lineItems: LineItemV3[];
    extraCharges: ExtraChargeV3[];
    overallConfidence: number;
    issuerIdentification: { companyId, companyName, confidence, isNewCompany };
    formatIdentification: { formatId, formatName, confidence, isNewFormat };
    validation: { isValid, errors[], warnings[] };
    jitCreated: { company: boolean, format: boolean };
  };

  // 信心度與路由
  confidenceResult: { overallScore, level, dimensions[], calculatedAt };
  routingDecision: { decision, score, threshold, reasons[] };

  // AI 詳情
  aiDetails: { prompt, response, tokenUsage, model };
  stageAiDetails: { stage1?, stage2?, stage3? };

  // Pipeline 擴展 (CHANGE-032)
  referenceNumberMatch: ReferenceNumberMatchResult;
  exchangeRateConversion: ExchangeRateConversionResult;

  // 計時
  timing: { totalMs, stepTimings: Record<string, number> };
  stepResults: StepResultV3[];
  warnings: string[];
}
```

---

## 3. 三層映射系統資料流

### 3.1 Tier 1: Universal Mapping（通用層）

| 屬性 | 說明 |
|------|------|
| 資料來源 | `MappingRule` 表，`scope = 'UNIVERSAL'` |
| 覆蓋率 | 70-80% 常見術語 |
| 服務 | `src/services/mapping.service.ts` |
| 匹配策略 | 精確匹配 + 模糊匹配（Levenshtein 距離） |
| 維護成本 | 低（只需維護一份全域規則） |

### 3.2 Tier 2: Forwarder-Specific Override（特定覆蓋層）

| 屬性 | 說明 |
|------|------|
| 資料來源 | `MappingRule` 表，`companyId` 非空 |
| 覆蓋方式 | 只記錄與通用規則不同的映射 |
| 優先級 | 高於 Tier 1（相同術語以 Tier 2 為準） |
| 維護成本 | 中（每個 Forwarder 只需記錄差異） |

### 3.3 Tier 3: LLM Classification（AI 智能分類）

| 屬性 | 說明 |
|------|------|
| 觸發條件 | Tier 1 + Tier 2 均無法匹配 |
| 服務 | `src/services/term-classification.service.ts` |
| 使用模型 | Azure OpenAI GPT-5.2 |
| 輸出 | 分類結果 + 信心度分數 |
| 學習機制 | 成功分類結果可轉為 Tier 1/2 規則 |

### 3.4 映射執行流程

```
                     輸入術語 (Input Term)
                            │
                            ▼
              ┌─────────────────────────┐
              │   Tier 2 查詢            │
              │   companyId + 術語       │
              │   (Company-Specific)     │
              └───────────┬─────────────┘
                          │
                   匹配?  │
                  ┌───────┼────────┐
                  │ Yes            │ No
                  ▼                ▼
          ┌───────────┐  ┌─────────────────────────┐
          │ 使用 Tier 2│  │   Tier 1 查詢            │
          │ 結果       │  │   scope = 'UNIVERSAL'    │
          └───────────┘  │   (Universal)             │
                         └───────────┬─────────────┘
                                     │
                              匹配?  │
                             ┌───────┼────────┐
                             │ Yes            │ No
                             ▼                ▼
                     ┌───────────┐  ┌─────────────────────────┐
                     │ 使用 Tier 1│  │   Tier 3 LLM 分類       │
                     │ 結果       │  │   GPT-5.2 智能分類       │
                     └───────────┘  │   (AI Classification)    │
                                    └───────────┬─────────────┘
                                                │
                                                ▼
                                        ┌───────────┐
                                        │ 分類結果   │
                                        │ + 信心度   │
                                        └───────────┘
```

### 3.5 映射相關服務

| 服務檔案 | 職責 |
|----------|------|
| `src/services/mapping.service.ts` | 三層映射系統核心 |
| `src/services/rule-resolver.ts` | 規則解析（按優先級排序） |
| `src/services/term-classification.service.ts` | Tier 3 LLM 分類 |
| `src/services/ai-term-validator.service.ts` | AI 術語驗證 |
| `src/services/similarity/levenshtein.ts` | 模糊匹配距離計算 |
| `src/services/rule-suggestion-generator.ts` | 規則建議自動生成 |
| `src/services/correction-recording.ts` | 修正記錄（學習迴路） |

---

## 4. 信心度計算系統

### 4.1 V3 六維度信心度

**服務**: `src/services/extraction-v3/confidence-v3.service.ts` → `ConfidenceV3Service`

| 維度 | 英文 | 說明 | 計算依據 |
|------|------|------|----------|
| 欄位映射 | fieldMapping | 映射規則匹配品質 | 匹配的規則數 / 總欄位數 |
| 術語匹配 | termMatching | 術語分類匹配品質 | 已分類項目 / 總項目數 |
| 格式識別 | formatRecognition | 文件格式識別信心度 | GPT 返回的格式識別分數 |
| 資料完整性 | dataCompleteness | 必填欄位填充率 | 已填充必填欄位 / 總必填欄位 |
| OCR 品質 | ocrQuality | OCR 提取品質 | 基於 OCR 引擎回報的品質分數 |
| 整體提取 | overallExtraction | GPT 整體提取信心度 | GPT 回報的 overallConfidence |

### 4.2 V3.1 五/六維度信心度

**服務**: `src/services/extraction-v3/confidence-v3-1.service.ts` → `ConfidenceV3_1Service`

| 維度 | 預設權重 | 計算方式 |
|------|----------|----------|
| STAGE_1_COMPANY | 20% (0.20) | Stage 1 公司識別 confidence (0-100) |
| STAGE_2_FORMAT | 15% (0.15) | Stage 2 格式識別 confidence (0-100) |
| STAGE_3_EXTRACTION | 30% (0.30) | Stage 3 提取 overallConfidence (0-100) |
| FIELD_COMPLETENESS | 20% (0.20) | 必填欄位填充率 (invoiceNumber, invoiceDate, vendorName, totalAmount, currency) |
| CONFIG_SOURCE_BONUS | 15% (0.15) | 配置來源加成: COMPANY_SPECIFIC > UNIVERSAL > LLM_INFERRED |
| REFERENCE_NUMBER_MATCH | 5% (0.05) | 參考號碼匹配分數 (CHANGE-032，從 CONFIG_SOURCE_BONUS 分出) |

**CONFIG_SOURCE_BONUS 分數對照**（定義於 `src/types/extraction-v3.types.ts` → `CONFIG_SOURCE_BONUS_SCORES`）：

| 配置來源 | 加成分數 |
|----------|----------|
| COMPANY_SPECIFIC | 100 |
| UNIVERSAL | 70 |
| LLM_INFERRED | 30 |

**REFERENCE_NUMBER_MATCH 分數邏輯**（FIX-036）：

| 匹配結果 | 分數 |
|----------|------|
| matchesFound > 0 | min(100, 80 + matchesFound * 5) |
| matchesFound = 0 | 0（懲罰性分數；但此路徑理論上已被上游 pipeline 中止） |

### 4.3 路由決策

```
                    overallScore
                        │
           ┌────────────┼────────────┐
           │            │            │
     >= 90          70-89          < 70
           │            │            │
           ▼            ▼            ▼
    AUTO_APPROVE   QUICK_REVIEW   FULL_REVIEW
    (自動通過)     (快速審核)     (完整審核)
```

**閾值定義**: `ROUTING_THRESHOLDS_V3_1`（`confidence-v3-1.service.ts`）

```typescript
{
  AUTO_APPROVE: 90,
  QUICK_REVIEW: 70,
  FULL_REVIEW: 0,
}
```

### 4.4 智能路由降級規則（CHANGE-025）

**服務**: `ConfidenceV3_1Service.getSmartReviewType()`

| 條件 | 降級行為 | needsConfigReview |
|------|----------|-------------------|
| 新公司 + 新格式 | 強制 FULL_REVIEW | true |
| 新公司 | 強制 FULL_REVIEW | true |
| 新格式 | 強制 QUICK_REVIEW | true |
| DEFAULT 配置來源 | 降級一級 (AUTO→QUICK, QUICK→FULL) | false |
| Stage 1 失敗 | 強制 FULL_REVIEW | - |
| Stage 2 失敗 | 強制 FULL_REVIEW | - |
| Stage 3 失敗 | 強制 FULL_REVIEW | - |
| >3 項需人工分類 | AUTO→QUICK（僅限 AUTO_APPROVE） | - |
| LLM_INFERRED 配置 | AUTO→QUICK（僅限 AUTO_APPROVE） | - |

---

## 5. 四層配置繼承資料流

系統中存在三種主要的配置繼承體系：

### 5.1 PromptConfig 繼承（四層）

**服務**: `src/services/prompt-resolver.service.ts`、`src/services/extraction-v3/prompt-assembly.service.ts`

```
SYSTEM (最低優先)
    └── 靜態 Prompt: src/services/static-prompts.ts
         │
         ▼
GLOBAL (覆蓋 SYSTEM)
    └── DB: PromptConfig WHERE scope='GLOBAL'
         │
         ▼
COMPANY (覆蓋 GLOBAL)
    └── DB: PromptConfig WHERE scope='COMPANY' AND companyId=?
         │
         ▼
FORMAT (最高優先)
    └── DB: PromptConfig WHERE scope='FORMAT' AND documentFormatId=?
```

**合併策略**（`src/services/extraction-v3/utils/prompt-merger.ts`）：
- `mergePrompts()`: 將多層 Prompt 配置合併為單一 Prompt
- `mergePromptConfigs()`: 依 scope 優先級選擇最高級配置
- `selectHighestPriorityConfig()`: FORMAT > COMPANY > GLOBAL 選擇

**變數替換**（`src/services/extraction-v3/utils/variable-replacer.ts`）：
- `replaceVariables()`: 替換 Prompt 中的 `${variableName}` 佔位符
- 上下文建構: `buildStage1VariableContext()`, `buildStage2VariableContext()`, `buildStage3VariableContext()`

### 5.2 FieldMappingConfig 繼承（三層）

**服務**: `src/services/mapping/config-resolver.ts` → `ConfigResolver`

```
GLOBAL (最低優先, priority=1)
    └── DB: FieldMappingConfig WHERE scope='GLOBAL' AND isActive=true
         │
         ▼
COMPANY (中間優先, priority=2)
    └── DB: FieldMappingConfig WHERE scope='COMPANY' AND companyId=? AND isActive=true
         │
         ▼
FORMAT (最高優先, priority=3)
    └── DB: FieldMappingConfig WHERE scope='FORMAT' AND documentFormatId=? AND isActive=true
```

**合併演算法**（`ConfigResolver.mergeConfigs()`）：

```
1. 從低優先級到高優先級遍歷所有配置
2. 對於每個配置的每條規則:
   - 以 targetField 為 key 存入 Map
   - 高優先級配置的規則會覆蓋低優先級的同名規則
3. 最終 Map 中的規則即為合併結果
4. 按 priority 欄位排序
```

**轉換類型**（`src/services/mapping/transform-executor.ts`）：

| 轉換類型 | 說明 | 實現 |
|----------|------|------|
| DIRECT | 直接映射 | `src/services/transform/direct.transform.ts` |
| CONCAT | 串接多欄位 | `src/services/transform/concat.transform.ts` |
| SPLIT | 分割單欄位 | `src/services/transform/split.transform.ts` |
| FORMULA | 公式計算 | `src/services/transform/formula.transform.ts` |
| LOOKUP | 查表轉換 | `src/services/transform/lookup.transform.ts` |

### 5.3 PipelineConfig 繼承（三層）

**服務**: `src/services/pipeline-config.service.ts` → `resolveEffectiveConfig()`

```
GLOBAL (最低優先)
    └── DB: PipelineConfig WHERE scope='GLOBAL' AND regionId=NULL AND companyId=NULL
         │
         ▼
REGION (中間優先)
    └── DB: PipelineConfig WHERE scope='REGION' AND regionId=?
         │
         ▼
COMPANY (最高優先)
    └── DB: PipelineConfig WHERE scope='COMPANY' AND companyId=?
```

**合併策略**（FIX-037 BUG-4 修正）：
- GLOBAL scope 的值一律採用
- REGION/COMPANY scope 只有與 Prisma schema 預設值不同的欄位才覆蓋
- nullable 欄位（如 `refMatchTypes`, `fxTargetCurrency`）只有非 null 時才覆蓋

**預設配置值**：

```typescript
const DEFAULT_EFFECTIVE_CONFIG: EffectivePipelineConfig = {
  refMatchEnabled: false,
  refMatchTypes: ['SHIPMENT', 'HAWB', 'MAWB', 'BL', 'CONTAINER'],
  refMatchMaxResults: 10,
  fxConversionEnabled: false,
  fxTargetCurrency: null,
  fxConvertLineItems: true,
  fxConvertExtraCharges: true,
  fxRoundingPrecision: 2,
  fxFallbackBehavior: 'skip',
};
```

### 5.4 配置解析流程圖

```
      ┌────────────────────────────────────────────────────────────────┐
      │                    配置解析統一流程                             │
      ├────────────────────────────────────────────────────────────────┤
      │                                                                │
      │  輸入: companyId? + documentFormatId? + regionId?              │
      │         │                                                      │
      │         ▼                                                      │
      │  ┌─────────────────────────────────┐                           │
      │  │  1. 查詢 FORMAT 配置            │ → FieldMappingConfig      │
      │  │     (如 documentFormatId 存在)   │    PromptConfig           │
      │  └─────────────┬───────────────────┘                           │
      │                │                                               │
      │                ▼                                               │
      │  ┌─────────────────────────────────┐                           │
      │  │  2. 查詢 COMPANY 配置           │ → FieldMappingConfig      │
      │  │     (如 companyId 存在)          │    PromptConfig           │
      │  └─────────────┬───────────────────┘    PipelineConfig         │
      │                │                                               │
      │                ▼                                               │
      │  ┌─────────────────────────────────┐                           │
      │  │  3. 查詢 REGION 配置            │ → PipelineConfig          │
      │  │     (如 regionId 存在)           │                           │
      │  └─────────────┬───────────────────┘                           │
      │                │                                               │
      │                ▼                                               │
      │  ┌─────────────────────────────────┐                           │
      │  │  4. 查詢 GLOBAL 配置            │ → FieldMappingConfig      │
      │  │     (始終查詢)                   │    PromptConfig           │
      │  └─────────────┬───────────────────┘    PipelineConfig         │
      │                │                                               │
      │                ▼                                               │
      │  ┌─────────────────────────────────┐                           │
      │  │  5. 合併                         │                           │
      │  │  高優先級覆蓋低優先級的同名規則  │                           │
      │  │  產出最終有效配置                │                           │
      │  └─────────────────────────────────┘                           │
      │                                                                │
      └────────────────────────────────────────────────────────────────┘
```

---

## 6. 審核流程資料流

```
提取結果 (ExtractionV3Output)
      │
      ├── confidenceResult.overallScore
      │
      ▼
信心度路由決策
      │
      ├──── >= 90: AUTO_APPROVE ──────────────────────────────────────┐
      │                                                                │
      ├──── 70-89: QUICK_REVIEW ────┐                                 │
      │                              │                                 │
      └──── < 70:  FULL_REVIEW ─┐   │                                 │
                                 │   │                                 │
                                 ▼   ▼                                 │
                          ┌─────────────────┐                          │
                          │   審核佇列       │                          │
                          │ ProcessingQueue  │                          │
                          │   status:        │                          │
                          │   PENDING_REVIEW │                          │
                          └────────┬────────┘                          │
                                   │                                   │
                    ┌──────────────┼──────────────┐                    │
                    │              │              │                     │
                    ▼              ▼              ▼                     │
             ┌───────────┐ ┌───────────┐ ┌───────────┐                │
             │ 快速確認   │ │ 逐欄修正   │ │ 升級處理   │                │
             │ 一鍵通過   │ │ 詳細檢查   │ │ Escalation │                │
             └─────┬─────┘ └─────┬─────┘ └─────┬─────┘                │
                   │             │             │                       │
                   │    Correction記錄          │                       │
                   │    ReviewRecord            │                       │
                   │             │             │                       │
                   ▼             ▼             ▼                       │
             ┌─────────────────────────────────────┐                   │
             │          持久化存入                   │ <─────────────────┘
             │  ExtractionV3Result / Document       │
             │  status: COMPLETED                   │
             └─────────────────────────────────────┘
                              │
                              ▼
                   ┌─────────────────┐
                   │  學習迴路        │
                   │  修正 → 規則建議 │
                   │  (Tier 1/2 學習) │
                   └─────────────────┘
```

### 審核相關服務

| 服務 | 檔案 | 職責 |
|------|------|------|
| 發票提交 | `src/services/invoice-submission.service.ts` | 處理結果持久化 |
| 審核路由 | `src/services/routing.service.ts` | 分配審核任務 |
| 任務狀態 | `src/services/task-status.service.ts` | 管理審核佇列狀態 |
| 修正記錄 | `src/services/correction-recording.ts` | 記錄人工修正 |
| 升級處理 | Escalation model | 處理需主管介入的案件 |

### 審核相關 Prisma Models

| Model | 說明 |
|-------|------|
| `ReviewRecord` | 審核記錄（誰審核、何時、結果） |
| `Correction` | 修正記錄（修改了哪些欄位） |
| `FieldCorrectionHistory` | 欄位修正歷史 |
| `CorrectionPattern` | 修正模式（用於自動學習） |
| `Escalation` | 升級記錄 |
| `Notification` | 通知（審核指派、升級通知等） |

---

## 7. 範本匹配系統資料流

### 7.1 DataTemplate 匹配流程

**服務**: `src/services/template-matching-engine.service.ts`、`src/services/auto-template-matching.service.ts`

```
提取結果 (ExtractionV3Output)
      │
      ├── formatIdentification.formatId
      ├── issuerIdentification.companyId
      │
      ▼
┌─────────────────────────────────────────────────┐
│  TemplateMatchingEngine                          │
│                                                  │
│  1. 根據 companyId + formatId 查詢候選模板       │
│     DB: DataTemplate WHERE                       │
│         companyId=? AND (formatId=? OR 通用)      │
│                                                  │
│  2. 對每個候選模板計算匹配分數                    │
│     - 欄位覆蓋率                                 │
│     - 欄位名稱匹配度                              │
│     - 格式匹配度                                  │
│                                                  │
│  3. 選擇最佳匹配模板                              │
│     (matchScore >= threshold)                    │
└───────────────┬─────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────┐
│  TemplateFieldMapping 應用                        │
│                                                  │
│  1. 載入模板欄位映射規則                          │
│     DB: TemplateFieldMapping WHERE templateId=?  │
│                                                  │
│  2. 對每條映射規則執行轉換                        │
│     sourceField → targetField                    │
│     transformType: DIRECT|CONCAT|SPLIT|FORMULA    │
│                                                  │
│  3. 處理預設值（當來源欄位為空時）                 │
│                                                  │
│  4. 輸出: 映射後的結構化資料                      │
└───────────────┬─────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────┐
│  TemplateInstance 生成                            │
│                                                  │
│  1. 建立模板實例                                  │
│     DB: TemplateInstance                          │
│                                                  │
│  2. 填充實例行資料                                │
│     DB: TemplateInstanceRow                      │
│                                                  │
│  3. 匯出 (可選)                                   │
│     TemplateExportService → Excel (ExcelJS)      │
└─────────────────────────────────────────────────┘
```

### 7.2 範本相關服務

| 服務 | 檔案 | 職責 |
|------|------|------|
| 資料模板 CRUD | `src/services/data-template.service.ts` | 模板建立/查詢/更新/刪除 |
| 模板欄位映射 | `src/services/template-field-mapping.service.ts` | 欄位映射規則管理 |
| 模板實例 | `src/services/template-instance.service.ts` | 實例化與版本管理 |
| 匹配引擎 | `src/services/template-matching-engine.service.ts` | 模板自動匹配 |
| 自動匹配 | `src/services/auto-template-matching.service.ts` | 批次自動匹配 |
| 匯出 | `src/services/template-export.service.ts` | Excel 匯出 (ExcelJS) |

### 7.3 範本相關 Prisma Models

| Model | 說明 |
|-------|------|
| `DataTemplate` | 資料模板定義（名稱、公司、格式、欄位定義） |
| `TemplateFieldMapping` | 模板欄位映射規則（來源→目標+轉換類型） |
| `TemplateInstance` | 模板實例（某次提取的具體結果） |
| `TemplateInstanceRow` | 模板實例行（行項目資料） |

---

## 8. 外部服務整合資料流

### 8.1 Azure Document Intelligence（OCR）

**服務**: `src/services/azure-di.service.ts`

```
文件 (Buffer)
      │
      ▼
┌─────────────────────────────────────────────────┐
│  Azure Document Intelligence API                 │
│                                                  │
│  1. 上傳文件到 Azure DI                           │
│     POST /formrecognizer/documentModels/         │
│          prebuilt-invoice:analyze                 │
│                                                  │
│  2. 輪詢結果 (Polling)                            │
│     GET /formrecognizer/documentModels/           │
│         prebuilt-invoice/analyzeResults/{id}      │
│     直到 status = 'succeeded'                    │
│                                                  │
│  3. 解析結果                                      │
│     extractedText, tables, keyValuePairs          │
│                                                  │
│  4. 錯誤重試                                      │
│     最大重試次數 3 次，指數退避                     │
└─────────────┬───────────────────────────────────┘
              │
              ▼
       OcrResult (DB 持久化)
```

### 8.2 Azure OpenAI（AI 提取/分類）

**V3 服務**: `src/services/extraction-v3/unified-gpt-extraction.service.ts`
**V3.1 服務**: `src/services/extraction-v3/stages/gpt-caller.service.ts`

```
Prompt + Images
      │
      ▼
┌─────────────────────────────────────────────────┐
│  Azure OpenAI Chat Completions API               │
│                                                  │
│  1. Prompt 組裝                                   │
│     PromptAssemblyService → 系統提示 + 用戶提示  │
│     + Base64 圖片 (Vision)                        │
│                                                  │
│  2. API 呼叫                                      │
│     POST /openai/deployments/{model}/             │
│          chat/completions                         │
│                                                  │
│  模型選擇:                                        │
│  ├── Stage 1 (公司識別): GPT-5-nano              │
│  ├── Stage 2 (格式識別): GPT-5-nano              │
│  └── Stage 3 (欄位提取): GPT-5.2                 │
│                                                  │
│  3. Token 追蹤                                    │
│     tokenUsage: { input, output, total }         │
│     用於 AI 成本計算 (ai-cost.service.ts)         │
│                                                  │
│  4. 結果解析                                      │
│     JSON response → 結構化提取結果                │
│                                                  │
│  5. 錯誤處理                                      │
│     429 Rate Limit → 指數退避重試                 │
│     400 Bad Request → 返回錯誤                    │
│     超時 → 可配置的 timeout (STEP_TIMEOUT_V3)     │
└─────────────────────────────────────────────────┘
```

### 8.3 SharePoint / Outlook 整合

**SharePoint 服務**:
| 服務 | 檔案 |
|------|------|
| 文件獲取 | `src/services/sharepoint-document.service.ts` |
| 配置管理 | `src/services/sharepoint-config.service.ts` |

**Outlook 服務**:
| 服務 | 檔案 |
|------|------|
| 郵件處理 | `src/services/outlook-mail.service.ts` |
| 文件提取 | `src/services/outlook-document.service.ts` |
| 配置管理 | `src/services/outlook-config.service.ts` |
| Graph API | `src/services/microsoft-graph.service.ts` |

```
SharePoint / Outlook
      │
      ├── Microsoft Graph API (src/services/microsoft-graph.service.ts)
      │   ├── 監控新文件/郵件
      │   ├── 下載附件
      │   └── 提取文件元資料
      │
      ▼
Document 建立 (src/services/document-source.service.ts)
      │
      ▼
進入提取管線 (ExtractionV3Service)
```

### 8.4 n8n 工作流整合

**服務目錄**: `src/services/n8n/`（9 個服務檔案）

```
┌─────────────────────────────────────────────────┐
│  n8n 工作流引擎                                   │
│                                                  │
│  觸發條件:                                        │
│  ├── 文件上傳完成 (webhook)                       │
│  ├── 提取完成 (webhook)                           │
│  ├── 審核完成 (webhook)                           │
│  └── 排程觸發 (cron)                              │
│                                                  │
│  服務:                                            │
│  ├── n8n-webhook.service.ts    → Webhook 收發     │
│  ├── workflow-trigger.service.ts → 觸發工作流      │
│  ├── workflow-execution.service.ts → 執行追蹤     │
│  ├── workflow-definition.service.ts → 流程定義    │
│  ├── workflow-error.service.ts → 錯誤處理         │
│  ├── n8n-document.service.ts   → 文件處理         │
│  ├── n8n-health.service.ts     → 健康檢查         │
│  ├── n8n-api-key.service.ts    → API 金鑰         │
│  └── webhook-config.service.ts → Webhook 配置     │
│                                                  │
│  回調機制:                                        │
│  ├── n8n → 系統: N8nIncomingWebhook              │
│  └── 系統 → n8n: WebhookConfig + event trigger   │
└─────────────────────────────────────────────────┘
```

### 8.5 快取（Upstash Redis）

**依賴**: `@upstash/redis`

| 用途 | 服務 |
|------|------|
| 映射配置快取 | `src/services/mapping/mapping-cache.ts` (TTL: 5 分鐘) |
| Prompt 配置快取 | `src/services/prompt-cache.service.ts` |
| Rate Limiting | `src/services/rate-limit.service.ts` |

---

## 9. 資料模型關係與流動

### 9.1 核心實體關係

```
Region (區域)
  │
  ├── 1:N → City (城市)
  │           │
  │           └── N:M → User (透過 UserCityAccess)
  │
  └── 1:N → ReferenceNumber (參考編號)

Company (公司)
  │
  ├── 1:N → DocumentFormat (文件格式)
  │           │
  │           ├── 1:N → Document (文件)
  │           │           │
  │           │           ├── 1:1 → OcrResult (OCR 結果)
  │           │           ├── 1:1 → ExtractionResult (提取結果 V1/V2)
  │           │           ├── 1:N → ReviewRecord (審核記錄)
  │           │           ├── 1:N → Correction (修正記錄)
  │           │           └── 1:1 → ProcessingQueue (處理佇列)
  │           │
  │           ├── 1:N → FieldMappingConfig (scope=FORMAT)
  │           └── 1:N → PromptConfig (scope=FORMAT)
  │
  ├── 1:N → MappingRule (公司專屬映射規則 - Tier 2)
  ├── 1:N → FieldMappingConfig (scope=COMPANY)
  ├── 1:N → PromptConfig (scope=COMPANY)
  └── 1:N → PipelineConfig (scope=COMPANY)
```

### 9.2 配置實體關係

```
PromptConfig
  ├── scope: SYSTEM | GLOBAL | COMPANY | FORMAT
  ├── companyId? → Company
  ├── documentFormatId? → DocumentFormat
  └── 1:N → PromptVariable (動態變數)

FieldMappingConfig
  ├── scope: GLOBAL | COMPANY | FORMAT
  ├── companyId? → Company
  ├── documentFormatId? → DocumentFormat
  └── 1:N → FieldMappingRule (映射規則)
               ├── sourceFields: string[]
               ├── targetField: string
               ├── transformType: DIRECT|CONCAT|SPLIT|FORMULA|LOOKUP
               └── transformParams: JSON

PipelineConfig
  ├── scope: GLOBAL | REGION | COMPANY
  ├── regionId? → Region
  ├── companyId? → Company
  ├── refMatchEnabled / refMatchTypes / refMatchMaxResults
  └── fxConversionEnabled / fxTargetCurrency / fxRoundingPrecision...
```

### 9.3 模板實體關係

```
DataTemplate (資料模板)
  ├── companyId? → Company
  ├── formatId? → DocumentFormat
  │
  ├── 1:N → TemplateFieldMapping (欄位映射規則)
  │           ├── sourceField → targetField
  │           ├── transformType + transformParams
  │           └── defaultValue?
  │
  └── 1:N → TemplateInstance (模板實例)
              ├── documentId → Document
              ├── status: DRAFT | COMPLETED | EXPORTED
              │
              └── 1:N → TemplateInstanceRow (實例行)
                          ├── rowIndex
                          └── fieldValues: JSON
```

### 9.4 參考編號與匯率

```
ReferenceNumber (參考編號主檔)
  ├── regionId → Region
  ├── number: string (唯一)
  ├── type: SHIPMENT | HAWB | MAWB | BL | CONTAINER
  └── status: ACTIVE | INACTIVE

ExchangeRate (匯率記錄)
  ├── sourceCurrency / targetCurrency
  ├── rate: number
  ├── effectiveDate
  └── year: number
```

---

## 10. 效能瓶頸與優化點

### 10.1 已識別的效能瓶頸

| 瓶頸 | 位置 | 影響 | 說明 |
|------|------|------|------|
| OCR 處理時間 | Azure DI API | 每頁 3-10 秒 | 外部 API 延遲，無法控制 |
| GPT API 呼叫 | Azure OpenAI | 每次 2-15 秒 | V3.1 三次呼叫，總計 6-45 秒 |
| PDF 轉換 | `pdf-to-img` 庫 | 每頁 1-3 秒 | CPU 密集型操作 |
| 配置查詢 | Prisma (PostgreSQL) | 每次 3 查詢 | 三層配置逐層查詢 |
| 匯率查詢 | N+1 問題（已修復） | FIX-037 | 快取匯率避免重複查詢 |

### 10.2 已實施的優化

| 優化 | 實現 | 效果 |
|------|------|------|
| 映射配置快取 | `src/services/mapping/mapping-cache.ts` (TTL: 5min) | 減少 DB 查詢 |
| Prompt 快取 | `src/services/prompt-cache.service.ts` | 減少 Prompt 組裝時間 |
| GPT 模型分級 | Stage 1/2 用 GPT-5-nano, Stage 3 用 GPT-5.2 | 降低 AI 成本 |
| 匯率快取 | `ExchangeRateConverterService` 內建 `rateCache` Map | 避免 N+1 查詢 |
| Feature Flags 灰度 | `extractionV3_1Percentage` | 漸進式遷移 |
| V3.1 回退機制 | `fallbackToV3OnError` | 保障可用性 |
| 公司列表限制 | `loadKnownCompanies()` take: 50 | 控制 Prompt 長度 |

### 10.3 潛在優化方向

| 方向 | 說明 | 預期效果 |
|------|------|----------|
| Stage 1+2 並行 | 公司識別和格式識別可同時進行（需獨立 Prompt） | 減少 1-3 秒延遲 |
| Redis 快取層 | 將 Upstash Redis 用於配置快取 | 毫秒級配置查詢 |
| 批次處理優化 | 多文件並行提取（控制並發數） | 提升吞吐量 |
| Prompt 預編譯 | 將常用 Prompt 模板預先合併 | 減少組裝時間 |

---

## 11. 錯誤處理與容錯機制

### 11.1 各階段錯誤處理策略

| 步驟 | 優先級 | 失敗處理 |
|------|--------|----------|
| FILE_PREPARATION | REQUIRED | 中止管線，返回錯誤 |
| REFERENCE_NUMBER_MATCHING | CONDITIONAL | 啟用且無匹配→中止(FIX-036)；未啟用→跳過 |
| STAGE_1_COMPANY | REQUIRED | 中止或繼續（`continueOnStageFailure`） |
| STAGE_2_FORMAT | REQUIRED | 中止或繼續（`continueOnStageFailure`） |
| STAGE_3_EXTRACTION | REQUIRED | 中止管線 |
| EXCHANGE_RATE_CONVERSION | OPTIONAL | 按 `fxFallbackBehavior` 處理 (skip/warn/error) |
| TERM_RECORDING | OPTIONAL | 失敗記錄警告，不中止管線 |
| CONFIDENCE_CALCULATION | REQUIRED | 中止管線 |
| ROUTING_DECISION | REQUIRED | 中止管線 |

### 11.2 重試機制

```
┌─────────────────────────────────────────────────┐
│  重試策略（各服務共用模式）                       │
│                                                  │
│  Azure DI (OCR):                                 │
│  ├── 最大重試: 3 次                               │
│  ├── 退避策略: 指數退避 (1s, 2s, 4s)             │
│  └── 可重試錯誤: 429, 500, 503, Timeout          │
│                                                  │
│  Azure OpenAI (GPT):                             │
│  ├── 最大重試: 由 STEP_RETRY_COUNT_V3 定義        │
│  ├── 退避策略: 指數退避                           │
│  └── 可重試錯誤: 429 Rate Limit, Timeout         │
│                                                  │
│  資料庫 (Prisma):                                 │
│  ├── 事務重試: 自動（Prisma 內建）                │
│  └── 連接重試: 連接池自動管理                     │
│                                                  │
│  匯率轉換:                                        │
│  ├── fxFallbackBehavior = 'skip': 跳過並記錄警告  │
│  ├── fxFallbackBehavior = 'warn': 記錄警告        │
│  └── fxFallbackBehavior = 'error': 拋出錯誤       │
└─────────────────────────────────────────────────┘
```

### 11.3 降級策略

```
V3.1 降級路徑
      │
      ├── V3.1 處理失敗
      │   └── flags.fallbackToV3OnError = true
      │       └── 自動回退到 V3 單階段架構
      │
      ├── Stage 失敗但 continueOnStageFailure = true
      │   └── 使用空結果繼續後續階段
      │       ├── createEmptyStage1Result() → 空的公司識別結果
      │       └── createEmptyStage2Result() → 空的格式識別結果
      │
      ├── 配置解析失敗
      │   └── 使用 DEFAULT_EFFECTIVE_CONFIG 預設配置
      │
      └── 匯率轉換失敗
          └── 根據 fxFallbackBehavior 降級處理
```

### 11.4 可觀測性

每個步驟都記錄以下指標：

```typescript
interface StepResultV3 {
  step: ProcessingStepV3;     // 步驟名稱
  success: boolean;            // 是否成功
  data?: unknown;              // 步驟輸出資料
  durationMs: number;          // 執行時間（毫秒）
  error?: string;              // 錯誤訊息
  skipped?: boolean;           // 是否跳過
}
```

最終輸出包含：
- `timing.totalMs`: 總處理時間
- `timing.stepTimings`: 各步驟耗時
- `stepResults[]`: 所有步驟結果
- `warnings[]`: 警告訊息
- `stageAiDetails`: 各階段 AI 呼叫詳情（prompt、response、tokenUsage、model）

---

## 附錄：關鍵檔案索引

| 領域 | 檔案路徑 | 說明 |
|------|----------|------|
| V3 主服務 | `src/services/extraction-v3/extraction-v3.service.ts` | 提取管線入口 |
| V3 導出 | `src/services/extraction-v3/index.ts` | 統一導出（377 行） |
| 階段協調器 | `src/services/extraction-v3/stages/stage-orchestrator.service.ts` | 三階段協調 |
| Stage 1 | `src/services/extraction-v3/stages/stage-1-company.service.ts` | 公司識別 |
| Stage 2 | `src/services/extraction-v3/stages/stage-2-format.service.ts` | 格式識別 |
| Stage 3 | `src/services/extraction-v3/stages/stage-3-extraction.service.ts` | 欄位提取 |
| GPT 呼叫器 | `src/services/extraction-v3/stages/gpt-caller.service.ts` | 統一 GPT 呼叫 |
| 參考號碼匹配 | `src/services/extraction-v3/stages/reference-number-matcher.service.ts` | CHANGE-032 |
| 匯率轉換 | `src/services/extraction-v3/stages/exchange-rate-converter.service.ts` | CHANGE-032 |
| V3 信心度 | `src/services/extraction-v3/confidence-v3.service.ts` | 六維度 |
| V3.1 信心度 | `src/services/extraction-v3/confidence-v3-1.service.ts` | 五/六維度 |
| Prompt 組裝 | `src/services/extraction-v3/prompt-assembly.service.ts` | 動態 Prompt |
| Prompt 合併 | `src/services/extraction-v3/utils/prompt-merger.ts` | CHANGE-026 |
| 變數替換 | `src/services/extraction-v3/utils/variable-replacer.ts` | CHANGE-026 |
| PDF 轉換 | `src/services/extraction-v3/utils/pdf-converter.ts` | PDF→Base64 |
| 配置解析 | `src/services/mapping/config-resolver.ts` | 三層映射配置 |
| 映射引擎 | `src/services/mapping/field-mapping-engine.ts` | 欄位映射核心 |
| 動態映射 | `src/services/mapping/dynamic-mapping.service.ts` | 映射主入口 |
| Pipeline 配置 | `src/services/pipeline-config.service.ts` | GLOBAL/REGION/COMPANY |
| 術語分類 | `src/services/term-classification.service.ts` | Tier 3 LLM |
| 模板匹配 | `src/services/template-matching-engine.service.ts` | 範本自動匹配 |
| V3 類型 | `src/types/extraction-v3.types.ts` | 所有 V3/V3.1 類型 |
| 步驟常數 | `src/constants/processing-steps-v3.ts` | 步驟順序/超時/重試 |
| Prisma Schema | `prisma/schema.prisma` | 119 models, 112 enums |

---

> **文件結束**
> 本文件基於 2026-02-13 時點的原始碼靜態分析生成。
> 如有架構變更，請同步更新本文件。
