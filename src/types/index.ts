/**
 * @fileoverview 類型定義統一導出
 * @module src/types
 * @since Epic 1 - Story 1.7
 * @lastModified 2025-12-19
 */

// 權限相關
export * from './permissions'
export * from './permission-categories'

// 用戶相關
export * from './user'

// OCR 提取相關
export * from './extraction'

// 欄位映射相關
export * from './field-mapping'
export * from './invoice-fields'

// 信心度相關
export * from './confidence'

// 審核相關
export * from './review'

// 升級相關 (Story 3.7)
export * from './escalation'

// Forwarder 管理相關 (Story 5.1)
export * from './forwarder'

// 規則管理相關 (Story 4.1)
// 注意：rule.ts 有自己的 ExtractionMethod/ExtractionPattern 定義
// 使用命名導出避免與 field-mapping.ts 衝突
export {
  type RulesQueryParams,
  type RuleListItem,
  type RulesSummary,
  type RulesListResponse,
  type RuleStats,
  type RecentApplication,
  type RuleDetail,
  type RuleDetailResponse,
  // 規則專用的類型（命名空間區分）
  type ExtractionMethod as RuleExtractionMethod,
  type ExtractionPattern as RuleExtractionPattern,
  EXTRACTION_METHODS as RULE_EXTRACTION_METHODS,
  RULE_STATUSES,
  FIELD_CATEGORIES as RULE_FIELD_CATEGORIES,
  STANDARD_FIELD_NAMES,
  getRuleStatusConfig,
  getExtractionMethodConfig,
  getStandardFieldConfig,
} from './rule'

// 規則變更請求相關 (Story 5.3)
export * from './change-request'

// 規則測試相關 (Story 5.4)
// 注意：rule-test.ts 也有 getChangeTypeConfig，使用命名導出區分
export {
  // Types
  type TestTaskStatus,
  type TestChangeType,
  type TestScope,
  type TestConfig,
  type TestResults,
  type TestDetailItem,
  type RuleTestTask,
  type StartRuleTestRequest,
  type CancelRuleTestRequest,
  type StartRuleTestResponse,
  type RuleTestTaskResponse,
  type RuleTestDetailsResponse,
  type RuleTestReportResponse,
  type TestDetailsQueryParams,
  type TestHistoryQueryParams,
  type ReportFormat,
  // Constants
  TEST_SCOPES,
  TEST_CHANGE_TYPES,
  TEST_TASK_STATUSES,
  REPORT_FORMATS,
  // Schemas
  testConfigSchema,
  startRuleTestRequestSchema,
  // Functions (renamed to avoid conflict with change-request.ts)
  getChangeTypeConfig as getTestChangeTypeConfig,
  getTaskStatusConfig,
} from './rule-test'

// 儀表板相關 (Story 7.1)
export * from './dashboard'

// 日期範圍相關 (Story 7.2)
export * from './date-range'

// 貨代商篩選相關 (Story 7.3)
export * from './forwarder-filter'
export * from './dashboard-filter'

// 區域報表相關 (Story 7.5)
// 注意：TimeGranularity 在 processing-statistics.ts 有更完整的定義
// 使用命名導出避免衝突
export {
  type CitySummary,
  type CityTrend,
  type RegionalSummary,
  type CityTrendData,
  type TopForwarderData,
  type CityDetailReport,
  type RegionalSummaryResponse,
  type CityDetailResponse,
  type RegionalReportParams,
  type RegionalExportConfig,
  TIME_GRANULARITY_OPTIONS,
  DEFAULT_TOP_FORWARDERS_LIMIT,
  REGIONAL_REPORT_CACHE_TTL,
  // 重新導出為別名以保持向後相容
  type TimeGranularity as RegionalTimeGranularity,
} from './regional-report'

// AI 成本追蹤相關 (Story 7.6)
export * from './ai-cost'

// 城市處理量統計相關 (Story 7.7)
// TimeGranularity 從這裡導出（包含 hour, day, week, month, year）
export * from './processing-statistics'

// 城市 AI 成本追蹤相關 (Story 7.8)
// 注意：AnomalyType 和 AnomalySeverity 與 ai-cost.ts 衝突
// 使用命名導出並為衝突類型添加前綴
export {
  // Story 7.8: City Cost Summary Types
  type CityCostSummary,
  type CityCostSummaryResponse,
  type CityCostTrendDataPoint,
  type CityCostTrend,
  type CityCostTrendResponse,
  type CityCostComparisonItem,
  type CityCostComparisonResponse,
  // Story 7.8: Pricing Configuration Types
  type ApiPricingConfig,
  type ApiPricingHistory,
  type PricingConfigListResponse,
  type PricingConfigDetailResponse,
  // Story 7.8: API Request Types
  type CityCostSummaryParams,
  type CityCostTrendParams,
  type CityCostComparisonParams,
  type PricingConfigListParams,
  type CreatePricingConfigRequest,
  type UpdatePricingConfigRequest,
  // Story 7.8: API Response Types
  type CityCostApiResponse,
  type CityCostApiError,
  // Story 7.8: Component Props Types
  type CityCostSummaryCardProps,
  type CityCostComparisonTableProps,
  type CityCostTrendChartProps,
  type PricingConfigTableProps,
  // Story 7.9: City Cost Report Types
  type LaborCostConfig,
  type AnomalyThresholds,
  type CostTrendPoint,
  type CostAnomalyDetail,
  type CityCostReport,
  type CityCostReportResponse,
  type CostTrendResponse,
  type AnomalyAnalysisResponse,
  type CityCostReportParams,
  type CostTrendParams,
  type AnomalyAnalysisParams,
  type CityCostTableProps,
  type CostAnomalyDialogProps,
  // Story 7.9: 衝突類型（使用別名區分）
  type AnomalyType as CityCostAnomalyType,
  type AnomalySeverity as CityCostAnomalySeverity,
  // Story 7.9: Constants
  DEFAULT_LABOR_COST_CONFIG,
  DEFAULT_ANOMALY_THRESHOLDS,
} from './city-cost'

// 月度成本分攤報告相關 (Story 7.10)
export * from './monthly-report'
