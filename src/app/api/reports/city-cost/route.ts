/**
 * @fileoverview 城市成本報表 API
 * @description
 *   提供城市級別成本報表數據：
 *   - GET: 獲取城市成本報表（整合 AI + 人工成本）
 *   - 權限控制：FINANCE, ADMIN, REGIONAL_MANAGER, CITY_MANAGER
 *
 * @module src/app/api/reports/city-cost
 * @since Epic 7 - Story 7.9 (城市成本報表)
 * @lastModified 2025-12-19
 */

import { NextRequest, NextResponse } from 'next/server'
import { withCityFilter, CityFilterContext } from '@/middlewares/city-filter'
import { cityCostReportService } from '@/services/city-cost-report.service'
import type { CityCostReportParams } from '@/types/city-cost'

/**
 * 獲取城市成本報表
 *
 * @description
 *   返回城市成本報表數據：
 *   - 處理統計（總量、自動化率）
 *   - 成本明細（API + 人工）
 *   - 異常檢測結果
 *   - 趨勢數據
 *
 * @method GET
 * @route /api/reports/city-cost
 *
 * @query startDate - 開始日期（可選，ISO 格式，預設 30 天前）
 * @query endDate - 結束日期（可選，ISO 格式，預設今天）
 * @query cityCodes - 城市代碼（可選，逗號分隔）
 * @query includeTrend - 是否包含趨勢數據（可選，預設 true）
 * @query includeAnomalies - 是否包含異常檢測（可選，預設 true）
 * @query forceRefresh - 是否強制刷新快取（可選，預設 false）
 *
 * @returns {CityCostReportResponse} 城市成本報表數據
 *
 * @example
 * GET /api/reports/city-cost?startDate=2025-01-01&endDate=2025-01-31
 * GET /api/reports/city-cost?cityCodes=HKG,SHA,BJS
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
      const startDateStr = searchParams.get('startDate')
      const endDateStr = searchParams.get('endDate')
      const cityCodesStr = searchParams.get('cityCodes')
      const includeTrendStr = searchParams.get('includeTrend')
      const includeAnomaliesStr = searchParams.get('includeAnomalies')
      const forceRefreshStr = searchParams.get('forceRefresh')

      // 解析城市代碼
      const requestedCityCodes = cityCodesStr
        ? cityCodesStr.split(',').map((c) => c.trim()).filter(Boolean)
        : undefined

      // 驗證城市權限
      if (requestedCityCodes?.length) {
        const invalidCities = requestedCityCodes.filter(
          (code) =>
            cityFilter.cityCodes.length > 0 &&
            !cityFilter.cityCodes.includes(code)
        )
        if (invalidCities.length > 0) {
          return NextResponse.json(
            {
              success: false,
              error: `Access denied: Not authorized for cities: ${invalidCities.join(', ')}`,
            },
            { status: 403 }
          )
        }
      }

      // 驗證日期格式
      if (startDateStr) {
        const startDate = new Date(startDateStr)
        if (isNaN(startDate.getTime())) {
          return NextResponse.json(
            {
              success: false,
              error: 'Invalid startDate format. Use ISO 8601 format (YYYY-MM-DD)',
            },
            { status: 400 }
          )
        }
      }

      if (endDateStr) {
        const endDate = new Date(endDateStr)
        if (isNaN(endDate.getTime())) {
          return NextResponse.json(
            {
              success: false,
              error: 'Invalid endDate format. Use ISO 8601 format (YYYY-MM-DD)',
            },
            { status: 400 }
          )
        }
      }

      // 構建查詢參數
      const params: CityCostReportParams = {
        startDate: startDateStr || undefined,
        endDate: endDateStr || undefined,
        cityCodes: requestedCityCodes,
        includeTrend: includeTrendStr === 'false' ? false : true,
        includeAnomalies: includeAnomaliesStr === 'false' ? false : true,
        forceRefresh: forceRefreshStr === 'true',
      }

      // 獲取報表數據
      const report = await cityCostReportService.getCityCostReport(
        params,
        cityFilter
      )

      return NextResponse.json({
        success: true,
        data: report,
      })
    } catch (error) {
      console.error('[City Cost Report API] Error:', error)

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
