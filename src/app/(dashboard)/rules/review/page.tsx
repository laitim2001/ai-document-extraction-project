'use client'

/**
 * @fileoverview 規則審核列表頁面
 * @description
 *   顯示待審核的規則建議列表，提供：
 *   - 待審核建議過濾
 *   - 點擊進入詳情審核
 *   - 統計摘要
 *
 * @module src/app/(dashboard)/rules/review/page
 * @since Epic 4 - Story 4.6 (審核學習規則)
 * @lastModified 2025-12-19
 *
 * @dependencies
 *   - @/hooks/useSuggestions - 建議列表 Hook
 *   - @/components/ui/* - shadcn UI 組件
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  ClipboardCheck,
  Clock,
  FileSearch,
  Bot,
  User,
  ArrowRight,
  RefreshCw,
  AlertCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { SuggestionListItem } from '@/types/suggestion'
import type { SuggestionStatus } from '@prisma/client'

// ============================================================
// Types
// ============================================================

interface SuggestionsResponse {
  success: true
  data: {
    suggestions: SuggestionListItem[]
    pagination: {
      total: number
      page: number
      pageSize: number
      totalPages: number
    }
    summary: {
      totalSuggestions: number
      pendingSuggestions: number
      autoLearningSuggestions: number
      manualSuggestions: number
    }
  }
}

// ============================================================
// API Functions
// ============================================================

async function fetchSuggestions(params: {
  status?: string
  page?: number
  pageSize?: number
}): Promise<SuggestionsResponse['data']> {
  const searchParams = new URLSearchParams()
  if (params.status) searchParams.set('status', params.status)
  if (params.page) searchParams.set('page', params.page.toString())
  if (params.pageSize) searchParams.set('pageSize', params.pageSize.toString())

  const response = await fetch(`/api/rules/suggestions?${searchParams}`)
  const result = await response.json()

  if (!response.ok || !result.success) {
    throw new Error(result.error?.detail || 'Failed to fetch suggestions')
  }

  return result.data
}

// ============================================================
// Sub Components
// ============================================================

/**
 * 統計卡片
 */
function StatCard({
  icon: Icon,
  label,
  value,
  className,
}: {
  icon: React.ElementType
  label: string
  value: number
  className?: string
}) {
  return (
    <Card className={className}>
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
            <Icon className="h-5 w-5 text-muted-foreground" />
          </div>
          <div>
            <p className="text-2xl font-bold">{value}</p>
            <p className="text-sm text-muted-foreground">{label}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

/**
 * 載入骨架
 */
function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-20" />
        ))}
      </div>
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

/**
 * 空狀態
 */
function EmptyState({ status }: { status: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <ClipboardCheck className="h-12 w-12 text-muted-foreground/50 mb-4" />
      <h3 className="text-lg font-medium">
        {status === 'PENDING' ? '無待審核建議' : '無建議記錄'}
      </h3>
      <p className="text-muted-foreground mt-1">
        {status === 'PENDING'
          ? '目前沒有待審核的規則建議'
          : '目前沒有符合條件的建議'}
      </p>
    </div>
  )
}

/**
 * 狀態徽章
 */
function StatusBadge({ status }: { status: SuggestionStatus }) {
  const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
    PENDING: 'secondary',
    APPROVED: 'default',
    REJECTED: 'destructive',
    IMPLEMENTED: 'outline',
  }

  const labels: Record<string, string> = {
    PENDING: '待審核',
    APPROVED: '已批准',
    REJECTED: '已拒絕',
    IMPLEMENTED: '已實施',
  }

  return (
    <Badge variant={variants[status] ?? 'default'}>
      {labels[status] ?? status}
    </Badge>
  )
}

/**
 * 來源圖標
 */
function SourceIcon({ source }: { source: string }) {
  if (source === 'AUTO_LEARNING') {
    return (
      <span title="自動學習">
        <Bot className="h-4 w-4 text-muted-foreground" />
      </span>
    )
  }
  return (
    <span title="手動建議">
      <User className="h-4 w-4 text-muted-foreground" />
    </span>
  )
}

/**
 * 信心度指示器
 */
function ConfidenceBadge({ confidence }: { confidence: number }) {
  const percentage = Math.round(confidence * 100)
  const color =
    percentage >= 90
      ? 'bg-green-100 text-green-700'
      : percentage >= 70
        ? 'bg-yellow-100 text-yellow-700'
        : 'bg-red-100 text-red-700'

  return (
    <Badge variant="outline" className={cn('font-mono', color)}>
      {percentage}%
    </Badge>
  )
}

// ============================================================
// Page Component
// ============================================================

/**
 * 規則審核列表頁面
 */
export default function RuleReviewPage() {
  const router = useRouter()
  const [statusFilter, setStatusFilter] = useState<string>('PENDING')

  // 獲取建議列表
  const {
    data,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['suggestions', { status: statusFilter }],
    queryFn: () => fetchSuggestions({ status: statusFilter, pageSize: 50 }),
  })

  if (isLoading) {
    return (
      <div className="container mx-auto py-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">規則審核</h1>
          <p className="text-muted-foreground mt-1">
            審核規則升級建議，批准或拒絕學習到的規則
          </p>
        </div>
        <LoadingSkeleton />
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto py-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">規則審核</h1>
        </div>
        <Card>
          <CardContent className="py-12">
            <div className="flex flex-col items-center justify-center text-center">
              <AlertCircle className="h-12 w-12 text-destructive mb-4" />
              <h3 className="text-lg font-medium mb-2">載入失敗</h3>
              <p className="text-muted-foreground mb-4">{(error as Error).message}</p>
              <Button variant="outline" onClick={() => refetch()}>
                <RefreshCw className="h-4 w-4 mr-2" />
                重試
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const { suggestions, summary } = data!

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* 頁面標題 */}
      <div>
        <h1 className="text-2xl font-bold">規則審核</h1>
        <p className="text-muted-foreground mt-1">
          審核規則升級建議，批准或拒絕學習到的規則
        </p>
      </div>

      {/* 統計卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard
          icon={FileSearch}
          label="總建議數"
          value={summary.totalSuggestions}
        />
        <StatCard
          icon={Clock}
          label="待審核"
          value={summary.pendingSuggestions}
        />
        <StatCard
          icon={Bot}
          label="自動學習"
          value={summary.autoLearningSuggestions}
        />
        <StatCard
          icon={User}
          label="手動建議"
          value={summary.manualSuggestions}
        />
      </div>

      {/* 建議列表 */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>建議列表</CardTitle>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="篩選狀態" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="PENDING">待審核</SelectItem>
              <SelectItem value="APPROVED">已批准</SelectItem>
              <SelectItem value="REJECTED">已拒絕</SelectItem>
              <SelectItem value="IMPLEMENTED">已實施</SelectItem>
              <SelectItem value="">全部</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          {suggestions.length === 0 ? (
            <EmptyState status={statusFilter} />
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Forwarder</TableHead>
                    <TableHead>欄位</TableHead>
                    <TableHead>類型</TableHead>
                    <TableHead className="text-center">來源</TableHead>
                    <TableHead className="text-center">信心度</TableHead>
                    <TableHead className="text-center">修正次數</TableHead>
                    <TableHead className="text-center">狀態</TableHead>
                    <TableHead className="w-[80px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {suggestions.map((suggestion) => (
                    <TableRow
                      key={suggestion.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => router.push(`/rules/review/${suggestion.id}`)}
                    >
                      <TableCell className="font-medium">
                        {suggestion.forwarder.name}
                      </TableCell>
                      <TableCell>{suggestion.fieldName}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {suggestion.extractionType}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <SourceIcon source={suggestion.source} />
                      </TableCell>
                      <TableCell className="text-center">
                        <ConfidenceBadge confidence={suggestion.confidence} />
                      </TableCell>
                      <TableCell className="text-center">
                        {suggestion.correctionCount}
                      </TableCell>
                      <TableCell className="text-center">
                        <StatusBadge status={suggestion.status} />
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={`/rules/review/${suggestion.id}`}>
                            <ArrowRight className="h-4 w-4" />
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
