'use client'

/**
 * @fileoverview 規則表格組件
 * @description
 *   顯示映射規則列表的表格：
 *   - 支援排序（欄位名稱、優先級、更新時間）
 *   - 顯示 Forwarder、欄位名稱、提取類型、狀態、版本、成功率
 *   - 行點擊導航到詳情頁
 *
 * @module src/components/features/rules/RuleTable
 * @since Epic 4 - Story 4.1 (映射規則列表與查看)
 * @lastModified 2025-12-18
 *
 * @dependencies
 *   - @/components/ui/table - shadcn Table 組件
 *   - date-fns - 日期格式化
 */

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { RuleStatusBadge } from './RuleStatusBadge'
import { ExtractionTypeIcon } from './ExtractionTypeIcon'
import { ArrowUpDown, ArrowUp, ArrowDown, Globe } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { zhTW } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import type { RuleListItem } from '@/types/rule'

// ============================================================
// Types
// ============================================================

interface RuleTableProps {
  /** 規則列表 */
  rules: RuleListItem[]
  /** 當前排序欄位 */
  sortBy?: string
  /** 排序方向 */
  sortOrder?: 'asc' | 'desc'
  /** 排序變更回調 */
  onSort: (by: string, order: 'asc' | 'desc') => void
  /** 行點擊回調 */
  onRowClick: (ruleId: string) => void
}

// ============================================================
// Helper Components
// ============================================================

/**
 * 排序圖標
 */
function SortIcon({
  column,
  sortBy,
  sortOrder,
}: {
  column: string
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}) {
  if (sortBy !== column) {
    return <ArrowUpDown className="h-4 w-4 ml-1 text-muted-foreground" />
  }
  return sortOrder === 'asc' ? (
    <ArrowUp className="h-4 w-4 ml-1" />
  ) : (
    <ArrowDown className="h-4 w-4 ml-1" />
  )
}

/**
 * 成功率顯示
 */
function SuccessRateCell({ rate }: { rate: number | null }) {
  if (rate === null) {
    return <span className="text-muted-foreground">--</span>
  }

  return (
    <span
      className={cn(
        'font-medium',
        rate >= 90
          ? 'text-green-600 dark:text-green-400'
          : rate >= 70
            ? 'text-yellow-600 dark:text-yellow-400'
            : 'text-red-600 dark:text-red-400'
      )}
    >
      {rate.toFixed(1)}%
    </span>
  )
}

// ============================================================
// Component
// ============================================================

/**
 * 規則表格
 *
 * @example
 * ```tsx
 * <RuleTable
 *   rules={rules}
 *   sortBy="updatedAt"
 *   sortOrder="desc"
 *   onSort={(by, order) => setFilters({ sortBy: by, sortOrder: order })}
 *   onRowClick={(id) => router.push(`/rules/${id}`)}
 * />
 * ```
 */
export function RuleTable({
  rules,
  sortBy,
  sortOrder,
  onSort,
  onRowClick,
}: RuleTableProps) {
  // --- Handlers ---
  const handleSort = (column: string) => {
    if (sortBy === column) {
      onSort(column, sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      onSort(column, 'desc')
    }
  }

  // --- Empty State ---
  if (rules.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center border rounded-lg bg-muted/20">
        <p className="text-muted-foreground">沒有符合條件的規則</p>
      </div>
    )
  }

  // --- Render ---
  return (
    <div className="border rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead className="w-[160px]">Forwarder</TableHead>
            <TableHead
              className="cursor-pointer hover:bg-muted/70 transition-colors"
              onClick={() => handleSort('fieldName')}
            >
              <div className="flex items-center">
                欄位名稱
                <SortIcon
                  column="fieldName"
                  sortBy={sortBy}
                  sortOrder={sortOrder}
                />
              </div>
            </TableHead>
            <TableHead className="w-[130px]">提取類型</TableHead>
            <TableHead className="w-[100px]">狀態</TableHead>
            <TableHead className="w-[80px] text-center">版本</TableHead>
            <TableHead
              className="w-[90px] cursor-pointer hover:bg-muted/70 transition-colors"
              onClick={() => handleSort('priority')}
            >
              <div className="flex items-center">
                優先級
                <SortIcon
                  column="priority"
                  sortBy={sortBy}
                  sortOrder={sortOrder}
                />
              </div>
            </TableHead>
            <TableHead className="w-[100px] text-right">成功率</TableHead>
            <TableHead
              className="w-[140px] cursor-pointer hover:bg-muted/70 transition-colors"
              onClick={() => handleSort('updatedAt')}
            >
              <div className="flex items-center">
                更新時間
                <SortIcon
                  column="updatedAt"
                  sortBy={sortBy}
                  sortOrder={sortOrder}
                />
              </div>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rules.map((rule) => (
            <TableRow
              key={rule.id}
              className="cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => onRowClick(rule.id)}
              data-testid="rule-row"
            >
              {/* Forwarder */}
              <TableCell>
                {rule.company ? (
                  <div>
                    <div className="font-medium">{rule.company.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {rule.company.code}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400">
                    <Globe className="h-4 w-4" />
                    <span className="font-medium">通用規則</span>
                  </div>
                )}
              </TableCell>

              {/* 欄位名稱 */}
              <TableCell>
                <div className="font-mono text-sm">{rule.fieldName}</div>
                {rule.fieldLabel && (
                  <div className="text-xs text-muted-foreground">
                    {rule.fieldLabel}
                  </div>
                )}
              </TableCell>

              {/* 提取類型 */}
              <TableCell>
                <ExtractionTypeIcon
                  type={rule.extractionPattern.method}
                  showLabel
                  size="sm"
                />
              </TableCell>

              {/* 狀態 */}
              <TableCell>
                <RuleStatusBadge status={rule.status} />
              </TableCell>

              {/* 版本 */}
              <TableCell className="text-center">
                <span className="text-sm font-medium">v{rule.version}</span>
              </TableCell>

              {/* 優先級 */}
              <TableCell>
                <span
                  className={cn(
                    'text-sm',
                    rule.priority > 0
                      ? 'font-medium'
                      : 'text-muted-foreground'
                  )}
                >
                  {rule.priority}
                </span>
              </TableCell>

              {/* 成功率 */}
              <TableCell className="text-right">
                <SuccessRateCell rate={rule.stats.successRate} />
              </TableCell>

              {/* 更新時間 */}
              <TableCell className="text-sm text-muted-foreground">
                {formatDistanceToNow(new Date(rule.updatedAt), {
                  addSuffix: true,
                  locale: zhTW,
                })}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
