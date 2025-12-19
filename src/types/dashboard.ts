/**
 * @fileoverview 儀表板統計類型定義
 * @description
 *   定義儀表板相關的類型，包括：
 *   - 趨勢方向
 *   - 處理量統計
 *   - 百分比指標
 *   - 處理時間指標
 *   - 待審核統計
 *
 * @module src/types/dashboard
 * @author Development Team
 * @since Epic 7 - Story 7.1 (Processing Statistics Dashboard)
 * @lastModified 2025-12-19
 *
 * @related
 *   - src/services/dashboard-statistics.service.ts - 儀表板統計服務
 *   - src/app/api/dashboard/statistics/route.ts - 統計 API
 *   - src/components/dashboard/StatCard.tsx - 統計卡片組件
 */

// ============================================================
// Trend Types
// ============================================================

/**
 * 趨勢方向
 * @description 表示指標相較於上一期的變化方向
 */
export type TrendDirection = 'up' | 'down' | 'stable'

// ============================================================
// Metric Types
// ============================================================

/**
 * 處理量統計
 * @description 包含今日、本週、本月的處理量及趨勢
 */
export interface ProcessingVolume {
  /** 今日處理量 */
  today: number
  /** 本週處理量 */
  thisWeek: number
  /** 本月處理量 */
  thisMonth: number
  /** 與上月相比的趨勢 */
  trend: TrendDirection
  /** 趨勢變化百分比 */
  trendPercentage: number
}

/**
 * 百分比指標
 * @description 用於成功率、自動化率等百分比類型的指標
 */
export interface PercentageMetric {
  /** 數值 (0-100) */
  value: number
  /** 與上月相比的趨勢 */
  trend: TrendDirection
  /** 趨勢變化百分比 */
  trendPercentage: number
}

/**
 * 處理時間指標
 * @description 包含處理時間數值及格式化字串
 */
export interface ProcessingTimeMetric {
  /** 數值（秒） */
  value: number
  /** 格式化字串（如 "2m 30s"） */
  formatted: string
  /** 與上月相比的趨勢 */
  trend: TrendDirection
  /** 趨勢變化百分比 */
  trendPercentage: number
}

/**
 * 待審核統計
 * @description 包含待審核總數及緊急案件數
 */
export interface PendingReviewMetric {
  /** 待審核總數 */
  count: number
  /** 緊急案件數（超過 24 小時未處理） */
  urgent: number
}

// ============================================================
// Dashboard Statistics
// ============================================================

/**
 * 儀表板統計數據
 * @description 完整的儀表板統計結果
 */
export interface DashboardStatistics {
  /** 處理量統計 */
  processingVolume: ProcessingVolume
  /** 成功率 */
  successRate: PercentageMetric
  /** 自動化率 */
  automationRate: PercentageMetric
  /** 平均處理時間 */
  averageProcessingTime: ProcessingTimeMetric
  /** 待審核統計 */
  pendingReview: PendingReviewMetric
  /** 最後更新時間（ISO 字串） */
  lastUpdated: string
}

// ============================================================
// Query Types
// ============================================================

/**
 * 統計查詢參數
 * @description API 查詢參數
 */
export interface StatisticsQueryParams {
  /** 城市代碼列表 */
  cityCodes?: string[]
  /** 開始日期 */
  startDate?: string
  /** 結束日期 */
  endDate?: string
}

// ============================================================
// Response Types
// ============================================================

/**
 * 統計 API 響應
 * @description GET /api/dashboard/statistics 的響應格式
 */
export interface DashboardStatisticsResponse {
  /** 請求是否成功 */
  success: boolean
  /** 統計數據（成功時） */
  data?: DashboardStatistics
  /** 錯誤訊息（失敗時） */
  error?: string
}

// ============================================================
// Component Types
// ============================================================

/**
 * StatCard 變體樣式
 * @description 根據指標狀態決定卡片樣式
 */
export type StatCardVariant = 'default' | 'success' | 'warning' | 'danger'

/**
 * StatCard 組件屬性
 * @description 統計卡片組件的完整 props 定義
 */
export interface StatCardProps {
  /** 卡片標題 */
  title: string
  /** 主要數值 */
  value: string | number
  /** 副標題（如今日數量） */
  subtitle?: string
  /** 趨勢方向 */
  trend?: TrendDirection
  /** 趨勢百分比顯示 */
  trendValue?: string
  /** 圖示組件 */
  icon?: React.ReactNode
  /** 載入狀態 */
  loading?: boolean
  /** 卡片變體樣式 */
  variant?: StatCardVariant
  /** 點擊處理 */
  onClick?: () => void
  /** 自定義 className */
  className?: string
}

// ============================================================
// Cache Types
// ============================================================

/**
 * 快取項目
 * @description 內部使用的快取包裝類型
 */
export interface CacheEntry<T> {
  /** 快取數據 */
  data: T
  /** 過期時間戳（毫秒） */
  expiresAt: number
}
