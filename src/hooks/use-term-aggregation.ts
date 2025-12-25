/**
 * @fileoverview 術語聚合資料 Hook
 * @description
 *   提供術語聚合資料的獲取和管理功能：
 *   - 獲取批次術語聚合統計
 *   - 手動觸發術語聚合
 *   - 刪除術語聚合結果
 *   - 錯誤處理和載入狀態
 *
 * @module src/hooks/use-term-aggregation
 * @since Epic 0 - Story 0.7
 * @lastModified 2025-12-25
 *
 * @features
 *   - React Query 整合
 *   - 自動快取管理
 *   - 樂觀更新
 *
 * @dependencies
 *   - @tanstack/react-query - 資料獲取
 *
 * @related
 *   - src/app/api/admin/historical-data/batches/[batchId]/term-stats/route.ts - API 端點
 *   - src/components/features/historical-data/TermAggregationSummary.tsx - UI 組件
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type {
  TermAggregationResponse,
  TermAggregationConfig,
} from '@/types/batch-term-aggregation'

// ============================================================
// Types
// ============================================================

interface UseTermAggregationOptions {
  /** 是否啟用自動獲取 */
  enabled?: boolean
  /** 自動刷新間隔（毫秒），0 表示不自動刷新 */
  refetchInterval?: number
}

interface TriggerAggregationParams {
  /** 聚合配置（可選） */
  config?: Partial<TermAggregationConfig>
}

// ============================================================
// API Functions
// ============================================================

/**
 * 獲取術語聚合統計
 */
async function fetchTermAggregation(
  batchId: string
): Promise<TermAggregationResponse> {
  const response = await fetch(
    `/api/admin/historical-data/batches/${batchId}/term-stats`
  )

  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(error.error || '獲取術語聚合資料失敗')
  }

  return response.json()
}

/**
 * 觸發術語聚合
 */
async function triggerTermAggregation(
  batchId: string,
  params?: TriggerAggregationParams
): Promise<TermAggregationResponse> {
  const response = await fetch(
    `/api/admin/historical-data/batches/${batchId}/term-stats`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params || {}),
    }
  )

  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(error.error || '觸發術語聚合失敗')
  }

  return response.json()
}

/**
 * 刪除術語聚合結果
 */
async function deleteTermAggregation(
  batchId: string
): Promise<{ success: boolean }> {
  const response = await fetch(
    `/api/admin/historical-data/batches/${batchId}/term-stats`,
    {
      method: 'DELETE',
    }
  )

  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(error.error || '刪除術語聚合結果失敗')
  }

  return response.json()
}

// ============================================================
// Query Keys
// ============================================================

export const termAggregationKeys = {
  all: ['term-aggregation'] as const,
  batch: (batchId: string) =>
    [...termAggregationKeys.all, 'batch', batchId] as const,
}

// ============================================================
// Hook
// ============================================================

/**
 * 術語聚合資料 Hook
 *
 * @description
 *   提供術語聚合資料的獲取、觸發和刪除功能
 *
 * @param batchId - 批次 ID
 * @param options - 配置選項
 * @returns Hook 返回值
 *
 * @example
 * ```tsx
 * const {
 *   data,
 *   isLoading,
 *   error,
 *   trigger,
 *   isTriggering,
 *   remove,
 *   isRemoving,
 * } = useTermAggregation(batchId);
 *
 * // 觸發聚合
 * trigger({ config: { similarityThreshold: 0.9 } });
 * ```
 */
export function useTermAggregation(
  batchId: string,
  options: UseTermAggregationOptions = {}
) {
  const { enabled = true, refetchInterval = 0 } = options
  const queryClient = useQueryClient()

  // --- Query: 獲取術語聚合資料 ---
  const query = useQuery({
    queryKey: termAggregationKeys.batch(batchId),
    queryFn: () => fetchTermAggregation(batchId),
    enabled: enabled && !!batchId,
    refetchInterval: refetchInterval || undefined,
    staleTime: 30 * 1000, // 30 秒內視為新鮮資料
  })

  // --- Mutation: 觸發術語聚合 ---
  const triggerMutation = useMutation({
    mutationFn: (params?: TriggerAggregationParams) =>
      triggerTermAggregation(batchId, params),
    onSuccess: (data) => {
      // 更新快取
      queryClient.setQueryData(termAggregationKeys.batch(batchId), data)
    },
    onError: () => {
      // 錯誤時重新獲取
      queryClient.invalidateQueries({
        queryKey: termAggregationKeys.batch(batchId),
      })
    },
  })

  // --- Mutation: 刪除術語聚合結果 ---
  const deleteMutation = useMutation({
    mutationFn: () => deleteTermAggregation(batchId),
    onSuccess: () => {
      // 重置為 pending 狀態
      queryClient.setQueryData(termAggregationKeys.batch(batchId), {
        batchId,
        status: 'pending',
      })
    },
  })

  // --- Return ---
  return {
    // 查詢狀態
    data: query.data,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error?.message || null,
    refetch: query.refetch,

    // 觸發聚合
    trigger: triggerMutation.mutate,
    triggerAsync: triggerMutation.mutateAsync,
    isTriggering: triggerMutation.isPending,
    triggerError: triggerMutation.error?.message || null,

    // 刪除結果
    remove: deleteMutation.mutate,
    removeAsync: deleteMutation.mutateAsync,
    isRemoving: deleteMutation.isPending,
    removeError: deleteMutation.error?.message || null,
  }
}

/**
 * 獲取術語聚合狀態
 * @description 簡化版 Hook，只返回狀態相關資訊
 */
export function useTermAggregationStatus(batchId: string) {
  const { data, isLoading, error } = useTermAggregation(batchId, {
    refetchInterval: 5000, // 每 5 秒自動刷新
  })

  return {
    status: data?.status || 'pending',
    isLoading,
    error,
    isCompleted: data?.status === 'completed',
    isAggregating: data?.status === 'aggregating',
    isFailed: data?.status === 'failed',
    isPending: !data || data.status === 'pending',
  }
}
