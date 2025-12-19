/**
 * @fileoverview 準確率相關 React Query Hooks
 * @description
 *   提供規則準確率查詢的 React Query hooks。
 *   用於 UI 組件獲取和管理準確率數據。
 *
 * @module src/hooks/use-accuracy
 * @since Epic 4 - Story 4.8 (規則自動回滾)
 * @lastModified 2025-12-19
 *
 * @features
 *   - 規則準確率查詢
 *   - 歷史趨勢數據
 *   - 自動重新獲取
 *
 * @dependencies
 *   - @tanstack/react-query - 資料獲取和快取
 *   - @/types/accuracy - 準確率相關類型
 */

import { useQuery } from '@tanstack/react-query'
import type { AccuracyMetrics, AccuracyApiResponse } from '@/types/accuracy'

// ============================================================
// Types
// ============================================================

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
 * 獲取規則準確率
 *
 * @description
 *   查詢指定規則的準確率指標和歷史趨勢。
 *   自動每 5 分鐘重新獲取數據以保持最新。
 *
 * @param ruleId - 規則 ID
 * @returns React Query 查詢結果
 *
 * @example
 *   const { data, isLoading, error } = useRuleAccuracy('rule-id')
 *   if (data) {
 *     console.log(`當前準確率: ${data.current.accuracy}`)
 *   }
 */
export function useRuleAccuracy(ruleId: string) {
  return useQuery({
    queryKey: ['rule-accuracy', ruleId],
    queryFn: async (): Promise<AccuracyApiResponse> => {
      const response = await fetch(`/api/rules/${ruleId}/accuracy`)

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(
          errorData.error?.detail || 'Failed to fetch accuracy'
        )
      }

      const result: ApiResponse<AccuracyApiResponse> = await response.json()

      if (!result.success || !result.data) {
        throw new Error(result.error?.detail || 'Failed to fetch accuracy')
      }

      return result.data
    },
    enabled: !!ruleId,
    refetchInterval: 5 * 60 * 1000, // 每 5 分鐘自動重新獲取
  })
}

/**
 * 獲取多個規則的準確率
 *
 * @description
 *   批量查詢多個規則的準確率指標。
 *   用於列表頁面顯示多個規則的準確率。
 *
 * @param ruleIds - 規則 ID 陣列
 * @returns React Query 查詢結果
 *
 * @example
 *   const { data, isLoading } = useRulesAccuracy(['rule-1', 'rule-2'])
 */
export function useRulesAccuracy(ruleIds: string[]) {
  return useQuery({
    queryKey: ['rules-accuracy', ruleIds],
    queryFn: async (): Promise<Map<string, AccuracyMetrics>> => {
      const results = new Map<string, AccuracyMetrics>()

      // 並行獲取所有規則的準確率
      const promises = ruleIds.map(async (ruleId) => {
        try {
          const response = await fetch(`/api/rules/${ruleId}/accuracy`)
          if (response.ok) {
            const result: ApiResponse<AccuracyApiResponse> = await response.json()
            if (result.success && result.data) {
              results.set(ruleId, result.data.current)
            }
          }
        } catch {
          // 忽略單個規則的錯誤
          console.warn(`Failed to fetch accuracy for rule ${ruleId}`)
        }
      })

      await Promise.all(promises)
      return results
    },
    enabled: ruleIds.length > 0,
    refetchInterval: 5 * 60 * 1000,
  })
}

/**
 * 計算準確率趨勢
 *
 * @description
 *   分析準確率歷史數據，計算趨勢方向。
 *
 * @param historical - 歷史準確率數據
 * @returns 趨勢：'up' | 'down' | 'stable'
 *
 * @example
 *   const trend = calculateTrend(data.historical)
 */
export function calculateTrend(
  historical: Array<{ accuracy: number | null; period: string }>
): 'up' | 'down' | 'stable' {
  const validData = historical.filter((h) => h.accuracy !== null)

  if (validData.length < 2) {
    return 'stable'
  }

  const latest = validData[validData.length - 1].accuracy!
  const previous = validData[validData.length - 2].accuracy!

  // 2% 以上的變化視為趨勢
  if (latest > previous + 0.02) return 'up'
  if (latest < previous - 0.02) return 'down'
  return 'stable'
}

/**
 * 格式化準確率百分比
 *
 * @description
 *   將準確率數值格式化為百分比字串。
 *
 * @param accuracy - 準確率 (0-1) 或 null
 * @param decimals - 小數位數（預設 1）
 * @returns 格式化的百分比字串或 '數據不足'
 *
 * @example
 *   formatAccuracy(0.85) // '85.0%'
 *   formatAccuracy(null) // '數據不足'
 */
export function formatAccuracy(
  accuracy: number | null,
  decimals: number = 1
): string {
  if (accuracy === null) {
    return '數據不足'
  }
  return `${(accuracy * 100).toFixed(decimals)}%`
}
