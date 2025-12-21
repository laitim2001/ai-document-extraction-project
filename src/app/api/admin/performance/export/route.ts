/**
 * @fileoverview Performance Data Export API Route
 * @description
 *   效能數據匯出 API 端點，提供：
 *   - CSV 格式匯出
 *   - JSON 格式匯出
 *
 * @module src/app/api/admin/performance/export/route
 * @since Epic 12 - Story 12-2
 * @lastModified 2025-12-21
 *
 * @endpoints
 *   GET /api/admin/performance/export - 匯出效能數據
 *     Query Params:
 *       - metric: MetricType (必須) - 指標類型
 *       - range: TimeRange - 時間範圍，預設 24h
 *       - format: 'csv' | 'json' - 匯出格式，預設 csv
 *
 * @access ADMIN, SUPER_USER
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { performanceService } from '@/services/performance.service';
import type { TimeRange, MetricType, ExportFormat } from '@/types/performance';

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
 * Valid export formats
 */
const VALID_FORMATS: ExportFormat[] = ['csv', 'json'];

/**
 * GET /api/admin/performance/export
 *
 * 匯出效能數據為 CSV 或 JSON
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
    const format = (searchParams.get('format') || 'csv') as ExportFormat;

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

    // 驗證格式
    if (!VALID_FORMATS.includes(format)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_PARAM',
            message: `Invalid format. Valid values: ${VALID_FORMATS.join(', ')}`,
          },
        },
        { status: 400 }
      );
    }

    // 執行匯出
    const result = await performanceService.export({
      metric,
      timeRange,
      format,
      includeHeaders: true,
    });

    // 設定響應標頭
    const headers = new Headers();
    headers.set('Content-Type', result.mimeType);
    headers.set(
      'Content-Disposition',
      `attachment; filename="${result.filename}"`
    );
    headers.set('X-Record-Count', result.recordCount.toString());

    return new NextResponse(result.content, {
      status: 200,
      headers,
    });
  } catch (error) {
    console.error('[Performance API] Export error:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to export performance data',
        },
      },
      { status: 500 }
    );
  }
}
