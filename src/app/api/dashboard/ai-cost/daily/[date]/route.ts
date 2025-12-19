/**
 * @fileoverview AI 成本每日明細 API
 * @description
 *   提供特定日期的 AI API 使用詳細記錄：
 *   - 當日成本摘要
 *   - 個別 API 呼叫記錄
 *   - 分頁支援
 *
 * @module src/app/api/dashboard/ai-cost/daily/[date]
 * @since Epic 7 - Story 7.6 (AI API 使用成本顯示)
 * @lastModified 2025-12-19
 *
 * @features
 *   - AC5: 詳細使用記錄查詢
 *   - 城市數據隔離
 *   - 分頁支援
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
import type { DailyDetail, AiCostApiResponse, ApiProviderType } from '@/types/ai-cost'

// ============================================================
// Validation Schema
// ============================================================

const querySchema = z.object({
  cities: z.string().optional(),
  providers: z.string().optional(),
  failedOnly: z.enum(['true', 'false']).optional(),
  page: z.string().regex(/^\d+$/).optional(),
  limit: z.string().regex(/^\d+$/).optional(),
})

const dateParamSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

// ============================================================
// Route Handler
// ============================================================

/**
 * GET /api/dashboard/ai-cost/daily/[date]
 *
 * @param date: 查詢日期（YYYY-MM-DD）
 *
 * @query
 *   - cities: 城市代碼列表（逗號分隔，可選）
 *   - providers: Provider 過濾（逗號分隔，可選）
 *   - failedOnly: 僅顯示失敗記錄（true/false，可選）
 *   - page: 頁碼（預設 1）
 *   - limit: 每頁數量（預設 50）
 *
 * @returns {AiCostApiResponse<DailyDetail>}
 */
async function handler(
  request: NextRequest,
  cityContext: CityFilterContext,
  params?: { params: Promise<{ date: string }> }
): Promise<NextResponse> {
  try {
    const resolvedParams = await params?.params
    const date = resolvedParams?.date

    // 驗證日期參數
    if (!date) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Date parameter is required',
          },
        },
        { status: 400 }
      )
    }

    const dateValidation = dateParamSchema.safeParse(date)
    if (!dateValidation.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid date format. Expected YYYY-MM-DD',
          },
        },
        { status: 400 }
      )
    }

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

    const providers = validation.data.providers
      ? (validation.data.providers.split(',') as ApiProviderType[])
      : undefined

    const detail = await aiCostService.getDailyDetail(
      {
        date: dateValidation.data,
        cityCodes: cityValidation.allowed.length > 0 ? cityValidation.allowed : undefined,
        providers,
        failedOnly: validation.data.failedOnly === 'true',
        page: validation.data.page ? parseInt(validation.data.page, 10) : undefined,
        limit: validation.data.limit ? parseInt(validation.data.limit, 10) : undefined,
      },
      cityContext
    )

    const response: AiCostApiResponse<DailyDetail> = {
      success: true,
      data: detail,
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('[AI Cost Daily API] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to fetch AI cost daily detail',
        },
      },
      { status: 500 }
    )
  }
}

export const GET = withCityFilter<{ params: Promise<{ date: string }> }>(handler)
