/**
 * @fileoverview 健康監控相關類型定義
 * @description
 *   定義系統健康監控所需的所有類型，包含：
 *   - 健康檢查結果類型
 *   - n8n 健康狀態類型
 *   - 狀態變化記錄類型
 *   - 告警閾值配置類型
 *   - API 請求/回應類型
 *
 * @module src/types/health-monitoring
 * @since Epic 10 - Story 10.7
 * @lastModified 2025-12-20
 *
 * @features
 *   - 健康檢查結果追蹤
 *   - 24小時統計數據
 *   - 城市級別健康狀態
 *   - 狀態變化歷史
 *
 * @dependencies
 *   - @prisma/client - Prisma 枚舉類型
 */

import {
  HealthStatus,
  HealthCheckType,
  AlertType,
  AlertSeverity,
  AlertStatus,
} from '@prisma/client';

// Re-export Prisma enums for convenience
export { HealthStatus, HealthCheckType, AlertType, AlertSeverity, AlertStatus };

// ===========================================
// JSON Schema Types
// ===========================================

/**
 * 健康檢查詳情 Schema
 */
export interface HealthCheckDetailsSchema {
  // 連接資訊
  endpoint?: string; // 檢查的端點
  method?: string; // HTTP 方法

  // 回應資訊
  responseBody?: string; // 回應內容（截斷）
  responseHeaders?: Record<string, string>; // 回應標頭

  // 錯誤資訊
  errorCode?: string; // 錯誤代碼
  errorStack?: string; // 錯誤堆疊（僅開發環境）

  // SSL/TLS 資訊
  sslValid?: boolean; // SSL 是否有效
  sslExpiry?: string; // SSL 到期日

  // 額外資訊
  version?: string; // 服務版本
  uptime?: number; // 服務運行時間（秒）
}

/**
 * 錯誤分類統計 Schema
 */
export interface ErrorsByTypeSchema {
  CONNECTION_ERROR?: number; // 連線錯誤次數
  TIMEOUT_ERROR?: number; // 逾時錯誤次數
  AUTHENTICATION_ERROR?: number; // 認證錯誤次數
  VALIDATION_ERROR?: number; // 驗證錯誤次數
  RATE_LIMIT_ERROR?: number; // 速率限制錯誤次數
  SERVER_ERROR?: number; // 伺服器錯誤次數
  UNKNOWN_ERROR?: number; // 未知錯誤次數
}

/**
 * 告警詳情 Schema
 */
export interface AlertDetailsSchema {
  // 觸發條件
  triggerCondition?: string; // 觸發條件描述
  triggerValue?: number; // 觸發值
  thresholdValue?: number; // 閾值

  // 連線資訊
  consecutiveFailures?: number; // 連續失敗次數
  lastSuccessAt?: string; // 最後成功時間
  lastErrorMessage?: string; // 最後錯誤訊息

  // 統計資訊
  errorRate?: number; // 錯誤率
  avgResponseMs?: number; // 平均回應時間

  // 影響範圍
  affectedCities?: string[]; // 受影響城市
  affectedWorkflows?: string[]; // 受影響工作流

  // 建議動作
  suggestedActions?: string[]; // 建議的處理動作
}

/**
 * 通知發送記錄 Schema
 */
export interface NotificationsSentSchema {
  notifications: Array<{
    channel: 'email' | 'teams' | 'slack'; // 通知管道
    sentAt: string; // 發送時間
    recipient: string; // 接收者
    success: boolean; // 是否成功
    errorMessage?: string; // 失敗原因
    messageId?: string; // 訊息 ID（用於追蹤）
  }>;
}

// ===========================================
// 健康檢查結果
// ===========================================

/**
 * 健康檢查結果
 */
export interface HealthCheckResult {
  success: boolean;
  status: HealthStatus;
  responseTimeMs?: number;
  error?: string;
  httpStatus?: number;
  details?: HealthCheckDetailsSchema;
}

// ===========================================
// n8n 健康狀態
// ===========================================

/**
 * n8n 整體健康狀態
 */
export interface N8nHealthStatus {
  status: HealthStatus;
  lastSuccessAt?: Date;
  lastCheckAt?: Date;
  consecutiveFailures: number;
  stats24h: ConnectionStats24h;
  cityStatuses?: CityHealthStatus[];
  activeAlerts: ActiveAlert[];
}

/**
 * 24 小時連接統計
 */
export interface ConnectionStats24h {
  totalCalls: number;
  successCalls: number;
  failedCalls: number;
  successRate: number; // 0-100
  avgResponseMs?: number;
  maxResponseMs?: number;
  minResponseMs?: number;
  errorsByType?: ErrorsByTypeSchema;
}

/**
 * 城市健康狀態
 */
export interface CityHealthStatus {
  cityCode: string;
  cityName: string;
  status: HealthStatus;
  lastCheckAt?: Date;
  consecutiveFailures: number;
}

/**
 * 活躍告警
 */
export interface ActiveAlert {
  id: string;
  alertType: AlertType;
  severity: AlertSeverity;
  title: string;
  message: string;
  createdAt: Date;
  status: AlertStatus;
}

// ===========================================
// 狀態變化記錄
// ===========================================

/**
 * 狀態變化記錄
 */
export interface StatusChangeRecord {
  previousStatus?: HealthStatus;
  newStatus: HealthStatus;
  reason?: string;
  changedAt: Date;
  cityCode?: string;
  cityName?: string;
  responseTimeMs?: number;
}

// ===========================================
// 健康歷史記錄
// ===========================================

/**
 * 健康歷史記錄項目
 */
export interface HealthHistoryEntry {
  status: HealthStatus;
  message?: string;
  responseTimeMs?: number;
  httpStatus?: number;
  createdAt: Date;
  cityCode?: string;
}

// ===========================================
// 告警配置
// ===========================================

/**
 * 告警閾值配置
 */
export interface AlertThresholds {
  consecutiveFailuresThreshold: number; // 連續失敗次數閾值
  errorRateThreshold: number; // 錯誤率閾值 (0-100)
  responseTimeThreshold: number; // 回應時間閾值 (ms)
  degradedSuccessRateMin: number; // 降級狀態最低成功率
  healthySuccessRateMin: number; // 健康狀態最低成功率
}

/**
 * 預設告警閾值
 */
export const DEFAULT_ALERT_THRESHOLDS: AlertThresholds = {
  consecutiveFailuresThreshold: 3,
  errorRateThreshold: 30, // 30% 以上錯誤率觸發告警
  responseTimeThreshold: 10000, // 10 秒以上視為逾時
  degradedSuccessRateMin: 70, // 70-90% 為降級
  healthySuccessRateMin: 90, // 90% 以上為健康
};

// ===========================================
// API 請求/回應類型
// ===========================================

/**
 * 獲取健康狀態參數
 */
export interface GetHealthParams {
  cityCode?: string;
  includeHistory?: boolean;
  historyLimit?: number;
}

/**
 * 執行健康檢查參數
 */
export interface PerformHealthCheckParams {
  cityCode?: string;
  checkType?: HealthCheckType;
}

/**
 * 獲取健康歷史參數
 */
export interface GetHealthHistoryParams {
  cityCode?: string;
  limit?: number;
  startDate?: Date;
  endDate?: Date;
  status?: HealthStatus;
}

/**
 * 獲取狀態變化參數
 */
export interface GetStatusChangesParams {
  limit?: number;
  cityCode?: string;
  startDate?: Date;
}

/**
 * 健康狀態 API 響應
 */
export interface HealthStatusResponse {
  status: HealthStatus;
  statusText: string;
  lastSuccessAt: string | null;
  lastCheckAt: string | null;
  consecutiveFailures: number;
  stats24h: {
    totalCalls: number;
    successCalls: number;
    failedCalls: number;
    successRate: number;
    avgResponseMs: number | null;
    maxResponseMs: number | null;
    minResponseMs: number | null;
  };
  cityStatuses: Array<{
    cityCode: string;
    cityName: string;
    status: HealthStatus;
    statusText: string;
    lastCheckAt: string | null;
    consecutiveFailures: number;
  }>;
  activeAlerts: Array<{
    id: string;
    alertType: AlertType;
    severity: AlertSeverity;
    title: string;
    message: string;
    createdAt: string;
    status: AlertStatus;
  }>;
}

/**
 * 健康檢查 API 響應
 */
export interface HealthCheckResponse {
  success: boolean;
  status: HealthStatus;
  statusText: string;
  responseTimeMs: number | null;
  httpStatus: number | null;
  error: string | null;
  checkedAt: string;
}

/**
 * 健康歷史 API 響應
 */
export interface HealthHistoryResponse {
  items: Array<{
    status: HealthStatus;
    statusText: string;
    message: string | null;
    responseTimeMs: number | null;
    httpStatus: number | null;
    createdAt: string;
    cityCode: string | null;
  }>;
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

/**
 * 狀態變化 API 響應
 */
export interface StatusChangesResponse {
  items: Array<{
    previousStatus: HealthStatus | null;
    previousStatusText: string | null;
    newStatus: HealthStatus;
    newStatusText: string;
    reason: string | null;
    changedAt: string;
    cityCode: string | null;
    cityName: string | null;
    responseTimeMs: number | null;
  }>;
}

// ===========================================
// Helper Functions
// ===========================================

/**
 * 獲取狀態顯示文字
 */
export function getHealthStatusText(status: HealthStatus): string {
  const statusTextMap: Record<HealthStatus, string> = {
    HEALTHY: '正常',
    DEGRADED: '降級',
    UNHEALTHY: '異常',
    UNKNOWN: '未知',
    UNCONFIGURED: '未配置',
  };
  return statusTextMap[status] || status;
}

/**
 * 獲取狀態顏色
 */
export function getHealthStatusColor(
  status: HealthStatus
): 'success' | 'warning' | 'error' | 'default' {
  const colorMap: Record<HealthStatus, 'success' | 'warning' | 'error' | 'default'> = {
    HEALTHY: 'success',
    DEGRADED: 'warning',
    UNHEALTHY: 'error',
    UNKNOWN: 'default',
    UNCONFIGURED: 'default',
  };
  return colorMap[status] || 'default';
}

/**
 * 判斷是否需要關注
 */
export function isAlertStatus(status: HealthStatus): boolean {
  return status === 'UNHEALTHY' || status === 'DEGRADED';
}
