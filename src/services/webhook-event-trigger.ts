/**
 * @fileoverview Webhook 事件觸發器
 * @description
 *   提供統一的 Webhook 事件觸發介面，用於在發票處理流程中
 *   觸發相應的 Webhook 通知。整合於發票處理服務中使用。
 *
 * @module src/services/webhook-event-trigger
 * @author Development Team
 * @since Epic 11 - Story 11.4 (Webhook 通知服務)
 * @lastModified 2025-12-21
 *
 * @features
 *   - 發票開始處理事件
 *   - 發票處理完成事件
 *   - 發票處理失敗事件
 *   - 發票需要審核事件
 *
 * @dependencies
 *   - @/services/webhook.service - Webhook 服務
 *   - @prisma/client - 資料庫操作
 *
 * @related
 *   - src/services/invoice-submission.service.ts - 發票提交服務
 *   - src/services/task-status.service.ts - 任務狀態服務
 */

import { webhookService } from './webhook.service';
import { prisma } from '@/lib/prisma';
import type {
  WebhookSendResult,
  InvoiceProcessingPayload,
  InvoiceCompletedPayload,
  InvoiceFailedPayload,
  InvoiceReviewRequiredPayload,
} from '@/types/external-api/webhook';

// ============================================================
// 觸發介面類型
// ============================================================

/**
 * 處理開始事件參數
 */
export interface ProcessingEventParams {
  /** 任務 ID */
  taskId: string;
  /** 原始檔案名稱 */
  fileName: string;
  /** MIME 類型 */
  mimeType: string;
  /** 檔案大小 */
  fileSize: number;
  /** 提交時間 */
  submittedAt: Date;
}

/**
 * 處理完成事件參數
 */
export interface CompletedEventParams {
  /** 任務 ID */
  taskId: string;
  /** 信心度分數 */
  confidenceScore: number;
  /** 提取欄位數 */
  fieldCount: number;
  /** 處理時間（毫秒） */
  processingTimeMs: number;
  /** 完成時間 */
  completedAt: Date;
}

/**
 * 處理失敗事件參數
 */
export interface FailedEventParams {
  /** 任務 ID */
  taskId: string;
  /** 錯誤代碼 */
  errorCode: string;
  /** 錯誤訊息 */
  errorMessage: string;
  /** 失敗階段 */
  failedStep: string;
  /** 失敗時間 */
  failedAt: Date;
  /** 是否可重試 */
  retryable: boolean;
}

/**
 * 需要審核事件參數
 */
export interface ReviewRequiredEventParams {
  /** 任務 ID */
  taskId: string;
  /** 信心度分數 */
  confidenceScore: number;
  /** 審核原因 */
  reviewReason: string;
  /** 低信心度欄位數 */
  lowConfidenceFields: number;
}

// ============================================================
// 事件觸發器類別
// ============================================================

/**
 * Webhook 事件觸發器
 * @description 提供便捷的方法觸發各類 Webhook 事件
 */
export class WebhookEventTrigger {
  /**
   * 取得任務的 API Key ID
   * @param taskId - 任務 ID
   * @returns API Key ID
   */
  private async getApiKeyId(taskId: string): Promise<string | null> {
    const task = await prisma.externalApiTask.findUnique({
      where: { id: taskId },
      select: { apiKeyId: true },
    });
    return task?.apiKeyId || null;
  }

  /**
   * 取得結果 URL
   * @param taskId - 任務 ID
   * @returns 結果 API URL
   */
  private getResultUrl(taskId: string): string {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    return `${baseUrl}/api/v1/invoices/${taskId}/result`;
  }

  /**
   * 取得審核 URL
   * @param taskId - 任務 ID
   * @returns 審核頁面 URL
   */
  private getReviewUrl(taskId: string): string {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    return `${baseUrl}/review/tasks/${taskId}`;
  }

  /**
   * 觸發處理開始事件
   * @param params - 事件參數
   * @returns 發送結果
   */
  async triggerProcessingEvent(
    params: ProcessingEventParams
  ): Promise<WebhookSendResult | null> {
    const { taskId, fileName, mimeType, fileSize, submittedAt } = params;

    const apiKeyId = await this.getApiKeyId(taskId);
    if (!apiKeyId) {
      console.warn(`[WebhookTrigger] No API key found for task ${taskId}`);
      return null;
    }

    const data: InvoiceProcessingPayload['data'] = {
      fileName,
      mimeType,
      fileSize,
      submittedAt: submittedAt.toISOString(),
    };

    return webhookService.sendWebhook({
      taskId,
      event: 'INVOICE_PROCESSING',
      data,
      apiKeyId,
    });
  }

  /**
   * 觸發處理完成事件
   * @param params - 事件參數
   * @returns 發送結果
   */
  async triggerCompletedEvent(
    params: CompletedEventParams
  ): Promise<WebhookSendResult | null> {
    const { taskId, confidenceScore, fieldCount, processingTimeMs, completedAt } =
      params;

    const apiKeyId = await this.getApiKeyId(taskId);
    if (!apiKeyId) {
      console.warn(`[WebhookTrigger] No API key found for task ${taskId}`);
      return null;
    }

    const data: InvoiceCompletedPayload['data'] = {
      confidenceScore,
      fieldCount,
      processingTimeMs,
      completedAt: completedAt.toISOString(),
      resultUrl: this.getResultUrl(taskId),
    };

    return webhookService.sendWebhook({
      taskId,
      event: 'INVOICE_COMPLETED',
      data,
      apiKeyId,
    });
  }

  /**
   * 觸發處理失敗事件
   * @param params - 事件參數
   * @returns 發送結果
   */
  async triggerFailedEvent(
    params: FailedEventParams
  ): Promise<WebhookSendResult | null> {
    const { taskId, errorCode, errorMessage, failedStep, failedAt, retryable } =
      params;

    const apiKeyId = await this.getApiKeyId(taskId);
    if (!apiKeyId) {
      console.warn(`[WebhookTrigger] No API key found for task ${taskId}`);
      return null;
    }

    const data: InvoiceFailedPayload['data'] = {
      errorCode,
      errorMessage,
      failedStep,
      failedAt: failedAt.toISOString(),
      retryable,
    };

    return webhookService.sendWebhook({
      taskId,
      event: 'INVOICE_FAILED',
      data,
      apiKeyId,
    });
  }

  /**
   * 觸發需要審核事件
   * @param params - 事件參數
   * @returns 發送結果
   */
  async triggerReviewRequiredEvent(
    params: ReviewRequiredEventParams
  ): Promise<WebhookSendResult | null> {
    const { taskId, confidenceScore, reviewReason, lowConfidenceFields } = params;

    const apiKeyId = await this.getApiKeyId(taskId);
    if (!apiKeyId) {
      console.warn(`[WebhookTrigger] No API key found for task ${taskId}`);
      return null;
    }

    const data: InvoiceReviewRequiredPayload['data'] = {
      confidenceScore,
      reviewReason,
      lowConfidenceFields,
      reviewUrl: this.getReviewUrl(taskId),
    };

    return webhookService.sendWebhook({
      taskId,
      event: 'INVOICE_REVIEW_REQUIRED',
      data,
      apiKeyId,
    });
  }
}

// ============================================================
// 導出單例
// ============================================================

/**
 * Webhook 事件觸發器單例
 */
export const webhookEventTrigger = new WebhookEventTrigger();

// ============================================================
// 便捷函數導出
// ============================================================

/**
 * 觸發處理開始事件（便捷函數）
 */
export const triggerProcessingEvent =
  webhookEventTrigger.triggerProcessingEvent.bind(webhookEventTrigger);

/**
 * 觸發處理完成事件（便捷函數）
 */
export const triggerCompletedEvent =
  webhookEventTrigger.triggerCompletedEvent.bind(webhookEventTrigger);

/**
 * 觸發處理失敗事件（便捷函數）
 */
export const triggerFailedEvent =
  webhookEventTrigger.triggerFailedEvent.bind(webhookEventTrigger);

/**
 * 觸發需要審核事件（便捷函數）
 */
export const triggerReviewRequiredEvent =
  webhookEventTrigger.triggerReviewRequiredEvent.bind(webhookEventTrigger);
