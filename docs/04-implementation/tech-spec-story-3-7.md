# Tech Spec: Story 3-7 升級複雜案例

## 1. Overview

### 1.1 Story Reference
- **Story ID**: 3.7
- **Title**: 升級複雜案例
- **Epic**: Epic 3 - 發票審核與修正工作流

### 1.2 Story Description
作為數據處理員，我希望將無法處理的複雜案例升級給 Super User，以便專業人員可以處理特殊情況。

### 1.3 Dependencies
- **Story 3-5**: 修正提取結果（提供審核界面）
- **Story 3-8 連接**: Super User 處理升級案例

---

## 2. Acceptance Criteria Mapping

| AC ID | Description | Implementation Approach |
|-------|-------------|------------------------|
| AC1 | 升級按鈕 | ReviewActions 中的升級按鈕 |
| AC2 | 提交升級請求 | EscalationDialog + POST /api/review/[id]/escalate |
| AC3 | 升級原因選擇 | EscalationReason enum + 表單驗證 |

---

## 3. Architecture Overview

### 3.1 Escalation Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          升級流程                                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  用戶點擊「升級案例」                                                      │
│         │                                                                │
│         ▼                                                                │
│  ┌──────────────────┐                                                    │
│  │ EscalationDialog │ ◄─── 顯示升級表單                                   │
│  └────────┬─────────┘                                                    │
│           │                                                              │
│           ▼                                                              │
│  ┌──────────────────┐                                                    │
│  │ 選擇升級原因     │                                                     │
│  │ • UNKNOWN_FORWARDER                                                   │
│  │ • RULE_NOT_APPLICABLE                                                 │
│  │ • POOR_QUALITY                                                        │
│  │ • OTHER                                                               │
│  └────────┬─────────┘                                                    │
│           │                                                              │
│           ▼                                                              │
│  ┌──────────────────┐      ┌──────────────────────────────────────────┐ │
│  │ POST /escalate   │ ───► │ 後端處理:                                 │ │
│  └──────────────────┘      │ 1. 更新 Document 狀態 → ESCALATED        │ │
│                            │ 2. 創建 Escalation 記錄                   │ │
│                            │ 3. 更新 ProcessingQueue                   │ │
│                            │ 4. 通知 Super User                        │ │
│                            │ 5. 記錄審計日誌                           │ │
│                            └──────────────────────────────────────────┘ │
│           │                                                              │
│           ▼                                                              │
│  ┌──────────────────┐                                                    │
│  │ 成功反饋         │ ◄─── Toast + 返回列表                              │
│  └──────────────────┘                                                    │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Component Architecture

```
src/
├── app/api/review/[id]/
│   └── escalate/
│       └── route.ts                    # 升級 API
├── components/features/review/
│   ├── EscalationDialog.tsx            # 升級對話框
│   └── EscalationReasonSelector.tsx    # 原因選擇器
├── hooks/
│   └── useEscalateReview.ts            # 升級操作 Hook
└── types/
    └── escalation.ts                   # 升級相關類型
```

---

## 4. Implementation Guide

### Phase 1: Database Schema (AC2)

#### 4.1.1 Escalation 模型

**File**: `prisma/schema.prisma` (已在 Story 文件中定義，此處確認)

```prisma
model Escalation {
  id            String           @id @default(uuid())
  documentId    String           @unique @map("document_id")
  escalatedBy   String           @map("escalated_by")
  reason        EscalationReason
  reasonDetail  String?          @map("reason_detail")
  status        EscalationStatus @default(PENDING)
  assignedTo    String?          @map("assigned_to")
  resolution    String?          // 解決方案說明
  createdAt     DateTime         @default(now()) @map("created_at")
  resolvedAt    DateTime?        @map("resolved_at")

  document  Document @relation(fields: [documentId], references: [id])
  escalator User     @relation("Escalator", fields: [escalatedBy], references: [id])
  assignee  User?    @relation("Assignee", fields: [assignedTo], references: [id])

  @@index([status])
  @@index([assignedTo])
  @@map("escalations")
}

enum EscalationReason {
  UNKNOWN_FORWARDER     // 無法識別 Forwarder
  RULE_NOT_APPLICABLE   // 映射規則不適用
  POOR_QUALITY          // 文件品質問題
  OTHER                 // 其他
}

enum EscalationStatus {
  PENDING      // 待處理
  IN_PROGRESS  // 處理中
  RESOLVED     // 已解決
  CANCELLED    // 已取消
}

// 更新 DocumentStatus enum
enum DocumentStatus {
  UPLOADED
  EXTRACTING
  EXTRACTED
  MAPPING
  PENDING_REVIEW
  ESCALATED       // 新增：已升級
  APPROVED
  REJECTED
  FAILED
}
```

---

### Phase 2: Type Definitions (AC3)

**File**: `src/types/escalation.ts`

```typescript
import { EscalationReason, EscalationStatus } from '@prisma/client'

// 升級請求
export interface EscalateRequest {
  reason: EscalationReason
  reasonDetail?: string
}

// 升級響應
export interface EscalateResponse {
  success: true
  data: {
    escalationId: string
    documentId: string
    status: EscalationStatus
    escalatedAt: string
  }
}

// 升級原因配置
export const ESCALATION_REASONS: {
  value: EscalationReason
  label: string
  description: string
  requiresDetail: boolean
}[] = [
  {
    value: 'UNKNOWN_FORWARDER',
    label: '無法識別 Forwarder',
    description: '系統無法判斷此發票來自哪個物流商',
    requiresDetail: false
  },
  {
    value: 'RULE_NOT_APPLICABLE',
    label: '映射規則不適用',
    description: '現有的映射規則無法正確處理此發票格式',
    requiresDetail: true
  },
  {
    value: 'POOR_QUALITY',
    label: '文件品質問題',
    description: '文件模糊、破損或無法正常讀取',
    requiresDetail: true
  },
  {
    value: 'OTHER',
    label: '其他',
    description: '其他需要 Super User 協助的情況',
    requiresDetail: true
  }
]

// 升級列表項
export interface EscalationListItem {
  id: string
  document: {
    id: string
    fileName: string
    forwarder: { name: string } | null
  }
  escalatedBy: { name: string; email: string }
  reason: EscalationReason
  reasonDetail: string | null
  status: EscalationStatus
  createdAt: string
}
```

---

### Phase 3: API Layer (AC2)

#### 4.3.1 升級 API

**File**: `src/app/api/review/[id]/escalate/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { DocumentStatus, EscalationStatus, QueueStatus } from '@prisma/client'
import { logAudit } from '@/lib/audit'
import { notifySuperUsers } from '@/services/notificationService'
import { z } from 'zod'

const escalateSchema = z.object({
  reason: z.enum([
    'UNKNOWN_FORWARDER',
    'RULE_NOT_APPLICABLE',
    'POOR_QUALITY',
    'OTHER'
  ]),
  reasonDetail: z.string().optional()
})

interface RouteParams {
  params: { id: string }
}

// POST /api/review/[id]/escalate - 升級案例
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

  const { id: documentId } = params

  try {
    // 解析並驗證請求
    const body = await request.json()
    const validation = escalateSchema.safeParse(body)

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

    const { reason, reasonDetail } = validation.data

    // 檢查需要詳情的原因是否提供了詳情
    if (['RULE_NOT_APPLICABLE', 'POOR_QUALITY', 'OTHER'].includes(reason) && !reasonDetail) {
      return NextResponse.json({
        success: false,
        error: {
          type: 'validation_error',
          title: 'Validation Error',
          status: 400,
          detail: 'Reason detail is required for this escalation reason'
        }
      }, { status: 400 })
    }

    // 獲取文件
    const document = await prisma.document.findUnique({
      where: { id: documentId },
      include: {
        processingQueue: true,
        escalation: true,
        forwarder: { select: { name: true } }
      }
    })

    if (!document) {
      return NextResponse.json({
        success: false,
        error: {
          type: 'not_found',
          title: 'Not Found',
          status: 404,
          detail: `Document ${documentId} not found`
        }
      }, { status: 404 })
    }

    // 檢查是否已升級
    if (document.escalation) {
      return NextResponse.json({
        success: false,
        error: {
          type: 'conflict',
          title: 'Conflict',
          status: 409,
          detail: 'Document already escalated'
        }
      }, { status: 409 })
    }

    // 檢查文件狀態
    if (document.status !== DocumentStatus.PENDING_REVIEW) {
      return NextResponse.json({
        success: false,
        error: {
          type: 'bad_request',
          title: 'Bad Request',
          status: 400,
          detail: `Document is in ${document.status} status, cannot escalate`
        }
      }, { status: 400 })
    }

    // 使用事務處理
    const result = await prisma.$transaction(async (tx) => {
      // 1. 創建升級記錄
      const escalation = await tx.escalation.create({
        data: {
          documentId,
          escalatedBy: session.user.id,
          reason,
          reasonDetail
        }
      })

      // 2. 更新文件狀態
      await tx.document.update({
        where: { id: documentId },
        data: {
          status: DocumentStatus.ESCALATED,
          updatedAt: new Date()
        }
      })

      // 3. 更新處理隊列
      if (document.processingQueue) {
        await tx.processingQueue.update({
          where: { id: document.processingQueue.id },
          data: {
            status: QueueStatus.ESCALATED,
            priority: 10 // 高優先級
          }
        })
      }

      return escalation
    })

    // 4. 通知 Super User
    await notifySuperUsers({
      type: 'ESCALATION',
      title: '新的升級案例',
      message: `${document.originalName || document.fileName} 需要處理`,
      data: {
        escalationId: result.id,
        documentId,
        reason,
        forwarderName: document.forwarder?.name
      }
    })

    // 5. 記錄審計日誌
    await logAudit({
      userId: session.user.id,
      action: 'DOCUMENT_ESCALATED',
      resourceType: 'Document',
      resourceId: documentId,
      details: {
        escalationId: result.id,
        reason,
        previousStatus: document.status
      }
    })

    return NextResponse.json({
      success: true,
      data: {
        escalationId: result.id,
        documentId,
        status: result.status,
        escalatedAt: result.createdAt.toISOString()
      }
    })

  } catch (error) {
    console.error('Failed to escalate document:', error)
    return NextResponse.json({
      success: false,
      error: {
        type: 'internal_error',
        title: 'Internal Server Error',
        status: 500,
        detail: 'Failed to escalate document'
      }
    }, { status: 500 })
  }
}
```

---

### Phase 4: React Query Hook (AC2)

**File**: `src/hooks/useEscalateReview.ts`

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { EscalateRequest, EscalateResponse } from '@/types/escalation'

interface EscalateParams {
  documentId: string
  data: EscalateRequest
}

async function escalateDocument({ documentId, data }: EscalateParams): Promise<EscalateResponse> {
  const response = await fetch(`/api/review/${documentId}/escalate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
  })

  const result = await response.json()

  if (!result.success) {
    throw new Error(result.error?.detail || 'Failed to escalate document')
  }

  return result
}

export function useEscalateReview() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: escalateDocument,
    onSuccess: (_, variables) => {
      // 使緩存失效
      queryClient.invalidateQueries({
        queryKey: ['reviewDetail', variables.documentId]
      })
      queryClient.invalidateQueries({
        queryKey: ['reviewQueue']
      })
    }
  })
}
```

---

### Phase 5: UI Components (AC1, AC3)

#### 4.5.1 升級對話框

**File**: `src/components/features/review/EscalationDialog.tsx`

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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Loader2, HelpCircle, FileX, AlertTriangle, MoreHorizontal } from 'lucide-react'
import { ESCALATION_REASONS, EscalateRequest } from '@/types/escalation'
import { EscalationReason } from '@prisma/client'
import { cn } from '@/lib/utils'

interface EscalationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (data: EscalateRequest) => void
  documentName: string
  isSubmitting?: boolean
}

const REASON_ICONS: Record<EscalationReason, React.ElementType> = {
  UNKNOWN_FORWARDER: HelpCircle,
  RULE_NOT_APPLICABLE: FileX,
  POOR_QUALITY: AlertTriangle,
  OTHER: MoreHorizontal
}

export function EscalationDialog({
  open,
  onOpenChange,
  onConfirm,
  documentName,
  isSubmitting
}: EscalationDialogProps) {
  const [selectedReason, setSelectedReason] = useState<EscalationReason | null>(null)
  const [reasonDetail, setReasonDetail] = useState('')

  const selectedReasonConfig = ESCALATION_REASONS.find(r => r.value === selectedReason)

  const handleConfirm = () => {
    if (!selectedReason) return

    onConfirm({
      reason: selectedReason,
      reasonDetail: reasonDetail || undefined
    })
  }

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setSelectedReason(null)
      setReasonDetail('')
    }
    onOpenChange(newOpen)
  }

  const canSubmit = selectedReason &&
    (!selectedReasonConfig?.requiresDetail || reasonDetail.trim().length > 0)

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle>升級案例</DialogTitle>
          <DialogDescription>
            將此發票升級給 Super User 處理。請選擇升級原因。
          </DialogDescription>
        </DialogHeader>

        {/* 文件信息 */}
        <div className="p-3 bg-muted rounded-lg">
          <p className="text-sm">
            <span className="text-muted-foreground">文件：</span>
            <span className="font-medium">{documentName}</span>
          </p>
        </div>

        {/* 原因選擇 */}
        <RadioGroup
          value={selectedReason || ''}
          onValueChange={(v) => setSelectedReason(v as EscalationReason)}
          className="space-y-3"
        >
          {ESCALATION_REASONS.map((reason) => {
            const Icon = REASON_ICONS[reason.value]
            const isSelected = selectedReason === reason.value

            return (
              <div
                key={reason.value}
                className={cn(
                  'flex items-start space-x-3 p-4 rounded-lg border cursor-pointer transition-colors',
                  isSelected
                    ? 'border-primary bg-primary/5'
                    : 'hover:bg-muted/50'
                )}
              >
                <RadioGroupItem value={reason.value} id={reason.value} />
                <div className="flex-1">
                  <Label
                    htmlFor={reason.value}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{reason.label}</span>
                    {reason.requiresDetail && (
                      <span className="text-xs text-muted-foreground">*需說明</span>
                    )}
                  </Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    {reason.description}
                  </p>
                </div>
              </div>
            )
          })}
        </RadioGroup>

        {/* 詳情輸入 */}
        {selectedReasonConfig && (
          <div className="space-y-2">
            <Label htmlFor="detail">
              詳細說明
              {selectedReasonConfig.requiresDetail && (
                <span className="text-destructive ml-1">*</span>
              )}
            </Label>
            <Textarea
              id="detail"
              value={reasonDetail}
              onChange={(e) => setReasonDetail(e.target.value)}
              placeholder={
                selectedReason === 'RULE_NOT_APPLICABLE'
                  ? '請說明哪個欄位的規則需要調整...'
                  : selectedReason === 'POOR_QUALITY'
                  ? '請描述文件的品質問題...'
                  : '請提供更多詳情...'
              }
              rows={3}
            />
            {selectedReasonConfig.requiresDetail && !reasonDetail.trim() && (
              <p className="text-xs text-destructive">請提供詳細說明</p>
            )}
          </div>
        )}

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
                提交中...
              </>
            ) : (
              '確認升級'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

---

### Phase 6: Page Integration

#### 4.6.1 更新審核詳情頁面

**File**: `src/app/(dashboard)/review/[id]/page.tsx` (更新升級功能)

```typescript
// 在現有的頁面組件中添加升級功能

import { useEscalateReview } from '@/hooks/useEscalateReview'
import { EscalationDialog } from '@/components/features/review/EscalationDialog'
import { EscalateRequest } from '@/types/escalation'

// ... 在組件內添加

const [showEscalateDialog, setShowEscalateDialog] = useState(false)
const { mutate: escalate, isPending: isEscalating } = useEscalateReview()

// 升級處理
const handleEscalate = () => {
  setShowEscalateDialog(true)
}

const handleConfirmEscalate = (data: EscalateRequest) => {
  escalate(
    { documentId: id, data },
    {
      onSuccess: () => {
        toast.success('案例已升級')
        setShowEscalateDialog(false)
        router.push('/review')
      },
      onError: (error) => {
        toast.error(error.message || '升級失敗，請重試')
      }
    }
  )
}

// ... 在 JSX 中添加對話框

<EscalationDialog
  open={showEscalateDialog}
  onOpenChange={setShowEscalateDialog}
  onConfirm={handleConfirmEscalate}
  documentName={reviewData.document.fileName}
  isSubmitting={isEscalating}
/>
```

---

## 5. Testing Guide

### 5.1 Integration Tests

**File**: `tests/integration/api/review-escalate.test.ts`

```typescript
import { POST } from '@/app/api/review/[id]/escalate/route'
import { NextRequest } from 'next/server'

describe('POST /api/review/[id]/escalate', () => {
  it('should escalate document successfully', async () => {
    const request = new NextRequest('http://localhost/api/review/test-doc-id/escalate', {
      method: 'POST',
      body: JSON.stringify({
        reason: 'UNKNOWN_FORWARDER'
      })
    })

    const response = await POST(request, { params: { id: 'test-doc-id' } })
    const data = await response.json()

    expect(data.success).toBe(true)
    expect(data.data.escalationId).toBeDefined()
    expect(data.data.status).toBe('PENDING')
  })

  it('should require detail for certain reasons', async () => {
    const request = new NextRequest('http://localhost/api/review/test-doc-id/escalate', {
      method: 'POST',
      body: JSON.stringify({
        reason: 'OTHER'
        // 缺少 reasonDetail
      })
    })

    const response = await POST(request, { params: { id: 'test-doc-id' } })
    expect(response.status).toBe(400)
  })

  it('should return 409 for already escalated document', async () => {
    const request = new NextRequest('http://localhost/api/review/already-escalated/escalate', {
      method: 'POST',
      body: JSON.stringify({
        reason: 'POOR_QUALITY',
        reasonDetail: 'Document is blurry'
      })
    })

    const response = await POST(request, { params: { id: 'already-escalated' } })
    expect(response.status).toBe(409)
  })
})
```

### 5.2 E2E Tests

**File**: `tests/e2e/escalation.spec.ts`

```typescript
import { test, expect } from '@playwright/test'

test.describe('Document Escalation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/review/test-doc-id')
  })

  test('should show escalation dialog when clicking escalate', async ({ page }) => {
    await page.getByRole('button', { name: '升級' }).click()

    await expect(page.getByText('升級案例')).toBeVisible()
    await expect(page.getByText('無法識別 Forwarder')).toBeVisible()
  })

  test('should require detail for certain reasons', async ({ page }) => {
    await page.getByRole('button', { name: '升級' }).click()

    // 選擇需要說明的原因
    await page.getByLabel('其他').click()

    // 確認按鈕應該禁用
    await expect(page.getByRole('button', { name: '確認升級' })).toBeDisabled()

    // 填寫說明後應該啟用
    await page.fill('textarea', '特殊情況說明')
    await expect(page.getByRole('button', { name: '確認升級' })).toBeEnabled()
  })

  test('should escalate and redirect to list', async ({ page }) => {
    await page.getByRole('button', { name: '升級' }).click()
    await page.getByLabel('無法識別 Forwarder').click()
    await page.getByRole('button', { name: '確認升級' }).click()

    // 檢查跳轉
    await expect(page).toHaveURL('/review')
    await expect(page.getByText('案例已升級')).toBeVisible()
  })
})
```

---

## 6. Verification Checklist

### 6.1 Acceptance Criteria Verification

- [ ] **AC1**: 升級按鈕
  - [ ] 按鈕在審核界面可見
  - [ ] 點擊顯示升級對話框

- [ ] **AC2**: 提交升級請求
  - [ ] 文件狀態更新為 ESCALATED
  - [ ] Escalation 記錄創建成功
  - [ ] ProcessingQueue 更新優先級
  - [ ] Super User 收到通知

- [ ] **AC3**: 升級原因選擇
  - [ ] 四種原因選項顯示正確
  - [ ] 需要說明的原因有驗證
  - [ ] 詳情輸入框正常工作

### 6.2 Technical Verification

- [ ] API 響應符合 RFC 7807 格式
- [ ] 事務處理正確
- [ ] 權限檢查正確
- [ ] 通知服務正常

---

## 7. Files to Create/Modify

| File Path | Action | Description |
|-----------|--------|-------------|
| `prisma/schema.prisma` | Modify | 添加 Escalation 模型和 enum |
| `src/types/escalation.ts` | Create | 升級相關類型 |
| `src/app/api/review/[id]/escalate/route.ts` | Create | 升級 API |
| `src/hooks/useEscalateReview.ts` | Create | 升級 Hook |
| `src/components/features/review/EscalationDialog.tsx` | Create | 升級對話框 |
| `src/app/(dashboard)/review/[id]/page.tsx` | Modify | 整合升級功能 |

---

*Tech Spec Created: 2025-12-16*
*Story Reference: 3-7-escalate-complex-cases*
