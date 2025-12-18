/**
 * @fileoverview 審核隊列 React Query Hook
 * @description
 *   提供審核隊列數據獲取功能：
 *   - useReviewQueue: 獲取待審核列表
 *   - usePrefetchNextPage: 預取下一頁
 *   - useRefreshReviewQueue: 手動刷新
 *
 *   特性：
 *   - 30 秒 staleTime，60 秒自動刷新
 *   - 視窗聚焦時刷新
 *   - 支援預取下一頁
 *
 * @module src/hooks/useReviewQueue
 * @since Epic 3 - Story 3.1
 * @lastModified 2025-12-18
 *
 * @dependencies
 *   - @tanstack/react-query - React Query
 *   - @/types/review - 類型定義
 *
 * @related
 *   - src/app/api/review/route.ts - API 端點
 *   - src/components/features/review/ReviewQueue.tsx - 審核隊列組件
 */

'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import type {
  ReviewQueueParams,
  ReviewQueueResponse,
  ReviewQueueErrorResponse,
} from '@/types/review'

// ============================================================
// API Client
// ============================================================

/**
 * 獲取審核隊列列表
 * @param params - 查詢參數（分頁、篩選）
 * @returns API 響應
 */
async function fetchReviewQueue(
  params: ReviewQueueParams
): Promise<ReviewQueueResponse> {
  const searchParams = new URLSearchParams()

  if (params.page) {
    searchParams.set('page', params.page.toString())
  }
  if (params.pageSize) {
    searchParams.set('pageSize', params.pageSize.toString())
  }
  if (params.forwarderId) {
    searchParams.set('forwarderId', params.forwarderId)
  }
  if (params.processingPath) {
    searchParams.set('processingPath', params.processingPath)
  }
  if (params.minConfidence !== undefined) {
    searchParams.set('minConfidence', params.minConfidence.toString())
  }
  if (params.maxConfidence !== undefined) {
    searchParams.set('maxConfidence', params.maxConfidence.toString())
  }

  const response = await fetch(`/api/review?${searchParams.toString()}`)
  const result = await response.json()

  if (!result.success) {
    const errorResult = result as ReviewQueueErrorResponse
    throw new Error(errorResult.error?.detail || 'Failed to fetch review queue')
  }

  return result as ReviewQueueResponse
}

// ============================================================
// Query Keys
// ============================================================

export const reviewQueueKeys = {
  all: ['reviewQueue'] as const,
  list: (params: ReviewQueueParams) => ['reviewQueue', params] as const,
}

// ============================================================
// Hooks
// ============================================================

/**
 * 審核隊列 Hook
 * 獲取待審核發票列表，支援篩選和分頁
 *
 * @param params - 查詢參數
 * @returns React Query 結果
 *
 * @example
 * ```typescript
 * const { data, isLoading, error } = useReviewQueue({
 *   page: 1,
 *   pageSize: 20,
 *   processingPath: ProcessingPath.QUICK_REVIEW,
 * })
 * ```
 */
export function useReviewQueue(params: ReviewQueueParams = {}) {
  return useQuery({
    queryKey: reviewQueueKeys.list(params),
    queryFn: () => fetchReviewQueue(params),
    staleTime: 30 * 1000, // 30 秒後標記為過時
    refetchInterval: 60 * 1000, // 每分鐘自動刷新
    refetchOnWindowFocus: true, // 視窗聚焦時刷新
  })
}

/**
 * 預取下一頁 Hook
 * 自動預取下一頁數據以提升用戶體驗
 *
 * @param params - 當前查詢參數
 * @param totalPages - 總頁數
 *
 * @example
 * ```typescript
 * usePrefetchNextPage(
 *   { page: 1, pageSize: 20 },
 *   data?.meta.totalPages || 0
 * )
 * ```
 */
export function usePrefetchNextPage(
  params: ReviewQueueParams,
  totalPages: number
) {
  const queryClient = useQueryClient()
  const currentPage = params.page || 1

  // 在組件 mount 時預取下一頁
  if (currentPage < totalPages) {
    const nextPageParams = { ...params, page: currentPage + 1 }
    queryClient.prefetchQuery({
      queryKey: reviewQueueKeys.list(nextPageParams),
      queryFn: () => fetchReviewQueue(nextPageParams),
    })
  }
}

/**
 * 刷新審核隊列 Hook
 * 提供手動刷新審核列表的功能
 *
 * @returns 刷新函數
 *
 * @example
 * ```typescript
 * const refresh = useRefreshReviewQueue()
 * // 手動刷新
 * refresh()
 * ```
 */
export function useRefreshReviewQueue() {
  const queryClient = useQueryClient()

  return () => {
    queryClient.invalidateQueries({ queryKey: reviewQueueKeys.all })
  }
}
