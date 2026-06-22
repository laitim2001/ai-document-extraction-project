'use client'

/**
 * @fileoverview 批量處理摘要卡片
 * @description
 *   顯示已完成批量處理的摘要資訊：
 *   - 處理統計（成功/失敗/跳過）
 *   - 成本統計
 *   - 新公司和費用項統計
 *   - 處理效率
 *
 * @module src/components/features/historical-data/BatchSummaryCard
 * @since Epic 0 - Story 0.4
 * @lastModified 2025-12-23
 *
 * @features
 *   - 處理結果摘要
 *   - 成本分析
 *   - 效率指標
 *   - 視覺化統計
 *
 * @dependencies
 *   - shadcn/ui - UI 組件
 *   - lucide-react - 圖標
 *
 * @related
 *   - src/services/batch-progress.service.ts - 摘要資料
 *   - src/components/features/historical-data/BatchProgressPanel.tsx - 進度面板
 */

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  CheckCircle2,
  XCircle,
  SkipForward,
  DollarSign,
  Building2,
  FileText,
  Clock,
  Zap,
  TrendingUp,
  AlertTriangle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { HistoricalBatchStatus } from '@prisma/client'

// ============================================================
// Types
// ============================================================

/**
 * 批次摘要資訊
 */
export interface BatchSummary {
  batchId: string
  batchName: string
  status: HistoricalBatchStatus
  totalFiles: number
  successCount: number
  failedCount: number
  skippedCount: number
  totalCost: number
  averageCostPerFile: number
  newCompaniesCount: number
  extractedTermsCount: number
  durationMs: number | null
  processingRate: number
  startedAt: Date | null
  completedAt: Date | null
}

interface BatchSummaryCardProps {
  /** 批次摘要資訊 */
  summary: BatchSummary
  /** 額外的 CSS 類名 */
  className?: string
}

// ============================================================
// Helper Functions
// ============================================================

/**
 * 格式化持續時間
 */
function formatDuration(
  ms: number | null,
  t: ReturnType<typeof useTranslations<'historicalData.batchSummary'>>
): string {
  if (!ms || ms <= 0) return '-'

  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)

  if (hours > 0) {
    const remainingMinutes = minutes % 60
    return t('duration.hoursMinutes', { hours, minutes: remainingMinutes })
  }

  if (minutes > 0) {
    const remainingSeconds = seconds % 60
    return t('duration.minutesSeconds', { minutes, seconds: remainingSeconds })
  }

  return t('duration.seconds', { seconds })
}

/**
 * 格式化成本
 */
function formatCost(cost: number): string {
  if (cost === 0) return '$0.00'
  if (cost < 0.01) return `$${cost.toFixed(4)}`
  return `$${cost.toFixed(2)}`
}

/**
 * 計算成功率
 */
function calculateSuccessRate(
  success: number,
  failed: number,
  skipped: number
): number {
  const total = success + failed + skipped
  if (total === 0) return 0
  return Math.round((success / total) * 100)
}

// ============================================================
// Sub-Components
// ============================================================

/**
 * 狀態徽章
 */
function StatusBadge({
  status,
  t,
}: {
  status: HistoricalBatchStatus
  t: ReturnType<typeof useTranslations<'historicalData.batchSummary'>>
}) {
  const config = {
    COMPLETED: {
      labelKey: 'completed',
      variant: 'default' as const,
      icon: CheckCircle2,
      className: 'bg-green-100 text-green-800 border-green-200',
    },
    FAILED: {
      labelKey: 'failed',
      variant: 'destructive' as const,
      icon: XCircle,
      className: '',
    },
    CANCELLED: {
      labelKey: 'cancelled',
      variant: 'secondary' as const,
      icon: AlertTriangle,
      className: '',
    },
    PENDING: {
      labelKey: 'pending',
      variant: 'outline' as const,
      icon: Clock,
      className: '',
    },
    PROCESSING: {
      labelKey: 'processing',
      variant: 'default' as const,
      icon: Zap,
      className: '',
    },
    PAUSED: {
      labelKey: 'paused',
      variant: 'outline' as const,
      icon: Clock,
      className: '',
    },
    AGGREGATING: {
      labelKey: 'aggregating',
      variant: 'outline' as const,
      icon: Clock,
      className: 'bg-blue-100 text-blue-800 border-blue-200',
    },
    AGGREGATED: {
      labelKey: 'aggregated',
      variant: 'default' as const,
      icon: CheckCircle2,
      className: 'bg-indigo-100 text-indigo-800 border-indigo-200',
    },
  }

  const { labelKey, variant, icon: Icon, className } = config[status] || config.PENDING

  return (
    <Badge variant={variant} className={cn('gap-1', className)}>
      <Icon className="h-3 w-3" />
      {t(`status.${labelKey}`)}
    </Badge>
  )
}

/**
 * 統計卡片
 */
function StatItem({
  icon: Icon,
  label,
  value,
  subValue,
  iconColor,
  tooltip,
}: {
  icon: React.ElementType
  label: string
  value: string | number
  subValue?: string
  iconColor?: string
  tooltip?: string
}) {
  const content = (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
      <div className={cn('p-2 rounded-lg bg-background', iconColor)}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm text-muted-foreground">{label}</div>
        <div className="text-lg font-semibold truncate">{value}</div>
        {subValue && (
          <div className="text-xs text-muted-foreground">{subValue}</div>
        )}
      </div>
    </div>
  )

  if (tooltip) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{content}</TooltipTrigger>
        <TooltipContent>{tooltip}</TooltipContent>
      </Tooltip>
    )
  }

  return content
}

// ============================================================
// Main Component
// ============================================================

export function BatchSummaryCard({ summary, className }: BatchSummaryCardProps) {
  const t = useTranslations('historicalData.batchSummary')
  const successRate = calculateSuccessRate(
    summary.successCount,
    summary.failedCount,
    summary.skippedCount
  )

  return (
    <TooltipProvider>
      <Card className={className}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {summary.batchName}
            </CardTitle>
            <StatusBadge status={summary.status} t={t} />
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* 處理結果統計 */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-muted-foreground">{t('results.title')}</h4>

            {/* 進度條 */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>{t('results.successRate')}</span>
                <span className="font-medium">{successRate}%</span>
              </div>
              <div className="relative h-3 rounded-full overflow-hidden bg-muted">
                {/* 成功 */}
                <div
                  className="absolute left-0 top-0 h-full bg-green-500 transition-all"
                  style={{
                    width: `${(summary.successCount / summary.totalFiles) * 100}%`,
                  }}
                />
                {/* 跳過 */}
                <div
                  className="absolute top-0 h-full bg-yellow-500 transition-all"
                  style={{
                    left: `${(summary.successCount / summary.totalFiles) * 100}%`,
                    width: `${(summary.skippedCount / summary.totalFiles) * 100}%`,
                  }}
                />
                {/* 失敗 */}
                <div
                  className="absolute top-0 h-full bg-red-500 transition-all"
                  style={{
                    left: `${((summary.successCount + summary.skippedCount) / summary.totalFiles) * 100}%`,
                    width: `${(summary.failedCount / summary.totalFiles) * 100}%`,
                  }}
                />
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                  {t('results.successLegend', { count: summary.successCount })}
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-yellow-500" />
                  {t('results.skippedLegend', { count: summary.skippedCount })}
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-red-500" />
                  {t('results.failedLegend', { count: summary.failedCount })}
                </div>
              </div>
            </div>

            {/* 數量統計 */}
            <div className="grid grid-cols-3 gap-3 pt-2">
              <div className="text-center p-2 rounded-lg bg-green-50 dark:bg-green-950">
                <CheckCircle2 className="h-5 w-5 mx-auto text-green-600 mb-1" />
                <div className="text-xl font-bold text-green-600">
                  {summary.successCount}
                </div>
                <div className="text-xs text-green-600/80">{t('results.success')}</div>
              </div>
              <div className="text-center p-2 rounded-lg bg-yellow-50 dark:bg-yellow-950">
                <SkipForward className="h-5 w-5 mx-auto text-yellow-600 mb-1" />
                <div className="text-xl font-bold text-yellow-600">
                  {summary.skippedCount}
                </div>
                <div className="text-xs text-yellow-600/80">{t('results.skipped')}</div>
              </div>
              <div className="text-center p-2 rounded-lg bg-red-50 dark:bg-red-950">
                <XCircle className="h-5 w-5 mx-auto text-red-600 mb-1" />
                <div className="text-xl font-bold text-red-600">
                  {summary.failedCount}
                </div>
                <div className="text-xs text-red-600/80">{t('results.failed')}</div>
              </div>
            </div>
          </div>

          {/* 詳細統計 */}
          <div className="grid grid-cols-2 gap-3">
            <StatItem
              icon={DollarSign}
              label={t('stats.totalCost')}
              value={formatCost(summary.totalCost)}
              subValue={t('stats.averageCost', { cost: formatCost(summary.averageCostPerFile) })}
              iconColor="text-green-600"
              tooltip={t('stats.totalCostTooltip')}
            />
            <StatItem
              icon={Building2}
              label={t('stats.newCompanies')}
              value={summary.newCompaniesCount}
              iconColor="text-blue-600"
              tooltip={t('stats.newCompaniesTooltip')}
            />
            <StatItem
              icon={TrendingUp}
              label={t('stats.extractedTerms')}
              value={summary.extractedTermsCount}
              iconColor="text-purple-600"
              tooltip={t('stats.extractedTermsTooltip')}
            />
            <StatItem
              icon={Clock}
              label={t('stats.processingTime')}
              value={formatDuration(summary.durationMs, t)}
              subValue={t('stats.processingRate', { rate: summary.processingRate.toFixed(1) })}
              iconColor="text-orange-600"
              tooltip={t('stats.processingTimeTooltip')}
            />
          </div>

          {/* 時間資訊 */}
          <div className="pt-3 border-t text-xs text-muted-foreground">
            <div className="flex justify-between">
              <span>{t('time.startedAt')}</span>
              <span>
                {summary.startedAt
                  ? new Date(summary.startedAt).toLocaleString('zh-TW')
                  : '-'}
              </span>
            </div>
            <div className="flex justify-between mt-1">
              <span>{t('time.completedAt')}</span>
              <span>
                {summary.completedAt
                  ? new Date(summary.completedAt).toLocaleString('zh-TW')
                  : '-'}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </TooltipProvider>
  )
}
