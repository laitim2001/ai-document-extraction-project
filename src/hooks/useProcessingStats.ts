/**
 * @fileoverview 處理統計數據 React Query Hooks
 * @description
 *   提供城市處理量統計數據的 React Query hooks：
 *   - 聚合統計查詢
 *   - 城市匯總查詢
 *   - 即時統計查詢
 *   - 數據校驗操作
 *
 * @module src/hooks/useProcessingStats
 * @since Epic 7 - Story 7.7 (城市處理數量追蹤)
 * @lastModified 2025-12-19
 *
 * @features
 *   - React Query 整合
 *   - 自動快取與重新驗證
 *   - 錯誤處理
 *
 * @dependencies
 *   - @tanstack/react-query - 數據獲取庫
 *   - @/types/processing-statistics - 類型定義
 */

import { useQuery, useMutation, useQueryClient, UseQueryOptions, UseMutationOptions } from '@tanstack/react-query'
import type {
  AggregatedStatsResponse,
  CityStatsSummaryResponse,
  RealtimeStatsResponse,
  ReconciliationResponse,
  TimeGranularity,
  ReconciliationRequest,
} from '@/types/processing-statistics'

// ============================================================
// Query Keys
// ============================================================

export const processingStatsQueryKeys = {
  all: ['processing-stats'] as const,
  aggregated: (params?: AggregatedStatsParams) =>
    [...processingStatsQueryKeys.all, 'aggregated', params] as const,
  cities: (params?: CitySummaryParams) =>
    [...processingStatsQueryKeys.all, 'cities', params] as const,
  realtime: () => [...processingStatsQueryKeys.all, 'realtime'] as const,
}

// ============================================================
// Query Parameters Types
// ============================================================

export interface AggregatedStatsParams {
  startDate?: string
  endDate?: string
  granularity?: TimeGranularity
  cityCodes?: string[]
}

export interface CitySummaryParams {
  startDate?: string
  endDate?: string
  cityCodes?: string[]
}

// ============================================================
// API Functions
// ============================================================

/**
 * 獲取聚合統計
 */
async function fetchAggregatedStats(
  params?: AggregatedStatsParams
): Promise<AggregatedStatsResponse> {
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
  if (params?.granularity) {
    searchParams.set('granularity', params.granularity)
  }

  const url = `/api/statistics/processing?${searchParams.toString()}`
  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(`Failed to fetch processing stats: ${response.statusText}`)
  }

  return response.json()
}

/**
 * 獲取城市統計匯總
 */
async function fetchCitySummary(
  params?: CitySummaryParams
): Promise<CityStatsSummaryResponse> {
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

  const url = `/api/statistics/processing/cities?${searchParams.toString()}`
  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(`Failed to fetch city stats summary: ${response.statusText}`)
  }

  return response.json()
}

/**
 * 獲取即時統計
 */
async function fetchRealtimeStats(): Promise<RealtimeStatsResponse> {
  const response = await fetch('/api/statistics/processing/realtime')

  if (!response.ok) {
    throw new Error(`Failed to fetch realtime stats: ${response.statusText}`)
  }

  return response.json()
}

/**
 * 執行數據校驗
 */
async function reconcileStats(
  params: ReconciliationRequest
): Promise<ReconciliationResponse> {
  const response = await fetch('/api/statistics/processing/reconcile', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(params),
  })

  if (!response.ok) {
    throw new Error(`Failed to reconcile stats: ${response.statusText}`)
  }

  return response.json()
}

// ============================================================
// React Query Hooks
// ============================================================

/**
 * 聚合統計 Hook
 *
 * @param params - 查詢參數
 * @param options - React Query 選項
 * @returns Query 結果
 *
 * @example
 * ```tsx
 * const { data, isLoading, error } = useAggregatedStats({
 *   startDate: '2025-12-01',
 *   endDate: '2025-12-19',
 *   granularity: 'day',
 * })
 * ```
 */
export function useAggregatedStats(
  params?: AggregatedStatsParams,
  options?: Omit<
    UseQueryOptions<AggregatedStatsResponse, Error>,
    'queryKey' | 'queryFn'
  >
) {
  return useQuery({
    queryKey: processingStatsQueryKeys.aggregated(params),
    queryFn: () => fetchAggregatedStats(params),
    staleTime: 5 * 60 * 1000, // 5 分鐘
    ...options,
  })
}

/**
 * 城市統計匯總 Hook
 *
 * @param params - 查詢參數
 * @param options - React Query 選項
 * @returns Query 結果
 *
 * @example
 * ```tsx
 * const { data, isLoading } = useCitySummary({
 *   startDate: '2025-12-01',
 *   endDate: '2025-12-19',
 * })
 * ```
 */
export function useCitySummary(
  params?: CitySummaryParams,
  options?: Omit<
    UseQueryOptions<CityStatsSummaryResponse, Error>,
    'queryKey' | 'queryFn'
  >
) {
  return useQuery({
    queryKey: processingStatsQueryKeys.cities(params),
    queryFn: () => fetchCitySummary(params),
    staleTime: 5 * 60 * 1000,
    ...options,
  })
}

/**
 * 即時統計 Hook
 *
 * @param options - React Query 選項
 * @returns Query 結果
 *
 * @example
 * ```tsx
 * const { data, isLoading } = useRealtimeStats()
 * ```
 */
export function useRealtimeStats(
  options?: Omit<
    UseQueryOptions<RealtimeStatsResponse, Error>,
    'queryKey' | 'queryFn'
  >
) {
  return useQuery({
    queryKey: processingStatsQueryKeys.realtime(),
    queryFn: fetchRealtimeStats,
    staleTime: 60 * 1000, // 1 分鐘
    refetchInterval: 60 * 1000, // 每分鐘自動刷新
    ...options,
  })
}

/**
 * 數據校驗 Mutation Hook
 *
 * @param options - Mutation 選項
 * @returns Mutation 結果
 *
 * @example
 * ```tsx
 * const { mutate, isLoading } = useReconcileStats()
 * mutate({ cityCode: 'HKG', date: '2025-12-19' })
 * ```
 */
export function useReconcileStats(
  options?: Omit<
    UseMutationOptions<ReconciliationResponse, Error, ReconciliationRequest>,
    'mutationFn'
  >
) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: reconcileStats,
    onSuccess: () => {
      // 校驗成功後刷新相關數據
      queryClient.invalidateQueries({ queryKey: processingStatsQueryKeys.all })
    },
    ...options,
  })
}

// ============================================================
// Utility Hooks
// ============================================================

/**
 * 組合 Hook - 獲取儀表板所需的所有處理統計數據
 *
 * @param params - 通用查詢參數
 * @returns 組合的查詢結果
 *
 * @example
 * ```tsx
 * const { aggregated, cities, realtime, isLoading } = useProcessingStatsDashboard({
 *   cityCodes: ['HKG', 'TPE'],
 *   dateRange: 30,
 * })
 * ```
 */
export function useProcessingStatsDashboard(params?: {
  cityCodes?: string[]
  dateRange?: number
  granularity?: TimeGranularity
}) {
  const endDate = new Date()
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - (params?.dateRange || 30))

  const startDateStr = startDate.toISOString().split('T')[0]
  const endDateStr = endDate.toISOString().split('T')[0]

  const aggregatedQuery = useAggregatedStats({
    cityCodes: params?.cityCodes,
    startDate: startDateStr,
    endDate: endDateStr,
    granularity: params?.granularity || 'day',
  })

  const citiesQuery = useCitySummary({
    cityCodes: params?.cityCodes,
    startDate: startDateStr,
    endDate: endDateStr,
  })

  const realtimeQuery = useRealtimeStats()

  return {
    aggregated: aggregatedQuery,
    cities: citiesQuery,
    realtime: realtimeQuery,
    isLoading:
      aggregatedQuery.isLoading ||
      citiesQuery.isLoading ||
      realtimeQuery.isLoading,
    isError:
      aggregatedQuery.isError || citiesQuery.isError || realtimeQuery.isError,
  }
}

/**
 * 趨勢比較 Hook - 獲取當期與上期的統計對比
 *
 * @param params - 查詢參數
 * @returns 當期與上期的統計數據
 *
 * @example
 * ```tsx
 * const { current, previous, trend } = useProcessingStatsTrend({
 *   cityCodes: ['HKG'],
 *   days: 7,
 * })
 * ```
 */
export function useProcessingStatsTrend(params: {
  cityCodes?: string[]
  days: number
}) {
  const endDate = new Date()
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - params.days)

  const prevEndDate = new Date(startDate)
  prevEndDate.setDate(prevEndDate.getDate() - 1)
  const prevStartDate = new Date(prevEndDate)
  prevStartDate.setDate(prevStartDate.getDate() - params.days + 1)

  const currentQuery = useCitySummary({
    cityCodes: params.cityCodes,
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0],
  })

  const previousQuery = useCitySummary({
    cityCodes: params.cityCodes,
    startDate: prevStartDate.toISOString().split('T')[0],
    endDate: prevEndDate.toISOString().split('T')[0],
  })

  const calculateTrend = (current: number, previous: number): number => {
    if (previous === 0) return current > 0 ? 100 : 0
    return ((current - previous) / previous) * 100
  }

  const currentData = currentQuery.data?.data || []
  const previousData = previousQuery.data?.data || []

  const trend = currentData.map((city) => {
    const prevCity = previousData.find((p) => p.cityCode === city.cityCode)
    return {
      cityCode: city.cityCode,
      cityName: city.cityName,
      currentProcessed: city.totalProcessed,
      previousProcessed: prevCity?.totalProcessed || 0,
      processedChange: calculateTrend(
        city.totalProcessed,
        prevCity?.totalProcessed || 0
      ),
      currentAutomation: city.automationRate,
      previousAutomation: prevCity?.automationRate || 0,
      automationChange: calculateTrend(
        city.automationRate,
        prevCity?.automationRate || 0
      ),
    }
  })

  return {
    current: currentQuery,
    previous: previousQuery,
    trend,
    isLoading: currentQuery.isLoading || previousQuery.isLoading,
    isError: currentQuery.isError || previousQuery.isError,
  }
}
