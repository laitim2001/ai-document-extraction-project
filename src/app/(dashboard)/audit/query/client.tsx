'use client'

/**
 * @fileoverview 審計查詢客戶端組件
 * @description
 *   整合審計查詢的表單和結果表格：
 *   - 管理查詢狀態
 *   - 處理分頁邏輯
 *   - 顯示查詢結果
 *
 * @module src/app/(dashboard)/audit/query/client
 * @since Epic 8 - Story 8.3 (處理記錄查詢)
 * @lastModified 2025-12-20
 *
 * @dependencies
 *   - @/components/audit - 審計組件
 *   - @/hooks/useAuditQuery - 審計查詢 Hook
 */

import { useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { AlertCircle, FileSearch } from 'lucide-react'
import { AuditQueryForm, AuditResultTable } from '@/components/audit'
import { useAuditQuery, useAuditQueryCount } from '@/hooks/useAuditQuery'
import type { AuditQueryParams, CountPreview } from '@/types/audit-query'

// ============================================================
// Component
// ============================================================

/**
 * @component AuditQueryClient
 * @description
 *   審計查詢客戶端組件，整合查詢表單和結果顯示。
 */
export function AuditQueryClient() {
  // --- Hooks ---
  const {
    data,
    isLoading,
    error,
    executeQuery,
    changePage
  } = useAuditQuery()

  const { getCount, isLoading: isCountLoading } = useAuditQueryCount()

  // --- Handlers ---
  const handleQuery = useCallback(
    async (params: AuditQueryParams) => {
      await executeQuery(params)
    },
    [executeQuery]
  )

  const handlePreviewCount = useCallback(
    async (params: AuditQueryParams): Promise<CountPreview> => {
      return getCount(params)
    },
    [getCount]
  )

  const handlePageChange = useCallback(
    async (page: number) => {
      await changePage(page)
    },
    [changePage]
  )

  // --- Render ---
  return (
    <div className="space-y-6">
      {/* 查詢表單 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSearch className="h-5 w-5" />
            查詢條件
          </CardTitle>
        </CardHeader>
        <CardContent>
          <AuditQueryForm
            onQuery={handleQuery}
            onPreviewCount={handlePreviewCount}
            loading={isLoading || isCountLoading}
          />
        </CardContent>
      </Card>

      {/* 錯誤提示 */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>查詢失敗</AlertTitle>
          <AlertDescription>
            {error.message || '發生未知錯誤，請稍後再試'}
          </AlertDescription>
        </Alert>
      )}

      {/* 查詢結果 */}
      {data && !data.isTruncated && (
        <Card>
          <CardHeader>
            <CardTitle>查詢結果</CardTitle>
          </CardHeader>
          <CardContent>
            <AuditResultTable
              data={data.records}
              total={data.total}
              page={data.page}
              pageSize={data.pageSize}
              onPageChange={handlePageChange}
              loading={isLoading}
              queryTime={data.queryTime}
            />
          </CardContent>
        </Card>
      )}

      {/* 結果被截斷提示 */}
      {data?.isTruncated && (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center text-muted-foreground py-8">
              <FileSearch className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">結果過多，請縮小查詢範圍</p>
              <p className="text-sm mt-2">
                共 {data.total.toLocaleString()} 筆記錄，超過顯示限制
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 空狀態提示 */}
      {!data && !error && !isLoading && (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center text-muted-foreground py-12">
              <FileSearch className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">請選擇查詢條件</p>
              <p className="text-sm mt-2">
                選擇日期範圍和其他篩選條件後，點擊「查詢」按鈕開始搜尋
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
