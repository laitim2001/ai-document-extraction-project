/**
 * @fileoverview 規則建議列表 Hook
 * @description
 *   使用 React Query 獲取規則建議列表，包含：
 *   - 支持 Forwarder、欄位名稱、狀態、來源篩選
 *   - 支持分頁和排序
 *   - 包含建議統計數據
 *   - 自動快取管理
 *
 * @module src/hooks/useSuggestionList
 * @since Epic 4 - Story 4.4 (規則升級建議生成)
 * @lastModified 2025-12-19
 *
 * @dependencies
 *   - @tanstack/react-query - React Query
 *   - @/types/suggestion - 類型定義
 */

import { useQuery, useQueryClient, UseQueryOptions } from '@tanstack/react-query'
import type {
  SuggestionListItem,
  SuggestionsQueryParams,
  SuggestionsSummary,
} from '@/types/suggestion'

// ============================================================
// Types
// ============================================================

/**
 * API 錯誤響應
 */
interface SuggestionErrorResponse {
  type: string
  title: string
  status: number
  detail: string
}

/**
 * API 成功響應
 */
interface SuggestionsListResponse {
  success: true
  data: {
    suggestions: SuggestionListItem[]
    pagination: {
      page: number
      pageSize: number
      total: number
      totalPages: number
    }
    summary: SuggestionsSummary
  }
}

/**
 * Hook 返回資料
 */
interface UseSuggestionListResult {
  /** 建議列表 */
  suggestions: SuggestionListItem[]
  /** 分頁資訊 */
  pagination: {
    page: number
    pageSize: number
    total: number
    totalPages: number
  }
  /** 摘要統計 */
  summary: SuggestionsSummary
}

/**
 * Hook 選項
 */
interface UseSuggestionListOptions {
  /** 是否啟用查詢 */
  enabled?: boolean
  /** React Query 選項 */
  queryOptions?: Omit<
    UseQueryOptions<UseSuggestionListResult, Error>,
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

/** 預設摘要 */
const DEFAULT_SUMMARY: SuggestionsSummary = {
  totalSuggestions: 0,
  pendingSuggestions: 0,
  autoLearningSuggestions: 0,
  manualSuggestions: 0,
}

// ============================================================
// API Function
// ============================================================

/**
 * 獲取建議列表
 *
 * @param params - 查詢參數
 * @returns 建議列表、分頁資訊和摘要
 * @throws 當 API 回傳錯誤時拋出
 */
async function fetchSuggestionList(
  params: SuggestionsQueryParams
): Promise<UseSuggestionListResult> {
  // 構建查詢字串
  const searchParams = new URLSearchParams()

  if (params.forwarderId) {
    searchParams.set('forwarderId', params.forwarderId)
  }
  if (params.fieldName) {
    searchParams.set('fieldName', params.fieldName)
  }
  if (params.status) {
    searchParams.set('status', params.status)
  }
  if (params.source) {
    searchParams.set('source', params.source)
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
  const url = `/api/rules/suggestions${queryString ? `?${queryString}` : ''}`

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  })

  const result = await response.json()

  // 處理錯誤響應
  if (!response.ok || !result.success) {
    const errorResponse = result as SuggestionErrorResponse
    throw new Error(errorResponse.detail || 'Failed to fetch suggestion list')
  }

  const successResponse = result as SuggestionsListResponse

  return {
    suggestions: successResponse.data.suggestions,
    pagination: successResponse.data.pagination,
    summary: successResponse.data.summary,
  }
}

// ============================================================
// Hook
// ============================================================

/**
 * 規則建議列表 Hook
 *
 * @param params - 查詢參數
 * @param options - Hook 選項
 * @returns React Query 結果
 *
 * @example
 * ```tsx
 * function SuggestionListPage() {
 *   const [filters, setFilters] = useState<SuggestionsQueryParams>({
 *     status: 'PENDING',
 *     page: 1,
 *     pageSize: 20,
 *   })
 *
 *   const { data, isLoading, error, refetch } = useSuggestionList(filters)
 *
 *   if (isLoading) return <Skeleton />
 *   if (error) return <ErrorMessage message={error.message} />
 *
 *   return (
 *     <div>
 *       <SuggestionSummaryCards summary={data.summary} />
 *       <SuggestionTable suggestions={data.suggestions} />
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
export function useSuggestionList(
  params: SuggestionsQueryParams = {},
  options?: UseSuggestionListOptions
) {
  const { enabled = true, queryOptions } = options ?? {}

  // 使用穩定的查詢鍵
  const queryKey = [
    'suggestions',
    {
      forwarderId: params.forwarderId,
      fieldName: params.fieldName,
      status: params.status,
      source: params.source,
      page: params.page ?? 1,
      pageSize: params.pageSize ?? DEFAULT_PAGE_SIZE,
      sortBy: params.sortBy ?? 'createdAt',
      sortOrder: params.sortOrder ?? 'desc',
    },
  ]

  return useQuery<UseSuggestionListResult, Error>({
    queryKey,
    queryFn: () => fetchSuggestionList(params),
    enabled,
    // 預設資料
    placeholderData: {
      suggestions: [],
      pagination: DEFAULT_PAGINATION,
      summary: DEFAULT_SUMMARY,
    },
    // 1 分鐘 stale time
    staleTime: 60 * 1000,
    // 保持視窗焦點時重新獲取
    refetchOnWindowFocus: true,
    ...queryOptions,
  })
}

// ============================================================
// Prefetch Hook
// ============================================================

/**
 * 預取建議列表 Hook
 * @description 用於預先載入下一頁資料
 */
export function usePrefetchSuggestions() {
  const queryClient = useQueryClient()

  return (params: SuggestionsQueryParams) => {
    queryClient.prefetchQuery({
      queryKey: [
        'suggestions',
        {
          ...params,
          page: (params.page ?? 1) + 1,
        },
      ],
      queryFn: () =>
        fetchSuggestionList({
          ...params,
          page: (params.page ?? 1) + 1,
        }),
      staleTime: 60 * 1000,
    })
  }
}

// ============================================================
// Invalidation Hook
// ============================================================

/**
 * 刷新建議列表 Hook
 * @description 用於在操作後刷新列表
 */
export function useInvalidateSuggestions() {
  const queryClient = useQueryClient()

  return () => {
    queryClient.invalidateQueries({ queryKey: ['suggestions'] })
  }
}

// ============================================================
// Query Key Factory
// ============================================================

/**
 * Query Key 工廠函數
 * @description 用於外部快取操作
 */
export const suggestionListKeys = {
  all: ['suggestions'] as const,
  lists: () => [...suggestionListKeys.all, 'list'] as const,
  list: (params: SuggestionsQueryParams) =>
    [...suggestionListKeys.lists(), params] as const,
}
