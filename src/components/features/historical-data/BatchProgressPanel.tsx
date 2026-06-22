'use client'

/**
 * @fileoverview 批量處理進度面板
 * @description
 *   顯示批量處理的即時進度：
 *   - 圓形進度指示器
 *   - 處理速率和剩餘時間
 *   - 狀態徽章
 *   - 控制按鈕
 *
 * @module src/components/features/historical-data/BatchProgressPanel
 * @since Epic 0 - Story 0.4
 * @lastModified 2025-12-23
 *
 * @features
 *   - 即時進度顯示
 *   - 處理速率
 *   - 剩餘時間估算
 *   - 控制功能
 *
 * @dependencies
 *   - use-batch-progress - 進度訂閱 Hook
 *   - shadcn/ui - UI 組件
 *
 * @related
 *   - src/hooks/use-batch-progress.ts - 進度訂閱 Hook
 */

import * as React from 'react'
import { useTranslations } from 'next-intl'
import {
  useBatchProgress,
  formatRemainingTime,
  formatProcessingRate,
  type BatchProgress,
} from '@/hooks/use-batch-progress'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  Loader2,
  Pause,
  Play,
  XCircle,
  RefreshCw,
  Clock,
  Zap,
  FileText,
  AlertCircle,
  CheckCircle2,
  WifiOff,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { HistoricalBatchStatus } from '@prisma/client'

// ============================================================
// Types
// ============================================================

interface BatchProgressPanelProps {
  batchId: string
  /** 暫停處理回調 */
  onPause?: () => void
  /** 恢復處理回調 */
  onResume?: () => void
  /** 取消處理回調 */
  onCancel?: () => void
  /** 處理完成回調 */
  onComplete?: (status: HistoricalBatchStatus) => void
  /** 查看錯誤回調 */
  onViewErrors?: () => void
  /** 是否顯示控制按鈕 */
  showControls?: boolean
  /** 額外的 CSS 類名 */
  className?: string
}

// ============================================================
// Status Badge Component
// ============================================================

function StatusBadge({
  status,
  t,
}: {
  status: HistoricalBatchStatus
  t: ReturnType<typeof useTranslations<'historicalData.batchProgress'>>
}) {
  const config = {
    PENDING: { labelKey: 'pending', variant: 'secondary' as const, icon: Clock },
    PROCESSING: { labelKey: 'processing', variant: 'default' as const, icon: Loader2 },
    PAUSED: { labelKey: 'paused', variant: 'outline' as const, icon: Pause },
    AGGREGATING: { labelKey: 'aggregating', variant: 'default' as const, icon: Loader2 },
    AGGREGATED: { labelKey: 'aggregated', variant: 'default' as const, icon: CheckCircle2 },
    COMPLETED: { labelKey: 'completed', variant: 'default' as const, icon: CheckCircle2 },
    FAILED: { labelKey: 'failed', variant: 'destructive' as const, icon: AlertCircle },
    CANCELLED: { labelKey: 'cancelled', variant: 'secondary' as const, icon: XCircle },
  }

  const { labelKey, variant, icon: Icon } = config[status] || config.PENDING

  return (
    <Badge variant={variant} className="gap-1">
      <Icon className={cn('h-3 w-3', status === 'PROCESSING' && 'animate-spin')} />
      {t(`status.${labelKey}`)}
    </Badge>
  )
}

// ============================================================
// Connection Status Indicator
// ============================================================

function ConnectionIndicator({
  status,
  t,
}: {
  status: 'connecting' | 'connected' | 'disconnected' | 'error'
  t: ReturnType<typeof useTranslations<'historicalData.batchProgress'>>
}) {
  const config = {
    connecting: { color: 'bg-yellow-500' },
    connected: { color: 'bg-green-500' },
    disconnected: { color: 'bg-gray-400' },
    error: { color: 'bg-red-500' },
  }

  const { color } = config[status]
  const label = t(`connection.${status}`)

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex items-center gap-1.5">
          <div className={cn('h-2 w-2 rounded-full', color)} />
          <span className="text-xs text-muted-foreground">{label}</span>
        </div>
      </TooltipTrigger>
      <TooltipContent>{t('connection.tooltip', { status: label })}</TooltipContent>
    </Tooltip>
  )
}

// ============================================================
// Circular Progress Component
// ============================================================

function CircularProgress({
  percentage,
  size = 120,
  strokeWidth = 8,
}: {
  percentage: number
  size?: number
  strokeWidth?: number
}) {
  const radius = (size - strokeWidth) / 2
  const circumference = radius * 2 * Math.PI
  const offset = circumference - (percentage / 100) * circumference

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg className="transform -rotate-90" width={size} height={size}>
        {/* Background circle */}
        <circle
          className="text-muted stroke-current"
          strokeWidth={strokeWidth}
          fill="none"
          r={radius}
          cx={size / 2}
          cy={size / 2}
        />
        {/* Progress circle */}
        <circle
          className="text-primary stroke-current transition-all duration-500 ease-out"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          fill="none"
          r={radius}
          cx={size / 2}
          cy={size / 2}
          style={{
            strokeDasharray: circumference,
            strokeDashoffset: offset,
          }}
        />
      </svg>
      {/* Percentage text */}
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-2xl font-bold">{percentage}%</span>
      </div>
    </div>
  )
}

// ============================================================
// Stats Grid Component
// ============================================================

function StatsGrid({
  progress,
  t,
}: {
  progress: BatchProgress
  t: ReturnType<typeof useTranslations<'historicalData.batchProgress'>>
}) {
  const stats = [
    {
      label: t('stats.completed'),
      value: progress.filesByStatus.completed,
      icon: CheckCircle2,
      color: 'text-green-500',
    },
    {
      label: t('stats.processing'),
      value: progress.filesByStatus.processing,
      icon: Loader2,
      color: 'text-blue-500',
      animate: true,
    },
    {
      label: t('stats.pending'),
      value: progress.filesByStatus.pending + progress.filesByStatus.detected,
      icon: Clock,
      color: 'text-gray-500',
    },
    {
      label: t('stats.failed'),
      value: progress.failedFiles,
      icon: AlertCircle,
      color: 'text-red-500',
    },
  ]

  return (
    <div className="grid grid-cols-4 gap-4">
      {stats.map((stat) => (
        <div key={stat.label} className="text-center">
          <stat.icon
            className={cn(
              'h-5 w-5 mx-auto mb-1',
              stat.color,
              stat.animate && 'animate-spin'
            )}
          />
          <div className="text-xl font-semibold">{stat.value}</div>
          <div className="text-xs text-muted-foreground">{stat.label}</div>
        </div>
      ))}
    </div>
  )
}

// ============================================================
// Main Component
// ============================================================

export function BatchProgressPanel({
  batchId,
  onPause,
  onResume,
  onCancel,
  onComplete,
  onViewErrors,
  showControls = true,
  className,
}: BatchProgressPanelProps) {
  // --- Hooks ---
  const t = useTranslations('historicalData.batchProgress')
  const {
    progress,
    connectionStatus,
    isLoading,
    error,
    reconnect,
  } = useBatchProgress(batchId, {
    enabled: true,
    onComplete,
  })

  // --- Render: Loading State ---
  if (isLoading && !progress) {
    return (
      <Card className={className}>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <span className="ml-2 text-muted-foreground">{t('loading')}</span>
        </CardContent>
      </Card>
    )
  }

  // --- Render: Error State ---
  if (error && !progress) {
    return (
      <Card className={className}>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <WifiOff className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground mb-4">{t('connectionError')}</p>
          <Button variant="outline" onClick={reconnect}>
            <RefreshCw className="mr-2 h-4 w-4" />
            {t('reconnect')}
          </Button>
        </CardContent>
      </Card>
    )
  }

  // --- Render: No Progress ---
  if (!progress) {
    return (
      <Card className={className}>
        <CardContent className="flex items-center justify-center py-12">
          <p className="text-muted-foreground">{t('noProgress')}</p>
        </CardContent>
      </Card>
    )
  }

  // --- Derived State ---
  const isProcessing = progress.status === 'PROCESSING'
  const isPaused = progress.status === 'PAUSED'
  const isCompleted = progress.status === 'COMPLETED'
  const isFailed = progress.status === 'FAILED'
  const canPause = isProcessing && onPause
  const canResume = isPaused && onResume
  const canCancel = (isProcessing || isPaused) && onCancel

  // --- Render ---
  return (
    <TooltipProvider>
      <Card className={className}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {progress.batchName}
            </CardTitle>
            <div className="flex items-center gap-3">
              <ConnectionIndicator status={connectionStatus} t={t} />
              <StatusBadge status={progress.status} t={t} />
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Progress Section */}
          <div className="flex items-center gap-6">
            <CircularProgress percentage={progress.percentage} />

            <div className="flex-1 space-y-3">
              {/* Processing Rate */}
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-yellow-500" />
                <span className="text-sm text-muted-foreground">{t('rate')}</span>
                <span className="font-medium">
                  {formatProcessingRate(progress.processingRate)}
                </span>
              </div>

              {/* Remaining Time */}
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-blue-500" />
                <span className="text-sm text-muted-foreground">{t('estimatedRemaining')}</span>
                <span className="font-medium">
                  {formatRemainingTime(progress.estimatedRemainingTime)}
                </span>
              </div>

              {/* Current File */}
              {progress.currentFileName && (
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">{t('currentFile')}</span>
                  <span className="font-medium truncate max-w-[200px]">
                    {progress.currentFileName}
                  </span>
                </div>
              )}

              {/* Linear Progress Bar */}
              <Progress value={progress.percentage} className="h-2" />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>
                  {t('fileCount', { processed: progress.processedFiles, total: progress.totalFiles })}
                </span>
                <span>{progress.percentage}%</span>
              </div>
            </div>
          </div>

          {/* Stats Grid */}
          <StatsGrid progress={progress} t={t} />

          {/* Control Buttons */}
          {showControls && (
            <div className="flex items-center justify-between pt-2 border-t">
              <div className="flex gap-2">
                {canPause && (
                  <Button variant="outline" size="sm" onClick={onPause}>
                    <Pause className="mr-1 h-4 w-4" />
                    {t('controls.pause')}
                  </Button>
                )}
                {canResume && (
                  <Button variant="outline" size="sm" onClick={onResume}>
                    <Play className="mr-1 h-4 w-4" />
                    {t('controls.resume')}
                  </Button>
                )}
                {canCancel && (
                  <Button variant="destructive" size="sm" onClick={onCancel}>
                    <XCircle className="mr-1 h-4 w-4" />
                    {t('controls.cancel')}
                  </Button>
                )}
              </div>

              {progress.failedFiles > 0 && onViewErrors && (
                <Button variant="ghost" size="sm" onClick={onViewErrors}>
                  <AlertCircle className="mr-1 h-4 w-4 text-red-500" />
                  {t('viewErrors', { count: progress.failedFiles })}
                </Button>
              )}
            </div>
          )}

          {/* Completed Summary */}
          {(isCompleted || isFailed) && (
            <div className="pt-2 border-t">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-lg font-semibold text-green-600">
                    ${progress.totalCost.toFixed(4)}
                  </div>
                  <div className="text-xs text-muted-foreground">{t('summary.totalCost')}</div>
                </div>
                <div>
                  <div className="text-lg font-semibold text-blue-600">
                    {progress.newCompaniesCount}
                  </div>
                  <div className="text-xs text-muted-foreground">{t('summary.newCompanies')}</div>
                </div>
                <div>
                  <div className="text-lg font-semibold text-purple-600">
                    {progress.extractedTermsCount}
                  </div>
                  <div className="text-xs text-muted-foreground">{t('summary.extractedTerms')}</div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </TooltipProvider>
  )
}
