/**
 * @fileoverview 城市詳情報表 API
 * @description
 *   提供單一城市的詳細報表數據：
 *   - GET: 獲取城市摘要、趨勢數據、Top Forwarders
 *   - 權限控制：必須有該城市的訪問權限
 *
 * @module src/app/api/reports/regional/city/[cityCode]
 * @since Epic 7 - Story 7.5 (跨城市匯總報表)
 * @lastModified 2025-12-19
 */

import { NextRequest, NextResponse } from 'next/server'
import { withCityFilter, CityFilterContext, validateRequestedCities } from '@/middlewares/city-filter'
import { regionalReportService } from '@/services/regional-report.service'
import type { CityDetailResponse, TimeGranularity } from '@/types/regional-report'

/**
 * 路由參數類型
 */
interface RouteParams {
  cityCode: string
}

/**
 * 獲取城市詳情報表
 *
 * @description
 *   返回指定城市的詳細數據：
 *   - 城市摘要（處理量、成功率、自動化率等）
 *   - 趨勢數據（按日/週/月）
 *   - Top Forwarders
 *
 * @method GET
 * @route /api/reports/regional/city/[cityCode]
 *
 * @param cityCode - 城市代碼（路徑參數）
 * @query startDate - 開始日期（必填，ISO 格式）
 * @query endDate - 結束日期（必填，ISO 格式）
 * @query granularity - 時間粒度（可選，day|week|month，預設 day）
 *
 * @returns {CityDetailResponse} 城市詳情報表
 *
 * @example
 * GET /api/reports/regional/city/HKG?startDate=2025-01-01&endDate=2025-01-31&granularity=week
 */
export const GET = withCityFilter<RouteParams>(
  async (
    request: NextRequest,
    cityFilter: CityFilterContext,
    params?: RouteParams
  ): Promise<NextResponse> => {
    try {
      const cityCode = params?.cityCode

      // 驗證城市代碼
      if (!cityCode) {
        const response: CityDetailResponse = {
          success: false,
          error: 'City code is required'
        }
        return NextResponse.json(response, { status: 400 })
      }

      // 驗證城市訪問權限
      const validation = validateRequestedCities([cityCode], cityFilter)
      if (!validation.valid) {
        const response: CityDetailResponse = {
          success: false,
          error: `Access denied: No permission to access city ${cityCode}`
        }
        return NextResponse.json(response, { status: 403 })
      }

      // 解析日期參數
      const searchParams = request.nextUrl.searchParams
      const startDateStr = searchParams.get('startDate')
      const endDateStr = searchParams.get('endDate')
      const granularityStr = searchParams.get('granularity')

      // 驗證必填參數
      if (!startDateStr || !endDateStr) {
        const response: CityDetailResponse = {
          success: false,
          error: 'Missing required parameters: startDate and endDate'
        }
        return NextResponse.json(response, { status: 400 })
      }

      // 解析日期
      const startDate = new Date(startDateStr)
      const endDate = new Date(endDateStr)

      // 驗證日期有效性
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        const response: CityDetailResponse = {
          success: false,
          error: 'Invalid date format. Use ISO 8601 format (YYYY-MM-DD)'
        }
        return NextResponse.json(response, { status: 400 })
      }

      // 驗證日期範圍
      if (startDate > endDate) {
        const response: CityDetailResponse = {
          success: false,
          error: 'startDate must be before or equal to endDate'
        }
        return NextResponse.json(response, { status: 400 })
      }

      // 設置 endDate 為當天結束
      endDate.setHours(23, 59, 59, 999)

      // 驗證粒度參數
      const validGranularities: TimeGranularity[] = ['day', 'week', 'month']
      const granularity: TimeGranularity =
        granularityStr && validGranularities.includes(granularityStr as TimeGranularity)
          ? (granularityStr as TimeGranularity)
          : 'day'

      // 獲取城市詳情數據
      const detail = await regionalReportService.getCityDetail(
        cityCode,
        startDate,
        endDate,
        granularity
      )

      const response: CityDetailResponse = {
        success: true,
        data: detail
      }

      return NextResponse.json(response)
    } catch (error) {
      console.error('[City Detail API] Error:', error)

      // 處理城市未找到錯誤
      if (error instanceof Error && error.message.includes('City not found')) {
        const response: CityDetailResponse = {
          success: false,
          error: 'City not found'
        }
        return NextResponse.json(response, { status: 404 })
      }

      const response: CityDetailResponse = {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error'
      }
      return NextResponse.json(response, { status: 500 })
    }
  }
)
