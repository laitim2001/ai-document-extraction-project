/**
 * @fileoverview Outlook 郵件附件提交 API 端點
 * @description
 *   提供外部系統（如 n8n）提交 Outlook 郵件附件的 API 端點。
 *   支援兩種模式：
 *   - MESSAGE_ID: 透過郵件 ID 讓系統自動獲取附件
 *   - DIRECT_UPLOAD: 直接上傳附件內容（Base64 編碼）
 *
 *   ## 認證方式
 *   - Header: `x-api-key: <api-key>`
 *   - Header: `Authorization: Bearer <api-key>`
 *
 *   ## 端點功能
 *   - POST /api/documents/from-outlook - 提交郵件附件
 *   - 自動檢查城市存取權限
 *   - 自動套用過濾規則
 *   - 自動建立處理隊列
 *
 * @module src/app/api/documents/from-outlook/route
 * @author Development Team
 * @since Epic 9 - Story 9.3 (Outlook 郵件附件提取 API)
 * @lastModified 2025-12-20
 *
 * @features
 *   - Outlook 郵件附件提交（MESSAGE_ID 模式）
 *   - 直接附件上傳（DIRECT_UPLOAD 模式）
 *   - API Key 認證
 *   - 城市存取權限驗證
 *   - 過濾規則驗證
 *
 * @dependencies
 *   - src/lib/auth/api-key.service.ts - API Key 驗證
 *   - src/services/outlook-document.service.ts - 文件提交服務
 *   - src/services/encryption.service.ts - 加密服務
 *   - zod - 請求驗證
 *
 * @related
 *   - src/types/outlook.ts - 類型定義
 *   - prisma/schema.prisma - 資料模型
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import {
  ApiKeyService,
  API_KEY_PERMISSIONS,
} from '@/lib/auth/api-key.service';
import { OutlookDocumentService } from '@/services/outlook-document.service';
import { EncryptionService } from '@/services/encryption.service';
import { OUTLOOK_ERROR_STATUS_CODES, type OutlookErrorCode } from '@/types/outlook';

// ============================================================
// Validation Schemas
// ============================================================

/**
 * 直接上傳附件 Schema
 */
const DirectAttachmentSchema = z.object({
  fileName: z.string().min(1, '檔名為必填'),
  contentType: z.string().min(1, '內容類型為必填'),
  contentBase64: z.string().min(1, 'Base64 內容為必填'),
});

/**
 * 提交請求 Schema
 */
const SubmitSchema = z
  .object({
    // 方式一：使用 Message ID
    messageId: z.string().optional(),

    // 方式二：直接上傳附件
    attachments: z.array(DirectAttachmentSchema).optional(),

    // 共用欄位
    cityCode: z
      .string()
      .min(2, '城市代碼至少 2 個字元')
      .max(10, '城市代碼最多 10 個字元'),
    senderEmail: z.string().email('請輸入有效的寄件者 Email'),
    senderName: z.string().optional(),
    subject: z.string().min(1, '郵件主旨為必填'),
    receivedAt: z.string().optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .refine(
    (data) => data.messageId || (data.attachments && data.attachments.length > 0),
    { message: '必須提供 messageId 或 attachments' }
  );

// ============================================================
// Helper Functions
// ============================================================

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
 * POST /api/documents/from-outlook
 *
 * @description
 *   提交 Outlook 郵件附件進行處理。
 *   支援兩種模式：
 *   - MESSAGE_ID: 提供郵件 ID，系統自動從 Outlook 獲取附件
 *   - DIRECT_UPLOAD: 直接上傳附件內容（n8n 預處理）
 *
 * @example MESSAGE_ID 模式
 *   POST /api/documents/from-outlook
 *   Headers: { "x-api-key": "your-api-key" }
 *   Body: {
 *     "messageId": "AAMkAGI2...",
 *     "cityCode": "TPE",
 *     "senderEmail": "vendor@example.com",
 *     "subject": "Invoice October 2024"
 *   }
 *
 * @example DIRECT_UPLOAD 模式
 *   POST /api/documents/from-outlook
 *   Headers: { "x-api-key": "your-api-key" }
 *   Body: {
 *     "cityCode": "TPE",
 *     "senderEmail": "vendor@example.com",
 *     "subject": "Invoice October 2024",
 *     "attachments": [
 *       { "fileName": "invoice.pdf", "contentType": "application/pdf", "contentBase64": "JVBERi0..." }
 *     ]
 *   }
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const instance = '/api/documents/from-outlook';

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
        API_KEY_PERMISSIONS.OUTLOOK_SUBMIT
      )
    ) {
      return createErrorResponse(
        'authorization',
        'Insufficient Permissions',
        403,
        '此 API Key 沒有 Outlook 提交權限',
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
    const validationResult = SubmitSchema.safeParse(body);
    if (!validationResult.success) {
      const errors: Record<string, string[]> = {};
      validationResult.error.issues.forEach((issue) => {
        const path = issue.path.join('.') || '_root';
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

    const validatedData = validationResult.data;

    // 5. 檢查城市存取權限
    if (!ApiKeyService.checkCityAccess(authResult.cityAccess, validatedData.cityCode)) {
      return createErrorResponse(
        'authorization',
        'City Access Denied',
        403,
        `此 API Key 沒有存取城市 ${validatedData.cityCode} 的權限`,
        instance
      );
    }

    // 6. 初始化服務
    const encryptionService = new EncryptionService();
    const outlookService = new OutlookDocumentService(prisma, encryptionService);

    // 7. 提取請求上下文
    const forwarded = request.headers.get('x-forwarded-for');
    const context = {
      ip: forwarded?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown',
      userAgent: request.headers.get('user-agent') || undefined,
      apiKeyId: authResult.keyId,
    };

    // 8. 執行提交
    const result = await outlookService.submitMailAttachments(validatedData, context);

    // 9. 返回結果
    if (result.success || result.processedCount > 0) {
      return NextResponse.json({
        success: true,
        data: {
          fetchLogId: result.fetchLogId,
          summary: {
            total: result.totalAttachments,
            processed: result.processedCount,
            skipped: result.skippedCount,
            failed: result.failedCount,
          },
          results: result.results.map((r) => ({
            fileName: r.fileName,
            status: r.status,
            documentId: r.documentId,
            processingJobId: r.processingJobId,
            reason: r.skipReason || r.error,
          })),
        },
      });
    }

    // 處理失敗
    const statusCode =
      OUTLOOK_ERROR_STATUS_CODES[result.error?.code as OutlookErrorCode] || 500;

    return NextResponse.json(
      {
        success: false,
        error: result.error,
        fetchLogId: result.fetchLogId,
      },
      { status: statusCode }
    );
  } catch (error) {
    console.error('Outlook submit error:', error);

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
