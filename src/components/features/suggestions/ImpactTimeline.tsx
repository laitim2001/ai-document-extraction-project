'use client'

/**
 * @fileoverview 影響分析時間軸組件
 * @description
 *   顯示規則變更影響的時間趨勢：
 *   - 每日受影響文件數
 *   - 每日改善數和惡化數
 *   - 趨勢可視化圖表
 *
 * @module src/components/features/suggestions/ImpactTimeline
 * @since Epic 4 - Story 4.5 (規則影響範圍分析)
 * @lastModified 2025-12-19
 *
 * @dependencies
 *   - @/components/ui/card - shadcn Card 組件
 *   - lucide-react - 圖標庫
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Calendar, TrendingUp, TrendingDown } from 'lucide-react'
import type { TimelineItem } from '@/types/impact'

// ============================================================
// Types
// ============================================================

interface ImpactTimelineProps {
  /** 時間軸數據 */
  timeline: TimelineItem[]
  /** 額外的 className */
  className?: string
}

// ============================================================
// Helper Functions
// ============================================================

/**
 * 格式化日期為簡短格式
 */
function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString('zh-TW', { month: 'short', day: 'numeric' })
}

/**
 * 計算最大值用於比例
 */
function getMaxValue(timeline: TimelineItem[]): number {
  if (timeline.length === 0) return 1
  return Math.max(...timeline.map((item) => item.affectedCount), 1)
}

// ============================================================
// Sub Components
// ============================================================

/**
 * 單一時間軸項目
 */
function TimelineBar({
  item,
  maxValue,
}: {
  item: TimelineItem
  maxValue: number
}) {
  const barHeight = Math.max((item.affectedCount / maxValue) * 60, 4)
  const improvedRatio = item.affectedCount > 0 ? item.improvedCount / item.affectedCount : 0
  const regressedRatio = item.affectedCount > 0 ? item.regressedCount / item.affectedCount : 0

  return (
    <div className="flex flex-col items-center gap-1 min-w-[40px]">
      {/* Bar */}
      <div
        className="w-6 bg-muted rounded-sm relative overflow-hidden"
        style={{ height: `${barHeight}px` }}
      >
        {/* Improved section (green from bottom) */}
        <div
          className="absolute bottom-0 left-0 right-0 bg-green-500"
          style={{ height: `${improvedRatio * 100}%` }}
        />
        {/* Regressed section (red from top) */}
        <div
          className="absolute top-0 left-0 right-0 bg-red-500"
          style={{ height: `${regressedRatio * 100}%` }}
        />
      </div>
      {/* Date label */}
      <span className="text-[10px] text-muted-foreground whitespace-nowrap">
        {formatDate(item.date)}
      </span>
    </div>
  )
}

/**
 * 圖例
 */
function Legend() {
  return (
    <div className="flex items-center gap-4 text-xs text-muted-foreground">
      <div className="flex items-center gap-1">
        <div className="w-3 h-3 bg-green-500 rounded-sm" />
        <span>改善</span>
      </div>
      <div className="flex items-center gap-1">
        <div className="w-3 h-3 bg-red-500 rounded-sm" />
        <span>惡化</span>
      </div>
      <div className="flex items-center gap-1">
        <div className="w-3 h-3 bg-muted rounded-sm" />
        <span>無變化</span>
      </div>
    </div>
  )
}

/**
 * 摘要統計
 */
function TimelineSummary({ timeline }: { timeline: TimelineItem[] }) {
  const totals = timeline.reduce(
    (acc, item) => ({
      affected: acc.affected + item.affectedCount,
      improved: acc.improved + item.improvedCount,
      regressed: acc.regressed + item.regressedCount,
    }),
    { affected: 0, improved: 0, regressed: 0 }
  )

  return (
    <div className="flex items-center gap-6 text-sm">
      <div className="flex items-center gap-2">
        <Calendar className="h-4 w-4 text-muted-foreground" />
        <span>{timeline.length} 天</span>
      </div>
      <div className="flex items-center gap-2">
        <TrendingUp className="h-4 w-4 text-green-500" />
        <span>{totals.improved} 改善</span>
      </div>
      <div className="flex items-center gap-2">
        <TrendingDown className="h-4 w-4 text-red-500" />
        <span>{totals.regressed} 惡化</span>
      </div>
    </div>
  )
}

// ============================================================
// Component
// ============================================================

/**
 * 影響分析時間軸
 *
 * @example
 * ```tsx
 * <ImpactTimeline timeline={data.timeline} />
 * ```
 */
export function ImpactTimeline({ timeline, className }: ImpactTimelineProps) {
  const maxValue = getMaxValue(timeline)

  if (timeline.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Calendar className="h-5 w-5 text-muted-foreground" />
            時間趨勢
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <Calendar className="h-8 w-8 mb-2" />
            <p>無時間軸數據</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Calendar className="h-5 w-5 text-muted-foreground" />
            時間趨勢（最近 {timeline.length} 天）
          </CardTitle>
          <Legend />
        </div>
      </CardHeader>
      <CardContent>
        {/* Timeline Chart */}
        <div className="flex items-end gap-1 overflow-x-auto pb-2 min-h-[100px]">
          {timeline.map((item) => (
            <TimelineBar key={item.date} item={item} maxValue={maxValue} />
          ))}
        </div>
        {/* Summary */}
        <div className="mt-4 pt-4 border-t">
          <TimelineSummary timeline={timeline} />
        </div>
      </CardContent>
    </Card>
  )
}
