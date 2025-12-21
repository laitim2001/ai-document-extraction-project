/**
 * @fileoverview Webhook 通知服務
 * @description
 *   處理外部 API Webhook 通知的核心服務，支援：
 *   - 發送 Webhook 通知
 *   - HMAC-SHA256 簽名驗證
 *   - 重試機制（指數退避）
 *   - 發送歷史查詢
 *   - 統計數據彙總
 *
 * @module src/services/webhook.service
 * @author Development Team
 * @since Epic 11 - Story 11.4 (Webhook 通知服務)
 * @lastModified 2025-12-21
 *
 * @features
 *   - HMAC-SHA256 簽名生成
 *   - 非阻塞異步發送
 *   - 指數退避重試（1/5/30 分鐘）
 *   - Timing-safe 簽名比較
 *   - 發送歷史與統計
 *
 * @dependencies
 *   - @prisma/client - 資料庫操作
 *   - crypto - HMAC 簽名生成
 *   - @/types/external-api/webhook - Webhook 類型
 *
 * @related
 *   - src/services/invoice-submission.service.ts - 發票提交服務
 *   - src/app/api/v1/webhooks/route.ts - Webhook 歷史 API
 */

import { prisma } from '@/lib/prisma';
import {
  ExternalWebhookDelivery,
  ExternalWebhookDeliveryStatus,
  WebhookEventType,
  Prisma,
} from '@prisma/client';
import crypto from 'crypto';
import {
  WebhookEventType as WebhookEventTypeAlias,
  WebhookDeliveryStatus,
  WebhookPayload,
  WebhookDeliveryRecord,
  WebhookDeliveryHistoryResponse,
  WebhookDeliveryStats,
  WebhookRetryResponse,
  WebhookSendOptions,
  WebhookSendResult,
  WebhookHistoryQueryParams,
  WebhookStatsQueryParams,
  WebhookSignatureHeaders,
  DEFAULT_HISTORY_PAGE_SIZE,
  MAX_HISTORY_PAGE_SIZE,
  DEFAULT_STATS_RANGE_DAYS,
  WEBHOOK_ERROR_CODES,
} from '@/types/external-api/webhook';

// ============================================================
// 常數定義
// ============================================================

/**
 * 重試延遲（毫秒）
 * 1 分鐘、5 分鐘、30 分鐘
 */
const RETRY_DELAYS_MS = [60000, 300000, 1800000];

/**
 * HTTP 請求超時（毫秒）
 */
const HTTP_TIMEOUT_MS = 30000;

/**
 * 狀態映射：Prisma enum → API 狀態
 */
const STATUS_MAP: Record<ExternalWebhookDeliveryStatus, WebhookDeliveryStatus> = {
  PENDING: 'PENDING',
  SENDING: 'SENDING',
  DELIVERED: 'DELIVERED',
  FAILED: 'FAILED',
  RETRYING: 'RETRYING',
};

/**
 * 事件類型映射：Prisma enum → API 類型
 */
const EVENT_TYPE_MAP: Record<WebhookEventType, WebhookEventTypeAlias> = {
  INVOICE_PROCESSING: 'INVOICE_PROCESSING',
  INVOICE_COMPLETED: 'INVOICE_COMPLETED',
  INVOICE_FAILED: 'INVOICE_FAILED',
  INVOICE_REVIEW_REQUIRED: 'INVOICE_REVIEW_REQUIRED',
};

// ============================================================
// 錯誤類別
// ============================================================

/**
 * Webhook 服務錯誤
 */
export class WebhookServiceError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number
  ) {
    super(message);
    this.name = 'WebhookServiceError';
  }
}

// ============================================================
// 簽名工具函數
// ============================================================

/**
 * 生成 HMAC-SHA256 簽名
 * @param payload - 要簽名的內容
 * @param secret - 簽名密鑰
 * @param timestamp - 時間戳記
 * @returns 簽名字串
 */
function generateSignature(
  payload: string,
  secret: string,
  timestamp: number
): string {
  const signaturePayload = `${timestamp}.${payload}`;
  return crypto
    .createHmac('sha256', secret)
    .update(signaturePayload, 'utf8')
    .digest('hex');
}

/**
 * Timing-safe 簽名比較
 * @param a - 簽名 A
 * @param b - 簽名 B
 * @returns 是否相等
 */
export function timingSafeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

// ============================================================
// 主要服務類別
// ============================================================

/**
 * Webhook 通知服務
 */
export class WebhookService {
  /**
   * 發送 Webhook 通知
   * @description 建立發送記錄並異步執行發送
   * @param options - 發送選項
   * @returns 發送結果
   */
  async sendWebhook(options: WebhookSendOptions): Promise<WebhookSendResult> {
    const { taskId, event, data, apiKeyId } = options;

    // 1. 取得 Webhook 配置
    const configs = await prisma.externalWebhookConfig.findMany({
      where: {
        apiKeyId,
        isActive: true,
        events: {
          has: event as WebhookEventType,
        },
      },
    });

    if (configs.length === 0) {
      return {
        deliveryId: '',
        sent: false,
        status: 'FAILED',
        error: 'No active webhook configuration found for this event',
      };
    }

    // 2. 對每個配置建立發送記錄
    const results: WebhookSendResult[] = [];

    for (const config of configs) {
      const timestamp = Date.now();
      const payload: WebhookPayload = {
        event: event as WebhookEventTypeAlias,
        taskId,
        timestamp: new Date(timestamp).toISOString(),
        data,
      } as WebhookPayload;

      const payloadString = JSON.stringify(payload);
      const signature = generateSignature(payloadString, config.secret, timestamp);

      // 建立發送記錄
      const delivery = await prisma.externalWebhookDelivery.create({
        data: {
          taskId,
          event: event as WebhookEventType,
          targetUrl: config.url,
          payload: payload as unknown as Prisma.JsonObject,
          signature,
          timestamp: BigInt(timestamp),
          status: 'PENDING',
          maxAttempts: config.maxRetries + 1, // 首次 + 重試次數
        },
      });

      // 3. 異步發送（不阻塞主流程）
      this.deliverWebhook(delivery.id).catch((error) => {
        console.error(`Webhook delivery failed for ${delivery.id}:`, error);
      });

      results.push({
        deliveryId: delivery.id,
        sent: true,
        status: 'PENDING',
      });
    }

    return results[0] || {
      deliveryId: '',
      sent: false,
      status: 'FAILED',
      error: 'Failed to create delivery records',
    };
  }

  /**
   * 執行 Webhook 發送
   * @description 實際執行 HTTP 請求
   * @param deliveryId - 發送記錄 ID
   */
  async deliverWebhook(deliveryId: string): Promise<void> {
    // 1. 取得發送記錄
    const delivery = await prisma.externalWebhookDelivery.findUnique({
      where: { id: deliveryId },
    });

    if (!delivery) {
      throw new WebhookServiceError(
        WEBHOOK_ERROR_CODES.DELIVERY_NOT_FOUND,
        'Delivery record not found',
        404
      );
    }

    // 2. 更新狀態為發送中
    await prisma.externalWebhookDelivery.update({
      where: { id: deliveryId },
      data: {
        status: 'SENDING',
        attempts: delivery.attempts + 1,
        lastAttemptAt: new Date(),
      },
    });

    // 3. 準備 Headers
    const headers: WebhookSignatureHeaders = {
      'X-Webhook-Signature': delivery.signature,
      'X-Webhook-Timestamp': delivery.timestamp.toString(),
      'X-Webhook-Event': EVENT_TYPE_MAP[delivery.event],
      'X-Webhook-Delivery-Id': delivery.id,
    };

    try {
      // 4. 發送 HTTP 請求
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), HTTP_TIMEOUT_MS);

      const response = await fetch(delivery.targetUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
        body: JSON.stringify(delivery.payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // 5. 處理響應
      const responseBody = await response.text().catch(() => '');

      if (response.ok) {
        // 成功
        await prisma.externalWebhookDelivery.update({
          where: { id: deliveryId },
          data: {
            status: 'DELIVERED',
            httpStatus: response.status,
            responseBody: responseBody.slice(0, 5000), // 限制長度
            completedAt: new Date(),
          },
        });
      } else {
        // HTTP 錯誤
        await this.handleDeliveryFailure(
          delivery,
          response.status,
          `HTTP ${response.status}: ${responseBody.slice(0, 500)}`
        );
      }
    } catch (error) {
      // 網路錯誤
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await this.handleDeliveryFailure(delivery, null, errorMessage);
    }
  }

  /**
   * 處理發送失敗
   * @param delivery - 發送記錄
   * @param httpStatus - HTTP 狀態碼
   * @param errorMessage - 錯誤訊息
   */
  private async handleDeliveryFailure(
    delivery: ExternalWebhookDelivery,
    httpStatus: number | null,
    errorMessage: string
  ): Promise<void> {
    const newAttempts = delivery.attempts + 1;
    const canRetry = newAttempts < delivery.maxAttempts;

    if (canRetry) {
      // 計算下次重試時間
      const retryIndex = Math.min(newAttempts - 1, RETRY_DELAYS_MS.length - 1);
      const delayMs = RETRY_DELAYS_MS[retryIndex];
      const nextRetryAt = new Date(Date.now() + delayMs);

      await prisma.externalWebhookDelivery.update({
        where: { id: delivery.id },
        data: {
          status: 'RETRYING',
          httpStatus,
          errorMessage: errorMessage.slice(0, 1000),
          attempts: newAttempts,
          nextRetryAt,
          lastAttemptAt: new Date(),
        },
      });
    } else {
      // 重試次數耗盡
      await prisma.externalWebhookDelivery.update({
        where: { id: delivery.id },
        data: {
          status: 'FAILED',
          httpStatus,
          errorMessage: errorMessage.slice(0, 1000),
          attempts: newAttempts,
          completedAt: new Date(),
          lastAttemptAt: new Date(),
        },
      });
    }
  }

  /**
   * 處理重試隊列
   * @description 由排程任務呼叫，處理等待重試的記錄
   * @param batchSize - 批次大小
   * @returns 處理的記錄數
   */
  async processRetryQueue(batchSize: number = 50): Promise<number> {
    const now = new Date();

    // 取得待重試的記錄
    const pendingRetries = await prisma.externalWebhookDelivery.findMany({
      where: {
        status: 'RETRYING',
        nextRetryAt: {
          lte: now,
        },
      },
      orderBy: {
        nextRetryAt: 'asc',
      },
      take: batchSize,
    });

    if (pendingRetries.length === 0) {
      return 0;
    }

    // 並行處理重試
    await Promise.allSettled(
      pendingRetries.map((delivery) => this.deliverWebhook(delivery.id))
    );

    return pendingRetries.length;
  }

  /**
   * 手動重試 Webhook
   * @param deliveryId - 發送記錄 ID
   * @param apiKeyId - API Key ID（用於權限驗證）
   * @returns 重試結果
   */
  async retryWebhook(
    deliveryId: string,
    apiKeyId: string
  ): Promise<WebhookRetryResponse> {
    // 1. 取得發送記錄
    const delivery = await prisma.externalWebhookDelivery.findUnique({
      where: { id: deliveryId },
      include: {
        task: {
          select: { apiKeyId: true },
        },
      },
    });

    if (!delivery) {
      throw new WebhookServiceError(
        WEBHOOK_ERROR_CODES.DELIVERY_NOT_FOUND,
        'Webhook delivery not found',
        404
      );
    }

    // 2. 權限檢查
    if (delivery.task.apiKeyId !== apiKeyId) {
      throw new WebhookServiceError(
        WEBHOOK_ERROR_CODES.DELIVERY_NOT_FOUND,
        'Webhook delivery not found',
        404
      );
    }

    // 3. 狀態檢查
    if (delivery.status === 'DELIVERED') {
      throw new WebhookServiceError(
        WEBHOOK_ERROR_CODES.ALREADY_DELIVERED,
        'Webhook has already been delivered successfully',
        409
      );
    }

    if (delivery.status === 'SENDING') {
      throw new WebhookServiceError(
        WEBHOOK_ERROR_CODES.DELIVERY_IN_PROGRESS,
        'Webhook delivery is currently in progress',
        409
      );
    }

    // 4. 排程立即重試
    const scheduledAt = new Date();
    await prisma.externalWebhookDelivery.update({
      where: { id: deliveryId },
      data: {
        status: 'RETRYING',
        nextRetryAt: scheduledAt,
        // 重置嘗試次數限制，允許額外重試
        maxAttempts: Math.max(delivery.maxAttempts, delivery.attempts + 1),
      },
    });

    // 5. 異步執行重試
    this.deliverWebhook(deliveryId).catch((error) => {
      console.error(`Manual retry failed for ${deliveryId}:`, error);
    });

    return {
      success: true,
      deliveryId,
      status: 'RETRYING',
      message: 'Webhook retry has been scheduled',
      scheduledAt: scheduledAt.toISOString(),
    };
  }

  /**
   * 取得發送歷史
   * @param apiKeyId - API Key ID
   * @param params - 查詢參數
   * @returns 發送歷史回應
   */
  async getDeliveryHistory(
    apiKeyId: string,
    params: WebhookHistoryQueryParams
  ): Promise<WebhookDeliveryHistoryResponse> {
    const {
      page = 1,
      limit = DEFAULT_HISTORY_PAGE_SIZE,
      event,
      status,
      from,
      to,
      taskId,
    } = params;

    const take = Math.min(limit, MAX_HISTORY_PAGE_SIZE);
    const skip = (page - 1) * take;

    // 建立查詢條件
    const where: Prisma.ExternalWebhookDeliveryWhereInput = {
      task: {
        apiKeyId,
      },
    };

    if (event) {
      where.event = event as WebhookEventType;
    }

    if (status) {
      where.status = status as ExternalWebhookDeliveryStatus;
    }

    if (taskId) {
      where.taskId = taskId;
    }

    if (from || to) {
      where.createdAt = {};
      if (from) {
        where.createdAt.gte = new Date(from);
      }
      if (to) {
        where.createdAt.lte = new Date(to);
      }
    }

    // 查詢資料和總數
    const [deliveries, total] = await Promise.all([
      prisma.externalWebhookDelivery.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      prisma.externalWebhookDelivery.count({ where }),
    ]);

    return {
      deliveries: deliveries.map((d) => this.mapDeliveryToRecord(d)),
      pagination: {
        page,
        limit: take,
        total,
        totalPages: Math.ceil(total / take),
      },
    };
  }

  /**
   * 取得發送統計
   * @param apiKeyId - API Key ID
   * @param params - 查詢參數
   * @returns 發送統計
   */
  async getDeliveryStats(
    apiKeyId: string,
    params: WebhookStatsQueryParams
  ): Promise<WebhookDeliveryStats> {
    const now = new Date();
    const defaultFrom = new Date(
      now.getTime() - DEFAULT_STATS_RANGE_DAYS * 24 * 60 * 60 * 1000
    );

    const from = params.from ? new Date(params.from) : defaultFrom;
    const to = params.to ? new Date(params.to) : now;

    // 查詢條件
    const where: Prisma.ExternalWebhookDeliveryWhereInput = {
      task: {
        apiKeyId,
      },
      createdAt: {
        gte: from,
        lte: to,
      },
    };

    // 取得各狀態統計
    const statusCounts = await prisma.externalWebhookDelivery.groupBy({
      by: ['status'],
      where,
      _count: {
        id: true,
      },
    });

    // 取得各事件類型統計
    const eventCounts = await prisma.externalWebhookDelivery.groupBy({
      by: ['event', 'status'],
      where,
      _count: {
        id: true,
      },
    });

    // 彙整統計
    const statusMap: Record<string, number> = {};
    statusCounts.forEach((item) => {
      statusMap[item.status] = item._count.id;
    });

    const total = Object.values(statusMap).reduce((a, b) => a + b, 0);
    const delivered = statusMap['DELIVERED'] || 0;
    const failed = statusMap['FAILED'] || 0;
    const pending = statusMap['PENDING'] || 0;
    const retrying = statusMap['RETRYING'] || 0;
    const sending = statusMap['SENDING'] || 0;

    // 按事件類型彙整
    const byEventType: WebhookDeliveryStats['byEventType'] = {
      INVOICE_PROCESSING: { total: 0, delivered: 0, failed: 0 },
      INVOICE_COMPLETED: { total: 0, delivered: 0, failed: 0 },
      INVOICE_FAILED: { total: 0, delivered: 0, failed: 0 },
      INVOICE_REVIEW_REQUIRED: { total: 0, delivered: 0, failed: 0 },
    };

    eventCounts.forEach((item) => {
      const eventKey = EVENT_TYPE_MAP[item.event];
      if (eventKey && byEventType[eventKey]) {
        byEventType[eventKey].total += item._count.id;
        if (item.status === 'DELIVERED') {
          byEventType[eventKey].delivered += item._count.id;
        } else if (item.status === 'FAILED') {
          byEventType[eventKey].failed += item._count.id;
        }
      }
    });

    return {
      total,
      delivered,
      failed,
      pending: pending + sending,
      retrying,
      successRate: total > 0 ? (delivered / total) * 100 : 0,
      avgResponseTimeMs: 0, // 需要更複雜的計算，暫時設為 0
      byEventType,
      period: {
        from: from.toISOString(),
        to: to.toISOString(),
      },
    };
  }

  /**
   * 映射發送記錄到 API 格式
   */
  private mapDeliveryToRecord(
    delivery: ExternalWebhookDelivery
  ): WebhookDeliveryRecord {
    return {
      id: delivery.id,
      taskId: delivery.taskId,
      event: EVENT_TYPE_MAP[delivery.event],
      targetUrl: delivery.targetUrl,
      status: STATUS_MAP[delivery.status],
      httpStatus: delivery.httpStatus,
      errorMessage: delivery.errorMessage,
      attempts: delivery.attempts,
      maxAttempts: delivery.maxAttempts,
      nextRetryAt: delivery.nextRetryAt?.toISOString() || null,
      lastAttemptAt: delivery.lastAttemptAt?.toISOString() || null,
      createdAt: delivery.createdAt.toISOString(),
      completedAt: delivery.completedAt?.toISOString() || null,
    };
  }
}

// ============================================================
// 導出單例
// ============================================================

/**
 * Webhook 服務單例
 */
export const webhookService = new WebhookService();
