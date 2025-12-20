/**
 * @fileoverview SharePoint 獲取狀態查詢 API 端點
 * @description
 *   提供外部系統查詢 SharePoint 文件獲取狀態的 API 端點。
 *   透過 fetchLogId 查詢特定獲取任務的處理狀態。
 *
 *   ## 認證方式
 *   - Header: `x-api-key: <api-key>`
 *   - Header: `Authorization: Bearer <api-key>`
 *
 *   ## 狀態說明
 *   - PENDING: 等待處理
 *   - DOWNLOADING: 正在從 SharePoint 下載
 *   - PROCESSING: 正在處理（上傳、建立記錄）
 *   - COMPLETED: 處理完成
 *   - FAILED: 處理失敗
 *   - DUPLICATE: 重複文件
 *
 * @module src/app/api/documents/from-sharepoint/status/[fetchLogId]/route
 * @author Development Team
 * @since Epic 9 - Story 9.1 (SharePoint 文件監控 API)
 * @lastModified 2025-12-20
 *
 * @features
 *   - 獲取狀態查詢
 *   - 錯誤詳情返回
 *   - 文件關聯資訊
 *
 * @dependencies
 *   - src/lib/auth/api-key.service.ts - API Key 驗證
 *   - @prisma/client - 資料庫操作
 *
 * @related
 *   - src/app/api/documents/from-sharepoint/route.ts - 文件提交端點
 *   - prisma/schema.prisma - SharePointFetchLog 模型
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  ApiKeyService,
  API_KEY_PERMISSIONS,
} from '@/lib/auth/api-key.service';

// ============================================================
// Types
// ============================================================

interface RouteParams {
  params: Promise<{
    fetchLogId: string;
  }>;
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
 * GET /api/documents/from-sharepoint/status/[fetchLogId]
 *
 * @description
 *   查詢 SharePoint 文件獲取狀態。
 *
 * @example
 *   GET /api/documents/from-sharepoint/status/clxxx123
 *   Headers: { "x-api-key": "your-api-key" }
 *
 * @returns
 *   {
 *     "success": true,
 *     "data": {
 *       "fetchLogId": "clxxx123",
 *       "status": "COMPLETED",
 *       "fileName": "invoice.pdf",
 *       "documentId": "clyyy456",
 *       "createdAt": "2025-01-01T00:00:00Z",
 *       "completedAt": "2025-01-01T00:01:00Z"
 *     }
 *   }
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  const { fetchLogId } = await params;
  const instance = `/api/documents/from-sharepoint/status/${fetchLogId}`;

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
        API_KEY_PERMISSIONS.SHAREPOINT_STATUS
      )
    ) {
      return createErrorResponse(
        'authorization',
        'Insufficient Permissions',
        403,
        '此 API Key 沒有查詢狀態的權限',
        instance
      );
    }

    // 3. 驗證 fetchLogId 格式
    if (!fetchLogId || fetchLogId.length < 10) {
      return createErrorResponse(
        'validation',
        'Invalid Parameter',
        400,
        'fetchLogId 格式無效',
        instance
      );
    }

    // 4. 查詢獲取日誌
    const fetchLog = await prisma.sharePointFetchLog.findUnique({
      where: { id: fetchLogId },
      include: {
        city: {
          select: {
            code: true,
            name: true,
          },
        },
        document: {
          select: {
            id: true,
            fileName: true,
            status: true,
          },
        },
      },
    });

    if (!fetchLog) {
      return createErrorResponse(
        'not_found',
        'Fetch Log Not Found',
        404,
        `找不到獲取日誌: ${fetchLogId}`,
        instance
      );
    }

    // 5. 檢查城市存取權限
    if (
      !ApiKeyService.checkCityAccess(authResult.cityAccess, fetchLog.city.code)
    ) {
      return createErrorResponse(
        'authorization',
        'City Access Denied',
        403,
        '此 API Key 沒有存取此城市的權限',
        instance
      );
    }

    // 6. 構建響應
    const response = {
      success: true,
      data: {
        fetchLogId: fetchLog.id,
        status: fetchLog.status,
        fileName: fetchLog.fileName,
        sharepointUrl: fetchLog.sharepointUrl,
        city: {
          code: fetchLog.city.code,
          name: fetchLog.city.name,
        },
        documentId: fetchLog.documentId,
        document: fetchLog.document
          ? {
              id: fetchLog.document.id,
              fileName: fetchLog.document.fileName,
              status: fetchLog.document.status,
            }
          : null,
        error:
          fetchLog.status === 'FAILED'
            ? {
                code: fetchLog.errorCode,
                message: fetchLog.errorMessage,
              }
            : null,
        createdAt: fetchLog.createdAt.toISOString(),
        completedAt: fetchLog.completedAt?.toISOString() || null,
      },
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error('SharePoint status query error:', error);

    return createErrorResponse(
      'internal',
      'Internal Server Error',
      500,
      '伺服器內部錯誤',
      instance
    );
  }
}
