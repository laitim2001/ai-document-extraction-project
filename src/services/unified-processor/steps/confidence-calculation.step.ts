/**
 * @fileoverview Step 10: 信心度計算
 * @description
 *   計算綜合信心度分數：
 *   - 結合 Azure DI 信心度
 *   - 結合 GPT Vision 信心度
 *   - 結合欄位映射信心度
 *   - 計算加權平均
 *
 * @module src/services/unified-processor/steps
 * @since Epic 15 - Story 15.1
 * @lastModified 2026-01-03
 */

import {
  ProcessingStep,
  StepPriority,
  StepConfig,
  StepResult,
  UnifiedProcessingContext,
  UnifiedProcessorFlags,
  UNIFIED_CONFIDENCE_THRESHOLDS,
} from '@/types/unified-processor';
import { BaseStepHandler } from '../interfaces/step-handler.interface';

/**
 * 信心度來源權重配置
 */
const CONFIDENCE_WEIGHTS = {
  azureDi: 0.4,
  gptVision: 0.3,
  fieldMapping: 0.2,
  issuerMatch: 0.1,
} as const;

/**
 * 信心度計算步驟
 */
export class ConfidenceCalculationStep extends BaseStepHandler {
  readonly step = ProcessingStep.CONFIDENCE_CALCULATION;
  readonly priority = StepPriority.REQUIRED;

  constructor(config: StepConfig) {
    super(config);
  }

  /**
   * 執行信心度計算
   */
  protected async doExecute(
    context: UnifiedProcessingContext,
    flags: UnifiedProcessorFlags
  ): Promise<StepResult> {
    const startTime = Date.now();

    try {
      // 收集各來源的信心度
      const confidenceScores = this.collectConfidenceScores(context);

      // 計算加權平均
      const overallConfidence = this.calculateWeightedAverage(
        confidenceScores,
        flags.enableEnhancedConfidence
      );

      // 更新上下文
      context.overallConfidence = overallConfidence.score;
      context.confidenceBreakdown = overallConfidence.breakdown;

      return this.createSuccessResult(
        {
          overallConfidence: overallConfidence.score,
          breakdown: overallConfidence.breakdown,
          sources: Object.keys(confidenceScores),
        },
        startTime
      );
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      return this.createFailedResult(startTime, err);
    }
  }

  /**
   * 收集各來源的信心度分數
   */
  private collectConfidenceScores(
    context: UnifiedProcessingContext
  ): Record<string, number> {
    const scores: Record<string, number> = {};

    // Azure DI 信心度
    if (context.extractedData?.rawAzureResponse) {
      const azureConfidence = this.extractAzureConfidence(
        context.extractedData.rawAzureResponse as Record<string, unknown>
      );
      if (azureConfidence !== null) {
        scores.azureDi = azureConfidence;
      }
    }

    // GPT Vision 信心度
    if (context.extractedData?.gptConfidence !== undefined) {
      scores.gptVision = context.extractedData.gptConfidence as number;
    }

    // 欄位映射信心度（基於映射成功率）
    if (context.mappedFields && context.unmappedFields) {
      const mappedCount = Object.keys(context.mappedFields).length;
      const unmappedCount = context.unmappedFields.length;
      const total = mappedCount + unmappedCount;

      if (total > 0) {
        scores.fieldMapping = mappedCount / total;
      }
    }

    // 發行者匹配信心度
    if (context.extractedData?.issuerIdentification) {
      const issuerData = context.extractedData.issuerIdentification as {
        confidence?: number;
      };
      if (issuerData.confidence !== undefined) {
        scores.issuerMatch = issuerData.confidence;
      }
    }

    return scores;
  }

  /**
   * 從 Azure 響應提取平均信心度
   */
  private extractAzureConfidence(
    response: Record<string, unknown>
  ): number | null {
    // Azure DI 響應結構中的信心度欄位
    const documents = response.documents as Array<{
      fields?: Record<string, { confidence?: number }>;
    }>;

    if (!documents || documents.length === 0) {
      return null;
    }

    const fields = documents[0]?.fields;
    if (!fields) {
      return null;
    }

    const confidences: number[] = [];
    for (const field of Object.values(fields)) {
      if (typeof field.confidence === 'number') {
        confidences.push(field.confidence);
      }
    }

    if (confidences.length === 0) {
      return null;
    }

    return confidences.reduce((sum, c) => sum + c, 0) / confidences.length;
  }

  /**
   * 計算加權平均信心度
   */
  private calculateWeightedAverage(
    scores: Record<string, number>,
    enhanced: boolean
  ): {
    score: number;
    breakdown: Record<string, { score: number; weight: number; weighted: number }>;
  } {
    const breakdown: Record<
      string,
      { score: number; weight: number; weighted: number }
    > = {};

    let totalWeight = 0;
    let weightedSum = 0;

    for (const [source, score] of Object.entries(scores)) {
      const weight =
        CONFIDENCE_WEIGHTS[source as keyof typeof CONFIDENCE_WEIGHTS] ?? 0;

      if (weight > 0) {
        const weighted = score * weight;
        breakdown[source] = { score, weight, weighted };
        totalWeight += weight;
        weightedSum += weighted;
      }
    }

    // 標準化（如果只有部分來源可用）
    const normalizedScore = totalWeight > 0 ? weightedSum / totalWeight : 0;

    // 如果啟用增強計算，應用額外的調整
    let finalScore = normalizedScore;
    if (enhanced) {
      // 增強模式：考慮額外因素
      finalScore = this.applyEnhancedCalculation(normalizedScore, breakdown);
    }

    // 確保分數在 0-1 範圍內
    finalScore = Math.max(0, Math.min(1, finalScore));

    return {
      score: finalScore,
      breakdown,
    };
  }

  /**
   * 應用增強信心度計算
   * @description 考慮額外因素調整信心度
   */
  private applyEnhancedCalculation(
    baseScore: number,
    breakdown: Record<string, { score: number; weight: number; weighted: number }>
  ): number {
    let adjustedScore = baseScore;

    // 如果所有來源一致高或一致低，增加/減少信心度
    const scores = Object.values(breakdown).map((b) => b.score);
    if (scores.length >= 2) {
      const allHigh = scores.every(
        (s) => s >= UNIFIED_CONFIDENCE_THRESHOLDS.AUTO_APPROVE
      );
      const allLow = scores.every(
        (s) => s < UNIFIED_CONFIDENCE_THRESHOLDS.FULL_REVIEW
      );

      if (allHigh) {
        adjustedScore = Math.min(1, adjustedScore * 1.05); // 輕微提升
      } else if (allLow) {
        adjustedScore = adjustedScore * 0.95; // 輕微降低
      }
    }

    return adjustedScore;
  }
}
