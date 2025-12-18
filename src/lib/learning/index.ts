/**
 * @fileoverview 學習服務模組導出
 * @description
 *   導出修正分析和規則建議相關功能。
 *   用於 Story 3.6 的修正類型標記和 Epic 4 的規則學習。
 *
 * @module src/lib/learning
 * @since Epic 3 - Story 3.6 (修正類型標記)
 * @lastModified 2025-12-18
 */

// 修正分析器
export {
  analyzeCorrectionPattern,
  checkCorrectionThreshold,
  getMostCommonCorrection,
  getFieldCorrectionStats,
  CORRECTION_THRESHOLD,
  ANALYSIS_PERIOD_DAYS,
  type CorrectionPattern,
} from './correctionAnalyzer'

// 規則建議觸發器
export {
  triggerRuleSuggestionCheck,
  batchTriggerRuleSuggestionCheck,
  getPendingRuleSuggestions,
  type TriggerResult,
} from './ruleSuggestionTrigger'
