/**
 * @fileoverview 系統日誌統計 API
 * @description
 *   提供日誌統計資訊查詢功能。
 *   包含各級別、來源的日誌數量分佈。
 *   僅限管理員存取。
 *
 * @module src/app/api/admin/logs/stats/route
 * @author Development Team
 * @since Epic 12 - Story 12-7 (System Log Query)
 * @lastModified 2025-12-21
 *
 * @endpoints
 *   - GET /api/admin/logs/stats - 獲取日誌統計
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { logQueryService } from '@/services/logging';

// ============================================================
// Validation Schemas
// ============================================================

const querySchema = z.object({
  startTime: z
    .string()
    .optional()
    .transform((v) => (v ? new Date(v) : new Date(Date.now() - 24 * 60 * 60 * 1000))), // 預設過去 24 小時
  endTime: z
    .string()
    .optional()
    .transform((v) => (v ? new Date(v) : new Date())),
});

// ============================================================
// Handlers
// ============================================================

/**
 * GET /api/admin/logs/stats
 * 獲取日誌統計
 */
export async function GET(request: NextRequest) {
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

    // 解析查詢參數
    const searchParams = request.nextUrl.searchParams;
    const queryResult = querySchema.safeParse({
      startTime: searchParams.get('startTime') ?? undefined,
      endTime: searchParams.get('endTime') ?? undefined,
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

    // 獲取日誌統計
    const stats = await logQueryService.getLogStats({
      startTime: queryResult.data.startTime,
      endTime: queryResult.data.endTime,
    });

    return NextResponse.json({
      success: true,
      data: stats,
      meta: {
        timeRange: {
          start: queryResult.data.startTime.toISOString(),
          end: queryResult.data.endTime.toISOString(),
        },
      },
    });
  } catch (error) {
    console.error('Error getting log stats:', error);
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
