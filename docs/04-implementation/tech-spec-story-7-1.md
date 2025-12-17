# Tech Spec: Story 7.1 - Processing Statistics Dashboard

## Story Reference
- **Story ID**: 7.1
- **Story Title**: 處理統計儀表板
- **Epic**: Epic 7 - 報表儀表板與成本追蹤
- **Status**: Tech Spec Complete

---

## 1. Technical Overview

### 1.1 Purpose
建立處理統計儀表板，提供關鍵業務指標的即時可視化，包括處理量、成功率、自動化率、平均處理時間和待審核數量，並支援城市數據隔離和即時刷新機制。

### 1.2 Scope
- 儀表板統計 API 端點設計
- DashboardStatisticsService 服務層實現
- Redis 快取策略
- StatCard 組件與 Skeleton 載入狀態
- 響應式儀表板頁面佈局
- 手動/自動刷新機制
- 城市數據隔離整合

### 1.3 Dependencies
- **Story 6.2**: 城市用戶數據訪問控制
- **Story 2.7**: 處理狀態追蹤
- **Story 1.0**: 專案初始化（Prisma, Redis 配置）
- Redis Server (快取層)
- TanStack Query (客戶端狀態管理)

---

## 2. Database Schema

### 2.1 Related Models (Existing)

```prisma
// prisma/schema.prisma

// 現有 Document 模型 - 用於統計查詢
model Document {
  id                  String          @id @default(uuid())
  fileName            String          @map("file_name")
  cityCode            String          @map("city_code")
  status              DocumentStatus
  autoApproved        Boolean         @default(false) @map("auto_approved")
  processingDuration  Int?            @map("processing_duration")  // 秒
  processedAt         DateTime?       @map("processed_at")
  createdAt           DateTime        @default(now()) @map("created_at")
  updatedAt           DateTime        @updatedAt @map("updated_at")

  // Relations
  city                City            @relation(fields: [cityCode], references: [code])

  @@index([cityCode, status])
  @@index([cityCode, processedAt])
  @@index([status, processedAt])
  @@map("documents")
}

enum DocumentStatus {
  PENDING
  PROCESSING
  COMPLETED
  APPROVED
  PENDING_REVIEW
  REJECTED
  FAILED
}
```

### 2.2 Optimized Indexes for Dashboard Queries

```sql
-- prisma/migrations/XXXXXX_dashboard_indexes/migration.sql

-- 儀表板查詢優化索引
CREATE INDEX CONCURRENTLY idx_documents_dashboard_volume
    ON documents(city_code, status, processed_at)
    WHERE status IN ('COMPLETED', 'APPROVED');

CREATE INDEX CONCURRENTLY idx_documents_dashboard_pending
    ON documents(city_code, status, created_at)
    WHERE status = 'PENDING_REVIEW';

CREATE INDEX CONCURRENTLY idx_documents_processing_duration
    ON documents(city_code, processing_duration)
    WHERE processing_duration IS NOT NULL
    AND status IN ('COMPLETED', 'APPROVED');

-- 時間範圍統計的 BRIN 索引（對於大表更高效）
CREATE INDEX CONCURRENTLY idx_documents_processed_at_brin
    ON documents USING BRIN (processed_at)
    WHERE processed_at IS NOT NULL;
```

---

## 3. Type Definitions

### 3.1 Dashboard Statistics Types

```typescript
// src/types/dashboard.ts

/**
 * 趨勢方向
 */
export type TrendDirection = 'up' | 'down' | 'stable'

/**
 * 處理量統計
 */
export interface ProcessingVolume {
  today: number
  thisWeek: number
  thisMonth: number
  trend: TrendDirection
  trendPercentage: number
}

/**
 * 百分比指標（成功率、自動化率）
 */
export interface PercentageMetric {
  value: number  // 0-100
  trend: TrendDirection
  trendPercentage: number
}

/**
 * 處理時間指標
 */
export interface ProcessingTimeMetric {
  value: number  // 秒
  formatted: string  // "2m 30s" 格式
  trend: TrendDirection
  trendPercentage: number
}

/**
 * 待審核統計
 */
export interface PendingReviewMetric {
  count: number
  urgent: number  // 超過 24 小時未處理
}

/**
 * 儀表板統計數據
 */
export interface DashboardStatistics {
  processingVolume: ProcessingVolume
  successRate: PercentageMetric
  automationRate: PercentageMetric
  averageProcessingTime: ProcessingTimeMetric
  pendingReview: PendingReviewMetric
  lastUpdated: string  // ISO timestamp
}

/**
 * 統計查詢參數
 */
export interface StatisticsQueryParams {
  cityCodes?: string[]
  startDate?: string
  endDate?: string
}

/**
 * 統計 API 響應
 */
export interface DashboardStatisticsResponse {
  success: boolean
  data?: DashboardStatistics
  error?: string
}
```

### 3.2 StatCard Component Types

```typescript
// src/types/components/stat-card.ts

import { LucideIcon } from 'lucide-react'
import { TrendDirection } from '@/types/dashboard'

/**
 * StatCard 變體樣式
 */
export type StatCardVariant = 'default' | 'success' | 'warning' | 'danger'

/**
 * StatCard 組件屬性
 */
export interface StatCardProps {
  /** 卡片標題 */
  title: string
  /** 主要數值 */
  value: string | number
  /** 副標題（如今日數量） */
  subtitle?: string
  /** 趨勢方向 */
  trend?: TrendDirection
  /** 趨勢百分比顯示 */
  trendValue?: string
  /** 圖示組件 */
  icon?: React.ReactNode
  /** 載入狀態 */
  loading?: boolean
  /** 卡片變體樣式 */
  variant?: StatCardVariant
  /** 點擊處理 */
  onClick?: () => void
  /** 自定義 className */
  className?: string
}
```

---

## 4. Service Layer Implementation

### 4.1 Dashboard Statistics Service

```typescript
// src/services/dashboard-statistics.service.ts
import { prisma } from '@/lib/prisma'
import { redis } from '@/lib/redis'
import { CityFilter, buildCityWhereClause } from '@/middleware/city-filter'
import {
  DashboardStatistics,
  StatisticsQueryParams,
  ProcessingVolume,
  PercentageMetric,
  ProcessingTimeMetric,
  PendingReviewMetric,
  TrendDirection
} from '@/types/dashboard'

/**
 * 儀表板統計服務
 * 提供處理量、成功率、自動化率等關鍵指標的計算
 */
export class DashboardStatisticsService {
  private readonly CACHE_TTL = 60 * 5  // 5 分鐘快取
  private readonly CACHE_PREFIX = 'dashboard:stats'

  /**
   * 獲取儀表板統計數據
   * 支援快取和城市過濾
   */
  async getStatistics(
    cityFilter: CityFilter,
    params?: StatisticsQueryParams
  ): Promise<DashboardStatistics> {
    const cacheKey = this.buildCacheKey(cityFilter, params)

    // 嘗試從快取獲取
    const cached = await this.getFromCache(cacheKey)
    if (cached) {
      return cached
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
    await this.setToCache(cacheKey, statistics)

    return statistics
  }

  /**
   * 計算處理量統計（今日/本週/本月）
   */
  private async getProcessingVolume(
    cityWhere: Record<string, unknown>,
    now: Date
  ): Promise<ProcessingVolume> {
    // 計算時間範圍
    const todayStart = new Date(now)
    todayStart.setHours(0, 0, 0, 0)

    const weekStart = new Date(now)
    weekStart.setDate(weekStart.getDate() - weekStart.getDay())
    weekStart.setHours(0, 0, 0, 0)

    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)

    const completedStatus = { in: ['COMPLETED', 'APPROVED'] as const }

    // 並行查詢各時間範圍的處理量
    const [today, thisWeek, thisMonth, lastMonth] = await Promise.all([
      prisma.document.count({
        where: {
          ...cityWhere,
          status: completedStatus,
          processedAt: { gte: todayStart }
        }
      }),
      prisma.document.count({
        where: {
          ...cityWhere,
          status: completedStatus,
          processedAt: { gte: weekStart }
        }
      }),
      prisma.document.count({
        where: {
          ...cityWhere,
          status: completedStatus,
          processedAt: { gte: monthStart }
        }
      }),
      prisma.document.count({
        where: {
          ...cityWhere,
          status: completedStatus,
          processedAt: {
            gte: lastMonthStart,
            lt: monthStart
          }
        }
      })
    ])

    // 計算趨勢
    const { trend, trendPercentage } = this.calculateTrend(thisMonth, lastMonth)

    return {
      today,
      thisWeek,
      thisMonth,
      trend,
      trendPercentage
    }
  }

  /**
   * 計算成功率
   */
  private async getSuccessRate(
    cityWhere: Record<string, unknown>,
    now: Date
  ): Promise<PercentageMetric> {
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)

    // 本月數據
    const [totalThisMonth, successfulThisMonth] = await Promise.all([
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

    // 上月數據（用於趨勢計算）
    const [totalLastMonth, successfulLastMonth] = await Promise.all([
      prisma.document.count({
        where: {
          ...cityWhere,
          processedAt: { gte: lastMonthStart, lt: monthStart }
        }
      }),
      prisma.document.count({
        where: {
          ...cityWhere,
          status: { in: ['COMPLETED', 'APPROVED'] },
          processedAt: { gte: lastMonthStart, lt: monthStart }
        }
      })
    ])

    const currentRate = totalThisMonth > 0
      ? (successfulThisMonth / totalThisMonth) * 100
      : 0
    const lastRate = totalLastMonth > 0
      ? (successfulLastMonth / totalLastMonth) * 100
      : 0

    const { trend, trendPercentage } = this.calculateTrend(currentRate, lastRate)

    return {
      value: Math.round(currentRate * 10) / 10,
      trend,
      trendPercentage
    }
  }

  /**
   * 計算自動化率（無需人工審核的比例）
   */
  private async getAutomationRate(
    cityWhere: Record<string, unknown>,
    now: Date
  ): Promise<PercentageMetric> {
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)

    // 本月數據
    const [totalThisMonth, autoApprovedThisMonth] = await Promise.all([
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

    // 上月數據
    const [totalLastMonth, autoApprovedLastMonth] = await Promise.all([
      prisma.document.count({
        where: {
          ...cityWhere,
          status: { in: ['COMPLETED', 'APPROVED'] },
          processedAt: { gte: lastMonthStart, lt: monthStart }
        }
      }),
      prisma.document.count({
        where: {
          ...cityWhere,
          status: 'APPROVED',
          autoApproved: true,
          processedAt: { gte: lastMonthStart, lt: monthStart }
        }
      })
    ])

    const currentRate = totalThisMonth > 0
      ? (autoApprovedThisMonth / totalThisMonth) * 100
      : 0
    const lastRate = totalLastMonth > 0
      ? (autoApprovedLastMonth / totalLastMonth) * 100
      : 0

    const { trend, trendPercentage } = this.calculateTrend(currentRate, lastRate)

    return {
      value: Math.round(currentRate * 10) / 10,
      trend,
      trendPercentage
    }
  }

  /**
   * 計算平均處理時間
   */
  private async getAverageProcessingTime(
    cityWhere: Record<string, unknown>,
    now: Date
  ): Promise<ProcessingTimeMetric> {
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)

    // 本月平均
    const currentResult = await prisma.document.aggregate({
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

    // 上月平均
    const lastResult = await prisma.document.aggregate({
      where: {
        ...cityWhere,
        status: { in: ['COMPLETED', 'APPROVED'] },
        processedAt: { gte: lastMonthStart, lt: monthStart },
        processingDuration: { not: null }
      },
      _avg: {
        processingDuration: true
      }
    })

    const currentAvg = currentResult._avg.processingDuration || 0
    const lastAvg = lastResult._avg.processingDuration || 0

    // 處理時間下降是好事，所以趨勢邏輯相反
    const { trend, trendPercentage } = this.calculateTrend(
      lastAvg,  // 注意：參數順序相反
      currentAvg
    )

    return {
      value: Math.round(currentAvg),
      formatted: this.formatDuration(currentAvg),
      trend,
      trendPercentage
    }
  }

  /**
   * 獲取待審核數量
   */
  private async getPendingReviewCount(
    cityWhere: Record<string, unknown>
  ): Promise<PendingReviewMetric> {
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

  /**
   * 計算趨勢
   */
  private calculateTrend(
    current: number,
    previous: number
  ): { trend: TrendDirection; trendPercentage: number } {
    if (previous === 0) {
      return { trend: 'stable', trendPercentage: 0 }
    }

    const change = ((current - previous) / previous) * 100
    const trendPercentage = Math.abs(Math.round(change * 10) / 10)

    let trend: TrendDirection = 'stable'
    if (change > 1) trend = 'up'
    else if (change < -1) trend = 'down'

    return { trend, trendPercentage }
  }

  /**
   * 格式化時間長度
   */
  private formatDuration(seconds: number): string {
    if (seconds < 60) {
      return `${Math.round(seconds)}s`
    }
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = Math.round(seconds % 60)
    return remainingSeconds > 0
      ? `${minutes}m ${remainingSeconds}s`
      : `${minutes}m`
  }

  /**
   * 建構快取鍵
   */
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
    return `${this.CACHE_PREFIX}:${cityPart}:${datePart}`
  }

  /**
   * 從快取獲取數據
   */
  private async getFromCache(key: string): Promise<DashboardStatistics | null> {
    try {
      const cached = await redis.get(key)
      if (cached) {
        return JSON.parse(cached) as DashboardStatistics
      }
    } catch (error) {
      console.error('Cache read error:', error)
    }
    return null
  }

  /**
   * 寫入快取
   */
  private async setToCache(
    key: string,
    data: DashboardStatistics
  ): Promise<void> {
    try {
      await redis.set(key, JSON.stringify(data), 'EX', this.CACHE_TTL)
    } catch (error) {
      console.error('Cache write error:', error)
    }
  }

  /**
   * 清除儀表板快取
   * 用於數據變更時強制刷新
   */
  async invalidateCache(cityCode?: string): Promise<void> {
    try {
      if (cityCode) {
        // 清除特定城市的快取
        const keys = await redis.keys(`${this.CACHE_PREFIX}:*${cityCode}*`)
        if (keys.length > 0) {
          await redis.del(...keys)
        }
      } else {
        // 清除所有儀表板快取
        const keys = await redis.keys(`${this.CACHE_PREFIX}:*`)
        if (keys.length > 0) {
          await redis.del(...keys)
        }
      }
    } catch (error) {
      console.error('Cache invalidation error:', error)
    }
  }
}

// 導出單例實例
export const dashboardStatisticsService = new DashboardStatisticsService()
```

---

## 5. API Routes

### 5.1 Dashboard Statistics Endpoint

```typescript
// src/app/api/dashboard/statistics/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { withCityFilter, CityFilter } from '@/middleware/city-filter'
import { dashboardStatisticsService } from '@/services/dashboard-statistics.service'
import { DashboardStatisticsResponse } from '@/types/dashboard'

/**
 * GET /api/dashboard/statistics
 * 獲取儀表板統計數據
 */
export async function GET(request: NextRequest) {
  return withCityFilter(request, async (req, cityFilter) => {
    try {
      const { searchParams } = new URL(req.url)

      // 解析查詢參數
      const params = {
        startDate: searchParams.get('startDate') || undefined,
        endDate: searchParams.get('endDate') || undefined,
        cityCodes: searchParams.get('cityCodes')?.split(',').filter(Boolean) || undefined
      }

      // 驗證城市訪問權限
      if (params.cityCodes && !cityFilter.isGlobalAdmin) {
        const invalidCities = params.cityCodes.filter(
          code => !cityFilter.cityCodes.includes(code)
        )
        if (invalidCities.length > 0) {
          return NextResponse.json<DashboardStatisticsResponse>(
            {
              success: false,
              error: `Access denied to cities: ${invalidCities.join(', ')}`
            },
            { status: 403 }
          )
        }
      }

      // 獲取統計數據
      const statistics = await dashboardStatisticsService.getStatistics(
        cityFilter,
        params
      )

      return NextResponse.json<DashboardStatisticsResponse>({
        success: true,
        data: statistics
      })
    } catch (error) {
      console.error('Dashboard statistics error:', error)
      return NextResponse.json<DashboardStatisticsResponse>(
        {
          success: false,
          error: 'Failed to fetch statistics'
        },
        { status: 500 }
      )
    }
  })
}
```

### 5.2 Cache Invalidation Endpoint (Admin)

```typescript
// src/app/api/admin/dashboard/invalidate-cache/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { dashboardStatisticsService } from '@/services/dashboard-statistics.service'

/**
 * POST /api/admin/dashboard/invalidate-cache
 * 手動清除儀表板快取（僅管理員）
 */
export async function POST(request: NextRequest) {
  const session = await auth()

  if (!session?.user?.isGlobalAdmin) {
    return NextResponse.json(
      { success: false, error: 'Admin access required' },
      { status: 403 }
    )
  }

  try {
    const body = await request.json().catch(() => ({}))
    const { cityCode } = body as { cityCode?: string }

    await dashboardStatisticsService.invalidateCache(cityCode)

    return NextResponse.json({
      success: true,
      message: cityCode
        ? `Cache invalidated for city: ${cityCode}`
        : 'All dashboard cache invalidated'
    })
  } catch (error) {
    console.error('Cache invalidation error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to invalidate cache' },
      { status: 500 }
    )
  }
}
```

---

## 6. Frontend Components

### 6.1 StatCard Component

```typescript
// src/components/dashboard/StatCard.tsx
'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { StatCardProps } from '@/types/components/stat-card'

/**
 * 統計卡片組件
 * 顯示關鍵指標數值和趨勢
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
  className
}: StatCardProps) {
  // Skeleton 載入狀態
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

  // 趨勢圖示選擇
  const TrendIcon = trend === 'up'
    ? TrendingUp
    : trend === 'down'
      ? TrendingDown
      : Minus

  // 趨勢顏色
  const trendColor = trend === 'up'
    ? 'text-green-600 dark:text-green-400'
    : trend === 'down'
      ? 'text-red-600 dark:text-red-400'
      : 'text-gray-500 dark:text-gray-400'

  // 變體樣式
  const variantStyles = {
    default: '',
    success: 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950',
    warning: 'border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950',
    danger: 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950'
  }

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
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        {icon && (
          <div className="text-muted-foreground h-4 w-4">
            {icon}
          </div>
        )}
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
```

### 6.2 Dashboard Stats Container

```typescript
// src/components/dashboard/DashboardStats.tsx
'use client'

import { useQuery } from '@tanstack/react-query'
import { StatCard } from './StatCard'
import { Button } from '@/components/ui/button'
import {
  RefreshCw,
  FileText,
  CheckCircle,
  Zap,
  Clock,
  AlertTriangle
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { zhTW } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import { DashboardStatistics, DashboardStatisticsResponse } from '@/types/dashboard'
import { Alert, AlertDescription } from '@/components/ui/alert'

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

/**
 * 格式化數字（千分位）
 */
function formatNumber(num: number): string {
  return new Intl.NumberFormat('zh-TW').format(num)
}

/**
 * 儀表板統計組件
 */
export function DashboardStats() {
  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
    dataUpdatedAt
  } = useQuery({
    queryKey: ['dashboard-statistics'],
    queryFn: fetchDashboardStats,
    refetchInterval: 5 * 60 * 1000,  // 每 5 分鐘自動刷新
    staleTime: 60 * 1000,  // 1 分鐘內視為新鮮數據
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000)
  })

  // 錯誤狀態
  if (isError && !data) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          無法載入統計數據：{(error as Error).message}
          <Button
            variant="link"
            size="sm"
            onClick={() => refetch()}
            className="ml-2"
          >
            重試
          </Button>
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-4">
      {/* 標題與刷新按鈕 */}
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
          trendValue={`${data?.processingVolume?.trendPercentage?.toFixed(1)}%`}
          icon={<FileText className="h-4 w-4" />}
          loading={isLoading}
        />

        {/* 成功率 */}
        <StatCard
          title="成功率"
          value={`${data?.successRate?.value?.toFixed(1) ?? 0}%`}
          trend={data?.successRate?.trend}
          trendValue={`${data?.successRate?.trendPercentage?.toFixed(1)}%`}
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
          trendValue={`${data?.automationRate?.trendPercentage?.toFixed(1)}%`}
          icon={<Zap className="h-4 w-4" />}
          loading={isLoading}
        />

        {/* 平均處理時間 */}
        <StatCard
          title="平均處理時間"
          value={data?.averageProcessingTime?.formatted ?? '—'}
          trend={data?.averageProcessingTime?.trend}
          trendValue={`${data?.averageProcessingTime?.trendPercentage?.toFixed(1)}%`}
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
            data?.pendingReview?.urgent && data.pendingReview.urgent > 0
              ? 'warning'
              : 'default'
          }
        />
      </div>
    </div>
  )
}
```

### 6.3 Dashboard Page

```typescript
// src/app/(dashboard)/dashboard/page.tsx
import { Metadata } from 'next'
import { DashboardStats } from '@/components/dashboard/DashboardStats'
import { CityIndicator } from '@/components/layout/CityIndicator'
import { Suspense } from 'react'
import { Skeleton } from '@/components/ui/skeleton'

export const metadata: Metadata = {
  title: '儀表板 | AI 文件處理系統',
  description: '查看處理統計和系統狀態'
}

/**
 * 儀表板載入骨架
 */
function DashboardSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-6 w-24" />
        <Skeleton className="h-8 w-32" />
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-32" />
        ))}
      </div>
    </div>
  )
}

/**
 * 儀表板頁面
 */
export default function DashboardPage() {
  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* 頁面標題 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">儀表板</h1>
          <p className="text-muted-foreground">查看處理統計和系統狀態</p>
        </div>
        <CityIndicator />
      </div>

      {/* 統計卡片區塊 */}
      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardStats />
      </Suspense>

      {/* 預留空間：後續 Stories 將添加更多區塊 */}
      {/* - 時間範圍篩選 (Story 7.2) */}
      {/* - 處理趨勢圖表 (Story 7.x) */}
      {/* - AI 成本概覽 (Story 7.6) */}
    </div>
  )
}
```

### 6.4 React Query Provider Setup

```typescript
// src/providers/QueryProvider.tsx
'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { useState, ReactNode } from 'react'

interface QueryProviderProps {
  children: ReactNode
}

export function QueryProvider({ children }: QueryProviderProps) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,  // 1 分鐘
            gcTime: 5 * 60 * 1000,  // 5 分鐘（舊稱 cacheTime）
            refetchOnWindowFocus: false,
            retry: 2
          }
        }
      })
  )

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {process.env.NODE_ENV === 'development' && (
        <ReactQueryDevtools initialIsOpen={false} />
      )}
    </QueryClientProvider>
  )
}
```

---

## 7. Testing Strategy

### 7.1 Service Unit Tests

```typescript
// __tests__/services/dashboard-statistics.service.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { DashboardStatisticsService } from '@/services/dashboard-statistics.service'
import { prisma } from '@/lib/prisma'
import { redis } from '@/lib/redis'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    document: {
      count: vi.fn(),
      aggregate: vi.fn()
    }
  }
}))

vi.mock('@/lib/redis', () => ({
  redis: {
    get: vi.fn(),
    set: vi.fn(),
    keys: vi.fn(),
    del: vi.fn()
  }
}))

describe('DashboardStatisticsService', () => {
  let service: DashboardStatisticsService

  beforeEach(() => {
    service = new DashboardStatisticsService()
    vi.clearAllMocks()
  })

  describe('getStatistics', () => {
    const mockCityFilter = {
      isGlobalAdmin: false,
      cityCodes: ['HKG']
    }

    it('should return cached data if available', async () => {
      const cachedData = {
        processingVolume: { today: 10, thisWeek: 50, thisMonth: 200, trend: 'up', trendPercentage: 15 },
        successRate: { value: 95.5, trend: 'stable', trendPercentage: 0 },
        automationRate: { value: 80.2, trend: 'up', trendPercentage: 5 },
        averageProcessingTime: { value: 120, formatted: '2m', trend: 'down', trendPercentage: 10 },
        pendingReview: { count: 5, urgent: 1 },
        lastUpdated: '2025-01-01T00:00:00.000Z'
      }

      vi.mocked(redis.get).mockResolvedValue(JSON.stringify(cachedData))

      const result = await service.getStatistics(mockCityFilter)

      expect(result).toEqual(cachedData)
      expect(prisma.document.count).not.toHaveBeenCalled()
    })

    it('should fetch from database when cache is empty', async () => {
      vi.mocked(redis.get).mockResolvedValue(null)
      vi.mocked(prisma.document.count).mockResolvedValue(100)
      vi.mocked(prisma.document.aggregate).mockResolvedValue({
        _avg: { processingDuration: 120 }
      })

      const result = await service.getStatistics(mockCityFilter)

      expect(result).toBeDefined()
      expect(result.processingVolume).toBeDefined()
      expect(result.successRate).toBeDefined()
      expect(redis.set).toHaveBeenCalled()
    })

    it('should handle database errors gracefully', async () => {
      vi.mocked(redis.get).mockResolvedValue(null)
      vi.mocked(prisma.document.count).mockRejectedValue(new Error('DB Error'))

      await expect(service.getStatistics(mockCityFilter)).rejects.toThrow('DB Error')
    })
  })

  describe('calculateTrend', () => {
    it('should return "up" when current > previous', () => {
      // Access private method through type assertion
      const result = (service as any).calculateTrend(150, 100)
      expect(result.trend).toBe('up')
      expect(result.trendPercentage).toBe(50)
    })

    it('should return "down" when current < previous', () => {
      const result = (service as any).calculateTrend(80, 100)
      expect(result.trend).toBe('down')
      expect(result.trendPercentage).toBe(20)
    })

    it('should return "stable" when change is minimal', () => {
      const result = (service as any).calculateTrend(100, 100)
      expect(result.trend).toBe('stable')
    })

    it('should handle zero previous value', () => {
      const result = (service as any).calculateTrend(100, 0)
      expect(result.trend).toBe('stable')
      expect(result.trendPercentage).toBe(0)
    })
  })

  describe('formatDuration', () => {
    it('should format seconds only', () => {
      const result = (service as any).formatDuration(45)
      expect(result).toBe('45s')
    })

    it('should format minutes and seconds', () => {
      const result = (service as any).formatDuration(150)
      expect(result).toBe('2m 30s')
    })

    it('should format minutes only when no remainder', () => {
      const result = (service as any).formatDuration(120)
      expect(result).toBe('2m')
    })
  })
})
```

### 7.2 API Route Tests

```typescript
// __tests__/api/dashboard/statistics.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET } from '@/app/api/dashboard/statistics/route'
import { NextRequest } from 'next/server'
import { dashboardStatisticsService } from '@/services/dashboard-statistics.service'

vi.mock('@/services/dashboard-statistics.service', () => ({
  dashboardStatisticsService: {
    getStatistics: vi.fn()
  }
}))

vi.mock('@/middleware/city-filter', () => ({
  withCityFilter: vi.fn((req, handler) =>
    handler(req, { isGlobalAdmin: false, cityCodes: ['HKG'] })
  )
}))

describe('GET /api/dashboard/statistics', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return statistics successfully', async () => {
    const mockStats = {
      processingVolume: { today: 10, thisWeek: 50, thisMonth: 200, trend: 'up', trendPercentage: 15 },
      successRate: { value: 95.5, trend: 'stable', trendPercentage: 0 },
      automationRate: { value: 80.2, trend: 'up', trendPercentage: 5 },
      averageProcessingTime: { value: 120, formatted: '2m', trend: 'down', trendPercentage: 10 },
      pendingReview: { count: 5, urgent: 1 },
      lastUpdated: '2025-01-01T00:00:00.000Z'
    }

    vi.mocked(dashboardStatisticsService.getStatistics).mockResolvedValue(mockStats)

    const request = new NextRequest('http://localhost/api/dashboard/statistics')
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.data).toEqual(mockStats)
  })

  it('should return 403 for unauthorized city access', async () => {
    const request = new NextRequest(
      'http://localhost/api/dashboard/statistics?cityCodes=SIN,LON'
    )
    const response = await GET(request)

    expect(response.status).toBe(403)
  })
})
```

### 7.3 Component Tests

```typescript
// __tests__/components/dashboard/StatCard.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StatCard } from '@/components/dashboard/StatCard'

describe('StatCard', () => {
  it('renders title and value correctly', () => {
    render(
      <StatCard
        title="本月處理量"
        value="1,234"
      />
    )

    expect(screen.getByText('本月處理量')).toBeInTheDocument()
    expect(screen.getByText('1,234')).toBeInTheDocument()
  })

  it('shows skeleton when loading', () => {
    const { container } = render(
      <StatCard
        title="本月處理量"
        value="1,234"
        loading
      />
    )

    expect(container.querySelectorAll('[class*="skeleton"]').length).toBeGreaterThan(0)
  })

  it('displays trend indicator correctly', () => {
    render(
      <StatCard
        title="成功率"
        value="95.5%"
        trend="up"
        trendValue="5.2%"
      />
    )

    expect(screen.getByText('5.2%')).toBeInTheDocument()
  })

  it('applies variant styles correctly', () => {
    const { container } = render(
      <StatCard
        title="待審核"
        value="10"
        variant="warning"
      />
    )

    expect(container.firstChild).toHaveClass('border-yellow-200')
  })

  it('handles click events', async () => {
    const handleClick = vi.fn()
    const user = userEvent.setup()

    render(
      <StatCard
        title="處理量"
        value="100"
        onClick={handleClick}
      />
    )

    await user.click(screen.getByText('處理量').closest('div')!)
    expect(handleClick).toHaveBeenCalledTimes(1)
  })
})
```

### 7.4 Integration Tests

```typescript
// __tests__/integration/dashboard.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createTestClient } from '@/test-utils/api-client'
import { seedTestData, cleanupTestData } from '@/test-utils/seed'

describe('Dashboard Integration', () => {
  let client: ReturnType<typeof createTestClient>

  beforeAll(async () => {
    await seedTestData()
    client = createTestClient({ cityCodes: ['HKG'] })
  })

  afterAll(async () => {
    await cleanupTestData()
  })

  it('should fetch dashboard statistics with city isolation', async () => {
    const response = await client.get('/api/dashboard/statistics')

    expect(response.status).toBe(200)
    expect(response.data.success).toBe(true)
    expect(response.data.data.processingVolume).toBeDefined()
  })

  it('should respect cache TTL', async () => {
    // First request - cache miss
    const first = await client.get('/api/dashboard/statistics')

    // Modify data in database
    // ...

    // Second request - should return cached data
    const second = await client.get('/api/dashboard/statistics')

    expect(first.data.data.lastUpdated).toBe(second.data.data.lastUpdated)
  })
})
```

---

## 8. Performance Considerations

### 8.1 Query Optimization

1. **並行查詢**: 所有統計查詢使用 `Promise.all` 並行執行
2. **複合索引**: 針對常用查詢模式建立複合索引
3. **部分索引**: 使用 WHERE 子句建立部分索引，減少索引大小
4. **BRIN 索引**: 對時間序列數據使用 BRIN 索引

### 8.2 Caching Strategy

1. **Redis 快取**: 5 分鐘 TTL，減少數據庫負載
2. **客戶端快取**: TanStack Query 提供 1 分鐘 stale time
3. **快取失效**: 支援手動和自動快取失效
4. **快取鍵設計**: 包含城市代碼和時間範圍

### 8.3 Response Time Targets

| 操作 | 目標響應時間 |
|------|-------------|
| 快取命中 | < 50ms |
| 快取未命中 | < 500ms |
| 首次載入 (冷啟動) | < 1000ms |

---

## 9. Security Considerations

1. **城市數據隔離**: 透過 city filter 中間件強制實施
2. **權限驗證**: API 端點驗證用戶對請求城市的訪問權限
3. **快取隔離**: 快取鍵包含城市代碼，防止跨城市數據洩漏
4. **管理員功能保護**: 快取失效端點僅限全局管理員
5. **輸入驗證**: 所有查詢參數經過驗證和消毒

---

## 10. Acceptance Criteria Verification

| AC | Description | Implementation | Verification |
|----|-------------|----------------|--------------|
| AC1 | 關鍵指標卡片顯示 | StatCard 組件顯示 5 個指標 | 組件測試 + 視覺測試 |
| AC2 | 載入狀態與過渡 | Skeleton 載入 + transition | 組件測試 |
| AC3 | 數據刷新機制 | 手動刷新按鈕 + 自動刷新 | API 測試 + E2E 測試 |
| AC4 | 城市數據隔離 | City filter 中間件 | 整合測試 |

---

## 11. References

- [TanStack Query Documentation](https://tanstack.com/query/latest)
- [Shadcn/ui Card Component](https://ui.shadcn.com/docs/components/card)
- [PostgreSQL Index Types](https://www.postgresql.org/docs/current/indexes-types.html)
- Story 7.1 Requirements Document
- Architecture Document: Dashboard Section
