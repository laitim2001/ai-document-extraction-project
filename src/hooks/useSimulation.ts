/**
 * @fileoverview 規則模擬測試 Hook
 * @description
 *   使用 React Query 執行規則模擬測試，包含：
 *   - 對歷史數據執行模擬
 *   - 可配置樣本數量和日期範圍
 *   - 返回改善/惡化/無變化統計
 *
 * @module src/hooks/useSimulation
 * @since Epic 4 - Story 4.5 (規則影響範圍分析)
 * @lastModified 2025-12-19
 *
 * @dependencies
 *   - @tanstack/react-query - React Query
 *   - @/types/impact - 類型定義
 */

import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { SimulationRequest, SimulationResult } from '@/types/impact'

// ============================================================
// Types
// ============================================================

/**
 * API 錯誤響應
 */
interface SimulationErrorResponse {
  type: string
  title: string
  status: number
  detail: string
  errors?: Record<string, string[]>
}

/**
 * API 成功響應
 */
interface SimulationResponse {
  success: true
  data: SimulationResult
}

/**
 * 執行模擬參數
 */
interface RunSimulationParams {
  /** 規則建議 ID */
  suggestionId: string
  /** 模擬選項 */
  options?: SimulationRequest
}

// ============================================================
// API Functions
// ============================================================

/**
 * 執行模擬測試
 *
 * @param suggestionId - 規則建議 ID
 * @param options - 模擬選項
 * @returns 模擬結果
 * @throws 當 API 回傳錯誤時拋出
 */
async function runSimulation(
  suggestionId: string,
  options?: SimulationRequest
): Promise<SimulationResult> {
  const response = await fetch(`/api/rules/suggestions/${suggestionId}/simulate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(options ?? {}),
  })

  const result = await response.json()

  if (!response.ok || !result.success) {
    const errorResponse = result as SimulationErrorResponse
    throw new Error(errorResponse.detail || 'Failed to run simulation')
  }

  const successResponse = result as SimulationResponse
  return successResponse.data
}

// ============================================================
// Mutation Hook
// ============================================================

/**
 * 規則模擬測試 Hook
 *
 * @returns Mutation 結果
 *
 * @example
 * ```tsx
 * function SimulationPanel({ suggestionId }: { suggestionId: string }) {
 *   const {
 *     mutate: runTest,
 *     data: result,
 *     isPending,
 *     error
 *   } = useSimulation()
 *
 *   return (
 *     <div>
 *       <SimulationConfig
 *         onRun={(options) => runTest({ suggestionId, options })}
 *         isRunning={isPending}
 *       />
 *       {error && <ErrorMessage message={error.message} />}
 *       {result && (
 *         <>
 *           <SimulationSummary summary={result.summary} />
 *           <SimulationResultsTable results={result.results} />
 *         </>
 *       )}
 *     </div>
 *   )
 * }
 * ```
 */
export function useSimulation() {
  const queryClient = useQueryClient()

  return useMutation<SimulationResult, Error, RunSimulationParams>({
    mutationFn: ({ suggestionId, options }) => runSimulation(suggestionId, options),
    onSuccess: (_, { suggestionId }) => {
      // 可選：刷新影響分析（如果模擬結果影響影響分析報告）
      queryClient.invalidateQueries({
        queryKey: ['suggestions', 'impact', suggestionId],
      })
    },
  })
}

// ============================================================
// Helper Types for UI
// ============================================================

/**
 * 模擬配置選項（用於 UI 表單）
 */
export interface SimulationConfigFormData {
  /** 樣本數量 */
  sampleSize: number
  /** 日期範圍天數 */
  dateRangeDays: number
  /** 是否包含未驗證文件 */
  includeUnverified: boolean
}

/**
 * 轉換表單數據為 API 請求
 *
 * @param formData - 表單數據
 * @returns API 請求參數
 */
export function toSimulationRequest(formData: SimulationConfigFormData): SimulationRequest {
  const now = new Date()
  const start = new Date()
  start.setDate(start.getDate() - formData.dateRangeDays)

  return {
    sampleSize: formData.sampleSize,
    dateRange: {
      start: start.toISOString(),
      end: now.toISOString(),
    },
    includeUnverified: formData.includeUnverified,
  }
}

/**
 * 默認模擬配置
 */
export const DEFAULT_SIMULATION_CONFIG: SimulationConfigFormData = {
  sampleSize: 100,
  dateRangeDays: 30,
  includeUnverified: false,
}
