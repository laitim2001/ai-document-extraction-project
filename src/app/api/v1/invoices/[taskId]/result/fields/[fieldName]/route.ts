/**
 * @fileoverview 單一欄位值查詢 API 端點
 * @description
 *   提供單一欄位值查詢功能，支援：
 *   - 依任務 ID 和欄位名稱查詢特定欄位值
 *   - 欄位名稱大小寫不敏感
 *   - 返回欄位值、信心度和驗證狀態
 *
 * @module src/app/api/v1/invoices/[taskId]/result/fields/[fieldName]/route
 * @author Development Team
 * @since Epic 11 - Story 11.3 (API 處理結果擷取端點)
 * @lastModified 2025-12-21
 *
 * @features
 *   - GET /api/v1/invoices/{taskId}/result/fields/{fieldName} - 查詢單一欄位
 *   - 欄位名稱大小寫不敏感匹配
 *   - API Key 權限驗證
 *
 * @dependencies
 *   - next/server - Next.js 伺服器端功能
 *   - @/services/result-retrieval.service - 結果擷取服務
 *   - @/services/rate-limit.service - 速率限制服務
 *   - @/middleware/external-api-auth - 外部 API 認證中間件
 *
 * @related
 *   - src/app/api/v1/invoices/[taskId]/result/route.ts - 完整結果查詢
 */

import { NextRequest, NextResponse } from 'next/server';
import { resultRetrievalService, ResultRetrievalError } from '@/services/result-retrieval.service';
import { rateLimitService } from '@/services/rate-limit.service';
import {
  externalApiAuthMiddleware,
  generateTraceId,
  getClientInfo,
} from '@/middleware/external-api-auth';
import { taskIdSchema } from '@/types/external-api';
import { createExternalApiError } from '@/types/external-api/response';
import {
  RESULT_ERROR_CODES,
  RESULT_ERROR_HTTP_STATUS,
} from '@/types/external-api/result';

// ============================================================
// 路由參數類型
// ============================================================

interface RouteContext {
  params: Promise<{
    taskId: string;
    fieldName: string;
  }>;
}

// ============================================================
// GET /api/v1/invoices/{taskId}/result/fields/{fieldName}
// ============================================================

/**
 * 查詢單一欄位值
 *
 * @description
 *   根據任務 ID 和欄位名稱查詢特定欄位值。
 *   欄位名稱匹配為大小寫不敏感。
 *
 * @param request - Next.js 請求物件
 * @param context - 路由上下文（含 taskId 和 fieldName 參數）
 * @returns 欄位值回應
 *
 * @example
 * GET /api/v1/invoices/task_abc123/result/fields/invoiceNumber
 * Authorization: Bearer sk_live_xxx
 *
 * Response:
 * {
 *   "taskId": "task_abc123",
 *   "fieldName": "invoiceNumber",
 *   "value": "INV-2025-001",
 *   "confidence": 0.98,
 *   "dataType": "string",
 *   "validationStatus": "valid"
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

    // 3. 解析並驗證參數
    const { taskId, fieldName } = await context.params;

    const taskIdValidation = taskIdSchema.safeParse(taskId);
    if (!taskIdValidation.success) {
      return NextResponse.json(
        createExternalApiError({
          type: 'validation_error',
          title: 'Invalid Task ID',
          status: 400,
          detail: 'Task ID format is invalid',
          instance: request.url,
          traceId,
          errors: {
            taskId: taskIdValidation.error.issues.map(e => e.message),
          },
        }),
        { status: 400 }
      );
    }

    // 驗證欄位名稱
    if (!fieldName || fieldName.trim().length === 0) {
      return NextResponse.json(
        createExternalApiError({
          type: 'validation_error',
          title: 'Invalid Field Name',
          status: 400,
          detail: 'Field name is required',
          instance: request.url,
          traceId,
          errors: {
            fieldName: ['Field name cannot be empty'],
          },
        }),
        { status: 400 }
      );
    }

    // 4. 查詢欄位值
    const fieldValue = await resultRetrievalService.getFieldValue(
      taskId,
      decodeURIComponent(fieldName),
      apiKey
    );

    // 5. 構建回應標頭
    const headers: Record<string, string> = {
      'X-Trace-ID': traceId,
      'X-RateLimit-Limit': String(rateLimitResult.limit),
      'X-RateLimit-Remaining': String(rateLimitResult.remaining),
      'X-RateLimit-Reset': String(rateLimitResult.reset),
    };

    // 6. 返回成功回應
    return NextResponse.json(fieldValue, { headers });
  } catch (error) {
    console.error('[Field Value API] Error:', {
      traceId,
      clientInfo,
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    // 處理結果擷取錯誤
    if (error instanceof ResultRetrievalError) {
      const status = RESULT_ERROR_HTTP_STATUS[error.code];

      // 特殊處理不同錯誤類型
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

      if (error.code === RESULT_ERROR_CODES.FIELD_NOT_FOUND) {
        return NextResponse.json(
          createExternalApiError({
            type: 'field_not_found',
            title: 'Field Not Found',
            status: 404,
            detail: error.message,
            instance: request.url,
            traceId,
          }),
          { status: 404 }
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
        detail: 'An unexpected error occurred while retrieving field value',
        instance: request.url,
        traceId,
      }),
      { status: 500 }
    );
  }
}
