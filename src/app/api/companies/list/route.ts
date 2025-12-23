/**
 * @fileoverview Companies List API - Simplified List for Dropdowns
 * @description
 *   提供簡化的 Company 列表，用於下拉選單等場景
 *   只返回必要欄位，支援快取
 *
 * @module src/app/api/companies/list
 * @since REFACTOR-001 (Forwarder → Company)
 * @lastModified 2025-12-22
 *
 * @features
 *   - 簡化的響應結構 (id, code, name, displayName, type)
 *   - 支援按類型篩選
 *   - 5 分鐘快取
 *
 * @related
 *   - src/hooks/useCompanyList.ts - 前端 Hook
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { CompanyStatus, CompanyType } from '@prisma/client'
import { z } from 'zod'

// 查詢參數 Schema
const ListQuerySchema = z.object({
  activeOnly: z
    .string()
    .optional()
    .transform((val) => val === 'true'),
  type: z.nativeEnum(CompanyType).optional(),
})

export async function GET(request: NextRequest) {
  try {
    // 1. 驗證用戶身份
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/unauthorized',
          title: 'Unauthorized',
          status: 401,
          detail: 'Authentication required',
          instance: '/api/companies/list',
        },
        { status: 401 }
      )
    }

    // 2. 解析查詢參數
    const { searchParams } = new URL(request.url)
    const queryParams = {
      activeOnly: searchParams.get('activeOnly') ?? undefined,
      type: searchParams.get('type') ?? undefined,
    }

    // 移除 undefined 值
    const cleanedParams = Object.fromEntries(
      Object.entries(queryParams).filter(([, v]) => v !== undefined)
    )

    const { activeOnly, type } = ListQuerySchema.parse(cleanedParams)

    // 3. 查詢 Companies
    const companies = await prisma.company.findMany({
      where: {
        ...(activeOnly ? { status: CompanyStatus.ACTIVE } : {}),
        ...(type ? { type } : {}),
      },
      select: {
        id: true,
        code: true,
        name: true,
        displayName: true,
        type: true,
        status: true,
      },
      orderBy: [
        { displayName: 'asc' },
        { name: 'asc' },
      ],
    })

    // 4. 返回結果（帶快取 header）
    return NextResponse.json(
      {
        success: true,
        data: companies,
      },
      {
        headers: {
          'Cache-Control': 'private, max-age=300', // 5 分鐘快取
        },
      }
    )
  } catch (error) {
    // Zod 驗證錯誤
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/validation',
          title: 'Validation Error',
          status: 400,
          detail: 'Query parameters validation failed',
          instance: '/api/companies/list',
          errors: error.flatten().fieldErrors,
        },
        { status: 400 }
      )
    }

    // 其他錯誤
    console.error('[API] GET /api/companies/list error:', error)
    return NextResponse.json(
      {
        type: 'https://api.example.com/errors/internal',
        title: 'Internal Server Error',
        status: 500,
        detail: 'An unexpected error occurred',
        instance: '/api/companies/list',
      },
      { status: 500 }
    )
  }
}
