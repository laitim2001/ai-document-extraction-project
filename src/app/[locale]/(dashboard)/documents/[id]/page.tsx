'use client'

/**
 * @fileoverview 文件詳情頁面
 * @description
 *   顯示單一文件的詳細資訊，整合 Epic 13 的預覽組件：
 *   - PDF 文件預覽
 *   - 欄位提取結果
 *   - 處理時間軸
 *   - 審計日誌
 *
 * @module src/app/[locale]/(dashboard)/documents/[id]/page
 * @author Development Team
 * @since Epic 13 - Story 13-8 (Document Detail Page)
 * @lastModified 2026-02-07
 *
 * @features
 *   - 完整的文件詳情檢視
 *   - 四個選項卡：預覽、欄位、處理、審計
 *   - 實時狀態更新（處理中自動輪詢）
 *   - 操作按鈕：重試、下載、刪除
 *   - i18n 國際化支援
 *
 * @dependencies
 *   - next-intl - 國際化
 *   - @/hooks/use-document-detail - 數據獲取 Hook
 *   - @/components/features/document/detail - 詳情組件
 *   - @/components/features/document-preview - PDF 預覽組件
 */

import { useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { DocumentDetailHeader } from '@/components/features/document/detail/DocumentDetailHeader'
import { DocumentDetailStats } from '@/components/features/document/detail/DocumentDetailStats'
import { DocumentDetailTabs } from '@/components/features/document/detail/DocumentDetailTabs'
import { SmartRoutingBanner } from '@/components/features/document/detail/SmartRoutingBanner'
import { useDocumentDetail } from '@/hooks/use-document-detail'
import { Skeleton } from '@/components/ui/skeleton'
import { AlertCircle } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

// ============================================================
// Page Component
// ============================================================

/**
 * 文件詳情頁面
 *
 * @description
 *   顯示單一文件的完整詳情，包含文件預覽、提取欄位、處理時間軸和審計日誌
 */
export default function DocumentDetailPage() {
  // --- Params ---
  const params = useParams()
  const id = params.id as string

  // --- i18n ---
  const t = useTranslations('documents')
  const tc = useTranslations('common')

  // --- Data Fetching ---
  const { document, isLoading, isError, error, refetch } = useDocumentDetail(id)

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
      <DocumentDetailHeader document={document} onRefresh={refetch} />

      {/* CHANGE-025: 智能路由提示橫幅 */}
      <SmartRoutingBanner
        markers={document.smartRoutingMarkers}
        companyId={document.company?.id}
        companyName={document.company?.name}
      />

      {/* Stats Cards */}
      <DocumentDetailStats document={document} />

      {/* Tabs */}
      <DocumentDetailTabs document={document} />
    </div>
  )
}
