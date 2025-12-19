/**
 * @fileoverview City 服務層
 * @description
 *   提供城市相關的業務邏輯，包含城市查詢、篩選等功能。
 *   支援依區域分組和權限範圍過濾。
 *
 *   主要功能：
 *   - 獲取所有活躍城市（按區域分組）
 *   - 根據 ID 獲取城市
 *   - 根據權限範圍過濾城市
 *
 * @module src/services/city.service
 * @author Development Team
 * @since Epic 1 - Story 1.8 (City Manager User Management)
 * @lastModified 2025-12-19
 *
 * @dependencies
 *   - @prisma/client - Prisma ORM 客戶端
 *   - @/lib/prisma - Prisma 單例實例
 *
 * @related
 *   - src/app/api/admin/cities/route.ts - City API
 *   - src/lib/auth/city-permission.ts - 城市權限中間件
 *   - src/services/city-access.service.ts - 城市權限服務 (Story 6.1)
 */

import { prisma } from '@/lib/prisma'
import type { City, CityStatus } from '@prisma/client'

// ============================================================
// Types
// ============================================================

/**
 * 城市列表項目
 */
export interface CityListItem {
  id: string
  code: string
  name: string
  regionCode: string | null
  status: CityStatus
}

/**
 * 按區域分組的城市列表
 */
export interface CitiesByRegion {
  region: string
  cities: CityListItem[]
}

// ============================================================
// City Queries
// ============================================================

/**
 * 獲取所有活躍城市
 *
 * @description
 *   返回所有 status='ACTIVE' 的城市，按名稱排序。
 *
 * @returns 城市列表
 *
 * @example
 *   const cities = await getAllActiveCities()
 */
export async function getAllActiveCities(): Promise<CityListItem[]> {
  const cities = await prisma.city.findMany({
    where: { status: 'ACTIVE' },
    orderBy: { name: 'asc' },
    include: {
      region: { select: { code: true } },
    },
  })

  return cities.map((city) => ({
    id: city.id,
    code: city.code,
    name: city.name,
    regionCode: city.region?.code ?? null,
    status: city.status,
  }))
}

/**
 * 獲取所有城市（包含非活躍）
 *
 * @description
 *   返回所有城市，按名稱排序。
 *   用於管理介面顯示完整城市清單。
 *
 * @returns 城市列表
 */
export async function getAllCities(): Promise<CityListItem[]> {
  const cities = await prisma.city.findMany({
    orderBy: { name: 'asc' },
    include: {
      region: { select: { code: true } },
    },
  })

  return cities.map((city) => ({
    id: city.id,
    code: city.code,
    name: city.name,
    regionCode: city.region?.code ?? null,
    status: city.status,
  }))
}

/**
 * 獲取城市（按區域分組）
 *
 * @description
 *   返回活躍城市，按區域分組顯示。
 *   區域順序：APAC > EMEA > AMER > 其他
 *
 * @param cityIds - 限制特定城市 ID（可選，用於權限過濾）
 * @returns 按區域分組的城市列表
 *
 * @example
 *   // 獲取所有城市（分組）
 *   const grouped = await getCitiesByRegion()
 *
 *   // 獲取特定城市（權限限制）
 *   const grouped = await getCitiesByRegion(['city-id-1', 'city-id-2'])
 */
export async function getCitiesByRegion(
  cityIds?: string[] | null
): Promise<CitiesByRegion[]> {
  interface CityWhereInput {
    status: CityStatus
    id?: { in: string[] }
  }

  const where: CityWhereInput = { status: 'ACTIVE' }

  // 如果有限制城市 ID，加入過濾條件
  if (cityIds && cityIds.length > 0) {
    where.id = { in: cityIds }
  }

  const cities = await prisma.city.findMany({
    where,
    orderBy: { name: 'asc' },
    include: {
      region: { select: { code: true } },
    },
  })

  // 按區域分組
  const groupedMap = new Map<string, CityListItem[]>()

  cities.forEach((city) => {
    const regionCode = city.region?.code || 'Other'
    if (!groupedMap.has(regionCode)) {
      groupedMap.set(regionCode, [])
    }
    groupedMap.get(regionCode)!.push({
      id: city.id,
      code: city.code,
      name: city.name,
      regionCode: city.region?.code ?? null,
      status: city.status,
    })
  })

  // 定義區域排序順序
  const regionOrder = ['APAC', 'EMEA', 'AMER', 'Other']

  // 轉換為陣列並排序
  const result: CitiesByRegion[] = []

  regionOrder.forEach((region) => {
    if (groupedMap.has(region)) {
      result.push({
        region,
        cities: groupedMap.get(region)!,
      })
      groupedMap.delete(region)
    }
  })

  // 添加其他未在順序列表中的區域
  groupedMap.forEach((cities, region) => {
    result.push({ region, cities })
  })

  return result
}

/**
 * 根據 ID 獲取城市
 *
 * @param id - 城市 ID
 * @returns 城市或 null
 */
export async function getCityById(id: string): Promise<City | null> {
  return prisma.city.findUnique({
    where: { id },
  })
}

/**
 * 根據代碼獲取城市
 *
 * @param code - 城市代碼 (如 'TPE', 'HKG')
 * @returns 城市或 null
 */
export async function getCityByCode(code: string): Promise<City | null> {
  return prisma.city.findUnique({
    where: { code },
  })
}

/**
 * 根據多個 ID 獲取城市
 *
 * @param ids - 城市 ID 列表
 * @returns 城市列表
 */
export async function getCitiesByIds(ids: string[]): Promise<CityListItem[]> {
  if (ids.length === 0) {
    return []
  }

  const cities = await prisma.city.findMany({
    where: { id: { in: ids } },
    orderBy: { name: 'asc' },
    include: {
      region: { select: { code: true } },
    },
  })

  return cities.map((city) => ({
    id: city.id,
    code: city.code,
    name: city.name,
    regionCode: city.region?.code ?? null,
    status: city.status,
  }))
}

/**
 * 獲取區域列表
 *
 * @description
 *   返回所有活躍區域的代碼。
 *
 * @returns 區域代碼列表
 */
export async function getAllRegions(): Promise<string[]> {
  const regions = await prisma.region.findMany({
    where: { status: 'ACTIVE' },
    select: { code: true },
    orderBy: { code: 'asc' },
  })

  return regions.map((r) => r.code)
}

/**
 * 檢查城市是否存在
 *
 * @param id - 城市 ID
 * @returns 是否存在
 */
export async function cityExists(id: string): Promise<boolean> {
  const count = await prisma.city.count({
    where: { id },
  })
  return count > 0
}

/**
 * 獲取城市名稱
 *
 * @description
 *   快速獲取城市名稱，用於顯示。
 *
 * @param id - 城市 ID
 * @returns 城市名稱或 null
 */
export async function getCityName(id: string): Promise<string | null> {
  const city = await prisma.city.findUnique({
    where: { id },
    select: { name: true },
  })
  return city?.name ?? null
}
