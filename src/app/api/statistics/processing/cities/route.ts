/**
 * @fileoverview 城市統計匯總 API
 * @description
 *   提供各城市處理量統計匯總：
 *   - 各城市總處理量統計
 *   - 成功率與自動化率
 *   - 趨勢變化指標
 *   - 城市數據隔離
 *
 * @module src/app/api/statistics/processing/cities
 * @since Epic 7 - Story 7.7 (城市處理數量追蹤)
 * @lastModified 2025-12-19
 *
 * @features
 *   - 城市級別統計匯總
 *   - 與上期間趨勢對比
 *   - 5 分鐘快取
 *
 * @dependencies
 *   - @/middlewares/city-filter - 城市過濾中間件
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
} from '@/middlewares/city-filter'
import { processingStatsService } from '@/services/processing-stats.service'
import type { CityStatsSummaryResponse } from '@/types/processing-statistics'

// ============================================================
// Validation Schema
// ============================================================

/**
 * 查詢參數驗證 Schema
 */
const querySchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
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

/**
 * 格式化日期為 YYYY-MM-DD
 */
function formatDate(date: Date): string {
  return date.toISOString().split('T')[0]
}

// ============================================================
// Route Handler
// ============================================================

/**
 * GET /api/statistics/processing/cities
 *
 * @description
 *   獲取各城市處理統計匯總。
 *   數據會根據用戶的城市訪問權限自動過濾。
 *
 * @query
 *   - startDate: 開始日期（ISO 8601，可選，預設 30 天前）
 *   - endDate: 結束日期（ISO 8601，可選，預設今天）
 *   - cities: 城市代碼列表（逗號分隔，可選）
 *
 * @returns {CityStatsSummaryResponse}
 *   - success: 請求是否成功
 *   - data: 城市統計匯總陣列
 *   - meta: 查詢元數據
 */
export const GET = withCityFilter(
  async (
    request: NextRequest,
    cityContext: CityFilterContext
  ): Promise<NextResponse<CityStatsSummaryResponse>> => {
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
              period: '',
              cityCount: 0,
            },
          } as CityStatsSummaryResponse,
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
              period: '',
              cityCount: 0,
            },
          } as CityStatsSummaryResponse,
          { status: 403 }
        )
      }

      // --- 解析日期範圍 ---
      const defaultEnd = getDefaultEndDate()
      const defaultStart = getDefaultStartDate()

      const endDate = parseDate(validation.data.endDate, defaultEnd)
      const startDate = parseDate(validation.data.startDate, defaultStart)

      // --- 獲取城市統計匯總 ---
      const summary = await processingStatsService.getCityStatsSummary(
        cityContext,
        startDate,
        endDate
      )

      // --- 返回成功響應 ---
      return NextResponse.json({
        success: true,
        data: summary,
        meta: {
          period: `${formatDate(startDate)} to ${formatDate(endDate)}`,
          cityCount: summary.length,
        },
      } as CityStatsSummaryResponse)
    } catch (error) {
      console.error('[City Stats Summary API] Error:', error)

      return NextResponse.json(
        {
          success: false,
          data: [],
          meta: {
            period: '',
            cityCount: 0,
          },
        } as CityStatsSummaryResponse,
        { status: 500 }
      )
    }
  }
)
