'use client'

/**
 * @fileoverview 城市詳情面板組件
 * @description
 *   顯示單一城市的詳細數據：
 *   - 處理趨勢圖表
 *   - Top Forwarders 列表
 *   - 支援按日/週/月查看
 *
 * @module src/components/reports/CityDetailPanel
 * @since Epic 7 - Story 7.5 (跨城市匯總報表)
 * @lastModified 2025-12-19
 *
 * @features
 *   - AC3: 城市詳情展開（趨勢圖表、Top Forwarders）
 *
 * @dependencies
 *   - @/components/ui/* - shadcn/ui 組件
 *   - @/contexts/DashboardFilterContext - 篩選器 Context
 *   - @/types/regional-report - 區域報表類型
 *   - recharts - 圖表庫
 *   - @tanstack/react-query - 資料查詢
 */

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
} from 'recharts'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { AlertCircle } from 'lucide-react'
import { useDashboardFilter } from '@/contexts/DashboardFilterContext'
import type { CityDetailReport, CityDetailResponse } from '@/types/regional-report'
import { formatISODate } from '@/lib/date-range-utils'

// ============================================================
// Types
// ============================================================

interface CityDetailPanelProps {
  /** 城市代碼 */
  cityCode: string
}

// ============================================================
// Component
// ============================================================

/**
 * 城市詳情面板組件
 *
 * @description
 *   顯示城市的詳細處理數據：
 *   - 處理趨勢圖表（處理量、成功率）
 *   - Top Forwarders 排行
 *
 * @example
 * ```tsx
 * <CityDetailPanel cityCode="HKG" />
 * ```
 */
export function CityDetailPanel({ cityCode }: CityDetailPanelProps) {
  const { dateRange } = useDashboardFilter()

  const { data, isLoading, error } = useQuery<CityDetailReport>({
    queryKey: ['city-detail', cityCode, dateRange.startDate, dateRange.endDate],
    queryFn: async () => {
      const params = new URLSearchParams({
        startDate: formatISODate(dateRange.startDate),
        endDate: formatISODate(dateRange.endDate),
        granularity: 'day'
      })
      const response = await fetch(
        `/api/reports/regional/city/${cityCode}?${params}`
      )
      if (!response.ok) throw new Error('Failed to fetch')
      const result: CityDetailResponse = await response.json()
      if (!result.success || !result.data) throw new Error(result.error || 'Unknown error')
      return result.data
    }
  })

  // 載入狀態
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

  // 錯誤狀態
  if (error || !data) {
    return (
      <div className="p-6 bg-muted/30">
        <div className="flex items-center justify-center gap-2 text-muted-foreground py-8">
          <AlertCircle className="h-5 w-5" />
          <span>載入失敗，請重試</span>
        </div>
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
              {data.trend.length > 0 ? (
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
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '6px'
                      }}
                      formatter={(value: number | undefined, name: string | undefined) => {
                        const displayName = name ?? ''
                        if (value === undefined) return ['-', displayName]
                        if (displayName === '成功率 %') {
                          return [`${value.toFixed(1)}%`, displayName]
                        }
                        return [value.toLocaleString(), displayName]
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
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  此期間無趨勢數據
                </div>
              )}
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
