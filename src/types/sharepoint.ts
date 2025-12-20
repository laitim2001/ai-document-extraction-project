/**
 * @fileoverview SharePoint 整合相關類型定義
 * @description
 *   定義 SharePoint 文件提交、Microsoft Graph API 整合、
 *   API Key 驗證相關的類型和常數。
 *
 * @module src/types/sharepoint
 * @author Development Team
 * @since Epic 9 - Story 9.1 (SharePoint 文件監控 API)
 * @lastModified 2025-12-20
 */

import type { SharePointFetchStatus, DocumentSourceType } from '@prisma/client';

// ============================================================
// Re-export Prisma Enums
// ============================================================

export { SharePointFetchStatus, DocumentSourceType };

// ============================================================
// Microsoft Graph API Types
// ============================================================

/**
 * Graph API 配置
 */
export interface GraphApiConfig {
  tenantId: string;
  clientId: string;
  clientSecret: string;
}

/**
 * SharePoint 文件資訊
 */
export interface SharePointFileInfo {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  webUrl: string;
  driveId: string;
  siteId: string;
  createdDateTime: string;
  lastModifiedDateTime: string;
  downloadUrl: string;
}

/**
 * SharePoint URL 解析結果
 */
export interface SharePointUrlParts {
  siteUrl: string;
  filePath: string;
}

// ============================================================
// Document Submission Types
// ============================================================

/**
 * SharePoint 文件提交請求
 */
export interface SharePointSubmitRequest {
  sharepointUrl: string;
  cityCode: string;
  originalFileName?: string;
  metadata?: Record<string, unknown>;
}

/**
 * SharePoint 文件提交結果
 */
export interface SharePointSubmitResult {
  success: boolean;
  documentId?: string;
  processingQueueId?: string;
  fetchLogId?: string;
  error?: SharePointError;
}

/**
 * SharePoint 錯誤
 */
export interface SharePointError {
  code: SharePointErrorCode;
  message: string;
  details?: Record<string, unknown>;
}

/**
 * SharePoint 錯誤代碼
 */
export type SharePointErrorCode =
  | 'VALIDATION_ERROR'
  | 'CONFIG_NOT_FOUND'
  | 'CITY_NOT_FOUND'
  | 'FILE_NOT_FOUND'
  | 'ACCESS_DENIED'
  | 'AUTH_ERROR'
  | 'INVALID_FILE_TYPE'
  | 'FILE_TOO_LARGE'
  | 'DUPLICATE_FILE'
  | 'DOWNLOAD_FAILED'
  | 'STORAGE_ERROR'
  | 'INTERNAL_ERROR';

// ============================================================
// Batch Submission Types
// ============================================================

/**
 * 批次提交請求
 */
export interface SharePointBatchSubmitRequest {
  documents: SharePointSubmitRequest[];
}

/**
 * 批次提交結果
 */
export interface SharePointBatchSubmitResult {
  total: number;
  successful: number;
  failed: number;
  results: SharePointSubmitResult[];
}

// ============================================================
// API Key Types
// ============================================================

/**
 * API Key 驗證結果
 */
export interface ApiKeyValidationResult {
  valid: boolean;
  keyId?: string;
  permissions?: string[];
  cityAccess?: string[];
  error?: string;
}

/**
 * 請求上下文
 */
export interface RequestContext {
  ip?: string;
  userAgent?: string;
  apiKeyId?: string;
}

// ============================================================
// Fetch Log Types
// ============================================================

/**
 * 獲取日誌查詢條件
 */
export interface FetchLogQueryOptions {
  cityId?: string;
  status?: SharePointFetchStatus;
  startDate?: Date;
  endDate?: Date;
  page?: number;
  pageSize?: number;
}

/**
 * 獲取日誌統計
 */
export interface FetchLogStats {
  total: number;
  pending: number;
  downloading: number;
  processing: number;
  completed: number;
  failed: number;
  duplicate: number;
}

/**
 * 獲取日誌詳情（API 響應用）
 */
export interface FetchLogDetail {
  id: string;
  status: SharePointFetchStatus;
  sharepointUrl: string;
  fileName: string;
  fileSize: number | null;
  documentId: string | null;
  processingQueueId?: string | null;
  processingStatus?: string | null;
  error: {
    code: string;
    message: string | null;
  } | null;
  createdAt: string;
  completedAt: string | null;
}

// ============================================================
// Source Metadata Types
// ============================================================

/**
 * SharePoint 來源 Metadata
 */
export interface SharePointSourceMetadata {
  sharepointUrl: string;
  webUrl: string;
  driveId: string;
  siteId: string;
  itemId: string;
  createdDateTime: string;
  lastModifiedDateTime: string;
  fetchedAt: string;
  fetchLogId: string;
}

// ============================================================
// Constants
// ============================================================

/**
 * 允許的 MIME 類型
 */
export const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/tiff',
  'image/gif',
] as const;

/**
 * 允許的 MIME 類型集合（用於快速查找）
 */
export const ALLOWED_MIME_TYPE_SET = new Set<string>(ALLOWED_MIME_TYPES);

/**
 * 最大文件大小 (50MB)
 */
export const MAX_FILE_SIZE = 50 * 1024 * 1024;

/**
 * HTTP 狀態碼對應
 */
export const ERROR_STATUS_CODES: Record<SharePointErrorCode, number> = {
  VALIDATION_ERROR: 400,
  CONFIG_NOT_FOUND: 404,
  CITY_NOT_FOUND: 404,
  FILE_NOT_FOUND: 404,
  ACCESS_DENIED: 403,
  AUTH_ERROR: 401,
  INVALID_FILE_TYPE: 400,
  FILE_TOO_LARGE: 400,
  DUPLICATE_FILE: 409,
  DOWNLOAD_FAILED: 502,
  STORAGE_ERROR: 500,
  INTERNAL_ERROR: 500,
};

/**
 * SharePoint 獲取狀態標籤
 */
export const FETCH_STATUS_LABELS: Record<SharePointFetchStatus, string> = {
  PENDING: '待處理',
  DOWNLOADING: '下載中',
  PROCESSING: '處理中',
  COMPLETED: '已完成',
  FAILED: '失敗',
  DUPLICATE: '重複文件',
};

/**
 * 文件來源類型標籤
 */
export const SOURCE_TYPE_LABELS: Record<DocumentSourceType, string> = {
  MANUAL_UPLOAD: '手動上傳',
  SHAREPOINT: 'SharePoint',
  OUTLOOK: 'Outlook',
  API: '外部 API',
};

// ============================================================
// API Response Types
// ============================================================

/**
 * SharePoint 提交成功響應
 */
export interface SharePointSubmitSuccessResponse {
  success: true;
  data: {
    documentId: string;
    processingQueueId: string;
    fetchLogId: string;
    message: string;
  };
}

/**
 * SharePoint 批次提交響應
 */
export interface SharePointBatchSubmitResponse {
  success: true;
  data: SharePointBatchSubmitResult;
}

/**
 * SharePoint 錯誤響應
 */
export interface SharePointErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

/**
 * 獲取狀態響應
 */
export interface FetchStatusResponse {
  success: true;
  data: FetchLogDetail;
}
