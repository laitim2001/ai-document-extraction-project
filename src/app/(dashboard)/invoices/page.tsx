'use client'

/**
 * @fileoverview 發票列表頁面
 * @description
 *   發票文件管理的主要列表頁面，提供：
 *   - 文件列表顯示
 *   - 處理統計卡片
 *   - 搜尋和篩選功能
 *   - 分頁導航
 *   - 實時狀態更新
 *
 * @module src/app/(dashboard)/invoices/page
 * @author Development Team
 * @since Epic 2 - Story 2.7 (Processing Status Tracking & Display)
 * @lastModified 2025-12-18
 *
 * @features
 *   - 動態輪詢（處理中 5s，閒置 30s）
 *   - 狀態統計卡片
 *   - 狀態篩選
 *   - 文件名搜尋
 *   - 分頁
 *
 * @dependencies
 *   - @/hooks/use-documents - Documents Hook
 *   - @/components/features/invoice - 發票組件
 *   - @/components/ui - shadcn/ui 組件
 *
 * @related
 *   - src/app/api/documents/route.ts - Documents API
 *   - src/components/features/invoice/InvoiceListTable.tsx - 表格組件
 */

import { useState } from 'react'
import { useDocuments } from '@/hooks/use-documents'
import { InvoiceListTable } from '@/components/features/invoice/InvoiceListTable'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Search, Filter, RefreshCw } from 'lucide-react'

// ============================================================
// Page Component
// ============================================================

/**
 * 發票列表頁面
 */
export default function InvoicesPage() {
  // --- State ---
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('')

  // --- Data Fetching ---
  const { data, isLoading, isRefetching, refetch } = useDocuments({
    page,
    pageSize: 20,
    search: search || undefined,
    status: statusFilter || undefined,
  })

  const stats = data?.stats

  // --- Render ---
  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">發票文件</h1>
          <p className="text-gray-500">管理和追蹤上傳的發票處理狀態</p>
        </div>
        <Button onClick={() => refetch()} disabled={isRefetching}>
          <RefreshCw
            className={`h-4 w-4 mr-2 ${isRefetching ? 'animate-spin' : ''}`}
          />
          刷新
        </Button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">
                總計
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-blue-500">
                處理中
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                {stats.processing}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-green-500">
                已完成
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {stats.completed}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-red-500">
                失敗
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {stats.failed}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="搜尋文件名稱..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            className="pl-10"
          />
        </div>

        <Select
          value={statusFilter || 'all'}
          onValueChange={(value) => {
            setStatusFilter(value === 'all' ? '' : value)
            setPage(1)
          }}
        >
          <SelectTrigger className="w-[180px]">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="所有狀態" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">所有狀態</SelectItem>
            <SelectItem value="UPLOADING">上傳中</SelectItem>
            <SelectItem value="OCR_PROCESSING">OCR 處理中</SelectItem>
            <SelectItem value="MAPPING_PROCESSING">映射中</SelectItem>
            <SelectItem value="PENDING_REVIEW">待審核</SelectItem>
            <SelectItem value="COMPLETED">已完成</SelectItem>
            <SelectItem value="OCR_FAILED">OCR 失敗</SelectItem>
            <SelectItem value="FAILED">處理失敗</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <InvoiceListTable
            documents={data?.data || []}
            isLoading={isLoading}
          />
        </CardContent>
      </Card>

      {/* Pagination */}
      {data?.meta && data.meta.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">
            顯示 {(page - 1) * data.meta.pageSize + 1} -{' '}
            {Math.min(page * data.meta.pageSize, data.meta.total)} of{' '}
            {data.meta.total}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              上一頁
            </Button>
            <span className="text-sm">
              {page} / {data.meta.totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setPage((p) => Math.min(data.meta.totalPages, p + 1))
              }
              disabled={page === data.meta.totalPages}
            >
              下一頁
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
