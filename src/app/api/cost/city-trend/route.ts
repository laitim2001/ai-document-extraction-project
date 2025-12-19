/**
 * @fileoverview 城市 AI 成本趨勢 API
 * @description
 *   提供城市級別的 AI API 成本趨勢數據：
 *   - 按時間粒度（日/週/月）的成本趨勢
 *   - 各城市的成本變化趨勢
 *   - 成本峰值與平均值分析
 *   - 多城市趨勢比較
 *
 *   ## 城市數據隔離
 *   使用 withCityFilter 中間件自動過濾用戶授權城市的數據。
 *
 * @module src/app/api/cost/city-trend
 * @since Epic 7 - Story 7.8 (城市 AI 成本追蹤)
 * @lastModified 2025-12-19
 *
 * @features
 *   - AC3: 城市成本趨勢分析
 *   - AC4: 多城市趨勢比較
 *   - 支援日/週/月時間粒度
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
import type { CityCostApiResponse, CityCostTrendResponse } from '@/types/city-cost'

// ============================================================
// Validation Schema
// ============================================================

/**
 * 查詢參數驗證 Schema
 */
const querySchema = z.object({
  cities: z.string().optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  granularity: z.enum(['day', 'week', 'month']).optional(),
  providers: z.string().optional(),
})

// ============================================================
// Route Handler
// ============================================================

/**
 * GET /api/cost/city-trend
 *
 * @description
 *   獲取城市級別 AI API 成本趨勢數據。
 *   數據會根據用戶的城市訪問權限自動過濾。
 *
 * @query
 *   - cities: 城市代碼列表（逗號分隔，可選）
 *   - startDate: 開始日期（YYYY-MM-DD，必填）
 *   - endDate: 結束日期（YYYY-MM-DD，必填）
 *   - granularity: 時間粒度（day/week/month，可選，預設 day）
 *   - providers: 提供者列表（逗號分隔，可選）
 *
 * @returns {CityCostApiResponse<CityCostTrendResponse>}
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

      // 解析 providers 列表
      const providers = validation.data.providers
        ? validation.data.providers.split(',').filter(Boolean) as ('AZURE_DOC_INTELLIGENCE' | 'OPENAI' | 'AZURE_OPENAI')[]
        : undefined

      // 獲取城市成本趨勢
      const trend = await cityCostService.getCityCostTrend(
        {
          cityCodes: cityValidation.allowed.length > 0 ? cityValidation.allowed : undefined,
          startDate: validation.data.startDate,
          endDate: validation.data.endDate,
          granularity: validation.data.granularity as 'day' | 'week' | 'month' | undefined,
          providers,
        },
        cityContext
      )

      // 返回成功響應
      const response: CityCostApiResponse<CityCostTrendResponse> = {
        success: true,
        data: trend,
      }

      return NextResponse.json(response)
    } catch (error) {
      // 處理其他錯誤
      console.error('[City Cost Trend API] Error:', error)
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Failed to fetch city cost trend',
          },
        },
        { status: 500 }
      )
    }
  }
)
