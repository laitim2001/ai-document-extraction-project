/**
 * @fileoverview Slowest Endpoints/Queries/Operations API Route
 * @description
 *   最慢分析 API 端點，提供：
 *   - 最慢的 API 端點列表
 *   - 最慢的數據庫查詢列表
 *   - 最慢的 AI 操作列表
 *
 * @module src/app/api/admin/performance/slowest/route
 * @since Epic 12 - Story 12-2
 * @lastModified 2025-12-21
 *
 * @endpoints
 *   GET /api/admin/performance/slowest - 取得最慢分析數據
 *     Query Params:
 *       - type: 'endpoints' | 'queries' | 'operations' | 'all' - 分析類型
 *       - range: TimeRange - 時間範圍，預設 24h
 *       - limit: number - 返回數量限制，預設 10
 *       - cityId: string - 可選的城市 ID 過濾
 *
 * @access ADMIN, SUPER_USER
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { performanceService } from '@/services/performance.service';
import type { TimeRange, SlowestEndpoint, SlowestQuery, SlowestAiOperation } from '@/types/performance';

/**
 * Analysis type
 */
type AnalysisType = 'endpoints' | 'queries' | 'operations' | 'all';

/**
 * Valid time ranges
 */
const VALID_RANGES: TimeRange[] = ['1h', '6h', '24h', '7d', '30d'];

/**
 * Valid analysis types
 */
const VALID_TYPES: AnalysisType[] = ['endpoints', 'queries', 'operations', 'all'];

/**
 * GET /api/admin/performance/slowest
 *
 * 取得最慢的 API 端點、數據庫查詢、AI 操作
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
    const type = (searchParams.get('type') || 'all') as AnalysisType;
    const timeRange = (searchParams.get('range') || '24h') as TimeRange;
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '10', 10), 1), 50);
    const cityId = searchParams.get('cityId') || undefined;

    // 驗證參數
    if (!VALID_TYPES.includes(type)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_PARAM',
            message: `Invalid type. Valid values: ${VALID_TYPES.join(', ')}`,
          },
        },
        { status: 400 }
      );
    }

    if (!VALID_RANGES.includes(timeRange)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_PARAM',
            message: `Invalid time range. Valid values: ${VALID_RANGES.join(', ')}`,
          },
        },
        { status: 400 }
      );
    }

    // 根據類型取得數據
    const result: {
      endpoints?: SlowestEndpoint[];
      queries?: SlowestQuery[];
      operations?: SlowestAiOperation[];
    } = {};

    const fetchPromises: Promise<void>[] = [];

    if (type === 'endpoints' || type === 'all') {
      fetchPromises.push(
        performanceService
          .getSlowestEndpoints(timeRange, limit, cityId)
          .then((data) => {
            result.endpoints = data;
          })
      );
    }

    if (type === 'queries' || type === 'all') {
      fetchPromises.push(
        performanceService.getSlowestQueries(timeRange, limit).then((data) => {
          result.queries = data;
        })
      );
    }

    if (type === 'operations' || type === 'all') {
      fetchPromises.push(
        performanceService
          .getSlowestAiOperations(timeRange, limit, cityId)
          .then((data) => {
            result.operations = data;
          })
      );
    }

    await Promise.all(fetchPromises);

    return NextResponse.json(
      {
        success: true,
        data: result,
        timeRange,
        generatedAt: new Date().toISOString(),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[Performance API] Get slowest analysis error:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to get slowest analysis data',
        },
      },
      { status: 500 }
    );
  }
}
