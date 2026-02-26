/**
 * @fileoverview V3.1 信心度計算服務 - 基於三階段架構
 * @description
 *   實現基於三階段分離架構的 5 維度加權信心度計算：
 *   - STAGE_1_COMPANY (20%): Stage 1 公司識別信心度
 *   - STAGE_2_FORMAT (15%): Stage 2 格式識別信心度
 *   - STAGE_3_EXTRACTION (30%): Stage 3 欄位提取信心度
 *   - FIELD_COMPLETENESS (20%): 欄位完整性
 *   - CONFIG_SOURCE_BONUS (15%): 配置來源加成
 *
 * @module src/services/extraction-v3/confidence-v3-1
 * @since CHANGE-024 - Three-Stage Extraction Architecture
 * @lastModified 2026-02-01
 *
 * @features
 *   - 基於三階段結果的 5 維度計算
 *   - 配置來源加成（COMPANY_SPECIFIC > UNIVERSAL > LLM_INFERRED）
 *   - 路由決策生成
 *   - 維度分數詳情
 *
 * @related
 *   - src/services/extraction-v3/stages/ - 三階段服務
 *   - src/types/extraction-v3.types.ts - V3.1 類型定義
 */

import type {
  Stage1CompanyResult,
  Stage2FormatResult,
  Stage3ExtractionResult,
  ConfidenceResultV3_1,
  DimensionScoreV3_1,
  ConfidenceWeightsV3_1,
  ConfidenceDimensionV3_1,
  FormatConfigSource,
  StandardFieldsV3,
  SmartRoutingInput,
  SmartRoutingOutput,
} from '@/types/extraction-v3.types';
import {
  DEFAULT_CONFIDENCE_WEIGHTS_V3_1,
  CONFIG_SOURCE_BONUS_SCORES,
} from '@/types/extraction-v3.types';
import { ConfidenceLevelEnum } from '@/types/confidence';

// ============================================================================
// Types
// ============================================================================

/**
 * V3.1 信心度計算輸入
 */
export interface ConfidenceInputV3_1 {
  /** Stage 1 結果 */
  stage1Result: Stage1CompanyResult;
  /** Stage 2 結果 */
  stage2Result: Stage2FormatResult;
  /** Stage 3 結果 */
  stage3Result: Stage3ExtractionResult;
  /** 歷史準確率（如已知） */
  historicalAccuracy?: number;
  /** CHANGE-032: 參考號碼匹配結果 */
  refMatchResult?: import('@/types/extraction-v3.types').ReferenceNumberMatchResult;
  /** CHANGE-032: 參考號碼匹配是否啟用 */
  refMatchEnabled?: boolean;
}

/**
 * V3.1 路由決策詳情
 */
export interface RoutingDecisionV3_1 {
  /** 決策類型 */
  decision: 'AUTO_APPROVE' | 'QUICK_REVIEW' | 'FULL_REVIEW';
  /** 信心度分數 */
  score: number;
  /** 閾值 */
  threshold: number;
  /** 決策原因 */
  reasons: string[];
}

/**
 * V3.1 信心度計算選項
 */
export interface ConfidenceCalculationOptionsV3_1 {
  /** 自定義權重 */
  weights?: Partial<ConfidenceWeightsV3_1>;
  /** 是否包含維度詳情 */
  includeDetails?: boolean;
}

/**
 * V3.1 信心度服務結果
 */
export interface ConfidenceServiceResultV3_1 {
  /** 是否成功 */
  success: boolean;
  /** 信心度結果 */
  result?: ConfidenceResultV3_1;
  /** 路由決策 */
  routingDecision?: RoutingDecisionV3_1;
  /** 錯誤訊息 */
  error?: string;
  /** 處理時間（毫秒） */
  processingTimeMs: number;
}

// ============================================================================
// Constants
// ============================================================================

/** V3.1 路由閾值 */
export const ROUTING_THRESHOLDS_V3_1 = {
  /** 自動批准閾值 */
  AUTO_APPROVE: 90,
  /** 快速審核閾值 */
  QUICK_REVIEW: 70,
  /** 完整審核閾值（低於此值） */
  FULL_REVIEW: 0,
} as const;

/** 必填欄位列表 */
const REQUIRED_FIELDS = [
  'invoiceNumber',
  'invoiceDate',
  'vendorName',
  'totalAmount',
  'currency',
] as const;

// ============================================================================
// Service Class
// ============================================================================

/**
 * V3.1 信心度計算服務
 *
 * @description 基於三階段架構的信心度計算服務
 *
 * @example
 * ```typescript
 * const result = await ConfidenceV3_1Service.calculate({
 *   stage1Result,
 *   stage2Result,
 *   stage3Result,
 * });
 * console.log(result.result.overallScore); // 85.5
 * console.log(result.routingDecision); // 'QUICK_REVIEW'
 * ```
 */
export class ConfidenceV3_1Service {
  /**
   * 計算 V3.1 信心度
   *
   * @param input - 三階段結果
   * @param options - 計算選項
   * @returns 信心度計算結果
   */
  static calculate(
    input: ConfidenceInputV3_1,
    options: ConfidenceCalculationOptionsV3_1 = {}
  ): ConfidenceServiceResultV3_1 {
    const startTime = Date.now();

    try {
      // 合併權重
      const weights: ConfidenceWeightsV3_1 = {
        ...DEFAULT_CONFIDENCE_WEIGHTS_V3_1,
        ...options.weights,
      };

      // 計算各維度分數
      const dimensions = this.calculateDimensions(input, weights);

      // 計算總分
      const overallScore = dimensions.reduce(
        (sum, d) => sum + d.weightedScore,
        0
      );

      // 確定信心度等級
      const level = this.determineLevel(overallScore);

      // 生成路由決策
      const routingDecision = this.generateRoutingDecision(input, overallScore);

      const result: ConfidenceResultV3_1 = {
        overallScore: Math.round(overallScore * 100) / 100,
        level,
        dimensions,
        calculatedAt: new Date(),
      };

      return {
        success: true,
        result,
        routingDecision,
        processingTimeMs: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : '計算 V3.1 信心度時發生錯誤',
        processingTimeMs: Date.now() - startTime,
      };
    }
  }

  /**
   * 計算各維度分數
   */
  private static calculateDimensions(
    input: ConfidenceInputV3_1,
    weights: ConfidenceWeightsV3_1
  ): DimensionScoreV3_1[] {
    const dimensions: DimensionScoreV3_1[] = [];
    const { stage1Result, stage2Result, stage3Result } = input;

    // 1. STAGE_1_COMPANY 維度
    const stage1Score = stage1Result.success ? stage1Result.confidence : 0;
    dimensions.push({
      dimension: 'STAGE_1_COMPANY' as ConfidenceDimensionV3_1,
      rawScore: stage1Score,
      weightedScore:
        stage1Score *
        weights['STAGE_1_COMPANY' as ConfidenceDimensionV3_1],
      weight: weights['STAGE_1_COMPANY' as ConfidenceDimensionV3_1],
    });

    // 2. STAGE_2_FORMAT 維度
    const stage2Score = stage2Result.success ? stage2Result.confidence : 0;
    dimensions.push({
      dimension: 'STAGE_2_FORMAT' as ConfidenceDimensionV3_1,
      rawScore: stage2Score,
      weightedScore:
        stage2Score *
        weights['STAGE_2_FORMAT' as ConfidenceDimensionV3_1],
      weight: weights['STAGE_2_FORMAT' as ConfidenceDimensionV3_1],
    });

    // 3. STAGE_3_EXTRACTION 維度
    const stage3Score = stage3Result.success
      ? stage3Result.overallConfidence
      : 0;
    dimensions.push({
      dimension: 'STAGE_3_EXTRACTION' as ConfidenceDimensionV3_1,
      rawScore: stage3Score,
      weightedScore:
        stage3Score *
        weights['STAGE_3_EXTRACTION' as ConfidenceDimensionV3_1],
      weight: weights['STAGE_3_EXTRACTION' as ConfidenceDimensionV3_1],
    });

    // 4. FIELD_COMPLETENESS 維度
    const fieldCompletenessScore = this.calculateFieldCompleteness(
      stage3Result.standardFields
    );
    dimensions.push({
      dimension: 'FIELD_COMPLETENESS' as ConfidenceDimensionV3_1,
      rawScore: fieldCompletenessScore,
      weightedScore:
        fieldCompletenessScore *
        weights['FIELD_COMPLETENESS' as ConfidenceDimensionV3_1],
      weight: weights['FIELD_COMPLETENESS' as ConfidenceDimensionV3_1],
    });

    // 5. CONFIG_SOURCE_BONUS 維度
    // CHANGE-032: 若 refMatch 啟用，CONFIG_SOURCE_BONUS 從 0.15 降為 0.10
    const configSourceWeight = input.refMatchEnabled
      ? Math.max(0, weights['CONFIG_SOURCE_BONUS' as ConfidenceDimensionV3_1] - 0.05)
      : weights['CONFIG_SOURCE_BONUS' as ConfidenceDimensionV3_1];
    const configSourceScore = this.calculateConfigSourceBonus(
      stage2Result.configSource
    );
    dimensions.push({
      dimension: 'CONFIG_SOURCE_BONUS' as ConfidenceDimensionV3_1,
      rawScore: configSourceScore,
      weightedScore: configSourceScore * configSourceWeight,
      weight: configSourceWeight,
    });

    // 6. CHANGE-032: REFERENCE_NUMBER_MATCH 維度（可選）
    if (input.refMatchEnabled && input.refMatchResult?.enabled) {
      const refMatchScore = this.calculateRefMatchScore(input.refMatchResult);
      const refMatchWeight = 0.05; // 從 CONFIG_SOURCE_BONUS 分出
      dimensions.push({
        dimension: 'REFERENCE_NUMBER_MATCH' as ConfidenceDimensionV3_1,
        rawScore: refMatchScore,
        weightedScore: refMatchScore * refMatchWeight,
        weight: refMatchWeight,
      });
    } else {
      // 未啟用時 weight=0，不影響計算
      dimensions.push({
        dimension: 'REFERENCE_NUMBER_MATCH' as ConfidenceDimensionV3_1,
        rawScore: 0,
        weightedScore: 0,
        weight: 0,
      });
    }

    return dimensions;
  }

  /**
   * 計算欄位完整性分數
   */
  private static calculateFieldCompleteness(
    standardFields: StandardFieldsV3
  ): number {
    let requiredFieldsCount = REQUIRED_FIELDS.length;
    let filledRequiredFieldsCount = 0;

    for (const fieldKey of REQUIRED_FIELDS) {
      const field =
        standardFields[fieldKey as keyof typeof standardFields];
      if (field && field.value !== null && field.value !== '') {
        filledRequiredFieldsCount++;
      }
    }

    return (filledRequiredFieldsCount / requiredFieldsCount) * 100;
  }

  /**
   * 計算配置來源加成
   */
  private static calculateConfigSourceBonus(
    configSource: FormatConfigSource
  ): number {
    return CONFIG_SOURCE_BONUS_SCORES[configSource] || 50;
  }

  /**
   * CHANGE-032 + FIX-036: 計算參考號碼匹配分數
   *
   * @description
   *   FIX-036: 調整分數策略，無匹配時給予懲罰性分數。
   *   注意：當 refMatchEnabled=true 且 matchesFound=0 時，
   *   pipeline 已在上游被中止，此分數計算理論上不會被觸及。
   *   但作為防禦性設計，仍給予低分。
   */
  private static calculateRefMatchScore(
    refMatchResult: import('@/types/extraction-v3.types').ReferenceNumberMatchResult
  ): number {
    const { matchesFound } = refMatchResult.summary;

    if (matchesFound > 0) {
      // 有匹配：80-100 分（依匹配數量遞增）
      return Math.min(100, 80 + matchesFound * 5);
    }

    // FIX-036: 無匹配時改為懲罰性分數（防禦性設計）
    return 0;
  }

  /**
   * 確定信心度等級
   */
  private static determineLevel(score: number): ConfidenceLevelEnum {
    if (score >= ROUTING_THRESHOLDS_V3_1.AUTO_APPROVE) {
      return ConfidenceLevelEnum.HIGH;
    } else if (score >= ROUTING_THRESHOLDS_V3_1.QUICK_REVIEW) {
      return ConfidenceLevelEnum.MEDIUM;
    } else {
      return ConfidenceLevelEnum.LOW;
    }
  }

  /**
   * 生成路由決策
   */
  private static generateRoutingDecision(
    input: ConfidenceInputV3_1,
    score: number
  ): RoutingDecisionV3_1 {
    const { stage1Result, stage2Result, stage3Result } = input;

    // 基於分數的基本路由
    let decision: 'AUTO_APPROVE' | 'QUICK_REVIEW' | 'FULL_REVIEW';

    if (score >= ROUTING_THRESHOLDS_V3_1.AUTO_APPROVE) {
      decision = 'AUTO_APPROVE';
    } else if (score >= ROUTING_THRESHOLDS_V3_1.QUICK_REVIEW) {
      decision = 'QUICK_REVIEW';
    } else {
      decision = 'FULL_REVIEW';
    }

    // 構建決策理由
    const reasons: string[] = [];

    // 基於分數的基本原因
    if (score >= ROUTING_THRESHOLDS_V3_1.AUTO_APPROVE) {
      reasons.push('整體信心度達到自動批准閾值');
    } else if (score >= ROUTING_THRESHOLDS_V3_1.QUICK_REVIEW) {
      reasons.push('整體信心度達到快速審核閾值');
    } else {
      reasons.push('整體信心度低於快速審核閾值');
    }

    // 額外檢查：新公司
    if (stage1Result.isNewCompany) {
      if (decision === 'AUTO_APPROVE') {
        decision = 'QUICK_REVIEW';
      }
      reasons.push('識別到新公司');
    }

    // 額外檢查：新格式
    if (stage2Result.isNewFormat) {
      if (decision === 'AUTO_APPROVE') {
        decision = 'QUICK_REVIEW';
      }
      reasons.push('識別到新文件格式');
    }

    // 額外檢查：LLM 推斷配置
    if (stage2Result.configSource === 'LLM_INFERRED') {
      if (decision === 'AUTO_APPROVE') {
        decision = 'QUICK_REVIEW';
      }
      reasons.push('格式由 LLM 推斷（無預設配置）');
    }

    // 額外檢查：需要分類的項目
    const itemsNeedingClassification =
      stage3Result.lineItems.filter((item) => item.needsClassification)
        .length +
      (stage3Result.extraCharges?.filter((charge) => charge.needsClassification)
        .length || 0);

    if (itemsNeedingClassification > 3 && decision === 'AUTO_APPROVE') {
      decision = 'QUICK_REVIEW';
      reasons.push(`${itemsNeedingClassification} 個項目需要人工分類`);
    }

    // 額外檢查：Stage 失敗
    if (!stage1Result.success) {
      if (decision !== 'FULL_REVIEW') {
        decision = 'FULL_REVIEW';
      }
      reasons.push('Stage 1 公司識別失敗');
    }

    if (!stage2Result.success) {
      if (decision !== 'FULL_REVIEW') {
        decision = 'FULL_REVIEW';
      }
      reasons.push('Stage 2 格式識別失敗');
    }

    if (!stage3Result.success) {
      decision = 'FULL_REVIEW';
      reasons.push('Stage 3 欄位提取失敗');
    }

    return {
      decision,
      score: Math.round(score * 100) / 100,
      threshold: ROUTING_THRESHOLDS_V3_1[decision],
      reasons,
    };
  }

  /**
   * 快速計算（不需要完整三階段結果）
   */
  static quickCalculate(
    stage1Confidence: number,
    stage2Confidence: number,
    stage3Confidence: number,
    fieldCompleteness: number,
    configSource: FormatConfigSource
  ): number {
    const weights = DEFAULT_CONFIDENCE_WEIGHTS_V3_1;
    const configSourceBonus = CONFIG_SOURCE_BONUS_SCORES[configSource] || 50;

    return (
      stage1Confidence *
        weights['STAGE_1_COMPANY' as ConfidenceDimensionV3_1] +
      stage2Confidence *
        weights['STAGE_2_FORMAT' as ConfidenceDimensionV3_1] +
      stage3Confidence *
        weights['STAGE_3_EXTRACTION' as ConfidenceDimensionV3_1] +
      fieldCompleteness *
        weights['FIELD_COMPLETENESS' as ConfidenceDimensionV3_1] +
      configSourceBonus *
        weights['CONFIG_SOURCE_BONUS' as ConfidenceDimensionV3_1]
    );
  }

  /**
   * 獲取路由閾值
   */
  static getRoutingThresholds(): typeof ROUTING_THRESHOLDS_V3_1 {
    return ROUTING_THRESHOLDS_V3_1;
  }

  /**
   * 獲取預設權重
   */
  static getDefaultWeights(): ConfidenceWeightsV3_1 {
    return { ...DEFAULT_CONFIDENCE_WEIGHTS_V3_1 };
  }

  /**
   * 獲取配置來源加成分數
   */
  static getConfigSourceBonusScores(): typeof CONFIG_SOURCE_BONUS_SCORES {
    return { ...CONFIG_SOURCE_BONUS_SCORES };
  }

  /**
   * CHANGE-025: 智能路由決策
   *
   * @description 根據智能路由標記決定審核類型
   *   - 新公司 + 新格式 → FULL_REVIEW（需人工配置公司和格式）
   *   - 新公司 → FULL_REVIEW（需人工配置公司識別規則）
   *   - 新格式 → QUICK_REVIEW（需人工配置格式映射）
   *   - DEFAULT 配置 → 根據信心度降級一級
   *   - 否則 → 標準信心度路由
   *
   * @param input - 智能路由輸入
   * @returns 智能路由輸出（審核類型 + 原因 + 配置審核標記）
   */
  static getSmartReviewType(input: SmartRoutingInput): SmartRoutingOutput {
    const { overallConfidence, isNewCompany, isNewFormat, configSource } = input;

    // 1. 新公司 + 新格式：強制 FULL_REVIEW
    if (isNewCompany && isNewFormat) {
      return {
        reviewType: 'FULL_REVIEW',
        reason: '新公司且新格式：需要人工配置公司識別規則和格式映射',
        needsConfigReview: true,
      };
    }

    // 2. 新公司：強制 FULL_REVIEW
    if (isNewCompany) {
      return {
        reviewType: 'FULL_REVIEW',
        reason: '新公司：需要人工配置公司識別規則（Logo/關鍵字）',
        needsConfigReview: true,
      };
    }

    // 3. 新格式：強制 QUICK_REVIEW
    if (isNewFormat) {
      return {
        reviewType: 'QUICK_REVIEW',
        reason: '新格式：需要人工驗證格式映射',
        needsConfigReview: true,
      };
    }

    // 4. DEFAULT 配置來源：根據信心度但降級一級
    if (configSource === 'DEFAULT') {
      const baseDecision = this.getBaseDecisionByConfidence(overallConfidence);
      const downgraded = this.downgradeDecision(baseDecision);
      return {
        reviewType: downgraded,
        reason: `使用預設配置（非公司/格式特定）：${baseDecision} → ${downgraded}`,
        needsConfigReview: false,
      };
    }

    // 5. 標準信心度路由
    const decision = this.getBaseDecisionByConfidence(overallConfidence);
    return {
      reviewType: decision,
      reason: `標準信心度路由：${overallConfidence.toFixed(1)}% (${configSource} 配置)`,
      needsConfigReview: false,
    };
  }

  /**
   * 根據信心度獲取基本決策
   */
  private static getBaseDecisionByConfidence(
    confidence: number
  ): 'AUTO_APPROVE' | 'QUICK_REVIEW' | 'FULL_REVIEW' {
    if (confidence >= ROUTING_THRESHOLDS_V3_1.AUTO_APPROVE) {
      return 'AUTO_APPROVE';
    } else if (confidence >= ROUTING_THRESHOLDS_V3_1.QUICK_REVIEW) {
      return 'QUICK_REVIEW';
    } else {
      return 'FULL_REVIEW';
    }
  }

  /**
   * 降級決策（AUTO_APPROVE → QUICK_REVIEW, QUICK_REVIEW → FULL_REVIEW）
   */
  private static downgradeDecision(
    decision: 'AUTO_APPROVE' | 'QUICK_REVIEW' | 'FULL_REVIEW'
  ): 'AUTO_APPROVE' | 'QUICK_REVIEW' | 'FULL_REVIEW' {
    switch (decision) {
      case 'AUTO_APPROVE':
        return 'QUICK_REVIEW';
      case 'QUICK_REVIEW':
        return 'FULL_REVIEW';
      case 'FULL_REVIEW':
        return 'FULL_REVIEW';
    }
  }
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * 計算 V3.1 信心度
 */
export function calculateConfidenceV3_1(
  input: ConfidenceInputV3_1,
  options?: ConfidenceCalculationOptionsV3_1
): ConfidenceServiceResultV3_1 {
  return ConfidenceV3_1Service.calculate(input, options);
}

/**
 * 快速計算 V3.1 信心度分數
 */
export function quickCalculateConfidenceV3_1(
  stage1Confidence: number,
  stage2Confidence: number,
  stage3Confidence: number,
  fieldCompleteness: number,
  configSource: FormatConfigSource
): number {
  return ConfidenceV3_1Service.quickCalculate(
    stage1Confidence,
    stage2Confidence,
    stage3Confidence,
    fieldCompleteness,
    configSource
  );
}

/**
 * 根據分數獲取 V3.1 路由決策
 */
export function getRoutingDecisionV3_1(
  score: number
): 'AUTO_APPROVE' | 'QUICK_REVIEW' | 'FULL_REVIEW' {
  if (score >= ROUTING_THRESHOLDS_V3_1.AUTO_APPROVE) {
    return 'AUTO_APPROVE';
  } else if (score >= ROUTING_THRESHOLDS_V3_1.QUICK_REVIEW) {
    return 'QUICK_REVIEW';
  } else {
    return 'FULL_REVIEW';
  }
}

/**
 * CHANGE-025: 智能路由決策
 *
 * @description 根據智能路由標記（新公司/新格式）決定審核類型
 * @param input - 智能路由輸入
 * @returns 智能路由輸出
 */
export function getSmartReviewTypeV3_1(input: SmartRoutingInput): SmartRoutingOutput {
  return ConfidenceV3_1Service.getSmartReviewType(input);
}
