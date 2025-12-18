/**
 * @fileoverview Confidence scoring type definitions
 * @description
 *   定義信心度計算相關的 TypeScript 類型：
 *   - 信心度等級（high, medium, low）
 *   - 信心度因素（OCR、規則匹配、格式驗證、歷史準確率）
 *   - 欄位信心度結果
 *   - 文件信心度結果
 *   - 閾值配置
 *
 * @module src/types/confidence
 * @since Epic 2 - Story 2.5 (Confidence Score Calculation)
 * @lastModified 2025-12-18
 */

// =====================
// Confidence Levels
// =====================

/**
 * 信心度等級
 * - high: ≥90% 自動通過
 * - medium: 70-89% 快速審核
 * - low: <70% 完整審核
 */
export type ConfidenceLevel = 'high' | 'medium' | 'low'

// =====================
// Confidence Factors
// =====================

/**
 * 信心度計算因素
 * 每個因素範圍 0-100，加權計算最終分數
 */
export interface ConfidenceFactors {
  /** OCR 識別清晰度分數 (0-100) */
  ocrConfidence: number

  /** 規則匹配精準度分數 (0-100) */
  ruleMatchScore: number

  /** 格式驗證結果分數 (0-100) */
  formatValidation: number

  /** 歷史準確率分數 (0-100) */
  historicalAccuracy: number
}

/**
 * 因素權重類型
 */
export type ConfidenceFactorWeights = {
  [K in keyof ConfidenceFactors]: number
}

// =====================
// Factor Breakdown
// =====================

/**
 * 單一因素貢獻明細
 */
export interface FactorContribution {
  /** 因素名稱 */
  factor: keyof ConfidenceFactors
  /** 因素權重 (0-1) */
  weight: number
  /** 原始分數 (0-100) */
  rawScore: number
  /** 加權後貢獻 */
  contribution: number
}

// =====================
// Field Confidence Result
// =====================

/**
 * 單一欄位信心度計算結果
 */
export interface FieldConfidenceResult {
  /** 最終加權分數 (0-100) */
  score: number

  /** 信心度等級分類 */
  level: ConfidenceLevel

  /** 個別因素分數 */
  factors: ConfidenceFactors

  /** 顯示顏色（用於 UI） */
  color: string

  /** 背景顏色（用於 UI） */
  bgColor: string

  /** 因素貢獻明細 */
  breakdown: FactorContribution[]
}

// =====================
// Document Confidence Result
// =====================

/**
 * 文件信心度統計資訊
 */
export interface DocumentConfidenceStats {
  /** 總欄位數 */
  totalFields: number
  /** 高信心度欄位數 */
  highConfidence: number
  /** 中信心度欄位數 */
  mediumConfidence: number
  /** 低信心度欄位數 */
  lowConfidence: number
  /** 平均分數 */
  averageScore: number
  /** 最低分數 */
  minScore: number
  /** 最高分數 */
  maxScore: number
}

/**
 * 處理建議類型
 */
export type ProcessingRecommendation = 'auto_approve' | 'quick_review' | 'full_review'

/**
 * 文件整體信心度結果
 */
export interface DocumentConfidenceResult {
  /** 整體分數 (0-100) */
  overallScore: number

  /** 整體信心度等級 */
  level: ConfidenceLevel

  /** 顯示顏色 */
  color: string

  /** 背景顏色 */
  bgColor: string

  /** 各欄位信心度結果 */
  fieldScores: Record<string, FieldConfidenceResult>

  /** 統計資訊 */
  stats: DocumentConfidenceStats

  /** 處理路徑建議 */
  recommendation: ProcessingRecommendation
}

// =====================
// Threshold Configuration
// =====================

/**
 * 信心度閾值配置
 */
export interface ConfidenceThreshold {
  /** 最小分數（含） */
  min: number
  /** 英文標籤 */
  label: string
  /** 中文標籤 */
  labelZh: string
  /** 顯示顏色（文字） */
  color: string
  /** 背景顏色 */
  bgColor: string
  /** 描述說明 */
  description: string
}

/**
 * 信心度閾值映射
 */
export type ConfidenceThresholds = Record<ConfidenceLevel, ConfidenceThreshold>

// =====================
// Routing Thresholds
// =====================

/**
 * 處理路徑路由閾值
 */
export interface RoutingThresholds {
  /** 自動通過閾值（≥ 此值自動批准） */
  autoApprove: number
  /** 快速審核閾值（≥ 此值進入快速審核） */
  quickReview: number
  /** 完整審核閾值（低於快速審核進入完整審核） */
  fullReview: number
}

// =====================
// Historical Data Types
// =====================

/**
 * 歷史準確度資料
 */
export interface HistoricalAccuracyData {
  /** 準確率 (0-100) */
  accuracy: number
  /** 樣本數量 */
  sampleSize: number
}

/**
 * Forwarder 欄位歷史準確度映射
 */
export type ForwarderFieldAccuracy = Record<string, HistoricalAccuracyData>

// =====================
// API Types
// =====================

/**
 * 信心度 API 響應
 */
export interface ConfidenceApiResponse {
  success: boolean
  data: DocumentConfidenceResult | null
  error?: string
}

/**
 * 信心度計算請求
 */
export interface CalculateConfidenceRequest {
  documentId: string
  /** 強制重新計算 */
  force?: boolean
}

/**
 * 重新計算信心度請求
 */
export interface RecalculateConfidenceRequest {
  documentId: string
  /** 更新後的欄位映射 */
  updatedMappings: Record<string, unknown>
}
