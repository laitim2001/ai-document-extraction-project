/**
 * @fileoverview 審計報告 React Query Hooks
 * @description
 *   提供審計報告相關的資料獲取和操作 Hooks：
 *   - useAuditReportJobs: 取得報告任務列表
 *   - useAuditReportJob: 取得報告任務詳情
 *   - useCreateAuditReport: 建立報告任務
 *   - useDownloadAuditReport: 下載報告
 *   - useVerifyAuditReport: 驗證報告完整性
 *
 * @module src/hooks/useAuditReports
 * @since Epic 8 - Story 8.5 (審計報告匯出)
 * @lastModified 2025-12-20
 *
 * @dependencies
 *   - @tanstack/react-query - 資料獲取
 */

import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryOptions,
  type UseMutationOptions,
} from '@tanstack/react-query'
import type {
  CreateAuditReportRequest,
  CreateAuditReportResponse,
  AuditReportListResponse,
  AuditReportDetailResponse,
  VerifyReportResponse,
} from '@/types/audit-report'
import type { ReportJobStatus2 } from '@prisma/client'

// ============================================================
// Types
// ============================================================

interface ListParams {
  page?: number
  limit?: number
  status?: ReportJobStatus2
}

interface DownloadResponse {
  blob: Blob
  fileName: string
}

// ============================================================
// API Functions
// ============================================================

async function fetchReportJobs(params: ListParams): Promise<AuditReportListResponse> {
  const searchParams = new URLSearchParams()
  if (params.page) searchParams.set('page', params.page.toString())
  if (params.limit) searchParams.set('limit', params.limit.toString())
  if (params.status) searchParams.set('status', params.status)

  const response = await fetch(`/api/audit/reports?${searchParams}`)
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.detail || 'Failed to fetch report jobs')
  }

  const data = await response.json()
  return data.data
}

async function fetchReportJob(jobId: string): Promise<AuditReportDetailResponse> {
  const response = await fetch(`/api/audit/reports/${jobId}`)
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.detail || 'Failed to fetch report job')
  }

  const data = await response.json()
  return data.data
}

async function createReportJob(
  request: CreateAuditReportRequest
): Promise<CreateAuditReportResponse> {
  const response = await fetch('/api/audit/reports', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.detail || 'Failed to create report job')
  }

  const data = await response.json()
  return data.data
}

function filenameFromContentDisposition(header: string | null): string | null {
  if (!header) return null
  const match = /filename\*?=(?:UTF-8'')?["']?([^"';]+)/i.exec(header)
  return match ? decodeURIComponent(match[1]) : null
}

async function downloadReport(jobId: string): Promise<DownloadResponse> {
  // FIX-085: server-side 串流下載——fetch 取檔案 bytes（app 經私有端點抓 blob），
  // 不再導向瀏覽器搆不到的 blob SAS URL。
  const response = await fetch(`/api/audit/reports/${jobId}/download`)
  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(error.detail || 'Failed to download report')
  }

  const blob = await response.blob()
  const fileName =
    filenameFromContentDisposition(response.headers.get('Content-Disposition')) ||
    `audit-report-${jobId}`
  return { blob, fileName }
}

async function verifyReport(
  jobId: string,
  fileContent: string
): Promise<VerifyReportResponse> {
  const response = await fetch(`/api/audit/reports/${jobId}/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fileContent }),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.detail || 'Failed to verify report')
  }

  const data = await response.json()
  return data.data
}

// ============================================================
// Query Keys
// ============================================================

export const auditReportKeys = {
  all: ['audit-reports'] as const,
  lists: () => [...auditReportKeys.all, 'list'] as const,
  list: (params: ListParams) => [...auditReportKeys.lists(), params] as const,
  details: () => [...auditReportKeys.all, 'detail'] as const,
  detail: (jobId: string) => [...auditReportKeys.details(), jobId] as const,
}

// ============================================================
// Hooks
// ============================================================

/**
 * 取得審計報告任務列表
 *
 * @param params - 查詢參數
 * @param options - React Query 選項
 *
 * @example
 * ```tsx
 * const { data, isLoading } = useAuditReportJobs({ page: 1, limit: 20 })
 * ```
 */
export function useAuditReportJobs(
  params: ListParams = {},
  options?: Omit<UseQueryOptions<AuditReportListResponse>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: auditReportKeys.list(params),
    queryFn: () => fetchReportJobs(params),
    refetchInterval: (query) => {
      // 如果有正在處理的任務，自動刷新
      const hasProcessing = query.state.data?.items.some((item) =>
        ['PENDING', 'QUEUED', 'PROCESSING', 'GENERATING', 'SIGNING'].includes(item.status)
      )
      return hasProcessing ? 5000 : false
    },
    ...options,
  })
}

/**
 * 取得審計報告任務詳情
 *
 * @param jobId - 任務 ID
 * @param options - React Query 選項
 *
 * @example
 * ```tsx
 * const { data } = useAuditReportJob('job-123')
 * ```
 */
export function useAuditReportJob(
  jobId: string,
  options?: Omit<UseQueryOptions<AuditReportDetailResponse>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: auditReportKeys.detail(jobId),
    queryFn: () => fetchReportJob(jobId),
    enabled: !!jobId,
    ...options,
  })
}

/**
 * 建立審計報告任務
 *
 * @param options - Mutation 選項
 *
 * @example
 * ```tsx
 * const { mutate: createReport } = useCreateAuditReport()
 * createReport({ reportType: 'FULL_AUDIT', ... })
 * ```
 */
export function useCreateAuditReport(
  options?: UseMutationOptions<CreateAuditReportResponse, Error, CreateAuditReportRequest>
) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: createReportJob,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: auditReportKeys.lists() })
    },
    ...options,
  })
}

/**
 * 下載審計報告
 *
 * @param options - Mutation 選項
 *
 * @example
 * ```tsx
 * const { mutate: download } = useDownloadAuditReport()
 * download('job-123')
 * ```
 */
export function useDownloadAuditReport(
  options?: UseMutationOptions<DownloadResponse, Error, string>
) {
  return useMutation({
    mutationFn: downloadReport,
    onSuccess: ({ blob, fileName }) => {
      // FIX-085: 用 object URL 觸發下載（檔案來自 server-side 串流，非 blob SAS URL）
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = fileName
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    },
    ...options,
  })
}

/**
 * 驗證審計報告完整性
 *
 * @param options - Mutation 選項
 *
 * @example
 * ```tsx
 * const { mutateAsync: verify } = useVerifyAuditReport()
 * const result = await verify({ jobId: 'job-123', fileContent: '...' })
 * ```
 */
export function useVerifyAuditReport(
  options?: UseMutationOptions<
    VerifyReportResponse,
    Error,
    { jobId: string; fileContent: string }
  >
) {
  return useMutation({
    mutationFn: ({ jobId, fileContent }) => verifyReport(jobId, fileContent),
    ...options,
  })
}
