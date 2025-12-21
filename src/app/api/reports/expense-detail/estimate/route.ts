/**
 * @fileoverview 費用明細報表記錄數估算 API
 * @description
 *   提供費用明細報表的記錄數預估端點：
 *   - 根據篩選條件估算記錄數量
 *   - 用於前端顯示預計匯出數量
 *   - 自動應用城市過濾
 *
 * @module src/app/api/reports/expense-detail/estimate
 * @since Epic 7 - Story 7.4 (費用明細報表匯出)
 * @lastModified 2025-12-19
 */

import { NextRequest, NextResponse } from 'next/server'
import { withCityFilter, CityFilterContext } from '@/middlewares/city-filter'
import { expenseReportService } from '@/services/expense-report.service'

/**
 * 估算請求 Body
 */
interface EstimateRequestBody {
  startDate: string
  endDate: string
  forwarderIds?: string[]
}

/**
 * 估算響應
 */
interface EstimateResponse {
  success: boolean
  data?: {
    count: number
  }
  error?: string
}

/**
 * POST /api/reports/expense-detail/estimate
 *
 * @description
 *   估算符合篩選條件的記錄數量。
 *   用於前端在匯出前顯示預計數量，並判斷是否需要背景處理。
 *
 * @param request - 包含篩選條件的 POST 請求
 * @returns 估算的記錄數量
 */
export const POST = withCityFilter(
  async (
    request: NextRequest,
    cityContext: CityFilterContext
  ): Promise<NextResponse<EstimateResponse>> => {
    try {
      const body: EstimateRequestBody = await request.json()

      // 驗證必要參數
      if (!body.startDate || !body.endDate) {
        return NextResponse.json<EstimateResponse>(
          { success: false, error: 'Date range is required' },
          { status: 400 }
        )
      }

      const count = await expenseReportService.getEstimatedCount(cityContext, {
        dateRange: {
          startDate: body.startDate,
          endDate: body.endDate
        },
        format: 'xlsx',
        fields: [],
        forwarderIds: body.forwarderIds
      })

      return NextResponse.json<EstimateResponse>({
        success: true,
        data: { count }
      })
    } catch (error) {
      console.error('Estimate error:', error)
      return NextResponse.json<EstimateResponse>(
        { success: false, error: 'Failed to estimate' },
        { status: 500 }
      )
    }
  }
)
