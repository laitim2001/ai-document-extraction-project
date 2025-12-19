/**
 * @fileoverview City API 端點
 * @description
 *   提供城市資料的查詢 API。
 *   支援列表查詢和按區域分組。
 *
 *   端點：
 *   - GET /api/admin/cities - 獲取城市列表
 *
 *   權限要求：
 *   - USER_VIEW 或 USER_MANAGE 或 USER_MANAGE_CITY 權限
 *
 * @module src/app/api/admin/cities/route
 * @author Development Team
 * @since Epic 1 - Story 1.8 (City Manager User Management)
 * @lastModified 2025-12-18
 *
 * @dependencies
 *   - next/server - Next.js API 處理
 *   - @/lib/auth - NextAuth 認證
 *   - @/services/city.service - 城市服務層
 *   - @/lib/auth/city-permission - 城市權限中間件
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getAllActiveCities, getCitiesByRegion } from '@/services/city.service'
import { hasViewPermission, getManagedCityIds } from '@/lib/auth/city-permission'

/**
 * GET /api/admin/cities
 * 獲取城市列表
 *
 * @description
 *   返回用戶可存取的城市列表。
 *   - 全域權限用戶：返回所有城市
 *   - City Manager：只返回所屬城市
 *
 * @query grouped - 是否按區域分組 (true/false，預設 false)
 *
 * @returns 城市列表或按區域分組的城市列表
 *
 * @example
 *   GET /api/admin/cities
 *   GET /api/admin/cities?grouped=true
 */
export async function GET(request: NextRequest) {
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

    // 檢查檢視權限
    if (!hasViewPermission(session.user)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            type: 'https://api.example.com/errors/forbidden',
            title: 'Forbidden',
            status: 403,
            detail: 'Permission denied',
          },
        },
        { status: 403 }
      )
    }

    // 解析查詢參數
    const { searchParams } = new URL(request.url)
    const grouped = searchParams.get('grouped') === 'true'

    // 獲取用戶可管理的城市 ID（null 表示全域權限）
    const managedCityIds = getManagedCityIds(session.user)

    if (grouped) {
      // 按區域分組返回
      const citiesByRegion = await getCitiesByRegion(managedCityIds)
      return NextResponse.json({
        success: true,
        data: citiesByRegion,
      })
    }

    // 平面列表返回
    const cities = await getAllActiveCities()

    // 如果是 City Manager，過濾為所屬城市
    const filteredCities =
      managedCityIds === null
        ? cities
        : cities.filter((city) => managedCityIds.includes(city.id))

    return NextResponse.json({
      success: true,
      data: filteredCities,
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
