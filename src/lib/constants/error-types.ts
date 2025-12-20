/**
 * @fileoverview 工作流錯誤類型常數定義
 * @description
 *   本模組定義工作流錯誤類型的配置常數，包含：
 *   - 各錯誤類型的顯示配置
 *   - 敏感 HTTP 標頭列表
 *   - 錯誤分類關鍵字
 *
 * @module src/lib/constants/error-types
 * @author Development Team
 * @since Epic 10 - Story 10.5
 * @lastModified 2025-12-20
 *
 * @features
 *   - 8 種錯誤類型完整配置
 *   - 敏感資訊遮蔽支援
 *   - 錯誤分類關鍵字匹配
 *
 * @related
 *   - src/types/workflow-error.ts - 錯誤類型定義
 *   - src/services/n8n/workflow-error.service.ts - 錯誤服務
 */

import type { WorkflowErrorType, ErrorTypeConfig } from '@/types/workflow-error';

// ============================================================
// 錯誤類型配置
// ============================================================

/**
 * 錯誤類型配置表
 *
 * @description
 *   定義每種錯誤類型的：
 *   - 顯示標籤
 *   - 顏色（error/warning/info）
 *   - 圖示名稱
 *   - 是否可恢復
 *   - 預設恢復建議
 */
export const ERROR_TYPE_CONFIG: Record<WorkflowErrorType, ErrorTypeConfig> = {
  CONNECTION_ERROR: {
    label: '連線失敗',
    color: 'error',
    icon: 'WifiOff',
    recoverable: true,
    defaultHint: '請檢查網路連線和 n8n 服務狀態後重試',
  },
  TIMEOUT_ERROR: {
    label: '逾時',
    color: 'warning',
    icon: 'Timer',
    recoverable: true,
    defaultHint: '操作逾時，請稍後重試或檢查目標服務回應時間',
  },
  AUTHENTICATION_ERROR: {
    label: '認證錯誤',
    color: 'error',
    icon: 'Lock',
    recoverable: false,
    defaultHint: '請檢查 API Key 或認證設定是否正確',
  },
  VALIDATION_ERROR: {
    label: '驗證錯誤',
    color: 'warning',
    icon: 'Warning',
    recoverable: false,
    defaultHint: '請檢查輸入資料格式是否正確',
  },
  BUSINESS_ERROR: {
    label: '業務錯誤',
    color: 'warning',
    icon: 'Info',
    recoverable: false,
    defaultHint: '請根據錯誤訊息修正業務資料',
  },
  SYSTEM_ERROR: {
    label: '系統錯誤',
    color: 'error',
    icon: 'Error',
    recoverable: false,
    defaultHint: '系統內部錯誤，請聯繫技術支援',
  },
  EXTERNAL_ERROR: {
    label: '外部服務錯誤',
    color: 'error',
    icon: 'Cloud',
    recoverable: true,
    defaultHint: '外部服務錯誤，請稍後重試',
  },
  UNKNOWN_ERROR: {
    label: '未知錯誤',
    color: 'error',
    icon: 'Help',
    recoverable: false,
    defaultHint: '發生未知錯誤，請聯繫技術支援',
  },
};

// ============================================================
// 敏感標頭列表
// ============================================================

/**
 * 敏感 HTTP 標頭列表
 *
 * @description
 *   這些標頭在錯誤詳情中會被遮蔽為 [REDACTED]
 *   防止敏感資訊外洩
 */
export const SENSITIVE_HEADERS: string[] = [
  'authorization',
  'x-api-key',
  'cookie',
  'set-cookie',
  'x-auth-token',
  'x-access-token',
  'x-refresh-token',
  'proxy-authorization',
  'www-authenticate',
];

// ============================================================
// 錯誤分類關鍵字
// ============================================================

/**
 * 逾時錯誤關鍵字
 */
export const TIMEOUT_KEYWORDS: string[] = [
  'timeout',
  'timed out',
  'timedout',
  'etimedout',
  'request timeout',
  'socket timeout',
];

/**
 * 連線錯誤關鍵字
 */
export const CONNECTION_KEYWORDS: string[] = [
  'connection',
  'network',
  'econnrefused',
  'enotfound',
  'ehostunreach',
  'econnreset',
  'epipe',
  'socket hang up',
  'dns',
  'unreachable',
];

/**
 * 認證錯誤關鍵字
 */
export const AUTHENTICATION_KEYWORDS: string[] = [
  'unauthorized',
  'authentication',
  'forbidden',
  'unauthenticated',
  'invalid token',
  'token expired',
  'invalid api key',
  'access denied',
  '401',
  '403',
];

/**
 * 驗證錯誤關鍵字
 */
export const VALIDATION_KEYWORDS: string[] = [
  'validation',
  'invalid',
  'required',
  'missing',
  'bad request',
  'malformed',
  'parse error',
  '400',
];

// ============================================================
// 輔助函數
// ============================================================

/**
 * 獲取錯誤類型配置
 *
 * @param type - 錯誤類型
 * @returns 錯誤類型配置，如果類型無效則返回 UNKNOWN_ERROR 配置
 */
export function getErrorTypeConfig(type: WorkflowErrorType): ErrorTypeConfig {
  return ERROR_TYPE_CONFIG[type] ?? ERROR_TYPE_CONFIG.UNKNOWN_ERROR;
}

/**
 * 檢查標頭是否為敏感標頭
 *
 * @param headerName - 標頭名稱
 * @returns 是否為敏感標頭
 */
export function isSensitiveHeader(headerName: string): boolean {
  return SENSITIVE_HEADERS.includes(headerName.toLowerCase());
}

/**
 * 檢查錯誤是否可恢復
 *
 * @param type - 錯誤類型
 * @returns 是否可恢復
 */
export function isErrorRecoverable(type: WorkflowErrorType): boolean {
  return ERROR_TYPE_CONFIG[type]?.recoverable ?? false;
}

/**
 * 獲取所有可恢復的錯誤類型
 *
 * @returns 可恢復的錯誤類型列表
 */
export function getRecoverableErrorTypes(): WorkflowErrorType[] {
  return (Object.keys(ERROR_TYPE_CONFIG) as WorkflowErrorType[]).filter(
    (type) => ERROR_TYPE_CONFIG[type].recoverable
  );
}

/**
 * 錯誤類型顏色 CSS 類名映射（用於 Tailwind CSS）
 */
export const ERROR_COLOR_CLASSES: Record<string, { bg: string; text: string; border: string }> = {
  error: {
    bg: 'bg-red-50',
    text: 'text-red-700',
    border: 'border-red-200',
  },
  warning: {
    bg: 'bg-yellow-50',
    text: 'text-yellow-700',
    border: 'border-yellow-200',
  },
  info: {
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    border: 'border-blue-200',
  },
};
