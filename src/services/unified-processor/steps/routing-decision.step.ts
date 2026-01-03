/**
 * @fileoverview Step 11: 路由決策（增強版）
 * @description
 *   根據信心度計算結果決定審核路由：
 *   - AUTO_APPROVE (≥90%): 自動通過，無需人工審核
 *   - QUICK_REVIEW (70-89%): 快速審核，一鍵確認/修正
 *   - FULL_REVIEW (<70%): 完整審核，詳細檢查所有欄位
 *
 *   增強功能：
 *   - 動態審核優先級計算
 *   - 預估審核時間
 *   - 詳細決策原因說明
 *   - 與 RoutingDecisionAdapter 整合
 *
 * @module src/services/unified-processor/steps
 * @since Epic 15 - Story 15.1
 * @lastModified 2026-01-03
 *
 * @features
 *   - 可配置的路由閾值
 *   - 審核優先級計算
 *   - 預估審核時間
 *   - 決策原因說明
 *
 * @related
 *   - src/services/unified-processor/adapters/routing-decision-adapter.ts
 *   - src/services/unified-processor/steps/confidence-calculation.step.ts
 *   - src/types/confidence.ts
 */

import {
  ProcessingStep,
  StepPriority,
  StepConfig,
  StepResult,
  UnifiedProcessingContext,
  UnifiedProcessorFlags,
  UnifiedRoutingDecision,
} from '@/types/unified-processor';
import {
  type ConfidenceCalculationResult,
  type RoutingDecisionResult,
  type RoutingThresholds,
  RoutingDecision,
  ConfidenceLevelEnum,
  ConfigSource,
} from '@/types/confidence';
import { BaseStepHandler } from '../interfaces/step-handler.interface';
import {
  RoutingDecisionAdapter,
  type RoutingDecisionOptions,
} from '../adapters/routing-decision-adapter';

// ============================================================================
// Types
// ============================================================================

/**
 * 路由決策步驟配置
 */
export interface RoutingDecisionStepConfig extends StepConfig {
  /** 路由決策適配器選項 */
  decisionOptions?: RoutingDecisionOptions;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * 將新版 RoutingDecision 轉換為舊版 UnifiedRoutingDecision
 */
function toUnifiedRoutingDecision(
  decision: RoutingDecision
): UnifiedRoutingDecision {
  switch (decision) {
    case RoutingDecision.AUTO_APPROVE:
      return UnifiedRoutingDecision.AUTO_APPROVE;
    case RoutingDecision.QUICK_REVIEW:
      return UnifiedRoutingDecision.QUICK_REVIEW;
    case RoutingDecision.FULL_REVIEW:
      return UnifiedRoutingDecision.FULL_REVIEW;
    default:
      return UnifiedRoutingDecision.FULL_REVIEW;
  }
}

// ============================================================================
// Step Implementation
// ============================================================================

/**
 * 路由決策步驟（增強版）
 * @description
 *   使用 RoutingDecisionAdapter 根據信心度計算結果決定處理路徑：
 *   1. 從上下文獲取信心度計算結果
 *   2. 使用適配器決定路由策略
 *   3. 計算審核優先級和預估時間
 *   4. 將結果寫入上下文
 */
export class RoutingDecisionStep extends BaseStepHandler {
  readonly step = ProcessingStep.ROUTING_DECISION;
  readonly priority = StepPriority.REQUIRED;

  private readonly decider: RoutingDecisionAdapter;

  constructor(config: RoutingDecisionStepConfig) {
    super(config);

    // 創建路由決策適配器
    this.decider = new RoutingDecisionAdapter(config.decisionOptions);
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
      // 獲取信心度計算結果
      const confidenceResult = this.getConfidenceResult(context);

      // 使用適配器決定路由
      const routingResult = this.decider.decide(confidenceResult);

      // 生成增強的決策理由（包含上下文信息）
      const enhancedReason = this.enhanceReason(routingResult, context);

      // 更新上下文
      this.updateContext(context, routingResult);

      // 返回結果
      return this.createSuccessResult(
        {
          routingDecision: toUnifiedRoutingDecision(routingResult.decision),
          decision: routingResult.decision,
          confidenceScore: routingResult.confidenceScore,
          confidenceLevel: routingResult.confidenceLevel,
          reviewPriority: routingResult.reviewPriority,
          estimatedReviewTime: routingResult.estimatedReviewTime,
          reasoning: enhancedReason,
          thresholds: routingResult.thresholds,
          // 向下兼容
          confidence: routingResult.confidenceScore / 100,
        },
        startTime
      );
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      return this.createFailedResult(startTime, err);
    }
  }

  /**
   * 從上下文獲取信心度計算結果
   */
  private getConfidenceResult(
    context: UnifiedProcessingContext
  ): ConfidenceCalculationResult {
    // 嘗試從步驟結果陣列獲取
    const stepResult = context.stepResults?.find(
      (r) => r.step === ProcessingStep.CONFIDENCE_CALCULATION
    );
    if (stepResult?.success && stepResult.data) {
      return stepResult.data as ConfidenceCalculationResult;
    }

    // 備選：從上下文的 overallConfidence 創建最小結果
    const score = (context.overallConfidence ?? 0) * 100;

    return {
      overallScore: score,
      level: this.scoreToLevel(score),
      dimensions: [],
      configSourceBonus: 0,
      configSource: ConfigSource.DEFAULT,
      calculatedAt: new Date(),
      hasWarnings: (context.warnings?.length ?? 0) > 0,
      warnings: context.warnings?.map((w) => w.message ?? String(w)) ?? [],
    };
  }

  /**
   * 將分數轉換為信心度等級
   */
  private scoreToLevel(score: number): ConfidenceLevelEnum {
    if (score >= 95) return ConfidenceLevelEnum.VERY_HIGH;
    if (score >= 85) return ConfidenceLevelEnum.HIGH;
    if (score >= 70) return ConfidenceLevelEnum.MEDIUM;
    if (score >= 50) return ConfidenceLevelEnum.LOW;
    return ConfidenceLevelEnum.VERY_LOW;
  }

  /**
   * 增強決策理由（添加上下文信息）
   */
  private enhanceReason(
    result: RoutingDecisionResult,
    context: UnifiedProcessingContext
  ): string {
    const parts: string[] = [result.reason];

    // 新公司檢測
    if (context.isNewCompany) {
      parts.push('偵測到新公司，可能需要額外驗證');
    }

    // 新格式檢測
    if (context.isNewFormat) {
      parts.push('偵測到新文件格式，可能需要配置格式');
    }

    // 警告數量
    if (context.warnings && context.warnings.length > 0) {
      parts.push(`處理過程中產生 ${context.warnings.length} 個警告`);
    }

    // 未映射欄位
    if (context.unmappedFields && context.unmappedFields.length > 0) {
      parts.push(`有 ${context.unmappedFields.length} 個未映射欄位`);
    }

    // 審核時間提示
    if (result.estimatedReviewTime > 0) {
      parts.push(`預估審核時間約 ${result.estimatedReviewTime} 分鐘`);
    }

    return parts.join('。');
  }

  /**
   * 更新處理上下文
   */
  private updateContext(
    context: UnifiedProcessingContext,
    result: RoutingDecisionResult
  ): void {
    // 更新路由決策（使用舊版類型向下兼容）
    context.routingDecision = toUnifiedRoutingDecision(result.decision);

    // 存儲完整路由結果供其他步驟使用（透過 stepResults 陣列）
    // 注意：實際的步驟結果由 BaseStepHandler 返回，這裡只更新上下文屬性
  }

  /**
   * 獲取當前路由閾值
   */
  getThresholds(): RoutingThresholds {
    return this.decider.getThresholds();
  }

  /**
   * 設置路由閾值
   */
  setThresholds(thresholds: Partial<RoutingThresholds>): void {
    this.decider.setThresholds(thresholds);
  }
}
