/**
 * @fileoverview 路由決策適配器
 * @description
 *   基於信心度計算結果決定處理路徑：
 *   - AUTO_APPROVE (≥90%): 自動通過，無需人工審核
 *   - QUICK_REVIEW (70-89%): 快速審核，一鍵確認/修正
 *   - FULL_REVIEW (<70%): 完整審核，詳細檢查所有欄位
 *
 * @module src/services/unified-processor/adapters
 * @since Epic 15 - Story 15.5 (信心度計算增強)
 * @lastModified 2026-01-03
 *
 * @features
 *   - 可配置的路由閾值
 *   - 審核優先級計算
 *   - 預估審核時間
 *   - 決策原因說明
 *
 * @related
 *   - src/types/confidence.ts - 類型定義
 *   - src/services/unified-processor/adapters/confidence-calculator-adapter.ts - 信心度計算
 *   - src/services/unified-processor/steps/routing-decision.step.ts - 使用此適配器
 */

import { type UnifiedProcessingContext, ProcessingStep } from '@/types/unified-processor';
import {
  type ConfidenceCalculationResult,
  type RoutingDecisionResult,
  type RoutingThresholds,
  RoutingDecision,
  ConfidenceLevelEnum,
  ROUTING_REVIEW_PRIORITY,
  ROUTING_ESTIMATED_TIME,
} from '@/types/confidence';

// ============================================================================
// Types
// ============================================================================

/**
 * 路由決策適配器選項
 */
export interface RoutingDecisionOptions {
  /** 自定義路由閾值 */
  thresholds?: Partial<RoutingThresholds>;
  /** 是否啟用動態閾值（根據歷史數據調整） */
  enableDynamicThresholds?: boolean;
  /** 自定義優先級映射 */
  priorityOverrides?: Partial<Record<RoutingDecision, number>>;
  /** 自定義預估時間映射（分鐘） */
  timeOverrides?: Partial<Record<RoutingDecision, number>>;
}

/**
 * 路由決策上下文（內部使用）
 */
interface DecisionContext {
  score: number;
  level: ConfidenceLevelEnum;
  hasWarnings: boolean;
  warningCount: number;
  lowDimensionCount: number;
}

// ============================================================================
// Constants
// ============================================================================

/** 預設路由閾值 */
const DEFAULT_ROUTING_THRESHOLDS: RoutingThresholds = {
  autoApprove: 90,
  quickReview: 70,
};

/** 警告閾值 - 有警告時降低路由等級的閾值 */
const WARNING_DOWNGRADE_THRESHOLD = 3;

/** 低維度分數閾值 - 單一維度低於此值視為警告 */
const LOW_DIMENSION_THRESHOLD = 50;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * 生成決策原因說明
 */
function generateDecisionReason(
  decision: RoutingDecision,
  context: DecisionContext,
  thresholds: RoutingThresholds
): string {
  const { score, level, hasWarnings, warningCount, lowDimensionCount } = context;

  const baseReasons: Record<RoutingDecision, string> = {
    [RoutingDecision.AUTO_APPROVE]: `信心度分數 ${score.toFixed(1)}% 達到自動通過閾值 (≥${thresholds.autoApprove}%)`,
    [RoutingDecision.QUICK_REVIEW]: `信心度分數 ${score.toFixed(1)}% 介於 ${thresholds.quickReview}%-${thresholds.autoApprove}%，需快速審核`,
    [RoutingDecision.FULL_REVIEW]: `信心度分數 ${score.toFixed(1)}% 低於 ${thresholds.quickReview}%，需完整審核`,
  };

  let reason = baseReasons[decision];

  // 添加警告信息
  if (hasWarnings && warningCount > 0) {
    reason += `。包含 ${warningCount} 個警告`;
  }

  // 添加低維度信息
  if (lowDimensionCount > 0) {
    reason += `，${lowDimensionCount} 個維度分數偏低`;
  }

  // 添加等級說明
  reason += `。信心度等級: ${level}`;

  return reason;
}

/**
 * 計算審核優先級
 * @description
 *   優先級範圍 1-5：
 *   - 1: 最高優先級（需要立即處理）
 *   - 5: 最低優先級（自動通過或可延後）
 */
function calculateReviewPriority(
  decision: RoutingDecision,
  context: DecisionContext,
  overrides?: Partial<Record<RoutingDecision, number>>
): number {
  // 獲取基礎優先級
  let priority = overrides?.[decision] ?? ROUTING_REVIEW_PRIORITY[decision];

  // 根據警告調整優先級
  if (context.hasWarnings && context.warningCount >= WARNING_DOWNGRADE_THRESHOLD) {
    priority = Math.max(1, priority - 1); // 提高優先級（數字越小越優先）
  }

  // 根據低維度數量調整
  if (context.lowDimensionCount >= 3) {
    priority = Math.max(1, priority - 1);
  }

  return priority;
}

/**
 * 計算預估審核時間
 */
function calculateEstimatedTime(
  decision: RoutingDecision,
  context: DecisionContext,
  overrides?: Partial<Record<RoutingDecision, number>>
): number {
  // 獲取基礎時間
  let time = overrides?.[decision] ?? ROUTING_ESTIMATED_TIME[decision];

  // 根據警告調整時間
  if (context.hasWarnings) {
    time += context.warningCount * 0.5; // 每個警告增加 0.5 分鐘
  }

  // 根據低維度數量調整
  if (context.lowDimensionCount > 0) {
    time += context.lowDimensionCount * 1; // 每個低維度增加 1 分鐘
  }

  return Math.round(time * 10) / 10; // 保留一位小數
}

// ============================================================================
// Main Adapter Class
// ============================================================================

/**
 * 路由決策適配器
 * @description
 *   根據信心度計算結果決定處理路徑：
 *   - AUTO_APPROVE: 自動通過（高信心度）
 *   - QUICK_REVIEW: 快速審核（中等信心度）
 *   - FULL_REVIEW: 完整審核（低信心度）
 */
export class RoutingDecisionAdapter {
  private thresholds: RoutingThresholds;
  private readonly enableDynamicThresholds: boolean;
  private readonly priorityOverrides?: Partial<Record<RoutingDecision, number>>;
  private readonly timeOverrides?: Partial<Record<RoutingDecision, number>>;

  constructor(options?: RoutingDecisionOptions) {
    this.thresholds = {
      ...DEFAULT_ROUTING_THRESHOLDS,
      ...options?.thresholds,
    };
    this.enableDynamicThresholds = options?.enableDynamicThresholds ?? false;
    this.priorityOverrides = options?.priorityOverrides;
    this.timeOverrides = options?.timeOverrides;
  }

  // --------------------------------------------------------------------------
  // Public Methods
  // --------------------------------------------------------------------------

  /**
   * 從 UnifiedProcessingContext 做出路由決策
   * @description 從上下文中提取信心度結果並做出決策
   */
  decideFromContext(context: UnifiedProcessingContext): RoutingDecisionResult {
    // 從步驟結果中提取信心度計算結果
    const confidenceResult = this.extractConfidenceResult(context);

    if (!confidenceResult) {
      // 如果沒有信心度結果，返回完整審核
      return this.createFallbackResult('無法獲取信心度計算結果，需要完整審核');
    }

    return this.decide(confidenceResult);
  }

  /**
   * 根據信心度計算結果做出路由決策
   */
  decide(confidenceResult: ConfidenceCalculationResult): RoutingDecisionResult {
    const { overallScore, level, hasWarnings, warnings, dimensions } = confidenceResult;

    // 計算低維度數量
    const lowDimensionCount = dimensions.filter(
      (d) => d.rawScore < LOW_DIMENSION_THRESHOLD
    ).length;

    // 構建決策上下文
    const decisionContext: DecisionContext = {
      score: overallScore,
      level,
      hasWarnings,
      warningCount: warnings.length,
      lowDimensionCount,
    };

    // 決定路由
    const decision = this.determineRouting(overallScore, decisionContext);

    // 生成決策原因
    const reason = generateDecisionReason(decision, decisionContext, this.thresholds);

    // 計算審核優先級
    const reviewPriority = calculateReviewPriority(
      decision,
      decisionContext,
      this.priorityOverrides
    );

    // 計算預估審核時間
    const estimatedReviewTime = calculateEstimatedTime(
      decision,
      decisionContext,
      this.timeOverrides
    );

    return {
      decision,
      confidenceScore: overallScore,
      confidenceLevel: level,
      reason,
      thresholds: { ...this.thresholds },
      reviewPriority,
      estimatedReviewTime,
      decidedAt: new Date(),
    };
  }

  /**
   * 獲取當前路由閾值
   */
  getThresholds(): RoutingThresholds {
    return { ...this.thresholds };
  }

  /**
   * 設置路由閾值
   */
  setThresholds(thresholds: Partial<RoutingThresholds>): void {
    this.thresholds = {
      ...this.thresholds,
      ...thresholds,
    };
  }

  /**
   * 驗證閾值配置
   * @returns 是否有效
   */
  validateThresholds(thresholds: RoutingThresholds): boolean {
    const { autoApprove, quickReview, fullReview } = thresholds;

    // 基本範圍檢查
    if (autoApprove < 0 || autoApprove > 100) return false;
    if (quickReview < 0 || quickReview > 100) return false;
    if (fullReview !== undefined && (fullReview < 0 || fullReview > 100)) return false;

    // 邏輯檢查：autoApprove > quickReview
    if (autoApprove <= quickReview) return false;

    // 如果有 fullReview，檢查 quickReview > fullReview
    if (fullReview !== undefined && quickReview <= fullReview) return false;

    return true;
  }

  /**
   * 批量決策
   * @description 對多個信心度結果進行批量路由決策
   */
  decideBatch(
    confidenceResults: ConfidenceCalculationResult[]
  ): RoutingDecisionResult[] {
    return confidenceResults.map((result) => this.decide(result));
  }

  /**
   * 獲取路由決策統計
   */
  getDecisionStats(decisions: RoutingDecisionResult[]): {
    total: number;
    autoApproveCount: number;
    quickReviewCount: number;
    fullReviewCount: number;
    autoApproveRate: number;
    averageScore: number;
    averageReviewTime: number;
  } {
    const total = decisions.length;
    if (total === 0) {
      return {
        total: 0,
        autoApproveCount: 0,
        quickReviewCount: 0,
        fullReviewCount: 0,
        autoApproveRate: 0,
        averageScore: 0,
        averageReviewTime: 0,
      };
    }

    const autoApproveCount = decisions.filter(
      (d) => d.decision === RoutingDecision.AUTO_APPROVE
    ).length;
    const quickReviewCount = decisions.filter(
      (d) => d.decision === RoutingDecision.QUICK_REVIEW
    ).length;
    const fullReviewCount = decisions.filter(
      (d) => d.decision === RoutingDecision.FULL_REVIEW
    ).length;

    const totalScore = decisions.reduce((sum, d) => sum + d.confidenceScore, 0);
    const totalTime = decisions.reduce((sum, d) => sum + d.estimatedReviewTime, 0);

    return {
      total,
      autoApproveCount,
      quickReviewCount,
      fullReviewCount,
      autoApproveRate: (autoApproveCount / total) * 100,
      averageScore: totalScore / total,
      averageReviewTime: totalTime / total,
    };
  }

  // --------------------------------------------------------------------------
  // Private Methods
  // --------------------------------------------------------------------------

  /**
   * 從 UnifiedProcessingContext 提取信心度結果
   */
  private extractConfidenceResult(
    context: UnifiedProcessingContext
  ): ConfidenceCalculationResult | null {
    // 嘗試從步驟結果中獲取
    const stepResults = context.stepResults;
    if (!stepResults || stepResults.length === 0) return null;

    // 查找 CONFIDENCE_CALCULATION 步驟的結果
    const confidenceStep = stepResults.find(
      (r) => r.step === ProcessingStep.CONFIDENCE_CALCULATION
    );
    if (confidenceStep?.success && confidenceStep.data) {
      return confidenceStep.data as ConfidenceCalculationResult;
    }

    return null;
  }

  /**
   * 決定路由策略
   */
  private determineRouting(
    score: number,
    context: DecisionContext
  ): RoutingDecision {
    const { autoApprove, quickReview } = this.thresholds;

    // 基本路由邏輯
    if (score >= autoApprove) {
      // 檢查是否有嚴重警告需要降級
      if (context.hasWarnings && context.warningCount >= WARNING_DOWNGRADE_THRESHOLD) {
        return RoutingDecision.QUICK_REVIEW;
      }
      return RoutingDecision.AUTO_APPROVE;
    }

    if (score >= quickReview) {
      return RoutingDecision.QUICK_REVIEW;
    }

    return RoutingDecision.FULL_REVIEW;
  }

  /**
   * 創建降級結果（當無法正常計算時使用）
   */
  private createFallbackResult(reason: string): RoutingDecisionResult {
    return {
      decision: RoutingDecision.FULL_REVIEW,
      confidenceScore: 0,
      confidenceLevel: ConfidenceLevelEnum.VERY_LOW,
      reason,
      thresholds: { ...this.thresholds },
      reviewPriority: 1, // 最高優先級
      estimatedReviewTime: ROUTING_ESTIMATED_TIME[RoutingDecision.FULL_REVIEW],
      decidedAt: new Date(),
    };
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

/**
 * 預設路由決策適配器實例
 */
export const routingDecisionAdapter = new RoutingDecisionAdapter();

/**
 * 創建自定義路由決策適配器
 */
export function createRoutingDecisionAdapter(
  options?: RoutingDecisionOptions
): RoutingDecisionAdapter {
  return new RoutingDecisionAdapter(options);
}
