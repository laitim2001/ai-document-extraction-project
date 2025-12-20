/**
 * @fileoverview n8n 狀態變化記錄 API
 * @description
 *   提供 n8n 連線狀態變化記錄查詢功能。
 *   僅限管理員存取。
 *
 * @module src/app/api/admin/n8n-health/changes/route
 * @author Development Team
 * @since Epic 10 - Story 10.7 (n8n Connection Status Monitoring)
 * @lastModified 2025-12-20
 *
 * @endpoints
 *   - GET /api/admin/n8n-health/changes - 獲取狀態變化記錄
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
  limit: z
    .string()
    .optional()
    .transform((v) => (v ? parseInt(v, 10) : 20)),
  startDate: z
    .string()
    .optional()
    .transform((v) => (v ? new Date(v) : undefined)),
});

// ============================================================
// Handlers
// ============================================================

/**
 * GET /api/admin/n8n-health/changes
 * 獲取狀態變化記錄
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
      limit: searchParams.get('limit') ?? undefined,
      startDate: searchParams.get('startDate') ?? undefined,
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

    // 獲取狀態變化記錄
    const result = await n8nHealthService.getStatusChanges(queryResult.data);

    // 格式化響應
    const items = result.map((change) => ({
      previousStatus: change.previousStatus ?? null,
      previousStatusText: change.previousStatus
        ? getHealthStatusText(change.previousStatus)
        : null,
      newStatus: change.newStatus,
      newStatusText: getHealthStatusText(change.newStatus),
      reason: change.reason ?? null,
      changedAt: change.changedAt.toISOString(),
      cityCode: change.cityCode ?? null,
      cityName: change.cityName ?? null,
      responseTimeMs: change.responseTimeMs ?? null,
    }));

    return NextResponse.json({
      success: true,
      data: {
        items,
      },
    });
  } catch (error) {
    console.error('Error getting status changes:', error);
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
