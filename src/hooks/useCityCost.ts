/**
 * @fileoverview 城市 AI 成本 React Query Hooks
 * @description
 *   提供城市級別 AI API 成本數據的 React Query hooks：
 *   - 城市成本摘要查詢
 *   - 城市成本趨勢查詢
 *   - 城市成本比較查詢
 *   - 計價配置管理（CRUD）
 *
 * @module src/hooks/useCityCost
 * @since Epic 7 - Story 7.8 (城市 AI 成本追蹤)
 * @lastModified 2025-12-19
 *
 * @features
 *   - React Query 整合
 *   - 自動快取與重新驗證
 *   - 樂觀更新支援
 *   - 錯誤處理
 *
 * @dependencies
 *   - @tanstack/react-query - 數據獲取庫
 *   - @/types/city-cost - 類型定義
 */

import {
  useQuery,
  useMutation,
  useQueryClient,
  UseQueryOptions,
  UseMutationOptions,
} from '@tanstack/react-query'
import type {
  CityCostSummaryResponse,
  CityCostTrendResponse,
  CityCostComparisonResponse,
  PricingConfigListResponse,
  PricingConfigDetailResponse,
  ApiPricingConfig,
  CityCostApiResponse,
  CityCostSummaryParams,
  CityCostTrendParams,
  CityCostComparisonParams,
  PricingConfigListParams,
  CreatePricingConfigRequest,
  UpdatePricingConfigRequest,
} from '@/types/city-cost'

// ============================================================
// Query Keys
// ============================================================

export const cityCostQueryKeys = {
  all: ['city-cost'] as const,
  summary: (params?: CityCostSummaryParams) =>
    [...cityCostQueryKeys.all, 'summary', params] as const,
  trend: (params: CityCostTrendParams) =>
    [...cityCostQueryKeys.all, 'trend', params] as const,
  comparison: (params?: CityCostComparisonParams) =>
    [...cityCostQueryKeys.all, 'comparison', params] as const,
  pricing: () => [...cityCostQueryKeys.all, 'pricing'] as const,
  pricingList: (params?: PricingConfigListParams) =>
    [...cityCostQueryKeys.pricing(), 'list', params] as const,
  pricingDetail: (id: string) =>
    [...cityCostQueryKeys.pricing(), 'detail', id] as const,
}

// ============================================================
// API Functions
// ============================================================

/**
 * 獲取城市成本摘要
 */
async function fetchCityCostSummary(
  params?: CityCostSummaryParams
): Promise<CityCostApiResponse<CityCostSummaryResponse>> {
  const searchParams = new URLSearchParams()

  if (params?.cityCodes?.length) {
    searchParams.set('cities', params.cityCodes.join(','))
  }
  if (params?.startDate) {
    searchParams.set('startDate', params.startDate)
  }
  if (params?.endDate) {
    searchParams.set('endDate', params.endDate)
  }
  if (params?.forceRefresh) {
    searchParams.set('forceRefresh', 'true')
  }

  const url = `/api/cost/city-summary?${searchParams.toString()}`
  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(`Failed to fetch city cost summary: ${response.statusText}`)
  }

  return response.json()
}

/**
 * 獲取城市成本趨勢
 */
async function fetchCityCostTrend(
  params: CityCostTrendParams
): Promise<CityCostApiResponse<CityCostTrendResponse>> {
  const searchParams = new URLSearchParams()

  if (params.cityCodes?.length) {
    searchParams.set('cities', params.cityCodes.join(','))
  }
  searchParams.set('startDate', params.startDate)
  searchParams.set('endDate', params.endDate)
  if (params.granularity) {
    searchParams.set('granularity', params.granularity)
  }
  if (params.providers?.length) {
    searchParams.set('providers', params.providers.join(','))
  }

  const url = `/api/cost/city-trend?${searchParams.toString()}`
  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(`Failed to fetch city cost trend: ${response.statusText}`)
  }

  return response.json()
}

/**
 * 獲取城市成本比較
 */
async function fetchCityCostComparison(
  params?: CityCostComparisonParams
): Promise<CityCostApiResponse<CityCostComparisonResponse>> {
  const searchParams = new URLSearchParams()

  if (params?.cityCodes?.length) {
    searchParams.set('cities', params.cityCodes.join(','))
  }
  if (params?.startDate) {
    searchParams.set('startDate', params.startDate)
  }
  if (params?.endDate) {
    searchParams.set('endDate', params.endDate)
  }
  if (params?.sortBy) {
    searchParams.set('sortBy', params.sortBy)
  }
  if (params?.sortOrder) {
    searchParams.set('sortOrder', params.sortOrder)
  }
  if (params?.limit) {
    searchParams.set('limit', params.limit.toString())
  }

  const url = `/api/cost/comparison?${searchParams.toString()}`
  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(`Failed to fetch city cost comparison: ${response.statusText}`)
  }

  return response.json()
}

/**
 * 獲取計價配置列表
 */
async function fetchPricingConfigs(
  params?: PricingConfigListParams
): Promise<CityCostApiResponse<PricingConfigListResponse>> {
  const searchParams = new URLSearchParams()

  if (params?.provider) {
    searchParams.set('provider', params.provider)
  }
  if (params?.activeOnly) {
    searchParams.set('activeOnly', 'true')
  }
  if (params?.page) {
    searchParams.set('page', params.page.toString())
  }
  if (params?.limit) {
    searchParams.set('limit', params.limit.toString())
  }

  const url = `/api/cost/pricing?${searchParams.toString()}`
  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(`Failed to fetch pricing configs: ${response.statusText}`)
  }

  return response.json()
}

/**
 * 獲取計價配置詳情
 */
async function fetchPricingConfigDetail(
  id: string
): Promise<CityCostApiResponse<PricingConfigDetailResponse>> {
  const url = `/api/cost/pricing/${id}`
  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(`Failed to fetch pricing config detail: ${response.statusText}`)
  }

  return response.json()
}

/**
 * 創建計價配置
 */
async function createPricingConfig(
  data: CreatePricingConfigRequest
): Promise<CityCostApiResponse<ApiPricingConfig>> {
  const response = await fetch('/api/cost/pricing', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  })

  if (!response.ok) {
    throw new Error(`Failed to create pricing config: ${response.statusText}`)
  }

  return response.json()
}

/**
 * 更新計價配置
 */
async function updatePricingConfig(
  id: string,
  data: UpdatePricingConfigRequest
): Promise<CityCostApiResponse<ApiPricingConfig>> {
  const response = await fetch(`/api/cost/pricing/${id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  })

  if (!response.ok) {
    throw new Error(`Failed to update pricing config: ${response.statusText}`)
  }

  return response.json()
}

// ============================================================
// React Query Hooks - 查詢
// ============================================================

/**
 * 城市成本摘要 Hook
 *
 * @param params - 查詢參數
 * @param options - React Query 選項
 * @returns Query 結果
 *
 * @example
 * ```tsx
 * const { data, isLoading } = useCityCostSummary({
 *   cityCodes: ['HKG', 'TPE'],
 *   startDate: '2025-12-01',
 *   endDate: '2025-12-19',
 * })
 * ```
 */
export function useCityCostSummary(
  params?: CityCostSummaryParams,
  options?: Omit<
    UseQueryOptions<CityCostApiResponse<CityCostSummaryResponse>, Error>,
    'queryKey' | 'queryFn'
  >
) {
  return useQuery({
    queryKey: cityCostQueryKeys.summary(params),
    queryFn: () => fetchCityCostSummary(params),
    staleTime: 5 * 60 * 1000, // 5 分鐘
    ...options,
  })
}

/**
 * 城市成本趨勢 Hook
 *
 * @param params - 查詢參數
 * @param options - React Query 選項
 * @returns Query 結果
 *
 * @example
 * ```tsx
 * const { data, isLoading } = useCityCostTrend({
 *   cityCodes: ['HKG'],
 *   startDate: '2025-12-01',
 *   endDate: '2025-12-19',
 *   granularity: 'day',
 * })
 * ```
 */
export function useCityCostTrend(
  params: CityCostTrendParams,
  options?: Omit<
    UseQueryOptions<CityCostApiResponse<CityCostTrendResponse>, Error>,
    'queryKey' | 'queryFn'
  >
) {
  return useQuery({
    queryKey: cityCostQueryKeys.trend(params),
    queryFn: () => fetchCityCostTrend(params),
    staleTime: 5 * 60 * 1000,
    enabled: Boolean(params.startDate && params.endDate),
    ...options,
  })
}

/**
 * 城市成本比較 Hook
 *
 * @param params - 查詢參數
 * @param options - React Query 選項
 * @returns Query 結果
 *
 * @example
 * ```tsx
 * const { data, isLoading } = useCityCostComparison({
 *   sortBy: 'cost',
 *   sortOrder: 'desc',
 *   limit: 10,
 * })
 * ```
 */
export function useCityCostComparison(
  params?: CityCostComparisonParams,
  options?: Omit<
    UseQueryOptions<CityCostApiResponse<CityCostComparisonResponse>, Error>,
    'queryKey' | 'queryFn'
  >
) {
  return useQuery({
    queryKey: cityCostQueryKeys.comparison(params),
    queryFn: () => fetchCityCostComparison(params),
    staleTime: 5 * 60 * 1000,
    ...options,
  })
}

/**
 * 計價配置列表 Hook
 *
 * @param params - 查詢參數
 * @param options - React Query 選項
 * @returns Query 結果
 *
 * @example
 * ```tsx
 * const { data, isLoading } = usePricingConfigs({
 *   provider: 'AZURE_OPENAI',
 *   activeOnly: true,
 * })
 * ```
 */
export function usePricingConfigs(
  params?: PricingConfigListParams,
  options?: Omit<
    UseQueryOptions<CityCostApiResponse<PricingConfigListResponse>, Error>,
    'queryKey' | 'queryFn'
  >
) {
  return useQuery({
    queryKey: cityCostQueryKeys.pricingList(params),
    queryFn: () => fetchPricingConfigs(params),
    staleTime: 5 * 60 * 1000,
    ...options,
  })
}

/**
 * 計價配置詳情 Hook
 *
 * @param id - 計價配置 ID
 * @param options - React Query 選項
 * @returns Query 結果
 *
 * @example
 * ```tsx
 * const { data, isLoading } = usePricingConfigDetail('config-id')
 * ```
 */
export function usePricingConfigDetail(
  id: string,
  options?: Omit<
    UseQueryOptions<CityCostApiResponse<PricingConfigDetailResponse>, Error>,
    'queryKey' | 'queryFn'
  >
) {
  return useQuery({
    queryKey: cityCostQueryKeys.pricingDetail(id),
    queryFn: () => fetchPricingConfigDetail(id),
    staleTime: 2 * 60 * 1000,
    enabled: Boolean(id),
    ...options,
  })
}

// ============================================================
// React Query Hooks - 變更
// ============================================================

/**
 * 創建計價配置 Mutation Hook
 *
 * @param options - Mutation 選項
 * @returns Mutation 結果
 *
 * @example
 * ```tsx
 * const createMutation = useCreatePricingConfig()
 *
 * createMutation.mutate({
 *   provider: 'AZURE_OPENAI',
 *   operation: 'completion',
 *   pricePerInputToken: 0.00001,
 *   pricePerOutputToken: 0.00003,
 *   effectiveFrom: '2025-01-01',
 * })
 * ```
 */
export function useCreatePricingConfig(
  options?: UseMutationOptions<
    CityCostApiResponse<ApiPricingConfig>,
    Error,
    CreatePricingConfigRequest
  >
) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: createPricingConfig,
    onSuccess: () => {
      // 使計價配置列表快取失效
      queryClient.invalidateQueries({ queryKey: cityCostQueryKeys.pricing() })
    },
    ...options,
  })
}

/**
 * 更新計價配置 Mutation Hook
 *
 * @param options - Mutation 選項
 * @returns Mutation 結果
 *
 * @example
 * ```tsx
 * const updateMutation = useUpdatePricingConfig()
 *
 * updateMutation.mutate({
 *   id: 'config-id',
 *   data: {
 *     pricePerInputToken: 0.000012,
 *     changeReason: 'Price adjustment',
 *   },
 * })
 * ```
 */
export function useUpdatePricingConfig(
  options?: UseMutationOptions<
    CityCostApiResponse<ApiPricingConfig>,
    Error,
    { id: string; data: UpdatePricingConfigRequest }
  >
) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, data }) => updatePricingConfig(id, data),
    onSuccess: (_, variables) => {
      // 使相關快取失效
      queryClient.invalidateQueries({ queryKey: cityCostQueryKeys.pricing() })
      queryClient.invalidateQueries({
        queryKey: cityCostQueryKeys.pricingDetail(variables.id),
      })
    },
    ...options,
  })
}

// ============================================================
// Utility Hooks
// ============================================================

/**
 * 組合 Hook - 獲取城市成本儀表板所需的所有數據
 *
 * @param params - 通用查詢參數
 * @returns 組合的查詢結果
 *
 * @example
 * ```tsx
 * const { summary, trend, comparison, isLoading } = useCityCostDashboard({
 *   cityCodes: ['HKG', 'TPE'],
 *   dateRange: 30,
 * })
 * ```
 */
export function useCityCostDashboard(params?: {
  cityCodes?: string[]
  dateRange?: number
}) {
  const endDate = new Date()
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - (params?.dateRange || 30))

  const dateParams = {
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0],
  }

  const summaryQuery = useCityCostSummary({
    cityCodes: params?.cityCodes,
    ...dateParams,
  })

  const trendQuery = useCityCostTrend({
    cityCodes: params?.cityCodes,
    ...dateParams,
    granularity: 'day',
  })

  const comparisonQuery = useCityCostComparison({
    cityCodes: params?.cityCodes,
    ...dateParams,
    sortBy: 'cost',
    sortOrder: 'desc',
  })

  return {
    summary: summaryQuery,
    trend: trendQuery,
    comparison: comparisonQuery,
    isLoading:
      summaryQuery.isLoading || trendQuery.isLoading || comparisonQuery.isLoading,
    isError:
      summaryQuery.isError || trendQuery.isError || comparisonQuery.isError,
  }
}
