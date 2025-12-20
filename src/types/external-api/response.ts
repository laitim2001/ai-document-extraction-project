/**
 * @fileoverview 外部 API 回應類型定義
 * @description
 *   定義外部 API 的標準回應格式，包括：
 *   - 發票提交成功回應
 *   - API 錯誤回應
 *   - 錯誤代碼定義
 *
 * @module src/types/external-api/response
 * @author Development Team
 * @since Epic 11 - Story 11.1 (API 發票提交端點)
 * @lastModified 2025-12-20
 *
 * @features
 *   - 標準化回應格式
 *   - 錯誤代碼分類定義
 *   - RFC 7807 相容錯誤格式
 *
 * @related
 *   - src/types/external-api/submission.ts - 提交類型
 *   - src/app/api/v1/invoices/route.ts - API 路由
 */

// ============================================================
// 成功回應類型
// ============================================================

/**
 * 發票提交成功回應
 * @description HTTP 202 Accepted 回應格式
 */
export interface SubmitInvoiceResponse {
  /** 公開的任務 ID */
  taskId: string;
  /** 初始狀態 */
  status: 'queued';
  /** 預估處理時間（秒） */
  estimatedProcessingTime: number;
  /** 狀態查詢 URL */
  statusUrl: string;
  /** 創建時間（ISO 8601 格式） */
  createdAt: string;
}

// ============================================================
// 錯誤代碼定義
// ============================================================

/**
 * 認證錯誤代碼 (401)
 */
export type AuthenticationErrorCode =
  | 'MISSING_API_KEY'
  | 'INVALID_API_KEY'
  | 'EXPIRED_API_KEY'
  | 'API_KEY_DISABLED';

/**
 * 授權錯誤代碼 (403)
 */
export type AuthorizationErrorCode =
  | 'CITY_NOT_ALLOWED'
  | 'OPERATION_NOT_ALLOWED'
  | 'INSUFFICIENT_PERMISSIONS';

/**
 * 請求錯誤代碼 (400)
 */
export type ValidationErrorCode =
  | 'INVALID_SUBMISSION'
  | 'VALIDATION_ERROR'
  | 'FILE_TOO_LARGE'
  | 'UNSUPPORTED_FORMAT'
  | 'EMPTY_FILE'
  | 'INVALID_CALLBACK_URL'
  | 'URL_FETCH_FAILED'
  | 'INVALID_SUBMISSION_TYPE'
  | 'UNSUPPORTED_CONTENT_TYPE'
  | 'MISSING_FILE';

/**
 * 速率限制錯誤代碼 (429)
 */
export type RateLimitErrorCode = 'RATE_LIMIT_EXCEEDED';

/**
 * 伺服器錯誤代碼 (500)
 */
export type ServerErrorCode = 'INTERNAL_ERROR';

/**
 * 外部 API 錯誤代碼聯合類型
 */
export type ExternalApiErrorCode =
  | AuthenticationErrorCode
  | AuthorizationErrorCode
  | ValidationErrorCode
  | RateLimitErrorCode
  | ServerErrorCode;

// ============================================================
// 錯誤代碼常數
// ============================================================

/**
 * 錯誤代碼常數對象
 */
export const ERROR_CODES = {
  // 認證錯誤 (401)
  MISSING_API_KEY: 'MISSING_API_KEY',
  INVALID_API_KEY: 'INVALID_API_KEY',
  EXPIRED_API_KEY: 'EXPIRED_API_KEY',
  API_KEY_DISABLED: 'API_KEY_DISABLED',

  // 授權錯誤 (403)
  CITY_NOT_ALLOWED: 'CITY_NOT_ALLOWED',
  OPERATION_NOT_ALLOWED: 'OPERATION_NOT_ALLOWED',
  INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',

  // 請求錯誤 (400)
  INVALID_SUBMISSION: 'INVALID_SUBMISSION',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  FILE_TOO_LARGE: 'FILE_TOO_LARGE',
  UNSUPPORTED_FORMAT: 'UNSUPPORTED_FORMAT',
  EMPTY_FILE: 'EMPTY_FILE',
  INVALID_CALLBACK_URL: 'INVALID_CALLBACK_URL',
  URL_FETCH_FAILED: 'URL_FETCH_FAILED',
  INVALID_SUBMISSION_TYPE: 'INVALID_SUBMISSION_TYPE',
  UNSUPPORTED_CONTENT_TYPE: 'UNSUPPORTED_CONTENT_TYPE',
  MISSING_FILE: 'MISSING_FILE',

  // 速率限制 (429)
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',

  // 伺服器錯誤 (500)
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

// ============================================================
// 錯誤回應類型
// ============================================================

/**
 * API 錯誤回應
 * @description 標準化的錯誤回應格式
 */
export interface ApiErrorResponse {
  error: {
    /** 錯誤代碼 */
    code: ExternalApiErrorCode;
    /** 錯誤訊息 */
    message: string;
    /** 額外細節 */
    details?: unknown;
  };
  /** 追蹤 ID（用於日誌關聯） */
  traceId: string;
}

/**
 * 速率限制錯誤回應
 * @description 包含速率限制相關標頭資訊
 */
export interface RateLimitErrorResponse extends ApiErrorResponse {
  error: {
    code: 'RATE_LIMIT_EXCEEDED';
    message: string;
    details: {
      /** 每分鐘允許的請求數 */
      limit: number;
      /** 剩餘請求數 */
      remaining: number;
      /** 重置時間（Unix 時間戳） */
      resetAt: number;
      /** 需要等待的秒數 */
      retryAfter: number;
    };
  };
  traceId: string;
}

// ============================================================
// 輔助函數
// ============================================================

/**
 * 根據錯誤代碼獲取 HTTP 狀態碼
 * @param code 錯誤代碼
 * @returns HTTP 狀態碼
 */
export function getHttpStatusForErrorCode(code: ExternalApiErrorCode): number {
  // 認證錯誤
  if (
    code === 'MISSING_API_KEY' ||
    code === 'INVALID_API_KEY' ||
    code === 'EXPIRED_API_KEY' ||
    code === 'API_KEY_DISABLED'
  ) {
    return 401;
  }

  // 授權錯誤
  if (
    code === 'CITY_NOT_ALLOWED' ||
    code === 'OPERATION_NOT_ALLOWED' ||
    code === 'INSUFFICIENT_PERMISSIONS'
  ) {
    return 403;
  }

  // 速率限制
  if (code === 'RATE_LIMIT_EXCEEDED') {
    return 429;
  }

  // 伺服器錯誤
  if (code === 'INTERNAL_ERROR') {
    return 500;
  }

  // 預設為請求錯誤
  return 400;
}

/**
 * 根據錯誤代碼獲取預設訊息
 * @param code 錯誤代碼
 * @returns 錯誤訊息
 */
export function getDefaultMessageForErrorCode(code: ExternalApiErrorCode): string {
  const messages: Record<ExternalApiErrorCode, string> = {
    // 認證錯誤
    MISSING_API_KEY: 'API key is required. Please provide a valid API key in the Authorization header.',
    INVALID_API_KEY: 'The provided API key is invalid.',
    EXPIRED_API_KEY: 'The API key has expired.',
    API_KEY_DISABLED: 'The API key has been disabled.',

    // 授權錯誤
    CITY_NOT_ALLOWED: 'API key is not authorized for this city.',
    OPERATION_NOT_ALLOWED: 'API key is not authorized for this operation.',
    INSUFFICIENT_PERMISSIONS: 'Insufficient permissions to perform this action.',

    // 請求錯誤
    INVALID_SUBMISSION: 'Invalid submission. Please check your request format.',
    VALIDATION_ERROR: 'Request validation failed.',
    FILE_TOO_LARGE: 'File size exceeds the maximum limit of 50MB.',
    UNSUPPORTED_FORMAT: 'File format not supported. Supported formats: PDF, PNG, JPG, TIFF.',
    EMPTY_FILE: 'File content is empty.',
    INVALID_CALLBACK_URL: 'Invalid callback URL format.',
    URL_FETCH_FAILED: 'Failed to fetch file from the provided URL.',
    INVALID_SUBMISSION_TYPE: 'Invalid submission type.',
    UNSUPPORTED_CONTENT_TYPE: 'Unsupported content type.',
    MISSING_FILE: 'No file provided in the request.',

    // 速率限制
    RATE_LIMIT_EXCEEDED: 'Rate limit exceeded. Please try again later.',

    // 伺服器錯誤
    INTERNAL_ERROR: 'An internal server error occurred.',
  };

  return messages[code];
}
