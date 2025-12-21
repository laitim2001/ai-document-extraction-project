/**
 * @fileoverview 區域匯總報表 API
 * @description
 *   提供跨城市匯總報表數據：
 *   - GET: 獲取所有授權城市的匯總數據
 *   - 權限控制：僅區域經理和全局管理員可訪問
 *
 * @module src/app/api/reports/regional/summary
 * @since Epic 7 - Story 7.5 (跨城市匯總報表)
 * @lastModified 2025-12-19
 */

import { NextRequest, NextResponse } from 'next/server'
import { withCityFilter, CityFilterContext } from '@/middlewares/city-filter'
import { regionalReportService } from '@/services/regional-report.service'
import type { RegionalSummaryResponse } from '@/types/regional-report'

/**
 * 獲取區域匯總報表
 *
 * @description
 *   返回用戶授權城市的匯總數據：
 *   - 城市總數、總處理量
 *   - 平均成功率、自動化率
 *   - 總 AI 成本
 *   - 各城市詳細數據
 *
 * @method GET
 * @route /api/reports/regional/summary
 *
 * @query startDate - 開始日期（必填，ISO 格式）
 * @query endDate - 結束日期（必填，ISO 格式）
 *
 * @returns {RegionalSummaryResponse} 區域匯總數據
 *
 * @example
 * GET /api/reports/regional/summary?startDate=2025-01-01&endDate=2025-01-31
 */
export const GET = withCityFilter(
  async (
    request: NextRequest,
    cityFilter: CityFilterContext
  ): Promise<NextResponse> => {
    try {
      // 權限檢查：必須是區域經理或全局管理員
      if (!cityFilter.isGlobalAdmin && !cityFilter.isRegionalManager) {
        const response: RegionalSummaryResponse = {
          success: false,
          error: 'Access denied: Regional manager access required'
        }
        return NextResponse.json(response, { status: 403 })
      }

      // 解析日期參數
      const searchParams = request.nextUrl.searchParams
      const startDateStr = searchParams.get('startDate')
      const endDateStr = searchParams.get('endDate')

      // 驗證必填參數
      if (!startDateStr || !endDateStr) {
        const response: RegionalSummaryResponse = {
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
        const response: RegionalSummaryResponse = {
          success: false,
          error: 'Invalid date format. Use ISO 8601 format (YYYY-MM-DD)'
        }
        return NextResponse.json(response, { status: 400 })
      }

      // 驗證日期範圍
      if (startDate > endDate) {
        const response: RegionalSummaryResponse = {
          success: false,
          error: 'startDate must be before or equal to endDate'
        }
        return NextResponse.json(response, { status: 400 })
      }

      // 設置 endDate 為當天結束
      endDate.setHours(23, 59, 59, 999)

      // 獲取區域匯總數據
      const summary = await regionalReportService.getRegionalSummary(
        cityFilter,
        startDate,
        endDate
      )

      const response: RegionalSummaryResponse = {
        success: true,
        data: summary
      }

      return NextResponse.json(response)
    } catch (error) {
      console.error('[Regional Summary API] Error:', error)

      // 處理權限錯誤
      if (error instanceof Error && error.message.includes('Access denied')) {
        const response: RegionalSummaryResponse = {
          success: false,
          error: error.message
        }
        return NextResponse.json(response, { status: 403 })
      }

      const response: RegionalSummaryResponse = {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error'
      }
      return NextResponse.json(response, { status: 500 })
    }
  }
)
