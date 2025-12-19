/**
 * @fileoverview 規則建議拒絕 Hook
 * @description
 *   使用 React Query 執行規則建議拒絕操作，包含：
 *   - 拒絕規則建議並記錄原因
 *   - 成功後刷新相關查詢
 *   - 錯誤處理
 *
 * @module src/hooks/useRuleReject
 * @since Epic 4 - Story 4.6 (審核學習規則)
 * @lastModified 2025-12-19
 *
 * @dependencies
 *   - @tanstack/react-query - React Query
 *   - @/types/review - 類型定義
 */

import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { RuleRejectRequest, RuleRejectResponse } from '@/types/review'

// ============================================================
// Types
// ============================================================

/**
 * API 錯誤響應
 */
interface RejectErrorResponse {
  success: false
  error: {
    type: string
    title: string
    status: number
    detail: string
    errors?: Record<string, string[]>
  }
}

// ============================================================
// API Functions
// ============================================================

/**
 * 拒絕規則建議
 *
 * @param suggestionId - 規則建議 ID
 * @param data - 拒絕請求數據
 * @returns 拒絕響應
 * @throws 當 API 回傳錯誤時拋出
 */
async function rejectSuggestion(
  suggestionId: string,
  data: RuleRejectRequest
): Promise<RuleRejectResponse> {
  const response = await fetch(`/api/rules/suggestions/${suggestionId}/reject`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  })

  const result = await response.json()

  if (!response.ok || !result.success) {
    const errorResponse = result as RejectErrorResponse
    throw new Error(errorResponse.error?.detail || 'Failed to reject suggestion')
  }

  return result as RuleRejectResponse
}

// ============================================================
// Mutation Hook
// ============================================================

/**
 * 規則拒絕 Hook
 *
 * @param suggestionId - 規則建議 ID
 * @returns Mutation 結果
 *
 * @example
 * ```tsx
 * function RejectButton({ suggestionId }: { suggestionId: string }) {
 *   const { mutate: reject, isPending } = useRuleReject(suggestionId)
 *
 *   const handleReject = (reason: RejectionReason, detail: string) => {
 *     reject({ reason, reasonDetail: detail }, {
 *       onSuccess: () => {
 *         toast.success('Suggestion rejected')
 *       },
 *       onError: (error) => {
 *         toast.error(error.message)
 *       }
 *     })
 *   }
 *
 *   return (
 *     <RejectDialog
 *       onConfirm={handleReject}
 *       isLoading={isPending}
 *     />
 *   )
 * }
 * ```
 */
export function useRuleReject(suggestionId: string) {
  const queryClient = useQueryClient()

  return useMutation<RuleRejectResponse, Error, RuleRejectRequest>({
    mutationFn: (data) => rejectSuggestion(suggestionId, data),
    onSuccess: () => {
      // 刷新建議列表
      queryClient.invalidateQueries({ queryKey: ['suggestions'] })
      // 刷新建議詳情
      queryClient.invalidateQueries({ queryKey: ['suggestion', suggestionId] })
    },
  })
}
