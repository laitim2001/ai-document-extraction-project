/**
 * @fileoverview Exchange Rate Convert API - 貨幣轉換計算
 * @description
 *   提供單一金額的貨幣轉換計算端點。
 *   支援三層 Fallback 邏輯：直接匹配 → 反向計算 → 交叉匯率（通過 USD）。
 *   year 參數可選，預設使用當前年份。
 *
 * @module src/app/api/v1/exchange-rates/convert
 * @since Epic 21 - Story 21.4
 * @lastModified 2026-02-05
 *
 * @endpoints
 *   POST /api/v1/exchange-rates/convert - 貨幣轉換計算
 *
 * @dependencies
 *   - src/services/exchange-rate.service.ts - convert 方法
 *   - src/lib/validations/exchange-rate.schema.ts - convertSchema
 *
 * @related
 *   - src/app/api/v1/exchange-rates/batch/route.ts - 批次查詢端點
 *   - src/types/exchange-rate.ts - ConvertResult 類型
 */

import { NextRequest, NextResponse } from 'next/server'
import { convert } from '@/services/exchange-rate.service'
import { convertSchema } from '@/lib/validations/exchange-rate.schema'
import { ZodError } from 'zod'

// =====================
// API Handlers
// =====================

/**
 * POST /api/v1/exchange-rates/convert
 * 貨幣轉換計算
 *
 * @description
 *   Fallback 邏輯：
 *   1. 直接查詢：fromCurrency → toCurrency
 *   2. 反向計算：toCurrency → fromCurrency，使用 1/rate
 *   3. 交叉匯率：fromCurrency → USD → toCurrency
 *   4. 找不到：返回 404 錯誤
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // 驗證請求體
    const parsed = convertSchema.safeParse(body)
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

    const { fromCurrency, toCurrency, amount, year } = parsed.data

    // 執行轉換
    const result = await convert(fromCurrency, toCurrency, amount, year)

    return NextResponse.json({
      success: true,
      data: result,
    })
  } catch (error) {
    // Zod 驗證錯誤（refinement 錯誤）
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/validation',
          title: 'Validation Error',
          status: 400,
          detail: 'Invalid request body',
          errors: error.flatten().fieldErrors,
        },
        { status: 400 }
      )
    }

    // 匯率找不到錯誤
    if (error instanceof Error && error.message.includes('找不到')) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/rate-not-found',
          title: 'Exchange Rate Not Found',
          status: 404,
          detail: error.message,
        },
        { status: 404 }
      )
    }

    console.error('[ExchangeRate:Convert] Error:', error)
    return NextResponse.json(
      {
        type: 'https://api.example.com/errors/internal',
        title: 'Internal Server Error',
        status: 500,
        detail: 'An unexpected error occurred while converting currency',
      },
      { status: 500 }
    )
  }
}
