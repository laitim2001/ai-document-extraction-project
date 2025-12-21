/**
 * @fileoverview 任務結果擷取 API 端點
 * @description
 *   提供任務處理結果擷取功能，支援：
 *   - 依任務 ID 查詢完整處理結果
 *   - 多格式輸出（JSON、CSV、XML）
 *   - 未完成狀態返回 HTTP 409
 *   - 結果過期返回 HTTP 410
 *
 * @module src/app/api/v1/invoices/[taskId]/result/route
 * @author Development Team
 * @since Epic 11 - Story 11.3 (API 處理結果擷取端點)
 * @lastModified 2025-12-21
 *
 * @features
 *   - GET /api/v1/invoices/{taskId}/result - 查詢任務結果
 *   - 支援 format 查詢參數（json|csv|xml）
 *   - 根據格式返回對應 Content-Type
 *   - API Key 權限驗證
 *
 * @dependencies
 *   - next/server - Next.js 伺服器端功能
 *   - @/services/result-retrieval.service - 結果擷取服務
 *   - @/services/rate-limit.service - 速率限制服務
 *   - @/middlewares/external-api-auth - 外部 API 認證中間件
 *   - @/types/external-api - 外部 API 類型定義
 *
 * @related
 *   - src/app/api/v1/invoices/[taskId]/status/route.ts - 狀態查詢
 *   - src/app/api/v1/invoices/[taskId]/result/fields/[fieldName]/route.ts - 欄位查詢
 */

import { NextRequest, NextResponse } from 'next/server';
import { resultRetrievalService, ResultRetrievalError } from '@/services/result-retrieval.service';
import { rateLimitService } from '@/services/rate-limit.service';
import {
  externalApiAuthMiddleware,
  generateTraceId,
  getClientInfo,
} from '@/middlewares/external-api-auth';
import { taskIdSchema } from '@/types/external-api';
import { createExternalApiError } from '@/types/external-api/response';
import {
  isValidOutputFormat,
  DEFAULT_OUTPUT_FORMAT,
  RESULT_ERROR_CODES,
  RESULT_ERROR_HTTP_STATUS,
} from '@/types/external-api/result';

// ============================================================
// 路由參數類型
// ============================================================

interface RouteContext {
  params: Promise<{
    taskId: string;
  }>;
}

// ============================================================
// GET /api/v1/invoices/{taskId}/result
// ============================================================

/**
 * 查詢任務處理結果
 *
 * @description
 *   根據任務 ID 查詢完整處理結果，支援多格式輸出：
 *   - json: 標準 JSON 格式（預設）
 *   - csv: CSV 格式（僅欄位資料）
 *   - xml: XML 格式
 *
 * @param request - Next.js 請求物件
 * @param context - 路由上下文（含 taskId 參數）
 * @returns 任務結果回應
 *
 * @example
 * GET /api/v1/invoices/task_abc123/result?format=json
 * Authorization: Bearer sk_live_xxx
 *
 * Response (success):
 * {
 *   "taskId": "task_abc123",
 *   "status": "completed",
 *   "confidenceScore": 0.95,
 *   "fields": [...],
 *   "metadata": {...}
 * }
 */
export async function GET(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
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

    // 3. 驗證任務 ID
    const { taskId } = await context.params;
    const validationResult = taskIdSchema.safeParse(taskId);

    if (!validationResult.success) {
      return NextResponse.json(
        createExternalApiError({
          type: 'validation_error',
          title: 'Invalid Task ID',
          status: 400,
          detail: 'Task ID format is invalid',
          instance: request.url,
          traceId,
          errors: {
            taskId: validationResult.error.issues.map(e => e.message),
          },
        }),
        { status: 400 }
      );
    }

    // 4. 解析輸出格式
    const url = new URL(request.url);
    const formatParam = url.searchParams.get('format') ?? DEFAULT_OUTPUT_FORMAT;

    if (!isValidOutputFormat(formatParam)) {
      return NextResponse.json(
        createExternalApiError({
          type: 'validation_error',
          title: 'Invalid Format',
          status: 400,
          detail: 'Invalid output format. Supported formats: json, csv, xml',
          instance: request.url,
          traceId,
          errors: {
            format: ['Must be one of: json, csv, xml'],
          },
        }),
        { status: 400 }
      );
    }

    // 5. 查詢任務結果
    const result = await resultRetrievalService.getTaskResult(taskId, apiKey);

    // 6. 構建回應標頭
    const headers: Record<string, string> = {
      'X-Trace-ID': traceId,
      'X-RateLimit-Limit': String(rateLimitResult.limit),
      'X-RateLimit-Remaining': String(rateLimitResult.remaining),
      'X-RateLimit-Reset': String(rateLimitResult.reset),
      'Content-Type': resultRetrievalService.getContentType(formatParam),
    };

    // 7. 根據格式返回結果
    if (formatParam === 'csv') {
      const csvContent = resultRetrievalService.formatAsCsv(result);
      return new NextResponse(csvContent, {
        status: 200,
        headers: {
          ...headers,
          'Content-Disposition': `attachment; filename="${taskId}_result.csv"`,
        },
      });
    }

    if (formatParam === 'xml') {
      const xmlContent = resultRetrievalService.formatAsXml(result);
      return new NextResponse(xmlContent, {
        status: 200,
        headers,
      });
    }

    // JSON 格式（預設）
    return NextResponse.json(result, { headers });
  } catch (error) {
    console.error('[Result API] Error:', {
      traceId,
      clientInfo,
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    // 處理結果擷取錯誤
    if (error instanceof ResultRetrievalError) {
      const status = RESULT_ERROR_HTTP_STATUS[error.code];

      // 特殊處理 409 和 410 狀態
      if (error.code === RESULT_ERROR_CODES.TASK_NOT_COMPLETED) {
        return NextResponse.json(
          createExternalApiError({
            type: 'task_not_completed',
            title: 'Task Not Completed',
            status: 409,
            detail: error.message,
            instance: request.url,
            traceId,
          }),
          {
            status: 409,
            headers: {
              'X-Poll-Interval': '5',
            },
          }
        );
      }

      if (error.code === RESULT_ERROR_CODES.RESULT_EXPIRED) {
        return NextResponse.json(
          createExternalApiError({
            type: 'result_expired',
            title: 'Result Expired',
            status: 410,
            detail: error.message,
            instance: request.url,
            traceId,
          }),
          { status: 410 }
        );
      }

      return NextResponse.json(
        createExternalApiError({
          type: error.code.toLowerCase(),
          title: error.code.replace(/_/g, ' '),
          status,
          detail: error.message,
          instance: request.url,
          traceId,
        }),
        { status }
      );
    }

    return NextResponse.json(
      createExternalApiError({
        type: 'internal_error',
        title: 'Internal Server Error',
        status: 500,
        detail: 'An unexpected error occurred while retrieving task result',
        instance: request.url,
        traceId,
      }),
      { status: 500 }
    );
  }
}
