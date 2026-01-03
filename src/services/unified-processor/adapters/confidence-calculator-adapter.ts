/**
 * @fileoverview 信心度計算適配器
 * @description
 *   實現 7 維度信心度計算系統：
 *   - EXTRACTION (25%): OCR/GPT 提取品質
 *   - ISSUER_IDENTIFICATION (15%): 發行商識別準確度
 *   - FORMAT_MATCHING (15%): 文件格式匹配程度
 *   - CONFIG_MATCH (10%): 配置來源匹配
 *   - HISTORICAL_ACCURACY (15%): 歷史準確率
 *   - FIELD_COMPLETENESS (10%): 欄位完整性
 *   - TERM_MATCHING (10%): 術語匹配程度
 *
 * @module src/services/unified-processor/adapters
 * @since Epic 15 - Story 15.5 (信心度計算增強)
 * @lastModified 2026-01-03
 *
 * @features
 *   - 7 維度加權信心度計算
 *   - 配置來源加成機制
 *   - 可配置的權重和閾值
 *   - 詳細的維度分數明細
 *
 * @related
 *   - src/types/confidence.ts - 類型定義
 *   - src/services/unified-processor/steps/confidence-calculation.step.ts - 使用此適配器
 *   - src/services/unified-processor/adapters/routing-decision-adapter.ts - 路由決策
 */

import type { UnifiedProcessingContext, StepResult } from '@/types/unified-processor';
import {
  type ConfidenceCalculationInput,
  type ConfidenceCalculationResult,
  type ConfidenceCalculationConfig,
  type ConfidenceWeights,
  type DimensionScore,
  type ConfigSourceBonuses,
  ConfidenceDimension,
  ConfidenceLevelEnum,
  ConfigSource,
  DEFAULT_DIMENSION_WEIGHTS,
  DEFAULT_CONFIG_SOURCE_BONUSES,
  DEFAULT_CONFIDENCE_CALCULATION_CONFIG,
  CONFIDENCE_LEVEL_RANGES,
} from '@/types/confidence';

// ============================================================================
// Types
// ============================================================================

/**
 * 信心度計算適配器選項
 */
export interface ConfidenceCalculatorOptions {
  /** 自定義權重 */
  weights?: Partial<ConfidenceWeights>;
  /** 自定義配置來源加成 */
  configSourceBonuses?: Partial<ConfigSourceBonuses>;
  /** 是否啟用歷史數據加權 */
  enableHistoricalWeighting?: boolean;
  /** 最小樣本數 */
  minSampleSize?: number;
}

/**
 * 維度計算結果（內部使用）
 */
interface DimensionCalculation {
  dimension: ConfidenceDimension;
  rawScore: number;
  source: string;
  details?: string;
}

// ============================================================================
// Constants
// ============================================================================

/** 默認分數（當無法計算時） */
const DEFAULT_DIMENSION_SCORE = 50;

/** 無數據時的低分 */
const NO_DATA_SCORE = 30;

// ============================================================================
// Main Adapter Class
// ============================================================================

/**
 * 信心度計算適配器
 * @description
 *   實現 7 維度信心度計算，整合：
 *   - 提取品質（來自 OCR/GPT）
 *   - 發行商識別（來自 IssuerIdentifier）
 *   - 格式匹配（來自 FormatMatcher）
 *   - 配置來源（來自 ConfigFetcher）
 *   - 歷史準確率（來自資料庫統計）
 *   - 欄位完整性（計算必填欄位填充率）
 *   - 術語匹配（來自 TermRecorder）
 */
export class ConfidenceCalculatorAdapter {
  private readonly config: ConfidenceCalculationConfig;

  constructor(options?: ConfidenceCalculatorOptions) {
    this.config = this.buildConfig(options);
  }

  // ============================================================================
  // Public Methods
  // ============================================================================

  /**
   * 從統一處理上下文計算信心度
   * @param context - 統一處理上下文
   * @returns 信心度計算結果
   */
  calculateFromContext(context: UnifiedProcessingContext): ConfidenceCalculationResult {
    const input = this.buildInputFromContext(context);
    return this.calculate(input);
  }

  /**
   * 計算信心度
   * @param input - 信心度計算輸入
   * @returns 信心度計算結果
   */
  calculate(input: ConfidenceCalculationInput): ConfidenceCalculationResult {
    const warnings: string[] = [];
    const dimensions: DimensionScore[] = [];

    // 1. 計算各維度分數
    const dimensionCalculations = [
      this.calculateExtractionScore(input),
      this.calculateIssuerIdentificationScore(input),
      this.calculateFormatMatchingScore(input),
      this.calculateConfigMatchScore(input),
      this.calculateHistoricalAccuracyScore(input, warnings),
      this.calculateFieldCompletenessScore(input),
      this.calculateTermMatchingScore(input),
    ];

    // 2. 應用權重並構建維度分數
    let baseScore = 0;
    for (const calc of dimensionCalculations) {
      const weight = this.config.weights[calc.dimension];
      const weightedScore = calc.rawScore * weight;
      baseScore += weightedScore;

      dimensions.push({
        dimension: calc.dimension,
        rawScore: calc.rawScore,
        weightedScore,
        weight,
        source: calc.source,
        details: calc.details,
      });
    }

    // 3. 應用配置來源加成
    const configSource = input.configInfo?.source ?? ConfigSource.DEFAULT;
    const configSourceBonus = this.config.configSourceBonuses[configSource];
    const overallScore = Math.min(100, baseScore + configSourceBonus);

    // 4. 確定信心度等級
    const level = this.getLevel(overallScore);

    return {
      overallScore: Math.round(overallScore * 100) / 100,
      level,
      dimensions,
      configSourceBonus,
      configSource,
      calculatedAt: new Date(),
      hasWarnings: warnings.length > 0,
      warnings,
    };
  }

  /**
   * 根據分數獲取信心度等級
   * @param score - 信心度分數 (0-100)
   * @returns 信心度等級
   */
  getLevel(score: number): ConfidenceLevelEnum {
    for (const [level, range] of Object.entries(CONFIDENCE_LEVEL_RANGES)) {
      if (score >= range.min && score <= range.max) {
        return level as ConfidenceLevelEnum;
      }
    }
    return ConfidenceLevelEnum.MEDIUM;
  }

  /**
   * 驗證權重配置
   * @param weights - 權重配置
   * @returns 是否有效（總和應為 1.0）
   */
  validateWeights(weights: ConfidenceWeights): boolean {
    const sum = Object.values(weights).reduce((acc, val) => acc + val, 0);
    return Math.abs(sum - 1.0) < 0.001;
  }

  /**
   * 獲取當前配置
   */
  getConfig(): ConfidenceCalculationConfig {
    return { ...this.config };
  }

  // ============================================================================
  // Private: Dimension Score Calculations
  // ============================================================================

  /**
   * 計算提取品質分數 (25%)
   * @description 基於 OCR/GPT 提取的信心度
   */
  private calculateExtractionScore(input: ConfidenceCalculationInput): DimensionCalculation {
    if (input.extractionConfidence !== undefined) {
      return {
        dimension: ConfidenceDimension.EXTRACTION,
        rawScore: Math.max(0, Math.min(100, input.extractionConfidence)),
        source: 'extractionConfidence',
        details: `OCR/GPT 提取信心度: ${input.extractionConfidence}%`,
      };
    }

    return {
      dimension: ConfidenceDimension.EXTRACTION,
      rawScore: DEFAULT_DIMENSION_SCORE,
      source: 'default',
      details: '無提取信心度數據，使用默認分數',
    };
  }

  /**
   * 計算發行商識別分數 (15%)
   * @description 基於發行商識別結果
   */
  private calculateIssuerIdentificationScore(input: ConfidenceCalculationInput): DimensionCalculation {
    const issuer = input.issuerIdentification;
    if (!issuer) {
      return {
        dimension: ConfidenceDimension.ISSUER_IDENTIFICATION,
        rawScore: NO_DATA_SCORE,
        source: 'no_data',
        details: '無發行商識別結果',
      };
    }

    if (!issuer.identified) {
      return {
        dimension: ConfidenceDimension.ISSUER_IDENTIFICATION,
        rawScore: 20,
        source: 'not_identified',
        details: '發行商未識別',
      };
    }

    // 識別成功，使用其信心度
    const baseScore = issuer.confidence;
    // 方法加成
    const methodBonus = this.getIssuerMethodBonus(issuer.method);
    const finalScore = Math.min(100, baseScore + methodBonus);

    return {
      dimension: ConfidenceDimension.ISSUER_IDENTIFICATION,
      rawScore: finalScore,
      source: issuer.method,
      details: `方法: ${issuer.method}, 原始信心度: ${baseScore}%, 方法加成: ${methodBonus}%`,
    };
  }

  /**
   * 計算格式匹配分數 (15%)
   * @description 基於文件格式匹配結果
   */
  private calculateFormatMatchingScore(input: ConfidenceCalculationInput): DimensionCalculation {
    const format = input.formatMatching;
    if (!format) {
      return {
        dimension: ConfidenceDimension.FORMAT_MATCHING,
        rawScore: NO_DATA_SCORE,
        source: 'no_data',
        details: '無格式匹配結果',
      };
    }

    if (!format.matched) {
      return {
        dimension: ConfidenceDimension.FORMAT_MATCHING,
        rawScore: 30,
        source: 'not_matched',
        details: '格式未匹配',
      };
    }

    return {
      dimension: ConfidenceDimension.FORMAT_MATCHING,
      rawScore: format.confidence,
      source: format.formatId ?? 'unknown',
      details: `格式ID: ${format.formatId ?? '未知'}, 信心度: ${format.confidence}%`,
    };
  }

  /**
   * 計算配置匹配分數 (10%)
   * @description 基於配置來源層級
   */
  private calculateConfigMatchScore(input: ConfidenceCalculationInput): DimensionCalculation {
    const config = input.configInfo;
    if (!config) {
      return {
        dimension: ConfidenceDimension.CONFIG_MATCH,
        rawScore: DEFAULT_DIMENSION_SCORE,
        source: 'no_config',
        details: '使用默認配置',
      };
    }

    // 配置來源層級對應的基礎分數
    const sourceScores: Record<ConfigSource, number> = {
      [ConfigSource.SPECIFIC]: 95,
      [ConfigSource.COMPANY]: 85,
      [ConfigSource.FORMAT]: 75,
      [ConfigSource.GLOBAL]: 65,
      [ConfigSource.DEFAULT]: 50,
    };

    const score = sourceScores[config.source] ?? DEFAULT_DIMENSION_SCORE;

    return {
      dimension: ConfidenceDimension.CONFIG_MATCH,
      rawScore: score,
      source: config.source,
      details: `配置來源: ${config.source}, 配置ID: ${config.configId ?? '無'}`,
    };
  }

  /**
   * 計算歷史準確率分數 (15%)
   * @description 基於歷史處理準確率
   */
  private calculateHistoricalAccuracyScore(
    input: ConfidenceCalculationInput,
    warnings: string[]
  ): DimensionCalculation {
    const history = input.historicalData;
    if (!history) {
      return {
        dimension: ConfidenceDimension.HISTORICAL_ACCURACY,
        rawScore: DEFAULT_DIMENSION_SCORE,
        source: 'no_history',
        details: '無歷史數據',
      };
    }

    // 檢查樣本數
    if (history.totalProcessed < this.config.minSampleSize) {
      warnings.push(`歷史樣本數不足: ${history.totalProcessed} < ${this.config.minSampleSize}`);
      return {
        dimension: ConfidenceDimension.HISTORICAL_ACCURACY,
        rawScore: DEFAULT_DIMENSION_SCORE,
        source: 'insufficient_sample',
        details: `樣本數不足: ${history.totalProcessed}/${this.config.minSampleSize}`,
      };
    }

    // 使用平均準確率
    const score = history.averageAccuracy;

    return {
      dimension: ConfidenceDimension.HISTORICAL_ACCURACY,
      rawScore: score,
      source: 'historical_data',
      details: `歷史準確率: ${score}%, 樣本數: ${history.totalProcessed}`,
    };
  }

  /**
   * 計算欄位完整性分數 (10%)
   * @description 基於必填欄位填充率
   */
  private calculateFieldCompletenessScore(input: ConfidenceCalculationInput): DimensionCalculation {
    const fields = input.fieldCompleteness;
    if (!fields) {
      return {
        dimension: ConfidenceDimension.FIELD_COMPLETENESS,
        rawScore: DEFAULT_DIMENSION_SCORE,
        source: 'no_data',
        details: '無欄位完整性數據',
      };
    }

    // 計算必填欄位填充率（權重更高）
    const requiredRate = fields.requiredFields > 0
      ? (fields.filledRequiredFields / fields.requiredFields) * 100
      : 100;

    // 計算總體填充率
    const totalRate = fields.totalFields > 0
      ? (fields.filledFields / fields.totalFields) * 100
      : 100;

    // 加權計算：必填欄位 70%，總體 30%
    const score = requiredRate * 0.7 + totalRate * 0.3;

    return {
      dimension: ConfidenceDimension.FIELD_COMPLETENESS,
      rawScore: Math.round(score * 100) / 100,
      source: 'field_analysis',
      details: `必填: ${fields.filledRequiredFields}/${fields.requiredFields}, 總體: ${fields.filledFields}/${fields.totalFields}`,
    };
  }

  /**
   * 計算術語匹配分數 (10%)
   * @description 基於術語匹配結果
   */
  private calculateTermMatchingScore(input: ConfidenceCalculationInput): DimensionCalculation {
    const terms = input.termMatching;
    if (!terms) {
      return {
        dimension: ConfidenceDimension.TERM_MATCHING,
        rawScore: DEFAULT_DIMENSION_SCORE,
        source: 'no_data',
        details: '無術語匹配數據',
      };
    }

    if (terms.totalTerms === 0) {
      return {
        dimension: ConfidenceDimension.TERM_MATCHING,
        rawScore: 70, // 無術語時給予中等分數
        source: 'no_terms',
        details: '文件無術語',
      };
    }

    // 計算匹配率
    const matchRate = (terms.matchedTerms / terms.totalTerms) * 100;

    // 新術語懲罰：每個新術語扣 2 分，最多扣 20 分
    const newTermPenalty = Math.min(20, terms.newTerms * 2);
    const score = Math.max(0, matchRate - newTermPenalty);

    return {
      dimension: ConfidenceDimension.TERM_MATCHING,
      rawScore: Math.round(score * 100) / 100,
      source: 'term_analysis',
      details: `匹配: ${terms.matchedTerms}/${terms.totalTerms}, 新術語: ${terms.newTerms}`,
    };
  }

  // ============================================================================
  // Private: Helper Methods
  // ============================================================================

  /**
   * 構建配置
   */
  private buildConfig(options?: ConfidenceCalculatorOptions): ConfidenceCalculationConfig {
    const defaultConfig = { ...DEFAULT_CONFIDENCE_CALCULATION_CONFIG };

    if (!options) {
      return defaultConfig;
    }

    return {
      weights: options.weights
        ? { ...DEFAULT_DIMENSION_WEIGHTS, ...options.weights }
        : defaultConfig.weights,
      configSourceBonuses: options.configSourceBonuses
        ? { ...DEFAULT_CONFIG_SOURCE_BONUSES, ...options.configSourceBonuses }
        : defaultConfig.configSourceBonuses,
      routingThresholds: defaultConfig.routingThresholds,
      enableHistoricalWeighting: options.enableHistoricalWeighting ?? defaultConfig.enableHistoricalWeighting,
      minSampleSize: options.minSampleSize ?? defaultConfig.minSampleSize,
    };
  }

  /**
   * 從統一處理上下文構建輸入
   */
  private buildInputFromContext(context: UnifiedProcessingContext): ConfidenceCalculationInput {
    const input: ConfidenceCalculationInput = {
      processedFileId: context.input?.fileId ?? '',
    };

    // Helper: 從 stepResults 陣列中查找指定步驟結果
    const findStepResult = (stepName: string): StepResult | undefined => {
      return context.stepResults?.find((r) => r.step === stepName);
    };

    // Helper: 安全取得 data 屬性
    const getData = <T>(result: StepResult | undefined): T | undefined => {
      return result?.data as T | undefined;
    };

    // 1. 提取信心度（從 extractedData 或 stepResults）
    const extractionResult = findStepResult('EXTRACTION');
    const extractionData = getData<{ confidence?: number }>(extractionResult);
    if (extractionData?.confidence) {
      input.extractionConfidence = extractionData.confidence;
    }

    // 2. 發行商識別
    const issuerResult = findStepResult('ISSUER_IDENTIFICATION');
    const issuerData = getData<{ identified?: boolean; confidence?: number; method?: string }>(issuerResult);
    if (issuerData) {
      input.issuerIdentification = {
        identified: issuerData.identified ?? false,
        confidence: issuerData.confidence ?? 0,
        method: issuerData.method ?? 'unknown',
      };
    }

    // 3. 格式匹配
    const formatResult = findStepResult('FORMAT_MATCHING');
    const formatData = getData<{ matched?: boolean; confidence?: number; formatId?: string }>(formatResult);
    if (formatData) {
      input.formatMatching = {
        matched: formatData.matched ?? false,
        confidence: formatData.confidence ?? 0,
        formatId: formatData.formatId,
      };
    }

    // 4. 配置信息
    const configResult = findStepResult('CONFIG_FETCHING');
    const configData = getData<{ source?: string; configId?: string }>(configResult);
    if (configData) {
      input.configInfo = {
        source: this.mapConfigSource(configData.source),
        configId: configData.configId,
      };
    }

    // 5. 歷史準確率（從統計服務獲取，這裡使用佔位符）
    // TODO: 整合歷史準確率服務
    if (context.companyId) {
      input.historicalData = {
        totalProcessed: 0,
        successfullyMapped: 0,
        averageAccuracy: 50,
      };
    }

    // 6. 欄位完整性
    if (context.extractedData?.invoiceData) {
      const invoiceData = context.extractedData.invoiceData;
      const requiredFields = ['vendorName', 'invoiceDate', 'totalAmount'];
      const allFields = Object.keys(invoiceData);
      const filledFields = allFields.filter((key) => {
        const value = (invoiceData as Record<string, unknown>)[key];
        return value !== null && value !== undefined && value !== '';
      });
      const filledRequiredFields = requiredFields.filter((key) => {
        const value = (invoiceData as Record<string, unknown>)[key];
        return value !== null && value !== undefined && value !== '';
      });

      input.fieldCompleteness = {
        totalFields: allFields.length,
        filledFields: filledFields.length,
        requiredFields: requiredFields.length,
        filledRequiredFields: filledRequiredFields.length,
      };
    }

    // 7. 術語匹配
    const termResult = findStepResult('TERM_RECORDING');
    const termData = termResult?.data as {
      stats?: {
        totalDetected?: number;
        exactMatches?: number;
        fuzzyMatches?: number;
        synonymMatches?: number;
        newTerms?: number;
      };
    } | undefined;
    if (termData?.stats) {
      const stats = termData.stats;
      input.termMatching = {
        totalTerms: stats.totalDetected ?? 0,
        matchedTerms: (stats.exactMatches ?? 0) + (stats.fuzzyMatches ?? 0) + (stats.synonymMatches ?? 0),
        unmatchedTerms: stats.newTerms ?? 0,
        newTerms: stats.newTerms ?? 0,
      };
    }

    return input;
  }

  /**
   * 映射配置來源
   */
  private mapConfigSource(source: string | undefined): ConfigSource {
    if (!source) return ConfigSource.DEFAULT;

    const mapping: Record<string, ConfigSource> = {
      'specific': ConfigSource.SPECIFIC,
      'company': ConfigSource.COMPANY,
      'format': ConfigSource.FORMAT,
      'global': ConfigSource.GLOBAL,
      'default': ConfigSource.DEFAULT,
    };

    return mapping[source.toLowerCase()] ?? ConfigSource.DEFAULT;
  }

  /**
   * 獲取發行商識別方法加成
   */
  private getIssuerMethodBonus(method: string): number {
    const bonuses: Record<string, number> = {
      'HEADER': 10,    // 從文件頭識別，較可靠
      'LOGO': 8,       // 從 Logo 識別
      'PATTERN': 5,    // 從模式識別
      'KEYWORD': 3,    // 從關鍵字識別
      'FALLBACK': 0,   // 後備方法
    };
    return bonuses[method.toUpperCase()] ?? 0;
  }
}

// 單例導出
export const confidenceCalculatorAdapter = new ConfidenceCalculatorAdapter();
