# Tech Spec: Story 7.5 - Cross-City Summary Report

## Story Reference
- **Story ID**: 7.5
- **Story Title**: 跨城市匯總報表
- **Epic**: Epic 7 - 報表儀表板與成本追蹤
- **Status**: Tech Spec Complete

---

## 1. Technical Overview

### 1.1 Purpose
建立跨城市匯總報表功能，允許區域經理查看和比較各城市的處理表現，包括處理量、成功率、自動化率、平均處理時間和 AI 成本等關鍵指標，並支援城市詳情展開和報表匯出。

### 1.2 Scope
- 區域報表 API 端點設計
- RegionalReportService 服務層實現
- CityComparisonTable 對比表格組件
- CityDetailPanel 城市詳情面板
- 區域報表匯出功能
- 權限控制（區域經理/全局管理員）

### 1.3 Dependencies
- **Story 6.3**: 區域經理跨城市訪問
- **Story 7.1**: 處理統計儀表板
- **Story 7.2**: 時間範圍篩選
- Recharts (趨勢圖表)
- ExcelJS (報表匯出)

---

## 2. Type Definitions

### 2.1 Regional Report Types

```typescript
// src/types/regional-report.ts

/**
 * 城市摘要數據
 */
export interface CitySummary {
  /** 城市代碼 */
  cityCode: string
  /** 城市名稱 */
  cityName: string
  /** 所屬區域 */
  region?: string
  /** 處理量 */
  processingVolume: number
  /** 成功率 (0-100) */
  successRate: number
  /** 自動化率 (0-100) */
  automationRate: number
  /** 平均處理時間（秒） */
  avgProcessingTime: number
  /** AI 成本 (USD) */
  aiCost: number
  /** 待審核數量 */
  pendingReview: number
  /** 趨勢數據 */
  trend: {
    /** 處理量變化百分比 */
    volumeChange: number
    /** 成功率變化 */
    successRateChange: number
    /** 成本變化百分比 */
    costChange: number
  }
}

/**
 * 區域匯總數據
 */
export interface RegionalSummary {
  /** 城市總數 */
  totalCities: number
  /** 總處理量 */
  totalVolume: number
  /** 平均成功率 */
  avgSuccessRate: number
  /** 平均自動化率 */
  avgAutomationRate: number
  /** 總 AI 成本 */
  totalAiCost: number
  /** 各城市詳情 */
  cities: CitySummary[]
}

/**
 * 城市趨勢數據點
 */
export interface CityTrendData {
  /** 日期 */
  date: string
  /** 處理量 */
  volume: number
  /** 成功率 */
  successRate: number
  /** 自動化率 */
  automationRate: number
  /** AI 成本 */
  aiCost: number
}

/**
 * Top Forwarder 數據
 */
export interface TopForwarderData {
  /** Forwarder 代碼 */
  code: string
  /** Forwarder 名稱 */
  name: string
  /** 處理量 */
  volume: number
  /** 成功率 */
  successRate: number
}

/**
 * 城市詳情報表
 */
export interface CityDetailReport {
  /** 城市代碼 */
  cityCode: string
  /** 城市名稱 */
  cityName: string
  /** 摘要數據 */
  summary: CitySummary
  /** 趨勢數據 */
  trend: CityTrendData[]
  /** Top Forwarders */
  topForwarders: TopForwarderData[]
}

/**
 * 時間聚合粒度
 */
export type TimeGranularity = 'day' | 'week' | 'month'

/**
 * 區域報表 API 響應
 */
export interface RegionalSummaryResponse {
  success: boolean
  data?: RegionalSummary
  error?: string
}

/**
 * 城市詳情 API 響應
 */
export interface CityDetailResponse {
  success: boolean
  data?: CityDetailReport
  error?: string
}
```

---

## 3. Service Implementation

### 3.1 Regional Report Service

```typescript
// src/services/regional-report.service.ts
import { prisma } from '@/lib/prisma'
import { redis } from '@/lib/redis'
import { CityFilter, buildCityWhereClause } from '@/middleware/city-filter'
import {
  RegionalSummary,
  CitySummary,
  CityDetailReport,
  CityTrendData,
  TopForwarderData,
  TimeGranularity
} from '@/types/regional-report'

/**
 * 區域報表服務
 */
export class RegionalReportService {
  private readonly CACHE_TTL = 60 * 10  // 10 分鐘快取

  /**
   * 獲取區域匯總報表
   */
  async getRegionalSummary(
    cityFilter: CityFilter,
    startDate: Date,
    endDate: Date
  ): Promise<RegionalSummary> {
    // 驗證權限
    if (!cityFilter.isGlobalAdmin && !cityFilter.isRegionalManager) {
      throw new Error('Access denied: Regional manager access required')
    }

    const cacheKey = this.buildCacheKey(
      'regional:summary',
      cityFilter,
      startDate,
      endDate
    )

    // 嘗試快取
    const cached = await this.getFromCache<RegionalSummary>(cacheKey)
    if (cached) return cached

    // 獲取授權城市列表
    const cities = await prisma.city.findMany({
      where: {
        code: { in: cityFilter.cityCodes }
      },
      include: {
        region: { select: { name: true } }
      }
    })

    // 並行查詢各城市數據
    const citySummaries = await Promise.all(
      cities.map(city =>
        this.getCitySummary(city.code, city.name, startDate, endDate, city.region?.name)
      )
    )

    // 計算區域匯總
    const summary: RegionalSummary = {
      totalCities: cities.length,
      totalVolume: citySummaries.reduce((sum, c) => sum + c.processingVolume, 0),
      avgSuccessRate: this.calculateWeightedAverage(
        citySummaries.map(c => ({ value: c.successRate, weight: c.processingVolume }))
      ),
      avgAutomationRate: this.calculateWeightedAverage(
        citySummaries.map(c => ({ value: c.automationRate, weight: c.processingVolume }))
      ),
      totalAiCost: citySummaries.reduce((sum, c) => sum + c.aiCost, 0),
      cities: citySummaries.sort((a, b) => b.processingVolume - a.processingVolume)
    }

    await this.setToCache(cacheKey, summary)
    return summary
  }

  /**
   * 獲取單一城市摘要
   */
  private async getCitySummary(
    cityCode: string,
    cityName: string,
    startDate: Date,
    endDate: Date,
    region?: string
  ): Promise<CitySummary> {
    const [current, previous] = await Promise.all([
      this.getPeriodStats(cityCode, startDate, endDate),
      this.getPreviousPeriodStats(cityCode, startDate, endDate)
    ])

    return {
      cityCode,
      cityName,
      region,
      processingVolume: current.volume,
      successRate: current.successRate,
      automationRate: current.automationRate,
      avgProcessingTime: current.avgProcessingTime,
      aiCost: current.aiCost,
      pendingReview: current.pendingReview,
      trend: {
        volumeChange: this.calculatePercentageChange(current.volume, previous.volume),
        successRateChange: Number((current.successRate - previous.successRate).toFixed(1)),
        costChange: this.calculatePercentageChange(current.aiCost, previous.aiCost)
      }
    }
  }

  /**
   * 獲取期間統計數據
   */
  private async getPeriodStats(
    cityCode: string,
    startDate: Date,
    endDate: Date
  ): Promise<{
    volume: number
    successRate: number
    automationRate: number
    avgProcessingTime: number
    aiCost: number
    pendingReview: number
  }> {
    const [
      totalCount,
      successResult,
      autoApprovedCount,
      avgTimeResult,
      costResult,
      pendingCount
    ] = await Promise.all([
      // 總處理量
      prisma.document.count({
        where: {
          cityCode,
          processedAt: { gte: startDate, lte: endDate }
        }
      }),
      // 成功數量
      prisma.document.count({
        where: {
          cityCode,
          processedAt: { gte: startDate, lte: endDate },
          status: { in: ['COMPLETED', 'APPROVED'] }
        }
      }),
      // 自動處理數量
      prisma.document.count({
        where: {
          cityCode,
          processedAt: { gte: startDate, lte: endDate },
          status: { in: ['COMPLETED', 'APPROVED'] },
          autoApproved: true
        }
      }),
      // 平均處理時間
      prisma.document.aggregate({
        where: {
          cityCode,
          processedAt: { gte: startDate, lte: endDate },
          status: { in: ['COMPLETED', 'APPROVED'] },
          processingDuration: { not: null }
        },
        _avg: { processingDuration: true }
      }),
      // AI 成本
      prisma.apiUsageLog.aggregate({
        where: {
          document: {
            cityCode,
            processedAt: { gte: startDate, lte: endDate }
          }
        },
        _sum: { estimatedCost: true }
      }),
      // 待審核數量
      prisma.document.count({
        where: { cityCode, status: 'PENDING_REVIEW' }
      })
    ])

    const successCount = successResult
    const successRate = totalCount > 0 ? (successCount / totalCount) * 100 : 0
    const automationRate = successCount > 0 ? (autoApprovedCount / successCount) * 100 : 0

    return {
      volume: totalCount,
      successRate: Number(successRate.toFixed(1)),
      automationRate: Number(automationRate.toFixed(1)),
      avgProcessingTime: avgTimeResult._avg.processingDuration || 0,
      aiCost: costResult._sum.estimatedCost || 0,
      pendingReview: pendingCount
    }
  }

  /**
   * 獲取上一期間統計
   */
  private async getPreviousPeriodStats(
    cityCode: string,
    startDate: Date,
    endDate: Date
  ) {
    const periodLength = endDate.getTime() - startDate.getTime()
    const prevStartDate = new Date(startDate.getTime() - periodLength)
    const prevEndDate = new Date(startDate.getTime() - 1)

    return this.getPeriodStats(cityCode, prevStartDate, prevEndDate)
  }

  /**
   * 獲取城市詳情
   */
  async getCityDetail(
    cityCode: string,
    startDate: Date,
    endDate: Date,
    granularity: TimeGranularity = 'day'
  ): Promise<CityDetailReport> {
    const city = await prisma.city.findUnique({
      where: { code: cityCode },
      select: { code: true, name: true }
    })

    if (!city) {
      throw new Error('City not found')
    }

    const [summary, trend, topForwarders] = await Promise.all([
      this.getCitySummary(city.code, city.name, startDate, endDate),
      this.getCityTrend(cityCode, startDate, endDate, granularity),
      this.getTopForwarders(cityCode, startDate, endDate)
    ])

    return {
      cityCode: city.code,
      cityName: city.name,
      summary,
      trend,
      topForwarders
    }
  }

  /**
   * 獲取城市趨勢數據
   */
  private async getCityTrend(
    cityCode: string,
    startDate: Date,
    endDate: Date,
    granularity: TimeGranularity
  ): Promise<CityTrendData[]> {
    const dateFormat = granularity === 'day'
      ? 'YYYY-MM-DD'
      : granularity === 'week'
        ? 'IYYY-"W"IW'
        : 'YYYY-MM'

    const result = await prisma.$queryRaw<any[]>`
      SELECT
        TO_CHAR(d.processed_at, ${dateFormat}) as date,
        COUNT(*) as volume,
        COUNT(*) FILTER (WHERE d.status IN ('COMPLETED', 'APPROVED'))::float
          / NULLIF(COUNT(*), 0) * 100 as success_rate,
        COUNT(*) FILTER (WHERE d.auto_approved = true)::float
          / NULLIF(COUNT(*) FILTER (WHERE d.status IN ('COMPLETED', 'APPROVED')), 0) * 100 as automation_rate,
        COALESCE(SUM(al.estimated_cost), 0) as ai_cost
      FROM documents d
      LEFT JOIN api_usage_logs al ON al.document_id = d.id
      WHERE d.city_code = ${cityCode}
        AND d.processed_at >= ${startDate}
        AND d.processed_at <= ${endDate}
        AND d.processed_at IS NOT NULL
      GROUP BY TO_CHAR(d.processed_at, ${dateFormat})
      ORDER BY date
    `

    return result.map(r => ({
      date: r.date,
      volume: parseInt(r.volume) || 0,
      successRate: parseFloat(r.success_rate) || 0,
      automationRate: parseFloat(r.automation_rate) || 0,
      aiCost: parseFloat(r.ai_cost) || 0
    }))
  }

  /**
   * 獲取 Top Forwarders
   */
  private async getTopForwarders(
    cityCode: string,
    startDate: Date,
    endDate: Date,
    limit: number = 5
  ): Promise<TopForwarderData[]> {
    const result = await prisma.document.groupBy({
      by: ['forwarderId'],
      where: {
        cityCode,
        processedAt: { gte: startDate, lte: endDate },
        forwarderId: { not: null }
      },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: limit
    })

    if (result.length === 0) return []

    const forwarderIds = result
      .map(r => r.forwarderId)
      .filter((id): id is string => id !== null)

    const forwarders = await prisma.forwarder.findMany({
      where: { id: { in: forwarderIds } },
      select: { id: true, code: true, name: true }
    })

    // 獲取成功率
    const successRates = await Promise.all(
      forwarderIds.map(async (forwarderId) => {
        const [total, success] = await Promise.all([
          prisma.document.count({
            where: { cityCode, forwarderId, processedAt: { gte: startDate, lte: endDate } }
          }),
          prisma.document.count({
            where: {
              cityCode,
              forwarderId,
              processedAt: { gte: startDate, lte: endDate },
              status: { in: ['COMPLETED', 'APPROVED'] }
            }
          })
        ])
        return { forwarderId, rate: total > 0 ? (success / total) * 100 : 0 }
      })
    )

    return result.map(r => {
      const forwarder = forwarders.find(f => f.id === r.forwarderId)
      const rateData = successRates.find(s => s.forwarderId === r.forwarderId)
      return {
        code: forwarder?.code || '',
        name: forwarder?.name || '',
        volume: r._count.id,
        successRate: Number((rateData?.rate || 0).toFixed(1))
      }
    })
  }

  /**
   * 計算加權平均
   */
  private calculateWeightedAverage(
    items: { value: number; weight: number }[]
  ): number {
    const totalWeight = items.reduce((sum, item) => sum + item.weight, 0)
    if (totalWeight === 0) return 0

    const weightedSum = items.reduce(
      (sum, item) => sum + item.value * item.weight,
      0
    )
    return Number((weightedSum / totalWeight).toFixed(1))
  }

  /**
   * 計算百分比變化
   */
  private calculatePercentageChange(current: number, previous: number): number {
    if (previous === 0) return current > 0 ? 100 : 0
    return Number((((current - previous) / previous) * 100).toFixed(1))
  }

  // 快取工具方法
  private buildCacheKey(
    prefix: string,
    cityFilter: CityFilter,
    startDate: Date,
    endDate: Date
  ): string {
    const cityPart = cityFilter.isGlobalAdmin
      ? 'all'
      : cityFilter.cityCodes.sort().join(',')
    return `${prefix}:${cityPart}:${startDate.toISOString()}:${endDate.toISOString()}`
  }

  private async getFromCache<T>(key: string): Promise<T | null> {
    try {
      const cached = await redis.get(key)
      return cached ? JSON.parse(cached) : null
    } catch {
      return null
    }
  }

  private async setToCache(key: string, data: any): Promise<void> {
    try {
      await redis.set(key, JSON.stringify(data), 'EX', this.CACHE_TTL)
    } catch (error) {
      console.error('Cache write error:', error)
    }
  }
}

export const regionalReportService = new RegionalReportService()
```

---

## 4. API Routes

### 4.1 Regional Summary API

```typescript
// src/app/api/reports/regional/summary/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { withCityFilter } from '@/middleware/city-filter'
import { regionalReportService } from '@/services/regional-report.service'
import { RegionalSummaryResponse } from '@/types/regional-report'
import { parseISO, isValid, startOfMonth } from 'date-fns'

export async function GET(request: NextRequest) {
  return withCityFilter(request, async (req, cityFilter) => {
    try {
      // 權限檢查
      if (!cityFilter.isGlobalAdmin && !cityFilter.isRegionalManager) {
        return NextResponse.json<RegionalSummaryResponse>(
          { success: false, error: 'Regional manager access required' },
          { status: 403 }
        )
      }

      const { searchParams } = new URL(req.url)

      // 解析日期參數
      const startDateStr = searchParams.get('startDate')
      const endDateStr = searchParams.get('endDate')

      const startDate = startDateStr && isValid(parseISO(startDateStr))
        ? parseISO(startDateStr)
        : startOfMonth(new Date())

      const endDate = endDateStr && isValid(parseISO(endDateStr))
        ? parseISO(endDateStr)
        : new Date()

      const summary = await regionalReportService.getRegionalSummary(
        cityFilter,
        startDate,
        endDate
      )

      return NextResponse.json<RegionalSummaryResponse>({
        success: true,
        data: summary
      })
    } catch (error) {
      console.error('Regional summary error:', error)
      return NextResponse.json<RegionalSummaryResponse>(
        { success: false, error: 'Failed to fetch regional summary' },
        { status: 500 }
      )
    }
  })
}
```

### 4.2 City Detail API

```typescript
// src/app/api/reports/regional/city/[cityCode]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { withCityFilter } from '@/middleware/city-filter'
import { regionalReportService } from '@/services/regional-report.service'
import { CityDetailResponse, TimeGranularity } from '@/types/regional-report'
import { parseISO, isValid, startOfMonth } from 'date-fns'

interface RouteParams {
  params: { cityCode: string }
}

export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  return withCityFilter(request, async (req, cityFilter) => {
    try {
      const { cityCode } = params

      // 權限檢查
      if (!cityFilter.isGlobalAdmin && !cityFilter.cityCodes.includes(cityCode)) {
        return NextResponse.json<CityDetailResponse>(
          { success: false, error: 'Access denied to this city' },
          { status: 403 }
        )
      }

      const { searchParams } = new URL(req.url)

      const startDateStr = searchParams.get('startDate')
      const endDateStr = searchParams.get('endDate')
      const granularity = (searchParams.get('granularity') || 'day') as TimeGranularity

      const startDate = startDateStr && isValid(parseISO(startDateStr))
        ? parseISO(startDateStr)
        : startOfMonth(new Date())

      const endDate = endDateStr && isValid(parseISO(endDateStr))
        ? parseISO(endDateStr)
        : new Date()

      const detail = await regionalReportService.getCityDetail(
        cityCode,
        startDate,
        endDate,
        granularity
      )

      return NextResponse.json<CityDetailResponse>({
        success: true,
        data: detail
      })
    } catch (error) {
      console.error('City detail error:', error)
      return NextResponse.json<CityDetailResponse>(
        { success: false, error: 'Failed to fetch city detail' },
        { status: 500 }
      )
    }
  })
}
```

---

## 5. Frontend Components

### 5.1 CityComparisonTable

```typescript
// src/components/reports/CityComparisonTable.tsx
'use client'

import { useState, useMemo } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  ChevronDown,
  ChevronUp,
  TrendingUp,
  TrendingDown,
  Minus,
  ArrowUpDown
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { CitySummary } from '@/types/regional-report'
import { CityDetailPanel } from './CityDetailPanel'

interface CityComparisonTableProps {
  cities: CitySummary[]
  loading?: boolean
}

type SortField = keyof Pick<
  CitySummary,
  'cityName' | 'processingVolume' | 'successRate' | 'automationRate' | 'avgProcessingTime' | 'aiCost'
>
type SortDirection = 'asc' | 'desc'

export function CityComparisonTable({ cities, loading }: CityComparisonTableProps) {
  const [sortField, setSortField] = useState<SortField>('processingVolume')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [expandedCity, setExpandedCity] = useState<string | null>(null)

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('desc')
    }
  }

  const sortedCities = useMemo(() => {
    return [...cities].sort((a, b) => {
      const aValue = a[sortField]
      const bValue = b[sortField]
      const modifier = sortDirection === 'asc' ? 1 : -1

      if (typeof aValue === 'string') {
        return aValue.localeCompare(bValue as string) * modifier
      }
      return ((aValue as number) - (bValue as number)) * modifier
    })
  }, [cities, sortField, sortDirection])

  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${Math.round(seconds)}s`
    const minutes = Math.floor(seconds / 60)
    const secs = Math.round(seconds % 60)
    return secs > 0 ? `${minutes}m ${secs}s` : `${minutes}m`
  }

  const formatCurrency = (amount: number) => `$${amount.toFixed(2)}`

  const TrendIndicator = ({ value, invert = false }: { value: number; invert?: boolean }) => {
    if (Math.abs(value) < 0.5) {
      return <Minus className="h-3 w-3 text-muted-foreground" />
    }
    const isPositive = invert ? value < 0 : value > 0
    const Icon = value > 0 ? TrendingUp : TrendingDown
    return (
      <span className={cn(
        'inline-flex items-center gap-0.5 text-xs font-medium',
        isPositive ? 'text-green-600' : 'text-red-600'
      )}>
        <Icon className="h-3 w-3" />
        {Math.abs(value).toFixed(1)}%
      </span>
    )
  }

  const RateIndicator = ({ value }: { value: number }) => {
    const variant = value >= 95 ? 'success' : value >= 90 ? 'warning' : 'destructive'
    return (
      <Badge variant={variant === 'success' ? 'default' : variant as any}>
        {value.toFixed(1)}%
      </Badge>
    )
  }

  const SortableHeader = ({
    field,
    children
  }: {
    field: SortField
    children: React.ReactNode
  }) => (
    <TableHead
      className="cursor-pointer hover:bg-muted/50 select-none"
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center gap-1">
        {children}
        {sortField === field ? (
          sortDirection === 'asc' ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )
        ) : (
          <ArrowUpDown className="h-4 w-4 opacity-30" />
        )}
      </div>
    </TableHead>
  )

  if (loading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-10 w-full" />
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    )
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <SortableHeader field="cityName">城市</SortableHeader>
            <SortableHeader field="processingVolume">處理量</SortableHeader>
            <SortableHeader field="successRate">成功率</SortableHeader>
            <SortableHeader field="automationRate">自動化率</SortableHeader>
            <SortableHeader field="avgProcessingTime">平均時間</SortableHeader>
            <SortableHeader field="aiCost">AI 成本</SortableHeader>
            <TableHead className="w-[60px]">待審核</TableHead>
            <TableHead className="w-[40px]" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedCities.map((city) => (
            <>
              <TableRow
                key={city.cityCode}
                className={cn(
                  'cursor-pointer transition-colors',
                  expandedCity === city.cityCode && 'bg-muted/50'
                )}
                onClick={() => setExpandedCity(
                  expandedCity === city.cityCode ? null : city.cityCode
                )}
              >
                <TableCell>
                  <div>
                    <div className="font-medium">{city.cityName}</div>
                    <div className="text-xs text-muted-foreground">
                      {city.cityCode}
                      {city.region && ` · ${city.region}`}
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">
                      {city.processingVolume.toLocaleString()}
                    </span>
                    <TrendIndicator value={city.trend.volumeChange} />
                  </div>
                </TableCell>
                <TableCell>
                  <RateIndicator value={city.successRate} />
                </TableCell>
                <TableCell>
                  <span className="font-medium">{city.automationRate.toFixed(1)}%</span>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {formatDuration(city.avgProcessingTime)}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{formatCurrency(city.aiCost)}</span>
                    <TrendIndicator value={city.trend.costChange} invert />
                  </div>
                </TableCell>
                <TableCell>
                  {city.pendingReview > 0 && (
                    <Badge variant="outline">{city.pendingReview}</Badge>
                  )}
                </TableCell>
                <TableCell>
                  <Button variant="ghost" size="sm">
                    {expandedCity === city.cityCode ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </Button>
                </TableCell>
              </TableRow>

              {expandedCity === city.cityCode && (
                <TableRow>
                  <TableCell colSpan={8} className="p-0 border-t-0">
                    <CityDetailPanel cityCode={city.cityCode} />
                  </TableCell>
                </TableRow>
              )}
            </>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
```

### 5.2 CityDetailPanel

```typescript
// src/components/reports/CityDetailPanel.tsx
'use client'

import { useQuery } from '@tanstack/react-query'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  BarChart,
  Bar
} from 'recharts'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { useDashboardFilter } from '@/contexts/DashboardFilterContext'
import { CityDetailReport, CityDetailResponse } from '@/types/regional-report'

interface CityDetailPanelProps {
  cityCode: string
}

export function CityDetailPanel({ cityCode }: CityDetailPanelProps) {
  const { filterParams } = useDashboardFilter()

  const { data, isLoading, error } = useQuery<CityDetailReport>({
    queryKey: ['city-detail', cityCode, filterParams],
    queryFn: async () => {
      const params = new URLSearchParams({
        startDate: filterParams.startDate,
        endDate: filterParams.endDate,
        granularity: 'day'
      })
      const response = await fetch(
        `/api/reports/regional/city/${cityCode}?${params}`
      )
      if (!response.ok) throw new Error('Failed to fetch')
      const result: CityDetailResponse = await response.json()
      if (!result.success || !result.data) throw new Error(result.error)
      return result.data
    }
  })

  if (isLoading) {
    return (
      <div className="p-6 bg-muted/30">
        <div className="space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="p-6 bg-muted/30 text-center text-muted-foreground">
        載入失敗，請重試
      </div>
    )
  }

  return (
    <div className="p-6 bg-muted/30 animate-in slide-in-from-top-2">
      <Tabs defaultValue="trend" className="space-y-4">
        <TabsList>
          <TabsTrigger value="trend">處理趨勢</TabsTrigger>
          <TabsTrigger value="forwarders">Top Forwarders</TabsTrigger>
        </TabsList>

        <TabsContent value="trend">
          <Card>
            <CardContent className="pt-6">
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={data.trend}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11 }}
                    tickFormatter={(value) => value.slice(5)}
                  />
                  <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    domain={[0, 100]}
                    tickFormatter={(v) => `${v}%`}
                    tick={{ fontSize: 11 }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--popover))',
                      border: '1px solid hsl(var(--border))'
                    }}
                  />
                  <Legend />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="volume"
                    name="處理量"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="successRate"
                    name="成功率 %"
                    stroke="#10b981"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="forwarders">
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-3">
                {data.topForwarders.map((forwarder, index) => (
                  <div
                    key={forwarder.code}
                    className="flex items-center justify-between p-3 bg-background rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <Badge
                        variant={index < 3 ? 'default' : 'secondary'}
                        className="w-6 h-6 flex items-center justify-center rounded-full p-0"
                      >
                        {index + 1}
                      </Badge>
                      <div>
                        <div className="font-medium">{forwarder.code}</div>
                        <div className="text-sm text-muted-foreground">
                          {forwarder.name}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium">
                        {forwarder.volume.toLocaleString()} 筆
                      </div>
                      <div className="text-sm text-muted-foreground">
                        成功率 {forwarder.successRate}%
                      </div>
                    </div>
                  </div>
                ))}
                {data.topForwarders.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    此期間無 Forwarder 數據
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
```

### 5.3 Regional Report Page

```typescript
// src/app/(dashboard)/reports/regional/page.tsx
import { Metadata } from 'next'
import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { DashboardFilterProvider } from '@/contexts/DashboardFilterContext'
import { RegionalReportContent } from '@/components/reports/RegionalReportContent'
import { Skeleton } from '@/components/ui/skeleton'

export const metadata: Metadata = {
  title: '區域報表 | AI 文件處理系統',
  description: '跨城市匯總報表和對比分析'
}

export default async function RegionalReportPage() {
  const session = await auth()

  // 權限檢查
  if (!session?.user?.isRegionalManager && !session?.user?.isGlobalAdmin) {
    redirect('/dashboard')
  }

  return (
    <DashboardFilterProvider syncWithUrl initialPreset="thisMonth">
      <div className="container mx-auto py-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">區域報表</h1>
          <p className="text-muted-foreground">
            跨城市匯總報表和對比分析
          </p>
        </div>

        <Suspense fallback={<Skeleton className="h-[600px]" />}>
          <RegionalReportContent />
        </Suspense>
      </div>
    </DashboardFilterProvider>
  )
}
```

---

## 6. Testing Strategy

### 6.1 Service Tests

```typescript
// __tests__/services/regional-report.service.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { RegionalReportService } from '@/services/regional-report.service'
import { prisma } from '@/lib/prisma'

vi.mock('@/lib/prisma')
vi.mock('@/lib/redis')

describe('RegionalReportService', () => {
  let service: RegionalReportService

  beforeEach(() => {
    service = new RegionalReportService()
    vi.clearAllMocks()
  })

  describe('getRegionalSummary', () => {
    it('should throw error for non-regional managers', async () => {
      const cityFilter = {
        isGlobalAdmin: false,
        isRegionalManager: false,
        cityCodes: ['HKG']
      }

      await expect(
        service.getRegionalSummary(
          cityFilter,
          new Date('2025-01-01'),
          new Date('2025-01-31')
        )
      ).rejects.toThrow('Regional manager access required')
    })

    it('should return summary for regional managers', async () => {
      vi.mocked(prisma.city.findMany).mockResolvedValue([
        { code: 'HKG', name: 'Hong Kong', region: { name: 'APAC' } }
      ] as any)

      vi.mocked(prisma.document.count).mockResolvedValue(100)
      vi.mocked(prisma.document.aggregate).mockResolvedValue({
        _avg: { processingDuration: 120 }
      } as any)
      vi.mocked(prisma.apiUsageLog.aggregate).mockResolvedValue({
        _sum: { estimatedCost: 50 }
      } as any)

      const cityFilter = {
        isGlobalAdmin: false,
        isRegionalManager: true,
        cityCodes: ['HKG']
      }

      const result = await service.getRegionalSummary(
        cityFilter,
        new Date('2025-01-01'),
        new Date('2025-01-31')
      )

      expect(result.totalCities).toBe(1)
      expect(result.cities).toHaveLength(1)
    })
  })
})
```

---

## 7. Performance Considerations

1. **並行查詢**: 各城市數據並行查詢
2. **加權平均**: 使用處理量作為權重計算平均值
3. **快取策略**: 區域匯總快取 10 分鐘
4. **按需載入**: 城市詳情僅在展開時載入
5. **原生查詢**: 趨勢數據使用原生 SQL 進行時間聚合

---

## 8. Security Considerations

1. **權限驗證**: 僅區域經理和全局管理員可訪問
2. **城市權限**: 只能查看授權城市的數據
3. **數據隔離**: 嚴格的城市數據隔離

---

## 9. Acceptance Criteria Verification

| AC | Description | Implementation | Verification |
|----|-------------|----------------|--------------|
| AC1 | 區域報表頁面入口 | /reports/regional 頁面 | 路由測試 |
| AC2 | 對比數據內容 | CityComparisonTable | 組件測試 |
| AC3 | 城市詳情展開 | CityDetailPanel | 組件測試 |
| AC4 | 報表匯出 | 整合 Story 7.4 | 整合測試 |
| AC5 | 權限控制 | 區域經理檢查 | API 測試 |

---

## 10. References

- [Recharts Documentation](https://recharts.org/)
- [PostgreSQL Date/Time Functions](https://www.postgresql.org/docs/current/functions-datetime.html)
- Story 7.5 Requirements Document
