'use client'

/**
 * @fileoverview 規則表格組件（國際化版本）
 * @description
 *   顯示映射規則列表的表格：
 *   - 支援排序（欄位名稱、優先級、更新時間）
 *   - 顯示 Forwarder、欄位名稱、提取類型、狀態、版本、成功率
 *   - 行點擊導航到詳情頁
 *   - 完整國際化支援
 *
 * @module src/components/features/rules/RuleTable
 * @since Epic 4 - Story 4.1 (映射規則列表與查看)
 * @lastModified 2026-06-21 (CHANGE-087 Phase 2: 遷移共用 DataTable)
 *
 * @dependencies
 *   - next-intl - 國際化
 *   - @/components/features/common/DataTable - 共用表格封裝（序號欄）
 *   - date-fns - 日期格式化
 */

import { useCallback, useMemo } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import {
  DataTable,
  type DataTableColumn,
} from '@/components/features/common/DataTable'
import { RuleStatusBadge } from './RuleStatusBadge'
import { ExtractionTypeIcon } from './ExtractionTypeIcon'
import { ArrowUpDown, ArrowUp, ArrowDown, Globe } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { zhTW, enUS } from 'date-fns/locale'
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
  /** CHANGE-087: 當前頁碼（1-based），用於序號跨頁連續 */
  page?: number
  /** CHANGE-087: 每頁筆數，用於序號跨頁連續 */
  pageSize?: number
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
  page,
  pageSize,
}: RuleTableProps) {
  const t = useTranslations('rules')
  const locale = useLocale()
  const dateLocale = locale === 'zh-TW' || locale === 'zh-CN' ? zhTW : enUS

  // --- Handlers ---
  const handleSort = useCallback(
    (column: string) => {
      if (sortBy === column) {
        onSort(column, sortOrder === 'asc' ? 'desc' : 'asc')
      } else {
        onSort(column, 'desc')
      }
    },
    [sortBy, sortOrder, onSort]
  )

  // --- Column 定義 ---
  const columns = useMemo<DataTableColumn<RuleListItem>[]>(
    () => [
      // Forwarder / Company
      {
        id: 'company',
        headerClassName: 'w-[160px]',
        header: t('ruleTable.company'),
        cell: (rule) =>
          rule.company ? (
            <div>
              <div className="font-medium">{rule.company.name}</div>
              <div className="text-xs text-muted-foreground">
                {rule.company.code}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400">
              <Globe className="h-4 w-4" />
              <span className="font-medium">{t('ruleTable.universalRule')}</span>
            </div>
          ),
      },
      // 欄位名稱（可排序）
      {
        id: 'fieldName',
        headerClassName: 'cursor-pointer hover:bg-muted/70 transition-colors',
        header: (
          <div
            className="flex items-center"
            onClick={() => handleSort('fieldName')}
          >
            {t('ruleTable.fieldName')}
            <SortIcon column="fieldName" sortBy={sortBy} sortOrder={sortOrder} />
          </div>
        ),
        cell: (rule) => (
          <>
            <div className="font-mono text-sm">{rule.fieldName}</div>
            {rule.fieldLabel && (
              <div className="text-xs text-muted-foreground">
                {rule.fieldLabel}
              </div>
            )}
          </>
        ),
      },
      // 提取類型
      {
        id: 'extractionType',
        headerClassName: 'w-[130px]',
        header: t('ruleTable.extractionType'),
        cell: (rule) => (
          <ExtractionTypeIcon
            type={rule.extractionPattern.method}
            showLabel
            size="sm"
          />
        ),
      },
      // 狀態
      {
        id: 'status',
        headerClassName: 'w-[100px]',
        header: t('ruleTable.status'),
        cell: (rule) => <RuleStatusBadge status={rule.status} />,
      },
      // 版本
      {
        id: 'version',
        headerClassName: 'w-[80px] text-center',
        cellClassName: 'text-center',
        header: t('ruleTable.version'),
        cell: (rule) => (
          <span className="text-sm font-medium">v{rule.version}</span>
        ),
      },
      // 優先級（可排序）
      {
        id: 'priority',
        headerClassName:
          'w-[90px] cursor-pointer hover:bg-muted/70 transition-colors',
        header: (
          <div
            className="flex items-center"
            onClick={() => handleSort('priority')}
          >
            {t('ruleTable.priority')}
            <SortIcon column="priority" sortBy={sortBy} sortOrder={sortOrder} />
          </div>
        ),
        cell: (rule) => (
          <span
            className={cn(
              'text-sm',
              rule.priority > 0 ? 'font-medium' : 'text-muted-foreground'
            )}
          >
            {rule.priority}
          </span>
        ),
      },
      // 成功率
      {
        id: 'successRate',
        headerClassName: 'w-[100px] text-right',
        cellClassName: 'text-right',
        header: t('ruleTable.successRate'),
        cell: (rule) => <SuccessRateCell rate={rule.stats.successRate} />,
      },
      // 更新時間（可排序）
      {
        id: 'updatedAt',
        headerClassName:
          'w-[140px] cursor-pointer hover:bg-muted/70 transition-colors',
        cellClassName: 'text-sm text-muted-foreground',
        header: (
          <div
            className="flex items-center"
            onClick={() => handleSort('updatedAt')}
          >
            {t('ruleTable.updatedAt')}
            <SortIcon column="updatedAt" sortBy={sortBy} sortOrder={sortOrder} />
          </div>
        ),
        cell: (rule) =>
          formatDistanceToNow(new Date(rule.updatedAt), {
            addSuffix: true,
            locale: dateLocale,
          }),
      },
    ],
    [t, sortBy, sortOrder, handleSort, dateLocale]
  )

  // --- Empty State ---
  if (rules.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center border rounded-lg bg-muted/20">
        <p className="text-muted-foreground">{t('ruleTable.noMatchingRules')}</p>
      </div>
    )
  }

  // --- Render ---
  return (
    <div className="border rounded-lg overflow-hidden">
      <DataTable
        data={rules}
        columns={columns}
        getRowId={(rule) => rule.id}
        page={page}
        pageSize={pageSize}
        rowProps={(rule) => ({
          className: 'cursor-pointer hover:bg-muted/50 transition-colors',
          onClick: () => onRowClick(rule.id),
          'data-testid': 'rule-row',
        })}
      />
    </div>
  )
}
