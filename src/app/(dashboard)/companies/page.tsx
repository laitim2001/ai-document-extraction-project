'use client'

/**
 * @fileoverview 公司管理頁面
 * @description
 *   顯示公司列表的管理介面，採用與發票列表一致的樣式。
 *   提供公司查看、搜尋、篩選和排序功能。
 *
 *   功能特點：
 *   - 統計卡片（總計/啟用/停用）
 *   - 分頁公司列表（每頁 10 筆）
 *   - 名稱/代碼搜尋（300ms debounce）
 *   - 狀態篩選（全部/啟用/停用）
 *   - 多欄位排序（預設：更新時間降序）
 *   - 手動刷新按鈕
 *
 *   權限要求：
 *   - FORWARDER_VIEW 權限（查看列表）
 *   - FORWARDER_MANAGE 權限（新增功能）
 *
 * @module src/app/(dashboard)/companies/page
 * @author Development Team
 * @since Epic 5 - Story 5.1 (Company Profile List)
 * @lastModified 2026-01-15
 *
 * @features
 *   - 統計卡片顯示
 *   - 動態刷新
 *   - 與發票列表統一樣式
 *
 * @dependencies
 *   - @/hooks/use-companies - Company 查詢 Hook
 *   - @/components/features/forwarders - Company 組件
 */

import { useState, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Plus, Search, Filter, RefreshCw, Building2, CheckCircle, XCircle } from 'lucide-react'
import { useCompanies } from '@/hooks/use-companies'
import { ForwarderTable } from '@/components/features/forwarders/ForwarderTable'
import { ForwarderTableSkeleton } from '@/components/features/forwarders/ForwarderTableSkeleton'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { CompanySortField } from '@/types/company'

// ============================================================
// Page Component
// ============================================================

/**
 * 公司管理頁面
 */
export default function CompaniesPage() {
  const router = useRouter()

  // --- State ---
  const [searchInput, setSearchInput] = useState('')

  // --- Data Fetching ---
  const {
    companies,
    pagination,
    params,
    isLoading,
    isRefetching,
    error,
    setSearch,
    setStatusFilter,
    setPage,
    setSort,
    refetch,
  } = useCompanies()

  // --- 計算統計數據 ---
  const stats = {
    total: pagination?.total ?? 0,
    active: companies.filter((c) => c.isActive).length,
    inactive: companies.filter((c) => !c.isActive).length,
  }

  // --- Handlers ---
  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value
      setSearchInput(value)
      setSearch(value)
    },
    [setSearch]
  )

  const handleStatusChange = useCallback(
    (value: string) => {
      setStatusFilter(value as 'all' | 'active' | 'inactive')
    },
    [setStatusFilter]
  )

  const handleSort = useCallback(
    (field: CompanySortField) => {
      setSort(field)
    },
    [setSort]
  )

  const handleView = useCallback(
    (id: string) => {
      router.push(`/companies/${id}`)
    },
    [router]
  )

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

  // --- Render ---
  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">公司管理</h1>
          <p className="text-gray-500">管理公司檔案、映射規則和優先級設定</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => refetch()}
            disabled={isRefetching}
          >
            <RefreshCw
              className={`h-4 w-4 mr-2 ${isRefetching ? 'animate-spin' : ''}`}
            />
            刷新
          </Button>
          <Button asChild>
            <Link href="/companies/new">
              <Plus className="mr-2 h-4 w-4" />
              新增公司
            </Link>
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              總計
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-green-500 flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              啟用
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {stats.active}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-red-500 flex items-center gap-2">
              <XCircle className="h-4 w-4" />
              停用
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {stats.inactive}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="搜尋公司名稱或代碼..."
            value={searchInput}
            onChange={handleSearchChange}
            className="pl-10"
          />
        </div>

        <Select value={currentStatus} onValueChange={handleStatusChange}>
          <SelectTrigger className="w-[180px]">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="所有狀態" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">所有狀態</SelectItem>
            <SelectItem value="active">啟用</SelectItem>
            <SelectItem value="inactive">停用</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <ForwarderTableSkeleton rows={10} />
          ) : error ? (
            <div className="py-10 text-center">
              <p className="text-destructive">載入公司列表失敗，請重試。</p>
              <p className="mt-2 text-sm text-muted-foreground">
                {error instanceof Error ? error.message : '未知錯誤'}
              </p>
            </div>
          ) : (
            <ForwarderTable
              forwarders={companies}
              sortBy={params.sortBy}
              sortOrder={params.sortOrder}
              onSort={handleSort}
              onView={handleView}
              onEdit={handleEdit}
            />
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">
            顯示 {(pagination.page - 1) * pagination.limit + 1} -{' '}
            {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
            {pagination.total}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(Math.max(1, pagination.page - 1))}
              disabled={pagination.page === 1}
            >
              上一頁
            </Button>
            <span className="text-sm">
              {pagination.page} / {pagination.totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setPage(Math.min(pagination.totalPages, pagination.page + 1))
              }
              disabled={pagination.page === pagination.totalPages}
            >
              下一頁
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
