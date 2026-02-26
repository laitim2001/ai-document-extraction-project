/**
 * @fileoverview Exchange Rate API - 列表與建立
 * @description
 *   提供 Exchange Rate 的列表查詢和建立功能。
 *   支援分頁、篩選（year, fromCurrency, toCurrency, isActive, source）、排序。
 *   建立時支援可選的自動反向匯率建立。
 *
 * @module src/app/api/v1/exchange-rates
 * @since Epic 21 - Story 21.3
 * @lastModified 2026-02-05
 *
 * @endpoints
 *   GET  /api/v1/exchange-rates - 列表查詢（支援分頁、篩選、排序）
 *   POST /api/v1/exchange-rates - 建立新匯率記錄（含可選反向匯率）
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  getExchangeRates,
  createExchangeRate,
} from '@/services/exchange-rate.service'
import {
  createExchangeRateSchema,
  getExchangeRatesQuerySchema,
} from '@/lib/validations/exchange-rate.schema'
import { Prisma } from '@prisma/client'

// =====================
// API Handlers
// =====================

/**
 * GET /api/v1/exchange-rates
 * 查詢匯率列表
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const queryParams = Object.fromEntries(searchParams.entries())

    // 驗證查詢參數
    const parsed = getExchangeRatesQuerySchema.safeParse(queryParams)
    if (!parsed.success) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/validation',
          title: 'Validation Error',
          status: 400,
          detail: 'Invalid query parameters',
          errors: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      )
    }

    // 查詢資料
    const result = await getExchangeRates(parsed.data)

    return NextResponse.json({
      success: true,
      data: result.items,
      meta: {
        pagination: result.pagination,
      },
    })
  } catch (error) {
    console.error('[ExchangeRate:GET] Error:', error)
    return NextResponse.json(
      {
        type: 'https://api.example.com/errors/internal',
        title: 'Internal Server Error',
        status: 500,
        detail: 'An unexpected error occurred while fetching exchange rates',
      },
      { status: 500 }
    )
  }
}

/**
 * POST /api/v1/exchange-rates
 * 建立新的匯率記錄
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // 驗證請求體
    const parsed = createExchangeRateSchema.safeParse(body)
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

    // 建立匯率記錄
    // 目前使用固定的 createdById，後續整合認證後替換
    const createdById = 'system'
    const item = await createExchangeRate(parsed.data, createdById)

    return NextResponse.json(
      {
        success: true,
        data: item,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('[ExchangeRate:POST] Error:', error)

    // 處理業務邏輯錯誤（唯一約束違反）
    if (error instanceof Error) {
      if (error.message.startsWith('匯率記錄已存在')) {
        return NextResponse.json(
          {
            type: 'https://api.example.com/errors/conflict',
            title: 'Conflict',
            status: 409,
            detail: error.message,
          },
          { status: 409 }
        )
      }

      if (error.message.startsWith('反向匯率記錄已存在')) {
        return NextResponse.json(
          {
            type: 'https://api.example.com/errors/conflict',
            title: 'Conflict',
            status: 409,
            detail: error.message,
          },
          { status: 409 }
        )
      }
    }

    // 處理 Prisma 唯一約束違反
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/conflict',
          title: 'Conflict',
          status: 409,
          detail: 'An exchange rate with this currency pair and year already exists',
        },
        { status: 409 }
      )
    }

    return NextResponse.json(
      {
        type: 'https://api.example.com/errors/internal',
        title: 'Internal Server Error',
        status: 500,
        detail: 'An unexpected error occurred while creating exchange rate',
      },
      { status: 500 }
    )
  }
}
