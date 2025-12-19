'use client'

/**
 * @fileoverview Forwarder 統計面板組件
 * @description
 *   顯示 Forwarder 的處理統計資料，包含：
 *   - 統計數字卡片（總數、成功率、信心度）
 *   - 30 天趨勢圖表
 *
 * @module src/components/features/forwarders/ForwarderStatsPanel
 * @author Development Team
 * @since Epic 5 - Story 5.2 (Forwarder Detail Config View)
 * @lastModified 2025-12-19
 *
 * @dependencies
 *   - recharts - 圖表庫
 *   - @/types/forwarder - 類型定義
 *   - @/components/ui - UI 組件
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { ForwarderStats, DailyTrendData } from '@/types/forwarder'
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
import { FileText, CheckCircle, TrendingUp, Activity } from 'lucide-react'

// ============================================================
// Types
// ============================================================

interface ForwarderStatsPanelProps {
  /** 統計資料 */
  stats: ForwarderStats
}

// ============================================================
// Sub Components
// ============================================================

interface StatCardProps {
  title: string
  value: string | number
  icon: React.ReactNode
  description?: string
  trend?: 'up' | 'down' | 'neutral'
}

function StatCard({ title, value, icon, description }: StatCardProps) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold mt-1">{value}</p>
            {description && (
              <p className="text-xs text-muted-foreground mt-1">{description}</p>
            )}
          </div>
          <div className="rounded-full bg-primary/10 p-3">{icon}</div>
        </div>
      </CardContent>
    </Card>
  )
}

// ============================================================
// Main Component
// ============================================================

/**
 * Forwarder 統計面板組件
 *
 * @description
 *   顯示處理統計和趨勢圖表
 */
export function ForwarderStatsPanel({ stats }: ForwarderStatsPanelProps) {
  // 格式化趨勢資料用於圖表
  const chartData = stats.dailyTrend.map((item: DailyTrendData) => ({
    date: item.date.slice(5), // 只顯示 MM-DD
    全部: item.count,
    成功: item.successCount,
  }))

  return (
    <div className="space-y-4">
      {/* 統計數字卡片 */}
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard
          title="文件總數"
          value={stats.totalDocuments.toLocaleString()}
          icon={<FileText className="h-5 w-5 text-primary" />}
        />
        <StatCard
          title="近 30 天處理"
          value={stats.processedLast30Days.toLocaleString()}
          icon={<Activity className="h-5 w-5 text-primary" />}
        />
        <StatCard
          title="成功率"
          value={`${stats.successRate}%`}
          icon={<CheckCircle className="h-5 w-5 text-green-600" />}
          description={stats.successRate >= 90 ? '表現優異' : stats.successRate >= 70 ? '表現良好' : '需要關注'}
        />
        <StatCard
          title="平均信心度"
          value={`${stats.avgConfidence}%`}
          icon={<TrendingUp className="h-5 w-5 text-blue-600" />}
          description={stats.avgConfidence >= 90 ? '高信心度' : stats.avgConfidence >= 70 ? '中等信心度' : '低信心度'}
        />
      </div>

      {/* 趨勢圖表 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            30 天處理趨勢
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={chartData}
                margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 12 }}
                  className="text-muted-foreground"
                />
                <YAxis
                  tick={{ fontSize: 12 }}
                  className="text-muted-foreground"
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '6px',
                  }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="全部"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
                <Line
                  type="monotone"
                  dataKey="成功"
                  stroke="hsl(142.1, 76.2%, 36.3%)"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
