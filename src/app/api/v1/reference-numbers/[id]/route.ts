/**
 * @fileoverview Reference Number API - 單一資源操作
 * @description
 *   提供單一 Reference Number 的查詢、更新、刪除功能。
 *   刪除採用軟刪除方式（isActive = false）。
 *
 * @module src/app/api/v1/reference-numbers/[id]
 * @since Epic 20 - Story 20.3
 * @lastModified 2026-02-05
 *
 * @endpoints
 *   GET    /api/v1/reference-numbers/:id - 取得 Reference Number 詳情
 *   PATCH  /api/v1/reference-numbers/:id - 更新 Reference Number
 *   DELETE /api/v1/reference-numbers/:id - 刪除 Reference Number（軟刪除）
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  getReferenceNumberById,
  updateReferenceNumber,
  deleteReferenceNumber,
} from '@/services/reference-number.service'
import {
  referenceNumberIdParamSchema,
  updateReferenceNumberSchema,
} from '@/lib/validations/reference-number.schema'
import { Prisma } from '@prisma/client'

// =====================
// Route Params Type
// =====================

interface RouteParams {
  params: Promise<{ id: string }>
}

// =====================
// API Handlers
// =====================

/**
 * GET /api/v1/reference-numbers/:id
 * 取得單一 Reference Number 詳情
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params

    // 驗證 ID 格式
    const parsedId = referenceNumberIdParamSchema.safeParse({ id })
    if (!parsedId.success) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/validation',
          title: 'Validation Error',
          status: 400,
          detail: 'Invalid reference number ID',
          errors: parsedId.error.flatten().fieldErrors,
        },
        { status: 400 }
      )
    }

    // 查詢 Reference Number
    const item = await getReferenceNumberById(id)

    if (!item) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/not-found',
          title: 'Not Found',
          status: 404,
          detail: 'Reference Number 不存在',
        },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: item,
    })
  } catch (error) {
    console.error('[ReferenceNumber:GET:id] Error:', error)
    return NextResponse.json(
      {
        type: 'https://api.example.com/errors/internal',
        title: 'Internal Server Error',
        status: 500,
        detail: 'An unexpected error occurred while fetching reference number',
      },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/v1/reference-numbers/:id
 * 更新 Reference Number
 */
export async function PATCH(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params

    // 驗證 ID 格式
    const parsedId = referenceNumberIdParamSchema.safeParse({ id })
    if (!parsedId.success) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/validation',
          title: 'Validation Error',
          status: 400,
          detail: 'Invalid reference number ID',
          errors: parsedId.error.flatten().fieldErrors,
        },
        { status: 400 }
      )
    }

    // 解析請求體
    const body = await request.json()

    // 驗證請求體
    const parsed = updateReferenceNumberSchema.safeParse(body)
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

    // 更新 Reference Number
    const item = await updateReferenceNumber(id, parsed.data)

    return NextResponse.json({
      success: true,
      data: item,
    })
  } catch (error) {
    console.error('[ReferenceNumber:PATCH] Error:', error)

    // 處理特定錯誤
    if (error instanceof Error) {
      if (error.message === 'Reference Number 不存在') {
        return NextResponse.json(
          {
            type: 'https://api.example.com/errors/not-found',
            title: 'Not Found',
            status: 404,
            detail: 'Reference Number 不存在',
          },
          { status: 404 }
        )
      }

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
        detail: 'An unexpected error occurred while updating reference number',
      },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/v1/reference-numbers/:id
 * 刪除 Reference Number（軟刪除）
 */
export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params

    // 驗證 ID 格式
    const parsedId = referenceNumberIdParamSchema.safeParse({ id })
    if (!parsedId.success) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/validation',
          title: 'Validation Error',
          status: 400,
          detail: 'Invalid reference number ID',
          errors: parsedId.error.flatten().fieldErrors,
        },
        { status: 400 }
      )
    }

    // 軟刪除 Reference Number
    await deleteReferenceNumber(id)

    return NextResponse.json({
      success: true,
    })
  } catch (error) {
    console.error('[ReferenceNumber:DELETE] Error:', error)

    // 處理特定錯誤
    if (error instanceof Error && error.message === 'Reference Number 不存在') {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/not-found',
          title: 'Not Found',
          status: 404,
          detail: 'Reference Number 不存在',
        },
        { status: 404 }
      )
    }

    return NextResponse.json(
      {
        type: 'https://api.example.com/errors/internal',
        title: 'Internal Server Error',
        status: 500,
        detail: 'An unexpected error occurred while deleting reference number',
      },
      { status: 500 }
    )
  }
}
