/**
 * @fileoverview Webhook 手動重試 API 端點
 * @description
 *   RESTful API 端點用於手動重試失敗的 Webhook，支援：
 *   - POST: 觸發手動重試
 *
 *   認證方式：Bearer Token (API Key)
 *
 * @module src/app/api/v1/webhooks/[deliveryId]/retry/route
 * @author Development Team
 * @since Epic 11 - Story 11.4 (Webhook 通知服務)
 * @lastModified 2025-12-21
 *
 * @features
 *   - 手動觸發 Webhook 重試
 *   - 權限驗證（只能重試自己的 Webhook）
 *   - 狀態檢查（不能重試已成功或進行中的）
 *
 * @dependencies
 *   - next/server - Next.js API 支援
 *   - @/services/webhook.service - Webhook 服務
 *   - @/middleware/external-api-auth - 認證中間件
 *
 * @related
 *   - docs/04-implementation/tech-specs/epic-11-external-api/tech-spec-story-11-4.md
 *   - src/app/api/v1/webhooks/route.ts - 歷史查詢 API
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  webhookService,
  WebhookServiceError,
} from '@/services/webhook.service';
import {
  externalApiAuthMiddleware,
  generateTraceId,
} from '@/middleware/external-api-auth';
import { createExternalApiError } from '@/types/external-api/response';
import { WEBHOOK_ERROR_HTTP_STATUS } from '@/types/external-api/webhook';

// ============================================================
// 類型定義
// ============================================================

interface RouteParams {
  params: Promise<{
    deliveryId: string;
  }>;
}

// ============================================================
// API 路由處理器
// ============================================================

/**
 * POST /api/v1/webhooks/[deliveryId]/retry
 * @description 手動重試 Webhook 發送
 *
 * @param request Next.js 請求對象
 * @param context 路由參數
 * @returns 重試結果
 *
 * @example
 * ```bash
 * # 手動重試 Webhook
 * curl -X POST "https://api.example.com/api/v1/webhooks/abc123/retry" \
 *   -H "Authorization: Bearer YOUR_API_KEY"
 * ```
 */
export async function POST(request: NextRequest, context: RouteParams) {
  const traceId = generateTraceId();

  try {
    // 1. 認證驗證
    const authResult = await externalApiAuthMiddleware(request, ['query']);

    if (!authResult.authorized || !authResult.apiKey) {
      return NextResponse.json(
        createExternalApiError({
          type: authResult.errorCode || 'UNAUTHORIZED',
          title: 'Authentication Error',
          status: authResult.statusCode,
          detail: authResult.errorMessage || 'Authentication failed',
          instance: '/api/v1/webhooks/retry',
          traceId,
        }),
        { status: authResult.statusCode }
      );
    }

    // 2. 獲取路由參數
    const { deliveryId } = await context.params;

    if (!deliveryId) {
      return NextResponse.json(
        createExternalApiError({
          type: 'VALIDATION_ERROR',
          title: 'Validation Error',
          status: 400,
          detail: 'Delivery ID is required',
          instance: '/api/v1/webhooks/retry',
          traceId,
        }),
        { status: 400 }
      );
    }

    // 3. 執行重試
    const result = await webhookService.retryWebhook(
      deliveryId,
      authResult.apiKey.id
    );

    // 4. 返回成功回應
    return NextResponse.json(
      {
        success: true,
        data: result,
        traceId,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[Webhook Retry API] Error:', error);

    // 處理已知錯誤
    if (error instanceof WebhookServiceError) {
      const statusCode =
        WEBHOOK_ERROR_HTTP_STATUS[
          error.code as keyof typeof WEBHOOK_ERROR_HTTP_STATUS
        ] || 500;

      return NextResponse.json(
        createExternalApiError({
          type: error.code,
          title: 'Webhook Error',
          status: statusCode,
          detail: error.message,
          instance: '/api/v1/webhooks/retry',
          traceId,
        }),
        { status: statusCode }
      );
    }

    // 處理未知錯誤
    return NextResponse.json(
      createExternalApiError({
        type: 'INTERNAL_ERROR',
        title: 'Internal Server Error',
        status: 500,
        detail: 'An unexpected error occurred',
        instance: '/api/v1/webhooks/retry',
        traceId,
      }),
      { status: 500 }
    );
  }
}
