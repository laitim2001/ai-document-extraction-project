/**
 * @fileoverview n8n Webhook 服務 - 管理 Webhook 事件發送與接收
 * @description
 *   本模組負責 n8n 整合的 Webhook 通訊，包含：
 *   - 事件發送與重試機制
 *   - Webhook 發送狀態追蹤
 *   - 重試佇列處理
 *   - 發送統計分析
 *
 *   ## 重試策略
 *   - 第 1 次重試：1 秒後
 *   - 第 2 次重試：5 秒後
 *   - 第 3 次重試：30 秒後
 *   - 超過 3 次：標記為 EXHAUSTED
 *
 *   ## 事件類型
 *   - DOCUMENT_RECEIVED：文件已接收
 *   - DOCUMENT_PROCESSING：處理中
 *   - DOCUMENT_COMPLETED：處理完成
 *   - DOCUMENT_FAILED：處理失敗
 *   - DOCUMENT_REVIEW_NEEDED：需要人工審核
 *   - WORKFLOW_STARTED：工作流啟動
 *   - WORKFLOW_COMPLETED：工作流完成
 *   - WORKFLOW_FAILED：工作流失敗
 *
 * @module src/services/n8n/n8n-webhook.service
 * @author Development Team
 * @since Epic 10 - Story 10.1
 * @lastModified 2025-12-20
 *
 * @features
 *   - 事件發送與追蹤
 *   - 自動重試機制
 *   - 重試佇列恢復
 *   - 發送統計分析
 *
 * @dependencies
 *   - @/lib/prisma - 資料庫客戶端
 *
 * @related
 *   - src/types/n8n.ts - n8n 類型定義
 *   - prisma/schema.prisma - N8nWebhookEvent 模型
 */

import { prisma } from '@/lib/prisma';
import type {
  SendEventInput,
  WebhookPayload,
  WebhookDeliveryResult,
  WebhookDeliveryStats,
  N8nEventType,
} from '@/types/n8n';
import type { Prisma, WebhookDeliveryStatus } from '@prisma/client';

// ============================================================
// Constants
// ============================================================

/** 重試延遲（毫秒）：1秒、5秒、30秒 */
const RETRY_DELAYS = [1000, 5000, 30000];

/** 預設超時時間（30 秒） */
const DEFAULT_TIMEOUT = 30000;

/** 最大重試次數 */
const MAX_ATTEMPTS = 3;

// ============================================================
// Service Class
// ============================================================

/**
 * @class N8nWebhookService
 * @description n8n Webhook 事件發送服務
 */
export class N8nWebhookService {
  // ============================================================
  // Public Methods - Event Sending
  // ============================================================

  /**
   * 發送事件
   *
   * @description
   *   建立事件記錄並立即嘗試發送 Webhook。
   *   如果發送失敗，會自動排程重試。
   *
   * @param input - 發送事件輸入
   * @returns 發送結果
   *
   * @example
   * ```typescript
   * const result = await n8nWebhookService.sendEvent({
   *   eventType: 'DOCUMENT_COMPLETED',
   *   documentId: 'doc-123',
   *   webhookUrl: 'https://n8n.example.com/webhook/xxx',
   *   cityCode: 'TW',
   *   payload: { status: 'success', data: { ... } },
   * });
   * ```
   */
  async sendEvent(input: SendEventInput): Promise<WebhookDeliveryResult> {
    // 創建事件記錄
    const event = await prisma.n8nWebhookEvent.create({
      data: {
        eventType: input.eventType as N8nEventType,
        documentId: input.documentId ?? null,
        workflowExecutionId: input.workflowExecutionId ?? null,
        webhookUrl: input.webhookUrl,
        cityCode: input.cityCode,
        requestPayload: input.payload as Prisma.JsonObject,
        status: 'PENDING',
        maxAttempts: MAX_ATTEMPTS,
      },
    });

    // 立即嘗試發送
    return this.deliverWebhook(event.id);
  }

  /**
   * 發送 Webhook
   *
   * @description
   *   執行實際的 Webhook HTTP 請求。
   *   處理成功、失敗和重試邏輯。
   *
   * @param eventId - 事件 ID
   * @returns 發送結果
   */
  async deliverWebhook(eventId: string): Promise<WebhookDeliveryResult> {
    const event = await prisma.n8nWebhookEvent.findUnique({
      where: { id: eventId },
    });

    if (!event || event.status === 'SUCCESS' || event.status === 'EXHAUSTED') {
      return {
        success: false,
        eventId,
        status: (event?.status ?? 'PENDING') as WebhookDeliveryStatus,
        error: 'Event not found or already completed',
      };
    }

    // 更新狀態為發送中
    await prisma.n8nWebhookEvent.update({
      where: { id: eventId },
      data: { status: 'SENDING' },
    });

    const traceId = this.generateTraceId();
    const startTime = Date.now();

    const payload: WebhookPayload = {
      event: event.eventType as N8nEventType,
      timestamp: new Date().toISOString(),
      data: event.requestPayload as Record<string, unknown>,
      metadata: {
        traceId,
        retryCount: event.attemptCount,
        cityCode: event.cityCode,
      },
    };

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT);

      const response = await fetch(event.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Event': event.eventType,
          'X-Trace-Id': traceId,
          'X-Retry-Count': event.attemptCount.toString(),
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const durationMs = Date.now() - startTime;
      const responseBody = await response.text();

      if (response.ok) {
        // 成功
        await prisma.n8nWebhookEvent.update({
          where: { id: eventId },
          data: {
            status: 'SUCCESS',
            responseCode: response.status,
            responseBody,
            attemptCount: event.attemptCount + 1,
            lastAttemptAt: new Date(),
            completedAt: new Date(),
            durationMs,
          },
        });

        return {
          success: true,
          eventId,
          status: 'SUCCESS',
          responseCode: response.status,
          responseTime: durationMs,
        };
      } else {
        throw new Error(`HTTP ${response.status}: ${responseBody}`);
      }
    } catch (error) {
      const durationMs = Date.now() - startTime;
      return this.handleDeliveryError(event, error, durationMs);
    }
  }

  /**
   * 處理待重試的 Webhooks
   *
   * @description
   *   用於應用重啟後恢復待重試的 Webhook 事件。
   *   處理所有已達重試時間的事件。
   *
   * @returns 處理的事件數量
   *
   * @example
   * ```typescript
   * // 應用啟動時執行
   * const processed = await n8nWebhookService.processRetryQueue();
   * console.log(`Processed ${processed} pending webhooks`);
   * ```
   */
  async processRetryQueue(): Promise<number> {
    const pendingRetries = await prisma.n8nWebhookEvent.findMany({
      where: {
        status: 'RETRYING',
        nextRetryAt: { lte: new Date() },
      },
      take: 100, // 批次處理
    });

    for (const event of pendingRetries) {
      await this.deliverWebhook(event.id);
    }

    return pendingRetries.length;
  }

  // ============================================================
  // Public Methods - Statistics
  // ============================================================

  /**
   * 獲取事件發送統計
   *
   * @description
   *   取得 Webhook 發送的統計數據，包含成功率和平均響應時間。
   *
   * @param options - 統計選項
   * @returns 發送統計
   *
   * @example
   * ```typescript
   * const stats = await n8nWebhookService.getDeliveryStats({
   *   cityCode: 'TW',
   *   startDate: new Date('2025-01-01'),
   *   endDate: new Date('2025-01-31'),
   * });
   * console.log(`Success rate: ${stats.successRate}%`);
   * ```
   */
  async getDeliveryStats(options: {
    cityCode?: string;
    startDate?: Date;
    endDate?: Date;
  }): Promise<WebhookDeliveryStats> {
    const { cityCode, startDate, endDate } = options;

    const where: Prisma.N8nWebhookEventWhereInput = {};
    if (cityCode) where.cityCode = cityCode;
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = startDate;
      if (endDate) where.createdAt.lte = endDate;
    }

    const [counts, avgDuration] = await Promise.all([
      prisma.n8nWebhookEvent.groupBy({
        by: ['status'],
        where,
        _count: true,
      }),
      prisma.n8nWebhookEvent.aggregate({
        where: {
          ...where,
          status: 'SUCCESS',
          durationMs: { not: null },
        },
        _avg: { durationMs: true },
      }),
    ]);

    const statusMap: Record<string, number> = {};
    counts.forEach((c) => {
      statusMap[c.status] = c._count;
    });

    const total = Object.values(statusMap).reduce((a, b) => a + b, 0);
    const success = statusMap['SUCCESS'] ?? 0;
    const failed = (statusMap['FAILED'] ?? 0) + (statusMap['EXHAUSTED'] ?? 0);
    const pending =
      (statusMap['PENDING'] ?? 0) +
      (statusMap['SENDING'] ?? 0) +
      (statusMap['RETRYING'] ?? 0);

    return {
      total,
      success,
      failed,
      pending,
      successRate: total > 0 ? (success / total) * 100 : 0,
      avgResponseTime: avgDuration._avg.durationMs ?? 0,
    };
  }

  /**
   * 獲取事件詳情
   *
   * @param eventId - 事件 ID
   * @returns 事件詳情或 null
   */
  async getEventById(eventId: string) {
    return prisma.n8nWebhookEvent.findUnique({
      where: { id: eventId },
    });
  }

  /**
   * 列出最近的事件
   *
   * @param options - 列表選項
   * @returns 事件列表
   */
  async listRecentEvents(options: {
    cityCode?: string;
    documentId?: string;
    limit?: number;
  }) {
    const { cityCode, documentId, limit = 50 } = options;

    const where: Prisma.N8nWebhookEventWhereInput = {};
    if (cityCode) where.cityCode = cityCode;
    if (documentId) where.documentId = documentId;

    return prisma.n8nWebhookEvent.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  // ============================================================
  // Private Methods
  // ============================================================

  /**
   * 處理發送錯誤
   *
   * @description
   *   處理 Webhook 發送失敗的情況。
   *   根據重試次數決定是否排程下次重試。
   *
   * @param event - 事件記錄
   * @param error - 錯誤對象
   * @param durationMs - 請求耗時
   * @returns 發送結果
   */
  private async handleDeliveryError(
    event: { id: string; attemptCount: number; maxAttempts: number },
    error: unknown,
    durationMs: number
  ): Promise<WebhookDeliveryResult> {
    const newAttemptCount = event.attemptCount + 1;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    if (newAttemptCount >= event.maxAttempts) {
      // 重試次數耗盡
      await prisma.n8nWebhookEvent.update({
        where: { id: event.id },
        data: {
          status: 'EXHAUSTED',
          errorMessage,
          attemptCount: newAttemptCount,
          lastAttemptAt: new Date(),
          durationMs,
        },
      });

      return {
        success: false,
        eventId: event.id,
        status: 'EXHAUSTED',
        error: errorMessage,
        responseTime: durationMs,
      };
    }

    // 設置下次重試時間
    const nextRetryDelay = RETRY_DELAYS[newAttemptCount - 1] ?? 30000;
    const nextRetryAt = new Date(Date.now() + nextRetryDelay);

    await prisma.n8nWebhookEvent.update({
      where: { id: event.id },
      data: {
        status: 'RETRYING',
        errorMessage,
        attemptCount: newAttemptCount,
        lastAttemptAt: new Date(),
        nextRetryAt,
        durationMs,
      },
    });

    // 排程重試
    setTimeout(() => {
      this.deliverWebhook(event.id).catch((err) => {
        console.error(`Failed to retry webhook ${event.id}:`, err);
      });
    }, nextRetryDelay);

    return {
      success: false,
      eventId: event.id,
      status: 'RETRYING',
      error: errorMessage,
      responseTime: durationMs,
      retryScheduled: nextRetryAt,
    };
  }

  /**
   * 生成 Trace ID
   *
   * @description
   *   生成唯一的追蹤 ID，用於請求追蹤和日誌關聯。
   *
   * @returns 追蹤 ID
   */
  private generateTraceId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 11);
    return `wh_${timestamp}_${random}`;
  }
}

// ============================================================
// Singleton Export
// ============================================================

/**
 * n8n Webhook 服務單例
 */
export const n8nWebhookService = new N8nWebhookService();
