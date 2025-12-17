# Tech Spec: Story 3-8 Super User 處理升級案例

## 1. Overview

### 1.1 Story Reference
- **Story ID**: 3.8
- **Title**: Super User 處理升級案例
- **Epic**: Epic 3 - 發票審核與修正工作流

### 1.2 Story Description
作為 Super User，我希望處理數據處理員升級的複雜案例，以便特殊情況可以得到正確處理。

### 1.3 Dependencies
- **Story 3-7**: 升級複雜案例（提供 Escalation 模型和升級機制）
- **Story 3-5**: 修正提取結果（審核界面共用）
- **Epic 4 連接**: 規則管理功能（RuleSuggestion 創建）

---

## 2. Acceptance Criteria Mapping

| AC ID | Description | Implementation Approach |
|-------|-------------|------------------------|
| AC1 | 升級案例列表 | EscalationsPage + GET /api/escalations |
| AC2 | 查看案例詳情 | EscalationDetailPage + 完整審核界面 |
| AC3 | 完成處理 | POST /api/escalations/[id]/resolve + 決策記錄 |
| AC4 | 創建規則建議 | CreateRuleButton + RuleSuggestion 預填 |

---

## 3. Architecture Overview

### 3.1 Super User Escalation Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    Super User 處理升級案例流程                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Super User 登入                                                             │
│         │                                                                    │
│         ▼                                                                    │
│  ┌──────────────────┐                                                        │
│  │ /escalations     │ ◄─── 升級案例列表頁面                                   │
│  │ • 待處理案例     │                                                        │
│  │ • 篩選 (狀態/原因)│                                                        │
│  │ • 排序 (時間/優先)│                                                        │
│  └────────┬─────────┘                                                        │
│           │ 點擊案例                                                         │
│           ▼                                                                  │
│  ┌──────────────────┐                                                        │
│  │ /escalations/[id]│ ◄─── 案例詳情頁面                                      │
│  │ • 升級原因/備註  │                                                        │
│  │ • PDF 並排審核   │                                                        │
│  │ • 完整編輯功能   │                                                        │
│  └────────┬─────────┘                                                        │
│           │                                                                  │
│           ├──────────────────────┬──────────────────────────┐               │
│           ▼                      ▼                          ▼               │
│  ┌────────────────┐    ┌────────────────┐        ┌────────────────┐         │
│  │ 核准 (APPROVED)│    │ 修正 (CORRECTED)│        │ 拒絕 (REJECTED)│         │
│  └───────┬────────┘    └───────┬────────┘        └───────┬────────┘         │
│          │                     │                         │                  │
│          └─────────────────────┼─────────────────────────┘                  │
│                                │                                            │
│                                ▼                                            │
│                    ┌──────────────────────┐                                 │
│                    │ 是否創建規則建議？    │ ◄─── 可選                        │
│                    └──────────┬───────────┘                                 │
│                               │ 是                                          │
│                               ▼                                             │
│                    ┌──────────────────────┐                                 │
│                    │ 創建 RuleSuggestion  │ ◄─── 連結 Epic 4                 │
│                    │ • 預填欄位/模式      │                                 │
│                    │ • 關聯 Forwarder     │                                 │
│                    └──────────────────────┘                                 │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │ POST /api/escalations/[id]/resolve                                    │   │
│  │ • 更新 Escalation.status → RESOLVED                                   │   │
│  │ • 更新 Document.status → APPROVED / REJECTED                          │   │
│  │ • 記錄 ReviewRecord (decision, notes)                                 │   │
│  │ • 可選創建 RuleSuggestion                                             │   │
│  │ • 審計日誌                                                            │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Component Architecture

```
src/
├── app/(dashboard)/escalations/
│   ├── page.tsx                         # 升級案例列表頁面
│   └── [id]/
│       └── page.tsx                     # 案例詳情頁面
├── app/api/escalations/
│   ├── route.ts                         # GET 升級案例列表 API
│   └── [id]/
│       └── resolve/
│           └── route.ts                 # POST 處理完成 API
├── components/features/escalation/
│   ├── EscalationList.tsx               # 升級案例列表組件
│   ├── EscalationCard.tsx               # 單一案例卡片
│   ├── EscalationHeader.tsx             # 案例詳情標頭
│   ├── EscalationInfo.tsx               # 升級原因顯示
│   ├── ResolveDialog.tsx                # 處理決策對話框
│   └── CreateRuleButton.tsx             # 創建規則按鈕
├── hooks/
│   ├── useEscalationList.ts             # 列表查詢 Hook
│   ├── useEscalationDetail.ts           # 詳情查詢 Hook
│   └── useResolveEscalation.ts          # 處理完成 Hook
└── types/
    └── escalation.ts                    # 擴展升級相關類型 (Story 3-7 基礎)
```

---

## 4. Implementation Guide

### Phase 1: Type Extensions (AC1-AC4)

**File**: `src/types/escalation.ts` (擴展 Story 3-7 定義)

```typescript
import { EscalationReason, EscalationStatus } from '@prisma/client'

// ===== 從 Story 3-7 繼承的類型 =====
// EscalateRequest, EscalateResponse, ESCALATION_REASONS, EscalationListItem

// ===== Story 3-8 新增類型 =====

// 處理決策枚舉
export type ResolveDecision = 'APPROVED' | 'CORRECTED' | 'REJECTED'

// 處理完成請求
export interface ResolveEscalationRequest {
  decision: ResolveDecision
  corrections?: {
    fieldName: string
    originalValue: string | null
    correctedValue: string
    correctionType: 'NORMAL' | 'EXCEPTION'
  }[]
  notes?: string
  createRule?: {
    fieldName: string
    suggestedPattern: string
    description?: string
  }
}

// 處理完成響應
export interface ResolveEscalationResponse {
  success: true
  data: {
    escalationId: string
    documentId: string
    decision: ResolveDecision
    resolvedAt: string
    ruleSuggestionId?: string
  }
}

// 升級案例詳情
export interface EscalationDetail {
  id: string
  status: EscalationStatus
  reason: EscalationReason
  reasonDetail: string | null
  createdAt: string
  resolvedAt: string | null
  resolution: string | null
  escalatedBy: {
    id: string
    name: string
    email: string
  }
  assignee: {
    id: string
    name: string
  } | null
  document: {
    id: string
    fileName: string
    originalName: string | null
    fileUrl: string
    status: string
    forwarder: {
      id: string
      name: string
      code: string
    } | null
    extractionResult: {
      fields: {
        name: string
        value: string | null
        confidence: number
        sourcePosition?: {
          page: number
          x: number
          y: number
          width: number
          height: number
        }
      }[]
    } | null
  }
  corrections: {
    id: string
    fieldName: string
    originalValue: string | null
    correctedValue: string
    correctionType: string
  }[]
}

// 列表查詢參數
export interface EscalationListParams {
  status?: EscalationStatus
  reason?: EscalationReason
  page?: number
  pageSize?: number
  sortBy?: 'createdAt' | 'priority'
  sortOrder?: 'asc' | 'desc'
}

// 決策選項配置
export const RESOLVE_DECISIONS: {
  value: ResolveDecision
  label: string
  description: string
  color: string
}[] = [
  {
    value: 'APPROVED',
    label: '核准',
    description: '確認提取結果正確，無需修改',
    color: 'success'
  },
  {
    value: 'CORRECTED',
    label: '修正後核准',
    description: '修正錯誤後核准此文件',
    color: 'warning'
  },
  {
    value: 'REJECTED',
    label: '拒絕',
    description: '文件無法處理，標記為拒絕',
    color: 'destructive'
  }
]

// 統計資訊
export interface EscalationStats {
  total: number
  pending: number
  inProgress: number
  resolved: number
  averageResolutionTime: number // 秒
}
```

---

### Phase 2: Prisma Schema Update

**File**: `prisma/schema.prisma` (確認 / 擴展)

```prisma
// ===== Story 3-7 已定義的模型，確認完整性 =====

model Escalation {
  id            String           @id @default(uuid())
  documentId    String           @unique @map("document_id")
  escalatedBy   String           @map("escalated_by")
  reason        EscalationReason
  reasonDetail  String?          @map("reason_detail")
  status        EscalationStatus @default(PENDING)
  assignedTo    String?          @map("assigned_to")
  resolution    String?          // 處理決策說明
  resolvedBy    String?          @map("resolved_by")  // Story 3-8 新增
  createdAt     DateTime         @default(now()) @map("created_at")
  resolvedAt    DateTime?        @map("resolved_at")

  document       Document  @relation(fields: [documentId], references: [id])
  escalator      User      @relation("Escalator", fields: [escalatedBy], references: [id])
  assignee       User?     @relation("Assignee", fields: [assignedTo], references: [id])
  resolver       User?     @relation("Resolver", fields: [resolvedBy], references: [id])
  ruleSuggestion RuleSuggestion? @relation("EscalationRule")

  @@index([status])
  @@index([assignedTo])
  @@index([resolvedBy])
  @@map("escalations")
}

// RuleSuggestion 模型 (連接 Epic 4)
model RuleSuggestion {
  id              String              @id @default(uuid())
  forwarderId     String              @map("forwarder_id")
  fieldName       String              @map("field_name")
  suggestedPattern String             @map("suggested_pattern")
  description     String?
  status          RuleSuggestionStatus @default(PENDING)
  suggestedBy     String              @map("suggested_by")
  escalationId    String?             @unique @map("escalation_id")
  createdAt       DateTime            @default(now()) @map("created_at")
  reviewedAt      DateTime?           @map("reviewed_at")
  reviewedBy      String?             @map("reviewed_by")

  forwarder  Forwarder   @relation(fields: [forwarderId], references: [id])
  suggester  User        @relation("Suggester", fields: [suggestedBy], references: [id])
  reviewer   User?       @relation("Reviewer", fields: [reviewedBy], references: [id])
  escalation Escalation? @relation("EscalationRule", fields: [escalationId], references: [id])

  @@index([forwarderId])
  @@index([status])
  @@map("rule_suggestions")
}

enum RuleSuggestionStatus {
  PENDING      // 待審核
  APPROVED     // 已核准
  REJECTED     // 已拒絕
  IMPLEMENTED  // 已實施
}
```

---

### Phase 3: API Layer (AC1, AC3)

#### 4.3.1 升級案例列表 API

**File**: `src/app/api/escalations/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PERMISSIONS } from '@/lib/permissions'
import { EscalationStatus, EscalationReason } from '@prisma/client'

interface EscalationListParams {
  status?: EscalationStatus
  reason?: EscalationReason
  page?: number
  pageSize?: number
  sortBy?: 'createdAt' | 'priority'
  sortOrder?: 'asc' | 'desc'
}

// GET /api/escalations - 獲取升級案例列表
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

  // 權限檢查：僅 Super User 可訪問
  const isSuperUser = session.user.roles?.some(r =>
    r.permissions.includes(PERMISSIONS.RULE_MANAGE)
  )

  if (!isSuperUser) {
    return NextResponse.json({
      success: false,
      error: {
        type: 'forbidden',
        title: 'Forbidden',
        status: 403,
        detail: 'Super User permission required'
      }
    }, { status: 403 })
  }

  try {
    const { searchParams } = new URL(request.url)

    const params: EscalationListParams = {
      status: searchParams.get('status') as EscalationStatus | undefined,
      reason: searchParams.get('reason') as EscalationReason | undefined,
      page: parseInt(searchParams.get('page') || '1'),
      pageSize: parseInt(searchParams.get('pageSize') || '20'),
      sortBy: (searchParams.get('sortBy') as 'createdAt' | 'priority') || 'createdAt',
      sortOrder: (searchParams.get('sortOrder') as 'asc' | 'desc') || 'desc'
    }

    // 構建查詢條件
    const where: any = {}
    if (params.status) {
      where.status = params.status
    }
    if (params.reason) {
      where.reason = params.reason
    }

    // 計算分頁
    const skip = (params.page! - 1) * params.pageSize!
    const take = params.pageSize!

    // 並行查詢數據和總數
    const [escalations, total, stats] = await Promise.all([
      prisma.escalation.findMany({
        where,
        skip,
        take,
        orderBy: params.sortBy === 'priority'
          ? [{ document: { processingQueue: { priority: params.sortOrder } } }, { createdAt: 'desc' }]
          : { createdAt: params.sortOrder },
        include: {
          document: {
            select: {
              id: true,
              fileName: true,
              originalName: true,
              forwarder: {
                select: {
                  id: true,
                  name: true,
                  code: true
                }
              },
              processingQueue: {
                select: {
                  priority: true
                }
              }
            }
          },
          escalator: {
            select: {
              id: true,
              name: true,
              email: true
            }
          },
          assignee: {
            select: {
              id: true,
              name: true
            }
          }
        }
      }),
      prisma.escalation.count({ where }),
      // 統計資訊
      prisma.escalation.groupBy({
        by: ['status'],
        _count: { id: true }
      })
    ])

    // 處理統計
    const statsByStatus = stats.reduce((acc, s) => {
      acc[s.status] = s._count.id
      return acc
    }, {} as Record<string, number>)

    return NextResponse.json({
      success: true,
      data: {
        items: escalations.map(e => ({
          id: e.id,
          status: e.status,
          reason: e.reason,
          reasonDetail: e.reasonDetail,
          createdAt: e.createdAt.toISOString(),
          resolvedAt: e.resolvedAt?.toISOString() || null,
          priority: e.document.processingQueue?.priority || 0,
          document: {
            id: e.document.id,
            fileName: e.document.fileName,
            originalName: e.document.originalName,
            forwarder: e.document.forwarder
          },
          escalatedBy: {
            id: e.escalator.id,
            name: e.escalator.name,
            email: e.escalator.email
          },
          assignee: e.assignee
        })),
        pagination: {
          page: params.page,
          pageSize: params.pageSize,
          total,
          totalPages: Math.ceil(total / params.pageSize!)
        },
        stats: {
          total,
          pending: statsByStatus['PENDING'] || 0,
          inProgress: statsByStatus['IN_PROGRESS'] || 0,
          resolved: statsByStatus['RESOLVED'] || 0
        }
      }
    })

  } catch (error) {
    console.error('Failed to fetch escalations:', error)
    return NextResponse.json({
      success: false,
      error: {
        type: 'internal_error',
        title: 'Internal Server Error',
        status: 500,
        detail: 'Failed to fetch escalations'
      }
    }, { status: 500 })
  }
}
```

#### 4.3.2 處理完成 API

**File**: `src/app/api/escalations/[id]/resolve/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PERMISSIONS } from '@/lib/permissions'
import { DocumentStatus, EscalationStatus, ReviewAction } from '@prisma/client'
import { logAudit } from '@/lib/audit'
import { z } from 'zod'

const resolveSchema = z.object({
  decision: z.enum(['APPROVED', 'CORRECTED', 'REJECTED']),
  corrections: z.array(z.object({
    fieldName: z.string(),
    originalValue: z.string().nullable(),
    correctedValue: z.string(),
    correctionType: z.enum(['NORMAL', 'EXCEPTION'])
  })).optional(),
  notes: z.string().optional(),
  createRule: z.object({
    fieldName: z.string(),
    suggestedPattern: z.string(),
    description: z.string().optional()
  }).optional()
})

interface RouteParams {
  params: { id: string }
}

// POST /api/escalations/[id]/resolve - 處理完成
export async function POST(request: NextRequest, { params }: RouteParams) {
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
  const isSuperUser = session.user.roles?.some(r =>
    r.permissions.includes(PERMISSIONS.RULE_MANAGE)
  )

  if (!isSuperUser) {
    return NextResponse.json({
      success: false,
      error: {
        type: 'forbidden',
        title: 'Forbidden',
        status: 403,
        detail: 'Super User permission required'
      }
    }, { status: 403 })
  }

  const { id: escalationId } = params

  try {
    // 解析請求
    const body = await request.json()
    const validation = resolveSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json({
        success: false,
        error: {
          type: 'validation_error',
          title: 'Validation Error',
          status: 400,
          detail: 'Invalid request body',
          errors: validation.error.flatten()
        }
      }, { status: 400 })
    }

    const { decision, corrections, notes, createRule } = validation.data

    // 驗證：CORRECTED 必須有修正
    if (decision === 'CORRECTED' && (!corrections || corrections.length === 0)) {
      return NextResponse.json({
        success: false,
        error: {
          type: 'validation_error',
          title: 'Validation Error',
          status: 400,
          detail: 'Corrections required when decision is CORRECTED'
        }
      }, { status: 400 })
    }

    // 獲取升級案例
    const escalation = await prisma.escalation.findUnique({
      where: { id: escalationId },
      include: {
        document: {
          include: {
            forwarder: true
          }
        }
      }
    })

    if (!escalation) {
      return NextResponse.json({
        success: false,
        error: {
          type: 'not_found',
          title: 'Not Found',
          status: 404,
          detail: `Escalation ${escalationId} not found`
        }
      }, { status: 404 })
    }

    // 檢查狀態
    if (escalation.status === EscalationStatus.RESOLVED) {
      return NextResponse.json({
        success: false,
        error: {
          type: 'conflict',
          title: 'Conflict',
          status: 409,
          detail: 'Escalation already resolved'
        }
      }, { status: 409 })
    }

    // 決定文件最終狀態
    const documentStatus = decision === 'REJECTED'
      ? DocumentStatus.REJECTED
      : DocumentStatus.APPROVED

    // 使用事務處理
    const result = await prisma.$transaction(async (tx) => {
      const now = new Date()

      // 1. 更新 Escalation 狀態
      const updatedEscalation = await tx.escalation.update({
        where: { id: escalationId },
        data: {
          status: EscalationStatus.RESOLVED,
          resolution: notes || `${decision} by Super User`,
          resolvedBy: session.user.id,
          resolvedAt: now
        }
      })

      // 2. 更新 Document 狀態
      await tx.document.update({
        where: { id: escalation.documentId },
        data: {
          status: documentStatus,
          updatedAt: now
        }
      })

      // 3. 創建 ReviewRecord
      await tx.reviewRecord.create({
        data: {
          documentId: escalation.documentId,
          reviewerId: session.user.id,
          action: decision as ReviewAction,
          notes: notes || null
        }
      })

      // 4. 如果有修正，創建 Correction 記錄
      if (corrections && corrections.length > 0) {
        await tx.correction.createMany({
          data: corrections.map(c => ({
            documentId: escalation.documentId,
            fieldName: c.fieldName,
            originalValue: c.originalValue,
            correctedValue: c.correctedValue,
            correctionType: c.correctionType,
            correctedBy: session.user.id
          }))
        })
      }

      // 5. 如果需要創建規則建議
      let ruleSuggestionId: string | undefined

      if (createRule && escalation.document.forwarder) {
        const ruleSuggestion = await tx.ruleSuggestion.create({
          data: {
            forwarderId: escalation.document.forwarder.id,
            fieldName: createRule.fieldName,
            suggestedPattern: createRule.suggestedPattern,
            description: createRule.description,
            suggestedBy: session.user.id,
            escalationId: escalationId
          }
        })
        ruleSuggestionId = ruleSuggestion.id
      }

      // 6. 更新 ProcessingQueue
      await tx.processingQueue.updateMany({
        where: { documentId: escalation.documentId },
        data: {
          status: decision === 'REJECTED' ? 'FAILED' : 'COMPLETED',
          completedAt: now
        }
      })

      return {
        escalation: updatedEscalation,
        ruleSuggestionId
      }
    })

    // 記錄審計日誌
    await logAudit({
      userId: session.user.id,
      action: 'ESCALATION_RESOLVED',
      resourceType: 'Escalation',
      resourceId: escalationId,
      details: {
        documentId: escalation.documentId,
        decision,
        correctionsCount: corrections?.length || 0,
        ruleCreated: !!result.ruleSuggestionId
      }
    })

    return NextResponse.json({
      success: true,
      data: {
        escalationId: result.escalation.id,
        documentId: escalation.documentId,
        decision,
        resolvedAt: result.escalation.resolvedAt?.toISOString(),
        ruleSuggestionId: result.ruleSuggestionId
      }
    })

  } catch (error) {
    console.error('Failed to resolve escalation:', error)
    return NextResponse.json({
      success: false,
      error: {
        type: 'internal_error',
        title: 'Internal Server Error',
        status: 500,
        detail: 'Failed to resolve escalation'
      }
    }, { status: 500 })
  }
}
```

#### 4.3.3 升級案例詳情 API

**File**: `src/app/api/escalations/[id]/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PERMISSIONS } from '@/lib/permissions'

interface RouteParams {
  params: { id: string }
}

// GET /api/escalations/[id] - 獲取升級案例詳情
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
  const isSuperUser = session.user.roles?.some(r =>
    r.permissions.includes(PERMISSIONS.RULE_MANAGE)
  )

  if (!isSuperUser) {
    return NextResponse.json({
      success: false,
      error: {
        type: 'forbidden',
        title: 'Forbidden',
        status: 403,
        detail: 'Super User permission required'
      }
    }, { status: 403 })
  }

  const { id: escalationId } = params

  try {
    const escalation = await prisma.escalation.findUnique({
      where: { id: escalationId },
      include: {
        document: {
          include: {
            forwarder: {
              select: {
                id: true,
                name: true,
                code: true
              }
            },
            extractionResult: {
              select: {
                fields: true
              }
            }
          }
        },
        escalator: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        assignee: {
          select: {
            id: true,
            name: true
          }
        },
        resolver: {
          select: {
            id: true,
            name: true
          }
        }
      }
    })

    if (!escalation) {
      return NextResponse.json({
        success: false,
        error: {
          type: 'not_found',
          title: 'Not Found',
          status: 404,
          detail: `Escalation ${escalationId} not found`
        }
      }, { status: 404 })
    }

    // 獲取相關的修正記錄
    const corrections = await prisma.correction.findMany({
      where: { documentId: escalation.documentId },
      orderBy: { createdAt: 'desc' }
    })

    // 如果是待處理狀態且尚未分配，自動分配給當前用戶
    if (escalation.status === 'PENDING' && !escalation.assignedTo) {
      await prisma.escalation.update({
        where: { id: escalationId },
        data: {
          status: 'IN_PROGRESS',
          assignedTo: session.user.id
        }
      })
    }

    return NextResponse.json({
      success: true,
      data: {
        id: escalation.id,
        status: escalation.status,
        reason: escalation.reason,
        reasonDetail: escalation.reasonDetail,
        resolution: escalation.resolution,
        createdAt: escalation.createdAt.toISOString(),
        resolvedAt: escalation.resolvedAt?.toISOString() || null,
        escalatedBy: escalation.escalator,
        assignee: escalation.assignee,
        resolver: escalation.resolver,
        document: {
          id: escalation.document.id,
          fileName: escalation.document.fileName,
          originalName: escalation.document.originalName,
          fileUrl: escalation.document.fileUrl,
          status: escalation.document.status,
          forwarder: escalation.document.forwarder,
          extractionResult: escalation.document.extractionResult
        },
        corrections: corrections.map(c => ({
          id: c.id,
          fieldName: c.fieldName,
          originalValue: c.originalValue,
          correctedValue: c.correctedValue,
          correctionType: c.correctionType
        }))
      }
    })

  } catch (error) {
    console.error('Failed to fetch escalation:', error)
    return NextResponse.json({
      success: false,
      error: {
        type: 'internal_error',
        title: 'Internal Server Error',
        status: 500,
        detail: 'Failed to fetch escalation'
      }
    }, { status: 500 })
  }
}
```

---

### Phase 4: React Query Hooks (AC1-AC3)

#### 4.4.1 列表查詢 Hook

**File**: `src/hooks/useEscalationList.ts`

```typescript
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { EscalationListParams, EscalationListItem, EscalationStats } from '@/types/escalation'

interface EscalationListResponse {
  success: true
  data: {
    items: EscalationListItem[]
    pagination: {
      page: number
      pageSize: number
      total: number
      totalPages: number
    }
    stats: EscalationStats
  }
}

async function fetchEscalations(params: EscalationListParams): Promise<EscalationListResponse> {
  const searchParams = new URLSearchParams()

  if (params.status) searchParams.set('status', params.status)
  if (params.reason) searchParams.set('reason', params.reason)
  if (params.page) searchParams.set('page', params.page.toString())
  if (params.pageSize) searchParams.set('pageSize', params.pageSize.toString())
  if (params.sortBy) searchParams.set('sortBy', params.sortBy)
  if (params.sortOrder) searchParams.set('sortOrder', params.sortOrder)

  const response = await fetch(`/api/escalations?${searchParams}`)
  const result = await response.json()

  if (!result.success) {
    throw new Error(result.error?.detail || 'Failed to fetch escalations')
  }

  return result
}

export function useEscalationList(params: EscalationListParams = {}) {
  return useQuery({
    queryKey: ['escalations', params],
    queryFn: () => fetchEscalations(params),
    staleTime: 30 * 1000, // 30 秒
    refetchInterval: 60 * 1000 // 每分鐘自動刷新
  })
}

// 預取下一頁
export function usePrefetchEscalations() {
  const queryClient = useQueryClient()

  return (params: EscalationListParams) => {
    queryClient.prefetchQuery({
      queryKey: ['escalations', { ...params, page: (params.page || 1) + 1 }],
      queryFn: () => fetchEscalations({ ...params, page: (params.page || 1) + 1 })
    })
  }
}
```

#### 4.4.2 詳情查詢 Hook

**File**: `src/hooks/useEscalationDetail.ts`

```typescript
import { useQuery } from '@tanstack/react-query'
import { EscalationDetail } from '@/types/escalation'

interface EscalationDetailResponse {
  success: true
  data: EscalationDetail
}

async function fetchEscalationDetail(id: string): Promise<EscalationDetailResponse> {
  const response = await fetch(`/api/escalations/${id}`)
  const result = await response.json()

  if (!result.success) {
    throw new Error(result.error?.detail || 'Failed to fetch escalation detail')
  }

  return result
}

export function useEscalationDetail(id: string | undefined) {
  return useQuery({
    queryKey: ['escalation', id],
    queryFn: () => fetchEscalationDetail(id!),
    enabled: !!id,
    staleTime: 10 * 1000 // 10 秒
  })
}
```

#### 4.4.3 處理完成 Hook

**File**: `src/hooks/useResolveEscalation.ts`

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ResolveEscalationRequest, ResolveEscalationResponse } from '@/types/escalation'

interface ResolveParams {
  escalationId: string
  data: ResolveEscalationRequest
}

async function resolveEscalation({ escalationId, data }: ResolveParams): Promise<ResolveEscalationResponse> {
  const response = await fetch(`/api/escalations/${escalationId}/resolve`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
  })

  const result = await response.json()

  if (!result.success) {
    throw new Error(result.error?.detail || 'Failed to resolve escalation')
  }

  return result
}

export function useResolveEscalation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: resolveEscalation,
    onSuccess: (_, variables) => {
      // 使相關緩存失效
      queryClient.invalidateQueries({
        queryKey: ['escalation', variables.escalationId]
      })
      queryClient.invalidateQueries({
        queryKey: ['escalations']
      })
    }
  })
}
```

---

### Phase 5: UI Components (AC1-AC4)

#### 4.5.1 升級案例列表頁面

**File**: `src/app/(dashboard)/escalations/page.tsx`

```typescript
import { Suspense } from 'react'
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { PERMISSIONS } from '@/lib/permissions'
import { EscalationList } from '@/components/features/escalation/EscalationList'
import { EscalationListSkeleton } from '@/components/features/escalation/EscalationListSkeleton'

export const metadata = {
  title: '升級案例 - Document Extraction',
  description: '處理升級的複雜案例'
}

export default async function EscalationsPage() {
  const session = await auth()

  // 權限檢查
  const isSuperUser = session?.user?.roles?.some(r =>
    r.permissions.includes(PERMISSIONS.RULE_MANAGE)
  )

  if (!isSuperUser) {
    redirect('/unauthorized')
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">升級案例</h1>
          <p className="text-muted-foreground">
            處理數據處理員升級的複雜案例
          </p>
        </div>
      </div>

      <Suspense fallback={<EscalationListSkeleton />}>
        <EscalationList />
      </Suspense>
    </div>
  )
}
```

#### 4.5.2 升級案例列表組件

**File**: `src/components/features/escalation/EscalationList.tsx`

```typescript
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useEscalationList, usePrefetchEscalations } from '@/hooks/useEscalationList'
import { EscalationCard } from './EscalationCard'
import { EscalationFilters } from './EscalationFilters'
import { EscalationStats } from './EscalationStats'
import { Pagination } from '@/components/ui/pagination'
import { Skeleton } from '@/components/ui/skeleton'
import { AlertCircle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EscalationListParams } from '@/types/escalation'
import { EscalationStatus, EscalationReason } from '@prisma/client'

export function EscalationList() {
  const router = useRouter()
  const prefetch = usePrefetchEscalations()

  const [filters, setFilters] = useState<EscalationListParams>({
    status: undefined,
    reason: undefined,
    page: 1,
    pageSize: 20,
    sortBy: 'createdAt',
    sortOrder: 'desc'
  })

  const { data, isLoading, error, refetch, isRefetching } = useEscalationList(filters)

  const handlePageChange = (page: number) => {
    setFilters(prev => ({ ...prev, page }))
    // 預取下一頁
    if (page < (data?.data.pagination.totalPages || 0)) {
      prefetch({ ...filters, page: page + 1 })
    }
  }

  const handleFilterChange = (
    key: 'status' | 'reason',
    value: EscalationStatus | EscalationReason | undefined
  ) => {
    setFilters(prev => ({
      ...prev,
      [key]: value,
      page: 1 // 重置頁碼
    }))
  }

  const handleCardClick = (escalationId: string) => {
    router.push(`/escalations/${escalationId}`)
  }

  if (isLoading) {
    return <EscalationListSkeleton />
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center">
        <AlertCircle className="h-12 w-12 text-destructive mb-4" />
        <h3 className="text-lg font-medium">載入失敗</h3>
        <p className="text-sm text-muted-foreground mb-4">
          {error.message}
        </p>
        <Button onClick={() => refetch()}>
          重試
        </Button>
      </div>
    )
  }

  const { items, pagination, stats } = data!.data

  return (
    <div className="space-y-6">
      {/* 統計卡片 */}
      <EscalationStats stats={stats} />

      {/* 篩選器 */}
      <div className="flex items-center justify-between">
        <EscalationFilters
          status={filters.status}
          reason={filters.reason}
          onStatusChange={(v) => handleFilterChange('status', v)}
          onReasonChange={(v) => handleFilterChange('reason', v)}
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

      {/* 列表 */}
      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 text-center border rounded-lg">
          <p className="text-muted-foreground">
            沒有符合條件的升級案例
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((escalation) => (
            <EscalationCard
              key={escalation.id}
              escalation={escalation}
              onClick={() => handleCardClick(escalation.id)}
            />
          ))}
        </div>
      )}

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

#### 4.5.3 案例詳情頁面

**File**: `src/app/(dashboard)/escalations/[id]/page.tsx`

```typescript
import { Suspense } from 'react'
import { auth } from '@/lib/auth'
import { redirect, notFound } from 'next/navigation'
import { PERMISSIONS } from '@/lib/permissions'
import { prisma } from '@/lib/prisma'
import { EscalationDetailView } from '@/components/features/escalation/EscalationDetailView'
import { Skeleton } from '@/components/ui/skeleton'

interface PageProps {
  params: { id: string }
}

export async function generateMetadata({ params }: PageProps) {
  const escalation = await prisma.escalation.findUnique({
    where: { id: params.id },
    include: {
      document: { select: { fileName: true } }
    }
  })

  return {
    title: escalation
      ? `處理升級案例 - ${escalation.document.fileName}`
      : '升級案例詳情',
    description: '處理升級的複雜案例'
  }
}

export default async function EscalationDetailPage({ params }: PageProps) {
  const session = await auth()

  // 權限檢查
  const isSuperUser = session?.user?.roles?.some(r =>
    r.permissions.includes(PERMISSIONS.RULE_MANAGE)
  )

  if (!isSuperUser) {
    redirect('/unauthorized')
  }

  // 驗證升級案例存在
  const exists = await prisma.escalation.findUnique({
    where: { id: params.id },
    select: { id: true }
  })

  if (!exists) {
    notFound()
  }

  return (
    <div className="container mx-auto py-6">
      <Suspense fallback={<EscalationDetailSkeleton />}>
        <EscalationDetailView escalationId={params.id} />
      </Suspense>
    </div>
  )
}

function EscalationDetailSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-24 w-full" />
      <div className="grid grid-cols-2 gap-6">
        <Skeleton className="h-[600px]" />
        <Skeleton className="h-[600px]" />
      </div>
    </div>
  )
}
```

#### 4.5.4 案例詳情視圖組件

**File**: `src/components/features/escalation/EscalationDetailView.tsx`

```typescript
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useEscalationDetail } from '@/hooks/useEscalationDetail'
import { useResolveEscalation } from '@/hooks/useResolveEscalation'
import { EscalationHeader } from './EscalationHeader'
import { EscalationInfo } from './EscalationInfo'
import { ResolveDialog } from './ResolveDialog'
import { CreateRuleButton } from './CreateRuleButton'
import { PdfViewer } from '@/components/features/review/PdfViewer'
import { ReviewPanel } from '@/components/features/review/ReviewPanel'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { Check, X, FileEdit, Loader2 } from 'lucide-react'
import { ResolveEscalationRequest, ResolveDecision } from '@/types/escalation'

interface EscalationDetailViewProps {
  escalationId: string
}

export function EscalationDetailView({ escalationId }: EscalationDetailViewProps) {
  const router = useRouter()
  const { data, isLoading, error } = useEscalationDetail(escalationId)
  const { mutate: resolve, isPending: isResolving } = useResolveEscalation()

  const [showResolveDialog, setShowResolveDialog] = useState(false)
  const [pendingDecision, setPendingDecision] = useState<ResolveDecision | null>(null)
  const [editedFields, setEditedFields] = useState<Map<string, string>>(new Map())

  if (isLoading) {
    return <div>載入中...</div>
  }

  if (error || !data) {
    return <div>載入失敗: {error?.message}</div>
  }

  const escalation = data.data
  const isResolved = escalation.status === 'RESOLVED'

  // 處理決策
  const handleDecision = (decision: ResolveDecision) => {
    setPendingDecision(decision)
    setShowResolveDialog(true)
  }

  // 確認處理
  const handleConfirmResolve = (request: ResolveEscalationRequest) => {
    resolve(
      { escalationId, data: request },
      {
        onSuccess: (result) => {
          toast.success('案例處理完成')
          setShowResolveDialog(false)

          // 如果創建了規則建議，顯示提示
          if (result.data.ruleSuggestionId) {
            toast.info('規則建議已創建', {
              action: {
                label: '查看',
                onClick: () => router.push(`/rules/suggestions/${result.data.ruleSuggestionId}`)
              }
            })
          }

          // 返回列表
          router.push('/escalations')
        },
        onError: (error) => {
          toast.error(error.message || '處理失敗，請重試')
        }
      }
    )
  }

  // 欄位編輯處理
  const handleFieldEdit = (fieldName: string, value: string) => {
    setEditedFields(prev => {
      const next = new Map(prev)
      next.set(fieldName, value)
      return next
    })
  }

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col">
      {/* 標頭 */}
      <EscalationHeader
        escalation={escalation}
        onBack={() => router.push('/escalations')}
      />

      {/* 升級資訊 */}
      <EscalationInfo
        reason={escalation.reason}
        reasonDetail={escalation.reasonDetail}
        escalatedBy={escalation.escalatedBy}
        createdAt={escalation.createdAt}
      />

      {/* 主要內容區 */}
      <div className="flex-1 mt-4">
        <ResizablePanelGroup direction="horizontal">
          {/* PDF 預覽 */}
          <ResizablePanel defaultSize={50} minSize={30}>
            <div className="h-full border rounded-lg overflow-hidden">
              <PdfViewer
                url={escalation.document.fileUrl}
                fileName={escalation.document.fileName}
              />
            </div>
          </ResizablePanel>

          <ResizableHandle withHandle />

          {/* 審核面板 */}
          <ResizablePanel defaultSize={50} minSize={30}>
            <div className="h-full border rounded-lg overflow-hidden flex flex-col">
              <ReviewPanel
                fields={escalation.document.extractionResult?.fields || []}
                existingCorrections={escalation.corrections}
                onFieldEdit={handleFieldEdit}
                readOnly={isResolved}
              />

              {/* 操作按鈕 */}
              {!isResolved && (
                <div className="p-4 border-t space-y-3">
                  <div className="flex gap-2">
                    <Button
                      className="flex-1"
                      variant="outline"
                      onClick={() => handleDecision('REJECTED')}
                      disabled={isResolving}
                    >
                      <X className="h-4 w-4 mr-2" />
                      拒絕
                    </Button>
                    <Button
                      className="flex-1"
                      variant="secondary"
                      onClick={() => handleDecision('CORRECTED')}
                      disabled={isResolving || editedFields.size === 0}
                    >
                      <FileEdit className="h-4 w-4 mr-2" />
                      修正後核准
                    </Button>
                    <Button
                      className="flex-1"
                      onClick={() => handleDecision('APPROVED')}
                      disabled={isResolving}
                    >
                      <Check className="h-4 w-4 mr-2" />
                      核准
                    </Button>
                  </div>

                  {/* 創建規則建議 */}
                  {escalation.document.forwarder && (
                    <CreateRuleButton
                      forwarderId={escalation.document.forwarder.id}
                      forwarderName={escalation.document.forwarder.name}
                      fields={escalation.document.extractionResult?.fields || []}
                      editedFields={editedFields}
                    />
                  )}
                </div>
              )}
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>

      {/* 處理確認對話框 */}
      <ResolveDialog
        open={showResolveDialog}
        onOpenChange={setShowResolveDialog}
        decision={pendingDecision}
        editedFields={editedFields}
        originalFields={escalation.document.extractionResult?.fields || []}
        forwarder={escalation.document.forwarder}
        onConfirm={handleConfirmResolve}
        isSubmitting={isResolving}
      />
    </div>
  )
}
```

#### 4.5.5 處理決策對話框

**File**: `src/components/features/escalation/ResolveDialog.tsx`

```typescript
'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { Loader2, Lightbulb } from 'lucide-react'
import { ResolveDecision, ResolveEscalationRequest, RESOLVE_DECISIONS } from '@/types/escalation'
import { cn } from '@/lib/utils'

interface ResolveDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  decision: ResolveDecision | null
  editedFields: Map<string, string>
  originalFields: { name: string; value: string | null }[]
  forwarder: { id: string; name: string } | null
  onConfirm: (request: ResolveEscalationRequest) => void
  isSubmitting?: boolean
}

export function ResolveDialog({
  open,
  onOpenChange,
  decision,
  editedFields,
  originalFields,
  forwarder,
  onConfirm,
  isSubmitting
}: ResolveDialogProps) {
  const [notes, setNotes] = useState('')
  const [createRule, setCreateRule] = useState(false)
  const [ruleFieldName, setRuleFieldName] = useState('')
  const [rulePattern, setRulePattern] = useState('')
  const [ruleDescription, setRuleDescription] = useState('')

  const decisionConfig = RESOLVE_DECISIONS.find(d => d.value === decision)

  // 建立修正列表
  const corrections = Array.from(editedFields.entries()).map(([fieldName, correctedValue]) => {
    const original = originalFields.find(f => f.name === fieldName)
    return {
      fieldName,
      originalValue: original?.value || null,
      correctedValue,
      correctionType: 'NORMAL' as const
    }
  })

  const handleConfirm = () => {
    if (!decision) return

    const request: ResolveEscalationRequest = {
      decision,
      notes: notes || undefined,
      corrections: decision === 'CORRECTED' ? corrections : undefined
    }

    // 添加規則建議
    if (createRule && ruleFieldName && rulePattern) {
      request.createRule = {
        fieldName: ruleFieldName,
        suggestedPattern: rulePattern,
        description: ruleDescription || undefined
      }
    }

    onConfirm(request)
  }

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      // 重置狀態
      setNotes('')
      setCreateRule(false)
      setRuleFieldName('')
      setRulePattern('')
      setRuleDescription('')
    }
    onOpenChange(newOpen)
  }

  const canSubmit = decision &&
    (decision !== 'CORRECTED' || corrections.length > 0) &&
    (!createRule || (ruleFieldName && rulePattern))

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle>確認處理決策</DialogTitle>
          <DialogDescription>
            請確認以下處理決策並填寫必要資訊
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* 決策信息 */}
          {decisionConfig && (
            <div className={cn(
              'p-4 rounded-lg border',
              decision === 'APPROVED' && 'bg-green-50 border-green-200',
              decision === 'CORRECTED' && 'bg-yellow-50 border-yellow-200',
              decision === 'REJECTED' && 'bg-red-50 border-red-200'
            )}>
              <p className="font-medium">{decisionConfig.label}</p>
              <p className="text-sm text-muted-foreground mt-1">
                {decisionConfig.description}
              </p>
            </div>
          )}

          {/* 修正摘要 */}
          {decision === 'CORRECTED' && corrections.length > 0 && (
            <div className="space-y-2">
              <Label>修正內容 ({corrections.length} 項)</Label>
              <div className="max-h-32 overflow-y-auto space-y-1">
                {corrections.map((c, i) => (
                  <div key={i} className="text-sm p-2 bg-muted rounded">
                    <span className="font-medium">{c.fieldName}</span>
                    <span className="text-muted-foreground mx-2">:</span>
                    <span className="line-through text-muted-foreground">{c.originalValue || '(空)'}</span>
                    <span className="mx-2">→</span>
                    <span className="text-primary">{c.correctedValue}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 處理備註 */}
          <div className="space-y-2">
            <Label htmlFor="notes">處理備註 (選填)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="輸入處理說明或備註..."
              rows={3}
            />
          </div>

          {/* 創建規則建議 */}
          {forwarder && (
            <div className="space-y-4 p-4 border rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Lightbulb className="h-4 w-4 text-yellow-500" />
                  <Label htmlFor="create-rule">創建規則建議</Label>
                </div>
                <Switch
                  id="create-rule"
                  checked={createRule}
                  onCheckedChange={setCreateRule}
                />
              </div>

              {createRule && (
                <div className="space-y-3 pt-2">
                  <p className="text-sm text-muted-foreground">
                    為 <span className="font-medium">{forwarder.name}</span> 創建新的映射規則建議
                  </p>

                  <div className="space-y-2">
                    <Label htmlFor="rule-field">欄位名稱 *</Label>
                    <Input
                      id="rule-field"
                      value={ruleFieldName}
                      onChange={(e) => setRuleFieldName(e.target.value)}
                      placeholder="例如: invoice_number"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="rule-pattern">建議模式 *</Label>
                    <Input
                      id="rule-pattern"
                      value={rulePattern}
                      onChange={(e) => setRulePattern(e.target.value)}
                      placeholder="例如: INV-[0-9]{8}"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="rule-desc">說明 (選填)</Label>
                    <Textarea
                      id="rule-desc"
                      value={ruleDescription}
                      onChange={(e) => setRuleDescription(e.target.value)}
                      placeholder="描述這個規則的用途..."
                      rows={2}
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isSubmitting}
          >
            取消
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!canSubmit || isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                處理中...
              </>
            ) : (
              '確認處理'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

#### 4.5.6 升級資訊組件

**File**: `src/components/features/escalation/EscalationInfo.tsx`

```typescript
'use client'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { EscalationReason } from '@prisma/client'
import { ESCALATION_REASONS } from '@/types/escalation'
import { AlertTriangle, User, Clock } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { zhTW } from 'date-fns/locale'

interface EscalationInfoProps {
  reason: EscalationReason
  reasonDetail: string | null
  escalatedBy: {
    id: string
    name: string
    email: string
  }
  createdAt: string
}

export function EscalationInfo({
  reason,
  reasonDetail,
  escalatedBy,
  createdAt
}: EscalationInfoProps) {
  const reasonConfig = ESCALATION_REASONS.find(r => r.value === reason)

  return (
    <Alert variant="default" className="mt-4 bg-amber-50 border-amber-200">
      <AlertTriangle className="h-4 w-4 text-amber-600" />
      <AlertTitle className="text-amber-800">升級原因</AlertTitle>
      <AlertDescription className="mt-2">
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <Badge variant="outline" className="bg-amber-100 text-amber-800">
            {reasonConfig?.label || reason}
          </Badge>

          <div className="flex items-center gap-1 text-muted-foreground">
            <User className="h-3 w-3" />
            <span>{escalatedBy.name}</span>
          </div>

          <div className="flex items-center gap-1 text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>
              {formatDistanceToNow(new Date(createdAt), {
                addSuffix: true,
                locale: zhTW
              })}
            </span>
          </div>
        </div>

        {reasonDetail && (
          <p className="mt-2 text-amber-700 bg-amber-100 p-2 rounded">
            {reasonDetail}
          </p>
        )}
      </AlertDescription>
    </Alert>
  )
}
```

#### 4.5.7 創建規則按鈕

**File**: `src/components/features/escalation/CreateRuleButton.tsx`

```typescript
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Lightbulb, ChevronDown, ExternalLink } from 'lucide-react'

interface CreateRuleButtonProps {
  forwarderId: string
  forwarderName: string
  fields: { name: string; value: string | null }[]
  editedFields: Map<string, string>
}

export function CreateRuleButton({
  forwarderId,
  forwarderName,
  fields,
  editedFields
}: CreateRuleButtonProps) {
  const router = useRouter()

  // 找出被修改的欄位
  const editedFieldNames = Array.from(editedFields.keys())

  const handleCreateRule = (fieldName?: string) => {
    const params = new URLSearchParams({
      forwarderId,
      source: 'escalation'
    })

    if (fieldName) {
      params.set('fieldName', fieldName)
      const originalField = fields.find(f => f.name === fieldName)
      const editedValue = editedFields.get(fieldName)

      if (originalField?.value) {
        params.set('originalValue', originalField.value)
      }
      if (editedValue) {
        params.set('correctedValue', editedValue)
      }
    }

    router.push(`/rules/suggestions/new?${params}`)
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="w-full">
          <Lightbulb className="h-4 w-4 mr-2 text-yellow-500" />
          創建規則建議
          <ChevronDown className="h-4 w-4 ml-auto" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>
          為 {forwarderName} 創建規則
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {editedFieldNames.length > 0 && (
          <>
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              基於修改的欄位
            </DropdownMenuLabel>
            {editedFieldNames.map(fieldName => (
              <DropdownMenuItem
                key={fieldName}
                onClick={() => handleCreateRule(fieldName)}
              >
                <span className="font-medium">{fieldName}</span>
                <ExternalLink className="h-3 w-3 ml-auto text-muted-foreground" />
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
          </>
        )}

        <DropdownMenuItem onClick={() => handleCreateRule()}>
          <span>創建新規則...</span>
          <ExternalLink className="h-3 w-3 ml-auto text-muted-foreground" />
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
```

---

## 5. Testing Guide

### 5.1 Integration Tests

**File**: `tests/integration/api/escalations.test.ts`

```typescript
import { GET } from '@/app/api/escalations/route'
import { POST } from '@/app/api/escalations/[id]/resolve/route'
import { NextRequest } from 'next/server'

describe('Escalations API', () => {
  describe('GET /api/escalations', () => {
    it('should return escalation list for super user', async () => {
      const request = new NextRequest('http://localhost/api/escalations')
      const response = await GET(request)
      const data = await response.json()

      expect(data.success).toBe(true)
      expect(Array.isArray(data.data.items)).toBe(true)
      expect(data.data.pagination).toBeDefined()
      expect(data.data.stats).toBeDefined()
    })

    it('should filter by status', async () => {
      const request = new NextRequest('http://localhost/api/escalations?status=PENDING')
      const response = await GET(request)
      const data = await response.json()

      expect(data.success).toBe(true)
      data.data.items.forEach((item: any) => {
        expect(item.status).toBe('PENDING')
      })
    })

    it('should return 403 for non-super user', async () => {
      // Mock non-super user session
      const request = new NextRequest('http://localhost/api/escalations')
      const response = await GET(request)

      expect(response.status).toBe(403)
    })
  })

  describe('POST /api/escalations/[id]/resolve', () => {
    it('should resolve escalation with APPROVED', async () => {
      const request = new NextRequest('http://localhost/api/escalations/test-id/resolve', {
        method: 'POST',
        body: JSON.stringify({
          decision: 'APPROVED',
          notes: 'Looks good'
        })
      })

      const response = await POST(request, { params: { id: 'test-id' } })
      const data = await response.json()

      expect(data.success).toBe(true)
      expect(data.data.decision).toBe('APPROVED')
    })

    it('should require corrections for CORRECTED decision', async () => {
      const request = new NextRequest('http://localhost/api/escalations/test-id/resolve', {
        method: 'POST',
        body: JSON.stringify({
          decision: 'CORRECTED'
          // Missing corrections
        })
      })

      const response = await POST(request, { params: { id: 'test-id' } })
      expect(response.status).toBe(400)
    })

    it('should create rule suggestion when requested', async () => {
      const request = new NextRequest('http://localhost/api/escalations/test-id/resolve', {
        method: 'POST',
        body: JSON.stringify({
          decision: 'CORRECTED',
          corrections: [{
            fieldName: 'invoice_number',
            originalValue: 'INV123',
            correctedValue: 'INV-123',
            correctionType: 'NORMAL'
          }],
          createRule: {
            fieldName: 'invoice_number',
            suggestedPattern: 'INV-[0-9]{3}',
            description: 'New invoice number pattern'
          }
        })
      })

      const response = await POST(request, { params: { id: 'test-id' } })
      const data = await response.json()

      expect(data.success).toBe(true)
      expect(data.data.ruleSuggestionId).toBeDefined()
    })
  })
})
```

### 5.2 E2E Tests

**File**: `tests/e2e/escalations.spec.ts`

```typescript
import { test, expect } from '@playwright/test'

test.describe('Super User Escalation Management', () => {
  test.beforeEach(async ({ page }) => {
    // Login as super user
    await page.goto('/login')
    await page.fill('[name="email"]', 'superuser@example.com')
    await page.fill('[name="password"]', 'password')
    await page.click('button[type="submit"]')
    await page.waitForURL('/dashboard')
  })

  test('should display escalation list', async ({ page }) => {
    await page.goto('/escalations')

    await expect(page.getByRole('heading', { name: '升級案例' })).toBeVisible()
    await expect(page.getByTestId('escalation-stats')).toBeVisible()
  })

  test('should filter by status', async ({ page }) => {
    await page.goto('/escalations')

    // 選擇待處理狀態
    await page.getByLabel('狀態').click()
    await page.getByText('待處理').click()

    // 驗證所有項目都是待處理
    const cards = page.getByTestId('escalation-card')
    for (const card of await cards.all()) {
      await expect(card.getByText('待處理')).toBeVisible()
    }
  })

  test('should navigate to escalation detail', async ({ page }) => {
    await page.goto('/escalations')

    // 點擊第一個案例
    await page.getByTestId('escalation-card').first().click()

    // 驗證進入詳情頁
    await expect(page.getByTestId('escalation-header')).toBeVisible()
    await expect(page.getByTestId('pdf-viewer')).toBeVisible()
    await expect(page.getByTestId('review-panel')).toBeVisible()
  })

  test('should resolve escalation with approval', async ({ page }) => {
    await page.goto('/escalations/test-escalation-id')

    // 點擊核准
    await page.getByRole('button', { name: '核准' }).click()

    // 填寫備註
    await page.fill('textarea[id="notes"]', '確認資料正確')

    // 確認處理
    await page.getByRole('button', { name: '確認處理' }).click()

    // 驗證跳轉回列表
    await expect(page).toHaveURL('/escalations')
    await expect(page.getByText('案例處理完成')).toBeVisible()
  })

  test('should create rule suggestion during resolution', async ({ page }) => {
    await page.goto('/escalations/test-escalation-id')

    // 先修改欄位
    await page.getByTestId('field-invoice_number').fill('INV-001')

    // 點擊修正後核准
    await page.getByRole('button', { name: '修正後核准' }).click()

    // 開啟創建規則
    await page.getByLabel('創建規則建議').check()

    // 填寫規則資訊
    await page.fill('#rule-field', 'invoice_number')
    await page.fill('#rule-pattern', 'INV-[0-9]{3}')

    // 確認
    await page.getByRole('button', { name: '確認處理' }).click()

    // 驗證規則建議提示
    await expect(page.getByText('規則建議已創建')).toBeVisible()
  })
})
```

---

## 6. Verification Checklist

### 6.1 Acceptance Criteria Verification

- [ ] **AC1**: 升級案例列表
  - [ ] Super User 可以訪問 `/escalations` 頁面
  - [ ] 顯示所有待處理的升級案例
  - [ ] 包含升級人、時間、原因、原始審核進度
  - [ ] 支援篩選和排序

- [ ] **AC2**: 查看案例詳情
  - [ ] 點擊案例可進入詳情頁
  - [ ] 顯示完整的 PDF 並排審核界面
  - [ ] 顯示升級原因和備註
  - [ ] 可編輯欄位值

- [ ] **AC3**: 完成處理
  - [ ] 核准/修正/拒絕三種決策選項
  - [ ] 文件狀態正確更新
  - [ ] ReviewRecord 正確記錄
  - [ ] 修正記錄正確保存

- [ ] **AC4**: 創建規則建議
  - [ ] 處理時可選擇創建規則
  - [ ] 正確連結到 RuleSuggestion
  - [ ] 預填相關資訊

### 6.2 Technical Verification

- [ ] API 響應符合 RFC 7807 格式
- [ ] 權限檢查正確（僅 Super User）
- [ ] 事務處理確保數據一致性
- [ ] 審計日誌完整記錄

### 6.3 UI/UX Verification

- [ ] 列表分頁正常工作
- [ ] 篩選器即時響應
- [ ] PDF 預覽正常顯示
- [ ] 表單驗證正確

---

## 7. Files to Create/Modify

| File Path | Action | Description |
|-----------|--------|-------------|
| `prisma/schema.prisma` | Modify | 添加 RuleSuggestion 模型、更新 Escalation |
| `src/types/escalation.ts` | Modify | 擴展升級相關類型 |
| `src/app/api/escalations/route.ts` | Create | 升級案例列表 API |
| `src/app/api/escalations/[id]/route.ts` | Create | 升級案例詳情 API |
| `src/app/api/escalations/[id]/resolve/route.ts` | Create | 處理完成 API |
| `src/hooks/useEscalationList.ts` | Create | 列表查詢 Hook |
| `src/hooks/useEscalationDetail.ts` | Create | 詳情查詢 Hook |
| `src/hooks/useResolveEscalation.ts` | Create | 處理完成 Hook |
| `src/app/(dashboard)/escalations/page.tsx` | Create | 列表頁面 |
| `src/app/(dashboard)/escalations/[id]/page.tsx` | Create | 詳情頁面 |
| `src/components/features/escalation/EscalationList.tsx` | Create | 列表組件 |
| `src/components/features/escalation/EscalationCard.tsx` | Create | 卡片組件 |
| `src/components/features/escalation/EscalationDetailView.tsx` | Create | 詳情視圖 |
| `src/components/features/escalation/EscalationHeader.tsx` | Create | 標頭組件 |
| `src/components/features/escalation/EscalationInfo.tsx` | Create | 升級資訊組件 |
| `src/components/features/escalation/ResolveDialog.tsx` | Create | 處理對話框 |
| `src/components/features/escalation/CreateRuleButton.tsx` | Create | 創建規則按鈕 |

---

*Tech Spec Created: 2025-12-16*
*Story Reference: 3-8-super-user-handle-escalated-cases*
