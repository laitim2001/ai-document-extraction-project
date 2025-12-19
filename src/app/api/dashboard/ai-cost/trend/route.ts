/**
 * @fileoverview AI 成本趨勢 API
 * @description
 *   提供 AI API 成本趨勢數據：
 *   - 依日/週/月粒度的成本變化
 *   - 各 Provider 分別的成本趨勢
 *   - 期間總成本與峰值
 *
 * @module src/app/api/dashboard/ai-cost/trend
 * @since Epic 7 - Story 7.6 (AI API 使用成本顯示)
 * @lastModified 2025-12-19
 *
 * @features
 *   - AC2: 成本趨勢圖表（日/週/月）
 *   - 城市數據隔離
 *
 * @dependencies
 *   - @/middleware/city-filter - 城市過濾中間件
 *   - @/services/ai-cost.service - AI 成本服務
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import {
  withCityFilter,
  CityFilterContext,
  extractCitiesFromRequest,
  validateRequestedCities,
} from '@/middleware/city-filter'
import { aiCostService } from '@/services/ai-cost.service'
import type { AiCostTrend, AiCostApiResponse, ApiProviderType } from '@/types/ai-cost'

// ============================================================
// Validation Schema
// ============================================================

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
 * GET /api/dashboard/ai-cost/trend
 *
 * @query
 *   - cities: 城市代碼列表（逗號分隔，可選）
 *   - startDate: 開始日期（YYYY-MM-DD，必填）
 *   - endDate: 結束日期（YYYY-MM-DD，必填）
 *   - granularity: 時間粒度（day/week/month，預設 day）
 *   - providers: Provider 過濾（逗號分隔，可選）
 *
 * @returns {AiCostApiResponse<AiCostTrend>}
 */
export const GET = withCityFilter(
  async (
    request: NextRequest,
    cityContext: CityFilterContext
  ): Promise<NextResponse> => {
    try {
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

      // 解析 providers
      const providers = validation.data.providers
        ? (validation.data.providers.split(',') as ApiProviderType[])
        : undefined

      const trend = await aiCostService.getCostTrend(
        {
          cityCodes: cityValidation.allowed.length > 0 ? cityValidation.allowed : undefined,
          startDate: validation.data.startDate,
          endDate: validation.data.endDate,
          granularity: validation.data.granularity as 'day' | 'week' | 'month' | undefined,
          providers,
        },
        cityContext
      )

      const response: AiCostApiResponse<AiCostTrend> = {
        success: true,
        data: trend,
      }

      return NextResponse.json(response)
    } catch (error) {
      console.error('[AI Cost Trend API] Error:', error)
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Failed to fetch AI cost trend',
          },
        },
        { status: 500 }
      )
    }
  }
)
