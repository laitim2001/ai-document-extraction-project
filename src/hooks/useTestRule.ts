/**
 * @fileoverview 測試映射規則 Hook
 * @description
 *   使用 React Query mutation 測試映射規則，包含：
 *   - 測試提取模式效果
 *   - 支持文件內容或已上傳文件測試
 *   - 返回詳細的匹配結果
 *   - 包含調試資訊
 *
 * @module src/hooks/useTestRule
 * @since Epic 4 - Story 4.2 (建議新映射規則)
 * @lastModified 2025-12-18
 *
 * @dependencies
 *   - @tanstack/react-query - React Query
 *   - @/types/rule - 類型定義
 *
 * @related
 *   - src/app/api/rules/test/route.ts - API 端點
 *   - src/components/features/rules/RuleTestPanel.tsx - 測試面板
 */

import { useMutation } from '@tanstack/react-query'
import type { TestRuleRequest } from '@/types/rule'

// ============================================================
// Types
// ============================================================

/**
 * API 錯誤響應
 */
interface TestErrorResponse {
  type: string
  title: string
  status: number
  detail: string
  errors?: Record<string, string[]>
}

/**
 * 測試結果資料
 */
interface TestResultData {
  /** 是否匹配成功 */
  matched: boolean
  /** 提取的值 */
  extractedValue: string | null
  /** 信心度 (0-1) */
  confidence: number
  /** 匹配位置列表 */
  matchPositions?: {
    start: number
    end: number
    line?: number
    column?: number
    context?: string
  }[]
  /** 調試資訊 */
  debugInfo?: {
    processingTime: number
    matchAttempts: number
    errors?: string[]
  }
}

/**
 * Hook 選項
 */
interface UseTestRuleOptions {
  /** 成功回調 */
  onSuccess?: (data: TestResultData) => void
  /** 錯誤回調 */
  onError?: (error: Error) => void
  /** 總是執行回調（無論成功或失敗） */
  onSettled?: () => void
}

// ============================================================
// API Function
// ============================================================

/**
 * 測試規則 API 呼叫
 *
 * @param request - 測試規則請求
 * @returns 測試結果
 * @throws 當 API 回傳錯誤時拋出
 */
async function testRule(request: TestRuleRequest): Promise<TestResultData> {
  const response = await fetch('/api/rules/test', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  })

  const result = await response.json()

  // 處理錯誤響應
  if (!response.ok || !result.success) {
    const errorResponse = result as TestErrorResponse

    // 如果有欄位錯誤，格式化錯誤訊息
    if (errorResponse.errors) {
      const fieldErrors = Object.entries(errorResponse.errors)
        .map(([field, messages]) => `${field}: ${messages.join(', ')}`)
        .join('; ')
      throw new Error(fieldErrors || errorResponse.detail)
    }

    throw new Error(errorResponse.detail || 'Failed to test rule')
  }

  return result.data as TestResultData
}

// ============================================================
// Hook
// ============================================================

/**
 * 測試映射規則 Hook
 *
 * @param options - Hook 選項
 * @returns React Query mutation 結果
 *
 * @example
 * ```tsx
 * function RuleTestPanel() {
 *   const { mutate, isPending, data, error, reset } = useTestRule({
 *     onSuccess: (result) => {
 *       if (result.matched) {
 *         toast.success(`Matched! Value: ${result.extractedValue}`)
 *       } else {
 *         toast.warning('No match found')
 *       }
 *     },
 *     onError: (error) => {
 *       toast.error(error.message)
 *     },
 *   })
 *
 *   const handleTest = () => {
 *     mutate({
 *       extractionType: 'REGEX',
 *       pattern: '^Invoice No[.:]?\\s*(\\S+)',
 *       documentContent: testContent,
 *     })
 *   }
 *
 *   return (
 *     <div>
 *       <Button onClick={handleTest} disabled={isPending}>
 *         {isPending ? 'Testing...' : 'Test Pattern'}
 *       </Button>
 *       {data && <TestResultDisplay result={data} />}
 *       {error && <ErrorMessage message={error.message} />}
 *     </div>
 *   )
 * }
 * ```
 */
export function useTestRule(options?: UseTestRuleOptions) {
  const { onSuccess, onError, onSettled } = options ?? {}

  return useMutation<TestResultData, Error, TestRuleRequest>({
    mutationFn: testRule,
    onSuccess: (data) => {
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

export type { UseTestRuleOptions, TestResultData }
