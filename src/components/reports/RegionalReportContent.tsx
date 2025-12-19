'use client'

/**
 * @fileoverview 區域報表內容組件
 * @description
 *   區域報表頁面的主要內容組件：
 *   - 整合日期範圍篩選
 *   - 區域匯總統計卡片
 *   - 城市對比表格
 *
 * @module src/components/reports/RegionalReportContent
 * @since Epic 7 - Story 7.5 (跨城市匯總報表)
 * @lastModified 2025-12-19
 *
 * @features
 *   - AC1: 區域報表頁面入口
 *   - AC2: 對比數據內容
 *
 * @dependencies
 *   - @/components/ui/* - shadcn/ui 組件
 *   - @/components/reports/* - 報表組件
 *   - @/contexts/DashboardFilterContext - 篩選器 Context
 *   - @/types/regional-report - 區域報表類型
 *   - @tanstack/react-query - 資料查詢
 */

import { useQuery } from '@tanstack/react-query'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Building2, CheckCircle2, Zap, DollarSign, AlertCircle } from 'lucide-react'
import { useDashboardFilter } from '@/contexts/DashboardFilterContext'
import { CityComparisonTable } from './CityComparisonTable'
import { DateRangePicker } from '@/components/dashboard/DateRangePicker'
import type { RegionalSummary, RegionalSummaryResponse } from '@/types/regional-report'
import { formatISODate } from '@/lib/date-range-utils'

// ============================================================
// Types
// ============================================================

interface StatCardProps {
  title: string
  value: string | number
  description?: string
  icon: React.ReactNode
  loading?: boolean
}

// ============================================================
// Sub-Components
// ============================================================

/**
 * 統計卡片組件
 */
function StatCard({ title, value, description, icon, loading }: StatCardProps) {
  if (loading) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-4" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-8 w-20" />
          <Skeleton className="h-3 w-32 mt-1" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <div className="text-muted-foreground">{icon}</div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </CardContent>
    </Card>
  )
}

// ============================================================
// Main Component
// ============================================================

/**
 * 區域報表內容組件
 *
 * @description
 *   整合區域報表頁面的所有內容：
 *   - 匯總統計卡片
 *   - 城市對比表格
 *   - 日期範圍篩選
 *
 * @example
 * ```tsx
 * <DashboardFilterProvider>
 *   <RegionalReportContent />
 * </DashboardFilterProvider>
 * ```
 */
export function RegionalReportContent() {
  const { dateRange } = useDashboardFilter()

  const { data, isLoading, error } = useQuery<RegionalSummary>({
    queryKey: ['regional-summary', dateRange.startDate, dateRange.endDate],
    queryFn: async () => {
      const params = new URLSearchParams({
        startDate: formatISODate(dateRange.startDate),
        endDate: formatISODate(dateRange.endDate)
      })
      const response = await fetch(`/api/reports/regional/summary?${params}`)
      if (!response.ok) throw new Error('Failed to fetch')
      const result: RegionalSummaryResponse = await response.json()
      if (!result.success || !result.data) throw new Error(result.error || 'Unknown error')
      return result.data
    }
  })

  // 錯誤狀態
  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>載入失敗</AlertTitle>
        <AlertDescription>
          {error instanceof Error ? error.message : '無法載入區域報表，請稍後再試'}
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-6">
      {/* 篩選器 */}
      <div className="flex justify-end">
        <DateRangePicker />
      </div>

      {/* 匯總統計卡片 */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="城市總數"
          value={data?.totalCities ?? '-'}
          description="管轄城市數量"
          icon={<Building2 className="h-4 w-4" />}
          loading={isLoading}
        />
        <StatCard
          title="總處理量"
          value={data?.totalVolume.toLocaleString() ?? '-'}
          description="選定期間處理文件數"
          icon={<CheckCircle2 className="h-4 w-4" />}
          loading={isLoading}
        />
        <StatCard
          title="平均成功率"
          value={data ? `${data.avgSuccessRate.toFixed(1)}%` : '-'}
          description="加權平均"
          icon={<Zap className="h-4 w-4" />}
          loading={isLoading}
        />
        <StatCard
          title="總 AI 成本"
          value={data ? `$${data.totalAiCost.toFixed(2)}` : '-'}
          description="選定期間累計成本"
          icon={<DollarSign className="h-4 w-4" />}
          loading={isLoading}
        />
      </div>

      {/* 城市對比表格 */}
      <Card>
        <CardHeader>
          <CardTitle>城市處理對比</CardTitle>
          <CardDescription>
            點擊城市列查看詳細趨勢和 Top Forwarders
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CityComparisonTable
            cities={data?.cities ?? []}
            loading={isLoading}
          />
        </CardContent>
      </Card>
    </div>
  )
}
