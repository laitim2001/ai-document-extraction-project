'use client'

/**
 * @fileoverview 發票列表表格組件（國際化版本）
 * @description
 *   顯示發票文件列表的表格，包含：
 *   - 文件名稱、狀態、處理路徑
 *   - 上傳時間（相對時間）
 *   - 操作按鈕（查看、重試）
 *   - 完整國際化支援
 *
 * @module src/components/features/invoice/InvoiceListTable
 * @author Development Team
 * @since Epic 2 - Story 2.7 (Processing Status Tracking & Display)
 * @lastModified 2026-01-17
 *
 * @features
 *   - 響應式表格
 *   - 狀態徽章顯示
 *   - 錯誤訊息顯示
 *   - 重試按鈕（僅失敗狀態）
 *   - i18n 國際化支援
 *
 * @dependencies
 *   - next-intl - 國際化
 *   - @/components/ui/table - Table 組件
 *   - @/components/ui/button - Button 組件
 *   - date-fns - 日期格式化
 *   - lucide-react - 圖標
 *
 * @related
 *   - src/hooks/use-documents.ts - Documents Hook
 *   - src/app/[locale]/(dashboard)/invoices/page.tsx - 發票列表頁面
 *   - messages/{locale}/invoices.json - 翻譯檔案
 */

import * as React from 'react'
import Link from 'next/link'
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
import { ProcessingStatus } from './ProcessingStatus'
import { RetryButton } from './RetryButton'
import { getStatusConfig } from '@/lib/document-status'
import { formatDistanceToNow } from 'date-fns'
import { zhTW, enUS } from 'date-fns/locale'
import { Eye, FileText } from 'lucide-react'
import type { DocumentListItem } from '@/hooks/use-documents'

// ============================================================
// Types
// ============================================================

export interface InvoiceListTableProps {
  /** 文件列表 */
  documents: DocumentListItem[]
  /** 是否載入中 */
  isLoading?: boolean
}

// ============================================================
// Constants
// ============================================================

/**
 * 處理路徑顯示映射 key（用於翻譯查找）
 */
const processingPathKeys: Record<string, string> = {
  AUTO_APPROVE: 'autoApprove',
  QUICK_REVIEW: 'quickReview',
  FULL_REVIEW: 'fullReview',
  MANUAL_REQUIRED: 'manualRequired',
}

// ============================================================
// Component
// ============================================================

/**
 * 發票列表表格組件
 *
 * @description
 *   顯示發票文件列表，包含狀態追蹤和操作功能
 *
 * @example
 * ```tsx
 * <InvoiceListTable
 *   documents={documents}
 *   isLoading={isLoading}
 * />
 * ```
 */
export function InvoiceListTable({
  documents,
  isLoading,
}: InvoiceListTableProps) {
  const t = useTranslations('invoices')
  const locale = useLocale()

  // 根據 locale 選擇日期格式化的 locale
  const dateLocale = locale === 'zh-TW' || locale === 'zh-CN' ? zhTW : enUS

  // 載入中狀態
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-pulse text-gray-500">{t('table.loading')}</div>
      </div>
    )
  }

  // 空狀態
  if (documents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-gray-500">
        <FileText className="h-12 w-12 mb-4 opacity-50" />
        <p>{t('table.noDocuments')}</p>
      </div>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t('table.columns.filename')}</TableHead>
          <TableHead>{t('table.columns.status')}</TableHead>
          <TableHead>{t('table.columns.processingPath')}</TableHead>
          <TableHead>{t('table.columns.uploadTime')}</TableHead>
          <TableHead className="text-right">{t('table.columns.actions')}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {documents.map((doc) => {
          const statusConfig = getStatusConfig(doc.status)

          return (
            <TableRow key={doc.id}>
              {/* 文件名稱 */}
              <TableCell className="font-medium">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-gray-400 flex-shrink-0" />
                  <span
                    className="truncate max-w-[200px]"
                    title={doc.fileName}
                  >
                    {doc.fileName}
                  </span>
                </div>
              </TableCell>

              {/* 狀態 */}
              <TableCell>
                <ProcessingStatus status={doc.status} />
                {statusConfig.isError && doc.uploader && (
                  <p
                    className="text-xs text-red-500 mt-1 truncate max-w-[150px]"
                    title={t('table.processingError')}
                  >
                    {t('table.processingFailed')}
                  </p>
                )}
              </TableCell>

              {/* 處理路徑 */}
              <TableCell>
                {doc.processingPath ? (
                  <span className="text-sm">
                    {t(`processingPath.${processingPathKeys[doc.processingPath]}`) ||
                      doc.processingPath}
                  </span>
                ) : (
                  <span className="text-gray-400">--</span>
                )}
              </TableCell>

              {/* 上傳時間 */}
              <TableCell className="text-gray-500 text-sm">
                {formatDistanceToNow(new Date(doc.createdAt), {
                  addSuffix: true,
                  locale: dateLocale,
                })}
              </TableCell>

              {/* 操作 */}
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-2">
                  {statusConfig.canRetry && (
                    <RetryButton documentId={doc.id} />
                  )}
                  <Link href={`/invoices/${doc.id}`}>
                    <Button variant="ghost" size="sm">
                      <Eye className="h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}
