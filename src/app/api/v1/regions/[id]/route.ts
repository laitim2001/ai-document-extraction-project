/**
 * @fileoverview Region API - 單一資源操作
 * @description
 *   提供單一 Region 的查詢、更新、刪除功能。
 *   刪除功能有保護機制：系統預設和有關聯記錄的 Region 不可刪除。
 *
 * @module src/app/api/v1/regions/[id]
 * @since Epic 20 - Story 20.2 (Region Management API & UI)
 * @lastModified 2026-02-05
 *
 * @endpoints
 *   GET    /api/v1/regions/:id - 取得 Region 詳情
 *   PATCH  /api/v1/regions/:id - 更新 Region
 *   DELETE /api/v1/regions/:id - 刪除 Region（軟刪除）
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  getRegionById,
  updateRegion,
  deleteRegion,
} from '@/services/region.service'
import {
  regionIdParamSchema,
  updateRegionSchema,
} from '@/lib/validations/region.schema'

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
 * GET /api/v1/regions/:id
 * 取得單一 Region 詳情
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params

    // 驗證 ID 格式
    const parsedId = regionIdParamSchema.safeParse({ id })
    if (!parsedId.success) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/validation',
          title: 'Validation Error',
          status: 400,
          detail: 'Invalid region ID',
          errors: parsedId.error.flatten().fieldErrors,
        },
        { status: 400 }
      )
    }

    // 查詢 Region
    const region = await getRegionById(id)

    if (!region) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/not-found',
          title: 'Not Found',
          status: 404,
          detail: '地區不存在',
        },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: region,
    })
  } catch (error) {
    console.error('[Region:GET:id] Error:', error)
    return NextResponse.json(
      {
        type: 'https://api.example.com/errors/internal',
        title: 'Internal Server Error',
        status: 500,
        detail: 'An unexpected error occurred while fetching region',
      },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/v1/regions/:id
 * 更新 Region
 */
export async function PATCH(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params

    // 驗證 ID 格式
    const parsedId = regionIdParamSchema.safeParse({ id })
    if (!parsedId.success) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/validation',
          title: 'Validation Error',
          status: 400,
          detail: 'Invalid region ID',
          errors: parsedId.error.flatten().fieldErrors,
        },
        { status: 400 }
      )
    }

    // 解析請求體
    const body = await request.json()

    // 驗證請求體
    const parsed = updateRegionSchema.safeParse(body)
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

    // 更新 Region
    const region = await updateRegion(id, parsed.data)

    return NextResponse.json({
      success: true,
      data: region,
    })
  } catch (error) {
    console.error('[Region:PATCH] Error:', error)

    // 處理特定錯誤
    if (error instanceof Error && error.message === 'Region 不存在') {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/not-found',
          title: 'Not Found',
          status: 404,
          detail: '地區不存在',
        },
        { status: 404 }
      )
    }

    return NextResponse.json(
      {
        type: 'https://api.example.com/errors/internal',
        title: 'Internal Server Error',
        status: 500,
        detail: 'An unexpected error occurred while updating region',
      },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/v1/regions/:id
 * 刪除 Region（軟刪除）
 *
 * @description
 *   限制：
 *   - isDefault = true 的 Region 不可刪除
 *   - 有關聯 ReferenceNumber 的 Region 不可刪除
 */
export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params

    // 驗證 ID 格式
    const parsedId = regionIdParamSchema.safeParse({ id })
    if (!parsedId.success) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/validation',
          title: 'Validation Error',
          status: 400,
          detail: 'Invalid region ID',
          errors: parsedId.error.flatten().fieldErrors,
        },
        { status: 400 }
      )
    }

    // 刪除 Region
    await deleteRegion(id)

    return NextResponse.json({
      success: true,
    })
  } catch (error) {
    console.error('[Region:DELETE] Error:', error)

    // 處理特定錯誤
    if (error instanceof Error) {
      if (error.message === 'Region 不存在') {
        return NextResponse.json(
          {
            type: 'https://api.example.com/errors/not-found',
            title: 'Not Found',
            status: 404,
            detail: '地區不存在',
          },
          { status: 404 }
        )
      }

      if (error.message === '無法刪除系統預設地區') {
        return NextResponse.json(
          {
            type: 'https://api.example.com/errors/forbidden',
            title: 'Forbidden',
            status: 403,
            detail: '無法刪除系統預設地區',
          },
          { status: 403 }
        )
      }

      if (error.message.includes('有關聯的 Reference Number')) {
        return NextResponse.json(
          {
            type: 'https://api.example.com/errors/conflict',
            title: 'Conflict',
            status: 409,
            detail: '此地區有關聯的 Reference Number，無法刪除',
          },
          { status: 409 }
        )
      }
    }

    return NextResponse.json(
      {
        type: 'https://api.example.com/errors/internal',
        title: 'Internal Server Error',
        status: 500,
        detail: 'An unexpected error occurred while deleting region',
      },
      { status: 500 }
    )
  }
}
