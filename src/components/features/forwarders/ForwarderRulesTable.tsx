'use client'

/**
 * @fileoverview Forwarder 規則列表組件
 * @description
 *   顯示 Forwarder 相關的映射規則列表，支援：
 *   - 狀態篩選
 *   - 搜尋
 *   - 分頁
 *   - 排序
 *
 * @module src/components/features/forwarders/ForwarderRulesTable
 * @author Development Team
 * @since Epic 5 - Story 5.2 (Forwarder Detail Config View)
 * @lastModified 2025-12-19
 *
 * @dependencies
 *   - @/types/forwarder - 類型定義
 *   - @/components/ui - UI 組件
 */

import { useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Pagination } from '@/components/ui/pagination'
import { Skeleton } from '@/components/ui/skeleton'
import { useForwarderRules } from '@/hooks/use-forwarder-detail'
import type { RuleStatus, RuleListItem } from '@/types/forwarder'
import { RULE_STATUS_CONFIG } from '@/types/forwarder'
import { Search, FileText, ExternalLink } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { zhTW } from 'date-fns/locale'
import Link from 'next/link'

// ============================================================
// Types
// ============================================================

interface ForwarderRulesTableProps {
  /** Forwarder ID */
  forwarderId: string
}

// ============================================================
// Component
// ============================================================

/**
 * Forwarder 規則列表組件
 *
 * @description
 *   顯示 Forwarder 的映射規則列表，支援篩選、搜尋和分頁
 */
export function ForwarderRulesTable({ forwarderId }: ForwarderRulesTableProps) {
  // 本地篩選狀態
  const [statusFilter, setStatusFilter] = useState<RuleStatus | 'all'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(1)

  // 使用 hook 獲取規則資料
  const { rules, pagination, isLoading, error } = useForwarderRules(
    forwarderId,
    {
      status: statusFilter === 'all' ? undefined : statusFilter,
      search: searchQuery || undefined,
      page: currentPage,
      limit: 10,
    }
  )

  // 處理狀態篩選
  const handleStatusChange = useCallback((value: string) => {
    setStatusFilter(value as RuleStatus | 'all')
    setCurrentPage(1) // 重置頁碼
  }, [])

  // 處理搜尋
  const handleSearch = useCallback((value: string) => {
    setSearchQuery(value)
    setCurrentPage(1) // 重置頁碼
  }, [])

  // 處理分頁
  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page)
  }, [])

  // 格式化時間
  const formatTime = (date: Date | string | null) => {
    if (!date) return '-'
    return formatDistanceToNow(new Date(date), { addSuffix: true, locale: zhTW })
  }

  // 載入中狀態
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            映射規則
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  // 錯誤狀態
  if (error) {
    return (
      <Card>
        <CardContent className="py-10 text-center">
          <p className="text-destructive">載入規則列表失敗</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            映射規則
            {pagination && (
              <span className="text-sm font-normal text-muted-foreground">
                ({pagination.total} 筆)
              </span>
            )}
          </CardTitle>

          {/* 篩選控制項 */}
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="搜尋欄位名稱..."
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                className="pl-8 w-full sm:w-[200px]"
              />
            </div>
            <Select value={statusFilter} onValueChange={handleStatusChange}>
              <SelectTrigger className="w-full sm:w-[140px]">
                <SelectValue placeholder="篩選狀態" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部狀態</SelectItem>
                <SelectItem value="ACTIVE">啟用</SelectItem>
                <SelectItem value="DRAFT">草稿</SelectItem>
                <SelectItem value="PENDING_REVIEW">待審核</SelectItem>
                <SelectItem value="DEPRECATED">已棄用</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {rules.length === 0 ? (
          <div className="py-10 text-center text-muted-foreground">
            {searchQuery || statusFilter !== 'all'
              ? '沒有符合條件的規則'
              : '尚無規則'}
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>欄位名稱</TableHead>
                  <TableHead>狀態</TableHead>
                  <TableHead className="text-right">版本</TableHead>
                  <TableHead className="text-right">信心度</TableHead>
                  <TableHead className="text-right">匹配次數</TableHead>
                  <TableHead>最後匹配</TableHead>
                  <TableHead className="w-[80px]">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rules.map((rule: RuleListItem) => (
                  <TableRow key={rule.id}>
                    <TableCell className="font-medium">
                      {rule.fieldName}
                    </TableCell>
                    <TableCell>
                      <Badge className={RULE_STATUS_CONFIG[rule.status].className}>
                        {RULE_STATUS_CONFIG[rule.status].label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">v{rule.version}</TableCell>
                    <TableCell className="text-right">
                      {rule.confidence}%
                    </TableCell>
                    <TableCell className="text-right">
                      {rule.matchCount.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatTime(rule.lastMatchedAt)}
                    </TableCell>
                    <TableCell>
                      <Link href={`/rules/${rule.id}`}>
                        <Button variant="ghost" size="sm">
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {/* 分頁 */}
            {pagination && pagination.totalPages > 1 && (
              <div className="mt-4 flex justify-center">
                <Pagination
                  currentPage={pagination.page}
                  totalPages={pagination.totalPages}
                  onPageChange={handlePageChange}
                />
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
