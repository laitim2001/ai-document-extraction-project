/**
 * @fileoverview 影響分析相關類型定義
 * @description
 *   定義規則影響範圍分析和模擬測試所需的所有類型，包括：
 *   - 風險等級和評估相關類型
 *   - 影響分析結果類型
 *   - 模擬測試請求和結果類型
 *   - UI 配置常數
 *
 * @module src/types/impact
 * @since Epic 4 - Story 4.5
 * @lastModified 2025-12-19
 */

// ===== 風險等級 =====

export type RiskLevel = 'HIGH' | 'MEDIUM' | 'LOW'

// ===== 影響分析類型 =====

export interface ImpactStatistics {
  totalAffected: number        // 受影響的歷史文件數
  estimatedImprovement: number // 預計改善數量
  estimatedRegression: number  // 可能惡化數量
  unchanged: number            // 無變化數量
  improvementRate: number      // 改善率百分比
  regressionRate: number       // 惡化率百分比
}

export interface RiskCase {
  documentId: string
  fileName: string
  currentValue: string | null
  predictedValue: string | null
  riskLevel: RiskLevel
  reason: string
}

export interface TimelineItem {
  date: string
  affectedCount: number
  improvedCount: number
  regressedCount: number
}

export interface ImpactAnalysisResult {
  suggestion: {
    id: string
    fieldName: string
    forwarderName: string
    currentPattern: string | null
    suggestedPattern: string
    extractionType: string
  }
  statistics: ImpactStatistics
  riskCases: RiskCase[]
  timeline: TimelineItem[]
  analysisDate: string
}

// ===== 影響分析 API 響應 =====

export interface ImpactAnalysisResponse {
  success: true
  data: ImpactAnalysisResult
}

// ===== 模擬測試類型 =====

export interface SimulationRequest {
  sampleSize?: number        // 默認 100
  dateRange?: {
    start: string
    end: string
  }
  includeUnverified?: boolean // 是否包含未驗證的文件
}

export interface SimulationCase {
  documentId: string
  fileName: string
  originalExtracted: string | null
  currentRuleResult: string | null
  newRuleResult: string | null
  actualValue: string | null
  currentAccurate: boolean
  newAccurate: boolean
  changeType: 'improved' | 'regressed' | 'unchanged'
}

export interface SimulationSummary {
  totalTested: number
  improvedCount: number
  regressedCount: number
  unchangedCount: number
  accuracyBefore: number | null
  accuracyAfter: number | null
  accuracyChange: number | null
}

export interface SimulationResult {
  simulationId: string
  suggestionId: string
  totalTested: number
  results: {
    improved: SimulationCase[]
    regressed: SimulationCase[]
    unchanged: SimulationCase[]
  }
  summary: SimulationSummary
  executedAt: string
  duration: number
}

// ===== 模擬測試 API 響應 =====

export interface SimulationResponse {
  success: true
  data: SimulationResult
}

// ===== 風險等級配置 =====

export const RISK_LEVELS: {
  value: RiskLevel
  label: string
  color: string
  icon: string
}[] = [
  {
    value: 'HIGH',
    label: '高風險',
    color: 'destructive',
    icon: 'AlertTriangle'
  },
  {
    value: 'MEDIUM',
    label: '中風險',
    color: 'warning',
    icon: 'AlertCircle'
  },
  {
    value: 'LOW',
    label: '低風險',
    color: 'secondary',
    icon: 'Info'
  }
]

// ===== 模擬配置選項 =====

export const SAMPLE_SIZE_OPTIONS = [
  { value: 50, label: '50 筆' },
  { value: 100, label: '100 筆（建議）' },
  { value: 200, label: '200 筆' },
  { value: 500, label: '500 筆' }
]

export const DATE_RANGE_OPTIONS = [
  { value: 7, label: '最近 7 天' },
  { value: 30, label: '最近 30 天（建議）' },
  { value: 90, label: '最近 90 天' },
  { value: 180, label: '最近 180 天' }
]

// ===== 內部類型（服務層使用）=====

/**
 * 文件資料結構（影響分析用）
 * 用於 ImpactAnalysisService 內部處理
 */
export interface DocumentWithExtractionData {
  id: string
  fileName: string
  createdAt: Date
  ocrResult: {
    extractedText: string
  } | null
  extractionResult: {
    fieldMappings: Record<string, FieldMappingValue>
  } | null
  corrections: {
    fieldName: string
    originalValue: string | null
    correctedValue: string
  }[]
}

/**
 * 欄位映射值結構
 * 對應 ExtractionResult.fieldMappings 的 Json 結構
 */
export interface FieldMappingValue {
  value: string | null
  rawValue?: string | null
  confidence: number
  source: 'tier1' | 'tier2' | 'tier3' | 'azure'
  ruleId?: string
  extractionMethod?: string
  position?: {
    page: number
    boundingBox: number[]
  }
}

/**
 * 規則模式配置
 * 用於 KEYWORD 類型的規則
 */
export interface KeywordRuleConfig {
  rules: {
    action: 'remove_prefix' | 'remove_suffix' | 'normalize' | 'extract'
    value?: string
    pattern?: string
  }[]
}
