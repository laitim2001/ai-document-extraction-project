/**
 * @fileoverview Region API - 列表與建立
 * @description
 *   提供 Region 的列表查詢和建立功能。
 *   Region 用於分類管理城市和 Reference Number。
 *
 * @module src/app/api/v1/regions
 * @since Epic 20 - Story 20.2 (Region Management API & UI)
 * @lastModified 2026-02-05
 *
 * @endpoints
 *   GET  /api/v1/regions - 列表查詢（支援 isActive 篩選）
 *   POST /api/v1/regions - 建立新 Region
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  getRegions,
  createRegion,
  regionCodeExists,
} from '@/services/region.service'
import {
  createRegionSchema,
  getRegionsQuerySchema,
} from '@/lib/validations/region.schema'
import { Prisma } from '@prisma/client'

// =====================
// API Handlers
// =====================

/**
 * GET /api/v1/regions
 * 查詢 Region 列表
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const queryParams = Object.fromEntries(searchParams.entries())

    // 驗證查詢參數
    const parsed = getRegionsQuerySchema.safeParse(queryParams)
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

    const { isActive } = parsed.data

    // 查詢資料
    const regions = await getRegions(isActive)

    return NextResponse.json({
      success: true,
      data: regions,
    })
  } catch (error) {
    console.error('[Region:GET] Error:', error)
    return NextResponse.json(
      {
        type: 'https://api.example.com/errors/internal',
        title: 'Internal Server Error',
        status: 500,
        detail: 'An unexpected error occurred while fetching regions',
      },
      { status: 500 }
    )
  }
}

/**
 * POST /api/v1/regions
 * 建立新的 Region
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // 驗證請求體
    const parsed = createRegionSchema.safeParse(body)
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

    const { code, name, description, sortOrder } = parsed.data

    // 檢查代碼唯一性
    const codeExists = await regionCodeExists(code.toUpperCase())
    if (codeExists) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/conflict',
          title: 'Conflict',
          status: 409,
          detail: `Region 代碼 "${code.toUpperCase()}" 已存在`,
        },
        { status: 409 }
      )
    }

    // 建立 Region
    const region = await createRegion({
      code,
      name,
      description,
      sortOrder,
    })

    return NextResponse.json(
      {
        success: true,
        data: region,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('[Region:POST] Error:', error)

    // 處理唯一約束違反
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/conflict',
          title: 'Conflict',
          status: 409,
          detail: 'A region with this code already exists',
        },
        { status: 409 }
      )
    }

    return NextResponse.json(
      {
        type: 'https://api.example.com/errors/internal',
        title: 'Internal Server Error',
        status: 500,
        detail: 'An unexpected error occurred while creating region',
      },
      { status: 500 }
    )
  }
}
