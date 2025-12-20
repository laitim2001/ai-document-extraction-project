/**
 * @fileoverview 發票提交 API 端點
 * @description
 *   RESTful API 端點用於外部系統提交發票，支援：
 *   - Multipart/form-data 文件上傳
 *   - Base64 編碼內容
 *   - URL 引用
 *
 *   認證方式：Bearer Token (API Key)
 *   回應格式：HTTP 202 Accepted
 *
 * @module src/app/api/v1/invoices/route
 * @author Development Team
 * @since Epic 11 - Story 11.1 (API 發票提交端點)
 * @lastModified 2025-12-20
 *
 * @features
 *   - 三種提交方式支援
 *   - API Key 認證
 *   - 速率限制
 *   - 請求追蹤
 *   - 審計日誌
 *
 * @dependencies
 *   - next/server - Next.js API 支援
 *   - @/services/invoice-submission.service - 發票提交服務
 *   - @/services/rate-limit.service - 速率限制服務
 *   - @/middleware/external-api-auth - 認證中間件
 *   - @/types/external-api - 類型定義
 *
 * @related
 *   - docs/04-implementation/tech-specs/epic-11-external-api/tech-spec-story-11-1.md
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  invoiceSubmissionService,
  ApiError,
} from '@/services/invoice-submission.service';
import { rateLimitService } from '@/services/rate-limit.service';
import {
  externalApiAuthMiddleware,
  generateTraceId,
  getClientInfo,
} from '@/middleware/external-api-auth';
import {
  base64SubmissionSchema,
  urlSubmissionSchema,
  commonParamsSchema,
  multipartParamsSchema,
  SubmitInvoiceRequest,
  ApiErrorResponse,
} from '@/types/external-api';
import { prisma } from '@/lib/prisma';

// ============================================================
// API 路由處理器
// ============================================================

/**
 * POST /api/v1/invoices
 * @description 提交發票進行 AI 處理
 *
 * @param request Next.js 請求對象
 * @returns HTTP 202 Accepted 或錯誤回應
 *
 * @example
 * ```bash
 * # Multipart 上傳
 * curl -X POST https://api.example.com/api/v1/invoices \
 *   -H "Authorization: Bearer YOUR_API_KEY" \
 *   -F "file=@invoice.pdf" \
 *   -F 'params={"cityCode":"HKG","priority":"NORMAL"}'
 *
 * # Base64 提交
 * curl -X POST https://api.example.com/api/v1/invoices \
 *   -H "Authorization: Bearer YOUR_API_KEY" \
 *   -H "Content-Type: application/json" \
 *   -d '{
 *     "type": "base64",
 *     "content": "JVBERi0xLjQK...",
 *     "fileName": "invoice.pdf",
 *     "mimeType": "application/pdf",
 *     "cityCode": "HKG"
 *   }'
 * ```
 */
export async function POST(request: NextRequest) {
  const traceId = generateTraceId();
  const startTime = Date.now();

  try {
    // 1. 認證
    const authResult = await externalApiAuthMiddleware(request, ['submit']);

    if (!authResult.authorized) {
      await logApiCall(request, null, authResult.statusCode, startTime, traceId);

      return createErrorResponse(
        authResult.errorCode || 'INVALID_API_KEY',
        authResult.errorMessage || 'Authentication failed',
        authResult.statusCode,
        traceId
      );
    }

    const apiKey = authResult.apiKey!;

    // 2. 速率限制
    const rateLimitResult = await rateLimitService.checkLimit(apiKey);

    if (!rateLimitResult.allowed) {
      await logApiCall(request, apiKey.id, 429, startTime, traceId);

      return NextResponse.json(
        {
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Too many requests. Please try again later.',
            details: {
              limit: rateLimitResult.limit,
              remaining: rateLimitResult.remaining,
              resetAt: rateLimitResult.reset,
              retryAfter: rateLimitResult.retryAfter,
            },
          },
          traceId,
        } satisfies ApiErrorResponse,
        {
          status: 429,
          headers: {
            'Retry-After': rateLimitResult.retryAfter?.toString() || '60',
            'X-RateLimit-Limit': rateLimitResult.limit.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': rateLimitResult.reset.toString(),
          },
        }
      );
    }

    // 3. 解析請求內容
    const contentType = request.headers.get('content-type') || '';
    let submissionRequest: SubmitInvoiceRequest;

    if (contentType.includes('multipart/form-data')) {
      submissionRequest = await parseMultipartRequest(request);
    } else if (contentType.includes('application/json')) {
      submissionRequest = await parseJsonRequest(request);
    } else {
      return createErrorResponse(
        'UNSUPPORTED_CONTENT_TYPE',
        'Content-Type must be multipart/form-data or application/json',
        415,
        traceId
      );
    }

    // 4. 提交處理
    const clientInfo = getClientInfo(request);
    const result = await invoiceSubmissionService.submitInvoice(
      submissionRequest,
      apiKey,
      clientInfo
    );

    await logApiCall(request, apiKey.id, 202, startTime, traceId);

    // 5. 返回結果
    return NextResponse.json(
      {
        data: result,
        traceId,
      },
      {
        status: 202,
        headers: {
          'X-RateLimit-Limit': rateLimitResult.limit.toString(),
          'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
          'X-RateLimit-Reset': rateLimitResult.reset.toString(),
        },
      }
    );
  } catch (error) {
    return handleError(error, traceId, startTime, request);
  }
}

// ============================================================
// 請求解析函數
// ============================================================

/**
 * 解析 Multipart 請求
 * @param request Next.js 請求對象
 * @returns 提交請求對象
 */
async function parseMultipartRequest(request: NextRequest): Promise<SubmitInvoiceRequest> {
  const formData = await request.formData();
  const file = formData.get('file') as File | null;
  const params = formData.get('params') as string | null;

  if (!file) {
    throw new ApiError('MISSING_FILE', 'File is required for multipart upload', 400);
  }

  // 解析參數
  let parsedParams: Record<string, unknown> = {};
  if (params) {
    try {
      parsedParams = JSON.parse(params);
    } catch {
      throw new ApiError('VALIDATION_ERROR', 'Invalid params JSON format', 400);
    }
  }

  // 也支援從 form fields 獲取參數
  const cityCode = (formData.get('cityCode') as string) || (parsedParams.cityCode as string);
  const priority = (formData.get('priority') as string) || (parsedParams.priority as string);
  const callbackUrl =
    (formData.get('callbackUrl') as string) || (parsedParams.callbackUrl as string);
  const metadataStr = formData.get('metadata') as string;

  const validatedParams = multipartParamsSchema.parse({
    cityCode,
    priority,
    callbackUrl,
    metadata: metadataStr || (parsedParams.metadata ? JSON.stringify(parsedParams.metadata) : undefined),
  });

  const arrayBuffer = await file.arrayBuffer();

  return {
    file: {
      buffer: Buffer.from(arrayBuffer),
      originalName: file.name,
      mimeType: file.type || 'application/octet-stream',
      size: file.size,
    },
    cityCode: validatedParams.cityCode,
    priority: validatedParams.priority,
    callbackUrl: validatedParams.callbackUrl,
    metadata: validatedParams.metadata,
  };
}

/**
 * 解析 JSON 請求
 * @param request Next.js 請求對象
 * @returns 提交請求對象
 */
async function parseJsonRequest(request: NextRequest): Promise<SubmitInvoiceRequest> {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    throw new ApiError('VALIDATION_ERROR', 'Invalid JSON body', 400);
  }

  // 驗證通用參數
  const validatedParams = commonParamsSchema.parse({
    cityCode: body.cityCode,
    priority: body.priority,
    callbackUrl: body.callbackUrl,
    metadata: body.metadata,
  });

  // 判斷提交類型
  if (body.submission && typeof body.submission === 'object') {
    const submission = body.submission as Record<string, unknown>;
    if (submission.type === 'base64') {
      const base64Data = base64SubmissionSchema.parse(submission);
      return {
        base64Content: {
          content: base64Data.content,
          fileName: base64Data.fileName,
          mimeType: base64Data.mimeType,
        },
        cityCode: validatedParams.cityCode,
        priority: validatedParams.priority,
        callbackUrl: validatedParams.callbackUrl,
        metadata: validatedParams.metadata,
      };
    }

    if (submission.type === 'url') {
      const urlData = urlSubmissionSchema.parse(submission);
      return {
        urlReference: {
          url: urlData.url,
          fileName: urlData.fileName,
        },
        cityCode: validatedParams.cityCode,
        priority: validatedParams.priority,
        callbackUrl: validatedParams.callbackUrl,
        metadata: validatedParams.metadata,
      };
    }
  }

  // 也支援平面結構（向後兼容）
  if (body.type === 'base64') {
    const base64Data = base64SubmissionSchema.parse(body);
    return {
      base64Content: {
        content: base64Data.content,
        fileName: base64Data.fileName,
        mimeType: base64Data.mimeType,
      },
      cityCode: validatedParams.cityCode,
      priority: validatedParams.priority,
      callbackUrl: validatedParams.callbackUrl,
      metadata: validatedParams.metadata,
    };
  }

  if (body.type === 'url') {
    const urlData = urlSubmissionSchema.parse(body);
    return {
      urlReference: {
        url: urlData.url,
        fileName: urlData.fileName,
      },
      cityCode: validatedParams.cityCode,
      priority: validatedParams.priority,
      callbackUrl: validatedParams.callbackUrl,
      metadata: validatedParams.metadata,
    };
  }

  throw new ApiError(
    'INVALID_SUBMISSION_TYPE',
    'type must be "base64" or "url" for JSON requests, or use "submission" object',
    400
  );
}

// ============================================================
// 錯誤處理
// ============================================================

/**
 * 創建錯誤回應
 */
function createErrorResponse(
  code: string,
  message: string,
  status: number,
  traceId: string,
  details?: unknown
): NextResponse {
  return NextResponse.json(
    {
      error: {
        code,
        message,
        details,
      },
      traceId,
    },
    { status }
  );
}

/**
 * 處理錯誤
 */
function handleError(
  error: unknown,
  traceId: string,
  startTime: number,
  request: NextRequest
): NextResponse {
  if (error instanceof ApiError) {
    // 記錄業務錯誤（異步）
    logApiCall(request, null, error.statusCode, startTime, traceId).catch(console.error);

    return createErrorResponse(error.code, error.message, error.statusCode, traceId);
  }

  if (error instanceof z.ZodError) {
    logApiCall(request, null, 400, startTime, traceId).catch(console.error);

    return createErrorResponse(
      'VALIDATION_ERROR',
      'Invalid request parameters',
      400,
      traceId,
      error.issues.map((e) => ({
        field: e.path.map(String).join('.'),
        message: e.message,
      }))
    );
  }

  // 未預期錯誤
  console.error('Invoice submission error:', error);
  logApiCall(request, null, 500, startTime, traceId).catch(console.error);

  return createErrorResponse('INTERNAL_ERROR', 'An unexpected error occurred', 500, traceId);
}

// ============================================================
// 審計日誌
// ============================================================

/**
 * 記錄 API 調用
 */
async function logApiCall(
  request: NextRequest,
  apiKeyId: string | null,
  statusCode: number,
  startTime: number,
  traceId: string
): Promise<void> {
  // 如果沒有 apiKeyId，跳過審計日誌（認證失敗的情況）
  if (!apiKeyId) {
    return;
  }

  try {
    await prisma.apiAuditLog.create({
      data: {
        apiKeyId,
        endpoint: '/api/v1/invoices',
        path: request.nextUrl.pathname,
        method: 'POST',
        statusCode,
        responseTime: Date.now() - startTime,
        traceId,
        clientIp:
          request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
          request.headers.get('x-real-ip') ||
          'unknown',
        userAgent: request.headers.get('user-agent'),
      },
    });
  } catch (error) {
    console.error('Failed to log API call:', error);
  }
}
