'use client'

/**
 * @fileoverview Region 查詢 Hook
 * @description
 *   提供客戶端 Region 列表查詢功能。
 *   使用 React Query 進行資料緩存和狀態管理。
 *
 *   主要功能：
 *   - 獲取 Region 列表（支援 isActive 篩選）
 *   - Region 資料緩存（5分鐘）
 *   - Region CRUD mutation
 *
 * @module src/hooks/use-regions
 * @author Development Team
 * @since Epic 20 - Story 20.2 (Region Management API & UI)
 * @lastModified 2026-02-05
 *
 * @dependencies
 *   - @tanstack/react-query - 資料查詢和緩存
 *
 * @example
 *   // 獲取所有 Region
 *   const { data: regions, isLoading } = useRegions()
 *
 *   // 只獲取啟用的 Region
 *   const { data: activeRegions } = useRegions({ isActive: true })
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

// ============================================================
// 類型定義
// ============================================================

/**
 * Region 資料結構
 */
export interface Region {
  /** Region ID */
  id: string
  /** Region 代碼 */
  code: string
  /** Region 名稱 */
  name: string
  /** Region 描述 */
  description: string | null
  /** 是否為系統預設 */
  isDefault: boolean
  /** 是否啟用 */
  isActive: boolean
  /** 排序順序 */
  sortOrder: number
  /** 建立時間 */
  createdAt: string
  /** 更新時間 */
  updatedAt: string
}

/**
 * Region API 響應
 */
interface RegionsApiResponse {
  success: boolean
  data?: Region[]
  error?: {
    title: string
    status: number
    detail?: string
  }
}

/**
 * 單一 Region API 響應
 */
interface RegionApiResponse {
  success: boolean
  data?: Region
  error?: {
    title: string
    status: number
    detail?: string
  }
}

/**
 * useRegions Hook 選項
 */
interface UseRegionsOptions {
  /** 是否只返回啟用的 Region */
  isActive?: boolean
  /** 是否啟用查詢 */
  enabled?: boolean
}

/**
 * 建立 Region 輸入
 */
export interface CreateRegionInput {
  code: string
  name: string
  description?: string | null
  sortOrder?: number
}

/**
 * 更新 Region 輸入
 */
export interface UpdateRegionInput {
  name?: string
  description?: string | null
  isActive?: boolean
  sortOrder?: number
}

// ============================================================
// API 函數
// ============================================================

/**
 * 從 API 獲取 Region 列表
 */
async function fetchRegions(isActive?: boolean): Promise<Region[]> {
  const url = new URL('/api/v1/regions', window.location.origin)
  if (isActive !== undefined) {
    url.searchParams.set('isActive', String(isActive))
  }

  const response = await fetch(url.toString())
  const json: RegionsApiResponse = await response.json()

  if (!response.ok) {
    throw new Error(json.error?.detail || 'Failed to fetch regions')
  }

  if (!json.success || !json.data) {
    throw new Error(json.error?.detail || 'Failed to fetch regions')
  }

  return json.data
}

/**
 * 建立新 Region
 */
async function createRegion(input: CreateRegionInput): Promise<Region> {
  const response = await fetch('/api/v1/regions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })

  const json: RegionApiResponse = await response.json()

  if (!response.ok) {
    throw new Error(json.error?.detail || 'Failed to create region')
  }

  if (!json.success || !json.data) {
    throw new Error(json.error?.detail || 'Failed to create region')
  }

  return json.data
}

/**
 * 更新 Region
 */
async function updateRegion(id: string, input: UpdateRegionInput): Promise<Region> {
  const response = await fetch(`/api/v1/regions/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })

  const json: RegionApiResponse = await response.json()

  if (!response.ok) {
    throw new Error(json.error?.detail || 'Failed to update region')
  }

  if (!json.success || !json.data) {
    throw new Error(json.error?.detail || 'Failed to update region')
  }

  return json.data
}

/**
 * 刪除 Region
 */
async function deleteRegion(id: string): Promise<void> {
  const response = await fetch(`/api/v1/regions/${id}`, {
    method: 'DELETE',
  })

  if (!response.ok) {
    const json = await response.json()
    throw new Error(json.error?.detail || 'Failed to delete region')
  }
}

// ============================================================
// Hooks
// ============================================================

/**
 * Region 列表查詢 Hook
 *
 * @param options - Hook 選項
 * @returns React Query 查詢結果
 *
 * @example
 *   // 獲取所有 Region
 *   const { data: regions, isLoading, error } = useRegions()
 *
 *   // 只獲取啟用的 Region
 *   const { data: activeRegions } = useRegions({ isActive: true })
 */
export function useRegions(options?: UseRegionsOptions) {
  const { isActive, enabled = true } = options ?? {}

  return useQuery({
    queryKey: ['regions', { isActive }],
    queryFn: () => fetchRegions(isActive),
    enabled,
    staleTime: 5 * 60 * 1000, // 5 分鐘
    gcTime: 30 * 60 * 1000, // 30 分鐘
  })
}

/**
 * 建立 Region Mutation Hook
 *
 * @returns React Query mutation 結果
 *
 * @example
 *   const { mutate: create, isPending } = useCreateRegion()
 *   create({ code: 'APAC', name: 'Asia Pacific' })
 */
export function useCreateRegion() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: createRegion,
    onSuccess: () => {
      // 重新獲取 Region 列表
      queryClient.invalidateQueries({ queryKey: ['regions'] })
    },
  })
}

/**
 * 更新 Region Mutation Hook
 *
 * @returns React Query mutation 結果
 *
 * @example
 *   const { mutate: update, isPending } = useUpdateRegion()
 *   update({ id: 'xxx', input: { name: 'Updated Name' } })
 */
export function useUpdateRegion() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateRegionInput }) =>
      updateRegion(id, input),
    onSuccess: () => {
      // 重新獲取 Region 列表
      queryClient.invalidateQueries({ queryKey: ['regions'] })
    },
  })
}

/**
 * 刪除 Region Mutation Hook
 *
 * @returns React Query mutation 結果
 *
 * @example
 *   const { mutate: remove, isPending } = useDeleteRegion()
 *   remove('xxx-xxx')
 */
export function useDeleteRegion() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: deleteRegion,
    onSuccess: () => {
      // 重新獲取 Region 列表
      queryClient.invalidateQueries({ queryKey: ['regions'] })
    },
  })
}
