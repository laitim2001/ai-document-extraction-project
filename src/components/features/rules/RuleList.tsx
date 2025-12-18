'use client'

/**
 * @fileoverview 規則列表組件
 * @description
 *   映射規則列表的主要容器組件：
 *   - 整合摘要卡片、篩選器、表格、分頁
 *   - 處理篩選和排序狀態
 *   - 支援分頁預取
 *   - 提供錯誤處理和重試功能
 *
 * @module src/components/features/rules/RuleList
 * @since Epic 4 - Story 4.1 (映射規則列表與查看)
 * @lastModified 2025-12-18
 *
 * @dependencies
 *   - @/hooks/useRuleList - 規則列表 Hook
 *   - @/components/ui/pagination - 分頁組件
 */

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useRuleList, usePrefetchRules } from '@/hooks/useRuleList'
import { RuleTable } from './RuleTable'
import { RuleFilters } from './RuleFilters'
import { RuleSummaryCards } from './RuleSummaryCards'
import { RuleListSkeleton } from './RuleListSkeleton'
import { Pagination } from '@/components/ui/pagination'
import { Button } from '@/components/ui/button'
import { RefreshCw, AlertCircle } from 'lucide-react'
import type { RulesQueryParams } from '@/types/rule'

// ============================================================
// Types
// ============================================================

interface RuleListProps {
  /** 初始篩選參數 */
  initialFilters?: RulesQueryParams
}

// ============================================================
// Component
// ============================================================

/**
 * 規則列表組件
 *
 * @description
 *   提供完整的規則列表功能，包含：
 *   - 摘要統計卡片
 *   - 多維度篩選（Forwarder、欄位名稱、狀態、類別）
 *   - 可排序表格
 *   - 分頁導航和預取
 *
 * @example
 * ```tsx
 * <RuleList />
 * <RuleList initialFilters={{ status: 'ACTIVE' }} />
 * ```
 */
export function RuleList({ initialFilters }: RuleListProps) {
  // --- Hooks ---
  const router = useRouter()
  const prefetch = usePrefetchRules()

  // --- State ---
  const [filters, setFilters] = useState<RulesQueryParams>({
    page: 1,
    pageSize: 20,
    sortBy: 'updatedAt',
    sortOrder: 'desc',
    ...initialFilters,
  })

  // --- Query ---
  const { data, isLoading, error, refetch, isRefetching } = useRuleList(filters)

  // --- Handlers ---
  const handleFilterChange = useCallback(
    (key: keyof RulesQueryParams, value: unknown) => {
      setFilters((prev) => ({
        ...prev,
        [key]: value,
        // 非分頁變更時重置頁碼
        page: key !== 'page' ? 1 : (value as number),
      }))
    },
    []
  )

  const handlePageChange = useCallback(
    (page: number) => {
      handleFilterChange('page', page)
      // 預取下一頁
      if (data && page < data.pagination.totalPages) {
        prefetch({ ...filters, page: page + 1 })
      }
    },
    [filters, data, prefetch, handleFilterChange]
  )

  const handleSort = useCallback(
    (by: string, order: 'asc' | 'desc') => {
      setFilters((prev) => ({
        ...prev,
        sortBy: by as RulesQueryParams['sortBy'],
        sortOrder: order,
      }))
    },
    []
  )

  const handleRowClick = useCallback(
    (ruleId: string) => {
      router.push(`/rules/${ruleId}`)
    },
    [router]
  )

  // --- Loading State ---
  if (isLoading) {
    return <RuleListSkeleton />
  }

  // --- Error State ---
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center">
        <AlertCircle className="h-12 w-12 text-destructive mb-4" />
        <h3 className="text-lg font-medium">載入失敗</h3>
        <p className="text-sm text-muted-foreground mb-4">{error.message}</p>
        <Button onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          重試
        </Button>
      </div>
    )
  }

  // --- Data ---
  const { rules, pagination, summary } = data!

  // --- Render ---
  return (
    <div className="space-y-6">
      {/* 摘要卡片 */}
      <RuleSummaryCards summary={summary} />

      {/* 篩選和刷新 */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <RuleFilters
          forwarderId={filters.forwarderId}
          fieldName={filters.fieldName}
          status={filters.status}
          category={filters.category}
          onForwarderChange={(v) => handleFilterChange('forwarderId', v)}
          onFieldNameChange={(v) => handleFilterChange('fieldName', v)}
          onStatusChange={(v) => handleFilterChange('status', v)}
          onCategoryChange={(v) => handleFilterChange('category', v)}
        />
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isRefetching}
        >
          <RefreshCw
            className={`h-4 w-4 mr-2 ${isRefetching ? 'animate-spin' : ''}`}
          />
          刷新
        </Button>
      </div>

      {/* 規則表格 */}
      <RuleTable
        rules={rules}
        sortBy={filters.sortBy}
        sortOrder={filters.sortOrder}
        onSort={handleSort}
        onRowClick={handleRowClick}
      />

      {/* 分頁 */}
      {pagination.totalPages > 1 && (
        <div className="flex justify-center">
          <Pagination
            currentPage={pagination.page}
            totalPages={pagination.totalPages}
            onPageChange={handlePageChange}
          />
        </div>
      )}

      {/* 結果統計 */}
      <div className="text-center text-sm text-muted-foreground">
        共 {pagination.total} 條規則，第 {pagination.page} /{' '}
        {pagination.totalPages} 頁
      </div>
    </div>
  )
}
