# Story 5.1: Forwarder Profile 列表

**Status:** ready-for-dev

---

## Story

**As a** Super User,
**I want** 查看所有 Forwarder Profile 列表,
**So that** 我可以管理不同 Forwarder 的配置。

---

## Acceptance Criteria

### AC1: 列表顯示

**Given** Super User 已登入
**When** 導航至「Forwarder 管理」頁面
**Then** 顯示所有 Forwarder Profile 列表
**And** 包含：名稱、代碼、狀態、規則數量、最後更新時間

### AC2: 列表篩選與搜索

**Given** Forwarder 列表頁面
**When** 使用篩選功能
**Then** 可按狀態（啟用/停用）篩選
**And** 可按名稱或代碼搜索
**And** 支援分頁瀏覽

### AC3: 列表排序

**Given** Forwarder 列表頁面
**When** 點擊欄位標題
**Then** 可按該欄位升序或降序排列
**And** 預設按最後更新時間降序

---

## Tasks / Subtasks

- [ ] **Task 1: Forwarder 管理頁面** (AC: #1)
  - [ ] 1.1 創建 `src/app/(dashboard)/forwarders/page.tsx`
  - [ ] 1.2 設計頁面佈局（標題、操作區、列表區）
  - [ ] 1.3 實現響應式設計
  - [ ] 1.4 加入麵包屑導航

- [ ] **Task 2: Forwarder 列表表格** (AC: #1)
  - [ ] 2.1 創建 `ForwarderTable.tsx` 組件
  - [ ] 2.2 顯示名稱欄位（連結到詳情）
  - [ ] 2.3 顯示代碼欄位（唯一識別碼）
  - [ ] 2.4 顯示狀態 Badge（ACTIVE/INACTIVE）
  - [ ] 2.5 顯示規則數量統計
  - [ ] 2.6 顯示最後更新時間（相對時間格式）

- [ ] **Task 3: 篩選功能** (AC: #2)
  - [ ] 3.1 創建 `ForwarderFilters.tsx` 組件
  - [ ] 3.2 狀態下拉選單篩選
  - [ ] 3.3 名稱/代碼搜索輸入框
  - [ ] 3.4 搜索防抖處理（300ms）
  - [ ] 3.5 篩選條件 URL 同步

- [ ] **Task 4: 分頁功能** (AC: #2)
  - [ ] 4.1 創建分頁組件
  - [ ] 4.2 顯示總數和當前頁
  - [ ] 4.3 每頁數量選擇（10/20/50）
  - [ ] 4.4 快速跳頁功能

- [ ] **Task 5: 排序功能** (AC: #3)
  - [ ] 5.1 可點擊欄位標題排序
  - [ ] 5.2 顯示排序方向指示器
  - [ ] 5.3 支援多欄位排序優先級
  - [ ] 5.4 預設排序設定

- [ ] **Task 6: Forwarder 列表 API** (AC: #1, #2, #3)
  - [ ] 6.1 創建 GET `/api/forwarders`
  - [ ] 6.2 實現篩選參數處理
  - [ ] 6.3 實現分頁邏輯
  - [ ] 6.4 實現排序邏輯
  - [ ] 6.5 關聯查詢規則數量

- [ ] **Task 7: 數據獲取與狀態管理** (AC: #1)
  - [ ] 7.1 使用 React Query 獲取數據
  - [ ] 7.2 實現加載狀態顯示
  - [ ] 7.3 實現錯誤處理
  - [ ] 7.4 實現空狀態顯示

- [ ] **Task 8: 權限控制** (AC: #1)
  - [ ] 8.1 僅 Super User 和系統管理員可訪問
  - [ ] 8.2 驗證 FORWARDER_VIEW 權限
  - [ ] 8.3 無權限時重導向

- [ ] **Task 9: 驗證與測試** (AC: #1-3)
  - [ ] 9.1 測試列表顯示正確性
  - [ ] 9.2 測試篩選功能
  - [ ] 9.3 測試分頁功能
  - [ ] 9.4 測試排序功能
  - [ ] 9.5 測試權限控制

---

## Dev Notes

### 依賴項

- **Story 1.2**: 角色權限基礎
- **Story 1.0**: 專案初始化（shadcn/ui 組件）

### Architecture Compliance

```prisma
model Forwarder {
  id            String   @id @default(uuid())
  name          String   @unique
  code          String   @unique
  description   String?
  status        ForwarderStatus @default(ACTIVE)
  logoUrl       String?  @map("logo_url")
  contactEmail  String?  @map("contact_email")
  defaultConfidence Float @default(0.8) @map("default_confidence")
  createdAt     DateTime @default(now()) @map("created_at")
  updatedAt     DateTime @updatedAt @map("updated_at")
  createdBy     String   @map("created_by")

  creator       User     @relation(fields: [createdBy], references: [id])
  mappingRules  MappingRule[]
  documents     Document[]
  ruleSuggestions RuleSuggestion[]
  correctionPatterns CorrectionPattern[]

  @@index([status])
  @@index([name])
  @@map("forwarders")
}

enum ForwarderStatus {
  ACTIVE      // 啟用中
  INACTIVE    // 已停用
  PENDING     // 待設定
}
```

```typescript
// GET /api/forwarders
interface ForwardersQueryParams {
  status?: ForwarderStatus
  search?: string           // 名稱或代碼搜索
  page?: number            // 默認 1
  limit?: number           // 默認 20
  sortBy?: 'name' | 'code' | 'updatedAt' | 'ruleCount'
  sortOrder?: 'asc' | 'desc'
}

interface ForwardersResponse {
  success: true
  data: {
    forwarders: {
      id: string
      name: string
      code: string
      description: string | null
      status: ForwarderStatus
      logoUrl: string | null
      ruleCount: number          // 關聯的映射規則數量
      activeRuleCount: number    // 活躍規則數量
      documentCount: number      // 處理的文件數量（30天內）
      lastDocumentAt: string | null  // 最後處理文件時間
      createdAt: string
      updatedAt: string
    }[]
    pagination: {
      total: number
      page: number
      limit: number
      totalPages: number
    }
  }
}
```

```typescript
// src/app/api/forwarders/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PERMISSIONS, hasPermission } from '@/lib/permissions'

export async function GET(request: NextRequest) {
  const session = await auth()

  // 權限檢查
  if (!hasPermission(session, PERMISSIONS.FORWARDER_VIEW)) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 403 }
    )
  }

  const searchParams = request.nextUrl.searchParams
  const status = searchParams.get('status') as ForwarderStatus | null
  const search = searchParams.get('search')
  const page = parseInt(searchParams.get('page') || '1')
  const limit = parseInt(searchParams.get('limit') || '20')
  const sortBy = searchParams.get('sortBy') || 'updatedAt'
  const sortOrder = searchParams.get('sortOrder') || 'desc'

  // 構建查詢條件
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

  // 執行查詢
  const [forwarders, total] = await Promise.all([
    prisma.forwarder.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { [sortBy]: sortOrder },
      include: {
        _count: {
          select: {
            mappingRules: true,
            documents: {
              where: {
                createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
              },
            },
          },
        },
        mappingRules: {
          where: { status: 'ACTIVE' },
          select: { id: true },
        },
        documents: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { createdAt: true },
        },
      },
    }),
    prisma.forwarder.count({ where }),
  ])

  // 格式化響應
  const formattedForwarders = forwarders.map(f => ({
    id: f.id,
    name: f.name,
    code: f.code,
    description: f.description,
    status: f.status,
    logoUrl: f.logoUrl,
    ruleCount: f._count.mappingRules,
    activeRuleCount: f.mappingRules.length,
    documentCount: f._count.documents,
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
}
```

```typescript
// src/app/(dashboard)/forwarders/page.tsx
import { Suspense } from 'react'
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { hasPermission, PERMISSIONS } from '@/lib/permissions'
import { ForwarderTable } from '@/components/forwarders/ForwarderTable'
import { ForwarderFilters } from '@/components/forwarders/ForwarderFilters'
import { ForwarderTableSkeleton } from '@/components/forwarders/ForwarderTableSkeleton'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import Link from 'next/link'

export default async function ForwardersPage() {
  const session = await auth()

  if (!hasPermission(session, PERMISSIONS.FORWARDER_VIEW)) {
    redirect('/unauthorized')
  }

  const canCreate = hasPermission(session, PERMISSIONS.FORWARDER_MANAGE)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Forwarder 管理</h1>
          <p className="text-muted-foreground">
            管理貨運代理商配置和映射規則
          </p>
        </div>
        {canCreate && (
          <Button asChild>
            <Link href="/forwarders/new">
              <Plus className="mr-2 h-4 w-4" />
              新增 Forwarder
            </Link>
          </Button>
        )}
      </div>

      <ForwarderFilters />

      <Suspense fallback={<ForwarderTableSkeleton />}>
        <ForwarderTable />
      </Suspense>
    </div>
  )
}
```

### UI 組件設計

```typescript
// src/components/forwarders/ForwarderTable.tsx
'use client'

import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'next/navigation'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { formatDistanceToNow } from 'date-fns'
import { zhTW } from 'date-fns/locale'
import Link from 'next/link'

export function ForwarderTable() {
  const searchParams = useSearchParams()

  const { data, isLoading, error } = useQuery({
    queryKey: ['forwarders', searchParams.toString()],
    queryFn: () => fetchForwarders(searchParams),
  })

  if (isLoading) return <ForwarderTableSkeleton />
  if (error) return <ErrorState error={error} />
  if (!data?.forwarders.length) return <EmptyState />

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[200px]">
              <SortableHeader field="name">名稱</SortableHeader>
            </TableHead>
            <TableHead className="w-[120px]">代碼</TableHead>
            <TableHead className="w-[100px]">狀態</TableHead>
            <TableHead className="w-[100px] text-right">規則數量</TableHead>
            <TableHead className="w-[150px]">
              <SortableHeader field="updatedAt">最後更新</SortableHeader>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.forwarders.map((forwarder) => (
            <TableRow key={forwarder.id}>
              <TableCell>
                <Link
                  href={`/forwarders/${forwarder.id}`}
                  className="font-medium hover:underline"
                >
                  {forwarder.name}
                </Link>
              </TableCell>
              <TableCell>
                <code className="rounded bg-muted px-2 py-1 text-sm">
                  {forwarder.code}
                </code>
              </TableCell>
              <TableCell>
                <Badge
                  variant={forwarder.status === 'ACTIVE' ? 'default' : 'secondary'}
                >
                  {forwarder.status === 'ACTIVE' ? '啟用' : '停用'}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                <span className="font-medium">{forwarder.activeRuleCount}</span>
                <span className="text-muted-foreground"> / {forwarder.ruleCount}</span>
              </TableCell>
              <TableCell className="text-muted-foreground">
                {formatDistanceToNow(new Date(forwarder.updatedAt), {
                  addSuffix: true,
                  locale: zhTW,
                })}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Pagination pagination={data.pagination} />
    </div>
  )
}
```

### References

- [Source: docs/03-epics/sections/epic-5-forwarder-config-management.md#story-51]
- [Source: docs/01-planning/prd/sections/functional-requirements.md#FR25]

---

## Story Metadata

| 屬性 | 值 |
|------|------|
| Story ID | 5.1 |
| Story Key | 5-1-forwarder-profile-list |
| Epic | Epic 5: Forwarder 配置管理 |
| FR Coverage | FR25 |
| Dependencies | Story 1.0, Story 1.2 |

---

*Story created: 2025-12-16*
*Status: ready-for-dev*
