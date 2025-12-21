/**
 * @fileoverview API 認證常數定義
 * @description
 *   定義 API Key 認證相關的常數，包括：
 *   - API Key 格式設定
 *   - 速率限制預設值
 *   - 錯誤代碼定義
 *   - 敏感欄位列表
 *
 * @module src/lib/constants/api-auth
 * @author Development Team
 * @since Epic 11 - Story 11.5 (API 存取控制與認證)
 * @lastModified 2025-12-21
 *
 * @features
 *   - API Key 格式常數
 *   - 速率限制常數
 *   - 錯誤代碼常數
 *   - 審計日誌配置
 *
 * @related
 *   - src/types/external-api/auth.ts - 認證類型定義
 *   - src/services/api-key.service.ts - API Key 服務
 *   - src/middleware/external-api-auth.ts - 認證中間件
 */

// ============================================================
// API Key 格式常數
// ============================================================

/**
 * API Key 前綴
 * @description 所有 API Key 都以此前綴開始，格式如：inv_a1b2c3d4...
 */
export const API_KEY_PREFIX = 'inv';

/**
 * API Key 隨機部分長度（bytes）
 * @description 生成 16 bytes = 32 hex 字符
 */
export const API_KEY_RANDOM_LENGTH = 16;

/**
 * API Key 前綴顯示長度
 * @description 用於日誌和顯示的前綴長度，如 inv_a1b2c3d4
 */
export const API_KEY_PREFIX_DISPLAY_LENGTH = 12;

/**
 * API Key 最小長度
 */
export const API_KEY_MIN_LENGTH = 32;

// ============================================================
// 速率限制常數
// ============================================================

/**
 * 預設速率限制（每分鐘請求數）
 */
export const DEFAULT_RATE_LIMIT = 60;

/**
 * 速率限制最小值
 */
export const MIN_RATE_LIMIT = 1;

/**
 * 速率限制最大值
 */
export const MAX_RATE_LIMIT = 10000;

/**
 * 速率限制窗口大小（毫秒）
 */
export const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 分鐘

// ============================================================
// 認證錯誤代碼
// ============================================================

/**
 * API 認證錯誤代碼
 */
export const API_AUTH_ERROR_CODES = {
  /** 缺少 API Key */
  MISSING_API_KEY: 'MISSING_API_KEY',
  /** 無效的 API Key 格式 */
  INVALID_API_KEY_FORMAT: 'INVALID_API_KEY_FORMAT',
  /** 無效的 API Key */
  INVALID_API_KEY: 'INVALID_API_KEY',
  /** API Key 已停用 */
  API_KEY_DISABLED: 'API_KEY_DISABLED',
  /** API Key 已過期 */
  EXPIRED_API_KEY: 'EXPIRED_API_KEY',
  /** IP 不在允許列表 */
  IP_NOT_ALLOWED: 'IP_NOT_ALLOWED',
  /** IP 在封鎖列表 */
  IP_BLOCKED: 'IP_BLOCKED',
  /** 權限不足 */
  INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',
  /** 城市存取被拒絕 */
  CITY_ACCESS_DENIED: 'CITY_ACCESS_DENIED',
  /** 超過速率限制 */
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
} as const;

/**
 * API 認證錯誤訊息
 */
export const API_AUTH_ERROR_MESSAGES: Record<string, string> = {
  [API_AUTH_ERROR_CODES.MISSING_API_KEY]: 'API key is required. Use Authorization: Bearer {api_key}',
  [API_AUTH_ERROR_CODES.INVALID_API_KEY_FORMAT]: 'Invalid API key format',
  [API_AUTH_ERROR_CODES.INVALID_API_KEY]: 'Invalid API key',
  [API_AUTH_ERROR_CODES.API_KEY_DISABLED]: 'API key is disabled',
  [API_AUTH_ERROR_CODES.EXPIRED_API_KEY]: 'API key has expired',
  [API_AUTH_ERROR_CODES.IP_NOT_ALLOWED]: 'Request from unauthorized IP address',
  [API_AUTH_ERROR_CODES.IP_BLOCKED]: 'Request from blocked IP address',
  [API_AUTH_ERROR_CODES.INSUFFICIENT_PERMISSIONS]: 'API key does not have required permissions',
  [API_AUTH_ERROR_CODES.CITY_ACCESS_DENIED]: 'API key does not have access to this city',
  [API_AUTH_ERROR_CODES.RATE_LIMIT_EXCEEDED]: 'Rate limit exceeded. Please retry later.',
};

// ============================================================
// API 操作類型常數
// ============================================================

/**
 * API 操作類型
 */
export const API_OPERATIONS = {
  /** 提交發票 */
  SUBMIT: 'submit',
  /** 查詢狀態 */
  QUERY: 'query',
  /** 獲取結果 */
  RESULT: 'result',
  /** Webhook 管理 */
  WEBHOOK: 'webhook',
} as const;

/**
 * 所有可用的 API 操作列表
 */
export const ALL_API_OPERATIONS = Object.values(API_OPERATIONS);

// ============================================================
// 審計日誌配置
// ============================================================

/**
 * 審計日誌敏感欄位
 * @description 這些欄位在記錄審計日誌時需要被過濾或遮蔽
 */
export const AUDIT_SENSITIVE_FIELDS = [
  'password',
  'secret',
  'apiKey',
  'api_key',
  'apikey',
  'token',
  'authorization',
  'cookie',
  'session',
  'credential',
  'credentials',
  'privateKey',
  'private_key',
  'accessToken',
  'access_token',
  'refreshToken',
  'refresh_token',
] as const;

/**
 * 審計日誌批次配置
 */
export const API_AUDIT_BATCH_CONFIG = {
  /** 批次大小 */
  BATCH_SIZE: 100,
  /** 刷新間隔（毫秒） */
  FLUSH_INTERVAL: 1000,
} as const;

/**
 * 審計日誌保留天數
 */
export const API_AUDIT_LOG_RETENTION_DAYS = 90;

// ============================================================
// HTTP 狀態碼對應
// ============================================================

/**
 * 認證錯誤對應的 HTTP 狀態碼
 */
export const AUTH_ERROR_STATUS_CODES: Record<string, number> = {
  [API_AUTH_ERROR_CODES.MISSING_API_KEY]: 401,
  [API_AUTH_ERROR_CODES.INVALID_API_KEY_FORMAT]: 401,
  [API_AUTH_ERROR_CODES.INVALID_API_KEY]: 401,
  [API_AUTH_ERROR_CODES.API_KEY_DISABLED]: 403,
  [API_AUTH_ERROR_CODES.EXPIRED_API_KEY]: 403,
  [API_AUTH_ERROR_CODES.IP_NOT_ALLOWED]: 403,
  [API_AUTH_ERROR_CODES.IP_BLOCKED]: 403,
  [API_AUTH_ERROR_CODES.INSUFFICIENT_PERMISSIONS]: 403,
  [API_AUTH_ERROR_CODES.CITY_ACCESS_DENIED]: 403,
  [API_AUTH_ERROR_CODES.RATE_LIMIT_EXCEEDED]: 429,
};

// ============================================================
// 輔助函數
// ============================================================

/**
 * 獲取錯誤對應的 HTTP 狀態碼
 * @param errorCode 錯誤代碼
 * @returns HTTP 狀態碼
 */
export function getAuthErrorStatusCode(errorCode: string): number {
  return AUTH_ERROR_STATUS_CODES[errorCode] || 500;
}

/**
 * 獲取錯誤對應的訊息
 * @param errorCode 錯誤代碼
 * @returns 錯誤訊息
 */
export function getAuthErrorMessage(errorCode: string): string {
  return API_AUTH_ERROR_MESSAGES[errorCode] || 'An unknown error occurred';
}
