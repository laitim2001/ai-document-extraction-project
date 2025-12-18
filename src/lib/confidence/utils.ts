/**
 * @fileoverview 信心度工具函數
 * @description
 *   提供信心度相關的格式化和描述函數：
 *   - 因素分解格式化（用於 UI 顯示）
 *   - 信心度等級描述
 *
 * @module src/lib/confidence/utils
 * @since Epic 3 - Story 3.3 (信心度顏色編碼顯示)
 * @lastModified 2025-12-18
 *
 * @related
 *   - src/lib/confidence/thresholds.ts - 閾值配置
 *   - src/types/confidence.ts - 類型定義
 */

import type { ConfidenceLevel, ConfidenceFactors } from '@/types/confidence'
import { FACTOR_WEIGHTS, FACTOR_LABELS } from './thresholds'

// ============================================================
// Types
// ============================================================

/**
 * 格式化後的信心度因素
 */
export interface FormattedConfidenceFactor {
  /** 因素鍵名 */
  key: keyof ConfidenceFactors
  /** 顯示標籤（中文） */
  label: string
  /** 因素值 (0-100) */
  value: number
  /** 權重百分比 */
  weight: string
  /** 加權後的值 */
  weightedValue: number
}

// ============================================================
// Functions
// ============================================================

/**
 * 格式化信心度因素為顯示資料
 *
 * @description
 *   將原始信心度因素資料轉換為 UI 顯示格式，
 *   包含標籤、值、權重和加權後的值。
 *
 * @param factors - 信心度因素資料
 * @returns 格式化後的因素陣列
 *
 * @example
 * ```typescript
 * const factors = {
 *   ocrConfidence: 85,
 *   ruleMatchScore: 90,
 *   formatValidation: 100,
 *   historicalAccuracy: 80
 * }
 * const formatted = formatConfidenceFactors(factors)
 * // [
 * //   { key: 'ocrConfidence', label: 'OCR 清晰度', value: 85, weight: '30%', weightedValue: 25.5 },
 * //   ...
 * // ]
 * ```
 */
export function formatConfidenceFactors(
  factors: ConfidenceFactors
): FormattedConfidenceFactor[] {
  const factorKeys: (keyof ConfidenceFactors)[] = [
    'ocrConfidence',
    'ruleMatchScore',
    'formatValidation',
    'historicalAccuracy',
  ]

  return factorKeys.map((key) => {
    const value = Math.round(factors[key])
    const weight = FACTOR_WEIGHTS[key]
    const weightedValue = Math.round(value * weight * 10) / 10

    return {
      key,
      label: FACTOR_LABELS[key].zh,
      value,
      weight: `${Math.round(weight * 100)}%`,
      weightedValue,
    }
  })
}

/**
 * 取得信心度等級描述
 *
 * @description
 *   根據信心度等級返回對應的描述文字，
 *   用於 Tooltip 或說明區塊顯示。
 *
 * @param level - 信心度等級
 * @returns 等級描述文字
 *
 * @example
 * ```typescript
 * getConfidenceDescription('high')   // '提取結果可信度高，通常無需修改'
 * getConfidenceDescription('medium') // '建議快速檢查確認'
 * getConfidenceDescription('low')    // '需要仔細檢查和可能的修正'
 * ```
 */
export function getConfidenceDescription(level: ConfidenceLevel): string {
  const descriptions: Record<ConfidenceLevel, string> = {
    high: '提取結果可信度高，通常無需修改',
    medium: '建議快速檢查確認',
    low: '需要仔細檢查和可能的修正',
  }
  return descriptions[level]
}

/**
 * 計算信心度因素的總加權分數
 *
 * @param factors - 信心度因素資料
 * @returns 總分 (0-100)
 */
export function calculateTotalScore(factors: ConfidenceFactors): number {
  const weighted =
    factors.ocrConfidence * FACTOR_WEIGHTS.ocrConfidence +
    factors.ruleMatchScore * FACTOR_WEIGHTS.ruleMatchScore +
    factors.formatValidation * FACTOR_WEIGHTS.formatValidation +
    factors.historicalAccuracy * FACTOR_WEIGHTS.historicalAccuracy

  return Math.round(weighted)
}
