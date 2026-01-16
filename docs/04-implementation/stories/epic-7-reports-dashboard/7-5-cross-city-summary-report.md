# Story 7.5: 跨城市匯總報表

**Status:** done

---

## Story

**As a** 區域經理,
**I want** 查看跨城市的匯總報表,
**So that** 我可以比較各城市的表現。

---

## Acceptance Criteria

### AC1: 區域報表頁面入口

**Given** 區域經理已登入
**When** 導航至「區域報表」頁面
**Then** 顯示各城市的對比數據表格

### AC2: 對比數據內容

**Given** 對比數據表格
**When** 查看內容
**Then** 包含以下欄位：
- 城市名稱
- 處理量
- 成功率
- 自動化率
- 平均處理時間
- AI 成本

### AC3: 城市詳情展開

**Given** 區域報表頁面
**When** 點擊某個城市
**Then** 展開顯示該城市的詳細趨勢圖

### AC4: 報表匯出

**Given** 區域報表
**When** 點擊「匯出」
**Then** 可以匯出跨城市對比報表（Excel 格式）

### AC5: 權限控制

**Given** 城市用戶（非區域經理）
**When** 嘗試訪問區域報表頁面
**Then** 重定向到城市級別報表
**And** 不顯示跨城市數據

---

## Tasks / Subtasks

- [ ] **Task 1: 跨城市統計 API** (AC: #1, #2)
  - [ ] 1.1 創建 `GET /api/reports/regional/summary` 端點
  - [ ] 1.2 實現跨城市數據聚合
  - [ ] 1.3 支援時間範圍參數
  - [ ] 1.4 添加快取機制

- [ ] **Task 2: 城市詳情 API** (AC: #3)
  - [ ] 2.1 創建 `GET /api/reports/regional/city/:cityCode` 端點
  - [ ] 2.2 實現城市趨勢數據查詢
  - [ ] 2.3 支援按日/週/月聚合

- [ ] **Task 3: 區域報表頁面** (AC: #1, #5)
  - [ ] 3.1 創建 `/reports/regional` 頁面路由
  - [ ] 3.2 實現權限檢查和重定向
  - [ ] 3.3 整合時間範圍篩選器

- [ ] **Task 4: 城市對比表格** (AC: #2)
  - [ ] 4.1 創建 `CityComparisonTable` 組件
  - [ ] 4.2 實現排序功能
  - [ ] 4.3 添加數據格式化
  - [ ] 4.4 實現性能指標色彩標示

- [ ] **Task 5: 城市詳情面板** (AC: #3)
  - [ ] 5.1 創建 `CityDetailPanel` 組件
  - [ ] 5.2 實現趨勢圖表（日/週/月）
  - [ ] 5.3 添加展開/收起動畫
  - [ ] 5.4 顯示關鍵指標對比

- [ ] **Task 6: 匯出功能** (AC: #4)
  - [ ] 6.1 創建 `POST /api/reports/regional/export` 端點
  - [ ] 6.2 實現跨城市對比 Excel 生成
  - [ ] 6.3 包含圖表截圖（可選）

- [ ] **Task 7: 測試** (AC: #1-5)
  - [ ] 7.1 測試區域經理訪問
  - [ ] 7.2 測試城市用戶權限限制
  - [ ] 7.3 測試數據準確性
  - [ ] 7.4 測試匯出功能

---

## Dev Notes

### 依賴項

- **Story 6.3**: 區域經理跨城市訪問
- **Story 7.1**: 處理統計儀表板
- **Story 7.2**: 時間範圍篩選

### Architecture Compliance

```typescript
// src/types/regional-report.ts
export interface CitySummary {
  cityCode: string
  cityName: string
  region?: string
  processingVolume: number
  successRate: number
  automationRate: number
  avgProcessingTime: number  // 秒
  aiCost: number  // USD
  pendingReview: number
  trend: {
    volumeChange: number  // 百分比
    successRateChange: number
    costChange: number
  }
}

export interface RegionalSummary {
  totalCities: number
  totalVolume: number
  avgSuccessRate: number
  avgAutomationRate: number
  totalAiCost: number
  cities: CitySummary[]
}

export interface CityTrendData {
  date: string
  volume: number
  successRate: number
  automationRate: number
  aiCost: number
}

export interface CityDetailReport {
  cityCode: string
  cityName: string
  summary: CitySummary
  trend: CityTrendData[]
  topForwarders: {
    code: string
    name: string
    volume: number
    successRate: number
  }[]
}
```

```typescript
// src/services/regional-report.service.ts
import { prisma } from '@/lib/prisma'
import { redis } from '@/lib/redis'
import { CityFilter } from '@/middleware/city-filter'
import { RegionalSummary, CitySummary, CityDetailReport, CityTrendData } from '@/types/regional-report'

export class RegionalReportService {
  private readonly CACHE_TTL = 60 * 10 // 10 分鐘快取

  async getRegionalSummary(
    cityFilter: CityFilter,
    startDate: Date,
    endDate: Date
  ): Promise<RegionalSummary> {
    // 驗證權限：必須是區域經理或全局管理員
    if (!cityFilter.isGlobalAdmin && !cityFilter.isRegionalManager) {
      throw new Error('Access denied: Regional manager access required')
    }

    const cacheKey = `regional:summary:${cityFilter.cityCodes.join(',')}:${startDate.toISOString()}:${endDate.toISOString()}`

    // 嘗試從快取獲取
    const cached = await redis.get(cacheKey)
    if (cached) {
      return JSON.parse(cached)
    }

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
      cities.map(city => this.getCitySummary(city.code, startDate, endDate))
    )

    // 計算匯總
    const summary: RegionalSummary = {
      totalCities: cities.length,
      totalVolume: citySummaries.reduce((sum, c) => sum + c.processingVolume, 0),
      avgSuccessRate: this.calculateAverage(citySummaries.map(c => c.successRate)),
      avgAutomationRate: this.calculateAverage(citySummaries.map(c => c.automationRate)),
      totalAiCost: citySummaries.reduce((sum, c) => sum + c.aiCost, 0),
      cities: citySummaries.map((summary, i) => ({
        ...summary,
        cityName: cities[i].name,
        region: cities[i].region?.name
      }))
    }

    // 按處理量排序
    summary.cities.sort((a, b) => b.processingVolume - a.processingVolume)

    // 寫入快取
    await redis.set(cacheKey, JSON.stringify(summary), 'EX', this.CACHE_TTL)

    return summary
  }

  private async getCitySummary(
    cityCode: string,
    startDate: Date,
    endDate: Date
  ): Promise<CitySummary> {
    const [current, previous] = await Promise.all([
      this.getPeriodStats(cityCode, startDate, endDate),
      this.getPreviousPeriodStats(cityCode, startDate, endDate)
    ])

    return {
      cityCode,
      cityName: '', // 會在上層填充
      processingVolume: current.volume,
      successRate: current.successRate,
      automationRate: current.automationRate,
      avgProcessingTime: current.avgProcessingTime,
      aiCost: current.aiCost,
      pendingReview: current.pendingReview,
      trend: {
        volumeChange: this.calculatePercentageChange(current.volume, previous.volume),
        successRateChange: current.successRate - previous.successRate,
        costChange: this.calculatePercentageChange(current.aiCost, previous.aiCost)
      }
    }
  }

  private async getPeriodStats(cityCode: string, startDate: Date, endDate: Date) {
    const [volumeData, costData, pendingCount] = await Promise.all([
      prisma.document.aggregate({
        where: {
          cityCode,
          processedAt: { gte: startDate, lte: endDate }
        },
        _count: { id: true },
        _avg: { processingDuration: true }
      }),
      prisma.document.findMany({
        where: {
          cityCode,
          processedAt: { gte: startDate, lte: endDate },
          status: { in: ['COMPLETED', 'APPROVED'] }
        },
        select: {
          autoApproved: true,
          apiUsageLogs: { select: { estimatedCost: true } }
        }
      }),
      prisma.document.count({
        where: { cityCode, status: 'PENDING_REVIEW' }
      })
    ])

    const totalDocs = costData.length
    const autoApproved = costData.filter(d => d.autoApproved).length
    const totalCost = costData.reduce(
      (sum, d) => sum + d.apiUsageLogs.reduce((s, l) => s + (l.estimatedCost || 0), 0),
      0
    )

    return {
      volume: volumeData._count.id,
      successRate: totalDocs > 0 ? (totalDocs / volumeData._count.id) * 100 : 0,
      automationRate: totalDocs > 0 ? (autoApproved / totalDocs) * 100 : 0,
      avgProcessingTime: volumeData._avg.processingDuration || 0,
      aiCost: totalCost,
      pendingReview: pendingCount
    }
  }

  private async getPreviousPeriodStats(cityCode: string, startDate: Date, endDate: Date) {
    const periodLength = endDate.getTime() - startDate.getTime()
    const prevStartDate = new Date(startDate.getTime() - periodLength)
    const prevEndDate = new Date(startDate.getTime() - 1)

    return this.getPeriodStats(cityCode, prevStartDate, prevEndDate)
  }

  async getCityDetail(
    cityCode: string,
    startDate: Date,
    endDate: Date,
    granularity: 'day' | 'week' | 'month' = 'day'
  ): Promise<CityDetailReport> {
    const city = await prisma.city.findUnique({
      where: { code: cityCode },
      select: { code: true, name: true }
    })

    if (!city) throw new Error('City not found')

    const [summary, trend, topForwarders] = await Promise.all([
      this.getCitySummary(cityCode, startDate, endDate),
      this.getCityTrend(cityCode, startDate, endDate, granularity),
      this.getTopForwarders(cityCode, startDate, endDate)
    ])

    return {
      cityCode: city.code,
      cityName: city.name,
      summary: { ...summary, cityName: city.name },
      trend,
      topForwarders
    }
  }

  private async getCityTrend(
    cityCode: string,
    startDate: Date,
    endDate: Date,
    granularity: 'day' | 'week' | 'month'
  ): Promise<CityTrendData[]> {
    // 使用 Prisma 原生查詢進行時間聚合
    const dateFormat = granularity === 'day'
      ? 'YYYY-MM-DD'
      : granularity === 'week'
        ? 'IYYY-IW'
        : 'YYYY-MM'

    const result = await prisma.$queryRaw<any[]>`
      SELECT
        TO_CHAR(processed_at, ${dateFormat}) as date,
        COUNT(*) as volume,
        COUNT(*) FILTER (WHERE status IN ('COMPLETED', 'APPROVED'))::float / NULLIF(COUNT(*), 0) * 100 as success_rate,
        COUNT(*) FILTER (WHERE auto_approved = true)::float / NULLIF(COUNT(*) FILTER (WHERE status IN ('COMPLETED', 'APPROVED')), 0) * 100 as automation_rate,
        SUM(
          (SELECT COALESCE(SUM(estimated_cost), 0) FROM api_usage_logs WHERE document_id = documents.id)
        ) as ai_cost
      FROM documents
      WHERE city_code = ${cityCode}
        AND processed_at >= ${startDate}
        AND processed_at <= ${endDate}
      GROUP BY TO_CHAR(processed_at, ${dateFormat})
      ORDER BY date
    `

    return result.map(r => ({
      date: r.date,
      volume: parseInt(r.volume),
      successRate: parseFloat(r.success_rate) || 0,
      automationRate: parseFloat(r.automation_rate) || 0,
      aiCost: parseFloat(r.ai_cost) || 0
    }))
  }

  private async getTopForwarders(
    cityCode: string,
    startDate: Date,
    endDate: Date,
    limit: number = 5
  ) {
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

    const forwarders = await prisma.forwarder.findMany({
      where: { id: { in: result.map(r => r.forwarderId!).filter(Boolean) } },
      select: { id: true, code: true, name: true }
    })

    return result.map(r => {
      const forwarder = forwarders.find(f => f.id === r.forwarderId)
      return {
        code: forwarder?.code || '',
        name: forwarder?.name || '',
        volume: r._count.id,
        successRate: 0 // 需要額外查詢計算
      }
    })
  }

  private calculateAverage(values: number[]): number {
    if (values.length === 0) return 0
    return values.reduce((sum, v) => sum + v, 0) / values.length
  }

  private calculatePercentageChange(current: number, previous: number): number {
    if (previous === 0) return current > 0 ? 100 : 0
    return ((current - previous) / previous) * 100
  }
}

export const regionalReportService = new RegionalReportService()
```

```typescript
// src/app/api/reports/regional/summary/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { withCityFilter } from '@/middleware/city-filter'
import { regionalReportService } from '@/services/regional-report.service'

export async function GET(request: NextRequest) {
  return withCityFilter(request, async (req, cityFilter) => {
    try {
      // 權限檢查
      if (!cityFilter.isGlobalAdmin && !cityFilter.isRegionalManager) {
        return NextResponse.json(
          { success: false, error: 'Regional manager access required' },
          { status: 403 }
        )
      }

      const { searchParams } = new URL(req.url)
      const startDate = new Date(searchParams.get('startDate') || new Date().setMonth(new Date().getMonth() - 1))
      const endDate = new Date(searchParams.get('endDate') || new Date())

      const summary = await regionalReportService.getRegionalSummary(
        cityFilter,
        startDate,
        endDate
      )

      return NextResponse.json({
        success: true,
        data: summary
      })
    } catch (error) {
      console.error('Regional summary error:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch regional summary' },
        { status: 500 }
      )
    }
  })
}
```

```typescript
// src/components/reports/CityComparisonTable.tsx
'use client'

import { useState } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { ChevronDown, ChevronUp, TrendingUp, TrendingDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { CitySummary } from '@/types/regional-report'
import { CityDetailPanel } from './CityDetailPanel'

interface CityComparisonTableProps {
  cities: CitySummary[]
  loading?: boolean
}

type SortField = 'cityName' | 'processingVolume' | 'successRate' | 'automationRate' | 'avgProcessingTime' | 'aiCost'
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

  const sortedCities = [...cities].sort((a, b) => {
    const aValue = a[sortField]
    const bValue = b[sortField]
    const modifier = sortDirection === 'asc' ? 1 : -1

    if (typeof aValue === 'string') {
      return aValue.localeCompare(bValue as string) * modifier
    }
    return ((aValue as number) - (bValue as number)) * modifier
  })

  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${Math.round(seconds)}s`
    const minutes = Math.floor(seconds / 60)
    return `${minutes}m ${Math.round(seconds % 60)}s`
  }

  const formatCurrency = (amount: number) => {
    return `$${amount.toFixed(2)}`
  }

  const TrendIndicator = ({ value }: { value: number }) => {
    if (Math.abs(value) < 0.1) return null
    const isUp = value > 0
    return (
      <span className={cn(
        'inline-flex items-center text-xs',
        isUp ? 'text-green-600' : 'text-red-600'
      )}>
        {isUp ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
        {Math.abs(value).toFixed(1)}%
      </span>
    )
  }

  const SortHeader = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <TableHead
      className="cursor-pointer hover:bg-muted/50"
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center gap-1">
        {children}
        {sortField === field && (
          sortDirection === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
        )}
      </div>
    </TableHead>
  )

  if (loading) {
    return <div className="animate-pulse h-64 bg-muted rounded-lg" />
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <SortHeader field="cityName">城市</SortHeader>
            <SortHeader field="processingVolume">處理量</SortHeader>
            <SortHeader field="successRate">成功率</SortHeader>
            <SortHeader field="automationRate">自動化率</SortHeader>
            <SortHeader field="avgProcessingTime">平均時間</SortHeader>
            <SortHeader field="aiCost">AI 成本</SortHeader>
            <TableHead className="w-[50px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedCities.map((city) => (
            <>
              <TableRow
                key={city.cityCode}
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => setExpandedCity(
                  expandedCity === city.cityCode ? null : city.cityCode
                )}
              >
                <TableCell className="font-medium">
                  <div>
                    <div>{city.cityName}</div>
                    <div className="text-xs text-muted-foreground">{city.cityCode}</div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {city.processingVolume.toLocaleString()}
                    <TrendIndicator value={city.trend.volumeChange} />
                  </div>
                </TableCell>
                <TableCell>
                  <div className={cn(
                    'font-medium',
                    city.successRate >= 95 ? 'text-green-600' :
                    city.successRate >= 90 ? 'text-yellow-600' : 'text-red-600'
                  )}>
                    {city.successRate.toFixed(1)}%
                  </div>
                </TableCell>
                <TableCell>
                  {city.automationRate.toFixed(1)}%
                </TableCell>
                <TableCell>
                  {formatDuration(city.avgProcessingTime)}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {formatCurrency(city.aiCost)}
                    <TrendIndicator value={city.trend.costChange} />
                  </div>
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

              {/* 展開的詳情面板 */}
              {expandedCity === city.cityCode && (
                <TableRow>
                  <TableCell colSpan={7} className="p-0">
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
  Legend
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useDashboardFilter } from '@/contexts/DashboardFilterContext'

interface CityDetailPanelProps {
  cityCode: string
}

export function CityDetailPanel({ cityCode }: CityDetailPanelProps) {
  const { filterParams } = useDashboardFilter()

  const { data, isLoading } = useQuery({
    queryKey: ['city-detail', cityCode, filterParams],
    queryFn: async () => {
      const params = new URLSearchParams({
        startDate: filterParams.startDate,
        endDate: filterParams.endDate,
        granularity: 'day'
      })
      const response = await fetch(`/api/reports/regional/city/${cityCode}?${params}`)
      if (!response.ok) throw new Error('Failed to fetch city detail')
      const result = await response.json()
      return result.data
    }
  })

  if (isLoading) {
    return (
      <div className="p-6 animate-pulse">
        <div className="h-64 bg-muted rounded-lg" />
      </div>
    )
  }

  return (
    <div className="p-6 bg-muted/30 border-t">
      <Tabs defaultValue="trend">
        <TabsList>
          <TabsTrigger value="trend">趨勢圖</TabsTrigger>
          <TabsTrigger value="forwarders">Top Forwarders</TabsTrigger>
        </TabsList>

        <TabsContent value="trend" className="mt-4">
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={data?.trend || []}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis yAxisId="left" />
              <YAxis yAxisId="right" orientation="right" />
              <Tooltip />
              <Legend />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="volume"
                name="處理量"
                stroke="#3b82f6"
                strokeWidth={2}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="successRate"
                name="成功率 %"
                stroke="#10b981"
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        </TabsContent>

        <TabsContent value="forwarders" className="mt-4">
          <div className="grid gap-2">
            {data?.topForwarders?.map((f: any, i: number) => (
              <div
                key={f.code}
                className="flex items-center justify-between p-3 bg-background rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <span className="text-lg font-bold text-muted-foreground">
                    #{i + 1}
                  </span>
                  <div>
                    <div className="font-medium">{f.code}</div>
                    <div className="text-sm text-muted-foreground">{f.name}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-medium">{f.volume.toLocaleString()}</div>
                  <div className="text-sm text-muted-foreground">筆</div>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
```

### 效能考量

- **數據聚合**: 使用 SQL 原生查詢進行時間聚合，避免應用層大量數據處理
- **快取策略**: 區域匯總數據快取 10 分鐘
- **按需載入**: 城市詳情僅在展開時載入
- **分頁考量**: 城市數量通常有限，無需分頁

### References

- [Source: docs/03-epics/sections/epic-7-reports-dashboard-cost-tracking.md#story-75]
- [Source: docs/01-planning/prd/sections/functional-requirements.md#FR34]

---

## Story Metadata

| 屬性 | 值 |
|------|------|
| Story ID | 7.5 |
| Story Key | 7-5-cross-city-summary-report |
| Epic | Epic 7: 報表儀表板與成本追蹤 |
| FR Coverage | FR34 |
| Dependencies | Story 6.3, Story 7.1, Story 7.2 |

---

*Story created: 2025-12-16*
*Status: done*
*Completed: 2025-12-19*

---

## Implementation Notes

### 已完成項目

- [x] **Task 1: 跨城市統計 API**
  - [x] 創建 `src/types/regional-report.ts` 定義所有類型
  - [x] 創建 `src/services/regional-report.service.ts` 實現核心邏輯
  - [x] 創建 `GET /api/reports/regional/summary` 端點
  - [x] 實現內存快取機制 (10 分鐘 TTL)
  - [x] 支援時間範圍參數

- [x] **Task 2: 城市詳情 API**
  - [x] 創建 `GET /api/reports/regional/city/[cityCode]` 端點
  - [x] 實現城市趨勢數據查詢 (支援 day/week/month 粒度)
  - [x] 實現 Top Forwarders 查詢

- [x] **Task 3: 區域報表頁面**
  - [x] 創建 `/reports/regional` 頁面路由
  - [x] 實現權限檢查 (isRegionalManager || isGlobalAdmin)
  - [x] 非授權用戶自動重導向到 /dashboard
  - [x] 整合 DashboardFilterProvider 進行日期篩選

- [x] **Task 4: 城市對比表格**
  - [x] 創建 `CityComparisonTable` 組件
  - [x] 實現 6 欄位排序功能
  - [x] 添加趨勢指標 (TrendIndicator)
  - [x] 實現成功率色彩標示 (綠/黃/紅)

- [x] **Task 5: 城市詳情面板**
  - [x] 創建 `CityDetailPanel` 組件
  - [x] 實現趨勢圖表 (Recharts LineChart)
  - [x] 添加 Top Forwarders 列表
  - [x] 展開/收起動畫 (animate-in slide-in-from-top-2)

- [x] **Task 6: 匯出功能**
  - [x] 創建 `GET /api/reports/regional/export` 端點
  - [x] 實現 Excel 多工作表匯出 (Summary, Cities, City Details)
  - [x] 支援 includeTrend 和 includeForwarders 選項

### Schema 適配

由於實際資料庫 Schema 與 Tech Spec 略有不同，進行了以下適配：

| Tech Spec | 實際實現 | 說明 |
|-----------|----------|------|
| `processedAt` | `createdAt` | 使用建立時間作為處理時間 |
| `autoApproved` | `processingPath === 'AUTO_APPROVE'` | 使用處理路徑判斷 |
| `processingDuration` | `extractionResult.processingTime` | 從提取結果取得處理時間 (ms→s) |
| `apiUsageLogs.estimatedCost` | `aiCost: 0` | AI 成本追蹤尚未實現 |

### 新增檔案

| 檔案路徑 | 說明 |
|----------|------|
| `src/types/regional-report.ts` | 區域報表類型定義 |
| `src/services/regional-report.service.ts` | 區域報表服務 (含快取) |
| `src/app/api/reports/regional/summary/route.ts` | 區域匯總 API |
| `src/app/api/reports/regional/city/[cityCode]/route.ts` | 城市詳情 API |
| `src/app/api/reports/regional/export/route.ts` | 區域匯出 API |
| `src/components/reports/CityComparisonTable.tsx` | 城市對比表格組件 |
| `src/components/reports/CityDetailPanel.tsx` | 城市詳情面板組件 |
| `src/components/reports/RegionalReportContent.tsx` | 區域報表內容組件 |
| `src/app/(dashboard)/reports/regional/page.tsx` | 區域報表頁面 |

### 修改檔案

| 檔案路徑 | 變更說明 |
|----------|----------|
| `src/types/index.ts` | 新增 regional-report 導出 |
| `src/services/index.ts` | 新增 regionalReportService 導出 |
