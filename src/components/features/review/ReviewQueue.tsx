/**
 * @fileoverview 審核隊列主組件（國際化版本）
 * @description
 *   審核隊列的主要容器組件，包含：
 *   - 數據獲取（使用 useReviewQueue Hook）
 *   - 載入狀態處理
 *   - 錯誤狀態處理
 *   - 空狀態處理
 *   - 分頁控制
 *   - 完整國際化支援
 *
 * @module src/components/features/review/ReviewQueue
 * @since Epic 3 - Story 3.1
 * @lastModified 2026-01-17
 *
 * @dependencies
 *   - next-intl - 國際化
 *   - @/hooks/useReviewQueue - 數據獲取 Hook
 *   - @/components/ui - shadcn UI 組件
 *   - @/types/review - 類型定義
 */

'use client'

import { useTranslations } from 'next-intl'
import { useReviewQueue, usePrefetchNextPage } from '@/hooks/useReviewQueue'
import { ReviewQueueTable } from './ReviewQueueTable'
import { ReviewQueueSkeleton } from './ReviewQueueSkeleton'
import type { ReviewQueueFilters } from '@/types/review'
import { Button } from '@/components/ui/button'
import { AlertCircle, RefreshCw } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

// ============================================================
// Types
// ============================================================

interface ReviewQueueProps {
  /** 篩選條件 */
  filters: ReviewQueueFilters
  /** 當前頁碼 */
  page: number
  /** 頁碼變更回調 */
  onPageChange: (page: number) => void
  /** 選擇項目回調 */
  onSelectItem: (documentId: string) => void
}

// ============================================================
// Component
// ============================================================

/**
 * 審核隊列組件
 * 整合數據獲取、狀態處理和表格顯示
 *
 * @example
 * ```tsx
 * <ReviewQueue
 *   filters={filters}
 *   page={page}
 *   onPageChange={setPage}
 *   onSelectItem={(id) => router.push(`/review/${id}`)}
 * />
 * ```
 */
export function ReviewQueue({
  filters,
  page,
  onPageChange,
  onSelectItem,
}: ReviewQueueProps) {
  const t = useTranslations('review')
  const { data, isLoading, error, refetch, isFetching } = useReviewQueue({
    ...filters,
    page,
    pageSize: 20,
  })

  // 預取下一頁
  usePrefetchNextPage({ ...filters, page }, data?.meta.totalPages || 0)

  // --- Loading State ---
  if (isLoading) {
    return <ReviewQueueSkeleton />
  }

  // --- Error State ---
  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>{t('queue.loadFailed')}</AlertTitle>
        <AlertDescription className="flex items-center justify-between">
          <span>{t('queue.loadFailedDesc')}</span>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            {t('queue.retry')}
          </Button>
        </AlertDescription>
      </Alert>
    )
  }

  // --- Empty State ---
  if (!data?.data.length) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p className="text-lg">{t('empty.title')}</p>
        <p className="text-sm mt-2">{t('empty.description')}</p>
      </div>
    )
  }

  // --- Data State ---
  return (
    <div className="space-y-4">
      {/* 頂部資訊列 */}
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">
          {t('queue.totalPending', { count: data.meta.total })}
        </p>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => refetch()}
          disabled={isFetching}
        >
          <RefreshCw
            className={`h-4 w-4 mr-2 ${isFetching ? 'animate-spin' : ''}`}
          />
          {t('queue.refresh')}
        </Button>
      </div>

      {/* 表格 */}
      <ReviewQueueTable items={data.data} onSelectItem={onSelectItem} />

      {/* 分頁 */}
      {data.meta.totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page === 1}
            onClick={() => onPageChange(page - 1)}
          >
            {t('queue.previous')}
          </Button>
          <span className="flex items-center px-4 text-sm">
            {page} / {data.meta.totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page === data.meta.totalPages}
            onClick={() => onPageChange(page + 1)}
          >
            {t('queue.next')}
          </Button>
        </div>
      )}
    </div>
  )
}
