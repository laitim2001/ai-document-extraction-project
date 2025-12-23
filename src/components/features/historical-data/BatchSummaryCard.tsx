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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
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
function formatDuration(ms: number | null): string {
  if (!ms || ms <= 0) return '-'

  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)

  if (hours > 0) {
    const remainingMinutes = minutes % 60
    return `${hours} 小時 ${remainingMinutes} 分鐘`
  }

  if (minutes > 0) {
    const remainingSeconds = seconds % 60
    return `${minutes} 分 ${remainingSeconds} 秒`
  }

  return `${seconds} 秒`
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
function StatusBadge({ status }: { status: HistoricalBatchStatus }) {
  const config = {
    COMPLETED: {
      label: '已完成',
      variant: 'default' as const,
      icon: CheckCircle2,
      className: 'bg-green-100 text-green-800 border-green-200',
    },
    FAILED: {
      label: '失敗',
      variant: 'destructive' as const,
      icon: XCircle,
      className: '',
    },
    CANCELLED: {
      label: '已取消',
      variant: 'secondary' as const,
      icon: AlertTriangle,
      className: '',
    },
    PENDING: {
      label: '待處理',
      variant: 'outline' as const,
      icon: Clock,
      className: '',
    },
    PROCESSING: {
      label: '處理中',
      variant: 'default' as const,
      icon: Zap,
      className: '',
    },
    PAUSED: {
      label: '已暫停',
      variant: 'outline' as const,
      icon: Clock,
      className: '',
    },
  }

  const { label, variant, icon: Icon, className } = config[status] || config.PENDING

  return (
    <Badge variant={variant} className={cn('gap-1', className)}>
      <Icon className="h-3 w-3" />
      {label}
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
            <StatusBadge status={summary.status} />
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* 處理結果統計 */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-muted-foreground">處理結果</h4>

            {/* 進度條 */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>成功率</span>
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
                  成功 {summary.successCount}
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-yellow-500" />
                  跳過 {summary.skippedCount}
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-red-500" />
                  失敗 {summary.failedCount}
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
                <div className="text-xs text-green-600/80">成功</div>
              </div>
              <div className="text-center p-2 rounded-lg bg-yellow-50 dark:bg-yellow-950">
                <SkipForward className="h-5 w-5 mx-auto text-yellow-600 mb-1" />
                <div className="text-xl font-bold text-yellow-600">
                  {summary.skippedCount}
                </div>
                <div className="text-xs text-yellow-600/80">跳過</div>
              </div>
              <div className="text-center p-2 rounded-lg bg-red-50 dark:bg-red-950">
                <XCircle className="h-5 w-5 mx-auto text-red-600 mb-1" />
                <div className="text-xl font-bold text-red-600">
                  {summary.failedCount}
                </div>
                <div className="text-xs text-red-600/80">失敗</div>
              </div>
            </div>
          </div>

          {/* 詳細統計 */}
          <div className="grid grid-cols-2 gap-3">
            <StatItem
              icon={DollarSign}
              label="總成本"
              value={formatCost(summary.totalCost)}
              subValue={`平均 ${formatCost(summary.averageCostPerFile)}/文件`}
              iconColor="text-green-600"
              tooltip="Azure OpenAI API 使用成本"
            />
            <StatItem
              icon={Building2}
              label="新發現公司"
              value={summary.newCompaniesCount}
              iconColor="text-blue-600"
              tooltip="處理過程中識別的新公司"
            />
            <StatItem
              icon={TrendingUp}
              label="提取費用項"
              value={summary.extractedTermsCount}
              iconColor="text-purple-600"
              tooltip="提取的費用術語總數"
            />
            <StatItem
              icon={Clock}
              label="處理時間"
              value={formatDuration(summary.durationMs)}
              subValue={`${summary.processingRate.toFixed(1)} files/min`}
              iconColor="text-orange-600"
              tooltip="總處理時間和處理速率"
            />
          </div>

          {/* 時間資訊 */}
          <div className="pt-3 border-t text-xs text-muted-foreground">
            <div className="flex justify-between">
              <span>開始時間</span>
              <span>
                {summary.startedAt
                  ? new Date(summary.startedAt).toLocaleString('zh-TW')
                  : '-'}
              </span>
            </div>
            <div className="flex justify-between mt-1">
              <span>完成時間</span>
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
