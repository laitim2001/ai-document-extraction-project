/**
 * @fileoverview Outlook 提交狀態查詢 API 端點
 * @description
 *   查詢 Outlook 郵件附件提交的處理狀態。
 *   提供獲取日誌的詳細資訊，包含各附件的處理進度。
 *
 *   ## 認證方式
 *   - Header: `x-api-key: <api-key>`
 *   - Header: `Authorization: Bearer <api-key>`
 *
 *   ## 端點功能
 *   - GET /api/documents/from-outlook/status/:fetchLogId - 查詢提交狀態
 *   - 返回獲取日誌的詳細資訊
 *   - 包含關聯文件的處理進度
 *
 * @module src/app/api/documents/from-outlook/status/[fetchLogId]/route
 * @author Development Team
 * @since Epic 9 - Story 9.3 (Outlook 郵件附件提取 API)
 * @lastModified 2025-12-20
 *
 * @features
 *   - 提交狀態查詢
 *   - 文件處理進度追蹤
 *   - API Key 認證
 *   - 城市存取權限驗證
 *
 * @dependencies
 *   - src/lib/auth/api-key.service.ts - API Key 驗證
 *   - @prisma/client - 資料庫操作
 *
 * @related
 *   - src/types/outlook.ts - 類型定義
 *   - src/app/api/documents/from-outlook/route.ts - 提交端點
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  ApiKeyService,
  API_KEY_PERMISSIONS,
} from '@/lib/auth/api-key.service';
import type { OutlookFetchLogDetail } from '@/types/outlook';

// ============================================================
// Types
// ============================================================

interface RouteParams {
  params: Promise<{ fetchLogId: string }>;
}

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
  instance: string
): NextResponse {
  return NextResponse.json(
    {
      type: `https://api.example.com/errors/${type}`,
      title,
      status,
      detail,
      instance,
    },
    { status }
  );
}

// ============================================================
// API Handler
// ============================================================

/**
 * GET /api/documents/from-outlook/status/:fetchLogId
 *
 * @description
 *   查詢 Outlook 郵件附件提交的處理狀態。
 *   返回獲取日誌的詳細資訊，包含各附件的處理進度。
 *
 * @example
 *   GET /api/documents/from-outlook/status/clr7xq2gh0001...
 *   Headers: { "x-api-key": "your-api-key" }
 *
 *   Response:
 *   {
 *     "success": true,
 *     "data": {
 *       "id": "clr7xq2gh0001...",
 *       "status": "COMPLETED",
 *       "subject": "Invoice October 2024",
 *       "senderEmail": "vendor@example.com",
 *       "summary": { "total": 2, "processed": 2, "skipped": 0 },
 *       "documents": [...]
 *     }
 *   }
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  const { fetchLogId } = await params;
  const instance = `/api/documents/from-outlook/status/${fetchLogId}`;

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
        API_KEY_PERMISSIONS.OUTLOOK_STATUS
      )
    ) {
      return createErrorResponse(
        'authorization',
        'Insufficient Permissions',
        403,
        '此 API Key 沒有 Outlook 狀態查詢權限',
        instance
      );
    }

    // 3. 查詢獲取日誌
    const fetchLog = await prisma.outlookFetchLog.findUnique({
      where: { id: fetchLogId },
      include: {
        city: { select: { code: true } },
      },
    });

    if (!fetchLog) {
      return createErrorResponse(
        'not-found',
        'Fetch Log Not Found',
        404,
        '找不到獲取記錄',
        instance
      );
    }

    // 4. 檢查城市存取權限
    if (!ApiKeyService.checkCityAccess(authResult.cityAccess, fetchLog.city.code)) {
      return createErrorResponse(
        'authorization',
        'City Access Denied',
        403,
        '無權限存取此記錄',
        instance
      );
    }

    // 5. 獲取關聯的文件處理狀態
    const documents =
      fetchLog.documentIds.length > 0
        ? await prisma.document.findMany({
            where: { id: { in: fetchLog.documentIds } },
            select: {
              id: true,
              fileName: true,
              status: true,
            },
          })
        : [];

    // 獲取處理隊列狀態
    const processingQueues =
      fetchLog.documentIds.length > 0
        ? await prisma.processingQueue.findMany({
            where: { documentId: { in: fetchLog.documentIds } },
            select: {
              id: true,
              documentId: true,
              status: true,
            },
          })
        : [];

    // 建立文件 ID 到處理隊列的映射
    const queueByDocId = new Map(
      processingQueues.map((q) => [q.documentId, q])
    );

    // 6. 組裝響應
    const responseData: OutlookFetchLogDetail = {
      id: fetchLog.id,
      status: fetchLog.status,
      subject: fetchLog.subject,
      senderEmail: fetchLog.senderEmail,
      senderName: fetchLog.senderName,
      receivedAt: fetchLog.receivedAt.toISOString(),
      summary: {
        total: fetchLog.totalAttachments,
        processed: fetchLog.validAttachments,
        skipped: fetchLog.skippedAttachments,
      },
      documents: documents.map((doc) => {
        const queue = queueByDocId.get(doc.id);
        return {
          id: doc.id,
          fileName: doc.fileName,
          status: doc.status,
          processingJobId: queue?.id,
          processingStatus: queue?.status,
        };
      }),
      skippedFiles: fetchLog.skippedFiles,
      error: fetchLog.errorCode
        ? {
            code: fetchLog.errorCode,
            message: fetchLog.errorMessage,
          }
        : null,
      createdAt: fetchLog.createdAt.toISOString(),
      completedAt: fetchLog.completedAt?.toISOString() || null,
    };

    return NextResponse.json({
      success: true,
      data: responseData,
    });
  } catch (error) {
    console.error('Fetch status error:', error);

    return createErrorResponse(
      'internal',
      'Internal Server Error',
      500,
      '伺服器內部錯誤',
      instance
    );
  }
}
