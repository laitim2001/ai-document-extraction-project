'use client'

/**
 * @fileoverview Forwarder Detail React Query Hooks
 * @description
 *   提供 Forwarder 詳情頁面的 React Query 封裝：
 *   - 詳情檢視（含統計、規則摘要、近期文件）
 *   - 規則列表（分頁、篩選）
 *   - 統計資料
 *   - 近期文件
 *
 * @module src/hooks/use-forwarder-detail
 * @author Development Team
 * @since Epic 5 - Story 5.2 (Forwarder Detail Config View)
 * @lastModified 2025-12-19
 *
 * @features
 *   - 5 分鐘自動重新獲取
 *   - 類型安全的 API 響應
 *   - 規則列表分頁支援
 *
 * @dependencies
 *   - @tanstack/react-query - React Query
 *
 * @related
 *   - src/app/api/forwarders/[id]/route.ts - Detail API
 *   - src/app/api/forwarders/[id]/rules/route.ts - Rules API
 *   - src/app/api/forwarders/[id]/stats/route.ts - Stats API
 *   - src/app/api/forwarders/[id]/documents/route.ts - Documents API
 *   - src/types/forwarder.ts - 類型定義
 */

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useMemo } from 'react'
import type {
  ForwarderDetailView,
  RuleListItem,
  PaginationInfo,
  ForwarderStats,
  RecentDocumentItem,
  RuleStatus,
  SortOrder,
} from '@/types/forwarder'

// ============================================================
// Types
// ============================================================

/**
 * 詳情 API 響應
 */
interface ForwarderDetailApiResponse {
  success: boolean
  data: ForwarderDetailView
  error?: {
    type: string
    title: string
    status: number
    detail: string
  }
}

/**
 * 規則列表 API 響應
 */
interface RulesApiResponse {
  success: boolean
  data: RuleListItem[]
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

/**
 * 統計 API 響應
 */
interface StatsApiResponse {
  success: boolean
  data: ForwarderStats
  error?: {
    type: string
    title: string
    status: number
    detail: string
  }
}

/**
 * 近期文件 API 響應
 */
interface DocumentsApiResponse {
  success: boolean
  data: RecentDocumentItem[]
  error?: {
    type: string
    title: string
    status: number
    detail: string
  }
}

/**
 * 規則查詢參數
 */
export interface UseForwarderRulesParams {
  /** 狀態篩選 */
  status?: RuleStatus
  /** 搜尋欄位名稱 */
  search?: string
  /** 頁碼 */
  page?: number
  /** 每頁數量 */
  limit?: number
  /** 排序欄位 */
  sortBy?: 'fieldName' | 'status' | 'confidence' | 'matchCount' | 'updatedAt'
  /** 排序方向 */
  sortOrder?: SortOrder
}

// ============================================================
// Query Keys
// ============================================================

export const forwarderDetailQueryKeys = {
  all: ['forwarder-detail'] as const,
  detail: (id: string) => ['forwarder-detail', id] as const,
  rules: (id: string, params?: UseForwarderRulesParams) =>
    ['forwarder-detail', id, 'rules', params] as const,
  stats: (id: string) => ['forwarder-detail', id, 'stats'] as const,
  documents: (id: string, limit?: number) => ['forwarder-detail', id, 'documents', limit] as const,
}

// ============================================================
// Constants
// ============================================================

/** 資料快取時間（毫秒） */
const STALE_TIME_MS = 5 * 60 * 1000 // 5 分鐘

/** 預設每頁數量 */
const DEFAULT_LIMIT = 10

// ============================================================
// useForwarderDetail Hook
// ============================================================

/**
 * Forwarder 詳情 React Query Hook
 *
 * @description
 *   獲取 Forwarder 的完整詳情，包含：
 *   - 基本資訊
 *   - 規則摘要
 *   - 處理統計
 *   - 近期文件
 *
 * @param id - Forwarder ID
 * @param options - React Query 選項
 * @returns Query 結果
 *
 * @example
 * ```tsx
 * const { data, isLoading, error } = useForwarderDetail('cuid123')
 * if (data) {
 *   console.log(data.stats.successRate)
 * }
 * ```
 */
export function useForwarderDetail(id: string, options?: { enabled?: boolean }) {
  const queryClient = useQueryClient()

  const query = useQuery<ForwarderDetailApiResponse>({
    queryKey: forwarderDetailQueryKeys.detail(id),
    queryFn: async () => {
      const response = await fetch(`/api/forwarders/${id}`)

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error?.detail || 'Failed to fetch forwarder details')
      }

      return response.json()
    },
    staleTime: STALE_TIME_MS,
    enabled: options?.enabled !== false && !!id,
  })

  const refetch = useCallback(() => {
    queryClient.invalidateQueries({
      queryKey: forwarderDetailQueryKeys.detail(id),
    })
  }, [queryClient, id])

  return {
    ...query,
    forwarder: query.data?.data ?? null,
    refetch,
  }
}

// ============================================================
// useForwarderRules Hook
// ============================================================

/**
 * Forwarder 規則列表 React Query Hook
 *
 * @description
 *   獲取 Forwarder 的規則列表，支援：
 *   - 狀態篩選
 *   - 欄位名稱搜尋
 *   - 分頁
 *   - 排序
 *
 * @param id - Forwarder ID
 * @param params - 查詢參數
 * @param options - React Query 選項
 * @returns Query 結果和分頁資訊
 *
 * @example
 * ```tsx
 * const { rules, pagination, setPage, setStatusFilter } = useForwarderRules('cuid123', {
 *   status: 'ACTIVE',
 *   page: 1,
 *   limit: 10,
 * })
 * ```
 */
export function useForwarderRules(
  id: string,
  params: UseForwarderRulesParams = {},
  options?: { enabled?: boolean }
) {
  const queryClient = useQueryClient()

  const queryParams = useMemo<UseForwarderRulesParams>(
    () => ({
      status: params.status,
      search: params.search,
      page: params.page || 1,
      limit: params.limit || DEFAULT_LIMIT,
      sortBy: params.sortBy || 'updatedAt',
      sortOrder: params.sortOrder || 'desc',
    }),
    [params]
  )

  const query = useQuery<RulesApiResponse>({
    queryKey: forwarderDetailQueryKeys.rules(id, queryParams),
    queryFn: async () => {
      const urlSearchParams = new URLSearchParams()

      if (queryParams.status) urlSearchParams.set('status', queryParams.status)
      if (queryParams.search) urlSearchParams.set('search', queryParams.search)
      if (queryParams.page) urlSearchParams.set('page', String(queryParams.page))
      if (queryParams.limit) urlSearchParams.set('limit', String(queryParams.limit))
      if (queryParams.sortBy) urlSearchParams.set('sortBy', queryParams.sortBy)
      if (queryParams.sortOrder) urlSearchParams.set('sortOrder', queryParams.sortOrder)

      const response = await fetch(`/api/forwarders/${id}/rules?${urlSearchParams}`)

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error?.detail || 'Failed to fetch forwarder rules')
      }

      return response.json()
    },
    staleTime: STALE_TIME_MS,
    enabled: options?.enabled !== false && !!id,
  })

  const refetch = useCallback(() => {
    queryClient.invalidateQueries({
      queryKey: forwarderDetailQueryKeys.rules(id, queryParams),
    })
  }, [queryClient, id, queryParams])

  return {
    ...query,
    rules: query.data?.data ?? [],
    pagination: query.data?.meta?.pagination ?? null,
    params: queryParams,
    refetch,
  }
}

// ============================================================
// useForwarderStats Hook
// ============================================================

/**
 * Forwarder 統計資料 React Query Hook
 *
 * @description
 *   獲取 Forwarder 的處理統計資料
 *
 * @param id - Forwarder ID
 * @param options - React Query 選項
 * @returns Query 結果
 *
 * @example
 * ```tsx
 * const { stats, isLoading } = useForwarderStats('cuid123')
 * if (stats) {
 *   console.log(`成功率: ${stats.successRate}%`)
 * }
 * ```
 */
export function useForwarderStats(id: string, options?: { enabled?: boolean }) {
  const queryClient = useQueryClient()

  const query = useQuery<StatsApiResponse>({
    queryKey: forwarderDetailQueryKeys.stats(id),
    queryFn: async () => {
      const response = await fetch(`/api/forwarders/${id}/stats`)

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error?.detail || 'Failed to fetch forwarder statistics')
      }

      return response.json()
    },
    staleTime: STALE_TIME_MS,
    enabled: options?.enabled !== false && !!id,
  })

  const refetch = useCallback(() => {
    queryClient.invalidateQueries({
      queryKey: forwarderDetailQueryKeys.stats(id),
    })
  }, [queryClient, id])

  return {
    ...query,
    stats: query.data?.data ?? null,
    refetch,
  }
}

// ============================================================
// useForwarderDocuments Hook
// ============================================================

/**
 * Forwarder 近期文件 React Query Hook
 *
 * @description
 *   獲取 Forwarder 最近處理的文件列表
 *
 * @param id - Forwarder ID
 * @param limit - 限制數量（預設 10）
 * @param options - React Query 選項
 * @returns Query 結果
 *
 * @example
 * ```tsx
 * const { documents, isLoading } = useForwarderDocuments('cuid123', 5)
 * ```
 */
export function useForwarderDocuments(
  id: string,
  limit: number = 10,
  options?: { enabled?: boolean }
) {
  const queryClient = useQueryClient()

  const query = useQuery<DocumentsApiResponse>({
    queryKey: forwarderDetailQueryKeys.documents(id, limit),
    queryFn: async () => {
      const response = await fetch(`/api/forwarders/${id}/documents?limit=${limit}`)

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error?.detail || 'Failed to fetch forwarder documents')
      }

      return response.json()
    },
    staleTime: STALE_TIME_MS,
    enabled: options?.enabled !== false && !!id,
  })

  const refetch = useCallback(() => {
    queryClient.invalidateQueries({
      queryKey: forwarderDetailQueryKeys.documents(id, limit),
    })
  }, [queryClient, id, limit])

  return {
    ...query,
    documents: query.data?.data ?? [],
    refetch,
  }
}

// ============================================================
// Prefetch Utilities
// ============================================================

/**
 * 預取 Forwarder 詳情（用於 hover 或 link prefetch）
 *
 * @param queryClient - React Query Client
 * @param id - Forwarder ID
 */
export function prefetchForwarderDetail(
  queryClient: ReturnType<typeof useQueryClient>,
  id: string
) {
  queryClient.prefetchQuery({
    queryKey: forwarderDetailQueryKeys.detail(id),
    queryFn: async () => {
      const response = await fetch(`/api/forwarders/${id}`)
      if (!response.ok) throw new Error('Failed to prefetch')
      return response.json()
    },
    staleTime: STALE_TIME_MS,
  })
}
