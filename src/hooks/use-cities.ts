'use client'

/**
 * @fileoverview 城市查詢 Hook
 * @description
 *   提供客戶端城市列表查詢功能。
 *   使用 React Query 進行資料緩存和狀態管理。
 *
 *   主要功能：
 *   - 獲取活躍城市列表（平面列表）
 *   - 獲取按區域分組的城市列表
 *   - 城市資料緩存（5分鐘）
 *
 * @module src/hooks/use-cities
 * @author Development Team
 * @since Epic 1 - Story 1.3 (User List & Search)
 * @lastModified 2025-12-18
 *
 * @dependencies
 *   - @tanstack/react-query - 資料查詢和緩存
 *
 * @example
 *   // 平面列表
 *   const { data: cities, isLoading } = useCities()
 *
 *   // 按區域分組
 *   const { data: groupedCities } = useCitiesGrouped()
 */

import { useQuery } from '@tanstack/react-query'

/**
 * 城市資料結構
 */
export interface City {
  /** 城市 ID */
  id: string
  /** 城市代碼（如 TPE, HKG） */
  code: string
  /** 城市名稱 */
  name: string
  /** 區域（如 APAC, EMEA） */
  region: string | null
}

/**
 * 按區域分組的城市資料結構
 */
export interface CityGroup {
  /** 區域名稱 */
  region: string
  /** 該區域的城市列表 */
  cities: City[]
}

/**
 * 城市 API 響應（平面列表）
 */
interface CitiesApiResponse {
  success: boolean
  data?: City[]
  error?: {
    title: string
    status: number
    detail?: string
  }
}

/**
 * 城市 API 響應（分組）
 */
interface CitiesGroupedApiResponse {
  success: boolean
  data?: CityGroup[]
  error?: {
    title: string
    status: number
    detail?: string
  }
}

/**
 * useCities Hook 選項
 */
interface UseCitiesOptions {
  /** 是否啟用查詢 */
  enabled?: boolean
}

/**
 * 從 API 獲取城市列表（平面）
 * @returns 城市列表
 */
async function fetchCities(): Promise<City[]> {
  const response = await fetch('/api/admin/cities')
  const json: CitiesApiResponse = await response.json()

  if (!response.ok) {
    throw new Error(json.error?.detail || 'Failed to fetch cities')
  }

  if (!json.success || !json.data) {
    throw new Error(json.error?.detail || 'Failed to fetch cities')
  }

  return json.data
}

/**
 * 從 API 獲取按區域分組的城市列表
 * @returns 按區域分組的城市列表
 */
async function fetchCitiesGrouped(): Promise<CityGroup[]> {
  const response = await fetch('/api/admin/cities?grouped=true')
  const json: CitiesGroupedApiResponse = await response.json()

  if (!response.ok) {
    throw new Error(json.error?.detail || 'Failed to fetch cities')
  }

  if (!json.success || !json.data) {
    throw new Error(json.error?.detail || 'Failed to fetch cities')
  }

  return json.data
}

/**
 * 城市查詢 Hook
 * 使用 React Query 管理城市列表的獲取和緩存
 *
 * @param options - Hook 選項
 * @returns React Query 查詢結果
 *
 * @example
 *   // 基本用法
 *   const { data: cities, isLoading, error } = useCities()
 *
 *   // 條件查詢
 *   const { data: cities } = useCities({ enabled: isAuthenticated })
 */
export function useCities(options?: UseCitiesOptions) {
  const { enabled = true } = options ?? {}

  return useQuery({
    queryKey: ['cities'],
    queryFn: fetchCities,
    enabled,
    staleTime: 5 * 60 * 1000, // 5 分鐘
    gcTime: 30 * 60 * 1000, // 30 分鐘
  })
}

/**
 * 按區域分組的城市查詢 Hook
 * 使用 React Query 管理分組城市列表的獲取和緩存
 *
 * @param options - Hook 選項
 * @returns React Query 查詢結果
 *
 * @example
 *   const { data: groupedCities, isLoading } = useCitiesGrouped()
 *   groupedCities?.forEach(group => {
 *     console.log(group.region, group.cities)
 *   })
 */
export function useCitiesGrouped(options?: UseCitiesOptions) {
  const { enabled = true } = options ?? {}

  return useQuery({
    queryKey: ['cities', 'grouped'],
    queryFn: fetchCitiesGrouped,
    enabled,
    staleTime: 5 * 60 * 1000, // 5 分鐘
    gcTime: 30 * 60 * 1000, // 30 分鐘
  })
}
