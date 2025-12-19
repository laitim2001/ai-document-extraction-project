/**
 * @fileoverview GET /api/cities/accessible - 獲取用戶可訪問城市 API
 * @description
 *   本 API 返回當前登入用戶可訪問的城市列表，含區域資訊。
 *   用於城市篩選組件，支援以下場景：
 *   - 全域管理員：返回所有活躍城市
 *   - 區域經理：返回其管理區域內的所有城市
 *   - 一般用戶：返回其被授權訪問的城市
 *
 * @module src/app/api/cities/accessible
 * @author Development Team
 * @since Epic 6 - Story 6.3 (Regional Manager Cross-City Access)
 * @lastModified 2025-12-19
 *
 * @features
 *   - 基於用戶權限的城市過濾
 *   - 城市依區域分組
 *   - 支援全域管理員/區域經理/一般用戶
 *
 * @dependencies
 *   - @/lib/auth - NextAuth 認證
 *   - @/services/regional-manager.service - 區域經理服務
 *
 * @related
 *   - src/components/filters/CityFilter.tsx - 城市篩選組件
 *   - src/hooks/useCityFilter.ts - 城市篩選 Hook
 */

import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { RegionalManagerService } from '@/services/regional-manager.service'

/**
 * 可訪問城市資訊
 */
interface AccessibleCity {
  code: string
  name: string
  region: {
    code: string
    name: string
  }
}

/**
 * GET /api/cities/accessible
 *
 * @description 獲取當前用戶可訪問的城市列表，含區域資訊
 * @returns {Promise<NextResponse>} 城市列表或錯誤響應
 *
 * @example
 * // Response
 * {
 *   success: true,
 *   data: [
 *     { code: "HKG", name: "香港", region: { code: "APAC", name: "亞太區" } },
 *     { code: "SIN", name: "新加坡", region: { code: "APAC", name: "亞太區" } }
 *   ]
 * }
 */
export async function GET(): Promise<NextResponse> {
  try {
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/unauthorized',
          title: 'Unauthorized',
          status: 401,
          detail: 'Authentication required',
        },
        { status: 401 }
      )
    }

    const { user } = session
    const isGlobalAdmin = user.isGlobalAdmin ?? false

    // 獲取用戶可訪問的城市
    const cities = await RegionalManagerService.getAccessibleCities(
      user.id,
      isGlobalAdmin
    )

    // 轉換為 API 響應格式
    const accessibleCities: AccessibleCity[] = cities.map((city) => ({
      code: city.code,
      name: city.name,
      region: {
        code: city.regionCode,
        name: city.regionName,
      },
    }))

    return NextResponse.json({
      success: true,
      data: accessibleCities,
      meta: {
        total: accessibleCities.length,
        isGlobalAdmin,
        isRegionalManager: user.isRegionalManager ?? false,
      },
    })
  } catch (error) {
    console.error('Error fetching accessible cities:', error)

    return NextResponse.json(
      {
        type: 'https://api.example.com/errors/internal',
        title: 'Internal Server Error',
        status: 500,
        detail: 'Failed to fetch accessible cities',
      },
      { status: 500 }
    )
  }
}
