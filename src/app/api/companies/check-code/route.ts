/**
 * @fileoverview Company Code Availability Check API
 * @description
 *   檢查 Company 代碼是否可用的 API 端點
 *   用於創建或更新 Company 時的即時驗證
 *
 * @module src/app/api/companies/check-code
 * @since REFACTOR-001 (Forwarder → Company)
 * @lastModified 2025-12-22
 *
 * @features
 *   - GET: 檢查代碼是否已被使用
 *   - 支援排除特定 Company (用於更新場景)
 *
 * @related
 *   - src/services/company.service.ts - getCompanyByCode
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

// 查詢參數 Schema
const CheckCodeSchema = z.object({
  code: z.string().min(1).max(20),
  excludeId: z.string().optional(),
})

// ============================================================
// GET /api/companies/check-code - 檢查代碼可用性
// ============================================================

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
          instance: '/api/companies/check-code',
        },
        { status: 401 }
      )
    }

    // 2. 解析查詢參數
    const { searchParams } = new URL(request.url)
    const queryParams = {
      code: searchParams.get('code') ?? '',
      excludeId: searchParams.get('excludeId') ?? undefined,
    }

    // 3. 驗證參數
    const { code, excludeId } = CheckCodeSchema.parse(queryParams)

    // 4. 檢查代碼是否存在
    const existingCompany = await prisma.company.findFirst({
      where: {
        code: {
          equals: code,
          mode: 'insensitive', // 不區分大小寫
        },
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: {
        id: true,
        code: true,
        name: true,
      },
    })

    // 5. 返回結果
    return NextResponse.json({
      success: true,
      data: {
        available: !existingCompany,
        code,
        existingCompany: existingCompany
          ? {
              id: existingCompany.id,
              code: existingCompany.code,
              name: existingCompany.name,
            }
          : null,
      },
    })
  } catch (error) {
    // Zod 驗證錯誤
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/validation',
          title: 'Validation Error',
          status: 400,
          detail: 'Query parameters validation failed',
          instance: '/api/companies/check-code',
          errors: error.flatten().fieldErrors,
        },
        { status: 400 }
      )
    }

    // 其他錯誤
    console.error('[API] GET /api/companies/check-code error:', error)
    return NextResponse.json(
      {
        type: 'https://api.example.com/errors/internal',
        title: 'Internal Server Error',
        status: 500,
        detail: 'An unexpected error occurred',
        instance: '/api/companies/check-code',
      },
      { status: 500 }
    )
  }
}
