/**
 * @fileoverview 警報通知服務
 * @description
 *   負責發送警報通知到各個頻道（Email、Teams、Webhook）
 *   支援通知模板、重試機制和狀態追蹤
 *
 * @module src/services/alert-notification.service
 * @since Epic 12 - Story 12-3 (錯誤警報設定)
 */

import { prisma } from '@/lib/prisma';
import type { Alert, AlertRule } from '@prisma/client';
import type {
  NotificationChannel,
  NotificationTemplateVars,
  NotificationSendResult,
} from '@/types/alerts';

// ============================================================
// Types
// ============================================================

interface AlertWithRule extends Alert {
  rule: AlertRule;
}

// ============================================================
// AlertNotificationService Class
// ============================================================

/**
 * 警報通知服務類別
 */
export class AlertNotificationService {
  private readonly baseUrl: string;

  constructor() {
    this.baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  }

  /**
   * 為警報發送所有配置的通知
   */
  async sendNotifications(alert: AlertWithRule): Promise<NotificationSendResult[]> {
    const channels = alert.rule.channels as NotificationChannel[];
    const recipients = alert.rule.recipients as string[];

    const results: NotificationSendResult[] = [];

    for (const channel of channels) {
      for (const recipient of recipients) {
        const result = await this.sendNotification(alert, channel, recipient);
        results.push(result);
      }
    }

    return results;
  }

  /**
   * 發送單個通知
   */
  async sendNotification(
    alert: AlertWithRule,
    channel: NotificationChannel,
    recipient: string
  ): Promise<NotificationSendResult> {
    const templateVars = this.buildTemplateVars(alert);
    const subject = this.buildSubject(alert.rule, templateVars);
    const body = this.buildBody(alert.rule, templateVars, channel);

    // 創建通知記錄
    const notification = await prisma.alertRuleNotification.create({
      data: {
        alertId: alert.id,
        channel,
        recipient,
        subject,
        body,
        status: 'PENDING',
      },
    });

    try {
      // 根據頻道發送通知
      switch (channel) {
        case 'EMAIL':
          await this.sendEmail(recipient, subject, body);
          break;
        case 'TEAMS':
          await this.sendTeamsMessage(recipient, subject, body);
          break;
        case 'WEBHOOK':
          await this.sendWebhook(recipient, alert, templateVars);
          break;
      }

      // 更新為已發送
      await prisma.alertRuleNotification.update({
        where: { id: notification.id },
        data: {
          status: 'SENT',
          sentAt: new Date(),
        },
      });

      return {
        success: true,
        channel,
        recipient,
        sentAt: new Date(),
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // 更新為失敗
      await prisma.alertRuleNotification.update({
        where: { id: notification.id },
        data: {
          status: 'FAILED',
          errorMessage,
        },
      });

      return {
        success: false,
        channel,
        recipient,
        errorMessage,
      };
    }
  }

  /**
   * 發送恢復通知
   */
  async sendRecoveryNotifications(alert: AlertWithRule): Promise<NotificationSendResult[]> {
    const channels = alert.rule.channels as NotificationChannel[];
    const recipients = alert.rule.recipients as string[];

    const results: NotificationSendResult[] = [];

    for (const channel of channels) {
      for (const recipient of recipients) {
        const result = await this.sendRecoveryNotification(alert, channel, recipient);
        results.push(result);
      }
    }

    return results;
  }

  /**
   * 發送單個恢復通知
   */
  private async sendRecoveryNotification(
    alert: AlertWithRule,
    channel: NotificationChannel,
    recipient: string
  ): Promise<NotificationSendResult> {
    const templateVars = this.buildTemplateVars(alert, true);
    const subject = `[RECOVERED] ${this.buildSubject(alert.rule, templateVars)}`;
    const body = this.buildRecoveryBody(alert.rule, templateVars, channel);

    // 創建通知記錄
    const notification = await prisma.alertRuleNotification.create({
      data: {
        alertId: alert.id,
        channel,
        recipient,
        subject,
        body,
        status: 'PENDING',
      },
    });

    try {
      switch (channel) {
        case 'EMAIL':
          await this.sendEmail(recipient, subject, body);
          break;
        case 'TEAMS':
          await this.sendTeamsMessage(recipient, subject, body);
          break;
        case 'WEBHOOK':
          await this.sendWebhook(recipient, alert, templateVars, 'recovered');
          break;
      }

      await prisma.alertRuleNotification.update({
        where: { id: notification.id },
        data: {
          status: 'RECOVERED',
          sentAt: new Date(),
        },
      });

      return {
        success: true,
        channel,
        recipient,
        sentAt: new Date(),
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      await prisma.alertRuleNotification.update({
        where: { id: notification.id },
        data: {
          status: 'FAILED',
          errorMessage,
        },
      });

      return {
        success: false,
        channel,
        recipient,
        errorMessage,
      };
    }
  }

  /**
   * 構建模板變數
   */
  private buildTemplateVars(alert: AlertWithRule, isRecovery = false): NotificationTemplateVars {
    const operatorSymbols: Record<string, string> = {
      GREATER_THAN: '>',
      GREATER_THAN_EQ: '>=',
      LESS_THAN: '<',
      LESS_THAN_EQ: '<=',
      EQUALS: '=',
      NOT_EQUALS: '!=',
    };

    return {
      ruleName: alert.rule.name,
      severity: alert.rule.severity as NotificationTemplateVars['severity'],
      metricName: alert.rule.metric,
      currentValue: alert.triggeredValue,
      threshold: alert.rule.threshold,
      operator: operatorSymbols[alert.rule.operator] || alert.rule.operator,
      triggeredAt: alert.triggeredAt.toISOString(),
      alertUrl: `${this.baseUrl}/admin/alerts/${alert.id}`,
      recoveredAt: isRecovery ? new Date().toISOString() : undefined,
    };
  }

  /**
   * 構建通知主題
   */
  private buildSubject(rule: AlertRule, vars: NotificationTemplateVars): string {
    const severityEmoji: Record<string, string> = {
      INFO: 'ℹ️',
      WARNING: '⚠️',
      CRITICAL: '🔴',
      EMERGENCY: '🚨',
    };

    return `${severityEmoji[rule.severity] || ''} [${rule.severity}] ${vars.ruleName}: ${vars.metricName} ${vars.operator} ${vars.threshold}`;
  }

  /**
   * 構建通知內容
   */
  private buildBody(
    rule: AlertRule,
    vars: NotificationTemplateVars,
    channel: NotificationChannel
  ): string {
    if (channel === 'TEAMS') {
      return this.buildTeamsCard(vars);
    }

    return `
警報規則: ${vars.ruleName}
嚴重程度: ${vars.severity}
指標: ${vars.metricName}
當前值: ${vars.currentValue}
閾值: ${vars.operator} ${vars.threshold}
觸發時間: ${new Date(vars.triggeredAt).toLocaleString('zh-TW')}

查看詳情: ${vars.alertUrl}
    `.trim();
  }

  /**
   * 構建恢復通知內容
   */
  private buildRecoveryBody(
    rule: AlertRule,
    vars: NotificationTemplateVars,
    channel: NotificationChannel
  ): string {
    if (channel === 'TEAMS') {
      return this.buildTeamsRecoveryCard(vars);
    }

    return `
✅ 警報已恢復

警報規則: ${vars.ruleName}
指標: ${vars.metricName}
觸發時間: ${new Date(vars.triggeredAt).toLocaleString('zh-TW')}
恢復時間: ${vars.recoveredAt ? new Date(vars.recoveredAt).toLocaleString('zh-TW') : '未知'}

查看詳情: ${vars.alertUrl}
    `.trim();
  }

  /**
   * 構建 Teams Adaptive Card
   */
  private buildTeamsCard(vars: NotificationTemplateVars): string {
    const card = {
      type: 'message',
      attachments: [
        {
          contentType: 'application/vnd.microsoft.card.adaptive',
          content: {
            $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
            type: 'AdaptiveCard',
            version: '1.4',
            body: [
              {
                type: 'TextBlock',
                text: `🚨 ${vars.ruleName}`,
                weight: 'Bolder',
                size: 'Large',
              },
              {
                type: 'FactSet',
                facts: [
                  { title: '嚴重程度', value: vars.severity },
                  { title: '指標', value: vars.metricName },
                  { title: '當前值', value: String(vars.currentValue) },
                  { title: '閾值', value: `${vars.operator} ${vars.threshold}` },
                  { title: '觸發時間', value: new Date(vars.triggeredAt).toLocaleString('zh-TW') },
                ],
              },
            ],
            actions: [
              {
                type: 'Action.OpenUrl',
                title: '查看詳情',
                url: vars.alertUrl,
              },
            ],
          },
        },
      ],
    };

    return JSON.stringify(card);
  }

  /**
   * 構建 Teams 恢復 Adaptive Card
   */
  private buildTeamsRecoveryCard(vars: NotificationTemplateVars): string {
    const card = {
      type: 'message',
      attachments: [
        {
          contentType: 'application/vnd.microsoft.card.adaptive',
          content: {
            $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
            type: 'AdaptiveCard',
            version: '1.4',
            body: [
              {
                type: 'TextBlock',
                text: `✅ 警報已恢復: ${vars.ruleName}`,
                weight: 'Bolder',
                size: 'Large',
                color: 'Good',
              },
              {
                type: 'FactSet',
                facts: [
                  { title: '指標', value: vars.metricName },
                  { title: '觸發時間', value: new Date(vars.triggeredAt).toLocaleString('zh-TW') },
                  { title: '恢復時間', value: vars.recoveredAt ? new Date(vars.recoveredAt).toLocaleString('zh-TW') : '未知' },
                ],
              },
            ],
            actions: [
              {
                type: 'Action.OpenUrl',
                title: '查看詳情',
                url: vars.alertUrl,
              },
            ],
          },
        },
      ],
    };

    return JSON.stringify(card);
  }

  /**
   * 發送 Email（模擬實現）
   */
  private async sendEmail(to: string, subject: string, body: string): Promise<void> {
    // TODO: 實際實現需要整合 Email 服務（如 SendGrid、Azure Communication Services）
    console.log(`[AlertNotification] Sending email to ${to}`);
    console.log(`Subject: ${subject}`);
    console.log(`Body: ${body}`);

    // 模擬發送延遲
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  /**
   * 發送 Teams 消息
   */
  private async sendTeamsMessage(webhookUrl: string, subject: string, card: string): Promise<void> {
    // 驗證 webhook URL
    if (!webhookUrl.startsWith('https://')) {
      throw new Error('Invalid Teams webhook URL');
    }

    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: card,
      });

      if (!response.ok) {
        throw new Error(`Teams webhook failed with status ${response.status}`);
      }
    } catch (error) {
      // 在開發環境中，如果 webhook 失敗，只記錄日誌
      console.error('[AlertNotification] Teams webhook error:', error);
      throw error;
    }
  }

  /**
   * 發送 Webhook
   */
  private async sendWebhook(
    url: string,
    alert: AlertWithRule,
    vars: NotificationTemplateVars,
    event: 'firing' | 'recovered' = 'firing'
  ): Promise<void> {
    const payload = {
      event,
      alertId: alert.id,
      ruleId: alert.rule.id,
      ruleName: alert.rule.name,
      severity: alert.rule.severity,
      metric: alert.rule.metric,
      currentValue: alert.triggeredValue,
      threshold: alert.rule.threshold,
      operator: alert.rule.operator,
      triggeredAt: alert.triggeredAt.toISOString(),
      recoveredAt: event === 'recovered' ? new Date().toISOString() : null,
    };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Alert-Event': event,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Webhook failed with status ${response.status}`);
      }
    } catch (error) {
      console.error('[AlertNotification] Webhook error:', error);
      throw error;
    }
  }

  /**
   * 獲取通知記錄
   */
  async getNotifications(alertId: string) {
    return prisma.alertRuleNotification.findMany({
      where: { alertId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * 重試失敗的通知
   */
  async retryFailedNotification(notificationId: string): Promise<NotificationSendResult> {
    const notification = await prisma.alertRuleNotification.findUnique({
      where: { id: notificationId },
      include: {
        alert: {
          include: {
            rule: true,
          },
        },
      },
    });

    if (!notification) {
      throw new Error('Notification not found');
    }

    if (notification.status !== 'FAILED') {
      throw new Error('Only failed notifications can be retried');
    }

    return this.sendNotification(
      notification.alert as AlertWithRule,
      notification.channel as NotificationChannel,
      notification.recipient
    );
  }
}

// ============================================================
// Singleton Export
// ============================================================

export const alertNotificationService = new AlertNotificationService();
