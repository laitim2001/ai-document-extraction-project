/**
 * @fileoverview 處理統計 API
 * @description
 *   提供城市處理量聚合統計數據：
 *   - 支援多種時間粒度（小時/日/週/月/年）
 *   - 城市數據隔離
 *   - 快取優化
 *
 * @module src/app/api/statistics/processing
 * @since Epic 7 - Story 7.7 (城市處理數量追蹤)
 * @lastModified 2025-12-19
 *
 * @features
 *   - AC2: 時間維度聚合（日/週/月/年）
 *   - 5 分鐘快取
 *   - 城市數據隔離
 *
 * @dependencies
 *   - @/middleware/city-filter - 城市過濾中間件
 *   - @/services/processing-stats.service - 處理統計服務
 *   - zod - 請求驗證
 *
 * @related
 *   - src/types/processing-statistics.ts - 類型定義
 *   - src/services/processing-stats.service.ts - 服務層
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import {
  withCityFilter,
  CityFilterContext,
  extractCitiesFromRequest,
  validateRequestedCities,
} from '@/middleware/city-filter'
import { processingStatsService } from '@/services/processing-stats.service'
import type {
  AggregatedStatsResponse,
  TimeGranularity,
} from '@/types/processing-statistics'

// ============================================================
// Validation Schema
// ============================================================

/**
 * 有效的時間粒度
 */
const validGranularities: TimeGranularity[] = ['hour', 'day', 'week', 'month', 'year']

/**
 * 查詢參數驗證 Schema
 */
const querySchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  granularity: z.enum(['hour', 'day', 'week', 'month', 'year']).optional().default('day'),
  cities: z.string().optional(),
})

// ============================================================
// Helper Functions
// ============================================================

/**
 * 驗證並解析日期
 */
function parseDate(dateStr: string | undefined, defaultDate: Date): Date {
  if (!dateStr) return defaultDate
  const parsed = new Date(dateStr)
  return isNaN(parsed.getTime()) ? defaultDate : parsed
}

/**
 * 獲取預設開始日期（30 天前）
 */
function getDefaultStartDate(): Date {
  const date = new Date()
  date.setDate(date.getDate() - 30)
  date.setHours(0, 0, 0, 0)
  return date
}

/**
 * 獲取預設結束日期（今天結束）
 */
function getDefaultEndDate(): Date {
  const date = new Date()
  date.setHours(23, 59, 59, 999)
  return date
}

// ============================================================
// Route Handler
// ============================================================

/**
 * GET /api/statistics/processing
 *
 * @description
 *   獲取處理統計聚合數據。
 *   數據會根據用戶的城市訪問權限自動過濾。
 *
 * @query
 *   - startDate: 開始日期（ISO 8601，可選，預設 30 天前）
 *   - endDate: 結束日期（ISO 8601，可選，預設今天）
 *   - granularity: 時間粒度（hour/day/week/month/year，預設 day）
 *   - cities: 城市代碼列表（逗號分隔，可選）
 *
 * @returns {AggregatedStatsResponse}
 *   - success: 請求是否成功
 *   - data: 聚合統計數據陣列
 *   - meta: 查詢元數據
 */
export const GET = withCityFilter(
  async (
    request: NextRequest,
    cityContext: CityFilterContext
  ): Promise<NextResponse<AggregatedStatsResponse>> => {
    try {
      // --- 解析參數 ---
      const searchParams = Object.fromEntries(request.nextUrl.searchParams)
      const validation = querySchema.safeParse(searchParams)

      if (!validation.success) {
        return NextResponse.json(
          {
            success: false,
            data: [],
            meta: {
              granularity: 'day',
              startDate: '',
              endDate: '',
              totalDataPoints: 0,
              cacheHit: false,
            },
          } as AggregatedStatsResponse,
          { status: 400 }
        )
      }

      const { granularity } = validation.data

      // --- 驗證時間粒度 ---
      if (!validGranularities.includes(granularity)) {
        return NextResponse.json(
          {
            success: false,
            data: [],
            meta: {
              granularity,
              startDate: '',
              endDate: '',
              totalDataPoints: 0,
              cacheHit: false,
            },
          } as AggregatedStatsResponse,
          { status: 400 }
        )
      }

      // --- 驗證城市訪問權限 ---
      const requestedCities = extractCitiesFromRequest(request)
      const cityValidation = validateRequestedCities(requestedCities, cityContext)

      if (!cityValidation.valid) {
        return NextResponse.json(
          {
            success: false,
            data: [],
            meta: {
              granularity,
              startDate: '',
              endDate: '',
              totalDataPoints: 0,
              cacheHit: false,
            },
          } as AggregatedStatsResponse,
          { status: 403 }
        )
      }

      // --- 解析日期範圍 ---
      const defaultEnd = getDefaultEndDate()
      const defaultStart = getDefaultStartDate()

      const endDate = parseDate(validation.data.endDate, defaultEnd)
      const startDate = parseDate(validation.data.startDate, defaultStart)

      // --- 獲取統計數據 ---
      const stats = await processingStatsService.getAggregatedStats(cityContext, {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        granularity,
        cityCodes: cityValidation.allowed.length > 0 ? cityValidation.allowed : undefined,
      })

      // --- 返回成功響應 ---
      return NextResponse.json({
        success: true,
        data: stats,
        meta: {
          granularity,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          totalDataPoints: stats.length,
          cacheHit: false, // 由服務層設定
        },
      } as AggregatedStatsResponse)
    } catch (error) {
      console.error('[Processing Statistics API] Error:', error)

      return NextResponse.json(
        {
          success: false,
          data: [],
          meta: {
            granularity: 'day',
            startDate: '',
            endDate: '',
            totalDataPoints: 0,
            cacheHit: false,
          },
        } as AggregatedStatsResponse,
        { status: 500 }
      )
    }
  }
)
