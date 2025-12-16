# Tech Spec: Story 3-6 修正類型標記

## 1. Overview

### 1.1 Story Reference
- **Story ID**: 3.6
- **Title**: 修正類型標記
- **Epic**: Epic 3 - 發票審核與修正工作流

### 1.2 Story Description
作為數據處理員，我希望標記修正是「正常修正」或「特例不學習」，以便系統可以正確地進行規則學習。

### 1.3 Dependencies
- **Story 3-5**: 修正提取結果（提供修正功能基礎）
- **Epic 4 連接**: 觸發規則升級建議流程

---

## 2. Acceptance Criteria Mapping

| AC ID | Description | Implementation Approach |
|-------|-------------|------------------------|
| AC1 | 修正類型選擇 | CorrectionTypeDialog 組件 |
| AC2 | 正常修正處理 | correctionType: NORMAL + 學習統計 |
| AC3 | 特例修正處理 | correctionType: EXCEPTION + 排除學習 |
| AC4 | 觸發規則升級建議 | checkCorrectionThreshold + RuleSuggestion |

---

## 3. Architecture Overview

### 3.1 Correction Type Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                       修正類型標記流程                                     │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  用戶修正欄位並儲存                                                        │
│         │                                                                │
│         ▼                                                                │
│  ┌──────────────────┐                                                    │
│  │ CorrectionType   │ ◄─── 顯示類型選擇對話框                              │
│  │ Dialog           │                                                    │
│  └────────┬─────────┘                                                    │
│           │                                                              │
│           ├──────────────────────────────────────────────┐               │
│           │                                              │               │
│           ▼                                              ▼               │
│  ┌──────────────────┐                        ┌──────────────────────────┐│
│  │ NORMAL           │                        │ EXCEPTION                ││
│  │ 正常修正         │                        │ 特例不學習               ││
│  └────────┬─────────┘                        └────────┬─────────────────┘│
│           │                                           │                  │
│           ▼                                           ▼                  │
│  ┌──────────────────┐                        ┌──────────────────────────┐│
│  │ 記錄修正模式     │                        │ 標記為特例               ││
│  │ 更新學習統計     │                        │ 可選填特例原因           ││
│  └────────┬─────────┘                        │ 排除學習統計             ││
│           │                                  └──────────────────────────┘│
│           ▼                                                              │
│  ┌──────────────────┐                                                    │
│  │ 檢查修正閾值     │                                                     │
│  │ (同一Forwarder+  │                                                     │
│  │  同一欄位 >= 3)  │                                                     │
│  └────────┬─────────┘                                                    │
│           │                                                              │
│           ▼ (達到閾值)                                                    │
│  ┌──────────────────┐                                                    │
│  │ 創建 RuleSuggestion│ ◄─── 連結到 Epic 4                               │
│  │ 通知 Super User  │                                                    │
│  └──────────────────┘                                                    │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Component Architecture

```
src/
├── app/api/
│   ├── review/[id]/correct/
│   │   └── route.ts                    # 更新：處理修正類型
│   └── rule-suggestions/
│       └── route.ts                    # 規則建議 API
├── components/features/review/
│   ├── CorrectionTypeDialog.tsx        # 修正類型選擇對話框
│   └── CorrectionTypeSelector.tsx      # 類型選擇器
├── lib/
│   └── learning/
│       ├── correctionAnalyzer.ts       # 修正分析器
│       └── ruleSuggestionTrigger.ts    # 規則建議觸發
└── services/
    └── notificationService.ts          # 通知服務
```

---

## 4. Implementation Guide

### Phase 1: Database Schema (AC2, AC3, AC4)

#### 4.1.1 RuleSuggestion 模型

**File**: `prisma/schema.prisma` (添加)

```prisma
model RuleSuggestion {
  id              String           @id @default(uuid())
  forwarderId     String           @map("forwarder_id")
  fieldName       String           @map("field_name")
  suggestedPattern String          @map("suggested_pattern")
  correctionCount Int              @map("correction_count")
  status          SuggestionStatus @default(PENDING)
  createdAt       DateTime         @default(now()) @map("created_at")
  reviewedAt      DateTime?        @map("reviewed_at")
  reviewedBy      String?          @map("reviewed_by")
  notes           String?

  forwarder Forwarder @relation(fields: [forwarderId], references: [id])
  reviewer  User?     @relation(fields: [reviewedBy], references: [id])

  @@unique([forwarderId, fieldName, suggestedPattern])
  @@index([forwarderId, fieldName])
  @@index([status])
  @@map("rule_suggestions")
}

enum SuggestionStatus {
  PENDING    // 待審核
  APPROVED   // 已批准
  REJECTED   // 已拒絕
  MERGED     // 已合併到規則
}

// 更新 Correction 模型添加 exceptionReason
model Correction {
  id              String         @id @default(uuid())
  documentId      String         @map("document_id")
  fieldName       String         @map("field_name")
  originalValue   String?        @map("original_value")
  correctedValue  String         @map("corrected_value")
  correctionType  CorrectionType @default(NORMAL) @map("correction_type")
  exceptionReason String?        @map("exception_reason")  // 新增：特例原因
  correctedBy     String         @map("corrected_by")
  createdAt       DateTime       @default(now()) @map("created_at")

  document  Document @relation(fields: [documentId], references: [id])
  corrector User     @relation(fields: [correctedBy], references: [id])

  @@index([documentId])
  @@index([correctedBy])
  @@index([fieldName, documentId])
  @@index([correctionType])  // 新增索引
  @@map("corrections")
}
```

---

### Phase 2: Learning Service (AC2, AC4)

#### 4.2.1 修正分析器

**File**: `src/lib/learning/correctionAnalyzer.ts`

```typescript
import { prisma } from '@/lib/prisma'
import { CorrectionType, SuggestionStatus } from '@prisma/client'

// 修正閾值配置
const CORRECTION_THRESHOLD = 3  // 觸發規則建議的修正次數
const ANALYSIS_PERIOD_DAYS = 30 // 分析週期（天）

interface CorrectionPattern {
  forwarderId: string
  fieldName: string
  originalPattern: string | null
  correctedPattern: string
  count: number
}

// 分析修正模式
export async function analyzeCorrectionPattern(
  documentId: string,
  fieldName: string,
  originalValue: string | null,
  correctedValue: string
): Promise<CorrectionPattern | null> {
  // 獲取文件的 Forwarder
  const document = await prisma.document.findUnique({
    where: { id: documentId },
    select: { forwarderId: true }
  })

  if (!document?.forwarderId) {
    return null
  }

  // 計算分析期間
  const since = new Date()
  since.setDate(since.getDate() - ANALYSIS_PERIOD_DAYS)

  // 統計相同模式的修正次數
  const count = await prisma.correction.count({
    where: {
      document: { forwarderId: document.forwarderId },
      fieldName,
      correctedValue,
      correctionType: CorrectionType.NORMAL,
      createdAt: { gte: since }
    }
  })

  return {
    forwarderId: document.forwarderId,
    fieldName,
    originalPattern: originalValue,
    correctedPattern: correctedValue,
    count: count + 1 // 加上當前修正
  }
}

// 檢查是否達到閾值
export async function checkCorrectionThreshold(
  forwarderId: string,
  fieldName: string
): Promise<boolean> {
  const since = new Date()
  since.setDate(since.getDate() - ANALYSIS_PERIOD_DAYS)

  const count = await prisma.correction.count({
    where: {
      document: { forwarderId },
      fieldName,
      correctionType: CorrectionType.NORMAL,
      createdAt: { gte: since }
    }
  })

  return count >= CORRECTION_THRESHOLD
}

// 獲取最常見的修正模式
export async function getMostCommonCorrection(
  forwarderId: string,
  fieldName: string
): Promise<{ correctedValue: string; count: number } | null> {
  const since = new Date()
  since.setDate(since.getDate() - ANALYSIS_PERIOD_DAYS)

  const result = await prisma.correction.groupBy({
    by: ['correctedValue'],
    where: {
      document: { forwarderId },
      fieldName,
      correctionType: CorrectionType.NORMAL,
      createdAt: { gte: since }
    },
    _count: { correctedValue: true },
    orderBy: { _count: { correctedValue: 'desc' } },
    take: 1
  })

  if (result.length === 0) {
    return null
  }

  return {
    correctedValue: result[0].correctedValue,
    count: result[0]._count.correctedValue
  }
}
```

#### 4.2.2 規則建議觸發器

**File**: `src/lib/learning/ruleSuggestionTrigger.ts`

```typescript
import { prisma } from '@/lib/prisma'
import { SuggestionStatus } from '@prisma/client'
import {
  checkCorrectionThreshold,
  getMostCommonCorrection
} from './correctionAnalyzer'
import { notifySuperUsers } from '@/services/notificationService'

interface TriggerResult {
  triggered: boolean
  suggestionId?: string
  message: string
}

// 觸發規則建議檢查
export async function triggerRuleSuggestionCheck(
  documentId: string,
  fieldName: string
): Promise<TriggerResult> {
  // 獲取文件的 Forwarder
  const document = await prisma.document.findUnique({
    where: { id: documentId },
    select: {
      forwarderId: true,
      forwarder: { select: { name: true } }
    }
  })

  if (!document?.forwarderId) {
    return { triggered: false, message: 'No forwarder associated' }
  }

  // 檢查是否達到閾值
  const shouldTrigger = await checkCorrectionThreshold(
    document.forwarderId,
    fieldName
  )

  if (!shouldTrigger) {
    return { triggered: false, message: 'Threshold not reached' }
  }

  // 獲取最常見的修正模式
  const pattern = await getMostCommonCorrection(
    document.forwarderId,
    fieldName
  )

  if (!pattern) {
    return { triggered: false, message: 'No correction pattern found' }
  }

  // 檢查是否已存在相同的建議
  const existingSuggestion = await prisma.ruleSuggestion.findFirst({
    where: {
      forwarderId: document.forwarderId,
      fieldName,
      suggestedPattern: pattern.correctedValue,
      status: { in: [SuggestionStatus.PENDING, SuggestionStatus.APPROVED] }
    }
  })

  if (existingSuggestion) {
    // 更新計數
    await prisma.ruleSuggestion.update({
      where: { id: existingSuggestion.id },
      data: { correctionCount: pattern.count }
    })

    return {
      triggered: false,
      suggestionId: existingSuggestion.id,
      message: 'Suggestion already exists, count updated'
    }
  }

  // 創建新的規則建議
  const suggestion = await prisma.ruleSuggestion.create({
    data: {
      forwarderId: document.forwarderId,
      fieldName,
      suggestedPattern: pattern.correctedValue,
      correctionCount: pattern.count
    }
  })

  // 通知 Super User
  await notifySuperUsers({
    type: 'RULE_SUGGESTION',
    title: '新的規則建議',
    message: `${document.forwarder?.name || 'Unknown'} 的 ${fieldName} 欄位有新的映射建議`,
    data: {
      suggestionId: suggestion.id,
      forwarderId: document.forwarderId,
      fieldName
    }
  })

  return {
    triggered: true,
    suggestionId: suggestion.id,
    message: 'Rule suggestion created and notifications sent'
  }
}
```

---

### Phase 3: API Layer (AC1-4)

#### 4.3.1 更新修正 API

**File**: `src/app/api/review/[id]/correct/route.ts` (更新)

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { CorrectionType } from '@prisma/client'
import { logAudit } from '@/lib/audit'
import { triggerRuleSuggestionCheck } from '@/lib/learning/ruleSuggestionTrigger'
import { z } from 'zod'

const correctionSchema = z.object({
  corrections: z.array(z.object({
    fieldName: z.string().min(1),
    originalValue: z.string().nullable(),
    correctedValue: z.string(),
    correctionType: z.enum(['NORMAL', 'EXCEPTION']).default('NORMAL'),
    exceptionReason: z.string().optional()
  })).min(1)
})

interface RouteParams {
  params: { id: string }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
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
    const body = await request.json()
    const validation = correctionSchema.safeParse(body)

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

    const { corrections } = validation.data

    // 獲取文件和提取結果
    const document = await prisma.document.findUnique({
      where: { id: documentId },
      include: {
        extractionResults: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: { fieldResults: true }
        }
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

    const extractionResult = document.extractionResults[0]
    if (!extractionResult) {
      return NextResponse.json({
        success: false,
        error: {
          type: 'not_found',
          title: 'Not Found',
          status: 404,
          detail: 'No extraction result found'
        }
      }, { status: 404 })
    }

    // 使用事務處理
    const result = await prisma.$transaction(async (tx) => {
      const correctionRecords = []
      const ruleSuggestionTriggers = []

      for (const correction of corrections) {
        // 1. 更新 FieldResult
        const fieldResult = extractionResult.fieldResults.find(
          f => f.fieldName === correction.fieldName
        )

        if (fieldResult) {
          await tx.fieldResult.update({
            where: { id: fieldResult.id },
            data: {
              value: correction.correctedValue,
              isCorrected: true,
              updatedAt: new Date()
            }
          })
        }

        // 2. 創建 Correction 記錄
        const correctionRecord = await tx.correction.create({
          data: {
            documentId,
            fieldName: correction.fieldName,
            originalValue: correction.originalValue,
            correctedValue: correction.correctedValue,
            correctionType: correction.correctionType as CorrectionType,
            exceptionReason: correction.exceptionReason,
            correctedBy: session.user.id
          }
        })

        correctionRecords.push(correctionRecord)

        // 3. 如果是正常修正，檢查是否觸發規則建議
        if (correction.correctionType === 'NORMAL') {
          ruleSuggestionTriggers.push(correction.fieldName)
        }
      }

      // 更新文件修改時間
      await tx.document.update({
        where: { id: documentId },
        data: { updatedAt: new Date() }
      })

      return { correctionRecords, ruleSuggestionTriggers }
    })

    // 4. 觸發規則建議檢查（事務外執行）
    const suggestionResults = []
    for (const fieldName of result.ruleSuggestionTriggers) {
      const triggerResult = await triggerRuleSuggestionCheck(documentId, fieldName)
      if (triggerResult.triggered) {
        suggestionResults.push(triggerResult)
      }
    }

    // 5. 記錄審計日誌
    await logAudit({
      userId: session.user.id,
      action: 'FIELDS_CORRECTED',
      resourceType: 'Document',
      resourceId: documentId,
      details: {
        correctionCount: result.correctionRecords.length,
        normalCount: corrections.filter(c => c.correctionType === 'NORMAL').length,
        exceptionCount: corrections.filter(c => c.correctionType === 'EXCEPTION').length,
        ruleSuggestionsTriggered: suggestionResults.length
      }
    })

    return NextResponse.json({
      success: true,
      data: {
        documentId,
        correctionCount: result.correctionRecords.length,
        corrections: result.correctionRecords.map(c => ({
          id: c.id,
          fieldName: c.fieldName,
          correctedValue: c.correctedValue,
          correctionType: c.correctionType
        })),
        ruleSuggestions: suggestionResults.map(s => ({
          suggestionId: s.suggestionId,
          message: s.message
        }))
      }
    })

  } catch (error) {
    console.error('Failed to save corrections:', error)
    return NextResponse.json({
      success: false,
      error: {
        type: 'internal_error',
        title: 'Internal Server Error',
        status: 500,
        detail: 'Failed to save corrections'
      }
    }, { status: 500 })
  }
}
```

---

### Phase 4: UI Components (AC1)

#### 4.4.1 修正類型選擇對話框

**File**: `src/components/features/review/CorrectionTypeDialog.tsx`

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
import { BookOpen, AlertOctagon, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

type CorrectionType = 'NORMAL' | 'EXCEPTION'

interface CorrectionTypeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (type: CorrectionType, reason?: string) => void
  fieldName: string
  originalValue: string | null
  correctedValue: string
  isSubmitting?: boolean
}

export function CorrectionTypeDialog({
  open,
  onOpenChange,
  onConfirm,
  fieldName,
  originalValue,
  correctedValue,
  isSubmitting
}: CorrectionTypeDialogProps) {
  const [selectedType, setSelectedType] = useState<CorrectionType>('NORMAL')
  const [exceptionReason, setExceptionReason] = useState('')

  const handleConfirm = () => {
    onConfirm(
      selectedType,
      selectedType === 'EXCEPTION' ? exceptionReason : undefined
    )
  }

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      // 重置狀態
      setSelectedType('NORMAL')
      setExceptionReason('')
    }
    onOpenChange(newOpen)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>選擇修正類型</DialogTitle>
          <DialogDescription>
            請選擇此修正是否應納入系統學習。
          </DialogDescription>
        </DialogHeader>

        {/* 修正摘要 */}
        <div className="p-3 bg-muted rounded-lg text-sm space-y-1">
          <p><span className="text-muted-foreground">欄位：</span>{fieldName}</p>
          <p><span className="text-muted-foreground">原始值：</span>{originalValue || '（空）'}</p>
          <p><span className="text-muted-foreground">修正為：</span><span className="font-medium">{correctedValue}</span></p>
        </div>

        {/* 類型選擇 */}
        <RadioGroup
          value={selectedType}
          onValueChange={(v) => setSelectedType(v as CorrectionType)}
          className="space-y-3"
        >
          {/* 正常修正選項 */}
          <div className={cn(
            'flex items-start space-x-3 p-4 rounded-lg border cursor-pointer transition-colors',
            selectedType === 'NORMAL'
              ? 'border-primary bg-primary/5'
              : 'hover:bg-muted/50'
          )}>
            <RadioGroupItem value="NORMAL" id="normal" />
            <div className="flex-1">
              <Label htmlFor="normal" className="flex items-center gap-2 cursor-pointer">
                <BookOpen className="h-4 w-4 text-blue-600" />
                <span className="font-medium">正常修正</span>
              </Label>
              <p className="text-sm text-muted-foreground mt-1">
                系統應該學習這個修正模式。當相同情況出現 3 次以上時，
                系統會自動建議添加新的映射規則。
              </p>
            </div>
          </div>

          {/* 特例選項 */}
          <div className={cn(
            'flex items-start space-x-3 p-4 rounded-lg border cursor-pointer transition-colors',
            selectedType === 'EXCEPTION'
              ? 'border-orange-500 bg-orange-50'
              : 'hover:bg-muted/50'
          )}>
            <RadioGroupItem value="EXCEPTION" id="exception" />
            <div className="flex-1">
              <Label htmlFor="exception" className="flex items-center gap-2 cursor-pointer">
                <AlertOctagon className="h-4 w-4 text-orange-600" />
                <span className="font-medium">特例不學習</span>
              </Label>
              <p className="text-sm text-muted-foreground mt-1">
                這是特殊情況，不應影響系統規則。
                例如：一次性的客戶特殊要求、輸入錯誤的修正等。
              </p>
            </div>
          </div>
        </RadioGroup>

        {/* 特例原因輸入 */}
        {selectedType === 'EXCEPTION' && (
          <div className="space-y-2">
            <Label htmlFor="reason">特例原因（選填）</Label>
            <Textarea
              id="reason"
              value={exceptionReason}
              onChange={(e) => setExceptionReason(e.target.value)}
              placeholder="說明為什麼這是特例..."
              rows={2}
            />
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
          <Button onClick={handleConfirm} disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                儲存中...
              </>
            ) : (
              '確認儲存'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

#### 4.4.2 修正類型選擇器（簡化版）

**File**: `src/components/features/review/CorrectionTypeSelector.tsx`

```typescript
'use client'

import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { BookOpen, AlertOctagon, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

type CorrectionType = 'NORMAL' | 'EXCEPTION'

interface CorrectionTypeSelectorProps {
  value: CorrectionType
  onChange: (value: CorrectionType) => void
  disabled?: boolean
}

export function CorrectionTypeSelector({
  value,
  onChange,
  disabled
}: CorrectionTypeSelectorProps) {
  const options = [
    {
      value: 'NORMAL' as CorrectionType,
      label: '正常修正',
      icon: BookOpen,
      description: '系統學習此修正',
      color: 'text-blue-600'
    },
    {
      value: 'EXCEPTION' as CorrectionType,
      label: '特例不學習',
      icon: AlertOctagon,
      description: '不影響系統規則',
      color: 'text-orange-600'
    }
  ]

  const selectedOption = options.find(o => o.value === value)!

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={disabled}
          className="justify-between min-w-[140px]"
        >
          <span className="flex items-center gap-2">
            <selectedOption.icon className={cn('h-4 w-4', selectedOption.color)} />
            {selectedOption.label}
          </span>
          <ChevronDown className="h-4 w-4 ml-2" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[250px] p-2">
        {options.map((option) => (
          <button
            key={option.value}
            onClick={() => onChange(option.value)}
            className={cn(
              'w-full flex items-start gap-3 p-3 rounded-lg text-left transition-colors',
              value === option.value
                ? 'bg-accent'
                : 'hover:bg-muted'
            )}
          >
            <option.icon className={cn('h-5 w-5 mt-0.5', option.color)} />
            <div>
              <p className="font-medium text-sm">{option.label}</p>
              <p className="text-xs text-muted-foreground">{option.description}</p>
            </div>
          </button>
        ))}
      </PopoverContent>
    </Popover>
  )
}
```

---

### Phase 5: Notification Service (AC4)

**File**: `src/services/notificationService.ts`

```typescript
import { prisma } from '@/lib/prisma'
import { PERMISSIONS } from '@/lib/permissions'

interface NotificationData {
  type: string
  title: string
  message: string
  data?: Record<string, unknown>
}

// 通知 Super User
export async function notifySuperUsers(notification: NotificationData) {
  // 查找所有 Super User
  const superUsers = await prisma.user.findMany({
    where: {
      roles: {
        some: {
          permissions: {
            has: PERMISSIONS.RULE_MANAGE
          }
        }
      },
      isActive: true
    },
    select: { id: true, email: true }
  })

  // 創建通知記錄
  const notifications = await prisma.notification.createMany({
    data: superUsers.map(user => ({
      userId: user.id,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      data: notification.data ? JSON.stringify(notification.data) : null
    }))
  })

  // 未來可以添加：
  // - Email 通知
  // - WebSocket 即時推送
  // - Microsoft Teams 通知

  return {
    notificationCount: notifications.count,
    recipients: superUsers.map(u => u.email)
  }
}
```

---

## 5. Testing Guide

### 5.1 Unit Tests

**File**: `tests/unit/lib/learning/correctionAnalyzer.test.ts`

```typescript
import {
  analyzeCorrectionPattern,
  checkCorrectionThreshold,
  getMostCommonCorrection
} from '@/lib/learning/correctionAnalyzer'

describe('Correction Analyzer', () => {
  describe('checkCorrectionThreshold', () => {
    it('should return false when below threshold', async () => {
      const result = await checkCorrectionThreshold('forwarder-1', 'invoiceDate')
      expect(result).toBe(false)
    })

    it('should return true when at or above threshold', async () => {
      // 創建 3 個修正記錄
      // ...
      const result = await checkCorrectionThreshold('forwarder-1', 'invoiceDate')
      expect(result).toBe(true)
    })
  })

  describe('getMostCommonCorrection', () => {
    it('should return the most common correction pattern', async () => {
      const result = await getMostCommonCorrection('forwarder-1', 'totalAmount')
      expect(result).toBeDefined()
      expect(result?.count).toBeGreaterThanOrEqual(1)
    })
  })
})
```

### 5.2 E2E Tests

**File**: `tests/e2e/correction-type.spec.ts`

```typescript
import { test, expect } from '@playwright/test'

test.describe('Correction Type Marking', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/review/test-doc-id')
  })

  test('should show correction type dialog when saving', async ({ page }) => {
    // 修改欄位
    await page.locator('[data-field-name="invoiceNumber"]').click()
    await page.fill('input', 'MODIFIED-123')
    await page.keyboard.press('Enter')

    // 點擊儲存
    await page.getByRole('button', { name: '儲存修正' }).click()

    // 檢查對話框
    await expect(page.getByText('選擇修正類型')).toBeVisible()
  })

  test('should save as NORMAL correction by default', async ({ page }) => {
    // 修改並儲存
    // ...
    await page.getByRole('button', { name: '確認儲存' }).click()

    // 驗證儲存成功
    await expect(page.getByText('修正已儲存')).toBeVisible()
  })

  test('should save as EXCEPTION with reason', async ({ page }) => {
    // 修改欄位
    // ...

    // 選擇特例
    await page.getByLabel('特例不學習').click()
    await page.fill('textarea', '一次性客戶要求')
    await page.getByRole('button', { name: '確認儲存' }).click()

    // 驗證儲存成功
    await expect(page.getByText('修正已儲存')).toBeVisible()
  })

  test('should trigger rule suggestion after 3 normal corrections', async ({ page }) => {
    // 這需要模擬多次修正
    // 驗證規則建議被創建
  })
})
```

---

## 6. Verification Checklist

### 6.1 Acceptance Criteria Verification

- [ ] **AC1**: 修正類型選擇
  - [ ] 對話框顯示兩種類型選項
  - [ ] 正常修正和特例說明清晰
  - [ ] 預設選擇正常修正

- [ ] **AC2**: 正常修正處理
  - [ ] correctionType 正確設為 NORMAL
  - [ ] 修正記錄納入學習統計

- [ ] **AC3**: 特例修正處理
  - [ ] correctionType 正確設為 EXCEPTION
  - [ ] 可填寫特例原因
  - [ ] 不納入學習統計

- [ ] **AC4**: 觸發規則升級建議
  - [ ] 達到 3 次閾值時觸發
  - [ ] 創建 RuleSuggestion 記錄
  - [ ] 通知 Super User

### 6.2 Technical Verification

- [ ] 事務處理正確
- [ ] 通知服務正常工作
- [ ] 閾值計算正確
- [ ] 索引優化到位

---

## 7. Files to Create/Modify

| File Path | Action | Description |
|-----------|--------|-------------|
| `prisma/schema.prisma` | Modify | 添加 RuleSuggestion，更新 Correction |
| `src/lib/learning/correctionAnalyzer.ts` | Create | 修正分析器 |
| `src/lib/learning/ruleSuggestionTrigger.ts` | Create | 規則建議觸發 |
| `src/app/api/review/[id]/correct/route.ts` | Modify | 處理修正類型 |
| `src/components/features/review/CorrectionTypeDialog.tsx` | Create | 類型選擇對話框 |
| `src/components/features/review/CorrectionTypeSelector.tsx` | Create | 類型選擇器 |
| `src/services/notificationService.ts` | Create | 通知服務 |

---

*Tech Spec Created: 2025-12-16*
*Story Reference: 3-6-correction-type-marking*
