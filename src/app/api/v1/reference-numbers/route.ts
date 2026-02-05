/**
 * @fileoverview Reference Number API - 列表與建立
 * @description
 *   提供 Reference Number 的列表查詢和建立功能。
 *   支援分頁、篩選、排序等功能。
 *
 * @module src/app/api/v1/reference-numbers
 * @since Epic 20 - Story 20.3
 * @lastModified 2026-02-05
 *
 * @endpoints
 *   GET  /api/v1/reference-numbers - 列表查詢（支援分頁、篩選、排序）
 *   POST /api/v1/reference-numbers - 建立新 Reference Number
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  getReferenceNumbers,
  createReferenceNumber,
} from '@/services/reference-number.service'
import {
  createReferenceNumberSchema,
  getReferenceNumbersQuerySchema,
} from '@/lib/validations/reference-number.schema'
import { Prisma } from '@prisma/client'

// =====================
// API Handlers
// =====================

/**
 * GET /api/v1/reference-numbers
 * 查詢 Reference Number 列表
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const queryParams = Object.fromEntries(searchParams.entries())

    // 驗證查詢參數
    const parsed = getReferenceNumbersQuerySchema.safeParse(queryParams)
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
    const result = await getReferenceNumbers(parsed.data)

    return NextResponse.json({
      success: true,
      data: result.items,
      meta: {
        pagination: result.pagination,
      },
    })
  } catch (error) {
    console.error('[ReferenceNumber:GET] Error:', error)
    return NextResponse.json(
      {
        type: 'https://api.example.com/errors/internal',
        title: 'Internal Server Error',
        status: 500,
        detail: 'An unexpected error occurred while fetching reference numbers',
      },
      { status: 500 }
    )
  }
}

/**
 * POST /api/v1/reference-numbers
 * 建立新的 Reference Number
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // 驗證請求體
    const parsed = createReferenceNumberSchema.safeParse(body)
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

    // 建立 Reference Number
    // 目前使用固定的 createdById，後續整合認證後替換
    const createdById = 'system'
    const item = await createReferenceNumber(parsed.data, createdById)

    return NextResponse.json(
      {
        success: true,
        data: item,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('[ReferenceNumber:POST] Error:', error)

    // 處理業務邏輯錯誤
    if (error instanceof Error) {
      if (error.message === '地區不存在') {
        return NextResponse.json(
          {
            type: 'https://api.example.com/errors/not-found',
            title: 'Not Found',
            status: 404,
            detail: '指定的地區不存在',
          },
          { status: 404 }
        )
      }

      if (error.message.startsWith('此組合已存在')) {
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

      if (error.message.startsWith('識別碼')) {
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
          detail: 'A reference number with this combination already exists',
        },
        { status: 409 }
      )
    }

    return NextResponse.json(
      {
        type: 'https://api.example.com/errors/internal',
        title: 'Internal Server Error',
        status: 500,
        detail: 'An unexpected error occurred while creating reference number',
      },
      { status: 500 }
    )
  }
}
