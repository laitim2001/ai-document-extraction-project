# Tech Spec: Story 15.5 - 信心度計算增強

## 概述

### Story 描述

**As a** 系統,
**I want** 使用多維度因素計算信心度,
**So that** 路由決策更加準確。

### 依賴關係

- **依賴 Story 15.2**: 發行者識別信心度
- **依賴 Story 15.3**: 格式匹配信心度、配置匹配程度
- **依賴 Story 15.4**: 術語匹配度

---

## 1. 核心類型定義

### 1.1 信心度維度枚舉

```typescript
// src/types/confidence.ts

/**
 * @fileoverview 信心度計算相關類型定義
 * @module src/types/confidence
 * @since Epic 15 - Story 15.5
 */

/**
 * 信心度維度 - 多維度評估的各個面向
 */
export enum ConfidenceDimension {
  /** Azure DI 提取信心度 */
  EXTRACTION = 'EXTRACTION',
  /** 發行者識別信心度 */
  ISSUER_IDENTIFICATION = 'ISSUER_IDENTIFICATION',
  /** 格式匹配信心度 */
  FORMAT_MATCHING = 'FORMAT_MATCHING',
  /** 配置匹配程度 */
  CONFIG_MATCH = 'CONFIG_MATCH',
  /** 歷史準確率 */
  HISTORICAL_ACCURACY = 'HISTORICAL_ACCURACY',
  /** 欄位完整度 */
  FIELD_COMPLETENESS = 'FIELD_COMPLETENESS',
  /** 術語匹配度 */
  TERM_MATCHING = 'TERM_MATCHING',
}

/**
 * 路由決策類型
 */
export enum RoutingDecision {
  /** 自動通過 - 信心度 ≥ 90% */
  AUTO_APPROVE = 'AUTO_APPROVE',
  /** 快速審核 - 信心度 70-89% */
  QUICK_REVIEW = 'QUICK_REVIEW',
  /** 完整審核 - 信心度 < 70% */
  FULL_REVIEW = 'FULL_REVIEW',
}

/**
 * 配置來源（用於信心度加成計算）
 */
export enum ConfigSource {
  /** Format 特定配置 - +10% 加成 */
  SPECIFIC = 'SPECIFIC',
  /** Company 層級配置 - +5% 加成 */
  COMPANY = 'COMPANY',
  /** Format 層級配置 - +3% 加成 */
  FORMAT = 'FORMAT',
  /** 全局配置 - +1% 加成 */
  GLOBAL = 'GLOBAL',
  /** 預設配置 - 無加成 */
  DEFAULT = 'DEFAULT',
}
```

### 1.2 信心度評分介面

```typescript
// src/types/confidence.ts (continued)

/**
 * 單一維度的信心度評分
 */
export interface DimensionScore {
  /** 維度類型 */
  dimension: ConfidenceDimension;
  /** 原始分數 (0-100) */
  rawScore: number;
  /** 權重 (0-1) */
  weight: number;
  /** 加權分數 */
  weightedScore: number;
  /** 加成/減成 */
  bonus: number;
  /** 最終分數 */
  finalScore: number;
  /** 評分來源說明 */
  source: string;
  /** 詳細指標 */
  details?: Record<string, unknown>;
}

/**
 * 信心度權重配置
 */
export interface ConfidenceWeights {
  [ConfidenceDimension.EXTRACTION]: number;
  [ConfidenceDimension.ISSUER_IDENTIFICATION]: number;
  [ConfidenceDimension.FORMAT_MATCHING]: number;
  [ConfidenceDimension.CONFIG_MATCH]: number;
  [ConfidenceDimension.HISTORICAL_ACCURACY]: number;
  [ConfidenceDimension.FIELD_COMPLETENESS]: number;
  [ConfidenceDimension.TERM_MATCHING]: number;
}

/**
 * 配置來源加成映射
 */
export interface ConfigBonusMap {
  [ConfigSource.SPECIFIC]: number;
  [ConfigSource.COMPANY]: number;
  [ConfigSource.FORMAT]: number;
  [ConfigSource.GLOBAL]: number;
  [ConfigSource.DEFAULT]: number;
}

/**
 * 完整的信心度計算結果
 */
export interface ConfidenceCalculationResult {
  /** 綜合信心度 (0-100) */
  overallScore: number;
  /** 各維度評分詳情 */
  dimensionScores: DimensionScore[];
  /** 路由決策 */
  routingDecision: RoutingDecision;
  /** 路由決策閾值 */
  thresholds: RoutingThresholds;
  /** 決策理由 */
  decisionReason: string;
  /** 信心度等級 */
  confidenceLevel: ConfidenceLevel;
  /** 建議的審核重點 */
  reviewFocus: string[];
  /** 計算時間戳 */
  calculatedAt: Date;
  /** 計算版本（用於追蹤算法變更） */
  algorithmVersion: string;
}

/**
 * 路由決策閾值配置
 */
export interface RoutingThresholds {
  /** AUTO_APPROVE 閾值 */
  autoApprove: number;
  /** QUICK_REVIEW 閾值 */
  quickReview: number;
  /** 低於此值為 FULL_REVIEW */
}

/**
 * 信心度等級
 */
export enum ConfidenceLevel {
  /** 非常高 (95-100) */
  VERY_HIGH = 'VERY_HIGH',
  /** 高 (85-94) */
  HIGH = 'HIGH',
  /** 中等 (70-84) */
  MEDIUM = 'MEDIUM',
  /** 低 (50-69) */
  LOW = 'LOW',
  /** 非常低 (0-49) */
  VERY_LOW = 'VERY_LOW',
}
```

### 1.3 輸入數據介面

```typescript
// src/types/confidence.ts (continued)

/**
 * 信心度計算輸入數據
 */
export interface ConfidenceCalculationInput {
  /** 文件 ID */
  fileId: string;
  /** 提取結果 */
  extraction: ExtractionConfidenceInput;
  /** 發行者識別結果 */
  issuerIdentification: IssuerConfidenceInput;
  /** 格式匹配結果 */
  formatMatching: FormatConfidenceInput;
  /** 配置匹配信息 */
  configMatch: ConfigMatchInput;
  /** 歷史數據 */
  historical: HistoricalAccuracyInput;
  /** 欄位完整度 */
  fieldCompleteness: FieldCompletenessInput;
  /** 術語匹配 */
  termMatching: TermMatchingInput;
}

/**
 * 提取信心度輸入
 */
export interface ExtractionConfidenceInput {
  /** Azure DI 整體信心度 */
  overallConfidence: number;
  /** 各欄位信心度 */
  fieldConfidences: Record<string, number>;
  /** 提取方法 */
  extractionMethod: 'AZURE_DI' | 'GPT_VISION' | 'DUAL_PROCESSING';
  /** OCR 品質分數 */
  ocrQuality?: number;
}

/**
 * 發行者識別信心度輸入
 */
export interface IssuerConfidenceInput {
  /** 識別是否成功 */
  identified: boolean;
  /** 識別方法 */
  method: 'LOGO' | 'HEADER' | 'TEXT_PATTERN' | 'AI_INFERENCE' | 'MANUAL';
  /** 識別信心度 */
  confidence: number;
  /** 匹配的公司 ID */
  companyId?: string;
  /** 是否為新建公司 */
  isNewCompany: boolean;
}

/**
 * 格式匹配信心度輸入
 */
export interface FormatConfidenceInput {
  /** 是否匹配成功 */
  matched: boolean;
  /** 匹配方法 */
  method: 'EXACT' | 'SIMILARITY' | 'AI_INFERENCE' | 'AUTO_CREATED';
  /** 匹配信心度 */
  confidence: number;
  /** 匹配的格式 ID */
  formatId?: string;
  /** 相似度分數 */
  similarityScore?: number;
}

/**
 * 配置匹配輸入
 */
export interface ConfigMatchInput {
  /** 欄位映射配置來源 */
  fieldMappingSource: ConfigSource;
  /** Prompt 配置來源 */
  promptConfigSource: ConfigSource;
  /** 是否使用了特定配置 */
  hasSpecificConfig: boolean;
  /** 配置完整度 */
  configCompleteness: number;
}

/**
 * 歷史準確率輸入
 */
export interface HistoricalAccuracyInput {
  /** 該公司/格式的歷史準確率 */
  companyFormatAccuracy?: number;
  /** 該公司整體準確率 */
  companyAccuracy?: number;
  /** 該格式整體準確率 */
  formatAccuracy?: number;
  /** 全局準確率 */
  globalAccuracy: number;
  /** 歷史記錄數量 */
  sampleSize: number;
}

/**
 * 欄位完整度輸入
 */
export interface FieldCompletenessInput {
  /** 必填欄位總數 */
  requiredFieldsTotal: number;
  /** 已填充的必填欄位數 */
  requiredFieldsFilled: number;
  /** 選填欄位總數 */
  optionalFieldsTotal: number;
  /** 已填充的選填欄位數 */
  optionalFieldsFilled: number;
  /** 缺失的關鍵欄位 */
  missingCriticalFields: string[];
}

/**
 * 術語匹配輸入
 */
export interface TermMatchingInput {
  /** 識別的術語總數 */
  totalTerms: number;
  /** 精確匹配的術語數 */
  exactMatches: number;
  /** 模糊匹配的術語數 */
  fuzzyMatches: number;
  /** 新術語數 */
  newTerms: number;
  /** 未知術語數 */
  unknownTerms: number;
  /** 術語匹配率 */
  matchRate: number;
}
```

---

## 2. 信心度計算服務

### 2.1 核心計算服務

```typescript
// src/services/confidence-calculator.service.ts

/**
 * @fileoverview 多維度信心度計算服務
 * @module src/services/confidence-calculator
 * @since Epic 15 - Story 15.5
 * @lastModified 2026-01-02
 *
 * @description
 *   實現多維度信心度計算算法，整合以下因素：
 *   - 提取信心度（來自 Azure DI）
 *   - 發行者識別信心度
 *   - 格式匹配信心度
 *   - 配置匹配程度
 *   - 歷史準確率
 *   - 欄位完整度
 *   - 術語匹配度
 *
 * @features
 *   - 加權平均算法
 *   - 配置來源加成機制
 *   - 路由決策自動判定
 *   - 審核重點建議生成
 *
 * @dependencies
 *   - Story 15.2: 發行者識別結果
 *   - Story 15.3: 格式匹配結果、配置來源
 *   - Story 15.4: 術語匹配統計
 */

import {
  ConfidenceDimension,
  RoutingDecision,
  ConfigSource,
  ConfidenceLevel,
  type DimensionScore,
  type ConfidenceWeights,
  type ConfigBonusMap,
  type ConfidenceCalculationResult,
  type ConfidenceCalculationInput,
  type RoutingThresholds,
} from '@/types/confidence';

/**
 * 預設權重配置
 * 所有權重加總應為 1.0
 */
const DEFAULT_WEIGHTS: ConfidenceWeights = {
  [ConfidenceDimension.EXTRACTION]: 0.25,           // 提取品質最重要
  [ConfidenceDimension.ISSUER_IDENTIFICATION]: 0.15, // 發行者識別
  [ConfidenceDimension.FORMAT_MATCHING]: 0.15,       // 格式匹配
  [ConfidenceDimension.CONFIG_MATCH]: 0.10,          // 配置匹配
  [ConfidenceDimension.HISTORICAL_ACCURACY]: 0.15,   // 歷史準確率
  [ConfidenceDimension.FIELD_COMPLETENESS]: 0.10,    // 欄位完整度
  [ConfidenceDimension.TERM_MATCHING]: 0.10,         // 術語匹配
};

/**
 * 配置來源加成映射（百分點）
 */
const CONFIG_BONUS_MAP: ConfigBonusMap = {
  [ConfigSource.SPECIFIC]: 10,  // 特定配置 +10%
  [ConfigSource.COMPANY]: 5,    // 公司配置 +5%
  [ConfigSource.FORMAT]: 3,     // 格式配置 +3%
  [ConfigSource.GLOBAL]: 1,     // 全局配置 +1%
  [ConfigSource.DEFAULT]: 0,    // 預設配置 +0%
};

/**
 * 預設路由閾值
 */
const DEFAULT_THRESHOLDS: RoutingThresholds = {
  autoApprove: 90,
  quickReview: 70,
};

/**
 * 算法版本號
 */
const ALGORITHM_VERSION = '1.0.0';

export class ConfidenceCalculatorService {
  private weights: ConfidenceWeights;
  private bonusMap: ConfigBonusMap;
  private thresholds: RoutingThresholds;

  constructor(
    weights: ConfidenceWeights = DEFAULT_WEIGHTS,
    bonusMap: ConfigBonusMap = CONFIG_BONUS_MAP,
    thresholds: RoutingThresholds = DEFAULT_THRESHOLDS
  ) {
    this.weights = weights;
    this.bonusMap = bonusMap;
    this.thresholds = thresholds;
    this.validateWeights();
  }

  /**
   * 驗證權重配置
   */
  private validateWeights(): void {
    const total = Object.values(this.weights).reduce((sum, w) => sum + w, 0);
    if (Math.abs(total - 1.0) > 0.001) {
      console.warn(
        `[ConfidenceCalculator] 權重總和為 ${total}，應為 1.0，將自動正規化`
      );
      // 自動正規化
      const factor = 1.0 / total;
      for (const key of Object.keys(this.weights) as ConfidenceDimension[]) {
        this.weights[key] *= factor;
      }
    }
  }

  /**
   * 計算綜合信心度
   */
  async calculate(
    input: ConfidenceCalculationInput
  ): Promise<ConfidenceCalculationResult> {
    // 計算各維度分數
    const dimensionScores: DimensionScore[] = [
      this.calculateExtractionScore(input.extraction),
      this.calculateIssuerScore(input.issuerIdentification),
      this.calculateFormatScore(input.formatMatching),
      this.calculateConfigScore(input.configMatch),
      this.calculateHistoricalScore(input.historical),
      this.calculateFieldCompletenessScore(input.fieldCompleteness),
      this.calculateTermMatchingScore(input.termMatching),
    ];

    // 計算加權總分
    const overallScore = this.calculateWeightedScore(dimensionScores);

    // 決定路由
    const routingDecision = this.determineRouting(overallScore);

    // 生成審核重點
    const reviewFocus = this.generateReviewFocus(dimensionScores);

    // 生成決策理由
    const decisionReason = this.generateDecisionReason(
      overallScore,
      routingDecision,
      dimensionScores
    );

    return {
      overallScore: Math.round(overallScore * 100) / 100,
      dimensionScores,
      routingDecision,
      thresholds: this.thresholds,
      decisionReason,
      confidenceLevel: this.getConfidenceLevel(overallScore),
      reviewFocus,
      calculatedAt: new Date(),
      algorithmVersion: ALGORITHM_VERSION,
    };
  }

  /**
   * 計算提取信心度分數
   */
  private calculateExtractionScore(
    input: ExtractionConfidenceInput
  ): DimensionScore {
    const dimension = ConfidenceDimension.EXTRACTION;
    const weight = this.weights[dimension];

    // 基礎分數來自 Azure DI
    let rawScore = input.overallConfidence;

    // OCR 品質影響
    if (input.ocrQuality !== undefined) {
      rawScore = rawScore * 0.7 + input.ocrQuality * 0.3;
    }

    // 提取方法加成
    const methodBonus = this.getExtractionMethodBonus(input.extractionMethod);

    const finalScore = Math.min(100, rawScore + methodBonus);

    return {
      dimension,
      rawScore,
      weight,
      weightedScore: rawScore * weight,
      bonus: methodBonus,
      finalScore,
      source: `Azure DI (${input.extractionMethod})`,
      details: {
        ocrQuality: input.ocrQuality,
        extractionMethod: input.extractionMethod,
        fieldCount: Object.keys(input.fieldConfidences).length,
      },
    };
  }

  /**
   * 獲取提取方法加成
   */
  private getExtractionMethodBonus(
    method: ExtractionConfidenceInput['extractionMethod']
  ): number {
    switch (method) {
      case 'DUAL_PROCESSING':
        return 5; // 雙重處理最可靠
      case 'AZURE_DI':
        return 3; // Azure DI 標準
      case 'GPT_VISION':
        return 0; // GPT Vision 無加成
      default:
        return 0;
    }
  }

  /**
   * 計算發行者識別分數
   */
  private calculateIssuerScore(
    input: IssuerConfidenceInput
  ): DimensionScore {
    const dimension = ConfidenceDimension.ISSUER_IDENTIFICATION;
    const weight = this.weights[dimension];

    let rawScore = input.identified ? input.confidence : 0;

    // 識別方法影響
    const methodBonus = this.getIssuerMethodBonus(input.method);

    // 新建公司減分
    const newCompanyPenalty = input.isNewCompany ? -10 : 0;

    const finalScore = Math.max(
      0,
      Math.min(100, rawScore + methodBonus + newCompanyPenalty)
    );

    return {
      dimension,
      rawScore,
      weight,
      weightedScore: rawScore * weight,
      bonus: methodBonus + newCompanyPenalty,
      finalScore,
      source: input.identified ? `Identified via ${input.method}` : 'Not identified',
      details: {
        method: input.method,
        companyId: input.companyId,
        isNewCompany: input.isNewCompany,
      },
    };
  }

  /**
   * 獲取發行者識別方法加成
   */
  private getIssuerMethodBonus(method: IssuerConfidenceInput['method']): number {
    switch (method) {
      case 'LOGO':
        return 5; // Logo 識別較可靠
      case 'HEADER':
        return 3;
      case 'TEXT_PATTERN':
        return 0;
      case 'AI_INFERENCE':
        return -5; // AI 推斷不太可靠
      case 'MANUAL':
        return 10; // 人工確認最可靠
      default:
        return 0;
    }
  }

  /**
   * 計算格式匹配分數
   */
  private calculateFormatScore(
    input: FormatConfidenceInput
  ): DimensionScore {
    const dimension = ConfidenceDimension.FORMAT_MATCHING;
    const weight = this.weights[dimension];

    let rawScore = input.matched ? input.confidence : 0;

    // 匹配方法影響
    const methodBonus = this.getFormatMethodBonus(input.method);

    const finalScore = Math.max(0, Math.min(100, rawScore + methodBonus));

    return {
      dimension,
      rawScore,
      weight,
      weightedScore: rawScore * weight,
      bonus: methodBonus,
      finalScore,
      source: input.matched ? `Matched via ${input.method}` : 'Not matched',
      details: {
        method: input.method,
        formatId: input.formatId,
        similarityScore: input.similarityScore,
      },
    };
  }

  /**
   * 獲取格式匹配方法加成
   */
  private getFormatMethodBonus(method: FormatConfidenceInput['method']): number {
    switch (method) {
      case 'EXACT':
        return 10; // 精確匹配最可靠
      case 'SIMILARITY':
        return 3;
      case 'AI_INFERENCE':
        return -5;
      case 'AUTO_CREATED':
        return -15; // 自動創建需要人工確認
      default:
        return 0;
    }
  }

  /**
   * 計算配置匹配分數
   */
  private calculateConfigScore(input: ConfigMatchInput): DimensionScore {
    const dimension = ConfidenceDimension.CONFIG_MATCH;
    const weight = this.weights[dimension];

    // 基礎分數來自配置完整度
    let rawScore = input.configCompleteness * 100;

    // 配置來源加成
    const fieldMappingBonus = this.bonusMap[input.fieldMappingSource];
    const promptBonus = this.bonusMap[input.promptConfigSource];
    const totalBonus = (fieldMappingBonus + promptBonus) / 2;

    const finalScore = Math.min(100, rawScore + totalBonus);

    return {
      dimension,
      rawScore,
      weight,
      weightedScore: rawScore * weight,
      bonus: totalBonus,
      finalScore,
      source: `Field: ${input.fieldMappingSource}, Prompt: ${input.promptConfigSource}`,
      details: {
        fieldMappingSource: input.fieldMappingSource,
        promptConfigSource: input.promptConfigSource,
        hasSpecificConfig: input.hasSpecificConfig,
        configCompleteness: input.configCompleteness,
      },
    };
  }

  /**
   * 計算歷史準確率分數
   */
  private calculateHistoricalScore(
    input: HistoricalAccuracyInput
  ): DimensionScore {
    const dimension = ConfidenceDimension.HISTORICAL_ACCURACY;
    const weight = this.weights[dimension];

    // 優先使用 company+format 的準確率
    let rawScore =
      input.companyFormatAccuracy ??
      input.companyAccuracy ??
      input.formatAccuracy ??
      input.globalAccuracy;

    rawScore = rawScore * 100;

    // 樣本量影響：樣本量太少時減分
    const sampleBonus = this.getSampleSizeBonus(input.sampleSize);

    const finalScore = Math.max(0, Math.min(100, rawScore + sampleBonus));

    return {
      dimension,
      rawScore,
      weight,
      weightedScore: rawScore * weight,
      bonus: sampleBonus,
      finalScore,
      source: this.getHistoricalSource(input),
      details: {
        companyFormatAccuracy: input.companyFormatAccuracy,
        companyAccuracy: input.companyAccuracy,
        formatAccuracy: input.formatAccuracy,
        globalAccuracy: input.globalAccuracy,
        sampleSize: input.sampleSize,
      },
    };
  }

  /**
   * 獲取樣本量加成
   */
  private getSampleSizeBonus(sampleSize: number): number {
    if (sampleSize >= 100) return 5;
    if (sampleSize >= 50) return 2;
    if (sampleSize >= 20) return 0;
    if (sampleSize >= 10) return -5;
    if (sampleSize >= 5) return -10;
    return -20; // 樣本太少
  }

  /**
   * 獲取歷史數據來源說明
   */
  private getHistoricalSource(input: HistoricalAccuracyInput): string {
    if (input.companyFormatAccuracy !== undefined) {
      return `Company+Format (n=${input.sampleSize})`;
    }
    if (input.companyAccuracy !== undefined) {
      return `Company (n=${input.sampleSize})`;
    }
    if (input.formatAccuracy !== undefined) {
      return `Format (n=${input.sampleSize})`;
    }
    return `Global (n=${input.sampleSize})`;
  }

  /**
   * 計算欄位完整度分數
   */
  private calculateFieldCompletenessScore(
    input: FieldCompletenessInput
  ): DimensionScore {
    const dimension = ConfidenceDimension.FIELD_COMPLETENESS;
    const weight = this.weights[dimension];

    // 必填欄位權重更高
    const requiredRatio =
      input.requiredFieldsTotal > 0
        ? input.requiredFieldsFilled / input.requiredFieldsTotal
        : 1;
    const optionalRatio =
      input.optionalFieldsTotal > 0
        ? input.optionalFieldsFilled / input.optionalFieldsTotal
        : 1;

    // 70% 權重給必填欄位
    const rawScore = (requiredRatio * 0.7 + optionalRatio * 0.3) * 100;

    // 缺失關鍵欄位的懲罰
    const criticalPenalty = input.missingCriticalFields.length * -5;

    const finalScore = Math.max(0, Math.min(100, rawScore + criticalPenalty));

    return {
      dimension,
      rawScore,
      weight,
      weightedScore: rawScore * weight,
      bonus: criticalPenalty,
      finalScore,
      source: `Required: ${input.requiredFieldsFilled}/${input.requiredFieldsTotal}, Optional: ${input.optionalFieldsFilled}/${input.optionalFieldsTotal}`,
      details: {
        requiredFieldsTotal: input.requiredFieldsTotal,
        requiredFieldsFilled: input.requiredFieldsFilled,
        optionalFieldsTotal: input.optionalFieldsTotal,
        optionalFieldsFilled: input.optionalFieldsFilled,
        missingCriticalFields: input.missingCriticalFields,
      },
    };
  }

  /**
   * 計算術語匹配分數
   */
  private calculateTermMatchingScore(
    input: TermMatchingInput
  ): DimensionScore {
    const dimension = ConfidenceDimension.TERM_MATCHING;
    const weight = this.weights[dimension];

    // 基礎分數來自匹配率
    let rawScore = input.matchRate * 100;

    // 精確匹配加成
    const exactMatchBonus =
      input.totalTerms > 0
        ? (input.exactMatches / input.totalTerms) * 10
        : 0;

    // 未知術語懲罰
    const unknownPenalty =
      input.totalTerms > 0
        ? (input.unknownTerms / input.totalTerms) * -15
        : 0;

    const totalBonus = exactMatchBonus + unknownPenalty;
    const finalScore = Math.max(0, Math.min(100, rawScore + totalBonus));

    return {
      dimension,
      rawScore,
      weight,
      weightedScore: rawScore * weight,
      bonus: totalBonus,
      finalScore,
      source: `Match rate: ${(input.matchRate * 100).toFixed(1)}%`,
      details: {
        totalTerms: input.totalTerms,
        exactMatches: input.exactMatches,
        fuzzyMatches: input.fuzzyMatches,
        newTerms: input.newTerms,
        unknownTerms: input.unknownTerms,
        matchRate: input.matchRate,
      },
    };
  }

  /**
   * 計算加權總分
   */
  private calculateWeightedScore(scores: DimensionScore[]): number {
    let weightedSum = 0;
    let totalWeight = 0;

    for (const score of scores) {
      weightedSum += score.finalScore * score.weight;
      totalWeight += score.weight;
    }

    return totalWeight > 0 ? weightedSum / totalWeight : 0;
  }

  /**
   * 決定路由
   */
  private determineRouting(score: number): RoutingDecision {
    if (score >= this.thresholds.autoApprove) {
      return RoutingDecision.AUTO_APPROVE;
    }
    if (score >= this.thresholds.quickReview) {
      return RoutingDecision.QUICK_REVIEW;
    }
    return RoutingDecision.FULL_REVIEW;
  }

  /**
   * 獲取信心度等級
   */
  private getConfidenceLevel(score: number): ConfidenceLevel {
    if (score >= 95) return ConfidenceLevel.VERY_HIGH;
    if (score >= 85) return ConfidenceLevel.HIGH;
    if (score >= 70) return ConfidenceLevel.MEDIUM;
    if (score >= 50) return ConfidenceLevel.LOW;
    return ConfidenceLevel.VERY_LOW;
  }

  /**
   * 生成審核重點建議
   */
  private generateReviewFocus(scores: DimensionScore[]): string[] {
    const focus: string[] = [];

    // 找出低分維度
    const lowScores = scores
      .filter((s) => s.finalScore < 70)
      .sort((a, b) => a.finalScore - b.finalScore);

    for (const score of lowScores.slice(0, 3)) {
      focus.push(this.getDimensionReviewSuggestion(score));
    }

    return focus;
  }

  /**
   * 獲取維度審核建議
   */
  private getDimensionReviewSuggestion(score: DimensionScore): string {
    const suggestions: Record<ConfidenceDimension, string> = {
      [ConfidenceDimension.EXTRACTION]:
        '請仔細核對提取的欄位值是否正確',
      [ConfidenceDimension.ISSUER_IDENTIFICATION]:
        '請確認文件發行者/公司是否正確',
      [ConfidenceDimension.FORMAT_MATCHING]:
        '請確認文件格式分類是否正確',
      [ConfidenceDimension.CONFIG_MATCH]:
        '該文件缺少特定配置，可能需要建立映射規則',
      [ConfidenceDimension.HISTORICAL_ACCURACY]:
        '該公司/格式歷史準確率較低，請特別注意',
      [ConfidenceDimension.FIELD_COMPLETENESS]:
        '部分必填欄位未提取到，請補充',
      [ConfidenceDimension.TERM_MATCHING]:
        '發現未識別的術語，請確認分類',
    };

    return `${suggestions[score.dimension]} (分數: ${score.finalScore.toFixed(1)})`;
  }

  /**
   * 生成決策理由
   */
  private generateDecisionReason(
    score: number,
    decision: RoutingDecision,
    scores: DimensionScore[]
  ): string {
    const topScores = scores
      .sort((a, b) => b.finalScore - a.finalScore)
      .slice(0, 2);

    const lowScores = scores
      .sort((a, b) => a.finalScore - b.finalScore)
      .slice(0, 2);

    let reason = `綜合信心度 ${score.toFixed(1)}%。`;

    switch (decision) {
      case RoutingDecision.AUTO_APPROVE:
        reason += ` 高信心度來源: ${topScores.map((s) => this.getDimensionName(s.dimension)).join('、')}.`;
        break;
      case RoutingDecision.QUICK_REVIEW:
        reason += ` 需要快速確認: ${lowScores.map((s) => this.getDimensionName(s.dimension)).join('、')}.`;
        break;
      case RoutingDecision.FULL_REVIEW:
        reason += ` 需要完整審核: ${lowScores.map((s) => `${this.getDimensionName(s.dimension)}(${s.finalScore.toFixed(0)}%)`).join('、')}.`;
        break;
    }

    return reason;
  }

  /**
   * 獲取維度中文名稱
   */
  private getDimensionName(dimension: ConfidenceDimension): string {
    const names: Record<ConfidenceDimension, string> = {
      [ConfidenceDimension.EXTRACTION]: '提取品質',
      [ConfidenceDimension.ISSUER_IDENTIFICATION]: '發行者識別',
      [ConfidenceDimension.FORMAT_MATCHING]: '格式匹配',
      [ConfidenceDimension.CONFIG_MATCH]: '配置匹配',
      [ConfidenceDimension.HISTORICAL_ACCURACY]: '歷史準確率',
      [ConfidenceDimension.FIELD_COMPLETENESS]: '欄位完整度',
      [ConfidenceDimension.TERM_MATCHING]: '術語匹配',
    };
    return names[dimension];
  }
}
```

---

## 3. 路由決策服務

### 3.1 路由決策執行

```typescript
// src/services/routing-decision.service.ts

/**
 * @fileoverview 路由決策執行服務
 * @module src/services/routing-decision
 * @since Epic 15 - Story 15.5
 */

import {
  RoutingDecision,
  type ConfidenceCalculationResult,
} from '@/types/confidence';
import type { ProcessedFile } from '@/types/processing';
import { prisma } from '@/lib/prisma';

/**
 * 路由決策結果
 */
export interface RoutingResult {
  /** 決策類型 */
  decision: RoutingDecision;
  /** 目標隊列/狀態 */
  targetQueue: string;
  /** 分配的審核員（如適用） */
  assignedReviewer?: string;
  /** 優先級 */
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  /** SLA 時限（分鐘） */
  slaDuration: number;
  /** 自動處理的欄位 */
  autoApprovedFields?: string[];
  /** 需要審核的欄位 */
  fieldsRequiringReview?: string[];
}

export class RoutingDecisionService {
  /**
   * 執行路由決策
   */
  async executeRouting(
    file: ProcessedFile,
    confidenceResult: ConfidenceCalculationResult
  ): Promise<RoutingResult> {
    const { routingDecision, overallScore, dimensionScores } = confidenceResult;

    switch (routingDecision) {
      case RoutingDecision.AUTO_APPROVE:
        return this.handleAutoApprove(file, confidenceResult);
      case RoutingDecision.QUICK_REVIEW:
        return this.handleQuickReview(file, confidenceResult);
      case RoutingDecision.FULL_REVIEW:
        return this.handleFullReview(file, confidenceResult);
      default:
        throw new Error(`Unknown routing decision: ${routingDecision}`);
    }
  }

  /**
   * 處理自動通過
   */
  private async handleAutoApprove(
    file: ProcessedFile,
    result: ConfidenceCalculationResult
  ): Promise<RoutingResult> {
    // 更新文件狀態為已批准
    await prisma.processedFile.update({
      where: { id: file.id },
      data: {
        status: 'APPROVED',
        approvedAt: new Date(),
        approvalType: 'AUTO',
        confidenceScore: result.overallScore,
        confidenceDetails: result as unknown as Prisma.JsonValue,
      },
    });

    // 記錄審計日誌
    await this.logAuditEvent(file.id, 'AUTO_APPROVE', result);

    return {
      decision: RoutingDecision.AUTO_APPROVE,
      targetQueue: 'approved',
      priority: 'LOW',
      slaDuration: 0, // 無需 SLA
      autoApprovedFields: this.getAllFieldNames(file),
    };
  }

  /**
   * 處理快速審核
   */
  private async handleQuickReview(
    file: ProcessedFile,
    result: ConfidenceCalculationResult
  ): Promise<RoutingResult> {
    // 識別需要審核的欄位
    const fieldsRequiringReview = this.identifyFieldsForReview(
      file,
      result.dimensionScores
    );

    // 自動通過高信心度欄位
    const autoApprovedFields = this.identifyAutoApproveFields(
      file,
      result.dimensionScores
    );

    // 更新文件狀態
    await prisma.processedFile.update({
      where: { id: file.id },
      data: {
        status: 'PENDING_QUICK_REVIEW',
        confidenceScore: result.overallScore,
        confidenceDetails: result as unknown as Prisma.JsonValue,
        reviewFocus: result.reviewFocus,
        autoApprovedFields,
        fieldsRequiringReview,
      },
    });

    // 分配審核員
    const assignedReviewer = await this.assignReviewer(
      file,
      'QUICK_REVIEW'
    );

    return {
      decision: RoutingDecision.QUICK_REVIEW,
      targetQueue: 'quick-review',
      assignedReviewer,
      priority: 'MEDIUM',
      slaDuration: 15, // 15 分鐘 SLA
      autoApprovedFields,
      fieldsRequiringReview,
    };
  }

  /**
   * 處理完整審核
   */
  private async handleFullReview(
    file: ProcessedFile,
    result: ConfidenceCalculationResult
  ): Promise<RoutingResult> {
    // 所有欄位都需要審核
    const fieldsRequiringReview = this.getAllFieldNames(file);

    // 更新文件狀態
    await prisma.processedFile.update({
      where: { id: file.id },
      data: {
        status: 'PENDING_FULL_REVIEW',
        confidenceScore: result.overallScore,
        confidenceDetails: result as unknown as Prisma.JsonValue,
        reviewFocus: result.reviewFocus,
        fieldsRequiringReview,
      },
    });

    // 分配審核員
    const assignedReviewer = await this.assignReviewer(
      file,
      'FULL_REVIEW'
    );

    // 設置優先級
    const priority = result.overallScore < 50 ? 'HIGH' : 'MEDIUM';

    return {
      decision: RoutingDecision.FULL_REVIEW,
      targetQueue: 'full-review',
      assignedReviewer,
      priority,
      slaDuration: 60, // 60 分鐘 SLA
      fieldsRequiringReview,
    };
  }

  /**
   * 識別需要審核的欄位
   */
  private identifyFieldsForReview(
    file: ProcessedFile,
    scores: DimensionScore[]
  ): string[] {
    const fields: string[] = [];

    // 根據維度分數決定哪些欄位需要審核
    const extractionScore = scores.find(
      (s) => s.dimension === ConfidenceDimension.EXTRACTION
    );

    if (extractionScore && extractionScore.details?.fieldConfidences) {
      const fieldConfidences = extractionScore.details.fieldConfidences as Record<
        string,
        number
      >;

      for (const [field, confidence] of Object.entries(fieldConfidences)) {
        if (confidence < 80) {
          fields.push(field);
        }
      }
    }

    // 發行者識別低分時，加入發行者相關欄位
    const issuerScore = scores.find(
      (s) => s.dimension === ConfidenceDimension.ISSUER_IDENTIFICATION
    );
    if (issuerScore && issuerScore.finalScore < 80) {
      fields.push('companyId', 'companyName');
    }

    return [...new Set(fields)];
  }

  /**
   * 識別可自動通過的欄位
   */
  private identifyAutoApproveFields(
    file: ProcessedFile,
    scores: DimensionScore[]
  ): string[] {
    const allFields = this.getAllFieldNames(file);
    const reviewFields = this.identifyFieldsForReview(file, scores);

    return allFields.filter((f) => !reviewFields.includes(f));
  }

  /**
   * 獲取所有欄位名稱
   */
  private getAllFieldNames(file: ProcessedFile): string[] {
    // 從文件的提取結果中獲取所有欄位名
    const invoiceData = file.extractionResult?.invoiceData || {};
    return Object.keys(invoiceData);
  }

  /**
   * 分配審核員
   */
  private async assignReviewer(
    file: ProcessedFile,
    reviewType: 'QUICK_REVIEW' | 'FULL_REVIEW'
  ): Promise<string | undefined> {
    // TODO: 實現智能審核員分配邏輯
    // 考慮因素：工作負載、專長、城市
    return undefined;
  }

  /**
   * 記錄審計事件
   */
  private async logAuditEvent(
    fileId: string,
    action: string,
    result: ConfidenceCalculationResult
  ): Promise<void> {
    await prisma.auditLog.create({
      data: {
        entityType: 'ProcessedFile',
        entityId: fileId,
        action,
        details: {
          overallScore: result.overallScore,
          routingDecision: result.routingDecision,
          algorithmVersion: result.algorithmVersion,
        },
        createdAt: new Date(),
      },
    });
  }
}
```

---

## 4. 整合到統一處理流程

### 4.1 修改 UnifiedDocumentProcessor

```typescript
// src/services/unified-document-processor.service.ts (修改)

import { ConfidenceCalculatorService } from './confidence-calculator.service';
import { RoutingDecisionService } from './routing-decision.service';

// 在 Step 10 中整合信心度計算
private async stepConfidenceCalculation(
  context: ProcessingContext
): Promise<StepResult> {
  const calculator = new ConfidenceCalculatorService();

  // 收集各步驟的結果
  const input: ConfidenceCalculationInput = {
    fileId: context.file.id,
    extraction: this.buildExtractionInput(context),
    issuerIdentification: this.buildIssuerInput(context),
    formatMatching: this.buildFormatInput(context),
    configMatch: this.buildConfigInput(context),
    historical: await this.buildHistoricalInput(context),
    fieldCompleteness: this.buildFieldCompletenessInput(context),
    termMatching: this.buildTermMatchingInput(context),
  };

  const result = await calculator.calculate(input);

  // 保存到 context
  context.confidenceResult = result;

  return {
    success: true,
    data: result,
    message: `信心度計算完成: ${result.overallScore.toFixed(1)}%`,
  };
}

// 在 Step 11 中執行路由決策
private async stepRoutingDecision(
  context: ProcessingContext
): Promise<StepResult> {
  const router = new RoutingDecisionService();

  if (!context.confidenceResult) {
    throw new Error('Confidence calculation not completed');
  }

  const result = await router.executeRouting(
    context.file,
    context.confidenceResult
  );

  context.routingResult = result;

  return {
    success: true,
    data: result,
    message: `路由決策: ${result.decision}`,
  };
}

// Helper: 構建提取信心度輸入
private buildExtractionInput(
  context: ProcessingContext
): ExtractionConfidenceInput {
  const extraction = context.extractionResult;

  return {
    overallConfidence: extraction?.confidence ?? 0,
    fieldConfidences: extraction?.fieldConfidences ?? {},
    extractionMethod: context.processingMethod ?? 'AZURE_DI',
    ocrQuality: extraction?.ocrQuality,
  };
}

// Helper: 構建發行者識別輸入
private buildIssuerInput(
  context: ProcessingContext
): IssuerConfidenceInput {
  const issuer = context.issuerResult;

  return {
    identified: issuer?.identified ?? false,
    method: issuer?.method ?? 'AI_INFERENCE',
    confidence: issuer?.confidence ?? 0,
    companyId: issuer?.companyId,
    isNewCompany: issuer?.isNewCompany ?? false,
  };
}

// Helper: 構建格式匹配輸入
private buildFormatInput(
  context: ProcessingContext
): FormatConfidenceInput {
  const format = context.formatResult;

  return {
    matched: format?.matched ?? false,
    method: format?.method ?? 'AUTO_CREATED',
    confidence: format?.confidence ?? 0,
    formatId: format?.formatId,
    similarityScore: format?.similarityScore,
  };
}

// Helper: 構建配置匹配輸入
private buildConfigInput(context: ProcessingContext): ConfigMatchInput {
  const config = context.dynamicConfig;

  return {
    fieldMappingSource: config?.metadata?.fieldMappingSource ?? ConfigSource.DEFAULT,
    promptConfigSource: config?.metadata?.promptSource ?? ConfigSource.DEFAULT,
    hasSpecificConfig: config?.metadata?.hasSpecificConfig ?? false,
    configCompleteness: config?.metadata?.completeness ?? 0.5,
  };
}

// Helper: 構建歷史準確率輸入
private async buildHistoricalInput(
  context: ProcessingContext
): Promise<HistoricalAccuracyInput> {
  const companyId = context.issuerResult?.companyId;
  const formatId = context.formatResult?.formatId;

  // 從資料庫獲取歷史統計
  const stats = await this.getHistoricalStats(companyId, formatId);

  return {
    companyFormatAccuracy: stats.companyFormatAccuracy,
    companyAccuracy: stats.companyAccuracy,
    formatAccuracy: stats.formatAccuracy,
    globalAccuracy: stats.globalAccuracy,
    sampleSize: stats.sampleSize,
  };
}

// Helper: 構建欄位完整度輸入
private buildFieldCompletenessInput(
  context: ProcessingContext
): FieldCompletenessInput {
  const invoiceData = context.extractionResult?.invoiceData ?? {};

  // 必填欄位列表
  const requiredFields = [
    'invoiceNumber',
    'invoiceDate',
    'vendorName',
    'totalAmount',
    'currency',
  ];

  const requiredFieldsFilled = requiredFields.filter(
    (f) => invoiceData[f] !== undefined && invoiceData[f] !== null
  ).length;

  // 選填欄位
  const optionalFields = Object.keys(invoiceData).filter(
    (f) => !requiredFields.includes(f)
  );
  const optionalFieldsFilled = optionalFields.filter(
    (f) => invoiceData[f] !== undefined && invoiceData[f] !== null
  ).length;

  const missingCriticalFields = requiredFields.filter(
    (f) => invoiceData[f] === undefined || invoiceData[f] === null
  );

  return {
    requiredFieldsTotal: requiredFields.length,
    requiredFieldsFilled,
    optionalFieldsTotal: optionalFields.length,
    optionalFieldsFilled,
    missingCriticalFields,
  };
}

// Helper: 構建術語匹配輸入
private buildTermMatchingInput(
  context: ProcessingContext
): TermMatchingInput {
  const termResult = context.termLearningResult;

  if (!termResult) {
    return {
      totalTerms: 0,
      exactMatches: 0,
      fuzzyMatches: 0,
      newTerms: 0,
      unknownTerms: 0,
      matchRate: 0,
    };
  }

  const stats = termResult.stats;

  return {
    totalTerms: stats.totalTerms,
    exactMatches: stats.exactMatches,
    fuzzyMatches: stats.fuzzyMatches,
    newTerms: stats.newTerms,
    unknownTerms: stats.unknownTerms,
    matchRate: stats.matchRate,
  };
}

// Helper: 獲取歷史統計
private async getHistoricalStats(
  companyId?: string,
  formatId?: string
): Promise<{
  companyFormatAccuracy?: number;
  companyAccuracy?: number;
  formatAccuracy?: number;
  globalAccuracy: number;
  sampleSize: number;
}> {
  // Company + Format 組合統計
  if (companyId && formatId) {
    const stats = await prisma.processedFile.aggregate({
      where: {
        companyId,
        documentFormatId: formatId,
        status: { in: ['APPROVED', 'CORRECTED'] },
      },
      _avg: {
        accuracyScore: true,
      },
      _count: true,
    });

    if (stats._count >= 5) {
      return {
        companyFormatAccuracy: stats._avg.accuracyScore ?? undefined,
        globalAccuracy: await this.getGlobalAccuracy(),
        sampleSize: stats._count,
      };
    }
  }

  // Company 統計
  if (companyId) {
    const stats = await prisma.processedFile.aggregate({
      where: {
        companyId,
        status: { in: ['APPROVED', 'CORRECTED'] },
      },
      _avg: {
        accuracyScore: true,
      },
      _count: true,
    });

    if (stats._count >= 5) {
      return {
        companyAccuracy: stats._avg.accuracyScore ?? undefined,
        globalAccuracy: await this.getGlobalAccuracy(),
        sampleSize: stats._count,
      };
    }
  }

  // Format 統計
  if (formatId) {
    const stats = await prisma.processedFile.aggregate({
      where: {
        documentFormatId: formatId,
        status: { in: ['APPROVED', 'CORRECTED'] },
      },
      _avg: {
        accuracyScore: true,
      },
      _count: true,
    });

    if (stats._count >= 5) {
      return {
        formatAccuracy: stats._avg.accuracyScore ?? undefined,
        globalAccuracy: await this.getGlobalAccuracy(),
        sampleSize: stats._count,
      };
    }
  }

  // 全局統計
  const globalStats = await prisma.processedFile.aggregate({
    where: {
      status: { in: ['APPROVED', 'CORRECTED'] },
    },
    _avg: {
      accuracyScore: true,
    },
    _count: true,
  });

  return {
    globalAccuracy: globalStats._avg.accuracyScore ?? 0.85,
    sampleSize: globalStats._count,
  };
}

private async getGlobalAccuracy(): Promise<number> {
  const stats = await prisma.processedFile.aggregate({
    where: {
      status: { in: ['APPROVED', 'CORRECTED'] },
    },
    _avg: {
      accuracyScore: true,
    },
  });

  return stats._avg.accuracyScore ?? 0.85;
}
```

---

## 5. API 端點

### 5.1 信心度計算 API

```typescript
// src/app/api/v1/confidence/calculate/route.ts

/**
 * @fileoverview 信心度計算 API
 * @module src/app/api/v1/confidence/calculate
 * @since Epic 15 - Story 15.5
 */

import { NextRequest, NextResponse } from 'next/server';
import { ConfidenceCalculatorService } from '@/services/confidence-calculator.service';
import { z } from 'zod';

const CalculateRequestSchema = z.object({
  fileId: z.string().cuid(),
  extraction: z.object({
    overallConfidence: z.number().min(0).max(100),
    fieldConfidences: z.record(z.number()),
    extractionMethod: z.enum(['AZURE_DI', 'GPT_VISION', 'DUAL_PROCESSING']),
    ocrQuality: z.number().min(0).max(100).optional(),
  }),
  issuerIdentification: z.object({
    identified: z.boolean(),
    method: z.enum(['LOGO', 'HEADER', 'TEXT_PATTERN', 'AI_INFERENCE', 'MANUAL']),
    confidence: z.number().min(0).max(100),
    companyId: z.string().optional(),
    isNewCompany: z.boolean(),
  }),
  formatMatching: z.object({
    matched: z.boolean(),
    method: z.enum(['EXACT', 'SIMILARITY', 'AI_INFERENCE', 'AUTO_CREATED']),
    confidence: z.number().min(0).max(100),
    formatId: z.string().optional(),
    similarityScore: z.number().min(0).max(1).optional(),
  }),
  configMatch: z.object({
    fieldMappingSource: z.enum(['SPECIFIC', 'COMPANY', 'FORMAT', 'GLOBAL', 'DEFAULT']),
    promptConfigSource: z.enum(['SPECIFIC', 'COMPANY', 'FORMAT', 'GLOBAL', 'DEFAULT']),
    hasSpecificConfig: z.boolean(),
    configCompleteness: z.number().min(0).max(1),
  }),
  historical: z.object({
    companyFormatAccuracy: z.number().min(0).max(1).optional(),
    companyAccuracy: z.number().min(0).max(1).optional(),
    formatAccuracy: z.number().min(0).max(1).optional(),
    globalAccuracy: z.number().min(0).max(1),
    sampleSize: z.number().int().min(0),
  }),
  fieldCompleteness: z.object({
    requiredFieldsTotal: z.number().int().min(0),
    requiredFieldsFilled: z.number().int().min(0),
    optionalFieldsTotal: z.number().int().min(0),
    optionalFieldsFilled: z.number().int().min(0),
    missingCriticalFields: z.array(z.string()),
  }),
  termMatching: z.object({
    totalTerms: z.number().int().min(0),
    exactMatches: z.number().int().min(0),
    fuzzyMatches: z.number().int().min(0),
    newTerms: z.number().int().min(0),
    unknownTerms: z.number().int().min(0),
    matchRate: z.number().min(0).max(1),
  }),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const input = CalculateRequestSchema.parse(body);

    const calculator = new ConfidenceCalculatorService();
    const result = await calculator.calculate(input);

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/validation',
          title: 'Validation Error',
          status: 400,
          detail: 'Invalid request body',
          errors: error.errors,
        },
        { status: 400 }
      );
    }

    console.error('[Confidence Calculate API] Error:', error);
    return NextResponse.json(
      {
        type: 'https://api.example.com/errors/internal',
        title: 'Internal Server Error',
        status: 500,
        detail: 'Failed to calculate confidence',
      },
      { status: 500 }
    );
  }
}
```

### 5.2 路由閾值配置 API

```typescript
// src/app/api/v1/confidence/thresholds/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const ThresholdsSchema = z.object({
  autoApprove: z.number().min(0).max(100),
  quickReview: z.number().min(0).max(100),
});

// GET - 獲取當前閾值配置
export async function GET() {
  const config = await prisma.systemConfig.findUnique({
    where: { key: 'routing_thresholds' },
  });

  const thresholds = config?.value ?? {
    autoApprove: 90,
    quickReview: 70,
  };

  return NextResponse.json({
    success: true,
    data: thresholds,
  });
}

// PUT - 更新閾值配置
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const thresholds = ThresholdsSchema.parse(body);

    // 驗證閾值邏輯
    if (thresholds.quickReview >= thresholds.autoApprove) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/validation',
          title: 'Validation Error',
          status: 400,
          detail: 'quickReview threshold must be less than autoApprove threshold',
        },
        { status: 400 }
      );
    }

    await prisma.systemConfig.upsert({
      where: { key: 'routing_thresholds' },
      update: { value: thresholds },
      create: {
        key: 'routing_thresholds',
        value: thresholds,
      },
    });

    return NextResponse.json({
      success: true,
      data: thresholds,
      message: 'Routing thresholds updated successfully',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/validation',
          title: 'Validation Error',
          status: 400,
          errors: error.errors,
        },
        { status: 400 }
      );
    }

    console.error('[Thresholds API] Error:', error);
    return NextResponse.json(
      {
        type: 'https://api.example.com/errors/internal',
        title: 'Internal Server Error',
        status: 500,
      },
      { status: 500 }
    );
  }
}
```

---

## 6. 信心度權重配置 API

```typescript
// src/app/api/v1/confidence/weights/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { ConfidenceDimension } from '@/types/confidence';

const WeightsSchema = z.object({
  [ConfidenceDimension.EXTRACTION]: z.number().min(0).max(1),
  [ConfidenceDimension.ISSUER_IDENTIFICATION]: z.number().min(0).max(1),
  [ConfidenceDimension.FORMAT_MATCHING]: z.number().min(0).max(1),
  [ConfidenceDimension.CONFIG_MATCH]: z.number().min(0).max(1),
  [ConfidenceDimension.HISTORICAL_ACCURACY]: z.number().min(0).max(1),
  [ConfidenceDimension.FIELD_COMPLETENESS]: z.number().min(0).max(1),
  [ConfidenceDimension.TERM_MATCHING]: z.number().min(0).max(1),
});

// GET - 獲取當前權重配置
export async function GET() {
  const config = await prisma.systemConfig.findUnique({
    where: { key: 'confidence_weights' },
  });

  const weights = config?.value ?? {
    [ConfidenceDimension.EXTRACTION]: 0.25,
    [ConfidenceDimension.ISSUER_IDENTIFICATION]: 0.15,
    [ConfidenceDimension.FORMAT_MATCHING]: 0.15,
    [ConfidenceDimension.CONFIG_MATCH]: 0.10,
    [ConfidenceDimension.HISTORICAL_ACCURACY]: 0.15,
    [ConfidenceDimension.FIELD_COMPLETENESS]: 0.10,
    [ConfidenceDimension.TERM_MATCHING]: 0.10,
  };

  return NextResponse.json({
    success: true,
    data: weights,
  });
}

// PUT - 更新權重配置
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const weights = WeightsSchema.parse(body);

    // 驗證權重總和
    const total = Object.values(weights).reduce((sum, w) => sum + w, 0);
    if (Math.abs(total - 1.0) > 0.01) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/validation',
          title: 'Validation Error',
          status: 400,
          detail: `Weights must sum to 1.0, got ${total.toFixed(2)}`,
        },
        { status: 400 }
      );
    }

    await prisma.systemConfig.upsert({
      where: { key: 'confidence_weights' },
      update: { value: weights },
      create: {
        key: 'confidence_weights',
        value: weights,
      },
    });

    return NextResponse.json({
      success: true,
      data: weights,
      message: 'Confidence weights updated successfully',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/validation',
          title: 'Validation Error',
          status: 400,
          errors: error.errors,
        },
        { status: 400 }
      );
    }

    console.error('[Weights API] Error:', error);
    return NextResponse.json(
      {
        type: 'https://api.example.com/errors/internal',
        title: 'Internal Server Error',
        status: 500,
      },
      { status: 500 }
    );
  }
}
```

---

## 7. 信心度儀表板組件

### 7.1 信心度詳情面板

```typescript
// src/components/features/confidence/ConfidenceDetailsPanel.tsx

/**
 * @fileoverview 信心度詳情面板組件
 * @module src/components/features/confidence
 * @since Epic 15 - Story 15.5
 */

'use client';

import * as React from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  ConfidenceLevel,
  RoutingDecision,
  type ConfidenceCalculationResult,
  type DimensionScore,
} from '@/types/confidence';
import { cn } from '@/lib/utils';

interface ConfidenceDetailsPanelProps {
  result: ConfidenceCalculationResult;
  className?: string;
}

/**
 * 信心度詳情面板
 */
export function ConfidenceDetailsPanel({
  result,
  className,
}: ConfidenceDetailsPanelProps) {
  return (
    <Card className={cn('w-full', className)}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">信心度分析</CardTitle>
            <CardDescription>
              算法版本: {result.algorithmVersion}
            </CardDescription>
          </div>
          <RoutingBadge decision={result.routingDecision} />
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* 綜合分數 */}
        <div className="text-center">
          <div className="text-4xl font-bold">
            {result.overallScore.toFixed(1)}%
          </div>
          <ConfidenceLevelBadge level={result.confidenceLevel} />
          <p className="mt-2 text-sm text-muted-foreground">
            {result.decisionReason}
          </p>
        </div>

        {/* 維度分數詳情 */}
        <div className="space-y-4">
          <h4 className="font-medium">維度分析</h4>
          {result.dimensionScores.map((score) => (
            <DimensionScoreRow key={score.dimension} score={score} />
          ))}
        </div>

        {/* 審核重點 */}
        {result.reviewFocus.length > 0 && (
          <div className="space-y-2">
            <h4 className="font-medium">審核重點</h4>
            <ul className="list-disc list-inside text-sm text-muted-foreground">
              {result.reviewFocus.map((focus, index) => (
                <li key={index}>{focus}</li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * 路由決策徽章
 */
function RoutingBadge({ decision }: { decision: RoutingDecision }) {
  const config = {
    [RoutingDecision.AUTO_APPROVE]: {
      label: '自動通過',
      variant: 'success' as const,
    },
    [RoutingDecision.QUICK_REVIEW]: {
      label: '快速審核',
      variant: 'warning' as const,
    },
    [RoutingDecision.FULL_REVIEW]: {
      label: '完整審核',
      variant: 'destructive' as const,
    },
  };

  const { label, variant } = config[decision];

  return (
    <Badge variant={variant} className="text-sm">
      {label}
    </Badge>
  );
}

/**
 * 信心度等級徽章
 */
function ConfidenceLevelBadge({ level }: { level: ConfidenceLevel }) {
  const labels: Record<ConfidenceLevel, string> = {
    [ConfidenceLevel.VERY_HIGH]: '非常高',
    [ConfidenceLevel.HIGH]: '高',
    [ConfidenceLevel.MEDIUM]: '中等',
    [ConfidenceLevel.LOW]: '低',
    [ConfidenceLevel.VERY_LOW]: '非常低',
  };

  return (
    <Badge variant="outline" className="mt-2">
      信心度: {labels[level]}
    </Badge>
  );
}

/**
 * 維度分數行
 */
function DimensionScoreRow({ score }: { score: DimensionScore }) {
  const dimensionLabels: Record<string, string> = {
    EXTRACTION: '提取品質',
    ISSUER_IDENTIFICATION: '發行者識別',
    FORMAT_MATCHING: '格式匹配',
    CONFIG_MATCH: '配置匹配',
    HISTORICAL_ACCURACY: '歷史準確率',
    FIELD_COMPLETENESS: '欄位完整度',
    TERM_MATCHING: '術語匹配',
  };

  const progressColor =
    score.finalScore >= 80
      ? 'bg-green-500'
      : score.finalScore >= 60
        ? 'bg-yellow-500'
        : 'bg-red-500';

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="space-y-1">
            <div className="flex justify-between text-sm">
              <span>{dimensionLabels[score.dimension]}</span>
              <span className="font-medium">
                {score.finalScore.toFixed(1)}%
                {score.bonus !== 0 && (
                  <span
                    className={cn(
                      'ml-1 text-xs',
                      score.bonus > 0 ? 'text-green-600' : 'text-red-600'
                    )}
                  >
                    ({score.bonus > 0 ? '+' : ''}{score.bonus.toFixed(0)})
                  </span>
                )}
              </span>
            </div>
            <Progress
              value={score.finalScore}
              className="h-2"
              indicatorClassName={progressColor}
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{score.source}</span>
              <span>權重: {(score.weight * 100).toFixed(0)}%</span>
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <div className="text-sm">
            <p>原始分數: {score.rawScore.toFixed(1)}%</p>
            <p>加成/減成: {score.bonus.toFixed(1)}</p>
            <p>加權分數: {score.weightedScore.toFixed(2)}</p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
```

---

## 8. 驗收標準

### 8.1 功能驗收

| 驗收條件 | 檢查項目 |
|---------|---------|
| 多維度計算 | 7 個維度全部參與計算 |
| 權重配置 | 權重總和為 1.0，可配置 |
| 配置加成 | specific +10%, company +5%, format +3%, global +1%, default +0% |
| 路由閾值 | ≥90% AUTO_APPROVE, 70-89% QUICK_REVIEW, <70% FULL_REVIEW |
| 審核建議 | 低分維度生成對應審核重點 |
| 決策理由 | 生成人類可讀的決策說明 |

### 8.2 性能驗收

| 指標 | 目標 |
|-----|------|
| 計算時間 | < 100ms |
| 歷史查詢 | < 50ms |
| API 響應 | < 200ms |

### 8.3 測試範例

```typescript
// 測試案例 1: 高信心度自動通過
const highConfidenceInput = {
  extraction: { overallConfidence: 95, ... },
  issuerIdentification: { identified: true, confidence: 92, ... },
  formatMatching: { matched: true, confidence: 90, ... },
  ...
};
// 預期: overallScore >= 90, decision = AUTO_APPROVE

// 測試案例 2: 中等信心度快速審核
const mediumConfidenceInput = {
  extraction: { overallConfidence: 80, ... },
  issuerIdentification: { identified: true, confidence: 75, ... },
  formatMatching: { matched: true, confidence: 70, ... },
  ...
};
// 預期: 70 <= overallScore < 90, decision = QUICK_REVIEW

// 測試案例 3: 低信心度完整審核
const lowConfidenceInput = {
  extraction: { overallConfidence: 60, ... },
  issuerIdentification: { identified: false, confidence: 0, ... },
  formatMatching: { matched: false, confidence: 0, ... },
  ...
};
// 預期: overallScore < 70, decision = FULL_REVIEW
```

---

## 9. 相關文檔

- **Epic 15**: 統一 3 層機制到日常處理流程
- **Story 15.2**: 發行者識別整合 - 提供識別信心度
- **Story 15.3**: 格式匹配與動態配置 - 提供格式信心度和配置來源
- **Story 15.4**: 持續術語學習 - 提供術語匹配統計
- **PRD**: docs/01-planning/prd/prd.md - 信心度路由機制定義

---

*Tech Spec 建立日期: 2026-01-02*
*版本: 1.0.0*
