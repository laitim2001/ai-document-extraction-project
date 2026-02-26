/**
 * @fileoverview Exchange Rate Batch API - 批次匯率查詢
 * @description
 *   提供批次匯率查詢端點，一次查詢多個貨幣對。
 *   每個貨幣對獨立處理，失敗的貨幣對返回 found=false 而非中斷整個請求。
 *   最多支援 50 組貨幣對。
 *
 * @module src/app/api/v1/exchange-rates/batch
 * @since Epic 21 - Story 21.4
 * @lastModified 2026-02-05
 *
 * @endpoints
 *   POST /api/v1/exchange-rates/batch - 批次匯率查詢
 *
 * @dependencies
 *   - src/services/exchange-rate.service.ts - batchGetRates 方法
 *   - src/lib/validations/exchange-rate.schema.ts - batchGetRatesSchema
 *
 * @related
 *   - src/app/api/v1/exchange-rates/convert/route.ts - 單一轉換端點
 *   - src/types/exchange-rate.ts - BatchRateResult 類型
 */

import { NextRequest, NextResponse } from 'next/server'
import { batchGetRates } from '@/services/exchange-rate.service'
import { batchGetRatesSchema } from '@/lib/validations/exchange-rate.schema'

// =====================
// API Handlers
// =====================

/**
 * POST /api/v1/exchange-rates/batch
 * 批次查詢多個貨幣對匯率
 *
 * @description
 *   並行查詢所有貨幣對，每個貨幣對使用 Fallback 邏輯。
 *   失敗的貨幣對返回 found: false，不影響其他貨幣對的查詢。
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // 驗證請求體
    const parsed = batchGetRatesSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/validation',
          title: 'Validation Error',
          status: 400,
          detail: 'Invalid request body',
          errors: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      )
    }

    const { pairs, year } = parsed.data
    const effectiveYear = year ?? new Date().getFullYear()

    // 執行批次查詢
    const results = await batchGetRates(pairs, effectiveYear)

    return NextResponse.json({
      success: true,
      data: {
        rates: results,
        effectiveYear,
      },
    })
  } catch (error) {
    console.error('[ExchangeRate:Batch] Error:', error)
    return NextResponse.json(
      {
        type: 'https://api.example.com/errors/internal',
        title: 'Internal Server Error',
        status: 500,
        detail: 'An unexpected error occurred while fetching batch rates',
      },
      { status: 500 }
    )
  }
}
