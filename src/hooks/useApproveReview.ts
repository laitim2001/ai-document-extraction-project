/**
 * @fileoverview 審核確認 Hook
 * @description
 *   使用 React Query Mutation 處理審核確認操作，包含：
 *   - 發送確認請求到 API
 *   - 自動更新相關快取
 *   - 錯誤處理與 Toast 提示
 *
 * @module src/hooks/useApproveReview
 * @since Epic 3 - Story 3.4 (確認提取結果)
 * @lastModified 2025-12-18
 *
 * @dependencies
 *   - @tanstack/react-query - React Query
 *   - @/types/review - 類型定義
 */

import { useMutation, useQueryClient } from '@tanstack/react-query'
import type {
  ApproveRequest,
  ApproveResponse,
  ApproveErrorResponse,
} from '@/types/review'

// ============================================================
// Types
// ============================================================

/**
 * Mutation 參數
 */
interface ApproveReviewParams {
  /** 文件 ID */
  documentId: string
  /** 確認請求資料 */
  data: ApproveRequest
}

/**
 * Hook 選項
 */
interface UseApproveReviewOptions {
  /** 成功時的回呼 */
  onSuccess?: (data: ApproveResponse['data']) => void
  /** 失敗時的回呼 */
  onError?: (error: Error) => void
}

// ============================================================
// API Function
// ============================================================

/**
 * 發送審核確認請求
 *
 * @param params - 請求參數
 * @returns ApproveResponse['data']
 * @throws 當 API 回傳錯誤時拋出
 */
async function approveReview(params: ApproveReviewParams): Promise<ApproveResponse['data']> {
  const { documentId, data } = params

  const response = await fetch(`/api/review/${documentId}/approve`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  })

  const result = await response.json()

  // 處理錯誤響應
  if (!response.ok || !result.success) {
    const errorResponse = result as ApproveErrorResponse
    throw new Error(errorResponse.detail || 'Failed to approve document')
  }

  return (result as ApproveResponse).data
}

// ============================================================
// Hook
// ============================================================

/**
 * 審核確認 Hook
 *
 * @param options - Hook 選項
 * @returns React Query Mutation 結果
 *
 * @example
 * ```tsx
 * function ApproveButton({ documentId }: { documentId: string }) {
 *   const { mutate, isPending } = useApproveReview({
 *     onSuccess: () => {
 *       toast.success('審核確認成功')
 *       router.push('/review')
 *     },
 *     onError: (error) => {
 *       toast.error(error.message)
 *     },
 *   })
 *
 *   const handleApprove = () => {
 *     mutate({
 *       documentId,
 *       data: {
 *         confirmedFields: ['invoiceNumber', 'totalAmount'],
 *         notes: '已確認所有欄位',
 *         reviewStartedAt: new Date().toISOString(),
 *       },
 *     })
 *   }
 *
 *   return (
 *     <Button onClick={handleApprove} disabled={isPending}>
 *       {isPending ? '確認中...' : '確認無誤'}
 *     </Button>
 *   )
 * }
 * ```
 */
export function useApproveReview(options?: UseApproveReviewOptions) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: approveReview,

    onSuccess: (data, variables) => {
      // 更新審核詳情快取
      queryClient.invalidateQueries({
        queryKey: ['reviewDetail', variables.documentId],
      })

      // 更新審核隊列快取
      queryClient.invalidateQueries({
        queryKey: ['reviewQueue'],
      })

      // 呼叫使用者提供的回呼
      options?.onSuccess?.(data)
    },

    onError: (error: Error) => {
      options?.onError?.(error)
    },
  })
}
