# Story 4.6: 審核學習規則

**Status:** done

---

## Story

**As a** Super User,
**I want** 審核待升級的學習規則,
**So that** 只有經過驗證的規則才會被應用。

---

## Acceptance Criteria

### AC1: 審核頁面

**Given** Super User 在規則審核頁面
**When** 查看待審核規則
**Then** 顯示規則詳情和影響分析

### AC2: 批准規則

**Given** Super User 審核規則
**When** 點擊「批准」
**Then** 規則狀態更新為「已批准」，進入生效隊列

### AC3: 拒絕規則

**Given** Super User 審核規則
**When** 點擊「拒絕」
**Then** 需要填寫拒絕原因，規則狀態更新為「已拒絕」

---

## Tasks / Subtasks

- [x] **Task 1: 待審核列表頁面** (AC: #1)
  - [x] 1.1 創建 `src/app/(dashboard)/rules/review/page.tsx`
  - [x] 1.2 顯示待審核規則列表
  - [x] 1.3 顯示來源標記（手動/自動學習）
  - [x] 1.4 支援排序和篩選

- [x] **Task 2: 審核詳情頁面** (AC: #1)
  - [x] 2.1 創建 `src/app/(dashboard)/rules/review/[id]/page.tsx`
  - [x] 2.2 顯示規則完整詳情
  - [x] 2.3 顯示影響分析摘要
  - [x] 2.4 顯示樣本案例

- [x] **Task 3: 待審核列表 API** (AC: #1)
  - [x] 3.1 創建 GET `/api/rules/suggestions?status=PENDING`
  - [x] 3.2 返回待審核建議列表
  - [x] 3.3 包含摘要統計

- [x] **Task 4: 批准功能** (AC: #2)
  - [x] 4.1 創建批准按鈕
  - [x] 4.2 可選填批准備註
  - [x] 4.3 確認對話框

- [x] **Task 5: 批准 API** (AC: #2)
  - [x] 5.1 創建 POST `/api/rules/suggestions/[id]/approve`
  - [x] 5.2 更新建議狀態為 APPROVED
  - [x] 5.3 創建或更新 MappingRule
  - [x] 5.4 記錄審核人和時間

- [x] **Task 6: 拒絕功能** (AC: #3)
  - [x] 6.1 創建拒絕按鈕
  - [x] 6.2 拒絕原因必填對話框
  - [x] 6.3 原因選項 + 自由文字

- [x] **Task 7: 拒絕 API** (AC: #3)
  - [x] 7.1 創建 POST `/api/rules/suggestions/[id]/reject`
  - [x] 7.2 驗證拒絕原因
  - [x] 7.3 更新建議狀態為 REJECTED
  - [x] 7.4 記錄拒絕原因

- [x] **Task 8: 審核歷史** (AC: #2, #3)
  - [x] 8.1 記錄所有審核動作
  - [x] 8.2 顯示審核歷史
  - [x] 8.3 審計追蹤

- [x] **Task 9: 驗證與測試** (AC: #1-3)
  - [x] 9.1 測試列表顯示
  - [x] 9.2 測試批准流程
  - [x] 9.3 測試拒絕流程
  - [x] 9.4 測試權限控制

---

## Dev Notes

### 依賴項

- **Story 4.5**: 影響分析功能

### Architecture Compliance

```typescript
// POST /api/rules/suggestions/[id]/approve
interface ApproveRequest {
  notes?: string
  effectiveDate?: string  // 可選的生效日期
}

interface ApproveResponse {
  success: true
  data: {
    suggestionId: string
    ruleId: string
    status: 'APPROVED'
    message: string
  }
}

// POST /api/rules/suggestions/[id]/reject
interface RejectRequest {
  reason: RejectionReason
  reasonDetail: string
}

enum RejectionReason {
  INSUFFICIENT_DATA = 'INSUFFICIENT_DATA',      // 數據不足
  POOR_ACCURACY = 'POOR_ACCURACY',              // 準確率不佳
  HIGH_RISK = 'HIGH_RISK',                      // 風險過高
  DUPLICATE = 'DUPLICATE',                      // 重複規則
  NOT_APPLICABLE = 'NOT_APPLICABLE',            // 不適用
  OTHER = 'OTHER',                              // 其他
}

interface RejectResponse {
  success: true
  data: {
    suggestionId: string
    status: 'REJECTED'
    message: string
  }
}
```

```typescript
// src/app/api/rules/suggestions/[id]/approve/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PERMISSIONS } from '@/lib/permissions'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth()

  // 權限檢查
  const hasPermission = session?.user?.roles?.some(r =>
    r.permissions.includes(PERMISSIONS.RULE_APPROVE)
  )

  if (!hasPermission) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 403 }
    )
  }

  const body = await request.json()
  const { notes, effectiveDate } = body

  // 開始事務
  const result = await prisma.$transaction(async (tx) => {
    // 1. 獲取建議
    const suggestion = await tx.ruleSuggestion.findUnique({
      where: { id: params.id },
    })

    if (!suggestion || suggestion.status !== 'PENDING') {
      throw new Error('Invalid suggestion')
    }

    // 2. 更新建議狀態
    await tx.ruleSuggestion.update({
      where: { id: params.id },
      data: {
        status: 'APPROVED',
        reviewedBy: session.user.id,
        reviewedAt: new Date(),
        reviewNotes: notes,
      },
    })

    // 3. 創建或更新映射規則
    const existingRule = await tx.mappingRule.findFirst({
      where: {
        forwarderId: suggestion.forwarderId,
        fieldName: suggestion.fieldName,
        status: 'ACTIVE',
      },
    })

    let rule
    if (existingRule) {
      // 棄用舊規則，創建新版本
      await tx.mappingRule.update({
        where: { id: existingRule.id },
        data: { status: 'DEPRECATED' },
      })

      rule = await tx.mappingRule.create({
        data: {
          forwarderId: suggestion.forwarderId,
          fieldName: suggestion.fieldName,
          extractionType: suggestion.extractionType,
          pattern: suggestion.suggestedPattern,
          version: existingRule.version + 1,
          status: 'ACTIVE',
          createdBy: session.user.id,
        },
      })
    } else {
      rule = await tx.mappingRule.create({
        data: {
          forwarderId: suggestion.forwarderId,
          fieldName: suggestion.fieldName,
          extractionType: suggestion.extractionType,
          pattern: suggestion.suggestedPattern,
          version: 1,
          status: 'ACTIVE',
          createdBy: session.user.id,
        },
      })
    }

    // 4. 創建版本歷史
    await tx.ruleVersion.create({
      data: {
        ruleId: rule.id,
        version: rule.version,
        pattern: rule.pattern,
        createdBy: session.user.id,
        changeReason: `Approved from suggestion: ${suggestion.id}`,
      },
    })

    return { suggestion, rule }
  })

  return NextResponse.json({
    success: true,
    data: {
      suggestionId: params.id,
      ruleId: result.rule.id,
      status: 'APPROVED',
      message: 'Rule approved and activated',
    },
  })
}
```

```typescript
// src/app/(dashboard)/rules/review/[id]/page.tsx
export default async function ReviewDetailPage({ params }: { params: { id: string } }) {
  const session = await auth()

  // 權限檢查
  const hasPermission = session?.user?.roles?.some(r =>
    r.permissions.includes(PERMISSIONS.RULE_APPROVE)
  )

  if (!hasPermission) {
    redirect('/unauthorized')
  }

  const suggestion = await getSuggestionWithDetails(params.id)
  const impact = await getImpactAnalysis(params.id)

  return (
    <div className="space-y-6">
      <SuggestionHeader suggestion={suggestion} />

      <div className="grid grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>規則詳情</CardTitle>
          </CardHeader>
          <CardContent>
            <RuleDetails suggestion={suggestion} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>影響分析</CardTitle>
          </CardHeader>
          <CardContent>
            <ImpactSummary impact={impact} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>樣本案例</CardTitle>
        </CardHeader>
        <CardContent>
          <SampleCases cases={suggestion.sampleCases} />
        </CardContent>
      </Card>

      <ReviewActions
        suggestionId={params.id}
        onApprove={handleApprove}
        onReject={handleReject}
      />
    </div>
  )
}
```

### References

- [Source: docs/03-epics/sections/epic-4-mapping-rules-auto-learning.md#story-46]
- [Source: docs/01-planning/prd/sections/functional-requirements.md#FR19]

---

## Story Metadata

| 屬性 | 值 |
|------|------|
| Story ID | 4.6 |
| Story Key | 4-6-review-learning-rule |
| Epic | Epic 4: 映射規則管理與自動學習 |
| FR Coverage | FR19 |
| Dependencies | Story 4.5 |

---

*Story created: 2025-12-16*
*Status: done*
*Completed: 2025-12-19*

## Implementation Summary

### Files Created/Modified

**Types:**
- `src/types/review.ts` - RejectionReason type and REJECTION_REASONS constant

**API Routes:**
- `src/app/api/rules/suggestions/[id]/approve/route.ts` - Rule approval API
- `src/app/api/rules/suggestions/[id]/reject/route.ts` - Rule rejection API

**Hooks:**
- `src/hooks/useRuleApprove.ts` - React Query mutation for rule approval
- `src/hooks/useRuleReject.ts` - React Query mutation for rule rejection

**Components:**
- `src/components/features/rule-review/SuggestionInfo.tsx` - Suggestion details display
- `src/components/features/rule-review/ImpactSummaryCard.tsx` - Impact statistics summary
- `src/components/features/rule-review/SampleCasesTable.tsx` - Sample cases table
- `src/components/features/rule-review/ApproveDialog.tsx` - Approval confirmation dialog
- `src/components/features/rule-review/RejectDialog.tsx` - Rejection dialog with reason selection
- `src/components/features/rule-review/ReviewDetailPage.tsx` - Main review detail component
- `src/components/features/rule-review/index.ts` - Component exports

**Pages:**
- `src/app/(dashboard)/rules/review/page.tsx` - Review list page with filters and statistics
- `src/app/(dashboard)/rules/review/[id]/page.tsx` - Review detail page with permission check

### Key Features Implemented
1. **AC1 - 審核頁面**: Complete review UI with rule details, impact analysis summary, and sample cases
2. **AC2 - 批准規則**: Approve functionality with optional notes, MappingRule creation/update, RuleVersion record
3. **AC3 - 拒絕規則**: Reject functionality with required reason selection and detailed explanation
