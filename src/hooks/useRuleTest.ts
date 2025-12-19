/**
 * @fileoverview 規則批次測試 Hooks
 * @description
 *   Story 5-4: 測試規則變更效果 - React Query Hooks
 *   提供規則批次測試功能的 React Hooks：
 *   - useStartRuleTest - 啟動批次測試
 *   - useTestTask - 取得任務狀態（支援輪詢）
 *   - useTestDetails - 取得測試詳情（分頁）
 *   - useCancelTestTask - 取消測試任務
 *   - useDownloadReport - 下載測試報告
 *
 * @module src/hooks/useRuleTest
 * @since Epic 5 - Story 5.4 (測試規則變更效果)
 * @lastModified 2025-12-19
 *
 * @dependencies
 *   - @tanstack/react-query - React Query
 *   - @/types/rule-test - 類型定義
 *
 * @related
 *   - src/app/api/rules/[id]/test/route.ts - 啟動測試 API
 *   - src/app/api/test-tasks/[taskId]/route.ts - 任務狀態 API
 *   - src/app/api/test-tasks/[taskId]/details/route.ts - 詳情 API
 *   - src/app/api/test-tasks/[taskId]/report/route.ts - 報告 API
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type {
  TestConfig,
  RuleTestTask,
  TestDetailItem,
  TestDetailsQueryParams,
  ReportFormat,
} from '@/types/rule-test'

// ============================================================
// Query Keys
// ============================================================

export const ruleTestKeys = {
  all: ['rule-tests'] as const,
  tasks: () => [...ruleTestKeys.all, 'tasks'] as const,
  task: (taskId: string) => [...ruleTestKeys.tasks(), taskId] as const,
  details: (taskId: string) => [...ruleTestKeys.task(taskId), 'details'] as const,
  detailsFiltered: (taskId: string, params: TestDetailsQueryParams) =>
    [...ruleTestKeys.details(taskId), params] as const,
}

// ============================================================
// Types
// ============================================================

/**
 * 啟動測試請求參數
 */
interface StartRuleTestParams {
  ruleId: string
  testPattern: unknown
  config: TestConfig
}

/**
 * 啟動測試響應
 */
interface StartRuleTestResponse {
  success: boolean
  data: {
    taskId: string
    status: string
    estimatedDocuments: number
    message: string
  }
}

/**
 * 測試任務響應
 */
interface TestTaskResponse {
  success: boolean
  data: RuleTestTask
}

/**
 * 測試詳情響應
 */
interface TestDetailsResponse {
  success: boolean
  data: {
    details: TestDetailItem[]
    pagination: {
      total: number
      page: number
      pageSize: number
      totalPages: number
    }
  }
}

/**
 * API 錯誤響應
 */
interface ApiError {
  type: string
  title: string
  status: number
  detail: string
  errors?: Record<string, string[]>
}

// ============================================================
// API Functions
// ============================================================

/**
 * 啟動規則測試 API
 */
async function startRuleTest(params: StartRuleTestParams): Promise<StartRuleTestResponse> {
  const response = await fetch(`/api/rules/${params.ruleId}/test`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      testPattern: params.testPattern,
      config: params.config,
    }),
  })

  const result = await response.json()

  if (!response.ok) {
    const error = result as ApiError
    throw new Error(error.detail || '啟動測試失敗')
  }

  return result as StartRuleTestResponse
}

/**
 * 取得測試任務 API
 */
async function fetchTestTask(taskId: string): Promise<RuleTestTask> {
  const response = await fetch(`/api/test-tasks/${taskId}`)
  const result = await response.json()

  if (!response.ok) {
    const error = result as ApiError
    throw new Error(error.detail || '取得測試任務失敗')
  }

  return (result as TestTaskResponse).data
}

/**
 * 取得測試詳情 API
 */
async function fetchTestDetails(
  taskId: string,
  params: TestDetailsQueryParams
): Promise<TestDetailsResponse['data']> {
  const searchParams = new URLSearchParams()
  if (params.page) searchParams.set('page', params.page.toString())
  if (params.pageSize) searchParams.set('pageSize', params.pageSize.toString())
  if (params.changeType) searchParams.set('changeType', params.changeType)
  if (params.sortBy) searchParams.set('sortBy', params.sortBy)
  if (params.sortOrder) searchParams.set('sortOrder', params.sortOrder)

  const response = await fetch(
    `/api/test-tasks/${taskId}/details?${searchParams.toString()}`
  )
  const result = await response.json()

  if (!response.ok) {
    const error = result as ApiError
    throw new Error(error.detail || '取得測試詳情失敗')
  }

  return (result as TestDetailsResponse).data
}

/**
 * 取消測試任務 API
 */
async function cancelTask(taskId: string): Promise<{ success: boolean; message: string }> {
  const response = await fetch(`/api/test-tasks/${taskId}/cancel`, {
    method: 'POST',
  })

  const result = await response.json()

  if (!response.ok) {
    const error = result as ApiError
    throw new Error(error.detail || '取消測試失敗')
  }

  return { success: true, message: result.data?.message || '任務已取消' }
}

/**
 * 下載報告 API
 */
async function downloadReport(
  taskId: string,
  format: ReportFormat
): Promise<{ blob: Blob; filename: string }> {
  const response = await fetch(`/api/test-tasks/${taskId}/report?format=${format}`)

  if (!response.ok) {
    const result = await response.json()
    const error = result as ApiError
    throw new Error(error.detail || '下載報告失敗')
  }

  const blob = await response.blob()
  const extension = format === 'pdf' ? 'pdf' : 'xlsx'
  const filename = `rule-test-report-${taskId}.${extension}`

  return { blob, filename }
}

// ============================================================
// Hooks
// ============================================================

/**
 * 啟動規則測試 Hook
 *
 * @description
 *   使用 React Query mutation 啟動規則批次測試
 *
 * @example
 *   const { mutate, isPending } = useStartRuleTest({
 *     onSuccess: (data) => console.log('Task started:', data.data.taskId)
 *   });
 *
 *   mutate({
 *     ruleId: 'rule-123',
 *     testPattern: { ... },
 *     config: { scope: 'recent', recentCount: 100 }
 *   });
 */
export function useStartRuleTest(options?: {
  onSuccess?: (data: StartRuleTestResponse) => void
  onError?: (error: Error) => void
}) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: startRuleTest,
    onSuccess: (data) => {
      // 清除相關快取
      queryClient.invalidateQueries({ queryKey: ruleTestKeys.tasks() })
      options?.onSuccess?.(data)
    },
    onError: options?.onError,
  })
}

/**
 * 取得測試任務狀態 Hook
 *
 * @description
 *   使用 React Query 查詢測試任務狀態，支援自動輪詢
 *
 * @param taskId - 任務 ID
 * @param options - 查詢選項
 *   - enabled: 是否啟用查詢
 *   - refetchInterval: 輪詢間隔（毫秒），預設 2000
 *   - stopPollingOnComplete: 完成後停止輪詢，預設 true
 *
 * @example
 *   const { data, isLoading } = useTestTask('task-123', {
 *     refetchInterval: 1000,
 *     onStatusChange: (status) => console.log('Status:', status)
 *   });
 */
export function useTestTask(
  taskId: string | null,
  options?: {
    enabled?: boolean
    refetchInterval?: number | false
    stopPollingOnComplete?: boolean
    onStatusChange?: (status: RuleTestTask['status']) => void
  }
) {
  const {
    enabled = true,
    refetchInterval = 2000,
    stopPollingOnComplete = true,
  } = options ?? {}

  return useQuery({
    queryKey: ruleTestKeys.task(taskId ?? ''),
    queryFn: () => fetchTestTask(taskId!),
    enabled: enabled && !!taskId,
    refetchInterval: (query) => {
      // 如果任務完成且設定停止輪詢，則停止
      if (stopPollingOnComplete && query.state.data) {
        const status = query.state.data.status
        if (['COMPLETED', 'FAILED', 'CANCELLED'].includes(status)) {
          return false
        }
      }
      return refetchInterval
    },
  })
}

/**
 * 取得測試詳情 Hook
 *
 * @description
 *   使用 React Query 查詢測試詳情，支援分頁和篩選
 *
 * @param taskId - 任務 ID
 * @param params - 查詢參數
 *
 * @example
 *   const { data, isLoading } = useTestDetails('task-123', {
 *     page: 1,
 *     pageSize: 20,
 *     changeType: 'REGRESSED'
 *   });
 */
export function useTestDetails(
  taskId: string | null,
  params: TestDetailsQueryParams = {}
) {
  const queryParams: TestDetailsQueryParams = {
    page: params.page ?? 1,
    pageSize: params.pageSize ?? 20,
    changeType: params.changeType,
    sortBy: params.sortBy ?? 'createdAt',
    sortOrder: params.sortOrder ?? 'desc',
  }

  return useQuery({
    queryKey: ruleTestKeys.detailsFiltered(taskId ?? '', queryParams),
    queryFn: () => fetchTestDetails(taskId!, queryParams),
    enabled: !!taskId,
  })
}

/**
 * 取消測試任務 Hook
 *
 * @description
 *   使用 React Query mutation 取消執行中的測試任務
 *
 * @example
 *   const { mutate, isPending } = useCancelTestTask({
 *     onSuccess: () => toast.success('任務已取消')
 *   });
 *
 *   mutate('task-123');
 */
export function useCancelTestTask(options?: {
  onSuccess?: () => void
  onError?: (error: Error) => void
}) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: cancelTask,
    onSuccess: (_, taskId) => {
      // 更新任務快取
      queryClient.invalidateQueries({ queryKey: ruleTestKeys.task(taskId) })
      options?.onSuccess?.()
    },
    onError: options?.onError,
  })
}

/**
 * 下載測試報告 Hook
 *
 * @description
 *   使用 React Query mutation 下載測試報告（PDF 或 Excel）
 *
 * @example
 *   const { mutate, isPending } = useDownloadReport();
 *
 *   mutate({ taskId: 'task-123', format: 'pdf' });
 */
export function useDownloadReport(options?: {
  onSuccess?: () => void
  onError?: (error: Error) => void
}) {
  return useMutation({
    mutationFn: async ({ taskId, format }: { taskId: string; format: ReportFormat }) => {
      const { blob, filename } = await downloadReport(taskId, format)

      // 觸發下載
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      return { filename }
    },
    onSuccess: options?.onSuccess,
    onError: options?.onError,
  })
}
