'use client'

/**
 * @fileoverview Reference Number 列表組件
 * @description
 *   顯示 Reference Number 資料表格，支援：
 *   - 排序（點擊欄位標題切換升序/降序）
 *   - 分頁導航
 *   - 操作選單（編輯、複製、刪除）
 *   - 類型與狀態 Badge 顯示
 *
 * @module src/components/features/reference-number/ReferenceNumberList
 * @since Epic 20 - Story 20.5 (Management Page - List & Filter)
 * @lastModified 2026-06-22 (CHANGE-087 Phase 2: 遷移共用 DataTable)
 *
 * @dependencies
 *   - next-intl - 國際化
 *   - @/components/features/common/DataTable - 共用表格封裝（序號欄）
 *   - @/components/ui/button - 按鈕
 *   - @/components/ui/dropdown-menu - 下拉選單
 *   - @/hooks/use-toast - Toast 通知
 *   - @/i18n/routing - i18n-aware 路由
 *   - @/lib/i18n-date - 日期格式化
 */

import * as React from 'react'
import { useTranslations, useLocale } from 'next-intl'
import {
  DataTable,
  type DataTableColumn,
} from '@/components/features/common/DataTable'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { MoreHorizontal, Edit, Trash, Copy, ArrowUpDown } from 'lucide-react'
import { Link } from '@/i18n/routing'
import { formatShortDate } from '@/lib/i18n-date'
import { useToast } from '@/hooks/use-toast'
import type { Locale } from '@/i18n/config'
import { ReferenceNumberTypeBadge } from './ReferenceNumberTypeBadge'
import { ReferenceNumberSubTypeBadge } from './ReferenceNumberSubTypeBadge'
import { ReferenceNumberStatusBadge } from './ReferenceNumberStatusBadge'
import { ReferenceNumberDeleteDialog } from './ReferenceNumberDeleteDialog'
import type { ReferenceNumber } from '@/hooks/use-reference-numbers'

// ============================================================
// Types
// ============================================================

interface PaginationInfo {
  page: number
  limit: number
  total: number
  totalPages: number
}

interface ReferenceNumberListProps {
  /** 列表資料 */
  data: ReferenceNumber[]
  /** 分頁資訊 */
  pagination?: PaginationInfo
  /** 是否載入中 */
  isLoading: boolean
  /** 當前排序欄位 */
  currentSortBy?: string
  /** 當前排序方向 */
  currentSortOrder?: 'asc' | 'desc'
  /** 分頁變更回調 */
  onPageChange: (page: number) => void
  /** 排序變更回調 */
  onSortChange: (sortBy: string, sortOrder: 'asc' | 'desc') => void
}

// ============================================================
// Component
// ============================================================

/**
 * Reference Number 列表表格
 *
 * @param props - 組件屬性
 * @returns React 元素
 */
export function ReferenceNumberList({
  data,
  pagination,
  isLoading,
  currentSortBy = 'createdAt',
  currentSortOrder = 'desc',
  onPageChange,
  onSortChange,
}: ReferenceNumberListProps) {
  const t = useTranslations('referenceNumber')
  const locale = useLocale()
  const { toast } = useToast()
  const [deleteId, setDeleteId] = React.useState<string | null>(null)

  // --- Handlers ---

  const handleSort = React.useCallback(
    (column: string) => {
      const isSameColumn = currentSortBy === column
      const newOrder = isSameColumn && currentSortOrder === 'asc' ? 'desc' : 'asc'
      onSortChange(column, newOrder)
    },
    [currentSortBy, currentSortOrder, onSortChange]
  )

  const copyToClipboard = React.useCallback(
    async (text: string) => {
      try {
        await navigator.clipboard.writeText(text)
        toast({
          title: t('toast.copySuccess'),
        })
      } catch {
        toast({
          variant: 'destructive',
          title: t('toast.copyFailed'),
        })
      }
    },
    [toast, t]
  )

  // --- Column 定義 ---
  const columns = React.useMemo<DataTableColumn<ReferenceNumber>[]>(
    () => [
      // 號碼 - 可排序
      {
        id: 'number',
        headerClassName: 'w-48',
        header: (
          <Button
            variant="ghost"
            size="sm"
            className="-ml-3 h-8"
            onClick={() => handleSort('number')}
          >
            {t('columns.number')}
            <ArrowUpDown className="ml-2 h-3 w-3" />
          </Button>
        ),
        cellClassName: 'font-mono text-sm',
        cell: (item) => item.number,
      },
      // 類型
      {
        id: 'type',
        headerClassName: 'w-32',
        header: t('columns.type'),
        cell: (item) => <ReferenceNumberTypeBadge type={item.type} />,
      },
      // 文件子類型
      {
        id: 'documentSubType',
        headerClassName: 'w-28',
        header: t('columns.documentSubType'),
        cell: (item) =>
          item.documentSubType ? (
            <ReferenceNumberSubTypeBadge subType={item.documentSubType} />
          ) : (
            <span className="text-muted-foreground">--</span>
          ),
      },
      // 年份 - 可排序
      {
        id: 'year',
        headerClassName: 'w-24',
        header: (
          <Button
            variant="ghost"
            size="sm"
            className="-ml-3 h-8"
            onClick={() => handleSort('year')}
          >
            {t('columns.year')}
            <ArrowUpDown className="ml-2 h-3 w-3" />
          </Button>
        ),
        cell: (item) => item.year,
      },
      // 地區
      {
        id: 'region',
        headerClassName: 'w-32',
        header: t('columns.region'),
        cellClassName: 'text-sm',
        cell: (item) => item.regionCode,
      },
      // 狀態
      {
        id: 'status',
        headerClassName: 'w-28',
        header: t('columns.status'),
        cell: (item) => <ReferenceNumberStatusBadge status={item.status} />,
      },
      // 匹配次數 - 可排序
      {
        id: 'matchCount',
        headerClassName: 'w-28',
        header: (
          <Button
            variant="ghost"
            size="sm"
            className="-ml-3 h-8"
            onClick={() => handleSort('matchCount')}
          >
            {t('columns.matchCount')}
            <ArrowUpDown className="ml-2 h-3 w-3" />
          </Button>
        ),
        cellClassName: 'tabular-nums',
        cell: (item) => item.matchCount,
      },
      // 建立時間 - 可排序
      {
        id: 'createdAt',
        headerClassName: 'w-36',
        header: (
          <Button
            variant="ghost"
            size="sm"
            className="-ml-3 h-8"
            onClick={() => handleSort('createdAt')}
          >
            {t('columns.createdAt')}
            <ArrowUpDown className="ml-2 h-3 w-3" />
          </Button>
        ),
        cellClassName: 'text-sm text-muted-foreground',
        cell: (item) => formatShortDate(item.createdAt, locale as Locale),
      },
      // 更新時間 - 可排序
      {
        id: 'updatedAt',
        headerClassName: 'w-36',
        header: (
          <Button
            variant="ghost"
            size="sm"
            className="-ml-3 h-8"
            onClick={() => handleSort('updatedAt')}
          >
            {t('columns.updatedAt')}
            <ArrowUpDown className="ml-2 h-3 w-3" />
          </Button>
        ),
        cellClassName: 'text-sm text-muted-foreground',
        cell: (item) => formatShortDate(item.updatedAt, locale as Locale),
      },
      // 操作
      {
        id: 'actions',
        headerClassName: 'w-20',
        header: t('columns.actions'),
        cell: (item) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link href={`/admin/reference-numbers/${item.id}`}>
                  <Edit className="h-4 w-4 mr-2" />
                  {t('actions.edit')}
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => copyToClipboard(item.number)}>
                <Copy className="h-4 w-4 mr-2" />
                {t('actions.copy')}
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive"
                onClick={() => setDeleteId(item.id)}
              >
                <Trash className="h-4 w-4 mr-2" />
                {t('actions.delete')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
    ],
    [t, locale, handleSort, copyToClipboard]
  )

  // --- Loading State ---

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    )
  }

  // --- Render ---

  return (
    <>
      <div className="rounded-md border">
        <DataTable
          data={data}
          columns={columns}
          getRowId={(item) => item.id}
          page={pagination?.page}
          pageSize={pagination?.limit}
          emptyState={t('noData')}
        />
      </div>

      {/* 分頁 */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between pt-4">
          <div className="text-sm text-muted-foreground">
            {t('pagination.showing', {
              from: (pagination.page - 1) * pagination.limit + 1,
              to: Math.min(
                pagination.page * pagination.limit,
                pagination.total
              ),
              total: pagination.total,
            })}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page === 1}
              onClick={() => onPageChange(pagination.page - 1)}
            >
              {t('pagination.previous')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page === pagination.totalPages}
              onClick={() => onPageChange(pagination.page + 1)}
            >
              {t('pagination.next')}
            </Button>
          </div>
        </div>
      )}

      {/* 刪除確認對話框 */}
      <ReferenceNumberDeleteDialog
        id={deleteId}
        onClose={() => setDeleteId(null)}
      />
    </>
  )
}
