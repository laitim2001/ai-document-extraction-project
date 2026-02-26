# CHANGE-024: 三階段提取架構重構

> **建立日期**: 2026-02-01
> **完成日期**: 2026-02-01
> **狀態**: ✅ Phase 5 完成（整合測試通過）
> **優先級**: High
> **類型**: Major Architecture Refactoring
> **前置條件**: CHANGE-021 V3 純 GPT Vision 架構已完成
> **影響範圍**: extraction-v3 服務、配置系統、信心度計算

---

## 1. 變更概述

### 1.1 執行摘要

本變更將 extraction-v3 服務從當前的**一次性 Prompt 架構**重構為**三階段分離架構**，以更好地對應專案的**三層映射系統**設計理念。

根據 2026-02-01 的混合架構測試結果：

| 發票類型 | 公司識別 | 格式識別 | 欄位提取 | 總成本 | 節省 |
|----------|----------|----------|----------|--------|------|
| DHL | 88% ✅ | 85% ✅ | 93% ✅ | $0.0035 | 87% |
| CEVA | 92% ✅ | 85% ✅ | 92% ✅ | $0.0035 | 85% |
| NIPPON | 92% ✅ | 82% ✅ | 90% ✅ | $0.0038 | 86% |

**混合架構驗證結論**：

| 指標 | 平均值 | 評估 |
|------|--------|------|
| 公司識別信心度 | 90.7% | ✅ 優秀 |
| 格式識別信心度 | 84.0% | ✅ 良好 |
| 欄位提取信心度 | 91.7% | ✅ 優秀 |
| 平均成本 | $0.0036 | ✅ 節省 86% |
| 成功率 | 100% (9/9) | ✅ 完美 |

### 1.2 背景與動機

#### 1.2.1 當前 V3 架構的問題

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 當前 V3: 一次性 Prompt（錯誤實現）                                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Step 3: UNIFIED_GPT_EXTRACTION                                             │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │ 單次 GPT-5.2 Vision 調用嘗試完成所有任務：                            │  │
│  │                                                                      │  │
│  │  ❌ 問題 1: 公司識別沒有利用配置層級                                  │  │
│  │  ❌ 問題 2: 格式識別沒有根據公司結果縮小範圍                          │  │
│  │  ❌ 問題 3: 欄位提取 Prompt 無法針對特定格式優化                      │  │
│  │  ❌ 問題 4: Token 消耗高（一次傳入所有配置）                          │  │
│  │  ❌ 問題 5: 錯誤時無法定位是哪個階段出問題                            │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  實際測試問題：                                                              │
│  • Prompt Assembly 中 aliases, identifiers, patterns, keywords 都是空的     │
│  • 術語映射 (universalMappings, companyMappings) 返回空物件                 │
│  • 信心度計算從 7 維度簡化到 5 維度，缺少 Tier 層級加成                     │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### 1.2.2 三階段架構設計理念

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 新架構: 三階段分離（對應三層映射系統）                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │ Stage 1: COMPANY_IDENTIFICATION (GPT-5-nano)                           │ │
│  │ ────────────────────────────────────────────────────────────────────── │ │
│  │ • 輸入：文件圖片 + 已知公司列表（用於提示）                             │ │
│  │ • 模型：GPT-5-nano（成本低、速度快）                                   │ │
│  │ • 輸出：companyId, companyName, confidence, isNewCompany               │ │
│  │ • 預估：~9s, ~$0.0004                                                  │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                      │                                       │
│                                      ▼                                       │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │ Stage 2: FORMAT_IDENTIFICATION (GPT-5-nano)                            │ │
│  │ ────────────────────────────────────────────────────────────────────── │ │
│  │ • 輸入：文件圖片 + Stage 1 公司識別結果                                 │ │
│  │                                                                        │ │
│  │ • 配置決策流程：                                                       │ │
│  │   ┌───────────────────────────────────────────────────────────────┐   │ │
│  │   │ 1. 查詢該公司的格式配置（DocumentFormat WHERE companyId = ?）  │   │ │
│  │   │    └─ 有配置 → 作為 input 提供給 LLM（縮小搜索範圍）          │   │ │
│  │   │                                                                │   │ │
│  │   │ 2. 沒有公司特定配置 → 使用統一格式配置（如有）                 │   │ │
│  │   │    └─ 通用格式定義作為 fallback                               │   │ │
│  │   │                                                                │   │ │
│  │   │ 3. 都沒有 → LLM 自行判斷格式                                   │   │ │
│  │   │    └─ 標記 isNewFormat: true                                  │   │ │
│  │   └───────────────────────────────────────────────────────────────┘   │ │
│  │                                                                        │ │
│  │ • 模型：GPT-5-nano                                                    │ │
│  │ • 輸出：formatId, formatName, confidence, isNewFormat, configSource   │ │
│  │ • 預估：~10s, ~$0.0005                                                │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                      │                                       │
│                                      ▼                                       │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │ Stage 3: FIELD_EXTRACTION (GPT-5.2)                                    │ │
│  │ ────────────────────────────────────────────────────────────────────── │ │
│  │ • 輸入：文件圖片 + Stage 1&2 結果 + 配置記錄                           │ │
│  │                                                                        │ │
│  │ • 配置組裝流程（基於 companyId + formatId）：                          │ │
│  │   ┌───────────────────────────────────────────────────────────────┐   │ │
│  │   │ 1. 查詢 PromptConfig (優先級: FORMAT > COMPANY > GLOBAL)       │   │ │
│  │   │ 2. 查詢 FieldMappingConfig (欄位定義 + 提取規則)               │   │ │
│  │   │ 3. 查詢 MappingRule (術語映射 Tier 1 + Tier 2)                 │   │ │
│  │   │ 4. 查詢 DocumentFormat.customFields (格式特定欄位)             │   │ │
│  │   └───────────────────────────────────────────────────────────────┘   │ │
│  │                                                                        │ │
│  │ • 組裝完整的資料提取 Prompt：                                          │ │
│  │   ├─ System Prompt：格式特定的提取指引                                │ │
│  │   ├─ 欄位定義：標準欄位 + 自定義欄位                                  │ │
│  │   ├─ 術語映射：Tier 1 (通用) + Tier 2 (公司特定)                      │ │
│  │   └─ 輸出 Schema：JSON Schema 強制結構化輸出                          │ │
│  │                                                                        │ │
│  │ • 模型：GPT-5.2（高精度、複雜任務）                                   │ │
│  │ • 輸出：standardFields, lineItems, extraCharges, customFields          │ │
│  │ • 預估：~6s, ~$0.0027                                                  │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  總計：~25s, ~$0.0036（vs 當前 V3 一次性調用的複雜度和成本）                │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.3 與三層映射系統的對應關係

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

### 1.4 變更目標

| # | 目標 | 當前狀態 | 目標狀態 |
|---|------|---------|---------|
| 1 | **架構對齊** | 一次性 Prompt | 三階段分離，對應三層映射系統 |
| 2 | **配置利用** | 配置幾乎未使用 | 完整利用 PromptConfig、FieldMappingConfig |
| 3 | **成本優化** | 全程 GPT-5.2 | Stage 1&2 用 GPT-5-nano，Stage 3 用 GPT-5.2 |
| 4 | **錯誤定位** | 無法區分失敗階段 | 每階段獨立追蹤，清晰定位問題 |
| 5 | **可觀測性** | 單一 AI 詳情 | 每階段獨立 AI 詳情（Prompt、Response、Token） |
| 6 | **靈活性** | 固定流程 | 可選跳過 Stage 2（成本優化模式） |

---

## 2. 技術設計

### 2.1 新架構概覽

```
┌─────────────────────────────────────────────────────────────────────────────┐
│               Extraction V3.1 - 三階段分離架構                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  現有步驟保留（不變）：                                                       │
│  ├─ Step 1: FILE_PREPARATION (文件準備)                                     │
│  └─ Step 7: ROUTING_DECISION (路由決策)                                     │
│                                                                              │
│  步驟重構（核心變更）：                                                       │
│  ├─ Step 2: DYNAMIC_PROMPT_ASSEMBLY → 移除（分散到三階段）                   │
│  ├─ Step 3: UNIFIED_GPT_EXTRACTION → 拆分為 Stage 1, 2, 3                   │
│  ├─ Step 4: RESULT_VALIDATION → 整合到各 Stage                              │
│  ├─ Step 5: TERM_RECORDING → 移到 Stage 3 之後                              │
│  └─ Step 6: CONFIDENCE_CALCULATION → 基於三階段結果計算                      │
│                                                                              │
│  新步驟流程：                                                                 │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │ 1. FILE_PREPARATION                                                    │ │
│  │    └─ PDF → Base64 圖片轉換                                            │ │
│  ├────────────────────────────────────────────────────────────────────────┤ │
│  │ 2. STAGE_1_COMPANY_IDENTIFICATION                                      │ │
│  │    ├─ 輸入：圖片 + 已知公司列表                                        │ │
│  │    ├─ 模型：GPT-5-nano                                                 │ │
│  │    └─ 輸出：companyId, confidence, isNewCompany                        │ │
│  ├────────────────────────────────────────────────────────────────────────┤ │
│  │ 3. STAGE_2_FORMAT_IDENTIFICATION                                       │ │
│  │    ├─ 輸入：圖片 + Stage 1 結果 + 公司格式配置（如有）                  │ │
│  │    ├─ 模型：GPT-5-nano                                                 │ │
│  │    ├─ 配置決策：公司特定 → 統一格式 → LLM 推斷                         │ │
│  │    └─ 輸出：formatId, confidence, isNewFormat, configSource            │ │
│  ├────────────────────────────────────────────────────────────────────────┤ │
│  │ 4. STAGE_3_FIELD_EXTRACTION                                            │ │
│  │    ├─ 輸入：圖片 + Stage 1&2 結果 + 完整配置                           │ │
│  │    ├─ 配置：PromptConfig + FieldMappingConfig + MappingRule            │ │
│  │    ├─ 模型：GPT-5.2                                                    │ │
│  │    └─ 輸出：standardFields, lineItems, extraCharges, customFields      │ │
│  ├────────────────────────────────────────────────────────────────────────┤ │
│  │ 5. TERM_RECORDING (保留，移到 Stage 3 之後)                            │ │
│  │    └─ 記錄新術語、更新頻率統計                                         │ │
│  ├────────────────────────────────────────────────────────────────────────┤ │
│  │ 6. CONFIDENCE_CALCULATION (基於三階段結果)                             │ │
│  │    ├─ Stage 1 信心度 (20%)                                             │ │
│  │    ├─ Stage 2 信心度 (15%)                                             │ │
│  │    ├─ Stage 3 信心度 (30%)                                             │ │
│  │    ├─ 欄位完整性 (20%)                                                 │ │
│  │    └─ 配置匹配加成 (15%)                                               │ │
│  ├────────────────────────────────────────────────────────────────────────┤ │
│  │ 7. ROUTING_DECISION (保留)                                             │ │
│  │    └─ AUTO_APPROVE / QUICK_REVIEW / FULL_REVIEW                        │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 核心類型定義

#### 2.2.1 ProcessingStepV3.1 Enum

```typescript
// src/types/extraction-v3.types.ts (修改)

export enum ProcessingStepV3_1 {
  // 階段 1: 準備
  FILE_PREPARATION = 'FILE_PREPARATION',

  // 階段 2: 三階段提取（核心變更）
  STAGE_1_COMPANY_IDENTIFICATION = 'STAGE_1_COMPANY_IDENTIFICATION',
  STAGE_2_FORMAT_IDENTIFICATION = 'STAGE_2_FORMAT_IDENTIFICATION',
  STAGE_3_FIELD_EXTRACTION = 'STAGE_3_FIELD_EXTRACTION',

  // 階段 3: 後處理
  TERM_RECORDING = 'TERM_RECORDING',
  CONFIDENCE_CALCULATION = 'CONFIDENCE_CALCULATION',
  ROUTING_DECISION = 'ROUTING_DECISION',
}

// 步驟順序
export const PROCESSING_STEP_ORDER_V3_1 = [
  ProcessingStepV3_1.FILE_PREPARATION,
  ProcessingStepV3_1.STAGE_1_COMPANY_IDENTIFICATION,
  ProcessingStepV3_1.STAGE_2_FORMAT_IDENTIFICATION,
  ProcessingStepV3_1.STAGE_3_FIELD_EXTRACTION,
  ProcessingStepV3_1.TERM_RECORDING,
  ProcessingStepV3_1.CONFIDENCE_CALCULATION,
  ProcessingStepV3_1.ROUTING_DECISION,
] as const;
```

#### 2.2.2 三階段結果類型

```typescript
// src/types/extraction-v3.types.ts (新增)

/**
 * Stage 1: 公司識別結果
 */
export interface Stage1CompanyResult {
  stageName: 'STAGE_1_COMPANY_IDENTIFICATION';
  success: boolean;
  durationMs: number;

  // 識別結果
  companyId?: string;           // 已匹配的公司 ID
  companyName: string;          // 識別出的公司名稱
  identificationMethod: 'LOGO' | 'HEADER' | 'ADDRESS' | 'TAX_ID' | 'LLM_INFERRED';
  confidence: number;           // 0-100
  isNewCompany: boolean;        // 是否為新公司

  // AI 詳情
  aiDetails: StageAiDetails;

  // 錯誤資訊（如果失敗）
  error?: string;
}

/**
 * Stage 2: 格式識別結果
 */
export interface Stage2FormatResult {
  stageName: 'STAGE_2_FORMAT_IDENTIFICATION';
  success: boolean;
  durationMs: number;

  // 識別結果
  formatId?: string;            // 已匹配的格式 ID
  formatName: string;           // 識別出的格式名稱
  confidence: number;           // 0-100
  isNewFormat: boolean;         // 是否為新格式

  // 配置來源追蹤
  configSource: 'COMPANY_SPECIFIC' | 'UNIVERSAL' | 'LLM_INFERRED';
  configUsed?: {
    formatConfigId?: string;    // 使用的格式配置 ID
    companyConfigCount?: number; // 該公司有多少格式配置
  };

  // AI 詳情
  aiDetails: StageAiDetails;

  // 錯誤資訊
  error?: string;
}

/**
 * Stage 3: 欄位提取結果
 */
export interface Stage3ExtractionResult {
  stageName: 'STAGE_3_FIELD_EXTRACTION';
  success: boolean;
  durationMs: number;

  // 提取結果
  standardFields: StandardFieldsV3;
  customFields?: Record<string, FieldValue>;
  lineItems: LineItemV3[];
  extraCharges?: ExtraChargeV3[];
  overallConfidence: number;    // GPT 自評信心度

  // 配置來源追蹤
  configUsed: {
    promptConfigScope: 'GLOBAL' | 'COMPANY' | 'FORMAT';
    promptConfigId?: string;
    fieldMappingConfigId?: string;
    universalMappingsCount: number;
    companyMappingsCount: number;
  };

  // Token 使用
  tokenUsage: {
    input: number;
    output: number;
    total: number;
  };

  // AI 詳情
  aiDetails: StageAiDetails;

  // 錯誤資訊
  error?: string;
}

/**
 * 階段 AI 詳情
 */
export interface StageAiDetails {
  stage: 'STAGE_1' | 'STAGE_2' | 'STAGE_3';
  model: string;                // 使用的模型
  prompt: string;               // 完整 Prompt
  response: string;             // 原始響應
  tokenUsage: {
    input: number;
    output: number;
    total: number;
  };
  imageDetailMode?: 'auto' | 'low' | 'high';
  durationMs: number;
}
```

#### 2.2.3 更新的信心度計算

```typescript
// src/types/extraction-v3.types.ts (修改)

/**
 * V3.1 信心度維度（基於三階段）
 */
export enum ConfidenceDimensionV3_1 {
  STAGE_1_COMPANY = 'STAGE_1_COMPANY',           // 公司識別信心度
  STAGE_2_FORMAT = 'STAGE_2_FORMAT',             // 格式識別信心度
  STAGE_3_EXTRACTION = 'STAGE_3_EXTRACTION',     // 欄位提取信心度
  FIELD_COMPLETENESS = 'FIELD_COMPLETENESS',     // 欄位完整性
  CONFIG_SOURCE_BONUS = 'CONFIG_SOURCE_BONUS',   // 配置來源加成
}

/**
 * V3.1 信心度權重
 */
export const CONFIDENCE_WEIGHTS_V3_1 = {
  [ConfidenceDimensionV3_1.STAGE_1_COMPANY]: 0.20,
  [ConfidenceDimensionV3_1.STAGE_2_FORMAT]: 0.15,
  [ConfidenceDimensionV3_1.STAGE_3_EXTRACTION]: 0.30,
  [ConfidenceDimensionV3_1.FIELD_COMPLETENESS]: 0.20,
  [ConfidenceDimensionV3_1.CONFIG_SOURCE_BONUS]: 0.15,
} as const;

/**
 * 配置來源加成規則
 */
export const CONFIG_SOURCE_BONUS = {
  'COMPANY_SPECIFIC': 100,     // 公司特定配置：滿分加成
  'UNIVERSAL': 80,             // 統一配置：80 分
  'LLM_INFERRED': 50,          // LLM 推斷：50 分
} as const;
```

### 2.3 服務目錄結構

```
src/services/extraction-v3/
├── index.ts                              # 服務導出
├── extraction-v3.service.ts              # 主服務（管線協調）
│
├── stages/                               # 🆕 三階段服務
│   ├── index.ts
│   ├── stage-1-company.service.ts        # Stage 1: 公司識別
│   ├── stage-2-format.service.ts         # Stage 2: 格式識別
│   ├── stage-3-extraction.service.ts     # Stage 3: 欄位提取
│   └── stage-orchestrator.service.ts     # 階段協調器
│
├── prompt-assembly.service.ts            # Prompt 組裝（重構）
├── unified-gpt-extraction.service.ts     # GPT 調用（支援多模型）
├── result-validation.service.ts          # 結果驗證（整合到各階段）
├── confidence-v3.service.ts              # 信心度計算（更新）
│
└── utils/
    ├── pdf-converter.ts
    └── prompt-builder.ts
```

### 2.4 各階段服務設計

#### 2.4.1 Stage 1: 公司識別服務

```typescript
// src/services/extraction-v3/stages/stage-1-company.service.ts

/**
 * @fileoverview Stage 1 - 公司識別服務
 *
 * @description
 *   使用 GPT-5-nano 識別文件發行公司
 *   輸入：文件圖片 + 已知公司列表
 *   輸出：companyId, companyName, confidence
 */

export interface Stage1Input {
  imageBase64Array: string[];
  knownCompanies: KnownCompanyForPrompt[];
  options?: {
    autoCreateCompany?: boolean;
  };
}

export class Stage1CompanyService {
  private gptService: UnifiedGptExtractionService;

  /**
   * 執行公司識別
   */
  async execute(input: Stage1Input): Promise<Stage1CompanyResult> {
    const startTime = Date.now();

    try {
      // 1. 組裝公司識別 Prompt
      const prompt = this.buildCompanyIdentificationPrompt(input.knownCompanies);

      // 2. 調用 GPT-5-nano
      const result = await this.gptService.extract({
        model: 'gpt-5-nano',  // 使用輕量級模型
        systemPrompt: prompt.system,
        userPrompt: prompt.user,
        images: input.imageBase64Array,
        imageDetailMode: 'low',  // 公司識別不需要高解析度
      });

      // 3. 解析結果
      const parsed = this.parseCompanyResult(result);

      // 4. 驗證並解析公司 ID
      const resolved = await this.resolveCompanyId(parsed, input.options);

      return {
        stageName: 'STAGE_1_COMPANY_IDENTIFICATION',
        success: true,
        durationMs: Date.now() - startTime,
        companyId: resolved.companyId,
        companyName: resolved.companyName,
        identificationMethod: parsed.identificationMethod,
        confidence: parsed.confidence,
        isNewCompany: resolved.isNewCompany,
        aiDetails: this.buildAiDetails(result, 'STAGE_1'),
      };
    } catch (error) {
      return {
        stageName: 'STAGE_1_COMPANY_IDENTIFICATION',
        success: false,
        durationMs: Date.now() - startTime,
        companyName: '',
        identificationMethod: 'LLM_INFERRED',
        confidence: 0,
        isNewCompany: false,
        aiDetails: {} as StageAiDetails,
        error: error.message,
      };
    }
  }

  /**
   * 組裝公司識別 Prompt
   */
  private buildCompanyIdentificationPrompt(
    knownCompanies: KnownCompanyForPrompt[]
  ): { system: string; user: string } {
    const companyList = knownCompanies.map(c =>
      `- ${c.name}${c.aliases?.length ? ` (別名: ${c.aliases.join(', ')})` : ''}`
    ).join('\n');

    return {
      system: `You are an invoice issuer identification specialist.
Your task is to identify the company that issued this invoice.

Known companies:
${companyList || '(No known companies - identify from document)'}

Identification methods (in priority order):
1. LOGO - Company logo on the document
2. HEADER - Company name in header/letterhead
3. ADDRESS - Company address information
4. TAX_ID - Tax identification number

Response format (JSON):
{
  "companyName": "string - identified company name",
  "identificationMethod": "LOGO" | "HEADER" | "ADDRESS" | "TAX_ID",
  "confidence": number (0-100),
  "matchedKnownCompany": "string | null - if matched to known company"
}`,
      user: 'Identify the issuing company from this invoice image.',
    };
  }
}
```

#### 2.4.2 Stage 2: 格式識別服務

```typescript
// src/services/extraction-v3/stages/stage-2-format.service.ts

/**
 * @fileoverview Stage 2 - 格式識別服務
 *
 * @description
 *   使用 GPT-5-nano 識別文件格式
 *   配置決策流程：公司特定 → 統一格式 → LLM 推斷
 */

export interface Stage2Input {
  imageBase64Array: string[];
  stage1Result: Stage1CompanyResult;
}

export class Stage2FormatService {
  private gptService: UnifiedGptExtractionService;
  private prisma: PrismaClient;

  /**
   * 執行格式識別
   */
  async execute(input: Stage2Input): Promise<Stage2FormatResult> {
    const startTime = Date.now();
    const { stage1Result } = input;

    try {
      // 1. 根據公司查詢格式配置
      const formatConfig = await this.loadFormatConfig(stage1Result.companyId);

      // 2. 組裝格式識別 Prompt（根據配置來源不同）
      const prompt = this.buildFormatIdentificationPrompt(formatConfig);

      // 3. 調用 GPT-5-nano
      const result = await this.gptService.extract({
        model: 'gpt-5-nano',
        systemPrompt: prompt.system,
        userPrompt: prompt.user,
        images: input.imageBase64Array,
        imageDetailMode: 'low',
      });

      // 4. 解析結果
      const parsed = this.parseFormatResult(result);

      // 5. 驗證並解析格式 ID
      const resolved = await this.resolveFormatId(parsed, stage1Result.companyId);

      return {
        stageName: 'STAGE_2_FORMAT_IDENTIFICATION',
        success: true,
        durationMs: Date.now() - startTime,
        formatId: resolved.formatId,
        formatName: resolved.formatName,
        confidence: parsed.confidence,
        isNewFormat: resolved.isNewFormat,
        configSource: formatConfig.source,
        configUsed: {
          formatConfigId: formatConfig.usedConfigId,
          companyConfigCount: formatConfig.companyFormatCount,
        },
        aiDetails: this.buildAiDetails(result, 'STAGE_2'),
      };
    } catch (error) {
      return {
        stageName: 'STAGE_2_FORMAT_IDENTIFICATION',
        success: false,
        durationMs: Date.now() - startTime,
        formatName: '',
        confidence: 0,
        isNewFormat: false,
        configSource: 'LLM_INFERRED',
        aiDetails: {} as StageAiDetails,
        error: error.message,
      };
    }
  }

  /**
   * 載入格式配置（核心決策流程）
   */
  private async loadFormatConfig(companyId?: string): Promise<{
    source: 'COMPANY_SPECIFIC' | 'UNIVERSAL' | 'LLM_INFERRED';
    formats: FormatPatternForPrompt[];
    usedConfigId?: string;
    companyFormatCount?: number;
  }> {
    // 1. 嘗試載入公司特定格式配置
    if (companyId) {
      const companyFormats = await this.prisma.documentFormat.findMany({
        where: { companyId, deletedAt: null },
        select: {
          id: true,
          name: true,
          documentType: true,
          documentSubtype: true,
          features: true,
          commonTerms: true,
          identificationRules: true,
        },
      });

      if (companyFormats.length > 0) {
        return {
          source: 'COMPANY_SPECIFIC',
          formats: companyFormats.map(this.toFormatPattern),
          companyFormatCount: companyFormats.length,
        };
      }
    }

    // 2. 沒有公司特定配置 → 使用統一格式配置
    const universalFormats = await this.prisma.documentFormat.findMany({
      where: { companyId: null, deletedAt: null },
      select: {
        id: true,
        name: true,
        documentType: true,
        documentSubtype: true,
        features: true,
        commonTerms: true,
        identificationRules: true,
      },
    });

    if (universalFormats.length > 0) {
      return {
        source: 'UNIVERSAL',
        formats: universalFormats.map(this.toFormatPattern),
      };
    }

    // 3. 都沒有 → LLM 自行判斷
    return {
      source: 'LLM_INFERRED',
      formats: [],
    };
  }

  /**
   * 組裝格式識別 Prompt
   */
  private buildFormatIdentificationPrompt(config: {
    source: string;
    formats: FormatPatternForPrompt[];
  }): { system: string; user: string } {
    const hasKnownFormats = config.formats.length > 0;

    const formatList = config.formats.map(f =>
      `- ${f.formatName}: ${f.patterns?.join(', ') || 'No patterns'}`
    ).join('\n');

    return {
      system: `You are an invoice format identification specialist.
Your task is to identify the format/template of this invoice.

${hasKnownFormats ? `Known formats (${config.source}):\n${formatList}` : 'No known formats - identify format characteristics from document.'}

Response format (JSON):
{
  "formatName": "string - identified format name",
  "confidence": number (0-100),
  "matchedKnownFormat": "string | null - if matched to known format",
  "formatCharacteristics": ["array of observed format characteristics"]
}`,
      user: 'Identify the format/template of this invoice image.',
    };
  }
}
```

#### 2.4.3 Stage 3: 欄位提取服務

```typescript
// src/services/extraction-v3/stages/stage-3-extraction.service.ts

/**
 * @fileoverview Stage 3 - 欄位提取服務
 *
 * @description
 *   使用 GPT-5.2 進行精準欄位提取
 *   基於 Stage 1&2 結果查詢配置，組裝完整的提取 Prompt
 */

export interface Stage3Input {
  imageBase64Array: string[];
  stage1Result: Stage1CompanyResult;
  stage2Result: Stage2FormatResult;
}

export class Stage3ExtractionService {
  private gptService: UnifiedGptExtractionService;
  private prisma: PrismaClient;

  /**
   * 執行欄位提取
   */
  async execute(input: Stage3Input): Promise<Stage3ExtractionResult> {
    const startTime = Date.now();
    const { stage1Result, stage2Result } = input;

    try {
      // 1. 基於 Stage 1&2 結果載入完整配置
      const config = await this.loadExtractionConfig(
        stage1Result.companyId,
        stage2Result.formatId
      );

      // 2. 組裝完整的提取 Prompt
      const prompt = this.buildExtractionPrompt(config);

      // 3. 調用 GPT-5.2（精準提取）
      const result = await this.gptService.extract({
        model: 'gpt-5.2',  // 使用高精度模型
        systemPrompt: prompt.system,
        userPrompt: prompt.user,
        images: input.imageBase64Array,
        imageDetailMode: config.imageDetailMode || 'auto',
        outputSchema: config.outputSchema,
      });

      // 4. 解析和驗證結果
      const parsed = this.parseExtractionResult(result);

      return {
        stageName: 'STAGE_3_FIELD_EXTRACTION',
        success: true,
        durationMs: Date.now() - startTime,
        standardFields: parsed.standardFields,
        customFields: parsed.customFields,
        lineItems: parsed.lineItems,
        extraCharges: parsed.extraCharges,
        overallConfidence: parsed.overallConfidence,
        configUsed: {
          promptConfigScope: config.promptConfigScope,
          promptConfigId: config.promptConfigId,
          fieldMappingConfigId: config.fieldMappingConfigId,
          universalMappingsCount: config.universalMappingsCount,
          companyMappingsCount: config.companyMappingsCount,
        },
        tokenUsage: result.tokenUsage,
        aiDetails: this.buildAiDetails(result, 'STAGE_3'),
      };
    } catch (error) {
      return {
        stageName: 'STAGE_3_FIELD_EXTRACTION',
        success: false,
        durationMs: Date.now() - startTime,
        standardFields: {} as StandardFieldsV3,
        lineItems: [],
        overallConfidence: 0,
        configUsed: {} as any,
        tokenUsage: { input: 0, output: 0, total: 0 },
        aiDetails: {} as StageAiDetails,
        error: error.message,
      };
    }
  }

  /**
   * 載入提取配置（完整配置組裝）
   */
  private async loadExtractionConfig(
    companyId?: string,
    formatId?: string
  ): Promise<ExtractionConfig> {
    // 1. 載入 PromptConfig（優先級: FORMAT > COMPANY > GLOBAL）
    const promptConfig = await this.loadPromptConfigHierarchical(companyId, formatId);

    // 2. 載入 FieldMappingConfig
    const fieldMappingConfig = await this.loadFieldMappingConfig(companyId, formatId);

    // 3. 載入術語映射（Tier 1 + Tier 2）
    const universalMappings = await this.loadTier1Mappings();
    const companyMappings = companyId
      ? await this.loadTier2Mappings(companyId)
      : {};

    // 4. 載入格式特定欄位定義
    const customFields = formatId
      ? await this.loadFormatCustomFields(formatId)
      : [];

    // 5. 生成 JSON Schema
    const outputSchema = this.generateOutputSchema(
      fieldMappingConfig.standardFields,
      customFields
    );

    return {
      promptConfigScope: promptConfig.scope,
      promptConfigId: promptConfig.id,
      systemPrompt: promptConfig.systemPrompt,
      userPromptTemplate: promptConfig.userPromptTemplate,
      fieldMappingConfigId: fieldMappingConfig.id,
      standardFields: fieldMappingConfig.standardFields,
      customFields,
      universalMappings,
      companyMappings,
      universalMappingsCount: Object.keys(universalMappings).length,
      companyMappingsCount: Object.keys(companyMappings).length,
      outputSchema,
      imageDetailMode: promptConfig.imageDetailMode,
    };
  }

  /**
   * 分層載入 PromptConfig
   */
  private async loadPromptConfigHierarchical(
    companyId?: string,
    formatId?: string
  ): Promise<PromptConfigResult> {
    // 1. 嘗試 FORMAT 級配置
    if (formatId && companyId) {
      const formatConfig = await this.prisma.promptConfig.findFirst({
        where: {
          scope: 'FORMAT',
          documentFormatId: formatId,
          companyId,
          isActive: true,
        },
      });
      if (formatConfig) return { ...formatConfig, scope: 'FORMAT' };
    }

    // 2. 嘗試 COMPANY 級配置
    if (companyId) {
      const companyConfig = await this.prisma.promptConfig.findFirst({
        where: {
          scope: 'COMPANY',
          companyId,
          isActive: true,
        },
      });
      if (companyConfig) return { ...companyConfig, scope: 'COMPANY' };
    }

    // 3. 使用 GLOBAL 級配置
    const globalConfig = await this.prisma.promptConfig.findFirst({
      where: {
        scope: 'GLOBAL',
        isActive: true,
      },
    });

    if (!globalConfig) {
      throw new Error('No active GLOBAL PromptConfig found');
    }

    return { ...globalConfig, scope: 'GLOBAL' };
  }
}
```

### 2.5 資料庫變更

```sql
-- 新增階段結果欄位到 ExtractionResult
-- prisma/migrations/xxx_add_stage_results.sql

ALTER TABLE extraction_results ADD COLUMN stage_1_result JSONB;
ALTER TABLE extraction_results ADD COLUMN stage_2_result JSONB;
ALTER TABLE extraction_results ADD COLUMN stage_3_result JSONB;

ALTER TABLE extraction_results ADD COLUMN stage_1_duration_ms INTEGER;
ALTER TABLE extraction_results ADD COLUMN stage_2_duration_ms INTEGER;
ALTER TABLE extraction_results ADD COLUMN stage_3_duration_ms INTEGER;

-- 每階段 AI 詳情
ALTER TABLE extraction_results ADD COLUMN stage_1_ai_details JSONB;
ALTER TABLE extraction_results ADD COLUMN stage_2_ai_details JSONB;
ALTER TABLE extraction_results ADD COLUMN stage_3_ai_details JSONB;

-- 配置來源追蹤
ALTER TABLE extraction_results ADD COLUMN stage_2_config_source VARCHAR(50);
ALTER TABLE extraction_results ADD COLUMN stage_3_config_scope VARCHAR(50);

-- 索引
CREATE INDEX idx_extraction_results_stage_2_config_source
  ON extraction_results(stage_2_config_source);
```

---

## 3. 影響範圍評估

### 3.1 文件影響清單

#### 3.1.1 新增文件

| 文件路徑 | 說明 | 優先級 |
|----------|------|--------|
| `src/services/extraction-v3/stages/index.ts` | 階段服務導出 | 🔴 高 |
| `src/services/extraction-v3/stages/stage-1-company.service.ts` | Stage 1 服務 | 🔴 高 |
| `src/services/extraction-v3/stages/stage-2-format.service.ts` | Stage 2 服務 | 🔴 高 |
| `src/services/extraction-v3/stages/stage-3-extraction.service.ts` | Stage 3 服務 | 🔴 高 |
| `src/services/extraction-v3/stages/stage-orchestrator.service.ts` | 階段協調器 | 🔴 高 |

#### 3.1.2 修改文件

| 文件路徑 | 影響程度 | 修改說明 |
|----------|----------|----------|
| `src/types/extraction-v3.types.ts` | 🔴 高 | 新增三階段類型定義 |
| `src/services/extraction-v3/extraction-v3.service.ts` | 🔴 高 | 重構為三階段管線 |
| `src/services/extraction-v3/unified-gpt-extraction.service.ts` | 🟡 中 | 支援多模型切換 |
| `src/services/extraction-v3/prompt-assembly.service.ts` | 🟡 中 | 分離為三階段組裝 |
| `src/services/extraction-v3/confidence-v3.service.ts` | 🟡 中 | 基於三階段計算 |
| `src/services/processing-result-persistence.service.ts` | 🟡 中 | 存儲階段結果 |
| `prisma/schema.prisma` | 🟡 中 | 新增階段結果欄位 |
| `src/app/api/documents/[id]/route.ts` | 🟢 低 | 返回階段詳情 |
| `messages/{locale}/invoices.json` | 🟢 低 | 階段相關翻譯 |

#### 3.1.3 UI 影響

| 組件/頁面 | 影響程度 | 說明 |
|-----------|----------|------|
| `ProcessingTimeline.tsx` | 🟡 中 | 新增三階段步驟顯示 |
| `AiDetailsTab.tsx` | 🟡 中 | 顯示每階段 AI 詳情 |
| `ConfidenceBreakdown.tsx` | 🟡 中 | 更新維度顯示 |

### 3.2 向後兼容策略

```typescript
// 版本檢測邏輯
function detectExtractionVersion(steps: ProcessingStep[]): 'v3' | 'v3.1' {
  const stepNames = steps.map(s => s.step);

  // V3.1 特有步驟
  if (stepNames.includes('STAGE_1_COMPANY_IDENTIFICATION') ||
      stepNames.includes('STAGE_2_FORMAT_IDENTIFICATION') ||
      stepNames.includes('STAGE_3_FIELD_EXTRACTION')) {
    return 'v3.1';
  }

  // V3 特有步驟
  if (stepNames.includes('UNIFIED_GPT_EXTRACTION')) {
    return 'v3';
  }

  return 'v3'; // 預設
}
```

---

## 4. 實施計畫

### 4.1 階段概覽

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              實施階段時間線                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Phase 1                 Phase 2                 Phase 3                     │
│  類型和骨架              三階段服務實現          整合和測試                   │
│  ──────────             ───────────────         ──────────                   │
│  預計: 1 天              預計: 2-3 天            預計: 1-2 天                 │
│                                                                              │
│  • 類型定義              • Stage 1 服務          • 整合到主服務               │
│  • 步驟常數              • Stage 2 服務          • 結果持久化                 │
│  • 服務骨架              • Stage 3 服務          • API 更新                   │
│                          • 階段協調器            • E2E 測試                   │
│                                                                              │
│                                    │                                         │
│                                    ▼                                         │
│                              Phase 4                                         │
│                              UI 更新和發布                                    │
│                              ─────────────                                   │
│                              預計: 1 天                                       │
│                                                                              │
│                              • ProcessingTimeline 更新                       │
│                              • AiDetailsTab 更新                             │
│                              • i18n 翻譯                                     │
│                              • Feature Flag 灰度發布                         │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 4.2 Phase 1: 類型和骨架 (1 天)

| # | 任務 | 文件 | 估計時間 |
|---|------|------|---------|
| 1.1 | 新增三階段類型定義 | `src/types/extraction-v3.types.ts` | 2h |
| 1.2 | 新增步驟常數 | `src/constants/processing-steps-v3.ts` | 1h |
| 1.3 | 建立服務目錄結構 | `src/services/extraction-v3/stages/` | 1h |
| 1.4 | 建立服務骨架和介面 | `stages/*.service.ts` | 2h |

### 4.3 Phase 2: 三階段服務實現 (2-3 天)

| # | 任務 | 文件 | 估計時間 | 依賴 |
|---|------|------|---------|------|
| 2.1 | 實現 Stage 1 公司識別 | `stage-1-company.service.ts` | 4h | Phase 1 |
| 2.2 | 實現 Stage 2 格式識別 | `stage-2-format.service.ts` | 6h | 2.1 |
| 2.3 | 實現 Stage 3 欄位提取 | `stage-3-extraction.service.ts` | 6h | 2.2 |
| 2.4 | 實現階段協調器 | `stage-orchestrator.service.ts` | 3h | 2.1-2.3 |
| 2.5 | 更新 GPT 調用服務 | `unified-gpt-extraction.service.ts` | 2h | - |

### 4.4 Phase 3: 整合和測試 (1-2 天)

| # | 任務 | 文件 | 估計時間 | 依賴 |
|---|------|------|---------|------|
| 3.1 | 整合到主服務 | `extraction-v3.service.ts` | 4h | Phase 2 |
| 3.2 | 更新信心度計算 | `confidence-v3.service.ts` | 2h | 3.1 |
| 3.3 | 更新結果持久化 | `processing-result-persistence.service.ts` | 2h | 3.1 |
| 3.4 | 資料庫遷移 | `prisma/` | 1h | - |
| 3.5 | 更新 API 端點 | `src/app/api/documents/[id]/route.ts` | 1h | 3.3 |
| 3.6 | 單元測試 | `tests/` | 4h | 3.1-3.5 |
| 3.7 | 整合測試 | `tests/integration/` | 3h | 3.6 |

### 4.5 Phase 4: UI 更新和發布 (1 天)

| # | 任務 | 文件 | 估計時間 | 依賴 |
|---|------|------|---------|------|
| 4.1 | 更新 ProcessingTimeline | `ProcessingTimeline.tsx` | 2h | Phase 3 |
| 4.2 | 更新 AiDetailsTab | `AiDetailsTab.tsx` | 2h | Phase 3 |
| 4.3 | 更新 ConfidenceBreakdown | `ConfidenceBreakdown.tsx` | 1h | Phase 3 |
| 4.4 | i18n 翻譯更新 | `messages/*/invoices.json` | 1h | 4.1-4.3 |
| 4.5 | Feature Flag 配置 | `feature-flags.ts` | 0.5h | - |
| 4.6 | E2E 測試 | Playwright | 2h | 4.1-4.4 |

---

## 5. 風險評估

### 5.1 風險矩陣

| # | 風險 | 可能性 | 影響 | 風險等級 | 緩解措施 |
|---|------|--------|------|---------|----------|
| R1 | GPT-5-nano 準確率不足 | 中 | 高 | 🟡 中 | A/B 測試驗證，可切換回 GPT-5.2 |
| R2 | 三次 API 調用延遲累積 | 中 | 中 | 🟡 中 | 並行優化，Stage 1&2 可並行 |
| R3 | 配置查詢增加資料庫負載 | 低 | 低 | 🟢 低 | 快取配置，減少查詢次數 |
| R4 | 向後兼容問題 | 低 | 高 | 🟡 中 | 版本檢測，保留 V3 代碼 |
| R5 | 階段間數據傳遞錯誤 | 低 | 中 | 🟢 低 | 類型檢查，驗證層 |

### 5.2 回滾計劃

```bash
# 立即回滾（Feature Flag）
EXTRACTION_V3_1_ENABLED=false

# 驗證回滾
curl /api/health/extraction
# 應返回: { "version": "v3", "status": "healthy" }
```

---

## 6. 驗收標準

### 6.1 功能驗收

| # | 驗收項目 | 驗收標準 | 優先級 |
|---|----------|---------|--------|
| F1 | Stage 1 公司識別 | 準確率 ≥ 90%，單次 ≤ 10s | P0 |
| F2 | Stage 2 格式識別 | 準確率 ≥ 85%，配置決策正確 | P0 |
| F3 | Stage 3 欄位提取 | 準確率 ≥ 92%，利用完整配置 | P0 |
| F4 | 配置來源追蹤 | 正確記錄 COMPANY_SPECIFIC/UNIVERSAL/LLM_INFERRED | P1 |
| F5 | 每階段 AI 詳情 | Prompt、Response、Token 完整記錄 | P1 |
| F6 | 信心度計算 | 5 維度正確計算，含配置加成 | P0 |

### 6.2 效能驗收

| # | 驗收項目 | 驗收標準 | 優先級 |
|---|----------|---------|--------|
| P1 | 總處理時間 | ≤ 30s（3 次 API 調用） | P0 |
| P2 | Token 消耗 | ≤ $0.004/份（對比當前節省 80%+） | P1 |
| P3 | 並發處理 | 5 並發無顯著性能下降 | P1 |

---

## 7. 相關文件

### 7.1 前置文件

| 文件 | 說明 |
|------|------|
| `CHANGE-021-unified-processor-v3-pure-gpt-vision.md` | V3 純 GPT Vision 架構 |
| `CHANGE-022-v3-ui-update-plan.md` | V3 UI 更新計劃 |
| `CHANGE-023-ai-details-tab.md` | AI 詳情 Tab |

### 7.2 參考文件

| 文件 | 說明 |
|------|------|
| `CLAUDE.md` | 三層映射系統設計理念 |
| `docs/02-architecture/` | 系統架構設計 |

---

## 8. 待決事項

| # | 事項 | 狀態 | 優先級 | 預計決策時間 |
|---|------|------|--------|-------------|
| 1 | 確認 Stage 1&2 是否可並行執行 | ⏳ 待確認 | P1 | Phase 2 開始前 |
| 2 | 確認 GPT-5-nano 的可用性和定價 | ⏳ 待確認 | P0 | Phase 1 開始前 |
| 3 | 確認配置快取策略（TTL、失效條件） | ⏳ 待設計 | P1 | Phase 2 實作時 |
| 4 | 確認 Stage 3 的 imageDetailMode 預設值 | ⏳ 待確認 | P2 | Phase 2 實作時 |

---

**文檔建立日期**: 2026-02-01
**作者**: AI Assistant (Claude)
**版本**: 1.6.0
**狀態**: ✅ Phase 5 完成（主服務整合完成）

### 更新記錄

| 版本 | 日期 | 變更內容 |
|------|------|---------|
| 1.0.0 | 2026-02-01 | 初始版本 - 完整規劃 |
| 1.1.0 | 2026-02-01 | Phase 1 完成 - 類型定義和服務骨架 |
| 1.2.0 | 2026-02-01 | Phase 2 完成 - 三階段服務實現 |
| 1.3.0 | 2026-02-01 | Phase 3 完成 - 整合、持久化、API 更新 |
| 1.4.0 | 2026-02-01 | Phase 4 完成 - UI 更新、i18n 翻譯 |
| 1.5.0 | 2026-02-01 | Phase 5 開始 - 主服務整合 |
| 1.6.0 | 2026-02-01 | Phase 5 完成 - V3.1 整合到主服務 |
| 1.7.0 | 2026-02-01 | Phase 5 整合測試通過 - 修復 GPT-5-nano maxTokens 問題 |

### Phase 1 實施結果

**新增文件**:
- `src/types/extraction-v3.types.ts` - 新增 V3.1 三階段類型定義（約 400 行）
- `src/services/extraction-v3/stages/index.ts` - 階段服務導出入口
- `src/services/extraction-v3/stages/stage-1-company.service.ts` - Stage 1 公司識別服務骨架
- `src/services/extraction-v3/stages/stage-2-format.service.ts` - Stage 2 格式識別服務骨架
- `src/services/extraction-v3/stages/stage-3-extraction.service.ts` - Stage 3 欄位提取服務骨架
- `src/services/extraction-v3/stages/stage-orchestrator.service.ts` - 階段協調器服務骨架

**修改文件**:
- `src/services/extraction-v3/index.ts` - 新增 V3.1 服務導出

**驗證結果**:
- ✅ TypeScript 類型檢查通過（stages 目錄無錯誤）

### Phase 2 實施結果

**新增文件**:
- `src/services/extraction-v3/stages/gpt-caller.service.ts` - 共用 GPT 調用服務
  - 支援 GPT-5-nano（Stage 1 & 2）和 GPT-5.2（Stage 3）
  - 統一的重試機制和錯誤處理
  - 圖片詳情模式配置（auto/low/high）
  - Token 使用追蹤

**修改文件**:
- `src/services/extraction-v3/stages/stage-1-company.service.ts`
  - ✅ 實現 `callGptNano()` 方法 - 調用 GPT-5-nano 進行公司識別
  - ✅ 實現 `jitCreateCompany()` - Just-in-Time 創建新公司記錄
  - 使用 `GptCallerService.callNano()` 統一調用

- `src/services/extraction-v3/stages/stage-2-format.service.ts`
  - ✅ 實現 `callGptNano()` 方法 - 調用 GPT-5-nano 進行格式識別
  - ✅ 實現 `jitCreateFormat()` - Just-in-Time 創建新格式記錄
  - 使用 `GptCallerService.callNano()` 統一調用

- `src/services/extraction-v3/stages/stage-3-extraction.service.ts`
  - ✅ 實現 `callGpt52()` 方法 - 調用 GPT-5.2 進行欄位提取
  - 使用 `GptCallerService.callFull()` 統一調用

- `src/services/extraction-v3/stages/index.ts`
  - 新增 `GptCallerService` 及相關類型導出

**驗證結果**:
- ✅ TypeScript 類型檢查通過（extraction-v3 目錄無錯誤）
- ✅ 所有 Stage 服務的 GPT 調用方法已實現
- ✅ JIT 創建公司/格式邏輯已實現

**技術細節**:
- `GptCallerService` 支援兩種模型：
  - `gpt-5-nano`: 1024 maxTokens, 'low' 圖片詳情（Stage 1 & 2）
  - `gpt-5.2`: 4096 maxTokens, 'auto' 圖片詳情（Stage 3）
- 環境變數配置：
  - `AZURE_OPENAI_NANO_DEPLOYMENT_NAME` - GPT-5-nano 部署名稱
  - `AZURE_OPENAI_DEPLOYMENT_NAME` - GPT-5.2 部署名稱
- JIT 創建使用 `AUTO_CREATED` 來源標記

### Phase 3 實施結果

**新增文件**:
- `src/services/extraction-v3/confidence-v3-1.service.ts` - V3.1 信心度計算服務
  - 5 維度加權信心度計算
  - STAGE_1_COMPANY (20%), STAGE_2_FORMAT (15%), STAGE_3_EXTRACTION (30%)
  - FIELD_COMPLETENESS (20%), CONFIG_SOURCE_BONUS (15%)

**修改文件**:
- `prisma/schema.prisma`
  - 新增 `extractionVersion` 欄位
  - 新增 `stage1Result`, `stage2Result`, `stage3Result` JSON 欄位
  - 新增 `stage1AiDetails`, `stage2AiDetails`, `stage3AiDetails` JSON 欄位
  - 新增 `stage1DurationMs`, `stage2DurationMs`, `stage3DurationMs` 欄位
  - 新增 `stage2ConfigSource`, `stage3ConfigScope` 欄位
  - 新增 `extractionVersion`, `stage2ConfigSource` 索引

- `src/services/processing-result-persistence.service.ts`
  - 新增 `persistV3_1ProcessingResult()` 函數
  - 支援三階段結果持久化
  - 計算並存儲整合的信心度

- `src/services/extraction-v3/index.ts`
  - 新增 V3.1 信心度服務導出
  - 新增 GptCallerService 導出

- `src/app/api/documents/[id]/route.ts`
  - 新增 `extractionVersion` 欄位返回
  - 支援 `?include=stageDetails` 查詢參數
  - V3.1 返回三階段 AI 詳情
  - V3 保持向後兼容

**驗證結果**:
- ✅ Prisma schema 同步成功（`prisma db push`）
- ✅ TypeScript 類型檢查通過
- ✅ API 端點支援 V3 和 V3.1

### Phase 4 實施結果

**修改文件**:
- `src/components/features/invoice/detail/AiDetailsTab.tsx`
  - ✅ 支援 V3（單一 AI 詳情）和 V3.1（三階段 AI 詳情）
  - ✅ V3.1 顯示三個 Stage Card（公司識別、格式識別、欄位提取）
  - ✅ 每階段獨立的 Prompt/Response 展示（Accordion）
  - ✅ 版本標籤顯示（V3 / V3.1）

- `src/components/features/invoice/detail/ProcessingTimeline.tsx`
  - ✅ 新增 V3.1 步驟標籤
  - ✅ STAGE_1_COMPANY_IDENTIFICATION
  - ✅ STAGE_2_FORMAT_IDENTIFICATION
  - ✅ STAGE_3_FIELD_EXTRACTION

- `messages/en/invoices.json`
  - ✅ 新增 V3.1 三階段翻譯
  - ✅ 新增 stages.stage1/2/3 title 和 description
  - ✅ 新增 timeline.version.v3_1
  - ✅ 新增 timeline.steps 三階段步驟

- `messages/zh-TW/invoices.json`
  - ✅ 新增 V3.1 三階段繁體中文翻譯

- `messages/zh-CN/invoices.json`
  - ✅ 新增 V3.1 三階段簡體中文翻譯

**驗證結果**:
- ✅ TypeScript 類型檢查通過
- ✅ 所有語言文件同步更新

### 待完成項目

1. ✅ **主服務整合** - 將 StageOrchestratorService 整合到 ExtractionV3Service
2. ✅ **整合測試** - 測試完整三階段處理流程 (2026-02-01 通過)
3. ⏳ **E2E 測試** - UI 功能測試（Playwright）
4. ⏳ **Feature Flag 配置** - 灰度發布控制
5. ⏳ **文檔更新** - 更新 CLAUDE.md 技術文檔

### Phase 5 實施結果

**修改文件**:
- `src/types/extraction-v3.types.ts`
  - ✅ 新增 `useExtractionV3_1` Feature Flag
  - ✅ 新增 `extractionV3_1Percentage` 灰度發布百分比
  - ✅ 新增 `fallbackToV3OnError` 回退選項
  - ✅ `ExtractionV3Output` 新增 `extractionVersion` 和 `stageAiDetails` 字段

- `src/services/extraction-v3/extraction-v3.service.ts`
  - ✅ 導入 V3.1 服務（StageOrchestratorService, ConfidenceV3_1Service）
  - ✅ 新增 `getStageOrchestrator()` 方法 - 延遲初始化
  - ✅ 新增 `shouldUseV3_1()` 方法 - Feature Flag + 灰度發布判斷
  - ✅ 修改 `processFile()` 主入口 - 根據 Flag 選擇 V3/V3.1
  - ✅ 新增 `processFileV3_1()` 方法 - V3.1 三階段處理流程
  - ✅ 支援 V3.1 失敗時回退到 V3

**驗證結果**:
- ✅ TypeScript 類型檢查通過
- ✅ 向後兼容（V3 流程保留）
- ✅ Feature Flag 控制 V3/V3.1 切換

**技術細節**:
- V3.1 灰度發布支援：`extractionV3_1Percentage` (0-100)
- 回退機制：V3.1 失敗時自動回退到 V3（`fallbackToV3OnError: true`）
- 版本標識：`extractionVersion: 'v3' | 'v3.1'`

**使用方式**:
```typescript
// 啟用 V3.1（100% 流量）
const service = new ExtractionV3Service({
  flags: {
    useExtractionV3_1: true,
    extractionV3_1Percentage: 100,
  }
});

// 啟用 V3.1（50% 灰度）
const service = new ExtractionV3Service({
  flags: {
    useExtractionV3_1: true,
    extractionV3_1Percentage: 50,
  }
});
```

### Phase 5 整合測試結果

**測試日期**: 2026-02-01
**測試文件**: CEVA_CEX250440_52240.pdf (87.12 KB)

| 測試案例 | 狀態 | 版本 | 耗時 |
|----------|------|------|------|
| V3.1 Three-Stage 100% | ✅ 通過 | v3.1 | 52.6s |
| V3.1 Fallback Test | ✅ 通過 | v3.1 | 43.3s |

**測試結果摘要**:
- 📈 通過率: 2/2 (100.0%)

**三階段執行詳情**:

| Stage | 功能 | 結果 | 信心度 | 耗時 |
|-------|------|------|--------|------|
| Stage 1 | 公司識別 | CEVA Logistics Hong Kong Office | 92% | ~10s |
| Stage 2 | 格式識別 | Ceva Logistics Hong Kong Invoice Template | 82-92% | ~9s |
| Stage 3 | 欄位提取 | 5 標準欄位 | - | ~28s |

**Token 使用量**:
- 輸入: ~2000 tokens
- 輸出: ~2700 tokens
- 總計: ~4700 tokens

**修復的問題**:

1. **GPT-5-nano temperature 參數不支援** (Stage 1 & 2)
   - 問題：GPT-5-nano 不支援自定義 temperature 值
   - 解決：將 temperature 設為 `undefined`，使用模型預設值

2. **GPT-5-nano maxTokens 不足** (Stage 2)
   - 問題：`maxTokens: 1024` 被 `reasoning_tokens` 完全消耗，沒有空間輸出 JSON
   - 現象：API 成功但 `content: ''`，`finishReason: 'length'`
   - 解決：將 `maxTokens` 從 1024 增加到 2048

**測試報告位置**: `claudedocs/5-status/testing/reports/TEST-REPORT-CHANGE-024-2026-02-01T09-54-03-138Z.json`
