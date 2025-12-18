/**
 * @fileoverview 欄位映射相關類型定義
 * @description
 *   定義欄位映射、提取結果、信心度計算等相關類型，包括：
 *   - 提取方法類型（regex, keyword, position, azure_field）
 *   - 欄位映射結果類型
 *   - 信心度來源類型（tier1, tier2, tier3, azure）
 *   - 映射規則類型
 *   - API 請求/響應類型
 *
 * @module src/types/field-mapping
 * @since Epic 2 - Story 2.4 (Field Mapping & Extraction)
 * @lastModified 2025-12-18
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
  forwarderId: string | null;
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
  forwarderId?: string;
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
  forwarderId: string | null;
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
  forwarderId?: string;
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
  forwarderId?: string;
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
  forwarderId?: string;
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
