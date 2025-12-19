'use client'

/**
 * @fileoverview 城市對比表格組件
 * @description
 *   顯示各城市處理數據的對比表格：
 *   - 可排序欄位（城市、處理量、成功率、自動化率、平均時間、AI 成本）
 *   - 趨勢指標（變化百分比）
 *   - 可展開顯示城市詳情
 *
 * @module src/components/reports/CityComparisonTable
 * @since Epic 7 - Story 7.5 (跨城市匯總報表)
 * @lastModified 2025-12-19
 *
 * @features
 *   - AC2: 對比數據內容（城市名、處理量、成功率、自動化率、平均時間、AI 成本）
 *   - AC3: 城市詳情展開
 *
 * @dependencies
 *   - @/components/ui/* - shadcn/ui 組件
 *   - @/types/regional-report - 區域報表類型
 */

import { useState, useMemo } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  ChevronDown,
  ChevronUp,
  TrendingUp,
  TrendingDown,
  Minus,
  ArrowUpDown
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { CitySummary } from '@/types/regional-report'
import { CityDetailPanel } from './CityDetailPanel'

// ============================================================
// Types
// ============================================================

interface CityComparisonTableProps {
  /** 城市摘要列表 */
  cities: CitySummary[]
  /** 載入狀態 */
  loading?: boolean
}

type SortField = keyof Pick<
  CitySummary,
  'cityName' | 'processingVolume' | 'successRate' | 'automationRate' | 'avgProcessingTime' | 'aiCost'
>
type SortDirection = 'asc' | 'desc'

// ============================================================
// Sub-Components
// ============================================================

/**
 * 趨勢指標組件
 */
function TrendIndicator({ value, invert = false }: { value: number; invert?: boolean }) {
  if (Math.abs(value) < 0.5) {
    return <Minus className="h-3 w-3 text-muted-foreground" />
  }
  const isPositive = invert ? value < 0 : value > 0
  const Icon = value > 0 ? TrendingUp : TrendingDown
  return (
    <span className={cn(
      'inline-flex items-center gap-0.5 text-xs font-medium',
      isPositive ? 'text-green-600' : 'text-red-600'
    )}>
      <Icon className="h-3 w-3" />
      {Math.abs(value).toFixed(1)}%
    </span>
  )
}

/**
 * 比率指標組件
 */
function RateIndicator({ value }: { value: number }) {
  const variant = value >= 95 ? 'default' : value >= 90 ? 'secondary' : 'destructive'
  return (
    <Badge variant={variant}>
      {value.toFixed(1)}%
    </Badge>
  )
}

// ============================================================
// Main Component
// ============================================================

/**
 * 城市對比表格組件
 *
 * @description
 *   顯示各城市處理數據的對比表格，支援：
 *   - 欄位排序
 *   - 趨勢指標顯示
 *   - 展開顯示城市詳情
 *
 * @example
 * ```tsx
 * <CityComparisonTable
 *   cities={summary.cities}
 *   loading={isLoading}
 * />
 * ```
 */
export function CityComparisonTable({ cities, loading }: CityComparisonTableProps) {
  const [sortField, setSortField] = useState<SortField>('processingVolume')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [expandedCity, setExpandedCity] = useState<string | null>(null)

  // 排序處理
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('desc')
    }
  }

  // 排序後的城市列表
  const sortedCities = useMemo(() => {
    return [...cities].sort((a, b) => {
      const aValue = a[sortField]
      const bValue = b[sortField]
      const modifier = sortDirection === 'asc' ? 1 : -1

      if (typeof aValue === 'string') {
        return aValue.localeCompare(bValue as string) * modifier
      }
      return ((aValue as number) - (bValue as number)) * modifier
    })
  }, [cities, sortField, sortDirection])

  // 格式化時間
  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${Math.round(seconds)}s`
    const minutes = Math.floor(seconds / 60)
    const secs = Math.round(seconds % 60)
    return secs > 0 ? `${minutes}m ${secs}s` : `${minutes}m`
  }

  // 格式化金額
  const formatCurrency = (amount: number) => `$${amount.toFixed(2)}`

  // 可排序表頭組件
  const SortableHeader = ({
    field,
    children
  }: {
    field: SortField
    children: React.ReactNode
  }) => (
    <TableHead
      className="cursor-pointer hover:bg-muted/50 select-none"
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center gap-1">
        {children}
        {sortField === field ? (
          sortDirection === 'asc' ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )
        ) : (
          <ArrowUpDown className="h-4 w-4 opacity-30" />
        )}
      </div>
    </TableHead>
  )

  // 載入狀態
  if (loading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-10 w-full" />
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    )
  }

  // 空狀態
  if (cities.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        無城市數據
      </div>
    )
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <SortableHeader field="cityName">城市</SortableHeader>
            <SortableHeader field="processingVolume">處理量</SortableHeader>
            <SortableHeader field="successRate">成功率</SortableHeader>
            <SortableHeader field="automationRate">自動化率</SortableHeader>
            <SortableHeader field="avgProcessingTime">平均時間</SortableHeader>
            <SortableHeader field="aiCost">AI 成本</SortableHeader>
            <TableHead className="w-[60px]">待審核</TableHead>
            <TableHead className="w-[40px]" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedCities.map((city) => (
            <TableRow
              key={city.cityCode}
              className={cn(
                'cursor-pointer transition-colors',
                expandedCity === city.cityCode && 'bg-muted/50'
              )}
            >
              <TableCell onClick={() => setExpandedCity(
                expandedCity === city.cityCode ? null : city.cityCode
              )}>
                <div>
                  <div className="font-medium">{city.cityName}</div>
                  <div className="text-xs text-muted-foreground">
                    {city.cityCode}
                    {city.region && ` · ${city.region}`}
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <span className="font-medium">
                    {city.processingVolume.toLocaleString()}
                  </span>
                  <TrendIndicator value={city.trend.volumeChange} />
                </div>
              </TableCell>
              <TableCell>
                <RateIndicator value={city.successRate} />
              </TableCell>
              <TableCell>
                <span className="font-medium">{city.automationRate.toFixed(1)}%</span>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  {formatDuration(city.avgProcessingTime)}
                </div>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{formatCurrency(city.aiCost)}</span>
                  <TrendIndicator value={city.trend.costChange} invert />
                </div>
              </TableCell>
              <TableCell>
                {city.pendingReview > 0 && (
                  <Badge variant="outline">{city.pendingReview}</Badge>
                )}
              </TableCell>
              <TableCell>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setExpandedCity(
                    expandedCity === city.cityCode ? null : city.cityCode
                  )}
                >
                  {expandedCity === city.cityCode ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {/* 展開的城市詳情 */}
      {expandedCity && (
        <div className="border-t">
          <CityDetailPanel cityCode={expandedCity} />
        </div>
      )}
    </div>
  )
}
