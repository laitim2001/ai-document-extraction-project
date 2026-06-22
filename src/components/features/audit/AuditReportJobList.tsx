'use client'

/**
 * @fileoverview 審計報告任務列表組件
 * @description
 *   顯示審計報告任務列表：
 *   - 任務狀態和進度
 *   - 下載和驗證操作
 *   - 分頁和過濾
 *
 * @module src/components/features/audit/AuditReportJobList
 * @since Epic 8 - Story 8.5 (審計報告匯出)
 * @lastModified 2026-06-22 (CHANGE-088 Phase 4: 顯示文字改走 next-intl reports namespace)
 *
 * @dependencies
 *   - @/components/features/common/DataTable - 共用表格封裝（序號欄）
 *   - @/components/ui/* - shadcn/ui 組件
 *   - @/types/audit-report - 報告類型定義
 *   - lucide-react - 圖示
 */

import * as React from 'react'
import { useTranslations, useLocale } from 'next-intl'
import {
  FileSpreadsheet,
  FileText,
  File,
  FileJson,
  Download,
  Shield,
  RefreshCw,
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
  AlertCircle,
} from 'lucide-react'
import {
  DataTable,
  type DataTableColumn,
} from '@/components/features/common/DataTable'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import {
  REPORT_JOB_STATUSES,
  REPORT_OUTPUT_FORMATS,
  isReportDownloadable,
} from '@/types/audit-report'
import type { AuditReportType, ReportOutputFormat, ReportJobStatus2 } from '@prisma/client'

// ============================================================
// Types
// ============================================================

interface ReportJobItem {
  id: string
  title: string
  reportType: AuditReportType
  outputFormat: ReportOutputFormat
  status: ReportJobStatus2
  progress: number
  totalRecords: number | null
  createdAt: Date | string
  completedAt: Date | string | null
  expiresAt: Date | string | null
  downloadCount?: number
  fileUrl?: string | null
}

interface AuditReportJobListProps {
  /** 報告任務列表 */
  jobs: ReportJobItem[]
  /** 是否正在載入 */
  isLoading?: boolean
  /** 下載報告回呼 */
  onDownload: (jobId: string) => void
  /** 驗證報告回呼 */
  onVerify: (jobId: string) => void
  /** 重新整理回呼 */
  onRefresh: () => void
  /** 正在下載的任務 ID */
  downloadingJobId?: string | null
}

// ============================================================
// Constants
// ============================================================

const FORMAT_ICONS: Record<ReportOutputFormat, React.ElementType> = {
  EXCEL: FileSpreadsheet,
  PDF: FileText,
  CSV: File,
  JSON: FileJson,
}

const STATUS_ICONS: Record<ReportJobStatus2, React.ElementType> = {
  PENDING: Clock,
  QUEUED: Clock,
  PROCESSING: Loader2,
  GENERATING: Loader2,
  SIGNING: Loader2,
  COMPLETED: CheckCircle,
  FAILED: XCircle,
  CANCELLED: XCircle,
  EXPIRED: AlertCircle,
}

// ============================================================
// Helpers
// ============================================================

function formatDate(date: Date | string, locale: string): string {
  return new Date(date).toLocaleString(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** 報告列表 i18n 翻譯函數型別（reports namespace） */
type ReportsTranslate = ReturnType<typeof useTranslations>

function formatRelativeTime(date: Date | string, t: ReportsTranslate): string {
  const now = new Date()
  const target = new Date(date)
  const diffMs = target.getTime() - now.getTime()
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays < 0) return t('auditReport.list.expiry.expired')
  if (diffDays === 0) return t('auditReport.list.expiry.today')
  if (diffDays === 1) return t('auditReport.list.expiry.tomorrow')
  return t('auditReport.list.expiry.inDays', { count: diffDays })
}

// ============================================================
// Component
// ============================================================

/**
 * 審計報告任務列表
 *
 * @description 顯示用戶建立的審計報告任務，
 *   包含狀態、進度和操作按鈕。
 *
 * @example
 * ```tsx
 * <AuditReportJobList
 *   jobs={reportJobs}
 *   isLoading={isLoading}
 *   onDownload={handleDownload}
 *   onVerify={handleVerify}
 *   onRefresh={refetch}
 * />
 * ```
 */
export function AuditReportJobList({
  jobs,
  isLoading = false,
  onDownload,
  onVerify,
  onRefresh,
  downloadingJobId,
}: AuditReportJobListProps) {
  const t = useTranslations('reports')
  const tCommon = useTranslations('common')
  const locale = useLocale()

  /**
   * 取得報告任務狀態的顯示文字。
   * PROCESSING/COMPLETED/FAILED 複用 common.status.*，
   * 其餘狀態使用 reports.auditReport.statuses.*。
   */
  const getStatusLabel = React.useCallback(
    (status: ReportJobStatus2): string => {
      switch (status) {
        case 'PROCESSING':
          return tCommon('status.processing')
        case 'COMPLETED':
          return tCommon('status.completed')
        case 'FAILED':
          return tCommon('status.failed')
        default:
          return t(`auditReport.statuses.${status}`)
      }
    },
    [t, tCommon]
  )

  // --- Column 定義（沿用原 ReportJobRow 各儲存格內容/樣式，逐欄 1:1 保留） ---
  const columns = React.useMemo<DataTableColumn<ReportJobItem>[]>(
    () => [
      // 報告名稱
      {
        id: 'title',
        header: t('auditReport.list.columns.title'),
        headerClassName: 'w-[300px]',
        cell: (job) => {
          const FormatIcon = FORMAT_ICONS[job.outputFormat]
          return (
            <div className="flex items-center gap-3">
              <FormatIcon className="h-5 w-5 text-muted-foreground flex-shrink-0" />
              <div className="min-w-0">
                <p className="font-medium truncate">{job.title}</p>
                {job.totalRecords !== null && (
                  <p className="text-xs text-muted-foreground">
                    {t('auditReport.list.recordCount', { count: job.totalRecords })}
                  </p>
                )}
              </div>
            </div>
          )
        },
      },
      // 類型
      {
        id: 'reportType',
        header: t('auditReport.list.columns.type'),
        cell: (job) => (
          <span className="text-sm">{t(`auditReport.types.${job.reportType}.label`)}</span>
        ),
      },
      // 格式
      {
        id: 'outputFormat',
        header: t('auditReport.list.columns.format'),
        cell: (job) => (
          <Badge variant="outline">{REPORT_OUTPUT_FORMATS[job.outputFormat].label}</Badge>
        ),
      },
      // 狀態
      {
        id: 'status',
        header: t('auditReport.list.columns.status'),
        cell: (job) => {
          const StatusIcon = STATUS_ICONS[job.status]
          const statusConfig = REPORT_JOB_STATUSES[job.status]
          const isProcessing = ['PROCESSING', 'GENERATING', 'SIGNING', 'QUEUED'].includes(
            job.status
          )
          return (
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <StatusIcon
                  className={cn(
                    'h-4 w-4',
                    isProcessing && 'animate-spin',
                    job.status === 'COMPLETED' && 'text-green-500',
                    job.status === 'FAILED' && 'text-red-500',
                    job.status === 'EXPIRED' && 'text-orange-500'
                  )}
                />
                <Badge className={statusConfig.color}>{getStatusLabel(job.status)}</Badge>
              </div>
              {isProcessing && <Progress value={job.progress} className="h-1 w-24" />}
              {job.expiresAt && job.status === 'COMPLETED' && (
                <p className="text-xs text-muted-foreground">
                  {formatRelativeTime(job.expiresAt, t)}
                </p>
              )}
            </div>
          )
        },
      },
      // 建立時間
      {
        id: 'createdAt',
        header: t('auditReport.list.columns.createdAt'),
        cell: (job) => (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="text-sm text-muted-foreground cursor-help">
                  {formatDate(job.createdAt, locale)}
                </span>
              </TooltipTrigger>
              <TooltipContent>
                {job.completedAt && (
                  <p>
                    {t('auditReport.list.completedAt', {
                      datetime: formatDate(job.completedAt, locale),
                    })}
                  </p>
                )}
                {job.downloadCount !== undefined && job.downloadCount > 0 && (
                  <p>{t('auditReport.list.downloadCount', { count: job.downloadCount })}</p>
                )}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ),
      },
      // 操作
      {
        id: 'actions',
        header: t('auditReport.list.columns.actions'),
        headerClassName: 'text-right',
        cellClassName: 'text-right',
        cell: (job) => {
          const isDownloadable = isReportDownloadable({
            status: job.status,
            expiresAt: job.expiresAt ? new Date(job.expiresAt) : null,
            fileUrl: job.fileUrl ?? null,
          })
          const isDownloading = downloadingJobId === job.id
          return (
            <div className="flex items-center justify-end gap-2">
              {isDownloadable && (
                <>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onDownload(job.id)}
                          disabled={isDownloading}
                        >
                          {isDownloading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Download className="h-4 w-4" />
                          )}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>{t('auditReport.list.download')}</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>

                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="sm" onClick={() => onVerify(job.id)}>
                          <Shield className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>{t('auditReport.list.verify')}</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </>
              )}

              {job.status === 'FAILED' && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge variant="destructive" className="cursor-help">
                        {tCommon('status.failed')}
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent>{t('auditReport.list.failedTooltip')}</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
          )
        },
      },
    ],
    [onDownload, onVerify, downloadingJobId, t, tCommon, locale, getStatusLabel]
  )

  // --- Render ---
  if (jobs.length === 0 && !isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <FileSpreadsheet className="h-12 w-12 mb-4 opacity-50" />
        <p className="text-lg font-medium">{t('auditReport.list.emptyTitle')}</p>
        <p className="text-sm">{t('auditReport.list.emptyDescription')}</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* 工具列 */}
      <div className="flex justify-end">
        <Button
          variant="outline"
          size="sm"
          onClick={onRefresh}
          disabled={isLoading}
        >
          <RefreshCw className={cn('h-4 w-4 mr-2', isLoading && 'animate-spin')} />
          {tCommon('actions.refresh')}
        </Button>
      </div>

      {/* 表格（props.jobs 無分頁，序號退化為 index + 1） */}
      <div className="rounded-md border">
        <DataTable
          data={isLoading ? [] : jobs}
          columns={columns}
          getRowId={(job) => job.id}
          emptyState={
            isLoading ? (
              <Loader2 className="h-6 w-6 animate-spin mx-auto" />
            ) : null
          }
        />
      </div>
    </div>
  )
}
