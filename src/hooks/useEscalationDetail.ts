/**
 * @fileoverview 升級案例詳情 Hook
 * @description
 *   使用 React Query 獲取單一升級案例詳情，包含：
 *   - 完整的升級案例資訊
 *   - 關聯的文件和提取結果
 *   - 已有的修正記錄
 *   - 自動快取管理
 *
 * @module src/hooks/useEscalationDetail
 * @since Epic 3 - Story 3.8 (Super User 處理升級案例)
 * @lastModified 2025-12-18
 *
 * @dependencies
 *   - @tanstack/react-query - React Query
 *   - @/types/escalation - 類型定義
 */

import { useQuery, UseQueryOptions } from '@tanstack/react-query'
import type { EscalationDetail, EscalationDetailResponse } from '@/types/escalation'

// ============================================================
// Types
// ============================================================

/**
 * API 錯誤響應
 */
interface EscalationErrorResponse {
  type: string
  title: string
  status: number
  detail: string
  instance?: string
}

/**
 * Hook 選項
 */
interface UseEscalationDetailOptions {
  /** 是否啟用查詢 */
  enabled?: boolean
  /** React Query 選項 */
  queryOptions?: Omit<
    UseQueryOptions<EscalationDetail, Error>,
    'queryKey' | 'queryFn'
  >
}

// ============================================================
// API Function
// ============================================================

/**
 * 獲取升級案例詳情
 *
 * @param escalationId - 升級案例 ID
 * @returns 升級案例詳情
 * @throws 當 API 回傳錯誤時拋出
 */
async function fetchEscalationDetail(
  escalationId: string
): Promise<EscalationDetail> {
  const response = await fetch(`/api/escalations/${escalationId}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  })

  const result = await response.json()

  // 處理錯誤響應
  if (!response.ok || !result.success) {
    const errorResponse = result as EscalationErrorResponse
    throw new Error(errorResponse.detail || 'Failed to fetch escalation detail')
  }

  return (result as EscalationDetailResponse).data
}

// ============================================================
// Hook
// ============================================================

/**
 * 升級案例詳情 Hook
 *
 * @param escalationId - 升級案例 ID
 * @param options - Hook 選項
 * @returns React Query 結果
 *
 * @example
 * ```tsx
 * function EscalationDetailPage({ id }: { id: string }) {
 *   const { data, isLoading, error } = useEscalationDetail(id)
 *
 *   if (isLoading) return <Skeleton />
 *   if (error) return <ErrorMessage message={error.message} />
 *   if (!data) return <NotFound />
 *
 *   return (
 *     <div>
 *       <EscalationHeader escalation={data} />
 *       <div className="grid grid-cols-2 gap-4">
 *         <PDFViewer fileUrl={data.document.fileUrl} />
 *         <FieldList fields={data.document.extractionResult?.fields} />
 *       </div>
 *       <ResolveActions escalation={data} />
 *     </div>
 *   )
 * }
 * ```
 */
export function useEscalationDetail(
  escalationId: string | undefined,
  options?: UseEscalationDetailOptions
) {
  const { enabled = true, queryOptions } = options ?? {}

  return useQuery<EscalationDetail, Error>({
    queryKey: ['escalationDetail', escalationId],
    queryFn: () => {
      if (!escalationId) {
        throw new Error('Escalation ID is required')
      }
      return fetchEscalationDetail(escalationId)
    },
    // 只有當 escalationId 存在且 enabled 為 true 時才執行查詢
    enabled: enabled && !!escalationId,
    // 5 分鐘 stale time
    staleTime: 5 * 60 * 1000,
    // 發生錯誤時重試 1 次
    retry: 1,
    ...queryOptions,
  })
}

/**
 * Query Key 工廠函數
 * @description 用於外部快取操作
 */
export const escalationDetailKeys = {
  all: ['escalationDetail'] as const,
  detail: (id: string) => [...escalationDetailKeys.all, id] as const,
}
