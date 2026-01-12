'use client'

/**
 * @fileoverview Forwarder 列表主組件
 * @description
 *   整合搜尋、篩選、表格和分頁的 Forwarder 管理列表。
 *   使用 URL 參數管理狀態，支援書籤和分享。
 *
 * @module src/components/features/companies/ForwarderList
 * @author Development Team
 * @since Epic 5 - Story 5.1 (Forwarder Profile List)
 * @lastModified 2025-12-19
 *
 * @features
 *   - 分頁 Forwarder 列表（每頁 10 筆）
 *   - 名稱/代碼搜尋（300ms debounce）
 *   - 狀態篩選（啟用/停用）
 *   - 多欄位排序（預設：更新時間降序）
 *   - URL 狀態同步
 *   - 骨架屏載入狀態
 *
 * @dependencies
 *   - @/hooks/use-forwarders - Forwarder 查詢
 *   - next/navigation - URL 路由
 *
 * @related
 *   - src/app/(dashboard)/companies/page.tsx - Forwarder 列表頁面
 */

import { useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useForwarders } from '@/hooks/use-forwarders'
import { ForwarderFilters } from './ForwarderFilters'
import { ForwarderTable } from './ForwarderTable'
import { ForwarderTableSkeleton } from './ForwarderTableSkeleton'
import { Pagination } from '@/components/ui/pagination'
import { Card, CardContent } from '@/components/ui/card'
// REFACTOR-001: CompanySortField 取代 ForwarderSortField
import type { CompanySortField } from '@/types/company'

// ============================================================
// Component
// ============================================================

/**
 * Forwarder 列表主組件
 *
 * @description
 *   整合 Forwarder 管理的所有功能：
 *   - 搜尋欄：按名稱或代碼搜尋
 *   - 篩選器：按狀態篩選
 *   - 資料表：顯示 Forwarder 列表（可排序）
 *   - 分頁：每頁 10 筆，支援頁碼導航
 *
 *   所有狀態透過 URL 參數管理，支援：
 *   - 頁面重載後保留狀態
 *   - 書籤和分享連結
 *   - 瀏覽器前進/後退
 *
 * @example
 *   // 在頁面中使用
 *   <Suspense fallback={<ForwarderListSkeleton />}>
 *     <ForwarderList />
 *   </Suspense>
 */
export function ForwarderList() {
  const router = useRouter()

  // 使用 Forwarder 查詢 Hook
  // REFACTOR-001: useForwarders 返回 { companies: ... }，不是 { forwarders: ... }
  const {
    companies: forwarders,
    pagination,
    params,
    isLoading,
    error,
    setSearch,
    setStatusFilter,
    setPage,
    setSort,
  } = useForwarders()

  /**
   * 處理搜尋變更
   * Hook 內部已處理 URL 同步和分頁重置
   */
  const handleSearchChange = useCallback(
    (search: string) => {
      setSearch(search)
    },
    [setSearch]
  )

  /**
   * 處理狀態篩選變更
   */
  const handleStatusChange = useCallback(
    (status: 'all' | 'active' | 'inactive') => {
      setStatusFilter(status)
    },
    [setStatusFilter]
  )

  /**
   * 處理排序變更
   */
  // REFACTOR-001: 排序欄位類型改為 CompanySortField
  const handleSort = useCallback(
    (field: CompanySortField) => {
      setSort(field)
    },
    [setSort]
  )

  /**
   * 處理分頁變更
   */
  const handlePageChange = useCallback(
    (page: number) => {
      setPage(page)
    },
    [setPage]
  )

  /**
   * 處理檢視詳情
   */
  const handleView = useCallback(
    (id: string) => {
      router.push(`/companies/${id}`)
    },
    [router]
  )

  /**
   * 處理編輯
   */
  const handleEdit = useCallback(
    (id: string) => {
      router.push(`/companies/${id}/edit`)
    },
    [router]
  )

  // 解析當前狀態篩選值
  const currentStatus =
    params.isActive === true
      ? 'active'
      : params.isActive === false
        ? 'inactive'
        : 'all'

  // 載入中狀態
  if (isLoading) {
    return <ForwarderTableSkeleton rows={10} />
  }

  // 錯誤狀態
  if (error) {
    return (
      <Card>
        <CardContent className="py-10 text-center">
          <p className="text-destructive">載入 Forwarder 列表失敗，請重試。</p>
          <p className="mt-2 text-sm text-muted-foreground">
            {error instanceof Error ? error.message : '未知錯誤'}
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* 搜尋和篩選 */}
      <ForwarderFilters
        search={params.search || ''}
        status={currentStatus}
        onSearchChange={handleSearchChange}
        onStatusChange={handleStatusChange}
        isLoading={isLoading}
      />

      {/* Forwarder 表格 */}
      <ForwarderTable
        forwarders={forwarders}
        sortBy={params.sortBy}
        sortOrder={params.sortOrder}
        onSort={handleSort}
        onView={handleView}
        onEdit={handleEdit}
      />

      {/* 分頁 */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex justify-center">
          <Pagination
            currentPage={pagination.page}
            totalPages={pagination.totalPages}
            onPageChange={handlePageChange}
          />
        </div>
      )}

      {/* 結果摘要 */}
      {pagination && (
        <p className="text-center text-sm text-muted-foreground">
          顯示 {forwarders.length} 筆，共 {pagination.total} 筆 Forwarder
        </p>
      )}
    </div>
  )
}
