/**
 * @fileoverview 處理升級案例 Hook
 * @description
 *   使用 React Query Mutation 處理升級案例，包含：
 *   - 支持 APPROVED/CORRECTED/REJECTED 決策
 *   - 自動更新相關快取
 *   - 錯誤處理與狀態管理
 *   - 可選創建規則建議
 *
 * @module src/hooks/useResolveEscalation
 * @since Epic 3 - Story 3.8 (Super User 處理升級案例)
 * @lastModified 2025-12-18
 *
 * @dependencies
 *   - @tanstack/react-query - React Query
 *   - @/types/escalation - 類型定義
 */

import { useMutation, useQueryClient } from '@tanstack/react-query'
import type {
  ResolveEscalationRequest,
  ResolveEscalationResponse,
} from '@/types/escalation'

// ============================================================
// Types
// ============================================================

/**
 * Mutation 參數
 */
interface ResolveEscalationParams {
  /** 升級案例 ID */
  escalationId: string
  /** 處理請求資料 */
  data: ResolveEscalationRequest
}

/**
 * API 錯誤響應
 */
interface ResolveErrorResponse {
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
interface UseResolveEscalationOptions {
  /** 成功時的回呼 */
  onSuccess?: (data: ResolveEscalationResponse['data']) => void
  /** 失敗時的回呼 */
  onError?: (error: Error) => void
}

// ============================================================
// API Function
// ============================================================

/**
 * 發送處理升級案例請求
 *
 * @param params - 請求參數
 * @returns ResolveEscalationResponse['data']
 * @throws 當 API 回傳錯誤時拋出
 */
async function resolveEscalation(
  params: ResolveEscalationParams
): Promise<ResolveEscalationResponse['data']> {
  const { escalationId, data } = params

  const response = await fetch(`/api/escalations/${escalationId}/resolve`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  })

  const result = await response.json()

  // 處理錯誤響應
  if (!response.ok || !result.success) {
    const errorResponse = result as ResolveErrorResponse
    throw new Error(errorResponse.detail || 'Failed to resolve escalation')
  }

  return (result as ResolveEscalationResponse).data
}

// ============================================================
// Hook
// ============================================================

/**
 * 處理升級案例 Hook
 *
 * @param options - Hook 選項
 * @returns React Query Mutation 結果
 *
 * @example
 * ```tsx
 * function ResolveDialog({ escalation, onClose }: Props) {
 *   const [decision, setDecision] = useState<ResolveDecision>('APPROVED')
 *   const [corrections, setCorrections] = useState<CorrectionItem[]>([])
 *
 *   const { mutate, isPending } = useResolveEscalation({
 *     onSuccess: (data) => {
 *       toast.success(`案例已${decision === 'APPROVED' ? '核准' : decision === 'CORRECTED' ? '修正' : '拒絕'}`)
 *       onClose()
 *       router.push('/escalations')
 *     },
 *     onError: (error) => {
 *       toast.error(error.message)
 *     },
 *   })
 *
 *   const handleSubmit = () => {
 *     mutate({
 *       escalationId: escalation.id,
 *       data: {
 *         decision,
 *         corrections: decision === 'CORRECTED' ? corrections : undefined,
 *         notes: notesValue,
 *       },
 *     })
 *   }
 *
 *   return (
 *     <Dialog>
 *       <DecisionSelector value={decision} onChange={setDecision} />
 *       {decision === 'CORRECTED' && (
 *         <CorrectionEditor value={corrections} onChange={setCorrections} />
 *       )}
 *       <Button onClick={handleSubmit} disabled={isPending}>
 *         {isPending ? '處理中...' : '確認'}
 *       </Button>
 *     </Dialog>
 *   )
 * }
 * ```
 */
export function useResolveEscalation(options?: UseResolveEscalationOptions) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: resolveEscalation,

    onSuccess: (data, variables) => {
      // 更新升級案例詳情快取
      queryClient.invalidateQueries({
        queryKey: ['escalationDetail', variables.escalationId],
      })

      // 更新升級案例列表快取
      queryClient.invalidateQueries({
        queryKey: ['escalations'],
      })

      // 更新審核隊列快取（因為文件狀態改變）
      queryClient.invalidateQueries({
        queryKey: ['reviewQueue'],
      })

      // 更新審核詳情快取（因為文件狀態改變）
      queryClient.invalidateQueries({
        queryKey: ['reviewDetail', data.documentId],
      })

      // 如果創建了規則建議，更新規則建議列表快取
      if (data.ruleSuggestionId) {
        queryClient.invalidateQueries({
          queryKey: ['ruleSuggestions'],
        })
      }

      // 呼叫使用者提供的回呼
      options?.onSuccess?.(data)
    },

    onError: (error: Error) => {
      options?.onError?.(error)
    },
  })
}

/**
 * Mutation Key 工廠函數
 * @description 用於外部操作
 */
export const resolveEscalationKeys = {
  all: ['resolveEscalation'] as const,
  resolve: (escalationId: string) =>
    [...resolveEscalationKeys.all, escalationId] as const,
}
