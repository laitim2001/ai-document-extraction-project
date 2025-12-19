/**
 * @fileoverview 城市 API 端點
 * @description
 *   提供城市相關的 RESTful API。
 *   需要認證才能存取。
 *
 *   端點：
 *   - GET /api/cities - 獲取所有活躍城市列表
 *
 * @module src/app/api/cities/route
 * @author Development Team
 * @since Epic 1 - Story 1.3 (User List & Search)
 * @lastModified 2025-12-19
 *
 * @dependencies
 *   - next/server - Next.js API 處理
 *   - @/lib/auth - NextAuth 認證
 *   - @/lib/prisma - Prisma 客戶端
 */

import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/cities
 * 獲取所有活躍城市列表
 *
 * @returns 城市列表（按名稱排序）
 *
 * @example
 *   GET /api/cities
 */
export async function GET() {
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

    // 獲取所有活躍城市 (Updated for Story 6.1)
    const cities = await prisma.city.findMany({
      where: { status: 'ACTIVE' },
      orderBy: { name: 'asc' },
      include: {
        region: { select: { code: true, name: true } },
      },
    })

    // 轉換為 API 響應格式
    const citiesResponse = cities.map((city) => ({
      id: city.id,
      code: city.code,
      name: city.name,
      regionCode: city.region?.code ?? null,
      regionName: city.region?.name ?? null,
    }))

    return NextResponse.json({
      success: true,
      data: citiesResponse,
    })
  } catch (error) {
    console.error('Get cities error:', error)

    return NextResponse.json(
      {
        success: false,
        error: {
          type: 'https://api.example.com/errors/internal-server-error',
          title: 'Internal Server Error',
          status: 500,
          detail: 'Failed to fetch cities',
        },
      },
      { status: 500 }
    )
  }
}
