/**
 * @fileoverview 任務狀態查詢 API 端點
 * @description
 *   提供單一任務狀態查詢功能，支援：
 *   - 依任務 ID 查詢處理狀態
 *   - 不同狀態返回不同資訊（進度、結果 URL、錯誤資訊等）
 *   - 輪詢間隔建議（X-Poll-Interval header）
 *
 * @module src/app/api/v1/invoices/[taskId]/status/route
 * @author Development Team
 * @since Epic 11 - Story 11.2 (API 處理狀態查詢端點)
 * @lastModified 2025-12-21
 *
 * @features
 *   - GET /api/v1/invoices/{taskId}/status - 查詢單一任務狀態
 *   - 根據狀態返回不同內容（completed 含 resultUrl，failed 含 error）
 *   - 非終端狀態含輪詢間隔建議
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
 *   - src/app/api/v1/invoices/route.ts - 發票提交與列表 API
 *   - src/app/api/v1/invoices/batch-status/route.ts - 批量狀態查詢
 */

import { NextRequest, NextResponse } from 'next/server';
import { taskStatusService } from '@/services/task-status.service';
import { rateLimitService } from '@/services/rate-limit.service';
import {
  externalApiAuthMiddleware,
  generateTraceId,
  getClientInfo,
} from '@/middlewares/external-api-auth';
import {
  taskIdSchema,
  isTerminalStatus,
  getSuggestedPollInterval,
} from '@/types/external-api';
import { createExternalApiError } from '@/types/external-api/response';

// ============================================================
// 路由參數類型
// ============================================================

interface RouteContext {
  params: Promise<{
    taskId: string;
  }>;
}

// ============================================================
// GET /api/v1/invoices/{taskId}/status
// ============================================================

/**
 * 查詢單一任務狀態
 *
 * @description
 *   根據任務 ID 查詢處理狀態，返回不同狀態對應的資訊：
 *   - queued: 預估完成時間
 *   - processing: 當前步驟、進度、預估完成時間
 *   - completed: 結果 URL、信心分數
 *   - failed: 錯誤代碼、訊息、是否可重試
 *   - review_required: 審核原因、審核 URL
 *   - expired: 過期時間
 *
 * @param request - Next.js 請求物件
 * @param context - 路由上下文（含 taskId 參數）
 * @returns 任務狀態回應
 *
 * @example
 * GET /api/v1/invoices/task_abc123/status
 * Authorization: Bearer sk_live_xxx
 *
 * Response (processing):
 * {
 *   "success": true,
 *   "data": {
 *     "taskId": "task_abc123",
 *     "status": "processing",
 *     "progress": 45,
 *     "currentStep": "AI extracting invoice data",
 *     "estimatedCompletion": "2025-12-21T10:30:00Z"
 *   }
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

    // 4. 查詢任務狀態
    const taskStatus = await taskStatusService.getTaskStatus(taskId, apiKey);

    // 5. 檢查任務是否存在
    if (!taskStatus) {
      return NextResponse.json(
        createExternalApiError({
          type: 'not_found',
          title: 'Task Not Found',
          status: 404,
          detail: `Task with ID '${taskId}' not found or you don't have permission to access it`,
          instance: request.url,
          traceId,
        }),
        { status: 404 }
      );
    }

    // 6. 構建回應標頭
    const headers: Record<string, string> = {
      'X-Trace-ID': traceId,
      'X-RateLimit-Limit': String(rateLimitResult.limit),
      'X-RateLimit-Remaining': String(rateLimitResult.remaining),
      'X-RateLimit-Reset': String(rateLimitResult.reset),
    };

    // 對於非終端狀態，添加輪詢間隔建議
    if (!isTerminalStatus(taskStatus.status)) {
      const pollInterval = getSuggestedPollInterval(taskStatus.status);
      headers['X-Poll-Interval'] = String(pollInterval);
    }

    // 7. 返回成功回應
    return NextResponse.json(
      {
        success: true,
        data: taskStatus,
      },
      { headers }
    );
  } catch (error) {
    console.error('[Task Status API] Error:', {
      traceId,
      clientInfo,
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return NextResponse.json(
      createExternalApiError({
        type: 'internal_error',
        title: 'Internal Server Error',
        status: 500,
        detail: 'An unexpected error occurred while querying task status',
        instance: request.url,
        traceId,
      }),
      { status: 500 }
    );
  }
}
