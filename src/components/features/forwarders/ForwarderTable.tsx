'use client'

/**
 * @fileoverview Forwarder 資料表格組件（國際化版本）
 * @description
 *   顯示 Forwarder 列表的資料表格。
 *   支援排序、分頁、空狀態顯示。
 *   - 完整國際化支援
 *
 * @module src/components/features/forwarders/ForwarderTable
 * @author Development Team
 * @since Epic 5 - Story 5.1 (Forwarder Profile List)
 * @lastModified 2026-06-22 (CHANGE-087 Phase 2: 遷移共用 DataTable)
 *
 * @dependencies
 *   - next-intl - 國際化
 *   - date-fns - 日期格式化
 *   - @/components/ui - shadcn/ui 組件
 *   - @/components/features/common/DataTable - 共用表格封裝（序號欄）
 *
 * @related
 *   - src/types/forwarder.ts - 類型定義
 *   - src/hooks/use-forwarders.ts - 資料查詢
 */

import * as React from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { formatDistanceToNow, format } from 'date-fns'
import { zhTW, enUS } from 'date-fns/locale'
import { ArrowUpDown, ArrowUp, ArrowDown, MoreHorizontal } from 'lucide-react'
import {
  DataTable,
  type DataTableColumn,
} from '@/components/features/common/DataTable'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
// REFACTOR-001: 使用 company 類型取代 forwarder 類型
import type {
  CompanyListItem as ForwarderListItem,
  CompanySortField as ForwarderSortField,
  SortOrder,
} from '@/types/company'
import { LEGACY_FORWARDER_STATUS_CONFIG, getForwarderDisplayStatus } from '@/types/forwarder'

// ============================================================
// Types
// ============================================================

interface ForwarderTableProps {
  /** Forwarder 列表 */
  forwarders: ForwarderListItem[]
  /** 當前排序欄位 */
  sortBy?: ForwarderSortField
  /** 當前排序方向 */
  sortOrder?: SortOrder
  /** 排序變更回調 */
  onSort?: (field: ForwarderSortField) => void
  /** 檢視詳情回調 */
  onView?: (id: string) => void
  /** 編輯回調 */
  onEdit?: (id: string) => void
  /** 是否顯示操作欄 */
  showActions?: boolean
}

// ============================================================
// Sub-components
// ============================================================

/**
 * 可排序表頭
 */
interface SortableHeaderProps {
  field: ForwarderSortField
  label: string
  currentSortBy?: ForwarderSortField
  currentSortOrder?: SortOrder
  onSort?: (field: ForwarderSortField) => void
  className?: string
}

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
    onSort?.(field)
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
      className={`-ml-3 h-8 data-[state=open]:bg-accent ${className}`}
      onClick={handleClick}
    >
      {label}
      <SortIcon className={`ml-2 h-4 w-4 ${isActive ? 'text-foreground' : 'text-muted-foreground'}`} />
    </Button>
  )
}

/**
 * 狀態徽章
 */
function StatusBadge({ isActive, t }: { isActive: boolean; t: (key: string) => string }) {
  const status = getForwarderDisplayStatus(isActive)
  const statusI18nKey = isActive ? 'active' : 'inactive'

  return (
    <Badge
      variant={LEGACY_FORWARDER_STATUS_CONFIG[status].variant}
      className={LEGACY_FORWARDER_STATUS_CONFIG[status].className}
    >
      {t(`status.${statusI18nKey}`)}
    </Badge>
  )
}

// ============================================================
// Component
// ============================================================

/**
 * Forwarder 資料表格組件
 *
 * @description
 *   顯示 Forwarder 資料的表格，包含以下欄位：
 *   - 名稱（可排序）
 *   - 代碼（可排序）
 *   - 狀態
 *   - 規則數量（可排序）
 *   - 優先級（可排序）
 *   - 最後更新（可排序）
 *   - 操作
 *
 * @example
 *   <ForwarderTable
 *     forwarders={forwarders}
 *     sortBy="updatedAt"
 *     sortOrder="desc"
 *     onSort={handleSort}
 *     onView={handleView}
 *     onEdit={handleEdit}
 *   />
 */
export function ForwarderTable({
  forwarders,
  sortBy,
  sortOrder,
  onSort,
  onView,
  onEdit,
  showActions = true,
}: ForwarderTableProps) {
  const t = useTranslations('companies')
  const locale = useLocale()
  const dateLocale = locale === 'zh-TW' || locale === 'zh-CN' ? zhTW : enUS

  // --- Column 定義 ---
  const columns = React.useMemo<DataTableColumn<ForwarderListItem>[]>(() => {
    const cols: DataTableColumn<ForwarderListItem>[] = [
      // 名稱（可排序）
      {
        id: 'name',
        headerClassName: 'w-[200px]',
        header: (
          <SortableHeader
            field="name"
            label={t('table.columns.name')}
            currentSortBy={sortBy}
            currentSortOrder={sortOrder}
            onSort={onSort}
          />
        ),
        cell: (forwarder) => (
          <div className="flex flex-col">
            <span className="font-medium">{forwarder.displayName || forwarder.name}</span>
            {forwarder.displayName && forwarder.displayName !== forwarder.name && (
              <span className="text-sm text-muted-foreground">{forwarder.name}</span>
            )}
          </div>
        ),
      },
      // 代碼（可排序）
      {
        id: 'code',
        headerClassName: 'w-[120px]',
        header: (
          <SortableHeader
            field="code"
            label={t('table.columns.code')}
            currentSortBy={sortBy}
            currentSortOrder={sortOrder}
            onSort={onSort}
          />
        ),
        cell: (forwarder) => (
          <code className="rounded bg-muted px-1.5 py-0.5 text-sm font-mono">
            {forwarder.code}
          </code>
        ),
      },
      // 狀態
      {
        id: 'status',
        headerClassName: 'w-[100px] text-center',
        header: t('table.columns.status'),
        cellClassName: 'text-center',
        cell: (forwarder) => <StatusBadge isActive={forwarder.isActive} t={t} />,
      },
      // 規則數量（可排序）
      {
        id: 'ruleCount',
        headerClassName: 'w-[100px] text-center',
        header: (
          <SortableHeader
            field="ruleCount"
            label={t('table.columns.ruleCount')}
            currentSortBy={sortBy}
            currentSortOrder={sortOrder}
            onSort={onSort}
            className="justify-center"
          />
        ),
        cellClassName: 'text-center',
        cell: (forwarder) => (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="cursor-help">
                {forwarder.ruleCount > 0 ? (
                  <Badge variant="outline">{forwarder.ruleCount}</Badge>
                ) : (
                  <span className="text-muted-foreground">0</span>
                )}
              </span>
            </TooltipTrigger>
            <TooltipContent>
              <p>{t('table.rulesCount', { count: forwarder.ruleCount })}</p>
            </TooltipContent>
          </Tooltip>
        ),
      },
      // 優先級（可排序）
      {
        id: 'priority',
        headerClassName: 'w-[100px] text-center',
        header: (
          <SortableHeader
            field="priority"
            label={t('table.columns.priority')}
            currentSortBy={sortBy}
            currentSortOrder={sortOrder}
            onSort={onSort}
            className="justify-center"
          />
        ),
        cellClassName: 'text-center',
        cell: (forwarder) => (
          <span className={forwarder.priority > 0 ? 'font-medium' : 'text-muted-foreground'}>
            {forwarder.priority}
          </span>
        ),
      },
      // 最後更新（可排序）
      {
        id: 'updatedAt',
        headerClassName: 'w-[180px]',
        header: (
          <SortableHeader
            field="updatedAt"
            label={t('table.columns.updatedAt')}
            currentSortBy={sortBy}
            currentSortOrder={sortOrder}
            onSort={onSort}
          />
        ),
        cell: (forwarder) => (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="cursor-help text-muted-foreground">
                {formatDistanceToNow(new Date(forwarder.updatedAt), {
                  addSuffix: true,
                  locale: dateLocale,
                })}
              </span>
            </TooltipTrigger>
            <TooltipContent>
              <p>{format(new Date(forwarder.updatedAt), 'yyyy-MM-dd HH:mm:ss', { locale: dateLocale })}</p>
            </TooltipContent>
          </Tooltip>
        ),
      },
    ]

    // 操作（條件顯示）
    if (showActions) {
      cols.push({
        id: 'actions',
        headerClassName: 'w-[80px] text-center',
        header: t('table.columns.actions'),
        cellClassName: 'text-center',
        cell: (forwarder) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <span className="sr-only">Open menu</span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onView?.(forwarder.id)}>
                {t('table.viewDetails')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onEdit?.(forwarder.id)}>
                {t('table.edit')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      })
    }

    return cols
  }, [t, sortBy, sortOrder, onSort, onView, onEdit, showActions, dateLocale])

  if (forwarders.length === 0) {
    return (
      <div className="rounded-md border p-8 text-center text-muted-foreground">
        {t('table.empty')}
      </div>
    )
  }

  return (
    <TooltipProvider>
      <div className="rounded-md border">
        <DataTable
          data={forwarders}
          columns={columns}
          getRowId={(forwarder) => forwarder.id}
        />
      </div>
    </TooltipProvider>
  )
}
