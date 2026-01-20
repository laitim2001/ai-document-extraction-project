'use client'

/**
 * @fileoverview 用戶可訪問城市查詢 Hook
 * @description
 *   提供當前用戶可訪問城市的查詢功能。
 *   使用 /api/cities/accessible 端點，不需要 admin 權限。
 *   適用於一般用戶場景（如發票上傳時選擇城市）。
 *
 *   與 use-cities.ts 的差異：
 *   - use-cities.ts 使用 /api/admin/cities，需要 USER_VIEW 權限
 *   - 本 hook 使用 /api/cities/accessible，僅需認證
 *
 * @module src/hooks/use-accessible-cities
 * @author Development Team
 * @since Epic 17 - Story 17.4 (i18n Bug Fixes)
 * @lastModified 2026-01-19
 *
 * @dependencies
 *   - @tanstack/react-query - 資料查詢和緩存
 *
 * @example
 *   // 按區域分組
 *   const { data: groupedCities } = useAccessibleCitiesGrouped()
 *
 *   // 平面列表
 *   const { data: cities } = useAccessibleCities()
 */

import { useQuery } from '@tanstack/react-query'

/**
 * 可訪問城市資料結構（API 原始格式）
 */
interface AccessibleCityResponse {
  code: string
  name: string
  region: {
    code: string
    name: string
  }
}

/**
 * 可訪問城市資料結構（轉換後）
 */
export interface AccessibleCity {
  id: string
  code: string
  name: string
  region: string | null
}

/**
 * 按區域分組的城市資料結構
 */
export interface AccessibleCityGroup {
  region: string
  cities: AccessibleCity[]
}

/**
 * API 響應結構
 */
interface AccessibleCitiesApiResponse {
  success: boolean
  data?: AccessibleCityResponse[]
  meta?: {
    total: number
    isGlobalAdmin: boolean
    isRegionalManager: boolean
  }
  error?: {
    title: string
    status: number
    detail?: string
  }
}

/**
 * Hook 選項
 */
interface UseAccessibleCitiesOptions {
  /** 是否啟用查詢 */
  enabled?: boolean
}

/**
 * 從 API 獲取用戶可訪問的城市列表
 * @returns 城市列表（按區域分組）
 */
async function fetchAccessibleCities(): Promise<AccessibleCityGroup[]> {
  const response = await fetch('/api/cities/accessible')
  const json: AccessibleCitiesApiResponse = await response.json()

  if (!response.ok) {
    throw new Error(json.error?.detail || 'Failed to fetch accessible cities')
  }

  if (!json.success || !json.data) {
    throw new Error(json.error?.detail || 'Failed to fetch accessible cities')
  }

  // 將扁平列表轉換為按區域分組的格式
  const groupedMap = new Map<string, AccessibleCity[]>()

  for (const city of json.data) {
    const regionName = city.region?.name || 'Other'

    if (!groupedMap.has(regionName)) {
      groupedMap.set(regionName, [])
    }

    groupedMap.get(regionName)!.push({
      id: city.code, // 使用 code 作為 id（與原 hook 兼容）
      code: city.code,
      name: city.name,
      region: city.region?.name || null,
    })
  }

  // 轉換為數組並排序
  const groups: AccessibleCityGroup[] = Array.from(groupedMap.entries())
    .map(([region, cities]) => ({
      region,
      cities: cities.sort((a, b) => a.name.localeCompare(b.name)),
    }))
    .sort((a, b) => a.region.localeCompare(b.region))

  return groups
}

/**
 * 從 API 獲取用戶可訪問的城市列表（平面）
 * @returns 城市列表
 */
async function fetchAccessibleCitiesFlat(): Promise<AccessibleCity[]> {
  const response = await fetch('/api/cities/accessible')
  const json: AccessibleCitiesApiResponse = await response.json()

  if (!response.ok) {
    throw new Error(json.error?.detail || 'Failed to fetch accessible cities')
  }

  if (!json.success || !json.data) {
    throw new Error(json.error?.detail || 'Failed to fetch accessible cities')
  }

  return json.data.map((city) => ({
    id: city.code,
    code: city.code,
    name: city.name,
    region: city.region?.name || null,
  }))
}

/**
 * 用戶可訪問城市查詢 Hook（按區域分組）
 * 使用 React Query 管理城市列表的獲取和緩存
 *
 * @param options - Hook 選項
 * @returns React Query 查詢結果
 *
 * @example
 *   const { data: groupedCities, isLoading } = useAccessibleCitiesGrouped()
 *   groupedCities?.forEach(group => {
 *     console.log(group.region, group.cities)
 *   })
 */
export function useAccessibleCitiesGrouped(options?: UseAccessibleCitiesOptions) {
  const { enabled = true } = options ?? {}

  return useQuery({
    queryKey: ['accessible-cities', 'grouped'],
    queryFn: fetchAccessibleCities,
    enabled,
    staleTime: 5 * 60 * 1000, // 5 分鐘
    gcTime: 30 * 60 * 1000, // 30 分鐘
  })
}

/**
 * 用戶可訪問城市查詢 Hook（平面列表）
 * 使用 React Query 管理城市列表的獲取和緩存
 *
 * @param options - Hook 選項
 * @returns React Query 查詢結果
 *
 * @example
 *   const { data: cities, isLoading, error } = useAccessibleCities()
 */
export function useAccessibleCities(options?: UseAccessibleCitiesOptions) {
  const { enabled = true } = options ?? {}

  return useQuery({
    queryKey: ['accessible-cities'],
    queryFn: fetchAccessibleCitiesFlat,
    enabled,
    staleTime: 5 * 60 * 1000, // 5 分鐘
    gcTime: 30 * 60 * 1000, // 30 分鐘
  })
}
