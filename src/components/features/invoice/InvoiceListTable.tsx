'use client'

/**
 * @fileoverview 發票列表表格組件
 * @description
 *   顯示發票文件列表的表格，包含：
 *   - 文件名稱、狀態、處理路徑
 *   - 上傳時間（相對時間）
 *   - 操作按鈕（查看、重試）
 *
 * @module src/components/features/invoice/InvoiceListTable
 * @author Development Team
 * @since Epic 2 - Story 2.7 (Processing Status Tracking & Display)
 * @lastModified 2025-12-18
 *
 * @features
 *   - 響應式表格
 *   - 狀態徽章顯示
 *   - 錯誤訊息顯示
 *   - 重試按鈕（僅失敗狀態）
 *
 * @dependencies
 *   - @/components/ui/table - Table 組件
 *   - @/components/ui/button - Button 組件
 *   - date-fns - 日期格式化
 *   - lucide-react - 圖標
 *
 * @related
 *   - src/hooks/use-documents.ts - Documents Hook
 *   - src/app/(dashboard)/invoices/page.tsx - 發票列表頁面
 */

import * as React from 'react'
import Link from 'next/link'
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
import { zhTW } from 'date-fns/locale'
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
 * 處理路徑顯示映射
 */
const processingPathLabels: Record<string, string> = {
  AUTO_APPROVE: '自動通過',
  QUICK_REVIEW: '快速審核',
  FULL_REVIEW: '完整審核',
  MANUAL_REQUIRED: '需人工處理',
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
  // 載入中狀態
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-pulse text-gray-500">載入中...</div>
      </div>
    )
  }

  // 空狀態
  if (documents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-gray-500">
        <FileText className="h-12 w-12 mb-4 opacity-50" />
        <p>沒有找到文件</p>
      </div>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>文件名稱</TableHead>
          <TableHead>狀態</TableHead>
          <TableHead>處理路徑</TableHead>
          <TableHead>上傳時間</TableHead>
          <TableHead className="text-right">操作</TableHead>
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
                    title="處理過程中發生錯誤"
                  >
                    處理失敗
                  </p>
                )}
              </TableCell>

              {/* 處理路徑 */}
              <TableCell>
                {doc.processingPath ? (
                  <span className="text-sm">
                    {processingPathLabels[doc.processingPath] ||
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
                  locale: zhTW,
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
