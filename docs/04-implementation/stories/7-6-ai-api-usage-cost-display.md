# Story 7.6: AI API 使用量與成本顯示

**Status:** done

---

## Story

**As a** 用戶,
**I want** 查看 AI API 使用量和成本,
**So that** 我可以監控和控制 AI 服務支出。

---

## Acceptance Criteria

### AC1: AI 成本區塊顯示

**Given** 在儀表板頁面
**When** 查看「AI 成本」區塊
**Then** 顯示：
- API 調用次數（Document Intelligence / OpenAI）
- Token 使用量（輸入/輸出）
- 估算成本（美元）
- 與上期對比（增減百分比）

### AC2: 成本明細頁面

**Given** 成本區塊
**When** 點擊「查看詳情」
**Then** 顯示成本明細頁面
**And** 包含按日期的成本趨勢圖

### AC3: 異常調查功能

**Given** 成本趨勢圖
**When** 發現異常高峰
**Then** 可以點擊該日期查看當日處理明細

### AC4: API 類型分類

**Given** 成本明細頁面
**When** 查看 API 使用詳情
**Then** 分別顯示：
- Azure Document Intelligence 使用量與成本
- OpenAI API Token 使用量與成本
- 其他 AI 服務（如有）

---

## Tasks / Subtasks

- [ ] **Task 1: 成本統計 API** (AC: #1)
  - [ ] 1.1 創建 `GET /api/dashboard/ai-cost` 端點
  - [ ] 1.2 聚合 API 調用次數
  - [ ] 1.3 計算 Token 使用量
  - [ ] 1.4 計算估算成本
  - [ ] 1.5 計算同期對比

- [ ] **Task 2: 成本趨勢 API** (AC: #2)
  - [ ] 2.1 創建 `GET /api/dashboard/ai-cost/trend` 端點
  - [ ] 2.2 支援按日/週/月聚合
  - [ ] 2.3 分 API 類型返回數據

- [ ] **Task 3: 日期明細 API** (AC: #3)
  - [ ] 3.1 創建 `GET /api/dashboard/ai-cost/daily/:date` 端點
  - [ ] 3.2 返回當日處理文件列表
  - [ ] 3.3 包含每筆的 API 使用詳情

- [ ] **Task 4: AI 成本卡片組件** (AC: #1)
  - [ ] 4.1 創建 `AiCostCard` 組件
  - [ ] 4.2 顯示關鍵指標
  - [ ] 4.3 添加趨勢指示器
  - [ ] 4.4 添加「查看詳情」連結

- [ ] **Task 5: 成本明細頁面** (AC: #2, #4)
  - [ ] 5.1 創建 `/dashboard/ai-cost` 頁面
  - [ ] 5.2 實現成本趨勢圖表
  - [ ] 5.3 創建 API 類型分類卡片
  - [ ] 5.4 添加時間範圍篩選

- [ ] **Task 6: 異常調查功能** (AC: #3)
  - [ ] 6.1 實現圖表點擊事件
  - [ ] 6.2 創建日期明細對話框
  - [ ] 6.3 顯示當日文件處理列表
  - [ ] 6.4 連結到文件詳情

- [ ] **Task 7: 測試** (AC: #1-4)
  - [ ] 7.1 測試成本計算準確性
  - [ ] 7.2 測試趨勢圖表渲染
  - [ ] 7.3 測試異常調查流程
  - [ ] 7.4 測試城市數據隔離

---

## Dev Notes

### 依賴項

- **Story 7.7**: 城市處理數量追蹤（ApiUsageLog 數據來源）
- **Story 7.1**: 處理統計儀表板

### Architecture Compliance

```typescript
// src/types/ai-cost.ts
export type ApiProvider = 'AZURE_DOC_INTELLIGENCE' | 'OPENAI' | 'AZURE_OPENAI'

export interface AiCostSummary {
  totalCost: number  // USD
  totalCalls: number
  totalTokens: {
    input: number
    output: number
    total: number
  }
  byProvider: {
    provider: ApiProvider
    calls: number
    tokens: { input: number; output: number }
    cost: number
    percentage: number
  }[]
  trend: {
    costChange: number  // 百分比
    callsChange: number
    tokensChange: number
  }
  periodStart: string
  periodEnd: string
}

export interface AiCostTrendPoint {
  date: string
  totalCost: number
  totalCalls: number
  byProvider: {
    provider: ApiProvider
    cost: number
    calls: number
  }[]
}

export interface DailyAiCostDetail {
  date: string
  totalCost: number
  totalCalls: number
  documents: {
    id: string
    invoiceNumber: string
    forwarderCode: string
    processedAt: string
    apiCalls: {
      provider: ApiProvider
      operation: string
      tokensInput: number
      tokensOutput: number
      cost: number
    }[]
    totalCost: number
  }[]
}

// API 單價配置（可從系統設定讀取）
export const API_PRICING: Record<ApiProvider, { perCall?: number; perTokenInput?: number; perTokenOutput?: number }> = {
  AZURE_DOC_INTELLIGENCE: {
    perCall: 0.001  // 每次調用 $0.001
  },
  OPENAI: {
    perTokenInput: 0.00001,  // GPT-4 Turbo 輸入 $0.01/1K
    perTokenOutput: 0.00003  // GPT-4 Turbo 輸出 $0.03/1K
  },
  AZURE_OPENAI: {
    perTokenInput: 0.00001,
    perTokenOutput: 0.00003
  }
}
```

```prisma
// prisma/schema.prisma - API 使用日誌模型
model ApiUsageLog {
  id            String      @id @default(uuid())
  documentId    String?     @map("document_id")
  cityCode      String      @map("city_code")
  provider      ApiProvider
  operation     String      // 'ocr', 'extraction', 'validation', etc.
  tokensInput   Int?        @map("tokens_input")
  tokensOutput  Int?        @map("tokens_output")
  estimatedCost Float       @map("estimated_cost")
  responseTime  Int?        @map("response_time")  // ms
  success       Boolean     @default(true)
  errorMessage  String?     @map("error_message")
  metadata      Json?
  createdAt     DateTime    @default(now()) @map("created_at")

  document      Document?   @relation(fields: [documentId], references: [id])

  @@index([documentId])
  @@index([cityCode])
  @@index([provider])
  @@index([createdAt])
  @@map("api_usage_logs")
}

enum ApiProvider {
  AZURE_DOC_INTELLIGENCE
  OPENAI
  AZURE_OPENAI
}
```

```typescript
// src/services/ai-cost.service.ts
import { prisma } from '@/lib/prisma'
import { redis } from '@/lib/redis'
import { CityFilter, buildCityWhereClause } from '@/middleware/city-filter'
import {
  AiCostSummary,
  AiCostTrendPoint,
  DailyAiCostDetail,
  ApiProvider,
  API_PRICING
} from '@/types/ai-cost'

export class AiCostService {
  private readonly CACHE_TTL = 60 * 5 // 5 分鐘

  async getCostSummary(
    cityFilter: CityFilter,
    startDate: Date,
    endDate: Date
  ): Promise<AiCostSummary> {
    const cacheKey = this.buildCacheKey('summary', cityFilter, startDate, endDate)

    const cached = await redis.get(cacheKey)
    if (cached) return JSON.parse(cached)

    const cityWhere = this.buildCityWhere(cityFilter)

    // 當前期間數據
    const currentStats = await this.getPeriodStats(cityWhere, startDate, endDate)

    // 上一期間數據（用於對比）
    const periodLength = endDate.getTime() - startDate.getTime()
    const prevStartDate = new Date(startDate.getTime() - periodLength)
    const prevEndDate = new Date(startDate.getTime() - 1)
    const prevStats = await this.getPeriodStats(cityWhere, prevStartDate, prevEndDate)

    // 計算對比
    const summary: AiCostSummary = {
      totalCost: currentStats.totalCost,
      totalCalls: currentStats.totalCalls,
      totalTokens: currentStats.totalTokens,
      byProvider: currentStats.byProvider.map(p => ({
        ...p,
        percentage: currentStats.totalCost > 0
          ? (p.cost / currentStats.totalCost) * 100
          : 0
      })),
      trend: {
        costChange: this.calculateChange(currentStats.totalCost, prevStats.totalCost),
        callsChange: this.calculateChange(currentStats.totalCalls, prevStats.totalCalls),
        tokensChange: this.calculateChange(
          currentStats.totalTokens.total,
          prevStats.totalTokens.total
        )
      },
      periodStart: startDate.toISOString(),
      periodEnd: endDate.toISOString()
    }

    await redis.set(cacheKey, JSON.stringify(summary), 'EX', this.CACHE_TTL)

    return summary
  }

  private async getPeriodStats(
    cityWhere: Record<string, unknown>,
    startDate: Date,
    endDate: Date
  ) {
    const logs = await prisma.apiUsageLog.groupBy({
      by: ['provider'],
      where: {
        ...cityWhere,
        createdAt: { gte: startDate, lte: endDate }
      },
      _count: { id: true },
      _sum: {
        tokensInput: true,
        tokensOutput: true,
        estimatedCost: true
      }
    })

    const byProvider = logs.map(log => ({
      provider: log.provider,
      calls: log._count.id,
      tokens: {
        input: log._sum.tokensInput || 0,
        output: log._sum.tokensOutput || 0
      },
      cost: log._sum.estimatedCost || 0
    }))

    return {
      totalCost: byProvider.reduce((sum, p) => sum + p.cost, 0),
      totalCalls: byProvider.reduce((sum, p) => sum + p.calls, 0),
      totalTokens: {
        input: byProvider.reduce((sum, p) => sum + p.tokens.input, 0),
        output: byProvider.reduce((sum, p) => sum + p.tokens.output, 0),
        total: byProvider.reduce((sum, p) => sum + p.tokens.input + p.tokens.output, 0)
      },
      byProvider
    }
  }

  async getCostTrend(
    cityFilter: CityFilter,
    startDate: Date,
    endDate: Date,
    granularity: 'day' | 'week' | 'month' = 'day'
  ): Promise<AiCostTrendPoint[]> {
    const cityWhere = this.buildCityWhere(cityFilter)

    const dateFormat = granularity === 'day'
      ? 'YYYY-MM-DD'
      : granularity === 'week'
        ? 'IYYY-IW'
        : 'YYYY-MM'

    const result = await prisma.$queryRaw<any[]>`
      SELECT
        TO_CHAR(created_at, ${dateFormat}) as date,
        provider,
        COUNT(*) as calls,
        SUM(estimated_cost) as cost
      FROM api_usage_logs
      WHERE created_at >= ${startDate}
        AND created_at <= ${endDate}
        ${cityWhere.cityCode ? prisma.$queryRaw`AND city_code = ${cityWhere.cityCode}` : prisma.$queryRaw``}
        ${cityWhere.cityCode?.in ? prisma.$queryRaw`AND city_code = ANY(${cityWhere.cityCode.in})` : prisma.$queryRaw``}
      GROUP BY TO_CHAR(created_at, ${dateFormat}), provider
      ORDER BY date
    `

    // 按日期聚合
    const trendMap = new Map<string, AiCostTrendPoint>()

    for (const row of result) {
      if (!trendMap.has(row.date)) {
        trendMap.set(row.date, {
          date: row.date,
          totalCost: 0,
          totalCalls: 0,
          byProvider: []
        })
      }

      const point = trendMap.get(row.date)!
      point.totalCost += parseFloat(row.cost) || 0
      point.totalCalls += parseInt(row.calls)
      point.byProvider.push({
        provider: row.provider as ApiProvider,
        cost: parseFloat(row.cost) || 0,
        calls: parseInt(row.calls)
      })
    }

    return Array.from(trendMap.values())
  }

  async getDailyDetail(
    cityFilter: CityFilter,
    date: Date
  ): Promise<DailyAiCostDetail> {
    const cityWhere = this.buildCityWhere(cityFilter)
    const startOfDay = new Date(date)
    startOfDay.setHours(0, 0, 0, 0)
    const endOfDay = new Date(date)
    endOfDay.setHours(23, 59, 59, 999)

    // 獲取當日所有 API 調用
    const logs = await prisma.apiUsageLog.findMany({
      where: {
        ...cityWhere,
        createdAt: { gte: startOfDay, lte: endOfDay }
      },
      include: {
        document: {
          select: {
            id: true,
            invoiceNumber: true,
            processedAt: true,
            forwarder: { select: { code: true } }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    // 按文件分組
    const documentMap = new Map<string, any>()

    for (const log of logs) {
      const docId = log.documentId || 'no-document'

      if (!documentMap.has(docId)) {
        documentMap.set(docId, {
          id: log.document?.id || 'N/A',
          invoiceNumber: log.document?.invoiceNumber || 'N/A',
          forwarderCode: log.document?.forwarder?.code || 'N/A',
          processedAt: log.document?.processedAt?.toISOString() || log.createdAt.toISOString(),
          apiCalls: [],
          totalCost: 0
        })
      }

      const doc = documentMap.get(docId)!
      doc.apiCalls.push({
        provider: log.provider,
        operation: log.operation,
        tokensInput: log.tokensInput || 0,
        tokensOutput: log.tokensOutput || 0,
        cost: log.estimatedCost
      })
      doc.totalCost += log.estimatedCost
    }

    return {
      date: date.toISOString().split('T')[0],
      totalCost: logs.reduce((sum, l) => sum + l.estimatedCost, 0),
      totalCalls: logs.length,
      documents: Array.from(documentMap.values())
    }
  }

  private buildCityWhere(cityFilter: CityFilter): Record<string, unknown> {
    if (cityFilter.isGlobalAdmin) return {}
    if (cityFilter.cityCodes.length === 1) {
      return { cityCode: cityFilter.cityCodes[0] }
    }
    return { cityCode: { in: cityFilter.cityCodes } }
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
    return `ai-cost:${type}:${cityPart}:${startDate.toISOString()}:${endDate.toISOString()}`
  }

  private calculateChange(current: number, previous: number): number {
    if (previous === 0) return current > 0 ? 100 : 0
    return ((current - previous) / previous) * 100
  }
}

export const aiCostService = new AiCostService()
```

```typescript
// src/app/api/dashboard/ai-cost/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { withCityFilter } from '@/middleware/city-filter'
import { aiCostService } from '@/services/ai-cost.service'

export async function GET(request: NextRequest) {
  return withCityFilter(request, async (req, cityFilter) => {
    try {
      const { searchParams } = new URL(req.url)
      const startDate = new Date(
        searchParams.get('startDate') || new Date().setMonth(new Date().getMonth() - 1)
      )
      const endDate = new Date(searchParams.get('endDate') || new Date())

      const summary = await aiCostService.getCostSummary(cityFilter, startDate, endDate)

      return NextResponse.json({
        success: true,
        data: summary
      })
    } catch (error) {
      console.error('AI cost summary error:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch AI cost summary' },
        { status: 500 }
      )
    }
  })
}
```

```typescript
// src/components/dashboard/AiCostCard.tsx
'use client'

import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { TrendingUp, TrendingDown, DollarSign, Cpu, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useDashboardFilter } from '@/contexts/DashboardFilterContext'
import { AiCostSummary } from '@/types/ai-cost'

export function AiCostCard() {
  const { filterParams } = useDashboardFilter()

  const { data, isLoading } = useQuery<AiCostSummary>({
    queryKey: ['ai-cost-summary', filterParams],
    queryFn: async () => {
      const params = new URLSearchParams({
        startDate: filterParams.startDate,
        endDate: filterParams.endDate
      })
      const response = await fetch(`/api/dashboard/ai-cost?${params}`)
      if (!response.ok) throw new Error('Failed to fetch AI cost')
      const result = await response.json()
      return result.data
    }
  })

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-24" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-8 w-20" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-28" />
        </CardContent>
      </Card>
    )
  }

  const formatCost = (cost: number) => `$${cost.toFixed(2)}`
  const formatNumber = (num: number) => num.toLocaleString()

  const TrendIndicator = ({ value, inverse = false }: { value: number; inverse?: boolean }) => {
    const isPositive = inverse ? value < 0 : value > 0
    const Icon = value > 0 ? TrendingUp : TrendingDown
    return (
      <span className={cn(
        'inline-flex items-center text-xs',
        isPositive ? 'text-green-600' : 'text-red-600'
      )}>
        <Icon className="h-3 w-3 mr-0.5" />
        {Math.abs(value).toFixed(1)}%
      </span>
    )
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          AI 成本
        </CardTitle>
        <DollarSign className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {/* 主要成本數字 */}
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold">{formatCost(data?.totalCost || 0)}</span>
          {data?.trend.costChange !== undefined && (
            <TrendIndicator value={data.trend.costChange} inverse />
          )}
        </div>

        {/* API 調用次數 */}
        <div className="mt-3 flex items-center gap-4 text-sm">
          <div className="flex items-center gap-1 text-muted-foreground">
            <Cpu className="h-3.5 w-3.5" />
            <span>{formatNumber(data?.totalCalls || 0)} 次調用</span>
          </div>
          <div className="flex items-center gap-1 text-muted-foreground">
            <Zap className="h-3.5 w-3.5" />
            <span>{formatNumber(data?.totalTokens.total || 0)} tokens</span>
          </div>
        </div>

        {/* API 類型分佈 */}
        <div className="mt-4 space-y-2">
          {data?.byProvider.map(p => (
            <div key={p.provider} className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {p.provider === 'AZURE_DOC_INTELLIGENCE' ? 'Doc Intelligence' :
                 p.provider === 'OPENAI' ? 'OpenAI' : 'Azure OpenAI'}
              </span>
              <div className="flex items-center gap-2">
                <span>{formatCost(p.cost)}</span>
                <span className="text-xs text-muted-foreground">
                  ({p.percentage.toFixed(0)}%)
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* 查看詳情連結 */}
        <Button variant="ghost" size="sm" className="mt-4 w-full" asChild>
          <Link href="/dashboard/ai-cost">查看詳情</Link>
        </Button>
      </CardContent>
    </Card>
  )
}
```

```typescript
// src/app/(dashboard)/dashboard/ai-cost/page.tsx
'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useDashboardFilter } from '@/contexts/DashboardFilterContext'
import { DashboardFilters } from '@/components/dashboard/DashboardFilters'
import { AiCostTrendPoint, DailyAiCostDetail } from '@/types/ai-cost'

const PROVIDER_COLORS = {
  AZURE_DOC_INTELLIGENCE: '#0078d4',
  OPENAI: '#10a37f',
  AZURE_OPENAI: '#5c2d91'
}

export default function AiCostPage() {
  const { filterParams } = useDashboardFilter()
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  // 趨勢數據
  const { data: trendData, isLoading: trendLoading } = useQuery<AiCostTrendPoint[]>({
    queryKey: ['ai-cost-trend', filterParams],
    queryFn: async () => {
      const params = new URLSearchParams({
        startDate: filterParams.startDate,
        endDate: filterParams.endDate,
        granularity: 'day'
      })
      const response = await fetch(`/api/dashboard/ai-cost/trend?${params}`)
      if (!response.ok) throw new Error('Failed to fetch trend')
      const result = await response.json()
      return result.data
    }
  })

  // 日期明細
  const { data: dailyDetail, isLoading: dailyLoading } = useQuery<DailyAiCostDetail>({
    queryKey: ['ai-cost-daily', selectedDate],
    queryFn: async () => {
      const response = await fetch(`/api/dashboard/ai-cost/daily/${selectedDate}`)
      if (!response.ok) throw new Error('Failed to fetch daily detail')
      const result = await response.json()
      return result.data
    },
    enabled: !!selectedDate
  })

  const handleChartClick = (data: any) => {
    if (data?.activePayload?.[0]?.payload?.date) {
      setSelectedDate(data.activePayload[0].payload.date)
    }
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">AI 成本分析</h1>
          <p className="text-muted-foreground">監控 AI API 使用量與成本</p>
        </div>
      </div>

      <DashboardFilters />

      <div className="grid gap-6 lg:grid-cols-2">
        {/* 成本趨勢圖 */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>成本趨勢</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={350}>
              <LineChart
                data={trendData || []}
                onClick={handleChartClick}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis tickFormatter={(v) => `$${v}`} />
                <Tooltip
                  formatter={(value: number) => [`$${value.toFixed(2)}`, '成本']}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="totalCost"
                  name="總成本"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={{ cursor: 'pointer' }}
                />
              </LineChart>
            </ResponsiveContainer>
            <p className="text-xs text-muted-foreground mt-2 text-center">
              點擊圖表上的數據點查看當日明細
            </p>
          </CardContent>
        </Card>

        {/* API 類型分佈 */}
        <Card>
          <CardHeader>
            <CardTitle>API 類型分佈</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                data={trendData || []}
                layout="vertical"
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" tickFormatter={(v) => `$${v}`} />
                <YAxis type="category" dataKey="date" width={80} />
                <Tooltip />
                <Legend />
                {Object.entries(PROVIDER_COLORS).map(([provider, color]) => (
                  <Bar
                    key={provider}
                    dataKey={(entry: AiCostTrendPoint) =>
                      entry.byProvider.find(p => p.provider === provider)?.cost || 0
                    }
                    name={provider === 'AZURE_DOC_INTELLIGENCE' ? 'Doc Intelligence' :
                          provider === 'OPENAI' ? 'OpenAI' : 'Azure OpenAI'}
                    stackId="a"
                    fill={color}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* 調用次數趨勢 */}
        <Card>
          <CardHeader>
            <CardTitle>API 調用次數</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={trendData || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="totalCalls"
                  name="調用次數"
                  stroke="#10b981"
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* 日期明細對話框 */}
      <Dialog open={!!selectedDate} onOpenChange={() => setSelectedDate(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedDate} 成本明細</DialogTitle>
          </DialogHeader>

          {dailyLoading ? (
            <div className="animate-pulse space-y-4">
              <div className="h-8 bg-muted rounded" />
              <div className="h-32 bg-muted rounded" />
            </div>
          ) : dailyDetail && (
            <div className="space-y-4">
              <div className="flex gap-4 text-sm">
                <div className="px-3 py-2 bg-muted rounded">
                  總成本：${dailyDetail.totalCost.toFixed(2)}
                </div>
                <div className="px-3 py-2 bg-muted rounded">
                  API 調用：{dailyDetail.totalCalls} 次
                </div>
              </div>

              <div className="space-y-2">
                {dailyDetail.documents.map((doc) => (
                  <div
                    key={doc.id}
                    className="p-3 border rounded-lg"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-medium">{doc.invoiceNumber}</div>
                        <div className="text-sm text-muted-foreground">
                          {doc.forwarderCode} | {new Date(doc.processedAt).toLocaleTimeString()}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium">${doc.totalCost.toFixed(4)}</div>
                        <div className="text-xs text-muted-foreground">
                          {doc.apiCalls.length} 次調用
                        </div>
                      </div>
                    </div>

                    <div className="mt-2 flex gap-2 flex-wrap">
                      {doc.apiCalls.map((call, i) => (
                        <span
                          key={i}
                          className="text-xs px-2 py-1 bg-muted rounded"
                        >
                          {call.operation}: ${call.cost.toFixed(4)}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
```

### 效能考量

- **快取策略**: 成本摘要快取 5 分鐘
- **數據聚合**: 使用資料庫層級聚合減少傳輸量
- **按需載入**: 日期明細僅在點擊時載入
- **圖表優化**: 大量數據點時考慮降採樣

### References

- [Source: docs/03-epics/sections/epic-7-reports-dashboard-cost-tracking.md#story-76]
- [Source: docs/01-planning/prd/sections/functional-requirements.md#FR35]

---

## Story Metadata

| 屬性 | 值 |
|------|------|
| Story ID | 7.6 |
| Story Key | 7-6-ai-api-usage-cost-display |
| Epic | Epic 7: 報表儀表板與成本追蹤 |
| FR Coverage | FR35 |
| Dependencies | Story 7.7, Story 7.1 |

---

*Story created: 2025-12-16*
*Status: ready-for-dev*
