'use client'

/**
 * @fileoverview 城市對比分析組件
 * @description
 *   提供跨城市績效指標的可視化對比：
 *   - 多城市選擇（最少 2 個，最多 5 個）
 *   - 時間週期切換（7天/30天/90天）
 *   - 多種圖表視圖（柱狀圖/雷達圖/趨勢圖）
 *   - 詳細數據表格
 *
 * @module src/components/analytics/CityComparison
 * @author Development Team
 * @since Epic 6 - Story 6.3 (Regional Manager Cross-City Access)
 * @lastModified 2025-12-19
 *
 * @features
 *   - 城市多選（2-5 個）
 *   - 時間週期選擇
 *   - 柱狀圖/雷達圖/趨勢圖切換
 *   - 最佳/最差城市標識
 *   - 響應式設計
 *
 * @dependencies
 *   - @tanstack/react-query - 數據查詢
 *   - recharts - 圖表庫
 *   - @/hooks/useUserCity - 用戶城市權限
 *   - @/components/filters/CityMultiSelect - 城市多選
 *
 * @related
 *   - src/app/api/analytics/city-comparison/route.ts - 城市對比 API
 *   - src/components/filters/CityMultiSelect.tsx - 城市多選組件
 */

import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useUserCity } from '@/hooks/useUserCity'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { CityMultiSelect } from '@/components/filters/CityMultiSelect'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from 'recharts'
import { Trophy, AlertTriangle, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

// ============================================================
// Constants
// ============================================================

/** 圖表顏色 */
const CHART_COLORS = [
  '#8884d8',
  '#82ca9d',
  '#ffc658',
  '#ff7300',
  '#00C49F',
  '#0088FE',
]

/** 指標標籤 */
const METRIC_LABELS: Record<string, string> = {
  documentsProcessed: '處理數量',
  successRate: '成功率',
  averageConfidence: '平均信心度',
  averageProcessingTime: '平均處理時間',
  correctionRate: '修正率',
  escalationRate: '升級率',
}

/** 時間週期類型 */
type Period = '7d' | '30d' | '90d'

/** 圖表類型 */
type ChartType = 'bar' | 'radar' | 'trend'

// ============================================================
// Types
// ============================================================

interface CityMetrics {
  cityCode: string
  cityName: string
  metrics: {
    documentsProcessed: number
    successRate: number
    averageConfidence: number
    averageProcessingTime: number
    correctionRate: number
    escalationRate: number
  }
  trend: Array<{
    date: string
    processed: number
    successRate: number
  }>
}

interface ComparisonResult {
  metric: string
  best: { cityCode: string; value: number }
  worst: { cityCode: string; value: number }
  average: number
  standardDeviation: number
}

interface ComparisonData {
  period: { start: string; end: string }
  cities: CityMetrics[]
  comparison: ComparisonResult[]
}

interface CityComparisonProps {
  className?: string
}

// ============================================================
// Helper Functions
// ============================================================

/**
 * 格式化指標值
 */
function formatMetricValue(value: number, metric: string): string {
  if (
    metric.includes('Rate') ||
    metric === 'successRate' ||
    metric === 'averageConfidence'
  ) {
    return `${(value * 100).toFixed(1)}%`
  }
  if (metric === 'averageProcessingTime') {
    return `${value.toFixed(1)}s`
  }
  return value.toLocaleString()
}

// ============================================================
// Sub-Components
// ============================================================

/**
 * 比較卡片
 */
function ComparisonCard({ comparison }: { comparison: ComparisonResult }) {
  return (
    <Card>
      <CardContent className="pt-4">
        <p className="text-sm text-muted-foreground">
          {METRIC_LABELS[comparison.metric] || comparison.metric}
        </p>
        <div className="mt-2 space-y-1">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1 text-green-600">
              <Trophy className="h-3 w-3" />
              <span className="text-xs">最佳</span>
            </div>
            <span className="text-sm font-medium">
              {comparison.best.cityCode}:{' '}
              {formatMetricValue(comparison.best.value, comparison.metric)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1 text-orange-600">
              <AlertTriangle className="h-3 w-3" />
              <span className="text-xs">待改善</span>
            </div>
            <span className="text-sm font-medium">
              {comparison.worst.cityCode}:{' '}
              {formatMetricValue(comparison.worst.value, comparison.metric)}
            </span>
          </div>
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs">平均</span>
            <span className="text-sm">
              {formatMetricValue(comparison.average, comparison.metric)}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

/**
 * 柱狀圖視圖
 */
function BarChartView({ data }: { data: CityMetrics[] }) {
  const chartData = useMemo(
    () =>
      data?.map((city) => ({
        name: city.cityName,
        處理數量: city.metrics.documentsProcessed,
        '成功率 (%)': Number((city.metrics.successRate * 100).toFixed(1)),
        '信心度 (%)': Number((city.metrics.averageConfidence * 100).toFixed(1)),
      })),
    [data]
  )

  if (!chartData?.length) return null

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="name" />
        <YAxis yAxisId="left" />
        <YAxis yAxisId="right" orientation="right" />
        <Tooltip />
        <Legend />
        <Bar yAxisId="left" dataKey="處理數量" fill={CHART_COLORS[0]} />
        <Bar yAxisId="right" dataKey="成功率 (%)" fill={CHART_COLORS[1]} />
        <Bar yAxisId="right" dataKey="信心度 (%)" fill={CHART_COLORS[2]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

/**
 * 雷達圖視圖
 */
function RadarChartView({ data }: { data: CityMetrics[] }) {
  const radarData = useMemo(() => {
    const metrics = [
      { metric: '成功率', key: 'successRate' },
      { metric: '信心度', key: 'averageConfidence' },
      { metric: '效率', key: 'efficiency' },
    ]

    return metrics.map((m) => {
      const result: Record<string, string | number> = {
        metric: m.metric,
        fullMark: 100,
      }
      data?.forEach((city) => {
        if (m.key === 'efficiency') {
          result[city.cityCode] = Number(
            ((1 - city.metrics.correctionRate) * 100).toFixed(1)
          )
        } else {
          result[city.cityCode] = Number(
            ((city.metrics[m.key as keyof typeof city.metrics] as number) * 100).toFixed(1)
          )
        }
      })
      return result
    })
  }, [data])

  if (!data?.length) return null

  return (
    <ResponsiveContainer width="100%" height="100%">
      <RadarChart data={radarData}>
        <PolarGrid />
        <PolarAngleAxis dataKey="metric" />
        <PolarRadiusAxis angle={30} domain={[0, 100]} />
        {data.map((city, index) => (
          <Radar
            key={city.cityCode}
            name={city.cityName}
            dataKey={city.cityCode}
            stroke={CHART_COLORS[index % CHART_COLORS.length]}
            fill={CHART_COLORS[index % CHART_COLORS.length]}
            fillOpacity={0.3}
          />
        ))}
        <Legend />
      </RadarChart>
    </ResponsiveContainer>
  )
}

/**
 * 趨勢圖視圖
 */
function TrendChartView({ data }: { data: CityMetrics[] }) {
  const trendData = useMemo(() => {
    const allDates = new Set<string>()
    data?.forEach((city) => {
      city.trend.forEach((t) => allDates.add(t.date))
    })

    return [...allDates].sort().map((date) => {
      const point: Record<string, string | number> = { date }
      data?.forEach((city) => {
        const dayData = city.trend.find((t) => t.date === date)
        point[city.cityCode] = dayData?.processed || 0
      })
      return point
    })
  }, [data])

  if (!trendData?.length) return null

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={trendData}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis
          dataKey="date"
          tickFormatter={(value) =>
            new Date(value).toLocaleDateString('zh-TW', {
              month: 'short',
              day: 'numeric',
            })
          }
        />
        <YAxis />
        <Tooltip
          labelFormatter={(value) =>
            new Date(value as string).toLocaleDateString('zh-TW')
          }
        />
        <Legend />
        {data?.map((city, index) => (
          <Line
            key={city.cityCode}
            type="monotone"
            dataKey={city.cityCode}
            name={city.cityName}
            stroke={CHART_COLORS[index % CHART_COLORS.length]}
            strokeWidth={2}
            dot={false}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}

/**
 * 比較表格
 */
function ComparisonTable({
  cities,
  comparison,
}: {
  cities: CityMetrics[]
  comparison: ComparisonResult[]
}) {
  if (!cities?.length || !comparison?.length) return null

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>指標</TableHead>
          {cities.map((city) => (
            <TableHead key={city.cityCode} className="text-center">
              {city.cityName}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {comparison.map((comp) => (
          <TableRow key={comp.metric}>
            <TableCell className="font-medium">
              {METRIC_LABELS[comp.metric] || comp.metric}
            </TableCell>
            {cities.map((city) => {
              const value = city.metrics[comp.metric as keyof typeof city.metrics] as number
              const isBest = comp.best.cityCode === city.cityCode
              const isWorst = comp.worst.cityCode === city.cityCode

              return (
                <TableCell
                  key={city.cityCode}
                  className={cn(
                    'text-center',
                    isBest && 'text-green-600 font-medium',
                    isWorst && 'text-orange-600'
                  )}
                >
                  {formatMetricValue(value, comp.metric)}
                  {isBest && <Trophy className="inline h-3 w-3 ml-1" />}
                </TableCell>
              )
            })}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

// ============================================================
// Main Component
// ============================================================

/**
 * 城市對比分析組件
 *
 * @description
 *   提供跨城市的績效指標對比分析。
 *   需要用戶有多城市訪問權限才能使用。
 *
 * @example
 *   <CityComparison className="mt-4" />
 */
export function CityComparison({ className }: CityComparisonProps) {
  // --- Hooks ---
  const { cityCodes, isGlobalAdmin, isLoading: userLoading } = useUserCity()

  const [selectedCities, setSelectedCities] = useState<string[]>([])
  const [period, setPeriod] = useState<Period>('30d')
  const [chartType, setChartType] = useState<ChartType>('bar')

  // 初始化選擇的城市
  useMemo(() => {
    if (selectedCities.length === 0 && cityCodes.length > 0) {
      setSelectedCities(cityCodes.slice(0, Math.min(3, cityCodes.length)))
    }
  }, [cityCodes, selectedCities.length])

  // 是否可以進行對比
  const canCompare =
    (isGlobalAdmin || cityCodes.length >= 2) && selectedCities.length >= 2

  // --- Data Fetching ---
  const {
    data: response,
    isLoading: dataLoading,
    error,
  } = useQuery<{ success: boolean; data: ComparisonData }>({
    queryKey: ['city-comparison', selectedCities, period],
    queryFn: async () => {
      const params = new URLSearchParams({
        cities: selectedCities.join(','),
        period,
      })
      const res = await fetch(`/api/analytics/city-comparison?${params}`)
      if (!res.ok) throw new Error('Failed to fetch comparison data')
      return res.json()
    },
    enabled: canCompare,
  })

  const comparisonData = response?.data

  // --- 權限不足 ---
  if (!userLoading && cityCodes.length < 2 && !isGlobalAdmin) {
    return (
      <Card className={className}>
        <CardContent className="pt-6">
          <p className="text-center text-muted-foreground">
            需要訪問多個城市才能進行對比分析
          </p>
        </CardContent>
      </Card>
    )
  }

  const isLoading = userLoading || dataLoading

  // --- Render ---
  return (
    <div className={className}>
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle>城市對比分析</CardTitle>
              <CardDescription>比較不同城市的關鍵績效指標</CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <CityMultiSelect
                value={selectedCities}
                onChange={setSelectedCities}
                maxSelection={5}
                minSelection={2}
              />
              <Select
                value={period}
                onValueChange={(v) => setPeriod(v as Period)}
              >
                <SelectTrigger className="w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7d">7 天</SelectItem>
                  <SelectItem value="30d">30 天</SelectItem>
                  <SelectItem value="90d">90 天</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={chartType}
                onValueChange={(v) => setChartType(v as ChartType)}
              >
                <SelectTrigger className="w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bar">柱狀圖</SelectItem>
                  <SelectItem value="radar">雷達圖</SelectItem>
                  <SelectItem value="trend">趨勢圖</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="h-[400px] flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="h-[400px] flex items-center justify-center">
              <p className="text-destructive">載入失敗，請稍後再試</p>
            </div>
          ) : !canCompare ? (
            <div className="h-[400px] flex items-center justify-center">
              <p className="text-muted-foreground">請選擇至少 2 個城市進行對比</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* 摘要卡片 */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {comparisonData?.comparison.slice(0, 3).map((comp) => (
                  <ComparisonCard key={comp.metric} comparison={comp} />
                ))}
              </div>

              {/* 圖表 */}
              <div className="h-[400px]">
                {chartType === 'bar' && (
                  <BarChartView data={comparisonData?.cities || []} />
                )}
                {chartType === 'radar' && (
                  <RadarChartView data={comparisonData?.cities || []} />
                )}
                {chartType === 'trend' && (
                  <TrendChartView data={comparisonData?.cities || []} />
                )}
              </div>

              {/* 詳細表格 */}
              <ComparisonTable
                cities={comparisonData?.cities || []}
                comparison={comparisonData?.comparison || []}
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
