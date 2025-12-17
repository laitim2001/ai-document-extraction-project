# Tech Spec: Story 3-4 確認提取結果

## 1. Overview

### 1.1 Story Reference
- **Story ID**: 3.4
- **Title**: 確認提取結果
- **Epic**: Epic 3 - 發票審核與修正工作流

### 1.2 Story Description
作為數據處理員，我希望確認正確的提取結果，以便已驗證的數據可以進入下一步處理。

### 1.3 Dependencies
- **Story 3-3**: 信心度顏色編碼顯示（提供欄位視覺化）
- **Story 3-2**: 並排 PDF 對照審核界面（提供審核界面）

---

## 2. Acceptance Criteria Mapping

| AC ID | Description | Implementation Approach |
|-------|-------------|------------------------|
| AC1 | 確認無誤按鈕 | ReviewActions 組件中的確認按鈕 |
| AC2 | 確認處理 | POST /api/review/[id]/approve API |
| AC3 | 快速確認模式 | ProcessingPath 判斷 + 簡化界面 |

---

## 3. Architecture Overview

### 3.1 Approval Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          確認流程                                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  用戶點擊「確認無誤」                                                      │
│         │                                                                │
│         ▼                                                                │
│  ┌──────────────────┐                                                    │
│  │ 前端驗證         │ ◄─── 檢查是否有未儲存的修改                          │
│  └────────┬─────────┘                                                    │
│           │                                                              │
│           ▼                                                              │
│  ┌──────────────────┐                                                    │
│  │ 確認對話框       │ ◄─── 顯示確認提示 (可選)                             │
│  └────────┬─────────┘                                                    │
│           │                                                              │
│           ▼                                                              │
│  ┌──────────────────┐      ┌────────────────────────────────────────┐   │
│  │ POST /approve    │ ───► │ 後端處理:                               │   │
│  └──────────────────┘      │ 1. 驗證用戶權限                         │   │
│                            │ 2. 更新 Document 狀態 → APPROVED        │   │
│                            │ 3. 更新 ProcessingQueue 狀態 → COMPLETED │   │
│                            │ 4. 創建 ReviewRecord                    │   │
│                            │ 5. 記錄審計日誌                         │   │
│                            └────────────────────────────────────────┘   │
│           │                                                              │
│           ▼                                                              │
│  ┌──────────────────┐                                                    │
│  │ 成功反饋         │ ◄─── Toast 提示 + 返回列表                          │
│  └──────────────────┘                                                    │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Component Architecture

```
src/
├── app/api/review/[id]/
│   └── approve/
│       └── route.ts                    # 確認 API
├── components/features/review/
│   ├── ReviewPanel/
│   │   ├── ReviewActions.tsx           # 操作按鈕 (更新)
│   │   └── QuickReviewMode.tsx         # 快速審核模式組件
│   └── ApprovalConfirmDialog.tsx       # 確認對話框
├── hooks/
│   └── useApproveReview.ts             # 確認操作 Hook
└── types/
    └── review.ts                       # 審核類型 (擴展)
```

---

## 4. Implementation Guide

### Phase 1: Database Schema (AC2)

#### 4.1.1 ReviewRecord 模型

**File**: `prisma/schema.prisma` (添加)

```prisma
model ReviewRecord {
  id          String       @id @default(uuid())
  documentId  String       @map("document_id")
  reviewerId  String       @map("reviewer_id")
  action      ReviewAction
  notes       String?
  createdAt   DateTime     @default(now()) @map("created_at")

  document Document @relation(fields: [documentId], references: [id])
  reviewer User     @relation(fields: [reviewerId], references: [id])

  @@index([documentId])
  @@index([reviewerId])
  @@map("review_records")
}

enum ReviewAction {
  APPROVED    // 確認通過
  CORRECTED   // 修正後通過
  ESCALATED   // 升級處理
}
```

---

### Phase 2: API Layer (AC2)

#### 4.2.1 確認 API

**File**: `src/app/api/review/[id]/approve/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { DocumentStatus, QueueStatus, ReviewAction } from '@prisma/client'
import { logAudit } from '@/lib/audit'

interface RouteParams {
  params: { id: string }
}

// POST /api/review/[id]/approve - 確認提取結果
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
    // 解析請求體 (可選)
    let body: { confirmedFields?: string[], notes?: string } = {}
    try {
      body = await request.json()
    } catch {
      // 允許空 body
    }

    // 獲取文件和處理隊列
    const document = await prisma.document.findUnique({
      where: { id: documentId },
      include: {
        processingQueue: true
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

    // 檢查文件狀態
    if (document.status === DocumentStatus.APPROVED) {
      return NextResponse.json({
        success: false,
        error: {
          type: 'conflict',
          title: 'Conflict',
          status: 409,
          detail: 'Document already approved'
        }
      }, { status: 409 })
    }

    if (document.status !== DocumentStatus.PENDING_REVIEW) {
      return NextResponse.json({
        success: false,
        error: {
          type: 'bad_request',
          title: 'Bad Request',
          status: 400,
          detail: `Document is in ${document.status} status, cannot approve`
        }
      }, { status: 400 })
    }

    // 使用事務更新
    const result = await prisma.$transaction(async (tx) => {
      // 1. 更新文件狀態
      const updatedDocument = await tx.document.update({
        where: { id: documentId },
        data: {
          status: DocumentStatus.APPROVED,
          updatedAt: new Date()
        }
      })

      // 2. 更新處理隊列狀態
      if (document.processingQueue) {
        await tx.processingQueue.update({
          where: { id: document.processingQueue.id },
          data: {
            status: QueueStatus.COMPLETED,
            completedAt: new Date()
          }
        })
      }

      // 3. 創建審核記錄
      const reviewRecord = await tx.reviewRecord.create({
        data: {
          documentId,
          reviewerId: session.user.id,
          action: ReviewAction.APPROVED,
          notes: body.notes
        }
      })

      return { document: updatedDocument, reviewRecord }
    })

    // 4. 記錄審計日誌
    await logAudit({
      userId: session.user.id,
      action: 'DOCUMENT_APPROVED',
      resourceType: 'Document',
      resourceId: documentId,
      details: {
        previousStatus: document.status,
        newStatus: DocumentStatus.APPROVED,
        reviewRecordId: result.reviewRecord.id
      }
    })

    return NextResponse.json({
      success: true,
      data: {
        documentId: result.document.id,
        status: result.document.status,
        reviewedBy: session.user.name || session.user.email,
        reviewedAt: result.reviewRecord.createdAt.toISOString()
      }
    })

  } catch (error) {
    console.error('Failed to approve document:', error)
    return NextResponse.json({
      success: false,
      error: {
        type: 'internal_error',
        title: 'Internal Server Error',
        status: 500,
        detail: 'Failed to approve document'
      }
    }, { status: 500 })
  }
}
```

#### 4.2.2 類型定義

**File**: `src/types/review.ts` (擴展)

```typescript
// 確認請求
export interface ApproveRequest {
  confirmedFields?: string[]  // 快速確認時指定欄位
  notes?: string              // 備註
}

// 確認響應
export interface ApproveResponse {
  success: true
  data: {
    documentId: string
    status: 'APPROVED'
    reviewedBy: string
    reviewedAt: string
  }
}

// 審核記錄
export interface ReviewRecord {
  id: string
  documentId: string
  reviewerId: string
  action: 'APPROVED' | 'CORRECTED' | 'ESCALATED'
  notes: string | null
  createdAt: string
}
```

---

### Phase 3: React Query Hook (AC1, AC2)

**File**: `src/hooks/useApproveReview.ts`

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ApproveRequest, ApproveResponse } from '@/types/review'

interface ApproveParams {
  documentId: string
  data?: ApproveRequest
}

async function approveDocument({ documentId, data }: ApproveParams): Promise<ApproveResponse> {
  const response = await fetch(`/api/review/${documentId}/approve`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: data ? JSON.stringify(data) : undefined
  })

  const result = await response.json()

  if (!result.success) {
    throw new Error(result.error?.detail || 'Failed to approve document')
  }

  return result
}

export function useApproveReview() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: approveDocument,
    onSuccess: (_, variables) => {
      // 使審核詳情緩存失效
      queryClient.invalidateQueries({
        queryKey: ['reviewDetail', variables.documentId]
      })

      // 使審核列表緩存失效
      queryClient.invalidateQueries({
        queryKey: ['reviewQueue']
      })
    }
  })
}
```

---

### Phase 4: UI Components (AC1, AC2, AC3)

#### 4.4.1 確認對話框

**File**: `src/components/features/review/ApprovalConfirmDialog.tsx`

```typescript
'use client'

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
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { useState } from 'react'
import { Loader2 } from 'lucide-react'

interface ApprovalConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (notes?: string) => void
  isSubmitting?: boolean
  documentName: string
  fieldCount: number
}

export function ApprovalConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
  isSubmitting,
  documentName,
  fieldCount
}: ApprovalConfirmDialogProps) {
  const [notes, setNotes] = useState('')

  const handleConfirm = () => {
    onConfirm(notes || undefined)
    setNotes('')
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>確認提取結果</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2">
              <p>
                確認 <span className="font-medium">{documentName}</span> 的提取結果無誤？
              </p>
              <p className="text-sm">
                共 {fieldCount} 個欄位將被標記為已審核。
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="py-4">
          <Label htmlFor="notes" className="text-sm text-muted-foreground">
            備註（選填）
          </Label>
          <Textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="輸入審核備註..."
            className="mt-2"
            rows={3}
          />
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isSubmitting}>取消</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                處理中...
              </>
            ) : (
              '確認無誤'
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
```

#### 4.4.2 快速審核模式組件

**File**: `src/components/features/review/ReviewPanel/QuickReviewMode.tsx`

```typescript
'use client'

import { ExtractedField } from '@/types/review'
import { getConfidenceLevel } from '@/lib/confidence/thresholds'
import { FieldRow } from './FieldRow'
import { Button } from '@/components/ui/button'
import { CheckCheck, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface QuickReviewModeProps {
  fields: ExtractedField[]
  selectedFieldId: string | null
  onFieldSelect: (field: ExtractedField) => void
  onConfirmAll: () => void
  isSubmitting?: boolean
}

export function QuickReviewMode({
  fields,
  selectedFieldId,
  onFieldSelect,
  onConfirmAll,
  isSubmitting
}: QuickReviewModeProps) {
  // 篩選出需要確認的低信心度欄位
  const lowConfidenceFields = fields.filter(
    f => getConfidenceLevel(f.confidence) !== 'high'
  )

  const highConfidenceCount = fields.length - lowConfidenceFields.length

  return (
    <div className="space-y-4">
      {/* 頭部提示 */}
      <div className="p-4 bg-muted/50 rounded-lg space-y-2">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-yellow-600" />
          <span className="font-medium">快速審核模式</span>
        </div>
        <p className="text-sm text-muted-foreground">
          {highConfidenceCount} 個高信心度欄位已自動確認，
          請檢查以下 {lowConfidenceFields.length} 個需要關注的欄位。
        </p>
      </div>

      {/* 低信心度欄位列表 */}
      {lowConfidenceFields.length > 0 ? (
        <div className="space-y-2">
          {lowConfidenceFields.map((field) => (
            <FieldRow
              key={field.id}
              field={field}
              isSelected={field.id === selectedFieldId}
              onSelect={() => onFieldSelect(field)}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-8 text-muted-foreground">
          <p>所有欄位信心度都很高！</p>
        </div>
      )}

      {/* 全部確認按鈕 */}
      <Button
        onClick={onConfirmAll}
        disabled={isSubmitting}
        className="w-full"
        size="lg"
      >
        <CheckCheck className="h-5 w-5 mr-2" />
        全部確認 ({fields.length} 欄位)
      </Button>
    </div>
  )
}
```

#### 4.4.3 更新審核操作組件

**File**: `src/components/features/review/ReviewPanel/ReviewActions.tsx` (更新)

```typescript
'use client'

import { Button } from '@/components/ui/button'
import { Check, Save, ArrowUpRight, Loader2 } from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

interface ReviewActionsProps {
  onApprove: () => void
  onSaveCorrections: () => void
  onEscalate: () => void
  hasPendingChanges: boolean
  isSubmitting?: boolean
  processingPath?: string
}

export function ReviewActions({
  onApprove,
  onSaveCorrections,
  onEscalate,
  hasPendingChanges,
  isSubmitting,
  processingPath
}: ReviewActionsProps) {
  const isQuickReview = processingPath === 'QUICK_REVIEW'

  return (
    <div className="p-4 border-t bg-muted/30 space-y-3">
      {/* 主要操作區 */}
      <div className="flex items-center gap-3">
        {/* 確認無誤 */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex-1">
                <Button
                  onClick={onApprove}
                  disabled={hasPendingChanges || isSubmitting}
                  className="w-full"
                  variant={isQuickReview ? 'default' : 'secondary'}
                >
                  {isSubmitting ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4 mr-2" />
                  )}
                  確認無誤
                </Button>
              </div>
            </TooltipTrigger>
            {hasPendingChanges && (
              <TooltipContent>
                <p>請先儲存修改後再確認</p>
              </TooltipContent>
            )}
          </Tooltip>
        </TooltipProvider>

        {/* 儲存修正 */}
        <Button
          variant={hasPendingChanges ? 'default' : 'secondary'}
          onClick={onSaveCorrections}
          disabled={!hasPendingChanges || isSubmitting}
          className="flex-1"
        >
          {isSubmitting ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          儲存修正
        </Button>

        {/* 升級案例 */}
        <Button
          variant="outline"
          onClick={onEscalate}
          disabled={isSubmitting}
        >
          <ArrowUpRight className="h-4 w-4 mr-2" />
          升級
        </Button>
      </div>

      {/* 狀態提示 */}
      {hasPendingChanges && (
        <p className="text-xs text-amber-600 text-center">
          有未儲存的修改
        </p>
      )}

      {isQuickReview && !hasPendingChanges && (
        <p className="text-xs text-muted-foreground text-center">
          快速審核模式：高信心度欄位已自動確認
        </p>
      )}
    </div>
  )
}
```

---

### Phase 5: Page Integration (AC1, AC2, AC3)

**File**: `src/app/(dashboard)/review/[id]/page.tsx` (更新)

```typescript
'use client'

import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { useReviewDetail } from '@/hooks/useReviewDetail'
import { useApproveReview } from '@/hooks/useApproveReview'
import { useReviewStore } from '@/stores/reviewStore'
import { ReviewDetailLayout } from '@/components/features/review/ReviewDetailLayout'
import { PdfViewer } from '@/components/features/review/PdfViewer/PdfViewer'
import { ReviewPanel } from '@/components/features/review/ReviewPanel/ReviewPanel'
import { QuickReviewMode } from '@/components/features/review/ReviewPanel/QuickReviewMode'
import { ApprovalConfirmDialog } from '@/components/features/review/ApprovalConfirmDialog'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { ProcessingPath } from '@prisma/client'

interface PageProps {
  params: { id: string }
}

export default function ReviewDetailPage({ params }: PageProps) {
  const router = useRouter()
  const { id } = params

  const [showApproveDialog, setShowApproveDialog] = useState(false)

  const { data, isLoading, error } = useReviewDetail(id)
  const { mutate: approve, isPending: isApproving } = useApproveReview()
  const { resetChanges, hasPendingChanges, setSelectedField } = useReviewStore()

  // 離開頁面前確認
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasPendingChanges()) {
        e.preventDefault()
        e.returnValue = ''
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [hasPendingChanges])

  // 重置狀態
  useEffect(() => {
    return () => resetChanges()
  }, [resetChanges])

  // 確認無誤處理
  const handleApprove = () => {
    if (hasPendingChanges()) {
      toast.error('請先儲存修改後再確認')
      return
    }
    setShowApproveDialog(true)
  }

  // 執行確認
  const handleConfirmApprove = (notes?: string) => {
    approve(
      { documentId: id, data: { notes } },
      {
        onSuccess: () => {
          toast.success('已確認無誤')
          setShowApproveDialog(false)
          router.push('/review')
        },
        onError: (error) => {
          toast.error(error.message || '操作失敗，請重試')
        }
      }
    )
  }

  // 儲存修正
  const handleSaveCorrections = async () => {
    // Story 3-5 實現
    toast.info('修正功能將在 Story 3-5 實現')
  }

  // 升級案例
  const handleEscalate = async () => {
    // Story 3-7 實現
    toast.info('升級功能將在 Story 3-7 實現')
  }

  // 返回列表
  const handleBack = () => {
    if (hasPendingChanges()) {
      if (confirm('有未儲存的修改，確定要離開嗎？')) {
        router.push('/review')
      }
    } else {
      router.push('/review')
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error || !data?.data) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-4rem)] gap-4">
        <p className="text-destructive">無法載入審核詳情</p>
        <Button variant="outline" onClick={handleBack}>
          返回列表
        </Button>
      </div>
    )
  }

  const reviewData = data.data
  const isQuickReview = reviewData.processingQueue?.processingPath === ProcessingPath.QUICK_REVIEW

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* 頂部導航 */}
      <div className="flex items-center gap-4 px-6 py-3 border-b">
        <Button variant="ghost" size="sm" onClick={handleBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          返回列表
        </Button>
        <span className="text-sm text-muted-foreground">
          審核發票
          {isQuickReview && (
            <span className="ml-2 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
              快速審核
            </span>
          )}
        </span>
      </div>

      {/* 主要內容區 */}
      <div className="flex-1 p-6">
        <ReviewDetailLayout
          pdfViewer={
            <PdfViewer
              url={reviewData.document.fileUrl}
              pageCount={reviewData.document.pageCount}
            />
          }
          reviewPanel={
            isQuickReview ? (
              <QuickReviewMode
                fields={reviewData.extraction.fields}
                selectedFieldId={useReviewStore.getState().selectedFieldId}
                onFieldSelect={(field) =>
                  setSelectedField(field.id, field.sourcePosition)
                }
                onConfirmAll={() => setShowApproveDialog(true)}
                isSubmitting={isApproving}
              />
            ) : (
              <ReviewPanel
                data={reviewData}
                onApprove={handleApprove}
                onSaveCorrections={handleSaveCorrections}
                onEscalate={handleEscalate}
                isSubmitting={isApproving}
              />
            )
          }
        />
      </div>

      {/* 確認對話框 */}
      <ApprovalConfirmDialog
        open={showApproveDialog}
        onOpenChange={setShowApproveDialog}
        onConfirm={handleConfirmApprove}
        isSubmitting={isApproving}
        documentName={reviewData.document.fileName}
        fieldCount={reviewData.extraction.fields.length}
      />
    </div>
  )
}
```

---

## 5. Testing Guide

### 5.1 Unit Tests

**File**: `tests/unit/hooks/useApproveReview.test.ts`

```typescript
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useApproveReview } from '@/hooks/useApproveReview'

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } }
  })
  return ({ children }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

describe('useApproveReview', () => {
  it('should approve document successfully', async () => {
    const { result } = renderHook(() => useApproveReview(), {
      wrapper: createWrapper()
    })

    result.current.mutate({ documentId: 'test-doc-id' })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.data.status).toBe('APPROVED')
  })

  it('should handle error when document not found', async () => {
    const { result } = renderHook(() => useApproveReview(), {
      wrapper: createWrapper()
    })

    result.current.mutate({ documentId: 'non-existent' })

    await waitFor(() => expect(result.current.isError).toBe(true))
  })
})
```

### 5.2 Integration Tests

**File**: `tests/integration/api/review-approve.test.ts`

```typescript
import { POST } from '@/app/api/review/[id]/approve/route'
import { NextRequest } from 'next/server'

describe('POST /api/review/[id]/approve', () => {
  it('should approve document and update status', async () => {
    const request = new NextRequest('http://localhost/api/review/test-doc-id/approve', {
      method: 'POST'
    })

    const response = await POST(request, { params: { id: 'test-doc-id' } })
    const data = await response.json()

    expect(data.success).toBe(true)
    expect(data.data.status).toBe('APPROVED')
    expect(data.data.reviewedBy).toBeDefined()
    expect(data.data.reviewedAt).toBeDefined()
  })

  it('should return 404 for non-existent document', async () => {
    const request = new NextRequest('http://localhost/api/review/non-existent/approve', {
      method: 'POST'
    })

    const response = await POST(request, { params: { id: 'non-existent' } })

    expect(response.status).toBe(404)
  })

  it('should return 409 for already approved document', async () => {
    const request = new NextRequest('http://localhost/api/review/already-approved/approve', {
      method: 'POST'
    })

    const response = await POST(request, { params: { id: 'already-approved' } })

    expect(response.status).toBe(409)
  })

  it('should create review record', async () => {
    const request = new NextRequest('http://localhost/api/review/test-doc-id/approve', {
      method: 'POST',
      body: JSON.stringify({ notes: 'Test approval' })
    })

    await POST(request, { params: { id: 'test-doc-id' } })

    // 驗證 ReviewRecord 已創建
    const reviewRecord = await prisma.reviewRecord.findFirst({
      where: { documentId: 'test-doc-id' }
    })

    expect(reviewRecord).toBeDefined()
    expect(reviewRecord?.action).toBe('APPROVED')
    expect(reviewRecord?.notes).toBe('Test approval')
  })
})
```

### 5.3 E2E Tests

**File**: `tests/e2e/review-approve.spec.ts`

```typescript
import { test, expect } from '@playwright/test'

test.describe('Review Approval', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/review/test-doc-id')
  })

  test('should show confirmation dialog when clicking approve', async ({ page }) => {
    await page.getByRole('button', { name: '確認無誤' }).click()

    // 檢查對話框顯示
    await expect(page.getByRole('alertdialog')).toBeVisible()
    await expect(page.getByText('確認提取結果')).toBeVisible()
  })

  test('should approve document and redirect to list', async ({ page }) => {
    await page.getByRole('button', { name: '確認無誤' }).click()
    await page.getByRole('button', { name: '確認無誤' }).click()

    // 檢查跳轉到列表
    await expect(page).toHaveURL('/review')

    // 檢查成功提示
    await expect(page.getByText('已確認無誤')).toBeVisible()
  })

  test('should show quick review mode for QUICK_REVIEW path', async ({ page }) => {
    await page.goto('/review/quick-review-doc-id')

    // 檢查快速審核模式
    await expect(page.getByText('快速審核模式')).toBeVisible()
    await expect(page.getByRole('button', { name: /全部確認/ })).toBeVisible()
  })

  test('should prevent approval when there are unsaved changes', async ({ page }) => {
    // 模擬修改欄位
    // ...

    await page.getByRole('button', { name: '確認無誤' }).click()

    // 檢查提示
    await expect(page.getByText('請先儲存修改後再確認')).toBeVisible()
  })
})
```

---

## 6. Verification Checklist

### 6.1 Acceptance Criteria Verification

- [ ] **AC1**: 確認無誤按鈕
  - [ ] 按鈕在審核界面可見
  - [ ] 有未儲存修改時按鈕禁用
  - [ ] 點擊後顯示確認對話框

- [ ] **AC2**: 確認處理
  - [ ] 文件狀態更新為 APPROVED
  - [ ] ProcessingQueue 狀態更新為 COMPLETED
  - [ ] ReviewRecord 記錄已創建
  - [ ] 審計日誌已記錄
  - [ ] 成功後返回列表

- [ ] **AC3**: 快速確認模式
  - [ ] QUICK_REVIEW 路徑顯示快速審核模式
  - [ ] 僅顯示低信心度欄位
  - [ ] 「全部確認」按鈕可用

### 6.2 Technical Verification

- [ ] API 響應符合 RFC 7807 格式
- [ ] 事務處理正確（原子性）
- [ ] 權限檢查正確
- [ ] 錯誤狀態處理正確

### 6.3 UX Verification

- [ ] 確認對話框清晰
- [ ] 載入狀態顯示正確
- [ ] 成功/錯誤提示正確
- [ ] 快速審核模式直觀

---

## 7. Files to Create/Modify

| File Path | Action | Description |
|-----------|--------|-------------|
| `prisma/schema.prisma` | Modify | 添加 ReviewRecord 模型 |
| `src/app/api/review/[id]/approve/route.ts` | Create | 確認 API |
| `src/types/review.ts` | Modify | 添加確認相關類型 |
| `src/hooks/useApproveReview.ts` | Create | 確認操作 Hook |
| `src/components/features/review/ApprovalConfirmDialog.tsx` | Create | 確認對話框 |
| `src/components/features/review/ReviewPanel/QuickReviewMode.tsx` | Create | 快速審核模式 |
| `src/components/features/review/ReviewPanel/ReviewActions.tsx` | Modify | 更新操作按鈕 |
| `src/app/(dashboard)/review/[id]/page.tsx` | Modify | 整合確認功能 |

---

*Tech Spec Created: 2025-12-16*
*Story Reference: 3-4-confirm-extraction-result*
