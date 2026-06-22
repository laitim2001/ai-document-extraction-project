/**
 * @fileoverview 規則準確率指標組件
 * @description
 *   顯示規則的準確率指標，包含：
 *   - 當前準確率數值
 *   - 趨勢指示（上升/下降/穩定）
 *   - 歷史趨勢圖表
 *   - 樣本數量統計
 *
 * @module src/components/features/rules/AccuracyMetrics
 * @since Epic 4 - Story 4.8 (規則自動回滾)
 * @lastModified 2025-12-19
 *
 * @dependencies
 *   - @/hooks/use-accuracy - 準確率 Hooks
 *   - shadcn/ui - UI 組件
 */

'use client'

import { useTranslations } from 'next-intl'
import { useRuleAccuracy, calculateTrend, formatAccuracy } from '@/hooks/use-accuracy'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Progress } from '@/components/ui/progress'
import {
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Minus,
  Activity,
  Target,
  Hash,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ============================================================
// Types
// ============================================================

interface AccuracyMetricsProps {
  /** 規則 ID */
  ruleId: string
  /** 自定義類名 */
  className?: string
  /** 是否顯示詳細資訊 */
  showDetails?: boolean
  /** 是否緊湊模式 */
  compact?: boolean
}

// ============================================================
// Constants
// ============================================================

/** 準確率閾值配置 */
const ACCURACY_THRESHOLDS = {
  HIGH: 0.9, // 90% 以上為高
  MEDIUM: 0.7, // 70-90% 為中
  // 70% 以下為低
}

// ============================================================
// Helper Components
// ============================================================

/**
 * 趨勢指示器
 */
function TrendIndicator({ trend }: { trend: 'up' | 'down' | 'stable' }) {
  const t = useTranslations('rules')
  const config = {
    up: {
      icon: TrendingUp,
      label: t('accuracyMetrics.trend.up'),
      tooltip: t('accuracyMetrics.trend.upTooltip'),
      className: 'text-green-600',
    },
    down: {
      icon: TrendingDown,
      label: t('accuracyMetrics.trend.down'),
      tooltip: t('accuracyMetrics.trend.downTooltip'),
      className: 'text-red-600',
    },
    stable: {
      icon: Minus,
      label: t('accuracyMetrics.trend.stable'),
      tooltip: t('accuracyMetrics.trend.stableTooltip'),
      className: 'text-muted-foreground',
    },
  }

  const { icon: Icon, label, tooltip, className } = config[trend]

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={cn('flex items-center gap-1', className)}>
            <Icon className="h-4 w-4" />
            <span className="text-xs">{label}</span>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>{tooltip}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

/**
 * 準確率等級徽章
 */
function AccuracyLevelBadge({ accuracy }: { accuracy: number | null }) {
  const t = useTranslations('rules')

  if (accuracy === null) {
    return (
      <Badge variant="outline" className="text-muted-foreground">
        {t('accuracyMetrics.insufficientData')}
      </Badge>
    )
  }

  if (accuracy >= ACCURACY_THRESHOLDS.HIGH) {
    return (
      <Badge variant="default" className="bg-green-600">
        {t('accuracyMetrics.level.good')}
      </Badge>
    )
  }

  if (accuracy >= ACCURACY_THRESHOLDS.MEDIUM) {
    return (
      <Badge variant="secondary" className="bg-yellow-500 text-white">
        {t('accuracyMetrics.level.normal')}
      </Badge>
    )
  }

  return (
    <Badge variant="destructive">
      {t('accuracyMetrics.level.needsAttention')}
    </Badge>
  )
}

/**
 * 簡單趨勢圖
 */
function SimpleTrendChart({
  data,
}: {
  data: Array<{ accuracy: number | null; period: string }>
}) {
  const t = useTranslations('rules')
  const validData = data.filter((d) => d.accuracy !== null)

  if (validData.length === 0) {
    return (
      <div className="h-12 flex items-center justify-center text-xs text-muted-foreground">
        {t('accuracyMetrics.noHistory')}
      </div>
    )
  }

  // 找出最大最小值以便縮放
  const accuracies = validData.map((d) => d.accuracy!)
  const maxAccuracy = Math.max(...accuracies)
  const minAccuracy = Math.min(...accuracies)
  const range = maxAccuracy - minAccuracy || 0.1 // 避免除以零

  return (
    <div className="h-12 flex items-end gap-1">
      {data.map((d, i) => {
        if (d.accuracy === null) {
          return (
            <div
              key={i}
              className="flex-1 h-full flex items-end"
              title={`${d.period}: ${t('accuracyMetrics.insufficientData')}`}
            >
              <div className="w-full h-1 bg-muted rounded" />
            </div>
          )
        }

        const height = ((d.accuracy - minAccuracy) / range) * 100
        const normalizedHeight = Math.max(10, Math.min(100, height))

        return (
          <TooltipProvider key={i}>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex-1 h-full flex items-end">
                  <div
                    className={cn(
                      'w-full rounded-t transition-all',
                      d.accuracy >= ACCURACY_THRESHOLDS.HIGH
                        ? 'bg-green-500'
                        : d.accuracy >= ACCURACY_THRESHOLDS.MEDIUM
                          ? 'bg-yellow-500'
                          : 'bg-red-500'
                    )}
                    style={{ height: `${normalizedHeight}%` }}
                  />
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>{d.period}</p>
                <p className="font-medium">{formatAccuracy(d.accuracy)}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )
      })}
    </div>
  )
}

/**
 * 載入骨架
 */
function AccuracyMetricsSkeleton({ compact }: { compact?: boolean }) {
  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-4 w-12" />
      </div>
    )
  }

  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-4 w-32" />
      </CardHeader>
      <CardContent className="space-y-4">
        <Skeleton className="h-8 w-20" />
        <Skeleton className="h-2 w-full" />
        <Skeleton className="h-12 w-full" />
      </CardContent>
    </Card>
  )
}

// ============================================================
// Main Component
// ============================================================

/**
 * 規則準確率指標組件
 *
 * @description
 *   顯示規則的準確率指標，支援緊湊模式和詳細模式。
 *   - 緊湊模式：只顯示數值和趨勢，適合列表頁面
 *   - 詳細模式：顯示完整統計和歷史趨勢，適合詳情頁面
 *
 * @example
 *   <AccuracyMetrics ruleId="rule-id" />
 *   <AccuracyMetrics ruleId="rule-id" compact />
 */
export function AccuracyMetrics({
  ruleId,
  className,
  showDetails = true,
  compact = false,
}: AccuracyMetricsProps) {
  const t = useTranslations('rules')
  const { data, isLoading, error } = useRuleAccuracy(ruleId)

  // 載入狀態
  if (isLoading) {
    return <AccuracyMetricsSkeleton compact={compact} />
  }

  // 錯誤狀態
  if (error) {
    if (compact) {
      return (
        <span className="text-xs text-muted-foreground">{t('accuracyMetrics.loadFailed')}</span>
      )
    }
    return (
      <Alert variant="destructive" className={className}>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          {t('accuracyMetrics.loadError', { message: error.message })}
        </AlertDescription>
      </Alert>
    )
  }

  // 無數據狀態
  if (!data) {
    if (compact) {
      return (
        <span className="text-xs text-muted-foreground">{t('accuracyMetrics.insufficientData')}</span>
      )
    }
    return (
      <Card className={className}>
        <CardContent className="py-6 text-center text-muted-foreground">
          {t('accuracyMetrics.noData')}
        </CardContent>
      </Card>
    )
  }

  const { current, historical } = data
  const trend = calculateTrend(historical)
  const accuracyPercent = current.accuracy !== null ? current.accuracy * 100 : 0

  // 緊湊模式
  if (compact) {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        <span
          className={cn(
            'text-sm font-medium',
            current.accuracy === null
              ? 'text-muted-foreground'
              : current.accuracy >= ACCURACY_THRESHOLDS.HIGH
                ? 'text-green-600'
                : current.accuracy >= ACCURACY_THRESHOLDS.MEDIUM
                  ? 'text-yellow-600'
                  : 'text-red-600'
          )}
        >
          {formatAccuracy(current.accuracy)}
        </span>
        <TrendIndicator trend={trend} />
      </div>
    )
  }

  // 完整模式
  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="h-4 w-4" />
              {t('accuracyMetrics.title')}
            </CardTitle>
            <CardDescription>
              {t('accuracyMetrics.versionStats', { version: data.currentVersion })}
            </CardDescription>
          </div>
          <AccuracyLevelBadge accuracy={current.accuracy} />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 主要數值 */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold">
                {formatAccuracy(current.accuracy)}
              </span>
              <TrendIndicator trend={trend} />
            </div>
            <p className="text-xs text-muted-foreground">
              {t('accuracyMetrics.currentVersionAccuracy')}
            </p>
          </div>
        </div>

        {/* 進度條 */}
        {current.accuracy !== null && (
          <div className="space-y-1">
            <Progress
              value={accuracyPercent}
              className={cn(
                'h-2',
                current.accuracy >= ACCURACY_THRESHOLDS.HIGH
                  ? '[&>div]:bg-green-500'
                  : current.accuracy >= ACCURACY_THRESHOLDS.MEDIUM
                    ? '[&>div]:bg-yellow-500'
                    : '[&>div]:bg-red-500'
              )}
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>0%</span>
              <span>{t('accuracyMetrics.threshold')}</span>
              <span>100%</span>
            </div>
          </div>
        )}

        {/* 詳細統計 */}
        {showDetails && (
          <div className="grid grid-cols-2 gap-4 pt-2">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-muted-foreground" />
              <div>
                <div className="text-sm font-medium">
                  {current.accurate} / {current.total}
                </div>
                <div className="text-xs text-muted-foreground">
                  {t('accuracyMetrics.correctOverTotal')}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Hash className="h-4 w-4 text-muted-foreground" />
              <div>
                <div className="text-sm font-medium">
                  {current.sampleSize}
                </div>
                <div className="text-xs text-muted-foreground">
                  {t('accuracyMetrics.sampleSize')}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 歷史趨勢 */}
        {showDetails && historical.length > 0 && (
          <div className="pt-2 border-t">
            <div className="text-xs text-muted-foreground mb-2">
              {t('accuracyMetrics.last7DaysTrend')}
            </div>
            <SimpleTrendChart data={historical} />
          </div>
        )}
      </CardContent>
    </Card>
  )
}
