# Tech Spec: Story 3-5 修正提取結果

## 1. Overview

### 1.1 Story Reference
- **Story ID**: 3.5
- **Title**: 修正提取結果
- **Epic**: Epic 3 - 發票審核與修正工作流

### 1.2 Story Description
作為數據處理員，我希望修正錯誤的提取值，以便最終數據的準確性得到保證。

### 1.3 Dependencies
- **Story 3-4**: 確認提取結果（提供審核界面）
- **Story 3-3**: 信心度顏色編碼（提供欄位視覺化）

---

## 2. Acceptance Criteria Mapping

| AC ID | Description | Implementation Approach |
|-------|-------------|------------------------|
| AC1 | 欄位編輯 | FieldEditor 組件 + 點擊切換編輯模式 |
| AC2 | 即時驗證 | Zod schema + react-hook-form + 即時反饋 |
| AC3 | 儲存修正 | PATCH /api/review/[id]/correct API + Correction 模型 |
| AC4 | 未儲存提示 | useReviewStore dirty tracking + beforeunload |

---

## 3. Architecture Overview

### 3.1 Correction Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          修正流程                                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  用戶點擊欄位                                                              │
│         │                                                                │
│         ▼                                                                │
│  ┌──────────────────┐                                                    │
│  │ 欄位進入編輯模式 │ ◄─── FieldEditor 組件                               │
│  └────────┬─────────┘                                                    │
│           │                                                              │
│           ▼                                                              │
│  ┌──────────────────┐                                                    │
│  │ 用戶輸入新值     │                                                     │
│  └────────┬─────────┘                                                    │
│           │                                                              │
│           ▼                                                              │
│  ┌──────────────────┐      ┌──────────────────────────────────────────┐ │
│  │ 即時驗證         │ ───► │ 驗證規則:                                 │ │
│  └────────┬─────────┘      │ • 日期格式: YYYY-MM-DD                   │ │
│           │                │ • 數字格式: 小數點精度                     │ │
│           │                │ • 必填欄位: 非空                          │ │
│           │                │ • 自定義規則                              │ │
│           │                └──────────────────────────────────────────┘ │
│           │                                                              │
│           ▼                                                              │
│  ┌──────────────────┐                                                    │
│  │ 標記為 dirty     │ ◄─── reviewStore.markFieldDirty()                 │
│  └────────┬─────────┘                                                    │
│           │                                                              │
│           ▼                                                              │
│  ┌──────────────────┐      ┌──────────────────────────────────────────┐ │
│  │ 儲存修正         │ ───► │ 後端處理:                                 │ │
│  └──────────────────┘      │ 1. 更新 ExtractionResult.fieldResults    │ │
│                            │ 2. 創建 Correction 記錄                   │ │
│                            │ 3. 記錄審計日誌                           │ │
│                            └──────────────────────────────────────────┘ │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Component Architecture

```
src/
├── app/api/review/[id]/
│   └── correct/
│       └── route.ts                    # 修正 API
├── components/features/review/
│   ├── ReviewPanel/
│   │   ├── FieldRow.tsx                # 更新支持編輯
│   │   └── FieldEditor.tsx             # 欄位編輯器
│   ├── validation/
│   │   ├── fieldSchemas.ts             # 欄位驗證 schema
│   │   └── ValidationMessage.tsx       # 驗證訊息顯示
│   └── UnsavedChangesGuard.tsx         # 未儲存提示
├── hooks/
│   ├── useFieldValidation.ts           # 欄位驗證 Hook
│   └── useSaveCorrections.ts           # 儲存修正 Hook
└── stores/
    └── reviewStore.ts                  # 更新：修改追蹤
```

---

## 4. Implementation Guide

### Phase 1: Database Schema (AC3)

#### 4.1.1 Correction 模型

**File**: `prisma/schema.prisma` (添加)

```prisma
model Correction {
  id              String         @id @default(uuid())
  documentId      String         @map("document_id")
  fieldName       String         @map("field_name")
  originalValue   String?        @map("original_value")
  correctedValue  String         @map("corrected_value")
  correctionType  CorrectionType @default(NORMAL) @map("correction_type")
  correctedBy     String         @map("corrected_by")
  createdAt       DateTime       @default(now()) @map("created_at")

  document  Document @relation(fields: [documentId], references: [id])
  corrector User     @relation(fields: [correctedBy], references: [id])

  @@index([documentId])
  @@index([correctedBy])
  @@index([fieldName, documentId])
  @@map("corrections")
}

enum CorrectionType {
  NORMAL      // 正常修正，系統應學習
  EXCEPTION   // 特例，不學習
}
```

---

### Phase 2: API Layer (AC3)

#### 4.2.1 修正 API

**File**: `src/app/api/review/[id]/correct/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { CorrectionType } from '@prisma/client'
import { logAudit } from '@/lib/audit'
import { z } from 'zod'

// 請求驗證 schema
const correctionSchema = z.object({
  corrections: z.array(z.object({
    fieldName: z.string().min(1),
    originalValue: z.string().nullable(),
    correctedValue: z.string(),
    correctionType: z.enum(['NORMAL', 'EXCEPTION']).default('NORMAL')
  })).min(1)
})

interface RouteParams {
  params: { id: string }
}

// PATCH /api/review/[id]/correct - 修正提取結果
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
    // 解析並驗證請求
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
          include: {
            fieldResults: true
          }
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

    // 驗證所有欄位名稱存在
    const existingFields = new Set(extractionResult.fieldResults.map(f => f.fieldName))
    const invalidFields = corrections.filter(c => !existingFields.has(c.fieldName))

    if (invalidFields.length > 0) {
      return NextResponse.json({
        success: false,
        error: {
          type: 'validation_error',
          title: 'Validation Error',
          status: 400,
          detail: `Invalid field names: ${invalidFields.map(f => f.fieldName).join(', ')}`
        }
      }, { status: 400 })
    }

    // 使用事務處理
    const result = await prisma.$transaction(async (tx) => {
      const correctionRecords = []

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
            correctedBy: session.user.id
          }
        })

        correctionRecords.push(correctionRecord)
      }

      // 3. 更新文件修改時間
      await tx.document.update({
        where: { id: documentId },
        data: { updatedAt: new Date() }
      })

      return correctionRecords
    })

    // 4. 記錄審計日誌
    await logAudit({
      userId: session.user.id,
      action: 'FIELDS_CORRECTED',
      resourceType: 'Document',
      resourceId: documentId,
      details: {
        correctionCount: result.length,
        fieldNames: corrections.map(c => c.fieldName)
      }
    })

    return NextResponse.json({
      success: true,
      data: {
        documentId,
        correctionCount: result.length,
        corrections: result.map(c => ({
          id: c.id,
          fieldName: c.fieldName,
          correctedValue: c.correctedValue,
          correctionType: c.correctionType
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

#### 4.2.2 類型定義

**File**: `src/types/review.ts` (擴展)

```typescript
// 修正請求
export interface CorrectionInput {
  fieldName: string
  originalValue: string | null
  correctedValue: string
  correctionType: 'NORMAL' | 'EXCEPTION'
}

export interface CorrectionRequest {
  corrections: CorrectionInput[]
}

// 修正響應
export interface CorrectionResponse {
  success: true
  data: {
    documentId: string
    correctionCount: number
    corrections: {
      id: string
      fieldName: string
      correctedValue: string
      correctionType: 'NORMAL' | 'EXCEPTION'
    }[]
  }
}

// 欄位編輯狀態
export interface FieldEditState {
  fieldId: string
  fieldName: string
  originalValue: string | null
  currentValue: string
  isEditing: boolean
  isDirty: boolean
  validationError: string | null
}
```

---

### Phase 3: Validation Layer (AC2)

#### 4.3.1 欄位驗證 Schema

**File**: `src/components/features/review/validation/fieldSchemas.ts`

```typescript
import { z } from 'zod'

// 基礎驗證器
export const fieldValidators = {
  // 日期格式
  date: z.string().regex(
    /^\d{4}-\d{2}-\d{2}$/,
    '日期格式必須為 YYYY-MM-DD'
  ).refine(
    (val) => !isNaN(Date.parse(val)),
    '無效的日期'
  ),

  // 數字格式
  number: z.string().regex(
    /^-?\d+(\.\d+)?$/,
    '必須為有效數字'
  ),

  // 金額格式
  currency: z.string().regex(
    /^-?\d{1,3}(,\d{3})*(\.\d{2})?$/,
    '金額格式無效'
  ),

  // 非空
  required: z.string().min(1, '此欄位為必填'),

  // 貨櫃號格式
  containerNumber: z.string().regex(
    /^[A-Z]{4}\d{7}$/,
    '貨櫃號格式為 4 字母 + 7 數字'
  ),

  // 提單號格式
  blNumber: z.string().min(1).max(50),

  // Email
  email: z.string().email('Email 格式無效'),

  // 通用文本
  text: z.string().max(500, '超過最大長度限制')
}

// 欄位類型映射
export const fieldTypeMap: Record<string, keyof typeof fieldValidators> = {
  invoiceDate: 'date',
  dueDate: 'date',
  totalAmount: 'currency',
  subTotal: 'currency',
  taxAmount: 'currency',
  containerNumber: 'containerNumber',
  blNumber: 'blNumber',
  invoiceNumber: 'required',
  shipperName: 'text',
  consigneeName: 'text',
  // 默認使用 text
}

// 獲取欄位驗證器
export function getFieldValidator(fieldName: string) {
  const type = fieldTypeMap[fieldName] || 'text'
  return fieldValidators[type]
}

// 驗證欄位值
export function validateFieldValue(
  fieldName: string,
  value: string
): { valid: boolean; error?: string } {
  try {
    const validator = getFieldValidator(fieldName)
    validator.parse(value)
    return { valid: true }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { valid: false, error: error.errors[0].message }
    }
    return { valid: false, error: '驗證失敗' }
  }
}
```

#### 4.3.2 驗證訊息組件

**File**: `src/components/features/review/validation/ValidationMessage.tsx`

```typescript
import { cn } from '@/lib/utils'
import { AlertCircle, CheckCircle2 } from 'lucide-react'

interface ValidationMessageProps {
  error?: string | null
  success?: boolean
  className?: string
}

export function ValidationMessage({
  error,
  success,
  className
}: ValidationMessageProps) {
  if (!error && !success) return null

  return (
    <div className={cn(
      'flex items-center gap-1 text-xs mt-1',
      error && 'text-destructive',
      success && 'text-green-600',
      className
    )}>
      {error ? (
        <>
          <AlertCircle className="h-3 w-3" />
          <span>{error}</span>
        </>
      ) : success ? (
        <>
          <CheckCircle2 className="h-3 w-3" />
          <span>格式正確</span>
        </>
      ) : null}
    </div>
  )
}
```

---

### Phase 4: UI Components (AC1, AC2)

#### 4.4.1 欄位編輯器組件

**File**: `src/components/features/review/ReviewPanel/FieldEditor.tsx`

```typescript
'use client'

import { useState, useEffect, useRef } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { ValidationMessage } from '../validation/ValidationMessage'
import { validateFieldValue } from '../validation/fieldSchemas'
import { Check, X, Edit3 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface FieldEditorProps {
  fieldId: string
  fieldName: string
  value: string | null
  onSave: (newValue: string) => void
  onCancel: () => void
  isEditing: boolean
  onStartEdit: () => void
  disabled?: boolean
}

export function FieldEditor({
  fieldId,
  fieldName,
  value,
  onSave,
  onCancel,
  isEditing,
  onStartEdit,
  disabled
}: FieldEditorProps) {
  const [editValue, setEditValue] = useState(value || '')
  const [validationError, setValidationError] = useState<string | null>(null)
  const [isValidating, setIsValidating] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // 聚焦輸入框
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isEditing])

  // 重置編輯值
  useEffect(() => {
    if (isEditing) {
      setEditValue(value || '')
      setValidationError(null)
    }
  }, [isEditing, value])

  // 即時驗證
  useEffect(() => {
    if (!isEditing || editValue === (value || '')) {
      setValidationError(null)
      return
    }

    setIsValidating(true)
    const timer = setTimeout(() => {
      const result = validateFieldValue(fieldName, editValue)
      setValidationError(result.error || null)
      setIsValidating(false)
    }, 300) // 防抖

    return () => clearTimeout(timer)
  }, [editValue, fieldName, isEditing, value])

  // 儲存處理
  const handleSave = () => {
    const result = validateFieldValue(fieldName, editValue)
    if (!result.valid) {
      setValidationError(result.error || '驗證失敗')
      return
    }
    onSave(editValue)
  }

  // 取消處理
  const handleCancel = () => {
    setEditValue(value || '')
    setValidationError(null)
    onCancel()
  }

  // 鍵盤處理
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !validationError) {
      handleSave()
    } else if (e.key === 'Escape') {
      handleCancel()
    }
  }

  if (!isEditing) {
    return (
      <div
        className={cn(
          'flex items-center gap-2 group cursor-pointer',
          !disabled && 'hover:bg-accent/50 rounded px-2 py-1 -mx-2 -my-1'
        )}
        onClick={() => !disabled && onStartEdit()}
      >
        <span className="text-sm">
          {value || <span className="text-muted-foreground">—</span>}
        </span>
        {!disabled && (
          <Edit3 className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
        )}
      </div>
    )
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <Input
          ref={inputRef}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          className={cn(
            'h-8',
            validationError && 'border-destructive focus-visible:ring-destructive'
          )}
        />

        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8"
          onClick={handleSave}
          disabled={!!validationError || isValidating}
        >
          <Check className="h-4 w-4 text-green-600" />
        </Button>

        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8"
          onClick={handleCancel}
        >
          <X className="h-4 w-4 text-muted-foreground" />
        </Button>
      </div>

      <ValidationMessage
        error={validationError}
        success={!validationError && editValue !== (value || '') && editValue.length > 0}
      />
    </div>
  )
}
```

#### 4.4.2 更新欄位列組件

**File**: `src/components/features/review/ReviewPanel/FieldRow.tsx` (更新)

```typescript
'use client'

import { useState } from 'react'
import { ExtractedField, ConfidenceFactors } from '@/types/review'
import { ConfidenceBadge } from '../ConfidenceBadge'
import { ConfidenceTooltip } from '../ConfidenceTooltip'
import { FieldEditor } from './FieldEditor'
import { getConfidenceConfig } from '@/lib/confidence/thresholds'
import { useReviewStore } from '@/stores/reviewStore'
import { cn } from '@/lib/utils'
import { MapPin } from 'lucide-react'

interface FieldRowProps {
  field: ExtractedField
  isSelected: boolean
  onSelect: () => void
  confidenceFactors?: ConfidenceFactors
  readOnly?: boolean
}

const FIELD_LABELS: Record<string, string> = {
  invoiceNumber: '發票號碼',
  invoiceDate: '發票日期',
  dueDate: '到期日',
  currency: '幣別',
  totalAmount: '總金額',
  shipperName: '發貨人名稱',
  consigneeName: '收貨人名稱',
  vesselName: '船名',
  voyageNumber: '航次',
  containerNumber: '貨櫃號',
  blNumber: '提單號',
}

export function FieldRow({
  field,
  isSelected,
  onSelect,
  confidenceFactors,
  readOnly = false
}: FieldRowProps) {
  const [isEditing, setIsEditing] = useState(false)
  const { markFieldDirty, pendingChanges } = useReviewStore()

  const config = getConfidenceConfig(field.confidence)
  const pendingValue = pendingChanges.get(field.id)
  const displayValue = pendingValue !== undefined ? pendingValue : field.value
  const isDirty = pendingValue !== undefined && pendingValue !== field.value

  const bgStyles = {
    high: 'hover:bg-[hsl(var(--confidence-high-bg))]',
    medium: 'hover:bg-[hsl(var(--confidence-medium-bg))]',
    low: 'bg-[hsl(var(--confidence-low-bg))] hover:bg-[hsl(var(--confidence-low-bg)/80%)]'
  }[config.level]

  const borderStyles = {
    high: 'border-l-[hsl(var(--confidence-high))]',
    medium: 'border-l-[hsl(var(--confidence-medium))]',
    low: 'border-l-[hsl(var(--confidence-low))]'
  }[config.level]

  const handleSave = (newValue: string) => {
    markFieldDirty(field.id, newValue)
    setIsEditing(false)
  }

  const handleCancel = () => {
    setIsEditing(false)
  }

  return (
    <div
      className={cn(
        'p-3 transition-all border-l-4',
        bgStyles,
        borderStyles,
        isSelected && 'ring-2 ring-inset ring-primary',
        isDirty && 'bg-amber-50 border-l-amber-500'
      )}
      onClick={() => !isEditing && onSelect()}
    >
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">
            {FIELD_LABELS[field.fieldName] || field.fieldName}
          </span>

          {field.sourcePosition && (
            <MapPin className="h-3 w-3 text-muted-foreground" />
          )}

          {isDirty && (
            <span className="text-xs bg-amber-200 text-amber-800 px-1 rounded">
              已修改
            </span>
          )}
        </div>

        <ConfidenceTooltip
          score={field.confidence}
          factors={confidenceFactors}
        >
          <div>
            <ConfidenceBadge score={field.confidence} size="sm" />
          </div>
        </ConfidenceTooltip>
      </div>

      {/* 值顯示/編輯區 */}
      <div onClick={(e) => e.stopPropagation()}>
        <FieldEditor
          fieldId={field.id}
          fieldName={field.fieldName}
          value={displayValue}
          onSave={handleSave}
          onCancel={handleCancel}
          isEditing={isEditing}
          onStartEdit={() => setIsEditing(true)}
          disabled={readOnly}
        />
      </div>
    </div>
  )
}
```

---

### Phase 5: State Management (AC4)

#### 4.5.1 更新 Review Store

**File**: `src/stores/reviewStore.ts` (更新)

```typescript
import { create } from 'zustand'
import { FieldSourcePosition } from '@/types/review'

interface ReviewState {
  // 選中的欄位
  selectedFieldId: string | null
  selectedFieldPosition: FieldSourcePosition | null

  // PDF 狀態
  currentPage: number
  zoomLevel: number

  // 修改追蹤
  dirtyFields: Set<string>
  pendingChanges: Map<string, string>
  originalValues: Map<string, string | null>

  // Actions
  setSelectedField: (fieldId: string | null, position?: FieldSourcePosition | null) => void
  setCurrentPage: (page: number) => void
  setZoomLevel: (level: number) => void
  markFieldDirty: (fieldId: string, newValue: string, originalValue?: string | null) => void
  clearDirtyField: (fieldId: string) => void
  resetChanges: () => void
  hasPendingChanges: () => boolean
  getPendingCorrections: () => { fieldId: string; originalValue: string | null; newValue: string }[]
}

export const useReviewStore = create<ReviewState>((set, get) => ({
  selectedFieldId: null,
  selectedFieldPosition: null,
  currentPage: 1,
  zoomLevel: 1,
  dirtyFields: new Set(),
  pendingChanges: new Map(),
  originalValues: new Map(),

  setSelectedField: (fieldId, position = null) => {
    set({
      selectedFieldId: fieldId,
      selectedFieldPosition: position
    })
    if (position?.page) {
      set({ currentPage: position.page })
    }
  },

  setCurrentPage: (page) => set({ currentPage: page }),

  setZoomLevel: (level) => set({ zoomLevel: Math.max(0.5, Math.min(3, level)) }),

  markFieldDirty: (fieldId, newValue, originalValue) => {
    const { dirtyFields, pendingChanges, originalValues } = get()
    const newDirtyFields = new Set(dirtyFields)
    const newPendingChanges = new Map(pendingChanges)
    const newOriginalValues = new Map(originalValues)

    newDirtyFields.add(fieldId)
    newPendingChanges.set(fieldId, newValue)

    // 只在首次修改時記錄原始值
    if (!originalValues.has(fieldId) && originalValue !== undefined) {
      newOriginalValues.set(fieldId, originalValue)
    }

    set({
      dirtyFields: newDirtyFields,
      pendingChanges: newPendingChanges,
      originalValues: newOriginalValues
    })
  },

  clearDirtyField: (fieldId) => {
    const { dirtyFields, pendingChanges, originalValues } = get()
    const newDirtyFields = new Set(dirtyFields)
    const newPendingChanges = new Map(pendingChanges)
    const newOriginalValues = new Map(originalValues)

    newDirtyFields.delete(fieldId)
    newPendingChanges.delete(fieldId)
    newOriginalValues.delete(fieldId)

    set({
      dirtyFields: newDirtyFields,
      pendingChanges: newPendingChanges,
      originalValues: newOriginalValues
    })
  },

  resetChanges: () => {
    set({
      dirtyFields: new Set(),
      pendingChanges: new Map(),
      originalValues: new Map(),
      selectedFieldId: null,
      selectedFieldPosition: null
    })
  },

  hasPendingChanges: () => get().dirtyFields.size > 0,

  getPendingCorrections: () => {
    const { pendingChanges, originalValues } = get()
    return Array.from(pendingChanges.entries()).map(([fieldId, newValue]) => ({
      fieldId,
      originalValue: originalValues.get(fieldId) ?? null,
      newValue
    }))
  }
}))
```

---

### Phase 6: Save Hook (AC3)

**File**: `src/hooks/useSaveCorrections.ts`

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { CorrectionRequest, CorrectionResponse } from '@/types/review'
import { useReviewStore } from '@/stores/reviewStore'

interface SaveParams {
  documentId: string
  corrections: CorrectionRequest['corrections']
}

async function saveCorrections({ documentId, corrections }: SaveParams): Promise<CorrectionResponse> {
  const response = await fetch(`/api/review/${documentId}/correct`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ corrections })
  })

  const result = await response.json()

  if (!result.success) {
    throw new Error(result.error?.detail || 'Failed to save corrections')
  }

  return result
}

export function useSaveCorrections(documentId: string) {
  const queryClient = useQueryClient()
  const { resetChanges } = useReviewStore()

  return useMutation({
    mutationFn: (corrections: CorrectionRequest['corrections']) =>
      saveCorrections({ documentId, corrections }),
    onSuccess: () => {
      // 使緩存失效
      queryClient.invalidateQueries({
        queryKey: ['reviewDetail', documentId]
      })

      // 重置修改狀態
      resetChanges()
    }
  })
}
```

---

### Phase 7: Unsaved Changes Guard (AC4)

**File**: `src/components/features/review/UnsavedChangesGuard.tsx`

```typescript
'use client'

import { useEffect } from 'react'
import { useReviewStore } from '@/stores/reviewStore'
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

interface UnsavedChangesGuardProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirmLeave: () => void
  onSaveAndLeave: () => void
}

export function UnsavedChangesGuard({
  open,
  onOpenChange,
  onConfirmLeave,
  onSaveAndLeave
}: UnsavedChangesGuardProps) {
  const { hasPendingChanges, dirtyFields } = useReviewStore()

  // 瀏覽器關閉/刷新提示
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

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>有未儲存的修改</AlertDialogTitle>
          <AlertDialogDescription>
            您有 {dirtyFields.size} 個欄位的修改尚未儲存。
            離開此頁面將會丟失這些修改。
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>取消</AlertDialogCancel>
          <AlertDialogAction
            variant="outline"
            onClick={onConfirmLeave}
          >
            不儲存離開
          </AlertDialogAction>
          <AlertDialogAction onClick={onSaveAndLeave}>
            儲存並離開
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
```

---

## 5. Testing Guide

### 5.1 Unit Tests

**File**: `tests/unit/validation/fieldSchemas.test.ts`

```typescript
import { validateFieldValue, getFieldValidator } from '@/components/features/review/validation/fieldSchemas'

describe('Field Validation', () => {
  describe('date validation', () => {
    it('should accept valid date format', () => {
      const result = validateFieldValue('invoiceDate', '2024-01-15')
      expect(result.valid).toBe(true)
    })

    it('should reject invalid date format', () => {
      const result = validateFieldValue('invoiceDate', '15/01/2024')
      expect(result.valid).toBe(false)
      expect(result.error).toContain('YYYY-MM-DD')
    })
  })

  describe('currency validation', () => {
    it('should accept valid currency format', () => {
      expect(validateFieldValue('totalAmount', '1,234.56').valid).toBe(true)
      expect(validateFieldValue('totalAmount', '100.00').valid).toBe(true)
    })

    it('should reject invalid currency', () => {
      expect(validateFieldValue('totalAmount', 'abc').valid).toBe(false)
    })
  })

  describe('container number validation', () => {
    it('should accept valid container number', () => {
      const result = validateFieldValue('containerNumber', 'ABCD1234567')
      expect(result.valid).toBe(true)
    })

    it('should reject invalid container number', () => {
      const result = validateFieldValue('containerNumber', 'ABC123')
      expect(result.valid).toBe(false)
    })
  })
})
```

### 5.2 E2E Tests

**File**: `tests/e2e/field-correction.spec.ts`

```typescript
import { test, expect } from '@playwright/test'

test.describe('Field Correction', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/review/test-doc-id')
  })

  test('should enter edit mode on field click', async ({ page }) => {
    await page.locator('[data-testid="field-row"]').first().click()
    await page.locator('[data-testid="field-value"]').click()

    // 檢查編輯模式
    await expect(page.locator('input[type="text"]')).toBeVisible()
  })

  test('should show validation error for invalid input', async ({ page }) => {
    // 點擊日期欄位
    await page.locator('[data-field-name="invoiceDate"]').click()
    await page.locator('[data-testid="field-value"]').click()

    // 輸入無效日期
    await page.fill('input', 'invalid-date')

    // 檢查驗證錯誤
    await expect(page.getByText('日期格式必須為')).toBeVisible()
  })

  test('should save correction and show dirty indicator', async ({ page }) => {
    await page.locator('[data-field-name="invoiceNumber"]').click()
    await page.locator('[data-testid="field-value"]').click()

    // 修改值
    await page.fill('input', 'NEW-INV-123')
    await page.getByRole('button', { name: /confirm/i }).click()

    // 檢查已修改指示器
    await expect(page.getByText('已修改')).toBeVisible()
  })

  test('should show unsaved changes warning when leaving', async ({ page }) => {
    // 修改欄位
    await page.locator('[data-field-name="invoiceNumber"]').click()
    await page.fill('input', 'MODIFIED')
    await page.keyboard.press('Enter')

    // 嘗試離開
    await page.getByRole('button', { name: '返回列表' }).click()

    // 檢查警告對話框
    await expect(page.getByText('有未儲存的修改')).toBeVisible()
  })
})
```

---

## 6. Verification Checklist

### 6.1 Acceptance Criteria Verification

- [ ] **AC1**: 欄位編輯
  - [ ] 點擊欄位進入編輯模式
  - [ ] 支援不同欄位類型輸入
  - [ ] Enter 確認，Escape 取消

- [ ] **AC2**: 即時驗證
  - [ ] 日期格式驗證正確
  - [ ] 數字格式驗證正確
  - [ ] 必填欄位驗證正確
  - [ ] 驗證結果即時顯示

- [ ] **AC3**: 儲存修正
  - [ ] API 正確更新 FieldResult
  - [ ] 創建 Correction 記錄
  - [ ] 記錄原始值和修正值

- [ ] **AC4**: 未儲存提示
  - [ ] 離開頁面顯示確認
  - [ ] 瀏覽器刷新顯示確認
  - [ ] 已修改欄位有視覺指示

### 6.2 Technical Verification

- [ ] Zod 驗證正確工作
- [ ] Zustand 狀態追蹤正確
- [ ] 事務處理正確（原子性）
- [ ] 防抖驗證正確

---

## 7. Files to Create/Modify

| File Path | Action | Description |
|-----------|--------|-------------|
| `prisma/schema.prisma` | Modify | 添加 Correction 模型 |
| `src/app/api/review/[id]/correct/route.ts` | Create | 修正 API |
| `src/types/review.ts` | Modify | 添加修正類型 |
| `src/components/features/review/validation/fieldSchemas.ts` | Create | 驗證 schema |
| `src/components/features/review/validation/ValidationMessage.tsx` | Create | 驗證訊息 |
| `src/components/features/review/ReviewPanel/FieldEditor.tsx` | Create | 欄位編輯器 |
| `src/components/features/review/ReviewPanel/FieldRow.tsx` | Modify | 支持編輯 |
| `src/stores/reviewStore.ts` | Modify | 修改追蹤 |
| `src/hooks/useSaveCorrections.ts` | Create | 儲存 Hook |
| `src/components/features/review/UnsavedChangesGuard.tsx` | Create | 未儲存提示 |

---

*Tech Spec Created: 2025-12-16*
*Story Reference: 3-5-correct-extraction-result*
