/**
 * @fileoverview 創建映射規則建議 Hook
 * @description
 *   使用 React Query mutation 創建映射規則建議，包含：
 *   - 提交新規則建議
 *   - 支持草稿模式
 *   - 自動刷新規則列表
 *   - 錯誤處理
 *
 * @module src/hooks/useCreateRule
 * @since Epic 4 - Story 4.2 (建議新映射規則)
 * @lastModified 2025-12-18
 *
 * @dependencies
 *   - @tanstack/react-query - React Query
 *   - @/types/rule - 類型定義
 *
 * @related
 *   - src/app/api/rules/route.ts - API 端點
 *   - src/hooks/useRuleList.ts - 規則列表 Hook
 */

import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { CreateRuleRequest, CreateRuleResponse } from '@/types/rule'
import { ruleListKeys } from './useRuleList'

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
  errors?: Record<string, string[]>
}

/**
 * Hook 選項
 */
interface UseCreateRuleOptions {
  /** 成功回調 */
  onSuccess?: (data: CreateRuleResponse['data']) => void
  /** 錯誤回調 */
  onError?: (error: Error) => void
  /** 總是執行回調（無論成功或失敗） */
  onSettled?: () => void
}

// ============================================================
// API Function
// ============================================================

/**
 * 創建規則建議 API 呼叫
 *
 * @param request - 創建規則請求
 * @returns 創建結果
 * @throws 當 API 回傳錯誤時拋出
 */
async function createRule(
  request: CreateRuleRequest
): Promise<CreateRuleResponse['data']> {
  const response = await fetch('/api/rules', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  })

  const result = await response.json()

  // 處理錯誤響應
  if (!response.ok || !result.success) {
    const errorResponse = result as RuleErrorResponse

    // 如果有欄位錯誤，格式化錯誤訊息
    if (errorResponse.errors) {
      const fieldErrors = Object.entries(errorResponse.errors)
        .map(([field, messages]) => `${field}: ${messages.join(', ')}`)
        .join('; ')
      throw new Error(fieldErrors || errorResponse.detail)
    }

    throw new Error(errorResponse.detail || 'Failed to create rule suggestion')
  }

  return result.data
}

// ============================================================
// Hook
// ============================================================

/**
 * 創建映射規則建議 Hook
 *
 * @param options - Hook 選項
 * @returns React Query mutation 結果
 *
 * @example
 * ```tsx
 * function NewRuleForm() {
 *   const { mutate, isPending, error } = useCreateRule({
 *     onSuccess: (data) => {
 *       toast.success(data.message)
 *       router.push('/rules')
 *     },
 *     onError: (error) => {
 *       toast.error(error.message)
 *     },
 *   })
 *
 *   const handleSubmit = (formData: CreateRuleRequest) => {
 *     mutate(formData)
 *   }
 *
 *   return (
 *     <form onSubmit={handleSubmit}>
 *       // form fields...
 *       <Button type="submit" disabled={isPending}>
 *         {isPending ? 'Submitting...' : 'Submit'}
 *       </Button>
 *       {error && <ErrorMessage message={error.message} />}
 *     </form>
 *   )
 * }
 * ```
 */
export function useCreateRule(options?: UseCreateRuleOptions) {
  const { onSuccess, onError, onSettled } = options ?? {}
  const queryClient = useQueryClient()

  return useMutation<
    CreateRuleResponse['data'],
    Error,
    CreateRuleRequest
  >({
    mutationFn: createRule,
    onSuccess: (data) => {
      // 刷新規則列表快取
      queryClient.invalidateQueries({
        queryKey: ruleListKeys.all,
      })

      // 執行自定義成功回調
      onSuccess?.(data)
    },
    onError: (error) => {
      // 執行自定義錯誤回調
      onError?.(error)
    },
    onSettled: () => {
      // 總是執行回調
      onSettled?.()
    },
  })
}

// ============================================================
// Types Export
// ============================================================

export type { UseCreateRuleOptions }
