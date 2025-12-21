/**
 * @fileoverview Webhook 統計 API 端點
 * @description
 *   RESTful API 端點用於查詢 Webhook 發送統計，支援：
 *   - GET: 查詢發送統計（成功率、按事件類型等）
 *
 *   認證方式：Bearer Token (API Key)
 *
 * @module src/app/api/v1/webhooks/stats/route
 * @author Development Team
 * @since Epic 11 - Story 11.4 (Webhook 通知服務)
 * @lastModified 2025-12-21
 *
 * @features
 *   - 發送成功率統計
 *   - 按事件類型分組統計
 *   - 自訂時間範圍查詢
 *
 * @dependencies
 *   - next/server - Next.js API 支援
 *   - @/services/webhook.service - Webhook 服務
 *   - @/middlewares/external-api-auth - 認證中間件
 *
 * @related
 *   - docs/04-implementation/tech-specs/epic-11-external-api/tech-spec-story-11-4.md
 *   - src/app/api/v1/webhooks/route.ts - 歷史查詢 API
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { webhookService } from '@/services/webhook.service';
import {
  externalApiAuthMiddleware,
  generateTraceId,
} from '@/middlewares/external-api-auth';
import { createExternalApiError } from '@/types/external-api/response';
import { WebhookStatsQueryParams } from '@/types/external-api/webhook';

// ============================================================
// 查詢參數驗證 Schema
// ============================================================

const statsQuerySchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

// ============================================================
// API 路由處理器
// ============================================================

/**
 * GET /api/v1/webhooks/stats
 * @description 查詢 Webhook 發送統計
 *
 * @param request Next.js 請求對象
 * @returns 發送統計資料
 *
 * @example
 * ```bash
 * # 查詢預設時間範圍統計（過去 7 天）
 * curl -X GET "https://api.example.com/api/v1/webhooks/stats" \
 *   -H "Authorization: Bearer YOUR_API_KEY"
 *
 * # 查詢指定時間範圍統計
 * curl -X GET "https://api.example.com/api/v1/webhooks/stats?from=2025-12-01T00:00:00Z&to=2025-12-21T23:59:59Z" \
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
          instance: '/api/v1/webhooks/stats',
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

    const parseResult = statsQuerySchema.safeParse(rawParams);

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
          instance: '/api/v1/webhooks/stats',
          traceId,
          errors: errorMap,
        }),
        { status: 400 }
      );
    }

    const params = parseResult.data;

    // 3. 查詢統計
    const queryParams: WebhookStatsQueryParams = {
      from: params.from,
      to: params.to,
    };

    const stats = await webhookService.getDeliveryStats(
      authResult.apiKey.id,
      queryParams
    );

    // 4. 返回成功回應
    return NextResponse.json(
      {
        success: true,
        data: stats,
        traceId,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[Webhook Stats API] Error:', error);

    return NextResponse.json(
      createExternalApiError({
        type: 'INTERNAL_ERROR',
        title: 'Internal Server Error',
        status: 500,
        detail: 'An unexpected error occurred',
        instance: '/api/v1/webhooks/stats',
        traceId,
      }),
      { status: 500 }
    );
  }
}
