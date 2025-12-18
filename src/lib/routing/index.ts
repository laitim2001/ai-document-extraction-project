/**
 * @fileoverview 路由模組導出
 * @description
 *   統一導出處理路徑路由相關的配置、邏輯和類型。
 *
 * @module src/lib/routing
 * @since Epic 2 - Story 2.6 (Processing Path Auto Routing)
 * @lastModified 2025-12-18
 */

// ============================================================
// Configuration Exports
// ============================================================

export {
  ROUTING_CONFIG,
  PROCESSING_PATH_CONFIG,
  QUEUE_PRIORITY,
  getPathConfig,
  getPathColor,
  getPathLabel,
  isReviewRequired,
  getReviewScope,
  isCriticalField,
  getCriticalFields,
} from './config'

export type { QueuePriorityLevel } from './config'

// ============================================================
// Router Logic Exports
// ============================================================

export {
  determineProcessingPath,
  calculateQueuePriority,
  shouldAutoApprove,
  getFieldsForReview,
  getRoutingDecisionSummary,
  estimateReviewTime,
  isValidRoutingDecision,
} from './router'
