/**
 * @fileoverview 文件路由邏輯模組
 * @description
 *   根據信心度分數決定文件的處理路徑，核心邏輯包括：
 *   - 處理路徑決策 (determineProcessingPath)
 *   - 隊列優先級計算 (calculateQueuePriority)
 *   - 自動通過判斷 (shouldAutoApprove)
 *   - 審核欄位篩選 (getFieldsForReview)
 *
 *   ## 路由決策規則
 *
 *   ```
 *   信心度 ≥ 95% → AUTO_APPROVE（自動通過）
 *   信心度 80-94% → QUICK_REVIEW（快速確認）
 *   信心度 < 80% → FULL_REVIEW（完整審核）
 *   關鍵欄位 ≥3 個低信心 → MANUAL_REQUIRED（需人工處理）
 *   ```
 *
 * @module src/lib/routing/router
 * @since Epic 2 - Story 2.6 (Processing Path Auto Routing)
 * @lastModified 2025-12-18
 *
 * @dependencies
 *   - @/types/routing - 路由類型定義
 *   - @/types/confidence - 信心度類型定義
 *   - ./config - 路由配置常數
 *
 * @related
 *   - src/services/routing.service.ts - 路由服務
 *   - src/lib/routing/config.ts - 路由配置
 *   - src/app/api/routing/ - API 端點
 */

import type { ProcessingPath, RoutingDecision } from '@/types/routing'
import type { DocumentConfidenceResult } from '@/types/confidence'
import { ROUTING_CONFIG, QUEUE_PRIORITY } from './config'

// ============================================================
// Core Routing Logic
// ============================================================

/**
 * 根據信心度結果決定處理路徑
 *
 * @description
 *   分析文件整體信心度和欄位信心度，決定最適合的處理路徑。
 *
 *   決策優先級：
 *   1. 如果 ≥3 個關鍵欄位低信心 → MANUAL_REQUIRED
 *   2. 如果整體信心度 ≥95% → AUTO_APPROVE
 *   3. 如果整體信心度 ≥80% → QUICK_REVIEW
 *   4. 否則 → FULL_REVIEW
 *
 * @param confidenceResult - 文件信心度計算結果
 * @returns 路由決策，包含路徑、原因、影響欄位等
 *
 * @example
 *   const decision = determineProcessingPath(confidenceResult)
 *   // { path: 'AUTO_APPROVE', reason: '整體信心度 96.5% >= 95%...', ... }
 */
export function determineProcessingPath(
  confidenceResult: DocumentConfidenceResult
): RoutingDecision {
  const { overallScore, fieldScores, stats } = confidenceResult
  const config = ROUTING_CONFIG

  // 獲取低信心度欄位
  const lowConfidenceFields = Object.entries(fieldScores)
    .filter(([, result]) => result.score < config.quickReviewThreshold)
    .map(([fieldName]) => fieldName)

  // 檢查關鍵欄位
  const criticalFieldsAffected = config.criticalFields.filter(
    (field) => fieldScores[field]?.score < config.quickReviewThreshold
  )

  // 決定路徑
  let path: ProcessingPath
  let reason: string

  // 檢查特殊情況：過多關鍵欄位受影響
  if (criticalFieldsAffected.length >= 3) {
    path = 'MANUAL_REQUIRED'
    reason = `${criticalFieldsAffected.length} 個關鍵欄位信心度低於 ${config.quickReviewThreshold}%，需人工處理。受影響欄位：${criticalFieldsAffected.join(', ')}`
  } else if (overallScore >= config.autoApproveThreshold) {
    // 高信心度 - 自動通過
    path = 'AUTO_APPROVE'
    reason = `整體信心度 ${overallScore.toFixed(1)}% >= ${config.autoApproveThreshold}%，自動通過。`
    if (stats) {
      reason += ` (${stats.highConfidence}/${stats.totalFields} 個欄位高信心度)`
    }
  } else if (overallScore >= config.quickReviewThreshold) {
    // 中等信心度 - 快速審核
    path = 'QUICK_REVIEW'
    reason = `整體信心度 ${overallScore.toFixed(1)}%，需確認 ${lowConfidenceFields.length} 個低信心度欄位。`
    if (criticalFieldsAffected.length > 0) {
      reason += ` 包含 ${criticalFieldsAffected.length} 個關鍵欄位。`
    }
  } else {
    // 低信心度 - 完整審核
    path = 'FULL_REVIEW'
    reason = `整體信心度 ${overallScore.toFixed(1)}% < ${config.quickReviewThreshold}%，需完整審核所有欄位。`
    if (stats) {
      reason += ` (${stats.lowConfidence} 個低信心度欄位)`
    }
  }

  return {
    path,
    reason,
    confidence: overallScore,
    lowConfidenceFields,
    criticalFieldsAffected,
    decidedAt: new Date(),
    decidedBy: 'SYSTEM',
  }
}

// ============================================================
// Priority Calculation
// ============================================================

/**
 * 計算隊列優先級
 *
 * @description
 *   根據路由決策和文件年齡計算優先級分數。
 *
 *   優先級因素：
 *   - 基礎優先級：FULL_REVIEW > QUICK_REVIEW > AUTO_APPROVE
 *   - 文件年齡加成：每過 24 小時加 5 分
 *   - 關鍵欄位加成：每個受影響關鍵欄位加 5 分
 *   - 最高上限：100
 *
 * @param decision - 路由決策
 * @param documentAge - 文件年齡（小時）
 * @returns 優先級分數 (0-100)
 *
 * @example
 *   const priority = calculateQueuePriority(decision, 36)
 *   // 75 + 5 (年齡) + 10 (2個關鍵欄位) = 90
 */
export function calculateQueuePriority(
  decision: RoutingDecision,
  documentAge: number // hours since upload
): number {
  let priority: number = QUEUE_PRIORITY.NORMAL

  // 根據處理路徑設定基礎優先級
  if (decision.path === 'FULL_REVIEW') {
    priority = QUEUE_PRIORITY.HIGH
  } else if (decision.path === 'MANUAL_REQUIRED') {
    priority = QUEUE_PRIORITY.URGENT
  }

  // 為較舊文件提升優先級
  if (ROUTING_CONFIG.priorityBoostForOlder && documentAge > 24) {
    const ageBoost = Math.min(25, Math.floor(documentAge / 24) * 5)
    priority += ageBoost
  }

  // 關鍵欄位受影響的加成
  priority += decision.criticalFieldsAffected.length * 5

  // 確保不超過上限
  return Math.min(100, priority)
}

// ============================================================
// Helper Functions
// ============================================================

/**
 * 檢查文件是否應自動通過
 *
 * @description
 *   快速判斷文件是否符合自動通過條件。
 *
 * @param confidenceResult - 文件信心度計算結果
 * @returns 是否應自動通過
 *
 * @example
 *   if (shouldAutoApprove(confidenceResult)) {
 *     // 執行自動通過邏輯
 *   }
 */
export function shouldAutoApprove(confidenceResult: DocumentConfidenceResult): boolean {
  const decision = determineProcessingPath(confidenceResult)
  return decision.path === 'AUTO_APPROVE'
}

/**
 * 根據處理路徑獲取需要審核的欄位
 *
 * @description
 *   根據路由決策的審核範圍，返回需要審核的欄位列表：
 *   - AUTO_APPROVE: 空列表（無需審核）
 *   - QUICK_REVIEW: 僅低信心度欄位
 *   - FULL_REVIEW/MANUAL_REQUIRED: 所有欄位
 *
 * @param decision - 路由決策
 * @param allFields - 所有欄位名稱列表
 * @returns 需要審核的欄位列表
 *
 * @example
 *   const fieldsToReview = getFieldsForReview(decision, ['invoiceNumber', 'totalAmount', ...])
 */
export function getFieldsForReview(
  decision: RoutingDecision,
  allFields: string[]
): string[] {
  switch (decision.path) {
    case 'AUTO_APPROVE':
      return []
    case 'QUICK_REVIEW':
      return decision.lowConfidenceFields
    case 'FULL_REVIEW':
    case 'MANUAL_REQUIRED':
      return allFields
    default:
      return allFields
  }
}

/**
 * 獲取路由決策摘要文字
 *
 * @param decision - 路由決策
 * @returns 摘要文字
 */
export function getRoutingDecisionSummary(decision: RoutingDecision): string {
  const pathLabels: Record<ProcessingPath, string> = {
    AUTO_APPROVE: '自動通過',
    QUICK_REVIEW: '快速確認',
    FULL_REVIEW: '完整審核',
    MANUAL_REQUIRED: '需人工處理',
  }

  return `${pathLabels[decision.path]}（信心度 ${decision.confidence.toFixed(1)}%）`
}

/**
 * 計算預估審核時間（分鐘）
 *
 * @description
 *   根據處理路徑和欄位數量估算審核時間
 *
 * @param decision - 路由決策
 * @param totalFields - 總欄位數
 * @returns 預估時間（分鐘）
 */
export function estimateReviewTime(
  decision: RoutingDecision,
  totalFields: number
): number {
  const baseTime: Record<ProcessingPath, number> = {
    AUTO_APPROVE: 0,
    QUICK_REVIEW: 2,
    FULL_REVIEW: 5,
    MANUAL_REQUIRED: 10,
  }

  const perFieldTime = 0.3 // 每欄位平均 0.3 分鐘

  if (decision.path === 'AUTO_APPROVE') {
    return 0
  }

  const fieldsToReview =
    decision.path === 'QUICK_REVIEW'
      ? decision.lowConfidenceFields.length
      : totalFields

  return Math.ceil(baseTime[decision.path] + fieldsToReview * perFieldTime)
}

/**
 * 驗證路由決策是否有效
 *
 * @param decision - 路由決策
 * @returns 是否有效
 */
export function isValidRoutingDecision(decision: unknown): decision is RoutingDecision {
  if (!decision || typeof decision !== 'object') {
    return false
  }

  const d = decision as Record<string, unknown>

  return (
    typeof d.path === 'string' &&
    ['AUTO_APPROVE', 'QUICK_REVIEW', 'FULL_REVIEW', 'MANUAL_REQUIRED'].includes(
      d.path as string
    ) &&
    typeof d.reason === 'string' &&
    typeof d.confidence === 'number' &&
    Array.isArray(d.lowConfidenceFields) &&
    Array.isArray(d.criticalFieldsAffected)
  )
}
