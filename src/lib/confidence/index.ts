/**
 * @fileoverview Confidence 模組統一導出
 * @description
 *   信心度計算模組的統一入口，導出所有公開的函數、類型和常數。
 *
 * @module src/lib/confidence
 * @since Epic 2 - Story 2.5 (Confidence Score Calculation)
 * @lastModified 2025-12-18
 */

// 閾值配置與輔助函數
export {
  // 常數
  CONFIDENCE_THRESHOLDS,
  ROUTING_THRESHOLDS,
  FACTOR_WEIGHTS,
  DEFAULT_FACTORS,
  FACTOR_LABELS,
  // 輔助函數
  getConfidenceLevel,
  getConfidenceColor,
  getConfidenceBgColor,
  getProcessingRecommendation,
  getThresholdConfig,
  isValidScore,
  clampScore,
  formatScore,
} from './thresholds'

// 計算器
export {
  calculateFieldConfidence,
  calculateDocumentConfidence,
  calculateWeightedDocumentConfidence,
  quickCalculateFieldScore,
  batchCalculateFieldConfidence,
} from './calculator'
