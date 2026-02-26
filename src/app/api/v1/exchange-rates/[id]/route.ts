/**
 * @fileoverview Exchange Rate API - 單一資源操作
 * @description
 *   提供單一 Exchange Rate 的查詢、更新、刪除功能。
 *   刪除採用硬刪除方式，同時級聯刪除自動產生的反向記錄。
 *
 * @module src/app/api/v1/exchange-rates/[id]
 * @since Epic 21 - Story 21.3
 * @lastModified 2026-02-05
 *
 * @endpoints
 *   GET    /api/v1/exchange-rates/:id - 取得匯率詳情（含反向記錄關聯）
 *   PATCH  /api/v1/exchange-rates/:id - 更新匯率記錄（部分更新）
 *   DELETE /api/v1/exchange-rates/:id - 刪除匯率記錄（含反向記錄級聯刪除）
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  getExchangeRateById,
  updateExchangeRate,
  deleteExchangeRate,
} from '@/services/exchange-rate.service'
import { updateExchangeRateSchema } from '@/lib/validations/exchange-rate.schema'
import { z } from 'zod'
import { Prisma } from '@prisma/client'

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
 * GET /api/v1/exchange-rates/:id
 * 取得單一匯率記錄詳情
 */
export async function GET(
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

    // 查詢匯率記錄
    const item = await getExchangeRateById(id)

    if (!item) {
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

    return NextResponse.json({
      success: true,
      data: item,
    })
  } catch (error) {
    console.error('[ExchangeRate:GET:id] Error:', error)
    return NextResponse.json(
      {
        type: 'https://api.example.com/errors/internal',
        title: 'Internal Server Error',
        status: 500,
        detail: 'An unexpected error occurred while fetching exchange rate',
      },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/v1/exchange-rates/:id
 * 更新匯率記錄（部分更新）
 */
export async function PATCH(
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

    // 解析請求體
    const body = await request.json()

    // 驗證請求體
    const parsed = updateExchangeRateSchema.safeParse(body)
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

    // 更新匯率記錄
    const item = await updateExchangeRate(id, parsed.data)

    return NextResponse.json({
      success: true,
      data: item,
    })
  } catch (error) {
    console.error('[ExchangeRate:PATCH] Error:', error)

    // 處理特定錯誤
    if (error instanceof Error) {
      if (error.message === '匯率記錄不存在') {
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
        detail: 'An unexpected error occurred while updating exchange rate',
      },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/v1/exchange-rates/:id
 * 刪除匯率記錄（含反向記錄級聯刪除）
 */
export async function DELETE(
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

    // 刪除匯率記錄（含反向記錄）
    await deleteExchangeRate(id)

    return NextResponse.json({
      success: true,
    })
  } catch (error) {
    console.error('[ExchangeRate:DELETE] Error:', error)

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
        detail: 'An unexpected error occurred while deleting exchange rate',
      },
      { status: 500 }
    )
  }
}
