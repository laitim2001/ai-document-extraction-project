# Story 7.9: 城市成本報表

**Status:** ready-for-dev

---

## Story

**As a** 財務人員,
**I want** 查看城市級別的成本報表,
**So that** 我可以進行預算管理和成本控制。

---

## Acceptance Criteria

### AC1: 成本報表頁面入口

**Given** 財務人員已登入
**When** 導航至「成本報表」頁面
**Then** 顯示各城市的成本明細表格

### AC2: 成本明細內容

**Given** 成本明細表格
**When** 查看內容
**Then** 包含：城市、處理量、AI 成本、人工成本（估算）、總成本

### AC3: 成本趨勢分析

**Given** 成本報表頁面
**When** 查看趨勢
**Then** 顯示各城市成本的月度趨勢圖
**And** 可以識別成本異常增長

### AC4: 異常警示

**Given** 城市成本數據
**When** 成本較上期增長超過閾值（如 20%）
**Then** 顯示警示標記
**And** 可以點擊查看原因分析

### AC5: 權限控制

**Given** 非財務角色用戶
**When** 嘗試訪問成本報表
**Then** 重定向到無權限頁面
**Or** 顯示有限的成本資訊

---

## Tasks / Subtasks

- [ ] **Task 1: 城市成本匯總 API** (AC: #1, #2)
  - [ ] 1.1 創建 `GET /api/reports/city-cost` 端點
  - [ ] 1.2 聚合各城市成本數據
  - [ ] 1.3 計算人工成本估算
  - [ ] 1.4 計算總成本

- [ ] **Task 2: 成本趨勢 API** (AC: #3)
  - [ ] 2.1 創建 `GET /api/reports/city-cost/trend` 端點
  - [ ] 2.2 按月聚合歷史成本
  - [ ] 2.3 計算環比變化

- [ ] **Task 3: 異常檢測服務** (AC: #4)
  - [ ] 3.1 定義成本異常閾值
  - [ ] 3.2 實現異常檢測邏輯
  - [ ] 3.3 生成異常原因分析

- [ ] **Task 4: 成本報表頁面** (AC: #1, #5)
  - [ ] 4.1 創建 `/reports/cost` 頁面路由
  - [ ] 4.2 實現權限檢查
  - [ ] 4.3 整合時間範圍篩選器

- [ ] **Task 5: 城市成本表格** (AC: #2, #4)
  - [ ] 5.1 創建 `CityCostTable` 組件
  - [ ] 5.2 實現排序和篩選
  - [ ] 5.3 添加異常警示標記
  - [ ] 5.4 實現成本細節展開

- [ ] **Task 6: 成本趨勢圖表** (AC: #3)
  - [ ] 6.1 創建 `CostTrendChart` 組件
  - [ ] 6.2 實現多城市對比視圖
  - [ ] 6.3 添加異常高峰標記
  - [ ] 6.4 實現互動式探索

- [ ] **Task 7: 測試** (AC: #1-5)
  - [ ] 7.1 測試成本計算準確性
  - [ ] 7.2 測試異常檢測
  - [ ] 7.3 測試權限控制
  - [ ] 7.4 測試趨勢圖表

---

## Dev Notes

### 依賴項

- **Story 7.7**: 城市處理數量追蹤
- **Story 7.8**: 城市 AI 成本追蹤
- **Story 6.3**: 區域經理跨城市訪問（權限模型）

### Architecture Compliance

```typescript
// src/types/city-cost.ts
export interface CityCostReport {
  cityCode: string
  cityName: string
  regionName?: string

  // 處理量
  processingVolume: number
  autoApproved: number
  manualReviewed: number

  // 成本明細
  aiCost: number
  laborCost: number  // 估算
  totalCost: number

  // 單位成本
  costPerDocument: number

  // 趨勢
  trend: {
    previousPeriodCost: number
    changePercent: number
    isAnomalous: boolean
  }

  // 時間範圍
  period: {
    start: string
    end: string
  }
}

export interface CostTrendPoint {
  period: string  // YYYY-MM
  cityCode: string
  cityName: string
  aiCost: number
  laborCost: number
  totalCost: number
  processingVolume: number
}

export interface CostAnomalyDetail {
  cityCode: string
  cityName: string
  currentCost: number
  previousCost: number
  changePercent: number
  anomalyType: 'volume_spike' | 'cost_per_doc_increase' | 'api_cost_spike' | 'unknown'
  possibleCauses: string[]
  recommendations: string[]
}

// 人工成本估算參數
export const LABOR_COST_CONFIG = {
  costPerManualReview: 0.5,  // USD per document
  costPerEscalation: 2.0,     // USD per escalated case
  overheadMultiplier: 1.2     // 20% overhead
}

// 異常檢測閾值
export const ANOMALY_THRESHOLDS = {
  costChangePercent: 20,  // 成本變化超過 20% 視為異常
  volumeChangePercent: 50, // 處理量變化超過 50% 視為異常
  costPerDocChangePercent: 15 // 單位成本變化超過 15% 視為異常
}
```

```typescript
// src/services/city-cost-report.service.ts
import { prisma } from '@/lib/prisma'
import { redis } from '@/lib/redis'
import { CityFilter } from '@/middleware/city-filter'
import {
  CityCostReport,
  CostTrendPoint,
  CostAnomalyDetail,
  LABOR_COST_CONFIG,
  ANOMALY_THRESHOLDS
} from '@/types/city-cost'

export class CityCostReportService {
  private readonly CACHE_TTL = 60 * 10 // 10 分鐘

  async getCityCostReport(
    cityFilter: CityFilter,
    startDate: Date,
    endDate: Date
  ): Promise<CityCostReport[]> {
    const cacheKey = this.buildCacheKey('report', cityFilter, startDate, endDate)

    const cached = await redis.get(cacheKey)
    if (cached) return JSON.parse(cached)

    // 獲取城市列表
    const cities = await this.getCities(cityFilter)

    // 並行獲取各城市數據
    const reports = await Promise.all(
      cities.map(city => this.getSingleCityCost(city, startDate, endDate))
    )

    // 按總成本排序
    reports.sort((a, b) => b.totalCost - a.totalCost)

    await redis.set(cacheKey, JSON.stringify(reports), 'EX', this.CACHE_TTL)

    return reports
  }

  private async getSingleCityCost(
    city: { code: string; name: string; region?: { name: string } },
    startDate: Date,
    endDate: Date
  ): Promise<CityCostReport> {
    // 獲取處理量統計
    const stats = await prisma.processingStatistics.aggregate({
      where: {
        cityCode: city.code,
        date: { gte: startDate, lte: endDate }
      },
      _sum: {
        totalProcessed: true,
        autoApproved: true,
        manualReviewed: true,
        escalated: true
      }
    })

    // 獲取 AI 成本
    const aiCostResult = await prisma.apiUsageLog.aggregate({
      where: {
        cityCode: city.code,
        createdAt: { gte: startDate, lte: endDate }
      },
      _sum: { estimatedCost: true }
    })

    const processingVolume = stats._sum.totalProcessed || 0
    const manualReviewed = stats._sum.manualReviewed || 0
    const escalated = stats._sum.escalated || 0
    const aiCost = aiCostResult._sum.estimatedCost || 0

    // 計算人工成本估算
    const laborCost = this.calculateLaborCost(manualReviewed, escalated)
    const totalCost = aiCost + laborCost

    // 獲取上期數據計算趨勢
    const periodLength = endDate.getTime() - startDate.getTime()
    const prevStartDate = new Date(startDate.getTime() - periodLength)
    const prevEndDate = new Date(startDate.getTime() - 1)

    const prevCost = await this.getPeriodTotalCost(city.code, prevStartDate, prevEndDate)

    const changePercent = prevCost > 0
      ? ((totalCost - prevCost) / prevCost) * 100
      : 0

    return {
      cityCode: city.code,
      cityName: city.name,
      regionName: city.region?.name,
      processingVolume,
      autoApproved: stats._sum.autoApproved || 0,
      manualReviewed,
      aiCost,
      laborCost,
      totalCost,
      costPerDocument: processingVolume > 0 ? totalCost / processingVolume : 0,
      trend: {
        previousPeriodCost: prevCost,
        changePercent,
        isAnomalous: Math.abs(changePercent) >= ANOMALY_THRESHOLDS.costChangePercent
      },
      period: {
        start: startDate.toISOString(),
        end: endDate.toISOString()
      }
    }
  }

  private calculateLaborCost(manualReviewed: number, escalated: number): number {
    const baseCost = (manualReviewed * LABOR_COST_CONFIG.costPerManualReview) +
                     (escalated * LABOR_COST_CONFIG.costPerEscalation)
    return baseCost * LABOR_COST_CONFIG.overheadMultiplier
  }

  private async getPeriodTotalCost(
    cityCode: string,
    startDate: Date,
    endDate: Date
  ): Promise<number> {
    const [aiCost, stats] = await Promise.all([
      prisma.apiUsageLog.aggregate({
        where: { cityCode, createdAt: { gte: startDate, lte: endDate } },
        _sum: { estimatedCost: true }
      }),
      prisma.processingStatistics.aggregate({
        where: { cityCode, date: { gte: startDate, lte: endDate } },
        _sum: { manualReviewed: true, escalated: true }
      })
    ])

    const laborCost = this.calculateLaborCost(
      stats._sum.manualReviewed || 0,
      stats._sum.escalated || 0
    )

    return (aiCost._sum.estimatedCost || 0) + laborCost
  }

  async getCostTrend(
    cityFilter: CityFilter,
    months: number = 6
  ): Promise<CostTrendPoint[]> {
    const cities = await this.getCities(cityFilter)
    const endDate = new Date()
    const startDate = new Date()
    startDate.setMonth(startDate.getMonth() - months)

    const result = await prisma.$queryRaw<any[]>`
      SELECT
        TO_CHAR(created_at, 'YYYY-MM') as period,
        city_code,
        SUM(estimated_cost) as ai_cost
      FROM api_usage_logs
      WHERE created_at >= ${startDate}
        AND created_at <= ${endDate}
        AND city_code = ANY(${cities.map(c => c.code)})
      GROUP BY TO_CHAR(created_at, 'YYYY-MM'), city_code
      ORDER BY period, city_code
    `

    // 獲取處理量統計
    const statsResult = await prisma.$queryRaw<any[]>`
      SELECT
        TO_CHAR(date, 'YYYY-MM') as period,
        city_code,
        SUM(total_processed) as processing_volume,
        SUM(manual_reviewed) as manual_reviewed,
        SUM(escalated) as escalated
      FROM processing_statistics
      WHERE date >= ${startDate}
        AND date <= ${endDate}
        AND city_code = ANY(${cities.map(c => c.code)})
      GROUP BY TO_CHAR(date, 'YYYY-MM'), city_code
      ORDER BY period, city_code
    `

    const cityMap = new Map(cities.map(c => [c.code, c.name]))
    const statsMap = new Map(
      statsResult.map(s => [`${s.period}-${s.city_code}`, s])
    )

    return result.map(r => {
      const stats = statsMap.get(`${r.period}-${r.city_code}`) || {}
      const laborCost = this.calculateLaborCost(
        parseInt(stats.manual_reviewed) || 0,
        parseInt(stats.escalated) || 0
      )

      return {
        period: r.period,
        cityCode: r.city_code,
        cityName: cityMap.get(r.city_code) || r.city_code,
        aiCost: parseFloat(r.ai_cost) || 0,
        laborCost,
        totalCost: (parseFloat(r.ai_cost) || 0) + laborCost,
        processingVolume: parseInt(stats.processing_volume) || 0
      }
    })
  }

  async analyzeAnomaly(
    cityCode: string,
    startDate: Date,
    endDate: Date
  ): Promise<CostAnomalyDetail> {
    const city = await prisma.city.findUnique({
      where: { code: cityCode },
      select: { code: true, name: true }
    })

    if (!city) throw new Error('City not found')

    // 當前期間
    const currentStats = await this.getPeriodDetailedStats(cityCode, startDate, endDate)

    // 上期
    const periodLength = endDate.getTime() - startDate.getTime()
    const prevStartDate = new Date(startDate.getTime() - periodLength)
    const prevEndDate = new Date(startDate.getTime() - 1)
    const prevStats = await this.getPeriodDetailedStats(cityCode, prevStartDate, prevEndDate)

    // 分析異常原因
    const anomalyType = this.determineAnomalyType(currentStats, prevStats)
    const { possibleCauses, recommendations } = this.generateAnomalyAnalysis(
      anomalyType,
      currentStats,
      prevStats
    )

    return {
      cityCode: city.code,
      cityName: city.name,
      currentCost: currentStats.totalCost,
      previousCost: prevStats.totalCost,
      changePercent: prevStats.totalCost > 0
        ? ((currentStats.totalCost - prevStats.totalCost) / prevStats.totalCost) * 100
        : 0,
      anomalyType,
      possibleCauses,
      recommendations
    }
  }

  private async getPeriodDetailedStats(cityCode: string, startDate: Date, endDate: Date) {
    const [aiStats, procStats] = await Promise.all([
      prisma.apiUsageLog.aggregate({
        where: { cityCode, createdAt: { gte: startDate, lte: endDate } },
        _sum: { estimatedCost: true },
        _count: { id: true }
      }),
      prisma.processingStatistics.aggregate({
        where: { cityCode, date: { gte: startDate, lte: endDate } },
        _sum: { totalProcessed: true, manualReviewed: true, escalated: true }
      })
    ])

    const aiCost = aiStats._sum.estimatedCost || 0
    const laborCost = this.calculateLaborCost(
      procStats._sum.manualReviewed || 0,
      procStats._sum.escalated || 0
    )
    const volume = procStats._sum.totalProcessed || 0

    return {
      aiCost,
      laborCost,
      totalCost: aiCost + laborCost,
      apiCalls: aiStats._count.id,
      volume,
      costPerDoc: volume > 0 ? (aiCost + laborCost) / volume : 0
    }
  }

  private determineAnomalyType(current: any, previous: any): CostAnomalyDetail['anomalyType'] {
    const volumeChange = previous.volume > 0
      ? ((current.volume - previous.volume) / previous.volume) * 100
      : 0

    const costPerDocChange = previous.costPerDoc > 0
      ? ((current.costPerDoc - previous.costPerDoc) / previous.costPerDoc) * 100
      : 0

    const aiCostChange = previous.aiCost > 0
      ? ((current.aiCost - previous.aiCost) / previous.aiCost) * 100
      : 0

    if (volumeChange >= ANOMALY_THRESHOLDS.volumeChangePercent) {
      return 'volume_spike'
    }
    if (costPerDocChange >= ANOMALY_THRESHOLDS.costPerDocChangePercent) {
      return 'cost_per_doc_increase'
    }
    if (aiCostChange >= ANOMALY_THRESHOLDS.costChangePercent * 1.5) {
      return 'api_cost_spike'
    }

    return 'unknown'
  }

  private generateAnomalyAnalysis(
    anomalyType: CostAnomalyDetail['anomalyType'],
    current: any,
    previous: any
  ): { possibleCauses: string[]; recommendations: string[] } {
    const analyses: Record<string, { possibleCauses: string[]; recommendations: string[] }> = {
      volume_spike: {
        possibleCauses: [
          '處理文件數量大幅增加',
          '可能是月末/季末文件積壓',
          '新客戶或新業務上線'
        ],
        recommendations: [
          '確認處理量增加是否預期',
          '評估是否需要調整自動化策略',
          '檢查是否有重複處理的情況'
        ]
      },
      cost_per_doc_increase: {
        possibleCauses: [
          '自動化率下降，更多文件需要人工審核',
          '文件複雜度增加',
          'AI 服務價格調整'
        ],
        recommendations: [
          '檢查自動化率變化',
          '分析失敗和升級案例',
          '評估映射規則優化空間'
        ]
      },
      api_cost_spike: {
        possibleCauses: [
          'API 調用次數異常增加',
          '可能存在重複調用',
          'AI 服務價格變更'
        ],
        recommendations: [
          '檢查 API 調用日誌',
          '確認沒有異常的重複處理',
          '驗證 API 單價配置'
        ]
      },
      unknown: {
        possibleCauses: ['成本變化原因待進一步分析'],
        recommendations: ['建議深入分析各成本組成變化']
      }
    }

    return analyses[anomalyType]
  }

  private async getCities(cityFilter: CityFilter) {
    const where = cityFilter.isGlobalAdmin
      ? {}
      : { code: { in: cityFilter.cityCodes } }

    return prisma.city.findMany({
      where,
      select: {
        code: true,
        name: true,
        region: { select: { name: true } }
      }
    })
  }

  private buildCacheKey(
    type: string,
    cityFilter: CityFilter,
    startDate: Date,
    endDate: Date
  ): string {
    const cityPart = cityFilter.isGlobalAdmin
      ? 'global'
      : cityFilter.cityCodes.sort().join(',')
    return `city-cost:${type}:${cityPart}:${startDate.toISOString()}:${endDate.toISOString()}`
  }
}

export const cityCostReportService = new CityCostReportService()
```

```typescript
// src/components/reports/CityCostTable.tsx
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
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { AlertTriangle, TrendingUp, TrendingDown, ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import { CityCostReport } from '@/types/city-cost'
import { CostAnomalyDialog } from './CostAnomalyDialog'

interface CityCostTableProps {
  data: CityCostReport[]
  loading?: boolean
}

export function CityCostTable({ data, loading }: CityCostTableProps) {
  const [sortField, setSortField] = useState<keyof CityCostReport>('totalCost')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')
  const [selectedCity, setSelectedCity] = useState<string | null>(null)

  const formatCurrency = (amount: number) => `$${amount.toFixed(2)}`

  const sortedData = [...data].sort((a, b) => {
    const aVal = a[sortField]
    const bVal = b[sortField]
    const modifier = sortDirection === 'asc' ? 1 : -1

    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return (aVal - bVal) * modifier
    }
    return 0
  })

  const handleSort = (field: keyof CityCostReport) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('desc')
    }
  }

  if (loading) {
    return <div className="animate-pulse h-64 bg-muted rounded-lg" />
  }

  return (
    <TooltipProvider>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="cursor-pointer" onClick={() => handleSort('cityName')}>
                城市
              </TableHead>
              <TableHead className="cursor-pointer text-right" onClick={() => handleSort('processingVolume')}>
                處理量
              </TableHead>
              <TableHead className="cursor-pointer text-right" onClick={() => handleSort('aiCost')}>
                AI 成本
              </TableHead>
              <TableHead className="cursor-pointer text-right" onClick={() => handleSort('laborCost')}>
                人工成本
              </TableHead>
              <TableHead className="cursor-pointer text-right" onClick={() => handleSort('totalCost')}>
                總成本
              </TableHead>
              <TableHead className="cursor-pointer text-right" onClick={() => handleSort('costPerDocument')}>
                單位成本
              </TableHead>
              <TableHead className="text-right">趨勢</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedData.map((city) => (
              <TableRow key={city.cityCode}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div>
                      <div className="font-medium">{city.cityName}</div>
                      <div className="text-xs text-muted-foreground">{city.regionName}</div>
                    </div>
                    {city.trend.isAnomalous && (
                      <Tooltip>
                        <TooltipTrigger>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => setSelectedCity(city.cityCode)}
                          >
                            <AlertTriangle className="h-4 w-4 text-amber-500" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          成本異常，點擊查看分析
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  {city.processingVolume.toLocaleString()}
                </TableCell>
                <TableCell className="text-right">
                  {formatCurrency(city.aiCost)}
                </TableCell>
                <TableCell className="text-right">
                  <Tooltip>
                    <TooltipTrigger className="cursor-help">
                      {formatCurrency(city.laborCost)}
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>人工審核: {city.manualReviewed} 筆</p>
                      <p className="text-xs text-muted-foreground">估算值</p>
                    </TooltipContent>
                  </Tooltip>
                </TableCell>
                <TableCell className="text-right font-medium">
                  {formatCurrency(city.totalCost)}
                </TableCell>
                <TableCell className="text-right">
                  {formatCurrency(city.costPerDocument)}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    {city.trend.changePercent > 0 ? (
                      <TrendingUp className={cn(
                        'h-4 w-4',
                        city.trend.isAnomalous ? 'text-red-500' : 'text-amber-500'
                      )} />
                    ) : city.trend.changePercent < 0 ? (
                      <TrendingDown className="h-4 w-4 text-green-500" />
                    ) : null}
                    <span className={cn(
                      'text-sm',
                      city.trend.changePercent > 0 && city.trend.isAnomalous && 'text-red-500',
                      city.trend.changePercent < 0 && 'text-green-500'
                    )}>
                      {city.trend.changePercent > 0 ? '+' : ''}
                      {city.trend.changePercent.toFixed(1)}%
                    </span>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* 異常分析對話框 */}
      <CostAnomalyDialog
        cityCode={selectedCity}
        open={!!selectedCity}
        onClose={() => setSelectedCity(null)}
      />
    </TooltipProvider>
  )
}
```

### 權限設計

- **FINANCE_VIEW**: 查看所有城市成本報表
- **CITY_MANAGER**: 查看所屬城市成本
- **REGIONAL_MANAGER**: 查看區域內城市成本

### 效能考量

- **快取策略**: 成本報表快取 10 分鐘
- **聚合查詢**: 使用資料庫層級聚合
- **按需載入**: 異常分析僅在點擊時查詢

### References

- [Source: docs/03-epics/sections/epic-7-reports-dashboard-cost-tracking.md#story-79]
- [Source: docs/01-planning/prd/sections/functional-requirements.md#FR71]

---

## Story Metadata

| 屬性 | 值 |
|------|------|
| Story ID | 7.9 |
| Story Key | 7-9-city-cost-report |
| Epic | Epic 7: 報表儀表板與成本追蹤 |
| FR Coverage | FR71 |
| Dependencies | Story 7.7, Story 7.8, Story 6.3 |

---

*Story created: 2025-12-16*
*Status: ready-for-dev*
