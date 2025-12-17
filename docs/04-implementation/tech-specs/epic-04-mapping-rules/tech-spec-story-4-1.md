# Tech Spec: Story 4-1 映射規則列表與查看

## 1. Overview

### 1.1 Story Reference
- **Story ID**: 4.1
- **Title**: 映射規則列表與查看
- **Epic**: Epic 4 - 映射規則管理與自動學習

### 1.2 Story Description
作為 Super User，我希望查看現有的映射規則，以便了解系統的提取邏輯並進行管理。

### 1.3 Dependencies
- **Story 1-2**: 角色權限基礎（RULE_VIEW 權限）
- **Story 5-3**: Forwarder 映射規則（基礎 Forwarder 模型）
- **Epic 3 連接**: 升級案例可創建規則建議

---

## 2. Acceptance Criteria Mapping

| AC ID | Description | Implementation Approach |
|-------|-------------|------------------------|
| AC1 | 規則列表顯示 | RulesPage + GET /api/rules + 篩選排序 |
| AC2 | 規則詳情查看 | RuleDetailPage + GET /api/rules/[id] + 統計 |

---

## 3. Architecture Overview

### 3.1 Rule Management System Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         映射規則管理系統                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                         Data Models                                   │   │
│  │                                                                       │   │
│  │  MappingRule                     RuleVersion                         │   │
│  │  ┌─────────────────┐            ┌─────────────────┐                  │   │
│  │  │ id              │            │ id              │                  │   │
│  │  │ forwarderId     │───────┐    │ ruleId         ◄───────────────┐   │   │
│  │  │ fieldName       │       │    │ version         │              │   │   │
│  │  │ extractionType  │       │    │ pattern         │              │   │   │
│  │  │ pattern         │       │    │ changeReason    │              │   │   │
│  │  │ status          │       │    │ createdBy       │              │   │   │
│  │  │ version         │       │    │ createdAt       │              │   │   │
│  │  │ createdBy       │       │    └─────────────────┘              │   │   │
│  │  └────────┬────────┘       │                                     │   │   │
│  │           │                │    RuleApplication                   │   │   │
│  │           │                │    ┌─────────────────┐              │   │   │
│  │           │                └────│ ruleId          │              │   │   │
│  │           │                     │ documentId      │              │   │   │
│  │           │                     │ isAccurate      │              │   │   │
│  │           │                     │ createdAt       │              │   │   │
│  │           │                     └─────────────────┘              │   │   │
│  │           │                                                       │   │   │
│  │           ▼                                                       │   │   │
│  │  Forwarder                                                        │   │   │
│  │  ┌─────────────────┐                                             │   │   │
│  │  │ id              │                                             │   │   │
│  │  │ name            │                                             │   │   │
│  │  │ code            │                                             │   │   │
│  │  └─────────────────┘                                             │   │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                         Rule List Page                                │   │
│  │                                                                       │   │
│  │  ┌─────────────────────────────────────────────────────────────────┐ │   │
│  │  │ Filters: [Forwarder ▼] [Field Name 🔍] [Status ▼] [Sort ▼]      │ │   │
│  │  └─────────────────────────────────────────────────────────────────┘ │   │
│  │                                                                       │   │
│  │  ┌─────────────────────────────────────────────────────────────────┐ │   │
│  │  │ Rule Table                                                       │ │   │
│  │  │ ┌────────┬──────────┬────────┬────────┬─────────┬───────────┐   │ │   │
│  │  │ │Forwarder│FieldName │ Type   │ Status │ Version │ Stats    │   │ │   │
│  │  │ ├────────┼──────────┼────────┼────────┼─────────┼───────────┤   │ │   │
│  │  │ │ DHL    │ inv_no   │ REGEX  │ ACTIVE │ v3      │ 98.5%    │   │ │   │
│  │  │ │ FedEx  │ amount   │ AI     │ ACTIVE │ v1      │ 95.2%    │   │ │   │
│  │  │ │ UPS    │ date     │ KEYWORD│ DRAFT  │ v2      │ --       │   │ │   │
│  │  │ └────────┴──────────┴────────┴────────┴─────────┴───────────┘   │ │   │
│  │  └─────────────────────────────────────────────────────────────────┘ │   │
│  │                                                                       │   │
│  │  ┌─────────────────────────────────────────────────────────────────┐ │   │
│  │  │ Pagination: [◄] [1] [2] [3] ... [10] [►]                       │ │   │
│  │  └─────────────────────────────────────────────────────────────────┘ │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Component Architecture

```
src/
├── app/(dashboard)/rules/
│   ├── page.tsx                         # 規則列表頁面
│   └── [id]/
│       └── page.tsx                     # 規則詳情頁面
├── app/api/rules/
│   ├── route.ts                         # GET 規則列表 API
│   └── [id]/
│       └── route.ts                     # GET 規則詳情 API
├── components/features/rules/
│   ├── RuleList.tsx                     # 規則列表組件
│   ├── RuleTable.tsx                    # 規則表格
│   ├── RuleFilters.tsx                  # 篩選器組件
│   ├── RuleCard.tsx                     # 規則卡片（詳情頁）
│   ├── RuleStats.tsx                    # 規則統計組件
│   ├── ExtractionTypeIcon.tsx           # 提取類型圖標
│   └── RuleStatusBadge.tsx              # 規則狀態標籤
├── hooks/
│   ├── useRuleList.ts                   # 規則列表 Hook
│   └── useRuleDetail.ts                 # 規則詳情 Hook
├── types/
│   └── rule.ts                          # 規則相關類型
└── lib/
    └── permissions.ts                   # 權限常量（擴展）
```

---

## 4. Implementation Guide

### Phase 1: Database Schema (Foundation)

#### 4.1.1 Prisma Schema 定義

**File**: `prisma/schema.prisma`

```prisma
// ===== 映射規則核心模型 =====

model MappingRule {
  id             String          @id @default(uuid())
  forwarderId    String          @map("forwarder_id")
  fieldName      String          @map("field_name")
  extractionType ExtractionType  @map("extraction_type")
  pattern        String?         // 提取模式（正則、關鍵字、提示詞等）
  confidence     Float           @default(0.8)
  priority       Int             @default(0)
  status         RuleStatus      @default(ACTIVE)
  version        Int             @default(1)
  description    String?         // 規則說明
  createdBy      String          @map("created_by")
  createdAt      DateTime        @default(now()) @map("created_at")
  updatedAt      DateTime        @updatedAt @map("updated_at")

  forwarder    Forwarder         @relation(fields: [forwarderId], references: [id])
  creator      User              @relation("RuleCreator", fields: [createdBy], references: [id])
  versions     RuleVersion[]
  applications RuleApplication[]
  rollbackLogs RollbackLog[]

  @@unique([forwarderId, fieldName, version])
  @@index([forwarderId])
  @@index([fieldName])
  @@index([status])
  @@map("mapping_rules")
}

enum ExtractionType {
  REGEX           // 正則表達式
  POSITION        // 位置提取（座標）
  KEYWORD         // 關鍵字匹配
  AI_PROMPT       // AI 提示詞
  TEMPLATE        // 模板匹配
}

enum RuleStatus {
  DRAFT           // 草稿
  PENDING_REVIEW  // 待審核
  ACTIVE          // 生效中
  DEPRECATED      // 已棄用
}

// ===== 規則應用記錄（用於統計） =====

model RuleApplication {
  id             String    @id @default(uuid())
  ruleId         String    @map("rule_id")
  ruleVersion    Int       @map("rule_version")
  documentId     String    @map("document_id")
  fieldName      String    @map("field_name")
  extractedValue String?   @map("extracted_value")
  isAccurate     Boolean?  @map("is_accurate")  // null = 未驗證
  verifiedAt     DateTime? @map("verified_at")
  createdAt      DateTime  @default(now()) @map("created_at")

  rule     MappingRule @relation(fields: [ruleId], references: [id])
  document Document    @relation(fields: [documentId], references: [id])

  @@index([ruleId, ruleVersion])
  @@index([createdAt])
  @@map("rule_applications")
}

// ===== 規則版本歷史 =====

model RuleVersion {
  id             String         @id @default(uuid())
  ruleId         String         @map("rule_id")
  version        Int
  extractionType ExtractionType @map("extraction_type")
  pattern        String?
  confidence     Float          @default(0.8)
  priority       Int            @default(0)
  changeReason   String?        @map("change_reason")
  createdBy      String         @map("created_by")
  createdAt      DateTime       @default(now()) @map("created_at")

  rule    MappingRule @relation(fields: [ruleId], references: [id])
  creator User        @relation("VersionCreator", fields: [createdBy], references: [id])

  @@unique([ruleId, version])
  @@index([ruleId])
  @@map("rule_versions")
}
```

---

### Phase 2: Type Definitions (AC1, AC2)

**File**: `src/types/rule.ts`

```typescript
import { ExtractionType, RuleStatus } from '@prisma/client'

// ===== 規則列表類型 =====

// 列表查詢參數
export interface RulesQueryParams {
  forwarderId?: string
  fieldName?: string
  status?: RuleStatus
  page?: number
  pageSize?: number
  sortBy?: 'createdAt' | 'updatedAt' | 'priority' | 'fieldName'
  sortOrder?: 'asc' | 'desc'
}

// 規則列表項
export interface RuleListItem {
  id: string
  forwarder: {
    id: string
    name: string
    code: string
  }
  fieldName: string
  extractionType: ExtractionType
  status: RuleStatus
  version: number
  priority: number
  createdBy: {
    id: string
    name: string
  }
  createdAt: string
  updatedAt: string
  stats: {
    applicationCount: number
    successRate: number | null
    lastAppliedAt: string | null
  }
}

// 規則列表響應
export interface RulesListResponse {
  success: true
  data: {
    rules: RuleListItem[]
    pagination: {
      total: number
      page: number
      pageSize: number
      totalPages: number
    }
    summary: {
      totalRules: number
      activeRules: number
      draftRules: number
      pendingReviewRules: number
    }
  }
}

// ===== 規則詳情類型 =====

export interface RuleDetail {
  id: string
  forwarder: {
    id: string
    name: string
    code: string
    logoUrl?: string
  }
  fieldName: string
  extractionType: ExtractionType
  pattern: string | null
  confidence: number
  priority: number
  status: RuleStatus
  version: number
  description: string | null
  createdBy: {
    id: string
    name: string
    email: string
  }
  createdAt: string
  updatedAt: string
  stats: RuleStats
  recentApplications: RecentApplication[]
}

export interface RuleStats {
  totalApplications: number
  successfulApplications: number
  successRate: number | null
  last7DaysApplications: number
  last7DaysSuccessRate: number | null
  averageConfidence: number
  trend: 'up' | 'down' | 'stable'
  trendPercentage: number
}

export interface RecentApplication {
  id: string
  documentId: string
  documentName: string
  extractedValue: string | null
  isAccurate: boolean | null
  appliedAt: string
}

// ===== 提取類型配置 =====

export const EXTRACTION_TYPES: {
  value: ExtractionType
  label: string
  description: string
  icon: string
  color: string
}[] = [
  {
    value: 'REGEX',
    label: '正則表達式',
    description: '使用正則表達式匹配文字模式',
    icon: 'Regex',
    color: 'blue'
  },
  {
    value: 'POSITION',
    label: '位置提取',
    description: '根據 PDF 座標位置提取',
    icon: 'Target',
    color: 'green'
  },
  {
    value: 'KEYWORD',
    label: '關鍵字匹配',
    description: '根據關鍵字定位提取',
    icon: 'Search',
    color: 'yellow'
  },
  {
    value: 'AI_PROMPT',
    label: 'AI 提示詞',
    description: '使用 LLM 智能提取',
    icon: 'Brain',
    color: 'purple'
  },
  {
    value: 'TEMPLATE',
    label: '模板匹配',
    description: '根據預定義模板提取',
    icon: 'Layout',
    color: 'orange'
  }
]

// ===== 規則狀態配置 =====

export const RULE_STATUSES: {
  value: RuleStatus
  label: string
  description: string
  color: string
}[] = [
  {
    value: 'ACTIVE',
    label: '生效中',
    description: '規則正在被系統使用',
    color: 'success'
  },
  {
    value: 'DRAFT',
    label: '草稿',
    description: '規則尚未啟用',
    color: 'secondary'
  },
  {
    value: 'PENDING_REVIEW',
    label: '待審核',
    description: '規則等待 Super User 審核',
    color: 'warning'
  },
  {
    value: 'DEPRECATED',
    label: '已棄用',
    description: '規則已被新版本取代',
    color: 'muted'
  }
]

// ===== 標準欄位名稱 =====

export const STANDARD_FIELD_NAMES: {
  name: string
  label: string
  category: string
}[] = [
  { name: 'invoice_number', label: '發票號碼', category: 'basic' },
  { name: 'invoice_date', label: '發票日期', category: 'basic' },
  { name: 'due_date', label: '到期日', category: 'basic' },
  { name: 'total_amount', label: '總金額', category: 'amount' },
  { name: 'currency', label: '幣別', category: 'amount' },
  { name: 'tax_amount', label: '稅額', category: 'amount' },
  { name: 'shipper_name', label: '發貨人名稱', category: 'party' },
  { name: 'consignee_name', label: '收貨人名稱', category: 'party' },
  { name: 'container_number', label: '貨櫃號', category: 'logistics' },
  { name: 'bl_number', label: '提單號', category: 'logistics' },
  { name: 'vessel_name', label: '船名', category: 'logistics' },
  { name: 'voyage_number', label: '航次', category: 'logistics' },
  { name: 'port_of_loading', label: '裝貨港', category: 'logistics' },
  { name: 'port_of_discharge', label: '卸貨港', category: 'logistics' }
]
```

---

### Phase 3: API Layer (AC1, AC2)

#### 4.3.1 規則列表 API

**File**: `src/app/api/rules/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PERMISSIONS } from '@/lib/permissions'
import { RuleStatus } from '@prisma/client'

// GET /api/rules - 獲取規則列表
export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
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

  // 權限檢查
  const hasPermission = session.user.roles?.some(r =>
    r.permissions.includes(PERMISSIONS.RULE_VIEW)
  )

  if (!hasPermission) {
    return NextResponse.json({
      success: false,
      error: {
        type: 'forbidden',
        title: 'Forbidden',
        status: 403,
        detail: 'RULE_VIEW permission required'
      }
    }, { status: 403 })
  }

  try {
    const { searchParams } = new URL(request.url)

    // 解析查詢參數
    const forwarderId = searchParams.get('forwarderId') || undefined
    const fieldName = searchParams.get('fieldName') || undefined
    const status = searchParams.get('status') as RuleStatus | undefined
    const page = parseInt(searchParams.get('page') || '1')
    const pageSize = Math.min(parseInt(searchParams.get('pageSize') || '20'), 100)
    const sortBy = (searchParams.get('sortBy') as string) || 'updatedAt'
    const sortOrder = (searchParams.get('sortOrder') as 'asc' | 'desc') || 'desc'

    // 構建查詢條件
    const where: any = {}
    if (forwarderId) where.forwarderId = forwarderId
    if (fieldName) {
      where.fieldName = {
        contains: fieldName,
        mode: 'insensitive'
      }
    }
    if (status) where.status = status

    // 計算分頁
    const skip = (page - 1) * pageSize

    // 構建排序
    const orderBy: any = {}
    if (sortBy === 'fieldName') {
      orderBy.fieldName = sortOrder
    } else if (sortBy === 'priority') {
      orderBy.priority = sortOrder
    } else if (sortBy === 'createdAt') {
      orderBy.createdAt = sortOrder
    } else {
      orderBy.updatedAt = sortOrder
    }

    // 並行查詢
    const [rules, total, summary] = await Promise.all([
      // 規則列表
      prisma.mappingRule.findMany({
        where,
        skip,
        take: pageSize,
        orderBy,
        include: {
          forwarder: {
            select: {
              id: true,
              name: true,
              code: true
            }
          },
          creator: {
            select: {
              id: true,
              name: true
            }
          },
          applications: {
            where: {
              isAccurate: { not: null }
            },
            select: {
              isAccurate: true,
              createdAt: true
            },
            orderBy: { createdAt: 'desc' },
            take: 100  // 取最近 100 筆計算統計
          }
        }
      }),
      // 總數
      prisma.mappingRule.count({ where }),
      // 狀態摘要
      prisma.mappingRule.groupBy({
        by: ['status'],
        _count: { id: true }
      })
    ])

    // 處理統計資料
    const rulesWithStats = rules.map(rule => {
      const apps = rule.applications
      const totalApps = apps.length
      const successApps = apps.filter(a => a.isAccurate).length
      const lastApp = apps[0]

      return {
        id: rule.id,
        forwarder: rule.forwarder,
        fieldName: rule.fieldName,
        extractionType: rule.extractionType,
        status: rule.status,
        version: rule.version,
        priority: rule.priority,
        createdBy: rule.creator,
        createdAt: rule.createdAt.toISOString(),
        updatedAt: rule.updatedAt.toISOString(),
        stats: {
          applicationCount: totalApps,
          successRate: totalApps > 0 ? (successApps / totalApps) * 100 : null,
          lastAppliedAt: lastApp?.createdAt.toISOString() || null
        }
      }
    })

    // 處理摘要
    const summaryMap = summary.reduce((acc, s) => {
      acc[s.status] = s._count.id
      return acc
    }, {} as Record<string, number>)

    return NextResponse.json({
      success: true,
      data: {
        rules: rulesWithStats,
        pagination: {
          total,
          page,
          pageSize,
          totalPages: Math.ceil(total / pageSize)
        },
        summary: {
          totalRules: total,
          activeRules: summaryMap['ACTIVE'] || 0,
          draftRules: summaryMap['DRAFT'] || 0,
          pendingReviewRules: summaryMap['PENDING_REVIEW'] || 0
        }
      }
    })

  } catch (error) {
    console.error('Failed to fetch rules:', error)
    return NextResponse.json({
      success: false,
      error: {
        type: 'internal_error',
        title: 'Internal Server Error',
        status: 500,
        detail: 'Failed to fetch rules'
      }
    }, { status: 500 })
  }
}
```

#### 4.3.2 規則詳情 API

**File**: `src/app/api/rules/[id]/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PERMISSIONS } from '@/lib/permissions'

interface RouteParams {
  params: { id: string }
}

// GET /api/rules/[id] - 獲取規則詳情
export async function GET(request: NextRequest, { params }: RouteParams) {
  const session = await auth()
  if (!session?.user?.id) {
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

  // 權限檢查
  const hasPermission = session.user.roles?.some(r =>
    r.permissions.includes(PERMISSIONS.RULE_VIEW)
  )

  if (!hasPermission) {
    return NextResponse.json({
      success: false,
      error: {
        type: 'forbidden',
        title: 'Forbidden',
        status: 403,
        detail: 'RULE_VIEW permission required'
      }
    }, { status: 403 })
  }

  const { id: ruleId } = params

  try {
    const rule = await prisma.mappingRule.findUnique({
      where: { id: ruleId },
      include: {
        forwarder: {
          select: {
            id: true,
            name: true,
            code: true,
            logoUrl: true
          }
        },
        creator: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    })

    if (!rule) {
      return NextResponse.json({
        success: false,
        error: {
          type: 'not_found',
          title: 'Not Found',
          status: 404,
          detail: `Rule ${ruleId} not found`
        }
      }, { status: 404 })
    }

    // 計算統計資料
    const now = new Date()
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)

    const [allApps, last7DaysApps, prev7DaysApps, recentApps] = await Promise.all([
      // 所有應用記錄統計
      prisma.ruleApplication.aggregate({
        where: {
          ruleId,
          isAccurate: { not: null }
        },
        _count: { id: true },
        _avg: { isAccurate: true }
      }),
      // 最近 7 天
      prisma.ruleApplication.findMany({
        where: {
          ruleId,
          isAccurate: { not: null },
          createdAt: { gte: sevenDaysAgo }
        },
        select: { isAccurate: true }
      }),
      // 前 7 天（用於計算趨勢）
      prisma.ruleApplication.findMany({
        where: {
          ruleId,
          isAccurate: { not: null },
          createdAt: {
            gte: fourteenDaysAgo,
            lt: sevenDaysAgo
          }
        },
        select: { isAccurate: true }
      }),
      // 最近應用記錄
      prisma.ruleApplication.findMany({
        where: { ruleId },
        include: {
          document: {
            select: {
              id: true,
              fileName: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: 10
      })
    ])

    // 計算趨勢
    const last7Rate = last7DaysApps.length > 0
      ? last7DaysApps.filter(a => a.isAccurate).length / last7DaysApps.length
      : null
    const prev7Rate = prev7DaysApps.length > 0
      ? prev7DaysApps.filter(a => a.isAccurate).length / prev7DaysApps.length
      : null

    let trend: 'up' | 'down' | 'stable' = 'stable'
    let trendPercentage = 0

    if (last7Rate !== null && prev7Rate !== null) {
      const diff = last7Rate - prev7Rate
      if (diff > 0.02) {
        trend = 'up'
        trendPercentage = diff * 100
      } else if (diff < -0.02) {
        trend = 'down'
        trendPercentage = Math.abs(diff) * 100
      }
    }

    const totalApps = allApps._count.id || 0
    const successRate = totalApps > 0 ? (allApps._avg.isAccurate || 0) * 100 : null

    return NextResponse.json({
      success: true,
      data: {
        id: rule.id,
        forwarder: rule.forwarder,
        fieldName: rule.fieldName,
        extractionType: rule.extractionType,
        pattern: rule.pattern,
        confidence: rule.confidence,
        priority: rule.priority,
        status: rule.status,
        version: rule.version,
        description: rule.description,
        createdBy: rule.creator,
        createdAt: rule.createdAt.toISOString(),
        updatedAt: rule.updatedAt.toISOString(),
        stats: {
          totalApplications: totalApps,
          successfulApplications: Math.round(totalApps * (successRate || 0) / 100),
          successRate,
          last7DaysApplications: last7DaysApps.length,
          last7DaysSuccessRate: last7Rate !== null ? last7Rate * 100 : null,
          averageConfidence: rule.confidence * 100,
          trend,
          trendPercentage
        },
        recentApplications: recentApps.map(app => ({
          id: app.id,
          documentId: app.document.id,
          documentName: app.document.fileName,
          extractedValue: app.extractedValue,
          isAccurate: app.isAccurate,
          appliedAt: app.createdAt.toISOString()
        }))
      }
    })

  } catch (error) {
    console.error('Failed to fetch rule detail:', error)
    return NextResponse.json({
      success: false,
      error: {
        type: 'internal_error',
        title: 'Internal Server Error',
        status: 500,
        detail: 'Failed to fetch rule detail'
      }
    }, { status: 500 })
  }
}
```

---

### Phase 4: React Query Hooks (AC1, AC2)

#### 4.4.1 規則列表 Hook

**File**: `src/hooks/useRuleList.ts`

```typescript
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { RulesQueryParams, RulesListResponse } from '@/types/rule'

async function fetchRules(params: RulesQueryParams): Promise<RulesListResponse> {
  const searchParams = new URLSearchParams()

  if (params.forwarderId) searchParams.set('forwarderId', params.forwarderId)
  if (params.fieldName) searchParams.set('fieldName', params.fieldName)
  if (params.status) searchParams.set('status', params.status)
  if (params.page) searchParams.set('page', params.page.toString())
  if (params.pageSize) searchParams.set('pageSize', params.pageSize.toString())
  if (params.sortBy) searchParams.set('sortBy', params.sortBy)
  if (params.sortOrder) searchParams.set('sortOrder', params.sortOrder)

  const response = await fetch(`/api/rules?${searchParams}`)
  const result = await response.json()

  if (!result.success) {
    throw new Error(result.error?.detail || 'Failed to fetch rules')
  }

  return result
}

export function useRuleList(params: RulesQueryParams = {}) {
  return useQuery({
    queryKey: ['rules', params],
    queryFn: () => fetchRules(params),
    staleTime: 60 * 1000, // 1 分鐘
    refetchOnWindowFocus: true
  })
}

// 預取功能
export function usePrefetchRules() {
  const queryClient = useQueryClient()

  return (params: RulesQueryParams) => {
    queryClient.prefetchQuery({
      queryKey: ['rules', { ...params, page: (params.page || 1) + 1 }],
      queryFn: () => fetchRules({ ...params, page: (params.page || 1) + 1 })
    })
  }
}
```

#### 4.4.2 規則詳情 Hook

**File**: `src/hooks/useRuleDetail.ts`

```typescript
import { useQuery } from '@tanstack/react-query'
import { RuleDetail } from '@/types/rule'

interface RuleDetailResponse {
  success: true
  data: RuleDetail
}

async function fetchRuleDetail(id: string): Promise<RuleDetailResponse> {
  const response = await fetch(`/api/rules/${id}`)
  const result = await response.json()

  if (!result.success) {
    throw new Error(result.error?.detail || 'Failed to fetch rule detail')
  }

  return result
}

export function useRuleDetail(id: string | undefined) {
  return useQuery({
    queryKey: ['rule', id],
    queryFn: () => fetchRuleDetail(id!),
    enabled: !!id,
    staleTime: 30 * 1000 // 30 秒
  })
}
```

---

### Phase 5: UI Components (AC1, AC2)

#### 4.5.1 規則列表頁面

**File**: `src/app/(dashboard)/rules/page.tsx`

```typescript
import { Suspense } from 'react'
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { PERMISSIONS } from '@/lib/permissions'
import { RuleList } from '@/components/features/rules/RuleList'
import { RuleListSkeleton } from '@/components/features/rules/RuleListSkeleton'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import Link from 'next/link'

export const metadata = {
  title: '映射規則管理 - Document Extraction',
  description: '查看和管理映射規則'
}

export default async function RulesPage() {
  const session = await auth()

  // 權限檢查
  const hasPermission = session?.user?.roles?.some(r =>
    r.permissions.includes(PERMISSIONS.RULE_VIEW)
  )

  if (!hasPermission) {
    redirect('/unauthorized')
  }

  const canCreateRule = session?.user?.roles?.some(r =>
    r.permissions.includes(PERMISSIONS.RULE_MANAGE)
  )

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">映射規則管理</h1>
          <p className="text-muted-foreground">
            查看和管理發票欄位提取規則
          </p>
        </div>
        {canCreateRule && (
          <Button asChild>
            <Link href="/rules/new">
              <Plus className="h-4 w-4 mr-2" />
              建議新規則
            </Link>
          </Button>
        )}
      </div>

      <Suspense fallback={<RuleListSkeleton />}>
        <RuleList />
      </Suspense>
    </div>
  )
}
```

#### 4.5.2 規則列表組件

**File**: `src/components/features/rules/RuleList.tsx`

```typescript
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useRuleList, usePrefetchRules } from '@/hooks/useRuleList'
import { RuleTable } from './RuleTable'
import { RuleFilters } from './RuleFilters'
import { RuleSummaryCards } from './RuleSummaryCards'
import { Pagination } from '@/components/ui/pagination'
import { Button } from '@/components/ui/button'
import { RefreshCw, AlertCircle } from 'lucide-react'
import { RulesQueryParams } from '@/types/rule'
import { RuleStatus } from '@prisma/client'

export function RuleList() {
  const router = useRouter()
  const prefetch = usePrefetchRules()

  const [filters, setFilters] = useState<RulesQueryParams>({
    page: 1,
    pageSize: 20,
    sortBy: 'updatedAt',
    sortOrder: 'desc'
  })

  const { data, isLoading, error, refetch, isRefetching } = useRuleList(filters)

  const handleFilterChange = (key: keyof RulesQueryParams, value: any) => {
    setFilters(prev => ({
      ...prev,
      [key]: value,
      page: key !== 'page' ? 1 : value // 非分頁變更時重置頁碼
    }))
  }

  const handlePageChange = (page: number) => {
    handleFilterChange('page', page)
    // 預取下一頁
    if (page < (data?.data.pagination.totalPages || 0)) {
      prefetch({ ...filters, page: page + 1 })
    }
  }

  const handleRowClick = (ruleId: string) => {
    router.push(`/rules/${ruleId}`)
  }

  if (isLoading) {
    return <RuleListSkeleton />
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center">
        <AlertCircle className="h-12 w-12 text-destructive mb-4" />
        <h3 className="text-lg font-medium">載入失敗</h3>
        <p className="text-sm text-muted-foreground mb-4">{error.message}</p>
        <Button onClick={() => refetch()}>重試</Button>
      </div>
    )
  }

  const { rules, pagination, summary } = data!.data

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
          onForwarderChange={(v) => handleFilterChange('forwarderId', v)}
          onFieldNameChange={(v) => handleFilterChange('fieldName', v)}
          onStatusChange={(v) => handleFilterChange('status', v)}
        />
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isRefetching}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isRefetching ? 'animate-spin' : ''}`} />
          刷新
        </Button>
      </div>

      {/* 規則表格 */}
      <RuleTable
        rules={rules}
        sortBy={filters.sortBy}
        sortOrder={filters.sortOrder}
        onSort={(by, order) => {
          setFilters(prev => ({ ...prev, sortBy: by, sortOrder: order }))
        }}
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
    </div>
  )
}
```

#### 4.5.3 規則表格組件

**File**: `src/components/features/rules/RuleTable.tsx`

```typescript
'use client'

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { RuleStatusBadge } from './RuleStatusBadge'
import { ExtractionTypeIcon } from './ExtractionTypeIcon'
import { RuleListItem } from '@/types/rule'
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { zhTW } from 'date-fns/locale'
import { cn } from '@/lib/utils'

interface RuleTableProps {
  rules: RuleListItem[]
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  onSort: (by: string, order: 'asc' | 'desc') => void
  onRowClick: (ruleId: string) => void
}

export function RuleTable({
  rules,
  sortBy,
  sortOrder,
  onSort,
  onRowClick
}: RuleTableProps) {
  const handleSort = (column: string) => {
    if (sortBy === column) {
      onSort(column, sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      onSort(column, 'desc')
    }
  }

  const SortIcon = ({ column }: { column: string }) => {
    if (sortBy !== column) {
      return <ArrowUpDown className="h-4 w-4 ml-1 text-muted-foreground" />
    }
    return sortOrder === 'asc'
      ? <ArrowUp className="h-4 w-4 ml-1" />
      : <ArrowDown className="h-4 w-4 ml-1" />
  }

  if (rules.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center border rounded-lg">
        <p className="text-muted-foreground">沒有符合條件的規則</p>
      </div>
    )
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[150px]">Forwarder</TableHead>
            <TableHead
              className="cursor-pointer hover:bg-muted/50"
              onClick={() => handleSort('fieldName')}
            >
              <div className="flex items-center">
                欄位名稱
                <SortIcon column="fieldName" />
              </div>
            </TableHead>
            <TableHead className="w-[120px]">提取類型</TableHead>
            <TableHead className="w-[100px]">狀態</TableHead>
            <TableHead className="w-[80px] text-center">版本</TableHead>
            <TableHead
              className="w-[100px] cursor-pointer hover:bg-muted/50"
              onClick={() => handleSort('priority')}
            >
              <div className="flex items-center">
                優先級
                <SortIcon column="priority" />
              </div>
            </TableHead>
            <TableHead className="w-[100px] text-right">成功率</TableHead>
            <TableHead
              className="w-[140px] cursor-pointer hover:bg-muted/50"
              onClick={() => handleSort('updatedAt')}
            >
              <div className="flex items-center">
                更新時間
                <SortIcon column="updatedAt" />
              </div>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rules.map((rule) => (
            <TableRow
              key={rule.id}
              className="cursor-pointer hover:bg-muted/50"
              onClick={() => onRowClick(rule.id)}
            >
              <TableCell>
                <div className="font-medium">{rule.forwarder.name}</div>
                <div className="text-xs text-muted-foreground">
                  {rule.forwarder.code}
                </div>
              </TableCell>
              <TableCell className="font-mono text-sm">
                {rule.fieldName}
              </TableCell>
              <TableCell>
                <ExtractionTypeIcon type={rule.extractionType} showLabel />
              </TableCell>
              <TableCell>
                <RuleStatusBadge status={rule.status} />
              </TableCell>
              <TableCell className="text-center">
                <span className="text-sm font-medium">v{rule.version}</span>
              </TableCell>
              <TableCell>
                <span className={cn(
                  'text-sm',
                  rule.priority > 0 ? 'font-medium' : 'text-muted-foreground'
                )}>
                  {rule.priority}
                </span>
              </TableCell>
              <TableCell className="text-right">
                {rule.stats.successRate !== null ? (
                  <span className={cn(
                    'font-medium',
                    rule.stats.successRate >= 90 ? 'text-green-600' :
                    rule.stats.successRate >= 70 ? 'text-yellow-600' :
                    'text-red-600'
                  )}>
                    {rule.stats.successRate.toFixed(1)}%
                  </span>
                ) : (
                  <span className="text-muted-foreground">--</span>
                )}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {formatDistanceToNow(new Date(rule.updatedAt), {
                  addSuffix: true,
                  locale: zhTW
                })}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
```

#### 4.5.4 規則篩選組件

**File**: `src/components/features/rules/RuleFilters.tsx`

```typescript
'use client'

import { useEffect, useState } from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { X } from 'lucide-react'
import { RuleStatus } from '@prisma/client'
import { RULE_STATUSES } from '@/types/rule'
import { useForwarderList } from '@/hooks/useForwarderList'
import { useDebounce } from '@/hooks/useDebounce'

interface RuleFiltersProps {
  forwarderId?: string
  fieldName?: string
  status?: RuleStatus
  onForwarderChange: (value: string | undefined) => void
  onFieldNameChange: (value: string | undefined) => void
  onStatusChange: (value: RuleStatus | undefined) => void
}

export function RuleFilters({
  forwarderId,
  fieldName,
  status,
  onForwarderChange,
  onFieldNameChange,
  onStatusChange
}: RuleFiltersProps) {
  const { data: forwarders } = useForwarderList()
  const [fieldNameInput, setFieldNameInput] = useState(fieldName || '')
  const debouncedFieldName = useDebounce(fieldNameInput, 300)

  // 處理防抖搜索
  useEffect(() => {
    onFieldNameChange(debouncedFieldName || undefined)
  }, [debouncedFieldName, onFieldNameChange])

  const hasFilters = forwarderId || fieldName || status

  const clearFilters = () => {
    onForwarderChange(undefined)
    onFieldNameChange(undefined)
    onStatusChange(undefined)
    setFieldNameInput('')
  }

  return (
    <div className="flex items-end gap-4 flex-wrap">
      {/* Forwarder 篩選 */}
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Forwarder</Label>
        <Select
          value={forwarderId || 'all'}
          onValueChange={(v) => onForwarderChange(v === 'all' ? undefined : v)}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="全部" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部 Forwarder</SelectItem>
            {forwarders?.map((fw) => (
              <SelectItem key={fw.id} value={fw.id}>
                {fw.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* 欄位名稱搜索 */}
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">欄位名稱</Label>
        <Input
          placeholder="搜索欄位..."
          value={fieldNameInput}
          onChange={(e) => setFieldNameInput(e.target.value)}
          className="w-[180px]"
        />
      </div>

      {/* 狀態篩選 */}
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">狀態</Label>
        <Select
          value={status || 'all'}
          onValueChange={(v) => onStatusChange(v === 'all' ? undefined : v as RuleStatus)}
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="全部" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部狀態</SelectItem>
            {RULE_STATUSES.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* 清除篩選 */}
      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={clearFilters}>
          <X className="h-4 w-4 mr-1" />
          清除
        </Button>
      )}
    </div>
  )
}
```

#### 4.5.5 規則詳情頁面

**File**: `src/app/(dashboard)/rules/[id]/page.tsx`

```typescript
import { Suspense } from 'react'
import { auth } from '@/lib/auth'
import { redirect, notFound } from 'next/navigation'
import { PERMISSIONS } from '@/lib/permissions'
import { prisma } from '@/lib/prisma'
import { RuleDetailView } from '@/components/features/rules/RuleDetailView'
import { Skeleton } from '@/components/ui/skeleton'

interface PageProps {
  params: { id: string }
}

export async function generateMetadata({ params }: PageProps) {
  const rule = await prisma.mappingRule.findUnique({
    where: { id: params.id },
    include: {
      forwarder: { select: { name: true } }
    }
  })

  return {
    title: rule
      ? `${rule.forwarder.name} - ${rule.fieldName} | 規則詳情`
      : '規則詳情',
    description: '查看映射規則詳情和統計'
  }
}

export default async function RuleDetailPage({ params }: PageProps) {
  const session = await auth()

  // 權限檢查
  const hasPermission = session?.user?.roles?.some(r =>
    r.permissions.includes(PERMISSIONS.RULE_VIEW)
  )

  if (!hasPermission) {
    redirect('/unauthorized')
  }

  // 驗證規則存在
  const exists = await prisma.mappingRule.findUnique({
    where: { id: params.id },
    select: { id: true }
  })

  if (!exists) {
    notFound()
  }

  return (
    <div className="container mx-auto py-6">
      <Suspense fallback={<RuleDetailSkeleton />}>
        <RuleDetailView ruleId={params.id} />
      </Suspense>
    </div>
  )
}

function RuleDetailSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-10 w-1/3" />
      <div className="grid grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
      <Skeleton className="h-64" />
    </div>
  )
}
```

#### 4.5.6 規則詳情視圖

**File**: `src/components/features/rules/RuleDetailView.tsx`

```typescript
'use client'

import { useRouter } from 'next/navigation'
import { useRuleDetail } from '@/hooks/useRuleDetail'
import { RuleStatusBadge } from './RuleStatusBadge'
import { ExtractionTypeIcon } from './ExtractionTypeIcon'
import { RuleStats } from './RuleStats'
import { RulePatternViewer } from './RulePatternViewer'
import { RecentApplicationsTable } from './RecentApplicationsTable'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  ArrowLeft,
  History,
  Settings,
  Activity,
  FileText,
  AlertCircle
} from 'lucide-react'
import Link from 'next/link'

interface RuleDetailViewProps {
  ruleId: string
}

export function RuleDetailView({ ruleId }: RuleDetailViewProps) {
  const router = useRouter()
  const { data, isLoading, error } = useRuleDetail(ruleId)

  if (isLoading) {
    return <div>載入中...</div>
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center">
        <AlertCircle className="h-12 w-12 text-destructive mb-4" />
        <h3 className="text-lg font-medium">載入失敗</h3>
        <p className="text-sm text-muted-foreground">{error?.message}</p>
      </div>
    )
  }

  const rule = data.data

  return (
    <div className="space-y-6">
      {/* 標頭 */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/rules')}
            className="mb-2 -ml-2"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            返回列表
          </Button>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">
              {rule.forwarder.name} - {rule.fieldName}
            </h1>
            <RuleStatusBadge status={rule.status} />
          </div>
          <p className="text-muted-foreground">
            {rule.description || '無描述'}
          </p>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href={`/rules/${ruleId}/history`}>
              <History className="h-4 w-4 mr-2" />
              版本歷史
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href={`/rules/${ruleId}/edit`}>
              <Settings className="h-4 w-4 mr-2" />
              編輯
            </Link>
          </Button>
        </div>
      </div>

      {/* 基本資訊卡片 */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              提取類型
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ExtractionTypeIcon type={rule.extractionType} showLabel size="lg" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              版本
            </CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-2xl font-bold">v{rule.version}</span>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              優先級
            </CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-2xl font-bold">{rule.priority}</span>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              信心度閾值
            </CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-2xl font-bold">{rule.confidence * 100}%</span>
          </CardContent>
        </Card>
      </div>

      {/* 統計資訊 */}
      <RuleStats stats={rule.stats} />

      {/* 詳細內容標籤頁 */}
      <Tabs defaultValue="pattern" className="space-y-4">
        <TabsList>
          <TabsTrigger value="pattern">
            <FileText className="h-4 w-4 mr-2" />
            提取模式
          </TabsTrigger>
          <TabsTrigger value="applications">
            <Activity className="h-4 w-4 mr-2" />
            應用記錄
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pattern">
          <Card>
            <CardHeader>
              <CardTitle>提取模式詳情</CardTitle>
            </CardHeader>
            <CardContent>
              <RulePatternViewer
                type={rule.extractionType}
                pattern={rule.pattern}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="applications">
          <Card>
            <CardHeader>
              <CardTitle>最近應用記錄</CardTitle>
            </CardHeader>
            <CardContent>
              <RecentApplicationsTable applications={rule.recentApplications} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* 元資料 */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">創建者：</span>
              <span className="ml-2">{rule.createdBy.name}</span>
            </div>
            <div>
              <span className="text-muted-foreground">創建時間：</span>
              <span className="ml-2">{new Date(rule.createdAt).toLocaleString('zh-TW')}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Forwarder：</span>
              <span className="ml-2">{rule.forwarder.name} ({rule.forwarder.code})</span>
            </div>
            <div>
              <span className="text-muted-foreground">更新時間：</span>
              <span className="ml-2">{new Date(rule.updatedAt).toLocaleString('zh-TW')}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
```

---

## 5. Testing Guide

### 5.1 Integration Tests

**File**: `tests/integration/api/rules.test.ts`

```typescript
import { GET } from '@/app/api/rules/route'
import { GET as GET_DETAIL } from '@/app/api/rules/[id]/route'
import { NextRequest } from 'next/server'

describe('Rules API', () => {
  describe('GET /api/rules', () => {
    it('should return rule list for authorized user', async () => {
      const request = new NextRequest('http://localhost/api/rules')
      const response = await GET(request)
      const data = await response.json()

      expect(data.success).toBe(true)
      expect(Array.isArray(data.data.rules)).toBe(true)
      expect(data.data.pagination).toBeDefined()
      expect(data.data.summary).toBeDefined()
    })

    it('should filter by forwarderId', async () => {
      const request = new NextRequest('http://localhost/api/rules?forwarderId=test-forwarder')
      const response = await GET(request)
      const data = await response.json()

      data.data.rules.forEach((rule: any) => {
        expect(rule.forwarder.id).toBe('test-forwarder')
      })
    })

    it('should filter by status', async () => {
      const request = new NextRequest('http://localhost/api/rules?status=ACTIVE')
      const response = await GET(request)
      const data = await response.json()

      data.data.rules.forEach((rule: any) => {
        expect(rule.status).toBe('ACTIVE')
      })
    })

    it('should support pagination', async () => {
      const request = new NextRequest('http://localhost/api/rules?page=2&pageSize=10')
      const response = await GET(request)
      const data = await response.json()

      expect(data.data.pagination.page).toBe(2)
      expect(data.data.pagination.pageSize).toBe(10)
    })

    it('should return 403 for unauthorized user', async () => {
      // Mock unauthorized session
      const request = new NextRequest('http://localhost/api/rules')
      const response = await GET(request)

      expect(response.status).toBe(403)
    })
  })

  describe('GET /api/rules/[id]', () => {
    it('should return rule detail', async () => {
      const request = new NextRequest('http://localhost/api/rules/test-rule-id')
      const response = await GET_DETAIL(request, { params: { id: 'test-rule-id' } })
      const data = await response.json()

      expect(data.success).toBe(true)
      expect(data.data.id).toBe('test-rule-id')
      expect(data.data.stats).toBeDefined()
      expect(data.data.recentApplications).toBeDefined()
    })

    it('should return 404 for non-existent rule', async () => {
      const request = new NextRequest('http://localhost/api/rules/non-existent')
      const response = await GET_DETAIL(request, { params: { id: 'non-existent' } })

      expect(response.status).toBe(404)
    })
  })
})
```

### 5.2 E2E Tests

**File**: `tests/e2e/rules.spec.ts`

```typescript
import { test, expect } from '@playwright/test'

test.describe('Rule Management', () => {
  test.beforeEach(async ({ page }) => {
    // Login as super user
    await page.goto('/login')
    await page.fill('[name="email"]', 'superuser@example.com')
    await page.fill('[name="password"]', 'password')
    await page.click('button[type="submit"]')
    await page.waitForURL('/dashboard')
  })

  test('should display rule list', async ({ page }) => {
    await page.goto('/rules')

    await expect(page.getByRole('heading', { name: '映射規則管理' })).toBeVisible()
    await expect(page.getByTestId('rule-table')).toBeVisible()
  })

  test('should filter by forwarder', async ({ page }) => {
    await page.goto('/rules')

    await page.getByLabel('Forwarder').click()
    await page.getByText('DHL').click()

    // 等待表格更新
    await page.waitForResponse(resp =>
      resp.url().includes('/api/rules') && resp.status() === 200
    )

    const rows = page.getByTestId('rule-row')
    for (const row of await rows.all()) {
      await expect(row.getByText('DHL')).toBeVisible()
    }
  })

  test('should navigate to rule detail', async ({ page }) => {
    await page.goto('/rules')

    await page.getByTestId('rule-row').first().click()

    await expect(page.getByTestId('rule-detail')).toBeVisible()
    await expect(page.getByText('提取模式')).toBeVisible()
    await expect(page.getByText('應用記錄')).toBeVisible()
  })

  test('should show rule statistics', async ({ page }) => {
    await page.goto('/rules/test-rule-id')

    await expect(page.getByTestId('rule-stats')).toBeVisible()
    await expect(page.getByText('成功率')).toBeVisible()
    await expect(page.getByText('應用次數')).toBeVisible()
  })
})
```

---

## 6. Verification Checklist

### 6.1 Acceptance Criteria Verification

- [ ] **AC1**: 規則列表顯示
  - [ ] 顯示所有映射規則
  - [ ] 支援按 Forwarder 篩選
  - [ ] 支援按欄位名稱搜索
  - [ ] 支援按狀態篩選
  - [ ] 顯示版本號
  - [ ] 顯示最後更新時間

- [ ] **AC2**: 規則詳情查看
  - [ ] 顯示提取模式詳情
  - [ ] 顯示適用 Forwarder
  - [ ] 顯示創建人資訊
  - [ ] 顯示應用統計（次數、成功率）

### 6.2 Technical Verification

- [ ] API 響應符合 RFC 7807 格式
- [ ] 權限檢查正確（RULE_VIEW）
- [ ] 分頁功能正常
- [ ] 排序功能正常

### 6.3 UI/UX Verification

- [ ] 表格響應式適配
- [ ] 載入狀態顯示
- [ ] 錯誤處理正確
- [ ] 篩選即時生效

---

## 7. Files to Create/Modify

| File Path | Action | Description |
|-----------|--------|-------------|
| `prisma/schema.prisma` | Modify | 添加 MappingRule、RuleVersion、RuleApplication |
| `src/types/rule.ts` | Create | 規則相關類型定義 |
| `src/app/api/rules/route.ts` | Create | 規則列表 API |
| `src/app/api/rules/[id]/route.ts` | Create | 規則詳情 API |
| `src/hooks/useRuleList.ts` | Create | 規則列表 Hook |
| `src/hooks/useRuleDetail.ts` | Create | 規則詳情 Hook |
| `src/app/(dashboard)/rules/page.tsx` | Create | 規則列表頁面 |
| `src/app/(dashboard)/rules/[id]/page.tsx` | Create | 規則詳情頁面 |
| `src/components/features/rules/RuleList.tsx` | Create | 列表組件 |
| `src/components/features/rules/RuleTable.tsx` | Create | 表格組件 |
| `src/components/features/rules/RuleFilters.tsx` | Create | 篩選組件 |
| `src/components/features/rules/RuleDetailView.tsx` | Create | 詳情視圖 |
| `src/components/features/rules/RuleStatusBadge.tsx` | Create | 狀態標籤 |
| `src/components/features/rules/ExtractionTypeIcon.tsx` | Create | 類型圖標 |
| `src/lib/permissions.ts` | Modify | 添加 RULE_VIEW 權限 |

---

*Tech Spec Created: 2025-12-16*
*Story Reference: 4-1-mapping-rule-list-view*
