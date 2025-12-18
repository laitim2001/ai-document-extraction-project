/**
 * @fileoverview 儲存修正 Hook
 * @description
 *   使用 React Query Mutation 處理欄位修正操作，包含：
 *   - 發送修正請求到 API
 *   - 自動更新相關快取
 *   - 與 reviewStore 整合
 *   - 錯誤處理與重試邏輯
 *
 * @module src/hooks/useSaveCorrections
 * @since Epic 3 - Story 3.5 (修正提取結果)
 * @lastModified 2025-12-18
 *
 * @dependencies
 *   - @tanstack/react-query - React Query
 *   - @/types/review - 類型定義
 *   - @/stores/reviewStore - 狀態管理
 */

import { useMutation, useQueryClient } from '@tanstack/react-query'
import type {
  CorrectRequest,
  CorrectResponse,
  CorrectErrorResponse,
  PendingCorrection,
  CorrectionInput,
} from '@/types/review'
import { useReviewStore } from '@/stores/reviewStore'

// ============================================================
// Types
// ============================================================

/**
 * Mutation 參數
 */
interface SaveCorrectionsParams {
  /** 文件 ID */
  documentId: string
  /** 修正列表 */
  corrections: PendingCorrection[]
}

/**
 * Hook 選項
 */
interface UseSaveCorrectionsOptions {
  /** 成功時的回呼 */
  onSuccess?: (data: CorrectResponse['data']) => void
  /** 失敗時的回呼 */
  onError?: (error: Error) => void
}

// ============================================================
// API Function
// ============================================================

/**
 * 發送修正請求
 *
 * @param params - 請求參數
 * @returns CorrectResponse['data']
 * @throws 當 API 回傳錯誤時拋出
 */
async function saveCorrections(params: SaveCorrectionsParams): Promise<CorrectResponse['data']> {
  const { documentId, corrections } = params

  // 轉換為 API 格式
  const requestBody: CorrectRequest = {
    corrections: corrections.map(
      (c): CorrectionInput => ({
        fieldId: c.fieldId,
        fieldName: c.fieldName,
        originalValue: c.originalValue,
        correctedValue: c.newValue,
        correctionType: 'NORMAL', // 預設為正常修正
      })
    ),
  }

  const response = await fetch(`/api/review/${documentId}/correct`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  })

  const result = await response.json()

  // 處理錯誤響應
  if (!response.ok || !result.success) {
    const errorResponse = result as CorrectErrorResponse
    throw new Error(errorResponse.detail || 'Failed to save corrections')
  }

  return (result as CorrectResponse).data
}

// ============================================================
// Hook
// ============================================================

/**
 * 儲存修正 Hook
 *
 * @param options - Hook 選項
 * @returns React Query Mutation 結果，加上便利方法
 *
 * @example
 * ```tsx
 * function SaveButton({ documentId }: { documentId: string }) {
 *   const { saveAll, isPending, pendingCount } = useSaveCorrections({
 *     onSuccess: () => {
 *       toast.success('修正已儲存')
 *     },
 *     onError: (error) => {
 *       toast.error(error.message)
 *     },
 *   })
 *
 *   return (
 *     <Button
 *       onClick={() => saveAll(documentId)}
 *       disabled={isPending || pendingCount === 0}
 *     >
 *       {isPending ? '儲存中...' : `儲存修正 (${pendingCount})`}
 *     </Button>
 *   )
 * }
 * ```
 */
export function useSaveCorrections(options?: UseSaveCorrectionsOptions) {
  const queryClient = useQueryClient()
  const { getPendingCorrections, resetChanges, hasPendingChanges } = useReviewStore()

  const mutation = useMutation({
    mutationFn: saveCorrections,

    onSuccess: (data, variables) => {
      // 清除 store 中的待處理修改
      resetChanges()

      // 更新審核詳情快取
      queryClient.invalidateQueries({
        queryKey: ['reviewDetail', variables.documentId],
      })

      // 更新審核隊列快取（狀態可能已變更）
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

  /**
   * 儲存所有待處理的修正
   * 從 reviewStore 取得修正列表並送出
   */
  const saveAll = (documentId: string) => {
    const corrections = getPendingCorrections()
    if (corrections.length === 0) return

    mutation.mutate({
      documentId,
      corrections,
    })
  }

  return {
    // 基本 mutation 結果
    ...mutation,

    // 便利方法
    /** 儲存所有待處理的修正 */
    saveAll,
    /** 待處理修正數量 */
    pendingCount: getPendingCorrections().length,
    /** 是否有待處理修正 */
    hasChanges: hasPendingChanges(),
  }
}
