'use client'

/**
 * @fileoverview AI 成本摘要卡片組件
 * @description
 *   儀表板上顯示 AI API 使用成本摘要的卡片組件：
 *   - 當期總成本顯示
 *   - 與上期比較的變化趨勢
 *   - 各 Provider 成本分佈
 *   - 成功率指標
 *   - 異常警示
 *
 * @module src/components/features/reports/AiCostCard
 * @since Epic 7 - Story 7.6 (AI API 使用成本顯示)
 * @lastModified 2025-12-19
 *
 * @features
 *   - AC1: 儀表板顯示當月 AI API 使用成本
 *   - AC3: 各 Provider 成本分佈圖
 *   - AC4: 成本異常警示
 *
 * @dependencies
 *   - @/hooks/useAiCost - 成本數據 hook
 *   - @/components/ui - shadcn/ui 組件
 *   - recharts - 圖表庫
 */

import * as React from 'react'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  ArrowUpRight,
  ArrowDownRight,
  TrendingUp,
  AlertTriangle,
  ChevronRight,
  DollarSign,
  Cpu,
  CheckCircle,
} from 'lucide-react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts'
import { cn } from '@/lib/utils'
import { useAiCostSummary, useAiCostAnomalies } from '@/hooks/useAiCost'
import type { AiCostCardProps, ApiProviderType } from '@/types/ai-cost'

// ============================================================
// Constants
// ============================================================

/**
 * Provider 顏色配置
 */
const PROVIDER_COLORS: Record<ApiProviderType, string> = {
  AZURE_DOC_INTELLIGENCE: '#0078d4',
  OPENAI: '#10a37f',
  AZURE_OPENAI: '#00bcf2',
}

/**
 * Provider 顯示名稱
 */
const PROVIDER_NAMES: Record<ApiProviderType, string> = {
  AZURE_DOC_INTELLIGENCE: 'Azure Doc Intelligence',
  OPENAI: 'OpenAI',
  AZURE_OPENAI: 'Azure OpenAI',
}

// ============================================================
// Sub-components
// ============================================================

/**
 * 成本變化指標
 */
function CostChangeIndicator({ change }: { change: number | null }) {
  if (change === null) {
    return <span className="text-muted-foreground text-sm">--</span>
  }

  const isPositive = change > 0
  const isNegative = change < 0
  const Icon = isPositive ? ArrowUpRight : isNegative ? ArrowDownRight : TrendingUp

  return (
    <span
      className={cn(
        'flex items-center gap-1 text-sm font-medium',
        isPositive && 'text-red-500',
        isNegative && 'text-green-500',
        !isPositive && !isNegative && 'text-muted-foreground'
      )}
    >
      <Icon className="h-4 w-4" />
      {Math.abs(change).toFixed(1)}%
    </span>
  )
}

/**
 * Provider 圖例項目
 */
function ProviderLegendItem({
  provider,
  cost,
  percentage,
}: {
  provider: ApiProviderType
  cost: number
  percentage: number
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <div className="flex items-center gap-2">
        <div
          className="h-3 w-3 rounded-full"
          style={{ backgroundColor: PROVIDER_COLORS[provider] }}
        />
        <span className="text-muted-foreground">{PROVIDER_NAMES[provider]}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="font-medium">${cost.toFixed(4)}</span>
        <span className="text-muted-foreground">({percentage.toFixed(0)}%)</span>
      </div>
    </div>
  )
}

/**
 * 載入骨架
 */
function AiCostCardSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-16" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-baseline justify-between">
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-4 w-16" />
          </div>
          <Skeleton className="h-[100px] w-full" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ============================================================
// Main Component
// ============================================================

/**
 * AI 成本摘要卡片
 */
export function AiCostCard({
  cityCodes,
  dateRange = 30,
  showDetailLink = true,
  className,
}: AiCostCardProps) {
  // 計算日期範圍
  const endDate = new Date()
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - dateRange)

  // 獲取成本摘要數據
  const {
    data: summaryData,
    isLoading: summaryLoading,
    error: summaryError,
  } = useAiCostSummary({
    cityCodes,
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0],
  })

  // 獲取異常數據
  const { data: anomalyData } = useAiCostAnomalies({
    cityCodes,
    days: 7,
  })

  // 載入中
  if (summaryLoading) {
    return <AiCostCardSkeleton />
  }

  // 錯誤狀態
  if (summaryError || !summaryData) {
    return (
      <Card className={cn('border-destructive', className)}>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <DollarSign className="h-4 w-4" />
            AI API 成本
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-4 text-center">
            <AlertTriangle className="h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">無法載入成本數據</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  const summary = summaryData.data
  const anomalies = anomalyData?.data

  // 計算 Provider 分佈百分比
  const totalCost = summary.totalCost
  const providerData = summary.providerBreakdown.map((p) => ({
    ...p,
    percentage: totalCost > 0 ? (p.totalCost / totalCost) * 100 : 0,
    name: PROVIDER_NAMES[p.provider],
    fill: PROVIDER_COLORS[p.provider],
  }))

  // 是否有異常
  const hasAnomalies = anomalies && (anomalies.severityCounts.high > 0 || anomalies.severityCounts.critical > 0)

  return (
    <Card className={cn(hasAnomalies && 'border-yellow-500', className)}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <DollarSign className="h-4 w-4" />
            AI API 成本
            {hasAnomalies && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Badge variant="outline" className="border-yellow-500 text-yellow-600">
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      {(anomalies?.severityCounts.high || 0) + (anomalies?.severityCounts.critical || 0)} 異常
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>過去 7 天有成本異常，請點擊查看詳情</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </CardTitle>
          <CardDescription>
            過去 {dateRange} 天
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* 總成本 */}
          <div className="flex items-baseline justify-between">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold">${totalCost.toFixed(4)}</span>
              <span className="text-sm text-muted-foreground">USD</span>
            </div>
            <CostChangeIndicator change={summary.costChangePercentage} />
          </div>

          {/* 統計指標 */}
          <div className="grid grid-cols-3 gap-4 pt-2">
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 text-muted-foreground text-xs">
                <Cpu className="h-3 w-3" />
                呼叫次數
              </div>
              <p className="text-lg font-semibold">{summary.totalCalls.toLocaleString()}</p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 text-muted-foreground text-xs">
                <CheckCircle className="h-3 w-3" />
                成功率
              </div>
              <p className="text-lg font-semibold">{summary.overallSuccessRate.toFixed(1)}%</p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 text-muted-foreground text-xs">
                <DollarSign className="h-3 w-3" />
                均成本
              </div>
              <p className="text-lg font-semibold">
                ${summary.totalCalls > 0 ? (totalCost / summary.totalCalls).toFixed(6) : '0'}
              </p>
            </div>
          </div>

          {/* Provider 分佈圖 */}
          {providerData.length > 0 && (
            <div className="flex items-center gap-4">
              <div className="h-[80px] w-[80px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={providerData}
                      dataKey="totalCost"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={25}
                      outerRadius={35}
                      paddingAngle={2}
                    >
                      {providerData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <RechartsTooltip
                      formatter={(value) => [`$${Number(value ?? 0).toFixed(4)}`, '成本']}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex-1 space-y-1.5">
                {providerData.map((p) => (
                  <ProviderLegendItem
                    key={p.provider}
                    provider={p.provider}
                    cost={p.totalCost}
                    percentage={p.percentage}
                  />
                ))}
              </div>
            </div>
          )}

          {/* 詳情連結 */}
          {showDetailLink && (
            <div className="pt-2 border-t">
              <Button variant="ghost" className="w-full justify-between" asChild>
                <Link href="/reports/ai-cost">
                  查看詳細分析
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export default AiCostCard
