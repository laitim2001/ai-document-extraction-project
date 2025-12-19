/**
 * @fileoverview 回滾相關 React Query Hooks
 * @description
 *   提供回滾歷史查詢的 React Query hooks。
 *   用於 UI 組件獲取和管理回滾歷史數據。
 *
 * @module src/hooks/use-rollback
 * @since Epic 4 - Story 4.8 (規則自動回滾)
 * @lastModified 2025-12-19
 *
 * @features
 *   - 回滾歷史查詢
 *   - 分頁支援
 *   - 過濾支援（規則 ID、觸發類型）
 *
 * @dependencies
 *   - @tanstack/react-query - 資料獲取和快取
 *   - @/lib/api-client - API 客戶端
 *   - @/types/accuracy - 準確率相關類型
 */

import { useQuery } from '@tanstack/react-query'
import type {
  RollbackHistoryResponse,
  RollbackTrigger,
} from '@/types/accuracy'

// ============================================================
// Types
// ============================================================

/**
 * 回滾歷史查詢選項
 */
interface RollbackHistoryOptions {
  /** 頁碼 */
  page?: number
  /** 每頁數量 */
  pageSize?: number
  /** 規則 ID 過濾 */
  ruleId?: string
  /** 觸發類型過濾 */
  trigger?: RollbackTrigger | string
}

/**
 * API 響應格式
 */
interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: {
    type: string
    title: string
    status: number
    detail: string
  }
}

// ============================================================
// Hooks
// ============================================================

/**
 * 獲取回滾歷史
 *
 * @description
 *   查詢系統的回滾歷史記錄，支援分頁和過濾。
 *   自動每 5 分鐘重新獲取數據以保持最新。
 *
 * @param options - 查詢選項
 * @returns React Query 查詢結果
 *
 * @example
 *   const { data, isLoading, error } = useRollbackHistory({
 *     page: 1,
 *     pageSize: 20,
 *     trigger: 'AUTO',
 *   })
 */
export function useRollbackHistory(options: RollbackHistoryOptions = {}) {
  const { page = 1, pageSize = 20, ruleId, trigger } = options

  return useQuery({
    queryKey: ['rollback-history', { page, pageSize, ruleId, trigger }],
    queryFn: async (): Promise<RollbackHistoryResponse> => {
      const params = new URLSearchParams()
      params.set('page', String(page))
      params.set('pageSize', String(pageSize))
      if (ruleId) params.set('ruleId', ruleId)
      if (trigger && trigger !== 'all') params.set('trigger', trigger)

      const response = await fetch(`/api/rollback-logs?${params}`)

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(
          errorData.error?.detail || 'Failed to fetch rollback history'
        )
      }

      const result: ApiResponse<RollbackHistoryResponse> = await response.json()

      if (!result.success || !result.data) {
        throw new Error(result.error?.detail || 'Failed to fetch rollback history')
      }

      return result.data
    },
    refetchInterval: 5 * 60 * 1000, // 每 5 分鐘自動重新獲取
  })
}

/**
 * 獲取規則的回滾統計
 *
 * @description
 *   查詢指定規則的回滾統計資訊。
 *
 * @param ruleId - 規則 ID
 * @returns React Query 查詢結果
 *
 * @example
 *   const { data, isLoading } = useRollbackStats('rule-id')
 */
export function useRollbackStats(ruleId: string) {
  return useQuery({
    queryKey: ['rollback-stats', ruleId],
    queryFn: async () => {
      const response = await fetch(`/api/rollback-logs?ruleId=${ruleId}&pageSize=100`)

      if (!response.ok) {
        throw new Error('Failed to fetch rollback stats')
      }

      const result: ApiResponse<RollbackHistoryResponse> = await response.json()

      if (!result.success || !result.data) {
        throw new Error('Failed to fetch rollback stats')
      }

      // 計算統計
      const items = result.data.items
      return {
        totalRollbacks: result.data.total,
        autoRollbacks: items.filter((i) => i.trigger === 'AUTO').length,
        manualRollbacks: items.filter((i) => i.trigger === 'MANUAL').length,
        emergencyRollbacks: items.filter((i) => i.trigger === 'EMERGENCY').length,
        lastRollbackAt: items.length > 0 ? items[0].createdAt : null,
      }
    },
    enabled: !!ruleId,
  })
}
