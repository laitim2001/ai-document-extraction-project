/**
 * @fileoverview Outlook 整合相關類型定義
 * @description
 *   定義 Outlook 郵件附件提取、過濾規則、
 *   API 提交與狀態查詢相關的類型和常數。
 *
 * @module src/types/outlook
 * @author Development Team
 * @since Epic 9 - Story 9.3 (Outlook 郵件附件提取 API)
 * @lastModified 2025-12-20
 *
 * @features
 *   - Outlook 郵件附件提交類型
 *   - 過濾規則類型
 *   - 獲取日誌類型
 *   - 錯誤處理類型
 */

import type {
  OutlookFetchStatus,
  OutlookRuleType,
  RuleOperator,
  OutlookSubmissionType,
} from '@prisma/client';

// ============================================================
// Re-export Prisma Enums
// ============================================================

export { OutlookFetchStatus, OutlookRuleType, RuleOperator, OutlookSubmissionType };

// ============================================================
// Mail Information Types
// ============================================================

/**
 * 郵件資訊
 */
export interface MailInfo {
  id: string;
  subject: string;
  sender: {
    email: string;
    name?: string;
  };
  receivedDateTime: string;
  attachments: AttachmentInfo[];
}

/**
 * 附件資訊
 */
export interface AttachmentInfo {
  id: string;
  name: string;
  contentType: string;
  size: number;
  isInline: boolean;
}

/**
 * 附件內容（含 Base64）
 */
export interface AttachmentContent extends AttachmentInfo {
  contentBytes: string; // Base64 編碼
}

// ============================================================
// Submission Request Types
// ============================================================

/**
 * 直接上傳的附件
 */
export interface DirectAttachment {
  fileName: string;
  contentType: string;
  contentBase64: string;
}

/**
 * Outlook 提交請求
 */
export interface OutlookSubmitRequest {
  // 方式一：使用 Message ID
  messageId?: string;

  // 方式二：直接上傳附件
  attachments?: DirectAttachment[];

  // 共用欄位
  cityCode: string;
  senderEmail: string;
  senderName?: string;
  subject: string;
  receivedAt?: string;
  metadata?: Record<string, unknown>;
}

// ============================================================
// Processing Result Types
// ============================================================

/**
 * 單一附件處理結果
 */
export interface AttachmentResult {
  fileName: string;
  status: 'success' | 'skipped' | 'failed';
  documentId?: string;
  processingJobId?: string;
  skipReason?: string;
  error?: string;
}

/**
 * 完整提交結果
 */
export interface OutlookSubmitResult {
  success: boolean;
  fetchLogId: string;
  totalAttachments: number;
  processedCount: number;
  skippedCount: number;
  failedCount: number;
  results: AttachmentResult[];
  error?: OutlookError;
}

/**
 * Outlook 錯誤
 */
export interface OutlookError {
  code: OutlookErrorCode;
  message: string;
  details?: Record<string, unknown>;
}

/**
 * Outlook 錯誤代碼
 */
export type OutlookErrorCode =
  | 'VALIDATION_ERROR'
  | 'CITY_NOT_FOUND'
  | 'CONFIG_NOT_FOUND'
  | 'AUTH_ERROR'
  | 'MAIL_NOT_FOUND'
  | 'ATTACHMENT_NOT_FOUND'
  | 'INVALID_FILE_TYPE'
  | 'FILE_TOO_LARGE'
  | 'DUPLICATE_ATTACHMENT'
  | 'FILTERED'
  | 'PROCESSING_ERROR'
  | 'INTERNAL_ERROR';

// ============================================================
// Filter Rule Types
// ============================================================

/**
 * 過濾規則檢查結果
 */
export interface FilterCheckResult {
  allowed: boolean;
  reason?: string;
  matchedRule?: {
    id: string;
    ruleType: OutlookRuleType;
    isWhitelist: boolean;
  };
}

/**
 * 過濾規則定義
 */
export interface OutlookFilterRuleDefinition {
  ruleType: OutlookRuleType;
  operator: RuleOperator;
  ruleValue: string;
  isWhitelist: boolean;
  isActive: boolean;
  priority: number;
}

// ============================================================
// Source Metadata Types
// ============================================================

/**
 * Outlook 來源 Metadata
 */
export interface OutlookSourceMetadata {
  messageId?: string;
  subject: string;
  senderEmail: string;
  senderName?: string;
  receivedAt: string;
  attachmentName: string;
  attachmentIndex: number;
  totalAttachments: number;
  fetchLogId: string;
}

// ============================================================
// Request Context Types
// ============================================================

/**
 * 請求上下文
 */
export interface OutlookRequestContext {
  ip?: string;
  userAgent?: string;
  apiKeyId?: string;
}

/**
 * 附件處理上下文
 */
export interface AttachmentContext {
  cityId: string;
  cityCode: string;
  senderEmail: string;
  senderName?: string;
  subject: string;
  messageId?: string;
  receivedAt?: string;
  attachmentIndex: number;
  totalAttachments: number;
  fetchLogId: string;
}

/**
 * 解析後的附件
 */
export interface ParsedAttachment {
  fileName: string;
  contentType: string;
  buffer: Buffer;
}

// ============================================================
// Fetch Log Types
// ============================================================

/**
 * 獲取日誌詳情（API 響應用）
 */
export interface OutlookFetchLogDetail {
  id: string;
  status: OutlookFetchStatus;
  subject: string;
  senderEmail: string;
  senderName: string | null;
  receivedAt: string;
  summary: {
    total: number;
    processed: number;
    skipped: number;
  };
  documents: Array<{
    id: string;
    fileName: string;
    status: string;
    processingJobId?: string;
    processingStatus?: string;
  }>;
  skippedFiles: unknown;
  error: {
    code: string;
    message: string | null;
  } | null;
  createdAt: string;
  completedAt: string | null;
}

// ============================================================
// Constants
// ============================================================

/**
 * 允許的 MIME 類型
 */
export const OUTLOOK_ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/tiff',
  'image/gif',
] as const;

/**
 * 允許的 MIME 類型集合（用於快速查找）
 */
export const OUTLOOK_ALLOWED_MIME_TYPE_SET = new Set<string>(OUTLOOK_ALLOWED_MIME_TYPES);

/**
 * 最大附件大小 (30MB)
 */
export const MAX_ATTACHMENT_SIZE = 30 * 1024 * 1024;

/**
 * HTTP 狀態碼對應
 */
export const OUTLOOK_ERROR_STATUS_CODES: Record<OutlookErrorCode, number> = {
  VALIDATION_ERROR: 400,
  CITY_NOT_FOUND: 404,
  CONFIG_NOT_FOUND: 404,
  AUTH_ERROR: 401,
  MAIL_NOT_FOUND: 404,
  ATTACHMENT_NOT_FOUND: 404,
  INVALID_FILE_TYPE: 400,
  FILE_TOO_LARGE: 400,
  DUPLICATE_ATTACHMENT: 409,
  FILTERED: 422,
  PROCESSING_ERROR: 500,
  INTERNAL_ERROR: 500,
};

/**
 * Outlook 獲取狀態標籤
 */
export const OUTLOOK_FETCH_STATUS_LABELS: Record<OutlookFetchStatus, string> = {
  PENDING: '待處理',
  FETCHING: '獲取中',
  PROCESSING: '處理中',
  COMPLETED: '已完成',
  PARTIAL: '部分成功',
  FAILED: '失敗',
  FILTERED: '被過濾',
};

/**
 * 過濾規則類型標籤
 */
export const OUTLOOK_RULE_TYPE_LABELS: Record<OutlookRuleType, string> = {
  SENDER_EMAIL: '寄件者 Email',
  SENDER_DOMAIN: '寄件者網域',
  SUBJECT_KEYWORD: '主旨關鍵字',
  SUBJECT_REGEX: '主旨正則',
  ATTACHMENT_TYPE: '附件類型',
  ATTACHMENT_NAME: '附件名稱',
};

/**
 * 規則運算符標籤
 */
export const RULE_OPERATOR_LABELS: Record<RuleOperator, string> = {
  EQUALS: '完全匹配',
  CONTAINS: '包含',
  STARTS_WITH: '開頭匹配',
  ENDS_WITH: '結尾匹配',
  REGEX: '正則表達式',
};

/**
 * 提交方式標籤
 */
export const OUTLOOK_SUBMISSION_TYPE_LABELS: Record<OutlookSubmissionType, string> = {
  MESSAGE_ID: 'Message ID',
  DIRECT_UPLOAD: '直接上傳',
};

// ============================================================
// API Response Types
// ============================================================

/**
 * Outlook 提交成功響應
 */
export interface OutlookSubmitSuccessResponse {
  success: true;
  data: {
    fetchLogId: string;
    summary: {
      total: number;
      processed: number;
      skipped: number;
      failed: number;
    };
    results: Array<{
      fileName: string;
      status: 'success' | 'skipped' | 'failed';
      documentId?: string;
      processingJobId?: string;
      reason?: string;
    }>;
  };
}

/**
 * Outlook 錯誤響應
 */
export interface OutlookErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
  fetchLogId?: string;
}

/**
 * 獲取狀態響應
 */
export interface OutlookFetchStatusResponse {
  success: true;
  data: OutlookFetchLogDetail;
}
