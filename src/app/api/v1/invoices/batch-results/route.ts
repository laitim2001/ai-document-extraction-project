/**
 * @fileoverview 批量結果查詢 API 端點
 * @description
 *   提供批量任務結果查詢功能，支援：
 *   - 一次查詢最多 50 個任務的結果
 *   - 返回每個任務的結果或錯誤資訊
 *   - 標示未找到的任務 ID
 *
 * @module src/app/api/v1/invoices/batch-results/route
 * @author Development Team
 * @since Epic 11 - Story 11.3 (API 處理結果擷取端點)
 * @lastModified 2025-12-21
 *
 * @features
 *   - POST /api/v1/invoices/batch-results - 批量查詢結果
 *   - 最多 50 個任務 ID
 *   - 返回成功/失敗狀態和詳細結果
 *   - API Key 權限驗證
 *
 * @dependencies
 *   - next/server - Next.js 伺服器端功能
 *   - @/services/result-retrieval.service - 結果擷取服務
 *   - @/services/rate-limit.service - 速率限制服務
 *   - @/middlewares/external-api-auth - 外部 API 認證中間件
 *   - zod - 請求驗證
 *
 * @related
 *   - src/app/api/v1/invoices/batch-status/route.ts - 批量狀態查詢
 *   - src/app/api/v1/invoices/[taskId]/result/route.ts - 單一結果查詢
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { resultRetrievalService, ResultRetrievalError } from '@/services/result-retrieval.service';
import { rateLimitService } from '@/services/rate-limit.service';
import {
  externalApiAuthMiddleware,
  generateTraceId,
  getClientInfo,
} from '@/middlewares/external-api-auth';
import { createExternalApiError } from '@/types/external-api/response';
import {
  MAX_BATCH_RESULTS_SIZE,
  RESULT_ERROR_CODES,
} from '@/types/external-api/result';

// ============================================================
// 請求驗證 Schema
// ============================================================

/**
 * 批量結果查詢請求 Schema
 */
const batchResultsSchema = z.object({
  taskIds: z
    .array(z.string().min(1))
    .min(1, 'At least one task ID is required')
    .max(MAX_BATCH_RESULTS_SIZE, `Maximum ${MAX_BATCH_RESULTS_SIZE} task IDs allowed`),
});

// ============================================================
// POST /api/v1/invoices/batch-results
// ============================================================

/**
 * 批量查詢任務結果
 *
 * @description
 *   一次查詢多個任務的處理結果。每個任務會獨立返回其結果或錯誤資訊。
 *   最多支援 50 個任務 ID。
 *
 * @param request - Next.js 請求物件
 * @returns 批量結果回應
 *
 * @example
 * POST /api/v1/invoices/batch-results
 * Authorization: Bearer sk_live_xxx
 * Content-Type: application/json
 *
 * Request:
 * {
 *   "taskIds": ["task_abc123", "task_def456", "task_ghi789"]
 * }
 *
 * Response:
 * {
 *   "results": [
 *     {
 *       "taskId": "task_abc123",
 *       "success": true,
 *       "result": { ... }
 *     },
 *     {
 *       "taskId": "task_def456",
 *       "success": false,
 *       "error": {
 *         "code": "TASK_NOT_COMPLETED",
 *         "message": "Task is currently processing"
 *       }
 *     }
 *   ],
 *   "notFound": ["task_ghi789"]
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
          title: authResult.errorCode ?? 'Authentication Failed',
          status: authResult.statusCode,
          detail: authResult.errorMessage ?? 'Invalid or missing API key',
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
            'Retry-After': String(rateLimitResult.retryAfter ?? 60),
          },
        }
      );
    }

    // 3. 解析並驗證請求體
    let requestBody: unknown;
    try {
      requestBody = await request.json();
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

    const validationResult = batchResultsSchema.safeParse(requestBody);

    if (!validationResult.success) {
      return NextResponse.json(
        createExternalApiError({
          type: 'validation_error',
          title: 'Validation Error',
          status: 400,
          detail: 'Request validation failed',
          instance: request.url,
          traceId,
          errors: validationResult.error.flatten().fieldErrors as Record<string, string[]>,
        }),
        { status: 400 }
      );
    }

    const { taskIds } = validationResult.data;

    // 4. 去除重複的任務 ID
    const uniqueTaskIds = [...new Set(taskIds)];

    // 5. 批量查詢結果
    const batchResults = await resultRetrievalService.getBatchResults(uniqueTaskIds, apiKey);

    // 6. 構建回應標頭
    const headers: Record<string, string> = {
      'X-Trace-ID': traceId,
      'X-RateLimit-Limit': String(rateLimitResult.limit),
      'X-RateLimit-Remaining': String(rateLimitResult.remaining),
      'X-RateLimit-Reset': String(rateLimitResult.reset),
    };

    // 7. 返回成功回應
    return NextResponse.json(batchResults, { headers });
  } catch (error) {
    console.error('[Batch Results API] Error:', {
      traceId,
      clientInfo,
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    // 處理批量大小超限錯誤
    if (error instanceof ResultRetrievalError) {
      if (error.code === RESULT_ERROR_CODES.BATCH_SIZE_EXCEEDED) {
        return NextResponse.json(
          createExternalApiError({
            type: 'batch_size_exceeded',
            title: 'Batch Size Exceeded',
            status: 400,
            detail: `Maximum ${MAX_BATCH_RESULTS_SIZE} task IDs allowed per request`,
            instance: request.url,
            traceId,
          }),
          { status: 400 }
        );
      }
    }

    return NextResponse.json(
      createExternalApiError({
        type: 'internal_error',
        title: 'Internal Server Error',
        status: 500,
        detail: 'An unexpected error occurred while retrieving batch results',
        instance: request.url,
        traceId,
      }),
      { status: 500 }
    );
  }
}
