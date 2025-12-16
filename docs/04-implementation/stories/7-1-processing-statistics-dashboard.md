# Story 7.1: 處理統計儀表板

**Status:** ready-for-dev

---

## Story

**As a** 用戶,
**I want** 查看處理統計儀表板,
**So that** 我可以了解整體處理狀況。

---

## Acceptance Criteria

### AC1: 關鍵指標卡片顯示

**Given** 用戶已登入
**When** 導航至「儀表板」頁面
**Then** 顯示關鍵指標卡片：
- 今日處理量 / 本週處理量 / 本月處理量
- 成功率（百分比）
- 自動化率（無需人工審核的比例）
- 平均處理時間
- 待審核數量

### AC2: 載入狀態與過渡

**Given** 儀表板頁面載入
**When** 數據正在載入
**Then** 顯示 Skeleton 載入狀態
**And** 載入完成後平滑過渡到實際數據

### AC3: 數據刷新機制

**Given** 儀表板頁面
**When** 數據有更新
**Then** 支援手動刷新按鈕
**And** 顯示最後更新時間

### AC4: 城市數據隔離

**Given** 城市用戶查看儀表板
**When** 載入統計數據
**Then** 僅顯示該用戶有權訪問的城市數據
**And** 區域經理可以看到跨城市匯總

---

## Tasks / Subtasks

- [ ] **Task 1: 儀表板 API 設計** (AC: #1, #4)
  - [ ] 1.1 創建 `GET /api/dashboard/statistics` 端點
  - [ ] 1.2 實現城市過濾邏輯
  - [ ] 1.3 計算處理量統計（日/週/月）
  - [ ] 1.4 計算成功率和自動化率
  - [ ] 1.5 計算平均處理時間
  - [ ] 1.6 查詢待審核數量

- [ ] **Task 2: 統計計算服務** (AC: #1)
  - [ ] 2.1 創建 `DashboardStatisticsService`
  - [ ] 2.2 實現時間範圍聚合查詢
  - [ ] 2.3 實現百分比計算邏輯
  - [ ] 2.4 添加結果快取（Redis）
  - [ ] 2.5 處理邊界情況（無數據時顯示 0）

- [ ] **Task 3: 指標卡片組件** (AC: #1, #2)
  - [ ] 3.1 創建 `StatCard` 基礎組件
  - [ ] 3.2 實現數值格式化（千分位、百分比）
  - [ ] 3.3 添加趨勢指示器（上升/下降箭頭）
  - [ ] 3.4 實現 Skeleton 載入狀態
  - [ ] 3.5 添加載入完成過渡動畫

- [ ] **Task 4: 儀表板頁面** (AC: #1-4)
  - [ ] 4.1 創建 `/dashboard` 頁面路由
  - [ ] 4.2 實現指標卡片網格佈局
  - [ ] 4.3 添加響應式設計
  - [ ] 4.4 整合城市過濾邏輯
  - [ ] 4.5 實現數據載入狀態管理

- [ ] **Task 5: 刷新機制** (AC: #3)
  - [ ] 5.1 添加手動刷新按鈕
  - [ ] 5.2 顯示最後更新時間戳
  - [ ] 5.3 實現自動刷新間隔（可配置）
  - [ ] 5.4 刷新時顯示載入指示器
  - [ ] 5.5 處理刷新失敗情況

- [ ] **Task 6: 測試與驗證** (AC: #1-4)
  - [ ] 6.1 單元測試統計計算邏輯
  - [ ] 6.2 API 端點測試
  - [ ] 6.3 組件渲染測試
  - [ ] 6.4 城市隔離測試
  - [ ] 6.5 效能測試（大數據量）

---

## Dev Notes

### 依賴項

- **Story 6.2**: 城市用戶數據訪問控制（城市過濾邏輯）
- **Story 2.7**: 處理狀態追蹤（狀態數據來源）

### Architecture Compliance

```typescript
// src/types/dashboard.ts
export interface DashboardStatistics {
  processingVolume: {
    today: number
    thisWeek: number
    thisMonth: number
    trend: 'up' | 'down' | 'stable'
    trendPercentage: number
  }
  successRate: {
    value: number  // 0-100
    trend: 'up' | 'down' | 'stable'
    trendPercentage: number
  }
  automationRate: {
    value: number  // 0-100 (無需人工審核的比例)
    trend: 'up' | 'down' | 'stable'
    trendPercentage: number
  }
  averageProcessingTime: {
    value: number  // 秒
    formatted: string  // "2m 30s"
    trend: 'up' | 'down' | 'stable'
    trendPercentage: number
  }
  pendingReview: {
    count: number
    urgent: number  // 超過 24 小時未處理
  }
  lastUpdated: string  // ISO timestamp
}

export interface StatisticsQueryParams {
  cityCodes?: string[]
  startDate?: string
  endDate?: string
}
```

```typescript
// src/services/dashboard-statistics.service.ts
import { prisma } from '@/lib/prisma'
import { redis } from '@/lib/redis'
import { CityFilter, buildCityWhereClause } from '@/middleware/city-filter'

export class DashboardStatisticsService {
  private readonly CACHE_TTL = 60 * 5 // 5 分鐘快取

  async getStatistics(
    cityFilter: CityFilter,
    params?: StatisticsQueryParams
  ): Promise<DashboardStatistics> {
    const cacheKey = this.buildCacheKey(cityFilter, params)

    // 嘗試從快取獲取
    const cached = await redis.get(cacheKey)
    if (cached) {
      return JSON.parse(cached)
    }

    const cityWhere = buildCityWhereClause(cityFilter)
    const now = new Date()

    // 並行查詢所有統計數據
    const [
      processingVolume,
      successRate,
      automationRate,
      avgProcessingTime,
      pendingReview
    ] = await Promise.all([
      this.getProcessingVolume(cityWhere, now),
      this.getSuccessRate(cityWhere, now),
      this.getAutomationRate(cityWhere, now),
      this.getAverageProcessingTime(cityWhere, now),
      this.getPendingReviewCount(cityWhere)
    ])

    const statistics: DashboardStatistics = {
      processingVolume,
      successRate,
      automationRate,
      averageProcessingTime: avgProcessingTime,
      pendingReview,
      lastUpdated: now.toISOString()
    }

    // 寫入快取
    await redis.set(cacheKey, JSON.stringify(statistics), 'EX', this.CACHE_TTL)

    return statistics
  }

  private async getProcessingVolume(
    cityWhere: Record<string, unknown>,
    now: Date
  ) {
    const todayStart = new Date(now)
    todayStart.setHours(0, 0, 0, 0)

    const weekStart = new Date(now)
    weekStart.setDate(weekStart.getDate() - weekStart.getDay())
    weekStart.setHours(0, 0, 0, 0)

    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

    const [today, thisWeek, thisMonth, lastMonth] = await Promise.all([
      prisma.document.count({
        where: {
          ...cityWhere,
          status: { in: ['COMPLETED', 'APPROVED'] },
          processedAt: { gte: todayStart }
        }
      }),
      prisma.document.count({
        where: {
          ...cityWhere,
          status: { in: ['COMPLETED', 'APPROVED'] },
          processedAt: { gte: weekStart }
        }
      }),
      prisma.document.count({
        where: {
          ...cityWhere,
          status: { in: ['COMPLETED', 'APPROVED'] },
          processedAt: { gte: monthStart }
        }
      }),
      prisma.document.count({
        where: {
          ...cityWhere,
          status: { in: ['COMPLETED', 'APPROVED'] },
          processedAt: {
            gte: new Date(now.getFullYear(), now.getMonth() - 1, 1),
            lt: monthStart
          }
        }
      })
    ])

    const trendPercentage = lastMonth > 0
      ? ((thisMonth - lastMonth) / lastMonth) * 100
      : 0

    return {
      today,
      thisWeek,
      thisMonth,
      trend: trendPercentage > 0 ? 'up' : trendPercentage < 0 ? 'down' : 'stable',
      trendPercentage: Math.abs(trendPercentage)
    }
  }

  private async getSuccessRate(
    cityWhere: Record<string, unknown>,
    now: Date
  ) {
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

    const [total, successful] = await Promise.all([
      prisma.document.count({
        where: {
          ...cityWhere,
          processedAt: { gte: monthStart }
        }
      }),
      prisma.document.count({
        where: {
          ...cityWhere,
          status: { in: ['COMPLETED', 'APPROVED'] },
          processedAt: { gte: monthStart }
        }
      })
    ])

    const value = total > 0 ? (successful / total) * 100 : 0

    return {
      value: Math.round(value * 10) / 10,
      trend: 'stable' as const,
      trendPercentage: 0
    }
  }

  private async getAutomationRate(
    cityWhere: Record<string, unknown>,
    now: Date
  ) {
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

    const [total, autoApproved] = await Promise.all([
      prisma.document.count({
        where: {
          ...cityWhere,
          status: { in: ['COMPLETED', 'APPROVED'] },
          processedAt: { gte: monthStart }
        }
      }),
      prisma.document.count({
        where: {
          ...cityWhere,
          status: 'APPROVED',
          autoApproved: true,
          processedAt: { gte: monthStart }
        }
      })
    ])

    const value = total > 0 ? (autoApproved / total) * 100 : 0

    return {
      value: Math.round(value * 10) / 10,
      trend: 'stable' as const,
      trendPercentage: 0
    }
  }

  private async getAverageProcessingTime(
    cityWhere: Record<string, unknown>,
    now: Date
  ) {
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

    const result = await prisma.document.aggregate({
      where: {
        ...cityWhere,
        status: { in: ['COMPLETED', 'APPROVED'] },
        processedAt: { gte: monthStart },
        processingDuration: { not: null }
      },
      _avg: {
        processingDuration: true
      }
    })

    const avgSeconds = result._avg.processingDuration || 0

    return {
      value: Math.round(avgSeconds),
      formatted: this.formatDuration(avgSeconds),
      trend: 'stable' as const,
      trendPercentage: 0
    }
  }

  private async getPendingReviewCount(cityWhere: Record<string, unknown>) {
    const urgentThreshold = new Date()
    urgentThreshold.setHours(urgentThreshold.getHours() - 24)

    const [total, urgent] = await Promise.all([
      prisma.document.count({
        where: {
          ...cityWhere,
          status: 'PENDING_REVIEW'
        }
      }),
      prisma.document.count({
        where: {
          ...cityWhere,
          status: 'PENDING_REVIEW',
          createdAt: { lt: urgentThreshold }
        }
      })
    ])

    return { count: total, urgent }
  }

  private formatDuration(seconds: number): string {
    if (seconds < 60) return `${Math.round(seconds)}s`
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = Math.round(seconds % 60)
    return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`
  }

  private buildCacheKey(
    cityFilter: CityFilter,
    params?: StatisticsQueryParams
  ): string {
    const cityPart = cityFilter.isGlobalAdmin
      ? 'global'
      : cityFilter.cityCodes.sort().join(',')
    const datePart = params?.startDate && params?.endDate
      ? `${params.startDate}_${params.endDate}`
      : 'default'
    return `dashboard:stats:${cityPart}:${datePart}`
  }
}

export const dashboardStatisticsService = new DashboardStatisticsService()
```

```typescript
// src/app/api/dashboard/statistics/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { withCityFilter, CityFilter } from '@/middleware/city-filter'
import { dashboardStatisticsService } from '@/services/dashboard-statistics.service'

export async function GET(request: NextRequest) {
  return withCityFilter(request, async (req, cityFilter) => {
    try {
      const { searchParams } = new URL(req.url)

      const params = {
        startDate: searchParams.get('startDate') || undefined,
        endDate: searchParams.get('endDate') || undefined,
        cityCodes: searchParams.get('cityCodes')?.split(',') || undefined
      }

      // 驗證城市訪問權限
      if (params.cityCodes && !cityFilter.isGlobalAdmin) {
        const invalidCities = params.cityCodes.filter(
          code => !cityFilter.cityCodes.includes(code)
        )
        if (invalidCities.length > 0) {
          return NextResponse.json(
            { success: false, error: 'Access denied to some cities' },
            { status: 403 }
          )
        }
      }

      const statistics = await dashboardStatisticsService.getStatistics(
        cityFilter,
        params
      )

      return NextResponse.json({
        success: true,
        data: statistics
      })
    } catch (error) {
      console.error('Dashboard statistics error:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch statistics' },
        { status: 500 }
      )
    }
  })
}
```

```typescript
// src/components/dashboard/StatCard.tsx
'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'

interface StatCardProps {
  title: string
  value: string | number
  subtitle?: string
  trend?: 'up' | 'down' | 'stable'
  trendValue?: string
  icon?: React.ReactNode
  loading?: boolean
  variant?: 'default' | 'success' | 'warning' | 'danger'
}

export function StatCard({
  title,
  value,
  subtitle,
  trend,
  trendValue,
  icon,
  loading = false,
  variant = 'default'
}: StatCardProps) {
  if (loading) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-4" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-8 w-20 mb-1" />
          <Skeleton className="h-3 w-16" />
        </CardContent>
      </Card>
    )
  }

  const TrendIcon = trend === 'up'
    ? TrendingUp
    : trend === 'down'
      ? TrendingDown
      : Minus

  const trendColor = trend === 'up'
    ? 'text-green-600'
    : trend === 'down'
      ? 'text-red-600'
      : 'text-gray-500'

  const variantStyles = {
    default: '',
    success: 'border-green-200 bg-green-50',
    warning: 'border-yellow-200 bg-yellow-50',
    danger: 'border-red-200 bg-red-50'
  }

  return (
    <Card className={cn('transition-all duration-300', variantStyles[variant])}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        {icon && <div className="text-muted-foreground">{icon}</div>}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {(subtitle || trend) && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
            {trend && (
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
```

```typescript
// src/components/dashboard/DashboardStats.tsx
'use client'

import { useQuery } from '@tanstack/react-query'
import { StatCard } from './StatCard'
import { Button } from '@/components/ui/button'
import { RefreshCw, FileText, CheckCircle, Zap, Clock, AlertTriangle } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { zhTW } from 'date-fns/locale'

async function fetchDashboardStats() {
  const response = await fetch('/api/dashboard/statistics')
  if (!response.ok) throw new Error('Failed to fetch statistics')
  const result = await response.json()
  return result.data
}

export function DashboardStats() {
  const { data, isLoading, refetch, isFetching, dataUpdatedAt } = useQuery({
    queryKey: ['dashboard-statistics'],
    queryFn: fetchDashboardStats,
    refetchInterval: 5 * 60 * 1000, // 每 5 分鐘自動刷新
    staleTime: 60 * 1000 // 1 分鐘內視為新鮮數據
  })

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('zh-TW').format(num)
  }

  return (
    <div className="space-y-4">
      {/* 標題與刷新 */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">處理統計</h2>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {dataUpdatedAt && (
            <span>
              最後更新：{formatDistanceToNow(dataUpdatedAt, {
                addSuffix: true,
                locale: zhTW
              })}
            </span>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <RefreshCw className={cn('h-4 w-4', isFetching && 'animate-spin')} />
          </Button>
        </div>
      </div>

      {/* 指標卡片網格 */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <StatCard
          title="本月處理量"
          value={formatNumber(data?.processingVolume?.thisMonth ?? 0)}
          subtitle={`今日 ${formatNumber(data?.processingVolume?.today ?? 0)}`}
          trend={data?.processingVolume?.trend}
          trendValue={`${data?.processingVolume?.trendPercentage?.toFixed(1)}%`}
          icon={<FileText className="h-4 w-4" />}
          loading={isLoading}
        />

        <StatCard
          title="成功率"
          value={`${data?.successRate?.value?.toFixed(1) ?? 0}%`}
          trend={data?.successRate?.trend}
          trendValue={`${data?.successRate?.trendPercentage?.toFixed(1)}%`}
          icon={<CheckCircle className="h-4 w-4" />}
          loading={isLoading}
          variant={data?.successRate?.value >= 95 ? 'success' : 'default'}
        />

        <StatCard
          title="自動化率"
          value={`${data?.automationRate?.value?.toFixed(1) ?? 0}%`}
          trend={data?.automationRate?.trend}
          trendValue={`${data?.automationRate?.trendPercentage?.toFixed(1)}%`}
          icon={<Zap className="h-4 w-4" />}
          loading={isLoading}
        />

        <StatCard
          title="平均處理時間"
          value={data?.averageProcessingTime?.formatted ?? '—'}
          trend={data?.averageProcessingTime?.trend}
          trendValue={`${data?.averageProcessingTime?.trendPercentage?.toFixed(1)}%`}
          icon={<Clock className="h-4 w-4" />}
          loading={isLoading}
        />

        <StatCard
          title="待審核"
          value={formatNumber(data?.pendingReview?.count ?? 0)}
          subtitle={data?.pendingReview?.urgent > 0
            ? `${data.pendingReview.urgent} 緊急`
            : undefined}
          icon={<AlertTriangle className="h-4 w-4" />}
          loading={isLoading}
          variant={data?.pendingReview?.urgent > 0 ? 'warning' : 'default'}
        />
      </div>
    </div>
  )
}
```

```typescript
// src/app/(dashboard)/dashboard/page.tsx
import { DashboardStats } from '@/components/dashboard/DashboardStats'
import { CityIndicator } from '@/components/layout/CityIndicator'

export default function DashboardPage() {
  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">儀表板</h1>
          <p className="text-muted-foreground">查看處理統計和系統狀態</p>
        </div>
        <CityIndicator />
      </div>

      <DashboardStats />

      {/* 更多儀表板區塊將在後續 Stories 添加 */}
    </div>
  )
}
```

### 效能考量

- **快取策略**: 使用 Redis 快取統計結果，TTL 5 分鐘
- **並行查詢**: 所有統計查詢並行執行，減少響應時間
- **增量計算**: 考慮使用預計算表格處理大量數據
- **客戶端快取**: React Query 提供客戶端快取和 stale-while-revalidate

### References

- [Source: docs/03-epics/sections/epic-7-reports-dashboard-cost-tracking.md#story-71]
- [Source: docs/01-planning/prd/sections/functional-requirements.md#FR30]

---

## Story Metadata

| 屬性 | 值 |
|------|------|
| Story ID | 7.1 |
| Story Key | 7-1-processing-statistics-dashboard |
| Epic | Epic 7: 報表儀表板與成本追蹤 |
| FR Coverage | FR30 |
| Dependencies | Story 6.2, Story 2.7 |

---

*Story created: 2025-12-16*
*Status: ready-for-dev*
