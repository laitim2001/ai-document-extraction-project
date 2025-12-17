# Tech Spec: Story 4-6 審核學習規則

## 1. Overview

### 1.1 Story Reference
- **Story ID**: 4.6
- **Title**: 審核學習規則
- **Epic**: Epic 4 - 映射規則管理與自動學習

### 1.2 Story Description
作為 Super User，我希望審核待升級的學習規則，以便只有經過驗證的規則才會被應用。

### 1.3 Dependencies
- **Story 4-5**: 規則影響範圍分析（影響分析功能）
- **Story 4-4**: 規則升級建議生成（RuleSuggestion 模型）
- **Story 1-2**: 角色權限基礎（RULE_APPROVE 權限）

---

## 2. Acceptance Criteria Mapping

| AC ID | Description | Implementation Approach |
|-------|-------------|------------------------|
| AC1 | 審核頁面 | ReviewPage + SuggestionDetail + ImpactSummary |
| AC2 | 批准規則 | POST /api/rules/suggestions/[id]/approve + Transaction |
| AC3 | 拒絕規則 | POST /api/rules/suggestions/[id]/reject + RejectionReason |

---

## 3. Architecture Overview

### 3.1 Review Workflow Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         規則審核工作流程                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                         Review List Page                              │   │
│  │  /rules/review                                                        │   │
│  │                                                                       │   │
│  │  ┌─────────────────────────────────────────────────────────────────┐ │   │
│  │  │ 待審核建議列表                                                     │ │   │
│  │  │ ┌────────┬──────────┬─────────┬────────┬─────────┬───────────┐  │ │   │
│  │  │ │Forwarder│FieldName │ Source  │ Count  │ Created │  Actions  │  │ │   │
│  │  │ ├────────┼──────────┼─────────┼────────┼─────────┼───────────┤  │ │   │
│  │  │ │ DHL    │ inv_no   │🤖 Auto  │  5     │ 2 小時前 │ [審核]    │  │ │   │
│  │  │ │ FedEx  │ amount   │👤 Manual│  3     │ 1 天前  │ [審核]    │  │ │   │
│  │  │ │ UPS    │ date     │🤖 Auto  │  8     │ 3 天前  │ [審核]    │  │ │   │
│  │  │ └────────┴──────────┴─────────┴────────┴─────────┴───────────┘  │ │   │
│  │  └─────────────────────────────────────────────────────────────────┘ │   │
│  │                                                                       │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                         │                                                   │
│                         │ Click "審核"                                       │
│                         ▼                                                   │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                         Review Detail Page                            │   │
│  │  /rules/review/[id]                                                   │   │
│  │                                                                       │   │
│  │  ┌─────────────────────────────────────────────────────────────────┐ │   │
│  │  │ 規則詳情                                                          │ │   │
│  │  │ • Forwarder: DHL                                                 │ │   │
│  │  │ • Field: invoice_number                                          │ │   │
│  │  │ • Type: REGEX                                                    │ │   │
│  │  │ • Pattern: ^[A-Z]{2,3}-\d{6,10}$                                 │ │   │
│  │  │ • Confidence: 92%                                                │ │   │
│  │  │ • Source: 🤖 AUTO_LEARNING                                       │ │   │
│  │  └─────────────────────────────────────────────────────────────────┘ │   │
│  │                                                                       │   │
│  │  ┌─────────────────────────────────────────────────────────────────┐ │   │
│  │  │ 影響分析摘要                                                       │ │   │
│  │  │ • 受影響文件: 156                                                  │ │   │
│  │  │ • 預計改善: 89 (57.1%)                                            │ │   │
│  │  │ • 可能惡化: 12 (7.7%)                                             │ │   │
│  │  │ [查看詳細分析]                                                     │ │   │
│  │  └─────────────────────────────────────────────────────────────────┘ │   │
│  │                                                                       │   │
│  │  ┌─────────────────────────────────────────────────────────────────┐ │   │
│  │  │ 樣本案例                                                          │ │   │
│  │  │ ┌──────────┬──────────────┬──────────────┐                       │ │   │
│  │  │ │ Document │ Original     │ Corrected    │                       │ │   │
│  │  │ ├──────────┼──────────────┼──────────────┤                       │ │   │
│  │  │ │ doc1.pdf │ INV-123456   │ INV123456    │                       │ │   │
│  │  │ │ doc2.pdf │ INV-234567   │ INV234567    │                       │ │   │
│  │  │ └──────────┴──────────────┴──────────────┘                       │ │   │
│  │  └─────────────────────────────────────────────────────────────────┘ │   │
│  │                                                                       │   │
│  │  ┌─────────────────────────────────────────────────────────────────┐ │   │
│  │  │                         Actions                                   │ │   │
│  │  │                                                                   │ │   │
│  │  │  [✅ 批准]                              [❌ 拒絕]                  │ │   │
│  │  │                                                                   │ │   │
│  │  └─────────────────────────────────────────────────────────────────┘ │   │
│  │                                                                       │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│            │                                        │                       │
│            │ Click "批准"                           │ Click "拒絕"           │
│            ▼                                        ▼                       │
│  ┌────────────────────────┐            ┌────────────────────────────────┐   │
│  │ Approve Dialog         │            │ Reject Dialog                  │   │
│  │                        │            │                                │   │
│  │ 確認批准此規則？        │            │ 請選擇拒絕原因：               │   │
│  │                        │            │ ○ 數據不足                      │   │
│  │ 備註 (選填):           │            │ ○ 準確率不佳                    │   │
│  │ [_______________]      │            │ ○ 風險過高                      │   │
│  │                        │            │ ● 其他                          │   │
│  │ 生效日期 (選填):       │            │                                │   │
│  │ [_______________]      │            │ 詳細說明 (必填):               │   │
│  │                        │            │ [_______________]              │   │
│  │ [取消]     [確認批准]   │            │                                │   │
│  │                        │            │ [取消]         [確認拒絕]       │   │
│  └────────────────────────┘            └────────────────────────────────┘   │
│            │                                        │                       │
│            ▼                                        ▼                       │
│  ┌────────────────────────────────────────────────────────────────────┐    │
│  │                         Transaction (Approve)                       │    │
│  │                                                                     │    │
│  │  1. Update RuleSuggestion                                          │    │
│  │     SET status = 'APPROVED'                                        │    │
│  │     SET reviewedBy = :userId                                       │    │
│  │     SET reviewedAt = NOW()                                         │    │
│  │                                                                     │    │
│  │  2. Check existing MappingRule                                     │    │
│  │     SELECT * FROM mapping_rules                                    │    │
│  │     WHERE forwarder_id AND field_name AND status = 'ACTIVE'        │    │
│  │                                                                     │    │
│  │  3a. If exists: Deprecate old rule                                 │    │
│  │      UPDATE mapping_rules SET status = 'DEPRECATED'                │    │
│  │                                                                     │    │
│  │  3b. Create new MappingRule                                        │    │
│  │      version = existingRule.version + 1 OR 1                       │    │
│  │      status = 'ACTIVE'                                             │    │
│  │      suggestionId = :suggestionId                                  │    │
│  │                                                                     │    │
│  │  4. Create RuleVersion record                                      │    │
│  │     changeReason = 'Approved from suggestion: :suggestionId'       │    │
│  │                                                                     │    │
│  │  5. Update Suggestion                                              │    │
│  │     SET status = 'IMPLEMENTED'                                     │    │
│  │                                                                     │    │
│  └────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Component Architecture

```
src/
├── app/
│   ├── api/rules/suggestions/[id]/
│   │   ├── approve/
│   │   │   └── route.ts                    # POST 批准 API
│   │   └── reject/
│   │       └── route.ts                    # POST 拒絕 API
│   └── (dashboard)/rules/
│       └── review/
│           ├── page.tsx                    # 待審核列表頁
│           └── [id]/
│               └── page.tsx                # 審核詳情頁
├── components/features/review/
│   ├── ReviewListPage.tsx                  # 審核列表主頁面
│   ├── ReviewTable.tsx                     # 審核表格
│   ├── ReviewDetailPage.tsx                # 審核詳情主頁面
│   ├── SuggestionInfo.tsx                  # 建議資訊卡片
│   ├── ImpactSummaryCard.tsx               # 影響摘要卡片
│   ├── SampleCasesTable.tsx                # 樣本案例表格
│   ├── ReviewActions.tsx                   # 審核操作按鈕
│   ├── ApproveDialog.tsx                   # 批准確認對話框
│   └── RejectDialog.tsx                    # 拒絕原因對話框
├── hooks/
│   ├── useApprove.ts                       # 批准 Hook
│   └── useReject.ts                        # 拒絕 Hook
└── types/
    └── review.ts                           # 審核相關類型
```

---

## 4. Implementation Guide

### Phase 1: Type Definitions

**File**: `src/types/review.ts`

```typescript
// ===== 拒絕原因枚舉 =====

export type RejectionReason =
  | 'INSUFFICIENT_DATA'    // 數據不足
  | 'POOR_ACCURACY'        // 準確率不佳
  | 'HIGH_RISK'            // 風險過高
  | 'DUPLICATE'            // 重複規則
  | 'NOT_APPLICABLE'       // 不適用
  | 'OTHER'                // 其他

// ===== 拒絕原因配置 =====

export const REJECTION_REASONS: {
  value: RejectionReason
  label: string
  description: string
}[] = [
  {
    value: 'INSUFFICIENT_DATA',
    label: '數據不足',
    description: '樣本數量不足以驗證規則的有效性'
  },
  {
    value: 'POOR_ACCURACY',
    label: '準確率不佳',
    description: '模擬測試顯示規則準確率未達標準'
  },
  {
    value: 'HIGH_RISK',
    label: '風險過高',
    description: '影響分析顯示潛在風險過高'
  },
  {
    value: 'DUPLICATE',
    label: '重複規則',
    description: '已存在功能相同或類似的規則'
  },
  {
    value: 'NOT_APPLICABLE',
    label: '不適用',
    description: '規則不適用於目標場景'
  },
  {
    value: 'OTHER',
    label: '其他',
    description: '其他原因（請在詳細說明中說明）'
  }
]

// ===== 批准請求 =====

export interface ApproveRequest {
  notes?: string
  effectiveDate?: string
}

export interface ApproveResponse {
  success: true
  data: {
    suggestionId: string
    ruleId: string
    ruleVersion: number
    status: 'APPROVED' | 'IMPLEMENTED'
    message: string
  }
}

// ===== 拒絕請求 =====

export interface RejectRequest {
  reason: RejectionReason
  reasonDetail: string
}

export interface RejectResponse {
  success: true
  data: {
    suggestionId: string
    status: 'REJECTED'
    message: string
  }
}

// ===== 審核歷史類型 =====

export interface ReviewHistoryItem {
  id: string
  suggestionId: string
  action: 'APPROVED' | 'REJECTED'
  reviewer: {
    id: string
    name: string
  }
  reviewedAt: string
  notes?: string
  rejectionReason?: RejectionReason
  rejectionDetail?: string
}

// ===== 審核列表項 =====

export interface ReviewListItem {
  id: string
  forwarder: {
    id: string
    name: string
    code: string
  }
  fieldName: string
  extractionType: string
  source: 'AUTO_LEARNING' | 'MANUAL' | 'IMPORT'
  correctionCount: number
  confidence: number
  priority: number
  createdAt: string
  hasExistingRule: boolean
  impactSummary: {
    totalAffected: number
    improvementRate: number
    regressionRate: number
  } | null
}
```

---

### Phase 2: API Layer (AC2, AC3)

#### 4.2.1 批准 API

**File**: `src/app/api/rules/suggestions/[id]/approve/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PERMISSIONS } from '@/lib/permissions'
import { z } from 'zod'

interface RouteParams {
  params: { id: string }
}

const approveSchema = z.object({
  notes: z.string().optional(),
  effectiveDate: z.string().optional()
})

// POST /api/rules/suggestions/[id]/approve - 批准建議
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
  const hasPermission = session.user.roles?.some(r =>
    r.permissions.includes(PERMISSIONS.RULE_APPROVE)
  )

  if (!hasPermission) {
    return NextResponse.json({
      success: false,
      error: {
        type: 'forbidden',
        title: 'Forbidden',
        status: 403,
        detail: 'RULE_APPROVE permission required'
      }
    }, { status: 403 })
  }

  const { id: suggestionId } = params

  try {
    const body = await request.json().catch(() => ({}))
    const parsed = approveSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({
        success: false,
        error: {
          type: 'validation_error',
          title: 'Validation Error',
          status: 400,
          detail: 'Invalid request body',
          errors: parsed.error.flatten().fieldErrors
        }
      }, { status: 400 })
    }

    const { notes, effectiveDate } = parsed.data

    // 執行事務
    const result = await prisma.$transaction(async (tx) => {
      // 1. 獲取建議
      const suggestion = await tx.ruleSuggestion.findUnique({
        where: { id: suggestionId },
        include: {
          forwarder: true
        }
      })

      if (!suggestion) {
        throw new Error('Suggestion not found')
      }

      if (suggestion.status !== 'PENDING') {
        throw new Error(`Suggestion is not pending (current status: ${suggestion.status})`)
      }

      // 2. 更新建議狀態為 APPROVED
      await tx.ruleSuggestion.update({
        where: { id: suggestionId },
        data: {
          status: 'APPROVED',
          reviewedBy: session.user!.id,
          reviewedAt: new Date(),
          reviewNotes: notes
        }
      })

      // 3. 檢查是否有現有活躍規則
      const existingRule = await tx.mappingRule.findFirst({
        where: {
          forwarderId: suggestion.forwarderId,
          fieldName: suggestion.fieldName,
          status: 'ACTIVE'
        }
      })

      let newRule
      let newVersion: number

      if (existingRule) {
        // 3a. 棄用舊規則
        await tx.mappingRule.update({
          where: { id: existingRule.id },
          data: { status: 'DEPRECATED' }
        })

        newVersion = existingRule.version + 1

        // 3b. 創建新版本規則
        newRule = await tx.mappingRule.create({
          data: {
            forwarderId: suggestion.forwarderId,
            fieldName: suggestion.fieldName,
            extractionType: suggestion.extractionType,
            pattern: suggestion.suggestedPattern,
            confidence: suggestion.confidence,
            priority: existingRule.priority,
            version: newVersion,
            status: 'ACTIVE',
            description: `Upgraded from suggestion (${suggestion.source})`,
            createdBy: session.user!.id,
            suggestionId: suggestion.id
          }
        })
      } else {
        newVersion = 1

        // 3c. 創建新規則
        newRule = await tx.mappingRule.create({
          data: {
            forwarderId: suggestion.forwarderId,
            fieldName: suggestion.fieldName,
            extractionType: suggestion.extractionType,
            pattern: suggestion.suggestedPattern,
            confidence: suggestion.confidence,
            priority: 0,
            version: newVersion,
            status: 'ACTIVE',
            description: `Created from suggestion (${suggestion.source})`,
            createdBy: session.user!.id,
            suggestionId: suggestion.id
          }
        })
      }

      // 4. 創建版本歷史記錄
      await tx.ruleVersion.create({
        data: {
          ruleId: newRule.id,
          version: newVersion,
          extractionType: suggestion.extractionType,
          pattern: suggestion.suggestedPattern,
          confidence: suggestion.confidence,
          priority: newRule.priority,
          changeReason: `Approved from suggestion: ${suggestion.id}`,
          createdBy: session.user!.id
        }
      })

      // 5. 更新建議狀態為 IMPLEMENTED
      await tx.ruleSuggestion.update({
        where: { id: suggestionId },
        data: { status: 'IMPLEMENTED' }
      })

      // 6. 如果有關聯的 CorrectionPattern，更新其狀態
      if (suggestion.patternId) {
        await tx.correctionPattern.update({
          where: { id: suggestion.patternId },
          data: {
            status: 'PROCESSED',
            processedAt: new Date(),
            processedBy: session.user!.id
          }
        })
      }

      return { suggestion, rule: newRule, version: newVersion }
    })

    return NextResponse.json({
      success: true,
      data: {
        suggestionId,
        ruleId: result.rule.id,
        ruleVersion: result.version,
        status: 'IMPLEMENTED',
        message: result.version === 1
          ? 'New rule created and activated'
          : `Rule upgraded to version ${result.version}`
      }
    })

  } catch (error) {
    console.error('Failed to approve suggestion:', error)

    const message = error instanceof Error ? error.message : 'Unknown error'
    const status = message.includes('not found') ? 404
      : message.includes('not pending') ? 400
      : 500

    return NextResponse.json({
      success: false,
      error: {
        type: status === 404 ? 'not_found' : status === 400 ? 'bad_request' : 'internal_error',
        title: status === 404 ? 'Not Found' : status === 400 ? 'Bad Request' : 'Internal Server Error',
        status,
        detail: message
      }
    }, { status })
  }
}
```

#### 4.2.2 拒絕 API

**File**: `src/app/api/rules/suggestions/[id]/reject/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PERMISSIONS } from '@/lib/permissions'
import { z } from 'zod'

interface RouteParams {
  params: { id: string }
}

const rejectSchema = z.object({
  reason: z.enum([
    'INSUFFICIENT_DATA',
    'POOR_ACCURACY',
    'HIGH_RISK',
    'DUPLICATE',
    'NOT_APPLICABLE',
    'OTHER'
  ]),
  reasonDetail: z.string().min(1, 'Rejection detail is required')
})

// POST /api/rules/suggestions/[id]/reject - 拒絕建議
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

  const hasPermission = session.user.roles?.some(r =>
    r.permissions.includes(PERMISSIONS.RULE_APPROVE)
  )

  if (!hasPermission) {
    return NextResponse.json({
      success: false,
      error: {
        type: 'forbidden',
        title: 'Forbidden',
        status: 403,
        detail: 'RULE_APPROVE permission required'
      }
    }, { status: 403 })
  }

  const { id: suggestionId } = params

  try {
    const body = await request.json()
    const parsed = rejectSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({
        success: false,
        error: {
          type: 'validation_error',
          title: 'Validation Error',
          status: 400,
          detail: 'Invalid request body',
          errors: parsed.error.flatten().fieldErrors
        }
      }, { status: 400 })
    }

    const { reason, reasonDetail } = parsed.data

    // 執行事務
    const result = await prisma.$transaction(async (tx) => {
      // 1. 獲取建議
      const suggestion = await tx.ruleSuggestion.findUnique({
        where: { id: suggestionId }
      })

      if (!suggestion) {
        throw new Error('Suggestion not found')
      }

      if (suggestion.status !== 'PENDING') {
        throw new Error(`Suggestion is not pending (current status: ${suggestion.status})`)
      }

      // 2. 更新建議狀態為 REJECTED
      await tx.ruleSuggestion.update({
        where: { id: suggestionId },
        data: {
          status: 'REJECTED',
          reviewedBy: session.user!.id,
          reviewedAt: new Date(),
          rejectionReason: `${reason}: ${reasonDetail}`
        }
      })

      // 3. 如果有關聯的 CorrectionPattern，更新其狀態為 IGNORED
      if (suggestion.patternId) {
        await tx.correctionPattern.update({
          where: { id: suggestion.patternId },
          data: {
            status: 'IGNORED',
            processedAt: new Date(),
            processedBy: session.user!.id
          }
        })
      }

      return suggestion
    })

    return NextResponse.json({
      success: true,
      data: {
        suggestionId,
        status: 'REJECTED',
        message: 'Suggestion rejected'
      }
    })

  } catch (error) {
    console.error('Failed to reject suggestion:', error)

    const message = error instanceof Error ? error.message : 'Unknown error'
    const status = message.includes('not found') ? 404
      : message.includes('not pending') ? 400
      : 500

    return NextResponse.json({
      success: false,
      error: {
        type: status === 404 ? 'not_found' : status === 400 ? 'bad_request' : 'internal_error',
        title: status === 404 ? 'Not Found' : status === 400 ? 'Bad Request' : 'Internal Server Error',
        status,
        detail: message
      }
    }, { status })
  }
}
```

---

### Phase 3: React Query Hooks

**File**: `src/hooks/useApprove.ts`

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ApproveRequest, ApproveResponse } from '@/types/review'

async function approveSuggestion(
  suggestionId: string,
  data: ApproveRequest
): Promise<ApproveResponse> {
  const response = await fetch(`/api/rules/suggestions/${suggestionId}/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  })

  const result = await response.json()

  if (!result.success) {
    throw new Error(result.error?.detail || 'Failed to approve suggestion')
  }

  return result
}

export function useApprove(suggestionId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: ApproveRequest) => approveSuggestion(suggestionId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suggestions'] })
      queryClient.invalidateQueries({ queryKey: ['suggestion', suggestionId] })
      queryClient.invalidateQueries({ queryKey: ['rules'] })
    }
  })
}
```

**File**: `src/hooks/useReject.ts`

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { RejectRequest, RejectResponse } from '@/types/review'

async function rejectSuggestion(
  suggestionId: string,
  data: RejectRequest
): Promise<RejectResponse> {
  const response = await fetch(`/api/rules/suggestions/${suggestionId}/reject`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  })

  const result = await response.json()

  if (!result.success) {
    throw new Error(result.error?.detail || 'Failed to reject suggestion')
  }

  return result
}

export function useReject(suggestionId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: RejectRequest) => rejectSuggestion(suggestionId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suggestions'] })
      queryClient.invalidateQueries({ queryKey: ['suggestion', suggestionId] })
    }
  })
}
```

---

### Phase 4: UI Components (AC1, AC2, AC3)

#### 4.4.1 審核詳情頁面

**File**: `src/app/(dashboard)/rules/review/[id]/page.tsx`

```typescript
import { Suspense } from 'react'
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { PERMISSIONS } from '@/lib/permissions'
import { ReviewDetailPage } from '@/components/features/review/ReviewDetailPage'
import { Skeleton } from '@/components/ui/skeleton'

interface PageProps {
  params: { id: string }
}

export const metadata = {
  title: '規則審核 - Document Extraction',
  description: '審核規則升級建議'
}

export default async function ReviewPage({ params }: PageProps) {
  const session = await auth()

  const hasPermission = session?.user?.roles?.some(r =>
    r.permissions.includes(PERMISSIONS.RULE_APPROVE)
  )

  if (!hasPermission) {
    redirect('/unauthorized')
  }

  return (
    <div className="container mx-auto py-6">
      <Suspense fallback={<ReviewPageSkeleton />}>
        <ReviewDetailPage suggestionId={params.id} />
      </Suspense>
    </div>
  )
}

function ReviewPageSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-10 w-1/3" />
      <div className="grid grid-cols-2 gap-6">
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
      </div>
      <Skeleton className="h-48" />
    </div>
  )
}
```

#### 4.4.2 審核詳情主組件

**File**: `src/components/features/review/ReviewDetailPage.tsx`

```typescript
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSuggestionDetail } from '@/hooks/useSuggestionDetail'
import { useImpactAnalysis } from '@/hooks/useImpactAnalysis'
import { useApprove } from '@/hooks/useApprove'
import { useReject } from '@/hooks/useReject'
import { SuggestionInfo } from './SuggestionInfo'
import { ImpactSummaryCard } from './ImpactSummaryCard'
import { SampleCasesTable } from './SampleCasesTable'
import { ApproveDialog } from './ApproveDialog'
import { RejectDialog } from './RejectDialog'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  ArrowLeft,
  Check,
  X,
  AlertCircle,
  ExternalLink
} from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'

interface ReviewDetailPageProps {
  suggestionId: string
}

export function ReviewDetailPage({ suggestionId }: ReviewDetailPageProps) {
  const router = useRouter()
  const [showApproveDialog, setShowApproveDialog] = useState(false)
  const [showRejectDialog, setShowRejectDialog] = useState(false)

  const { data: suggestionData, isLoading: loadingSuggestion } = useSuggestionDetail(suggestionId)
  const { data: impactData, isLoading: loadingImpact } = useImpactAnalysis(suggestionId)

  const approve = useApprove(suggestionId)
  const reject = useReject(suggestionId)

  const handleApprove = async (data: { notes?: string; effectiveDate?: string }) => {
    try {
      await approve.mutateAsync(data)
      toast.success('規則已批准並生效')
      setShowApproveDialog(false)
      router.push('/rules/review')
    } catch (error) {
      toast.error('批准失敗：' + (error as Error).message)
    }
  }

  const handleReject = async (data: { reason: string; reasonDetail: string }) => {
    try {
      await reject.mutateAsync(data as any)
      toast.success('建議已拒絕')
      setShowRejectDialog(false)
      router.push('/rules/review')
    } catch (error) {
      toast.error('拒絕失敗：' + (error as Error).message)
    }
  }

  if (loadingSuggestion) {
    return <div className="text-center py-12">載入中...</div>
  }

  if (!suggestionData) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center">
        <AlertCircle className="h-12 w-12 text-destructive mb-4" />
        <h3 className="text-lg font-medium">找不到建議</h3>
      </div>
    )
  }

  const suggestion = suggestionData.data

  // 檢查是否為待審核狀態
  const isPending = suggestion.status === 'PENDING'

  return (
    <div className="space-y-6">
      {/* 標頭 */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/rules/review')}
            className="mb-2 -ml-2"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            返回列表
          </Button>
          <h1 className="text-2xl font-bold">審核規則建議</h1>
          <p className="text-muted-foreground">
            {suggestion.forwarder.name} - {suggestion.fieldName}
          </p>
        </div>
      </div>

      {/* 非待審核狀態提示 */}
      {!isPending && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            此建議狀態為「{suggestion.status}」，無法進行審核操作。
          </AlertDescription>
        </Alert>
      )}

      {/* 主要內容 */}
      <div className="grid grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>規則詳情</CardTitle>
          </CardHeader>
          <CardContent>
            <SuggestionInfo suggestion={suggestion} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>影響分析</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href={`/rules/suggestions/${suggestionId}/impact`}>
                <ExternalLink className="h-4 w-4 mr-1" />
                詳細分析
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {loadingImpact ? (
              <div className="text-center py-4">載入中...</div>
            ) : impactData ? (
              <ImpactSummaryCard statistics={impactData.data.statistics} />
            ) : (
              <div className="text-muted-foreground">無法載入影響分析</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 樣本案例 */}
      <Card>
        <CardHeader>
          <CardTitle>樣本案例</CardTitle>
        </CardHeader>
        <CardContent>
          <SampleCasesTable cases={suggestion.sampleCases} />
        </CardContent>
      </Card>

      {/* 審核操作 */}
      {isPending && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex justify-end gap-4">
              <Button
                variant="outline"
                onClick={() => setShowRejectDialog(true)}
                disabled={reject.isPending}
              >
                <X className="h-4 w-4 mr-2" />
                拒絕
              </Button>
              <Button
                onClick={() => setShowApproveDialog(true)}
                disabled={approve.isPending}
              >
                <Check className="h-4 w-4 mr-2" />
                批准
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 批准對話框 */}
      <ApproveDialog
        open={showApproveDialog}
        onOpenChange={setShowApproveDialog}
        onConfirm={handleApprove}
        isLoading={approve.isPending}
      />

      {/* 拒絕對話框 */}
      <RejectDialog
        open={showRejectDialog}
        onOpenChange={setShowRejectDialog}
        onConfirm={handleReject}
        isLoading={reject.isPending}
      />
    </div>
  )
}
```

#### 4.4.3 批准對話框

**File**: `src/components/features/review/ApproveDialog.tsx`

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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Loader2 } from 'lucide-react'

interface ApproveDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (data: { notes?: string; effectiveDate?: string }) => void
  isLoading: boolean
}

export function ApproveDialog({
  open,
  onOpenChange,
  onConfirm,
  isLoading
}: ApproveDialogProps) {
  const [notes, setNotes] = useState('')
  const [effectiveDate, setEffectiveDate] = useState('')

  const handleConfirm = () => {
    onConfirm({
      notes: notes || undefined,
      effectiveDate: effectiveDate || undefined
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>確認批准</DialogTitle>
          <DialogDescription>
            批准此規則建議後，將創建或更新對應的映射規則並立即生效。
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="notes">備註 (選填)</Label>
            <Textarea
              id="notes"
              placeholder="輸入批准備註..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="effectiveDate">生效日期 (選填)</Label>
            <Input
              id="effectiveDate"
              type="date"
              value={effectiveDate}
              onChange={(e) => setEffectiveDate(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              留空則立即生效
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            取消
          </Button>
          <Button onClick={handleConfirm} disabled={isLoading}>
            {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            確認批准
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

#### 4.4.4 拒絕對話框

**File**: `src/components/features/review/RejectDialog.tsx`

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
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Loader2 } from 'lucide-react'
import { REJECTION_REASONS, RejectionReason } from '@/types/review'

interface RejectDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (data: { reason: RejectionReason; reasonDetail: string }) => void
  isLoading: boolean
}

export function RejectDialog({
  open,
  onOpenChange,
  onConfirm,
  isLoading
}: RejectDialogProps) {
  const [reason, setReason] = useState<RejectionReason>('OTHER')
  const [reasonDetail, setReasonDetail] = useState('')

  const handleConfirm = () => {
    if (!reasonDetail.trim()) {
      return
    }
    onConfirm({ reason, reasonDetail: reasonDetail.trim() })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>拒絕建議</DialogTitle>
          <DialogDescription>
            請選擇拒絕原因並提供詳細說明。
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="space-y-3">
            <Label>拒絕原因</Label>
            <RadioGroup
              value={reason}
              onValueChange={(v) => setReason(v as RejectionReason)}
            >
              {REJECTION_REASONS.map((r) => (
                <div key={r.value} className="flex items-start space-x-2">
                  <RadioGroupItem value={r.value} id={r.value} />
                  <Label
                    htmlFor={r.value}
                    className="cursor-pointer font-normal"
                  >
                    <span className="font-medium">{r.label}</span>
                    <span className="text-sm text-muted-foreground ml-2">
                      - {r.description}
                    </span>
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reasonDetail">詳細說明 *</Label>
            <Textarea
              id="reasonDetail"
              placeholder="請提供拒絕的詳細說明..."
              value={reasonDetail}
              onChange={(e) => setReasonDetail(e.target.value)}
              rows={3}
            />
            {!reasonDetail.trim() && (
              <p className="text-xs text-destructive">
                詳細說明為必填
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            取消
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={isLoading || !reasonDetail.trim()}
          >
            {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            確認拒絕
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

---

## 5. Testing Guide

### 5.1 Integration Tests

**File**: `tests/integration/api/review.test.ts`

```typescript
import { POST as approveHandler } from '@/app/api/rules/suggestions/[id]/approve/route'
import { POST as rejectHandler } from '@/app/api/rules/suggestions/[id]/reject/route'
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'

describe('Review API', () => {
  describe('POST /api/rules/suggestions/[id]/approve', () => {
    it('should approve pending suggestion and create rule', async () => {
      const request = new NextRequest('http://localhost', {
        method: 'POST',
        body: JSON.stringify({ notes: 'Approved after review' })
      })

      const response = await approveHandler(request, {
        params: { id: 'test-suggestion-id' }
      })
      const data = await response.json()

      expect(data.success).toBe(true)
      expect(data.data.status).toBe('IMPLEMENTED')
      expect(data.data.ruleId).toBeDefined()
    })

    it('should return 400 for non-pending suggestion', async () => {
      const request = new NextRequest('http://localhost', {
        method: 'POST',
        body: JSON.stringify({})
      })

      const response = await approveHandler(request, {
        params: { id: 'already-approved-suggestion' }
      })

      expect(response.status).toBe(400)
    })

    it('should return 403 without RULE_APPROVE permission', async () => {
      // Test with user without permission
      const request = new NextRequest('http://localhost', {
        method: 'POST',
        body: JSON.stringify({})
      })

      const response = await approveHandler(request, {
        params: { id: 'test-suggestion-id' }
      })

      expect(response.status).toBe(403)
    })
  })

  describe('POST /api/rules/suggestions/[id]/reject', () => {
    it('should reject suggestion with reason', async () => {
      const request = new NextRequest('http://localhost', {
        method: 'POST',
        body: JSON.stringify({
          reason: 'HIGH_RISK',
          reasonDetail: 'Too many potential regressions'
        })
      })

      const response = await rejectHandler(request, {
        params: { id: 'test-suggestion-id' }
      })
      const data = await response.json()

      expect(data.success).toBe(true)
      expect(data.data.status).toBe('REJECTED')
    })

    it('should return 400 without reason detail', async () => {
      const request = new NextRequest('http://localhost', {
        method: 'POST',
        body: JSON.stringify({
          reason: 'OTHER',
          reasonDetail: ''
        })
      })

      const response = await rejectHandler(request, {
        params: { id: 'test-suggestion-id' }
      })

      expect(response.status).toBe(400)
    })
  })
})
```

---

## 6. Verification Checklist

### 6.1 Acceptance Criteria Verification

- [ ] **AC1**: 審核頁面
  - [ ] 顯示規則詳情（Forwarder、欄位、類型、模式）
  - [ ] 顯示影響分析摘要
  - [ ] 顯示樣本案例
  - [ ] 顯示建議來源（AUTO/MANUAL）

- [ ] **AC2**: 批准規則
  - [ ] 可選填批准備註
  - [ ] 可選填生效日期
  - [ ] 批准後建議狀態更新為 IMPLEMENTED
  - [ ] 創建或更新 MappingRule
  - [ ] 創建 RuleVersion 記錄

- [ ] **AC3**: 拒絕規則
  - [ ] 必須選擇拒絕原因
  - [ ] 必須填寫詳細說明
  - [ ] 拒絕後建議狀態更新為 REJECTED
  - [ ] 關聯 Pattern 狀態更新為 IGNORED

### 6.2 Technical Verification

- [ ] API 響應符合 RFC 7807 格式
- [ ] 權限檢查正確（RULE_APPROVE）
- [ ] 事務正確處理（批准操作）
- [ ] 樂觀鎖處理並發審核

---

## 7. Files to Create/Modify

| File Path | Action | Description |
|-----------|--------|-------------|
| `src/types/review.ts` | Create | 審核相關類型定義 |
| `src/app/api/rules/suggestions/[id]/approve/route.ts` | Create | 批准 API |
| `src/app/api/rules/suggestions/[id]/reject/route.ts` | Create | 拒絕 API |
| `src/hooks/useApprove.ts` | Create | 批准 Hook |
| `src/hooks/useReject.ts` | Create | 拒絕 Hook |
| `src/app/(dashboard)/rules/review/page.tsx` | Create | 待審核列表頁 |
| `src/app/(dashboard)/rules/review/[id]/page.tsx` | Create | 審核詳情頁 |
| `src/components/features/review/*.tsx` | Create | 審核相關 UI 組件 |
| `prisma/schema.prisma` | Modify | 添加 rejectionReason 欄位 |

---

*Tech Spec Created: 2025-12-16*
*Story Reference: 4-6-review-learning-rule*
