/**
 * @fileoverview Webhook 發送歷史查詢 API 端點
 * @description
 *   RESTful API 端點用於查詢 Webhook 發送歷史，支援：
 *   - GET: 查詢發送記錄列表（分頁、篩選）
 *
 *   認證方式：Bearer Token (API Key)
 *
 * @module src/app/api/v1/webhooks/route
 * @author Development Team
 * @since Epic 11 - Story 11.4 (Webhook 通知服務)
 * @lastModified 2025-12-21
 *
 * @features
 *   - 分頁查詢發送歷史
 *   - 依事件類型、狀態、日期範圍篩選
 *   - API Key 認證
 *
 * @dependencies
 *   - next/server - Next.js API 支援
 *   - @/services/webhook.service - Webhook 服務
 *   - @/middlewares/external-api-auth - 認證中間件
 *
 * @related
 *   - docs/04-implementation/tech-specs/epic-11-external-api/tech-spec-story-11-4.md
 *   - src/app/api/v1/webhooks/[deliveryId]/retry/route.ts - 手動重試 API
 *   - src/app/api/v1/webhooks/stats/route.ts - 統計 API
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { webhookService } from '@/services/webhook.service';
import {
  externalApiAuthMiddleware,
  generateTraceId,
} from '@/middlewares/external-api-auth';
import { createExternalApiError } from '@/types/external-api/response';
import {
  WebhookHistoryQueryParams,
  DEFAULT_HISTORY_PAGE_SIZE,
  MAX_HISTORY_PAGE_SIZE,
  isValidWebhookEventType,
  isValidWebhookDeliveryStatus,
} from '@/types/external-api/webhook';

// ============================================================
// 查詢參數驗證 Schema
// ============================================================

const historyQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce
    .number()
    .int()
    .positive()
    .max(MAX_HISTORY_PAGE_SIZE)
    .default(DEFAULT_HISTORY_PAGE_SIZE),
  event: z.string().optional(),
  status: z.string().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  taskId: z.string().optional(),
});

// ============================================================
// API 路由處理器
// ============================================================

/**
 * GET /api/v1/webhooks
 * @description 查詢 Webhook 發送歷史
 *
 * @param request Next.js 請求對象
 * @returns 發送歷史列表（含分頁資訊）
 *
 * @example
 * ```bash
 * # 查詢所有發送記錄（分頁）
 * curl -X GET "https://api.example.com/api/v1/webhooks?page=1&limit=20" \
 *   -H "Authorization: Bearer YOUR_API_KEY"
 *
 * # 篩選特定事件類型
 * curl -X GET "https://api.example.com/api/v1/webhooks?event=INVOICE_COMPLETED" \
 *   -H "Authorization: Bearer YOUR_API_KEY"
 *
 * # 篩選特定狀態
 * curl -X GET "https://api.example.com/api/v1/webhooks?status=FAILED" \
 *   -H "Authorization: Bearer YOUR_API_KEY"
 * ```
 */
export async function GET(request: NextRequest) {
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
          instance: '/api/v1/webhooks',
          traceId,
        }),
        { status: authResult.statusCode }
      );
    }

    // 2. 解析查詢參數
    const url = new URL(request.url);
    const rawParams: Record<string, string> = {};
    url.searchParams.forEach((value, key) => {
      rawParams[key] = value;
    });

    const parseResult = historyQuerySchema.safeParse(rawParams);

    if (!parseResult.success) {
      const errorMap: Record<string, string[]> = {};
      parseResult.error.issues.forEach((issue) => {
        const field = issue.path.join('.');
        if (!errorMap[field]) {
          errorMap[field] = [];
        }
        errorMap[field].push(issue.message);
      });

      return NextResponse.json(
        createExternalApiError({
          type: 'VALIDATION_ERROR',
          title: 'Validation Error',
          status: 400,
          detail: 'Invalid query parameters',
          instance: '/api/v1/webhooks',
          traceId,
          errors: errorMap,
        }),
        { status: 400 }
      );
    }

    const params = parseResult.data;

    // 3. 驗證事件類型（如果有提供）
    if (params.event && !isValidWebhookEventType(params.event)) {
      return NextResponse.json(
        createExternalApiError({
          type: 'VALIDATION_ERROR',
          title: 'Validation Error',
          status: 400,
          detail: `Invalid event type: ${params.event}. Valid values: INVOICE_PROCESSING, INVOICE_COMPLETED, INVOICE_FAILED, INVOICE_REVIEW_REQUIRED`,
          instance: '/api/v1/webhooks',
          traceId,
        }),
        { status: 400 }
      );
    }

    // 4. 驗證狀態（如果有提供）
    if (params.status && !isValidWebhookDeliveryStatus(params.status)) {
      return NextResponse.json(
        createExternalApiError({
          type: 'VALIDATION_ERROR',
          title: 'Validation Error',
          status: 400,
          detail: `Invalid status: ${params.status}. Valid values: PENDING, SENDING, DELIVERED, FAILED, RETRYING`,
          instance: '/api/v1/webhooks',
          traceId,
        }),
        { status: 400 }
      );
    }

    // 5. 查詢歷史
    const queryParams: WebhookHistoryQueryParams = {
      page: params.page,
      limit: params.limit,
      event: params.event as WebhookHistoryQueryParams['event'],
      status: params.status as WebhookHistoryQueryParams['status'],
      from: params.from,
      to: params.to,
      taskId: params.taskId,
    };

    const result = await webhookService.getDeliveryHistory(
      authResult.apiKey.id,
      queryParams
    );

    // 6. 返回成功回應
    return NextResponse.json(
      {
        success: true,
        data: result.deliveries,
        meta: {
          pagination: result.pagination,
        },
        traceId,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[Webhooks API] Error:', error);

    return NextResponse.json(
      createExternalApiError({
        type: 'INTERNAL_ERROR',
        title: 'Internal Server Error',
        status: 500,
        detail: 'An unexpected error occurred',
        instance: '/api/v1/webhooks',
        traceId,
      }),
      { status: 500 }
    );
  }
}
