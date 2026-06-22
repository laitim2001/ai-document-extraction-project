'use client'

/**
 * @fileoverview Exchange Rate 列表組件
 * @description
 *   顯示 Exchange Rate 資料表格，支援：
 *   - 排序（點擊欄位標題切換升序/降序）
 *   - 分頁導航
 *   - 操作選單（編輯、切換狀態、刪除）
 *   - 狀態和來源 Badge 顯示
 *
 * @module src/components/features/exchange-rate/ExchangeRateList
 * @since Epic 21 - Story 21.6 (Management Page - List & Filter)
 * @lastModified 2026-06-22 (CHANGE-087 Phase 2: 遷移共用 DataTable)
 *
 * @dependencies
 *   - next-intl - 國際化
 *   - @/components/features/common/DataTable - 共用表格封裝（序號欄）
 *   - @/components/ui/button - 按鈕
 *   - @/components/ui/badge - 徽章
 *   - @/components/ui/dropdown-menu - 下拉選單
 *   - @/hooks/use-exchange-rates - React Query hooks
 *   - @/hooks/use-toast - Toast 通知
 *   - @/i18n/routing - i18n-aware 路由
 */

import * as React from 'react'
import { useTranslations } from 'next-intl'
import {
  DataTable,
  type DataTableColumn,
} from '@/components/features/common/DataTable'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  MoreHorizontal,
  Pencil,
  Trash2,
  ToggleLeft,
  ArrowUpDown,
} from 'lucide-react'
import { Link } from '@/i18n/routing'
import { useToast } from '@/hooks/use-toast'
import {
  useDeleteExchangeRate,
  useToggleExchangeRate,
  type ExchangeRateItem,
} from '@/hooks/use-exchange-rates'

// ============================================================
// Types
// ============================================================

interface PaginationInfo {
  page: number
  limit: number
  total: number
  totalPages: number
}

interface ExchangeRateListProps {
  /** 列表資料 */
  data: ExchangeRateItem[]
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
 * Exchange Rate 列表表格
 *
 * @param props - 組件屬性
 * @returns React 元素
 */
export function ExchangeRateList({
  data,
  pagination,
  isLoading,
  currentSortBy = 'createdAt',
  currentSortOrder = 'desc',
  onPageChange,
  onSortChange,
}: ExchangeRateListProps) {
  const t = useTranslations('exchangeRate')
  const { toast } = useToast()
  const [deleteId, setDeleteId] = React.useState<string | null>(null)

  const deleteMutation = useDeleteExchangeRate()
  const toggleMutation = useToggleExchangeRate()

  // --- Handlers ---

  const handleSort = React.useCallback(
    (column: string) => {
      const isSameColumn = currentSortBy === column
      const newOrder = isSameColumn && currentSortOrder === 'asc' ? 'desc' : 'asc'
      onSortChange(column, newOrder)
    },
    [currentSortBy, currentSortOrder, onSortChange]
  )

  const handleDelete = React.useCallback(
    async (id: string) => {
      try {
        await deleteMutation.mutateAsync(id)
        toast({
          title: t('messages.deleted'),
        })
      } catch {
        toast({
          variant: 'destructive',
          title: t('messages.deleteFailed'),
        })
      }
      setDeleteId(null)
    },
    [deleteMutation, toast, t]
  )

  const handleToggle = React.useCallback(
    async (id: string) => {
      try {
        await toggleMutation.mutateAsync(id)
        toast({
          title: t('messages.toggled'),
        })
      } catch {
        toast({
          variant: 'destructive',
          title: t('messages.toggleFailed'),
        })
      }
    },
    [toggleMutation, toast, t]
  )

  // --- Column 定義 ---
  const columns = React.useMemo<DataTableColumn<ExchangeRateItem>[]>(
    () => [
      // 來源貨幣 - 可排序
      {
        id: 'fromCurrency',
        headerClassName: 'w-32',
        header: (
          <Button
            variant="ghost"
            size="sm"
            className="-ml-3 h-8"
            onClick={() => handleSort('fromCurrency')}
          >
            {t('list.fromCurrency')}
            <ArrowUpDown className="ml-2 h-3 w-3" />
          </Button>
        ),
        cellClassName: 'font-mono text-sm',
        cell: (item) => item.fromCurrency,
      },
      // 目標貨幣 - 可排序
      {
        id: 'toCurrency',
        headerClassName: 'w-32',
        header: (
          <Button
            variant="ghost"
            size="sm"
            className="-ml-3 h-8"
            onClick={() => handleSort('toCurrency')}
          >
            {t('list.toCurrency')}
            <ArrowUpDown className="ml-2 h-3 w-3" />
          </Button>
        ),
        cellClassName: 'font-mono text-sm',
        cell: (item) => item.toCurrency,
      },
      // 匯率 - 可排序
      {
        id: 'rate',
        headerClassName: 'w-36 text-right',
        header: (
          <Button
            variant="ghost"
            size="sm"
            className="-ml-3 h-8"
            onClick={() => handleSort('rate')}
          >
            {t('list.rate')}
            <ArrowUpDown className="ml-2 h-3 w-3" />
          </Button>
        ),
        cellClassName: 'text-right font-mono tabular-nums',
        cell: (item) => Number(item.rate).toFixed(6),
      },
      // 年份 - 可排序
      {
        id: 'effectiveYear',
        headerClassName: 'w-24',
        header: (
          <Button
            variant="ghost"
            size="sm"
            className="-ml-3 h-8"
            onClick={() => handleSort('effectiveYear')}
          >
            {t('list.effectiveYear')}
            <ArrowUpDown className="ml-2 h-3 w-3" />
          </Button>
        ),
        cell: (item) => item.effectiveYear,
      },
      // 來源
      {
        id: 'source',
        headerClassName: 'w-32',
        header: t('list.source'),
        cell: (item) => <Badge variant="outline">{t(`source.${item.source}`)}</Badge>,
      },
      // 狀態
      {
        id: 'status',
        headerClassName: 'w-24',
        header: t('list.status'),
        cell: (item) => (
          <Badge variant={item.isActive ? 'default' : 'secondary'}>
            {item.isActive ? t('filters.active') : t('filters.inactive')}
          </Badge>
        ),
      },
      // 操作
      {
        id: 'actions',
        headerClassName: 'w-20',
        header: t('list.actions'),
        cell: (item) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link href={`/admin/exchange-rates/${item.id}`}>
                  <Pencil className="h-4 w-4 mr-2" />
                  {t('actions.edit')}
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleToggle(item.id)}>
                <ToggleLeft className="h-4 w-4 mr-2" />
                {t('actions.toggle')}
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive"
                onClick={() => setDeleteId(item.id)}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                {t('actions.delete')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
    ],
    [t, handleSort, handleToggle]
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
          emptyState={t('list.empty')}
        />
      </div>

      {/* 分頁 */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between pt-4">
          <div className="text-sm text-muted-foreground">
            {t('pagination.showing', {
              from: (pagination.page - 1) * pagination.limit + 1,
              to: Math.min(pagination.page * pagination.limit, pagination.total),
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
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('actions.delete')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('messages.confirmDelete')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('pagination.previous')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && handleDelete(deleteId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t('actions.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
