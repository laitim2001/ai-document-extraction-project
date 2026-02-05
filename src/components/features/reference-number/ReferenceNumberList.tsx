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
 * @lastModified 2026-02-05
 *
 * @dependencies
 *   - next-intl - 國際化
 *   - @/components/ui/table - 表格基礎組件
 *   - @/components/ui/button - 按鈕
 *   - @/components/ui/dropdown-menu - 下拉選單
 *   - @/hooks/use-toast - Toast 通知
 *   - @/i18n/routing - i18n-aware 路由
 *   - @/lib/i18n-date - 日期格式化
 */

import * as React from 'react'
import { useTranslations, useLocale } from 'next-intl'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
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
        <Table>
          <TableHeader>
            <TableRow>
              {/* 號碼 - 可排序 */}
              <TableHead className="w-48">
                <Button
                  variant="ghost"
                  size="sm"
                  className="-ml-3 h-8"
                  onClick={() => handleSort('number')}
                >
                  {t('columns.number')}
                  <ArrowUpDown className="ml-2 h-3 w-3" />
                </Button>
              </TableHead>
              {/* 類型 */}
              <TableHead className="w-32">{t('columns.type')}</TableHead>
              {/* 年份 - 可排序 */}
              <TableHead className="w-24">
                <Button
                  variant="ghost"
                  size="sm"
                  className="-ml-3 h-8"
                  onClick={() => handleSort('year')}
                >
                  {t('columns.year')}
                  <ArrowUpDown className="ml-2 h-3 w-3" />
                </Button>
              </TableHead>
              {/* 地區 */}
              <TableHead className="w-32">{t('columns.region')}</TableHead>
              {/* 狀態 */}
              <TableHead className="w-28">{t('columns.status')}</TableHead>
              {/* 匹配次數 - 可排序 */}
              <TableHead className="w-28">
                <Button
                  variant="ghost"
                  size="sm"
                  className="-ml-3 h-8"
                  onClick={() => handleSort('matchCount')}
                >
                  {t('columns.matchCount')}
                  <ArrowUpDown className="ml-2 h-3 w-3" />
                </Button>
              </TableHead>
              {/* 建立時間 - 可排序 */}
              <TableHead className="w-36">
                <Button
                  variant="ghost"
                  size="sm"
                  className="-ml-3 h-8"
                  onClick={() => handleSort('createdAt')}
                >
                  {t('columns.createdAt')}
                  <ArrowUpDown className="ml-2 h-3 w-3" />
                </Button>
              </TableHead>
              {/* 更新時間 - 可排序 */}
              <TableHead className="w-36">
                <Button
                  variant="ghost"
                  size="sm"
                  className="-ml-3 h-8"
                  onClick={() => handleSort('updatedAt')}
                >
                  {t('columns.updatedAt')}
                  <ArrowUpDown className="ml-2 h-3 w-3" />
                </Button>
              </TableHead>
              {/* 操作 */}
              <TableHead className="w-20">{t('columns.actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8">
                  {t('noData')}
                </TableCell>
              </TableRow>
            ) : (
              data.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-mono text-sm">
                    {item.number}
                  </TableCell>
                  <TableCell>
                    <ReferenceNumberTypeBadge type={item.type} />
                  </TableCell>
                  <TableCell>{item.year}</TableCell>
                  <TableCell className="text-sm">
                    {item.regionCode}
                  </TableCell>
                  <TableCell>
                    <ReferenceNumberStatusBadge status={item.status} />
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {item.matchCount}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatShortDate(item.createdAt, locale as Locale)}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatShortDate(item.updatedAt, locale as Locale)}
                  </TableCell>
                  <TableCell>
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
                        <DropdownMenuItem
                          onClick={() => copyToClipboard(item.number)}
                        >
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
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
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
