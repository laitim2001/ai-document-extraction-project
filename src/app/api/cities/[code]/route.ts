/**
 * @fileoverview 單一城市 API 端點
 * @description
 *   提供單一城市資訊查詢的 RESTful API。
 *   需要認證才能存取。
 *
 *   端點：
 *   - GET /api/cities/[code] - 根據城市代碼獲取城市資訊
 *
 * @module src/app/api/cities/[code]/route
 * @author Development Team
 * @since Epic 6 - Story 6.2 (City User Data Access Control)
 * @lastModified 2025-12-19
 *
 * @dependencies
 *   - next/server - Next.js API 處理
 *   - @/lib/auth - NextAuth 認證
 *   - @/lib/prisma - Prisma 客戶端
 *
 * @related
 *   - src/app/api/cities/route.ts - 城市列表 API
 *   - src/components/layout/CityIndicator.tsx - 城市指示器組件
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// ===========================================
// Types
// ===========================================

interface RouteParams {
  params: Promise<{
    code: string
  }>
}

// ===========================================
// GET Handler
// ===========================================

/**
 * GET /api/cities/[code]
 * 根據城市代碼獲取城市詳細資訊
 *
 * @param request - Next.js 請求對象
 * @param context - 路由上下文（包含 params）
 * @returns 城市詳細資訊
 *
 * @example
 *   GET /api/cities/HKG
 *   Response:
 *   {
 *     "success": true,
 *     "data": {
 *       "id": "city-id",
 *       "code": "HKG",
 *       "name": "Hong Kong",
 *       "region": {
 *         "code": "APAC",
 *         "name": "Asia Pacific"
 *       }
 *     }
 *   }
 */
export async function GET(request: NextRequest, context: RouteParams) {
  try {
    // 驗證認證狀態
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json(
        {
          success: false,
          error: {
            type: 'https://api.example.com/errors/unauthorized',
            title: 'Unauthorized',
            status: 401,
            detail: 'Authentication required',
          },
        },
        { status: 401 }
      )
    }

    // 獲取路由參數
    const params = await context.params
    const { code } = params

    // 驗證城市代碼格式
    if (!code || typeof code !== 'string' || code.length < 2 || code.length > 10) {
      return NextResponse.json(
        {
          success: false,
          error: {
            type: 'https://api.example.com/errors/validation',
            title: 'Validation Error',
            status: 400,
            detail: 'Invalid city code format',
          },
        },
        { status: 400 }
      )
    }

    // 查詢城市資訊（大小寫不敏感）
    const city = await prisma.city.findFirst({
      where: {
        code: {
          equals: code.toUpperCase(),
          mode: 'insensitive',
        },
      },
      include: {
        region: {
          select: {
            code: true,
            name: true,
          },
        },
      },
    })

    // 城市不存在
    if (!city) {
      return NextResponse.json(
        {
          success: false,
          error: {
            type: 'https://api.example.com/errors/not-found',
            title: 'Not Found',
            status: 404,
            detail: `City with code "${code}" not found`,
          },
        },
        { status: 404 }
      )
    }

    // 返回城市資訊
    return NextResponse.json({
      success: true,
      data: {
        id: city.id,
        code: city.code,
        name: city.name,
        status: city.status,
        timezone: city.timezone,
        region: city.region
          ? {
              code: city.region.code,
              name: city.region.name,
            }
          : null,
      },
    })
  } catch (error) {
    console.error('Get city by code error:', error)

    return NextResponse.json(
      {
        success: false,
        error: {
          type: 'https://api.example.com/errors/internal-server-error',
          title: 'Internal Server Error',
          status: 500,
          detail: 'Failed to fetch city information',
        },
      },
      { status: 500 }
    )
  }
}
