'use client'

/**
 * @fileoverview 統計卡片組件
 * @description
 *   顯示儀表板關鍵指標數值和趨勢：
 *   - 主要數值顯示
 *   - 趨勢指示（上升/下降/持平）
 *   - Skeleton 載入狀態
 *   - 多種變體樣式（default/success/warning/danger）
 *
 * @module src/components/dashboard/StatCard
 * @author Development Team
 * @since Epic 7 - Story 7.1 (Processing Statistics Dashboard)
 * @lastModified 2025-12-19
 *
 * @dependencies
 *   - @/components/ui/card - shadcn/ui 卡片
 *   - @/components/ui/skeleton - 骨架屏
 *   - lucide-react - 圖示
 *
 * @related
 *   - src/types/dashboard.ts - 類型定義
 *   - src/components/dashboard/DashboardStats.tsx - 容器組件
 */

import * as React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { StatCardProps } from '@/types/dashboard'

// ============================================================
// StatCard Component
// ============================================================

/**
 * 統計卡片組件
 *
 * @description
 *   用於儀表板顯示關鍵業務指標。
 *   支援載入狀態、趨勢指示和多種變體樣式。
 *
 * @param props - StatCardProps
 * @returns React 組件
 *
 * @example
 *   <StatCard
 *     title="今日處理量"
 *     value="1,234"
 *     subtitle="本週: 8,567"
 *     trend="up"
 *     trendValue="+12.5%"
 *     icon={<FileText className="h-4 w-4" />}
 *   />
 */
export function StatCard({
  title,
  value,
  subtitle,
  trend,
  trendValue,
  icon,
  loading = false,
  variant = 'default',
  onClick,
  className,
}: StatCardProps) {
  // ============================================================
  // Skeleton Loading State
  // ============================================================

  if (loading) {
    return (
      <Card className={cn('transition-all duration-300', className)}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-4 rounded" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-8 w-20 mb-1" />
          <Skeleton className="h-3 w-16" />
        </CardContent>
      </Card>
    )
  }

  // ============================================================
  // Trend Styling
  // ============================================================

  // 趨勢圖示選擇
  const TrendIcon =
    trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus

  // 趨勢顏色
  const trendColor =
    trend === 'up'
      ? 'text-green-600 dark:text-green-400'
      : trend === 'down'
        ? 'text-red-600 dark:text-red-400'
        : 'text-gray-500 dark:text-gray-400'

  // ============================================================
  // Variant Styling
  // ============================================================

  const variantStyles: Record<NonNullable<StatCardProps['variant']>, string> = {
    default: '',
    success: 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950',
    warning: 'border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950',
    danger: 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950',
  }

  // ============================================================
  // Render
  // ============================================================

  return (
    <Card
      className={cn(
        'transition-all duration-300',
        variantStyles[variant],
        onClick && 'cursor-pointer hover:shadow-md',
        className
      )}
      onClick={onClick}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        {icon && <div className="text-muted-foreground h-4 w-4">{icon}</div>}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {(subtitle || trend) && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
            {trend && trendValue && (
              <span className={cn('flex items-center gap-0.5', trendColor)}>
                <TrendIcon className="h-3 w-3" />
                {trendValue}
              </span>
            )}
            {subtitle && <span>{subtitle}</span>}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ============================================================
// StatCardSkeleton Component
// ============================================================

/**
 * StatCard 骨架屏組件
 *
 * @description
 *   獨立的骨架屏組件，用於批量顯示載入狀態。
 */
export function StatCardSkeleton({ className }: { className?: string }) {
  return (
    <Card className={cn('transition-all duration-300', className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-4 rounded" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-8 w-20 mb-1" />
        <Skeleton className="h-3 w-16" />
      </CardContent>
    </Card>
  )
}
