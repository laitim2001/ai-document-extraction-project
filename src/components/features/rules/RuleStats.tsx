'use client'

/**
 * @fileoverview 規則統計組件（國際化版本）
 * @description
 *   顯示映射規則的應用統計：
 *   - 總應用次數和成功次數
 *   - 整體成功率
 *   - 近 7 天應用次數和成功率
 *   - 成功率趨勢（上升/下降/穩定）
 *   - 平均信心度
 *   - 完整國際化支援
 *
 * @module src/components/features/rules/RuleStats
 * @since Epic 4 - Story 4.1 (映射規則列表與查看)
 * @lastModified 2026-01-17
 *
 * @dependencies
 *   - next-intl - 國際化
 *   - @/components/ui/card - shadcn Card 組件
 *   - lucide-react - 圖標庫
 */

import { useTranslations } from 'next-intl'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import {
  Activity,
  TrendingUp,
  TrendingDown,
  Minus,
  Target,
  Calendar,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { RuleStats as RuleStatsType } from '@/types/rule'

// ============================================================
// Types
// ============================================================

interface RuleStatsProps {
  /** 統計數據 */
  stats: RuleStatsType
  /** 額外的 className */
  className?: string
}

// ============================================================
// Helper Components
// ============================================================

// 趨勢翻譯 key 映射
const TREND_I18N_KEYS: Record<'up' | 'down' | 'stable', string> = {
  up: 'up',
  down: 'down',
  stable: 'stable',
}

/**
 * 趨勢指示器
 */
function TrendIndicator({
  trend,
  percentage,
  t,
}: {
  trend: 'up' | 'down' | 'stable'
  percentage: number
  t: (key: string) => string
}) {
  const config = {
    up: {
      icon: TrendingUp,
      color: 'text-green-600 dark:text-green-400',
      bgColor: 'bg-green-100 dark:bg-green-900/30',
    },
    down: {
      icon: TrendingDown,
      color: 'text-red-600 dark:text-red-400',
      bgColor: 'bg-red-100 dark:bg-red-900/30',
    },
    stable: {
      icon: Minus,
      color: 'text-slate-600 dark:text-slate-400',
      bgColor: 'bg-slate-100 dark:bg-slate-800',
    },
  }

  const { icon: Icon, color, bgColor } = config[trend]
  const label = t(`trend.${TREND_I18N_KEYS[trend]}`)

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-sm font-medium',
        bgColor,
        color
      )}
    >
      <Icon className="h-4 w-4" />
      <span>
        {label}
        {percentage > 0 && ` ${percentage.toFixed(1)}%`}
      </span>
    </div>
  )
}

/**
 * 成功率進度條
 */
function SuccessRateProgress({
  rate,
  label,
}: {
  rate: number | null
  label: string
}) {
  const displayRate = rate ?? 0

  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span
          className={cn(
            'font-medium',
            displayRate >= 90
              ? 'text-green-600 dark:text-green-400'
              : displayRate >= 70
                ? 'text-yellow-600 dark:text-yellow-400'
                : displayRate > 0
                  ? 'text-red-600 dark:text-red-400'
                  : 'text-muted-foreground'
          )}
        >
          {rate !== null ? `${rate.toFixed(1)}%` : '--'}
        </span>
      </div>
      <Progress
        value={displayRate}
        className={cn(
          'h-2',
          displayRate >= 90
            ? '[&>div]:bg-green-500'
            : displayRate >= 70
              ? '[&>div]:bg-yellow-500'
              : '[&>div]:bg-red-500'
        )}
      />
    </div>
  )
}

// ============================================================
// Component
// ============================================================

/**
 * 規則統計組件
 *
 * @example
 * ```tsx
 * <RuleStats stats={rule.stats} />
 * ```
 */
export function RuleStats({ stats, className }: RuleStatsProps) {
  const t = useTranslations('rules')

  return (
    <div className={cn('grid grid-cols-1 md:grid-cols-2 gap-4', className)}>
      {/* 應用統計 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Activity className="h-4 w-4 text-muted-foreground" />
            {t('stats.applicationStats')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-2xl font-bold">{stats.totalApplications}</p>
              <p className="text-xs text-muted-foreground">{t('stats.totalApplications')}</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                {stats.successfulApplications}
              </p>
              <p className="text-xs text-muted-foreground">{t('stats.successfulApplications')}</p>
            </div>
          </div>

          <SuccessRateProgress rate={stats.successRate} label={t('stats.overallSuccessRate')} />
        </CardContent>
      </Card>

      {/* 近期表現 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            {t('stats.last7DaysPerformance')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold">
                {stats.last7DaysApplications}
              </p>
              <p className="text-xs text-muted-foreground">{t('stats.last7DaysApplications')}</p>
            </div>
            <TrendIndicator
              trend={stats.trend}
              percentage={stats.trendPercentage}
              t={t}
            />
          </div>

          <SuccessRateProgress
            rate={stats.last7DaysSuccessRate}
            label={t('stats.last7DaysSuccessRate')}
          />
        </CardContent>
      </Card>

      {/* 信心度配置 */}
      <Card className="md:col-span-2">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Target className="h-4 w-4 text-muted-foreground" />
            {t('stats.confidenceConfig')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center h-12 w-12 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                <span className="text-xl font-bold text-blue-600 dark:text-blue-400">
                  {stats.averageConfidence.toFixed(0)}%
                </span>
              </div>
              <div>
                <p className="font-medium">{t('stats.confidenceThreshold')}</p>
                <p className="text-xs text-muted-foreground">
                  {t('stats.belowRequiresReview')}
                </p>
              </div>
            </div>

            <div className="flex-1">
              <Progress
                value={stats.averageConfidence}
                className="h-3 [&>div]:bg-blue-500"
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
