'use client'

/**
 * @fileoverview AI 成本報表內容組件
 * @description
 *   AI API 成本分析頁面的主要內容組件：
 *   - 成本摘要統計卡片
 *   - 成本趨勢圖表
 *   - Provider 成本分佈
 *   - 異常警示列表
 *   - 每日使用明細表格
 *
 * @module src/components/reports/AiCostReportContent
 * @since Epic 7 - Story 7.6 (AI API 使用成本顯示)
 * @lastModified 2025-12-19
 */

import * as React from 'react'
import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  DollarSign,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Cpu,
  RefreshCw,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts'
import { cn } from '@/lib/utils'
import { useCityFilter } from '@/hooks/useCityFilter'
import {
  useAiCostSummary,
  useAiCostTrend,
  useAiCostAnomalies,
  useAiCostDailyDetail,
} from '@/hooks/useAiCost'
import type {
  Granularity,
  ApiProviderType,
  Anomaly,
  AnomalySeverity,
} from '@/types/ai-cost'

// ============================================================
// Constants
// ============================================================

const PROVIDER_COLORS: Record<ApiProviderType, string> = {
  AZURE_DOC_INTELLIGENCE: '#0078d4',
  OPENAI: '#10a37f',
  AZURE_OPENAI: '#00bcf2',
}

const PROVIDER_NAMES: Record<ApiProviderType, string> = {
  AZURE_DOC_INTELLIGENCE: 'Azure Doc Intelligence',
  OPENAI: 'OpenAI',
  AZURE_OPENAI: 'Azure OpenAI',
}

const SEVERITY_STYLES: Record<AnomalySeverity, { bg: string; text: string; icon: string }> = {
  low: { bg: 'bg-blue-100', text: 'text-blue-700', icon: 'text-blue-500' },
  medium: { bg: 'bg-yellow-100', text: 'text-yellow-700', icon: 'text-yellow-500' },
  high: { bg: 'bg-orange-100', text: 'text-orange-700', icon: 'text-orange-500' },
  critical: { bg: 'bg-red-100', text: 'text-red-700', icon: 'text-red-500' },
}

const DATE_RANGE_OPTIONS = ['7', '14', '30', '90'] as const

// ============================================================
// Sub-components
// ============================================================

/**
 * 統計卡片
 */
function StatCard({
  title,
  value,
  change,
  icon: Icon,
  format = 'number',
  changeLabel,
}: {
  title: string
  value: number
  change?: number | null
  icon: React.ElementType
  format?: 'number' | 'currency' | 'percent'
  changeLabel: string
}) {
  const formatValue = (v: number) => {
    switch (format) {
      case 'currency':
        return `$${v.toFixed(4)}`
      case 'percent':
        return `${v.toFixed(1)}%`
      default:
        return v.toLocaleString()
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{formatValue(value)}</div>
        {change !== undefined && change !== null && (
          <p className={cn(
            'text-xs flex items-center gap-1',
            change > 0 ? 'text-red-500' : change < 0 ? 'text-green-500' : 'text-muted-foreground'
          )}>
            {change > 0 ? (
              <ArrowUpRight className="h-3 w-3" />
            ) : change < 0 ? (
              <ArrowDownRight className="h-3 w-3" />
            ) : null}
            {Math.abs(change).toFixed(1)}% {changeLabel}
          </p>
        )}
      </CardContent>
    </Card>
  )
}

/**
 * 異常警示項
 */
function AnomalyItem({
  anomaly,
  t,
}: {
  anomaly: Anomaly
  t: ReturnType<typeof useTranslations>
}) {
  const styles = SEVERITY_STYLES[anomaly.severity]

  return (
    <div className={cn('p-3 rounded-lg', styles.bg)}>
      <div className="flex items-start gap-3">
        <AlertTriangle className={cn('h-5 w-5 mt-0.5', styles.icon)} />
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={styles.text}>
              {anomaly.severity.toUpperCase()}
            </Badge>
            <span className="text-sm text-muted-foreground">{anomaly.date}</span>
          </div>
          <p className={cn('mt-1 text-sm', styles.text)}>{anomaly.description}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {t('aiCost.report.currentValue', { value: anomaly.currentValue.toFixed(2) })} |{' '}
            {t('aiCost.report.baselineValue', { value: anomaly.baselineValue.toFixed(2) })} |{' '}
            {t('aiCost.report.deviation', { value: anomaly.deviationPercentage.toFixed(1) })}
          </p>
        </div>
      </div>
    </div>
  )
}

// ============================================================
// Main Component
// ============================================================

export function AiCostReportContent() {
  // i18n
  const t = useTranslations('reports')
  const tCommon = useTranslations('common')

  // 狀態
  const [dateRange, setDateRange] = useState('30')
  const [granularity, setGranularity] = useState<Granularity>('day')
  // Note: selectedDate 保留供未來每日明細功能使用
  const [selectedDate, _setSelectedDate] = useState<string | null>(null)

  // 從 Hook 獲取城市過濾
  const { effectiveCities, isFiltered } = useCityFilter()

  // 計算日期範圍
  const endDate = new Date()
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - parseInt(dateRange))

  // API Queries
  const {
    data: summaryData,
    isLoading: summaryLoading,
    refetch: refetchSummary,
  } = useAiCostSummary({
    cityCodes: isFiltered ? effectiveCities : undefined,
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0],
  })

  const { data: trendData, isLoading: trendLoading } = useAiCostTrend({
    cityCodes: isFiltered ? effectiveCities : undefined,
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0],
    granularity,
  })

  const { data: anomalyData, isLoading: anomalyLoading } = useAiCostAnomalies({
    cityCodes: isFiltered ? effectiveCities : undefined,
    days: parseInt(dateRange),
  })

  // Note: dailyData 保留供未來每日明細功能使用
  const { data: _dailyData, isLoading: _dailyLoading } = useAiCostDailyDetail(
    {
      date: selectedDate || endDate.toISOString().split('T')[0],
      cityCodes: isFiltered ? effectiveCities : undefined,
      page: 1,
      limit: 20,
    },
    { enabled: Boolean(selectedDate) }
  )

  const summary = summaryData?.data
  const trend = trendData?.data
  const anomalies = anomalyData?.data

  // 準備圖表數據
  const trendChartData = trend?.data.map((d) => ({
    date: d.date,
    cost: d.totalCost,
    calls: d.totalCalls,
    ...d.providerCosts.reduce(
      (acc, p) => ({
        ...acc,
        [p.provider]: p.cost,
      }),
      {}
    ),
  })) || []

  const providerPieData = summary?.providerBreakdown.map((p) => ({
    name: PROVIDER_NAMES[p.provider],
    value: p.totalCost,
    fill: PROVIDER_COLORS[p.provider],
  })) || []

  return (
    <div className="space-y-6">
      {/* 控制列 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder={t('aiCost.report.selectTimeRange')} />
            </SelectTrigger>
            <SelectContent>
              {DATE_RANGE_OPTIONS.map((days) => (
                <SelectItem key={days} value={days}>
                  {t('aiCost.report.dateRangeOption', { days })}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={granularity} onValueChange={(v) => setGranularity(v as Granularity)}>
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder={t('aiCost.report.granularity')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="day">{t('aiCost.report.granularityDay')}</SelectItem>
              <SelectItem value="week">{t('aiCost.report.granularityWeek')}</SelectItem>
              <SelectItem value="month">{t('aiCost.report.granularityMonth')}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button variant="outline" size="sm" onClick={() => refetchSummary()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          {tCommon('actions.refresh')}
        </Button>
      </div>

      {/* 統計卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {summaryLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))
        ) : summary ? (
          <>
            <StatCard
              title={t('aiCost.report.totalCost')}
              value={summary.totalCost}
              change={summary.costChangePercentage}
              icon={DollarSign}
              format="currency"
              changeLabel={t('performance.comparison.vsLastPeriod')}
            />
            <StatCard
              title={t('aiCost.report.totalCalls')}
              value={summary.totalCalls}
              change={summary.callsChangePercentage}
              icon={Cpu}
              changeLabel={t('performance.comparison.vsLastPeriod')}
            />
            <StatCard
              title={t('aiCost.report.successRate')}
              value={summary.overallSuccessRate}
              icon={CheckCircle}
              format="percent"
              changeLabel={t('performance.comparison.vsLastPeriod')}
            />
            <StatCard
              title={t('aiCost.report.avgCostPerCall')}
              value={summary.totalCalls > 0 ? summary.totalCost / summary.totalCalls : 0}
              icon={TrendingUp}
              format="currency"
              changeLabel={t('performance.comparison.vsLastPeriod')}
            />
          </>
        ) : null}
      </div>

      {/* 異常警示 */}
      {anomalies && (anomalies.severityCounts.high > 0 || anomalies.severityCounts.critical > 0) && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>{t('aiCost.report.anomalyAlertTitle')}</AlertTitle>
          <AlertDescription>
            {t('aiCost.report.anomalyAlertDescription', {
              days: dateRange,
              count: anomalies.severityCounts.high + anomalies.severityCounts.critical,
            })}
          </AlertDescription>
        </Alert>
      )}

      {/* 圖表區 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 趨勢圖表 */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>{t('aiCost.report.costTrendTitle')}</CardTitle>
            <CardDescription>{t('aiCost.report.costTrendDesc')}</CardDescription>
          </CardHeader>
          <CardContent>
            {trendLoading ? (
              <Skeleton className="h-[300px]" />
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={trendChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" fontSize={12} />
                  <YAxis fontSize={12} tickFormatter={(v) => `$${v.toFixed(2)}`} />
                  <Tooltip
                    formatter={(value) => [
                      `$${Number(value ?? 0).toFixed(4)}`,
                      t('aiCost.costLabel'),
                    ]}
                    labelFormatter={(label) =>
                      t('aiCost.report.dateLabel', { date: String(label) })
                    }
                  />
                  <Area
                    type="monotone"
                    dataKey="cost"
                    stroke="#8884d8"
                    fill="#8884d8"
                    fillOpacity={0.3}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Provider 分佈 */}
        <Card>
          <CardHeader>
            <CardTitle>{t('aiCost.report.providerDistTitle')}</CardTitle>
            <CardDescription>{t('aiCost.report.providerDistDesc')}</CardDescription>
          </CardHeader>
          <CardContent>
            {summaryLoading ? (
              <Skeleton className="h-[300px]" />
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={providerPieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={({ name, percent }) =>
                      `${name}: ${((percent ?? 0) * 100).toFixed(0)}%`
                    }
                    labelLine
                  >
                    {providerPieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value) => [
                      `$${Number(value ?? 0).toFixed(4)}`,
                      t('aiCost.costLabel'),
                    ]}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tabs: 異常列表 & Provider 詳情 */}
      <Tabs defaultValue="anomalies">
        <TabsList>
          <TabsTrigger value="anomalies">
            {t('aiCost.report.tabAnomalies')}
          </TabsTrigger>
          <TabsTrigger value="providers">
            {t('aiCost.report.tabProviders')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="anomalies" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>{t('aiCost.report.anomalyResultTitle')}</CardTitle>
              <CardDescription>
                {t('aiCost.report.anomalyResultDesc', { days: dateRange })}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {anomalyLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-20" />
                  ))}
                </div>
              ) : anomalies?.anomalies.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle className="h-12 w-12 mx-auto mb-2 text-green-500" />
                  <p>{t('aiCost.report.noAnomalies')}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {anomalies?.anomalies.map((anomaly) => (
                    <AnomalyItem key={anomaly.id} anomaly={anomaly} t={t} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="providers" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>{t('aiCost.report.providerStatsTitle')}</CardTitle>
              <CardDescription>{t('aiCost.report.providerStatsDesc')}</CardDescription>
            </CardHeader>
            <CardContent>
              {summaryLoading ? (
                <Skeleton className="h-[200px]" />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('aiCost.report.colProvider')}</TableHead>
                      <TableHead className="text-right">{t('aiCost.report.colTotalCalls')}</TableHead>
                      <TableHead className="text-right">{t('aiCost.report.colSuccess')}</TableHead>
                      <TableHead className="text-right">{t('aiCost.report.colFailed')}</TableHead>
                      <TableHead className="text-right">{t('aiCost.report.colSuccessRate')}</TableHead>
                      <TableHead className="text-right">{t('aiCost.report.colTotalCost')}</TableHead>
                      <TableHead className="text-right">{t('aiCost.report.colAvgCost')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {summary?.providerBreakdown.map((p) => (
                      <TableRow key={p.provider}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <div
                              className="h-3 w-3 rounded-full"
                              style={{ backgroundColor: PROVIDER_COLORS[p.provider] }}
                            />
                            {PROVIDER_NAMES[p.provider]}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          {p.totalCalls.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right text-green-600">
                          {p.successCalls.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right text-red-600">
                          {p.failedCalls.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right">
                          {p.successRate.toFixed(1)}%
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          ${p.totalCost.toFixed(4)}
                        </TableCell>
                        <TableCell className="text-right">
                          ${p.averageCostPerCall.toFixed(6)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default AiCostReportContent
