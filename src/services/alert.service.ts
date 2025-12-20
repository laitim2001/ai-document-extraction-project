/**
 * @fileoverview 告警服務
 * @description
 *   本模組負責系統告警的完整生命週期管理，包含：
 *   - 告警創建與更新
 *   - 告警確認與解決
 *   - 告警查詢與統計
 *   - 通知發送（Email, Teams, Slack）
 *
 *   ## 告警狀態流轉
 *   ```
 *   ACTIVE → ACKNOWLEDGED → RESOLVED
 *          ↘ SUPPRESSED
 *   ```
 *
 *   ## 告警嚴重程度
 *   - CRITICAL: 需要立即處理
 *   - ERROR: 需要處理
 *   - WARNING: 需要注意
 *   - INFO: 一般性通知
 *
 * @module src/services/alert.service
 * @author Development Team
 * @since Epic 10 - Story 10.7
 * @lastModified 2025-12-20
 *
 * @features
 *   - 告警 CRUD 操作
 *   - 告警狀態管理
 *   - 告警摘要統計
 *   - 多通道通知發送
 *
 * @dependencies
 *   - @/lib/prisma - 資料庫客戶端
 */

import { prisma } from '@/lib/prisma';
import { AlertType, AlertSeverity, AlertStatus } from '@prisma/client';
import {
  CreateAlertParams,
  AcknowledgeAlertParams,
  ResolveAlertParams,
  AlertSummary,
  ListAlertsParams,
  AlertRecordDto,
  AlertRecordListItem,
  NotificationMessage,
} from '@/types/alert-service';

// ============================================================
// Constants
// ============================================================

/** 預設頁面大小 */
const DEFAULT_PAGE_SIZE = 20;

// Note: DEFAULT_COOLDOWN_MINUTES 將在實現通知冷卻功能時使用
// const DEFAULT_COOLDOWN_MINUTES = 30;

// ============================================================
// Service Class
// ============================================================

/**
 * @class AlertService
 * @description 告警管理服務
 */
export class AlertService {
  // ============================================================
  // Alert Management
  // ============================================================

  /**
   * 創建告警
   *
   * @description
   *   創建新的告警記錄：
   *   1. 檢查是否已有相同的活躍告警（避免重複）
   *   2. 創建或更新告警記錄
   *   3. 發送通知（如配置）
   *
   * @param params - 創建告警的參數
   * @returns 告警記錄
   */
  async createAlert(params: CreateAlertParams): Promise<AlertRecordDto> {
    const { alertType, severity, title, message, details, service, cityCode } = params;

    // 檢查是否已有相同的活躍告警
    const existingAlert = await prisma.alertRecord.findFirst({
      where: {
        alertType,
        service,
        cityCode: cityCode || null,
        status: { in: [AlertStatus.ACTIVE, AlertStatus.ACKNOWLEDGED] },
      },
    });

    if (existingAlert) {
      // 更新現有告警
      const updated = await prisma.alertRecord.update({
        where: { id: existingAlert.id },
        data: {
          message,
          details: details as object,
          updatedAt: new Date(),
        },
      });
      return this.toDto(updated);
    }

    // 創建新告警
    const alert = await prisma.alertRecord.create({
      data: {
        alertType,
        severity,
        title,
        message,
        details: details as object,
        service,
        cityCode,
      },
    });

    // 發送通知
    await this.sendNotifications(alert);

    return this.toDto(alert);
  }

  /**
   * 確認告警
   *
   * @param params - 確認告警的參數
   * @returns 更新後的告警記錄
   */
  async acknowledgeAlert(params: AcknowledgeAlertParams): Promise<AlertRecordDto> {
    const { alertId, userId, note } = params;

    const alert = await prisma.alertRecord.update({
      where: { id: alertId },
      data: {
        status: AlertStatus.ACKNOWLEDGED,
        acknowledgedBy: userId,
        acknowledgedAt: new Date(),
        ...(note && { resolutionNote: note }),
      },
    });

    return this.toDto(alert);
  }

  /**
   * 解決告警
   *
   * @param params - 解決告警的參數
   * @returns 更新後的告警記錄
   */
  async resolveAlert(params: ResolveAlertParams): Promise<AlertRecordDto> {
    const { alertId, userId, note } = params;

    const alert = await prisma.alertRecord.update({
      where: { id: alertId },
      data: {
        status: AlertStatus.RESOLVED,
        resolvedBy: userId,
        resolvedAt: new Date(),
        ...(note && { resolutionNote: note }),
      },
    });

    return this.toDto(alert);
  }

  /**
   * 解決服務相關的所有告警
   *
   * @param service - 服務名稱
   * @param options - 選項
   */
  async resolveAlertsByService(
    service: string,
    options?: { cityCode?: string; note?: string }
  ): Promise<number> {
    const result = await prisma.alertRecord.updateMany({
      where: {
        service,
        ...(options?.cityCode && { cityCode: options.cityCode }),
        status: { in: [AlertStatus.ACTIVE, AlertStatus.ACKNOWLEDGED] },
      },
      data: {
        status: AlertStatus.RESOLVED,
        resolvedAt: new Date(),
        ...(options?.note && { resolutionNote: options.note }),
      },
    });

    return result.count;
  }

  /**
   * 抑制告警
   *
   * @param alertId - 告警 ID
   * @param userId - 操作者 ID
   */
  async suppressAlert(alertId: string, userId: string): Promise<void> {
    await prisma.alertRecord.update({
      where: { id: alertId },
      data: {
        status: AlertStatus.SUPPRESSED,
        acknowledgedBy: userId,
        acknowledgedAt: new Date(),
      },
    });
  }

  // ============================================================
  // Alert Queries
  // ============================================================

  /**
   * 獲取告警詳情
   *
   * @param alertId - 告警 ID
   * @returns 告警詳情或 null
   */
  async getAlert(alertId: string): Promise<AlertRecordDto | null> {
    const alert = await prisma.alertRecord.findUnique({
      where: { id: alertId },
    });

    if (!alert) return null;

    return this.toDto(alert);
  }

  /**
   * 獲取活躍告警
   *
   * @param service - 服務名稱（可選）
   * @returns 活躍告警列表
   */
  async getActiveAlerts(service?: string): Promise<AlertRecordDto[]> {
    const alerts = await prisma.alertRecord.findMany({
      where: {
        status: { in: [AlertStatus.ACTIVE, AlertStatus.ACKNOWLEDGED] },
        ...(service && { service }),
      },
      orderBy: [{ severity: 'desc' }, { createdAt: 'desc' }],
    });

    return alerts.map((alert) => this.toDto(alert));
  }

  /**
   * 獲取告警列表
   *
   * @param params - 查詢參數
   * @returns 告警列表與分頁資訊
   */
  async listAlerts(params: ListAlertsParams = {}): Promise<{
    items: AlertRecordListItem[];
    pagination: {
      page: number;
      pageSize: number;
      total: number;
      totalPages: number;
    };
  }> {
    const {
      service,
      cityCode,
      status,
      severity,
      alertType,
      page = 1,
      pageSize = DEFAULT_PAGE_SIZE,
      startDate,
      endDate,
    } = params;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};
    if (service) where.service = service;
    if (cityCode) where.cityCode = cityCode;
    if (status) where.status = status;
    if (severity) where.severity = severity;
    if (alertType) where.alertType = alertType;
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = startDate;
      if (endDate) where.createdAt.lte = endDate;
    }

    const skip = (page - 1) * pageSize;

    const [items, total] = await Promise.all([
      prisma.alertRecord.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }],
        skip,
        take: pageSize,
        select: {
          id: true,
          alertType: true,
          severity: true,
          title: true,
          service: true,
          cityCode: true,
          status: true,
          createdAt: true,
        },
      }),
      prisma.alertRecord.count({ where }),
    ]);

    return {
      items: items.map((item) => ({
        id: item.id,
        alertType: item.alertType,
        severity: item.severity,
        title: item.title,
        service: item.service,
        cityCode: item.cityCode,
        status: item.status,
        createdAt: item.createdAt,
      })),
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  /**
   * 獲取告警摘要
   *
   * @returns 告警摘要統計
   */
  async getAlertSummary(): Promise<AlertSummary> {
    const [totalCount, bySeverity, byStatus, byService, recentAlerts] = await Promise.all([
      prisma.alertRecord.count(),
      prisma.alertRecord.groupBy({
        by: ['severity'],
        _count: true,
      }),
      prisma.alertRecord.groupBy({
        by: ['status'],
        _count: true,
      }),
      prisma.alertRecord.groupBy({
        by: ['service'],
        _count: true,
      }),
      prisma.alertRecord.findMany({
        where: { status: AlertStatus.ACTIVE },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true,
          title: true,
          severity: true,
          createdAt: true,
        },
      }),
    ]);

    return {
      total: totalCount,
      bySeverity: Object.fromEntries(
        bySeverity.map((s) => [s.severity, s._count])
      ) as Record<AlertSeverity, number>,
      byStatus: Object.fromEntries(
        byStatus.map((s) => [s.status, s._count])
      ) as Record<AlertStatus, number>,
      byService: Object.fromEntries(
        byService.map((s) => [s.service, s._count])
      ) as Record<string, number>,
      recentAlerts,
    };
  }

  /**
   * 獲取告警歷史
   *
   * @param options - 查詢選項
   * @returns 告警歷史列表
   */
  async getAlertHistory(options: {
    service?: string;
    alertType?: AlertType;
    severity?: AlertSeverity;
    status?: AlertStatus;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }): Promise<AlertRecordDto[]> {
    const {
      service,
      alertType,
      severity,
      status,
      startDate,
      endDate,
      limit = 100,
    } = options;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};
    if (service) where.service = service;
    if (alertType) where.alertType = alertType;
    if (severity) where.severity = severity;
    if (status) where.status = status;
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = startDate;
      if (endDate) where.createdAt.lte = endDate;
    }

    const alerts = await prisma.alertRecord.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 500),
    });

    return alerts.map((alert) => this.toDto(alert));
  }

  // ============================================================
  // Notification Methods
  // ============================================================

  /**
   * 發送通知
   *
   * @description
   *   根據通知配置發送告警通知
   *
   * @param alert - 告警記錄
   */
  private async sendNotifications(alert: {
    id: string;
    alertType: AlertType;
    severity: AlertSeverity;
    title: string;
    message: string;
    service: string;
    createdAt: Date;
  }): Promise<void> {
    const notifications: Array<{
      channel: string;
      sentAt: string;
      recipient: string;
      success: boolean;
      errorMessage?: string;
    }> = [];

    // 獲取通知配置
    const configs = await this.getNotificationConfigs(alert);
    if (configs.length === 0) return;

    const notificationMessage: NotificationMessage = {
      title: `[${alert.severity}] ${alert.title}`,
      body: alert.message,
      severity: alert.severity,
      service: alert.service,
      timestamp: alert.createdAt,
      actionUrl: `/admin/alerts/${alert.id}`,
    };

    for (const config of configs) {
      // Email 通知
      if (config.emailEnabled && config.emailRecipients.length > 0) {
        for (const recipient of config.emailRecipients) {
          try {
            await this.sendEmailNotification(recipient, notificationMessage);
            notifications.push({
              channel: 'email',
              sentAt: new Date().toISOString(),
              recipient,
              success: true,
            });
          } catch (error) {
            notifications.push({
              channel: 'email',
              sentAt: new Date().toISOString(),
              recipient,
              success: false,
              errorMessage: error instanceof Error ? error.message : 'Unknown error',
            });
          }
        }
      }

      // Teams 通知
      if (config.teamsEnabled && config.teamsWebhookUrl) {
        try {
          await this.sendTeamsNotification(config.teamsWebhookUrl, notificationMessage);
          notifications.push({
            channel: 'teams',
            sentAt: new Date().toISOString(),
            recipient: 'Teams Channel',
            success: true,
          });
        } catch (error) {
          notifications.push({
            channel: 'teams',
            sentAt: new Date().toISOString(),
            recipient: 'Teams Channel',
            success: false,
            errorMessage: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      // Slack 通知
      if (config.slackEnabled && config.slackWebhookUrl) {
        try {
          await this.sendSlackNotification(config.slackWebhookUrl, notificationMessage);
          notifications.push({
            channel: 'slack',
            sentAt: new Date().toISOString(),
            recipient: 'Slack Channel',
            success: true,
          });
        } catch (error) {
          notifications.push({
            channel: 'slack',
            sentAt: new Date().toISOString(),
            recipient: 'Slack Channel',
            success: false,
            errorMessage: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }
    }

    // 更新告警記錄的通知發送狀態
    if (notifications.length > 0) {
      await prisma.alertRecord.update({
        where: { id: alert.id },
        data: {
          notificationsSent: { notifications },
        },
      });
    }
  }

  /**
   * 獲取通知配置
   */
  private async getNotificationConfigs(alert: {
    alertType: AlertType;
    severity: AlertSeverity;
    service: string;
  }) {
    return prisma.alertNotificationConfig.findMany({
      where: {
        isActive: true,
        services: { has: alert.service },
        alertTypes: { has: alert.alertType },
        minSeverity: { in: this.getSeverityLevels(alert.severity) },
      },
    });
  }

  /**
   * 獲取嚴重程度級別列表（包含更低級別）
   */
  private getSeverityLevels(severity: AlertSeverity): AlertSeverity[] {
    const levels: AlertSeverity[] = [];
    const order: AlertSeverity[] = ['INFO', 'WARNING', 'ERROR', 'CRITICAL'];
    const index = order.indexOf(severity);

    for (let i = 0; i <= index; i++) {
      levels.push(order[i]);
    }

    return levels;
  }

  /**
   * 發送 Email 通知
   */
  private async sendEmailNotification(
    recipient: string,
    message: NotificationMessage
  ): Promise<void> {
    // TODO: 實現實際的 Email 發送邏輯
    // 目前只記錄日誌
    console.log(`[AlertService] Would send email to ${recipient}:`, message.title);
  }

  /**
   * 發送 Teams 通知
   */
  private async sendTeamsNotification(
    webhookUrl: string,
    message: NotificationMessage
  ): Promise<void> {
    // 構建 Teams Adaptive Card
    const card = {
      '@type': 'MessageCard',
      '@context': 'http://schema.org/extensions',
      themeColor: this.getSeverityColor(message.severity),
      summary: message.title,
      sections: [
        {
          activityTitle: message.title,
          facts: [
            { name: '服務', value: message.service },
            { name: '嚴重程度', value: message.severity },
            { name: '時間', value: message.timestamp.toISOString() },
          ],
          text: message.body,
        },
      ],
      potentialAction: message.actionUrl
        ? [
            {
              '@type': 'OpenUri',
              name: '查看詳情',
              targets: [{ os: 'default', uri: message.actionUrl }],
            },
          ]
        : undefined,
    };

    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(card),
      });

      if (!response.ok) {
        throw new Error(`Teams notification failed: ${response.statusText}`);
      }
    } catch (error) {
      console.error('[AlertService] Teams notification error:', error);
      throw error;
    }
  }

  /**
   * 發送 Slack 通知
   */
  private async sendSlackNotification(
    webhookUrl: string,
    message: NotificationMessage
  ): Promise<void> {
    // 構建 Slack 訊息
    const payload = {
      attachments: [
        {
          color: this.getSeverityColor(message.severity),
          title: message.title,
          text: message.body,
          fields: [
            { title: '服務', value: message.service, short: true },
            { title: '嚴重程度', value: message.severity, short: true },
            { title: '時間', value: message.timestamp.toISOString(), short: false },
          ],
          actions: message.actionUrl
            ? [
                {
                  type: 'button',
                  text: '查看詳情',
                  url: message.actionUrl,
                },
              ]
            : undefined,
        },
      ],
    };

    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Slack notification failed: ${response.statusText}`);
      }
    } catch (error) {
      console.error('[AlertService] Slack notification error:', error);
      throw error;
    }
  }

  /**
   * 獲取嚴重程度顏色
   */
  private getSeverityColor(severity: AlertSeverity): string {
    const colors: Record<AlertSeverity, string> = {
      INFO: '0076D7',
      WARNING: 'FFA500',
      ERROR: 'FF0000',
      CRITICAL: '8B0000',
    };
    return colors[severity] || '808080';
  }

  // ============================================================
  // Helper Methods
  // ============================================================

  /**
   * 轉換為 DTO
   */
  private toDto(alert: {
    id: string;
    alertType: AlertType;
    severity: AlertSeverity;
    title: string;
    message: string;
    details: unknown;
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
  }): AlertRecordDto {
    return {
      id: alert.id,
      alertType: alert.alertType,
      severity: alert.severity,
      title: alert.title,
      message: alert.message,
      details: alert.details as object | null,
      service: alert.service,
      cityCode: alert.cityCode,
      status: alert.status,
      acknowledgedBy: alert.acknowledgedBy,
      acknowledgedAt: alert.acknowledgedAt,
      resolvedAt: alert.resolvedAt,
      resolvedBy: alert.resolvedBy,
      resolutionNote: alert.resolutionNote,
      createdAt: alert.createdAt,
      updatedAt: alert.updatedAt,
    };
  }
}

// ============================================================
// Singleton Export
// ============================================================

/**
 * 告警服務單例
 */
export const alertService = new AlertService();
