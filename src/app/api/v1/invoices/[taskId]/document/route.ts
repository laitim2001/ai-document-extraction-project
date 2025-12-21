/**
 * @fileoverview 原始文件下載資訊 API 端點
 * @description
 *   提供原始文件下載資訊，支援：
 *   - 依任務 ID 獲取原始文件下載 URL
 *   - 返回帶有 SAS Token 的下載連結
 *   - URL 有效期 1 小時
 *
 * @module src/app/api/v1/invoices/[taskId]/document/route
 * @author Development Team
 * @since Epic 11 - Story 11.3 (API 處理結果擷取端點)
 * @lastModified 2025-12-21
 *
 * @features
 *   - GET /api/v1/invoices/{taskId}/document - 獲取文件下載資訊
 *   - 返回帶有時效性的 SAS Token URL
 *   - 包含檔案元數據（名稱、大小、類型）
 *   - API Key 權限驗證
 *
 * @dependencies
 *   - next/server - Next.js 伺服器端功能
 *   - @/services/result-retrieval.service - 結果擷取服務
 *   - @/services/rate-limit.service - 速率限制服務
 *   - @/middlewares/external-api-auth - 外部 API 認證中間件
 *
 * @related
 *   - src/app/api/v1/invoices/[taskId]/result/route.ts - 結果查詢
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
// GET /api/v1/invoices/{taskId}/document
// ============================================================

/**
 * 獲取原始文件下載資訊
 *
 * @description
 *   根據任務 ID 獲取原始上傳文件的下載資訊。
 *   返回的 URL 帶有 SAS Token，有效期為 1 小時。
 *
 * @param request - Next.js 請求物件
 * @param context - 路由上下文（含 taskId 參數）
 * @returns 文件下載資訊回應
 *
 * @example
 * GET /api/v1/invoices/task_abc123/document
 * Authorization: Bearer sk_live_xxx
 *
 * Response:
 * {
 *   "taskId": "task_abc123",
 *   "downloadUrl": "https://storage.example.com/documents/abc.pdf?sig=xxx",
 *   "fileName": "invoice.pdf",
 *   "fileSize": 1024000,
 *   "mimeType": "application/pdf",
 *   "urlExpiresAt": "2025-12-21T11:30:00Z"
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

    // 4. 獲取文件下載資訊
    const downloadInfo = await resultRetrievalService.getDocumentDownload(taskId, apiKey);

    // 5. 構建回應標頭
    const headers: Record<string, string> = {
      'X-Trace-ID': traceId,
      'X-RateLimit-Limit': String(rateLimitResult.limit),
      'X-RateLimit-Remaining': String(rateLimitResult.remaining),
      'X-RateLimit-Reset': String(rateLimitResult.reset),
    };

    // 6. 返回成功回應
    return NextResponse.json(downloadInfo, { headers });
  } catch (error) {
    console.error('[Document Download API] Error:', {
      traceId,
      clientInfo,
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    // 處理結果擷取錯誤
    if (error instanceof ResultRetrievalError) {
      const status = RESULT_ERROR_HTTP_STATUS[error.code];

      if (error.code === RESULT_ERROR_CODES.TASK_NOT_FOUND) {
        return NextResponse.json(
          createExternalApiError({
            type: 'task_not_found',
            title: 'Task Not Found',
            status: 404,
            detail: error.message,
            instance: request.url,
            traceId,
          }),
          { status: 404 }
        );
      }

      if (error.code === RESULT_ERROR_CODES.DOCUMENT_NOT_FOUND) {
        return NextResponse.json(
          createExternalApiError({
            type: 'document_not_found',
            title: 'Document Not Found',
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
        detail: 'An unexpected error occurred while retrieving document info',
        instance: request.url,
        traceId,
      }),
      { status: 500 }
    );
  }
}
