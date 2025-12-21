/**
 * @fileoverview Performance Time Series API Route
 * @description
 *   效能時間序列 API 端點，提供：
 *   - API 回應時間趨勢
 *   - 數據庫查詢時間趨勢
 *   - AI 處理時間趨勢
 *   - CPU 使用率趨勢
 *   - 記憶體使用率趨勢
 *
 * @module src/app/api/admin/performance/timeseries/route
 * @since Epic 12 - Story 12-2
 * @lastModified 2025-12-21
 *
 * @endpoints
 *   GET /api/admin/performance/timeseries - 取得時間序列數據
 *     Query Params:
 *       - metric: MetricType (必須) - 指標類型
 *       - range: TimeRange - 時間範圍，預設 24h
 *       - endpoint: string - 可選的 API 端點過濾
 *       - cityId: string - 可選的城市 ID 過濾
 *
 * @access ADMIN, SUPER_USER
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { performanceService } from '@/services/performance.service';
import type { TimeRange, MetricType } from '@/types/performance';

/**
 * Valid metric types
 */
const VALID_METRICS: MetricType[] = [
  'api_response_time',
  'db_query_time',
  'ai_processing_time',
  'cpu_usage',
  'memory_usage',
];

/**
 * Valid time ranges
 */
const VALID_RANGES: TimeRange[] = ['1h', '6h', '24h', '7d', '30d'];

/**
 * GET /api/admin/performance/timeseries
 *
 * 取得效能指標時間序列數據
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
    const metric = searchParams.get('metric') as MetricType;
    const timeRange = (searchParams.get('range') || '24h') as TimeRange;
    const endpoint = searchParams.get('endpoint') || undefined;
    const cityId = searchParams.get('cityId') || undefined;

    // 驗證必要參數
    if (!metric || !VALID_METRICS.includes(metric)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_PARAM',
            message: `Valid metric parameter is required. Valid values: ${VALID_METRICS.join(', ')}`,
          },
        },
        { status: 400 }
      );
    }

    // 驗證時間範圍
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

    // 取得時間序列數據
    const timeSeries = await performanceService.getTimeSeries(metric, timeRange, {
      endpoint,
      cityId,
    });

    return NextResponse.json(
      {
        success: true,
        data: timeSeries.data,
        metric: timeSeries.metric,
        timeRange: timeSeries.timeRange,
        thresholds: timeSeries.thresholds,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[Performance API] Get time series error:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to get time series data',
        },
      },
      { status: 500 }
    );
  }
}
