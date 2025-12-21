/**
 * @fileoverview 系統日誌匯出狀態 API
 * @description
 *   提供日誌匯出任務狀態查詢和下載功能。
 *   僅限管理員存取。
 *
 * @module src/app/api/admin/logs/export/[id]/route
 * @author Development Team
 * @since Epic 12 - Story 12-7 (System Log Query)
 * @lastModified 2025-12-21
 *
 * @endpoints
 *   - GET /api/admin/logs/export/:id - 獲取匯出狀態/下載檔案
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { logQueryService } from '@/services/logging';

// ============================================================
// Handlers
// ============================================================

/**
 * GET /api/admin/logs/export/:id
 * 獲取匯出狀態或下載檔案
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 驗證權限
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/unauthorized',
          title: 'Unauthorized',
          status: 401,
          detail: '需要登入',
        },
        { status: 401 }
      );
    }

    // 檢查管理員權限
    const isAdmin =
      session.user.isGlobalAdmin || session.user.roles?.some((r) => r.name === 'GLOBAL_ADMIN');
    if (!isAdmin) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/forbidden',
          title: 'Forbidden',
          status: 403,
          detail: '需要管理員權限',
        },
        { status: 403 }
      );
    }

    const { id } = await params;

    // 驗證 ID
    if (!id || id.trim() === '') {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/validation',
          title: 'Validation Error',
          status: 400,
          detail: '匯出 ID 不能為空',
        },
        { status: 400 }
      );
    }

    // 檢查是否請求下載
    const searchParams = request.nextUrl.searchParams;
    const download = searchParams.get('download') === 'true';

    // 獲取匯出狀態
    const exportStatus = await logQueryService.getExportStatus(id);

    if (!exportStatus) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/not-found',
          title: 'Not Found',
          status: 404,
          detail: '匯出任務不存在',
        },
        { status: 404 }
      );
    }

    // 如果請求下載且匯出完成
    if (download && exportStatus.status === 'COMPLETED' && exportStatus.filePath) {
      // 實際場景中應該從檔案系統或雲端儲存讀取檔案
      // 這裡返回下載 URL 作為示範
      return NextResponse.json({
        success: true,
        data: {
          downloadUrl: exportStatus.downloadUrl,
          fileName: exportStatus.fileName,
          expiresAt: exportStatus.expiresAt?.toISOString(),
        },
      });
    }

    // 返回狀態資訊
    return NextResponse.json({
      success: true,
      data: {
        id: exportStatus.id,
        format: exportStatus.format,
        status: exportStatus.status,
        progress: exportStatus.progress,
        totalRecords: exportStatus.totalRecords,
        processedRecords: exportStatus.processedRecords,
        fileSize: exportStatus.fileSize,
        createdAt: exportStatus.createdAt.toISOString(),
        completedAt: exportStatus.completedAt?.toISOString(),
        error: exportStatus.error,
      },
    });
  } catch (error) {
    console.error('Error getting export status:', error);
    return NextResponse.json(
      {
        type: 'https://api.example.com/errors/internal',
        title: 'Internal Server Error',
        status: 500,
        detail: error instanceof Error ? error.message : '伺服器內部錯誤',
      },
      { status: 500 }
    );
  }
}
