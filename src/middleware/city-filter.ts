/**
 * @fileoverview 城市數據過濾中間件
 * @description
 *   提供 API 層的城市數據過濾功能：
 *   - 自動過濾用戶授權城市的數據
 *   - 驗證請求的城市訪問權限
 *   - 構建 Prisma where 子句
 *
 *   ## 三層防護機制
 *   1. RLS（資料庫層）- Story 6.1
 *   2. API 中間件（本模組）
 *   3. UI 組件（CityRestricted）
 *
 * @module src/middleware/city-filter
 * @author Development Team
 * @since Epic 6 - Story 6.2 (City User Data Access Control)
 * @lastModified 2025-12-19
 *
 * @dependencies
 *   - next/server - Next.js API 處理
 *   - @/lib/auth - NextAuth 認證
 *
 * @related
 *   - src/middleware/resource-access.ts - 資源訪問驗證
 *   - src/services/security-log.ts - 安全日誌服務
 *   - src/hooks/useUserCity.ts - 前端城市訪問 Hook
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'

// ===========================================
// Types
// ===========================================

/**
 * 城市過濾上下文
 * @description 傳遞給 API handlers 的城市訪問資訊
 */
export interface CityFilterContext {
  /** 是否為全球管理員 */
  isGlobalAdmin: boolean
  /** 是否為區域管理員 */
  isRegionalManager: boolean
  /** 授權城市代碼列表 */
  cityCodes: string[]
  /** 用戶主要城市代碼 */
  primaryCityCode: string | null
  /** 是否為單一城市訪問 */
  isSingleCity: boolean
  /** 用戶 ID（用於審計） */
  userId: string
}

/**
 * 城市驗證結果
 */
export interface CityValidationResult {
  /** 驗證是否通過 */
  valid: boolean
  /** 允許訪問的城市 */
  allowed: string[]
  /** 未授權的城市 */
  unauthorized: string[]
}

// ===========================================
// withCityFilter Higher-Order Function
// ===========================================

/**
 * 城市過濾高階函數
 *
 * @description
 *   包裝 API handlers 以自動注入城市過濾上下文。
 *   - 驗證用戶認證狀態
 *   - 構建城市訪問上下文
 *   - 檢查用戶是否有城市訪問權限
 *
 * @param handler - 原始 API handler
 * @returns 包裝後的 handler
 *
 * @example
 *   export const GET = withCityFilter(async (request, cityContext) => {
 *     const where = buildCityWhereClause(cityContext)
 *     const documents = await prisma.document.findMany({ where })
 *     return NextResponse.json({ data: documents })
 *   })
 */
export function withCityFilter<T>(
  handler: (
    request: NextRequest,
    context: CityFilterContext,
    params?: T
  ) => Promise<NextResponse>
) {
  return async (request: NextRequest, routeContext?: { params: T }) => {
    const session = await auth()

    // 認證檢查
    if (!session?.user) {
      return NextResponse.json(
        {
          success: false,
          error: {
            type: 'https://api.example.com/errors/unauthorized',
            title: 'Authentication required',
            status: 401,
            detail: '請先登入以訪問此資源',
          },
        },
        { status: 401 }
      )
    }

    // 構建城市過濾上下文
    const cityContext: CityFilterContext = {
      isGlobalAdmin: session.user.isGlobalAdmin || false,
      isRegionalManager: session.user.isRegionalManager || false,
      cityCodes: session.user.cityCodes || [],
      primaryCityCode: session.user.primaryCityCode || null,
      isSingleCity:
        (session.user.cityCodes?.length || 0) === 1 &&
        !session.user.isGlobalAdmin,
      userId: session.user.id,
    }

    // 檢查用戶是否有城市訪問權限（全球管理員除外）
    if (!cityContext.isGlobalAdmin && cityContext.cityCodes.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: {
            type: 'https://api.example.com/errors/no-city-access',
            title: 'No city access configured',
            status: 403,
            detail: '您尚未被分配任何城市訪問權限，請聯繫管理員',
          },
        },
        { status: 403 }
      )
    }

    return handler(request, cityContext, routeContext?.params)
  }
}

// ===========================================
// validateRequestedCities Function
// ===========================================

/**
 * 驗證請求的城市是否在用戶授權範圍內
 *
 * @description
 *   檢查用戶請求訪問的城市是否被授權：
 *   - 全球管理員可訪問任何城市
 *   - 如未指定城市，返回所有授權城市
 *   - 部分授權時返回允許和未授權的城市列表
 *
 * @param requestedCities - 請求的城市代碼列表
 * @param context - 城市過濾上下文
 * @returns 驗證結果
 *
 * @example
 *   const validation = validateRequestedCities(['HKG', 'NYC'], cityContext)
 *   if (!validation.valid) {
 *     // 記錄未授權訪問嘗試
 *     await SecurityLogService.logUnauthorizedAccess(...)
 *   }
 */
export function validateRequestedCities(
  requestedCities: string[] | undefined,
  context: CityFilterContext
): CityValidationResult {
  // 全球管理員可訪問任何城市
  if (context.isGlobalAdmin) {
    return {
      valid: true,
      allowed: requestedCities || [],
      unauthorized: [],
    }
  }

  // 如未指定城市，使用所有授權城市
  if (!requestedCities || requestedCities.length === 0) {
    return {
      valid: true,
      allowed: context.cityCodes,
      unauthorized: [],
    }
  }

  // 檢查每個請求的城市
  const unauthorized = requestedCities.filter(
    (city) => !context.cityCodes.includes(city)
  )

  if (unauthorized.length > 0) {
    return {
      valid: false,
      allowed: requestedCities.filter((city) =>
        context.cityCodes.includes(city)
      ),
      unauthorized,
    }
  }

  return {
    valid: true,
    allowed: requestedCities,
    unauthorized: [],
  }
}

// ===========================================
// buildCityWhereClause Function
// ===========================================

/**
 * 構建 Prisma where 子句用於城市過濾
 *
 * @description
 *   根據用戶的城市訪問權限構建 Prisma where 條件：
 *   - 全球管理員：無限制（空對象）
 *   - 單一城市：直接等於條件
 *   - 多城市：IN 條件
 *   - 無城市：返回不可能條件確保無結果
 *
 * @param context - 城市過濾上下文
 * @param fieldName - 城市代碼欄位名稱（預設 'cityCode'）
 * @param requestedCities - 請求的特定城市（可選）
 * @returns Prisma where 子句對象
 *
 * @example
 *   // 基本用法
 *   const where = buildCityWhereClause(cityContext)
 *   const documents = await prisma.document.findMany({ where })
 *
 *   // 自定義欄位名稱
 *   const where = buildCityWhereClause(cityContext, 'document.cityCode')
 *
 *   // 指定特定城市過濾
 *   const where = buildCityWhereClause(cityContext, 'cityCode', ['HKG'])
 */
export function buildCityWhereClause(
  context: CityFilterContext,
  fieldName: string = 'cityCode',
  requestedCities?: string[]
): Record<string, unknown> {
  // 全球管理員且未指定特定城市過濾
  if (
    context.isGlobalAdmin &&
    (!requestedCities || requestedCities.length === 0)
  ) {
    return {}
  }

  // 計算實際過濾的城市
  const citiesToFilter = requestedCities?.length
    ? requestedCities.filter(
        (c) => context.isGlobalAdmin || context.cityCodes.includes(c)
      )
    : context.cityCodes

  // 無城市時返回不可能條件
  if (citiesToFilter.length === 0) {
    return { [fieldName]: { equals: '__NONE__' } }
  }

  // 單一城市使用等於條件
  if (citiesToFilter.length === 1) {
    return { [fieldName]: citiesToFilter[0] }
  }

  // 多城市使用 IN 條件
  return { [fieldName]: { in: citiesToFilter } }
}

// ===========================================
// Helper Functions
// ===========================================

/**
 * 從請求中提取城市參數
 *
 * @param request - Next.js 請求對象
 * @param paramName - 參數名稱（預設 'cities'）
 * @returns 城市代碼列表或 undefined
 */
export function extractCitiesFromRequest(
  request: NextRequest,
  paramName: string = 'cities'
): string[] | undefined {
  const citiesParam = request.nextUrl.searchParams.get(paramName)
  if (!citiesParam) return undefined

  return citiesParam
    .split(',')
    .map((c) => c.trim())
    .filter(Boolean)
}

/**
 * 獲取客戶端 IP 地址
 *
 * @param request - Next.js 請求對象
 * @returns IP 地址或 undefined
 */
export function getClientIp(request?: NextRequest): string | undefined {
  if (!request) return undefined

  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    undefined
  )
}
