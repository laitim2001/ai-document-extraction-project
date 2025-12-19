/**
 * @fileoverview 規則編輯 Hook
 * @description
 *   使用 React Query mutation 處理規則編輯操作，包含：
 *   - 更新現有規則（創建變更請求）
 *   - 創建新規則（創建變更請求）
 *   - 自動刷新規則列表
 *   - 錯誤處理
 *
 * @module src/hooks/useRuleEdit
 * @since Epic 5 - Story 5.3 (編輯 Forwarder 映射規則)
 * @lastModified 2025-12-19
 *
 * @dependencies
 *   - @tanstack/react-query - React Query
 *   - @/types/change-request - 變更請求類型
 *
 * @related
 *   - src/app/api/forwarders/[id]/rules/route.ts - 創建規則 API
 *   - src/app/api/forwarders/[id]/rules/[ruleId]/route.ts - 更新規則 API
 *   - src/services/rule-change.service.ts - 規則變更服務
 */

import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { ExtractionType } from '@prisma/client'

// ============================================================
// Types
// ============================================================

/**
 * API 錯誤響應
 */
interface ApiErrorResponse {
  success: false
  error: {
    type: string
    title: string
    status: number
    detail: string
    errors?: Record<string, string[]>
  }
}

/**
 * 更新規則請求
 */
export interface UpdateRuleRequest {
  /** Forwarder ID */
  forwarderId: string
  /** 規則 ID */
  ruleId: string
  /** 更新內容 */
  updates: {
    extractionType?: ExtractionType
    pattern?: Record<string, unknown>
    priority?: number
    confidence?: number
    description?: string
  }
  /** 變更原因 */
  reason: string
}

/**
 * 創建規則請求
 */
export interface CreateRuleRequest {
  /** Forwarder ID */
  forwarderId: string
  /** 欄位名稱 */
  fieldName: string
  /** 欄位標籤 */
  fieldLabel: string
  /** 提取類型 */
  extractionType: ExtractionType
  /** 提取模式配置 */
  pattern: Record<string, unknown>
  /** 優先級 */
  priority?: number
  /** 信心度閾值 */
  confidence?: number
  /** 規則描述 */
  description?: string
  /** 是否必填 */
  isRequired?: boolean
  /** 驗證正則 */
  validationPattern?: string
  /** 欄位類別 */
  category?: string
  /** 新增原因 */
  reason: string
}

/**
 * 變更請求響應
 */
interface ChangeRequestResponse {
  success: true
  data: {
    changeRequestId: string
    status: string
    message: string
    fieldName?: string
    rule?: {
      id: string
      fieldName?: string
    }
  }
}

/**
 * Hook 選項
 */
interface UseRuleEditOptions {
  /** 成功回調 */
  onSuccess?: (data: ChangeRequestResponse['data']) => void
  /** 錯誤回調 */
  onError?: (error: Error) => void
  /** 總是執行回調 */
  onSettled?: () => void
}

// ============================================================
// Query Keys
// ============================================================

/**
 * 規則相關的 Query Keys
 */
export const ruleKeys = {
  all: ['rules'] as const,
  lists: () => [...ruleKeys.all, 'list'] as const,
  list: (forwarderId: string) => [...ruleKeys.lists(), forwarderId] as const,
  details: () => [...ruleKeys.all, 'detail'] as const,
  detail: (id: string) => [...ruleKeys.details(), id] as const,
} as const

// ============================================================
// API Functions
// ============================================================

/**
 * 更新規則 API 呼叫
 *
 * @param request - 更新規則請求
 * @returns 變更請求響應
 * @throws 當 API 回傳錯誤時拋出
 */
async function updateRule(
  request: UpdateRuleRequest
): Promise<ChangeRequestResponse['data']> {
  const { forwarderId, ruleId, updates, reason } = request

  const response = await fetch(`/api/forwarders/${forwarderId}/rules/${ruleId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      ...updates,
      reason,
    }),
  })

  const result = await response.json()

  if (!response.ok || !result.success) {
    const errorResponse = result as ApiErrorResponse

    if (errorResponse.error?.errors) {
      const fieldErrors = Object.entries(errorResponse.error.errors)
        .map(([field, messages]) => `${field}: ${messages.join(', ')}`)
        .join('; ')
      throw new Error(fieldErrors || errorResponse.error.detail)
    }

    throw new Error(errorResponse.error?.detail || '更新規則失敗')
  }

  return result.data
}

/**
 * 創建規則 API 呼叫
 *
 * @param request - 創建規則請求
 * @returns 變更請求響應
 * @throws 當 API 回傳錯誤時拋出
 */
async function createRule(
  request: CreateRuleRequest
): Promise<ChangeRequestResponse['data']> {
  const { forwarderId, ...ruleData } = request

  const response = await fetch(`/api/forwarders/${forwarderId}/rules`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(ruleData),
  })

  const result = await response.json()

  if (!response.ok || !result.success) {
    const errorResponse = result as ApiErrorResponse

    if (errorResponse.error?.errors) {
      const fieldErrors = Object.entries(errorResponse.error.errors)
        .map(([field, messages]) => `${field}: ${messages.join(', ')}`)
        .join('; ')
      throw new Error(fieldErrors || errorResponse.error.detail)
    }

    throw new Error(errorResponse.error?.detail || '創建規則失敗')
  }

  return result.data
}

// ============================================================
// Hooks
// ============================================================

/**
 * 更新規則 Hook
 *
 * @description
 *   用於更新現有規則。實際上會創建一個變更請求，
 *   需要審核者批准後才會生效。
 *
 * @param options - Hook 選項
 * @returns React Query mutation 結果
 *
 * @example
 * ```tsx
 * function RuleEditForm({ rule }) {
 *   const { mutate, isPending } = useUpdateRule({
 *     onSuccess: (data) => {
 *       toast.success(data.message)
 *     },
 *   })
 *
 *   const handleSubmit = (formData) => {
 *     mutate({
 *       forwarderId: rule.forwarderId,
 *       ruleId: rule.id,
 *       updates: formData,
 *       reason: '提高提取準確度'
 *     })
 *   }
 * }
 * ```
 */
export function useUpdateRule(options?: UseRuleEditOptions) {
  const { onSuccess, onError, onSettled } = options ?? {}
  const queryClient = useQueryClient()

  return useMutation<ChangeRequestResponse['data'], Error, UpdateRuleRequest>({
    mutationFn: updateRule,
    onSuccess: (data, variables) => {
      // 刷新規則列表和詳情快取
      queryClient.invalidateQueries({
        queryKey: ruleKeys.list(variables.forwarderId),
      })
      queryClient.invalidateQueries({
        queryKey: ruleKeys.detail(variables.ruleId),
      })

      onSuccess?.(data)
    },
    onError,
    onSettled,
  })
}

/**
 * 創建規則 Hook
 *
 * @description
 *   用於創建新規則。實際上會創建一個變更請求，
 *   需要審核者批准後才會生效。
 *
 * @param options - Hook 選項
 * @returns React Query mutation 結果
 *
 * @example
 * ```tsx
 * function NewRuleForm({ forwarderId }) {
 *   const { mutate, isPending } = useCreateForwarderRule({
 *     onSuccess: (data) => {
 *       toast.success(data.message)
 *     },
 *   })
 *
 *   const handleSubmit = (formData) => {
 *     mutate({
 *       forwarderId,
 *       ...formData,
 *       reason: '新增欄位提取規則'
 *     })
 *   }
 * }
 * ```
 */
export function useCreateForwarderRule(options?: UseRuleEditOptions) {
  const { onSuccess, onError, onSettled } = options ?? {}
  const queryClient = useQueryClient()

  return useMutation<ChangeRequestResponse['data'], Error, CreateRuleRequest>({
    mutationFn: createRule,
    onSuccess: (data, variables) => {
      // 刷新規則列表快取
      queryClient.invalidateQueries({
        queryKey: ruleKeys.list(variables.forwarderId),
      })

      onSuccess?.(data)
    },
    onError,
    onSettled,
  })
}

// ============================================================
// Types Export
// ============================================================

export type { UseRuleEditOptions, ChangeRequestResponse }
