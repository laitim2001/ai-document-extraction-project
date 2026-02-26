'use client'

/**
 * @fileoverview GlobalTrend 全局趨勢組件
 * @description
 *   顯示全局趨勢圖表：
 *   - 每日處理量趨勢
 *   - 成功率趨勢
 *   - 信心度趨勢
 *   - 可切換時間週期
 *
 * @module src/components/features/global/GlobalTrend
 * @author Development Team
 * @since Epic 6 - Story 6.4 (Global Admin Full Access)
 * @lastModified 2025-12-19
 *
 * @features
 *   - 多指標趨勢線圖
 *   - 時間週期切換
 *   - 懸停數據提示
 *   - 響應式圖表
 *
 * @dependencies
 *   - @tanstack/react-query - 數據獲取
 *   - recharts - 圖表庫
 *   - lucide-react - 圖標
 *
 * @related
 *   - src/app/(dashboard)/global/page.tsx - 全局儀表板頁面
 *   - src/app/api/analytics/global/route.ts - 全局分析 API
 */

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { TrendingUp } from 'lucide-react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'

// ============================================================
// Types
// ============================================================

interface DailyTrendItem {
  date: string
  documents: number
  successRate: number
  confidence: number
}

interface GlobalTrendProps {
  /** 初始時間週期 */
  initialPeriod?: '7d' | '30d' | '90d'
}

// ============================================================
// Component
// ============================================================

/**
 * @component GlobalTrend
 * @description 顯示全局處理趨勢的折線圖組件
 */
export function GlobalTrend({ initialPeriod = '30d' }: GlobalTrendProps) {
  const t = useTranslations('global')
  const [period, setPeriod] = useState<'7d' | '30d' | '90d'>(initialPeriod)
  const [activeMetric, setActiveMetric] = useState<
    'all' | 'documents' | 'successRate' | 'confidence'
  >('all')

  const { data, isLoading } = useQuery({
    queryKey: ['global-analytics', period],
    queryFn: async () => {
      const response = await fetch(`/api/analytics/global?period=${period}`)
      if (!response.ok) throw new Error('Failed to fetch')
      return response.json()
    },
  })

  if (isLoading) {
    return <GlobalTrendSkeleton />
  }

  const dailyTrend: DailyTrendItem[] = data?.data?.dailyTrend || []

  // 圖表數據使用 key 而非翻譯後的文字（供圖表內部使用）
  const chartData = dailyTrend.map((item) => ({
    date: formatDate(item.date),
    volume: item.documents,
    successRate: Math.round(item.successRate * 100),
    confidence: Math.round(item.confidence * 100),
  }))

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-blue-500" />
            {t('trend.title')}
          </CardTitle>
          <div className="flex items-center gap-4">
            <Select
              value={activeMetric}
              onValueChange={(v) =>
                setActiveMetric(
                  v as 'all' | 'documents' | 'successRate' | 'confidence'
                )
              }
            >
              <SelectTrigger className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('trend.metrics.all')}</SelectItem>
                <SelectItem value="documents">{t('trend.metrics.volume')}</SelectItem>
                <SelectItem value="successRate">{t('trend.metrics.successRate')}</SelectItem>
                <SelectItem value="confidence">{t('trend.metrics.confidence')}</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={period}
              onValueChange={(v) => setPeriod(v as typeof period)}
            >
              <SelectTrigger className="w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">{t('region.days7')}</SelectItem>
                <SelectItem value="30d">{t('region.days30')}</SelectItem>
                <SelectItem value="90d">{t('region.days90')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {chartData.length === 0 ? (
          <div className="h-[300px] flex items-center justify-center text-muted-foreground">
            {t('trend.noData')}
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 12 }}
                tickMargin={8}
              />
              <YAxis
                yAxisId="left"
                tick={{ fontSize: 12 }}
                tickMargin={8}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                tick={{ fontSize: 12 }}
                tickMargin={8}
                domain={[0, 100]}
                tickFormatter={(v) => `${v}%`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--background))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                }}
                labelStyle={{ color: 'hsl(var(--foreground))' }}
              />
              <Legend />

              {(activeMetric === 'all' || activeMetric === 'documents') && (
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="volume"
                  name={t('trend.metrics.volume')}
                  stroke="#8884d8"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                />
              )}

              {(activeMetric === 'all' || activeMetric === 'successRate') && (
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="successRate"
                  name={t('trend.metrics.successRate')}
                  stroke="#82ca9d"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                />
              )}

              {(activeMetric === 'all' || activeMetric === 'confidence') && (
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="confidence"
                  name={t('trend.metrics.confidence')}
                  stroke="#ffc658"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  )
}

// ============================================================
// Helper Functions
// ============================================================

/**
 * 格式化日期顯示
 */
function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return `${date.getMonth() + 1}/${date.getDate()}`
}

// ============================================================
// Skeleton Component
// ============================================================

/**
 * 載入骨架組件
 */
function GlobalTrendSkeleton() {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-5" />
            <Skeleton className="h-6 w-24" />
          </div>
          <div className="flex items-center gap-4">
            <Skeleton className="h-10 w-28" />
            <Skeleton className="h-10 w-24" />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Skeleton className="h-[300px] w-full" />
      </CardContent>
    </Card>
  )
}
