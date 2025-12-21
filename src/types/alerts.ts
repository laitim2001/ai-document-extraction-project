/**
 * @fileoverview 警報系統類型定義
 * @description
 *   定義 Story 12-3 錯誤警報設定相關的 TypeScript 類型
 *   包含警報規則、警報記錄、通知等完整類型系統
 *
 * @module src/types/alerts
 * @since Epic 12 - Story 12-3 (錯誤警報設定)
 */

import type { AlertRule, Alert, AlertRuleNotification } from '@prisma/client';

// ============================================================
// Enum Types (從 Prisma Schema 導出)
// ============================================================

/**
 * 警報條件類型
 */
export const AlertConditionType = {
  SERVICE_DOWN: 'SERVICE_DOWN',
  ERROR_RATE: 'ERROR_RATE',
  RESPONSE_TIME: 'RESPONSE_TIME',
  QUEUE_BACKLOG: 'QUEUE_BACKLOG',
  STORAGE_LOW: 'STORAGE_LOW',
  CPU_HIGH: 'CPU_HIGH',
  MEMORY_HIGH: 'MEMORY_HIGH',
  CUSTOM_METRIC: 'CUSTOM_METRIC',
} as const;

export type AlertConditionType = (typeof AlertConditionType)[keyof typeof AlertConditionType];

/**
 * 警報運算符
 */
export const AlertOperator = {
  GREATER_THAN: 'GREATER_THAN',
  GREATER_THAN_EQ: 'GREATER_THAN_EQ',
  LESS_THAN: 'LESS_THAN',
  LESS_THAN_EQ: 'LESS_THAN_EQ',
  EQUALS: 'EQUALS',
  NOT_EQUALS: 'NOT_EQUALS',
} as const;

export type AlertOperator = (typeof AlertOperator)[keyof typeof AlertOperator];

/**
 * 警報嚴重程度
 */
export const AlertSeverity = {
  INFO: 'INFO',
  WARNING: 'WARNING',
  ERROR: 'ERROR',
  CRITICAL: 'CRITICAL',
  EMERGENCY: 'EMERGENCY',
} as const;

export type AlertSeverity = (typeof AlertSeverity)[keyof typeof AlertSeverity];

/**
 * 警報狀態
 */
export const AlertStatus = {
  FIRING: 'FIRING',
  ACKNOWLEDGED: 'ACKNOWLEDGED',
  RESOLVED: 'RESOLVED',
  RECOVERED: 'RECOVERED',
} as const;

export type AlertStatus = (typeof AlertStatus)[keyof typeof AlertStatus];

/**
 * 通知頻道
 */
export const NotificationChannel = {
  EMAIL: 'EMAIL',
  TEAMS: 'TEAMS',
  WEBHOOK: 'WEBHOOK',
} as const;

export type NotificationChannel = (typeof NotificationChannel)[keyof typeof NotificationChannel];

/**
 * 通知狀態
 */
export const NotificationStatus = {
  PENDING: 'PENDING',
  SENT: 'SENT',
  FAILED: 'FAILED',
  ACKNOWLEDGED: 'ACKNOWLEDGED',
  RECOVERED: 'RECOVERED',
} as const;

export type NotificationStatus = (typeof NotificationStatus)[keyof typeof NotificationStatus];

// ============================================================
// Alert Rule Types
// ============================================================

/**
 * 通知頻道配置
 */
export interface AlertChannelConfig {
  /** 頻道類型 */
  channel: NotificationChannel;
  /** 是否啟用 */
  enabled: boolean;
  /** 頻道特定配置 */
  config?: {
    webhookUrl?: string;
    templateId?: string;
  };
}

/**
 * 創建警報規則請求
 */
export interface CreateAlertRuleRequest {
  name: string;
  description?: string;
  conditionType: AlertConditionType;
  metric: string;
  operator: AlertOperator;
  threshold: number;
  duration: number;
  serviceName?: string;
  endpoint?: string;
  severity: AlertSeverity;
  channels: NotificationChannel[];
  recipients: string[];
  cooldownMinutes?: number;
  cityId?: string;
}

/**
 * 更新警報規則請求
 */
export interface UpdateAlertRuleRequest {
  name?: string;
  description?: string | null;
  isActive?: boolean;
  conditionType?: AlertConditionType;
  metric?: string;
  operator?: AlertOperator;
  threshold?: number;
  duration?: number;
  serviceName?: string | null;
  endpoint?: string | null;
  severity?: AlertSeverity;
  channels?: NotificationChannel[];
  recipients?: string[];
  cooldownMinutes?: number | null;
  cityId?: string | null;
}

/**
 * 警報規則響應（包含關聯數據）
 */
export interface AlertRuleResponse extends AlertRule {
  createdBy?: {
    id: string;
    name: string | null;
    email: string;
  };
  city?: {
    id: string;
    code: string;
    name: string;
  } | null;
  _count?: {
    alerts: number;
  };
}

/**
 * 警報規則列表查詢參數
 */
export interface AlertRuleListParams {
  page?: number;
  limit?: number;
  isActive?: boolean;
  severity?: AlertSeverity;
  conditionType?: AlertConditionType;
  cityId?: string;
  search?: string;
}

// ============================================================
// Alert Types
// ============================================================

/**
 * 警報詳情
 */
export interface AlertDetails {
  message?: string;
  context?: Record<string, unknown>;
  stackTrace?: string;
}

/**
 * 指標數據快照
 */
export interface MetricDataSnapshot {
  timestamp: string;
  value: number;
  previousValues?: number[];
}

/**
 * 警報響應（包含關聯數據）
 */
export interface AlertResponse extends Alert {
  rule: {
    id: string;
    name: string;
    severity: string;
    conditionType: string;
    metric: string;
    operator: string;
    threshold: number;
  };
  city?: {
    id: string;
    code: string;
    name: string;
  } | null;
  notifications?: AlertRuleNotification[];
}

/**
 * 警報列表查詢參數
 */
export interface AlertListParams {
  page?: number;
  limit?: number;
  status?: AlertStatus;
  ruleId?: string;
  severity?: AlertSeverity;
  cityId?: string;
  startDate?: string;
  endDate?: string;
}

/**
 * 確認警報請求
 */
export interface AcknowledgeAlertRequest {
  note?: string;
}

/**
 * 解決警報請求
 */
export interface ResolveAlertRequest {
  resolution: string;
}

// ============================================================
// Statistics Types
// ============================================================

/**
 * 警報統計數據
 */
export interface AlertStatistics {
  /** 總警報數 */
  totalAlerts: number;
  /** 觸發中的警報數 */
  firingAlerts: number;
  /** 已確認的警報數 */
  acknowledgedAlerts: number;
  /** 已解決的警報數 */
  resolvedAlerts: number;
  /** 已恢復的警報數 */
  recoveredAlerts: number;
  /** 按嚴重程度統計 */
  bySeverity: {
    INFO: number;
    WARNING: number;
    CRITICAL: number;
    EMERGENCY: number;
  };
  /** 按條件類型統計 */
  byConditionType: Record<string, number>;
  /** 平均解決時間（分鐘） */
  avgResolutionTime: number | null;
  /** 平均恢復時間（分鐘） */
  avgRecoveryTime: number | null;
}

/**
 * 警報趨勢數據點
 */
export interface AlertTrendPoint {
  date: string;
  count: number;
  bySeverity: Record<string, number>;
}

// ============================================================
// Metric Value Types
// ============================================================

/**
 * 指標值
 */
export interface MetricValue {
  /** 指標名稱 */
  name: string;
  /** 當前值 */
  value: number;
  /** 時間戳 */
  timestamp: Date;
  /** 標籤 */
  labels?: Record<string, string>;
}

/**
 * 警報評估上下文
 */
export interface AlertEvaluationContext {
  /** 規則 ID */
  ruleId: string;
  /** 指標值 */
  metricValue: MetricValue;
  /** 閾值 */
  threshold: number;
  /** 運算符 */
  operator: AlertOperator;
  /** 上次評估時間 */
  lastEvaluatedAt?: Date;
  /** 上次觸發時間 */
  lastFiredAt?: Date;
}

// ============================================================
// Notification Types
// ============================================================

/**
 * 通知模板變數
 */
export interface NotificationTemplateVars {
  ruleName: string;
  severity: AlertSeverity;
  metricName: string;
  currentValue: number;
  threshold: number;
  operator: string;
  triggeredAt: string;
  alertUrl: string;
  recoveredAt?: string;
}

/**
 * 發送通知請求
 */
export interface SendNotificationRequest {
  alertId: string;
  channel: NotificationChannel;
  recipient: string;
  subject: string;
  body: string;
}

/**
 * 通知發送結果
 */
export interface NotificationSendResult {
  success: boolean;
  channel: NotificationChannel;
  recipient: string;
  sentAt?: Date;
  errorMessage?: string;
}

// ============================================================
// Re-export Prisma types
// ============================================================

export type { AlertRule, Alert, AlertRuleNotification };
