/**
 * @fileoverview AI 成本數據 React Query Hooks
 * @description
 *   提供 AI API 成本數據的 React Query hooks：
 *   - 成本摘要查詢
 *   - 趨勢數據查詢
 *   - 每日明細查詢
 *   - 異常檢測查詢
 *
 * @module src/hooks/useAiCost
 * @since Epic 7 - Story 7.6 (AI API 使用成本顯示)
 * @lastModified 2025-12-19
 *
 * @features
 *   - React Query 整合
 *   - 自動快取與重新驗證
 *   - 錯誤處理
 *
 * @dependencies
 *   - @tanstack/react-query - 數據獲取庫
 *   - @/types/ai-cost - 類型定義
 */

import { useQuery, UseQueryOptions } from '@tanstack/react-query'
import type {
  AiCostSummary,
  AiCostTrend,
  DailyDetail,
  AnomalyDetectionResult,
  AiCostApiResponse,
  AiCostSummaryParams,
  AiCostTrendParams,
  DailyDetailParams,
  AnomalyDetectionParams,
} from '@/types/ai-cost'

// ============================================================
// Query Keys
// ============================================================

export const aiCostQueryKeys = {
  all: ['ai-cost'] as const,
  summary: (params?: AiCostSummaryParams) => [...aiCostQueryKeys.all, 'summary', params] as const,
  trend: (params: AiCostTrendParams) => [...aiCostQueryKeys.all, 'trend', params] as const,
  daily: (date: string, params?: Omit<DailyDetailParams, 'date'>) =>
    [...aiCostQueryKeys.all, 'daily', date, params] as const,
  anomalies: (params?: AnomalyDetectionParams) =>
    [...aiCostQueryKeys.all, 'anomalies', params] as const,
}

// ============================================================
// API Functions
// ============================================================

/**
 * 獲取成本摘要
 */
async function fetchCostSummary(
  params?: AiCostSummaryParams
): Promise<AiCostApiResponse<AiCostSummary>> {
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

  const url = `/api/dashboard/ai-cost?${searchParams.toString()}`
  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(`Failed to fetch AI cost summary: ${response.statusText}`)
  }

  return response.json()
}

/**
 * 獲取趨勢數據
 */
async function fetchCostTrend(
  params: AiCostTrendParams
): Promise<AiCostApiResponse<AiCostTrend>> {
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

  const url = `/api/dashboard/ai-cost/trend?${searchParams.toString()}`
  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(`Failed to fetch AI cost trend: ${response.statusText}`)
  }

  return response.json()
}

/**
 * 獲取每日明細
 */
async function fetchDailyDetail(
  params: DailyDetailParams
): Promise<AiCostApiResponse<DailyDetail>> {
  const searchParams = new URLSearchParams()

  if (params.cityCodes?.length) {
    searchParams.set('cities', params.cityCodes.join(','))
  }
  if (params.providers?.length) {
    searchParams.set('providers', params.providers.join(','))
  }
  if (params.failedOnly) {
    searchParams.set('failedOnly', 'true')
  }
  if (params.page) {
    searchParams.set('page', params.page.toString())
  }
  if (params.limit) {
    searchParams.set('limit', params.limit.toString())
  }

  const url = `/api/dashboard/ai-cost/daily/${params.date}?${searchParams.toString()}`
  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(`Failed to fetch AI cost daily detail: ${response.statusText}`)
  }

  return response.json()
}

/**
 * 獲取異常檢測結果
 */
async function fetchAnomalies(
  params?: AnomalyDetectionParams
): Promise<AiCostApiResponse<AnomalyDetectionResult>> {
  const searchParams = new URLSearchParams()

  if (params?.cityCodes?.length) {
    searchParams.set('cities', params.cityCodes.join(','))
  }
  if (params?.days) {
    searchParams.set('days', params.days.toString())
  }
  if (params?.minSeverity) {
    searchParams.set('minSeverity', params.minSeverity)
  }
  if (params?.includeAcknowledged) {
    searchParams.set('includeAcknowledged', 'true')
  }

  const url = `/api/dashboard/ai-cost/anomalies?${searchParams.toString()}`
  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(`Failed to fetch AI cost anomalies: ${response.statusText}`)
  }

  return response.json()
}

// ============================================================
// React Query Hooks
// ============================================================

/**
 * 成本摘要 Hook
 *
 * @param params - 查詢參數
 * @param options - React Query 選項
 * @returns Query 結果
 *
 * @example
 * ```tsx
 * const { data, isLoading, error } = useAiCostSummary({
 *   cityCodes: ['HKG', 'TPE'],
 *   startDate: '2025-12-01',
 *   endDate: '2025-12-19',
 * })
 * ```
 */
export function useAiCostSummary(
  params?: AiCostSummaryParams,
  options?: Omit<
    UseQueryOptions<AiCostApiResponse<AiCostSummary>, Error>,
    'queryKey' | 'queryFn'
  >
) {
  return useQuery({
    queryKey: aiCostQueryKeys.summary(params),
    queryFn: () => fetchCostSummary(params),
    staleTime: 5 * 60 * 1000, // 5 分鐘
    ...options,
  })
}

/**
 * 成本趨勢 Hook
 *
 * @param params - 查詢參數
 * @param options - React Query 選項
 * @returns Query 結果
 *
 * @example
 * ```tsx
 * const { data, isLoading } = useAiCostTrend({
 *   startDate: '2025-12-01',
 *   endDate: '2025-12-19',
 *   granularity: 'day',
 * })
 * ```
 */
export function useAiCostTrend(
  params: AiCostTrendParams,
  options?: Omit<
    UseQueryOptions<AiCostApiResponse<AiCostTrend>, Error>,
    'queryKey' | 'queryFn'
  >
) {
  return useQuery({
    queryKey: aiCostQueryKeys.trend(params),
    queryFn: () => fetchCostTrend(params),
    staleTime: 5 * 60 * 1000,
    enabled: Boolean(params.startDate && params.endDate),
    ...options,
  })
}

/**
 * 每日明細 Hook
 *
 * @param params - 查詢參數
 * @param options - React Query 選項
 * @returns Query 結果
 *
 * @example
 * ```tsx
 * const { data, isLoading } = useAiCostDailyDetail({
 *   date: '2025-12-19',
 *   page: 1,
 *   limit: 50,
 * })
 * ```
 */
export function useAiCostDailyDetail(
  params: DailyDetailParams,
  options?: Omit<
    UseQueryOptions<AiCostApiResponse<DailyDetail>, Error>,
    'queryKey' | 'queryFn'
  >
) {
  return useQuery({
    queryKey: aiCostQueryKeys.daily(params.date, {
      cityCodes: params.cityCodes,
      providers: params.providers,
      failedOnly: params.failedOnly,
      page: params.page,
      limit: params.limit,
    }),
    queryFn: () => fetchDailyDetail(params),
    staleTime: 2 * 60 * 1000, // 2 分鐘
    enabled: Boolean(params.date),
    ...options,
  })
}

/**
 * 異常檢測 Hook
 *
 * @param params - 查詢參數
 * @param options - React Query 選項
 * @returns Query 結果
 *
 * @example
 * ```tsx
 * const { data, isLoading } = useAiCostAnomalies({
 *   days: 7,
 *   minSeverity: 'medium',
 * })
 * ```
 */
export function useAiCostAnomalies(
  params?: AnomalyDetectionParams,
  options?: Omit<
    UseQueryOptions<AiCostApiResponse<AnomalyDetectionResult>, Error>,
    'queryKey' | 'queryFn'
  >
) {
  return useQuery({
    queryKey: aiCostQueryKeys.anomalies(params),
    queryFn: () => fetchAnomalies(params),
    staleTime: 5 * 60 * 1000,
    ...options,
  })
}

// ============================================================
// Utility Hooks
// ============================================================

/**
 * 組合 Hook - 獲取儀表板所需的所有成本數據
 *
 * @param params - 通用查詢參數
 * @returns 組合的查詢結果
 */
export function useAiCostDashboard(params?: {
  cityCodes?: string[]
  dateRange?: number
}) {
  const endDate = new Date()
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - (params?.dateRange || 30))

  const summaryQuery = useAiCostSummary({
    cityCodes: params?.cityCodes,
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0],
  })

  const trendQuery = useAiCostTrend({
    cityCodes: params?.cityCodes,
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0],
    granularity: 'day',
  })

  const anomalyQuery = useAiCostAnomalies({
    cityCodes: params?.cityCodes,
    days: 7,
  })

  return {
    summary: summaryQuery,
    trend: trendQuery,
    anomalies: anomalyQuery,
    isLoading: summaryQuery.isLoading || trendQuery.isLoading || anomalyQuery.isLoading,
    isError: summaryQuery.isError || trendQuery.isError || anomalyQuery.isError,
  }
}
