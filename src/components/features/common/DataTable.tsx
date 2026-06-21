'use client'

/**
 * @fileoverview 共用 DataTable 封裝（序號欄 + 欄位定義驅動）
 * @description
 *   全站列表共用表格封裝，提供：
 *   - No. 序號欄（跨頁連續：(page-1)*pageSize + index + 1；無分頁時退化為 index + 1）
 *   - 以 columns 定義驅動表頭與儲存格渲染（取代各頁手寫 <TableHead>/<TableCell>）
 *   - 可選的空狀態（沿用各頁既有行為，不擴增未要求能力）
 *   內部組合 shadcn `Table` primitive，不修改 `ui/table.tsx`。
 *
 * @module src/components/features/common/DataTable
 * @since CHANGE-087 Phase 1
 * @lastModified 2026-06-21
 */

import * as React from 'react'
import { useTranslations } from 'next-intl'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

// ============================================================
// Types
// ============================================================

/**
 * 欄位定義
 * @template T 列資料型別
 */
export interface DataTableColumn<T> {
  /** 欄位唯一 id（React key 用） */
  id: string
  /** 表頭內容 */
  header: React.ReactNode
  /** 儲存格渲染（row：列資料；index：該頁內索引，0-based） */
  cell: (row: T, index: number) => React.ReactNode
  /** 表頭 className */
  headerClassName?: string
  /** 儲存格 className */
  cellClassName?: string
}

export interface DataTableProps<T> {
  /** 列資料 */
  data: T[]
  /** 欄位定義 */
  columns: DataTableColumn<T>[]
  /** 取得列的唯一 key */
  getRowId: (row: T) => string
  /** 是否顯示 No. 序號欄（預設 true） */
  showRowNumber?: boolean
  /** 分頁：當前頁碼（1-based）；與 pageSize 一同提供時序號跨頁連續 */
  page?: number
  /** 分頁：每頁筆數；與 page 一同提供時序號跨頁連續 */
  pageSize?: number
  /** 空資料時顯示內容（置於跨欄儲存格內） */
  emptyState?: React.ReactNode
  /** 每列額外屬性（如 data-state="selected"） */
  rowProps?: (row: T) => React.HTMLAttributes<HTMLTableRowElement>
}

// ============================================================
// Component
// ============================================================

/**
 * @component DataTable
 * @description 統一列表表格的序號欄與欄位渲染。載入狀態與資料獲取由呼叫端負責。
 */
export function DataTable<T>({
  data,
  columns,
  getRowId,
  showRowNumber = true,
  page,
  pageSize,
  emptyState,
  rowProps,
}: DataTableProps<T>) {
  const t = useTranslations('common')

  // 跨頁連續序號起始 offset（無分頁時為 0 → 序號 = index + 1）
  const rowNumberOffset =
    page != null && pageSize != null ? (page - 1) * pageSize : 0

  const totalColumns = columns.length + (showRowNumber ? 1 : 0)

  return (
    <Table>
      <TableHeader>
        <TableRow>
          {showRowNumber && (
            <TableHead className="w-[60px]">{t('table.columns.no')}</TableHead>
          )}
          {columns.map((col) => (
            <TableHead key={col.id} className={col.headerClassName}>
              {col.header}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.length === 0 ? (
          <TableRow>
            <TableCell
              colSpan={totalColumns}
              className="py-8 text-center text-gray-500"
            >
              {emptyState}
            </TableCell>
          </TableRow>
        ) : (
          data.map((row, index) => (
            <TableRow key={getRowId(row)} {...(rowProps?.(row) ?? {})}>
              {showRowNumber && (
                <TableCell className="text-sm tabular-nums text-gray-500">
                  {rowNumberOffset + index + 1}
                </TableCell>
              )}
              {columns.map((col) => (
                <TableCell key={col.id} className={col.cellClassName}>
                  {col.cell(row, index)}
                </TableCell>
              ))}
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  )
}
