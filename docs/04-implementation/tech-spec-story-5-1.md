# Tech Spec: Story 5-1 Forwarder Profile 列表

## 1. Overview

### 1.1 Story Reference
- **Story ID**: 5.1
- **Epic**: Epic 5 - Forwarder 配置管理
- **Title**: Forwarder Profile 列表
- **Status**: Ready for Dev

### 1.2 Summary
實作 Forwarder Profile 列表管理功能，允許 Super User 查看、篩選、搜索和排序所有貨運代理商（Forwarder）的配置。列表顯示每個 Forwarder 的基本資訊、狀態、規則數量和最後更新時間，並支援分頁瀏覽。

### 1.3 Acceptance Criteria Overview
| AC ID | Description | Priority |
|-------|-------------|----------|
| AC1 | 列表顯示 - 顯示所有 Forwarder Profile，包含名稱、代碼、狀態、規則數量、最後更新時間 | Must Have |
| AC2 | 列表篩選與搜索 - 可按狀態篩選、按名稱或代碼搜索、支援分頁 | Must Have |
| AC3 | 列表排序 - 可按欄位排序，預設按最後更新時間降序 | Must Have |

---

## 2. Technical Design

### 2.1 Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                       Forwarder List Management                          │
├─────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                    ForwardersPage                                │    │
│  │  ┌────────────────┐  ┌─────────────────┐  ┌──────────────────┐ │    │
│  │  │ForwarderFilters│  │ ForwarderTable  │  │   Pagination     │ │    │
│  │  │                │  │                 │  │                  │ │    │
│  │  │ - Status       │  │ - Name (link)   │  │ - Page info      │ │    │
│  │  │ - Search       │  │ - Code          │  │ - Page size      │ │    │
│  │  │ - Reset        │  │ - Status Badge  │  │ - Navigation     │ │    │
│  │  │                │  │ - Rule Count    │  │                  │ │    │
│  │  │                │  │ - Updated At    │  │                  │ │    │
│  │  └────────────────┘  └─────────────────┘  └──────────────────┘ │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│         │                       │                       │               │
│         └───────────────────────┼───────────────────────┘               │
│                                 ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                     useForwarders Hook                           │    │
│  │  - Query key: ['forwarders', filters]                           │    │
│  │  - Handles loading, error, refetch                              │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                 │                                        │
│                                 ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                    GET /api/forwarders                           │    │
│  │  - Authentication & Authorization                                │    │
│  │  - Query params: status, search, page, limit, sortBy, sortOrder │    │
│  │  - Returns: forwarders[], pagination                            │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                 │                                        │
│                                 ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                    Prisma (Forwarder)                            │    │
│  │  - Include: _count (mappingRules, documents)                    │    │
│  │  - Filter: status, name/code search                             │    │
│  │  - Sort: dynamic field + order                                  │    │
│  └─────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Data Models

#### 2.2.1 Prisma Schema

```prisma
// Forwarder 模型 - 貨運代理商配置
model Forwarder {
  id               String          @id @default(uuid())
  name             String          @unique // 顯示名稱
  code             String          @unique // 唯一代碼（大寫）
  description      String?         // 描述說明
  status           ForwarderStatus @default(ACTIVE)
  logoUrl          String?         @map("logo_url") // Logo 圖片 URL
  contactEmail     String?         @map("contact_email") // 聯絡郵箱
  defaultConfidence Float          @default(0.8) @map("default_confidence") // 預設信心度
  createdAt        DateTime        @default(now()) @map("created_at")
  updatedAt        DateTime        @updatedAt @map("updated_at")
  createdBy        String          @map("created_by")

  // Relations
  creator            User               @relation(fields: [createdBy], references: [id])
  mappingRules       MappingRule[]
  documents          Document[]
  ruleSuggestions    RuleSuggestion[]
  correctionPatterns CorrectionPattern[]
  ruleChangeRequests RuleChangeRequest[]
  ruleTestTasks      RuleTestTask[]

  @@index([status])
  @@index([name])
  @@index([code])
  @@index([updatedAt])
  @@map("forwarders")
}

// Forwarder 狀態枚舉
enum ForwarderStatus {
  ACTIVE    // 啟用中 - 可接收和處理發票
  INACTIVE  // 已停用 - 暫停使用，歷史數據保留
  PENDING   // 待設定 - 新建但尚未完成配置
}
```

#### 2.2.2 TypeScript Types

```typescript
// src/types/forwarder.ts

import type { ForwarderStatus } from '@prisma/client'

/**
 * Forwarder 列表項目
 */
export interface ForwarderListItem {
  id: string
  name: string
  code: string
  description: string | null
  status: ForwarderStatus
  logoUrl: string | null
  ruleCount: number           // 總規則數量
  activeRuleCount: number     // 活躍規則數量
  documentCount: number       // 最近 30 天處理文件數
  lastDocumentAt: string | null // 最後處理文件時間
  createdAt: string
  updatedAt: string
}

/**
 * 分頁資訊
 */
export interface PaginationInfo {
  total: number
  page: number
  limit: number
  totalPages: number
}

/**
 * Forwarder 列表響應
 */
export interface ForwardersResponse {
  forwarders: ForwarderListItem[]
  pagination: PaginationInfo
}

/**
 * Forwarder 列表查詢參數
 */
export interface ForwardersQueryParams {
  status?: ForwarderStatus
  search?: string
  page?: number
  limit?: number
  sortBy?: ForwarderSortField
  sortOrder?: 'asc' | 'desc'
}

/**
 * 可排序欄位
 */
export type ForwarderSortField =
  | 'name'
  | 'code'
  | 'status'
  | 'updatedAt'
  | 'ruleCount'

/**
 * 狀態顯示配置
 */
export const FORWARDER_STATUS_CONFIG = {
  ACTIVE: {
    label: '啟用',
    variant: 'default' as const,
    color: 'green',
  },
  INACTIVE: {
    label: '停用',
    variant: 'secondary' as const,
    color: 'gray',
  },
  PENDING: {
    label: '待設定',
    variant: 'outline' as const,
    color: 'yellow',
  },
} as const

/**
 * 篩選器狀態
 */
export interface ForwarderFiltersState {
  status: ForwarderStatus | 'all'
  search: string
  sortBy: ForwarderSortField
  sortOrder: 'asc' | 'desc'
}
```

### 2.3 API Design

#### 2.3.1 GET /api/forwarders - 取得 Forwarder 列表

**Purpose**: 取得所有 Forwarder Profile 列表，支援篩選、搜索、排序和分頁

**Route**: `src/app/api/forwarders/route.ts`

**Request**:
```typescript
// Query Parameters
interface ForwardersQueryParams {
  status?: 'ACTIVE' | 'INACTIVE' | 'PENDING'  // 狀態篩選
  search?: string                              // 名稱或代碼搜索
  page?: number                                // 頁碼，預設 1
  limit?: number                               // 每頁數量，預設 20
  sortBy?: 'name' | 'code' | 'updatedAt' | 'ruleCount'  // 排序欄位
  sortOrder?: 'asc' | 'desc'                   // 排序方向，預設 desc
}
```

**Response**:
```typescript
// 成功響應
interface ForwardersSuccessResponse {
  success: true
  data: ForwardersResponse
}

// 錯誤響應 (RFC 7807)
interface ForwardersErrorResponse {
  success: false
  error: {
    type: string
    title: string
    status: number
    detail: string
    instance: string
  }
}
```

**Implementation**:
```typescript
// src/app/api/forwarders/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { checkPermission } from '@/lib/permissions'
import { z } from 'zod'
import { Prisma } from '@prisma/client'

const querySchema = z.object({
  status: z.enum(['ACTIVE', 'INACTIVE', 'PENDING']).optional(),
  search: z.string().max(100).optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  sortBy: z.enum(['name', 'code', 'updatedAt', 'ruleCount']).default('updatedAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
})

export async function GET(request: NextRequest) {
  try {
    // 1. Authentication
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json(
        {
          success: false,
          error: {
            type: 'https://api.example.com/errors/unauthorized',
            title: 'Unauthorized',
            status: 401,
            detail: 'Authentication required',
            instance: '/api/forwarders',
          },
        },
        { status: 401 }
      )
    }

    // 2. Authorization
    const hasPermission = await checkPermission(session.user.id, 'FORWARDER_VIEW')
    if (!hasPermission) {
      return NextResponse.json(
        {
          success: false,
          error: {
            type: 'https://api.example.com/errors/forbidden',
            title: 'Forbidden',
            status: 403,
            detail: 'FORWARDER_VIEW permission required',
            instance: '/api/forwarders',
          },
        },
        { status: 403 }
      )
    }

    // 3. Parse and validate query params
    const searchParams = request.nextUrl.searchParams
    const queryResult = querySchema.safeParse({
      status: searchParams.get('status'),
      search: searchParams.get('search'),
      page: searchParams.get('page'),
      limit: searchParams.get('limit'),
      sortBy: searchParams.get('sortBy'),
      sortOrder: searchParams.get('sortOrder'),
    })

    if (!queryResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            type: 'https://api.example.com/errors/validation',
            title: 'Validation Error',
            status: 400,
            detail: queryResult.error.issues[0].message,
            instance: '/api/forwarders',
          },
        },
        { status: 400 }
      )
    }

    const { status, search, page, limit, sortBy, sortOrder } = queryResult.data

    // 4. Build where clause
    const where: Prisma.ForwarderWhereInput = {}

    if (status) {
      where.status = status
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
      ]
    }

    // 5. Calculate 30 days ago for document count
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

    // 6. Execute query with counts
    const [forwarders, total] = await Promise.all([
      prisma.forwarder.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: sortBy === 'ruleCount'
          ? { mappingRules: { _count: sortOrder } }
          : { [sortBy]: sortOrder },
        include: {
          _count: {
            select: {
              mappingRules: true,
            },
          },
          mappingRules: {
            where: { status: 'ACTIVE' },
            select: { id: true },
          },
          documents: {
            where: { createdAt: { gte: thirtyDaysAgo } },
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: { createdAt: true },
          },
        },
      }),
      prisma.forwarder.count({ where }),
    ])

    // 7. Get document counts separately for better performance
    const forwarderIds = forwarders.map((f) => f.id)
    const documentCounts = await prisma.document.groupBy({
      by: ['forwarderId'],
      where: {
        forwarderId: { in: forwarderIds },
        createdAt: { gte: thirtyDaysAgo },
      },
      _count: true,
    })

    const documentCountMap = new Map(
      documentCounts.map((dc) => [dc.forwarderId, dc._count])
    )

    // 8. Transform response
    const formattedForwarders: ForwarderListItem[] = forwarders.map((f) => ({
      id: f.id,
      name: f.name,
      code: f.code,
      description: f.description,
      status: f.status,
      logoUrl: f.logoUrl,
      ruleCount: f._count.mappingRules,
      activeRuleCount: f.mappingRules.length,
      documentCount: documentCountMap.get(f.id) || 0,
      lastDocumentAt: f.documents[0]?.createdAt.toISOString() || null,
      createdAt: f.createdAt.toISOString(),
      updatedAt: f.updatedAt.toISOString(),
    }))

    return NextResponse.json({
      success: true,
      data: {
        forwarders: formattedForwarders,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      },
    })
  } catch (error) {
    console.error('Error fetching forwarders:', error)
    return NextResponse.json(
      {
        success: false,
        error: {
          type: 'https://api.example.com/errors/internal',
          title: 'Internal Server Error',
          status: 500,
          detail: 'An unexpected error occurred',
          instance: '/api/forwarders',
        },
      },
      { status: 500 }
    )
  }
}
```

### 2.4 UI Components

#### 2.4.1 Forwarders Page

```typescript
// src/app/(dashboard)/forwarders/page.tsx
import { Suspense } from 'react'
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { checkPermission } from '@/lib/permissions'
import { ForwarderTable } from '@/components/forwarders/ForwarderTable'
import { ForwarderFilters } from '@/components/forwarders/ForwarderFilters'
import { ForwarderTableSkeleton } from '@/components/forwarders/ForwarderTableSkeleton'
import { Button } from '@/components/ui/button'
import { Plus, Truck } from 'lucide-react'
import Link from 'next/link'

export const metadata = {
  title: 'Forwarder 管理',
  description: '管理貨運代理商配置和映射規則',
}

export default async function ForwardersPage() {
  const session = await auth()

  if (!session?.user?.id) {
    redirect('/login')
  }

  const hasViewPermission = await checkPermission(session.user.id, 'FORWARDER_VIEW')
  if (!hasViewPermission) {
    redirect('/unauthorized')
  }

  const hasManagePermission = await checkPermission(session.user.id, 'FORWARDER_MANAGE')

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Truck className="h-6 w-6" />
            Forwarder 管理
          </h1>
          <p className="text-muted-foreground">
            管理貨運代理商配置和映射規則
          </p>
        </div>
        {hasManagePermission && (
          <Button asChild>
            <Link href="/forwarders/new">
              <Plus className="mr-2 h-4 w-4" />
              新增 Forwarder
            </Link>
          </Button>
        )}
      </div>

      {/* Filters */}
      <ForwarderFilters />

      {/* Table with Suspense */}
      <Suspense fallback={<ForwarderTableSkeleton />}>
        <ForwarderTable />
      </Suspense>
    </div>
  )
}
```

#### 2.4.2 Forwarder Filters Component

```typescript
// src/components/forwarders/ForwarderFilters.tsx
'use client'

import { useCallback, useTransition } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Search, X, RotateCcw } from 'lucide-react'
import { useDebouncedCallback } from 'use-debounce'
import { ForwarderStatus } from '@prisma/client'

export function ForwarderFilters() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  // Current filter values
  const currentStatus = searchParams.get('status') || 'all'
  const currentSearch = searchParams.get('search') || ''
  const currentSortBy = searchParams.get('sortBy') || 'updatedAt'
  const currentSortOrder = searchParams.get('sortOrder') || 'desc'

  // Create URL with updated params
  const createQueryString = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString())

      Object.entries(updates).forEach(([key, value]) => {
        if (value === null || value === '' || value === 'all') {
          params.delete(key)
        } else {
          params.set(key, value)
        }
      })

      // Reset to page 1 when filters change
      if (!updates.page) {
        params.delete('page')
      }

      return params.toString()
    },
    [searchParams]
  )

  // Update URL with new params
  const updateFilters = useCallback(
    (updates: Record<string, string | null>) => {
      startTransition(() => {
        const queryString = createQueryString(updates)
        router.push(`${pathname}${queryString ? `?${queryString}` : ''}`)
      })
    },
    [router, pathname, createQueryString]
  )

  // Debounced search handler
  const handleSearchChange = useDebouncedCallback((value: string) => {
    updateFilters({ search: value || null })
  }, 300)

  // Reset all filters
  const handleReset = () => {
    router.push(pathname)
  }

  const hasActiveFilters = currentStatus !== 'all' || currentSearch !== ''

  return (
    <div className="flex flex-col sm:flex-row gap-4">
      {/* Search Input */}
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="搜索名稱或代碼..."
          defaultValue={currentSearch}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="pl-9"
        />
        {currentSearch && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
            onClick={() => updateFilters({ search: null })}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Status Filter */}
      <Select
        value={currentStatus}
        onValueChange={(value) => updateFilters({ status: value })}
      >
        <SelectTrigger className="w-[150px]">
          <SelectValue placeholder="狀態篩選" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">全部狀態</SelectItem>
          <SelectItem value="ACTIVE">啟用</SelectItem>
          <SelectItem value="INACTIVE">停用</SelectItem>
          <SelectItem value="PENDING">待設定</SelectItem>
        </SelectContent>
      </Select>

      {/* Sort By */}
      <Select
        value={currentSortBy}
        onValueChange={(value) => updateFilters({ sortBy: value })}
      >
        <SelectTrigger className="w-[150px]">
          <SelectValue placeholder="排序方式" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="updatedAt">更新時間</SelectItem>
          <SelectItem value="name">名稱</SelectItem>
          <SelectItem value="code">代碼</SelectItem>
          <SelectItem value="ruleCount">規則數量</SelectItem>
        </SelectContent>
      </Select>

      {/* Sort Order */}
      <Select
        value={currentSortOrder}
        onValueChange={(value) => updateFilters({ sortOrder: value })}
      >
        <SelectTrigger className="w-[120px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="desc">降序</SelectItem>
          <SelectItem value="asc">升序</SelectItem>
        </SelectContent>
      </Select>

      {/* Reset Button */}
      {hasActiveFilters && (
        <Button variant="outline" onClick={handleReset}>
          <RotateCcw className="mr-2 h-4 w-4" />
          重置
        </Button>
      )}
    </div>
  )
}
```

#### 2.4.3 Forwarder Table Component

```typescript
// src/components/forwarders/ForwarderTable.tsx
'use client'

import { useSearchParams } from 'next/navigation'
import { useForwarders } from '@/hooks/use-forwarders'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Pagination } from '@/components/ui/pagination'
import { SortableHeader } from '@/components/ui/sortable-header'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/ui/error-state'
import { formatDistanceToNow } from 'date-fns'
import { zhTW } from 'date-fns/locale'
import { Truck } from 'lucide-react'
import Link from 'next/link'
import { FORWARDER_STATUS_CONFIG } from '@/types/forwarder'

export function ForwarderTable() {
  const searchParams = useSearchParams()
  const { data, isLoading, error, refetch } = useForwarders(searchParams)

  if (isLoading) {
    return <ForwarderTableSkeleton />
  }

  if (error) {
    return (
      <ErrorState
        title="載入失敗"
        description="無法載入 Forwarder 列表，請稍後再試"
        onRetry={refetch}
      />
    )
  }

  if (!data?.forwarders.length) {
    return (
      <EmptyState
        icon={Truck}
        title="尚無 Forwarder"
        description="目前沒有符合條件的 Forwarder 資料"
        action={{
          label: '新增 Forwarder',
          href: '/forwarders/new',
        }}
      />
    )
  }

  return (
    <div className="space-y-4">
      {/* Results Count */}
      <div className="text-sm text-muted-foreground">
        共 {data.pagination.total} 筆資料
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[250px]">
                <SortableHeader field="name">名稱</SortableHeader>
              </TableHead>
              <TableHead className="w-[120px]">
                <SortableHeader field="code">代碼</SortableHeader>
              </TableHead>
              <TableHead className="w-[100px]">狀態</TableHead>
              <TableHead className="w-[120px] text-right">
                <SortableHeader field="ruleCount">規則數量</SortableHeader>
              </TableHead>
              <TableHead className="w-[100px] text-right">30天文件</TableHead>
              <TableHead className="w-[150px]">
                <SortableHeader field="updatedAt">最後更新</SortableHeader>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.forwarders.map((forwarder) => {
              const statusConfig = FORWARDER_STATUS_CONFIG[forwarder.status]

              return (
                <TableRow key={forwarder.id}>
                  <TableCell>
                    <Link
                      href={`/forwarders/${forwarder.id}`}
                      className="flex items-center gap-3 hover:underline"
                    >
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={forwarder.logoUrl || undefined} />
                        <AvatarFallback className="bg-muted text-xs">
                          {forwarder.code.slice(0, 2)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <span className="font-medium">{forwarder.name}</span>
                        {forwarder.description && (
                          <p className="text-xs text-muted-foreground truncate max-w-[180px]">
                            {forwarder.description}
                          </p>
                        )}
                      </div>
                    </Link>
                  </TableCell>
                  <TableCell>
                    <code className="rounded bg-muted px-2 py-1 text-sm font-mono">
                      {forwarder.code}
                    </code>
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusConfig.variant}>
                      {statusConfig.label}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="font-medium">{forwarder.activeRuleCount}</span>
                    <span className="text-muted-foreground">
                      {' / '}{forwarder.ruleCount}
                    </span>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {forwarder.documentCount.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDistanceToNow(new Date(forwarder.updatedAt), {
                      addSuffix: true,
                      locale: zhTW,
                    })}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {data.pagination.totalPages > 1 && (
        <Pagination
          currentPage={data.pagination.page}
          totalPages={data.pagination.totalPages}
          pageSize={data.pagination.limit}
          totalItems={data.pagination.total}
        />
      )}
    </div>
  )
}
```

#### 2.4.4 Table Skeleton Component

```typescript
// src/components/forwarders/ForwarderTableSkeleton.tsx
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

export function ForwarderTableSkeleton() {
  return (
    <div className="space-y-4">
      {/* Count skeleton */}
      <Skeleton className="h-4 w-24" />

      {/* Table skeleton */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[250px]">名稱</TableHead>
              <TableHead className="w-[120px]">代碼</TableHead>
              <TableHead className="w-[100px]">狀態</TableHead>
              <TableHead className="w-[120px] text-right">規則數量</TableHead>
              <TableHead className="w-[100px] text-right">30天文件</TableHead>
              <TableHead className="w-[150px]">最後更新</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={i}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-8 w-8 rounded-full" />
                    <div className="space-y-1">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <Skeleton className="h-6 w-16" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-5 w-12" />
                </TableCell>
                <TableCell className="text-right">
                  <Skeleton className="h-4 w-12 ml-auto" />
                </TableCell>
                <TableCell className="text-right">
                  <Skeleton className="h-4 w-8 ml-auto" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-20" />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
```

### 2.5 React Query Hooks

```typescript
// src/hooks/use-forwarders.ts
import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import type { ForwardersResponse, ForwardersQueryParams } from '@/types/forwarder'

/**
 * 解析 URL search params 為查詢參數
 */
function parseSearchParams(
  searchParams: URLSearchParams
): ForwardersQueryParams {
  return {
    status: searchParams.get('status') as ForwardersQueryParams['status'],
    search: searchParams.get('search') || undefined,
    page: searchParams.get('page') ? parseInt(searchParams.get('page')!) : 1,
    limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 20,
    sortBy: (searchParams.get('sortBy') || 'updatedAt') as ForwardersQueryParams['sortBy'],
    sortOrder: (searchParams.get('sortOrder') || 'desc') as ForwardersQueryParams['sortOrder'],
  }
}

/**
 * Forwarder 列表查詢 Hook
 */
export function useForwarders(searchParams: URLSearchParams) {
  const params = parseSearchParams(searchParams)

  return useQuery({
    queryKey: ['forwarders', params],
    queryFn: async (): Promise<ForwardersResponse> => {
      const queryString = new URLSearchParams()

      if (params.status) queryString.set('status', params.status)
      if (params.search) queryString.set('search', params.search)
      if (params.page) queryString.set('page', String(params.page))
      if (params.limit) queryString.set('limit', String(params.limit))
      if (params.sortBy) queryString.set('sortBy', params.sortBy)
      if (params.sortOrder) queryString.set('sortOrder', params.sortOrder)

      const response = await apiClient.get(`/api/forwarders?${queryString}`)

      if (!response.success) {
        throw new Error(response.error?.detail || 'Failed to fetch forwarders')
      }

      return response.data
    },
    staleTime: 30 * 1000, // 30 seconds
    refetchOnWindowFocus: true,
  })
}

/**
 * 單一 Forwarder 查詢 Hook
 */
export function useForwarder(id: string) {
  return useQuery({
    queryKey: ['forwarder', id],
    queryFn: async () => {
      const response = await apiClient.get(`/api/forwarders/${id}`)

      if (!response.success) {
        throw new Error(response.error?.detail || 'Failed to fetch forwarder')
      }

      return response.data
    },
    enabled: !!id,
  })
}
```

### 2.6 Sortable Header Component

```typescript
// src/components/ui/sortable-header.tsx
'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SortableHeaderProps {
  field: string
  children: React.ReactNode
}

export function SortableHeader({ field, children }: SortableHeaderProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const currentSortBy = searchParams.get('sortBy') || 'updatedAt'
  const currentSortOrder = searchParams.get('sortOrder') || 'desc'

  const isActive = currentSortBy === field

  const handleClick = () => {
    const params = new URLSearchParams(searchParams.toString())

    if (isActive) {
      // Toggle order if same field
      params.set('sortOrder', currentSortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      // New field, default to desc
      params.set('sortBy', field)
      params.set('sortOrder', 'desc')
    }

    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      className={cn(
        '-ml-3 h-8 font-medium',
        isActive && 'text-foreground'
      )}
      onClick={handleClick}
    >
      {children}
      {isActive ? (
        currentSortOrder === 'asc' ? (
          <ArrowUp className="ml-2 h-4 w-4" />
        ) : (
          <ArrowDown className="ml-2 h-4 w-4" />
        )
      ) : (
        <ArrowUpDown className="ml-2 h-4 w-4 opacity-50" />
      )}
    </Button>
  )
}
```

---

## 3. Test Specifications

### 3.1 API Tests

```typescript
// src/app/api/forwarders/__tests__/route.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { GET } from '../route'
import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { checkPermission } from '@/lib/permissions'

vi.mock('@/lib/auth')
vi.mock('@/lib/prisma')
vi.mock('@/lib/permissions')

describe('GET /api/forwarders', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return 401 when not authenticated', async () => {
    vi.mocked(auth).mockResolvedValue(null)

    const request = new NextRequest('http://localhost/api/forwarders')
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(401)
    expect(data.success).toBe(false)
  })

  it('should return 403 when lacking permission', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'user-1' } })
    vi.mocked(checkPermission).mockResolvedValue(false)

    const request = new NextRequest('http://localhost/api/forwarders')
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(403)
    expect(data.success).toBe(false)
  })

  it('should return forwarders list with pagination', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'user-1' } })
    vi.mocked(checkPermission).mockResolvedValue(true)

    const mockForwarders = [
      {
        id: 'f1',
        name: 'DHL Express',
        code: 'DHL',
        description: 'Express delivery',
        status: 'ACTIVE',
        logoUrl: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        _count: { mappingRules: 5 },
        mappingRules: [{ id: 'r1' }, { id: 'r2' }],
        documents: [{ createdAt: new Date() }],
      },
    ]

    vi.mocked(prisma.forwarder.findMany).mockResolvedValue(mockForwarders)
    vi.mocked(prisma.forwarder.count).mockResolvedValue(1)
    vi.mocked(prisma.document.groupBy).mockResolvedValue([
      { forwarderId: 'f1', _count: 10 },
    ])

    const request = new NextRequest('http://localhost/api/forwarders')
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.data.forwarders).toHaveLength(1)
    expect(data.data.pagination.total).toBe(1)
  })

  it('should filter by status', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'user-1' } })
    vi.mocked(checkPermission).mockResolvedValue(true)
    vi.mocked(prisma.forwarder.findMany).mockResolvedValue([])
    vi.mocked(prisma.forwarder.count).mockResolvedValue(0)
    vi.mocked(prisma.document.groupBy).mockResolvedValue([])

    const request = new NextRequest(
      'http://localhost/api/forwarders?status=ACTIVE'
    )
    await GET(request)

    expect(prisma.forwarder.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: 'ACTIVE' }),
      })
    )
  })

  it('should search by name or code', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'user-1' } })
    vi.mocked(checkPermission).mockResolvedValue(true)
    vi.mocked(prisma.forwarder.findMany).mockResolvedValue([])
    vi.mocked(prisma.forwarder.count).mockResolvedValue(0)
    vi.mocked(prisma.document.groupBy).mockResolvedValue([])

    const request = new NextRequest(
      'http://localhost/api/forwarders?search=dhl'
    )
    await GET(request)

    expect(prisma.forwarder.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            expect.objectContaining({ name: expect.any(Object) }),
            expect.objectContaining({ code: expect.any(Object) }),
          ]),
        }),
      })
    )
  })
})
```

### 3.2 Component Tests

```typescript
// src/components/forwarders/__tests__/ForwarderTable.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ForwarderTable } from '../ForwarderTable'
import { useForwarders } from '@/hooks/use-forwarders'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

vi.mock('@/hooks/use-forwarders')
vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
}))

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
})

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
)

describe('ForwarderTable', () => {
  it('should render loading skeleton', () => {
    vi.mocked(useForwarders).mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
      refetch: vi.fn(),
    } as any)

    render(<ForwarderTable />, { wrapper })

    // Skeleton should be visible
    expect(document.querySelector('.animate-pulse')).toBeInTheDocument()
  })

  it('should render error state', () => {
    vi.mocked(useForwarders).mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('Test error'),
      refetch: vi.fn(),
    } as any)

    render(<ForwarderTable />, { wrapper })

    expect(screen.getByText('載入失敗')).toBeInTheDocument()
  })

  it('should render empty state', () => {
    vi.mocked(useForwarders).mockReturnValue({
      data: { forwarders: [], pagination: { total: 0, page: 1, limit: 20, totalPages: 0 } },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as any)

    render(<ForwarderTable />, { wrapper })

    expect(screen.getByText('尚無 Forwarder')).toBeInTheDocument()
  })

  it('should render forwarders list', () => {
    vi.mocked(useForwarders).mockReturnValue({
      data: {
        forwarders: [
          {
            id: 'f1',
            name: 'DHL Express',
            code: 'DHL',
            description: 'Express delivery',
            status: 'ACTIVE',
            logoUrl: null,
            ruleCount: 5,
            activeRuleCount: 3,
            documentCount: 100,
            lastDocumentAt: new Date().toISOString(),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
        pagination: { total: 1, page: 1, limit: 20, totalPages: 1 },
      },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as any)

    render(<ForwarderTable />, { wrapper })

    expect(screen.getByText('DHL Express')).toBeInTheDocument()
    expect(screen.getByText('DHL')).toBeInTheDocument()
    expect(screen.getByText('啟用')).toBeInTheDocument()
  })
})
```

---

## 4. Implementation Checklist

### Phase 1: Data Layer
- [ ] 確認 Forwarder Prisma schema 已存在
- [ ] 建立 TypeScript types (`src/types/forwarder.ts`)
- [ ] 執行 Prisma migration（如需要）

### Phase 2: API Layer
- [ ] 實作 GET `/api/forwarders` endpoint
- [ ] 實作篩選、搜索、排序邏輯
- [ ] 實作分頁邏輯
- [ ] 撰寫 API 測試

### Phase 3: UI Layer
- [ ] 建立 ForwardersPage (`src/app/(dashboard)/forwarders/page.tsx`)
- [ ] 建立 ForwarderFilters 組件
- [ ] 建立 ForwarderTable 組件
- [ ] 建立 ForwarderTableSkeleton 組件
- [ ] 建立 SortableHeader 組件
- [ ] 實作 useForwarders Hook
- [ ] 撰寫組件測試

### Phase 4: Integration
- [ ] 整合權限檢查
- [ ] 端對端測試驗證完整流程

---

## 5. Dependencies

### 5.1 Internal Dependencies
- **Story 1.2**: 角色權限基礎（FORWARDER_VIEW, FORWARDER_MANAGE）
- **Authentication**: NextAuth session

### 5.2 External Libraries
- `@tanstack/react-query` - 資料獲取與快取
- `use-debounce` - 搜索防抖
- `date-fns` - 日期格式化
- `zod` - 請求驗證

---

## 6. Security Considerations

### 6.1 Authentication & Authorization
- 所有 API 需要 NextAuth session
- 列表查看需要 `FORWARDER_VIEW` 權限
- 新增按鈕僅對有 `FORWARDER_MANAGE` 權限的用戶顯示

### 6.2 Data Validation
- 所有查詢參數使用 Zod schema 驗證
- 搜索輸入限制最大長度 100 字符
- 分頁限制每頁最多 100 筆

---

## 7. Performance Considerations

### 7.1 Database Optimization
- `status`, `name`, `code`, `updatedAt` 欄位建立索引
- 使用 `_count` 避免額外查詢
- 文件數量使用 `groupBy` 批量查詢

### 7.2 Frontend Optimization
- React Query 快取 30 秒
- 搜索防抖 300ms
- Skeleton loading 改善 UX
- URL 狀態同步支援 bookmarking 和分享

---

## 8. References

- [Story 5-1 定義](../stories/5-1-forwarder-profile-list.md)
- [Epic 5 概覽](../../03-epics/sections/epic-5-forwarder-config-management.md)
