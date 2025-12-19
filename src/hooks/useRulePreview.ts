/**
 * @fileoverview 規則預覽 Hook
 * @description
 *   使用 React Query mutation 處理規則預覽操作，包含：
 *   - 在文件上測試規則提取效果
 *   - 預覽自定義 pattern 的提取結果
 *   - 提供調試資訊
 *
 * @module src/hooks/useRulePreview
 * @since Epic 5 - Story 5.3 (編輯 Forwarder 映射規則)
 * @lastModified 2025-12-19
 *
 * @dependencies
 *   - @tanstack/react-query - React Query
 *   - @prisma/client - ExtractionType enum
 *
 * @related
 *   - src/app/api/rules/[id]/preview/route.ts - 預覽 API
 *   - src/components/features/rules/RulePreview.tsx - 預覽組件
 */

import { useMutation } from '@tanstack/react-query'
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
 * 預覽請求
 */
export interface RulePreviewRequest {
  /** 規則 ID */
  ruleId: string
  /** 測試文件 ID（與 documentContent 二選一） */
  documentId?: string
  /** 測試文件內容（Base64 或純文字） */
  documentContent?: string
  /** 自定義提取模式（用於預覽修改後的效果） */
  previewPattern?: Record<string, unknown>
  /** 自定義提取類型 */
  previewExtractionType?: ExtractionType
}

/**
 * 匹配位置資訊
 */
interface MatchPosition {
  page: number
  x: number
  y: number
  width: number
  height: number
}

/**
 * 調試資訊
 */
interface DebugInfo {
  patternMatched: boolean
  matchDetails?: string
  errorMessage?: string
}

/**
 * 預覽結果
 */
export interface RulePreviewResult {
  /** 是否匹配成功 */
  matched: boolean
  /** 提取的值 */
  extractedValue: string | null
  /** 信心度 (0-1) */
  confidence: number
  /** 處理時間（毫秒） */
  processingTime: number
  /** 匹配位置（如果有） */
  matchPosition?: MatchPosition
  /** 調試資訊 */
  debugInfo?: DebugInfo
  /** 規則資訊 */
  rule: {
    id: string
    fieldName: string
    fieldLabel: string
  }
  /** 文件資訊（如果使用 documentId） */
  document: {
    id: string
    fileName: string
  } | null
  /** 預覽配置 */
  previewConfig: {
    usedCustomPattern: boolean
    usedCustomType: boolean
  }
}

/**
 * Hook 選項
 */
interface UseRulePreviewOptions {
  /** 成功回調 */
  onSuccess?: (data: RulePreviewResult) => void
  /** 錯誤回調 */
  onError?: (error: Error) => void
  /** 總是執行回調 */
  onSettled?: () => void
}

// ============================================================
// API Functions
// ============================================================

/**
 * 預覽規則 API 呼叫
 *
 * @param request - 預覽請求
 * @returns 預覽結果
 * @throws 當 API 回傳錯誤時拋出
 */
async function previewRule(request: RulePreviewRequest): Promise<RulePreviewResult> {
  const { ruleId, ...previewData } = request

  const response = await fetch(`/api/rules/${ruleId}/preview`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(previewData),
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

    throw new Error(errorResponse.error?.detail || '預覽規則失敗')
  }

  return result.data
}

// ============================================================
// Hooks
// ============================================================

/**
 * 規則預覽 Hook
 *
 * @description
 *   用於在文件上測試規則的提取效果。
 *   支援使用自定義 pattern 預覽修改後的效果。
 *
 * @param options - Hook 選項
 * @returns React Query mutation 結果
 *
 * @example
 * ```tsx
 * function RulePreviewSection({ ruleId, documentId }) {
 *   const { mutate: preview, data, isPending } = useRulePreview({
 *     onSuccess: (result) => {
 *       if (result.matched) {
 *         toast.success(`提取成功: ${result.extractedValue}`)
 *       } else {
 *         toast.warning('未匹配到任何內容')
 *       }
 *     },
 *   })
 *
 *   const handlePreview = () => {
 *     preview({
 *       ruleId,
 *       documentId,
 *     })
 *   }
 *
 *   const handlePreviewWithCustomPattern = (pattern) => {
 *     preview({
 *       ruleId,
 *       documentId,
 *       previewPattern: pattern,
 *     })
 *   }
 *
 *   return (
 *     <div>
 *       <Button onClick={handlePreview} disabled={isPending}>
 *         {isPending ? '預覽中...' : '預覽'}
 *       </Button>
 *       {data && (
 *         <div>
 *           <p>匹配: {data.matched ? '是' : '否'}</p>
 *           <p>提取值: {data.extractedValue || '無'}</p>
 *           <p>信心度: {(data.confidence * 100).toFixed(1)}%</p>
 *         </div>
 *       )}
 *     </div>
 *   )
 * }
 * ```
 */
export function useRulePreview(options?: UseRulePreviewOptions) {
  const { onSuccess, onError, onSettled } = options ?? {}

  return useMutation<RulePreviewResult, Error, RulePreviewRequest>({
    mutationFn: previewRule,
    onSuccess,
    onError,
    onSettled,
  })
}

// ============================================================
// Types Export
// ============================================================

export type { UseRulePreviewOptions }
