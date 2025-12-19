/**
 * @fileoverview 規則建議詳情 Hook
 * @description
 *   使用 React Query 獲取規則建議詳情，包含：
 *   - 完整建議資訊
 *   - 規則對比（現有 vs 建議）
 *   - 影響分析
 *   - 樣本案例
 *
 * @module src/hooks/useSuggestionDetail
 * @since Epic 4 - Story 4.4 (規則升級建議生成)
 * @lastModified 2025-12-19
 *
 * @dependencies
 *   - @tanstack/react-query - React Query
 *   - @/types/suggestion - 類型定義
 */

import { useQuery, useMutation, useQueryClient, UseQueryOptions } from '@tanstack/react-query'
import type { SuggestionDetail } from '@/types/suggestion'

// ============================================================
// Types
// ============================================================

/**
 * API 錯誤響應
 */
interface SuggestionErrorResponse {
  type: string
  title: string
  status: number
  detail: string
}

/**
 * API 成功響應
 */
interface SuggestionDetailResponse {
  success: true
  data: SuggestionDetail
}

/**
 * 更新建議請求
 */
interface UpdateSuggestionRequest {
  status?: 'APPROVED' | 'REJECTED' | 'IMPLEMENTED'
  reviewNotes?: string
  implementRule?: boolean
}

/**
 * 更新建議響應
 */
interface UpdateSuggestionResponse {
  success: true
  data: {
    id: string
    status: string
    reviewedAt: string | null
    implementedAt: string | null
    createdRuleId: string | null
  }
}

/**
 * Hook 選項
 */
interface UseSuggestionDetailOptions {
  /** 是否啟用查詢 */
  enabled?: boolean
  /** React Query 選項 */
  queryOptions?: Omit<
    UseQueryOptions<SuggestionDetail, Error>,
    'queryKey' | 'queryFn'
  >
}

// ============================================================
// API Functions
// ============================================================

/**
 * 獲取建議詳情
 *
 * @param id - 建議 ID
 * @returns 建議詳情
 * @throws 當 API 回傳錯誤時拋出
 */
async function fetchSuggestionDetail(id: string): Promise<SuggestionDetail> {
  const response = await fetch(`/api/rules/suggestions/${id}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  })

  const result = await response.json()

  if (!response.ok || !result.success) {
    const errorResponse = result as SuggestionErrorResponse
    throw new Error(errorResponse.detail || 'Failed to fetch suggestion detail')
  }

  const successResponse = result as SuggestionDetailResponse
  return successResponse.data
}

/**
 * 更新建議狀態
 *
 * @param id - 建議 ID
 * @param data - 更新資料
 * @returns 更新結果
 */
async function updateSuggestion(
  id: string,
  data: UpdateSuggestionRequest
): Promise<UpdateSuggestionResponse['data']> {
  const response = await fetch(`/api/rules/suggestions/${id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  })

  const result = await response.json()

  if (!response.ok || !result.success) {
    const errorResponse = result as SuggestionErrorResponse
    throw new Error(errorResponse.detail || 'Failed to update suggestion')
  }

  return (result as UpdateSuggestionResponse).data
}

// ============================================================
// Query Hook
// ============================================================

/**
 * 規則建議詳情 Hook
 *
 * @param id - 建議 ID
 * @param options - Hook 選項
 * @returns React Query 結果
 *
 * @example
 * ```tsx
 * function SuggestionDetailPage({ id }: { id: string }) {
 *   const { data, isLoading, error } = useSuggestionDetail(id)
 *
 *   if (isLoading) return <Skeleton />
 *   if (error) return <ErrorMessage message={error.message} />
 *
 *   return (
 *     <div>
 *       <SuggestionHeader suggestion={data} />
 *       <RuleComparison
 *         currentRule={data.currentRule}
 *         suggestedRule={data.suggestedRule}
 *       />
 *       <ImpactAnalysis impact={data.expectedImpact} />
 *       <SampleCases samples={data.sampleCases} />
 *     </div>
 *   )
 * }
 * ```
 */
export function useSuggestionDetail(
  id: string | undefined,
  options?: UseSuggestionDetailOptions
) {
  const { enabled = true, queryOptions } = options ?? {}

  return useQuery<SuggestionDetail, Error>({
    queryKey: ['suggestions', 'detail', id],
    queryFn: () => fetchSuggestionDetail(id!),
    enabled: enabled && !!id,
    // 30 秒 stale time
    staleTime: 30 * 1000,
    ...queryOptions,
  })
}

// ============================================================
// Mutation Hooks
// ============================================================

/**
 * 審批建議 Hook
 *
 * @returns Mutation 結果
 *
 * @example
 * ```tsx
 * function ApproveButton({ id }: { id: string }) {
 *   const { mutate: approve, isPending } = useApproveSuggestion()
 *
 *   return (
 *     <Button
 *       onClick={() => approve({ id, notes: 'Looks good' })}
 *       disabled={isPending}
 *     >
 *       {isPending ? '處理中...' : '核准'}
 *     </Button>
 *   )
 * }
 * ```
 */
export function useApproveSuggestion() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, notes }: { id: string; notes?: string }) =>
      updateSuggestion(id, {
        status: 'APPROVED',
        reviewNotes: notes,
      }),
    onSuccess: (_, { id }) => {
      // 刷新詳情
      queryClient.invalidateQueries({ queryKey: ['suggestions', 'detail', id] })
      // 刷新列表
      queryClient.invalidateQueries({ queryKey: ['suggestions'] })
    },
  })
}

/**
 * 拒絕建議 Hook
 *
 * @returns Mutation 結果
 */
export function useRejectSuggestion() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, notes }: { id: string; notes?: string }) =>
      updateSuggestion(id, {
        status: 'REJECTED',
        reviewNotes: notes,
      }),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['suggestions', 'detail', id] })
      queryClient.invalidateQueries({ queryKey: ['suggestions'] })
    },
  })
}

/**
 * 實施建議為規則 Hook
 *
 * @returns Mutation 結果
 *
 * @example
 * ```tsx
 * function ImplementButton({ id }: { id: string }) {
 *   const { mutate: implement, isPending, data } = useImplementSuggestion()
 *
 *   return (
 *     <Button
 *       onClick={() => implement({ id })}
 *       disabled={isPending}
 *     >
 *       {isPending ? '實施中...' : '實施規則'}
 *     </Button>
 *   )
 * }
 * ```
 */
export function useImplementSuggestion() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, notes }: { id: string; notes?: string }) =>
      updateSuggestion(id, {
        status: 'IMPLEMENTED',
        implementRule: true,
        reviewNotes: notes,
      }),
    onSuccess: (_, { id }) => {
      // 刷新建議相關
      queryClient.invalidateQueries({ queryKey: ['suggestions', 'detail', id] })
      queryClient.invalidateQueries({ queryKey: ['suggestions'] })
      // 刷新規則列表
      queryClient.invalidateQueries({ queryKey: ['rules'] })
    },
  })
}

// ============================================================
// Generate Suggestion Hook
// ============================================================

/**
 * 生成建議響應
 */
interface GenerateSuggestionResponse {
  success: true
  data: {
    suggestionId: string
    inferredRule: {
      type: string
      pattern: string
      confidence: number
      explanation: string
    }
    impact: {
      affectedDocuments: number
      estimatedImprovement: number
      currentAccuracy: number | null
      predictedAccuracy: number
      riskCount: number
    }
  }
}

/**
 * 從 Pattern 生成建議 Hook
 *
 * @returns Mutation 結果
 *
 * @example
 * ```tsx
 * function GenerateButton({ patternId }: { patternId: string }) {
 *   const { mutate: generate, isPending } = useGenerateSuggestion()
 *
 *   return (
 *     <Button
 *       onClick={() => generate(patternId)}
 *       disabled={isPending}
 *     >
 *       {isPending ? '生成中...' : '生成建議'}
 *     </Button>
 *   )
 * }
 * ```
 */
export function useGenerateSuggestion() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (patternId: string) => {
      const response = await fetch('/api/rules/suggestions/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ patternId }),
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        const errorResponse = result as SuggestionErrorResponse
        throw new Error(errorResponse.detail || 'Failed to generate suggestion')
      }

      return (result as GenerateSuggestionResponse).data
    },
    onSuccess: () => {
      // 刷新建議列表
      queryClient.invalidateQueries({ queryKey: ['suggestions'] })
      // 刷新修正模式列表
      queryClient.invalidateQueries({ queryKey: ['correction-patterns'] })
    },
  })
}

/**
 * 批量生成建議響應
 */
interface BatchGenerateResponse {
  success: true
  data: {
    processed: number
    succeeded: number
    failed: number
    errors: string[]
    hasMoreErrors: boolean
  }
}

/**
 * 批量生成建議 Hook
 *
 * @returns Mutation 結果
 */
export function useBatchGenerateSuggestions() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (limit?: number) => {
      const response = await fetch('/api/rules/suggestions/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ batch: true, limit }),
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        const errorResponse = result as SuggestionErrorResponse
        throw new Error(errorResponse.detail || 'Failed to batch generate suggestions')
      }

      return (result as BatchGenerateResponse).data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suggestions'] })
      queryClient.invalidateQueries({ queryKey: ['correction-patterns'] })
    },
  })
}

// ============================================================
// Query Key Factory
// ============================================================

/**
 * Query Key 工廠函數
 * @description 用於外部快取操作
 */
export const suggestionDetailKeys = {
  all: ['suggestions'] as const,
  details: () => [...suggestionDetailKeys.all, 'detail'] as const,
  detail: (id: string) => [...suggestionDetailKeys.details(), id] as const,
}
