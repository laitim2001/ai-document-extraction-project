/**
 * @fileoverview 信心度閾值配置與輔助函數
 * @description
 *   定義信心度計算系統的核心配置：
 *   - 信心度等級閾值與顏色配置
 *   - 處理路徑路由閾值
 *   - 因素權重配置
 *   - 預設因素值
 *   - 輔助判斷函數
 *
 * @module src/lib/confidence/thresholds
 * @since Epic 2 - Story 2.5 (Confidence Score Calculation)
 * @lastModified 2025-12-18
 *
 * @related
 *   - src/types/confidence.ts - 類型定義
 *   - src/lib/confidence/calculator.ts - 計算邏輯
 *   - src/services/confidence.service.ts - 服務整合
 */

import type {
  ConfidenceLevel,
  ConfidenceThresholds,
  RoutingThresholds,
  ConfidenceFactorWeights,
  ConfidenceFactors,
  ProcessingRecommendation,
} from '@/types/confidence'

// ============================================================
// Confidence Level Thresholds
// ============================================================

/**
 * 信心度等級閾值與樣式配置
 *
 * @description
 *   定義三個信心度等級的閾值和顯示樣式：
 *   - High (≥90%): 綠色，可自動通過
 *   - Medium (70-89%): 黃色，需快速審核
 *   - Low (<70%): 紅色，需完整審核
 *
 * @example
 *   const config = CONFIDENCE_THRESHOLDS['high']
 *   // { min: 90, label: 'High Confidence', color: '#22c55e', ... }
 */
export const CONFIDENCE_THRESHOLDS: ConfidenceThresholds = {
  high: {
    min: 90,
    label: 'High Confidence',
    labelZh: '高信心',
    color: '#22c55e', // green-500
    bgColor: '#dcfce7', // green-100
    description: 'Can be auto-approved',
  },
  medium: {
    min: 70,
    label: 'Medium Confidence',
    labelZh: '中信心',
    color: '#eab308', // yellow-500
    bgColor: '#fef9c3', // yellow-100
    description: 'Needs quick review',
  },
  low: {
    min: 0,
    label: 'Low Confidence',
    labelZh: '低信心',
    color: '#ef4444', // red-500
    bgColor: '#fee2e2', // red-100
    description: 'Requires full review',
  },
} as const

// ============================================================
// Processing Path Routing Thresholds
// ============================================================

/**
 * 處理路徑路由閾值
 *
 * @description
 *   決定文件應進入哪種處理流程：
 *   - ≥95%: 自動批准，無需人工介入
 *   - 80-94%: 快速審核，一鍵確認
 *   - <80%: 完整審核，詳細檢查
 *
 * @note
 *   路由閾值與信心度等級閾值不同：
 *   - 信心度等級用於顯示（顏色分類）
 *   - 路由閾值用於決定處理流程
 */
export const ROUTING_THRESHOLDS: RoutingThresholds = {
  /** 自動批准閾值：≥95% 時自動通過 */
  autoApprove: 95,

  /** 快速審核閾值：80-94% 進入快速審核 */
  quickReview: 80,

  /** 完整審核閾值：<80% 進入完整審核 */
  fullReview: 0,
} as const

// ============================================================
// Factor Weights
// ============================================================

/**
 * 信心度因素權重配置
 *
 * @description
 *   四個因素的加權配置，總和必須等於 1.0：
 *   - OCR 信心度: 30% - Azure DI 識別品質
 *   - 規則匹配: 30% - 提取方法可靠性
 *   - 格式驗證: 25% - 資料格式正確性
 *   - 歷史準確率: 15% - 過往準確度
 *
 * @example
 *   const ocrWeight = FACTOR_WEIGHTS.ocrConfidence // 0.30
 */
export const FACTOR_WEIGHTS: ConfidenceFactorWeights = {
  /** OCR 識別清晰度權重 */
  ocrConfidence: 0.30,

  /** 規則匹配精準度權重 */
  ruleMatchScore: 0.30,

  /** 格式驗證結果權重 */
  formatValidation: 0.25,

  /** 歷史準確率權重 */
  historicalAccuracy: 0.15,
} as const

// ============================================================
// Default Factor Values
// ============================================================

/**
 * 預設因素值
 *
 * @description
 *   當某個因素無法取得時使用的預設值：
 *   - OCR 信心度: 80 (假設中等品質)
 *   - 規則匹配: 70 (假設基本匹配)
 *   - 格式驗證: 100 (假設有效，除非明確驗證失敗)
 *   - 歷史準確率: 85 (假設良好歷史，除非有資料)
 */
export const DEFAULT_FACTORS: ConfidenceFactors = {
  ocrConfidence: 80,
  ruleMatchScore: 70,
  formatValidation: 100, // 假設有效，除非驗證失敗
  historicalAccuracy: 85, // 假設良好歷史，除非有資料
} as const

// ============================================================
// Factor Labels (for UI)
// ============================================================

/**
 * 因素標籤（用於 UI 顯示）
 */
export const FACTOR_LABELS: Record<keyof ConfidenceFactors, { en: string; zh: string }> = {
  ocrConfidence: { en: 'OCR Clarity', zh: 'OCR 清晰度' },
  ruleMatchScore: { en: 'Rule Match', zh: '規則匹配' },
  formatValidation: { en: 'Format Validation', zh: '格式驗證' },
  historicalAccuracy: { en: 'Historical Accuracy', zh: '歷史準確率' },
} as const

// ============================================================
// Helper Functions
// ============================================================

/**
 * 根據分數取得信心度等級
 *
 * @param score - 信心度分數 (0-100)
 * @returns 信心度等級
 *
 * @example
 *   getConfidenceLevel(95) // 'high'
 *   getConfidenceLevel(75) // 'medium'
 *   getConfidenceLevel(50) // 'low'
 */
export function getConfidenceLevel(score: number): ConfidenceLevel {
  if (score >= CONFIDENCE_THRESHOLDS.high.min) return 'high'
  if (score >= CONFIDENCE_THRESHOLDS.medium.min) return 'medium'
  return 'low'
}

/**
 * 根據分數取得顯示顏色
 *
 * @param score - 信心度分數 (0-100)
 * @returns 顏色值 (hex)
 *
 * @example
 *   getConfidenceColor(95) // '#22c55e' (green)
 *   getConfidenceColor(75) // '#eab308' (yellow)
 *   getConfidenceColor(50) // '#ef4444' (red)
 */
export function getConfidenceColor(score: number): string {
  const level = getConfidenceLevel(score)
  return CONFIDENCE_THRESHOLDS[level].color
}

/**
 * 根據分數取得背景顏色
 *
 * @param score - 信心度分數 (0-100)
 * @returns 背景顏色值 (hex)
 */
export function getConfidenceBgColor(score: number): string {
  const level = getConfidenceLevel(score)
  return CONFIDENCE_THRESHOLDS[level].bgColor
}

/**
 * 根據分數取得處理建議
 *
 * @param score - 信心度分數 (0-100)
 * @returns 處理建議類型
 *
 * @example
 *   getProcessingRecommendation(96) // 'auto_approve'
 *   getProcessingRecommendation(85) // 'quick_review'
 *   getProcessingRecommendation(70) // 'full_review'
 */
export function getProcessingRecommendation(
  score: number
): ProcessingRecommendation {
  if (score >= ROUTING_THRESHOLDS.autoApprove) return 'auto_approve'
  if (score >= ROUTING_THRESHOLDS.quickReview) return 'quick_review'
  return 'full_review'
}

/**
 * 根據等級取得配置
 *
 * @param level - 信心度等級
 * @returns 閾值配置
 */
export function getThresholdConfig(level: ConfidenceLevel) {
  return CONFIDENCE_THRESHOLDS[level]
}

/**
 * 驗證分數是否在有效範圍內
 *
 * @param score - 要驗證的分數
 * @returns 是否為有效分數 (0-100)
 */
export function isValidScore(score: number): boolean {
  return (
    typeof score === 'number' &&
    !Number.isNaN(score) &&
    score >= 0 &&
    score <= 100
  )
}

/**
 * 限制分數在有效範圍內
 *
 * @param score - 原始分數
 * @returns 限制在 0-100 範圍內的分數
 */
export function clampScore(score: number): number {
  return Math.min(100, Math.max(0, score))
}

/**
 * 格式化分數顯示
 *
 * @param score - 信心度分數
 * @param decimals - 小數位數（預設 0）
 * @returns 格式化的百分比字串
 */
export function formatScore(score: number, decimals: number = 0): string {
  return `${score.toFixed(decimals)}%`
}
