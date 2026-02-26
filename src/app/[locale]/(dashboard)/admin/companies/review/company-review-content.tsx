'use client'

/**
 * @fileoverview 待審核公司內容組件
 * @description
 *   客戶端組件，提供公司審核的互動功能：
 *   - 分頁列表
 *   - 類型分類
 *   - 批量合併
 *
 * @module src/app/(dashboard)/admin/companies/review/company-review-content
 * @since Epic 0 - Story 0.3
 * @lastModified 2025-12-23
 *
 * @features
 *   - 待審核公司列表
 *   - 公司類型選擇
 *   - 批量選擇和合併
 *   - 重複項警示
 *
 * @dependencies
 *   - @/hooks/use-pending-companies - 數據獲取
 *   - @/components/features/companies - UI 組件
 */

import * as React from 'react'
import {
  usePendingCompanies,
  useUpdateCompany,
  type PendingCompany,
} from '@/hooks/use-pending-companies'
import {
  CompanyTypeSelector,
  CompanyTypeBadge,
  CompanyMergeDialog,
} from '@/components/features/companies'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Building2,
  AlertTriangle,
  GitMerge,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Users,
  Clock,
  CheckCircle,
  Loader2,
} from 'lucide-react'
import { toast } from 'sonner'
import { CompanyType } from '@prisma/client'
import { formatDistanceToNow } from 'date-fns'
import { zhTW } from 'date-fns/locale'

// ============================================================
// Types
// ============================================================

interface CompanyReviewContentProps {
  canManage: boolean
}

// ============================================================
// Component
// ============================================================

export function CompanyReviewContent({ canManage }: CompanyReviewContentProps) {
  // --- State ---
  const [page, setPage] = React.useState(1)
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set())
  const [mergeDialogOpen, setMergeDialogOpen] = React.useState(false)

  // --- Hooks ---
  const { data, isLoading, error, refetch } = usePendingCompanies({
    page,
    limit: 20,
  })
  const updateMutation = useUpdateCompany()

  // --- Derived Data ---
  const companies = React.useMemo(
    () => data?.data?.companies ?? [],
    [data?.data?.companies]
  )
  const pagination = data?.data?.pagination
  const selectedCompanies = React.useMemo(
    () => companies.filter((c) => selectedIds.has(c.id)),
    [companies, selectedIds]
  )

  // --- Handlers ---
  const handleSelectAll = React.useCallback(
    (checked: boolean) => {
      if (checked) {
        setSelectedIds(new Set(companies.map((c) => c.id)))
      } else {
        setSelectedIds(new Set())
      }
    },
    [companies]
  )

  const handleSelectOne = React.useCallback(
    (id: string, checked: boolean) => {
      setSelectedIds((prev) => {
        const next = new Set(prev)
        if (checked) {
          next.add(id)
        } else {
          next.delete(id)
        }
        return next
      })
    },
    []
  )

  const handleTypeChange = React.useCallback(
    async (id: string, type: CompanyType) => {
      try {
        await updateMutation.mutateAsync({ id, data: { type } })
        toast.success('公司類型已更新')
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : '更新失敗'
        )
      }
    },
    [updateMutation]
  )

  const handleMergeSuccess = React.useCallback(() => {
    setSelectedIds(new Set())
    refetch()
  }, [refetch])

  // --- Stats ---
  const stats = React.useMemo(() => {
    const total = pagination?.total ?? 0
    const withDuplicates = companies.filter(
      (c) => c.possibleDuplicates.length > 0
    ).length
    const recentCount = companies.filter((c) => {
      const date = new Date(c.firstSeenAt)
      const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
      return date > dayAgo
    }).length

    return { total, withDuplicates, recentCount }
  }, [companies, pagination])

  // --- Error State ---
  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          無法載入待審核公司列表：{error.message}
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Building2 className="h-6 w-6" />
              待審核公司
            </h1>
            <p className="text-muted-foreground">
              分類和管理系統自動建立的公司
            </p>
          </div>
          <div className="flex items-center gap-2">
            {selectedIds.size >= 2 && canManage && (
              <Button
                variant="outline"
                onClick={() => setMergeDialogOpen(true)}
              >
                <GitMerge className="mr-2 h-4 w-4" />
                合併選取 ({selectedIds.size})
              </Button>
            )}
            <Button
              variant="outline"
              size="icon"
              onClick={() => refetch()}
              disabled={isLoading}
            >
              <RefreshCw
                className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`}
              />
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                待審核公司
              </CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
              <p className="text-xs text-muted-foreground">
                需要分類的公司
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                疑似重複
              </CardTitle>
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.withDuplicates}</div>
              <p className="text-xs text-muted-foreground">
                可能需要合併
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                今日新增
              </CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.recentCount}</div>
              <p className="text-xs text-muted-foreground">
                最近 24 小時
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                已選取
              </CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{selectedIds.size}</div>
              <p className="text-xs text-muted-foreground">
                等待操作
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Table */}
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                {canManage && (
                  <TableHead className="w-12">
                    <Checkbox
                      checked={
                        companies.length > 0 &&
                        selectedIds.size === companies.length
                      }
                      onCheckedChange={handleSelectAll}
                      aria-label="全選"
                    />
                  </TableHead>
                )}
                <TableHead>公司名稱</TableHead>
                <TableHead>類型</TableHead>
                <TableHead>出現次數</TableHead>
                <TableHead>首次出現</TableHead>
                <TableHead>重複提示</TableHead>
                {canManage && <TableHead>操作</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell
                    colSpan={canManage ? 7 : 5}
                    className="text-center py-8"
                  >
                    <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                    <span className="ml-2 text-muted-foreground">
                      載入中...
                    </span>
                  </TableCell>
                </TableRow>
              ) : companies.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={canManage ? 7 : 5}
                    className="text-center py-8"
                  >
                    <Building2 className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                    <p className="text-muted-foreground">
                      沒有待審核的公司
                    </p>
                  </TableCell>
                </TableRow>
              ) : (
                companies.map((company) => (
                  <CompanyRow
                    key={company.id}
                    company={company}
                    canManage={canManage}
                    isSelected={selectedIds.has(company.id)}
                    onSelect={handleSelectOne}
                    onTypeChange={handleTypeChange}
                    isUpdating={updateMutation.isPending}
                  />
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {pagination && pagination.totalPages > 1 && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              顯示第 {(page - 1) * pagination.limit + 1} -{' '}
              {Math.min(page * pagination.limit, pagination.total)} 項，
              共 {pagination.total} 項
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1 || isLoading}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm">
                第 {page} / {pagination.totalPages} 頁
              </span>
              <Button
                variant="outline"
                size="icon"
                onClick={() =>
                  setPage((p) => Math.min(pagination.totalPages, p + 1))
                }
                disabled={page === pagination.totalPages || isLoading}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Merge Dialog */}
        <CompanyMergeDialog
          open={mergeDialogOpen}
          onOpenChange={setMergeDialogOpen}
          companies={selectedCompanies}
          onSuccess={handleMergeSuccess}
        />
      </div>
    </TooltipProvider>
  )
}

// ============================================================
// Row Component
// ============================================================

interface CompanyRowProps {
  company: PendingCompany
  canManage: boolean
  isSelected: boolean
  onSelect: (id: string, checked: boolean) => void
  onTypeChange: (id: string, type: CompanyType) => void
  isUpdating: boolean
}

function CompanyRow({
  company,
  canManage,
  isSelected,
  onSelect,
  onTypeChange,
  isUpdating,
}: CompanyRowProps) {
  return (
    <TableRow>
      {canManage && (
        <TableCell>
          <Checkbox
            checked={isSelected}
            onCheckedChange={(checked) =>
              onSelect(company.id, checked as boolean)
            }
            aria-label={`選擇 ${company.name}`}
          />
        </TableCell>
      )}
      <TableCell>
        <div className="font-medium">{company.name}</div>
        {company.displayName !== company.name && (
          <div className="text-xs text-muted-foreground">
            顯示名稱: {company.displayName}
          </div>
        )}
      </TableCell>
      <TableCell>
        {canManage ? (
          <CompanyTypeSelector
            value={company.type}
            onChange={(type) => onTypeChange(company.id, type)}
            disabled={isUpdating}
            className="w-40"
          />
        ) : (
          <CompanyTypeBadge type={company.type} />
        )}
      </TableCell>
      <TableCell>
        <Badge variant="secondary">{company.documentCount}</Badge>
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {formatDistanceToNow(new Date(company.firstSeenAt), {
          addSuffix: true,
          locale: zhTW,
        })}
      </TableCell>
      <TableCell>
        {company.possibleDuplicates.length > 0 ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="outline" className="gap-1 cursor-help">
                <AlertTriangle className="h-3 w-3 text-yellow-500" />
                {company.possibleDuplicates.length} 個疑似重複
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <div className="space-y-1">
                <p className="font-medium">可能重複的公司：</p>
                <ul className="text-sm">
                  {company.possibleDuplicates.map((dup) => (
                    <li key={dup.id}>
                      {dup.name} ({Math.round(dup.matchScore * 100)}% 相似)
                    </li>
                  ))}
                </ul>
              </div>
            </TooltipContent>
          </Tooltip>
        ) : (
          <span className="text-muted-foreground text-sm">-</span>
        )}
      </TableCell>
      {canManage && (
        <TableCell>
          <Button variant="ghost" size="sm" asChild>
            <a href={`/admin/companies/${company.id}`}>詳情</a>
          </Button>
        </TableCell>
      )}
    </TableRow>
  )
}
