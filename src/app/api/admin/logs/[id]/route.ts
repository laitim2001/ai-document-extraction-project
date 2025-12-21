/**
 * @fileoverview 系統日誌詳情 API
 * @description
 *   提供單一日誌詳情查詢功能。
 *   包含完整的日誌資訊、錯誤堆疊和使用者資訊。
 *   僅限管理員存取。
 *
 * @module src/app/api/admin/logs/[id]/route
 * @author Development Team
 * @since Epic 12 - Story 12-7 (System Log Query)
 * @lastModified 2025-12-21
 *
 * @endpoints
 *   - GET /api/admin/logs/:id - 獲取日誌詳情
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { logQueryService } from '@/services/logging';

// ============================================================
// Handlers
// ============================================================

/**
 * GET /api/admin/logs/:id
 * 獲取日誌詳情
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
          detail: '日誌 ID 不能為空',
        },
        { status: 400 }
      );
    }

    // 獲取日誌詳情
    const log = await logQueryService.getLogDetail(id);

    if (!log) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/not-found',
          title: 'Not Found',
          status: 404,
          detail: '日誌不存在',
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: log,
    });
  } catch (error) {
    console.error('Error getting log detail:', error);
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
