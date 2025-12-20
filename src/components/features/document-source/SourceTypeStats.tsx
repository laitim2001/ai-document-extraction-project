/**
 * @fileoverview 來源類型統計圖組件
 * @description
 *   顯示文件來源類型分佈的圓餅圖
 *
 * @module src/components/features/document-source/SourceTypeStats
 * @author Development Team
 * @since Epic 9 - Story 9.5 (自動獲取來源追蹤)
 * @lastModified 2025-12-20
 */

'use client'

import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from 'recharts'
import {
  SOURCE_TYPE_CONFIG,
  SOURCE_TYPE_CHART_COLORS,
} from '@/lib/constants/source-types'
import { DocumentSourceType } from '@prisma/client'
import type { SourceTypeStats as StatsType } from '@/types/document-source.types'

// ============================================================
// Types
// ============================================================

interface SourceTypeStatsProps {
  /** 城市 ID 篩選 */
  cityId?: string
  /** 開始日期 */
  dateFrom?: Date
  /** 結束日期 */
  dateTo?: Date
  /** 標題 */
  title?: string
}

// ============================================================
// Component
// ============================================================

/**
 * @component SourceTypeStats
 * @description 來源類型分佈圓餅圖
 */
export function SourceTypeStats({
  cityId,
  dateFrom,
  dateTo,
  title = '文件來源分佈',
}: SourceTypeStatsProps) {
  const { data, isLoading } = useQuery<{ data: StatsType[] }>({
    queryKey: [
      'source-type-stats',
      cityId,
      dateFrom?.toISOString(),
      dateTo?.toISOString(),
    ],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (cityId) params.set('cityId', cityId)
      if (dateFrom) params.set('dateFrom', dateFrom.toISOString())
      if (dateTo) params.set('dateTo', dateTo.toISOString())

      const response = await fetch(`/api/documents/sources/stats?${params}`)
      if (!response.ok) throw new Error('Failed to fetch stats')
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
          <Skeleton className="h-[200px] w-full" />
        </CardContent>
      </Card>
    )
  }

  const stats = data?.data || []
  const total = stats.reduce((sum, s) => sum + s.count, 0)

  const chartData = stats.map((s) => ({
    name:
      SOURCE_TYPE_CONFIG[s.sourceType as DocumentSourceType]?.label ||
      s.sourceType,
    value: s.count,
    percentage: s.percentage,
    fill:
      SOURCE_TYPE_CHART_COLORS[s.sourceType as DocumentSourceType] || '#94a3b8',
  }))

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {total === 0 ? (
          <div className="flex items-center justify-center h-[200px] text-muted-foreground">
            暫無資料
          </div>
        ) : (
          <div className="flex items-center gap-6">
            {/* 圓餅圖 */}
            <div className="w-[180px] h-[180px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={75}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value, name) => [
                      `${value} 個文件`,
                      name as string,
                    ]}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* 圖例與數據 */}
            <div className="flex-1 space-y-3">
              {chartData.map((item) => (
                <div
                  key={item.name}
                  className="flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: item.fill }}
                    />
                    <span className="text-sm">{item.name}</span>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">
                      {item.value}
                    </span>{' '}
                    ({item.percentage}%)
                  </div>
                </div>
              ))}

              <div className="border-t pt-3 mt-3">
                <div className="flex items-center justify-between font-medium">
                  <span>總計</span>
                  <span>{total} 個文件</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
