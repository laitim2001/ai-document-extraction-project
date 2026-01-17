'use client'

/**
 * @fileoverview Forwarder 統計面板組件（國際化版本）
 * @description
 *   顯示 Forwarder 的處理統計資料，包含：
 *   - 統計數字卡片（總數、成功率、信心度）
 *   - 30 天趨勢圖表
 *   - 完整國際化支援
 *
 * @module src/components/features/forwarders/ForwarderStatsPanel
 * @author Development Team
 * @since Epic 5 - Story 5.2 (Forwarder Detail Config View)
 * @lastModified 2026-01-17
 *
 * @dependencies
 *   - next-intl - 國際化
 *   - recharts - 圖表庫
 *   - @/types/forwarder - 類型定義
 *   - @/components/ui - UI 組件
 */

import { useTranslations } from 'next-intl'
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
  const t = useTranslations('companies')

  // 空值保護：如果 stats 未定義，顯示空狀態
  if (!stats) {
    return (
      <div className="flex items-center justify-center py-16 text-center">
        <div className="text-muted-foreground">
          <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>{t('stats.noData')}</p>
        </div>
      </div>
    )
  }

  // 獲取圖表標籤的翻譯
  const chartAllLabel = t('stats.chartAll')
  const chartSuccessLabel = t('stats.chartSuccess')

  // 格式化趨勢資料用於圖表
  const chartData = (stats.dailyTrend ?? []).map((item: DailyTrendData) => ({
    date: item.date.slice(5), // 只顯示 MM-DD
    [chartAllLabel]: item.count,
    [chartSuccessLabel]: item.successCount,
  }))

  // 獲取成功率描述
  const getSuccessRateDesc = () => {
    if (stats.successRate >= 90) return t('stats.excellent')
    if (stats.successRate >= 70) return t('stats.good')
    return t('stats.needsAttention')
  }

  // 獲取信心度描述
  const getConfidenceDesc = () => {
    if (stats.avgConfidence >= 90) return t('stats.highConfidence')
    if (stats.avgConfidence >= 70) return t('stats.mediumConfidence')
    return t('stats.lowConfidence')
  }

  return (
    <div className="space-y-4">
      {/* 統計數字卡片 */}
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard
          title={t('stats.totalDocuments')}
          value={stats.totalDocuments.toLocaleString()}
          icon={<FileText className="h-5 w-5 text-primary" />}
        />
        <StatCard
          title={t('stats.processedLast30Days')}
          value={stats.processedLast30Days.toLocaleString()}
          icon={<Activity className="h-5 w-5 text-primary" />}
        />
        <StatCard
          title={t('stats.successRate')}
          value={`${stats.successRate}%`}
          icon={<CheckCircle className="h-5 w-5 text-green-600" />}
          description={getSuccessRateDesc()}
        />
        <StatCard
          title={t('stats.avgConfidence')}
          value={`${stats.avgConfidence}%`}
          icon={<TrendingUp className="h-5 w-5 text-blue-600" />}
          description={getConfidenceDesc()}
        />
      </div>

      {/* 趨勢圖表 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            {t('stats.trendTitle')}
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
                  dataKey={chartAllLabel}
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
                <Line
                  type="monotone"
                  dataKey={chartSuccessLabel}
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
