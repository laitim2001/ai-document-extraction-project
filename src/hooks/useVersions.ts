/**
 * @fileoverview 規則版本歷史 Hooks
 * @description
 *   使用 React Query 管理規則版本歷史功能，包含：
 *   - 版本列表查詢
 *   - 版本對比查詢
 *   - 手動回滾操作
 *   - 自動快取管理
 *
 * @module src/hooks/useVersions
 * @since Epic 4 - Story 4.7 (規則版本歷史管理)
 * @lastModified 2025-12-19
 *
 * @dependencies
 *   - @tanstack/react-query - React Query
 *   - @/types/version - 類型定義
 */

import { useQuery, useMutation, useQueryClient, UseQueryOptions } from '@tanstack/react-query'
import type {
  VersionsResponse,
  CompareResponse,
  RollbackRequest,
  RollbackResult,
} from '@/types/version'

// ============================================================
// Types
// ============================================================

/**
 * API 錯誤響應
 */
interface VersionErrorResponse {
  success: false
  error: {
    type: string
    title: string
    status: number
    detail: string
  }
}

/**
 * API 成功響應
 */
interface VersionSuccessResponse<T> {
  success: true
  data: T
}

/**
 * Hook 選項
 */
interface UseVersionsOptions {
  /** 返回數量限制 */
  limit?: number
  /** 分頁偏移 */
  offset?: number
  /** React Query 選項 */
  queryOptions?: Omit<
    UseQueryOptions<VersionsResponse, Error>,
    'queryKey' | 'queryFn' | 'enabled'
  >
}

/**
 * 版本對比 Hook 選項
 */
interface UseVersionCompareOptions {
  /** React Query 選項 */
  queryOptions?: Omit<
    UseQueryOptions<CompareResponse, Error>,
    'queryKey' | 'queryFn' | 'enabled'
  >
}

// ============================================================
// API Functions
// ============================================================

/**
 * 獲取版本列表
 *
 * @param ruleId - 規則 ID
 * @param limit - 返回數量限制
 * @param offset - 分頁偏移
 * @returns 版本列表響應
 * @throws 當 API 回傳錯誤時拋出
 */
async function fetchVersions(
  ruleId: string,
  limit: number = 20,
  offset: number = 0
): Promise<VersionsResponse> {
  const params = new URLSearchParams({
    limit: limit.toString(),
    offset: offset.toString(),
  })

  const response = await fetch(`/api/rules/${ruleId}/versions?${params}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  })

  const result = await response.json()

  if (!response.ok || !result.success) {
    const errorResponse = result as VersionErrorResponse
    throw new Error(errorResponse.error?.detail || 'Failed to fetch versions')
  }

  return (result as VersionSuccessResponse<VersionsResponse>).data
}

/**
 * 對比兩個版本
 *
 * @param ruleId - 規則 ID
 * @param v1 - 版本 1 ID
 * @param v2 - 版本 2 ID
 * @returns 版本對比響應
 * @throws 當 API 回傳錯誤時拋出
 */
async function fetchVersionCompare(
  ruleId: string,
  v1: string,
  v2: string
): Promise<CompareResponse> {
  const params = new URLSearchParams({ v1, v2 })

  const response = await fetch(`/api/rules/${ruleId}/versions/compare?${params}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  })

  const result = await response.json()

  if (!response.ok || !result.success) {
    const errorResponse = result as VersionErrorResponse
    throw new Error(errorResponse.error?.detail || 'Failed to compare versions')
  }

  return (result as VersionSuccessResponse<CompareResponse>).data
}

/**
 * 執行版本回滾
 *
 * @param ruleId - 規則 ID
 * @param data - 回滾請求數據
 * @returns 回滾結果
 * @throws 當 API 回傳錯誤時拋出
 */
async function executeRollback(
  ruleId: string,
  data: RollbackRequest
): Promise<RollbackResult> {
  const response = await fetch(`/api/rules/${ruleId}/versions/rollback`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  })

  const result = await response.json()

  if (!response.ok || !result.success) {
    const errorResponse = result as VersionErrorResponse
    throw new Error(errorResponse.error?.detail || 'Rollback failed')
  }

  return (result as VersionSuccessResponse<RollbackResult>).data
}

// ============================================================
// Hooks
// ============================================================

/**
 * 版本歷史查詢 Hook
 *
 * @param ruleId - 規則 ID（傳入 undefined 時不執行查詢）
 * @param options - Hook 選項
 * @returns React Query 結果
 *
 * @example
 * ```tsx
 * function VersionHistoryPage({ ruleId }: { ruleId: string }) {
 *   const { data, isLoading, error } = useVersions(ruleId)
 *
 *   if (isLoading) return <Skeleton />
 *   if (error) return <ErrorMessage message={error.message} />
 *
 *   return (
 *     <div>
 *       <h1>版本歷史 - {data?.ruleName}</h1>
 *       <VersionList versions={data?.versions} />
 *     </div>
 *   )
 * }
 * ```
 */
export function useVersions(
  ruleId: string | undefined,
  options?: UseVersionsOptions
) {
  const { limit = 20, offset = 0, queryOptions } = options ?? {}

  return useQuery<VersionsResponse, Error>({
    queryKey: ['rule-versions', ruleId, { limit, offset }],
    queryFn: () => fetchVersions(ruleId!, limit, offset),
    enabled: !!ruleId,
    // 30 秒 stale time
    staleTime: 30 * 1000,
    // 5 分鐘快取時間
    gcTime: 5 * 60 * 1000,
    ...queryOptions,
  })
}

/**
 * 版本對比查詢 Hook
 *
 * @param ruleId - 規則 ID
 * @param versionId1 - 版本 1 ID
 * @param versionId2 - 版本 2 ID
 * @param enabled - 是否啟用查詢
 * @param options - Hook 選項
 * @returns React Query 結果
 *
 * @example
 * ```tsx
 * function VersionCompareDialog({ ruleId, v1, v2, open }: Props) {
 *   const { data, isLoading, error } = useVersionCompare(
 *     ruleId, v1, v2, open
 *   )
 *
 *   if (isLoading) return <Spinner />
 *   if (error) return <ErrorMessage message={error.message} />
 *
 *   return (
 *     <div>
 *       <DiffSummary summary={data?.summaryText} />
 *       <FieldDiffTable differences={data?.differences} />
 *       <PatternDiffViewer patternDiff={data?.patternDiff} />
 *     </div>
 *   )
 * }
 * ```
 */
export function useVersionCompare(
  ruleId: string | undefined,
  versionId1: string | undefined,
  versionId2: string | undefined,
  enabled: boolean = true,
  options?: UseVersionCompareOptions
) {
  const { queryOptions } = options ?? {}

  return useQuery<CompareResponse, Error>({
    queryKey: ['rule-version-compare', ruleId, versionId1, versionId2],
    queryFn: () => fetchVersionCompare(ruleId!, versionId1!, versionId2!),
    enabled: enabled && !!ruleId && !!versionId1 && !!versionId2,
    // 對比結果不需要太長快取
    staleTime: 10 * 1000,
    gcTime: 60 * 1000,
    ...queryOptions,
  })
}

/**
 * 手動回滾 Mutation Hook
 *
 * @param ruleId - 規則 ID
 * @returns Mutation 結果
 *
 * @example
 * ```tsx
 * function RollbackButton({ ruleId, targetVersionId }: Props) {
 *   const { mutate: rollback, isPending } = useManualRollback(ruleId)
 *
 *   const handleRollback = () => {
 *     rollback(
 *       { targetVersionId, reason: 'Reverting to stable version' },
 *       {
 *         onSuccess: (data) => {
 *           toast.success(`Rolled back to version ${data.toVersion}`)
 *         },
 *         onError: (error) => {
 *           toast.error(error.message)
 *         }
 *       }
 *     )
 *   }
 *
 *   return (
 *     <Button onClick={handleRollback} disabled={isPending}>
 *       {isPending ? 'Rolling back...' : 'Rollback'}
 *     </Button>
 *   )
 * }
 * ```
 */
export function useManualRollback(ruleId: string) {
  const queryClient = useQueryClient()

  return useMutation<RollbackResult, Error, RollbackRequest>({
    mutationFn: (data) => executeRollback(ruleId, data),
    onSuccess: () => {
      // 刷新版本列表
      queryClient.invalidateQueries({ queryKey: ['rule-versions', ruleId] })
      // 刷新規則詳情
      queryClient.invalidateQueries({ queryKey: ['rule', ruleId] })
      // 刷新規則列表
      queryClient.invalidateQueries({ queryKey: ['rules'] })
    },
  })
}

// ============================================================
// Query Key Factory
// ============================================================

/**
 * Query Key 工廠函數
 * @description 用於外部快取操作
 */
export const versionKeys = {
  all: ['rule-versions'] as const,
  list: (ruleId: string) => [...versionKeys.all, ruleId] as const,
  compare: (ruleId: string, v1: string, v2: string) =>
    ['rule-version-compare', ruleId, v1, v2] as const,
}
