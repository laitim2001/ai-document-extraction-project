/**
 * @fileoverview 類型定義統一導出
 * @module src/types
 * @since Epic 1 - Story 1.7
 * @lastModified 2025-12-18
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
