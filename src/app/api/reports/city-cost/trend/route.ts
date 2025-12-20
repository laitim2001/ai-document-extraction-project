/**
 * @fileoverview 城市成本趨勢 API
 * @description
 *   提供城市成本趨勢數據：
 *   - GET: 獲取指定城市的成本趨勢
 *   - 權限控制：FINANCE, ADMIN, REGIONAL_MANAGER, CITY_MANAGER
 *
 * @module src/app/api/reports/city-cost/trend
 * @since Epic 7 - Story 7.9 (城市成本報表)
 * @lastModified 2025-12-19
 */

import { NextRequest, NextResponse } from 'next/server'
import { withCityFilter, CityFilterContext } from '@/middleware/city-filter'
import { cityCostReportService } from '@/services/city-cost-report.service'
import type { CostTrendParams } from '@/types/city-cost'

/**
 * 獲取城市成本趨勢
 *
 * @description
 *   返回城市成本趨勢數據：
 *   - 每日/每週/每月成本趨勢
 *   - API 成本 vs 人工成本
 *   - 成本峰值統計
 *
 * @method GET
 * @route /api/reports/city-cost/trend
 *
 * @query cityCode - 城市代碼（必填）
 * @query startDate - 開始日期（必填，ISO 格式）
 * @query endDate - 結束日期（必填，ISO 格式）
 * @query granularity - 時間粒度（可選，day|week|month，預設 day）
 *
 * @returns {CostTrendResponse} 成本趨勢數據
 *
 * @example
 * GET /api/reports/city-cost/trend?cityCode=HKG&startDate=2025-01-01&endDate=2025-01-31
 * GET /api/reports/city-cost/trend?cityCode=SHA&startDate=2025-01-01&endDate=2025-03-31&granularity=week
 */
export const GET = withCityFilter(
  async (
    request: NextRequest,
    cityFilter: CityFilterContext
  ): Promise<NextResponse> => {
    try {
      // 權限檢查：全球管理員或區域管理員可訪問
      // 一般城市用戶也可透過 cityFilter.cityCodes 訪問其授權城市的報表
      // 此處 withCityFilter 已驗證用戶有授權城市

      // 解析查詢參數
      const searchParams = request.nextUrl.searchParams
      const cityCode = searchParams.get('cityCode')
      const startDateStr = searchParams.get('startDate')
      const endDateStr = searchParams.get('endDate')
      const granularity = searchParams.get('granularity') as 'day' | 'week' | 'month' | null

      // 驗證必填參數
      if (!cityCode) {
        return NextResponse.json(
          {
            success: false,
            error: 'Missing required parameter: cityCode',
          },
          { status: 400 }
        )
      }

      if (!startDateStr || !endDateStr) {
        return NextResponse.json(
          {
            success: false,
            error: 'Missing required parameters: startDate and endDate',
          },
          { status: 400 }
        )
      }

      // 驗證城市權限
      if (
        cityFilter.cityCodes.length > 0 &&
        !cityFilter.cityCodes.includes(cityCode)
      ) {
        return NextResponse.json(
          {
            success: false,
            error: `Access denied: Not authorized for city: ${cityCode}`,
          },
          { status: 403 }
        )
      }

      // 驗證日期格式
      const startDate = new Date(startDateStr)
      const endDate = new Date(endDateStr)

      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        return NextResponse.json(
          {
            success: false,
            error: 'Invalid date format. Use ISO 8601 format (YYYY-MM-DD)',
          },
          { status: 400 }
        )
      }

      if (startDate > endDate) {
        return NextResponse.json(
          {
            success: false,
            error: 'startDate must be before or equal to endDate',
          },
          { status: 400 }
        )
      }

      // 驗證 granularity
      if (granularity && !['day', 'week', 'month'].includes(granularity)) {
        return NextResponse.json(
          {
            success: false,
            error: 'Invalid granularity. Use: day, week, or month',
          },
          { status: 400 }
        )
      }

      // 構建查詢參數
      const params: CostTrendParams = {
        cityCode,
        startDate: startDateStr,
        endDate: endDateStr,
        granularity: granularity || 'day',
      }

      // 獲取趨勢數據
      const trend = await cityCostReportService.getCostTrend(
        params,
        cityFilter
      )

      return NextResponse.json({
        success: true,
        data: trend,
      })
    } catch (error) {
      console.error('[City Cost Trend API] Error:', error)

      // 處理權限錯誤
      if (error instanceof Error && error.message.includes('Access denied')) {
        return NextResponse.json(
          {
            success: false,
            error: error.message,
          },
          { status: 403 }
        )
      }

      return NextResponse.json(
        {
          success: false,
          error: error instanceof Error ? error.message : 'Internal server error',
        },
        { status: 500 }
      )
    }
  }
)
