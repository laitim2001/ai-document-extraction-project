'use client'

/**
 * @fileoverview GlobalStats 全局統計組件
 * @description
 *   顯示全局統計摘要卡片：
 *   - 總處理量
 *   - 成功率
 *   - 平均信心度
 *   - 活躍城市/用戶數
 *
 * @module src/components/features/global/GlobalStats
 * @author Development Team
 * @since Epic 6 - Story 6.4 (Global Admin Full Access)
 * @lastModified 2025-12-19
 *
 * @features
 *   - 全局統計卡片
 *   - 數據即時更新
 *   - 趨勢指示
 *
 * @dependencies
 *   - @tanstack/react-query - 數據獲取
 *   - lucide-react - 圖標
 *
 * @related
 *   - src/app/(dashboard)/global/page.tsx - 全局儀表板頁面
 *   - src/app/api/analytics/global/route.ts - 全局分析 API
 */

import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  FileText,
  CheckCircle2,
  Target,
  Building2,
  Users,
  TrendingUp,
} from 'lucide-react'

// ============================================================
// Types
// ============================================================

interface GlobalStatsData {
  totalDocuments: number
  processedDocuments: number
  successRate: number
  averageConfidence: number
  activeCities: number
  activeUsers: number
}

interface GlobalStatsProps {
  /** 時間週期 */
  period?: '7d' | '30d' | '90d' | '1y'
}

// ============================================================
// Component
// ============================================================

/**
 * @component GlobalStats
 * @description 顯示全局統計摘要的卡片組件
 */
export function GlobalStats({ period = '30d' }: GlobalStatsProps) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['global-analytics', period],
    queryFn: async () => {
      const response = await fetch(`/api/analytics/global?period=${period}`)
      if (!response.ok) {
        throw new Error('Failed to fetch global analytics')
      }
      return response.json()
    },
  })

  if (isLoading) {
    return <GlobalStatsSkeleton />
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-600">
        載入統計數據時發生錯誤
      </div>
    )
  }

  const stats: GlobalStatsData = data?.data?.global || {
    totalDocuments: 0,
    processedDocuments: 0,
    successRate: 0,
    averageConfidence: 0,
    activeCities: 0,
    activeUsers: 0,
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {/* 總處理量 */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">總處理量</CardTitle>
          <FileText className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {stats.totalDocuments.toLocaleString()}
          </div>
          <p className="text-xs text-muted-foreground">
            期間內處理的文件總數
          </p>
        </CardContent>
      </Card>

      {/* 已完成 */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">已完成</CardTitle>
          <CheckCircle2 className="h-4 w-4 text-green-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {stats.processedDocuments.toLocaleString()}
          </div>
          <p className="text-xs text-muted-foreground">
            成功處理的文件數
          </p>
        </CardContent>
      </Card>

      {/* 成功率 */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">成功率</CardTitle>
          <TrendingUp className="h-4 w-4 text-blue-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {(stats.successRate * 100).toFixed(1)}%
          </div>
          <p className="text-xs text-muted-foreground">
            處理完成比例
          </p>
        </CardContent>
      </Card>

      {/* 平均信心度 */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">平均信心度</CardTitle>
          <Target className="h-4 w-4 text-purple-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {(stats.averageConfidence * 100).toFixed(1)}%
          </div>
          <p className="text-xs text-muted-foreground">
            AI 分類信心度
          </p>
        </CardContent>
      </Card>

      {/* 活躍城市 */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">活躍城市</CardTitle>
          <Building2 className="h-4 w-4 text-orange-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.activeCities}</div>
          <p className="text-xs text-muted-foreground">
            啟用中的城市數
          </p>
        </CardContent>
      </Card>

      {/* 活躍用戶 */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">活躍用戶</CardTitle>
          <Users className="h-4 w-4 text-cyan-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.activeUsers}</div>
          <p className="text-xs text-muted-foreground">
            期間內登入的用戶
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

/**
 * 載入骨架組件
 */
function GlobalStatsSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {Array.from({ length: 6 }).map((_, i) => (
        <Card key={i}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-4" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-8 w-24 mb-2" />
            <Skeleton className="h-3 w-32" />
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
