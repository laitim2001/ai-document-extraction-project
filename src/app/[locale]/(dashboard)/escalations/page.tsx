/**
 * @fileoverview 升級案例列表頁面
 * @description
 *   Super User 升級案例管理頁面，提供：
 *   - 升級案例的列表顯示
 *   - 狀態、原因篩選
 *   - 分頁功能
 *   - 點擊進入詳情處理
 *
 *   URL 參數（支援書籤和分享）：
 *   - status: 升級狀態
 *   - reason: 升級原因
 *   - page: 頁碼
 *
 * @module src/app/(dashboard)/escalations/page
 * @since Epic 3 - Story 3.8 (Super User 處理升級案例)
 * @lastModified 2025-12-18
 *
 * @dependencies
 *   - next/navigation - URL 路由
 *   - @/components/features/escalation - 升級案例組件
 *   - @/hooks/useEscalationList - 資料獲取
 */

'use client'

import { useState, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { AlertCircle } from 'lucide-react'
import {
  EscalationListTable,
  EscalationListSkeleton,
  EscalationFilters,
} from '@/components/features/escalation'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { useEscalationList } from '@/hooks/useEscalationList'
import type { EscalationListParams } from '@/types/escalation'
import type { EscalationStatus, EscalationReason } from '@prisma/client'

// ============================================================
// Helper Functions
// ============================================================

/**
 * 從 URL 解析篩選參數
 */
function parseFiltersFromUrl(searchParams: URLSearchParams): EscalationListParams {
  return {
    status: (searchParams.get('status') as EscalationStatus) || undefined,
    reason: (searchParams.get('reason') as EscalationReason) || undefined,
    page: parseInt(searchParams.get('page') || '1', 10),
    pageSize: 20,
    sortBy: 'createdAt',
    sortOrder: 'desc',
  }
}

/**
 * 將篩選參數轉換為 URL 查詢字串
 */
function filtersToUrlParams(filters: EscalationListParams): string {
  const params = new URLSearchParams()

  if (filters.status) {
    params.set('status', filters.status)
  }
  if (filters.reason) {
    params.set('reason', filters.reason)
  }
  if (filters.page && filters.page > 1) {
    params.set('page', filters.page.toString())
  }

  return params.toString()
}

// ============================================================
// Main Content Component
// ============================================================

function EscalationsPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  // 從 URL 讀取篩選狀態
  const [filters, setFilters] = useState<EscalationListParams>(() =>
    parseFiltersFromUrl(searchParams)
  )

  // 獲取升級案例列表
  const { data, isLoading, error, refetch } = useEscalationList(filters)

  // 更新狀態篩選
  const handleStatusChange = useCallback(
    (status: EscalationStatus | undefined) => {
      const newFilters = { ...filters, status, page: 1 }
      setFilters(newFilters)
      const urlParams = filtersToUrlParams(newFilters)
      router.push(`/escalations${urlParams ? `?${urlParams}` : ''}`)
    },
    [filters, router]
  )

  // 更新原因篩選
  const handleReasonChange = useCallback(
    (reason: EscalationReason | undefined) => {
      const newFilters = { ...filters, reason, page: 1 }
      setFilters(newFilters)
      const urlParams = filtersToUrlParams(newFilters)
      router.push(`/escalations${urlParams ? `?${urlParams}` : ''}`)
    },
    [filters, router]
  )

  // 清除所有篩選
  const handleClearFilters = useCallback(() => {
    const newFilters: EscalationListParams = {
      page: 1,
      pageSize: 20,
      sortBy: 'createdAt',
      sortOrder: 'desc',
    }
    setFilters(newFilters)
    router.push('/escalations')
  }, [router])

  // 更新頁碼
  const handlePageChange = useCallback(
    (newPage: number) => {
      const newFilters = { ...filters, page: newPage }
      setFilters(newFilters)
      const urlParams = filtersToUrlParams(newFilters)
      router.push(`/escalations${urlParams ? `?${urlParams}` : ''}`)
    },
    [filters, router]
  )

  // 點擊進入詳情
  const handleSelectItem = useCallback(
    (escalationId: string) => {
      router.push(`/escalations/${escalationId}`)
    },
    [router]
  )

  // 錯誤處理
  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription className="flex items-center justify-between">
          <span>載入升級案例失敗：{error.message}</span>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            重試
          </Button>
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <>
      {/* 篩選區域 */}
      <EscalationFilters
        status={filters.status}
        reason={filters.reason}
        onStatusChange={handleStatusChange}
        onReasonChange={handleReasonChange}
        onClearFilters={handleClearFilters}
      />

      {/* 列表區域 */}
      {isLoading ? (
        <EscalationListSkeleton />
      ) : (
        <>
          <EscalationListTable
            items={data?.escalations || []}
            onSelectItem={handleSelectItem}
          />

          {/* 分頁 */}
          {data && data.pagination.totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                共 {data.pagination.total} 筆，
                第 {data.pagination.page} / {data.pagination.totalPages} 頁
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(data.pagination.page - 1)}
                  disabled={data.pagination.page <= 1}
                >
                  上一頁
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(data.pagination.page + 1)}
                  disabled={data.pagination.page >= data.pagination.totalPages}
                >
                  下一頁
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </>
  )
}

// ============================================================
// Page Component
// ============================================================

/**
 * 升級案例列表頁面
 * 顯示所有升級案例，支援篩選和分頁
 */
export default function EscalationsPage() {
  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* 頁面標題 */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">升級案例管理</h1>
          <p className="text-muted-foreground mt-1">
            處理需要 Super User 審核的複雜案例
          </p>
        </div>
      </div>

      {/* 使用 Suspense 包裝使用 useSearchParams 的組件 */}
      <Suspense fallback={<EscalationListSkeleton />}>
        <EscalationsPageContent />
      </Suspense>
    </div>
  )
}
