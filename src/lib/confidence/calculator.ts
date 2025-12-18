/**
 * @fileoverview 信心度計算器
 * @description
 *   實現多因素加權信心度計算邏輯：
 *   - 欄位信心度計算（基於 OCR、規則匹配、格式驗證、歷史準確率）
 *   - 文件信心度計算（基於所有欄位的加權平均）
 *   - 關鍵欄位懲罰機制
 *
 *   計算公式：
 *   score = Σ(factor × weight)
 *   - OCR Confidence (30%)
 *   - Rule Match Score (30%)
 *   - Format Validation (25%)
 *   - Historical Accuracy (15%)
 *
 * @module src/lib/confidence/calculator
 * @since Epic 2 - Story 2.5 (Confidence Score Calculation)
 * @lastModified 2025-12-18
 *
 * @related
 *   - src/lib/confidence/thresholds.ts - 閾值配置
 *   - src/types/confidence.ts - 類型定義
 *   - src/types/field-mapping.ts - 欄位映射類型
 */

import type {
  ConfidenceFactors,
  FieldConfidenceResult,
  DocumentConfidenceResult,
  FactorContribution,
  HistoricalAccuracyData,
  ForwarderFieldAccuracy,
} from '@/types/confidence'
import type { FieldMappingResult, FieldMappings } from '@/types/field-mapping'
import {
  CONFIDENCE_THRESHOLDS,
  FACTOR_WEIGHTS,
  DEFAULT_FACTORS,
  getConfidenceLevel,
  getProcessingRecommendation,
  clampScore,
} from './thresholds'

// ============================================================
// Field Confidence Calculation
// ============================================================

/**
 * 計算單一欄位的信心度
 *
 * @description
 *   根據四個因素計算加權信心度分數：
 *   1. OCR Confidence: 來自提取結果的信心度
 *   2. Rule Match Score: 基於提取方法的可靠性
 *   3. Format Validation: 格式驗證結果
 *   4. Historical Accuracy: 歷史準確率（如有資料）
 *
 * @param fieldMapping - 欄位映射結果
 * @param historicalData - 歷史準確率資料（可選）
 * @returns 欄位信心度結果
 *
 * @example
 *   const result = calculateFieldConfidence(fieldMapping, { accuracy: 92, sampleSize: 100 })
 *   // { score: 87.5, level: 'medium', factors: {...}, breakdown: [...] }
 */
export function calculateFieldConfidence(
  fieldMapping: FieldMappingResult,
  historicalData?: HistoricalAccuracyData
): FieldConfidenceResult {
  // 收集各因素分數
  const factors = gatherFactors(fieldMapping, historicalData)

  // 計算加權分數
  const breakdown = calculateBreakdown(factors)
  const score = breakdown.reduce((sum, item) => sum + item.contribution, 0)
  const roundedScore = Math.round(score * 100) / 100

  // 決定等級
  const level = getConfidenceLevel(roundedScore)
  const config = CONFIDENCE_THRESHOLDS[level]

  return {
    score: roundedScore,
    level,
    factors,
    color: config.color,
    bgColor: config.bgColor,
    breakdown,
  }
}

/**
 * 收集信心度計算因素
 *
 * @param fieldMapping - 欄位映射結果
 * @param historicalData - 歷史準確率資料
 * @returns 信心度因素
 */
function gatherFactors(
  fieldMapping: FieldMappingResult,
  historicalData?: HistoricalAccuracyData
): ConfidenceFactors {
  // 判斷是否為空值
  const isEmpty = fieldMapping.value === null || fieldMapping.value === ''

  // OCR Confidence: 從提取結果取得
  const ocrConfidence = isEmpty ? 0 : fieldMapping.confidence || DEFAULT_FACTORS.ocrConfidence

  // Rule Match Score: 基於提取方法
  const ruleMatchScore = calculateRuleMatchScore(fieldMapping, isEmpty)

  // Format Validation: 基於驗證結果
  const formatValidation = calculateFormatValidationScore(fieldMapping, isEmpty)

  // Historical Accuracy: 從歷史資料或使用預設值
  const historicalAccuracy = historicalData
    ? adjustByHistoricalData(historicalData)
    : DEFAULT_FACTORS.historicalAccuracy

  return {
    ocrConfidence: clampScore(ocrConfidence),
    ruleMatchScore: clampScore(ruleMatchScore),
    formatValidation: clampScore(formatValidation),
    historicalAccuracy: clampScore(historicalAccuracy),
  }
}

/**
 * 計算規則匹配分數
 *
 * @description
 *   基於提取方法給予不同的基礎分數：
 *   - azure_field: 95 (Azure DI 直接提取，最可靠)
 *   - regex: 85 (正則匹配)
 *   - keyword: 70 (關鍵字提取)
 *   - position: 65 (位置提取)
 *   - llm: 75 (LLM 分類)
 *   - 其他: 50 (預設/回退)
 *
 *   如果有指定規則 ID，額外加 5 分
 */
function calculateRuleMatchScore(
  fieldMapping: FieldMappingResult,
  isEmpty: boolean
): number {
  if (isEmpty) return 0

  // 基於提取方法的分數
  const methodScores: Record<string, number> = {
    azure_field: 95, // Azure DI 直接提取
    regex: 85, // 正則匹配
    keyword: 70, // 關鍵字提取
    position: 65, // 位置提取
    llm: 75, // LLM 分類
  }

  const baseScore = methodScores[fieldMapping.extractionMethod] || 50

  // 有指定規則 ID 表示不是預設/回退
  const ruleBonus = fieldMapping.ruleId ? 5 : 0

  return baseScore + ruleBonus
}

/**
 * 計算格式驗證分數
 *
 * @description
 *   基於驗證結果計算分數：
 *   - 有效（或未驗證）: 100
 *   - 驗證失敗: -40
 *   - 有驗證錯誤訊息: -20
 *   - 空值（已提取但為 null）: -30
 */
function calculateFormatValidationScore(
  fieldMapping: FieldMappingResult,
  isEmpty: boolean
): number {
  if (isEmpty) return 0

  let score = 100

  // 驗證失敗
  if (fieldMapping.isValidated === false) {
    score -= 40
  }

  // 有驗證錯誤訊息
  if (fieldMapping.validationError) {
    score -= 20
  }

  // 已提取但值為 null（非正常情況）
  if (fieldMapping.value === null && !isEmpty) {
    score -= 30
  }

  return Math.max(0, score)
}

/**
 * 根據歷史資料調整準確率
 *
 * @description
 *   根據樣本數量給予歷史準確率不同的權重：
 *   - 樣本越多，歷史準確率越可信
 *   - 樣本少時，與預設值混合
 *
 * @param historicalData - 歷史準確率資料
 * @returns 調整後的準確率分數
 */
function adjustByHistoricalData(historicalData: HistoricalAccuracyData): number {
  const { accuracy, sampleSize } = historicalData

  // 樣本權重：100 個樣本以上時完全信任歷史資料
  const sampleWeight = Math.min(1, sampleSize / 100)

  // 混合歷史準確率與預設值
  return accuracy * sampleWeight + DEFAULT_FACTORS.historicalAccuracy * (1 - sampleWeight)
}

/**
 * 計算因素貢獻明細
 */
function calculateBreakdown(factors: ConfidenceFactors): FactorContribution[] {
  return Object.entries(FACTOR_WEIGHTS).map(([factor, weight]) => {
    const rawScore = factors[factor as keyof ConfidenceFactors]
    return {
      factor: factor as keyof ConfidenceFactors,
      weight,
      rawScore,
      contribution: rawScore * weight,
    }
  })
}

// ============================================================
// Document Confidence Calculation
// ============================================================

/**
 * 計算文件整體信心度
 *
 * @description
 *   基於所有欄位的信心度計算文件整體分數：
 *   - 計算每個欄位的信心度
 *   - 取非空欄位的平均值作為整體分數
 *   - 統計各等級欄位數量
 *
 * @param fieldMappings - 所有欄位映射結果
 * @param historicalData - 各欄位的歷史準確率資料（可選）
 * @returns 文件信心度結果
 *
 * @example
 *   const result = calculateDocumentConfidence(fieldMappings, historicalData)
 *   // { overallScore: 85.5, level: 'medium', recommendation: 'quick_review', ... }
 */
export function calculateDocumentConfidence(
  fieldMappings: FieldMappings,
  historicalData?: ForwarderFieldAccuracy
): DocumentConfidenceResult {
  const fieldScores: Record<string, FieldConfidenceResult> = {}
  const scores: number[] = []

  // 計算每個欄位的信心度
  for (const [fieldName, mapping] of Object.entries(fieldMappings)) {
    const fieldHistory = historicalData?.[fieldName]
    const result = calculateFieldConfidence(mapping, fieldHistory)
    fieldScores[fieldName] = result
    scores.push(result.score)
  }

  // 計算非空欄位的平均分數
  const nonEmptyEntries = Object.entries(fieldMappings).filter(
    ([, m]) => m.value !== null && m.value !== ''
  )
  const nonEmptyScores = nonEmptyEntries.map(([name]) => fieldScores[name].score)

  const averageScore =
    nonEmptyScores.length > 0
      ? nonEmptyScores.reduce((a, b) => a + b, 0) / nonEmptyScores.length
      : 0

  const roundedAverage = Math.round(averageScore * 100) / 100

  // 統計各等級欄位數量
  const stats = {
    totalFields: Object.keys(fieldMappings).length,
    highConfidence: Object.values(fieldScores).filter((s) => s.level === 'high').length,
    mediumConfidence: Object.values(fieldScores).filter((s) => s.level === 'medium').length,
    lowConfidence: Object.values(fieldScores).filter((s) => s.level === 'low').length,
    averageScore: roundedAverage,
    minScore: scores.length > 0 ? Math.min(...scores) : 0,
    maxScore: scores.length > 0 ? Math.max(...scores) : 0,
  }

  // 決定整體等級
  const overallLevel = getConfidenceLevel(roundedAverage)
  const config = CONFIDENCE_THRESHOLDS[overallLevel]

  return {
    overallScore: roundedAverage,
    level: overallLevel,
    color: config.color,
    bgColor: config.bgColor,
    fieldScores,
    stats,
    recommendation: getProcessingRecommendation(roundedAverage),
  }
}

/**
 * 計算加權文件信心度（含關鍵欄位懲罰）
 *
 * @description
 *   在基礎文件信心度上，對關鍵欄位（必填欄位）的低信心度進行額外懲罰：
 *   - 關鍵欄位低信心度: -5% 每個
 *   - 關鍵欄位中信心度: -2% 每個
 *
 * @param fieldMappings - 所有欄位映射結果
 * @param criticalFieldNames - 關鍵欄位名稱列表
 * @param historicalData - 各欄位的歷史準確率資料（可選）
 * @returns 調整後的文件信心度結果
 *
 * @example
 *   const criticalFields = ['invoice_number', 'total_amount', 'invoice_date']
 *   const result = calculateWeightedDocumentConfidence(mappings, criticalFields)
 */
export function calculateWeightedDocumentConfidence(
  fieldMappings: FieldMappings,
  criticalFieldNames: string[],
  historicalData?: ForwarderFieldAccuracy
): DocumentConfidenceResult {
  const baseResult = calculateDocumentConfidence(fieldMappings, historicalData)

  // 計算關鍵欄位懲罰
  let penalty = 0
  for (const fieldName of criticalFieldNames) {
    const fieldScore = baseResult.fieldScores[fieldName]
    if (fieldScore) {
      if (fieldScore.level === 'low') {
        penalty += 5 // 5% 懲罰
      } else if (fieldScore.level === 'medium') {
        penalty += 2 // 2% 懲罰
      }
    }
  }

  // 應用懲罰
  const adjustedScore = Math.max(0, baseResult.overallScore - penalty)
  const roundedScore = Math.round(adjustedScore * 100) / 100
  const adjustedLevel = getConfidenceLevel(roundedScore)
  const config = CONFIDENCE_THRESHOLDS[adjustedLevel]

  return {
    ...baseResult,
    overallScore: roundedScore,
    level: adjustedLevel,
    color: config.color,
    bgColor: config.bgColor,
    recommendation: getProcessingRecommendation(roundedScore),
  }
}

// ============================================================
// Utility Functions
// ============================================================

/**
 * 快速計算單一欄位的信心度分數（僅返回分數）
 *
 * @param fieldMapping - 欄位映射結果
 * @returns 信心度分數 (0-100)
 */
export function quickCalculateFieldScore(fieldMapping: FieldMappingResult): number {
  const result = calculateFieldConfidence(fieldMapping)
  return result.score
}

/**
 * 批量計算多個欄位的信心度
 *
 * @param fieldMappings - 欄位映射結果陣列
 * @param historicalData - 歷史準確率資料映射
 * @returns 欄位信心度結果陣列
 */
export function batchCalculateFieldConfidence(
  fieldMappings: Record<string, FieldMappingResult>,
  historicalData?: ForwarderFieldAccuracy
): Record<string, FieldConfidenceResult> {
  const results: Record<string, FieldConfidenceResult> = {}

  for (const [fieldName, mapping] of Object.entries(fieldMappings)) {
    const history = historicalData?.[fieldName]
    results[fieldName] = calculateFieldConfidence(mapping, history)
  }

  return results
}
