/**
 * @fileoverview 城市成本比較 API
 * @description
 *   提供城市間 AI API 成本比較數據：
 *   - 城市成本排名
 *   - 成本效率比較（每次呼叫成本）
 *   - 成本佔比分析
 *   - 與上期比較的變化趨勢
 *
 *   ## 城市數據隔離
 *   使用 withCityFilter 中間件自動過濾用戶授權城市的數據。
 *
 * @module src/app/api/cost/comparison
 * @since Epic 7 - Story 7.8 (城市 AI 成本追蹤)
 * @lastModified 2025-12-19
 *
 * @features
 *   - AC5: 城市間成本比較
 *   - AC6: 成本效率排名
 *   - 支援多種排序方式
 *   - 城市數據隔離
 *
 * @dependencies
 *   - @/middleware/city-filter - 城市過濾中間件
 *   - @/services/city-cost.service - 城市成本服務
 *   - zod - 請求驗證
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import {
  withCityFilter,
  CityFilterContext,
  extractCitiesFromRequest,
  validateRequestedCities,
} from '@/middleware/city-filter'
import { cityCostService } from '@/services/city-cost.service'
import type { CityCostApiResponse, CityCostComparisonResponse } from '@/types/city-cost'

// ============================================================
// Validation Schema
// ============================================================

/**
 * 查詢參數驗證 Schema
 */
const querySchema = z.object({
  cities: z.string().optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  sortBy: z.enum(['cost', 'calls', 'efficiency']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
  limit: z.string().regex(/^\d+$/).optional(),
})

// ============================================================
// Route Handler
// ============================================================

/**
 * GET /api/cost/comparison
 *
 * @description
 *   獲取城市間成本比較數據。
 *   數據會根據用戶的城市訪問權限自動過濾。
 *
 * @query
 *   - cities: 城市代碼列表（逗號分隔，可選，留空比較所有城市）
 *   - startDate: 開始日期（YYYY-MM-DD，可選，預設 30 天前）
 *   - endDate: 結束日期（YYYY-MM-DD，可選，預設今天）
 *   - sortBy: 排序方式（cost/calls/efficiency，可選，預設 cost）
 *   - sortOrder: 排序順序（asc/desc，可選，預設 desc）
 *   - limit: 返回數量限制（可選）
 *
 * @returns {CityCostApiResponse<CityCostComparisonResponse>}
 */
export const GET = withCityFilter(
  async (
    request: NextRequest,
    cityContext: CityFilterContext
  ): Promise<NextResponse> => {
    try {
      // 解析查詢參數
      const searchParams = Object.fromEntries(request.nextUrl.searchParams)
      const validation = querySchema.safeParse(searchParams)

      if (!validation.success) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid request parameters',
              details: validation.error.issues,
            },
          },
          { status: 400 }
        )
      }

      // 驗證城市訪問權限
      const requestedCities = extractCitiesFromRequest(request)
      const cityValidation = validateRequestedCities(requestedCities, cityContext)

      if (!cityValidation.valid) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'FORBIDDEN',
              message: `無權訪問以下城市: ${cityValidation.unauthorized.join(', ')}`,
            },
          },
          { status: 403 }
        )
      }

      // 獲取城市成本比較
      const comparison = await cityCostService.getCityCostComparison(
        {
          cityCodes: cityValidation.allowed.length > 0 ? cityValidation.allowed : undefined,
          startDate: validation.data.startDate,
          endDate: validation.data.endDate,
          sortBy: validation.data.sortBy as 'cost' | 'calls' | 'efficiency' | undefined,
          sortOrder: validation.data.sortOrder as 'asc' | 'desc' | undefined,
          limit: validation.data.limit ? parseInt(validation.data.limit, 10) : undefined,
        },
        cityContext
      )

      // 返回成功響應
      const response: CityCostApiResponse<CityCostComparisonResponse> = {
        success: true,
        data: comparison,
      }

      return NextResponse.json(response)
    } catch (error) {
      // 處理其他錯誤
      console.error('[City Cost Comparison API] Error:', error)
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Failed to fetch city cost comparison',
          },
        },
        { status: 500 }
      )
    }
  }
)
