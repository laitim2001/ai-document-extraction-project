/**
 * @fileoverview 系統日誌查詢 API
 * @description
 *   提供系統日誌查詢和匯出功能。
 *   支援多條件篩選、分頁和排序。
 *   僅限管理員存取。
 *
 * @module src/app/api/admin/logs/route
 * @author Development Team
 * @since Epic 12 - Story 12-7 (System Log Query)
 * @lastModified 2025-12-21
 *
 * @endpoints
 *   - GET /api/admin/logs - 獲取日誌列表
 *   - POST /api/admin/logs/export - 建立匯出任務
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { logQueryService } from '@/services/logging';
import { LogLevel, LogSource } from '@prisma/client';

// ============================================================
// Validation Schemas
// ============================================================

const querySchema = z.object({
  startTime: z
    .string()
    .optional()
    .transform((v) => (v ? new Date(v) : undefined)),
  endTime: z
    .string()
    .optional()
    .transform((v) => (v ? new Date(v) : undefined)),
  levels: z
    .string()
    .optional()
    .transform((v) => (v ? (v.split(',') as LogLevel[]) : undefined)),
  sources: z
    .string()
    .optional()
    .transform((v) => (v ? (v.split(',') as LogSource[]) : undefined)),
  keyword: z.string().optional(),
  correlationId: z.string().optional(),
  userId: z.string().optional(),
  errorCode: z.string().optional(),
  page: z
    .string()
    .optional()
    .transform((v) => (v ? parseInt(v, 10) : 1)),
  limit: z
    .string()
    .optional()
    .transform((v) => (v ? parseInt(v, 10) : 50)),
  sortBy: z
    .enum(['timestamp', 'level', 'source'])
    .optional()
    .default('timestamp'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

// ============================================================
// Handlers
// ============================================================

/**
 * GET /api/admin/logs
 * 獲取日誌列表
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
      levels: searchParams.get('levels') ?? undefined,
      sources: searchParams.get('sources') ?? undefined,
      keyword: searchParams.get('keyword') ?? undefined,
      correlationId: searchParams.get('correlationId') ?? undefined,
      userId: searchParams.get('userId') ?? undefined,
      errorCode: searchParams.get('errorCode') ?? undefined,
      page: searchParams.get('page') ?? undefined,
      limit: searchParams.get('limit') ?? undefined,
      sortBy: searchParams.get('sortBy') ?? undefined,
      sortOrder: searchParams.get('sortOrder') ?? undefined,
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

    // 建立查詢選項（包含篩選條件）
    const { page, limit, sortOrder } = queryResult.data;
    const offset = (page - 1) * limit;

    // 獲取日誌列表
    const result = await logQueryService.queryLogs({
      filters: {
        startTime: queryResult.data.startTime,
        endTime: queryResult.data.endTime,
        levels: queryResult.data.levels,
        sources: queryResult.data.sources,
        keyword: queryResult.data.keyword,
        correlationId: queryResult.data.correlationId,
        userId: queryResult.data.userId,
        errorCode: queryResult.data.errorCode,
      },
      limit,
      offset,
      orderBy: sortOrder,
    });

    const totalPages = Math.ceil(result.total / limit);

    return NextResponse.json({
      success: true,
      data: result.logs,
      meta: {
        pagination: {
          page,
          limit,
          total: result.total,
          totalPages,
        },
      },
    });
  } catch (error) {
    console.error('Error querying logs:', error);
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
