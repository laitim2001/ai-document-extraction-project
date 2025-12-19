/**
 * @fileoverview 區域報表相關類型定義
 * @description
 *   定義跨城市匯總報表功能所需的所有類型：
 *   - 城市摘要與區域匯總
 *   - 城市趨勢數據
 *   - Top Forwarders 數據
 *   - API 響應類型
 *
 * @module src/types/regional-report
 * @since Epic 7 - Story 7.5 (跨城市匯總報表)
 * @lastModified 2025-12-19
 */

// ============================================================
// City Summary Types
// ============================================================

/**
 * 城市摘要數據
 */
export interface CitySummary {
  /** 城市代碼 */
  cityCode: string
  /** 城市名稱 */
  cityName: string
  /** 所屬區域 */
  region?: string
  /** 處理量 */
  processingVolume: number
  /** 成功率 (0-100) */
  successRate: number
  /** 自動化率 (0-100) */
  automationRate: number
  /** 平均處理時間（秒） */
  avgProcessingTime: number
  /** AI 成本 (USD) */
  aiCost: number
  /** 待審核數量 */
  pendingReview: number
  /** 趨勢數據 */
  trend: CityTrend
}

/**
 * 城市趨勢變化
 */
export interface CityTrend {
  /** 處理量變化百分比 */
  volumeChange: number
  /** 成功率變化 */
  successRateChange: number
  /** 成本變化百分比 */
  costChange: number
}

// ============================================================
// Regional Summary Types
// ============================================================

/**
 * 區域匯總數據
 */
export interface RegionalSummary {
  /** 城市總數 */
  totalCities: number
  /** 總處理量 */
  totalVolume: number
  /** 平均成功率 */
  avgSuccessRate: number
  /** 平均自動化率 */
  avgAutomationRate: number
  /** 總 AI 成本 */
  totalAiCost: number
  /** 各城市詳情 */
  cities: CitySummary[]
}

// ============================================================
// City Trend Data Types
// ============================================================

/**
 * 城市趨勢數據點
 */
export interface CityTrendData {
  /** 日期 */
  date: string
  /** 處理量 */
  volume: number
  /** 成功率 */
  successRate: number
  /** 自動化率 */
  automationRate: number
  /** AI 成本 */
  aiCost: number
}

// ============================================================
// Forwarder Data Types
// ============================================================

/**
 * Top Forwarder 數據
 */
export interface TopForwarderData {
  /** Forwarder 代碼 */
  code: string
  /** Forwarder 名稱 */
  name: string
  /** 處理量 */
  volume: number
  /** 成功率 */
  successRate: number
}

// ============================================================
// City Detail Types
// ============================================================

/**
 * 城市詳情報表
 */
export interface CityDetailReport {
  /** 城市代碼 */
  cityCode: string
  /** 城市名稱 */
  cityName: string
  /** 摘要數據 */
  summary: CitySummary
  /** 趨勢數據 */
  trend: CityTrendData[]
  /** Top Forwarders */
  topForwarders: TopForwarderData[]
}

// ============================================================
// Time Granularity
// ============================================================

/**
 * 時間聚合粒度
 */
export type TimeGranularity = 'day' | 'week' | 'month'

// ============================================================
// API Response Types
// ============================================================

/**
 * 區域報表 API 響應
 */
export interface RegionalSummaryResponse {
  success: boolean
  data?: RegionalSummary
  error?: string
}

/**
 * 城市詳情 API 響應
 */
export interface CityDetailResponse {
  success: boolean
  data?: CityDetailReport
  error?: string
}

// ============================================================
// Query Parameters
// ============================================================

/**
 * 區域報表查詢參數
 */
export interface RegionalReportParams {
  /** 開始日期 */
  startDate: string
  /** 結束日期 */
  endDate: string
  /** 時間粒度 */
  granularity?: TimeGranularity
}

// ============================================================
// Export Configuration
// ============================================================

/**
 * 區域報表匯出配置
 */
export interface RegionalExportConfig {
  /** 日期範圍 */
  dateRange: {
    startDate: string
    endDate: string
  }
  /** 匯出格式 */
  format: 'xlsx' | 'csv'
  /** 包含的城市代碼（空則全部） */
  cityCodes?: string[]
  /** 是否包含趨勢數據 */
  includeTrend?: boolean
  /** 是否包含 Top Forwarders */
  includeForwarders?: boolean
}

// ============================================================
// Constants
// ============================================================

/**
 * 時間粒度選項
 */
export const TIME_GRANULARITY_OPTIONS = [
  { value: 'day' as const, label: '按日' },
  { value: 'week' as const, label: '按週' },
  { value: 'month' as const, label: '按月' }
]

/**
 * 預設 Top Forwarders 數量
 */
export const DEFAULT_TOP_FORWARDERS_LIMIT = 5

/**
 * 區域報表快取時間（秒）
 */
export const REGIONAL_REPORT_CACHE_TTL = 600 // 10 分鐘
