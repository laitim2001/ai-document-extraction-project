'use client'

/**
 * @fileoverview 批量處理術語聚合摘要組件
 * @description
 *   顯示批量處理後的術語聚合統計資訊：
 *   - 聚合狀態指示器
 *   - 統計摘要（唯一術語、通用術語、已分類）
 *   - Top 術語分佈
 *   - 類別分佈
 *   - 公司術語分佈
 *   - 手動觸發聚合功能
 *
 * @module src/components/features/historical-data/TermAggregationSummary
 * @since Epic 0 - Story 0.7
 * @lastModified 2025-12-25
 *
 * @features
 *   - 術語聚合狀態顯示
 *   - 統計數據可視化
 *   - 分佈圖表
 *   - 手動觸發聚合
 *
 * @dependencies
 *   - shadcn/ui - UI 組件
 *   - lucide-react - 圖標
 *
 * @related
 *   - src/services/batch-term-aggregation.service.ts - 術語聚合服務
 *   - src/app/api/admin/historical-data/batches/[batchId]/term-stats/route.ts - API 端點
 */

import * as React from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  Hash,
  Building2,
  FolderOpen,
  Globe,
  Tag,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  ChevronDown,
  RefreshCw,
  TrendingUp,
  BarChart3,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type {
  TermAggregationResponse,
  BatchTermAggregationStats,
} from '@/types/batch-term-aggregation'

// ============================================================
// Types
// ============================================================

interface TermAggregationSummaryProps {
  /** 批次 ID */
  batchId: string
  /** 術語聚合響應資料 */
  data?: TermAggregationResponse | null
  /** 是否正在載入 */
  isLoading?: boolean
  /** 錯誤訊息 */
  error?: string | null
  /** 觸發聚合回調 */
  onTriggerAggregation?: () => void
  /** 是否正在觸發聚合 */
  isTriggering?: boolean
  /** 額外的 CSS 類名 */
  className?: string
}

// ============================================================
// Helper Functions
// ============================================================

/**
 * 格式化數字
 */
function formatNumber(num: number): string {
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`
  }
  if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}K`
  }
  return num.toString()
}

/**
 * 計算百分比
 */
function calculatePercentage(value: number, total: number): number {
  if (total === 0) return 0
  return Math.round((value / total) * 100)
}

// ============================================================
// Sub-Components
// ============================================================

/**
 * 聚合狀態徽章
 */
function AggregationStatusBadge({
  status,
}: {
  status: TermAggregationResponse['status']
}) {
  const config = {
    pending: {
      label: '待聚合',
      variant: 'secondary' as const,
      icon: Clock,
      className: 'bg-gray-100 text-gray-700 border-gray-200',
    },
    aggregating: {
      label: '聚合中',
      variant: 'default' as const,
      icon: Loader2,
      className: 'bg-blue-100 text-blue-700 border-blue-200',
    },
    completed: {
      label: '已完成',
      variant: 'default' as const,
      icon: CheckCircle2,
      className: 'bg-green-100 text-green-700 border-green-200',
    },
    failed: {
      label: '失敗',
      variant: 'destructive' as const,
      icon: XCircle,
      className: '',
    },
  }

  const { label, variant, icon: Icon, className } = config[status] || config.pending

  return (
    <Badge variant={variant} className={cn('gap-1', className)}>
      <Icon
        className={cn('h-3 w-3', status === 'aggregating' && 'animate-spin')}
      />
      {label}
    </Badge>
  )
}

/**
 * 統計項目
 */
function StatItem({
  icon: Icon,
  label,
  value,
  subValue,
  iconColor,
  tooltip,
}: {
  icon: React.ElementType
  label: string
  value: string | number
  subValue?: string
  iconColor?: string
  tooltip?: string
}) {
  const content = (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
      <div className={cn('p-2 rounded-lg bg-background', iconColor)}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm text-muted-foreground">{label}</div>
        <div className="text-lg font-semibold truncate">{value}</div>
        {subValue && (
          <div className="text-xs text-muted-foreground">{subValue}</div>
        )}
      </div>
    </div>
  )

  if (tooltip) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{content}</TooltipTrigger>
        <TooltipContent>{tooltip}</TooltipContent>
      </Tooltip>
    )
  }

  return content
}

/**
 * 統計概覽網格
 */
function StatsGrid({ stats }: { stats: BatchTermAggregationStats }) {
  const classifiedPercentage = calculatePercentage(
    stats.classifiedTermsCount,
    stats.totalUniqueTerms
  )

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
      <StatItem
        icon={Hash}
        label="唯一術語"
        value={formatNumber(stats.totalUniqueTerms)}
        subValue={`共 ${formatNumber(stats.totalOccurrences)} 次出現`}
        iconColor="text-purple-600"
        tooltip="識別到的不重複術語總數"
      />
      <StatItem
        icon={Globe}
        label="通用術語"
        value={formatNumber(stats.universalTermsCount)}
        subValue={`跨 2+ 公司通用`}
        iconColor="text-blue-600"
        tooltip="出現在多個公司中的通用術語"
      />
      <StatItem
        icon={Building2}
        label="公司特定"
        value={formatNumber(stats.companySpecificCount)}
        subValue={`${stats.companiesWithTerms} 個公司`}
        iconColor="text-orange-600"
        tooltip="只出現在特定公司的術語"
      />
      <StatItem
        icon={Tag}
        label="已分類"
        value={formatNumber(stats.classifiedTermsCount)}
        subValue={`${classifiedPercentage}% 覆蓋率`}
        iconColor="text-green-600"
        tooltip="已自動分類的術語數量"
      />
      <StatItem
        icon={FolderOpen}
        label="待分類"
        value={formatNumber(stats.totalUniqueTerms - stats.classifiedTermsCount)}
        subValue={`${100 - classifiedPercentage}% 待處理`}
        iconColor="text-yellow-600"
        tooltip="需要人工分類或映射的術語"
      />
      <StatItem
        icon={BarChart3}
        label="涵蓋公司"
        value={stats.companiesWithTerms}
        iconColor="text-teal-600"
        tooltip="有術語提取結果的公司數量"
      />
    </div>
  )
}

/**
 * Top 術語列表
 */
function TopTermsList({
  terms,
}: {
  terms: { term: string; frequency: number }[]
}) {
  if (!terms || terms.length === 0) {
    return (
      <div className="text-sm text-muted-foreground text-center py-4">
        暫無術語資料
      </div>
    )
  }

  const maxFrequency = Math.max(...terms.map((t) => t.frequency))

  return (
    <div className="space-y-2">
      {terms.slice(0, 10).map((item, index) => (
        <div key={item.term} className="flex items-center gap-3">
          <div className="w-6 text-sm text-muted-foreground text-right">
            {index + 1}.
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium truncate">{item.term}</span>
              <span className="text-xs text-muted-foreground">
                {formatNumber(item.frequency)}
              </span>
            </div>
            <Progress
              value={(item.frequency / maxFrequency) * 100}
              className="h-1.5"
            />
          </div>
        </div>
      ))}
    </div>
  )
}

/**
 * 類別分佈列表
 */
function CategoryBreakdown({
  categories,
}: {
  categories: { category: string; count: number }[]
}) {
  if (!categories || categories.length === 0) {
    return (
      <div className="text-sm text-muted-foreground text-center py-4">
        暫無類別資料
      </div>
    )
  }

  const total = categories.reduce((sum, c) => sum + c.count, 0)

  return (
    <div className="space-y-2">
      {categories.slice(0, 8).map((item) => {
        const percentage = calculatePercentage(item.count, total)
        return (
          <div key={item.category} className="flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium truncate">
                  {item.category || '未分類'}
                </span>
                <span className="text-xs text-muted-foreground">
                  {formatNumber(item.count)} ({percentage}%)
                </span>
              </div>
              <Progress value={percentage} className="h-1.5" />
            </div>
          </div>
        )
      })}
    </div>
  )
}

/**
 * 公司術語分佈
 */
function CompanyBreakdown({
  companies,
}: {
  companies: { companyName: string; termCount: number }[]
}) {
  if (!companies || companies.length === 0) {
    return (
      <div className="text-sm text-muted-foreground text-center py-4">
        暫無公司資料
      </div>
    )
  }

  const maxCount = Math.max(...companies.map((c) => c.termCount))

  return (
    <div className="space-y-2">
      {companies.slice(0, 8).map((item) => (
        <div key={item.companyName} className="flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium truncate">
                {item.companyName}
              </span>
              <span className="text-xs text-muted-foreground">
                {formatNumber(item.termCount)} 術語
              </span>
            </div>
            <Progress
              value={(item.termCount / maxCount) * 100}
              className="h-1.5"
            />
          </div>
        </div>
      ))}
    </div>
  )
}

/**
 * 可折疊分佈區塊
 */
function DistributionSection({
  title,
  icon: Icon,
  children,
  defaultOpen = false,
}: {
  title: string
  icon: React.ElementType
  children: React.ReactNode
  defaultOpen?: boolean
}) {
  const [isOpen, setIsOpen] = React.useState(defaultOpen)

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger className="flex items-center justify-between w-full py-2 text-sm font-medium hover:text-primary transition-colors">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4" />
          {title}
        </div>
        <ChevronDown
          className={cn(
            'h-4 w-4 transition-transform duration-200',
            isOpen && 'transform rotate-180'
          )}
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-2">{children}</CollapsibleContent>
    </Collapsible>
  )
}

// ============================================================
// Main Component
// ============================================================

export function TermAggregationSummary({
  batchId: _batchId,
  data,
  isLoading = false,
  error,
  onTriggerAggregation,
  isTriggering = false,
  className,
}: TermAggregationSummaryProps) {
  // --- Render: Loading State ---
  if (isLoading) {
    return (
      <Card className={className}>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <span className="ml-2 text-muted-foreground">載入術語聚合資料...</span>
        </CardContent>
      </Card>
    )
  }

  // --- Render: Error State ---
  if (error) {
    return (
      <Card className={className}>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
          <p className="text-muted-foreground mb-4">{error}</p>
          {onTriggerAggregation && (
            <Button variant="outline" onClick={onTriggerAggregation}>
              <RefreshCw className="mr-2 h-4 w-4" />
              重試
            </Button>
          )}
        </CardContent>
      </Card>
    )
  }

  // --- Render: Pending State ---
  if (!data || data.status === 'pending') {
    return (
      <Card className={className}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Hash className="h-5 w-5" />
              術語聚合
            </CardTitle>
            <AggregationStatusBadge status="pending" />
          </div>
          <CardDescription>
            術語聚合尚未執行。批量處理完成後可執行術語聚合分析。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8">
            <Clock className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">尚未進行術語聚合分析</p>
            {onTriggerAggregation && (
              <Button
                onClick={onTriggerAggregation}
                disabled={isTriggering}
                className="gap-2"
              >
                {isTriggering ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    聚合中...
                  </>
                ) : (
                  <>
                    <TrendingUp className="h-4 w-4" />
                    執行術語聚合
                  </>
                )}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    )
  }

  // --- Render: Aggregating State ---
  if (data.status === 'aggregating') {
    return (
      <Card className={className}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Hash className="h-5 w-5" />
              術語聚合
            </CardTitle>
            <AggregationStatusBadge status="aggregating" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8">
            <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">正在進行術語聚合分析...</p>
            <p className="text-xs text-muted-foreground mt-2">
              這可能需要幾分鐘時間
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  // --- Render: Failed State ---
  if (data.status === 'failed') {
    return (
      <Card className={className}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Hash className="h-5 w-5" />
              術語聚合
            </CardTitle>
            <AggregationStatusBadge status="failed" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8">
            <XCircle className="h-12 w-12 text-red-500 mb-4" />
            <p className="text-muted-foreground mb-2">術語聚合失敗</p>
            <p className="text-sm text-red-500 mb-4">
              {data.error || '未知錯誤'}
            </p>
            {onTriggerAggregation && (
              <Button
                variant="outline"
                onClick={onTriggerAggregation}
                disabled={isTriggering}
              >
                {isTriggering ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    重試中...
                  </>
                ) : (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    重新執行
                  </>
                )}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    )
  }

  // --- Render: Completed State ---
  const { stats, summary, aggregatedAt } = data

  return (
    <TooltipProvider>
      <Card className={className}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Hash className="h-5 w-5" />
              術語聚合分析
            </CardTitle>
            <div className="flex items-center gap-2">
              <AggregationStatusBadge status="completed" />
              {onTriggerAggregation && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onTriggerAggregation}
                  disabled={isTriggering}
                >
                  {isTriggering ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                </Button>
              )}
            </div>
          </div>
          {aggregatedAt && (
            <CardDescription>
              聚合完成時間：{new Date(aggregatedAt).toLocaleString('zh-TW')}
            </CardDescription>
          )}
        </CardHeader>

        <CardContent className="space-y-6">
          {/* 統計概覽 */}
          {stats && <StatsGrid stats={stats} />}

          {/* 分佈詳情 */}
          {summary && (
            <div className="space-y-4 pt-4 border-t">
              {/* Top 術語 */}
              {summary.topTerms && summary.topTerms.length > 0 && (
                <DistributionSection
                  title="最常見術語"
                  icon={TrendingUp}
                  defaultOpen={true}
                >
                  <TopTermsList terms={summary.topTerms} />
                </DistributionSection>
              )}

              {/* 類別分佈 */}
              {summary.categoryBreakdown &&
                summary.categoryBreakdown.length > 0 && (
                  <DistributionSection title="類別分佈" icon={Tag}>
                    <CategoryBreakdown categories={summary.categoryBreakdown} />
                  </DistributionSection>
                )}

              {/* 公司分佈 */}
              {summary.companyBreakdown &&
                summary.companyBreakdown.length > 0 && (
                  <DistributionSection title="公司術語分佈" icon={Building2}>
                    <CompanyBreakdown companies={summary.companyBreakdown} />
                  </DistributionSection>
                )}
            </div>
          )}

          {/* 無分佈資料時的提示 */}
          {!summary && stats && (
            <div className="text-center py-4 text-sm text-muted-foreground border-t">
              詳細分佈資料不可用。請嘗試重新執行聚合分析。
            </div>
          )}
        </CardContent>
      </Card>
    </TooltipProvider>
  )
}
