/**
 * @fileoverview 告警服務相關類型定義
 * @description
 *   定義告警服務所需的所有類型，包含：
 *   - 通知管道配置類型
 *   - 通知訊息類型
 *   - 告警摘要類型
 *   - 告警 API 請求/回應類型
 *
 * @module src/types/alert-service
 * @since Epic 10 - Story 10.7
 * @lastModified 2025-12-20
 *
 * @features
 *   - 多通道通知配置（Email, Teams, Slack）
 *   - 告警狀態管理
 *   - 告警摘要統計
 *
 * @dependencies
 *   - @prisma/client - Prisma 枚舉類型
 */

import { AlertType, AlertSeverity, AlertStatus } from '@prisma/client';
import { AlertDetailsSchema } from './health-monitoring';

// Re-export for convenience
export { AlertType, AlertSeverity, AlertStatus };

// ===========================================
// 通知管道配置
// ===========================================

/**
 * Email 通知配置
 */
export interface EmailNotificationConfig {
  enabled: boolean;
  recipients: string[];
  templateId?: string; // Email 範本 ID
}

/**
 * Teams 通知配置
 */
export interface TeamsNotificationConfig {
  enabled: boolean;
  webhookUrl: string;
  channelName?: string;
}

/**
 * Slack 通知配置
 */
export interface SlackNotificationConfig {
  enabled: boolean;
  webhookUrl: string;
  channelId?: string;
}

/**
 * 通知配置
 */
export interface NotificationConfig {
  email?: EmailNotificationConfig;
  teams?: TeamsNotificationConfig;
  slack?: SlackNotificationConfig;
}

// ===========================================
// 通知訊息
// ===========================================

/**
 * 通知訊息
 */
export interface NotificationMessage {
  title: string;
  body: string;
  severity: AlertSeverity;
  service: string;
  timestamp: Date;
  actionUrl?: string; // 處理連結
  details?: Record<string, unknown>;
}

/**
 * 通知發送結果
 */
export interface NotificationSendResult {
  channel: 'email' | 'teams' | 'slack';
  success: boolean;
  messageId?: string;
  error?: string;
  sentAt: Date;
}

// ===========================================
// 告警摘要
// ===========================================

/**
 * 告警摘要
 */
export interface AlertSummary {
  total: number;
  bySeverity: Record<AlertSeverity, number>;
  byStatus: Record<AlertStatus, number>;
  byService: Record<string, number>;
  recentAlerts: Array<{
    id: string;
    title: string;
    severity: AlertSeverity;
    createdAt: Date;
  }>;
}

// ===========================================
// 告警記錄 DTO
// ===========================================

/**
 * 告警記錄 DTO
 */
export interface AlertRecordDto {
  id: string;
  alertType: AlertType;
  severity: AlertSeverity;
  title: string;
  message: string;
  details: AlertDetailsSchema | null;
  service: string;
  cityCode: string | null;
  status: AlertStatus;
  acknowledgedBy: string | null;
  acknowledgedAt: Date | null;
  resolvedAt: Date | null;
  resolvedBy: string | null;
  resolutionNote: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 告警記錄列表項目
 */
export interface AlertRecordListItem {
  id: string;
  alertType: AlertType;
  severity: AlertSeverity;
  title: string;
  service: string;
  cityCode: string | null;
  status: AlertStatus;
  createdAt: Date;
}

// ===========================================
// API 請求類型
// ===========================================

/**
 * 建立告警參數
 */
export interface CreateAlertParams {
  alertType: AlertType;
  severity: AlertSeverity;
  title: string;
  message: string;
  details?: AlertDetailsSchema;
  service: string;
  cityCode?: string;
}

/**
 * 確認告警參數
 */
export interface AcknowledgeAlertParams {
  alertId: string;
  userId: string;
  note?: string;
}

/**
 * 解決告警參數
 */
export interface ResolveAlertParams {
  alertId: string;
  userId: string;
  note?: string;
}

/**
 * 獲取告警列表參數
 */
export interface ListAlertsParams {
  service?: string;
  cityCode?: string;
  status?: AlertStatus;
  severity?: AlertSeverity;
  alertType?: AlertType;
  page?: number;
  pageSize?: number;
  startDate?: Date;
  endDate?: Date;
}

// ===========================================
// API 回應類型
// ===========================================

/**
 * 告警列表響應
 */
export interface AlertListResponse {
  items: AlertRecordListItem[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

/**
 * 告警詳情響應
 */
export interface AlertDetailResponse extends AlertRecordDto {
  acknowledgedByName?: string;
  resolvedByName?: string;
}

/**
 * 告警操作響應
 */
export interface AlertActionResponse {
  success: boolean;
  alert: AlertRecordDto;
  message: string;
}

// ===========================================
// 通知配置 DTO
// ===========================================

/**
 * 告警通知配置 DTO
 */
export interface AlertNotificationConfigDto {
  id: string;
  name: string;
  description: string | null;
  services: string[];
  alertTypes: AlertType[];
  minSeverity: AlertSeverity;
  emailEnabled: boolean;
  emailRecipients: string[];
  teamsEnabled: boolean;
  teamsWebhookUrl: string | null;
  slackEnabled: boolean;
  slackWebhookUrl: string | null;
  cooldownMinutes: number;
  suppressDuplicates: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 建立通知配置輸入
 */
export interface CreateNotificationConfigInput {
  name: string;
  description?: string;
  services: string[];
  alertTypes: AlertType[];
  minSeverity: AlertSeverity;
  emailEnabled?: boolean;
  emailRecipients?: string[];
  teamsEnabled?: boolean;
  teamsWebhookUrl?: string;
  slackEnabled?: boolean;
  slackWebhookUrl?: string;
  cooldownMinutes?: number;
  suppressDuplicates?: boolean;
}

/**
 * 更新通知配置輸入
 */
export interface UpdateNotificationConfigInput {
  name?: string;
  description?: string | null;
  services?: string[];
  alertTypes?: AlertType[];
  minSeverity?: AlertSeverity;
  emailEnabled?: boolean;
  emailRecipients?: string[];
  teamsEnabled?: boolean;
  teamsWebhookUrl?: string | null;
  slackEnabled?: boolean;
  slackWebhookUrl?: string | null;
  cooldownMinutes?: number;
  suppressDuplicates?: boolean;
  isActive?: boolean;
}

// ===========================================
// Helper Functions
// ===========================================

/**
 * 獲取告警嚴重程度顯示文字
 */
export function getAlertSeverityText(severity: AlertSeverity): string {
  const severityTextMap: Record<AlertSeverity, string> = {
    INFO: '資訊',
    WARNING: '警告',
    ERROR: '錯誤',
    CRITICAL: '嚴重',
    EMERGENCY: '緊急',
  };
  return severityTextMap[severity] || severity;
}

/**
 * 獲取告警嚴重程度顏色
 */
export function getAlertSeverityColor(
  severity: AlertSeverity
): 'info' | 'warning' | 'error' | 'destructive' {
  const colorMap: Record<AlertSeverity, 'info' | 'warning' | 'error' | 'destructive'> = {
    INFO: 'info',
    WARNING: 'warning',
    ERROR: 'error',
    CRITICAL: 'destructive',
    EMERGENCY: 'destructive',
  };
  return colorMap[severity] || 'info';
}

/**
 * 獲取告警狀態顯示文字
 */
export function getAlertStatusText(status: AlertStatus): string {
  const statusTextMap: Record<AlertStatus, string> = {
    ACTIVE: '活躍',
    ACKNOWLEDGED: '已確認',
    RESOLVED: '已解決',
    SUPPRESSED: '已抑制',
    FIRING: '觸發中',
    RECOVERED: '已恢復',
  };
  return statusTextMap[status] || status;
}

/**
 * 獲取告警類型顯示文字
 */
export function getAlertTypeText(alertType: AlertType): string {
  const typeTextMap: Record<AlertType, string> = {
    CONNECTION_FAILURE: '連線失敗',
    HIGH_ERROR_RATE: '高錯誤率',
    RESPONSE_TIMEOUT: '回應逾時',
    SERVICE_DEGRADED: '服務降級',
    SERVICE_RECOVERED: '服務恢復',
    CONFIGURATION_ERROR: '配置錯誤',
    AUTHENTICATION_FAILURE: '認證失敗',
    RATE_LIMIT_EXCEEDED: '超過速率限制',
  };
  return typeTextMap[alertType] || alertType;
}

/**
 * 判斷告警是否需要處理
 */
export function isAlertActionRequired(status: AlertStatus): boolean {
  return status === 'ACTIVE' || status === 'ACKNOWLEDGED' || status === 'FIRING';
}

/**
 * 獲取嚴重程度優先級
 */
export function getSeverityPriority(severity: AlertSeverity): number {
  const priorityMap: Record<AlertSeverity, number> = {
    INFO: 1,
    WARNING: 2,
    ERROR: 3,
    CRITICAL: 4,
    EMERGENCY: 5,
  };
  return priorityMap[severity] || 0;
}
