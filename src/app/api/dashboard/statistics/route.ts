/**
 * @fileoverview 儀表板統計 API
 * @description
 *   提供處理統計儀表板的數據：
 *   - 處理量統計（今日/本週/本月）
 *   - 成功率與自動化率
 *   - 平均處理時間
 *   - 待審核數量
 *
 *   ## 城市數據隔離
 *   使用 withCityFilter 中間件自動過濾用戶授權城市的數據。
 *
 *   ## 快取機制
 *   統計數據快取 5 分鐘，減少資料庫負載。
 *
 * @module src/app/api/dashboard/statistics
 * @author Development Team
 * @since Epic 7 - Story 7.1 (Processing Statistics Dashboard)
 * @lastModified 2025-12-19
 *
 * @features
 *   - 城市數據隔離
 *   - 5 分鐘快取
 *   - 趨勢指標
 *
 * @dependencies
 *   - @/middleware/city-filter - 城市過濾中間件
 *   - @/services/dashboard-statistics.service - 統計服務
 *   - zod - 請求驗證
 *
 * @related
 *   - src/components/dashboard/DashboardStats.tsx - 儀表板組件
 *   - src/types/dashboard.ts - 類型定義
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import {
  withCityFilter,
  CityFilterContext,
  extractCitiesFromRequest,
  validateRequestedCities,
} from '@/middleware/city-filter'
import { dashboardStatisticsService } from '@/services/dashboard-statistics.service'
import type { DashboardStatisticsResponse } from '@/types/dashboard'

// ============================================================
// Validation Schema
// ============================================================

/**
 * 查詢參數驗證 Schema
 */
const querySchema = z.object({
  cities: z.string().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
})

// ============================================================
// Route Handler
// ============================================================

/**
 * GET /api/dashboard/statistics
 *
 * @description
 *   獲取儀表板統計數據。
 *   數據會根據用戶的城市訪問權限自動過濾。
 *
 * @query
 *   - cities: 城市代碼列表（逗號分隔，可選）
 *   - startDate: 開始日期（ISO 8601，可選）
 *   - endDate: 結束日期（ISO 8601，可選）
 *
 * @returns {DashboardStatisticsResponse}
 *   - success: 請求是否成功
 *   - data: 統計數據
 *     - processingVolume: 處理量（今日/本週/本月）
 *     - successRate: 成功率（%）
 *     - automationRate: 自動化率（%）
 *     - averageProcessingTime: 平均處理時間（秒）
 *     - pendingReview: 待審核數量
 *     - lastUpdated: 最後更新時間
 */
export const GET = withCityFilter(
  async (
    request: NextRequest,
    cityContext: CityFilterContext
  ): Promise<NextResponse<DashboardStatisticsResponse>> => {
    try {
      // --- 解析參數 ---
      const searchParams = Object.fromEntries(request.nextUrl.searchParams)
      const validation = querySchema.safeParse(searchParams)

      if (!validation.success) {
        return NextResponse.json(
          {
            success: false,
            error: '無效的查詢參數',
          } as DashboardStatisticsResponse,
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
            error: `無權訪問以下城市: ${cityValidation.unauthorized.join(', ')}`,
          } as DashboardStatisticsResponse,
          { status: 403 }
        )
      }

      // --- 獲取統計數據 ---
      const statistics = await dashboardStatisticsService.getStatistics(cityContext, {
        cityCodes: cityValidation.allowed.length > 0 ? cityValidation.allowed : undefined,
        startDate: validation.data.startDate,
        endDate: validation.data.endDate,
      })

      // --- 返回成功響應 ---
      return NextResponse.json({
        success: true,
        data: statistics,
      } as DashboardStatisticsResponse)
    } catch (error) {
      console.error('[Dashboard Statistics API] Error:', error)

      return NextResponse.json(
        {
          success: false,
          error: '獲取統計數據失敗',
        } as DashboardStatisticsResponse,
        { status: 500 }
      )
    }
  }
)
