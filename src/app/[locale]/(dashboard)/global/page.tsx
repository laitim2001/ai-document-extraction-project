'use client'

/**
 * @fileoverview 全局管理儀表板頁面
 * @description
 *   全局管理者專用儀表板：
 *   - 全系統統計概覽
 *   - 區域績效分析
 *   - 城市排行榜
 *   - 趨勢分析圖表
 *   - 僅限全局管理者訪問
 *
 * @module src/app/(dashboard)/global/page
 * @author Development Team
 * @since Epic 6 - Story 6.4 (Global Admin Full Access)
 * @lastModified 2025-12-19
 *
 * @features
 *   - 全局統計摘要
 *   - 區域績效視圖
 *   - 城市排名展示
 *   - 趨勢分析圖表
 *   - 權限保護
 *
 * @dependencies
 *   - @tanstack/react-query - 數據獲取
 *   - lucide-react - 圖標
 *
 * @related
 *   - src/components/features/global/ - 全局組件
 *   - src/app/api/analytics/global/route.ts - 全局分析 API
 */

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { redirect } from 'next/navigation'
import {
  GlobalStats,
  RegionView,
  CityRankings,
  GlobalTrend,
} from '@/components/features/global'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Globe, Map, Trophy } from 'lucide-react'

// ============================================================
// Types
// ============================================================

type PeriodType = '7d' | '30d' | '90d' | '1y'

// ============================================================
// Page Component
// ============================================================

/**
 * @page GlobalDashboard
 * @description 全局管理者儀表板頁面
 */
export default function GlobalDashboardPage() {
  const { data: session, status } = useSession()
  const [period, setPeriod] = useState<PeriodType>('30d')

  // 載入中
  if (status === 'loading') {
    return <GlobalDashboardSkeleton />
  }

  // 未認證 - 重定向到登入
  if (!session?.user) {
    redirect('/login')
  }

  // 非全局管理者 - 重定向到儀表板
  if (!session.user.isGlobalAdmin) {
    redirect('/dashboard')
  }

  return (
    <div className="space-y-6">
      {/* 頁面標題 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Globe className="h-8 w-8 text-blue-600" />
            全局管理儀表板
          </h1>
          <p className="text-muted-foreground mt-1">
            跨區域、跨城市的全系統績效監控
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Select
            value={period}
            onValueChange={(v) => setPeriod(v as PeriodType)}
          >
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">最近 7 天</SelectItem>
              <SelectItem value="30d">最近 30 天</SelectItem>
              <SelectItem value="90d">最近 90 天</SelectItem>
              <SelectItem value="1y">過去一年</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* 全局統計卡片 */}
      <GlobalStats period={period} />

      {/* 趨勢分析 */}
      <GlobalTrend initialPeriod={period === '1y' ? '90d' : period} />

      {/* 標籤頁內容 */}
      <Tabs defaultValue="regions" className="space-y-4">
        <TabsList>
          <TabsTrigger value="regions" className="flex items-center gap-2">
            <Map className="h-4 w-4" />
            區域績效
          </TabsTrigger>
          <TabsTrigger value="rankings" className="flex items-center gap-2">
            <Trophy className="h-4 w-4" />
            城市排行
          </TabsTrigger>
        </TabsList>

        <TabsContent value="regions">
          <RegionView />
        </TabsContent>

        <TabsContent value="rankings">
          <CityRankings period={period === '1y' ? '90d' : period} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

// ============================================================
// Skeleton Component
// ============================================================

/**
 * 載入骨架組件
 */
function GlobalDashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="h-9 w-64 bg-muted rounded animate-pulse" />
          <div className="h-5 w-48 bg-muted rounded animate-pulse mt-2" />
        </div>
        <div className="h-10 w-32 bg-muted rounded animate-pulse" />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-28 bg-muted rounded-lg animate-pulse" />
        ))}
      </div>

      <div className="h-[350px] bg-muted rounded-lg animate-pulse" />

      <div className="h-10 w-64 bg-muted rounded animate-pulse" />

      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-24 bg-muted rounded-lg animate-pulse" />
        ))}
      </div>
    </div>
  )
}
