/**
 * @fileoverview AI 成本異常檢測 API
 * @description
 *   提供 AI API 成本異常檢測功能：
 *   - 成本突增檢測（標準差 2 倍閾值）
 *   - 高錯誤率警示
 *   - 異常呼叫量檢測
 *   - 響應時間異常
 *
 * @module src/app/api/dashboard/ai-cost/anomalies
 * @since Epic 7 - Story 7.6 (AI API 使用成本顯示)
 * @lastModified 2025-12-19
 *
 * @features
 *   - AC4: 成本異常警示
 *   - 城市數據隔離
 *   - 嚴重程度分類
 *
 * @dependencies
 *   - @/middlewares/city-filter - 城市過濾中間件
 *   - @/services/ai-cost.service - AI 成本服務
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import {
  withCityFilter,
  CityFilterContext,
  extractCitiesFromRequest,
  validateRequestedCities,
} from '@/middlewares/city-filter'
import { aiCostService } from '@/services/ai-cost.service'
import type { AnomalyDetectionResult, AiCostApiResponse, AnomalySeverity } from '@/types/ai-cost'

// ============================================================
// Validation Schema
// ============================================================

const querySchema = z.object({
  cities: z.string().optional(),
  days: z.string().regex(/^\d+$/).optional(),
  minSeverity: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  includeAcknowledged: z.enum(['true', 'false']).optional(),
})

// ============================================================
// Route Handler
// ============================================================

/**
 * GET /api/dashboard/ai-cost/anomalies
 *
 * @query
 *   - cities: 城市代碼列表（逗號分隔，可選）
 *   - days: 檢測天數（預設 7）
 *   - minSeverity: 最低嚴重程度（low/medium/high/critical，可選）
 *   - includeAcknowledged: 包含已確認異常（true/false，預設 false）
 *
 * @returns {AiCostApiResponse<AnomalyDetectionResult>}
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

      const result = await aiCostService.detectAnomalies(
        {
          cityCodes: cityValidation.allowed.length > 0 ? cityValidation.allowed : undefined,
          days: validation.data.days ? parseInt(validation.data.days, 10) : undefined,
          minSeverity: validation.data.minSeverity as AnomalySeverity | undefined,
          includeAcknowledged: validation.data.includeAcknowledged === 'true',
        },
        cityContext
      )

      const response: AiCostApiResponse<AnomalyDetectionResult> = {
        success: true,
        data: result,
      }

      return NextResponse.json(response)
    } catch (error) {
      console.error('[AI Cost Anomalies API] Error:', error)
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Failed to detect anomalies',
          },
        },
        { status: 500 }
      )
    }
  }
)
