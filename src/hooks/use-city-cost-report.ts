'use client'

/**
 * @fileoverview 城市成本報表 React Query Hooks
 * @description
 *   提供城市成本報表的 React Query 封裝：
 *   - 成本報表查詢
 *   - 成本趨勢查詢
 *   - 異常分析查詢
 *
 * @module src/hooks/use-city-cost-report
 * @author Development Team
 * @since Epic 7 - Story 7.9 (城市成本報表)
 * @lastModified 2025-12-19
 *
 * @features
 *   - 10 分鐘快取
 *   - 類型安全的 API 響應
 *   - 參數驗證
 *
 * @dependencies
 *   - @tanstack/react-query - React Query
 *
 * @related
 *   - src/app/api/reports/city-cost/route.ts - 成本報表 API
 *   - src/types/city-cost.ts - 類型定義
 */

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useCallback } from 'react'
import type {
  CityCostReportResponse,
  CityCostReportParams,
  CostTrendResponse,
  CostTrendParams,
  AnomalyAnalysisResponse,
  AnomalyAnalysisParams,
} from '@/types/city-cost'

// ============================================================
// Types
// ============================================================

/**
 * API 響應包裝
 */
interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
}

// ============================================================
// Query Keys
// ============================================================

export const cityCostReportQueryKeys = {
  all: ['city-cost-report'] as const,
  reports: () => [...cityCostReportQueryKeys.all, 'reports'] as const,
  report: (params: CityCostReportParams) =>
    [...cityCostReportQueryKeys.reports(), params] as const,
  trends: () => [...cityCostReportQueryKeys.all, 'trends'] as const,
  trend: (params: CostTrendParams) =>
    [...cityCostReportQueryKeys.trends(), params] as const,
  anomalies: () => [...cityCostReportQueryKeys.all, 'anomalies'] as const,
  anomaly: (params: AnomalyAnalysisParams) =>
    [...cityCostReportQueryKeys.anomalies(), params] as const,
}

// ============================================================
// Constants
// ============================================================

/** 資料快取時間（毫秒） */
const STALE_TIME_MS = 10 * 60 * 1000 // 10 分鐘

// ============================================================
// Hooks
// ============================================================

/**
 * 城市成本報表 Hook
 *
 * @description
 *   獲取城市成本報表數據，包含：
 *   - 處理統計
 *   - 成本明細（API + 人工）
 *   - 異常檢測結果
 *   - 趨勢數據（可選）
 *
 * @param params - 查詢參數
 * @returns Query 結果
 *
 * @example
 * ```tsx
 * const { data, isLoading, error } = useCityCostReport({
 *   startDate: '2025-01-01',
 *   endDate: '2025-01-31',
 * })
 * ```
 */
export function useCityCostReport(params: CityCostReportParams = {}) {
  const queryParams = useMemo(() => ({
    startDate: params.startDate,
    endDate: params.endDate,
    cityCodes: params.cityCodes,
    includeTrend: params.includeTrend ?? true,
    includeAnomalies: params.includeAnomalies ?? true,
    forceRefresh: params.forceRefresh ?? false,
  }), [
    params.startDate,
    params.endDate,
    params.cityCodes,
    params.includeTrend,
    params.includeAnomalies,
    params.forceRefresh,
  ])

  const query = useQuery<ApiResponse<CityCostReportResponse>>({
    queryKey: cityCostReportQueryKeys.report(queryParams),
    queryFn: async () => {
      const urlSearchParams = new URLSearchParams()

      if (queryParams.startDate) {
        urlSearchParams.set('startDate', queryParams.startDate)
      }
      if (queryParams.endDate) {
        urlSearchParams.set('endDate', queryParams.endDate)
      }
      if (queryParams.cityCodes?.length) {
        urlSearchParams.set('cityCodes', queryParams.cityCodes.join(','))
      }
      if (queryParams.includeTrend !== undefined) {
        urlSearchParams.set('includeTrend', String(queryParams.includeTrend))
      }
      if (queryParams.includeAnomalies !== undefined) {
        urlSearchParams.set('includeAnomalies', String(queryParams.includeAnomalies))
      }
      if (queryParams.forceRefresh) {
        urlSearchParams.set('forceRefresh', 'true')
      }

      const response = await fetch(
        `/api/reports/city-cost?${urlSearchParams.toString()}`
      )

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to fetch city cost report')
      }

      return response.json()
    },
    staleTime: queryParams.forceRefresh ? 0 : STALE_TIME_MS,
    enabled: true,
  })

  return {
    ...query,
    reports: query.data?.data?.reports ?? [],
    totals: query.data?.data?.totals ?? null,
    generatedAt: query.data?.data?.generatedAt ?? null,
  }
}

/**
 * 城市成本趨勢 Hook
 *
 * @description
 *   獲取指定城市的成本趨勢數據
 *
 * @param params - 查詢參數
 * @returns Query 結果
 *
 * @example
 * ```tsx
 * const { data, isLoading } = useCityCostTrend({
 *   cityCode: 'HKG',
 *   startDate: '2025-01-01',
 *   endDate: '2025-01-31',
 * })
 * ```
 */
export function useCityCostTrend(params: CostTrendParams | null) {
  const query = useQuery<ApiResponse<CostTrendResponse>>({
    queryKey: cityCostReportQueryKeys.trend(params!),
    queryFn: async () => {
      if (!params) {
        throw new Error('Missing required parameters')
      }

      const urlSearchParams = new URLSearchParams()
      urlSearchParams.set('cityCode', params.cityCode)
      urlSearchParams.set('startDate', params.startDate)
      urlSearchParams.set('endDate', params.endDate)
      if (params.granularity) {
        urlSearchParams.set('granularity', params.granularity)
      }

      const response = await fetch(
        `/api/reports/city-cost/trend?${urlSearchParams.toString()}`
      )

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to fetch cost trend')
      }

      return response.json()
    },
    staleTime: STALE_TIME_MS,
    enabled: !!params?.cityCode && !!params?.startDate && !!params?.endDate,
  })

  return {
    ...query,
    trend: query.data?.data?.trend ?? [],
    summary: query.data?.data?.summary ?? null,
    cityCode: query.data?.data?.cityCode ?? null,
    cityName: query.data?.data?.cityName ?? null,
  }
}

/**
 * 城市成本異常分析 Hook
 *
 * @description
 *   獲取指定城市的成本異常分析
 *
 * @param params - 查詢參數
 * @returns Query 結果
 *
 * @example
 * ```tsx
 * const { data, isLoading } = useCityCostAnomaly({
 *   cityCode: 'HKG',
 * })
 * ```
 */
export function useCityCostAnomaly(params: AnomalyAnalysisParams | null) {
  const query = useQuery<ApiResponse<AnomalyAnalysisResponse>>({
    queryKey: cityCostReportQueryKeys.anomaly(params!),
    queryFn: async () => {
      if (!params) {
        throw new Error('Missing required parameters')
      }

      const urlSearchParams = new URLSearchParams()
      if (params.startDate) {
        urlSearchParams.set('startDate', params.startDate)
      }
      if (params.endDate) {
        urlSearchParams.set('endDate', params.endDate)
      }
      if (params.severity?.length) {
        urlSearchParams.set('severity', params.severity.join(','))
      }
      if (params.types?.length) {
        urlSearchParams.set('types', params.types.join(','))
      }

      const response = await fetch(
        `/api/reports/city-cost/anomaly/${encodeURIComponent(params.cityCode)}?${urlSearchParams.toString()}`
      )

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to fetch anomaly analysis')
      }

      return response.json()
    },
    staleTime: STALE_TIME_MS,
    enabled: !!params?.cityCode,
  })

  return {
    ...query,
    anomalies: query.data?.data?.anomalies ?? [],
    summary: query.data?.data?.summary ?? null,
    cityCode: query.data?.data?.cityCode ?? null,
    cityName: query.data?.data?.cityName ?? null,
  }
}

/**
 * 城市成本報表控制 Hook
 *
 * @description
 *   提供報表相關的操作功能
 *
 * @returns 操作函數
 */
export function useCityCostReportActions() {
  const queryClient = useQueryClient()

  const invalidateReports = useCallback(() => {
    queryClient.invalidateQueries({
      queryKey: cityCostReportQueryKeys.reports(),
    })
  }, [queryClient])

  const invalidateTrends = useCallback(() => {
    queryClient.invalidateQueries({
      queryKey: cityCostReportQueryKeys.trends(),
    })
  }, [queryClient])

  const invalidateAnomalies = useCallback(() => {
    queryClient.invalidateQueries({
      queryKey: cityCostReportQueryKeys.anomalies(),
    })
  }, [queryClient])

  const invalidateAll = useCallback(() => {
    queryClient.invalidateQueries({
      queryKey: cityCostReportQueryKeys.all,
    })
  }, [queryClient])

  return {
    invalidateReports,
    invalidateTrends,
    invalidateAnomalies,
    invalidateAll,
  }
}
