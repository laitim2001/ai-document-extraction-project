/**
 * @fileoverview n8n API 認證中間件
 * @description
 *   本模組提供 n8n API 端點的認證和授權功能，包含：
 *   - API Key 驗證（支援 Authorization header 和 X-API-Key header）
 *   - 權限檢查
 *   - 速率限制
 *   - 請求追蹤與記錄
 *
 *   ## 認證方式
 *   支援兩種 API Key 提供方式：
 *   1. Authorization: Bearer <api_key>
 *   2. X-API-Key: <api_key>
 *
 *   ## 錯誤響應格式
 *   ```json
 *   {
 *     "success": false,
 *     "error": {
 *       "code": "ERROR_CODE",
 *       "message": "Error description"
 *     },
 *     "traceId": "n8n_xxx_xxx",
 *     "timestamp": "2025-01-01T00:00:00.000Z"
 *   }
 *   ```
 *
 * @module src/lib/middleware/n8n-api.middleware
 * @author Development Team
 * @since Epic 10 - Story 10.1
 * @lastModified 2025-12-20
 *
 * @features
 *   - API Key 認證
 *   - 權限驗證
 *   - 請求追蹤
 *   - API 調用記錄
 *
 * @dependencies
 *   - @/services/n8n - n8n 服務
 *   - @/lib/prisma - 資料庫客戶端
 *
 * @related
 *   - src/types/n8n.ts - n8n 類型定義
 *   - src/app/api/n8n/ - n8n API 路由
 */

import { NextRequest } from 'next/server';
import { n8nApiKeyService } from '@/services/n8n';
import { prisma } from '@/lib/prisma';
import type { N8nPermission, N8nErrorCode, N8nApiContext } from '@/types/n8n';

// ============================================================
// Types
// ============================================================

/**
 * 錯誤碼對應 HTTP 狀態碼
 */
const ERROR_STATUS_MAP: Record<N8nErrorCode, number> = {
  MISSING_API_KEY: 401,
  INVALID_API_KEY: 401,
  EXPIRED_API_KEY: 401,
  DISABLED_API_KEY: 401,
  RATE_LIMITED: 429,
  INSUFFICIENT_PERMISSIONS: 403,
  CITY_MISMATCH: 403,
  VALIDATION_ERROR: 400,
  NOT_FOUND: 404,
  INTERNAL_ERROR: 500,
  WEBHOOK_DELIVERY_FAILED: 500,
};

/**
 * 驗證錯誤碼對應 n8n 錯誤碼
 */
const VALIDATION_ERROR_MAP: Record<string, N8nErrorCode> = {
  INVALID_KEY: 'INVALID_API_KEY',
  DISABLED: 'DISABLED_API_KEY',
  EXPIRED: 'EXPIRED_API_KEY',
  RATE_LIMITED: 'RATE_LIMITED',
};

// ============================================================
// Middleware Function
// ============================================================

/**
 * n8n API 認證中間件
 *
 * @description
 *   驗證 n8n API 請求的認證和授權。
 *   執行以下檢查：
 *   1. API Key 存在性
 *   2. API Key 有效性
 *   3. 權限驗證
 *   4. 速率限制
 *
 * @param request - Next.js 請求對象
 * @param requiredPermission - 所需權限
 * @returns 認證上下文
 *
 * @example
 * ```typescript
 * export async function POST(request: NextRequest) {
 *   const authResult = await n8nApiMiddleware(request, 'documents:write');
 *
 *   if (!authResult.authorized) {
 *     return NextResponse.json(
 *       {
 *         success: false,
 *         error: { code: authResult.errorCode, message: authResult.errorMessage },
 *         traceId: authResult.traceId,
 *         timestamp: new Date().toISOString(),
 *       },
 *       { status: authResult.statusCode }
 *     );
 *   }
 *
 *   // 繼續處理請求...
 *   const apiKey = authResult.apiKey!;
 * }
 * ```
 */
export async function n8nApiMiddleware(
  request: NextRequest,
  requiredPermission: N8nPermission
): Promise<N8nApiContext> {
  const startTime = Date.now();
  const traceId = generateTraceId();

  // 從 header 獲取 API Key
  const authHeader = request.headers.get('Authorization');
  const apiKeyHeader = request.headers.get('X-API-Key');

  let rawKey: string | null = null;

  if (authHeader?.startsWith('Bearer ')) {
    rawKey = authHeader.slice(7);
  } else if (apiKeyHeader) {
    rawKey = apiKeyHeader;
  }

  if (!rawKey) {
    await recordApiCall(request, null, 401, startTime, traceId, 'Missing API key');
    return {
      authorized: false,
      traceId,
      statusCode: 401,
      errorCode: 'MISSING_API_KEY',
      errorMessage: 'API key is required. Provide via Authorization header or X-API-Key header.',
    };
  }

  // 驗證 API Key
  const validationResult = await n8nApiKeyService.validateApiKey(rawKey);

  if (!validationResult.valid) {
    const errorCode = VALIDATION_ERROR_MAP[validationResult.errorCode ?? ''] ?? 'INVALID_API_KEY';
    const statusCode = ERROR_STATUS_MAP[errorCode];

    await recordApiCall(request, null, statusCode, startTime, traceId, validationResult.error);

    return {
      authorized: false,
      traceId,
      statusCode,
      errorCode,
      errorMessage: validationResult.error,
    };
  }

  const apiKey = validationResult.apiKey!;

  // 檢查權限
  if (!n8nApiKeyService.hasPermission(apiKey, requiredPermission)) {
    await recordApiCall(
      request,
      apiKey.id,
      403,
      startTime,
      traceId,
      'Insufficient permissions'
    );

    return {
      authorized: false,
      apiKey,
      traceId,
      statusCode: 403,
      errorCode: 'INSUFFICIENT_PERMISSIONS',
      errorMessage: `Missing required permission: ${requiredPermission}`,
    };
  }

  return {
    authorized: true,
    apiKey,
    traceId,
    statusCode: 200,
  };
}

// ============================================================
// Helper Functions
// ============================================================

/**
 * 生成 Trace ID
 *
 * @description
 *   生成唯一的追蹤 ID，格式：n8n_{timestamp}_{random}
 *
 * @returns 追蹤 ID
 */
function generateTraceId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 11);
  return `n8n_${timestamp}_${random}`;
}

/**
 * 記錄 API 調用
 *
 * @description
 *   將 API 調用記錄到資料庫，用於統計和審計。
 *
 * @param request - Next.js 請求對象
 * @param apiKeyId - API Key ID（如有）
 * @param statusCode - HTTP 狀態碼
 * @param startTime - 請求開始時間
 * @param traceId - 追蹤 ID
 * @param errorMessage - 錯誤訊息（如有）
 */
async function recordApiCall(
  request: NextRequest,
  apiKeyId: string | null,
  statusCode: number,
  startTime: number,
  traceId: string,
  errorMessage?: string
): Promise<void> {
  if (!apiKeyId) return;

  const durationMs = Date.now() - startTime;

  try {
    await prisma.n8nApiCall.create({
      data: {
        apiKeyId,
        endpoint: new URL(request.url).pathname,
        method: request.method,
        statusCode,
        durationMs,
        traceId,
        ipAddress:
          request.headers.get('x-forwarded-for') ??
          request.headers.get('x-real-ip') ??
          'unknown',
        userAgent: request.headers.get('user-agent'),
        responseBody: errorMessage ? { error: errorMessage } : undefined,
      },
    });
  } catch (error) {
    console.error('Failed to record API call:', error);
  }
}

// ============================================================
// Utility Exports
// ============================================================

/**
 * 建立標準錯誤響應
 *
 * @description
 *   建立符合 n8n API 規範的錯誤響應對象。
 *
 * @param context - 認證上下文
 * @returns 錯誤響應對象
 *
 * @example
 * ```typescript
 * if (!authResult.authorized) {
 *   return NextResponse.json(
 *     createErrorResponse(authResult),
 *     { status: authResult.statusCode }
 *   );
 * }
 * ```
 */
export function createErrorResponse(context: N8nApiContext) {
  return {
    success: false,
    error: {
      code: context.errorCode,
      message: context.errorMessage,
    },
    traceId: context.traceId,
    timestamp: new Date().toISOString(),
  };
}

/**
 * 建立標準成功響應
 *
 * @description
 *   建立符合 n8n API 規範的成功響應對象。
 *
 * @param data - 響應數據
 * @param traceId - 追蹤 ID
 * @returns 成功響應對象
 *
 * @example
 * ```typescript
 * return NextResponse.json(
 *   createSuccessResponse(result, authResult.traceId),
 *   { status: 200 }
 * );
 * ```
 */
export function createSuccessResponse<T>(data: T, traceId: string) {
  return {
    success: true,
    data,
    traceId,
    timestamp: new Date().toISOString(),
  };
}
