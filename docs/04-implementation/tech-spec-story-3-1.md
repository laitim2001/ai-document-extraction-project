# Tech Spec: Story 3-1 待審核發票列表

## 1. Overview

### 1.1 Story Reference
- **Story ID**: 3.1
- **Title**: 待審核發票列表
- **Epic**: Epic 3 - 發票審核與修正工作流

### 1.2 Story Description
作為數據處理員，我希望查看分配給我的待審核發票列表，以便有效安排審核工作。

### 1.3 Dependencies
- **Epic 2**: 文件處理流程、ProcessingQueue 數據模型
- **Story 2-6**: 處理路徑自動路由（提供 ProcessingQueue 數據）
- **Story 2-7**: 處理狀態追蹤（提供狀態查詢基礎）

---

## 2. Acceptance Criteria Mapping

| AC ID | Description | Implementation Approach |
|-------|-------------|------------------------|
| AC1 | 待審核列表顯示 | ReviewQueue 組件 + GET /api/review API |
| AC2 | 篩選功能 | ReviewFilters 組件 + URL 查詢參數 |
| AC3 | 進入審核詳情 | 點擊列表項導航至 /review/[id] |

---

## 3. Architecture Overview

### 3.1 System Context

```
┌─────────────────────────────────────────────────────────────────┐
│                      審核列表頁面                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ ReviewFilters                                               │ │
│  │ ┌──────────────┐ ┌──────────────┐ ┌──────────────────────┐ │ │
│  │ │ Forwarder ▼  │ │ 信心度範圍 ▼ │ │ 處理路徑 ▼          │ │ │
│  │ └──────────────┘ └──────────────┘ └──────────────────────┘ │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ ReviewQueue Table                                           │ │
│  │ ┌──────────┬────────────┬──────────┬────────┬────────────┐ │ │
│  │ │ 文件名   │ Forwarder  │ 上傳時間 │ 信心度 │ 處理路徑   │ │ │
│  │ ├──────────┼────────────┼──────────┼────────┼────────────┤ │ │
│  │ │ inv001.. │ DHL        │ 2h ago   │ 75%    │ QUICK_REV  │ │ │
│  │ │ inv002.. │ FedEx      │ 3h ago   │ 65%    │ FULL_REV   │ │ │
│  │ └──────────┴────────────┴──────────┴────────┴────────────┘ │ │
│  │                                                             │ │
│  │ Pagination: ◄ 1 2 3 ... 10 ►                               │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 Component Architecture

```
src/
├── app/(dashboard)/review/
│   └── page.tsx                    # 審核列表頁面
├── components/features/review/
│   ├── ReviewQueue.tsx             # 審核隊列主組件
│   ├── ReviewQueueTable.tsx        # 列表表格
│   ├── ReviewFilters.tsx           # 篩選組件
│   └── ReviewQueueSkeleton.tsx     # 載入骨架
├── hooks/
│   └── useReviewQueue.ts           # 審核隊列 Hook
└── app/api/review/
    └── route.ts                    # 審核列表 API
```

---

## 4. Implementation Guide

### Phase 1: API Layer (AC1, AC2)

#### 4.1.1 審核列表 API

**File**: `src/app/api/review/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ProcessingPath, QueueStatus } from '@prisma/client'

// GET /api/review - 獲取待審核列表
export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({
      success: false,
      error: {
        type: 'unauthorized',
        title: 'Unauthorized',
        status: 401,
        detail: 'Authentication required'
      }
    }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)

  // 解析查詢參數
  const page = parseInt(searchParams.get('page') || '1')
  const pageSize = parseInt(searchParams.get('pageSize') || '20')
  const forwarderId = searchParams.get('forwarderId')
  const processingPath = searchParams.get('processingPath') as ProcessingPath | null
  const minConfidence = parseFloat(searchParams.get('minConfidence') || '0')
  const maxConfidence = parseFloat(searchParams.get('maxConfidence') || '100')

  // 構建查詢條件
  const where = {
    status: QueueStatus.PENDING,
    ...(forwarderId && {
      document: { forwarderId }
    }),
    ...(processingPath && { processingPath }),
    overallConfidence: {
      gte: minConfidence / 100,
      lte: maxConfidence / 100
    },
    // 排除自動通過的項目（除非明確請求）
    processingPath: processingPath || {
      in: [ProcessingPath.QUICK_REVIEW, ProcessingPath.FULL_REVIEW]
    }
  }

  try {
    // 並行查詢數據和總數
    const [items, total] = await prisma.$transaction([
      prisma.processingQueue.findMany({
        where,
        include: {
          document: {
            select: {
              id: true,
              fileName: true,
              originalName: true,
              createdAt: true,
              forwarder: {
                select: { id: true, name: true, code: true }
              }
            }
          }
        },
        orderBy: [
          { priority: 'desc' },           // 高優先級優先
          { document: { createdAt: 'asc' } } // 最舊優先
        ],
        skip: (page - 1) * pageSize,
        take: pageSize
      }),
      prisma.processingQueue.count({ where })
    ])

    // 轉換響應格式
    const data = items.map(item => ({
      id: item.id,
      document: {
        id: item.document.id,
        fileName: item.document.originalName || item.document.fileName,
        createdAt: item.document.createdAt.toISOString()
      },
      forwarder: item.document.forwarder,
      processingPath: item.processingPath,
      overallConfidence: Math.round(item.overallConfidence * 100),
      priority: item.priority,
      status: item.status
    }))

    return NextResponse.json({
      success: true,
      data,
      meta: {
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize)
      }
    })
  } catch (error) {
    console.error('Failed to fetch review queue:', error)
    return NextResponse.json({
      success: false,
      error: {
        type: 'internal_error',
        title: 'Internal Server Error',
        status: 500,
        detail: 'Failed to fetch review queue'
      }
    }, { status: 500 })
  }
}
```

#### 4.1.2 API 類型定義

**File**: `src/types/review.ts`

```typescript
import { ProcessingPath, QueueStatus } from '@prisma/client'

// API 響應類型
export interface ReviewQueueItem {
  id: string
  document: {
    id: string
    fileName: string
    createdAt: string
  }
  forwarder: {
    id: string
    name: string
    code: string
  } | null
  processingPath: ProcessingPath
  overallConfidence: number  // 0-100 整數
  priority: number
  status: QueueStatus
}

export interface ReviewQueueResponse {
  success: true
  data: ReviewQueueItem[]
  meta: {
    total: number
    page: number
    pageSize: number
    totalPages: number
  }
}

// 篩選參數類型
export interface ReviewQueueFilters {
  forwarderId?: string
  processingPath?: ProcessingPath
  minConfidence?: number  // 0-100
  maxConfidence?: number  // 0-100
}

export interface ReviewQueueParams extends ReviewQueueFilters {
  page?: number
  pageSize?: number
}
```

---

### Phase 2: React Query Hook (AC1, AC2)

**File**: `src/hooks/useReviewQueue.ts`

```typescript
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ReviewQueueParams, ReviewQueueResponse } from '@/types/review'

// API 客戶端函數
async function fetchReviewQueue(params: ReviewQueueParams): Promise<ReviewQueueResponse> {
  const searchParams = new URLSearchParams()

  if (params.page) searchParams.set('page', params.page.toString())
  if (params.pageSize) searchParams.set('pageSize', params.pageSize.toString())
  if (params.forwarderId) searchParams.set('forwarderId', params.forwarderId)
  if (params.processingPath) searchParams.set('processingPath', params.processingPath)
  if (params.minConfidence !== undefined) {
    searchParams.set('minConfidence', params.minConfidence.toString())
  }
  if (params.maxConfidence !== undefined) {
    searchParams.set('maxConfidence', params.maxConfidence.toString())
  }

  const response = await fetch(`/api/review?${searchParams.toString()}`)
  const result = await response.json()

  if (!result.success) {
    throw new Error(result.error?.detail || 'Failed to fetch review queue')
  }

  return result
}

// 審核隊列 Hook
export function useReviewQueue(params: ReviewQueueParams = {}) {
  return useQuery({
    queryKey: ['reviewQueue', params],
    queryFn: () => fetchReviewQueue(params),
    staleTime: 30 * 1000,        // 30 秒後標記為過時
    refetchInterval: 60 * 1000,  // 每分鐘自動刷新
    refetchOnWindowFocus: true,  // 視窗聚焦時刷新
  })
}

// 預取下一頁
export function usePrefetchNextPage(params: ReviewQueueParams, totalPages: number) {
  const queryClient = useQueryClient()
  const currentPage = params.page || 1

  if (currentPage < totalPages) {
    queryClient.prefetchQuery({
      queryKey: ['reviewQueue', { ...params, page: currentPage + 1 }],
      queryFn: () => fetchReviewQueue({ ...params, page: currentPage + 1 }),
    })
  }
}

// 手動刷新列表
export function useRefreshReviewQueue() {
  const queryClient = useQueryClient()

  return () => {
    queryClient.invalidateQueries({ queryKey: ['reviewQueue'] })
  }
}
```

---

### Phase 3: UI Components (AC1, AC2, AC3)

#### 4.3.1 審核列表頁面

**File**: `src/app/(dashboard)/review/page.tsx`

```typescript
'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ReviewQueue } from '@/components/features/review/ReviewQueue'
import { ReviewFilters } from '@/components/features/review/ReviewFilters'
import { ReviewQueueFilters } from '@/types/review'

export default function ReviewPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  // 從 URL 讀取篩選狀態
  const [filters, setFilters] = useState<ReviewQueueFilters>({
    forwarderId: searchParams.get('forwarderId') || undefined,
    processingPath: searchParams.get('processingPath') as any || undefined,
    minConfidence: searchParams.get('minConfidence')
      ? parseInt(searchParams.get('minConfidence')!)
      : undefined,
    maxConfidence: searchParams.get('maxConfidence')
      ? parseInt(searchParams.get('maxConfidence')!)
      : undefined,
  })

  const [page, setPage] = useState(
    parseInt(searchParams.get('page') || '1')
  )

  // 更新篩選條件
  const handleFiltersChange = (newFilters: ReviewQueueFilters) => {
    setFilters(newFilters)
    setPage(1) // 重置頁碼

    // 更新 URL
    const params = new URLSearchParams()
    if (newFilters.forwarderId) params.set('forwarderId', newFilters.forwarderId)
    if (newFilters.processingPath) params.set('processingPath', newFilters.processingPath)
    if (newFilters.minConfidence) params.set('minConfidence', newFilters.minConfidence.toString())
    if (newFilters.maxConfidence) params.set('maxConfidence', newFilters.maxConfidence.toString())

    router.push(`/review?${params.toString()}`)
  }

  // 點擊進入詳情 (AC3)
  const handleSelectItem = (documentId: string) => {
    router.push(`/review/${documentId}`)
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">待審核發票</h1>
      </div>

      <ReviewFilters
        filters={filters}
        onFiltersChange={handleFiltersChange}
      />

      <ReviewQueue
        filters={filters}
        page={page}
        onPageChange={setPage}
        onSelectItem={handleSelectItem}
      />
    </div>
  )
}
```

#### 4.3.2 審核隊列組件

**File**: `src/components/features/review/ReviewQueue.tsx`

```typescript
'use client'

import { useReviewQueue, usePrefetchNextPage } from '@/hooks/useReviewQueue'
import { ReviewQueueTable } from './ReviewQueueTable'
import { ReviewQueueSkeleton } from './ReviewQueueSkeleton'
import { ReviewQueueFilters as Filters } from '@/types/review'
import { Button } from '@/components/ui/button'
import { AlertCircle, RefreshCw } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

interface ReviewQueueProps {
  filters: Filters
  page: number
  onPageChange: (page: number) => void
  onSelectItem: (documentId: string) => void
}

export function ReviewQueue({
  filters,
  page,
  onPageChange,
  onSelectItem
}: ReviewQueueProps) {
  const { data, isLoading, error, refetch, isFetching } = useReviewQueue({
    ...filters,
    page,
    pageSize: 20
  })

  // 預取下一頁
  usePrefetchNextPage(
    { ...filters, page },
    data?.meta.totalPages || 0
  )

  if (isLoading) {
    return <ReviewQueueSkeleton />
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>載入失敗</AlertTitle>
        <AlertDescription className="flex items-center justify-between">
          <span>無法載入待審核列表，請重試。</span>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            重試
          </Button>
        </AlertDescription>
      </Alert>
    )
  }

  if (!data?.data.length) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p className="text-lg">沒有待審核的發票</p>
        <p className="text-sm mt-2">所有發票都已處理完成</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">
          共 {data.meta.total} 筆待審核
        </p>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => refetch()}
          disabled={isFetching}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
          刷新
        </Button>
      </div>

      <ReviewQueueTable
        items={data.data}
        onSelectItem={onSelectItem}
      />

      {/* 分頁 */}
      {data.meta.totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page === 1}
            onClick={() => onPageChange(page - 1)}
          >
            上一頁
          </Button>
          <span className="flex items-center px-4 text-sm">
            {page} / {data.meta.totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page === data.meta.totalPages}
            onClick={() => onPageChange(page + 1)}
          >
            下一頁
          </Button>
        </div>
      )}
    </div>
  )
}
```

#### 4.3.3 審核隊列表格

**File**: `src/components/features/review/ReviewQueueTable.tsx`

```typescript
'use client'

import { ReviewQueueItem } from '@/types/review'
import { ConfidenceBadge } from './ConfidenceBadge'
import { ProcessingPathBadge } from './ProcessingPathBadge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatDistanceToNow } from 'date-fns'
import { zhTW } from 'date-fns/locale'

interface ReviewQueueTableProps {
  items: ReviewQueueItem[]
  onSelectItem: (documentId: string) => void
}

export function ReviewQueueTable({ items, onSelectItem }: ReviewQueueTableProps) {
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[300px]">文件名</TableHead>
            <TableHead>Forwarder</TableHead>
            <TableHead>上傳時間</TableHead>
            <TableHead className="text-center">信心度</TableHead>
            <TableHead>處理路徑</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow
              key={item.id}
              className="cursor-pointer hover:bg-muted/50"
              onClick={() => onSelectItem(item.document.id)}
            >
              <TableCell className="font-medium">
                <span className="truncate block max-w-[280px]" title={item.document.fileName}>
                  {item.document.fileName}
                </span>
              </TableCell>
              <TableCell>
                {item.forwarder?.name || (
                  <span className="text-muted-foreground">未識別</span>
                )}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {formatDistanceToNow(new Date(item.document.createdAt), {
                  addSuffix: true,
                  locale: zhTW
                })}
              </TableCell>
              <TableCell className="text-center">
                <ConfidenceBadge score={item.overallConfidence} />
              </TableCell>
              <TableCell>
                <ProcessingPathBadge path={item.processingPath} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
```

#### 4.3.4 篩選組件

**File**: `src/components/features/review/ReviewFilters.tsx`

```typescript
'use client'

import { useEffect, useState } from 'react'
import { ReviewQueueFilters } from '@/types/review'
import { ProcessingPath } from '@prisma/client'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { Button } from '@/components/ui/button'
import { X } from 'lucide-react'

interface ReviewFiltersProps {
  filters: ReviewQueueFilters
  onFiltersChange: (filters: ReviewQueueFilters) => void
}

// Forwarder 列表 Hook（簡化版）
function useForwarders() {
  const [forwarders, setForwarders] = useState<{ id: string; name: string }[]>([])

  useEffect(() => {
    fetch('/api/forwarders?active=true')
      .then(res => res.json())
      .then(data => {
        if (data.success) setForwarders(data.data)
      })
  }, [])

  return forwarders
}

export function ReviewFilters({ filters, onFiltersChange }: ReviewFiltersProps) {
  const forwarders = useForwarders()
  const [confidenceRange, setConfidenceRange] = useState<[number, number]>([
    filters.minConfidence || 0,
    filters.maxConfidence || 100
  ])

  const hasFilters = filters.forwarderId || filters.processingPath ||
    filters.minConfidence !== undefined || filters.maxConfidence !== undefined

  const clearFilters = () => {
    onFiltersChange({})
    setConfidenceRange([0, 100])
  }

  const handleConfidenceChange = (values: number[]) => {
    setConfidenceRange([values[0], values[1]])
  }

  const handleConfidenceCommit = () => {
    onFiltersChange({
      ...filters,
      minConfidence: confidenceRange[0] > 0 ? confidenceRange[0] : undefined,
      maxConfidence: confidenceRange[1] < 100 ? confidenceRange[1] : undefined
    })
  }

  return (
    <div className="flex flex-wrap items-center gap-4 p-4 bg-muted/30 rounded-lg">
      {/* Forwarder 篩選 */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Forwarder:</span>
        <Select
          value={filters.forwarderId || 'all'}
          onValueChange={(value) =>
            onFiltersChange({
              ...filters,
              forwarderId: value === 'all' ? undefined : value
            })
          }
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="全部" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部</SelectItem>
            {forwarders.map(f => (
              <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* 處理路徑篩選 */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">處理路徑:</span>
        <Select
          value={filters.processingPath || 'all'}
          onValueChange={(value) =>
            onFiltersChange({
              ...filters,
              processingPath: value === 'all' ? undefined : value as ProcessingPath
            })
          }
        >
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="全部" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部</SelectItem>
            <SelectItem value={ProcessingPath.QUICK_REVIEW}>快速審核</SelectItem>
            <SelectItem value={ProcessingPath.FULL_REVIEW}>完整審核</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* 信心度範圍篩選 */}
      <div className="flex items-center gap-2 min-w-[250px]">
        <span className="text-sm text-muted-foreground">信心度:</span>
        <div className="flex-1 px-2">
          <Slider
            value={confidenceRange}
            onValueChange={handleConfidenceChange}
            onValueCommit={handleConfidenceCommit}
            min={0}
            max={100}
            step={5}
          />
        </div>
        <span className="text-sm min-w-[60px]">
          {confidenceRange[0]}-{confidenceRange[1]}%
        </span>
      </div>

      {/* 清除篩選 */}
      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={clearFilters}>
          <X className="h-4 w-4 mr-1" />
          清除篩選
        </Button>
      )}
    </div>
  )
}
```

#### 4.3.5 信心度 Badge 組件

**File**: `src/components/features/review/ConfidenceBadge.tsx`

```typescript
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface ConfidenceBadgeProps {
  score: number  // 0-100
  showIcon?: boolean
  size?: 'sm' | 'default'
}

export function ConfidenceBadge({
  score,
  showIcon = true,
  size = 'default'
}: ConfidenceBadgeProps) {
  const level = score >= 90 ? 'high' : score >= 70 ? 'medium' : 'low'

  const config = {
    high: {
      icon: '✓',
      label: '高',
      className: 'bg-green-100 text-green-800 border-green-200'
    },
    medium: {
      icon: '○',
      label: '中',
      className: 'bg-yellow-100 text-yellow-800 border-yellow-200'
    },
    low: {
      icon: '△',
      label: '低',
      className: 'bg-red-100 text-red-800 border-red-200'
    }
  }[level]

  return (
    <Badge
      variant="outline"
      className={cn(
        config.className,
        size === 'sm' && 'text-xs px-1.5 py-0'
      )}
    >
      {showIcon && <span className="mr-1">{config.icon}</span>}
      {score}%
    </Badge>
  )
}
```

#### 4.3.6 處理路徑 Badge 組件

**File**: `src/components/features/review/ProcessingPathBadge.tsx`

```typescript
import { ProcessingPath } from '@prisma/client'
import { Badge } from '@/components/ui/badge'
import { Zap, Search } from 'lucide-react'

interface ProcessingPathBadgeProps {
  path: ProcessingPath
}

export function ProcessingPathBadge({ path }: ProcessingPathBadgeProps) {
  const config = {
    [ProcessingPath.AUTO_APPROVE]: {
      label: '自動通過',
      icon: null,
      variant: 'secondary' as const
    },
    [ProcessingPath.QUICK_REVIEW]: {
      label: '快速審核',
      icon: <Zap className="h-3 w-3 mr-1" />,
      variant: 'default' as const
    },
    [ProcessingPath.FULL_REVIEW]: {
      label: '完整審核',
      icon: <Search className="h-3 w-3 mr-1" />,
      variant: 'outline' as const
    }
  }[path]

  return (
    <Badge variant={config.variant}>
      {config.icon}
      {config.label}
    </Badge>
  )
}
```

#### 4.3.7 載入骨架組件

**File**: `src/components/features/review/ReviewQueueSkeleton.tsx`

```typescript
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

export function ReviewQueueSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-8 w-16" />
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[300px]">文件名</TableHead>
              <TableHead>Forwarder</TableHead>
              <TableHead>上傳時間</TableHead>
              <TableHead className="text-center">信心度</TableHead>
              <TableHead>處理路徑</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={i}>
                <TableCell><Skeleton className="h-4 w-[250px]" /></TableCell>
                <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                <TableCell className="text-center">
                  <Skeleton className="h-6 w-12 mx-auto" />
                </TableCell>
                <TableCell><Skeleton className="h-6 w-20" /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
```

---

## 5. Testing Guide

### 5.1 Unit Tests

**File**: `tests/unit/hooks/useReviewQueue.test.ts`

```typescript
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useReviewQueue } from '@/hooks/useReviewQueue'

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } }
  })
  return ({ children }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

describe('useReviewQueue', () => {
  it('should fetch review queue with default params', async () => {
    const { result } = renderHook(() => useReviewQueue(), {
      wrapper: createWrapper()
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.data).toBeDefined()
  })

  it('should apply filters correctly', async () => {
    const { result } = renderHook(
      () => useReviewQueue({ processingPath: 'FULL_REVIEW' }),
      { wrapper: createWrapper() }
    )

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    result.current.data?.data.forEach(item => {
      expect(item.processingPath).toBe('FULL_REVIEW')
    })
  })
})
```

### 5.2 Integration Tests

**File**: `tests/integration/api/review.test.ts`

```typescript
import { GET } from '@/app/api/review/route'
import { NextRequest } from 'next/server'

describe('GET /api/review', () => {
  it('should return paginated review queue', async () => {
    const request = new NextRequest('http://localhost/api/review?page=1&pageSize=10')
    const response = await GET(request)
    const data = await response.json()

    expect(data.success).toBe(true)
    expect(data.data).toBeInstanceOf(Array)
    expect(data.meta).toHaveProperty('total')
    expect(data.meta).toHaveProperty('page', 1)
    expect(data.meta).toHaveProperty('pageSize', 10)
  })

  it('should filter by processingPath', async () => {
    const request = new NextRequest(
      'http://localhost/api/review?processingPath=QUICK_REVIEW'
    )
    const response = await GET(request)
    const data = await response.json()

    data.data.forEach(item => {
      expect(item.processingPath).toBe('QUICK_REVIEW')
    })
  })

  it('should filter by confidence range', async () => {
    const request = new NextRequest(
      'http://localhost/api/review?minConfidence=60&maxConfidence=80'
    )
    const response = await GET(request)
    const data = await response.json()

    data.data.forEach(item => {
      expect(item.overallConfidence).toBeGreaterThanOrEqual(60)
      expect(item.overallConfidence).toBeLessThanOrEqual(80)
    })
  })
})
```

### 5.3 E2E Tests

**File**: `tests/e2e/review-queue.spec.ts`

```typescript
import { test, expect } from '@playwright/test'

test.describe('Review Queue Page', () => {
  test.beforeEach(async ({ page }) => {
    // 登入
    await page.goto('/login')
    // ... 登入流程
    await page.goto('/review')
  })

  test('should display review queue list', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('待審核發票')
    await expect(page.locator('table')).toBeVisible()
  })

  test('should filter by processing path', async ({ page }) => {
    await page.getByRole('combobox', { name: /處理路徑/i }).click()
    await page.getByRole('option', { name: '快速審核' }).click()

    // 驗證所有項目都是快速審核
    const badges = await page.locator('text=快速審核').count()
    const rows = await page.locator('tbody tr').count()
    expect(badges).toBe(rows)
  })

  test('should navigate to review detail on row click', async ({ page }) => {
    await page.locator('tbody tr').first().click()
    await expect(page).toHaveURL(/\/review\/[a-z0-9-]+/)
  })
})
```

---

## 6. Verification Checklist

### 6.1 Acceptance Criteria Verification

- [ ] **AC1**: 待審核列表顯示
  - [ ] 列表包含文件名、Forwarder、上傳時間、信心度、處理路徑
  - [ ] 按上傳時間排序（最舊優先）
  - [ ] 高優先級項目排在前面

- [ ] **AC2**: 篩選功能
  - [ ] Forwarder 下拉篩選正常
  - [ ] 信心度範圍滑桿正常
  - [ ] 處理路徑篩選正常
  - [ ] 篩選條件可清除

- [ ] **AC3**: 進入審核詳情
  - [ ] 點擊列表項可跳轉
  - [ ] URL 正確包含文件 ID

### 6.2 Technical Verification

- [ ] API 響應符合 RFC 7807 格式
- [ ] React Query 緩存正常工作
- [ ] 分頁功能正確
- [ ] 載入狀態顯示正確
- [ ] 錯誤狀態顯示正確
- [ ] 空狀態顯示正確

### 6.3 UX Verification

- [ ] 信心度三重編碼（顏色+形狀+數字）
- [ ] 處理路徑標籤清晰
- [ ] 載入骨架顯示流暢
- [ ] 響應式佈局正確

---

## 7. Files to Create/Modify

| File Path | Action | Description |
|-----------|--------|-------------|
| `src/app/api/review/route.ts` | Create | 審核列表 API |
| `src/types/review.ts` | Create | 審核相關類型定義 |
| `src/hooks/useReviewQueue.ts` | Create | 審核隊列 Hook |
| `src/app/(dashboard)/review/page.tsx` | Create | 審核列表頁面 |
| `src/components/features/review/ReviewQueue.tsx` | Create | 審核隊列組件 |
| `src/components/features/review/ReviewQueueTable.tsx` | Create | 列表表格組件 |
| `src/components/features/review/ReviewFilters.tsx` | Create | 篩選組件 |
| `src/components/features/review/ConfidenceBadge.tsx` | Create | 信心度 Badge |
| `src/components/features/review/ProcessingPathBadge.tsx` | Create | 處理路徑 Badge |
| `src/components/features/review/ReviewQueueSkeleton.tsx` | Create | 載入骨架 |
| `src/components/features/review/index.ts` | Create | 統一導出 |

---

*Tech Spec Created: 2025-12-16*
*Story Reference: 3-1-pending-review-invoice-list*
