/**
 * @fileoverview 批量任務狀態查詢 API 端點
 * @description
 *   提供批量任務狀態查詢功能，支援：
 *   - 一次查詢多個任務狀態（最多 100 個）
 *   - 返回找到的任務和未找到的任務 ID
 *   - 效能優化的批量查詢
 *
 * @module src/app/api/v1/invoices/batch-status/route
 * @author Development Team
 * @since Epic 11 - Story 11.2 (API 處理狀態查詢端點)
 * @lastModified 2025-12-21
 *
 * @features
 *   - POST /api/v1/invoices/batch-status - 批量查詢任務狀態
 *   - 支援最多 100 個任務 ID
 *   - 返回找到和未找到的任務清單
 *   - API Key 權限驗證
 *
 * @dependencies
 *   - next/server - Next.js 伺服器端功能
 *   - @/services/task-status.service - 任務狀態服務
 *   - @/services/rate-limit.service - 速率限制服務
 *   - @/middlewares/external-api-auth - 外部 API 認證中間件
 *   - @/types/external-api - 外部 API 類型定義
 *
 * @related
 *   - src/app/api/v1/invoices/[taskId]/status/route.ts - 單一狀態查詢
 *   - src/app/api/v1/invoices/route.ts - 發票提交與列表 API
 */

import { NextRequest, NextResponse } from 'next/server';
import { taskStatusService } from '@/services/task-status.service';
import { rateLimitService } from '@/services/rate-limit.service';
import {
  externalApiAuthMiddleware,
  generateTraceId,
  getClientInfo,
} from '@/middlewares/external-api-auth';
import { batchStatusSchema } from '@/types/external-api';
import { createExternalApiError } from '@/types/external-api/response';

// ============================================================
// POST /api/v1/invoices/batch-status
// ============================================================

/**
 * 批量查詢任務狀態
 *
 * @description
 *   一次查詢多個任務的處理狀態，適用於：
 *   - 批量提交後追蹤多個任務進度
 *   - 定期同步大量任務狀態
 *   - 減少 API 呼叫次數
 *
 * @param request - Next.js 請求物件
 * @returns 批量狀態回應（含找到和未找到的任務）
 *
 * @example
 * POST /api/v1/invoices/batch-status
 * Authorization: Bearer sk_live_xxx
 * Content-Type: application/json
 *
 * {
 *   "taskIds": ["task_abc123", "task_def456", "task_ghi789"]
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "results": [
 *       { "taskId": "task_abc123", "status": "completed", ... },
 *       { "taskId": "task_def456", "status": "processing", ... }
 *     ],
 *     "notFound": ["task_ghi789"]
 *   }
 * }
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const traceId = generateTraceId();
  const clientInfo = getClientInfo(request);

  try {
    // 1. API Key 認證
    const authResult = await externalApiAuthMiddleware(request, ['query']);

    if (!authResult.authorized) {
      return NextResponse.json(
        createExternalApiError({
          type: 'authentication_error',
          title: authResult.errorCode || 'Authentication Failed',
          status: authResult.statusCode,
          detail: authResult.errorMessage || 'Invalid or missing API key',
          instance: request.url,
          traceId,
        }),
        { status: authResult.statusCode }
      );
    }

    const apiKey = authResult.apiKey!;

    // 2. 檢查速率限制
    const rateLimitResult = await rateLimitService.checkLimit(apiKey);

    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        createExternalApiError({
          type: 'rate_limit_exceeded',
          title: 'Rate Limit Exceeded',
          status: 429,
          detail: `Rate limit exceeded. Limit: ${rateLimitResult.limit}, remaining: ${rateLimitResult.remaining}`,
          instance: request.url,
          traceId,
        }),
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': String(rateLimitResult.limit),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': String(rateLimitResult.reset),
            'Retry-After': String(rateLimitResult.retryAfter || 60),
          },
        }
      );
    }

    // 3. 解析請求體
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        createExternalApiError({
          type: 'validation_error',
          title: 'Invalid Request Body',
          status: 400,
          detail: 'Request body must be valid JSON',
          instance: request.url,
          traceId,
        }),
        { status: 400 }
      );
    }

    // 4. 驗證請求體
    const validationResult = batchStatusSchema.safeParse(body);

    if (!validationResult.success) {
      const fieldErrors: Record<string, string[]> = {};
      validationResult.error.issues.forEach(issue => {
        const path = issue.path.join('.');
        if (!fieldErrors[path]) {
          fieldErrors[path] = [];
        }
        fieldErrors[path].push(issue.message);
      });

      return NextResponse.json(
        createExternalApiError({
          type: 'validation_error',
          title: 'Validation Error',
          status: 400,
          detail: 'Request body validation failed',
          instance: request.url,
          traceId,
          errors: fieldErrors,
        }),
        { status: 400 }
      );
    }

    const { taskIds } = validationResult.data;

    // 5. 查詢批量任務狀態
    const batchResult = await taskStatusService.getTaskStatuses(taskIds, apiKey);

    // 6. 返回成功回應
    return NextResponse.json(
      {
        success: true,
        data: batchResult,
      },
      {
        headers: {
          'X-Trace-ID': traceId,
          'X-RateLimit-Limit': String(rateLimitResult.limit),
          'X-RateLimit-Remaining': String(rateLimitResult.remaining),
          'X-RateLimit-Reset': String(rateLimitResult.reset),
        },
      }
    );
  } catch (error) {
    console.error('[Batch Status API] Error:', {
      traceId,
      clientInfo,
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return NextResponse.json(
      createExternalApiError({
        type: 'internal_error',
        title: 'Internal Server Error',
        status: 500,
        detail: 'An unexpected error occurred while querying batch status',
        instance: request.url,
        traceId,
      }),
      { status: 500 }
    );
  }
}
