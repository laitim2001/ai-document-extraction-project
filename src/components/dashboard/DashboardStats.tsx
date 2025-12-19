'use client'

/**
 * @fileoverview 儀表板統計容器組件
 * @description
 *   整合 React Query 獲取儀表板統計數據：
 *   - 自動刷新（5 分鐘）
 *   - 手動刷新按鈕
 *   - 錯誤處理與重試
 *   - 5 個關鍵指標卡片
 *
 * @module src/components/dashboard/DashboardStats
 * @author Development Team
 * @since Epic 7 - Story 7.1 (Processing Statistics Dashboard)
 * @lastModified 2025-12-19
 *
 * @features
 *   - 處理量統計（今日/本週/本月）
 *   - 成功率與自動化率
 *   - 平均處理時間
 *   - 待審核數量（含緊急）
 *
 * @dependencies
 *   - @tanstack/react-query - 數據獲取
 *   - date-fns - 時間格式化
 *   - lucide-react - 圖示
 *
 * @related
 *   - src/components/dashboard/StatCard.tsx - 統計卡片
 *   - src/app/api/dashboard/statistics/route.ts - 統計 API
 *   - src/types/dashboard.ts - 類型定義
 */

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { formatDistanceToNow } from 'date-fns'
import { zhTW } from 'date-fns/locale'
import { RefreshCw, FileText, CheckCircle, Zap, Clock, AlertTriangle } from 'lucide-react'
import { StatCard } from './StatCard'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { cn } from '@/lib/utils'
import type { DashboardStatistics, DashboardStatisticsResponse } from '@/types/dashboard'

// ============================================================
// API Functions
// ============================================================

/**
 * 獲取儀表板統計數據
 */
async function fetchDashboardStats(): Promise<DashboardStatistics> {
  const response = await fetch('/api/dashboard/statistics')

  if (!response.ok) {
    throw new Error('Failed to fetch statistics')
  }

  const result: DashboardStatisticsResponse = await response.json()

  if (!result.success || !result.data) {
    throw new Error(result.error || 'Unknown error')
  }

  return result.data
}

// ============================================================
// Utility Functions
// ============================================================

/**
 * 格式化數字（千分位）
 */
function formatNumber(num: number): string {
  return new Intl.NumberFormat('zh-TW').format(num)
}

// ============================================================
// Component
// ============================================================

/**
 * 儀表板統計組件
 *
 * @description
 *   顯示 5 個關鍵業務指標卡片：
 *   1. 本月處理量
 *   2. 成功率
 *   3. 自動化率
 *   4. 平均處理時間
 *   5. 待審核數量
 */
export function DashboardStats() {
  const { data, isLoading, isError, error, refetch, isFetching, dataUpdatedAt } = useQuery({
    queryKey: ['dashboard-statistics'],
    queryFn: fetchDashboardStats,
    refetchInterval: 5 * 60 * 1000, // 每 5 分鐘自動刷新
    staleTime: 60 * 1000, // 1 分鐘內視為新鮮數據
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  })

  // ============================================================
  // Error State
  // ============================================================

  if (isError && !data) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          無法載入統計數據：{(error as Error).message}
          <Button variant="link" size="sm" onClick={() => refetch()} className="ml-2">
            重試
          </Button>
        </AlertDescription>
      </Alert>
    )
  }

  // ============================================================
  // Render
  // ============================================================

  return (
    <div className="space-y-4">
      {/* 標題與刷新按鈕 */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">處理統計</h2>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {dataUpdatedAt && (
            <span>
              最後更新：
              {formatDistanceToNow(dataUpdatedAt, {
                addSuffix: true,
                locale: zhTW,
              })}
            </span>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            aria-label="刷新統計數據"
          >
            <RefreshCw className={cn('h-4 w-4', isFetching && 'animate-spin')} />
          </Button>
        </div>
      </div>

      {/* 指標卡片網格 */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        {/* 本月處理量 */}
        <StatCard
          title="本月處理量"
          value={formatNumber(data?.processingVolume?.thisMonth ?? 0)}
          subtitle={`今日 ${formatNumber(data?.processingVolume?.today ?? 0)}`}
          trend={data?.processingVolume?.trend}
          trendValue={`${data?.processingVolume?.trendPercentage?.toFixed(1) ?? 0}%`}
          icon={<FileText className="h-4 w-4" />}
          loading={isLoading}
        />

        {/* 成功率 */}
        <StatCard
          title="成功率"
          value={`${data?.successRate?.value?.toFixed(1) ?? 0}%`}
          trend={data?.successRate?.trend}
          trendValue={`${data?.successRate?.trendPercentage?.toFixed(1) ?? 0}%`}
          icon={<CheckCircle className="h-4 w-4" />}
          loading={isLoading}
          variant={
            data?.successRate?.value !== undefined
              ? data.successRate.value >= 95
                ? 'success'
                : data.successRate.value < 80
                  ? 'danger'
                  : 'default'
              : 'default'
          }
        />

        {/* 自動化率 */}
        <StatCard
          title="自動化率"
          value={`${data?.automationRate?.value?.toFixed(1) ?? 0}%`}
          trend={data?.automationRate?.trend}
          trendValue={`${data?.automationRate?.trendPercentage?.toFixed(1) ?? 0}%`}
          icon={<Zap className="h-4 w-4" />}
          loading={isLoading}
        />

        {/* 平均處理時間 */}
        <StatCard
          title="平均處理時間"
          value={data?.averageProcessingTime?.formatted ?? '—'}
          trend={data?.averageProcessingTime?.trend}
          trendValue={`${data?.averageProcessingTime?.trendPercentage?.toFixed(1) ?? 0}%`}
          icon={<Clock className="h-4 w-4" />}
          loading={isLoading}
        />

        {/* 待審核 */}
        <StatCard
          title="待審核"
          value={formatNumber(data?.pendingReview?.count ?? 0)}
          subtitle={
            data?.pendingReview?.urgent && data.pendingReview.urgent > 0
              ? `${data.pendingReview.urgent} 緊急`
              : undefined
          }
          icon={<AlertTriangle className="h-4 w-4" />}
          loading={isLoading}
          variant={
            data?.pendingReview?.urgent && data.pendingReview.urgent > 0 ? 'warning' : 'default'
          }
        />
      </div>
    </div>
  )
}
