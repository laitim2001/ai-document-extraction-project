# Tech Spec: Story 5-2 - Forwarder 詳細配置查看

## Story Reference
- **Story ID**: 5.2
- **Epic**: Epic 5 - Forwarder 配置管理
- **Story File**: `docs/04-implementation/stories/5-2-forwarder-detail-config-view.md`
- **Status**: ready-for-dev
- **Dependencies**: Story 5.1 (Forwarder 列表)

---

## 1. Overview

### 1.1 Purpose
實現 Forwarder 詳細配置頁面，讓 Super User 能夠查看單個 Forwarder 的完整資訊，包括基本設定、關聯的映射規則、處理統計數據以及最近處理的發票範例。

### 1.2 User Story
**As a** Super User,
**I want** 查看單個 Forwarder 的詳細配置,
**So that** 我可以了解該 Forwarder 的所有設定。

### 1.3 Scope
- 基本資訊顯示（名稱、代碼、描述、狀態、Logo、聯絡資訊）
- 關聯映射規則列表與篩選
- 處理統計數據與視覺化圖表
- 最近處理發票列表
- 標籤頁式導航架構

---

## 2. Technical Architecture

### 2.1 System Context

```
┌─────────────────────────────────────────────────────────────────┐
│                    Forwarder Detail Page                        │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    Page Header                           │   │
│  │  [Logo] Forwarder Name                [Actions Dropdown] │   │
│  │         Code: FWD-001                                    │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  [總覽] [映射規則] [處理統計] [最近發票]                  │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    Tab Content Area                       │   │
│  │                                                           │   │
│  │  Overview Tab:                                            │   │
│  │  - ForwarderInfo (basic info)                             │   │
│  │  - ForwarderStats (compact)                               │   │
│  │  - RecentDocuments (limit 5)                              │   │
│  │                                                           │   │
│  │  Rules Tab:                                               │   │
│  │  - ForwarderRules (full table with filters)               │   │
│  │                                                           │   │
│  │  Stats Tab:                                               │   │
│  │  - ForwarderStats (full charts)                           │   │
│  │                                                           │   │
│  │  Documents Tab:                                           │   │
│  │  - RecentDocuments (full list)                            │   │
│  │                                                           │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 API Architecture

```
GET /api/forwarders/[id]          → Forwarder 詳情（含摘要數據）
GET /api/forwarders/[id]/rules    → 關聯規則列表（分頁/篩選）
GET /api/forwarders/[id]/stats    → 統計數據（含趨勢）
GET /api/forwarders/[id]/documents → 最近文件列表
```

### 2.3 Component Architecture

```
ForwarderDetailPage (Server Component)
├── PageHeader
│   ├── Logo/Avatar
│   ├── Title & Code
│   └── ForwarderActions (Client - Edit/Deactivate)
├── Tabs (Client Component)
│   ├── TabsList
│   │   ├── TabsTrigger: "總覽"
│   │   ├── TabsTrigger: "映射規則"
│   │   ├── TabsTrigger: "處理統計"
│   │   └── TabsTrigger: "最近發票"
│   └── TabsContent
│       ├── OverviewTab
│       │   ├── ForwarderInfo
│       │   ├── ForwarderStats (compact)
│       │   └── RecentDocuments (limit 5)
│       ├── RulesTab
│       │   └── ForwarderRules
│       ├── StatsTab
│       │   └── ForwarderStats (full)
│       └── DocumentsTab
│           └── RecentDocuments (full)
```

---

## 3. Database Schema Reference

### 3.1 Forwarder Model (已存在)

```prisma
model Forwarder {
  id               String          @id @default(uuid())
  name             String          @unique
  code             String          @unique
  description      String?
  status           ForwarderStatus @default(ACTIVE)
  logoUrl          String?         @map("logo_url")
  contactEmail     String?         @map("contact_email")
  defaultConfidence Float          @default(0.8) @map("default_confidence")
  createdAt        DateTime        @default(now()) @map("created_at")
  updatedAt        DateTime        @updatedAt @map("updated_at")
  createdById      String          @map("created_by_id")

  // Relations
  createdBy        User            @relation(fields: [createdById], references: [id])
  mappingRules     MappingRule[]
  documents        Document[]

  @@map("forwarders")
}

enum ForwarderStatus {
  ACTIVE    // 啟用中
  INACTIVE  // 已停用
  PENDING   // 待設定
}
```

### 3.2 MappingRule Model (已存在)

```prisma
model MappingRule {
  id               String         @id @default(uuid())
  forwarderId      String         @map("forwarder_id")
  fieldName        String         @map("field_name")
  extractionType   ExtractionType @map("extraction_type")
  pattern          Json?
  confidence       Float          @default(0.8)
  status           RuleStatus     @default(DRAFT)
  version          Int            @default(1)
  createdAt        DateTime       @default(now()) @map("created_at")
  updatedAt        DateTime       @updatedAt @map("updated_at")
  createdById      String         @map("created_by_id")

  // Relations
  forwarder        Forwarder      @relation(fields: [forwarderId], references: [id])
  createdBy        User           @relation(fields: [createdById], references: [id])
  results          ExtractionResult[]
  versions         RuleVersion[]

  @@unique([forwarderId, fieldName])
  @@map("mapping_rules")
}

enum ExtractionType {
  REGEX           // 正則表達式
  POSITION        // 位置座標
  KEYWORD         // 關鍵字搜尋
  TABLE           // 表格提取
  AI_ASSISTED     // AI 輔助
}

enum RuleStatus {
  DRAFT           // 草稿
  ACTIVE          // 啟用
  DEPRECATED      // 已棄用
}
```

### 3.3 Document Model (已存在)

```prisma
model Document {
  id               String         @id @default(uuid())
  fileName         String         @map("file_name")
  fileUrl          String         @map("file_url")
  thumbnailUrl     String?        @map("thumbnail_url")
  status           DocumentStatus @default(PENDING)
  forwarderId      String?        @map("forwarder_id")
  confidence       Float?
  processedAt      DateTime?      @map("processed_at")
  processingTime   Int?           @map("processing_time") // 毫秒
  createdAt        DateTime       @default(now()) @map("created_at")
  createdById      String         @map("created_by_id")

  // Relations
  forwarder        Forwarder?     @relation(fields: [forwarderId], references: [id])
  createdBy        User           @relation(fields: [createdById], references: [id])
  extractionResults ExtractionResult[]

  @@map("documents")
}

enum DocumentStatus {
  PENDING         // 待處理
  PROCESSING      // 處理中
  COMPLETED       // 已完成
  FAILED          // 失敗
}
```

### 3.4 ExtractionResult Model (統計用)

```prisma
model ExtractionResult {
  id               String         @id @default(uuid())
  documentId       String         @map("document_id")
  ruleId           String         @map("rule_id")
  fieldName        String         @map("field_name")
  extractedValue   String?        @map("extracted_value")
  confidence       Float
  status           ResultStatus   @default(PENDING)
  correctedValue   String?        @map("corrected_value")
  correctedAt      DateTime?      @map("corrected_at")
  correctedById    String?        @map("corrected_by_id")
  createdAt        DateTime       @default(now()) @map("created_at")

  // Relations
  document         Document       @relation(fields: [documentId], references: [id])
  rule             MappingRule    @relation(fields: [ruleId], references: [id])

  @@map("extraction_results")
}

enum ResultStatus {
  PENDING         // 待確認
  CONFIRMED       // 已確認
  CORRECTED       // 已修正
  REJECTED        // 已拒絕
}
```

---

## 4. API Implementation

### 4.1 GET /api/forwarders/[id]

**Purpose**: 取得 Forwarder 詳細資訊與摘要數據

**File**: `src/app/api/forwarders/[id]/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { hasPermission, PERMISSIONS } from '@/lib/permissions'
import { prisma } from '@/lib/prisma'
import { ForwarderStatus, RuleStatus, DocumentStatus } from '@prisma/client'

// Response Types
interface ForwarderDetailResponse {
  success: true
  data: {
    id: string
    name: string
    code: string
    description: string | null
    status: ForwarderStatus
    logoUrl: string | null
    contactEmail: string | null
    defaultConfidence: number
    createdAt: string
    updatedAt: string
    createdBy: {
      id: string
      name: string
    }
    rules: {
      total: number
      active: number
      draft: number
      deprecated: number
    }
    stats: {
      totalProcessed: number
      last30Days: number
      successRate: number
      averageConfidence: number
    }
    recentDocuments: {
      id: string
      fileName: string
      status: DocumentStatus
      confidence: number | null
      createdAt: string
      thumbnailUrl: string | null
    }[]
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 1. Authentication & Authorization
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/unauthorized',
          title: 'Unauthorized',
          status: 401,
          detail: '請先登入'
        },
        { status: 401 }
      )
    }

    if (!hasPermission(session, PERMISSIONS.FORWARDER_VIEW)) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/forbidden',
          title: 'Forbidden',
          status: 403,
          detail: '您沒有查看 Forwarder 的權限'
        },
        { status: 403 }
      )
    }

    const { id } = params

    // 2. Validate UUID format
    const uuidSchema = z.string().uuid()
    const parseResult = uuidSchema.safeParse(id)
    if (!parseResult.success) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/validation',
          title: 'Validation Error',
          status: 400,
          detail: '無效的 Forwarder ID 格式'
        },
        { status: 400 }
      )
    }

    // 3. Get Forwarder with relations
    const forwarder = await prisma.forwarder.findUnique({
      where: { id },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true
          }
        },
        mappingRules: {
          select: {
            status: true
          }
        }
      }
    })

    if (!forwarder) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/not-found',
          title: 'Not Found',
          status: 404,
          detail: '找不到指定的 Forwarder'
        },
        { status: 404 }
      )
    }

    // 4. Calculate rules summary
    const rulesSummary = {
      total: forwarder.mappingRules.length,
      active: forwarder.mappingRules.filter(r => r.status === RuleStatus.ACTIVE).length,
      draft: forwarder.mappingRules.filter(r => r.status === RuleStatus.DRAFT).length,
      deprecated: forwarder.mappingRules.filter(r => r.status === RuleStatus.DEPRECATED).length
    }

    // 5. Calculate processing statistics
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const [totalStats, last30DaysStats] = await Promise.all([
      // Total processed documents
      prisma.document.aggregate({
        where: {
          forwarderId: id,
          status: { in: [DocumentStatus.COMPLETED, DocumentStatus.FAILED] }
        },
        _count: { id: true },
        _avg: { confidence: true }
      }),
      // Last 30 days
      prisma.document.aggregate({
        where: {
          forwarderId: id,
          status: { in: [DocumentStatus.COMPLETED, DocumentStatus.FAILED] },
          createdAt: { gte: thirtyDaysAgo }
        },
        _count: { id: true }
      })
    ])

    // Success rate calculation
    const successfulDocs = await prisma.document.count({
      where: {
        forwarderId: id,
        status: DocumentStatus.COMPLETED
      }
    })

    const successRate = totalStats._count.id > 0
      ? successfulDocs / totalStats._count.id
      : 0

    // 6. Get recent documents
    const recentDocuments = await prisma.document.findMany({
      where: { forwarderId: id },
      select: {
        id: true,
        fileName: true,
        status: true,
        confidence: true,
        createdAt: true,
        thumbnailUrl: true
      },
      orderBy: { createdAt: 'desc' },
      take: 10
    })

    // 7. Build response
    const response: ForwarderDetailResponse = {
      success: true,
      data: {
        id: forwarder.id,
        name: forwarder.name,
        code: forwarder.code,
        description: forwarder.description,
        status: forwarder.status,
        logoUrl: forwarder.logoUrl,
        contactEmail: forwarder.contactEmail,
        defaultConfidence: forwarder.defaultConfidence,
        createdAt: forwarder.createdAt.toISOString(),
        updatedAt: forwarder.updatedAt.toISOString(),
        createdBy: forwarder.createdBy,
        rules: rulesSummary,
        stats: {
          totalProcessed: totalStats._count.id,
          last30Days: last30DaysStats._count.id,
          successRate,
          averageConfidence: totalStats._avg.confidence ?? 0
        },
        recentDocuments: recentDocuments.map(doc => ({
          ...doc,
          createdAt: doc.createdAt.toISOString()
        }))
      }
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Error fetching forwarder detail:', error)
    return NextResponse.json(
      {
        type: 'https://api.example.com/errors/internal',
        title: 'Internal Server Error',
        status: 500,
        detail: '取得 Forwarder 詳情時發生錯誤'
      },
      { status: 500 }
    )
  }
}
```

### 4.2 GET /api/forwarders/[id]/rules

**Purpose**: 取得 Forwarder 關聯的映射規則列表

**File**: `src/app/api/forwarders/[id]/rules/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { hasPermission, PERMISSIONS } from '@/lib/permissions'
import { prisma } from '@/lib/prisma'
import { RuleStatus, ExtractionType } from '@prisma/client'

// Query Params Schema
const querySchema = z.object({
  fieldName: z.string().optional(),
  status: z.nativeEnum(RuleStatus).optional(),
  extractionType: z.nativeEnum(ExtractionType).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(10).max(100).default(20),
  sortBy: z.enum(['fieldName', 'status', 'version', 'updatedAt', 'successRate']).default('updatedAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc')
})

interface RuleWithStats {
  id: string
  fieldName: string
  extractionType: ExtractionType
  status: RuleStatus
  version: number
  confidence: number
  updatedAt: string
  successRate: number
  applicationCount: number
}

interface ForwarderRulesResponse {
  success: true
  data: {
    items: RuleWithStats[]
    pagination: {
      page: number
      pageSize: number
      totalItems: number
      totalPages: number
    }
    summary: {
      total: number
      active: number
      draft: number
      deprecated: number
    }
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 1. Authentication & Authorization
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/unauthorized',
          title: 'Unauthorized',
          status: 401,
          detail: '請先登入'
        },
        { status: 401 }
      )
    }

    if (!hasPermission(session, PERMISSIONS.FORWARDER_VIEW)) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/forbidden',
          title: 'Forbidden',
          status: 403,
          detail: '您沒有查看 Forwarder 的權限'
        },
        { status: 403 }
      )
    }

    const { id } = params

    // 2. Validate UUID
    const uuidSchema = z.string().uuid()
    if (!uuidSchema.safeParse(id).success) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/validation',
          title: 'Validation Error',
          status: 400,
          detail: '無效的 Forwarder ID 格式'
        },
        { status: 400 }
      )
    }

    // 3. Check forwarder exists
    const forwarderExists = await prisma.forwarder.findUnique({
      where: { id },
      select: { id: true }
    })

    if (!forwarderExists) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/not-found',
          title: 'Not Found',
          status: 404,
          detail: '找不到指定的 Forwarder'
        },
        { status: 404 }
      )
    }

    // 4. Parse query params
    const { searchParams } = new URL(request.url)
    const queryParseResult = querySchema.safeParse({
      fieldName: searchParams.get('fieldName') || undefined,
      status: searchParams.get('status') || undefined,
      extractionType: searchParams.get('extractionType') || undefined,
      page: searchParams.get('page') || 1,
      pageSize: searchParams.get('pageSize') || 20,
      sortBy: searchParams.get('sortBy') || 'updatedAt',
      sortOrder: searchParams.get('sortOrder') || 'desc'
    })

    if (!queryParseResult.success) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/validation',
          title: 'Validation Error',
          status: 400,
          detail: '無效的查詢參數',
          errors: queryParseResult.error.flatten().fieldErrors
        },
        { status: 400 }
      )
    }

    const { fieldName, status, extractionType, page, pageSize, sortBy, sortOrder } = queryParseResult.data

    // 5. Build where clause
    const where = {
      forwarderId: id,
      ...(fieldName && { fieldName: { contains: fieldName, mode: 'insensitive' as const } }),
      ...(status && { status }),
      ...(extractionType && { extractionType })
    }

    // 6. Get total count and rules
    const [totalItems, rules, summary] = await Promise.all([
      prisma.mappingRule.count({ where }),
      prisma.mappingRule.findMany({
        where,
        select: {
          id: true,
          fieldName: true,
          extractionType: true,
          status: true,
          version: true,
          confidence: true,
          updatedAt: true,
          _count: {
            select: { results: true }
          }
        },
        orderBy: sortBy === 'successRate'
          ? { updatedAt: sortOrder } // Fallback, calculate later
          : { [sortBy]: sortOrder },
        skip: (page - 1) * pageSize,
        take: pageSize
      }),
      // Summary counts
      prisma.mappingRule.groupBy({
        by: ['status'],
        where: { forwarderId: id },
        _count: { id: true }
      })
    ])

    // 7. Calculate success rate for each rule
    const rulesWithStats = await Promise.all(
      rules.map(async (rule) => {
        const [total, successful] = await Promise.all([
          prisma.extractionResult.count({
            where: { ruleId: rule.id }
          }),
          prisma.extractionResult.count({
            where: {
              ruleId: rule.id,
              status: { in: ['CONFIRMED', 'CORRECTED'] }
            }
          })
        ])

        return {
          id: rule.id,
          fieldName: rule.fieldName,
          extractionType: rule.extractionType,
          status: rule.status,
          version: rule.version,
          confidence: rule.confidence,
          updatedAt: rule.updatedAt.toISOString(),
          successRate: total > 0 ? successful / total : 0,
          applicationCount: rule._count.results
        }
      })
    )

    // Sort by successRate if needed
    if (sortBy === 'successRate') {
      rulesWithStats.sort((a, b) =>
        sortOrder === 'desc'
          ? b.successRate - a.successRate
          : a.successRate - b.successRate
      )
    }

    // 8. Build summary
    const summaryMap = summary.reduce((acc, item) => {
      acc[item.status.toLowerCase()] = item._count.id
      return acc
    }, {} as Record<string, number>)

    const response: ForwarderRulesResponse = {
      success: true,
      data: {
        items: rulesWithStats,
        pagination: {
          page,
          pageSize,
          totalItems,
          totalPages: Math.ceil(totalItems / pageSize)
        },
        summary: {
          total: totalItems,
          active: summaryMap.active || 0,
          draft: summaryMap.draft || 0,
          deprecated: summaryMap.deprecated || 0
        }
      }
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Error fetching forwarder rules:', error)
    return NextResponse.json(
      {
        type: 'https://api.example.com/errors/internal',
        title: 'Internal Server Error',
        status: 500,
        detail: '取得規則列表時發生錯誤'
      },
      { status: 500 }
    )
  }
}
```

### 4.3 GET /api/forwarders/[id]/stats

**Purpose**: 取得 Forwarder 的詳細統計數據與趨勢

**File**: `src/app/api/forwarders/[id]/stats/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { hasPermission, PERMISSIONS } from '@/lib/permissions'
import { prisma } from '@/lib/prisma'
import { DocumentStatus, ResultStatus } from '@prisma/client'

// Query Params Schema
const querySchema = z.object({
  period: z.enum(['7d', '30d', '90d', '1y']).default('30d')
})

interface ForwarderStatsResponse {
  success: true
  data: {
    overview: {
      totalProcessed: number
      successfulExtractions: number
      failedExtractions: number
      successRate: number
      averageConfidence: number
      averageProcessingTime: number
    }
    trend: {
      date: string
      processed: number
      successful: number
      averageConfidence: number
    }[]
    fieldStats: {
      fieldName: string
      totalExtractions: number
      successRate: number
      averageConfidence: number
      correctionRate: number
    }[]
    confidenceDistribution: {
      range: string
      count: number
      percentage: number
    }[]
  }
}

// Helper function to get date range
function getDateRange(period: string): Date {
  const now = new Date()
  switch (period) {
    case '7d':
      return new Date(now.setDate(now.getDate() - 7))
    case '30d':
      return new Date(now.setDate(now.getDate() - 30))
    case '90d':
      return new Date(now.setDate(now.getDate() - 90))
    case '1y':
      return new Date(now.setFullYear(now.getFullYear() - 1))
    default:
      return new Date(now.setDate(now.getDate() - 30))
  }
}

// Helper function to format date for grouping
function formatDateKey(date: Date): string {
  return date.toISOString().split('T')[0]
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 1. Authentication & Authorization
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/unauthorized',
          title: 'Unauthorized',
          status: 401,
          detail: '請先登入'
        },
        { status: 401 }
      )
    }

    if (!hasPermission(session, PERMISSIONS.FORWARDER_VIEW)) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/forbidden',
          title: 'Forbidden',
          status: 403,
          detail: '您沒有查看 Forwarder 的權限'
        },
        { status: 403 }
      )
    }

    const { id } = params

    // 2. Validate UUID
    const uuidSchema = z.string().uuid()
    if (!uuidSchema.safeParse(id).success) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/validation',
          title: 'Validation Error',
          status: 400,
          detail: '無效的 Forwarder ID 格式'
        },
        { status: 400 }
      )
    }

    // 3. Check forwarder exists
    const forwarderExists = await prisma.forwarder.findUnique({
      where: { id },
      select: { id: true }
    })

    if (!forwarderExists) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/not-found',
          title: 'Not Found',
          status: 404,
          detail: '找不到指定的 Forwarder'
        },
        { status: 404 }
      )
    }

    // 4. Parse query params
    const { searchParams } = new URL(request.url)
    const { period } = querySchema.parse({
      period: searchParams.get('period') || '30d'
    })

    const startDate = getDateRange(period)

    // 5. Calculate overview statistics
    const [
      totalDocs,
      successfulDocs,
      avgStats,
      processingTimeStats
    ] = await Promise.all([
      // Total processed documents
      prisma.document.count({
        where: {
          forwarderId: id,
          status: { in: [DocumentStatus.COMPLETED, DocumentStatus.FAILED] },
          createdAt: { gte: startDate }
        }
      }),
      // Successful documents
      prisma.document.count({
        where: {
          forwarderId: id,
          status: DocumentStatus.COMPLETED,
          createdAt: { gte: startDate }
        }
      }),
      // Average confidence
      prisma.document.aggregate({
        where: {
          forwarderId: id,
          status: DocumentStatus.COMPLETED,
          createdAt: { gte: startDate }
        },
        _avg: { confidence: true }
      }),
      // Average processing time
      prisma.document.aggregate({
        where: {
          forwarderId: id,
          status: DocumentStatus.COMPLETED,
          createdAt: { gte: startDate },
          processingTime: { not: null }
        },
        _avg: { processingTime: true }
      })
    ])

    // 6. Get trend data using raw query for date grouping
    const trendData = await prisma.$queryRaw<
      { date: Date; processed: bigint; successful: bigint; avg_confidence: number }[]
    >`
      SELECT
        DATE(created_at) as date,
        COUNT(*) as processed,
        SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END) as successful,
        AVG(CASE WHEN confidence IS NOT NULL THEN confidence ELSE 0 END) as avg_confidence
      FROM documents
      WHERE forwarder_id = ${id}
        AND created_at >= ${startDate}
        AND status IN ('COMPLETED', 'FAILED')
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `

    const trend = trendData.map(row => ({
      date: formatDateKey(new Date(row.date)),
      processed: Number(row.processed),
      successful: Number(row.successful),
      averageConfidence: row.avg_confidence || 0
    }))

    // 7. Get field-level statistics
    const fieldStatsRaw = await prisma.$queryRaw<
      {
        field_name: string
        total: bigint
        confirmed: bigint
        corrected: bigint
        avg_confidence: number
      }[]
    >`
      SELECT
        er.field_name,
        COUNT(*) as total,
        SUM(CASE WHEN er.status = 'CONFIRMED' THEN 1 ELSE 0 END) as confirmed,
        SUM(CASE WHEN er.status = 'CORRECTED' THEN 1 ELSE 0 END) as corrected,
        AVG(er.confidence) as avg_confidence
      FROM extraction_results er
      JOIN documents d ON er.document_id = d.id
      WHERE d.forwarder_id = ${id}
        AND d.created_at >= ${startDate}
      GROUP BY er.field_name
      ORDER BY total DESC
    `

    const fieldStats = fieldStatsRaw.map(row => ({
      fieldName: row.field_name,
      totalExtractions: Number(row.total),
      successRate: Number(row.total) > 0
        ? (Number(row.confirmed) + Number(row.corrected)) / Number(row.total)
        : 0,
      averageConfidence: row.avg_confidence || 0,
      correctionRate: Number(row.total) > 0
        ? Number(row.corrected) / Number(row.total)
        : 0
    }))

    // 8. Calculate confidence distribution
    const confidenceRanges = [
      { min: 0.9, max: 1.0, label: '90-100%' },
      { min: 0.8, max: 0.9, label: '80-90%' },
      { min: 0.7, max: 0.8, label: '70-80%' },
      { min: 0.6, max: 0.7, label: '60-70%' },
      { min: 0, max: 0.6, label: '<60%' }
    ]

    const confidenceDistributionPromises = confidenceRanges.map(async range => {
      const count = await prisma.document.count({
        where: {
          forwarderId: id,
          status: DocumentStatus.COMPLETED,
          createdAt: { gte: startDate },
          confidence: {
            gte: range.min,
            lt: range.max === 1.0 ? 1.01 : range.max // Include 100%
          }
        }
      })
      return { range: range.label, count }
    })

    const confidenceDistributionRaw = await Promise.all(confidenceDistributionPromises)
    const totalWithConfidence = confidenceDistributionRaw.reduce((sum, item) => sum + item.count, 0)

    const confidenceDistribution = confidenceDistributionRaw.map(item => ({
      range: item.range,
      count: item.count,
      percentage: totalWithConfidence > 0 ? item.count / totalWithConfidence : 0
    }))

    // 9. Build response
    const response: ForwarderStatsResponse = {
      success: true,
      data: {
        overview: {
          totalProcessed: totalDocs,
          successfulExtractions: successfulDocs,
          failedExtractions: totalDocs - successfulDocs,
          successRate: totalDocs > 0 ? successfulDocs / totalDocs : 0,
          averageConfidence: avgStats._avg.confidence ?? 0,
          averageProcessingTime: processingTimeStats._avg.processingTime ?? 0
        },
        trend,
        fieldStats,
        confidenceDistribution
      }
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Error fetching forwarder stats:', error)
    return NextResponse.json(
      {
        type: 'https://api.example.com/errors/internal',
        title: 'Internal Server Error',
        status: 500,
        detail: '取得統計數據時發生錯誤'
      },
      { status: 500 }
    )
  }
}
```

### 4.4 GET /api/forwarders/[id]/documents

**Purpose**: 取得 Forwarder 最近處理的文件列表

**File**: `src/app/api/forwarders/[id]/documents/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { hasPermission, PERMISSIONS } from '@/lib/permissions'
import { prisma } from '@/lib/prisma'
import { DocumentStatus } from '@prisma/client'

// Query Params Schema
const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(5).max(50).default(10),
  status: z.nativeEnum(DocumentStatus).optional()
})

interface ForwarderDocumentsResponse {
  success: true
  data: {
    items: {
      id: string
      fileName: string
      status: DocumentStatus
      confidence: number | null
      thumbnailUrl: string | null
      processedAt: string | null
      createdAt: string
    }[]
    pagination: {
      page: number
      pageSize: number
      totalItems: number
      totalPages: number
    }
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 1. Authentication & Authorization
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/unauthorized',
          title: 'Unauthorized',
          status: 401,
          detail: '請先登入'
        },
        { status: 401 }
      )
    }

    if (!hasPermission(session, PERMISSIONS.FORWARDER_VIEW)) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/forbidden',
          title: 'Forbidden',
          status: 403,
          detail: '您沒有查看 Forwarder 的權限'
        },
        { status: 403 }
      )
    }

    const { id } = params

    // 2. Validate UUID
    const uuidSchema = z.string().uuid()
    if (!uuidSchema.safeParse(id).success) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/validation',
          title: 'Validation Error',
          status: 400,
          detail: '無效的 Forwarder ID 格式'
        },
        { status: 400 }
      )
    }

    // 3. Check forwarder exists
    const forwarderExists = await prisma.forwarder.findUnique({
      where: { id },
      select: { id: true }
    })

    if (!forwarderExists) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/not-found',
          title: 'Not Found',
          status: 404,
          detail: '找不到指定的 Forwarder'
        },
        { status: 404 }
      )
    }

    // 4. Parse query params
    const { searchParams } = new URL(request.url)
    const queryParseResult = querySchema.safeParse({
      page: searchParams.get('page') || 1,
      pageSize: searchParams.get('pageSize') || 10,
      status: searchParams.get('status') || undefined
    })

    if (!queryParseResult.success) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/validation',
          title: 'Validation Error',
          status: 400,
          detail: '無效的查詢參數',
          errors: queryParseResult.error.flatten().fieldErrors
        },
        { status: 400 }
      )
    }

    const { page, pageSize, status } = queryParseResult.data

    // 5. Build where clause
    const where = {
      forwarderId: id,
      ...(status && { status })
    }

    // 6. Get documents with pagination
    const [totalItems, documents] = await Promise.all([
      prisma.document.count({ where }),
      prisma.document.findMany({
        where,
        select: {
          id: true,
          fileName: true,
          status: true,
          confidence: true,
          thumbnailUrl: true,
          processedAt: true,
          createdAt: true
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize
      })
    ])

    // 7. Build response
    const response: ForwarderDocumentsResponse = {
      success: true,
      data: {
        items: documents.map(doc => ({
          ...doc,
          processedAt: doc.processedAt?.toISOString() ?? null,
          createdAt: doc.createdAt.toISOString()
        })),
        pagination: {
          page,
          pageSize,
          totalItems,
          totalPages: Math.ceil(totalItems / pageSize)
        }
      }
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Error fetching forwarder documents:', error)
    return NextResponse.json(
      {
        type: 'https://api.example.com/errors/internal',
        title: 'Internal Server Error',
        status: 500,
        detail: '取得文件列表時發生錯誤'
      },
      { status: 500 }
    )
  }
}
```

---

## 5. Frontend Components

### 5.1 Forwarder Detail Page

**File**: `src/app/(dashboard)/forwarders/[id]/page.tsx`

```typescript
import { Suspense } from 'react'
import { notFound, redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { hasPermission, PERMISSIONS } from '@/lib/permissions'
import { prisma } from '@/lib/prisma'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb'
import { ForwarderInfo } from '@/components/forwarders/ForwarderInfo'
import { ForwarderRules } from '@/components/forwarders/ForwarderRules'
import { ForwarderStats } from '@/components/forwarders/ForwarderStats'
import { RecentDocuments } from '@/components/forwarders/RecentDocuments'
import { ForwarderActions } from '@/components/forwarders/ForwarderActions'
import { ForwarderStatus } from '@prisma/client'

interface Props {
  params: { id: string }
}

// Server-side data fetching
async function getForwarder(id: string) {
  const forwarder = await prisma.forwarder.findUnique({
    where: { id },
    include: {
      createdBy: {
        select: {
          id: true,
          name: true
        }
      }
    }
  })
  return forwarder
}

// Status badge variant mapping
function getStatusBadgeVariant(status: ForwarderStatus) {
  switch (status) {
    case 'ACTIVE':
      return 'default'
    case 'INACTIVE':
      return 'secondary'
    case 'PENDING':
      return 'outline'
  }
}

// Status label mapping
function getStatusLabel(status: ForwarderStatus) {
  switch (status) {
    case 'ACTIVE':
      return '啟用中'
    case 'INACTIVE':
      return '已停用'
    case 'PENDING':
      return '待設定'
  }
}

export default async function ForwarderDetailPage({ params }: Props) {
  // 1. Authentication & Authorization
  const session = await auth()

  if (!session?.user?.id) {
    redirect('/login')
  }

  if (!hasPermission(session, PERMISSIONS.FORWARDER_VIEW)) {
    redirect('/unauthorized')
  }

  // 2. Fetch Forwarder data
  const forwarder = await getForwarder(params.id)

  if (!forwarder) {
    notFound()
  }

  // 3. Check edit permission
  const canEdit = hasPermission(session, PERMISSIONS.FORWARDER_MANAGE)

  return (
    <div className="space-y-6">
      {/* Breadcrumb Navigation */}
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/forwarders">Forwarders</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{forwarder.name}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Page Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          {/* Logo */}
          {forwarder.logoUrl ? (
            <img
              src={forwarder.logoUrl}
              alt={`${forwarder.name} logo`}
              className="h-16 w-16 rounded-lg object-contain border"
            />
          ) : (
            <div className="h-16 w-16 rounded-lg bg-muted flex items-center justify-center">
              <span className="text-2xl font-bold text-muted-foreground">
                {forwarder.name.charAt(0).toUpperCase()}
              </span>
            </div>
          )}

          {/* Title and Code */}
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">{forwarder.name}</h1>
              <Badge variant={getStatusBadgeVariant(forwarder.status)}>
                {getStatusLabel(forwarder.status)}
              </Badge>
            </div>
            <p className="text-muted-foreground">
              <code className="rounded bg-muted px-2 py-1 text-sm">
                {forwarder.code}
              </code>
            </p>
          </div>
        </div>

        {/* Actions Dropdown */}
        {canEdit && <ForwarderActions forwarder={forwarder} />}
      </div>

      {/* Tab Navigation */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">總覽</TabsTrigger>
          <TabsTrigger value="rules">映射規則</TabsTrigger>
          <TabsTrigger value="stats">處理統計</TabsTrigger>
          <TabsTrigger value="documents">最近發票</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <ForwarderInfo forwarder={forwarder} />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Suspense fallback={<Skeleton className="h-[300px]" />}>
              <ForwarderStats forwarderId={params.id} compact />
            </Suspense>
            <Suspense fallback={<Skeleton className="h-[300px]" />}>
              <RecentDocuments forwarderId={params.id} limit={5} />
            </Suspense>
          </div>
        </TabsContent>

        {/* Rules Tab */}
        <TabsContent value="rules">
          <Suspense fallback={<Skeleton className="h-[400px]" />}>
            <ForwarderRules forwarderId={params.id} />
          </Suspense>
        </TabsContent>

        {/* Stats Tab */}
        <TabsContent value="stats">
          <Suspense fallback={<Skeleton className="h-[500px]" />}>
            <ForwarderStats forwarderId={params.id} />
          </Suspense>
        </TabsContent>

        {/* Documents Tab */}
        <TabsContent value="documents">
          <Suspense fallback={<Skeleton className="h-[400px]" />}>
            <RecentDocuments forwarderId={params.id} />
          </Suspense>
        </TabsContent>
      </Tabs>
    </div>
  )
}
```

### 5.2 ForwarderInfo Component

**File**: `src/components/forwarders/ForwarderInfo.tsx`

```typescript
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Forwarder, ForwarderStatus, User } from '@prisma/client'
import { formatDistanceToNow } from 'date-fns'
import { zhTW } from 'date-fns/locale'
import { Building2, Mail, Calendar, User as UserIcon, Percent } from 'lucide-react'
import ReactMarkdown from 'react-markdown'

interface ForwarderWithCreator extends Forwarder {
  createdBy: {
    id: string
    name: string
  }
}

interface ForwarderInfoProps {
  forwarder: ForwarderWithCreator
}

export function ForwarderInfo({ forwarder }: ForwarderInfoProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="h-5 w-5" />
          基本資訊
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Description */}
        {forwarder.description && (
          <div className="prose prose-sm max-w-none">
            <ReactMarkdown>{forwarder.description}</ReactMarkdown>
          </div>
        )}

        {/* Info Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Contact Email */}
          {forwarder.contactEmail && (
            <div className="flex items-center gap-2 text-sm">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">聯絡信箱:</span>
              <a
                href={`mailto:${forwarder.contactEmail}`}
                className="text-primary hover:underline"
              >
                {forwarder.contactEmail}
              </a>
            </div>
          )}

          {/* Default Confidence */}
          <div className="flex items-center gap-2 text-sm">
            <Percent className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">預設信心度:</span>
            <span>{(forwarder.defaultConfidence * 100).toFixed(0)}%</span>
          </div>

          {/* Created By */}
          <div className="flex items-center gap-2 text-sm">
            <UserIcon className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">建立者:</span>
            <span>{forwarder.createdBy.name}</span>
          </div>

          {/* Created At */}
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">建立時間:</span>
            <span>
              {formatDistanceToNow(new Date(forwarder.createdAt), {
                addSuffix: true,
                locale: zhTW
              })}
            </span>
          </div>

          {/* Updated At */}
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">最後更新:</span>
            <span>
              {formatDistanceToNow(new Date(forwarder.updatedAt), {
                addSuffix: true,
                locale: zhTW
              })}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
```

### 5.3 ForwarderRules Component

**File**: `src/components/forwarders/ForwarderRules.tsx`

```typescript
'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { useDebouncedCallback } from 'use-debounce'
import { Search, MoreHorizontal, Eye, Edit, Power, FileCode } from 'lucide-react'
import { RuleStatus, ExtractionType } from '@prisma/client'
import { SortableHeader } from '@/components/ui/sortable-header'

interface ForwarderRulesProps {
  forwarderId: string
}

interface RuleWithStats {
  id: string
  fieldName: string
  extractionType: ExtractionType
  status: RuleStatus
  version: number
  confidence: number
  updatedAt: string
  successRate: number
  applicationCount: number
}

interface RulesResponse {
  success: true
  data: {
    items: RuleWithStats[]
    pagination: {
      page: number
      pageSize: number
      totalItems: number
      totalPages: number
    }
    summary: {
      total: number
      active: number
      draft: number
      deprecated: number
    }
  }
}

// Fetch function
async function fetchRules(
  forwarderId: string,
  params: {
    fieldName?: string
    status?: RuleStatus
    page: number
    pageSize: number
    sortBy: string
    sortOrder: 'asc' | 'desc'
  }
): Promise<RulesResponse> {
  const searchParams = new URLSearchParams()
  if (params.fieldName) searchParams.set('fieldName', params.fieldName)
  if (params.status) searchParams.set('status', params.status)
  searchParams.set('page', params.page.toString())
  searchParams.set('pageSize', params.pageSize.toString())
  searchParams.set('sortBy', params.sortBy)
  searchParams.set('sortOrder', params.sortOrder)

  const response = await fetch(`/api/forwarders/${forwarderId}/rules?${searchParams}`)
  if (!response.ok) {
    throw new Error('Failed to fetch rules')
  }
  return response.json()
}

// Status badge variant mapping
function getStatusBadgeVariant(status: RuleStatus) {
  switch (status) {
    case 'ACTIVE':
      return 'default'
    case 'DRAFT':
      return 'secondary'
    case 'DEPRECATED':
      return 'destructive'
  }
}

// Status label mapping
function getStatusLabel(status: RuleStatus) {
  switch (status) {
    case 'ACTIVE':
      return '啟用'
    case 'DRAFT':
      return '草稿'
    case 'DEPRECATED':
      return '已棄用'
  }
}

// Extraction type label mapping
function getExtractionTypeLabel(type: ExtractionType) {
  switch (type) {
    case 'REGEX':
      return '正則表達式'
    case 'POSITION':
      return '位置座標'
    case 'KEYWORD':
      return '關鍵字搜尋'
    case 'TABLE':
      return '表格提取'
    case 'AI_ASSISTED':
      return 'AI 輔助'
  }
}

export function ForwarderRules({ forwarderId }: ForwarderRulesProps) {
  const router = useRouter()

  // Filter state
  const [fieldName, setFieldName] = useState('')
  const [status, setStatus] = useState<RuleStatus | 'ALL'>('ALL')
  const [page, setPage] = useState(1)
  const [sortBy, setSortBy] = useState('updatedAt')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

  // Debounced field name search
  const debouncedSetFieldName = useDebouncedCallback((value: string) => {
    setFieldName(value)
    setPage(1)
  }, 300)

  // Query
  const { data, isLoading, error } = useQuery({
    queryKey: ['forwarder-rules', forwarderId, fieldName, status, page, sortBy, sortOrder],
    queryFn: () => fetchRules(forwarderId, {
      fieldName: fieldName || undefined,
      status: status === 'ALL' ? undefined : status,
      page,
      pageSize: 20,
      sortBy,
      sortOrder
    })
  })

  // Handle sort
  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(column)
      setSortOrder('desc')
    }
  }

  if (isLoading) {
    return <ForwarderRulesSkeleton />
  }

  if (error || !data) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-destructive">
          載入規則時發生錯誤
        </CardContent>
      </Card>
    )
  }

  const { items, pagination, summary } = data.data

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <FileCode className="h-5 w-5" />
            映射規則
          </CardTitle>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Badge variant="default">{summary.active} 啟用</Badge>
            <Badge variant="secondary">{summary.draft} 草稿</Badge>
            <Badge variant="destructive">{summary.deprecated} 已棄用</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="搜尋欄位名稱..."
              className="pl-9"
              onChange={(e) => debouncedSetFieldName(e.target.value)}
            />
          </div>
          <Select
            value={status}
            onValueChange={(value) => {
              setStatus(value as RuleStatus | 'ALL')
              setPage(1)
            }}
          >
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="狀態篩選" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">全部狀態</SelectItem>
              <SelectItem value="ACTIVE">啟用</SelectItem>
              <SelectItem value="DRAFT">草稿</SelectItem>
              <SelectItem value="DEPRECATED">已棄用</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        {items.length === 0 ? (
          <div className="py-10 text-center text-muted-foreground">
            沒有找到符合條件的規則
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableHeader
                    column="fieldName"
                    label="欄位名稱"
                    sortBy={sortBy}
                    sortOrder={sortOrder}
                    onSort={handleSort}
                  />
                  <TableHead>提取類型</TableHead>
                  <SortableHeader
                    column="status"
                    label="狀態"
                    sortBy={sortBy}
                    sortOrder={sortOrder}
                    onSort={handleSort}
                  />
                  <SortableHeader
                    column="version"
                    label="版本"
                    sortBy={sortBy}
                    sortOrder={sortOrder}
                    onSort={handleSort}
                  />
                  <SortableHeader
                    column="successRate"
                    label="成功率"
                    sortBy={sortBy}
                    sortOrder={sortOrder}
                    onSort={handleSort}
                  />
                  <TableHead className="text-right">應用次數</TableHead>
                  <TableHead className="w-[50px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((rule) => (
                  <TableRow
                    key={rule.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => router.push(`/rules/${rule.id}`)}
                  >
                    <TableCell className="font-medium">{rule.fieldName}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {getExtractionTypeLabel(rule.extractionType)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getStatusBadgeVariant(rule.status)}>
                        {getStatusLabel(rule.status)}
                      </Badge>
                    </TableCell>
                    <TableCell>v{rule.version}</TableCell>
                    <TableCell>
                      <span className={
                        rule.successRate >= 0.9 ? 'text-green-600' :
                        rule.successRate >= 0.7 ? 'text-yellow-600' :
                        'text-red-600'
                      }>
                        {(rule.successRate * 100).toFixed(1)}%
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      {rule.applicationCount.toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => router.push(`/rules/${rule.id}`)}>
                            <Eye className="mr-2 h-4 w-4" />
                            查看詳情
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => router.push(`/rules/${rule.id}/edit`)}>
                            <Edit className="mr-2 h-4 w-4" />
                            編輯規則
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Power className="mr-2 h-4 w-4" />
                            {rule.status === 'ACTIVE' ? '停用' : '啟用'}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              顯示 {(page - 1) * pagination.pageSize + 1} - {Math.min(page * pagination.pageSize, pagination.totalItems)} 筆，
              共 {pagination.totalItems} 筆
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
              >
                上一頁
              </Button>
              <span className="text-sm">
                第 {page} / {pagination.totalPages} 頁
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= pagination.totalPages}
                onClick={() => setPage(page + 1)}
              >
                下一頁
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// Skeleton component
function ForwarderRulesSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-6 w-32" />
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 flex-1 max-w-sm" />
          <Skeleton className="h-10 w-[150px]" />
        </div>
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
```

### 5.4 ForwarderStats Component

**File**: `src/components/forwarders/ForwarderStats.tsx`

```typescript
'use client'

import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { useState } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  BarChart,
  Bar
} from 'recharts'
import { BarChart3, TrendingUp, CheckCircle, Clock, Percent } from 'lucide-react'

interface ForwarderStatsProps {
  forwarderId: string
  compact?: boolean
}

interface StatsResponse {
  success: true
  data: {
    overview: {
      totalProcessed: number
      successfulExtractions: number
      failedExtractions: number
      successRate: number
      averageConfidence: number
      averageProcessingTime: number
    }
    trend: {
      date: string
      processed: number
      successful: number
      averageConfidence: number
    }[]
    fieldStats: {
      fieldName: string
      totalExtractions: number
      successRate: number
      averageConfidence: number
      correctionRate: number
    }[]
    confidenceDistribution: {
      range: string
      count: number
      percentage: number
    }[]
  }
}

// Fetch function
async function fetchStats(forwarderId: string, period: string): Promise<StatsResponse> {
  const response = await fetch(`/api/forwarders/${forwarderId}/stats?period=${period}`)
  if (!response.ok) {
    throw new Error('Failed to fetch stats')
  }
  return response.json()
}

// Colors for charts
const COLORS = ['#22c55e', '#84cc16', '#eab308', '#f97316', '#ef4444']

export function ForwarderStats({ forwarderId, compact = false }: ForwarderStatsProps) {
  const [period, setPeriod] = useState('30d')

  const { data, isLoading, error } = useQuery({
    queryKey: ['forwarder-stats', forwarderId, period],
    queryFn: () => fetchStats(forwarderId, period)
  })

  if (isLoading) {
    return <ForwarderStatsSkeleton compact={compact} />
  }

  if (error || !data) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-destructive">
          載入統計數據時發生錯誤
        </CardContent>
      </Card>
    )
  }

  const { overview, trend, fieldStats, confidenceDistribution } = data.data

  return (
    <div className="space-y-6">
      {/* Period Selector (only in full mode) */}
      {!compact && (
        <div className="flex justify-end">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">最近 7 天</SelectItem>
              <SelectItem value="30d">最近 30 天</SelectItem>
              <SelectItem value="90d">最近 90 天</SelectItem>
              <SelectItem value="1y">最近一年</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Overview Cards */}
      <div className={`grid gap-4 ${compact ? 'grid-cols-2' : 'grid-cols-4'}`}>
        <StatCard
          icon={<BarChart3 className="h-4 w-4" />}
          title="總處理數"
          value={overview.totalProcessed.toLocaleString()}
          description="文件數量"
        />
        <StatCard
          icon={<CheckCircle className="h-4 w-4" />}
          title="成功率"
          value={`${(overview.successRate * 100).toFixed(1)}%`}
          description="提取成功比例"
          valueClassName={
            overview.successRate >= 0.9 ? 'text-green-600' :
            overview.successRate >= 0.7 ? 'text-yellow-600' :
            'text-red-600'
          }
        />
        {!compact && (
          <>
            <StatCard
              icon={<Percent className="h-4 w-4" />}
              title="平均信心度"
              value={`${(overview.averageConfidence * 100).toFixed(1)}%`}
              description="AI 提取信心度"
            />
            <StatCard
              icon={<Clock className="h-4 w-4" />}
              title="平均處理時間"
              value={`${(overview.averageProcessingTime / 1000).toFixed(1)}s`}
              description="每份文件"
            />
          </>
        )}
      </div>

      {/* Full mode charts */}
      {!compact && (
        <>
          {/* Trend Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                處理趨勢
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={trend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 12 }}
                    tickFormatter={(value) => {
                      const date = new Date(value)
                      return `${date.getMonth() + 1}/${date.getDate()}`
                    }}
                  />
                  <YAxis yAxisId="left" />
                  <YAxis yAxisId="right" orientation="right" domain={[0, 1]} />
                  <Tooltip
                    labelFormatter={(value) => new Date(value).toLocaleDateString('zh-TW')}
                    formatter={(value: number, name: string) => {
                      if (name === '平均信心度') {
                        return [`${(value * 100).toFixed(1)}%`, name]
                      }
                      return [value, name]
                    }}
                  />
                  <Legend />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="processed"
                    stroke="#8884d8"
                    name="處理數量"
                    strokeWidth={2}
                  />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="successful"
                    stroke="#82ca9d"
                    name="成功數量"
                    strokeWidth={2}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="averageConfidence"
                    stroke="#ffc658"
                    name="平均信心度"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Field Stats */}
          <Card>
            <CardHeader>
              <CardTitle>欄位提取統計</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={fieldStats.slice(0, 10)} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" domain={[0, 1]} tickFormatter={(v) => `${(v * 100).toFixed(0)}%`} />
                  <YAxis dataKey="fieldName" type="category" width={120} tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(value: number) => `${(value * 100).toFixed(1)}%`} />
                  <Legend />
                  <Bar dataKey="successRate" fill="#82ca9d" name="成功率" />
                  <Bar dataKey="correctionRate" fill="#ffc658" name="修正率" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Confidence Distribution */}
          <Card>
            <CardHeader>
              <CardTitle>信心度分布</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={confidenceDistribution}
                    dataKey="count"
                    nameKey="range"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={({ range, percentage }) => `${range}: ${(percentage * 100).toFixed(1)}%`}
                  >
                    {confidenceDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => value.toLocaleString()} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}

// Stat Card Component
interface StatCardProps {
  icon: React.ReactNode
  title: string
  value: string
  description: string
  valueClassName?: string
}

function StatCard({ icon, title, value, description, valueClassName }: StatCardProps) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
          {icon}
          {title}
        </div>
        <div className={`text-2xl font-bold ${valueClassName || ''}`}>{value}</div>
        <p className="text-xs text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  )
}

// Skeleton
function ForwarderStatsSkeleton({ compact }: { compact?: boolean }) {
  return (
    <div className="space-y-6">
      <div className={`grid gap-4 ${compact ? 'grid-cols-2' : 'grid-cols-4'}`}>
        {Array.from({ length: compact ? 2 : 4 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="pt-6">
              <Skeleton className="h-4 w-20 mb-2" />
              <Skeleton className="h-8 w-24 mb-1" />
              <Skeleton className="h-3 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
      {!compact && (
        <>
          <Skeleton className="h-[350px]" />
          <Skeleton className="h-[350px]" />
          <Skeleton className="h-[300px]" />
        </>
      )}
    </div>
  )
}
```

### 5.5 RecentDocuments Component

**File**: `src/components/forwarders/RecentDocuments.tsx`

```typescript
'use client'

import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDistanceToNow } from 'date-fns'
import { zhTW } from 'date-fns/locale'
import { FileText, ChevronRight, ExternalLink } from 'lucide-react'
import { DocumentStatus } from '@prisma/client'

interface RecentDocumentsProps {
  forwarderId: string
  limit?: number
}

interface DocumentItem {
  id: string
  fileName: string
  status: DocumentStatus
  confidence: number | null
  thumbnailUrl: string | null
  processedAt: string | null
  createdAt: string
}

interface DocumentsResponse {
  success: true
  data: {
    items: DocumentItem[]
    pagination: {
      page: number
      pageSize: number
      totalItems: number
      totalPages: number
    }
  }
}

// Fetch function
async function fetchDocuments(forwarderId: string, limit: number): Promise<DocumentsResponse> {
  const response = await fetch(`/api/forwarders/${forwarderId}/documents?pageSize=${limit}`)
  if (!response.ok) {
    throw new Error('Failed to fetch documents')
  }
  return response.json()
}

// Status badge variant mapping
function getStatusBadgeVariant(status: DocumentStatus) {
  switch (status) {
    case 'COMPLETED':
      return 'default'
    case 'PROCESSING':
      return 'secondary'
    case 'PENDING':
      return 'outline'
    case 'FAILED':
      return 'destructive'
  }
}

// Status label mapping
function getStatusLabel(status: DocumentStatus) {
  switch (status) {
    case 'COMPLETED':
      return '已完成'
    case 'PROCESSING':
      return '處理中'
    case 'PENDING':
      return '待處理'
    case 'FAILED':
      return '失敗'
  }
}

export function RecentDocuments({ forwarderId, limit = 10 }: RecentDocumentsProps) {
  const router = useRouter()

  const { data, isLoading, error } = useQuery({
    queryKey: ['forwarder-documents', forwarderId, limit],
    queryFn: () => fetchDocuments(forwarderId, limit)
  })

  if (isLoading) {
    return <RecentDocumentsSkeleton limit={limit} />
  }

  if (error || !data) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-destructive">
          載入文件列表時發生錯誤
        </CardContent>
      </Card>
    )
  }

  const { items, pagination } = data.data

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            最近發票
          </CardTitle>
          {pagination.totalItems > limit && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push(`/documents?forwarderId=${forwarderId}`)}
            >
              查看更多
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <div className="py-10 text-center text-muted-foreground">
            尚無處理過的發票
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer transition-colors"
                onClick={() => router.push(`/documents/${doc.id}`)}
              >
                {/* Thumbnail */}
                {doc.thumbnailUrl ? (
                  <img
                    src={doc.thumbnailUrl}
                    alt={doc.fileName}
                    className="h-12 w-12 rounded object-cover border"
                  />
                ) : (
                  <div className="h-12 w-12 rounded bg-muted flex items-center justify-center">
                    <FileText className="h-6 w-6 text-muted-foreground" />
                  </div>
                )}

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{doc.fileName}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatDistanceToNow(new Date(doc.createdAt), {
                      addSuffix: true,
                      locale: zhTW
                    })}
                  </p>
                </div>

                {/* Status & Confidence */}
                <div className="flex items-center gap-2">
                  {doc.confidence !== null && (
                    <span className={`text-sm font-medium ${
                      doc.confidence >= 0.9 ? 'text-green-600' :
                      doc.confidence >= 0.7 ? 'text-yellow-600' :
                      'text-red-600'
                    }`}>
                      {(doc.confidence * 100).toFixed(0)}%
                    </span>
                  )}
                  <Badge variant={getStatusBadgeVariant(doc.status)}>
                    {getStatusLabel(doc.status)}
                  </Badge>
                </div>

                {/* External Link Icon */}
                <ExternalLink className="h-4 w-4 text-muted-foreground" />
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// Skeleton
function RecentDocumentsSkeleton({ limit }: { limit: number }) {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-6 w-24" />
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {Array.from({ length: Math.min(limit, 5) }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 p-3">
              <Skeleton className="h-12 w-12 rounded" />
              <div className="flex-1">
                <Skeleton className="h-4 w-32 mb-1" />
                <Skeleton className="h-3 w-20" />
              </div>
              <Skeleton className="h-5 w-16" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
```

### 5.6 ForwarderActions Component

**File**: `src/components/forwarders/ForwarderActions.tsx`

```typescript
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { MoreHorizontal, Edit, Power, PowerOff, Trash2 } from 'lucide-react'
import { Forwarder, ForwarderStatus } from '@prisma/client'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

interface ForwarderActionsProps {
  forwarder: Forwarder
}

export function ForwarderActions({ forwarder }: ForwarderActionsProps) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [showDeactivateDialog, setShowDeactivateDialog] = useState(false)
  const [showActivateDialog, setShowActivateDialog] = useState(false)

  // Toggle status mutation
  const toggleStatusMutation = useMutation({
    mutationFn: async (newStatus: ForwarderStatus) => {
      const response = await fetch(`/api/forwarders/${forwarder.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      })
      if (!response.ok) {
        throw new Error('Failed to update status')
      }
      return response.json()
    },
    onSuccess: () => {
      toast.success(forwarder.status === 'ACTIVE' ? 'Forwarder 已停用' : 'Forwarder 已啟用')
      queryClient.invalidateQueries({ queryKey: ['forwarder', forwarder.id] })
      router.refresh()
    },
    onError: () => {
      toast.error('操作失敗，請稍後再試')
    }
  })

  const handleDeactivate = () => {
    toggleStatusMutation.mutate('INACTIVE')
    setShowDeactivateDialog(false)
  }

  const handleActivate = () => {
    toggleStatusMutation.mutate('ACTIVE')
    setShowActivateDialog(false)
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => router.push(`/forwarders/${forwarder.id}/edit`)}>
            <Edit className="mr-2 h-4 w-4" />
            編輯資訊
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {forwarder.status === 'ACTIVE' ? (
            <DropdownMenuItem
              onClick={() => setShowDeactivateDialog(true)}
              className="text-destructive focus:text-destructive"
            >
              <PowerOff className="mr-2 h-4 w-4" />
              停用 Forwarder
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onClick={() => setShowActivateDialog(true)}>
              <Power className="mr-2 h-4 w-4" />
              啟用 Forwarder
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Deactivate Confirmation Dialog */}
      <AlertDialog open={showDeactivateDialog} onOpenChange={setShowDeactivateDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>確定要停用此 Forwarder？</AlertDialogTitle>
            <AlertDialogDescription>
              停用後，所有使用此 Forwarder 的映射規則將暫停運作，新文件將無法使用此 Forwarder 進行處理。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeactivate}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              停用
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Activate Confirmation Dialog */}
      <AlertDialog open={showActivateDialog} onOpenChange={setShowActivateDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>確定要啟用此 Forwarder？</AlertDialogTitle>
            <AlertDialogDescription>
              啟用後，此 Forwarder 的映射規則將恢復運作，新文件可以使用此 Forwarder 進行處理。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleActivate}>
              啟用
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
```

---

## 6. React Query Hooks

### 6.1 useForwarderDetail Hook

**File**: `src/hooks/useForwarderDetail.ts`

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ForwarderStatus } from '@prisma/client'

interface ForwarderDetail {
  id: string
  name: string
  code: string
  description: string | null
  status: ForwarderStatus
  logoUrl: string | null
  contactEmail: string | null
  defaultConfidence: number
  createdAt: string
  updatedAt: string
  createdBy: {
    id: string
    name: string
  }
  rules: {
    total: number
    active: number
    draft: number
    deprecated: number
  }
  stats: {
    totalProcessed: number
    last30Days: number
    successRate: number
    averageConfidence: number
  }
  recentDocuments: {
    id: string
    fileName: string
    status: string
    confidence: number | null
    createdAt: string
    thumbnailUrl: string | null
  }[]
}

async function fetchForwarderDetail(id: string): Promise<ForwarderDetail> {
  const response = await fetch(`/api/forwarders/${id}`)
  if (!response.ok) {
    throw new Error('Failed to fetch forwarder')
  }
  const result = await response.json()
  return result.data
}

async function updateForwarderStatus(
  id: string,
  status: ForwarderStatus
): Promise<ForwarderDetail> {
  const response = await fetch(`/api/forwarders/${id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status })
  })
  if (!response.ok) {
    throw new Error('Failed to update status')
  }
  const result = await response.json()
  return result.data
}

export function useForwarderDetail(id: string) {
  return useQuery({
    queryKey: ['forwarder', id],
    queryFn: () => fetchForwarderDetail(id),
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}

export function useUpdateForwarderStatus(id: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (status: ForwarderStatus) => updateForwarderStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['forwarder', id] })
      queryClient.invalidateQueries({ queryKey: ['forwarders'] })
    }
  })
}
```

### 6.2 useForwarderRules Hook

**File**: `src/hooks/useForwarderRules.ts`

```typescript
import { useQuery } from '@tanstack/react-query'
import { RuleStatus, ExtractionType } from '@prisma/client'

interface RuleWithStats {
  id: string
  fieldName: string
  extractionType: ExtractionType
  status: RuleStatus
  version: number
  confidence: number
  updatedAt: string
  successRate: number
  applicationCount: number
}

interface RulesData {
  items: RuleWithStats[]
  pagination: {
    page: number
    pageSize: number
    totalItems: number
    totalPages: number
  }
  summary: {
    total: number
    active: number
    draft: number
    deprecated: number
  }
}

interface UseForwarderRulesParams {
  forwarderId: string
  fieldName?: string
  status?: RuleStatus
  page?: number
  pageSize?: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

async function fetchForwarderRules(params: UseForwarderRulesParams): Promise<RulesData> {
  const searchParams = new URLSearchParams()
  if (params.fieldName) searchParams.set('fieldName', params.fieldName)
  if (params.status) searchParams.set('status', params.status)
  if (params.page) searchParams.set('page', params.page.toString())
  if (params.pageSize) searchParams.set('pageSize', params.pageSize.toString())
  if (params.sortBy) searchParams.set('sortBy', params.sortBy)
  if (params.sortOrder) searchParams.set('sortOrder', params.sortOrder)

  const response = await fetch(
    `/api/forwarders/${params.forwarderId}/rules?${searchParams}`
  )
  if (!response.ok) {
    throw new Error('Failed to fetch rules')
  }
  const result = await response.json()
  return result.data
}

export function useForwarderRules(params: UseForwarderRulesParams) {
  return useQuery({
    queryKey: [
      'forwarder-rules',
      params.forwarderId,
      params.fieldName,
      params.status,
      params.page,
      params.pageSize,
      params.sortBy,
      params.sortOrder
    ],
    queryFn: () => fetchForwarderRules(params),
    staleTime: 2 * 60 * 1000, // 2 minutes
  })
}
```

### 6.3 useForwarderStats Hook

**File**: `src/hooks/useForwarderStats.ts`

```typescript
import { useQuery } from '@tanstack/react-query'

interface StatsOverview {
  totalProcessed: number
  successfulExtractions: number
  failedExtractions: number
  successRate: number
  averageConfidence: number
  averageProcessingTime: number
}

interface TrendData {
  date: string
  processed: number
  successful: number
  averageConfidence: number
}

interface FieldStats {
  fieldName: string
  totalExtractions: number
  successRate: number
  averageConfidence: number
  correctionRate: number
}

interface ConfidenceDistribution {
  range: string
  count: number
  percentage: number
}

interface ForwarderStatsData {
  overview: StatsOverview
  trend: TrendData[]
  fieldStats: FieldStats[]
  confidenceDistribution: ConfidenceDistribution[]
}

type Period = '7d' | '30d' | '90d' | '1y'

async function fetchForwarderStats(
  forwarderId: string,
  period: Period
): Promise<ForwarderStatsData> {
  const response = await fetch(
    `/api/forwarders/${forwarderId}/stats?period=${period}`
  )
  if (!response.ok) {
    throw new Error('Failed to fetch stats')
  }
  const result = await response.json()
  return result.data
}

export function useForwarderStats(forwarderId: string, period: Period = '30d') {
  return useQuery({
    queryKey: ['forwarder-stats', forwarderId, period],
    queryFn: () => fetchForwarderStats(forwarderId, period),
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}
```

---

## 7. Test Specifications

### 7.1 API Tests

**File**: `__tests__/api/forwarders/[id]/route.test.ts`

```typescript
import { GET } from '@/app/api/forwarders/[id]/route'
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'

// Mock dependencies
jest.mock('@/lib/auth')
jest.mock('@/lib/prisma', () => ({
  prisma: {
    forwarder: {
      findUnique: jest.fn()
    },
    document: {
      aggregate: jest.fn(),
      count: jest.fn(),
      findMany: jest.fn()
    }
  }
}))

const mockAuth = auth as jest.MockedFunction<typeof auth>

describe('GET /api/forwarders/[id]', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should return 401 when not authenticated', async () => {
    mockAuth.mockResolvedValue(null)

    const request = new NextRequest('http://localhost/api/forwarders/123')
    const response = await GET(request, { params: { id: '123' } })

    expect(response.status).toBe(401)
  })

  it('should return 400 for invalid UUID', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'user-1', role: 'SUPER_USER' }
    } as any)

    const request = new NextRequest('http://localhost/api/forwarders/invalid-id')
    const response = await GET(request, { params: { id: 'invalid-id' } })

    expect(response.status).toBe(400)
  })

  it('should return 404 when forwarder not found', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'user-1', role: 'SUPER_USER' }
    } as any)

    ;(prisma.forwarder.findUnique as jest.Mock).mockResolvedValue(null)

    const request = new NextRequest('http://localhost/api/forwarders/550e8400-e29b-41d4-a716-446655440000')
    const response = await GET(request, { params: { id: '550e8400-e29b-41d4-a716-446655440000' } })

    expect(response.status).toBe(404)
  })

  it('should return forwarder detail with stats', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'user-1', role: 'SUPER_USER' }
    } as any)

    const mockForwarder = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      name: 'Test Forwarder',
      code: 'TEST-001',
      description: 'Test description',
      status: 'ACTIVE',
      logoUrl: null,
      contactEmail: 'test@example.com',
      defaultConfidence: 0.8,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: { id: 'user-1', name: 'Test User' },
      mappingRules: [
        { status: 'ACTIVE' },
        { status: 'ACTIVE' },
        { status: 'DRAFT' }
      ]
    }

    ;(prisma.forwarder.findUnique as jest.Mock).mockResolvedValue(mockForwarder)
    ;(prisma.document.aggregate as jest.Mock).mockResolvedValue({
      _count: { id: 100 },
      _avg: { confidence: 0.85 }
    })
    ;(prisma.document.count as jest.Mock).mockResolvedValue(90)
    ;(prisma.document.findMany as jest.Mock).mockResolvedValue([])

    const request = new NextRequest('http://localhost/api/forwarders/550e8400-e29b-41d4-a716-446655440000')
    const response = await GET(request, { params: { id: '550e8400-e29b-41d4-a716-446655440000' } })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.data.name).toBe('Test Forwarder')
    expect(data.data.rules.total).toBe(3)
    expect(data.data.rules.active).toBe(2)
    expect(data.data.rules.draft).toBe(1)
  })
})
```

### 7.2 Component Tests

**File**: `__tests__/components/forwarders/ForwarderStats.test.tsx`

```typescript
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ForwarderStats } from '@/components/forwarders/ForwarderStats'

// Mock fetch
global.fetch = jest.fn()

const mockStatsData = {
  success: true,
  data: {
    overview: {
      totalProcessed: 1000,
      successfulExtractions: 950,
      failedExtractions: 50,
      successRate: 0.95,
      averageConfidence: 0.88,
      averageProcessingTime: 2500
    },
    trend: [
      { date: '2025-01-01', processed: 30, successful: 28, averageConfidence: 0.87 },
      { date: '2025-01-02', processed: 35, successful: 33, averageConfidence: 0.89 }
    ],
    fieldStats: [
      { fieldName: 'invoiceNumber', totalExtractions: 1000, successRate: 0.98, averageConfidence: 0.92, correctionRate: 0.02 }
    ],
    confidenceDistribution: [
      { range: '90-100%', count: 700, percentage: 0.7 },
      { range: '80-90%', count: 200, percentage: 0.2 }
    ]
  }
}

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } }
  })
  return render(
    <QueryClientProvider client={queryClient}>
      {ui}
    </QueryClientProvider>
  )
}

describe('ForwarderStats', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockStatsData)
    })
  })

  it('should render loading skeleton initially', () => {
    renderWithClient(<ForwarderStats forwarderId="test-id" />)
    expect(screen.getByTestId('stats-skeleton')).toBeInTheDocument()
  })

  it('should render overview cards after loading', async () => {
    renderWithClient(<ForwarderStats forwarderId="test-id" />)

    await waitFor(() => {
      expect(screen.getByText('1,000')).toBeInTheDocument()
      expect(screen.getByText('95.0%')).toBeInTheDocument()
      expect(screen.getByText('88.0%')).toBeInTheDocument()
    })
  })

  it('should render compact mode correctly', async () => {
    renderWithClient(<ForwarderStats forwarderId="test-id" compact />)

    await waitFor(() => {
      expect(screen.getByText('1,000')).toBeInTheDocument()
    })

    // Charts should not be rendered in compact mode
    expect(screen.queryByText('處理趨勢')).not.toBeInTheDocument()
  })

  it('should render charts in full mode', async () => {
    renderWithClient(<ForwarderStats forwarderId="test-id" />)

    await waitFor(() => {
      expect(screen.getByText('處理趨勢')).toBeInTheDocument()
      expect(screen.getByText('欄位提取統計')).toBeInTheDocument()
      expect(screen.getByText('信心度分布')).toBeInTheDocument()
    })
  })
})
```

### 7.3 E2E Tests

**File**: `e2e/forwarder-detail.spec.ts`

```typescript
import { test, expect } from '@playwright/test'

test.describe('Forwarder Detail Page', () => {
  test.beforeEach(async ({ page }) => {
    // Login as super user
    await page.goto('/login')
    await page.fill('[name="email"]', 'admin@example.com')
    await page.fill('[name="password"]', 'password')
    await page.click('button[type="submit"]')
    await page.waitForURL('/dashboard')
  })

  test('should display forwarder basic info', async ({ page }) => {
    await page.goto('/forwarders/test-forwarder-id')

    // Check header elements
    await expect(page.locator('h1')).toContainText('Test Forwarder')
    await expect(page.locator('code')).toContainText('TEST-001')

    // Check tabs exist
    await expect(page.getByRole('tab', { name: '總覽' })).toBeVisible()
    await expect(page.getByRole('tab', { name: '映射規則' })).toBeVisible()
    await expect(page.getByRole('tab', { name: '處理統計' })).toBeVisible()
    await expect(page.getByRole('tab', { name: '最近發票' })).toBeVisible()
  })

  test('should navigate between tabs', async ({ page }) => {
    await page.goto('/forwarders/test-forwarder-id')

    // Click rules tab
    await page.click('role=tab[name="映射規則"]')
    await expect(page.getByText('欄位名稱')).toBeVisible()

    // Click stats tab
    await page.click('role=tab[name="處理統計"]')
    await expect(page.getByText('處理趨勢')).toBeVisible()

    // Click documents tab
    await page.click('role=tab[name="最近發票"]')
    await expect(page.getByText('最近發票')).toBeVisible()
  })

  test('should filter rules by status', async ({ page }) => {
    await page.goto('/forwarders/test-forwarder-id')
    await page.click('role=tab[name="映射規則"]')

    // Open status filter
    await page.click('[data-testid="status-filter"]')
    await page.click('text=啟用')

    // Verify filter applied
    await expect(page.locator('.badge:has-text("啟用")')).toHaveCount(await page.locator('table tbody tr').count())
  })

  test('should search rules by field name', async ({ page }) => {
    await page.goto('/forwarders/test-forwarder-id')
    await page.click('role=tab[name="映射規則"]')

    // Search for specific field
    await page.fill('[placeholder="搜尋欄位名稱..."]', 'invoice')

    // Wait for debounced search
    await page.waitForTimeout(400)

    // Verify search results
    const rows = page.locator('table tbody tr')
    for (const row of await rows.all()) {
      await expect(row).toContainText(/invoice/i)
    }
  })

  test('should show deactivate dialog for active forwarder', async ({ page }) => {
    await page.goto('/forwarders/test-forwarder-id')

    // Click actions menu
    await page.click('[data-testid="forwarder-actions"]')
    await page.click('text=停用 Forwarder')

    // Check dialog appears
    await expect(page.getByRole('alertdialog')).toBeVisible()
    await expect(page.getByText('確定要停用此 Forwarder？')).toBeVisible()
  })

  test('should display stats charts correctly', async ({ page }) => {
    await page.goto('/forwarders/test-forwarder-id')
    await page.click('role=tab[name="處理統計"]')

    // Wait for charts to render
    await page.waitForSelector('.recharts-wrapper')

    // Verify chart elements exist
    await expect(page.locator('.recharts-line')).toBeVisible()
    await expect(page.locator('.recharts-bar')).toBeVisible()
    await expect(page.locator('.recharts-pie')).toBeVisible()
  })

  test('should navigate to document detail on click', async ({ page }) => {
    await page.goto('/forwarders/test-forwarder-id')
    await page.click('role=tab[name="最近發票"]')

    // Click first document
    await page.click('[data-testid="document-item"]:first-child')

    // Verify navigation
    await expect(page).toHaveURL(/\/documents\//)
  })
})
```

---

## 8. Performance Considerations

### 8.1 Database Query Optimization

```typescript
// Use select to fetch only needed fields
const forwarder = await prisma.forwarder.findUnique({
  where: { id },
  select: {
    id: true,
    name: true,
    code: true,
    // ... only needed fields
  }
})

// Use parallel queries for independent data
const [stats, documents, rules] = await Promise.all([
  fetchStats(id),
  fetchDocuments(id),
  fetchRules(id)
])

// Add database indexes for frequent queries
// In schema.prisma:
// @@index([forwarderId, createdAt])
// @@index([forwarderId, status])
```

### 8.2 Frontend Performance

```typescript
// React Query caching strategy
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000,   // 10 minutes
    }
  }
})

// Lazy load charts
const ForwarderStats = dynamic(
  () => import('@/components/forwarders/ForwarderStats'),
  { loading: () => <StatsSkeleton /> }
)

// Debounce search inputs
const debouncedSearch = useDebouncedCallback(
  (value) => setSearchTerm(value),
  300
)
```

### 8.3 Chart Performance

```typescript
// Limit data points for trend charts
const trend = trendData.slice(-30) // Last 30 days only

// Use responsive container with fixed height
<ResponsiveContainer width="100%" height={300}>
  <LineChart data={trend}>
    {/* ... */}
  </LineChart>
</ResponsiveContainer>

// Memoize chart data
const chartData = useMemo(() =>
  trend.map(item => ({
    ...item,
    formattedDate: formatDate(item.date)
  })),
  [trend]
)
```

---

## 9. Accessibility Requirements

### 9.1 ARIA Labels

```typescript
// Tab navigation
<Tabs aria-label="Forwarder 詳細資訊">
  <TabsList aria-label="分頁選單">
    <TabsTrigger value="overview" aria-controls="overview-panel">
      總覽
    </TabsTrigger>
    {/* ... */}
  </TabsList>
  <TabsContent id="overview-panel" role="tabpanel">
    {/* ... */}
  </TabsContent>
</Tabs>

// Status badges
<Badge aria-label={`狀態: ${getStatusLabel(status)}`}>
  {getStatusLabel(status)}
</Badge>

// Charts (provide text alternatives)
<div aria-label={`成功率: ${(successRate * 100).toFixed(1)}%`}>
  <PieChart>
    {/* ... */}
  </PieChart>
</div>
```

### 9.2 Keyboard Navigation

```typescript
// Table row navigation
<TableRow
  tabIndex={0}
  onKeyDown={(e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      router.push(`/rules/${rule.id}`)
    }
  }}
>
  {/* ... */}
</TableRow>

// Dropdown menu keyboard support
<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button aria-haspopup="menu" aria-expanded={open}>
      <MoreHorizontal aria-hidden="true" />
      <span className="sr-only">操作選單</span>
    </Button>
  </DropdownMenuTrigger>
  {/* ... */}
</DropdownMenu>
```

---

## 10. Implementation Checklist

### Phase 1: API Development
- [ ] Implement GET /api/forwarders/[id]
- [ ] Implement GET /api/forwarders/[id]/rules
- [ ] Implement GET /api/forwarders/[id]/stats
- [ ] Implement GET /api/forwarders/[id]/documents
- [ ] Write API unit tests

### Phase 2: UI Components
- [ ] Create ForwarderDetailPage
- [ ] Create ForwarderInfo component
- [ ] Create ForwarderRules component
- [ ] Create ForwarderStats component
- [ ] Create RecentDocuments component
- [ ] Create ForwarderActions component

### Phase 3: Data Layer
- [ ] Implement useForwarderDetail hook
- [ ] Implement useForwarderRules hook
- [ ] Implement useForwarderStats hook
- [ ] Configure React Query caching

### Phase 4: Charts Integration
- [ ] Install and configure Recharts
- [ ] Implement trend line chart
- [ ] Implement field stats bar chart
- [ ] Implement confidence pie chart

### Phase 5: Testing & QA
- [ ] Write component tests
- [ ] Write E2E tests
- [ ] Accessibility testing
- [ ] Performance testing

---

## 11. Dependencies

### NPM Packages
```json
{
  "recharts": "^2.10.0",
  "react-markdown": "^9.0.0",
  "date-fns": "^3.0.0",
  "use-debounce": "^10.0.0"
}
```

### Related Stories
- Story 5.1: Forwarder Profile 列表（前置依賴）
- Story 5.3: 編輯 Forwarder 映射規則
- Story 5.5: 新增與停用 Forwarder Profile

---

*Tech Spec created: 2025-12-16*
*Last updated: 2025-12-16*
