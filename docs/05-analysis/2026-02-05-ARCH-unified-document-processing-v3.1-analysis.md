# 統一文件處理系統架構分析報告 - V3.1 版本

> **分析日期**: 2026-02-05
> **分析版本**: V3.1 三階段分離架構
> **前置版本**: V3 單階段架構 (CHANGE-021)
> **關聯變更**: CHANGE-024 三階段提取架構重構
> **狀態**: ✅ Phase 5 完成（整合測試通過）

---

## 📋 執行摘要

本報告對 V3.1 統一文件處理系統進行全面的架構分析和實現狀態檢查。V3.1 版本將原 V3 的單次 GPT 調用重構為**三階段分離架構**，以更好地對應專案的**三層映射系統**設計理念。

### 關鍵發現

| 項目 | V3 | V3.1 | 改進 |
|------|----|----|------|
| **架構模式** | 單次 GPT-5.2 調用 | 三階段分離調用 | ✅ 對應三層映射 |
| **模型使用** | 全程 GPT-5.2 | S1/S2: nano, S3: 5.2 | ✅ 成本優化 |
| **處理步驟** | 7 步 | 7 步（內容不同） | ✅ 步驟優化 |
| **信心度維度** | 5 維度 | 5 維度（基於三階段） | ✅ 來源加成 |
| **可觀測性** | 單一 AI 詳情 | 每階段獨立詳情 | ✅ 問題定位 |
| **配置利用** | 部分利用 | 完整利用 | ✅ 精準提取 |

### 性能對比（實測數據 2026-02-01）

| 指標 | V3 | V3.1 | 變化 |
|------|----|----|------|
| 公司識別信心度 | ~88% | 90.7% | +2.7% |
| 格式識別信心度 | ~82% | 84.0% | +2.0% |
| 欄位提取信心度 | ~90% | 91.7% | +1.7% |
| 平均成本 | ~$0.025 | $0.0036 | **-86%** |
| 成功率 | 100% | 100% | 持平 |

---

## 1. 系統架構概覽

### 1.1 版本演進時間線

```
V2 (11 步 + Azure DI)
    │
    │ CHANGE-021 (2026-01-30)
    ▼
V3 (7 步純 GPT Vision)
    │
    │ CHANGE-024 (2026-02-01)
    ▼
V3.1 (三階段分離架構) ← 當前版本
    │
    │ CHANGE-025 (規劃中)
    ▼
V3.2 (智能路由 + 配置感知)
```

### 1.2 三層映射系統對應關係

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 三層映射系統 → 三階段提取架構對應                                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│ TIER 1: Universal Mapping（通用層）                                         │
│ ├─ Stage 2：統一格式配置（當沒有公司特定配置時）                            │
│ └─ Stage 3：GLOBAL 級 PromptConfig + 通用術語映射                           │
│                                                                              │
│ TIER 2: Company-Specific Override（公司特定覆蓋層）                          │
│ ├─ Stage 2：公司特定格式配置（優先使用）                                    │
│ └─ Stage 3：COMPANY/FORMAT 級 PromptConfig + 公司特定術語映射               │
│                                                                              │
│ TIER 3: LLM Classification（AI 智能分類）                                   │
│ ├─ Stage 1：公司識別（無配置匹配時由 LLM 推斷）                             │
│ ├─ Stage 2：格式識別（無配置時由 LLM 推斷並標記 isNewFormat）               │
│ └─ Stage 3：術語分類（無映射的術語由 LLM 智能分類）                         │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. V3.1 處理步驟詳細分析

### 2.1 處理步驟流程圖

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      V3.1 三階段分離架構（7 步）                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Step 1: FILE_PREPARATION（文件準備）                                        │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │ • PDF → Base64 圖片轉換                                              │  │
│  │ • 文件類型檢測（Native PDF / Scanned PDF / Image）                   │  │
│  │ • 頁數計算                                                           │  │
│  │ 📤 輸出: imageBase64Array[], pageCount, fileType                     │  │
│  │ ⏱️ 超時: 10 秒                                                       │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                      │                                       │
│                                      ▼                                       │
│  Step 2: STAGE_1_COMPANY_IDENTIFICATION（公司識別）                          │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │ • 輸入：圖片 + 已知公司列表（用於提示）                               │  │
│  │ • 模型：GPT-5-nano（成本低、速度快）                                 │  │
│  │ • 識別方法：LOGO → HEADER → ADDRESS → TAX_ID → LLM_INFERRED         │  │
│  │ 📤 輸出: companyId?, companyName, confidence, isNewCompany           │  │
│  │ ⏱️ 預估: ~10s, ~$0.0004                                              │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                      │                                       │
│                                      ▼                                       │
│  Step 3: STAGE_2_FORMAT_IDENTIFICATION（格式識別）                          │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │ • 輸入：圖片 + Stage 1 結果 + 公司格式配置（如有）                    │  │
│  │ • 模型：GPT-5-nano                                                   │  │
│  │                                                                      │  │
│  │ • 配置決策流程：                                                     │  │
│  │   ┌───────────────────────────────────────────────────────────────┐ │  │
│  │   │ 1. 查詢該公司的格式配置（DocumentFormat WHERE companyId = ?）  │ │  │
│  │   │    └─ 有配置 → 作為 input 提供給 LLM（縮小搜索範圍）          │ │  │
│  │   │    → configSource: 'COMPANY_SPECIFIC'                         │ │  │
│  │   │                                                               │ │  │
│  │   │ 2. 沒有公司特定配置 → 使用統一格式配置（如有）                 │ │  │
│  │   │    └─ 通用格式定義作為 fallback                               │ │  │
│  │   │    → configSource: 'UNIVERSAL'                                │ │  │
│  │   │                                                               │ │  │
│  │   │ 3. 都沒有 → LLM 自行判斷格式                                   │ │  │
│  │   │    └─ 標記 isNewFormat: true                                  │ │  │
│  │   │    → configSource: 'LLM_INFERRED'                             │ │  │
│  │   └───────────────────────────────────────────────────────────────┘ │  │
│  │                                                                      │  │
│  │ 📤 輸出: formatId?, formatName, confidence, isNewFormat, configSource│  │
│  │ ⏱️ 預估: ~10s, ~$0.0005                                              │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                      │                                       │
│                                      ▼                                       │
│  Step 4: STAGE_3_FIELD_EXTRACTION（欄位提取）                               │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │ • 輸入：圖片 + Stage 1&2 結果 + 完整配置                             │  │
│  │ • 模型：GPT-5.2（高精度、複雜任務）                                  │  │
│  │                                                                      │  │
│  │ • 配置組裝流程（基於 companyId + formatId）：                        │  │
│  │   ┌───────────────────────────────────────────────────────────────┐ │  │
│  │   │ 1. 查詢 PromptConfig (優先級: FORMAT > COMPANY > GLOBAL)       │ │  │
│  │   │ 2. 查詢 FieldMappingConfig (欄位定義 + 提取規則)               │ │  │
│  │   │ 3. 查詢 MappingRule (術語映射 Tier 1 + Tier 2)                 │ │  │
│  │   │ 4. 查詢 DocumentFormat.customFields (格式特定欄位)             │ │  │
│  │   └───────────────────────────────────────────────────────────────┘ │  │
│  │                                                                      │  │
│  │ 📤 輸出: standardFields, lineItems, extraCharges, customFields       │  │
│  │ ⏱️ 預估: ~6s, ~$0.0027                                               │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                      │                                       │
│                                      ▼                                       │
│  Step 5: TERM_RECORDING（術語記錄）                                         │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │ • 記錄新術語 (needsClassification: true)                             │  │
│  │ • 更新術語頻率統計                                                   │  │
│  │ • 識別同義詞候選（Levenshtein 距離）                                 │  │
│  │ 📤 輸出: termRecordingStats                                          │  │
│  │ ⏱️ 超時: 5 秒                                                        │  │
│  │ 🔄 優先級: OPTIONAL（失敗繼續）                                      │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                      │                                       │
│                                      ▼                                       │
│  Step 6: CONFIDENCE_CALCULATION（信心度計算）                               │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │ V3.1 信心度計算（5 維度，基於三階段結果）：                          │  │
│  │                                                                      │  │
│  │ 1. STAGE_1_COMPANY (20%)                                             │  │
│  │    └─ Stage 1 公司識別信心度                                        │  │
│  │                                                                      │  │
│  │ 2. STAGE_2_FORMAT (15%)                                              │  │
│  │    └─ Stage 2 格式識別信心度                                        │  │
│  │                                                                      │  │
│  │ 3. STAGE_3_EXTRACTION (30%)                                          │  │
│  │    └─ Stage 3 欄位提取信心度（GPT 自評）                            │  │
│  │                                                                      │  │
│  │ 4. FIELD_COMPLETENESS (20%)                                          │  │
│  │    └─ 必填欄位完整性                                                │  │
│  │       (filledRequiredFields / requiredFieldsCount)                  │  │
│  │                                                                      │  │
│  │ 5. CONFIG_SOURCE_BONUS (15%)                                         │  │
│  │    └─ 配置來源加成：                                                │  │
│  │       COMPANY_SPECIFIC: 100 分                                      │  │
│  │       UNIVERSAL: 80 分                                              │  │
│  │       LLM_INFERRED: 50 分                                           │  │
│  │                                                                      │  │
│  │ 計算: overallScore = Σ(rawScore[i] × weight[i])                     │  │
│  │                                                                      │  │
│  │ 信心度等級:                                                          │  │
│  │   ≥ 90% → HIGH                                                       │  │
│  │   70-89% → MEDIUM                                                    │  │
│  │   < 70% → LOW                                                        │  │
│  │                                                                      │  │
│  │ 📤 輸出: ConfidenceResultV3_1                                        │  │
│  │ ⏱️ 超時: 3 秒                                                        │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                      │                                       │
│                                      ▼                                       │
│  Step 7: ROUTING_DECISION（路由決策）                                       │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │ 根據信心度分數決策:                                                   │  │
│  │                                                                      │  │
│  │ 🟢 ≥ 90%   → AUTO_APPROVE（自動批准）                                │  │
│  │ 🟡 70-89%  → QUICK_REVIEW（快速審核）                                │  │
│  │ 🔴 < 70%   → FULL_REVIEW（完整審核）                                 │  │
│  │                                                                      │  │
│  │ V3.1 額外檢查:                                                       │  │
│  │ • 新公司 (isNewCompany) → 降級至 QUICK_REVIEW                       │  │
│  │ • 新格式 (isNewFormat) → 降級至 QUICK_REVIEW                        │  │
│  │ • LLM 推斷配置 → 降級至 QUICK_REVIEW                                │  │
│  │ • >3 項需分類 → 降級至 QUICK_REVIEW                                 │  │
│  │ • Stage 失敗 → FULL_REVIEW                                          │  │
│  │                                                                      │  │
│  │ 📤 輸出: RoutingDecisionV3_1 {decision, score, threshold, reasons[]}│  │
│  │ ⏱️ 超時: 2 秒                                                        │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  總計預估: ~26s, ~$0.0036                                                   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 步驟配置詳情

| 步驟 | 優先級 | 超時 | 重試 | 說明 |
|------|--------|------|------|------|
| FILE_PREPARATION | ⚠️ REQUIRED | 10s | 0 | 失敗中斷 |
| STAGE_1_COMPANY_IDENTIFICATION | ⚠️ REQUIRED | - | 2 | GPT-5-nano |
| STAGE_2_FORMAT_IDENTIFICATION | ⚠️ REQUIRED | - | 2 | GPT-5-nano |
| STAGE_3_FIELD_EXTRACTION | ⚠️ REQUIRED | - | 2 | GPT-5.2 |
| TERM_RECORDING | ❌ OPTIONAL | 5s | 0 | 失敗繼續 |
| CONFIDENCE_CALCULATION | ⚠️ REQUIRED | 3s | 0 | 失敗中斷 |
| ROUTING_DECISION | ⚠️ REQUIRED | 2s | 0 | 失敗中斷 |

---

## 3. 服務架構分析

### 3.1 目錄結構

```
src/services/extraction-v3/
├── index.ts                              # 統一導出
├── extraction-v3.service.ts              # 主服務（V3/V3.1 判斷）
├── unified-gpt-extraction.service.ts     # GPT 提取（V3 單階段）
├── confidence-v3.service.ts              # 信心度計算（V3）
├── confidence-v3-1.service.ts            # 信心度計算（V3.1）✅ 已實現
├── prompt-assembly.service.ts            # Prompt 組裝
├── result-validation.service.ts          # 結果驗證
│
├── stages/                               # V3.1 三階段服務 ✅ 已實現
│   ├── index.ts                          # 導出
│   ├── stage-1-company.service.ts        # Stage 1: 公司識別
│   ├── stage-2-format.service.ts         # Stage 2: 格式識別
│   ├── stage-3-extraction.service.ts     # Stage 3: 欄位提取
│   ├── stage-orchestrator.service.ts     # 三階段協調器
│   └── gpt-caller.service.ts             # 共用 GPT 調用
│
└── utils/
    ├── pdf-converter.ts                  # PDF 轉換
    └── prompt-builder.ts                 # Prompt 構建
```

### 3.2 關鍵服務職責

| 服務 | 職責 | 輸入 | 輸出 |
|------|------|------|------|
| **ExtractionV3Service** | V3/V3.1 切換與協調 | ExtractionV3Input | ExtractionV3Output |
| **StageOrchestratorService** | 三階段協調 | OrchestratorInput | ThreeStageResult |
| **Stage1CompanyService** | 公司識別 (GPT-5-nano) | Stage1Input | Stage1CompanyResult |
| **Stage2FormatService** | 格式識別 (GPT-5-nano) | Stage2Input | Stage2FormatResult |
| **Stage3ExtractionService** | 欄位提取 (GPT-5.2) | Stage3Input | Stage3ExtractionResult |
| **GptCallerService** | 統一 GPT 調用 | GptCallOptions | GptCallResult |
| **ConfidenceV3_1Service** | 信心度計算 | ConfidenceInputV3_1 | ConfidenceServiceResultV3_1 |

### 3.3 服務實現狀態

| 服務 | 文件 | 狀態 | 備註 |
|------|------|------|------|
| StageOrchestratorService | stage-orchestrator.service.ts | ✅ 已實現 | 478 行 |
| Stage1CompanyService | stage-1-company.service.ts | ✅ 已實現 | 含 JIT 創建 |
| Stage2FormatService | stage-2-format.service.ts | ✅ 已實現 | 含配置決策 |
| Stage3ExtractionService | stage-3-extraction.service.ts | ✅ 已實現 | 含配置組裝 |
| GptCallerService | gpt-caller.service.ts | ✅ 已實現 | 支援 nano/5.2 |
| ConfidenceV3_1Service | confidence-v3-1.service.ts | ✅ 已實現 | 618 行 |

---

## 4. 類型定義分析

### 4.1 核心類型結構

#### ProcessingStepV3_1 枚舉

```typescript
export enum ProcessingStepV3_1 {
  FILE_PREPARATION = 'FILE_PREPARATION',
  STAGE_1_COMPANY_IDENTIFICATION = 'STAGE_1_COMPANY_IDENTIFICATION',
  STAGE_2_FORMAT_IDENTIFICATION = 'STAGE_2_FORMAT_IDENTIFICATION',
  STAGE_3_FIELD_EXTRACTION = 'STAGE_3_FIELD_EXTRACTION',
  TERM_RECORDING = 'TERM_RECORDING',
  CONFIDENCE_CALCULATION = 'CONFIDENCE_CALCULATION',
  ROUTING_DECISION = 'ROUTING_DECISION',
}
```

#### 三階段結果類型

| 類型 | 關鍵欄位 | 說明 |
|------|---------|------|
| **Stage1CompanyResult** | companyId?, companyName, identificationMethod, confidence, isNewCompany | 公司識別 |
| **Stage2FormatResult** | formatId?, formatName, confidence, isNewFormat, configSource | 格式識別 |
| **Stage3ExtractionResult** | standardFields, lineItems, extraCharges, configUsed, tokenUsage | 欄位提取 |
| **StageAiDetails** | stage, model, prompt, response, tokenUsage, durationMs | AI 詳情 |

#### 信心度維度

```typescript
export enum ConfidenceDimensionV3_1 {
  STAGE_1_COMPANY = 'STAGE_1_COMPANY',           // 20%
  STAGE_2_FORMAT = 'STAGE_2_FORMAT',             // 15%
  STAGE_3_EXTRACTION = 'STAGE_3_EXTRACTION',     // 30%
  FIELD_COMPLETENESS = 'FIELD_COMPLETENESS',     // 20%
  CONFIG_SOURCE_BONUS = 'CONFIG_SOURCE_BONUS',   // 15%
}
```

#### 配置來源加成

```typescript
export const CONFIG_SOURCE_BONUS_SCORES: Record<FormatConfigSource, number> = {
  COMPANY_SPECIFIC: 100,  // 公司特定配置：滿分
  UNIVERSAL: 80,          // 統一配置：80 分
  LLM_INFERRED: 50,       // LLM 推斷：50 分
};
```

### 4.2 Feature Flags

```typescript
export interface ExtractionV3Flags {
  // V3 主開關
  useExtractionV3: boolean;
  extractionV3Percentage: number;
  fallbackToV2OnError: boolean;
  enableAzureDIFallback: boolean;

  // V3.1 三階段架構（CHANGE-024）
  useExtractionV3_1: boolean;              // ✅ 已實現
  extractionV3_1Percentage: number;        // ✅ 灰度百分比
  fallbackToV3OnError: boolean;            // ✅ 回退到 V3

  // 調試選項
  logPromptAssembly: boolean;
  logGptResponse: boolean;
}
```

---

## 5. 資料庫模式分析

### 5.1 ExtractionResult 表新增欄位

| 欄位 | 類型 | 說明 |
|------|------|------|
| extractionVersion | String? | 'v3' 或 'v3.1' |
| stage1Result | Json? | Stage 1 完整結果 |
| stage2Result | Json? | Stage 2 完整結果 |
| stage3Result | Json? | Stage 3 完整結果 |
| stage1AiDetails | Json? | Stage 1 AI 詳情 |
| stage2AiDetails | Json? | Stage 2 AI 詳情 |
| stage3AiDetails | Json? | Stage 3 AI 詳情 |
| stage1DurationMs | Int? | Stage 1 耗時 |
| stage2DurationMs | Int? | Stage 2 耗時 |
| stage3DurationMs | Int? | Stage 3 耗時 |
| stage2ConfigSource | String? | COMPANY_SPECIFIC / UNIVERSAL / LLM_INFERRED |
| stage3ConfigScope | String? | GLOBAL / COMPANY / FORMAT |

### 5.2 索引

```sql
CREATE INDEX idx_extraction_results_extraction_version
  ON extraction_results(extraction_version);
CREATE INDEX idx_extraction_results_stage_2_config_source
  ON extraction_results(stage_2_config_source);
```

---

## 6. API 集成分析

### 6.1 文件上傳端點

```
POST /api/documents/upload
```

| 參數 | 類型 | 說明 |
|------|------|------|
| files | File[] | 上傳文件 |
| cityCode | string | 城市代碼 |
| autoExtract | boolean? | 自動提取（預設 true） |
| processingVersion | 'v2' \| 'v3' \| 'auto'? | 處理版本 |

### 6.2 文件詳情端點

```
GET /api/documents/[id]?include=stageDetails
```

V3.1 響應新增欄位：
- `extractionVersion`: 'v3' | 'v3.1'
- `stageDetails`: { stage1, stage2, stage3 }（需 include=stageDetails）

---

## 7. 整合測試結果

### 7.1 測試摘要（2026-02-01）

| 測試案例 | 狀態 | 版本 | 耗時 |
|----------|------|------|------|
| V3.1 Three-Stage 100% | ✅ 通過 | v3.1 | 52.6s |
| V3.1 Fallback Test | ✅ 通過 | v3.1 | 43.3s |

**通過率**: 2/2 (100.0%)

### 7.2 三階段執行詳情

| Stage | 功能 | 結果 | 信心度 | 耗時 |
|-------|------|------|--------|------|
| Stage 1 | 公司識別 | CEVA Logistics Hong Kong Office | 92% | ~10s |
| Stage 2 | 格式識別 | Ceva Logistics Hong Kong Invoice Template | 82-92% | ~9s |
| Stage 3 | 欄位提取 | 5 標準欄位 | - | ~28s |

### 7.3 Token 使用量

| 階段 | 輸入 | 輸出 | 總計 |
|------|------|------|------|
| Stage 1 | ~600 | ~300 | ~900 |
| Stage 2 | ~800 | ~400 | ~1200 |
| Stage 3 | ~600 | ~2000 | ~2600 |
| **合計** | ~2000 | ~2700 | ~4700 |

### 7.4 已修復問題

| 問題 | 描述 | 解決方案 |
|------|------|---------|
| GPT-5-nano temperature | 不支援自定義 temperature | 設為 undefined |
| GPT-5-nano maxTokens | 1024 被 reasoning_tokens 消耗 | 增加到 2048 |

---

## 8. 待完成項目

### 8.1 已完成項目 ✅

- [x] 類型定義（ProcessingStepV3_1, Stage*Result）
- [x] Stage 1/2/3 服務實現
- [x] StageOrchestratorService 協調器
- [x] GptCallerService 統一調用
- [x] ConfidenceV3_1Service 信心度計算
- [x] 主服務整合（extraction-v3.service.ts）
- [x] API 端點更新
- [x] UI 更新（AiDetailsTab, ProcessingTimeline）
- [x] i18n 翻譯（en, zh-TW, zh-CN）
- [x] 資料庫遷移
- [x] 整合測試

### 8.2 待完成項目 ⏳

- [ ] E2E 測試（Playwright）
- [ ] Feature Flag 環境變數配置
- [ ] 灰度發布策略
- [ ] CHANGE-025 智能路由（配置來源感知）
- [ ] CHANGE-026 變數替換 + Prompt 合併
- [ ] 性能監控儀表板

---

## 9. 風險與建議

### 9.1 風險評估

| 風險 | 可能性 | 影響 | 緩解措施 |
|------|--------|------|---------|
| GPT-5-nano 準確率不足 | 中 | 高 | A/B 測試，可切換回 GPT-5.2 |
| 三次 API 調用延遲 | 中 | 中 | 並行優化 Stage 1&2 |
| 配置查詢增加負載 | 低 | 低 | 配置快取 |
| 向後兼容問題 | 低 | 高 | 版本檢測，保留 V3 |

### 9.2 建議

1. **短期**
   - 完成 E2E 測試覆蓋
   - 配置環境變數 Feature Flag
   - 開始 5% 灰度發布

2. **中期**
   - 實現 CHANGE-025 智能路由
   - 優化 Stage 1&2 並行執行
   - 建立配置快取機制

3. **長期**
   - 實現 CHANGE-026 動態 Prompt
   - 建立性能監控儀表板
   - 考慮 Stage 1&2 模型升級

---

## 10. 相關文檔

| 文檔 | 路徑 | 說明 |
|------|------|------|
| CHANGE-021 | `claudedocs/4-changes/feature-changes/CHANGE-021-*.md` | V3 純 GPT Vision |
| CHANGE-024 | `claudedocs/4-changes/feature-changes/CHANGE-024-*.md` | V3.1 三階段架構 |
| V3 類型定義 | `src/types/extraction-v3.types.ts` | ~1500 行 |
| 主服務 | `src/services/extraction-v3/extraction-v3.service.ts` | V3/V3.1 切換 |
| 協調器 | `src/services/extraction-v3/stages/stage-orchestrator.service.ts` | 三階段協調 |
| 信心度 V3.1 | `src/services/extraction-v3/confidence-v3-1.service.ts` | 5 維度計算 |
| 步驟常數 | `src/constants/processing-steps-v3.ts` | 步驟配置 |

---

**報告完成時間**: 2026-02-05
**分析深度**: 完整系統級別分析
**涵蓋範圍**: 架構、類型、服務、資料庫、API、測試、風險
