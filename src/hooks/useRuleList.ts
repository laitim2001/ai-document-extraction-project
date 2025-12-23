/**
 * @fileoverview 映射規則列表 Hook
 * @description
 *   使用 React Query 獲取映射規則列表，包含：
 *   - 支持 Forwarder、欄位名稱、狀態、類別篩選
 *   - 支持分頁和排序
 *   - 包含規則統計數據
 *   - 自動快取管理
 *
 * @module src/hooks/useRuleList
 * @since Epic 4 - Story 4.1 (映射規則列表與查看)
 * @lastModified 2025-12-22
 * @refactor REFACTOR-001 (Forwarder → Company)
 *
 * @dependencies
 *   - @tanstack/react-query - React Query
 *   - @/types/rule - 類型定義
 */

import { useQuery, useQueryClient, UseQueryOptions } from '@tanstack/react-query'
import type {
  RulesQueryParams,
  RulesListResponse,
  RuleListItem,
  RulesSummary,
} from '@/types/rule'

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
}

/**
 * Hook 返回資料
 */
interface UseRuleListResult {
  /** 規則列表 */
  rules: RuleListItem[]
  /** 分頁資訊 */
  pagination: {
    page: number
    pageSize: number
    total: number
    totalPages: number
  }
  /** 摘要統計 */
  summary: RulesSummary
}

/**
 * Hook 選項
 */
interface UseRuleListOptions {
  /** 是否啟用查詢 */
  enabled?: boolean
  /** React Query 選項 */
  queryOptions?: Omit<
    UseQueryOptions<UseRuleListResult, Error>,
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
const DEFAULT_SUMMARY: RulesSummary = {
  totalRules: 0,
  activeRules: 0,
  draftRules: 0,
  pendingReviewRules: 0,
  deprecatedRules: 0,
  universalRules: 0,
}

// ============================================================
// API Function
// ============================================================

/**
 * 獲取規則列表
 *
 * @param params - 查詢參數
 * @returns 規則列表、分頁資訊和摘要
 * @throws 當 API 回傳錯誤時拋出
 */
async function fetchRuleList(
  params: RulesQueryParams
): Promise<UseRuleListResult> {
  // 構建查詢字串
  const searchParams = new URLSearchParams()

  if (params.companyId) {
    searchParams.set('companyId', params.companyId) // REFACTOR-001: 原 forwarderId
  }
  if (params.fieldName) {
    searchParams.set('fieldName', params.fieldName)
  }
  if (params.status) {
    searchParams.set('status', params.status)
  }
  if (params.category) {
    searchParams.set('category', params.category)
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
  const url = `/api/rules${queryString ? `?${queryString}` : ''}`

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  })

  const result = await response.json()

  // 處理錯誤響應
  if (!response.ok || !result.success) {
    const errorResponse = result as RuleErrorResponse
    throw new Error(errorResponse.detail || 'Failed to fetch rule list')
  }

  const successResponse = result as RulesListResponse

  return {
    rules: successResponse.data.rules,
    pagination: successResponse.data.pagination,
    summary: successResponse.data.summary,
  }
}

// ============================================================
// Hook
// ============================================================

/**
 * 映射規則列表 Hook
 *
 * @param params - 查詢參數
 * @param options - Hook 選項
 * @returns React Query 結果
 *
 * @example
 * ```tsx
 * function RuleListPage() {
 *   const [filters, setFilters] = useState<RulesQueryParams>({
 *     status: 'ACTIVE',
 *     page: 1,
 *     pageSize: 20,
 *   })
 *
 *   const { data, isLoading, error, refetch } = useRuleList(filters)
 *
 *   if (isLoading) return <Skeleton />
 *   if (error) return <ErrorMessage message={error.message} />
 *
 *   return (
 *     <div>
 *       <RuleSummaryCards summary={data.summary} />
 *       <RuleTable rules={data.rules} />
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
export function useRuleList(
  params: RulesQueryParams = {},
  options?: UseRuleListOptions
) {
  const { enabled = true, queryOptions } = options ?? {}

  // 使用穩定的查詢鍵
  const queryKey = [
    'rules',
    {
      companyId: params.companyId, // REFACTOR-001: 原 forwarderId
      fieldName: params.fieldName,
      status: params.status,
      category: params.category,
      page: params.page ?? 1,
      pageSize: params.pageSize ?? DEFAULT_PAGE_SIZE,
      sortBy: params.sortBy ?? 'updatedAt',
      sortOrder: params.sortOrder ?? 'desc',
    },
  ]

  return useQuery<UseRuleListResult, Error>({
    queryKey,
    queryFn: () => fetchRuleList(params),
    enabled,
    // 預設資料
    placeholderData: {
      rules: [],
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
 * 預取規則列表 Hook
 * @description 用於預先載入下一頁資料
 */
export function usePrefetchRules() {
  const queryClient = useQueryClient()

  return (params: RulesQueryParams) => {
    queryClient.prefetchQuery({
      queryKey: [
        'rules',
        {
          ...params,
          page: (params.page ?? 1) + 1,
        },
      ],
      queryFn: () =>
        fetchRuleList({
          ...params,
          page: (params.page ?? 1) + 1,
        }),
      staleTime: 60 * 1000,
    })
  }
}

// ============================================================
// Query Key Factory
// ============================================================

/**
 * Query Key 工廠函數
 * @description 用於外部快取操作
 */
export const ruleListKeys = {
  all: ['rules'] as const,
  lists: () => [...ruleListKeys.all, 'list'] as const,
  list: (params: RulesQueryParams) =>
    [...ruleListKeys.lists(), params] as const,
}
