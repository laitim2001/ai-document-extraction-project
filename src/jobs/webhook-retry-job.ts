/**
 * @fileoverview Webhook 重試定時任務
 * @description
 *   定義 Webhook 重試的定時任務配置：
 *   - 處理等待重試的 Webhook 發送記錄
 *   - 提供手動觸發函數供 API 調用
 *   - 記錄執行日誌
 *   - 可整合 Vercel Cron 或 n8n 外部排程
 *
 * @module src/jobs/webhook-retry-job
 * @since Epic 11 - Story 11.4 (Webhook 通知服務)
 * @lastModified 2025-12-21
 *
 * @features
 *   - 每分鐘檢查待重試的 Webhook
 *   - 批次處理提升效能
 *   - 手動觸發 API
 *   - 執行結果統計
 *
 * @dependencies
 *   - @/services/webhook.service - Webhook 服務
 *
 * @note
 *   此任務可透過以下方式觸發：
 *   1. Vercel Cron: 在 vercel.json 配置
 *   2. n8n: 設定 HTTP webhook 調用 API
 *   3. 手動: POST /api/jobs/webhook-retry
 */

import { webhookService } from '@/services/webhook.service';

// ============================================================
// Types
// ============================================================

/**
 * 任務執行結果
 */
export interface WebhookRetryJobResult {
  /** 是否成功 */
  success: boolean;
  /** 處理的記錄數 */
  processed: number;
  /** 錯誤訊息 */
  error?: string;
  /** 執行時間戳 */
  timestamp: string;
  /** 執行時間（毫秒） */
  executionTimeMs: number;
}

// ============================================================
// Job Configuration
// ============================================================

/**
 * 預設批次大小
 */
const DEFAULT_BATCH_SIZE = 50;

/**
 * Cron 配置
 */
export const WEBHOOK_RETRY_CRON_CONFIG = {
  /** Cron 表達式：每分鐘執行 */
  schedule: '* * * * *',
  /** 時區 */
  timezone: 'Asia/Taipei',
  /** 描述 */
  description: 'Process webhook retry queue every minute',
};

// ============================================================
// Job Functions
// ============================================================

/**
 * 處理 Webhook 重試隊列
 *
 * @description
 *   處理所有等待重試的 Webhook 發送記錄
 *   由排程器或 API 調用觸發
 *
 * @param batchSize - 每次處理的批次大小（預設 50）
 * @returns 執行結果
 *
 * @example
 * ```typescript
 * const result = await processWebhookRetryQueue();
 * console.log(`Processed ${result.processed} webhook retries`);
 * ```
 */
export async function processWebhookRetryQueue(
  batchSize: number = DEFAULT_BATCH_SIZE
): Promise<WebhookRetryJobResult> {
  const startTime = Date.now();
  const timestamp = new Date().toISOString();

  console.log('[WebhookRetryJob] Starting webhook retry processing...', {
    timestamp,
    batchSize,
  });

  try {
    // 處理重試隊列
    const processed = await webhookService.processRetryQueue(batchSize);

    const executionTimeMs = Date.now() - startTime;

    console.log('[WebhookRetryJob] Job completed successfully', {
      processed,
      executionTimeMs,
      timestamp,
    });

    return {
      success: true,
      processed,
      timestamp,
      executionTimeMs,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const executionTimeMs = Date.now() - startTime;

    console.error('[WebhookRetryJob] Job failed', {
      error: errorMessage,
      executionTimeMs,
      timestamp,
    });

    return {
      success: false,
      processed: 0,
      error: errorMessage,
      timestamp,
      executionTimeMs,
    };
  }
}

/**
 * 獲取待重試的 Webhook 數量
 *
 * @description
 *   查詢目前等待重試的 Webhook 發送記錄數量
 *
 * @returns 待重試數量
 */
export async function getPendingRetryCount(): Promise<number> {
  const { prisma } = await import('@/lib/prisma');

  return prisma.externalWebhookDelivery.count({
    where: {
      status: 'RETRYING',
      nextRetryAt: {
        lte: new Date(),
      },
    },
  });
}

/**
 * 獲取重試任務狀態
 *
 * @description
 *   查詢 Webhook 重試隊列的當前狀態
 *
 * @returns 狀態資訊
 */
export async function getWebhookRetryStatus(): Promise<{
  pendingCount: number;
  retryingCount: number;
  failedTodayCount: number;
  deliveredTodayCount: number;
}> {
  const { prisma } = await import('@/lib/prisma');

  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const [pendingCount, retryingCount, failedTodayCount, deliveredTodayCount] =
    await Promise.all([
      // 待重試（時間已到）
      prisma.externalWebhookDelivery.count({
        where: {
          status: 'RETRYING',
          nextRetryAt: { lte: now },
        },
      }),
      // 等待重試（時間未到）
      prisma.externalWebhookDelivery.count({
        where: {
          status: 'RETRYING',
          nextRetryAt: { gt: now },
        },
      }),
      // 今日失敗
      prisma.externalWebhookDelivery.count({
        where: {
          status: 'FAILED',
          completedAt: { gte: startOfDay },
        },
      }),
      // 今日成功
      prisma.externalWebhookDelivery.count({
        where: {
          status: 'DELIVERED',
          completedAt: { gte: startOfDay },
        },
      }),
    ]);

  return {
    pendingCount,
    retryingCount,
    failedTodayCount,
    deliveredTodayCount,
  };
}
