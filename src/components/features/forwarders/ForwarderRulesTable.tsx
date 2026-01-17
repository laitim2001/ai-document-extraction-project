'use client'

/**
 * @fileoverview Forwarder 規則列表組件（國際化版本）
 * @description
 *   顯示 Forwarder 相關的映射規則列表，支援：
 *   - 狀態篩選
 *   - 搜尋
 *   - 分頁
 *   - 排序
 *   - 規則編輯（Story 5-3）
 *   - 完整國際化支援
 *
 * @module src/components/features/forwarders/ForwarderRulesTable
 * @author Development Team
 * @since Epic 5 - Story 5.2 (Forwarder Detail Config View)
 * @lastModified 2026-01-17
 *
 * @dependencies
 *   - next-intl - 國際化
 *   - @/types/forwarder - 類型定義
 *   - @/components/ui - UI 組件
 *   - @/components/features/rules - 規則編輯組件
 */

import { useState, useCallback } from 'react'
import { useTranslations, useLocale } from 'next-intl'
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Pagination } from '@/components/ui/pagination'
import { Skeleton } from '@/components/ui/skeleton'
import { useForwarderRules } from '@/hooks/use-forwarder-detail'
import { RuleEditDialog } from '@/components/features/rules/RuleEditDialog'
import type { RuleStatus, RuleListItem } from '@/types/forwarder'
import { RULE_STATUS_CONFIG } from '@/types/forwarder'
import { Search, FileText, MoreHorizontal, Edit, Eye } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { zhTW, enUS } from 'date-fns/locale'
import Link from 'next/link'
import { useQueryClient } from '@tanstack/react-query'
import { ruleKeys } from '@/hooks/useRuleEdit'

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
  const t = useTranslations('companies')
  const locale = useLocale()
  const dateLocale = locale === 'zh-TW' || locale === 'zh-CN' ? zhTW : enUS

  // 本地篩選狀態
  const [statusFilter, setStatusFilter] = useState<RuleStatus | 'all'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(1)

  // 編輯對話框狀態（Story 5-3）
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [selectedRule, setSelectedRule] = useState<RuleListItem | null>(null)

  // Query client for cache invalidation
  const queryClient = useQueryClient()

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

  // 處理編輯規則（Story 5-3）
  const handleEditRule = useCallback((rule: RuleListItem) => {
    setSelectedRule(rule)
    setEditDialogOpen(true)
  }, [])

  // 處理編輯成功
  const handleEditSuccess = useCallback(() => {
    // 刷新規則列表
    queryClient.invalidateQueries({ queryKey: ruleKeys.list(forwarderId) })
    setSelectedRule(null)
  }, [queryClient, forwarderId])

  // 格式化時間
  const formatTime = (date: Date | string | null) => {
    if (!date) return '-'
    return formatDistanceToNow(new Date(date), { addSuffix: true, locale: dateLocale })
  }

  // 載入中狀態
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {t('rulesTable.title')}
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
          <p className="text-destructive">{t('rulesTable.loadFailed')}</p>
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
            {t('rulesTable.title')}
            {pagination && (
              <span className="text-sm font-normal text-muted-foreground">
                {t('rulesTable.totalCount', { count: pagination.total })}
              </span>
            )}
          </CardTitle>

          {/* 篩選控制項 */}
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t('rulesTable.searchPlaceholder')}
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                className="pl-8 w-full sm:w-[200px]"
              />
            </div>
            <Select value={statusFilter} onValueChange={handleStatusChange}>
              <SelectTrigger className="w-full sm:w-[140px]">
                <SelectValue placeholder={t('rulesTable.filterStatus')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('rulesTable.allStatus')}</SelectItem>
                <SelectItem value="ACTIVE">{t('rulesTable.ruleStatus.active')}</SelectItem>
                <SelectItem value="DRAFT">{t('rulesTable.ruleStatus.draft')}</SelectItem>
                <SelectItem value="PENDING_REVIEW">{t('rulesTable.ruleStatus.pendingReview')}</SelectItem>
                <SelectItem value="DEPRECATED">{t('rulesTable.ruleStatus.deprecated')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {rules.length === 0 ? (
          <div className="py-10 text-center text-muted-foreground">
            {searchQuery || statusFilter !== 'all'
              ? t('rulesTable.noMatchingRules')
              : t('rulesTable.noRules')}
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('rulesTable.columns.fieldName')}</TableHead>
                  <TableHead>{t('rulesTable.columns.status')}</TableHead>
                  <TableHead className="text-right">{t('rulesTable.columns.version')}</TableHead>
                  <TableHead className="text-right">{t('rulesTable.columns.confidence')}</TableHead>
                  <TableHead className="text-right">{t('rulesTable.columns.matchCount')}</TableHead>
                  <TableHead>{t('rulesTable.columns.lastMatched')}</TableHead>
                  <TableHead className="w-[80px]">{t('rulesTable.columns.actions')}</TableHead>
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
                        {t(`rulesTable.ruleStatus.${rule.status === 'ACTIVE' ? 'active' : rule.status === 'DRAFT' ? 'draft' : rule.status === 'PENDING_REVIEW' ? 'pendingReview' : 'deprecated'}`)}
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
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEditRule(rule)}>
                            <Edit className="h-4 w-4 mr-2" />
                            {t('rulesTable.actions.editRule')}
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link href={`/rules/${rule.id}`}>
                              <Eye className="h-4 w-4 mr-2" />
                              {t('rulesTable.actions.viewDetails')}
                            </Link>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
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

        {/* 編輯對話框（Story 5-3） */}
        {selectedRule && (
          <RuleEditDialog
            open={editDialogOpen}
            onOpenChange={setEditDialogOpen}
            rule={{
              id: selectedRule.id,
              fieldName: selectedRule.fieldName,
              fieldLabel: selectedRule.fieldName, // 使用 fieldName 作為顯示標籤
              extractionType: 'REGEX', // 預設值，實際會從 API 獲取
              extractionPattern: {},
              priority: 1,
              confidence: selectedRule.confidence,
              forwarderId,
            }}
            onSuccess={handleEditSuccess}
          />
        )}
      </CardContent>
    </Card>
  )
}
