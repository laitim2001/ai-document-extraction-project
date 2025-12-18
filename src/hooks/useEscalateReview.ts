/**
 * @fileoverview 案例升級 Hook
 * @description
 *   使用 React Query Mutation 處理案例升級操作，包含：
 *   - 發送升級請求到 API
 *   - 自動更新相關快取
 *   - 錯誤處理與狀態管理
 *
 * @module src/hooks/useEscalateReview
 * @since Epic 3 - Story 3.7 (升級複雜案例)
 * @lastModified 2025-12-18
 *
 * @dependencies
 *   - @tanstack/react-query - React Query
 *   - @/types/escalation - 類型定義
 */

import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { EscalateRequest, EscalateResponse } from '@/types/escalation'

// ============================================================
// Types
// ============================================================

/**
 * Mutation 參數
 */
interface EscalateReviewParams {
  /** 文件 ID */
  documentId: string
  /** 升級請求資料 */
  data: EscalateRequest
}

/**
 * API 錯誤響應
 */
interface EscalateErrorResponse {
  type: string
  title: string
  status: number
  detail: string
  instance?: string
  errors?: Record<string, string[]>
}

/**
 * Hook 選項
 */
interface UseEscalateReviewOptions {
  /** 成功時的回呼 */
  onSuccess?: (data: EscalateResponse['data']) => void
  /** 失敗時的回呼 */
  onError?: (error: Error) => void
}

// ============================================================
// API Function
// ============================================================

/**
 * 發送案例升級請求
 *
 * @param params - 請求參數
 * @returns EscalateResponse['data']
 * @throws 當 API 回傳錯誤時拋出
 */
async function escalateReview(
  params: EscalateReviewParams
): Promise<EscalateResponse['data']> {
  const { documentId, data } = params

  const response = await fetch(`/api/review/${documentId}/escalate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  })

  const result = await response.json()

  // 處理錯誤響應
  if (!response.ok || !result.success) {
    const errorResponse = result as EscalateErrorResponse
    throw new Error(errorResponse.detail || 'Failed to escalate document')
  }

  return (result as EscalateResponse).data
}

// ============================================================
// Hook
// ============================================================

/**
 * 案例升級 Hook
 *
 * @param options - Hook 選項
 * @returns React Query Mutation 結果
 *
 * @example
 * ```tsx
 * function EscalateButton({ documentId, fileName }: Props) {
 *   const [showDialog, setShowDialog] = useState(false)
 *   const { mutate, isPending } = useEscalateReview({
 *     onSuccess: () => {
 *       toast.success('案例已升級')
 *       router.push('/review')
 *     },
 *     onError: (error) => {
 *       toast.error(error.message)
 *     },
 *   })
 *
 *   const handleEscalate = (data: EscalateRequest) => {
 *     mutate({
 *       documentId,
 *       data,
 *     })
 *   }
 *
 *   return (
 *     <>
 *       <Button onClick={() => setShowDialog(true)}>
 *         升級案例
 *       </Button>
 *       <EscalationDialog
 *         open={showDialog}
 *         onOpenChange={setShowDialog}
 *         onConfirm={handleEscalate}
 *         documentName={fileName}
 *         isSubmitting={isPending}
 *       />
 *     </>
 *   )
 * }
 * ```
 */
export function useEscalateReview(options?: UseEscalateReviewOptions) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: escalateReview,

    onSuccess: (data, variables) => {
      // 更新審核詳情快取
      queryClient.invalidateQueries({
        queryKey: ['reviewDetail', variables.documentId],
      })

      // 更新審核隊列快取
      queryClient.invalidateQueries({
        queryKey: ['reviewQueue'],
      })

      // 更新升級案例列表快取（如果存在）
      queryClient.invalidateQueries({
        queryKey: ['escalations'],
      })

      // 呼叫使用者提供的回呼
      options?.onSuccess?.(data)
    },

    onError: (error: Error) => {
      options?.onError?.(error)
    },
  })
}
