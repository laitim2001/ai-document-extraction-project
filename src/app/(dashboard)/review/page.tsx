/**
 * @fileoverview 審核列表頁面
 * @description
 *   待審核發票列表頁面，提供：
 *   - 待審核發票的列表顯示
 *   - Forwarder、處理路徑、信心度範圍篩選
 *   - 分頁功能
 *   - 點擊進入審核詳情
 *
 *   URL 參數（支援書籤和分享）：
 *   - forwarderId: Forwarder ID
 *   - processingPath: 處理路徑
 *   - minConfidence: 最低信心度
 *   - maxConfidence: 最高信心度
 *   - page: 頁碼
 *
 * @module src/app/(dashboard)/review/page
 * @since Epic 3 - Story 3.1
 * @lastModified 2025-12-18
 *
 * @dependencies
 *   - next/navigation - URL 路由
 *   - @/components/features/review - 審核組件
 *   - @/types/review - 類型定義
 */

'use client'

import { useState, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ReviewQueue, ReviewFilters } from '@/components/features/review'
import { ReviewQueueSkeleton } from '@/components/features/review'
import type { ReviewQueueFilters } from '@/types/review'
import type { ProcessingPath } from '@prisma/client'

// ============================================================
// Helper Functions
// ============================================================

/**
 * 從 URL 解析篩選參數
 */
function parseFiltersFromUrl(searchParams: URLSearchParams): ReviewQueueFilters {
  return {
    forwarderId: searchParams.get('forwarderId') || undefined,
    processingPath:
      (searchParams.get('processingPath') as ProcessingPath) || undefined,
    minConfidence: searchParams.get('minConfidence')
      ? parseInt(searchParams.get('minConfidence')!, 10)
      : undefined,
    maxConfidence: searchParams.get('maxConfidence')
      ? parseInt(searchParams.get('maxConfidence')!, 10)
      : undefined,
  }
}

/**
 * 將篩選參數轉換為 URL 查詢字串
 */
function filtersToUrlParams(filters: ReviewQueueFilters, page: number): string {
  const params = new URLSearchParams()

  if (filters.forwarderId) {
    params.set('forwarderId', filters.forwarderId)
  }
  if (filters.processingPath) {
    params.set('processingPath', filters.processingPath)
  }
  if (filters.minConfidence !== undefined) {
    params.set('minConfidence', filters.minConfidence.toString())
  }
  if (filters.maxConfidence !== undefined) {
    params.set('maxConfidence', filters.maxConfidence.toString())
  }
  if (page > 1) {
    params.set('page', page.toString())
  }

  return params.toString()
}

// ============================================================
// Main Content Component
// ============================================================

function ReviewPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  // 從 URL 讀取篩選狀態
  const [filters, setFilters] = useState<ReviewQueueFilters>(() =>
    parseFiltersFromUrl(searchParams)
  )

  const [page, setPage] = useState(() =>
    parseInt(searchParams.get('page') || '1', 10)
  )

  // 更新篩選條件
  const handleFiltersChange = useCallback(
    (newFilters: ReviewQueueFilters) => {
      setFilters(newFilters)
      setPage(1) // 重置頁碼

      // 更新 URL
      const urlParams = filtersToUrlParams(newFilters, 1)
      router.push(`/review${urlParams ? `?${urlParams}` : ''}`)
    },
    [router]
  )

  // 更新頁碼
  const handlePageChange = useCallback(
    (newPage: number) => {
      setPage(newPage)

      // 更新 URL
      const urlParams = filtersToUrlParams(filters, newPage)
      router.push(`/review${urlParams ? `?${urlParams}` : ''}`)
    },
    [filters, router]
  )

  // 點擊進入詳情 (AC3)
  const handleSelectItem = useCallback(
    (documentId: string) => {
      router.push(`/review/${documentId}`)
    },
    [router]
  )

  return (
    <>
      <ReviewFilters filters={filters} onFiltersChange={handleFiltersChange} />

      <ReviewQueue
        filters={filters}
        page={page}
        onPageChange={handlePageChange}
        onSelectItem={handleSelectItem}
      />
    </>
  )
}

// ============================================================
// Page Component
// ============================================================

/**
 * 審核列表頁面
 * 顯示待審核發票列表，支援篩選和分頁
 */
export default function ReviewPage() {
  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* 頁面標題 */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">待審核發票</h1>
      </div>

      {/* 使用 Suspense 包裝使用 useSearchParams 的組件 */}
      <Suspense fallback={<ReviewQueueSkeleton />}>
        <ReviewPageContent />
      </Suspense>
    </div>
  )
}
