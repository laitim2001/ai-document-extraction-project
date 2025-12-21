/**
 * @fileoverview Performance Overview API Route
 * @description
 *   效能概覽 API 端點，提供：
 *   - API 回應時間統計（P50/P95/P99）
 *   - 數據庫查詢時間統計
 *   - AI 服務效能統計
 *   - 系統資源使用率統計
 *
 * @module src/app/api/admin/performance/route
 * @since Epic 12 - Story 12-2
 * @lastModified 2025-12-21
 *
 * @endpoints
 *   GET /api/admin/performance - 取得效能概覽
 *     Query Params:
 *       - range: TimeRange (1h|6h|24h|7d|30d) - 時間範圍，預設 24h
 *       - cityId: string - 可選的城市 ID 過濾
 *
 * @access ADMIN, SUPER_USER
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { performanceService } from '@/services/performance.service';
import type { TimeRange } from '@/types/performance';

/**
 * GET /api/admin/performance
 *
 * 取得效能概覽統計數據
 */
export async function GET(request: NextRequest) {
  try {
    // 認證檢查
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: '需要登入',
          },
        },
        { status: 401 }
      );
    }

    // 檢查管理員權限（ADMIN 或 SUPER_USER）
    const isAdmin =
      session.user.isGlobalAdmin ||
      session.user.roles?.some((r) => ['GLOBAL_ADMIN', 'ADMIN', 'SUPER_USER'].includes(r.name));
    if (!isAdmin) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: '需要管理員權限',
          },
        },
        { status: 403 }
      );
    }

    // 取得參數
    const searchParams = request.nextUrl.searchParams;
    const timeRange = (searchParams.get('range') || '24h') as TimeRange;
    const cityId = searchParams.get('cityId') || undefined;

    // 驗證時間範圍
    const validRanges: TimeRange[] = ['1h', '6h', '24h', '7d', '30d'];
    if (!validRanges.includes(timeRange)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_PARAM',
            message: 'Invalid time range. Valid values: 1h, 6h, 24h, 7d, 30d',
          },
        },
        { status: 400 }
      );
    }

    // 取得效能概覽
    const overview = await performanceService.getOverview(timeRange, cityId);

    return NextResponse.json(
      {
        success: true,
        data: overview,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[Performance API] Get overview error:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to get performance data',
        },
      },
      { status: 500 }
    );
  }
}
