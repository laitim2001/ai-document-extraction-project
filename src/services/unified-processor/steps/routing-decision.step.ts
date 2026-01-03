/**
 * @fileoverview Step 11: 路由決策
 * @description
 *   根據信心度決定審核路由：
 *   - AUTO_APPROVE (≥90%): 自動通過
 *   - QUICK_REVIEW (70-89%): 快速審核
 *   - FULL_REVIEW (<70%): 完整審核
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
  UnifiedRoutingDecision,
  UNIFIED_CONFIDENCE_THRESHOLDS,
} from '@/types/unified-processor';
import { BaseStepHandler } from '../interfaces/step-handler.interface';

/**
 * 路由決策步驟
 */
export class RoutingDecisionStep extends BaseStepHandler {
  readonly step = ProcessingStep.ROUTING_DECISION;
  readonly priority = StepPriority.REQUIRED;

  constructor(config: StepConfig) {
    super(config);
  }

  /**
   * 執行路由決策
   */
  protected async doExecute(
    context: UnifiedProcessingContext,
    _flags: UnifiedProcessorFlags
  ): Promise<StepResult> {
    const startTime = Date.now();

    try {
      const confidence = context.overallConfidence ?? 0;

      // 決定路由
      const routingDecision = this.determineRouting(confidence);

      // 生成路由理由
      const reasoning = this.generateReasoning(
        confidence,
        routingDecision,
        context
      );

      // 更新上下文
      context.routingDecision = routingDecision;

      return this.createSuccessResult(
        {
          routingDecision,
          confidence,
          reasoning,
          thresholds: UNIFIED_CONFIDENCE_THRESHOLDS,
        },
        startTime
      );
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      return this.createFailedResult(startTime, err);
    }
  }

  /**
   * 決定審核路由
   */
  private determineRouting(confidence: number): UnifiedRoutingDecision {
    if (confidence >= UNIFIED_CONFIDENCE_THRESHOLDS.AUTO_APPROVE) {
      return UnifiedRoutingDecision.AUTO_APPROVE;
    }

    if (confidence >= UNIFIED_CONFIDENCE_THRESHOLDS.QUICK_REVIEW) {
      return UnifiedRoutingDecision.QUICK_REVIEW;
    }

    return UnifiedRoutingDecision.FULL_REVIEW;
  }

  /**
   * 生成路由決策理由
   */
  private generateReasoning(
    confidence: number,
    decision: UnifiedRoutingDecision,
    context: UnifiedProcessingContext
  ): string {
    const confidencePercent = (confidence * 100).toFixed(1);

    const parts: string[] = [];

    // 基本信心度說明
    parts.push(`Overall confidence: ${confidencePercent}%`);

    // 決策說明
    switch (decision) {
      case UnifiedRoutingDecision.AUTO_APPROVE:
        parts.push(
          `Exceeds auto-approve threshold (${UNIFIED_CONFIDENCE_THRESHOLDS.AUTO_APPROVE * 100}%)`
        );
        break;

      case UnifiedRoutingDecision.QUICK_REVIEW:
        parts.push(
          `Within quick review range (${UNIFIED_CONFIDENCE_THRESHOLDS.QUICK_REVIEW * 100}%-${UNIFIED_CONFIDENCE_THRESHOLDS.AUTO_APPROVE * 100}%)`
        );
        break;

      case UnifiedRoutingDecision.FULL_REVIEW:
        parts.push(
          `Below quick review threshold (${UNIFIED_CONFIDENCE_THRESHOLDS.QUICK_REVIEW * 100}%)`
        );
        break;
    }

    // 額外因素
    if (context.isNewCompany) {
      parts.push('New company detected - may require additional verification');
    }

    if (context.isNewFormat) {
      parts.push('New document format detected - may need format configuration');
    }

    if (context.warnings.length > 0) {
      parts.push(`${context.warnings.length} warning(s) during processing`);
    }

    if (context.unmappedFields && context.unmappedFields.length > 0) {
      parts.push(`${context.unmappedFields.length} unmapped field(s)`);
    }

    return parts.join('. ');
  }
}
