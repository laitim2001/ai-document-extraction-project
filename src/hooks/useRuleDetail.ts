/**
 * @fileoverview 映射規則詳情 Hook
 * @description
 *   使用 React Query 獲取單一映射規則的詳細資訊，包含：
 *   - 規則基本資訊
 *   - 應用統計數據
 *   - 最近應用記錄
 *   - 自動快取管理
 *
 * @module src/hooks/useRuleDetail
 * @since Epic 4 - Story 4.1 (映射規則列表與查看)
 * @lastModified 2025-12-18
 *
 * @dependencies
 *   - @tanstack/react-query - React Query
 *   - @/types/rule - 類型定義
 */

import { useQuery, UseQueryOptions } from '@tanstack/react-query'
import type { RuleDetail, RuleDetailResponse } from '@/types/rule'

// ============================================================
// Types
// ============================================================

/**
 * API 錯誤響應
 */
interface RuleErrorResponse {
  type: string
  title: string
  status: number
  detail: string
}

/**
 * Hook 選項
 */
interface UseRuleDetailOptions {
  /** 是否啟用查詢 */
  enabled?: boolean
  /** React Query 選項 */
  queryOptions?: Omit<
    UseQueryOptions<RuleDetail, Error>,
    'queryKey' | 'queryFn' | 'enabled'
  >
}

// ============================================================
// API Function
// ============================================================

/**
 * 獲取規則詳情
 *
 * @param id - 規則 ID
 * @returns 規則詳細資訊
 * @throws 當 API 回傳錯誤時拋出
 */
async function fetchRuleDetail(id: string): Promise<RuleDetail> {
  const response = await fetch(`/api/rules/${id}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  })

  const result = await response.json()

  // 處理錯誤響應
  if (!response.ok || !result.success) {
    const errorResponse = result as RuleErrorResponse
    throw new Error(errorResponse.detail || 'Failed to fetch rule detail')
  }

  const successResponse = result as RuleDetailResponse
  return successResponse.data
}

// ============================================================
// Hook
// ============================================================

/**
 * 映射規則詳情 Hook
 *
 * @param id - 規則 ID（傳入 undefined 時不執行查詢）
 * @param options - Hook 選項
 * @returns React Query 結果
 *
 * @example
 * ```tsx
 * function RuleDetailPage({ params }: { params: { id: string } }) {
 *   const { data: rule, isLoading, error } = useRuleDetail(params.id)
 *
 *   if (isLoading) return <Skeleton />
 *   if (error) return <ErrorMessage message={error.message} />
 *   if (!rule) return <NotFound />
 *
 *   return (
 *     <div>
 *       <RuleDetailHeader rule={rule} />
 *       <RuleStats stats={rule.stats} />
 *       <RecentApplicationsTable applications={rule.recentApplications} />
 *     </div>
 *   )
 * }
 * ```
 */
export function useRuleDetail(
  id: string | undefined,
  options?: UseRuleDetailOptions
) {
  const { enabled = true, queryOptions } = options ?? {}

  return useQuery<RuleDetail, Error>({
    queryKey: ['rule', id],
    queryFn: () => fetchRuleDetail(id!),
    enabled: enabled && !!id,
    // 30 秒 stale time
    staleTime: 30 * 1000,
    // 5 分鐘快取時間
    gcTime: 5 * 60 * 1000,
    ...queryOptions,
  })
}

// ============================================================
// Query Key Factory
// ============================================================

/**
 * Query Key 工廠函數
 * @description 用於外部快取操作
 */
export const ruleDetailKeys = {
  all: ['rule'] as const,
  detail: (id: string) => [...ruleDetailKeys.all, id] as const,
}
