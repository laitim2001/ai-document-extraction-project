'use client'

/**
 * @fileoverview 發票詳情頁面
 * @description
 *   顯示單一發票的詳細資訊，整合 Epic 13 的預覽組件：
 *   - PDF 文件預覽
 *   - 欄位提取結果
 *   - 處理時間軸
 *   - 審計日誌
 *
 * @module src/app/[locale]/(dashboard)/invoices/[id]/page
 * @author Development Team
 * @since Epic 13 - Story 13-8 (Invoice Detail Page)
 * @lastModified 2026-01-18
 *
 * @features
 *   - 完整的發票詳情檢視
 *   - 四個選項卡：預覽、欄位、處理、審計
 *   - 實時狀態更新（處理中自動輪詢）
 *   - 操作按鈕：重試、下載、刪除
 *   - i18n 國際化支援
 *
 * @dependencies
 *   - next-intl - 國際化
 *   - @/hooks/use-invoice-detail - 數據獲取 Hook
 *   - @/components/features/invoice/detail - 詳情組件
 *   - @/components/features/document-preview - PDF 預覽組件
 */

import { useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { InvoiceDetailHeader } from '@/components/features/invoice/detail/InvoiceDetailHeader'
import { InvoiceDetailStats } from '@/components/features/invoice/detail/InvoiceDetailStats'
import { InvoiceDetailTabs } from '@/components/features/invoice/detail/InvoiceDetailTabs'
import { useInvoiceDetail } from '@/hooks/use-invoice-detail'
import { Skeleton } from '@/components/ui/skeleton'
import { AlertCircle } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

// ============================================================
// Page Component
// ============================================================

/**
 * 發票詳情頁面
 *
 * @description
 *   顯示單一發票的完整詳情，包含文件預覽、提取欄位、處理時間軸和審計日誌
 */
export default function InvoiceDetailPage() {
  // --- Params ---
  const params = useParams()
  const id = params.id as string

  // --- i18n ---
  const t = useTranslations('invoices')
  const tc = useTranslations('common')

  // --- Data Fetching ---
  const { document, isLoading, isError, error, refetch } = useInvoiceDetail(id)

  // --- Loading State ---
  if (isLoading) {
    return (
      <div className="space-y-6 p-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10" />
          <div className="flex-1">
            <Skeleton className="h-8 w-64 mb-2" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-[600px]" />
      </div>
    )
  }

  // --- Error State ---
  if (isError || !document) {
    return (
      <div className="p-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>{tc('errors.title')}</AlertTitle>
          <AlertDescription>
            {error?.message || t('detail.errors.notFound')}
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  // --- Render ---
  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <InvoiceDetailHeader document={document} onRefresh={refetch} />

      {/* Stats Cards */}
      <InvoiceDetailStats document={document} />

      {/* Tabs */}
      <InvoiceDetailTabs document={document} />
    </div>
  )
}
