'use client'

/**
 * @fileoverview Line Items 表格組件
 * @description
 *   顯示文件提取結果中的行項目（Line Items），支援：
 *   - 動態欄位推斷（只顯示有值的欄位）
 *   - 信心度顏色編碼
 *   - needsClassification 警告標記
 *   - i18n 國際化
 *
 * @module src/components/features/document-preview
 * @since CHANGE-051 - Extracted Fields 顯示重構
 * @lastModified 2026-02-26
 *
 * @dependencies
 *   - next-intl - 國際化
 *   - @/components/ui/table - shadcn/ui 表格
 *   - @/types/extraction-v3.types - LineItemV3 類型
 */

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { LineItemV3 } from '@/types/extraction-v3.types'

// ============================================================
// Types
// ============================================================

export interface LineItemsTableProps {
  /** 行項目列表 */
  lineItems: LineItemV3[]
  /** 自定義 CSS 類名 */
  className?: string
}

// ============================================================
// Constants
// ============================================================

/** 固定欄位順序 */
const FIXED_COLUMNS = [
  'description',
  'classifiedAs',
  'quantity',
  'unitPrice',
  'amount',
  'confidence',
] as const

// ============================================================
// Helper Functions
// ============================================================

/**
 * 從 lineItems 中推斷可用的動態欄位
 */
function inferColumns(lineItems: LineItemV3[]): string[] {
  return FIXED_COLUMNS.filter((col) =>
    lineItems.some((item) => {
      const value = item[col as keyof LineItemV3]
      return value !== undefined && value !== null
    })
  )
}

/**
 * 取得信心度顏色類名
 */
function getConfidenceColor(confidence: number): string {
  if (confidence >= 90) return 'text-green-700'
  if (confidence >= 70) return 'text-yellow-700'
  return 'text-red-700'
}

/**
 * 格式化數字（金額/數量）
 */
function formatNumber(value: number | undefined): string {
  if (value === undefined || value === null) return '-'
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })
}

// ============================================================
// Component
// ============================================================

/**
 * 行項目表格組件
 *
 * @description
 *   從 LineItemV3[] 動態推斷可用欄位，只顯示有值的欄位。
 *   支援信心度顏色編碼和 needsClassification 警告。
 */
export function LineItemsTable({ lineItems, className }: LineItemsTableProps) {
  const t = useTranslations('documentPreview')

  const columns = React.useMemo(() => inferColumns(lineItems), [lineItems])

  if (lineItems.length === 0) {
    return (
      <div className="flex items-center justify-center py-8 text-gray-500">
        <p>{t('lineItems.empty')}</p>
      </div>
    )
  }

  return (
    <div className={cn('overflow-auto', className)}>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">#</TableHead>
            {columns.map((col) => (
              <TableHead key={col}>
                {t(`lineItems.columns.${col}`)}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {lineItems.map((item, index) => (
            <TableRow key={index}>
              <TableCell className="font-mono text-xs text-gray-500">
                {index + 1}
              </TableCell>
              {columns.map((col) => (
                <TableCell key={col}>
                  <CellValue col={col} item={item} t={t} />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

// ============================================================
// Cell Renderer
// ============================================================

interface CellValueProps {
  col: string
  item: LineItemV3
  t: ReturnType<typeof useTranslations>
}

function CellValue({ col, item, t }: CellValueProps) {
  switch (col) {
    case 'amount':
    case 'unitPrice':
      return (
        <span className="font-mono text-sm">
          {formatNumber(item[col as keyof LineItemV3] as number | undefined)}
        </span>
      )

    case 'quantity':
      return (
        <span className="font-mono text-sm">
          {item.quantity !== undefined ? item.quantity : '-'}
        </span>
      )

    case 'confidence':
      return (
        <span className={cn('text-sm font-medium', getConfidenceColor(item.confidence))}>
          {Math.round(item.confidence)}%
        </span>
      )

    case 'classifiedAs':
      return (
        <div className="flex items-center gap-1.5">
          <span className="text-sm">{item.classifiedAs ?? '-'}</span>
          {item.needsClassification && (
            <span className="inline-flex items-center gap-0.5 rounded bg-amber-50 px-1.5 py-0.5 text-xs text-amber-700">
              <AlertTriangle className="h-3 w-3" />
              {t('lineItems.needsClassification')}
            </span>
          )}
        </div>
      )

    case 'description':
      return <span className="text-sm">{item.description}</span>

    default:
      return (
        <span className="text-sm">
          {String((item as unknown as Record<string, unknown>)[col] ?? '-')}
        </span>
      )
  }
}

LineItemsTable.displayName = 'LineItemsTable'
