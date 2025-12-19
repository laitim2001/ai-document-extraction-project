'use client'

/**
 * @fileoverview 影響分析摘要卡片
 * @description
 *   顯示影響分析的統計摘要，包含：
 *   - 受影響文件數
 *   - 改善率與惡化率
 *   - 風險案例數
 *   - 預期準確率
 *
 * @module src/components/features/rule-review/ImpactSummaryCard
 * @since Epic 4 - Story 4.6 (審核學習規則)
 * @lastModified 2025-12-19
 *
 * @dependencies
 *   - lucide-react - 圖標
 *   - @/types/impact - ImpactStatistics 類型
 */

import {
  FileCheck,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Percent,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ImpactStatistics } from '@/types/impact'

// ============================================================
// Types
// ============================================================

interface ImpactSummaryCardProps {
  /** 統計數據 */
  statistics: ImpactStatistics
  /** 額外的 className */
  className?: string
}

// ============================================================
// Sub Components
// ============================================================

/**
 * 統計項目
 */
function StatItem({
  icon: Icon,
  label,
  value,
  trend: _trend,
  trendColor,
}: {
  icon: React.ElementType
  label: string
  value: string | number
  trend?: 'up' | 'down' | 'neutral'
  trendColor?: 'green' | 'red' | 'yellow' | 'default'
}) {
  const colorClasses = {
    green: 'text-green-600',
    red: 'text-red-600',
    yellow: 'text-yellow-600',
    default: 'text-foreground',
  }

  const bgClasses = {
    green: 'bg-green-100',
    red: 'bg-red-100',
    yellow: 'bg-yellow-100',
    default: 'bg-muted',
  }

  return (
    <div className="flex items-center gap-3">
      <div
        className={cn(
          'flex h-10 w-10 items-center justify-center rounded-lg',
          bgClasses[trendColor ?? 'default']
        )}
      >
        <Icon
          className={cn('h-5 w-5', colorClasses[trendColor ?? 'default'])}
        />
      </div>
      <div>
        <p className="text-sm text-muted-foreground">{label}</p>
        <p
          className={cn(
            'text-lg font-semibold',
            colorClasses[trendColor ?? 'default']
          )}
        >
          {value}
        </p>
      </div>
    </div>
  )
}

// ============================================================
// Component
// ============================================================

/**
 * 影響分析摘要卡片
 *
 * @description
 *   在審核頁面顯示規則變更的影響統計摘要
 *
 * @example
 * ```tsx
 * <ImpactSummaryCard statistics={impactData.statistics} />
 * ```
 */
export function ImpactSummaryCard({
  statistics,
  className,
}: ImpactSummaryCardProps) {
  // 改善率和惡化率已經是百分比格式 (0-100)
  const improvementRate = Math.round(statistics.improvementRate)
  const regressionRate = Math.round(statistics.regressionRate)

  return (
    <div className={cn('space-y-4', className)}>
      <div className="grid grid-cols-2 gap-4">
        <StatItem
          icon={FileCheck}
          label="受影響文件"
          value={statistics.totalAffected.toLocaleString()}
          trendColor="default"
        />

        <StatItem
          icon={TrendingUp}
          label="預計改善"
          value={statistics.estimatedImprovement.toLocaleString()}
          trend="up"
          trendColor="green"
        />

        <StatItem
          icon={TrendingDown}
          label="可能惡化"
          value={statistics.estimatedRegression.toLocaleString()}
          trend="down"
          trendColor={statistics.estimatedRegression > 0 ? 'red' : 'green'}
        />

        <StatItem
          icon={AlertTriangle}
          label="無變化"
          value={statistics.unchanged.toLocaleString()}
          trendColor="default"
        />
      </div>

      <div className="border-t pt-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">改善率</span>
          <div className="flex items-center gap-2">
            <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full transition-all',
                  improvementRate >= 80
                    ? 'bg-green-500'
                    : improvementRate >= 50
                      ? 'bg-yellow-500'
                      : 'bg-red-500'
                )}
                style={{ width: `${Math.min(improvementRate, 100)}%` }}
              />
            </div>
            <span
              className={cn(
                'font-medium text-sm',
                improvementRate >= 80
                  ? 'text-green-600'
                  : improvementRate >= 50
                    ? 'text-yellow-600'
                    : 'text-red-600'
              )}
            >
              {improvementRate}%
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">惡化率</span>
          <div className="flex items-center gap-2">
            <Percent
              className={cn(
                'h-4 w-4',
                regressionRate <= 5
                  ? 'text-green-600'
                  : regressionRate <= 15
                    ? 'text-yellow-600'
                    : 'text-red-600'
              )}
            />
            <span
              className={cn(
                'font-medium',
                regressionRate <= 5
                  ? 'text-green-600'
                  : regressionRate <= 15
                    ? 'text-yellow-600'
                    : 'text-red-600'
              )}
            >
              {regressionRate}%
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
