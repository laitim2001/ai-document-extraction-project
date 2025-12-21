/**
 * @fileoverview 關聯日誌查詢 API
 * @description
 *   根據 correlationId 獲取關聯日誌列表。
 *   用於追蹤同一請求或操作的完整日誌鏈。
 *   僅限管理員存取。
 *
 * @module src/app/api/admin/logs/[id]/related/route
 * @author Development Team
 * @since Epic 12 - Story 12-7 (System Log Query)
 * @lastModified 2025-12-21
 *
 * @endpoints
 *   - GET /api/admin/logs/:id/related - 獲取關聯日誌
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { logQueryService } from '@/services/logging';

// ============================================================
// Validation Schemas
// ============================================================

const querySchema = z.object({
  limit: z
    .string()
    .optional()
    .transform((v) => (v ? parseInt(v, 10) : 100)),
});

// ============================================================
// Handlers
// ============================================================

/**
 * GET /api/admin/logs/:id/related
 * 獲取關聯日誌
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

    // 解析查詢參數
    const searchParams = request.nextUrl.searchParams;
    const queryResult = querySchema.safeParse({
      limit: searchParams.get('limit') ?? undefined,
    });

    if (!queryResult.success) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/validation',
          title: 'Validation Error',
          status: 400,
          detail: '查詢參數驗證失敗',
          errors: queryResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    // 獲取關聯日誌
    const relatedLogs = await logQueryService.getRelatedLogs(id, queryResult.data.limit);

    return NextResponse.json({
      success: true,
      data: relatedLogs,
      meta: {
        total: relatedLogs.length,
      },
    });
  } catch (error) {
    console.error('Error getting related logs:', error);
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
