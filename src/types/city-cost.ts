/**
 * @fileoverview 城市 AI 成本追蹤類型定義
 * @description
 *   定義城市級別 AI API 成本追蹤功能所需的所有類型，包括：
 *   - 城市成本摘要與趨勢數據
 *   - 城市間成本比較
 *   - API 計價配置管理
 *   - API 請求參數與響應類型
 *   - 城市成本報表類型（Story 7-9）
 *   - 異常檢測類型
 *
 * @module src/types/city-cost
 * @since Epic 7 - Story 7.8 (城市 AI 成本追蹤)
 * @lastModified 2025-12-19
 *
 * @features
 *   - 城市成本摘要類型
 *   - 城市成本趨勢類型
 *   - 城市成本比較類型
 *   - 計價配置管理類型
 *   - 城市成本報表類型（Story 7-9）
 *   - 成本異常檢測類型（Story 7-9）
 *
 * @dependencies
 *   - @/types/ai-cost - 基礎 AI 成本類型
 *
 * @related
 *   - src/services/city-cost.service.ts - 城市成本服務
 *   - src/services/city-cost-report.service.ts - 城市成本報表服務
 *   - src/app/api/cost/ - API 路由
 *   - src/app/api/reports/city-cost/ - 成本報表 API 路由
 */

import type { ApiProviderType, Granularity, ProviderCost } from './ai-cost'

// ============================================================
// City Cost Summary Types
// ============================================================

/**
 * 城市成本摘要
 */
export interface CityCostSummary {
  /** 城市代碼 */
  cityCode: string
  /** 城市名稱 */
  cityName: string
  /** 查詢期間開始日期 */
  periodStart: string
  /** 查詢期間結束日期 */
  periodEnd: string
  /** 總成本（USD） */
  totalCost: number
  /** 總 API 呼叫次數 */
  totalCalls: number
  /** 總輸入 tokens */
  totalInputTokens: number
  /** 總輸出 tokens */
  totalOutputTokens: number
  /** 整體成功率 (0-100) */
  overallSuccessRate: number
  /** 各提供者成本明細 */
  providerBreakdown: ProviderCost[]
  /** 與上期比較的成本變化百分比 */
  costChangePercentage: number | null
  /** 與上期比較的呼叫次數變化百分比 */
  callsChangePercentage: number | null
  /** 平均每日成本 */
  averageDailyCost: number
  /** 平均每次呼叫成本 */
  averageCostPerCall: number
}

/**
 * 多城市成本摘要響應
 */
export interface CityCostSummaryResponse {
  /** 城市成本摘要列表 */
  cities: CityCostSummary[]
  /** 全部城市合計 */
  totals: {
    totalCost: number
    totalCalls: number
    totalInputTokens: number
    totalOutputTokens: number
    overallSuccessRate: number
  }
}

// ============================================================
// City Cost Trend Types
// ============================================================

/**
 * 城市成本趨勢數據點
 */
export interface CityCostTrendDataPoint {
  /** 日期 (YYYY-MM-DD) */
  date: string
  /** 總成本 */
  totalCost: number
  /** 總呼叫次數 */
  totalCalls: number
  /** 成功率 (0-100) */
  successRate: number
  /** 各提供者成本 */
  providerCosts: {
    provider: ApiProviderType
    cost: number
    calls: number
  }[]
}

/**
 * 城市成本趨勢響應
 */
export interface CityCostTrend {
  /** 城市代碼 */
  cityCode: string
  /** 城市名稱 */
  cityName: string
  /** 時間粒度 */
  granularity: Granularity
  /** 趨勢數據 */
  data: CityCostTrendDataPoint[]
  /** 期間總成本 */
  periodTotal: number
  /** 平均每日成本 */
  averageDailyCost: number
  /** 成本峰值 */
  peakCost: number
  /** 成本峰值日期 */
  peakDate: string
}

/**
 * 多城市成本趨勢響應
 */
export interface CityCostTrendResponse {
  /** 各城市趨勢 */
  cityTrends: CityCostTrend[]
  /** 時間粒度 */
  granularity: Granularity
}

// ============================================================
// City Cost Comparison Types
// ============================================================

/**
 * 城市成本比較項目
 */
export interface CityCostComparisonItem {
  /** 城市代碼 */
  cityCode: string
  /** 城市名稱 */
  cityName: string
  /** 總成本 */
  totalCost: number
  /** 總呼叫次數 */
  totalCalls: number
  /** 平均每次呼叫成本 */
  averageCostPerCall: number
  /** 成功率 (0-100) */
  successRate: number
  /** 成本佔比 (0-100) */
  costPercentage: number
  /** 呼叫量佔比 (0-100) */
  callsPercentage: number
  /** 與上期比較的成本變化百分比 */
  costChangePercentage: number | null
  /** 排名（依成本） */
  rank: number
}

/**
 * 城市成本比較響應
 */
export interface CityCostComparisonResponse {
  /** 查詢期間開始日期 */
  periodStart: string
  /** 查詢期間結束日期 */
  periodEnd: string
  /** 城市比較列表（依成本排序） */
  cities: CityCostComparisonItem[]
  /** 全部城市合計 */
  totals: {
    totalCost: number
    totalCalls: number
    averageCostPerCall: number
    overallSuccessRate: number
  }
}

// ============================================================
// Pricing Configuration Types
// ============================================================

/**
 * API 計價配置
 */
export interface ApiPricingConfig {
  /** 配置 ID */
  id: string
  /** API 提供者 */
  provider: ApiProviderType
  /** 操作類型 */
  operation: string
  /** 每次呼叫價格（可選） */
  pricePerCall: number | null
  /** 每輸入 token 價格（可選） */
  pricePerInputToken: number | null
  /** 每輸出 token 價格（可選） */
  pricePerOutputToken: number | null
  /** 貨幣 */
  currency: string
  /** 生效起始時間 */
  effectiveFrom: string
  /** 生效結束時間（可選） */
  effectiveTo: string | null
  /** 是否啟用 */
  isActive: boolean
  /** 建立時間 */
  createdAt: string
  /** 更新時間 */
  updatedAt: string
}

/**
 * 計價配置歷史記錄
 */
export interface ApiPricingHistory {
  /** 記錄 ID */
  id: string
  /** 計價配置 ID */
  pricingConfigId: string
  /** API 提供者 */
  provider: ApiProviderType
  /** 操作類型 */
  operation: string
  /** 舊的每次呼叫價格 */
  previousPricePerCall: number | null
  /** 舊的每輸入 token 價格 */
  previousPricePerInputToken: number | null
  /** 舊的每輸出 token 價格 */
  previousPricePerOutputToken: number | null
  /** 新的每次呼叫價格 */
  newPricePerCall: number | null
  /** 新的每輸入 token 價格 */
  newPricePerInputToken: number | null
  /** 新的每輸出 token 價格 */
  newPricePerOutputToken: number | null
  /** 變更者 */
  changedBy: string
  /** 變更原因 */
  changeReason: string | null
  /** 生效時間 */
  effectiveFrom: string
  /** 建立時間 */
  createdAt: string
}

/**
 * 計價配置列表響應
 */
export interface PricingConfigListResponse {
  /** 計價配置列表 */
  configs: ApiPricingConfig[]
  /** 分頁信息 */
  pagination: {
    total: number
    page: number
    limit: number
    totalPages: number
  }
}

/**
 * 計價配置詳情響應（含歷史）
 */
export interface PricingConfigDetailResponse {
  /** 計價配置 */
  config: ApiPricingConfig
  /** 變更歷史 */
  history: ApiPricingHistory[]
}

// ============================================================
// API Request Types
// ============================================================

/**
 * 城市成本摘要查詢參數
 */
export interface CityCostSummaryParams {
  /** 城市代碼（可多選） */
  cityCodes?: string[]
  /** 開始日期 */
  startDate?: string
  /** 結束日期 */
  endDate?: string
  /** 是否強制刷新快取 */
  forceRefresh?: boolean
}

/**
 * 城市成本趨勢查詢參數
 */
export interface CityCostTrendParams {
  /** 城市代碼（可多選） */
  cityCodes?: string[]
  /** 開始日期 */
  startDate: string
  /** 結束日期 */
  endDate: string
  /** 時間粒度 */
  granularity?: Granularity
  /** 提供者過濾 */
  providers?: ApiProviderType[]
}

/**
 * 城市成本比較查詢參數
 */
export interface CityCostComparisonParams {
  /** 城市代碼（可多選，留空則比較所有城市） */
  cityCodes?: string[]
  /** 開始日期 */
  startDate?: string
  /** 結束日期 */
  endDate?: string
  /** 排序方式 */
  sortBy?: 'cost' | 'calls' | 'efficiency'
  /** 排序順序 */
  sortOrder?: 'asc' | 'desc'
  /** 返回數量限制 */
  limit?: number
}

/**
 * 計價配置列表查詢參數
 */
export interface PricingConfigListParams {
  /** API 提供者過濾 */
  provider?: ApiProviderType
  /** 是否只顯示啟用的配置 */
  activeOnly?: boolean
  /** 頁碼 */
  page?: number
  /** 每頁數量 */
  limit?: number
}

/**
 * 建立計價配置請求
 */
export interface CreatePricingConfigRequest {
  /** API 提供者 */
  provider: ApiProviderType
  /** 操作類型 */
  operation: string
  /** 每次呼叫價格（可選） */
  pricePerCall?: number
  /** 每輸入 token 價格（可選） */
  pricePerInputToken?: number
  /** 每輸出 token 價格（可選） */
  pricePerOutputToken?: number
  /** 貨幣 */
  currency?: string
  /** 生效起始時間 */
  effectiveFrom: string
}

/**
 * 更新計價配置請求
 */
export interface UpdatePricingConfigRequest {
  /** 每次呼叫價格（可選） */
  pricePerCall?: number | null
  /** 每輸入 token 價格（可選） */
  pricePerInputToken?: number | null
  /** 每輸出 token 價格（可選） */
  pricePerOutputToken?: number | null
  /** 生效結束時間（可選） */
  effectiveTo?: string | null
  /** 是否啟用 */
  isActive?: boolean
  /** 變更原因 */
  changeReason?: string
}

// ============================================================
// API Response Types
// ============================================================

/**
 * 城市成本 API 成功響應
 */
export interface CityCostApiResponse<T> {
  success: true
  data: T
  meta?: {
    cached?: boolean
    cachedAt?: string
    expiresAt?: string
  }
}

/**
 * 城市成本 API 錯誤響應
 */
export interface CityCostApiError {
  success: false
  error: {
    code: string
    message: string
    details?: Record<string, unknown>
  }
}

// ============================================================
// Story 7-9: City Cost Report Types
// ============================================================

/**
 * 異常類型
 * @description 定義成本報表中可能出現的異常類型
 */
export type AnomalyType =
  | 'volume_spike'           // 處理量激增
  | 'volume_drop'            // 處理量驟降
  | 'cost_per_doc_increase'  // 單據成本上升
  | 'cost_per_doc_decrease'  // 單據成本下降
  | 'api_cost_spike'         // API 成本激增
  | 'labor_cost_spike'       // 人工成本激增
  | 'automation_rate_drop'   // 自動化率下降
  | 'unknown'                // 未知異常

/**
 * 異常嚴重度
 */
export type AnomalySeverity = 'low' | 'medium' | 'high'

/**
 * 人工成本配置
 * @description 用於估算人工審核成本的配置
 */
export interface LaborCostConfig {
  /** 手動審核每筆成本（USD） */
  manualReviewCostPerDoc: number
  /** 升級處理每筆成本（USD） */
  escalationCostPerDoc: number
  /** 間接成本係數（1.2 = 20% 額外成本） */
  overheadMultiplier: number
}

/**
 * 異常檢測閾值配置
 * @description 用於檢測成本異常的閾值設定
 */
export interface AnomalyThresholds {
  /** 成本變化閾值（百分比，預設 20%） */
  costChangeThreshold: number
  /** 處理量變化閾值（百分比，預設 50%） */
  volumeChangeThreshold: number
  /** 單據成本變化閾值（百分比，預設 15%） */
  costPerDocChangeThreshold: number
}

/**
 * 成本趨勢數據點
 * @description 用於顯示成本趨勢的單一數據點
 */
export interface CostTrendPoint {
  /** 日期 (YYYY-MM-DD) */
  date: string
  /** API 成本（USD） */
  apiCost: number
  /** 人工成本（USD，估算） */
  laborCost: number
  /** 總成本（USD） */
  totalCost: number
  /** 處理文檔數量 */
  documentCount: number
  /** 每單據成本（USD） */
  costPerDocument: number
}

/**
 * 成本異常詳情
 * @description 單一異常的完整信息
 */
export interface CostAnomalyDetail {
  /** 異常 ID */
  id: string
  /** 城市代碼 */
  cityCode: string
  /** 城市名稱 */
  cityName: string
  /** 異常類型 */
  type: AnomalyType
  /** 嚴重度 */
  severity: AnomalySeverity
  /** 異常描述 */
  description: string
  /** 當前值 */
  currentValue: number
  /** 基準值（上期或歷史平均） */
  baselineValue: number
  /** 變化百分比 */
  changePercentage: number
  /** 檢測時間 */
  detectedAt: string
  /** 受影響期間開始 */
  periodStart: string
  /** 受影響期間結束 */
  periodEnd: string
  /** 建議處理方式 */
  recommendation: string
}

/**
 * 城市成本報表
 * @description 整合 AI 成本與人工成本的城市級別報表
 */
export interface CityCostReport {
  /** 城市代碼 */
  cityCode: string
  /** 城市名稱 */
  cityName: string
  /** 報表期間開始 */
  periodStart: string
  /** 報表期間結束 */
  periodEnd: string
  /** 處理統計 */
  processing: {
    /** 總處理文檔數 */
    totalDocuments: number
    /** 自動通過數量 */
    autoApproved: number
    /** 手動審核數量 */
    manualReviewed: number
    /** 升級處理數量 */
    escalated: number
    /** 自動化率 (0-100) */
    automationRate: number
  }
  /** 成本明細 */
  costs: {
    /** API 成本（USD，實際） */
    apiCost: number
    /** 人工成本（USD，估算） */
    laborCost: number
    /** 總成本（USD） */
    totalCost: number
    /** 每單據平均成本（USD） */
    costPerDocument: number
    /** 與上期比較的變化百分比 */
    changeFromLastPeriod: number | null
  }
  /** 異常列表 */
  anomalies: CostAnomalyDetail[]
  /** 趨勢數據 */
  trend: CostTrendPoint[]
}

/**
 * 城市成本報表響應
 */
export interface CityCostReportResponse {
  /** 城市報表列表 */
  reports: CityCostReport[]
  /** 全部城市合計 */
  totals: {
    totalDocuments: number
    totalApiCost: number
    totalLaborCost: number
    totalCost: number
    averageCostPerDocument: number
    overallAutomationRate: number
  }
  /** 生成時間 */
  generatedAt: string
}

/**
 * 成本趨勢查詢響應
 */
export interface CostTrendResponse {
  /** 城市代碼 */
  cityCode: string
  /** 城市名稱 */
  cityName: string
  /** 趨勢數據 */
  trend: CostTrendPoint[]
  /** 期間統計 */
  summary: {
    totalApiCost: number
    totalLaborCost: number
    totalCost: number
    totalDocuments: number
    averageCostPerDocument: number
    peakCost: number
    peakDate: string
  }
}

/**
 * 異常分析查詢響應
 */
export interface AnomalyAnalysisResponse {
  /** 城市代碼 */
  cityCode: string
  /** 城市名稱 */
  cityName: string
  /** 異常列表 */
  anomalies: CostAnomalyDetail[]
  /** 統計摘要 */
  summary: {
    totalAnomalies: number
    highSeverityCount: number
    mediumSeverityCount: number
    lowSeverityCount: number
  }
}

// ============================================================
// Story 7-9: API Request Types
// ============================================================

/**
 * 城市成本報表查詢參數
 */
export interface CityCostReportParams {
  /** 城市代碼（可多選） */
  cityCodes?: string[]
  /** 開始日期 */
  startDate?: string
  /** 結束日期 */
  endDate?: string
  /** 是否包含趨勢數據 */
  includeTrend?: boolean
  /** 是否包含異常檢測 */
  includeAnomalies?: boolean
  /** 是否強制刷新快取 */
  forceRefresh?: boolean
}

/**
 * 成本趨勢查詢參數
 */
export interface CostTrendParams {
  /** 城市代碼 */
  cityCode: string
  /** 開始日期 */
  startDate: string
  /** 結束日期 */
  endDate: string
  /** 時間粒度 */
  granularity?: 'day' | 'week' | 'month'
}

/**
 * 異常分析查詢參數
 */
export interface AnomalyAnalysisParams {
  /** 城市代碼 */
  cityCode: string
  /** 開始日期 */
  startDate?: string
  /** 結束日期 */
  endDate?: string
  /** 嚴重度過濾 */
  severity?: AnomalySeverity[]
  /** 異常類型過濾 */
  types?: AnomalyType[]
}

// ============================================================
// Story 7-9: Default Constants
// ============================================================

/**
 * 預設人工成本配置
 */
export const DEFAULT_LABOR_COST_CONFIG: LaborCostConfig = {
  manualReviewCostPerDoc: 0.50,   // $0.50 per manual review
  escalationCostPerDoc: 2.00,     // $2.00 per escalation
  overheadMultiplier: 1.2,        // 20% overhead
}

/**
 * 預設異常檢測閾值
 */
export const DEFAULT_ANOMALY_THRESHOLDS: AnomalyThresholds = {
  costChangeThreshold: 20,         // 20% cost change
  volumeChangeThreshold: 50,       // 50% volume change
  costPerDocChangeThreshold: 15,   // 15% cost per doc change
}

// ============================================================
// Story 7-9: Component Props Types
// ============================================================

/**
 * 城市成本表格 Props
 */
export interface CityCostTableProps {
  /** 報表數據 */
  reports: CityCostReport[]
  /** 是否顯示異常標記 */
  showAnomalies?: boolean
  /** 點擊城市回調 */
  onCityClick?: (cityCode: string) => void
  /** 點擊異常回調 */
  onAnomalyClick?: (cityCode: string, anomaly: CostAnomalyDetail) => void
  /** 自定義 className */
  className?: string
}

/**
 * 成本異常對話框 Props
 */
export interface CostAnomalyDialogProps {
  /** 是否開啟 */
  open: boolean
  /** 關閉回調 */
  onClose: () => void
  /** 城市代碼 */
  cityCode: string
  /** 城市名稱 */
  cityName: string
  /** 異常列表 */
  anomalies: CostAnomalyDetail[]
  /** 是否載入中 */
  isLoading?: boolean
}

// ============================================================
// Component Props Types
// ============================================================

/**
 * 城市成本摘要卡片 Props
 */
export interface CityCostSummaryCardProps {
  /** 城市代碼 */
  cityCode: string
  /** 日期範圍（天數） */
  dateRange?: number
  /** 是否顯示趨勢 */
  showTrend?: boolean
  /** 是否顯示詳細信息連結 */
  showDetailLink?: boolean
  /** 自定義 className */
  className?: string
}

/**
 * 城市成本比較表格 Props
 */
export interface CityCostComparisonTableProps {
  /** 城市比較數據 */
  data: CityCostComparisonItem[]
  /** 是否顯示排名 */
  showRank?: boolean
  /** 是否顯示變化百分比 */
  showChange?: boolean
  /** 點擊城市回調 */
  onCityClick?: (cityCode: string) => void
  /** 自定義 className */
  className?: string
}

/**
 * 城市成本趨勢圖表 Props
 */
export interface CityCostTrendChartProps {
  /** 趨勢數據 */
  data: CityCostTrend[]
  /** 時間粒度 */
  granularity: Granularity
  /** 是否顯示多城市比較 */
  showComparison?: boolean
  /** 圖表高度 */
  height?: number
  /** 自定義 className */
  className?: string
}

/**
 * 計價配置表格 Props
 */
export interface PricingConfigTableProps {
  /** 計價配置列表 */
  configs: ApiPricingConfig[]
  /** 編輯回調 */
  onEdit?: (config: ApiPricingConfig) => void
  /** 刪除回調 */
  onDelete?: (configId: string) => void
  /** 是否允許編輯 */
  editable?: boolean
  /** 自定義 className */
  className?: string
}
