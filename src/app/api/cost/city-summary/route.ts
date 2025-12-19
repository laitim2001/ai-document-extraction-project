/**
 * @fileoverview 城市 AI 成本摘要 API
 * @description
 *   提供城市級別的 AI API 使用成本摘要數據：
 *   - 各城市總成本與呼叫次數
 *   - 各城市 Provider 成本分佈
 *   - 與上期比較的變化趨勢
 *   - 平均每日成本與每次呼叫成本
 *
 *   ## 城市數據隔離
 *   使用 withCityFilter 中間件自動過濾用戶授權城市的數據。
 *
 *   ## 快取機制
 *   城市成本摘要數據快取 5 分鐘，減少資料庫負載。
 *
 * @module src/app/api/cost/city-summary
 * @since Epic 7 - Story 7.8 (城市 AI 成本追蹤)
 * @lastModified 2025-12-19
 *
 * @features
 *   - AC1: 城市級別成本摘要查詢
 *   - AC2: 多城市成本數據匯總
 *   - 城市數據隔離
 *   - 5 分鐘快取
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
import type { CityCostApiResponse, CityCostSummaryResponse } from '@/types/city-cost'

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
  forceRefresh: z.enum(['true', 'false']).optional(),
})

// ============================================================
// Route Handler
// ============================================================

/**
 * GET /api/cost/city-summary
 *
 * @description
 *   獲取城市級別 AI API 成本摘要數據。
 *   數據會根據用戶的城市訪問權限自動過濾。
 *
 * @query
 *   - cities: 城市代碼列表（逗號分隔，可選）
 *   - startDate: 開始日期（YYYY-MM-DD，可選，預設 30 天前）
 *   - endDate: 結束日期（YYYY-MM-DD，可選，預設今天）
 *   - forceRefresh: 是否強制刷新快取（true/false，可選）
 *
 * @returns {CityCostApiResponse<CityCostSummaryResponse>}
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

      // 獲取城市成本摘要
      const summary = await cityCostService.getCityCostSummary(
        {
          cityCodes: cityValidation.allowed.length > 0 ? cityValidation.allowed : undefined,
          startDate: validation.data.startDate,
          endDate: validation.data.endDate,
          forceRefresh: validation.data.forceRefresh === 'true',
        },
        cityContext
      )

      // 返回成功響應
      const response: CityCostApiResponse<CityCostSummaryResponse> = {
        success: true,
        data: summary,
        meta: {
          cached: !validation.data.forceRefresh,
        },
      }

      return NextResponse.json(response)
    } catch (error) {
      // 處理其他錯誤
      console.error('[City Cost Summary API] Error:', error)
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Failed to fetch city cost summary',
          },
        },
        { status: 500 }
      )
    }
  }
)
