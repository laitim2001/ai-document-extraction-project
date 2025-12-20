/**
 * @fileoverview SharePoint 文件提交 API 端點
 * @description
 *   提供外部系統（如 n8n）提交 SharePoint 文件的 API 端點。
 *   支援單一文件和批次文件提交。
 *
 *   ## 認證方式
 *   - Header: `x-api-key: <api-key>`
 *   - Header: `Authorization: Bearer <api-key>`
 *
 *   ## 端點功能
 *   - POST /api/documents/from-sharepoint - 提交 SharePoint 文件
 *   - 支援單一文件和批次提交模式
 *   - 自動檢查城市存取權限
 *   - 自動建立處理隊列
 *
 * @module src/app/api/documents/from-sharepoint/route
 * @author Development Team
 * @since Epic 9 - Story 9.1 (SharePoint 文件監控 API)
 * @lastModified 2025-12-20
 *
 * @features
 *   - SharePoint 文件單一提交
 *   - SharePoint 文件批次提交
 *   - API Key 認證
 *   - 城市存取權限驗證
 *
 * @dependencies
 *   - src/lib/auth/api-key.service.ts - API Key 驗證
 *   - src/services/sharepoint-document.service.ts - 文件提交服務
 *   - src/services/encryption.service.ts - 加密服務
 *   - zod - 請求驗證
 *
 * @related
 *   - src/types/sharepoint.ts - 類型定義
 *   - prisma/schema.prisma - 資料模型
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import {
  ApiKeyService,
  API_KEY_PERMISSIONS,
} from '@/lib/auth/api-key.service';
import { SharePointDocumentService } from '@/services/sharepoint-document.service';
import { EncryptionService } from '@/services/encryption.service';
import type { RequestContext } from '@/types/sharepoint';

// ============================================================
// Validation Schemas
// ============================================================

/**
 * 單一文件提交請求 Schema
 */
const SingleSubmitSchema = z.object({
  sharepointUrl: z
    .string()
    .url('必須是有效的 URL')
    .refine(
      (url) =>
        url.includes('.sharepoint.com') || url.includes('.sharepoint.cn'),
      '必須是 SharePoint URL'
    ),
  cityCode: z
    .string()
    .min(2, '城市代碼至少 2 個字元')
    .max(10, '城市代碼最多 10 個字元'),
  originalFileName: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

/**
 * 批次文件提交請求 Schema
 */
const BatchSubmitSchema = z.object({
  files: z
    .array(SingleSubmitSchema)
    .min(1, '至少需要一個文件')
    .max(50, '單次最多提交 50 個文件'),
});

/**
 * 請求體 Schema（支援單一和批次模式）
 */
const RequestSchema = z.union([
  SingleSubmitSchema,
  BatchSubmitSchema,
]);

// ============================================================
// Helper Functions
// ============================================================

/**
 * 從請求中提取上下文資訊
 */
function extractRequestContext(
  request: NextRequest,
  apiKeyId: string
): RequestContext {
  const forwarded = request.headers.get('x-forwarded-for');
  const ip = forwarded?.split(',')[0]?.trim() || 'unknown';
  const userAgent = request.headers.get('user-agent') || undefined;

  return {
    ip,
    userAgent,
    apiKeyId,
  };
}

/**
 * 檢查是否為批次請求
 */
function isBatchRequest(
  body: unknown
): body is z.infer<typeof BatchSubmitSchema> {
  return (
    typeof body === 'object' &&
    body !== null &&
    'files' in body &&
    Array.isArray((body as { files: unknown }).files)
  );
}

/**
 * 建立錯誤響應（RFC 7807 格式）
 */
function createErrorResponse(
  type: string,
  title: string,
  status: number,
  detail: string,
  instance: string,
  errors?: Record<string, string[]>
): NextResponse {
  return NextResponse.json(
    {
      type: `https://api.example.com/errors/${type}`,
      title,
      status,
      detail,
      instance,
      errors,
    },
    { status }
  );
}

// ============================================================
// API Handler
// ============================================================

/**
 * POST /api/documents/from-sharepoint
 *
 * @description
 *   提交 SharePoint 文件進行處理。
 *   支援單一文件和批次提交模式。
 *
 * @example 單一文件請求
 *   POST /api/documents/from-sharepoint
 *   Headers: { "x-api-key": "your-api-key" }
 *   Body: {
 *     "sharepointUrl": "https://tenant.sharepoint.com/sites/Site/file.pdf",
 *     "cityCode": "TPE"
 *   }
 *
 * @example 批次請求
 *   POST /api/documents/from-sharepoint
 *   Headers: { "x-api-key": "your-api-key" }
 *   Body: {
 *     "files": [
 *       { "sharepointUrl": "...", "cityCode": "TPE" },
 *       { "sharepointUrl": "...", "cityCode": "HKG" }
 *     ]
 *   }
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const instance = '/api/documents/from-sharepoint';

  try {
    // 1. API Key 驗證
    const authResult = await ApiKeyService.verify(request);

    if (!authResult.valid) {
      return createErrorResponse(
        'authentication',
        'Authentication Failed',
        401,
        authResult.error || 'Invalid API key',
        instance
      );
    }

    // 2. 權限檢查
    if (
      !ApiKeyService.checkPermission(
        authResult.permissions,
        API_KEY_PERMISSIONS.SHAREPOINT_SUBMIT
      )
    ) {
      return createErrorResponse(
        'authorization',
        'Insufficient Permissions',
        403,
        '此 API Key 沒有 SharePoint 提交權限',
        instance
      );
    }

    // 3. 解析請求體
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return createErrorResponse(
        'validation',
        'Invalid Request Body',
        400,
        '請求體必須是有效的 JSON',
        instance
      );
    }

    // 4. 驗證請求格式
    const validationResult = RequestSchema.safeParse(body);
    if (!validationResult.success) {
      const errors: Record<string, string[]> = {};
      validationResult.error.issues.forEach((issue) => {
        const path = issue.path.join('.');
        if (!errors[path]) {
          errors[path] = [];
        }
        errors[path].push(issue.message);
      });

      return createErrorResponse(
        'validation',
        'Validation Error',
        400,
        '請求參數驗證失敗',
        instance,
        errors
      );
    }

    // 5. 初始化服務
    const encryptionService = new EncryptionService();
    const sharePointService = new SharePointDocumentService(
      prisma,
      encryptionService
    );

    // 6. 提取請求上下文
    const context = extractRequestContext(request, authResult.keyId!);

    // 7. 處理請求
    if (isBatchRequest(validationResult.data)) {
      // 批次提交模式
      const requests = validationResult.data.files;

      // 檢查城市存取權限
      for (const req of requests) {
        if (!ApiKeyService.checkCityAccess(authResult.cityAccess, req.cityCode)) {
          return createErrorResponse(
            'authorization',
            'City Access Denied',
            403,
            `此 API Key 沒有存取城市 ${req.cityCode} 的權限`,
            instance
          );
        }
      }

      // 執行批次提交
      const batchResult = await sharePointService.submitDocumentsBatch(
        requests,
        context
      );

      return NextResponse.json(
        {
          success: true,
          data: {
            total: batchResult.total,
            successful: batchResult.successful,
            failed: batchResult.failed,
            results: batchResult.results.map((r) => ({
              success: r.success,
              documentId: r.documentId,
              fetchLogId: r.fetchLogId,
              error: r.error
                ? {
                    code: r.error.code,
                    message: r.error.message,
                  }
                : undefined,
            })),
          },
        },
        { status: 200 }
      );
    } else {
      // 單一文件提交模式
      const singleRequest = validationResult.data as z.infer<
        typeof SingleSubmitSchema
      >;

      // 檢查城市存取權限
      if (
        !ApiKeyService.checkCityAccess(
          authResult.cityAccess,
          singleRequest.cityCode
        )
      ) {
        return createErrorResponse(
          'authorization',
          'City Access Denied',
          403,
          `此 API Key 沒有存取城市 ${singleRequest.cityCode} 的權限`,
          instance
        );
      }

      // 執行單一提交
      const result = await sharePointService.submitDocument(
        singleRequest,
        context
      );

      if (!result.success) {
        // 根據錯誤類型返回適當的 HTTP 狀態碼
        const statusCode = getErrorStatusCode(result.error?.code);

        return NextResponse.json(
          {
            success: false,
            error: {
              code: result.error?.code || 'INTERNAL_ERROR',
              message: result.error?.message || '處理失敗',
            },
            fetchLogId: result.fetchLogId,
          },
          { status: statusCode }
        );
      }

      return NextResponse.json(
        {
          success: true,
          data: {
            documentId: result.documentId,
            processingQueueId: result.processingQueueId,
            fetchLogId: result.fetchLogId,
          },
        },
        { status: 201 }
      );
    }
  } catch (error) {
    console.error('SharePoint submit error:', error);

    // 處理加密服務初始化錯誤
    if (error instanceof Error && error.message.includes('ENCRYPTION_KEY')) {
      return createErrorResponse(
        'configuration',
        'Server Configuration Error',
        500,
        '伺服器配置錯誤，請聯繫管理員',
        instance
      );
    }

    return createErrorResponse(
      'internal',
      'Internal Server Error',
      500,
      '伺服器內部錯誤',
      instance
    );
  }
}

/**
 * 根據錯誤代碼返回 HTTP 狀態碼
 */
function getErrorStatusCode(errorCode?: string): number {
  const statusMap: Record<string, number> = {
    FILE_NOT_FOUND: 404,
    ACCESS_DENIED: 403,
    INVALID_FILE_TYPE: 400,
    FILE_TOO_LARGE: 400,
    DUPLICATE_FILE: 409,
    CITY_NOT_FOUND: 404,
    CONFIG_NOT_FOUND: 500,
    AUTH_ERROR: 500,
    INTERNAL_ERROR: 500,
  };

  return statusMap[errorCode || 'INTERNAL_ERROR'] || 500;
}
