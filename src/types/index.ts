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

// 審計查詢相關 (Story 8.3)
export * from './audit-query'

// 追溯功能相關 (Story 8.4)
export * from './traceability'

// 審計報告匯出相關 (Story 8.5)
// 注意：REPORT_EXPIRY_DAYS 與 monthly-report.ts 衝突，使用別名
export {
  // Types
  type AuditReportConfig,
  type AuditReportData,
  type ProcessingRecordItem,
  type ChangeHistoryItem,
  type FileListItem,
  type AuditReportJob,
  type AuditReportDownload,
  type ReportIntegrityResult,
  type CreateAuditReportRequest,
  type CreateAuditReportResponse,
  type AuditReportListParams,
  type AuditReportListResponse,
  type AuditReportJobListItem,
  type AuditReportDetailResponse,
  type DownloadReportResponse,
  type VerifyReportResponse,
  // Constants
  AUDIT_REPORT_TYPES,
  REPORT_OUTPUT_FORMATS,
  REPORT_JOB_STATUSES,
  LARGE_REPORT_THRESHOLD,
  MAX_REPORT_RECORDS,
  REPORT_EXPIRY_DAYS as AUDIT_REPORT_EXPIRY_DAYS,
  // Functions
  getReportTypeConfig,
  getOutputFormatConfig,
  getJobStatusConfig,
  isReportDownloadable,
  calculateExpiryDate,
} from './audit-report'

// 資料保留相關 (Story 8.6)
export * from './retention'

// SharePoint 整合相關 (Story 9.1, 9.2)
export * from './sharepoint'

// Outlook 整合相關 (Story 9.3)
export * from './outlook'

// 文件來源追蹤相關 (Story 9.5)
// 注意：SharePointSourceMetadata 和 OutlookSourceMetadata 已在上方導出
// 使用命名導出避免衝突
export {
  // Types
  type ManualUploadSourceMetadata,
  type ApiSourceMetadata,
  type SourceMetadata,
  type DocumentSourceInfo,
  type SourceDetails,
  type SourceTypeStats,
  type SourceTypeTrendData,
  type SourceSearchOptions,
  type SourceSearchResult,
  type DocumentWithSource,
} from './document-source.types'

// n8n 整合相關 (Story 10.1)
export * from './n8n'

// 工作流執行狀態相關 (Story 10.3)
export * from './workflow-execution'

// 工作流觸發相關 (Story 10.4)
export * from './workflow-trigger'

// 工作流錯誤相關 (Story 10.5)
export * from './workflow-error'

// 文件處理進度追蹤相關 (Story 10.6)
export * from './document-progress'

// 健康監控相關 (Story 10.7)
export * from './health-monitoring'

// 告警服務相關 (Story 10.7)
export * from './alert-service'

// 外部 API 相關 (Story 11.1)
// 注意：MAX_FILE_SIZE 與 sharepoint.ts 衝突，使用命名導出
export {
  // Submission types
  type FileUploadContent,
  type Base64Content,
  type UrlReferenceContent,
  type SubmitInvoiceRequest,
  type ProcessedFileData,
  type ClientInfo,
  SUPPORTED_MIME_TYPES,
  MAX_FILE_SIZE as EXTERNAL_API_MAX_FILE_SIZE,
  URL_FETCH_TIMEOUT,
  // Response types
  type SubmitInvoiceResponse,
  type ApiErrorResponse,
  type RateLimitErrorResponse,
  type AuthenticationErrorCode,
  type AuthorizationErrorCode,
  type ValidationErrorCode,
  type RateLimitErrorCode,
  type ServerErrorCode,
  type ExternalApiErrorCode,
  ERROR_CODES,
  getHttpStatusForErrorCode,
  getDefaultMessageForErrorCode,
  // Validation types
  base64SubmissionSchema,
  urlSubmissionSchema,
  commonParamsSchema,
  jsonRequestBodySchema,
  multipartParamsSchema,
  type Base64Submission,
  type UrlSubmission,
  type CommonParams,
  type JsonRequestBody,
  type MultipartParams,
  isSupportedMimeType,
  isFileSizeValid,
  parseMimeType,
  isValidBase64,
  inferMimeTypeFromFileName,
} from './external-api'

// API 文檔相關 (Story 11.6)
export * from './documentation'
export * from './sdk-examples'

// 警報系統相關 (Story 12-3)
// 注意：AlertSeverity, AlertStatus 與 health-monitoring.ts, alert-service.ts 衝突
// NotificationSendResult 與 alert-service.ts 衝突
// 使用命名導出避免衝突
export {
  // Condition types
  AlertConditionType,
  AlertOperator,
  NotificationChannel,
  NotificationStatus,
  // Alert Rule types
  type AlertChannelConfig,
  type CreateAlertRuleRequest,
  type UpdateAlertRuleRequest,
  type AlertRuleResponse,
  type AlertRuleListParams,
  // Alert types
  type AlertDetails,
  type MetricDataSnapshot,
  type AlertResponse,
  type AlertListParams,
  type AcknowledgeAlertRequest,
  type ResolveAlertRequest,
  // Statistics types
  type AlertStatistics,
  type AlertTrendPoint,
  // Metric types
  type MetricValue,
  type AlertEvaluationContext,
  // Notification types
  type NotificationTemplateVars,
  type SendNotificationRequest,
  // 重新導出為別名以區分
  AlertSeverity as RuleAlertSeverity,
  AlertStatus as RuleAlertStatus,
  type NotificationSendResult as RuleNotificationSendResult,
  // Re-export Prisma types
  type AlertRule,
  type Alert,
  type AlertRuleNotification,
} from './alerts'

// 系統配置管理相關 (Story 12-4)
export * from './config'

// 數據備份管理相關 (Story 12-5)
export * from './backup'
