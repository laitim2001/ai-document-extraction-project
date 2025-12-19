'use client'

/**
 * @fileoverview 影響分析統計卡片組件
 * @description
 *   顯示規則變更影響分析的統計數據：
 *   - 受影響文件總數
 *   - 預計改善數量
 *   - 可能惡化數量
 *   - 無變化數量
 *   - 改善率和惡化率
 *
 * @module src/components/features/suggestions/ImpactStatisticsCards
 * @since Epic 4 - Story 4.5 (規則影響範圍分析)
 * @lastModified 2025-12-19
 *
 * @dependencies
 *   - @/components/ui/card - shadcn Card 組件
 *   - lucide-react - 圖標庫
 */

import { Card, CardContent } from '@/components/ui/card'
import {
  FileStack,
  TrendingUp,
  TrendingDown,
  Minus,
  Percent,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ImpactStatistics } from '@/types/impact'

// ============================================================
// Types
// ============================================================

interface ImpactStatisticsCardsProps {
  /** 統計數據 */
  statistics: ImpactStatistics
  /** 額外的 className */
  className?: string
}

// ============================================================
// Card Configuration
// ============================================================

interface CardConfig {
  key: keyof ImpactStatistics | 'improvementRateDisplay' | 'regressionRateDisplay'
  getValue: (stats: ImpactStatistics) => string | number
  label: string
  icon: typeof FileStack
  color: string
  bgColor: string
}

const CARD_CONFIGS: CardConfig[] = [
  {
    key: 'totalAffected',
    getValue: (stats) => stats.totalAffected,
    label: '受影響文件',
    icon: FileStack,
    color: 'text-slate-600 dark:text-slate-400',
    bgColor: 'bg-slate-100 dark:bg-slate-800',
  },
  {
    key: 'estimatedImprovement',
    getValue: (stats) => stats.estimatedImprovement,
    label: '預計改善',
    icon: TrendingUp,
    color: 'text-green-600 dark:text-green-400',
    bgColor: 'bg-green-100 dark:bg-green-900/30',
  },
  {
    key: 'estimatedRegression',
    getValue: (stats) => stats.estimatedRegression,
    label: '可能惡化',
    icon: TrendingDown,
    color: 'text-red-600 dark:text-red-400',
    bgColor: 'bg-red-100 dark:bg-red-900/30',
  },
  {
    key: 'unchanged',
    getValue: (stats) => stats.unchanged,
    label: '無變化',
    icon: Minus,
    color: 'text-slate-500 dark:text-slate-400',
    bgColor: 'bg-slate-100 dark:bg-slate-800',
  },
  {
    key: 'improvementRateDisplay',
    getValue: (stats) => `${stats.improvementRate}%`,
    label: '改善率',
    icon: Percent,
    color: 'text-emerald-600 dark:text-emerald-400',
    bgColor: 'bg-emerald-100 dark:bg-emerald-900/30',
  },
  {
    key: 'regressionRateDisplay',
    getValue: (stats) => `${stats.regressionRate}%`,
    label: '惡化率',
    icon: Percent,
    color: 'text-rose-600 dark:text-rose-400',
    bgColor: 'bg-rose-100 dark:bg-rose-900/30',
  },
]

// ============================================================
// Component
// ============================================================

/**
 * 影響分析統計卡片
 *
 * @example
 * ```tsx
 * <ImpactStatisticsCards statistics={data.statistics} />
 * ```
 */
export function ImpactStatisticsCards({
  statistics,
  className,
}: ImpactStatisticsCardsProps) {
  return (
    <div
      className={cn(
        'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4',
        className
      )}
    >
      {CARD_CONFIGS.map((config) => {
        const Icon = config.icon
        const value = config.getValue(statistics)

        return (
          <Card key={config.key} className="overflow-hidden">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    'flex items-center justify-center rounded-lg p-2',
                    config.bgColor
                  )}
                >
                  <Icon className={cn('h-5 w-5', config.color)} />
                </div>
                <div>
                  <p className="text-2xl font-bold">{value}</p>
                  <p className="text-xs text-muted-foreground">{config.label}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
