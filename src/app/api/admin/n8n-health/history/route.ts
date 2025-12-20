/**
 * @fileoverview n8n 健康歷史記錄 API
 * @description
 *   提供 n8n 連線健康歷史記錄查詢功能。
 *   僅限管理員存取。
 *
 * @module src/app/api/admin/n8n-health/history/route
 * @author Development Team
 * @since Epic 10 - Story 10.7 (n8n Connection Status Monitoring)
 * @lastModified 2025-12-20
 *
 * @endpoints
 *   - GET /api/admin/n8n-health/history - 獲取健康歷史記錄
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { n8nHealthService } from '@/services/n8n';
import { getHealthStatusText } from '@/types/health-monitoring';

// ============================================================
// Validation Schemas
// ============================================================

const querySchema = z.object({
  cityCode: z.string().optional(),
  page: z
    .string()
    .optional()
    .transform((v) => (v ? parseInt(v, 10) : 1)),
  pageSize: z
    .string()
    .optional()
    .transform((v) => (v ? parseInt(v, 10) : 20)),
  startDate: z
    .string()
    .optional()
    .transform((v) => (v ? new Date(v) : undefined)),
  endDate: z
    .string()
    .optional()
    .transform((v) => (v ? new Date(v) : undefined)),
  status: z.enum(['HEALTHY', 'DEGRADED', 'UNHEALTHY', 'UNKNOWN', 'UNCONFIGURED']).optional(),
});

// ============================================================
// Handlers
// ============================================================

/**
 * GET /api/admin/n8n-health/history
 * 獲取健康歷史記錄
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
      cityCode: searchParams.get('cityCode') ?? undefined,
      page: searchParams.get('page') ?? undefined,
      pageSize: searchParams.get('pageSize') ?? undefined,
      startDate: searchParams.get('startDate') ?? undefined,
      endDate: searchParams.get('endDate') ?? undefined,
      status: searchParams.get('status') ?? undefined,
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

    const { page, pageSize, ...params } = queryResult.data;
    const limit = pageSize;

    // 獲取健康歷史
    const result = await n8nHealthService.getHealthHistory({
      ...params,
      limit,
    });

    // 格式化響應
    const items = result.map((entry) => ({
      status: entry.status,
      statusText: getHealthStatusText(entry.status),
      message: entry.message ?? null,
      responseTimeMs: entry.responseTimeMs ?? null,
      httpStatus: entry.httpStatus ?? null,
      createdAt: entry.createdAt.toISOString(),
      cityCode: entry.cityCode ?? null,
    }));

    return NextResponse.json({
      success: true,
      data: {
        items,
        pagination: {
          page,
          pageSize,
          total: items.length,
          totalPages: Math.ceil(items.length / pageSize),
        },
      },
    });
  } catch (error) {
    console.error('Error getting health history:', error);
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
