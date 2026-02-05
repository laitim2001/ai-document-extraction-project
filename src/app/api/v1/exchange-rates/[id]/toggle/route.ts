/**
 * @fileoverview Exchange Rate API - 切換啟用狀態
 * @description
 *   提供 Exchange Rate 的啟用/停用狀態切換功能。
 *   isActive 在 true/false 之間切換。
 *
 * @module src/app/api/v1/exchange-rates/[id]/toggle
 * @since Epic 21 - Story 21.3
 * @lastModified 2026-02-05
 *
 * @endpoints
 *   POST /api/v1/exchange-rates/:id/toggle - 切換匯率記錄的啟用狀態
 */

import { NextRequest, NextResponse } from 'next/server'
import { toggleExchangeRate } from '@/services/exchange-rate.service'
import { z } from 'zod'

// =====================
// Route Params Type
// =====================

interface RouteParams {
  params: Promise<{ id: string }>
}

// =====================
// Validation
// =====================

const idParamSchema = z.object({
  id: z.string().min(1, { message: 'ID is required' }),
})

// =====================
// API Handlers
// =====================

/**
 * POST /api/v1/exchange-rates/:id/toggle
 * 切換匯率記錄的啟用/停用狀態
 */
export async function POST(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params

    // 驗證 ID 格式
    const parsedId = idParamSchema.safeParse({ id })
    if (!parsedId.success) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/validation',
          title: 'Validation Error',
          status: 400,
          detail: 'Invalid exchange rate ID',
          errors: parsedId.error.flatten().fieldErrors,
        },
        { status: 400 }
      )
    }

    // 切換狀態
    const item = await toggleExchangeRate(id)

    return NextResponse.json({
      success: true,
      data: item,
    })
  } catch (error) {
    console.error('[ExchangeRate:Toggle] Error:', error)

    // 處理特定錯誤
    if (error instanceof Error && error.message === '匯率記錄不存在') {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/not-found',
          title: 'Not Found',
          status: 404,
          detail: '匯率記錄不存在',
        },
        { status: 404 }
      )
    }

    return NextResponse.json(
      {
        type: 'https://api.example.com/errors/internal',
        title: 'Internal Server Error',
        status: 500,
        detail: 'An unexpected error occurred while toggling exchange rate status',
      },
      { status: 500 }
    )
  }
}
