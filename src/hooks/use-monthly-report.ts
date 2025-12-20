'use client'

/**
 * @fileoverview 月度成本報告 React Query Hooks
 * @description
 *   提供月度成本報告的 React Query 封裝：
 *   - 報告歷史查詢
 *   - 報告生成 mutation
 *   - 報告下載
 *
 * @module src/hooks/use-monthly-report
 * @since Epic 7 - Story 7.10 (月度成本分攤報告)
 * @lastModified 2025-12-20
 *
 * @features
 *   - 5 分鐘快取
 *   - 類型安全的 API 響應
 *   - 生成和下載 mutation
 *
 * @dependencies
 *   - @tanstack/react-query - React Query
 *
 * @related
 *   - src/app/api/reports/monthly-cost/ - 月度報告 API
 *   - src/types/monthly-report.ts - 類型定義
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useCallback, useMemo } from 'react'
import type {
  MonthlyReportListResponse,
  MonthlyReportGenerateResponse,
  ReportDownloadResponse,
  ReportFormat,
} from '@/types/monthly-report'

// ============================================================
// Query Keys
// ============================================================

export const monthlyReportQueryKeys = {
  all: ['monthly-reports'] as const,
  list: (params: { page?: number; pageSize?: number }) =>
    [...monthlyReportQueryKeys.all, 'list', params] as const,
  download: (id: string, format: ReportFormat) =>
    [...monthlyReportQueryKeys.all, 'download', id, format] as const,
}

// ============================================================
// Constants
// ============================================================

/** 資料快取時間（毫秒） */
const STALE_TIME_MS = 5 * 60 * 1000 // 5 分鐘

// ============================================================
// Hooks
// ============================================================

/**
 * 月度報告列表 Hook
 *
 * @description
 *   獲取月度報告歷史列表
 *
 * @param params - 分頁參數
 * @returns Query 結果
 *
 * @example
 * ```tsx
 * const { data, isLoading, error } = useMonthlyReports({ page: 1, pageSize: 12 })
 * ```
 */
export function useMonthlyReports(
  params: { page?: number; pageSize?: number } = {}
) {
  const queryParams = useMemo(
    () => ({
      page: params.page ?? 1,
      pageSize: params.pageSize ?? 12,
    }),
    [params.page, params.pageSize]
  )

  const query = useQuery<MonthlyReportListResponse>({
    queryKey: monthlyReportQueryKeys.list(queryParams),
    queryFn: async () => {
      const urlSearchParams = new URLSearchParams()
      urlSearchParams.set('page', String(queryParams.page))
      urlSearchParams.set('pageSize', String(queryParams.pageSize))

      const response = await fetch(
        `/api/reports/monthly-cost?${urlSearchParams.toString()}`
      )

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to fetch monthly reports')
      }

      return response.json()
    },
    staleTime: STALE_TIME_MS,
  })

  return {
    ...query,
    reports: query.data?.data ?? [],
    pagination: query.data?.pagination ?? { total: 0, page: 1, pageSize: 12 },
  }
}

/**
 * 月度報告生成 Hook
 *
 * @description
 *   生成指定月份的成本報告
 *
 * @returns Mutation 結果
 *
 * @example
 * ```tsx
 * const { mutate, isLoading } = useGenerateMonthlyReport()
 * mutate({ month: '2025-01', formats: ['excel', 'pdf'] })
 * ```
 */
export function useGenerateMonthlyReport() {
  const queryClient = useQueryClient()

  return useMutation<
    MonthlyReportGenerateResponse,
    Error,
    { month: string; formats: ReportFormat[]; sendNotification?: boolean }
  >({
    mutationFn: async ({ month, formats, sendNotification }) => {
      const response = await fetch('/api/reports/monthly-cost/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month, formats, sendNotification }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to generate report')
      }

      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: monthlyReportQueryKeys.all,
      })
    },
  })
}

/**
 * 月度報告下載 Hook
 *
 * @description
 *   獲取報告下載連結並觸發下載
 *
 * @returns Mutation 結果
 *
 * @example
 * ```tsx
 * const { mutate } = useDownloadMonthlyReport()
 * mutate({ reportId: 'xxx', format: 'excel' })
 * ```
 */
export function useDownloadMonthlyReport() {
  return useMutation<
    ReportDownloadResponse,
    Error,
    { reportId: string; format: ReportFormat }
  >({
    mutationFn: async ({ reportId, format }) => {
      const response = await fetch(
        `/api/reports/monthly-cost/${reportId}/download?format=${format}`
      )

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to get download URL')
      }

      return response.json()
    },
    onSuccess: (data) => {
      // 自動觸發下載
      if (data.success && data.data?.downloadUrl) {
        const link = document.createElement('a')
        link.href = data.data.downloadUrl
        link.download = data.data.fileName
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
      }
    },
  })
}

/**
 * 月度報告控制 Hook
 *
 * @description
 *   提供報告相關的操作功能
 *
 * @returns 操作函數
 */
export function useMonthlyReportActions() {
  const queryClient = useQueryClient()

  const invalidateReports = useCallback(() => {
    queryClient.invalidateQueries({
      queryKey: monthlyReportQueryKeys.all,
    })
  }, [queryClient])

  return {
    invalidateReports,
  }
}
