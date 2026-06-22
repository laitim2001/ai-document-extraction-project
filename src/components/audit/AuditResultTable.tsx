'use client'

/**
 * @fileoverview 審計查詢結果表格組件
 * @description
 *   顯示審計查詢結果的表格：
 *   - 分頁顯示（每頁 50 筆）
 *   - 排序功能
 *   - 結果內搜尋
 *   - 狀態 Badge 顯示
 *
 * @module src/components/audit/AuditResultTable
 * @since Epic 8 - Story 8.3 (處理記錄查詢)
 * @lastModified 2025-12-20
 *
 * @features
 *   - AC2: 查詢結果分頁（每頁 50 筆）
 *   - AC3: 結果內篩選（排序、搜尋）
 *
 * @dependencies
 *   - @tanstack/react-table - 表格功能
 *   - date-fns - 日期格式化
 *   - @/types/audit-query - 類型定義
 */

import { useState, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  ColumnDef,
  flexRender,
  SortingState
} from '@tanstack/react-table'
import { format } from 'date-fns'
import { zhTW } from 'date-fns/locale'
import { ArrowUpDown, Search, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import {
  ProcessingRecord,
  STATUS_BADGE_VARIANT
} from '@/types/audit-query'

// ============================================================
// Types
// ============================================================

interface AuditResultTableProps {
  /** 處理記錄資料 */
  data: ProcessingRecord[]
  /** 總記錄數 */
  total: number
  /** 當前頁碼 */
  page: number
  /** 每頁筆數 */
  pageSize: number
  /** 頁碼變更回調 */
  onPageChange: (page: number) => void
  /** 是否正在載入 */
  loading?: boolean
  /** 查詢耗時（毫秒） */
  queryTime?: number
  /** 自定義 className */
  className?: string
}

// ============================================================
// Component
// ============================================================

/**
 * @component AuditResultTable
 * @description
 *   審計查詢結果表格組件，支援分頁、排序和搜尋功能。
 */
export function AuditResultTable({
  data,
  total,
  page,
  pageSize,
  onPageChange,
  loading = false,
  queryTime,
  className
}: AuditResultTableProps) {
  // --- i18n ---
  const t = useTranslations('reports')

  // --- State ---
  const [globalFilter, setGlobalFilter] = useState('')
  const [sorting, setSorting] = useState<SortingState>([])

  // --- Column Definitions ---
  const columns = useMemo<ColumnDef<ProcessingRecord>[]>(
    () => [
      {
        accessorKey: 'invoiceNumber',
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          >
            {t('auditResult.columns.invoiceNumber')}
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        ),
        cell: ({ row }) => (
          <span className="font-mono">
            {row.original.invoiceNumber || '-'}
          </span>
        )
      },
      {
        accessorKey: 'forwarderName',
        header: t('auditResult.columns.forwarder'),
        cell: ({ row }) => (
          <div>
            <div className="font-medium">{row.original.forwarderName || '-'}</div>
            <div className="text-xs text-muted-foreground">
              {row.original.forwarderCode}
            </div>
          </div>
        )
      },
      {
        accessorKey: 'cityName',
        header: t('auditResult.columns.city'),
        cell: ({ row }) => (
          <Badge variant="outline">{row.original.cityName}</Badge>
        )
      },
      {
        accessorKey: 'status',
        header: t('auditResult.columns.status'),
        cell: ({ row }) => (
          <Badge
            variant={STATUS_BADGE_VARIANT[row.original.status] || 'outline'}
          >
            {t.has(`auditResult.statusLabels.${row.original.status}`)
              ? t(`auditResult.statusLabels.${row.original.status}`)
              : row.original.status}
          </Badge>
        )
      },
      {
        accessorKey: 'processingType',
        header: t('auditResult.columns.processingType'),
        cell: ({ row }) => (
          <Badge variant={row.original.processingType === 'AUTO' ? 'default' : 'secondary'}>
            {row.original.processingType === 'AUTO'
              ? t('auditResult.processingTypeAuto')
              : t('auditResult.processingTypeManual')}
          </Badge>
        )
      },
      {
        accessorKey: 'processedByName',
        header: t('auditResult.columns.processedBy'),
        cell: ({ row }) => row.original.processedByName || '-'
      },
      {
        accessorKey: 'createdAt',
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          >
            {t('auditResult.columns.createdAt')}
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        ),
        cell: ({ row }) =>
          format(new Date(row.original.createdAt), 'yyyy-MM-dd HH:mm', {
            locale: zhTW
          })
      },
      {
        accessorKey: 'aiCost',
        header: t('auditResult.columns.aiCost'),
        cell: ({ row }) =>
          row.original.aiCost != null
            ? `$${row.original.aiCost.toFixed(4)}`
            : '-'
      },
      {
        accessorKey: 'corrections',
        header: t('auditResult.columns.corrections'),
        cell: ({ row }) => row.original.corrections || 0
      }
    ],
    [t]
  )

  // --- Table Instance ---
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    state: {
      globalFilter,
      sorting
    },
    onGlobalFilterChange: setGlobalFilter,
    onSortingChange: setSorting
  })

  // --- Pagination ---
  const totalPages = Math.ceil(total / pageSize)
  const canGoPrevious = page > 1
  const canGoNext = page < totalPages

  // --- Render ---
  return (
    <div className={cn('space-y-4', className)}>
      {/* 工具列 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t('auditResult.searchPlaceholder')}
            value={globalFilter}
            onChange={e => setGlobalFilter(e.target.value)}
            className="w-64"
          />
        </div>
        <div className="text-sm text-muted-foreground">
          {t('auditResult.recordCount', { count: total.toLocaleString() })}
          {queryTime != null && (
            <span className="ml-2">
              {t('auditResult.queryTime', {
                seconds: (queryTime / 1000).toFixed(2)
              })}
            </span>
          )}
        </div>
      </div>

      {/* 表格 */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map(headerGroup => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map(header => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
                    <span className="ml-2">{t('auditResult.loading')}</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map(row => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map(cell => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  {t('auditResult.noResults')}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* 分頁 */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {t('auditResult.pageInfo', { page, totalPages })}
          <span className="ml-2 text-xs">
            {t('auditResult.pageRange', {
              start: (page - 1) * pageSize + 1,
              end: Math.min(page * pageSize, total)
            })}
          </span>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={!canGoPrevious || loading}
            onClick={() => onPageChange(page - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
            {t('auditResult.previousPage')}
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!canGoNext || loading}
            onClick={() => onPageChange(page + 1)}
          >
            {t('auditResult.nextPage')}
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
