'use client'

/**
 * @fileoverview 城市成本報表內容組件
 * @description
 *   城市成本報表頁面的主要內容組件：
 *   - 成本摘要統計卡片
 *   - 城市成本表格
 *   - 異常警示與分析對話框
 *   - 篩選與重新整理功能
 *
 * @module src/components/reports/CityCostReportContent
 * @since Epic 7 - Story 7.9 (城市成本報表)
 * @lastModified 2025-12-19
 */

import * as React from 'react'
import { useState, useCallback, useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DollarSign,
  TrendingUp,
  AlertTriangle,
  FileText,
  RefreshCw,
  ArrowUpRight,
  ArrowDownRight,
  Users,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useCityFilter } from '@/hooks/useCityFilter'
import {
  useCityCostReport,
  useCityCostReportActions,
} from '@/hooks/use-city-cost-report'
import { CityCostTable } from '@/components/features/reports/CityCostTable'
import { CostAnomalyDialog } from '@/components/features/reports/CostAnomalyDialog'
import type { CostAnomalyDetail } from '@/types/city-cost'

// ============================================================
// Constants
// ============================================================

const DATE_RANGE_OPTIONS = [
  { value: '7', label: '過去 7 天' },
  { value: '14', label: '過去 14 天' },
  { value: '30', label: '過去 30 天' },
  { value: '60', label: '過去 60 天' },
  { value: '90', label: '過去 90 天' },
]

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
  loading = false,
}: {
  title: string
  value: number
  change?: number | null
  icon: React.ElementType
  format?: 'number' | 'currency' | 'percent'
  loading?: boolean
}) {
  const formatValue = (v: number) => {
    switch (format) {
      case 'currency':
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }).format(v)
      case 'percent':
        return `${v.toFixed(1)}%`
      default:
        return v.toLocaleString()
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-4" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-3 w-20 mt-2" />
        </CardContent>
      </Card>
    )
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
          <p
            className={cn(
              'text-xs flex items-center gap-1',
              change > 0
                ? 'text-red-500'
                : change < 0
                  ? 'text-green-500'
                  : 'text-muted-foreground'
            )}
          >
            {change > 0 ? (
              <ArrowUpRight className="h-3 w-3" />
            ) : change < 0 ? (
              <ArrowDownRight className="h-3 w-3" />
            ) : null}
            {Math.abs(change).toFixed(1)}% 較上期
          </p>
        )}
      </CardContent>
    </Card>
  )
}

// ============================================================
// Main Component
// ============================================================

export function CityCostReportContent() {
  // --- State ---
  const [dateRange, setDateRange] = useState('30')
  const [selectedCityCode, setSelectedCityCode] = useState<string | null>(null)
  const [selectedCityName, setSelectedCityName] = useState<string | null>(null)
  const [selectedAnomalies, setSelectedAnomalies] = useState<CostAnomalyDetail[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)

  // --- Hooks ---
  const { effectiveCities, isFiltered } = useCityFilter()
  const { invalidateAll } = useCityCostReportActions()

  // --- Calculate date range ---
  const endDate = useMemo(() => {
    const date = new Date()
    return date.toISOString().split('T')[0]
  }, [])

  const startDate = useMemo(() => {
    const date = new Date()
    date.setDate(date.getDate() - parseInt(dateRange))
    return date.toISOString().split('T')[0]
  }, [dateRange])

  // --- API Query ---
  const {
    isLoading,
    isError,
    error,
    reports,
    totals,
  } = useCityCostReport({
    startDate,
    endDate,
    cityCodes: isFiltered ? effectiveCities : undefined,
    includeTrend: true,
    includeAnomalies: true,
  })

  // --- Computed values ---
  const totalAnomalies = useMemo(() => {
    if (!reports) return 0
    return reports.reduce((sum, r) => sum + (r.anomalies?.length || 0), 0)
  }, [reports])

  const highSeverityAnomalies = useMemo(() => {
    if (!reports) return 0
    return reports.reduce(
      (sum, r) =>
        sum + (r.anomalies?.filter((a) => a.severity === 'high').length || 0),
      0
    )
  }, [reports])

  // --- Handlers ---
  const handleRefresh = useCallback(() => {
    invalidateAll()
  }, [invalidateAll])

  const handleCityClick = useCallback(
    (cityCode: string) => {
      const report = reports.find((r) => r.cityCode === cityCode)
      if (report && report.anomalies && report.anomalies.length > 0) {
        setSelectedCityCode(cityCode)
        setSelectedCityName(report.cityName)
        setSelectedAnomalies(report.anomalies)
        setDialogOpen(true)
      }
    },
    [reports]
  )

  const handleAnomalyClick = useCallback(
    (cityCode: string, anomaly: CostAnomalyDetail) => {
      const report = reports.find((r) => r.cityCode === cityCode)
      if (report) {
        setSelectedCityCode(cityCode)
        setSelectedCityName(report.cityName)
        setSelectedAnomalies(report.anomalies || [anomaly])
        setDialogOpen(true)
      }
    },
    [reports]
  )

  const handleDialogClose = useCallback(() => {
    setDialogOpen(false)
    setSelectedCityCode(null)
    setSelectedCityName(null)
    setSelectedAnomalies([])
  }, [])

  // --- Error state ---
  if (isError) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>載入失敗</AlertTitle>
        <AlertDescription>
          {error instanceof Error ? error.message : '無法載入城市成本報表'}
        </AlertDescription>
      </Alert>
    )
  }

  // --- Render ---
  return (
    <div className="space-y-6">
      {/* 控制列 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="選擇時間範圍" />
            </SelectTrigger>
            <SelectContent>
              {DATE_RANGE_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button variant="outline" size="sm" onClick={handleRefresh}>
          <RefreshCw className="h-4 w-4 mr-2" />
          重新整理
        </Button>
      </div>

      {/* 統計卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard
          title="總成本"
          value={totals?.totalCost || 0}
          icon={DollarSign}
          format="currency"
          loading={isLoading}
        />
        <StatCard
          title="處理文檔數"
          value={totals?.totalDocuments || 0}
          icon={FileText}
          loading={isLoading}
        />
        <StatCard
          title="平均自動化率"
          value={totals?.overallAutomationRate || 0}
          icon={TrendingUp}
          format="percent"
          loading={isLoading}
        />
        <StatCard
          title="城市數量"
          value={reports?.length || 0}
          icon={Users}
          loading={isLoading}
        />
      </div>

      {/* 異常警示 */}
      {highSeverityAnomalies > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>成本異常警示</AlertTitle>
          <AlertDescription>
            在過去 {dateRange} 天內檢測到 {highSeverityAnomalies} 個高風險異常，
            請點擊城市行查看詳情。
          </AlertDescription>
        </Alert>
      )}

      {/* 成本摘要 */}
      {totals && (
        <Card>
          <CardHeader>
            <CardTitle>成本摘要</CardTitle>
            <CardDescription>
              {startDate} 至 {endDate} 期間的成本統計
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <div className="text-muted-foreground">AI 成本</div>
                <div className="text-lg font-medium">
                  {new Intl.NumberFormat('en-US', {
                    style: 'currency',
                    currency: 'USD',
                  }).format(totals.totalApiCost)}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">人工成本（估算）</div>
                <div className="text-lg font-medium">
                  {new Intl.NumberFormat('en-US', {
                    style: 'currency',
                    currency: 'USD',
                  }).format(totals.totalLaborCost)}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">總成本</div>
                <div className="text-lg font-medium">
                  {new Intl.NumberFormat('en-US', {
                    style: 'currency',
                    currency: 'USD',
                  }).format(totals.totalCost)}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">平均單位成本</div>
                <div className="text-lg font-medium">
                  {new Intl.NumberFormat('en-US', {
                    style: 'currency',
                    currency: 'USD',
                  }).format(totals.averageCostPerDocument)}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 城市成本表格 */}
      <Card>
        <CardHeader>
          <CardTitle>城市成本明細</CardTitle>
          <CardDescription>
            各城市的成本、處理量與異常狀態
            {totalAnomalies > 0 && (
              <span className="ml-2 text-amber-600">
                （{totalAnomalies} 個異常）
              </span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : (
            <CityCostTable
              reports={reports}
              showAnomalies={true}
              onCityClick={handleCityClick}
              onAnomalyClick={handleAnomalyClick}
            />
          )}
        </CardContent>
      </Card>

      {/* 異常詳情對話框 */}
      <CostAnomalyDialog
        open={dialogOpen}
        onClose={handleDialogClose}
        cityCode={selectedCityCode || ''}
        cityName={selectedCityName || ''}
        anomalies={selectedAnomalies}
      />
    </div>
  )
}

export default CityCostReportContent
