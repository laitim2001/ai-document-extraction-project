'use client'

/**
 * @fileoverview 審計查詢 React Query Hooks
 * @description
 *   提供審計查詢的資料獲取功能：
 *   - useAuditQuery: 執行審計查詢
 *   - useAuditQueryCount: 獲取結果計數預覽
 *
 *   特性：
 *   - 使用 useMutation 處理 POST 查詢
 *   - 支援分頁和排序
 *   - 自動處理錯誤狀態
 *
 * @module src/hooks/useAuditQuery
 * @since Epic 8 - Story 8.3 (處理記錄查詢)
 * @lastModified 2025-12-20
 *
 * @dependencies
 *   - @tanstack/react-query - React Query
 *   - @/types/audit-query - 類型定義
 *
 * @related
 *   - src/app/api/audit/query/route.ts - 審計查詢 API
 *   - src/app/(dashboard)/audit/query/page.tsx - 審計查詢頁面
 */

import { useState, useCallback } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type {
  AuditQueryParams,
  AuditQueryResult,
  AuditQueryResponse,
  CountPreview,
  CountPreviewResponse
} from '@/types/audit-query'

// ============================================================
// Types
// ============================================================

/**
 * 審計查詢 Hook 返回類型
 */
export interface UseAuditQueryReturn {
  /** 查詢結果 */
  data: AuditQueryResult | null
  /** 是否正在載入 */
  isLoading: boolean
  /** 錯誤訊息 */
  error: Error | null
  /** 執行查詢 */
  executeQuery: (params: AuditQueryParams) => Promise<void>
  /** 變更頁碼 */
  changePage: (page: number) => Promise<void>
  /** 當前查詢參數 */
  currentParams: AuditQueryParams | null
  /** 重置查詢 */
  reset: () => void
}

// ============================================================
// API Client
// ============================================================

/**
 * 執行審計查詢
 * @param params - 查詢參數
 * @returns 查詢結果
 */
async function fetchAuditQuery(
  params: AuditQueryParams
): Promise<AuditQueryResult> {
  const response = await fetch('/api/audit/query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params)
  })

  const result: AuditQueryResponse = await response.json()

  if (!response.ok || !result.success) {
    const errorResult = result as unknown as { detail?: string; error?: string }
    throw new Error(errorResult.detail || errorResult.error || '查詢失敗')
  }

  return result.data
}

/**
 * 獲取結果計數預覽
 * @param params - 查詢參數
 * @returns 計數預覽
 */
async function fetchCountPreview(
  params: AuditQueryParams
): Promise<CountPreview> {
  const response = await fetch('/api/audit/query/count', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params)
  })

  const result: CountPreviewResponse = await response.json()

  if (!response.ok || !result.success) {
    const errorResult = result as unknown as { detail?: string; error?: string }
    throw new Error(errorResult.detail || errorResult.error || '計數預覽失敗')
  }

  return result.data
}

// ============================================================
// Query Keys
// ============================================================

export const auditQueryKeys = {
  all: ['auditQuery'] as const,
  query: (params: AuditQueryParams) => ['auditQuery', 'query', params] as const,
  count: (params: AuditQueryParams) => ['auditQuery', 'count', params] as const
}

// ============================================================
// Hooks
// ============================================================

/**
 * 審計查詢 Hook
 * 執行審計查詢並管理結果狀態
 *
 * @returns 審計查詢功能與狀態
 *
 * @example
 * ```typescript
 * const { data, isLoading, error, executeQuery, changePage } = useAuditQuery()
 *
 * // 執行查詢
 * await executeQuery({
 *   startDate: '2025-01-01T00:00:00Z',
 *   endDate: '2025-01-31T23:59:59Z',
 *   statuses: ['COMPLETED']
 * })
 *
 * // 翻頁
 * await changePage(2)
 * ```
 */
export function useAuditQuery(): UseAuditQueryReturn {
  const [data, setData] = useState<AuditQueryResult | null>(null)
  const [currentParams, setCurrentParams] = useState<AuditQueryParams | null>(
    null
  )
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: fetchAuditQuery,
    onSuccess: result => {
      setData(result)
    },
    onError: error => {
      console.error('[useAuditQuery] Query failed:', error)
    }
  })

  const executeQuery = useCallback(
    async (params: AuditQueryParams) => {
      setCurrentParams(params)
      await mutation.mutateAsync(params)
    },
    [mutation]
  )

  const changePage = useCallback(
    async (page: number) => {
      if (!currentParams) {
        console.warn('[useAuditQuery] No current params, cannot change page')
        return
      }

      const newParams = { ...currentParams, page }
      setCurrentParams(newParams)
      await mutation.mutateAsync(newParams)
    },
    [currentParams, mutation]
  )

  const reset = useCallback(() => {
    setData(null)
    setCurrentParams(null)
    mutation.reset()
    queryClient.invalidateQueries({ queryKey: auditQueryKeys.all })
  }, [mutation, queryClient])

  return {
    data,
    isLoading: mutation.isPending,
    error: mutation.error,
    executeQuery,
    changePage,
    currentParams,
    reset
  }
}

/**
 * 審計查詢計數預覽 Hook
 * 獲取查詢結果的計數預覽
 *
 * @returns 計數預覽功能與狀態
 *
 * @example
 * ```typescript
 * const { getCount, isLoading } = useAuditQueryCount()
 *
 * const preview = await getCount({
 *   startDate: '2025-01-01T00:00:00Z',
 *   endDate: '2025-01-31T23:59:59Z'
 * })
 *
 * if (preview.exceedsLimit) {
 *   console.log('結果超過限制！')
 * }
 * ```
 */
export function useAuditQueryCount() {
  const mutation = useMutation({
    mutationFn: fetchCountPreview,
    onError: error => {
      console.error('[useAuditQueryCount] Count preview failed:', error)
    }
  })

  const getCount = useCallback(
    async (params: AuditQueryParams): Promise<CountPreview> => {
      return mutation.mutateAsync(params)
    },
    [mutation]
  )

  return {
    getCount,
    isLoading: mutation.isPending,
    error: mutation.error
  }
}

/**
 * 刷新審計查詢 Hook
 * 提供手動刷新審計查詢快取的功能
 *
 * @returns 刷新函數
 */
export function useRefreshAuditQuery() {
  const queryClient = useQueryClient()

  return useCallback(() => {
    queryClient.invalidateQueries({ queryKey: auditQueryKeys.all })
  }, [queryClient])
}
