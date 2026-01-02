/**
 * @fileoverview 欄位映射相關類型定義
 * @description
 *   定義欄位映射、提取結果、信心度計算等相關類型，包括：
 *   - 提取方法類型（regex, keyword, position, azure_field）
 *   - 欄位映射結果類型
 *   - 信心度來源類型（tier1, tier2, tier3, azure）
 *   - 映射規則類型
 *   - API 請求/響應類型
 *   - [Story 13.3] 視覺化映射配置類型（轉換類型、配置範圍）
 *
 * @module src/types/field-mapping
 * @since Epic 2 - Story 2.4 (Field Mapping & Extraction)
 * @updated Epic 13 - Story 13.3 (欄位映射配置介面)
 * @lastModified 2026-01-02
 */

import type { ExtractionStatus } from '@prisma/client';

// =====================
// Extraction Methods
// =====================

/**
 * 提取方法類型
 */
export const EXTRACTION_METHODS = {
  REGEX: 'regex',
  KEYWORD: 'keyword',
  POSITION: 'position',
  AZURE_FIELD: 'azure_field',
  LLM: 'llm',
} as const;

export type ExtractionMethod = (typeof EXTRACTION_METHODS)[keyof typeof EXTRACTION_METHODS];

// =====================
// Confidence Sources (Three-Tier Architecture)
// =====================

/**
 * 信心度來源（三層架構）
 */
export const CONFIDENCE_SOURCES = {
  /** Tier 1: 通用映射規則 */
  TIER1: 'tier1',
  /** Tier 2: Forwarder 特定規則 */
  TIER2: 'tier2',
  /** Tier 3: LLM 智能分類 */
  TIER3: 'tier3',
  /** Azure Document Intelligence 直接提取 */
  AZURE: 'azure',
} as const;

export type ConfidenceSource = (typeof CONFIDENCE_SOURCES)[keyof typeof CONFIDENCE_SOURCES];

// =====================
// Confidence Thresholds
// =====================

/**
 * 信心度閾值常數
 */
export const CONFIDENCE_THRESHOLDS = {
  /** 高信心度閾值（自動通過） */
  HIGH: 90,
  /** 中等信心度閾值（快速審核） */
  MEDIUM: 70,
} as const;

/**
 * 審核類型
 */
export const REVIEW_TYPES = {
  AUTO_APPROVE: 'AUTO_APPROVE',
  QUICK_REVIEW: 'QUICK_REVIEW',
  FULL_REVIEW: 'FULL_REVIEW',
} as const;

export type ReviewType = (typeof REVIEW_TYPES)[keyof typeof REVIEW_TYPES];

/**
 * 根據信心度取得審核類型
 * @param confidence 信心度 (0-100)
 */
export function getReviewType(confidence: number): ReviewType {
  if (confidence >= CONFIDENCE_THRESHOLDS.HIGH) {
    return REVIEW_TYPES.AUTO_APPROVE;
  }
  if (confidence >= CONFIDENCE_THRESHOLDS.MEDIUM) {
    return REVIEW_TYPES.QUICK_REVIEW;
  }
  return REVIEW_TYPES.FULL_REVIEW;
}

// =====================
// Extraction Pattern Types
// =====================

/**
 * 提取模式 - 正則表達式
 */
export interface RegexExtractionPattern {
  method: 'regex';
  pattern: string;
  flags?: string;
  groupIndex?: number;
  confidenceBoost?: number;
}

/**
 * 提取模式 - 關鍵字
 */
export interface KeywordExtractionPattern {
  method: 'keyword';
  keywords: string[];
  proximityWords?: string[];
  maxDistance?: number;
  confidenceBoost?: number;
}

/**
 * 提取模式 - 位置
 */
export interface PositionExtractionPattern {
  method: 'position';
  page?: number;
  region: {
    top: number;
    left: number;
    width: number;
    height: number;
  };
  confidenceBoost?: number;
}

/**
 * 提取模式 - Azure 欄位
 */
export interface AzureFieldExtractionPattern {
  method: 'azure_field';
  azureFieldName: string;
  fallbackPattern?: string;
  confidenceBoost?: number;
}

/**
 * 提取模式聯合類型
 */
export type ExtractionPattern =
  | RegexExtractionPattern
  | KeywordExtractionPattern
  | PositionExtractionPattern
  | AzureFieldExtractionPattern;

// =====================
// Field Mapping Result Types
// =====================

/**
 * 位置資訊
 */
export interface FieldPosition {
  page: number;
  boundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

/**
 * 單一欄位映射結果
 */
export interface FieldMappingResult {
  /** 提取的值（已正規化） */
  value: string | null;
  /** 原始值 */
  rawValue: string | null;
  /** 信心度 (0-100) */
  confidence: number;
  /** 信心度來源 */
  source: ConfidenceSource;
  /** 使用的規則 ID */
  ruleId?: string;
  /** 提取方法 */
  extractionMethod: ExtractionMethod;
  /** 位置資訊 */
  position?: FieldPosition;
  /** 是否已驗證 */
  isValidated?: boolean;
  /** 驗證錯誤訊息 */
  validationError?: string;
}

/**
 * 欄位映射集合
 */
export type FieldMappings = Record<string, FieldMappingResult>;

// =====================
// Unmapped Field Tracking
// =====================

/**
 * 未映射欄位詳情
 */
export interface UnmappedFieldDetail {
  /** 未映射原因 */
  reason: string;
  /** 嘗試過的方法 */
  attempts: string[];
}

/**
 * 未映射欄位集合
 */
export type UnmappedFieldDetails = Record<string, UnmappedFieldDetail>;

// =====================
// Mapping Rule Types
// =====================

/**
 * 映射規則（用於 API 傳輸）
 */
export interface MappingRuleDTO {
  id: string;
  companyId: string | null; // REFACTOR-001: 原 forwarderId
  fieldName: string;
  fieldLabel: string;
  extractionPattern: ExtractionPattern;
  priority: number;
  isRequired: boolean;
  isActive: boolean;
  validationPattern: string | null;
  defaultValue: string | null;
  category: string | null;
  description: string | null;
}

/**
 * 建立映射規則請求
 */
export interface CreateMappingRuleRequest {
  companyId?: string; // REFACTOR-001: 原 forwarderId
  fieldName: string;
  fieldLabel: string;
  extractionPattern: ExtractionPattern;
  priority?: number;
  isRequired?: boolean;
  validationPattern?: string;
  defaultValue?: string;
  category?: string;
  description?: string;
}

/**
 * 更新映射規則請求
 */
export interface UpdateMappingRuleRequest {
  fieldLabel?: string;
  extractionPattern?: ExtractionPattern;
  priority?: number;
  isRequired?: boolean;
  isActive?: boolean;
  validationPattern?: string;
  defaultValue?: string;
  category?: string;
  description?: string;
}

// =====================
// Extraction Result Types
// =====================

/**
 * 提取結果統計
 */
export interface ExtractionStatistics {
  totalFields: number;
  mappedFields: number;
  unmappedFields: number;
  averageConfidence: number;
  processingTime: number | null;
  rulesApplied: number;
}

/**
 * 提取結果 DTO（用於 API 傳輸）
 */
export interface ExtractionResultDTO {
  id: string;
  documentId: string;
  companyId: string | null; // REFACTOR-001: 原 forwarderId
  fieldMappings: FieldMappings;
  statistics: ExtractionStatistics;
  status: ExtractionStatus;
  errorMessage: string | null;
  unmappedFieldDetails: UnmappedFieldDetails | null;
  createdAt: string;
  updatedAt: string;
}

// =====================
// API Request/Response Types
// =====================

/**
 * 欄位映射請求
 */
export interface MapFieldsRequest {
  documentId: string;
  companyId?: string; // REFACTOR-001: 原 forwarderId
  ocrResultId?: string;
  /** 強制重新處理 */
  force?: boolean;
}

/**
 * 欄位映射響應
 */
export interface MapFieldsResponse {
  success: boolean;
  data: ExtractionResultDTO;
}

/**
 * 批量映射請求
 */
export interface BatchMapFieldsRequest {
  documentIds: string[];
  companyId?: string; // REFACTOR-001: 原 forwarderId
}

/**
 * 批量映射響應
 */
export interface BatchMapFieldsResponse {
  success: boolean;
  data: {
    results: ExtractionResultDTO[];
    summary: {
      total: number;
      successful: number;
      failed: number;
    };
  };
}

/**
 * 取得提取結果請求
 */
export interface GetExtractionResultRequest {
  documentId: string;
}

/**
 * 取得提取結果響應
 */
export interface GetExtractionResultResponse {
  success: boolean;
  data: ExtractionResultDTO | null;
}

/**
 * 取得映射規則請求
 */
export interface GetMappingRulesRequest {
  companyId?: string; // REFACTOR-001: 原 forwarderId
  category?: string;
  fieldName?: string;
  isActive?: boolean;
}

/**
 * 取得映射規則響應
 */
export interface GetMappingRulesResponse {
  success: boolean;
  data: MappingRuleDTO[];
  meta: {
    total: number;
    universalCount: number;
    forwarderSpecificCount: number;
  };
}

// =====================
// Python Service Types (for communication)
// =====================

/**
 * Python 服務映射請求
 */
export interface PythonMapFieldsRequest {
  document_id: string;
  forwarder_id?: string;
  ocr_text: string;
  azure_invoice_data?: Record<string, unknown>;
  mapping_rules: PythonMappingRule[];
}

/**
 * Python 服務映射規則格式
 */
export interface PythonMappingRule {
  id: string;
  field_name: string;
  field_label: string;
  extraction_pattern: {
    method: string;
    pattern?: string;
    keywords?: string[];
    position?: {
      page?: number;
      region: {
        top: number;
        left: number;
        width: number;
        height: number;
      };
    };
    azure_field_name?: string;
    confidence_boost?: number;
  };
  priority: number;
  is_required: boolean;
  validation_pattern?: string;
  default_value?: string;
  category?: string;
}

/**
 * Python 服務映射響應
 */
export interface PythonMapFieldsResponse {
  success: boolean;
  document_id: string;
  forwarder_id?: string;
  field_mappings: Record<
    string,
    {
      value: string | null;
      raw_value: string | null;
      confidence: number;
      source: string;
      rule_id?: string;
      extraction_method: string;
      position?: {
        page: number;
        bounding_box?: {
          x: number;
          y: number;
          width: number;
          height: number;
        };
      };
    }
  >;
  statistics: {
    total_fields: number;
    mapped_fields: number;
    unmapped_fields: number;
    average_confidence: number;
    processing_time_ms: number;
    rules_applied: number;
  };
  unmapped_field_details?: Record<
    string,
    {
      reason: string;
      attempts: string[];
    }
  >;
  error_message?: string;
}

// =====================
// Utility Types
// =====================

/**
 * 欄位值正規化選項
 */
export interface NormalizationOptions {
  /** 日期格式（預設: YYYY-MM-DD） */
  dateFormat?: string;
  /** 金額小數位數（預設: 2） */
  currencyDecimals?: number;
  /** 是否移除空白 */
  trimWhitespace?: boolean;
  /** 是否轉大寫 */
  toUpperCase?: boolean;
}

/**
 * 驗證結果
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * 欄位映射摘要
 */
export interface FieldMappingSummary {
  documentId: string;
  forwarderName: string | null;
  totalFields: number;
  mappedFields: number;
  unmappedFields: number;
  averageConfidence: number;
  reviewType: ReviewType;
  status: ExtractionStatus;
}

// ============================================================
// Story 13.3 - 視覺化映射配置類型
// ============================================================

import { z } from 'zod';

/**
 * 轉換類型
 * @description 定義欄位值轉換的方式
 */
export type TransformType = 'DIRECT' | 'CONCAT' | 'SPLIT' | 'LOOKUP' | 'CUSTOM';

/**
 * 配置範圍
 * @description 定義映射規則的適用範圍
 * - GLOBAL: 全域通用規則
 * - COMPANY: 特定公司規則
 * - FORMAT: 特定文件格式規則
 */
export type ConfigScope = 'GLOBAL' | 'COMPANY' | 'FORMAT';

/**
 * 轉換類型選項（用於 UI 下拉選單）
 */
export const TRANSFORM_TYPE_OPTIONS: Array<{
  value: TransformType;
  label: string;
  description: string;
}> = [
  {
    value: 'DIRECT',
    label: '直接映射',
    description: '直接將來源欄位值複製到目標欄位',
  },
  {
    value: 'CONCAT',
    label: '合併',
    description: '將多個來源欄位合併為單一目標欄位',
  },
  {
    value: 'SPLIT',
    label: '分割',
    description: '將來源欄位按分隔符分割，取指定索引的值',
  },
  {
    value: 'LOOKUP',
    label: '對照表',
    description: '根據對照表將來源值轉換為對應的目標值',
  },
  {
    value: 'CUSTOM',
    label: '自訂表達式',
    description: '使用自訂 JavaScript 表達式進行轉換',
  },
];

/**
 * 配置範圍選項（用於 UI 下拉選單）
 */
export const CONFIG_SCOPE_OPTIONS: Array<{
  value: ConfigScope;
  label: string;
  description: string;
}> = [
  {
    value: 'GLOBAL',
    label: '全域',
    description: '適用於所有公司和文件格式',
  },
  {
    value: 'COMPANY',
    label: '公司',
    description: '僅適用於特定公司',
  },
  {
    value: 'FORMAT',
    label: '文件格式',
    description: '僅適用於特定文件格式',
  },
];

/**
 * 轉換參數
 * @description 各種轉換類型所需的參數
 */
export interface TransformParams {
  /** CONCAT: 合併時使用的分隔符 */
  separator?: string;
  /** SPLIT: 分割時使用的分隔符 */
  delimiter?: string;
  /** SPLIT: 分割後取第幾個元素（0-based） */
  index?: number;
  /** SPLIT: 分割後取哪個索引（保持向後兼容 index 別名） */
  splitIndex?: number;
  /** SPLIT: 是否保留所有分割結果（用陣列） */
  keepAll?: boolean;
  /** LOOKUP: 值對照表 */
  lookupTable?: Record<string, string>;
  /** LOOKUP: 對照表 ID（用於引用資料庫中的對照表） */
  lookupTableId?: string;
  /** LOOKUP: 是否區分大小寫 */
  caseSensitive?: boolean;
  /** LOOKUP: 找不到對應值時的預設值 */
  defaultValue?: string;
  /** CUSTOM: 自訂 JavaScript 表達式 */
  expression?: string;
  /** CUSTOM: 自訂公式（expression 別名） */
  customFormula?: string;
  /** 通用: 空值處理策略 */
  nullHandling?: 'skip' | 'empty' | 'default';
}

/**
 * 視覺化映射規則
 * @description 用於 Story 13.3 映射配置介面的規則結構
 */
export interface VisualMappingRule {
  /** 規則唯一識別碼 */
  id: string;
  /** 所屬配置 ID */
  configId: string;
  /** 來源欄位列表（支援多個來源用於 CONCAT） */
  sourceFields: string[];
  /** 目標欄位名稱 */
  targetField: string;
  /** 轉換類型 */
  transformType: TransformType;
  /** 轉換參數 */
  transformParams: TransformParams;
  /** 規則優先級（數字越小優先級越高） */
  priority: number;
  /** 規則是否啟用 */
  isActive: boolean;
  /** 規則描述（可選） */
  description?: string;
  /** 建立時間 */
  createdAt: string;
  /** 更新時間 */
  updatedAt: string;
}

/**
 * 視覺化映射配置
 * @description 包含多個映射規則的配置容器
 */
export interface VisualMappingConfig {
  /** 配置唯一識別碼 */
  id: string;
  /** 配置範圍 */
  scope: ConfigScope;
  /** 關聯的公司 ID（當 scope 為 COMPANY 時） */
  companyId?: string | null;
  /** 關聯的文件格式 ID（當 scope 為 FORMAT 時） */
  documentFormatId?: string | null;
  /** 配置名稱 */
  name: string;
  /** 配置描述 */
  description?: string;
  /** 包含的映射規則列表 */
  rules: VisualMappingRule[];
  /** 配置是否啟用 */
  isActive: boolean;
  /** 版本號（用於樂觀鎖） */
  version: number;
  /** 建立時間 */
  createdAt: string;
  /** 更新時間 */
  updatedAt: string;
}

/**
 * 來源欄位定義
 * @description 描述可用於映射的來源欄位
 */
export interface SourceFieldDefinition {
  /** 欄位 ID */
  id: string;
  /** 欄位名稱（程式用） */
  fieldName: string;
  /** 顯示名稱 */
  displayName: string;
  /** 欄位分類 */
  category: string;
  /** 欄位說明 */
  description?: string;
  /** 範例值 */
  sampleValue?: string;
}

/**
 * 目標欄位定義
 * @description 描述映射的目標欄位
 */
export interface TargetFieldDefinition {
  /** 欄位 ID */
  id: string;
  /** 欄位名稱（程式用） */
  fieldName: string;
  /** 顯示名稱 */
  displayName: string;
  /** 欄位分類 */
  category: string;
  /** 欄位說明 */
  description?: string;
  /** 是否為必填欄位 */
  required: boolean;
  /** 預期資料類型 */
  dataType: 'string' | 'number' | 'date' | 'boolean';
}

/**
 * 規則編輯表單狀態
 */
export interface RuleEditorFormState {
  /** 來源欄位列表 */
  sourceFields: string[];
  /** 目標欄位 */
  targetField: string;
  /** 轉換類型 */
  transformType: TransformType;
  /** 轉換參數 */
  transformParams: TransformParams;
  /** 是否啟用 */
  isActive: boolean;
  /** 描述 */
  description: string;
}

/**
 * 映射預覽結果
 */
export interface MappingPreviewResult {
  /** 來源欄位值 */
  sourceValues: Record<string, string>;
  /** 目標欄位值 */
  targetValue: string;
  /** 是否成功 */
  success: boolean;
  /** 錯誤訊息（如果失敗） */
  error?: string;
}

/**
 * 規則驗證結果
 */
export interface RuleEditorValidationResult {
  /** 是否有效 */
  isValid: boolean;
  /** 錯誤訊息列表 */
  errors: string[];
  /** 警告訊息列表 */
  warnings: string[];
}

// =====================
// Story 13.3 Zod Schemas
// =====================

/**
 * 轉換參數 Zod Schema
 */
export const TransformParamsSchema = z.object({
  separator: z.string().optional(),
  delimiter: z.string().optional(),
  index: z.number().int().min(0).optional(),
  splitIndex: z.number().int().min(0).optional(),
  keepAll: z.boolean().optional(),
  lookupTable: z.record(z.string(), z.string()).optional(),
  lookupTableId: z.string().optional(),
  caseSensitive: z.boolean().optional(),
  defaultValue: z.string().optional(),
  expression: z.string().optional(),
  customFormula: z.string().optional(),
  nullHandling: z.enum(['skip', 'empty', 'default']).optional(),
});

/**
 * 視覺化映射規則 Zod Schema
 */
export const VisualMappingRuleSchema = z.object({
  id: z.string(),
  configId: z.string(),
  sourceFields: z.array(z.string()).min(1, '至少需要一個來源欄位'),
  targetField: z.string().min(1, '目標欄位為必填'),
  transformType: z.enum(['DIRECT', 'CONCAT', 'SPLIT', 'LOOKUP', 'CUSTOM']),
  transformParams: TransformParamsSchema,
  priority: z.number().int().min(0),
  isActive: z.boolean(),
  description: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

/**
 * 視覺化映射配置 Zod Schema
 */
export const VisualMappingConfigSchema = z.object({
  id: z.string(),
  scope: z.enum(['GLOBAL', 'COMPANY', 'FORMAT']),
  companyId: z.string().nullable().optional(),
  documentFormatId: z.string().nullable().optional(),
  name: z.string().min(1, '配置名稱為必填'),
  description: z.string().optional(),
  rules: z.array(VisualMappingRuleSchema),
  isActive: z.boolean(),
  version: z.number().int().min(0),
  createdAt: z.string(),
  updatedAt: z.string(),
});

/**
 * 規則編輯表單 Zod Schema
 */
export const RuleEditorFormSchema = z
  .object({
    sourceFields: z.array(z.string()).min(1, '至少選擇一個來源欄位'),
    targetField: z.string().min(1, '請選擇目標欄位'),
    transformType: z.enum(['DIRECT', 'CONCAT', 'SPLIT', 'LOOKUP', 'CUSTOM']),
    transformParams: TransformParamsSchema,
    isActive: z.boolean(),
    description: z.string().optional(),
  })
  .refine(
    (data) => {
      // CONCAT 需要多個來源欄位
      if (data.transformType === 'CONCAT' && data.sourceFields.length < 2) {
        return false;
      }
      return true;
    },
    {
      message: '合併轉換需要至少兩個來源欄位',
      path: ['sourceFields'],
    }
  )
  .refine(
    (data) => {
      // SPLIT 需要 delimiter
      if (data.transformType === 'SPLIT' && !data.transformParams.delimiter) {
        return false;
      }
      return true;
    },
    {
      message: '分割轉換需要設定分隔符',
      path: ['transformParams', 'delimiter'],
    }
  )
  .refine(
    (data) => {
      // LOOKUP 需要 lookupTable
      if (
        data.transformType === 'LOOKUP' &&
        (!data.transformParams.lookupTable ||
          Object.keys(data.transformParams.lookupTable).length === 0)
      ) {
        return false;
      }
      return true;
    },
    {
      message: '對照表轉換需要至少一個對照項目',
      path: ['transformParams', 'lookupTable'],
    }
  )
  .refine(
    (data) => {
      // CUSTOM 需要 expression
      if (data.transformType === 'CUSTOM' && !data.transformParams.expression) {
        return false;
      }
      return true;
    },
    {
      message: '自訂轉換需要設定表達式',
      path: ['transformParams', 'expression'],
    }
  );

// =====================
// Story 13.3 Type Guards
// =====================

/**
 * 檢查是否為有效的轉換類型
 */
export function isTransformType(value: unknown): value is TransformType {
  return (
    typeof value === 'string' &&
    ['DIRECT', 'CONCAT', 'SPLIT', 'LOOKUP', 'CUSTOM'].includes(value)
  );
}

/**
 * 檢查是否為有效的配置範圍
 */
export function isConfigScope(value: unknown): value is ConfigScope {
  return (
    typeof value === 'string' && ['GLOBAL', 'COMPANY', 'FORMAT'].includes(value)
  );
}

/**
 * 檢查是否為有效的視覺化映射規則
 */
export function isVisualMappingRule(value: unknown): value is VisualMappingRule {
  return VisualMappingRuleSchema.safeParse(value).success;
}

/**
 * 檢查是否為有效的視覺化映射配置
 */
export function isVisualMappingConfig(
  value: unknown
): value is VisualMappingConfig {
  return VisualMappingConfigSchema.safeParse(value).success;
}

// =====================
// Story 13.3 Utility Functions
// =====================

/**
 * 取得轉換類型的標籤
 */
export function getTransformTypeLabel(type: TransformType): string {
  const option = TRANSFORM_TYPE_OPTIONS.find((o) => o.value === type);
  return option?.label ?? type;
}

/**
 * 取得配置範圍的標籤
 */
export function getConfigScopeLabel(scope: ConfigScope): string {
  const option = CONFIG_SCOPE_OPTIONS.find((o) => o.value === scope);
  return option?.label ?? scope;
}

/**
 * 建立預設的轉換參數
 */
export function createDefaultTransformParams(
  type: TransformType
): TransformParams {
  switch (type) {
    case 'DIRECT':
      return {};
    case 'CONCAT':
      return { separator: ' ' };
    case 'SPLIT':
      return { delimiter: ',', index: 0 };
    case 'LOOKUP':
      return { lookupTable: {}, defaultValue: '' };
    case 'CUSTOM':
      return { expression: '' };
  }
}

/**
 * 建立新的映射規則（空白）
 */
export function createEmptyVisualRule(
  configId: string,
  priority: number
): Omit<VisualMappingRule, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    configId,
    sourceFields: [],
    targetField: '',
    transformType: 'DIRECT',
    transformParams: {},
    priority,
    isActive: true,
    description: '',
  };
}

/**
 * 執行欄位轉換
 * @param sourceValues 來源欄位值
 * @param rule 映射規則
 * @returns 轉換後的值
 */
export function executeTransform(
  sourceValues: Record<string, string>,
  rule: VisualMappingRule
): MappingPreviewResult {
  try {
    const { transformType, transformParams, sourceFields } = rule;
    const values = sourceFields.map((f) => sourceValues[f] ?? '');

    let targetValue: string;

    switch (transformType) {
      case 'DIRECT':
        targetValue = values[0] ?? '';
        break;

      case 'CONCAT':
        targetValue = values.join(transformParams.separator ?? ' ');
        break;

      case 'SPLIT': {
        const delimiter = transformParams.delimiter ?? ',';
        const index = transformParams.index ?? 0;
        const parts = (values[0] ?? '').split(delimiter);
        targetValue = parts[index]?.trim() ?? '';
        break;
      }

      case 'LOOKUP': {
        const lookupTable = transformParams.lookupTable ?? {};
        const defaultValue = transformParams.defaultValue ?? '';
        const sourceValue = values[0] ?? '';
        targetValue = lookupTable[sourceValue] ?? defaultValue;
        break;
      }

      case 'CUSTOM': {
        // 安全執行自訂表達式（僅支援簡單替換）
        const expression = transformParams.expression ?? '';
        targetValue = expression;
        sourceFields.forEach((field, idx) => {
          targetValue = targetValue.replace(
            new RegExp(`\\$\\{${field}\\}`, 'g'),
            values[idx] ?? ''
          );
        });
        break;
      }

      default:
        targetValue = values[0] ?? '';
    }

    return {
      sourceValues,
      targetValue,
      success: true,
    };
  } catch (error) {
    return {
      sourceValues,
      targetValue: '',
      success: false,
      error: error instanceof Error ? error.message : '轉換失敗',
    };
  }
}
