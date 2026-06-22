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
 * @lastModified 2026-06-22 (CHANGE-087 Phase 2: 遷移共用 DataTable)
 *
 * @dependencies
 *   - @/components/features/common/DataTable - 共用表格封裝（序號欄）
 *   - @/components/ui/* - shadcn/ui 組件
 *   - @/types/audit-report - 報告類型定義
 *   - lucide-react - 圖示
 */

import * as React from 'react'
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
  AUDIT_REPORT_TYPES,
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

function formatDate(date: Date | string): string {
  return new Date(date).toLocaleString('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatRelativeTime(date: Date | string): string {
  const now = new Date()
  const target = new Date(date)
  const diffMs = target.getTime() - now.getTime()
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays < 0) return '已過期'
  if (diffDays === 0) return '今日到期'
  if (diffDays === 1) return '明日到期'
  return `${diffDays} 天後到期`
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
  // --- Column 定義（沿用原 ReportJobRow 各儲存格內容/樣式，逐欄 1:1 保留） ---
  const columns = React.useMemo<DataTableColumn<ReportJobItem>[]>(
    () => [
      // 報告名稱
      {
        id: 'title',
        header: '報告名稱',
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
                    {job.totalRecords.toLocaleString()} 筆記錄
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
        header: '類型',
        cell: (job) => (
          <span className="text-sm">{AUDIT_REPORT_TYPES[job.reportType].label}</span>
        ),
      },
      // 格式
      {
        id: 'outputFormat',
        header: '格式',
        cell: (job) => (
          <Badge variant="outline">{REPORT_OUTPUT_FORMATS[job.outputFormat].label}</Badge>
        ),
      },
      // 狀態
      {
        id: 'status',
        header: '狀態',
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
                <Badge className={statusConfig.color}>{statusConfig.label}</Badge>
              </div>
              {isProcessing && <Progress value={job.progress} className="h-1 w-24" />}
              {job.expiresAt && job.status === 'COMPLETED' && (
                <p className="text-xs text-muted-foreground">
                  {formatRelativeTime(job.expiresAt)}
                </p>
              )}
            </div>
          )
        },
      },
      // 建立時間
      {
        id: 'createdAt',
        header: '建立時間',
        cell: (job) => (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="text-sm text-muted-foreground cursor-help">
                  {formatDate(job.createdAt)}
                </span>
              </TooltipTrigger>
              <TooltipContent>
                {job.completedAt && <p>完成時間：{formatDate(job.completedAt)}</p>}
                {job.downloadCount !== undefined && job.downloadCount > 0 && (
                  <p>下載次數：{job.downloadCount}</p>
                )}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ),
      },
      // 操作
      {
        id: 'actions',
        header: '操作',
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
                      <TooltipContent>下載報告</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>

                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="sm" onClick={() => onVerify(job.id)}>
                          <Shield className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>驗證完整性</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </>
              )}

              {job.status === 'FAILED' && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge variant="destructive" className="cursor-help">
                        失敗
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent>報告生成失敗，請重新建立</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
          )
        },
      },
    ],
    [onDownload, onVerify, downloadingJobId]
  )

  // --- Render ---
  if (jobs.length === 0 && !isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <FileSpreadsheet className="h-12 w-12 mb-4 opacity-50" />
        <p className="text-lg font-medium">尚無報告任務</p>
        <p className="text-sm">建立新的審計報告以開始</p>
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
          重新整理
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
