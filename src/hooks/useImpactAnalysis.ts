/**
 * @fileoverview 規則影響分析 Hook
 * @description
 *   使用 React Query 獲取規則變更影響分析報告，包含：
 *   - 統計數據（受影響文件、改善率、惡化率）
 *   - 風險案例列表
 *   - 時間軸趨勢數據
 *
 * @module src/hooks/useImpactAnalysis
 * @since Epic 4 - Story 4.5 (規則影響範圍分析)
 * @lastModified 2025-12-19
 *
 * @dependencies
 *   - @tanstack/react-query - React Query
 *   - @/types/impact - 類型定義
 */

import { useQuery, UseQueryOptions } from '@tanstack/react-query'
import type { ImpactAnalysisResult } from '@/types/impact'

// ============================================================
// Types
// ============================================================

/**
 * API 錯誤響應
 */
interface ImpactErrorResponse {
  type: string
  title: string
  status: number
  detail: string
}

/**
 * API 成功響應
 */
interface ImpactAnalysisResponse {
  success: true
  data: ImpactAnalysisResult
}

/**
 * Hook 選項
 */
interface UseImpactAnalysisOptions {
  /** 是否啟用查詢 */
  enabled?: boolean
  /** React Query 選項 */
  queryOptions?: Omit<
    UseQueryOptions<ImpactAnalysisResult, Error>,
    'queryKey' | 'queryFn'
  >
}

// ============================================================
// API Functions
// ============================================================

/**
 * 獲取影響分析報告
 *
 * @param suggestionId - 規則建議 ID
 * @returns 影響分析結果
 * @throws 當 API 回傳錯誤時拋出
 */
async function fetchImpactAnalysis(suggestionId: string): Promise<ImpactAnalysisResult> {
  const response = await fetch(`/api/rules/suggestions/${suggestionId}/impact`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  })

  const result = await response.json()

  if (!response.ok || !result.success) {
    const errorResponse = result as ImpactErrorResponse
    throw new Error(errorResponse.detail || 'Failed to fetch impact analysis')
  }

  const successResponse = result as ImpactAnalysisResponse
  return successResponse.data
}

// ============================================================
// Query Hook
// ============================================================

/**
 * 規則影響分析 Hook
 *
 * @param suggestionId - 規則建議 ID
 * @param options - Hook 選項
 * @returns React Query 結果
 *
 * @example
 * ```tsx
 * function ImpactAnalysisPanel({ suggestionId }: { suggestionId: string }) {
 *   const { data, isLoading, error } = useImpactAnalysis(suggestionId)
 *
 *   if (isLoading) return <Skeleton />
 *   if (error) return <ErrorMessage message={error.message} />
 *
 *   return (
 *     <div>
 *       <ImpactStatisticsCards statistics={data.statistics} />
 *       <RiskCasesTable riskCases={data.riskCases} />
 *       <ImpactTimeline timeline={data.timeline} />
 *     </div>
 *   )
 * }
 * ```
 */
export function useImpactAnalysis(
  suggestionId: string | undefined,
  options?: UseImpactAnalysisOptions
) {
  const { enabled = true, queryOptions } = options ?? {}

  return useQuery<ImpactAnalysisResult, Error>({
    queryKey: ['suggestions', 'impact', suggestionId],
    queryFn: () => fetchImpactAnalysis(suggestionId!),
    enabled: enabled && !!suggestionId,
    // 5 分鐘 stale time（影響分析較少變動）
    staleTime: 5 * 60 * 1000,
    // 30 分鐘快取時間
    gcTime: 30 * 60 * 1000,
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
export const impactAnalysisKeys = {
  all: ['suggestions', 'impact'] as const,
  detail: (suggestionId: string) => [...impactAnalysisKeys.all, suggestionId] as const,
}
