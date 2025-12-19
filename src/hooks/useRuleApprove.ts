/**
 * @fileoverview 規則建議批准 Hook
 * @description
 *   使用 React Query 執行規則建議批准操作，包含：
 *   - 批准規則建議並創建/更新映射規則
 *   - 成功後刷新相關查詢
 *   - 錯誤處理
 *
 * @module src/hooks/useRuleApprove
 * @since Epic 4 - Story 4.6 (審核學習規則)
 * @lastModified 2025-12-19
 *
 * @dependencies
 *   - @tanstack/react-query - React Query
 *   - @/types/review - 類型定義
 */

import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { RuleApproveRequest, RuleApproveResponse } from '@/types/review'

// ============================================================
// Types
// ============================================================

/**
 * API 錯誤響應
 */
interface ApproveErrorResponse {
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
 * 批准規則建議
 *
 * @param suggestionId - 規則建議 ID
 * @param data - 批准請求數據
 * @returns 批准響應
 * @throws 當 API 回傳錯誤時拋出
 */
async function approveSuggestion(
  suggestionId: string,
  data: RuleApproveRequest
): Promise<RuleApproveResponse> {
  const response = await fetch(`/api/rules/suggestions/${suggestionId}/approve`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  })

  const result = await response.json()

  if (!response.ok || !result.success) {
    const errorResponse = result as ApproveErrorResponse
    throw new Error(errorResponse.error?.detail || 'Failed to approve suggestion')
  }

  return result as RuleApproveResponse
}

// ============================================================
// Mutation Hook
// ============================================================

/**
 * 規則批准 Hook
 *
 * @param suggestionId - 規則建議 ID
 * @returns Mutation 結果
 *
 * @example
 * ```tsx
 * function ApproveButton({ suggestionId }: { suggestionId: string }) {
 *   const { mutate: approve, isPending } = useRuleApprove(suggestionId)
 *
 *   const handleApprove = () => {
 *     approve({ notes: 'Approved after review' }, {
 *       onSuccess: (data) => {
 *         toast.success(`Rule v${data.data.ruleVersion} created`)
 *       },
 *       onError: (error) => {
 *         toast.error(error.message)
 *       }
 *     })
 *   }
 *
 *   return (
 *     <Button onClick={handleApprove} disabled={isPending}>
 *       {isPending ? 'Approving...' : 'Approve'}
 *     </Button>
 *   )
 * }
 * ```
 */
export function useRuleApprove(suggestionId: string) {
  const queryClient = useQueryClient()

  return useMutation<RuleApproveResponse, Error, RuleApproveRequest>({
    mutationFn: (data) => approveSuggestion(suggestionId, data),
    onSuccess: () => {
      // 刷新建議列表
      queryClient.invalidateQueries({ queryKey: ['suggestions'] })
      // 刷新建議詳情
      queryClient.invalidateQueries({ queryKey: ['suggestion', suggestionId] })
      // 刷新規則列表
      queryClient.invalidateQueries({ queryKey: ['rules'] })
      // 刷新影響分析
      queryClient.invalidateQueries({ queryKey: ['suggestions', 'impact', suggestionId] })
    },
  })
}
