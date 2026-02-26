'use client'

/**
 * @fileoverview 城市成本報表表格組件
 * @description
 *   顯示城市成本報表的資料表格，包含：
 *   - 城市成本明細（AI + 人工）
 *   - 處理量與自動化率
 *   - 成本趨勢指標
 *   - 異常標記與點擊互動
 *
 * @module src/components/features/reports/CityCostTable
 * @author Development Team
 * @since Epic 7 - Story 7.9 (城市成本報表)
 * @lastModified 2025-12-19
 *
 * @features
 *   - 可排序表格欄位
 *   - 成本變化趨勢指標
 *   - 異常警示標記
 *   - 人工成本估算提示
 *
 * @dependencies
 *   - @/components/ui - shadcn/ui 組件
 *   - lucide-react - 圖示
 *
 * @related
 *   - src/types/city-cost.ts - 類型定義
 *   - src/hooks/use-city-cost-report.ts - 資料查詢
 */

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { useMemo, useState, useCallback } from 'react'
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Minus,
  Info,
} from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import type {
  CityCostTableProps,
  CityCostReport,
  CostAnomalyDetail,
} from '@/types/city-cost'

// ============================================================
// Types
// ============================================================

type SortField =
  | 'cityName'
  | 'totalDocuments'
  | 'apiCost'
  | 'laborCost'
  | 'totalCost'
  | 'costPerDocument'
  | 'automationRate'

type SortOrder = 'asc' | 'desc'

interface SortableHeaderProps {
  field: SortField
  label: string
  currentSortBy: SortField
  currentSortOrder: SortOrder
  onSort: (field: SortField) => void
  className?: string
}

// ============================================================
// Helper Functions
// ============================================================

/**
 * 格式化貨幣
 */
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

/**
 * 格式化數字
 */
function formatNumber(num: number): string {
  return new Intl.NumberFormat('zh-TW').format(num)
}

/**
 * 格式化百分比
 */
function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`
}

// ============================================================
// Sub-components
// ============================================================

/**
 * 可排序表頭
 */
function SortableHeader({
  field,
  label,
  currentSortBy,
  currentSortOrder,
  onSort,
  className,
}: SortableHeaderProps) {
  const isActive = currentSortBy === field

  const handleClick = () => {
    onSort(field)
  }

  const SortIcon = isActive
    ? currentSortOrder === 'asc'
      ? ArrowUp
      : ArrowDown
    : ArrowUpDown

  return (
    <Button
      variant="ghost"
      size="sm"
      className={cn('-ml-3 h-8 data-[state=open]:bg-accent', className)}
      onClick={handleClick}
    >
      {label}
      <SortIcon
        className={cn(
          'ml-2 h-4 w-4',
          isActive ? 'text-foreground' : 'text-muted-foreground'
        )}
      />
    </Button>
  )
}

/**
 * 趨勢指標
 */
function TrendIndicator({
  value,
  inverse = false,
}: {
  value: number | null
  inverse?: boolean
}) {
  if (value === null || Math.abs(value) < 0.1) {
    return <Minus className="h-4 w-4 text-muted-foreground" />
  }

  const isPositive = inverse ? value < 0 : value > 0
  const Icon = value > 0 ? TrendingUp : TrendingDown

  return (
    <span
      className={cn(
        'flex items-center gap-0.5 text-sm',
        isPositive ? 'text-emerald-600' : 'text-red-600'
      )}
    >
      <Icon className="h-4 w-4" />
      {Math.abs(value).toFixed(1)}%
    </span>
  )
}

/**
 * 異常標記按鈕
 */
function AnomalyIndicator({
  report,
  onAnomalyClick,
  t,
}: {
  report: CityCostReport
  onAnomalyClick?: (cityCode: string, anomaly: CostAnomalyDetail) => void
  t: (key: string, values?: Record<string, number>) => string
}) {
  if (!report.anomalies || report.anomalies.length === 0) {
    return null
  }

  const highSeverityCount = report.anomalies.filter(
    (a) => a.severity === 'high'
  ).length
  const mediumSeverityCount = report.anomalies.filter(
    (a) => a.severity === 'medium'
  ).length

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (onAnomalyClick && report.anomalies.length > 0) {
      onAnomalyClick(report.cityCode, report.anomalies[0])
    }
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={handleClick}
        >
          <AlertTriangle
            className={cn(
              'h-4 w-4',
              highSeverityCount > 0
                ? 'text-red-500'
                : mediumSeverityCount > 0
                  ? 'text-amber-500'
                  : 'text-yellow-500'
            )}
          />
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        <div className="space-y-1">
          <p className="font-medium">
            {t('cityCost.anomalyCount', { count: report.anomalies.length })}
          </p>
          {highSeverityCount > 0 && (
            <p className="text-red-500">{t('cityCost.highRisk', { count: highSeverityCount })}</p>
          )}
          {mediumSeverityCount > 0 && (
            <p className="text-amber-500">{t('cityCost.mediumRisk', { count: mediumSeverityCount })}</p>
          )}
          <p className="text-xs text-muted-foreground">{t('cityCost.clickForDetails')}</p>
        </div>
      </TooltipContent>
    </Tooltip>
  )
}

// ============================================================
// Component
// ============================================================

/**
 * 城市成本報表表格組件
 *
 * @description
 *   顯示城市成本報表數據的表格，支援：
 *   - 排序（城市名稱、處理量、成本等）
 *   - 異常標記顯示
 *   - 城市點擊互動
 *   - 人工成本估算提示
 *
 * @example
 * ```tsx
 * <CityCostTable
 *   reports={reports}
 *   showAnomalies={true}
 *   onCityClick={handleCityClick}
 *   onAnomalyClick={handleAnomalyClick}
 * />
 * ```
 */
export function CityCostTable({
  reports,
  showAnomalies = true,
  onCityClick,
  onAnomalyClick,
  className,
}: CityCostTableProps) {
  const t = useTranslations('reports')

  // --- State ---
  const [sortField, setSortField] = useState<SortField>('totalCost')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')

  // --- Handlers ---
  const handleSort = useCallback((field: SortField) => {
    setSortField((prevField) => {
      if (prevField === field) {
        setSortOrder((prevOrder) => (prevOrder === 'asc' ? 'desc' : 'asc'))
        return field
      }
      setSortOrder('desc')
      return field
    })
  }, [])

  const handleRowClick = useCallback(
    (cityCode: string) => {
      onCityClick?.(cityCode)
    },
    [onCityClick]
  )

  // --- Sorted Data ---
  const sortedReports = useMemo(() => {
    return [...reports].sort((a, b) => {
      let aVal: number | string = 0
      let bVal: number | string = 0

      switch (sortField) {
        case 'cityName':
          aVal = a.cityName
          bVal = b.cityName
          break
        case 'totalDocuments':
          aVal = a.processing.totalDocuments
          bVal = b.processing.totalDocuments
          break
        case 'apiCost':
          aVal = a.costs.apiCost
          bVal = b.costs.apiCost
          break
        case 'laborCost':
          aVal = a.costs.laborCost
          bVal = b.costs.laborCost
          break
        case 'totalCost':
          aVal = a.costs.totalCost
          bVal = b.costs.totalCost
          break
        case 'costPerDocument':
          aVal = a.costs.costPerDocument
          bVal = b.costs.costPerDocument
          break
        case 'automationRate':
          aVal = a.processing.automationRate
          bVal = b.processing.automationRate
          break
      }

      const modifier = sortOrder === 'asc' ? 1 : -1

      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return (aVal - bVal) * modifier
      }
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return aVal.localeCompare(bVal) * modifier
      }
      return 0
    })
  }, [reports, sortField, sortOrder])

  // --- Empty State ---
  if (reports.length === 0) {
    return (
      <div
        className={cn(
          'rounded-md border p-8 text-center text-muted-foreground',
          className
        )}
      >
        {t('cityCost.emptyState')}
      </div>
    )
  }

  // --- Render ---
  return (
    <TooltipProvider>
      <div className={cn('rounded-md border', className)}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[180px]">
                <SortableHeader
                  field="cityName"
                  label={t('cityCost.columns.city')}
                  currentSortBy={sortField}
                  currentSortOrder={sortOrder}
                  onSort={handleSort}
                />
              </TableHead>
              <TableHead className="w-[120px] text-right">
                <SortableHeader
                  field="totalDocuments"
                  label={t('cityCost.columns.volume')}
                  currentSortBy={sortField}
                  currentSortOrder={sortOrder}
                  onSort={handleSort}
                  className="justify-end"
                />
              </TableHead>
              <TableHead className="w-[100px] text-right">
                <SortableHeader
                  field="automationRate"
                  label={t('cityCost.columns.automationRate')}
                  currentSortBy={sortField}
                  currentSortOrder={sortOrder}
                  onSort={handleSort}
                  className="justify-end"
                />
              </TableHead>
              <TableHead className="w-[120px] text-right">
                <SortableHeader
                  field="apiCost"
                  label={t('cityCost.columns.aiCost')}
                  currentSortBy={sortField}
                  currentSortOrder={sortOrder}
                  onSort={handleSort}
                  className="justify-end"
                />
              </TableHead>
              <TableHead className="w-[120px] text-right">
                <div className="flex items-center justify-end gap-1">
                  <SortableHeader
                    field="laborCost"
                    label={t('cityCost.columns.laborCost')}
                    currentSortBy={sortField}
                    currentSortOrder={sortOrder}
                    onSort={handleSort}
                    className="justify-end"
                  />
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-3 w-3 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{t('cityCost.laborCostTooltip')}</p>
                      <p className="text-xs text-muted-foreground">
                        {t('cityCost.laborCostDesc')}
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </div>
              </TableHead>
              <TableHead className="w-[120px] text-right">
                <SortableHeader
                  field="totalCost"
                  label={t('cityCost.columns.totalCost')}
                  currentSortBy={sortField}
                  currentSortOrder={sortOrder}
                  onSort={handleSort}
                  className="justify-end"
                />
              </TableHead>
              <TableHead className="w-[100px] text-right">
                <SortableHeader
                  field="costPerDocument"
                  label={t('cityCost.columns.unitCost')}
                  currentSortBy={sortField}
                  currentSortOrder={sortOrder}
                  onSort={handleSort}
                  className="justify-end"
                />
              </TableHead>
              <TableHead className="w-[80px] text-center">{t('cityCost.columns.trend')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedReports.map((report) => {
              const hasReportAnomalies =
                showAnomalies &&
                report.anomalies &&
                report.anomalies.length > 0

              return (
                <TableRow
                  key={report.cityCode}
                  className={cn(
                    onCityClick && 'cursor-pointer hover:bg-muted/50',
                    hasReportAnomalies && 'bg-amber-50/50'
                  )}
                  onClick={() => handleRowClick(report.cityCode)}
                >
                  {/* 城市名稱 */}
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div>
                        <div className="font-medium">{report.cityName}</div>
                        <div className="text-xs text-muted-foreground">
                          {report.cityCode}
                        </div>
                      </div>
                      {showAnomalies && (
                        <AnomalyIndicator
                          report={report}
                          onAnomalyClick={onAnomalyClick}
                          t={t}
                        />
                      )}
                    </div>
                  </TableCell>

                  {/* 處理量 */}
                  <TableCell className="text-right">
                    <div>
                      <div>{formatNumber(report.processing.totalDocuments)}</div>
                      <div className="text-xs text-muted-foreground">
                        {t('cityCost.autoPrefix', { count: formatNumber(report.processing.autoApproved) })}
                      </div>
                    </div>
                  </TableCell>

                  {/* 自動化率 */}
                  <TableCell className="text-right">
                    <Badge
                      variant={
                        report.processing.automationRate >= 90
                          ? 'default'
                          : report.processing.automationRate >= 70
                            ? 'secondary'
                            : 'destructive'
                      }
                      className="font-mono"
                    >
                      {formatPercent(report.processing.automationRate)}
                    </Badge>
                  </TableCell>

                  {/* AI 成本 */}
                  <TableCell className="text-right font-mono">
                    {formatCurrency(report.costs.apiCost)}
                  </TableCell>

                  {/* 人工成本 */}
                  <TableCell className="text-right">
                    <Tooltip>
                      <TooltipTrigger className="cursor-help">
                        <span className="border-b border-dashed border-muted-foreground/30 font-mono">
                          {formatCurrency(report.costs.laborCost)}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        <div className="space-y-1">
                          <p>
                            {t('cityCost.manualReview', { count: formatNumber(report.processing.manualReviewed) })}
                          </p>
                          <p>
                            {t('cityCost.escalation', { count: formatNumber(report.processing.escalated) })}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {t('cityCost.estimateNote')}
                          </p>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </TableCell>

                  {/* 總成本 */}
                  <TableCell className="text-right font-medium font-mono">
                    {formatCurrency(report.costs.totalCost)}
                  </TableCell>

                  {/* 單位成本 */}
                  <TableCell className="text-right font-mono">
                    {formatCurrency(report.costs.costPerDocument)}
                  </TableCell>

                  {/* 趨勢 */}
                  <TableCell className="text-center">
                    <TrendIndicator
                      value={report.costs.changeFromLastPeriod}
                      inverse
                    />
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
    </TooltipProvider>
  )
}
