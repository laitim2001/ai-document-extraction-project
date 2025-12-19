'use client'

/**
 * @fileoverview Forwarder List React Query Hook
 * @description
 *   提供 Forwarder 列表的 React Query 封裝：
 *   - 分頁查詢
 *   - 搜尋過濾
 *   - 狀態篩選
 *   - 排序功能
 *   - URL 同步
 *
 * @module src/hooks/use-forwarders
 * @author Development Team
 * @since Epic 5 - Story 5.1 (Forwarder Profile List)
 * @lastModified 2025-12-19
 *
 * @features
 *   - URL 參數同步（支援書籤和分享）
 *   - 300ms debounced 搜尋
 *   - 5 分鐘自動重新獲取
 *   - 類型安全的 API 響應
 *
 * @dependencies
 *   - @tanstack/react-query - React Query
 *   - next/navigation - Next.js 導航
 *
 * @related
 *   - src/app/api/forwarders/route.ts - Forwarders API
 *   - src/app/(dashboard)/forwarders/page.tsx - Forwarder 列表頁面
 *   - src/types/forwarder.ts - 類型定義
 */

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { useCallback, useMemo } from 'react'
import { useDebounce } from './use-debounce'
import type {
  ForwarderListItem,
  ForwarderSortField,
  SortOrder,
  PaginationInfo,
} from '@/types/forwarder'

// ============================================================
// Types
// ============================================================

/**
 * useForwarders 查詢參數
 */
export interface UseForwardersParams {
  /** 搜尋關鍵字 */
  search?: string
  /** 狀態篩選 */
  isActive?: boolean
  /** 頁碼 */
  page?: number
  /** 每頁數量 */
  limit?: number
  /** 排序欄位 */
  sortBy?: ForwarderSortField
  /** 排序方向 */
  sortOrder?: SortOrder
}

/**
 * API 響應結構
 */
interface ForwardersApiResponse {
  success: boolean
  data: ForwarderListItem[]
  meta: {
    pagination: PaginationInfo
  }
  error?: {
    type: string
    title: string
    status: number
    detail: string
  }
}

// ============================================================
// Query Keys
// ============================================================

export const forwardersQueryKeys = {
  all: ['forwarders'] as const,
  list: (params: UseForwardersParams) => ['forwarders', 'list', params] as const,
  detail: (id: string) => ['forwarders', 'detail', id] as const,
  options: () => ['forwarders', 'options'] as const,
}

// ============================================================
// Constants
// ============================================================

/** 搜尋 debounce 延遲（毫秒） */
const SEARCH_DEBOUNCE_MS = 300

/** 資料快取時間（毫秒） */
const STALE_TIME_MS = 5 * 60 * 1000 // 5 分鐘

/** 預設每頁數量 */
const DEFAULT_LIMIT = 10

/** 預設排序欄位 */
const DEFAULT_SORT_BY: ForwarderSortField = 'updatedAt'

/** 預設排序方向 */
const DEFAULT_SORT_ORDER: SortOrder = 'desc'

// ============================================================
// Hook
// ============================================================

/**
 * Forwarder 列表 React Query Hook
 *
 * @description
 *   提供 Forwarder 列表查詢功能，包含：
 *   - URL 參數同步（支援書籤和分享）
 *   - 300ms debounced 搜尋
 *   - 分頁、篩選、排序
 *   - 5 分鐘快取
 *
 * @param initialParams - 初始查詢參數（可選，會被 URL 參數覆蓋）
 * @returns Query 結果和狀態管理函數
 *
 * @example
 * ```tsx
 * const {
 *   data,
 *   isLoading,
 *   pagination,
 *   setPage,
 *   setSearch,
 *   setStatusFilter,
 *   setSort,
 * } = useForwarders()
 * ```
 */
export function useForwarders(initialParams: UseForwardersParams = {}) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const queryClient = useQueryClient()

  // 從 URL 解析參數（優先於初始參數）
  const params = useMemo<UseForwardersParams>(() => {
    const search = searchParams.get('search') || initialParams.search
    const isActiveParam = searchParams.get('isActive')
    const page = searchParams.get('page')
    const limit = searchParams.get('limit')
    const sortBy = searchParams.get('sortBy') as ForwarderSortField | null
    const sortOrder = searchParams.get('sortOrder') as SortOrder | null

    return {
      search: search || undefined,
      isActive: isActiveParam === 'true' ? true : isActiveParam === 'false' ? false : undefined,
      page: page ? parseInt(page, 10) : initialParams.page || 1,
      limit: limit ? parseInt(limit, 10) : initialParams.limit || DEFAULT_LIMIT,
      sortBy: sortBy || initialParams.sortBy || DEFAULT_SORT_BY,
      sortOrder: sortOrder || initialParams.sortOrder || DEFAULT_SORT_ORDER,
    }
  }, [searchParams, initialParams])

  // Debounced 搜尋（用於 query key）
  const debouncedSearch = useDebounce(params.search || '', SEARCH_DEBOUNCE_MS)

  // 實際查詢參數（使用 debounced search）
  const queryParams = useMemo<UseForwardersParams>(
    () => ({
      ...params,
      search: debouncedSearch || undefined,
    }),
    [params, debouncedSearch]
  )

  // Forwarder 列表查詢
  const query = useQuery<ForwardersApiResponse>({
    queryKey: forwardersQueryKeys.list(queryParams),
    queryFn: async () => {
      const urlSearchParams = new URLSearchParams()

      if (queryParams.search) urlSearchParams.set('search', queryParams.search)
      if (queryParams.isActive !== undefined) urlSearchParams.set('isActive', String(queryParams.isActive))
      if (queryParams.page) urlSearchParams.set('page', String(queryParams.page))
      if (queryParams.limit) urlSearchParams.set('limit', String(queryParams.limit))
      if (queryParams.sortBy) urlSearchParams.set('sortBy', queryParams.sortBy)
      if (queryParams.sortOrder) urlSearchParams.set('sortOrder', queryParams.sortOrder)

      const response = await fetch(`/api/forwarders?${urlSearchParams}`)

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error?.detail || 'Failed to fetch forwarders')
      }

      return response.json()
    },
    staleTime: STALE_TIME_MS,
  })

  // 更新 URL 參數
  const updateUrlParams = useCallback(
    (updates: Partial<UseForwardersParams>) => {
      const newParams = new URLSearchParams(searchParams.toString())

      Object.entries(updates).forEach(([key, value]) => {
        if (value === undefined || value === '' || value === null) {
          newParams.delete(key)
        } else {
          newParams.set(key, String(value))
        }
      })

      router.push(`${pathname}?${newParams.toString()}`, { scroll: false })
    },
    [searchParams, router, pathname]
  )

  // 設定搜尋關鍵字
  const setSearch = useCallback(
    (search: string) => {
      updateUrlParams({ search: search || undefined, page: 1 }) // 重置到第一頁
    },
    [updateUrlParams]
  )

  // 設定狀態篩選
  const setStatusFilter = useCallback(
    (status: 'all' | 'active' | 'inactive') => {
      const isActive = status === 'all' ? undefined : status === 'active'
      updateUrlParams({ isActive, page: 1 }) // 重置到第一頁
    },
    [updateUrlParams]
  )

  // 設定頁碼
  const setPage = useCallback(
    (page: number) => {
      updateUrlParams({ page })
    },
    [updateUrlParams]
  )

  // 設定每頁數量
  const setLimit = useCallback(
    (limit: number) => {
      updateUrlParams({ limit, page: 1 }) // 重置到第一頁
    },
    [updateUrlParams]
  )

  // 設定排序
  const setSort = useCallback(
    (sortBy: ForwarderSortField, sortOrder?: SortOrder) => {
      // 如果點擊相同欄位，切換排序方向
      const currentSortBy = params.sortBy
      const currentSortOrder = params.sortOrder

      let newSortOrder: SortOrder = sortOrder || 'asc'
      if (!sortOrder && sortBy === currentSortBy) {
        newSortOrder = currentSortOrder === 'asc' ? 'desc' : 'asc'
      }

      updateUrlParams({ sortBy, sortOrder: newSortOrder })
    },
    [updateUrlParams, params.sortBy, params.sortOrder]
  )

  // 重新獲取資料
  const refetch = useCallback(() => {
    queryClient.invalidateQueries({
      queryKey: forwardersQueryKeys.all,
    })
  }, [queryClient])

  return {
    // Query 狀態
    ...query,

    // 資料存取
    forwarders: query.data?.data ?? [],
    pagination: query.data?.meta?.pagination ?? null,

    // 當前參數
    params,

    // 狀態管理函數
    setSearch,
    setStatusFilter,
    setPage,
    setLimit,
    setSort,
    refetch,
  }
}

// ============================================================
// 輔助 Hooks
// ============================================================

/**
 * 獲取 Forwarder 選項（用於下拉選單）
 *
 * @description
 *   獲取所有啟用的 Forwarder 用於表單選擇
 *
 * @returns Forwarder 選項列表
 */
export function useForwarderOptions() {
  return useQuery<ForwardersApiResponse>({
    queryKey: forwardersQueryKeys.options(),
    queryFn: async () => {
      const response = await fetch('/api/forwarders?isActive=true&limit=100')

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error?.detail || 'Failed to fetch forwarder options')
      }

      return response.json()
    },
    staleTime: 10 * 60 * 1000, // 10 分鐘
    select: (data) => data, // 可以在這裡轉換資料格式
  })
}
