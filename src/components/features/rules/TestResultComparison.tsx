'use client'

/**
 * @fileoverview 測試結果比較組件
 * @description
 *   Story 5-4: 測試規則變更效果 - 結果比較表格
 *   顯示個別測試案例的詳細比較：
 *   - 原規則與新規則的提取結果對比
 *   - 變更類型顏色編碼
 *   - 分頁和篩選功能
 *
 * @module src/components/features/rules/TestResultComparison
 * @since Epic 5 - Story 5.4 (測試規則變更效果)
 * @lastModified 2025-12-19
 *
 * @dependencies
 *   - @/components/ui/* - shadcn UI 組件
 *   - @/types/rule-test - 類型定義
 */

import * as React from 'react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  XCircle,
  Minus,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { TestDetailItem, TestChangeType } from '@/types/rule-test'
import { TEST_CHANGE_TYPES, getChangeTypeConfig } from '@/types/rule-test'

// ============================================================
// Types
// ============================================================

interface TestResultComparisonProps {
  /** 測試詳情列表 */
  details: TestDetailItem[]
  /** 分頁資訊 */
  pagination: {
    total: number
    page: number
    pageSize: number
    totalPages: number
  }
  /** 變更類型篩選 */
  changeTypeFilter?: TestChangeType
  /** 篩選變更回調 */
  onFilterChange?: (changeType: TestChangeType | undefined) => void
  /** 頁碼變更回調 */
  onPageChange?: (page: number) => void
  /** 是否載入中 */
  isLoading?: boolean
  /** 額外的 className */
  className?: string
}

// ============================================================
// Helper Functions
// ============================================================

const CHANGE_TYPE_ICONS: Record<TestChangeType, React.ReactNode> = {
  IMPROVED: <TrendingUp className="h-4 w-4" />,
  REGRESSED: <TrendingDown className="h-4 w-4" />,
  BOTH_RIGHT: <CheckCircle2 className="h-4 w-4" />,
  BOTH_WRONG: <XCircle className="h-4 w-4" />,
  UNCHANGED: <Minus className="h-4 w-4" />,
}

const CHANGE_TYPE_COLORS: Record<TestChangeType, string> = {
  IMPROVED: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  REGRESSED: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  BOTH_RIGHT: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  BOTH_WRONG: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  UNCHANGED: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400',
}

// ============================================================
// Component
// ============================================================

/**
 * 測試結果比較組件
 *
 * @example
 * ```tsx
 * <TestResultComparison
 *   details={testDetails}
 *   pagination={{ total: 100, page: 1, pageSize: 20, totalPages: 5 }}
 *   onPageChange={setPage}
 *   onFilterChange={setFilter}
 * />
 * ```
 */
export function TestResultComparison({
  details,
  pagination,
  changeTypeFilter,
  onFilterChange,
  onPageChange,
  isLoading = false,
  className,
}: TestResultComparisonProps) {
  // --- Render Loading ---

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="text-base">測試詳情</CardTitle>
          <CardDescription>載入中...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  // --- Render Empty ---

  if (details.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="text-base">測試詳情</CardTitle>
          <CardDescription>
            共 {pagination.total} 筆測試結果
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <p className="text-muted-foreground">沒有找到符合條件的測試結果</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  // --- Render ---

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-base">測試詳情</CardTitle>
            <CardDescription>
              共 {pagination.total} 筆測試結果
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">篩選：</span>
            <Select
              value={changeTypeFilter ?? 'all'}
              onValueChange={(v) =>
                onFilterChange?.(v === 'all' ? undefined : (v as TestChangeType))
              }
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="全部" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部</SelectItem>
                {TEST_CHANGE_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* 表格 */}
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[200px]">文件名稱</TableHead>
                <TableHead>原規則結果</TableHead>
                <TableHead>新規則結果</TableHead>
                <TableHead>實際值</TableHead>
                <TableHead className="w-[100px]">變化</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {details.map((detail) => {
                const config = getChangeTypeConfig(detail.changeType)
                return (
                  <TableRow key={detail.id}>
                    <TableCell className="font-medium">
                      <span className="line-clamp-1" title={detail.document.fileName}>
                        {detail.document.fileName}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <span className={cn(
                          detail.originalAccurate
                            ? 'text-green-600'
                            : 'text-red-600'
                        )}>
                          {detail.originalResult ?? '(無)'}
                        </span>
                        {detail.originalConfidence !== null && (
                          <span className="text-xs text-muted-foreground">
                            {(detail.originalConfidence * 100).toFixed(0)}%
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <span className={cn(
                          detail.testAccurate
                            ? 'text-green-600'
                            : 'text-red-600'
                        )}>
                          {detail.testResult ?? '(無)'}
                        </span>
                        {detail.testConfidence !== null && (
                          <span className="text-xs text-muted-foreground">
                            {(detail.testConfidence * 100).toFixed(0)}%
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-muted-foreground">
                        {detail.actualValue ?? '(無)'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={cn(
                          'gap-1 border-0',
                          CHANGE_TYPE_COLORS[detail.changeType]
                        )}
                      >
                        {CHANGE_TYPE_ICONS[detail.changeType]}
                        {config.label}
                      </Badge>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>

        {/* 分頁 */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between pt-4">
            <p className="text-sm text-muted-foreground">
              第 {pagination.page} / {pagination.totalPages} 頁
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onPageChange?.(pagination.page - 1)}
                disabled={pagination.page <= 1}
              >
                <ChevronLeft className="h-4 w-4" />
                上一頁
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onPageChange?.(pagination.page + 1)}
                disabled={pagination.page >= pagination.totalPages}
              >
                下一頁
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
