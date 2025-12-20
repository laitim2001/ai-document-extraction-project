/**
 * @fileoverview 來源類型趨勢圖組件
 * @description
 *   顯示文件來源類型的月度趨勢堆疊長條圖
 *
 * @module src/components/features/document-source/SourceTypeTrend
 * @author Development Team
 * @since Epic 9 - Story 9.5 (自動獲取來源追蹤)
 * @lastModified 2025-12-20
 */

'use client'

import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import {
  SOURCE_TYPE_CONFIG,
  SOURCE_TYPE_CHART_COLORS,
} from '@/lib/constants/source-types'
import type { SourceTypeTrendData } from '@/types/document-source.types'

// ============================================================
// Types
// ============================================================

interface SourceTypeTrendProps {
  /** 城市 ID 篩選 */
  cityId?: string
  /** 顯示月數 */
  months?: number
  /** 標題 */
  title?: string
}

// ============================================================
// Component
// ============================================================

/**
 * @component SourceTypeTrend
 * @description 來源類型月度趨勢圖
 */
export function SourceTypeTrend({
  cityId,
  months = 6,
  title = '來源類型趨勢',
}: SourceTypeTrendProps) {
  const { data, isLoading } = useQuery<{ data: SourceTypeTrendData[] }>({
    queryKey: ['source-type-trend', cityId, months],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (cityId) params.set('cityId', cityId)
      params.set('months', months.toString())

      const response = await fetch(`/api/documents/sources/trend?${params}`)
      if (!response.ok) throw new Error('Failed to fetch trend')
      return response.json()
    },
  })

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[300px] w-full" />
        </CardContent>
      </Card>
    )
  }

  const trendData = data?.data || []

  if (trendData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-[300px] text-muted-foreground">
            暫無資料
          </div>
        </CardContent>
      </Card>
    )
  }

  // 格式化月份
  const formattedData = trendData.map((item) => ({
    ...item,
    month: formatMonth(item.month),
  }))

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={formattedData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 12 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
              <Tooltip />
              <Legend />
              <Bar
                dataKey="MANUAL_UPLOAD"
                name={SOURCE_TYPE_CONFIG.MANUAL_UPLOAD.label}
                fill={SOURCE_TYPE_CHART_COLORS.MANUAL_UPLOAD}
                stackId="stack"
              />
              <Bar
                dataKey="SHAREPOINT"
                name={SOURCE_TYPE_CONFIG.SHAREPOINT.label}
                fill={SOURCE_TYPE_CHART_COLORS.SHAREPOINT}
                stackId="stack"
              />
              <Bar
                dataKey="OUTLOOK"
                name={SOURCE_TYPE_CONFIG.OUTLOOK.label}
                fill={SOURCE_TYPE_CHART_COLORS.OUTLOOK}
                stackId="stack"
              />
              <Bar
                dataKey="API"
                name={SOURCE_TYPE_CONFIG.API.label}
                fill={SOURCE_TYPE_CHART_COLORS.API}
                stackId="stack"
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}

/**
 * 格式化月份
 */
function formatMonth(monthStr: string): string {
  const [year, month] = monthStr.split('-')
  return `${year}/${month}`
}
