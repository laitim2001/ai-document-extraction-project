/**
 * @fileoverview 升級案例列表 Hook
 * @description
 *   使用 React Query 獲取升級案例列表，包含：
 *   - 支持狀態、原因篩選
 *   - 支持分頁和排序
 *   - 自動快取管理
 *
 * @module src/hooks/useEscalationList
 * @since Epic 3 - Story 3.8 (Super User 處理升級案例)
 * @lastModified 2025-12-18
 *
 * @dependencies
 *   - @tanstack/react-query - React Query
 *   - @/types/escalation - 類型定義
 */

import { useQuery, UseQueryOptions } from '@tanstack/react-query'
import type {
  EscalationListItem,
  EscalationListParams,
  EscalationListResponse,
} from '@/types/escalation'

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
 * Hook 返回資料
 */
interface UseEscalationListResult {
  /** 升級案例列表 */
  escalations: EscalationListItem[]
  /** 分頁資訊 */
  pagination: {
    page: number
    pageSize: number
    total: number
    totalPages: number
  }
}

/**
 * Hook 選項
 */
interface UseEscalationListOptions {
  /** 是否啟用查詢 */
  enabled?: boolean
  /** React Query 選項 */
  queryOptions?: Omit<
    UseQueryOptions<UseEscalationListResult, Error>,
    'queryKey' | 'queryFn'
  >
}

// ============================================================
// Constants
// ============================================================

/** 預設分頁大小 */
const DEFAULT_PAGE_SIZE = 20

/** 預設分頁資訊 */
const DEFAULT_PAGINATION = {
  page: 1,
  pageSize: DEFAULT_PAGE_SIZE,
  total: 0,
  totalPages: 0,
}

// ============================================================
// API Function
// ============================================================

/**
 * 獲取升級案例列表
 *
 * @param params - 查詢參數
 * @returns 升級案例列表和分頁資訊
 * @throws 當 API 回傳錯誤時拋出
 */
async function fetchEscalationList(
  params: EscalationListParams
): Promise<UseEscalationListResult> {
  // 構建查詢字串
  const searchParams = new URLSearchParams()

  if (params.status) {
    searchParams.set('status', params.status)
  }
  if (params.reason) {
    searchParams.set('reason', params.reason)
  }
  if (params.page) {
    searchParams.set('page', params.page.toString())
  }
  if (params.pageSize) {
    searchParams.set('pageSize', params.pageSize.toString())
  }
  if (params.sortBy) {
    searchParams.set('sortBy', params.sortBy)
  }
  if (params.sortOrder) {
    searchParams.set('sortOrder', params.sortOrder)
  }

  const queryString = searchParams.toString()
  const url = `/api/escalations${queryString ? `?${queryString}` : ''}`

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  })

  const result = await response.json()

  // 處理錯誤響應
  if (!response.ok || !result.success) {
    const errorResponse = result as EscalationErrorResponse
    throw new Error(errorResponse.detail || 'Failed to fetch escalation list')
  }

  const successResponse = result as EscalationListResponse

  return {
    escalations: successResponse.data,
    pagination: successResponse.meta.pagination,
  }
}

// ============================================================
// Hook
// ============================================================

/**
 * 升級案例列表 Hook
 *
 * @param params - 查詢參數
 * @param options - Hook 選項
 * @returns React Query 結果
 *
 * @example
 * ```tsx
 * function EscalationListPage() {
 *   const [filters, setFilters] = useState<EscalationListParams>({
 *     status: 'PENDING',
 *     page: 1,
 *     pageSize: 20,
 *   })
 *
 *   const { data, isLoading, error } = useEscalationList(filters)
 *
 *   if (isLoading) return <Skeleton />
 *   if (error) return <ErrorMessage message={error.message} />
 *
 *   return (
 *     <div>
 *       <EscalationTable data={data.escalations} />
 *       <Pagination
 *         page={data.pagination.page}
 *         totalPages={data.pagination.totalPages}
 *         onPageChange={(page) => setFilters(f => ({ ...f, page }))}
 *       />
 *     </div>
 *   )
 * }
 * ```
 */
export function useEscalationList(
  params: EscalationListParams = {},
  options?: UseEscalationListOptions
) {
  const { enabled = true, queryOptions } = options ?? {}

  // 使用穩定的查詢鍵
  const queryKey = [
    'escalations',
    {
      status: params.status,
      reason: params.reason,
      page: params.page ?? 1,
      pageSize: params.pageSize ?? DEFAULT_PAGE_SIZE,
      sortBy: params.sortBy ?? 'createdAt',
      sortOrder: params.sortOrder ?? 'desc',
    },
  ]

  return useQuery<UseEscalationListResult, Error>({
    queryKey,
    queryFn: () => fetchEscalationList(params),
    enabled,
    // 預設資料
    placeholderData: {
      escalations: [],
      pagination: DEFAULT_PAGINATION,
    },
    // 5 分鐘 stale time
    staleTime: 5 * 60 * 1000,
    ...queryOptions,
  })
}

/**
 * Query Key 工廠函數
 * @description 用於外部快取操作
 */
export const escalationListKeys = {
  all: ['escalations'] as const,
  lists: () => [...escalationListKeys.all, 'list'] as const,
  list: (params: EscalationListParams) =>
    [...escalationListKeys.lists(), params] as const,
}
