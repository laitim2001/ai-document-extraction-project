# Tech Spec: Story 5-3 - 編輯 Forwarder 映射規則

## Story Reference
- **Story ID**: 5.3
- **Epic**: Epic 5 - Forwarder 配置管理
- **Story File**: `docs/04-implementation/stories/5-3-edit-forwarder-mapping-rules.md`
- **Status**: ready-for-dev
- **Dependencies**: Story 5.2 (Forwarder 詳情), Story 4.6 (規則審核流程)

---

## 1. Overview

### 1.1 Purpose
實現 Forwarder 映射規則的編輯功能，包含多種提取模式的 Pattern 編輯器、即時預覽功能，以及完整的變更審核流程。所有規則變更都需要經過審核才能生效，確保生產環境的穩定性。

### 1.2 User Story
**As a** Super User,
**I want** 編輯 Forwarder 特定的映射規則,
**So that** 可以優化特定 Forwarder 的提取準確性。

### 1.3 Scope
- 規則編輯界面與表單
- 多種 Pattern 類型編輯器（REGEX、POSITION、KEYWORD、AI_ASSISTED、TABLE）
- 即時預覽功能
- 變更請求創建與審核流程
- 新增規則功能
- 審核通知機制

---

## 2. Technical Architecture

### 2.1 System Context

```
┌─────────────────────────────────────────────────────────────────┐
│                    Rule Edit Workflow                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌────────────┐      ┌────────────┐      ┌────────────┐        │
│  │   User     │ ──▶  │  Edit UI   │ ──▶  │  Preview   │        │
│  │   Input    │      │  Form      │      │  Test      │        │
│  └────────────┘      └────────────┘      └────────────┘        │
│                              │                   │              │
│                              ▼                   ▼              │
│                      ┌────────────┐      ┌────────────┐        │
│                      │  Submit    │      │  Preview   │        │
│                      │  Changes   │      │  API       │        │
│                      └────────────┘      └────────────┘        │
│                              │                                  │
│                              ▼                                  │
│  ┌────────────────────────────────────────────────────────┐    │
│  │              RuleChangeRequest Created                  │    │
│  │  Status: PENDING → (Review) → APPROVED/REJECTED         │    │
│  └────────────────────────────────────────────────────────┘    │
│                              │                                  │
│                              ▼                                  │
│  ┌────────────────────────────────────────────────────────┐    │
│  │              Notify Reviewers                           │    │
│  │  Users with RULE_APPROVE permission                     │    │
│  └────────────────────────────────────────────────────────┘    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 API Architecture

```
PUT  /api/forwarders/[id]/rules/[ruleId]     → 更新規則（創建變更請求）
POST /api/forwarders/[id]/rules              → 新增規則（創建變更請求）
POST /api/rules/[ruleId]/preview             → 預覽規則效果
GET  /api/forwarders/[id]/change-requests    → 變更請求列表
POST /api/change-requests/[id]/approve       → 審核通過
POST /api/change-requests/[id]/reject        → 審核拒絕
```

### 2.3 Component Architecture

```
ForwarderRulesPage (Client Component)
├── PageHeader
│   ├── Title
│   └── AddRuleButton
├── RulesList
│   └── RuleCard (for each rule)
│       ├── RuleHeader (fieldName, type, priority)
│       ├── PatternDisplay
│       └── Actions (Preview, Edit)
├── RuleEditDialog
│   └── RuleEditForm
│       ├── BasicInfoSection
│       │   ├── FieldNameInput
│       │   ├── ExtractionTypeSelect
│       │   ├── PrioritySlider
│       │   └── ConfidenceInput
│       ├── PatternEditorSection
│       │   ├── RegexEditor
│       │   ├── PositionEditor
│       │   ├── KeywordEditor
│       │   ├── AIPromptEditor
│       │   └── TableEditor
│       └── SubmitSection
│           ├── ReasonTextarea
│           └── SubmitButton
├── RulePreviewDialog
│   └── RulePreview
│       ├── DocumentSelector
│       ├── ExecuteButton
│       └── ResultDisplay
│           ├── ExtractedValue
│           ├── ConfidenceBadge
│           └── MatchHighlight
└── NewRuleDialog
    └── RuleEditForm (isNew=true)
```

---

## 3. Database Schema

### 3.1 RuleChangeRequest Model

```prisma
model RuleChangeRequest {
  id              String               @id @default(uuid())
  ruleId          String?              @map("rule_id")
  forwarderId     String               @map("forwarder_id")
  changeType      ChangeType
  beforeContent   Json?                @map("before_content")
  afterContent    Json                 @map("after_content")
  reason          String?
  status          ChangeRequestStatus  @default(PENDING)
  requestedById   String               @map("requested_by")
  reviewedById    String?              @map("reviewed_by")
  reviewNotes     String?              @map("review_notes")
  createdAt       DateTime             @default(now()) @map("created_at")
  reviewedAt      DateTime?            @map("reviewed_at")

  // Relations
  rule            MappingRule?         @relation(fields: [ruleId], references: [id])
  forwarder       Forwarder            @relation(fields: [forwarderId], references: [id])
  requester       User                 @relation("ChangeRequester", fields: [requestedById], references: [id])
  reviewer        User?                @relation("ChangeReviewer", fields: [reviewedById], references: [id])

  @@index([forwarderId])
  @@index([status])
  @@index([requestedById])
  @@map("rule_change_requests")
}

enum ChangeType {
  CREATE      // 新增規則
  UPDATE      // 修改規則
  DELETE      // 刪除規則
  ACTIVATE    // 啟用規則
  DEACTIVATE  // 停用規則
}

enum ChangeRequestStatus {
  PENDING     // 待審核
  APPROVED    // 已批准
  REJECTED    // 已拒絕
  CANCELLED   // 已取消
}
```

### 3.2 Notification Model

```prisma
model Notification {
  id          String           @id @default(uuid())
  userId      String           @map("user_id")
  type        NotificationType
  title       String
  message     String
  data        Json?
  isRead      Boolean          @default(false) @map("is_read")
  createdAt   DateTime         @default(now()) @map("created_at")
  readAt      DateTime?        @map("read_at")

  // Relations
  user        User             @relation(fields: [userId], references: [id])

  @@index([userId, isRead])
  @@index([createdAt])
  @@map("notifications")
}

enum NotificationType {
  RULE_CHANGE_REQUEST    // 規則變更申請
  RULE_CHANGE_APPROVED   // 規則變更已批准
  RULE_CHANGE_REJECTED   // 規則變更已拒絕
  SYSTEM_ALERT           // 系統警告
}
```

### 3.3 Pattern Schema Definition

```typescript
// Pattern content schema for different extraction types
interface RegexPattern {
  type: 'REGEX'
  expression: string
  flags?: string           // e.g., 'gi'
  groupIndex?: number      // which capture group to use
  preprocessing?: {
    trim?: boolean
    removeSpaces?: boolean
    toUpperCase?: boolean
    toLowerCase?: boolean
  }
}

interface PositionPattern {
  type: 'POSITION'
  coordinates: {
    x1: number             // percentage or pixels
    y1: number
    x2: number
    y2: number
  }
  unit: 'percent' | 'pixel'
  pageNumber?: number      // default to 1
  fallbackToOCR?: boolean
}

interface KeywordPattern {
  type: 'KEYWORD'
  keywords: string[]
  searchDirection: 'right' | 'below' | 'left' | 'above'
  maxDistance: number      // in characters or pixels
  caseSensitive?: boolean
  extractLength?: number   // how many characters to extract
}

interface AIAssistedPattern {
  type: 'AI_ASSISTED'
  prompt: string
  modelConfig?: {
    model?: string
    temperature?: number
    maxTokens?: number
  }
  contextFields?: string[] // other fields to include as context
}

interface TablePattern {
  type: 'TABLE'
  tableIdentifier: {
    headerKeywords?: string[]
    tableIndex?: number
    nearText?: string
  }
  column: {
    headerText?: string
    columnIndex?: number
  }
  row: {
    identifierKeywords?: string[]
    rowIndex?: number
  }
  cellExtraction?: {
    trim?: boolean
    parseNumber?: boolean
  }
}

type PatternContent =
  | RegexPattern
  | PositionPattern
  | KeywordPattern
  | AIAssistedPattern
  | TablePattern
```

---

## 4. API Implementation

### 4.1 PUT /api/forwarders/[id]/rules/[ruleId]

**Purpose**: 更新現有規則（創建變更請求）

**File**: `src/app/api/forwarders/[id]/rules/[ruleId]/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { hasPermission, PERMISSIONS } from '@/lib/permissions'
import { prisma } from '@/lib/prisma'
import { ExtractionType, ChangeType, ChangeRequestStatus } from '@prisma/client'
import { notifyReviewers } from '@/lib/notifications'

// Request Schema
const updateRuleSchema = z.object({
  extractionType: z.nativeEnum(ExtractionType).optional(),
  pattern: z.record(z.unknown()).optional(),
  priority: z.number().int().min(1).max(100).optional(),
  confidence: z.number().min(0).max(1).optional(),
  reason: z.string().min(1).max(500)
})

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string; ruleId: string } }
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

    if (!hasPermission(session, PERMISSIONS.RULE_EDIT)) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/forbidden',
          title: 'Forbidden',
          status: 403,
          detail: '您沒有編輯規則的權限'
        },
        { status: 403 }
      )
    }

    // 2. Validate request body
    const body = await request.json()
    const parseResult = updateRuleSchema.safeParse(body)

    if (!parseResult.success) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/validation',
          title: 'Validation Error',
          status: 400,
          detail: '請求資料驗證失敗',
          errors: parseResult.error.flatten().fieldErrors
        },
        { status: 400 }
      )
    }

    const { extractionType, pattern, priority, confidence, reason } = parseResult.data

    // 3. Get existing rule
    const existingRule = await prisma.mappingRule.findUnique({
      where: { id: params.ruleId },
      include: {
        forwarder: {
          select: { id: true, name: true }
        }
      }
    })

    if (!existingRule) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/not-found',
          title: 'Not Found',
          status: 404,
          detail: '找不到指定的規則'
        },
        { status: 404 }
      )
    }

    // 4. Verify rule belongs to forwarder
    if (existingRule.forwarderId !== params.id) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/bad-request',
          title: 'Bad Request',
          status: 400,
          detail: '此規則不屬於指定的 Forwarder'
        },
        { status: 400 }
      )
    }

    // 5. Check for pending changes on same rule
    const existingPendingRequest = await prisma.ruleChangeRequest.findFirst({
      where: {
        ruleId: params.ruleId,
        status: ChangeRequestStatus.PENDING
      }
    })

    if (existingPendingRequest) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/conflict',
          title: 'Conflict',
          status: 409,
          detail: '此規則已有待審核的變更請求，請等待審核完成後再提交新的變更'
        },
        { status: 409 }
      )
    }

    // 6. Build before/after content
    const beforeContent = {
      extractionType: existingRule.extractionType,
      pattern: existingRule.pattern,
      priority: existingRule.priority,
      confidence: existingRule.confidence
    }

    const afterContent = {
      extractionType: extractionType ?? existingRule.extractionType,
      pattern: pattern ?? existingRule.pattern,
      priority: priority ?? existingRule.priority,
      confidence: confidence ?? existingRule.confidence
    }

    // 7. Create change request
    const changeRequest = await prisma.ruleChangeRequest.create({
      data: {
        ruleId: params.ruleId,
        forwarderId: params.id,
        changeType: ChangeType.UPDATE,
        beforeContent,
        afterContent,
        reason,
        requestedById: session.user.id,
        status: ChangeRequestStatus.PENDING
      },
      include: {
        requester: {
          select: { id: true, name: true }
        },
        forwarder: {
          select: { id: true, name: true }
        },
        rule: {
          select: { id: true, fieldName: true }
        }
      }
    })

    // 8. Create audit log
    await prisma.auditLog.create({
      data: {
        action: 'RULE_CHANGE_REQUEST_CREATED',
        entityType: 'RuleChangeRequest',
        entityId: changeRequest.id,
        userId: session.user.id,
        details: {
          changeType: ChangeType.UPDATE,
          ruleId: params.ruleId,
          forwarderId: params.id,
          fieldName: existingRule.fieldName
        }
      }
    })

    // 9. Notify reviewers
    await notifyReviewers({
      changeRequestId: changeRequest.id,
      changeType: ChangeType.UPDATE,
      forwarderName: existingRule.forwarder.name,
      fieldName: existingRule.fieldName,
      requesterName: session.user.name ?? 'Unknown'
    })

    // 10. Return response
    return NextResponse.json({
      success: true,
      data: {
        changeRequestId: changeRequest.id,
        status: 'PENDING',
        message: '規則變更已提交審核',
        rule: {
          id: existingRule.id,
          fieldName: existingRule.fieldName
        }
      }
    })
  } catch (error) {
    console.error('Error updating rule:', error)
    return NextResponse.json(
      {
        type: 'https://api.example.com/errors/internal',
        title: 'Internal Server Error',
        status: 500,
        detail: '更新規則時發生錯誤'
      },
      { status: 500 }
    )
  }
}
```

### 4.2 POST /api/forwarders/[id]/rules

**Purpose**: 創建新規則（創建變更請求）

**File**: `src/app/api/forwarders/[id]/rules/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { hasPermission, PERMISSIONS } from '@/lib/permissions'
import { prisma } from '@/lib/prisma'
import { ExtractionType, ChangeType, ChangeRequestStatus } from '@prisma/client'
import { notifyReviewers } from '@/lib/notifications'

// Request Schema
const createRuleSchema = z.object({
  fieldName: z.string().min(1).max(100),
  extractionType: z.nativeEnum(ExtractionType),
  pattern: z.record(z.unknown()).optional(),
  priority: z.number().int().min(1).max(100).default(50),
  confidence: z.number().min(0).max(1).default(0.8),
  reason: z.string().min(1).max(500)
})

export async function POST(
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

    if (!hasPermission(session, PERMISSIONS.RULE_EDIT)) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/forbidden',
          title: 'Forbidden',
          status: 403,
          detail: '您沒有新增規則的權限'
        },
        { status: 403 }
      )
    }

    // 2. Validate UUID
    const uuidSchema = z.string().uuid()
    if (!uuidSchema.safeParse(params.id).success) {
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

    // 3. Validate request body
    const body = await request.json()
    const parseResult = createRuleSchema.safeParse(body)

    if (!parseResult.success) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/validation',
          title: 'Validation Error',
          status: 400,
          detail: '請求資料驗證失敗',
          errors: parseResult.error.flatten().fieldErrors
        },
        { status: 400 }
      )
    }

    const { fieldName, extractionType, pattern, priority, confidence, reason } = parseResult.data

    // 4. Check forwarder exists
    const forwarder = await prisma.forwarder.findUnique({
      where: { id: params.id },
      select: { id: true, name: true }
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

    // 5. Check if field name already exists for this forwarder
    const existingRule = await prisma.mappingRule.findFirst({
      where: {
        forwarderId: params.id,
        fieldName
      }
    })

    if (existingRule) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/conflict',
          title: 'Conflict',
          status: 409,
          detail: `此 Forwarder 已存在欄位名稱為 "${fieldName}" 的規則`
        },
        { status: 409 }
      )
    }

    // 6. Check for pending create request for same field
    const existingPendingRequest = await prisma.ruleChangeRequest.findFirst({
      where: {
        forwarderId: params.id,
        changeType: ChangeType.CREATE,
        status: ChangeRequestStatus.PENDING,
        afterContent: {
          path: ['fieldName'],
          equals: fieldName
        }
      }
    })

    if (existingPendingRequest) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/conflict',
          title: 'Conflict',
          status: 409,
          detail: `已有待審核的新增規則請求包含欄位名稱 "${fieldName}"`
        },
        { status: 409 }
      )
    }

    // 7. Build after content
    const afterContent = {
      fieldName,
      extractionType,
      pattern: pattern ?? null,
      priority,
      confidence
    }

    // 8. Create change request (no ruleId since it's new)
    const changeRequest = await prisma.ruleChangeRequest.create({
      data: {
        ruleId: null,
        forwarderId: params.id,
        changeType: ChangeType.CREATE,
        beforeContent: null,
        afterContent,
        reason,
        requestedById: session.user.id,
        status: ChangeRequestStatus.PENDING
      },
      include: {
        requester: {
          select: { id: true, name: true }
        },
        forwarder: {
          select: { id: true, name: true }
        }
      }
    })

    // 9. Create audit log
    await prisma.auditLog.create({
      data: {
        action: 'RULE_CHANGE_REQUEST_CREATED',
        entityType: 'RuleChangeRequest',
        entityId: changeRequest.id,
        userId: session.user.id,
        details: {
          changeType: ChangeType.CREATE,
          forwarderId: params.id,
          fieldName
        }
      }
    })

    // 10. Notify reviewers
    await notifyReviewers({
      changeRequestId: changeRequest.id,
      changeType: ChangeType.CREATE,
      forwarderName: forwarder.name,
      fieldName,
      requesterName: session.user.name ?? 'Unknown'
    })

    // 11. Return response
    return NextResponse.json({
      success: true,
      data: {
        changeRequestId: changeRequest.id,
        status: 'PENDING',
        message: '新增規則已提交審核',
        fieldName
      }
    }, { status: 201 })
  } catch (error) {
    console.error('Error creating rule:', error)
    return NextResponse.json(
      {
        type: 'https://api.example.com/errors/internal',
        title: 'Internal Server Error',
        status: 500,
        detail: '新增規則時發生錯誤'
      },
      { status: 500 }
    )
  }
}
```

### 4.3 POST /api/rules/[ruleId]/preview

**Purpose**: 預覽規則在指定文件上的提取效果

**File**: `src/app/api/rules/[ruleId]/preview/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { hasPermission, PERMISSIONS } from '@/lib/permissions'
import { prisma } from '@/lib/prisma'
import { RuleExecutor } from '@/lib/extraction/rule-executor'
import { ExtractionType } from '@prisma/client'

// Request Schema
const previewSchema = z.object({
  documentId: z.string().uuid(),
  // Optional: preview with modified pattern without saving
  previewPattern: z.record(z.unknown()).optional(),
  previewExtractionType: z.nativeEnum(ExtractionType).optional()
})

interface PreviewResult {
  extractedValue: string | null
  confidence: number
  processingTime: number
  matchPosition?: {
    page: number
    x: number
    y: number
    width: number
    height: number
  }
  rawOcrText?: string
  debugInfo?: {
    patternMatched: boolean
    matchDetails?: string
    errorMessage?: string
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { ruleId: string } }
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

    if (!hasPermission(session, PERMISSIONS.RULE_EDIT)) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/forbidden',
          title: 'Forbidden',
          status: 403,
          detail: '您沒有預覽規則的權限'
        },
        { status: 403 }
      )
    }

    // 2. Validate request body
    const body = await request.json()
    const parseResult = previewSchema.safeParse(body)

    if (!parseResult.success) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/validation',
          title: 'Validation Error',
          status: 400,
          detail: '請求資料驗證失敗',
          errors: parseResult.error.flatten().fieldErrors
        },
        { status: 400 }
      )
    }

    const { documentId, previewPattern, previewExtractionType } = parseResult.data

    // 3. Get rule
    const rule = await prisma.mappingRule.findUnique({
      where: { id: params.ruleId },
      include: {
        forwarder: {
          select: { id: true, name: true }
        }
      }
    })

    if (!rule) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/not-found',
          title: 'Not Found',
          status: 404,
          detail: '找不到指定的規則'
        },
        { status: 404 }
      )
    }

    // 4. Get document
    const document = await prisma.document.findUnique({
      where: { id: documentId },
      include: {
        ocrResult: true
      }
    })

    if (!document) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/not-found',
          title: 'Not Found',
          status: 404,
          detail: '找不到指定的文件'
        },
        { status: 404 }
      )
    }

    // 5. Verify document belongs to same forwarder or is test document
    if (document.forwarderId && document.forwarderId !== rule.forwarderId) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/bad-request',
          title: 'Bad Request',
          status: 400,
          detail: '此文件不屬於此規則的 Forwarder'
        },
        { status: 400 }
      )
    }

    // 6. Execute rule preview
    const startTime = Date.now()
    const executor = new RuleExecutor()

    const effectivePattern = previewPattern ?? rule.pattern
    const effectiveType = previewExtractionType ?? rule.extractionType

    let result: PreviewResult

    try {
      const extractionResult = await executor.execute({
        extractionType: effectiveType,
        pattern: effectivePattern,
        document: {
          id: document.id,
          fileUrl: document.fileUrl,
          ocrText: document.ocrResult?.text ?? '',
          ocrData: document.ocrResult?.data
        }
      })

      result = {
        extractedValue: extractionResult.value,
        confidence: extractionResult.confidence,
        processingTime: Date.now() - startTime,
        matchPosition: extractionResult.position,
        rawOcrText: document.ocrResult?.text?.substring(0, 500),
        debugInfo: {
          patternMatched: !!extractionResult.value,
          matchDetails: extractionResult.matchDetails
        }
      }
    } catch (error) {
      result = {
        extractedValue: null,
        confidence: 0,
        processingTime: Date.now() - startTime,
        debugInfo: {
          patternMatched: false,
          errorMessage: error instanceof Error ? error.message : 'Unknown error'
        }
      }
    }

    // 7. Log preview action
    await prisma.auditLog.create({
      data: {
        action: 'RULE_PREVIEW_EXECUTED',
        entityType: 'MappingRule',
        entityId: rule.id,
        userId: session.user.id,
        details: {
          documentId,
          fieldName: rule.fieldName,
          success: !!result.extractedValue,
          confidence: result.confidence
        }
      }
    })

    // 8. Return response
    return NextResponse.json({
      success: true,
      data: {
        rule: {
          id: rule.id,
          fieldName: rule.fieldName,
          extractionType: effectiveType
        },
        document: {
          id: document.id,
          fileName: document.fileName
        },
        result
      }
    })
  } catch (error) {
    console.error('Error previewing rule:', error)
    return NextResponse.json(
      {
        type: 'https://api.example.com/errors/internal',
        title: 'Internal Server Error',
        status: 500,
        detail: '預覽規則時發生錯誤'
      },
      { status: 500 }
    )
  }
}
```

### 4.4 Notification Service

**File**: `src/lib/notifications.ts`

```typescript
import { prisma } from '@/lib/prisma'
import { PERMISSIONS } from '@/lib/permissions'
import { ChangeType, NotificationType } from '@prisma/client'

interface NotifyReviewersParams {
  changeRequestId: string
  changeType: ChangeType
  forwarderName: string
  fieldName: string
  requesterName: string
}

// Change type labels for notifications
const changeTypeLabels: Record<ChangeType, string> = {
  CREATE: '新增',
  UPDATE: '修改',
  DELETE: '刪除',
  ACTIVATE: '啟用',
  DEACTIVATE: '停用'
}

export async function notifyReviewers(params: NotifyReviewersParams): Promise<void> {
  const { changeRequestId, changeType, forwarderName, fieldName, requesterName } = params

  try {
    // 1. Find users with RULE_APPROVE permission
    const reviewers = await prisma.user.findMany({
      where: {
        roles: {
          some: {
            permissions: {
              has: PERMISSIONS.RULE_APPROVE
            }
          }
        }
      },
      select: {
        id: true,
        name: true,
        email: true
      }
    })

    if (reviewers.length === 0) {
      console.warn('No reviewers found with RULE_APPROVE permission')
      return
    }

    // 2. Create notification for each reviewer
    const notifications = reviewers.map(reviewer => ({
      userId: reviewer.id,
      type: NotificationType.RULE_CHANGE_REQUEST,
      title: '規則變更申請',
      message: `${requesterName} 申請${changeTypeLabels[changeType]}規則「${fieldName}」(Forwarder: ${forwarderName})`,
      data: {
        changeRequestId,
        changeType,
        forwarderName,
        fieldName,
        requesterName
      }
    }))

    await prisma.notification.createMany({
      data: notifications
    })

    // 3. Optionally send real-time notifications (WebSocket/SSE)
    // This would integrate with your real-time notification system
    // await pushNotifications(reviewers.map(r => r.id), notifications[0])

    console.log(`Notified ${reviewers.length} reviewers about change request ${changeRequestId}`)
  } catch (error) {
    console.error('Error notifying reviewers:', error)
    // Don't throw - notification failure shouldn't fail the main operation
  }
}

export async function notifyRequester(
  requesterId: string,
  changeRequestId: string,
  status: 'APPROVED' | 'REJECTED',
  fieldName: string,
  reviewerName: string,
  reviewNotes?: string
): Promise<void> {
  try {
    const notificationType = status === 'APPROVED'
      ? NotificationType.RULE_CHANGE_APPROVED
      : NotificationType.RULE_CHANGE_REJECTED

    const title = status === 'APPROVED' ? '規則變更已批准' : '規則變更已拒絕'
    const message = status === 'APPROVED'
      ? `您的規則變更申請「${fieldName}」已被 ${reviewerName} 批准`
      : `您的規則變更申請「${fieldName}」已被 ${reviewerName} 拒絕${reviewNotes ? `：${reviewNotes}` : ''}`

    await prisma.notification.create({
      data: {
        userId: requesterId,
        type: notificationType,
        title,
        message,
        data: {
          changeRequestId,
          status,
          fieldName,
          reviewerName,
          reviewNotes
        }
      }
    })
  } catch (error) {
    console.error('Error notifying requester:', error)
  }
}
```

---

## 5. Frontend Components

### 5.1 ForwarderRulesPage

**File**: `src/app/(dashboard)/forwarders/[id]/rules/page.tsx`

```typescript
'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Plus, Edit, Eye, FileCode, ArrowLeft } from 'lucide-react'
import { RuleEditForm } from '@/components/rules/RuleEditForm'
import { RulePreview } from '@/components/rules/RulePreview'
import { ExtractionType, RuleStatus } from '@prisma/client'
import { toast } from 'sonner'

interface Props {
  params: { id: string }
}

interface MappingRule {
  id: string
  fieldName: string
  extractionType: ExtractionType
  pattern: Record<string, unknown> | null
  priority: number
  confidence: number
  status: RuleStatus
  version: number
  updatedAt: string
}

// Fetch functions
async function fetchForwarderRules(forwarderId: string): Promise<MappingRule[]> {
  const response = await fetch(`/api/forwarders/${forwarderId}/rules?pageSize=100`)
  if (!response.ok) throw new Error('Failed to fetch rules')
  const result = await response.json()
  return result.data.items
}

async function updateRule(
  forwarderId: string,
  ruleId: string,
  data: {
    extractionType?: ExtractionType
    pattern?: Record<string, unknown>
    priority?: number
    confidence?: number
    reason: string
  }
) {
  const response = await fetch(`/api/forwarders/${forwarderId}/rules/${ruleId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  })
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.detail || 'Failed to update rule')
  }
  return response.json()
}

async function createRule(
  forwarderId: string,
  data: {
    fieldName: string
    extractionType: ExtractionType
    pattern?: Record<string, unknown>
    priority?: number
    confidence?: number
    reason: string
  }
) {
  const response = await fetch(`/api/forwarders/${forwarderId}/rules`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  })
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.detail || 'Failed to create rule')
  }
  return response.json()
}

// Extraction type label mapping
function getExtractionTypeLabel(type: ExtractionType): string {
  const labels: Record<ExtractionType, string> = {
    REGEX: '正則表達式',
    POSITION: '位置座標',
    KEYWORD: '關鍵字搜尋',
    TABLE: '表格提取',
    AI_ASSISTED: 'AI 輔助'
  }
  return labels[type]
}

// Status badge variant
function getStatusBadgeVariant(status: RuleStatus) {
  switch (status) {
    case 'ACTIVE': return 'default'
    case 'DRAFT': return 'secondary'
    case 'DEPRECATED': return 'destructive'
  }
}

export default function ForwarderRulesPage({ params }: Props) {
  const router = useRouter()
  const queryClient = useQueryClient()

  // Dialog states
  const [editingRule, setEditingRule] = useState<MappingRule | null>(null)
  const [previewRule, setPreviewRule] = useState<MappingRule | null>(null)
  const [isNewRuleOpen, setIsNewRuleOpen] = useState(false)

  // Query
  const { data: rules, isLoading, error } = useQuery({
    queryKey: ['forwarder-rules-edit', params.id],
    queryFn: () => fetchForwarderRules(params.id)
  })

  // Mutations
  const updateMutation = useMutation({
    mutationFn: (data: { ruleId: string; updates: Parameters<typeof updateRule>[2] }) =>
      updateRule(params.id, data.ruleId, data.updates),
    onSuccess: (result) => {
      toast.success(result.data.message)
      setEditingRule(null)
      queryClient.invalidateQueries({ queryKey: ['forwarder-rules-edit', params.id] })
    },
    onError: (error: Error) => {
      toast.error(error.message)
    }
  })

  const createMutation = useMutation({
    mutationFn: (data: Parameters<typeof createRule>[1]) =>
      createRule(params.id, data),
    onSuccess: (result) => {
      toast.success(result.data.message)
      setIsNewRuleOpen(false)
      queryClient.invalidateQueries({ queryKey: ['forwarder-rules-edit', params.id] })
    },
    onError: (error: Error) => {
      toast.error(error.message)
    }
  })

  if (isLoading) {
    return <RulesPageSkeleton />
  }

  if (error) {
    return (
      <div className="py-10 text-center text-destructive">
        載入規則時發生錯誤
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push(`/forwarders/${params.id}`)}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <FileCode className="h-5 w-5" />
              映射規則管理
            </h2>
            <p className="text-sm text-muted-foreground">
              共 {rules?.length ?? 0} 條規則
            </p>
          </div>
        </div>
        <Button onClick={() => setIsNewRuleOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          新增規則
        </Button>
      </div>

      {/* Rules List */}
      <div className="space-y-4">
        {rules?.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground">
              尚無映射規則，點擊「新增規則」開始建立
            </CardContent>
          </Card>
        ) : (
          rules?.map((rule) => (
            <Card key={rule.id}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div>
                  <CardTitle className="text-lg">{rule.fieldName}</CardTitle>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="outline">
                      {getExtractionTypeLabel(rule.extractionType)}
                    </Badge>
                    <Badge variant={getStatusBadgeVariant(rule.status)}>
                      {rule.status === 'ACTIVE' ? '啟用' : rule.status === 'DRAFT' ? '草稿' : '已棄用'}
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      優先級: {rule.priority} | 版本: v{rule.version}
                    </span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPreviewRule(rule)}
                  >
                    <Eye className="mr-1 h-4 w-4" />
                    預覽
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setEditingRule(rule)}
                  >
                    <Edit className="mr-1 h-4 w-4" />
                    編輯
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="rounded bg-muted p-4">
                  <p className="text-sm font-medium mb-2">Pattern:</p>
                  <pre className="text-sm overflow-x-auto whitespace-pre-wrap">
                    {rule.pattern ? JSON.stringify(rule.pattern, null, 2) : '(未設定)'}
                  </pre>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editingRule} onOpenChange={() => setEditingRule(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>編輯規則: {editingRule?.fieldName}</DialogTitle>
          </DialogHeader>
          {editingRule && (
            <RuleEditForm
              rule={editingRule}
              onSubmit={(updates) =>
                updateMutation.mutate({ ruleId: editingRule.id, updates })
              }
              onCancel={() => setEditingRule(null)}
              isSubmitting={updateMutation.isPending}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={!!previewRule} onOpenChange={() => setPreviewRule(null)}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>規則預覽: {previewRule?.fieldName}</DialogTitle>
          </DialogHeader>
          {previewRule && (
            <RulePreview
              rule={previewRule}
              forwarderId={params.id}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* New Rule Dialog */}
      <Dialog open={isNewRuleOpen} onOpenChange={setIsNewRuleOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>新增映射規則</DialogTitle>
          </DialogHeader>
          <RuleEditForm
            forwarderId={params.id}
            onSubmit={(data) => createMutation.mutate(data)}
            onCancel={() => setIsNewRuleOpen(false)}
            isSubmitting={createMutation.isPending}
            isNew
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}

// Skeleton
function RulesPageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-10 w-32" />
      </div>
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-4 w-48" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-24 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
```

### 5.2 RuleEditForm Component

**File**: `src/components/rules/RuleEditForm.tsx`

```typescript
'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Slider } from '@/components/ui/slider'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2 } from 'lucide-react'
import { ExtractionType } from '@prisma/client'
import { RegexEditor } from './pattern-editors/RegexEditor'
import { PositionEditor } from './pattern-editors/PositionEditor'
import { KeywordEditor } from './pattern-editors/KeywordEditor'
import { AIPromptEditor } from './pattern-editors/AIPromptEditor'
import { TableEditor } from './pattern-editors/TableEditor'

// Form Schema
const ruleFormSchema = z.object({
  fieldName: z.string().min(1, '欄位名稱為必填').max(100),
  extractionType: z.nativeEnum(ExtractionType),
  pattern: z.record(z.unknown()).optional(),
  priority: z.number().int().min(1).max(100),
  confidence: z.number().min(0).max(1),
  reason: z.string().min(1, '請說明變更原因').max(500)
})

type RuleFormData = z.infer<typeof ruleFormSchema>

interface MappingRule {
  id: string
  fieldName: string
  extractionType: ExtractionType
  pattern: Record<string, unknown> | null
  priority: number
  confidence: number
}

interface RuleEditFormProps {
  rule?: MappingRule
  forwarderId?: string
  onSubmit: (data: RuleFormData) => void
  onCancel: () => void
  isSubmitting: boolean
  isNew?: boolean
}

export function RuleEditForm({
  rule,
  forwarderId,
  onSubmit,
  onCancel,
  isSubmitting,
  isNew = false
}: RuleEditFormProps) {
  const [extractionType, setExtractionType] = useState<ExtractionType>(
    rule?.extractionType ?? ExtractionType.REGEX
  )
  const [pattern, setPattern] = useState<Record<string, unknown> | null>(
    rule?.pattern ?? null
  )

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors }
  } = useForm<RuleFormData>({
    resolver: zodResolver(ruleFormSchema),
    defaultValues: {
      fieldName: rule?.fieldName ?? '',
      extractionType: rule?.extractionType ?? ExtractionType.REGEX,
      pattern: rule?.pattern ?? undefined,
      priority: rule?.priority ?? 50,
      confidence: rule?.confidence ?? 0.8,
      reason: ''
    }
  })

  const priority = watch('priority')
  const confidence = watch('confidence')

  // Handle extraction type change
  const handleExtractionTypeChange = (type: ExtractionType) => {
    setExtractionType(type)
    setValue('extractionType', type)
    // Reset pattern when type changes
    setPattern(null)
    setValue('pattern', undefined)
  }

  // Handle pattern change
  const handlePatternChange = (newPattern: Record<string, unknown>) => {
    setPattern(newPattern)
    setValue('pattern', newPattern)
  }

  // Form submit handler
  const onFormSubmit = (data: RuleFormData) => {
    onSubmit({
      ...data,
      pattern: pattern ?? undefined
    })
  }

  // Render pattern editor based on extraction type
  const renderPatternEditor = () => {
    switch (extractionType) {
      case ExtractionType.REGEX:
        return (
          <RegexEditor
            value={pattern as any}
            onChange={handlePatternChange}
          />
        )
      case ExtractionType.POSITION:
        return (
          <PositionEditor
            value={pattern as any}
            onChange={handlePatternChange}
          />
        )
      case ExtractionType.KEYWORD:
        return (
          <KeywordEditor
            value={pattern as any}
            onChange={handlePatternChange}
          />
        )
      case ExtractionType.AI_ASSISTED:
        return (
          <AIPromptEditor
            value={pattern as any}
            onChange={handlePatternChange}
          />
        )
      case ExtractionType.TABLE:
        return (
          <TableEditor
            value={pattern as any}
            onChange={handlePatternChange}
          />
        )
      default:
        return null
    }
  }

  return (
    <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-6">
      {/* Basic Info Section */}
      <Card>
        <CardHeader>
          <CardTitle>基本資訊</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Field Name */}
          <div className="space-y-2">
            <Label htmlFor="fieldName">欄位名稱 *</Label>
            <Input
              id="fieldName"
              {...register('fieldName')}
              disabled={!isNew}
              placeholder="例如: invoiceNumber, totalAmount"
            />
            {errors.fieldName && (
              <p className="text-sm text-destructive">{errors.fieldName.message}</p>
            )}
          </div>

          {/* Extraction Type */}
          <div className="space-y-2">
            <Label>提取類型 *</Label>
            <Select
              value={extractionType}
              onValueChange={(value) => handleExtractionTypeChange(value as ExtractionType)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="REGEX">正則表達式</SelectItem>
                <SelectItem value="POSITION">位置座標</SelectItem>
                <SelectItem value="KEYWORD">關鍵字搜尋</SelectItem>
                <SelectItem value="TABLE">表格提取</SelectItem>
                <SelectItem value="AI_ASSISTED">AI 輔助</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Priority */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>優先級</Label>
              <span className="text-sm text-muted-foreground">{priority}</span>
            </div>
            <Slider
              value={[priority]}
              onValueChange={([value]) => setValue('priority', value)}
              min={1}
              max={100}
              step={1}
            />
            <p className="text-xs text-muted-foreground">
              數值越高，優先級越高。當多個規則匹配時，優先使用高優先級的規則。
            </p>
          </div>

          {/* Confidence Threshold */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>信心度閾值</Label>
              <span className="text-sm text-muted-foreground">
                {(confidence * 100).toFixed(0)}%
              </span>
            </div>
            <Slider
              value={[confidence * 100]}
              onValueChange={([value]) => setValue('confidence', value / 100)}
              min={0}
              max={100}
              step={5}
            />
            <p className="text-xs text-muted-foreground">
              低於此閾值的提取結果將被標記為需要人工審核。
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Pattern Editor Section */}
      <Card>
        <CardHeader>
          <CardTitle>Pattern 設定</CardTitle>
        </CardHeader>
        <CardContent>
          {renderPatternEditor()}
        </CardContent>
      </Card>

      {/* Reason Section */}
      <Card>
        <CardHeader>
          <CardTitle>變更說明</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label htmlFor="reason">變更原因 *</Label>
            <Textarea
              id="reason"
              {...register('reason')}
              placeholder="請說明為什麼要進行此變更..."
              rows={3}
            />
            {errors.reason && (
              <p className="text-sm text-destructive">{errors.reason.message}</p>
            )}
            <p className="text-xs text-muted-foreground">
              此說明將會顯示在變更審核流程中，請提供足夠的資訊讓審核者了解變更的必要性。
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex items-center justify-end gap-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          取消
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isNew ? '提交新增申請' : '提交變更申請'}
        </Button>
      </div>
    </form>
  )
}
```

### 5.3 Pattern Editors

#### 5.3.1 RegexEditor

**File**: `src/components/rules/pattern-editors/RegexEditor.tsx`

```typescript
'use client'

import { useState, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { AlertCircle, CheckCircle } from 'lucide-react'

interface RegexPattern {
  type: 'REGEX'
  expression: string
  flags?: string
  groupIndex?: number
  preprocessing?: {
    trim?: boolean
    removeSpaces?: boolean
    toUpperCase?: boolean
    toLowerCase?: boolean
  }
}

interface RegexEditorProps {
  value: RegexPattern | null
  onChange: (value: RegexPattern) => void
}

export function RegexEditor({ value, onChange }: RegexEditorProps) {
  const [expression, setExpression] = useState(value?.expression ?? '')
  const [flags, setFlags] = useState(value?.flags ?? '')
  const [groupIndex, setGroupIndex] = useState(value?.groupIndex ?? 0)
  const [testInput, setTestInput] = useState('')
  const [testResult, setTestResult] = useState<{ matched: boolean; value?: string } | null>(null)
  const [regexError, setRegexError] = useState<string | null>(null)
  const [preprocessing, setPreprocessing] = useState({
    trim: value?.preprocessing?.trim ?? true,
    removeSpaces: value?.preprocessing?.removeSpaces ?? false,
    toUpperCase: value?.preprocessing?.toUpperCase ?? false,
    toLowerCase: value?.preprocessing?.toLowerCase ?? false
  })

  // Validate and test regex
  useEffect(() => {
    if (!expression) {
      setRegexError(null)
      setTestResult(null)
      return
    }

    try {
      const regex = new RegExp(expression, flags)
      setRegexError(null)

      if (testInput) {
        const match = regex.exec(testInput)
        if (match) {
          const extractedValue = match[groupIndex] ?? match[0]
          setTestResult({ matched: true, value: extractedValue })
        } else {
          setTestResult({ matched: false })
        }
      }
    } catch (error) {
      setRegexError(error instanceof Error ? error.message : 'Invalid regex')
      setTestResult(null)
    }
  }, [expression, flags, groupIndex, testInput])

  // Update parent
  useEffect(() => {
    if (expression && !regexError) {
      onChange({
        type: 'REGEX',
        expression,
        flags: flags || undefined,
        groupIndex: groupIndex || undefined,
        preprocessing
      })
    }
  }, [expression, flags, groupIndex, preprocessing])

  return (
    <div className="space-y-4">
      {/* Expression Input */}
      <div className="space-y-2">
        <Label>正則表達式 *</Label>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">/</span>
          <Input
            value={expression}
            onChange={(e) => setExpression(e.target.value)}
            placeholder="例如: INV-(\d{6})"
            className="font-mono"
          />
          <span className="text-muted-foreground">/</span>
          <Input
            value={flags}
            onChange={(e) => setFlags(e.target.value)}
            placeholder="gi"
            className="w-16 font-mono"
          />
        </div>
        {regexError && (
          <p className="text-sm text-destructive flex items-center gap-1">
            <AlertCircle className="h-4 w-4" />
            {regexError}
          </p>
        )}
      </div>

      {/* Group Index */}
      <div className="space-y-2">
        <Label>擷取群組索引</Label>
        <Input
          type="number"
          min={0}
          value={groupIndex}
          onChange={(e) => setGroupIndex(parseInt(e.target.value) || 0)}
          className="w-24"
        />
        <p className="text-xs text-muted-foreground">
          0 = 完整匹配，1 = 第一個括號群組，以此類推
        </p>
      </div>

      {/* Preprocessing Options */}
      <div className="space-y-2">
        <Label>預處理選項</Label>
        <div className="flex flex-wrap gap-4">
          <div className="flex items-center gap-2">
            <Checkbox
              id="trim"
              checked={preprocessing.trim}
              onCheckedChange={(checked) =>
                setPreprocessing(prev => ({ ...prev, trim: !!checked }))
              }
            />
            <label htmlFor="trim" className="text-sm">移除頭尾空白</label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="removeSpaces"
              checked={preprocessing.removeSpaces}
              onCheckedChange={(checked) =>
                setPreprocessing(prev => ({ ...prev, removeSpaces: !!checked }))
              }
            />
            <label htmlFor="removeSpaces" className="text-sm">移除所有空白</label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="toUpperCase"
              checked={preprocessing.toUpperCase}
              onCheckedChange={(checked) =>
                setPreprocessing(prev => ({ ...prev, toUpperCase: !!checked, toLowerCase: false }))
              }
            />
            <label htmlFor="toUpperCase" className="text-sm">轉大寫</label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="toLowerCase"
              checked={preprocessing.toLowerCase}
              onCheckedChange={(checked) =>
                setPreprocessing(prev => ({ ...prev, toLowerCase: !!checked, toUpperCase: false }))
              }
            />
            <label htmlFor="toLowerCase" className="text-sm">轉小寫</label>
          </div>
        </div>
      </div>

      {/* Test Area */}
      <div className="space-y-2 border-t pt-4">
        <Label>測試</Label>
        <Input
          value={testInput}
          onChange={(e) => setTestInput(e.target.value)}
          placeholder="輸入測試文字..."
        />
        {testResult && (
          <div className="flex items-center gap-2">
            {testResult.matched ? (
              <>
                <Badge variant="default" className="gap-1">
                  <CheckCircle className="h-3 w-3" />
                  匹配成功
                </Badge>
                <span className="text-sm">
                  提取結果: <code className="bg-muted px-1 rounded">{testResult.value}</code>
                </span>
              </>
            ) : (
              <Badge variant="destructive" className="gap-1">
                <AlertCircle className="h-3 w-3" />
                無匹配
              </Badge>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
```

#### 5.3.2 KeywordEditor

**File**: `src/components/rules/pattern-editors/KeywordEditor.tsx`

```typescript
'use client'

import { useState, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Plus, X } from 'lucide-react'

interface KeywordPattern {
  type: 'KEYWORD'
  keywords: string[]
  searchDirection: 'right' | 'below' | 'left' | 'above'
  maxDistance: number
  caseSensitive?: boolean
  extractLength?: number
}

interface KeywordEditorProps {
  value: KeywordPattern | null
  onChange: (value: KeywordPattern) => void
}

export function KeywordEditor({ value, onChange }: KeywordEditorProps) {
  const [keywords, setKeywords] = useState<string[]>(value?.keywords ?? [])
  const [newKeyword, setNewKeyword] = useState('')
  const [searchDirection, setSearchDirection] = useState<'right' | 'below' | 'left' | 'above'>(
    value?.searchDirection ?? 'right'
  )
  const [maxDistance, setMaxDistance] = useState(value?.maxDistance ?? 100)
  const [caseSensitive, setCaseSensitive] = useState(value?.caseSensitive ?? false)
  const [extractLength, setExtractLength] = useState(value?.extractLength ?? 50)

  // Add keyword
  const addKeyword = () => {
    if (newKeyword.trim() && !keywords.includes(newKeyword.trim())) {
      setKeywords(prev => [...prev, newKeyword.trim()])
      setNewKeyword('')
    }
  }

  // Remove keyword
  const removeKeyword = (keyword: string) => {
    setKeywords(prev => prev.filter(k => k !== keyword))
  }

  // Update parent
  useEffect(() => {
    if (keywords.length > 0) {
      onChange({
        type: 'KEYWORD',
        keywords,
        searchDirection,
        maxDistance,
        caseSensitive: caseSensitive || undefined,
        extractLength
      })
    }
  }, [keywords, searchDirection, maxDistance, caseSensitive, extractLength])

  return (
    <div className="space-y-4">
      {/* Keywords Input */}
      <div className="space-y-2">
        <Label>關鍵字列表 *</Label>
        <div className="flex gap-2">
          <Input
            value={newKeyword}
            onChange={(e) => setNewKeyword(e.target.value)}
            placeholder="輸入關鍵字..."
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addKeyword())}
          />
          <Button type="button" onClick={addKeyword} size="icon">
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          {keywords.map((keyword) => (
            <Badge key={keyword} variant="secondary" className="gap-1">
              {keyword}
              <button
                type="button"
                onClick={() => removeKeyword(keyword)}
                className="ml-1 hover:text-destructive"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
          {keywords.length === 0 && (
            <p className="text-sm text-muted-foreground">尚未添加關鍵字</p>
          )}
        </div>
      </div>

      {/* Search Direction */}
      <div className="space-y-2">
        <Label>搜尋方向</Label>
        <Select
          value={searchDirection}
          onValueChange={(value) => setSearchDirection(value as any)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="right">向右 (→)</SelectItem>
            <SelectItem value="below">向下 (↓)</SelectItem>
            <SelectItem value="left">向左 (←)</SelectItem>
            <SelectItem value="above">向上 (↑)</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          找到關鍵字後，從該方向提取值
        </p>
      </div>

      {/* Max Distance */}
      <div className="space-y-2">
        <Label>最大搜尋距離 (字元)</Label>
        <Input
          type="number"
          min={10}
          max={500}
          value={maxDistance}
          onChange={(e) => setMaxDistance(parseInt(e.target.value) || 100)}
          className="w-32"
        />
      </div>

      {/* Extract Length */}
      <div className="space-y-2">
        <Label>提取長度 (字元)</Label>
        <Input
          type="number"
          min={1}
          max={200}
          value={extractLength}
          onChange={(e) => setExtractLength(parseInt(e.target.value) || 50)}
          className="w-32"
        />
      </div>

      {/* Case Sensitive */}
      <div className="flex items-center gap-2">
        <Checkbox
          id="caseSensitive"
          checked={caseSensitive}
          onCheckedChange={(checked) => setCaseSensitive(!!checked)}
        />
        <label htmlFor="caseSensitive" className="text-sm">區分大小寫</label>
      </div>
    </div>
  )
}
```

### 5.4 RulePreview Component

**File**: `src/components/rules/RulePreview.tsx`

```typescript
'use client'

import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2, CheckCircle, AlertCircle, FileText, Clock } from 'lucide-react'
import { ExtractionType } from '@prisma/client'

interface MappingRule {
  id: string
  fieldName: string
  extractionType: ExtractionType
  pattern: Record<string, unknown> | null
}

interface RulePreviewProps {
  rule: MappingRule
  forwarderId: string
}

interface PreviewResult {
  extractedValue: string | null
  confidence: number
  processingTime: number
  matchPosition?: {
    page: number
    x: number
    y: number
    width: number
    height: number
  }
  rawOcrText?: string
  debugInfo?: {
    patternMatched: boolean
    matchDetails?: string
    errorMessage?: string
  }
}

// Fetch recent documents
async function fetchRecentDocuments(forwarderId: string) {
  const response = await fetch(`/api/forwarders/${forwarderId}/documents?pageSize=20`)
  if (!response.ok) throw new Error('Failed to fetch documents')
  const result = await response.json()
  return result.data.items
}

// Execute preview
async function executePreview(
  ruleId: string,
  documentId: string
): Promise<{ rule: any; document: any; result: PreviewResult }> {
  const response = await fetch(`/api/rules/${ruleId}/preview`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ documentId })
  })
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.detail || 'Failed to preview rule')
  }
  const result = await response.json()
  return result.data
}

export function RulePreview({ rule, forwarderId }: RulePreviewProps) {
  const [selectedDocument, setSelectedDocument] = useState<string>('')

  // Fetch documents
  const { data: documents, isLoading: isLoadingDocs } = useQuery({
    queryKey: ['forwarder-documents-preview', forwarderId],
    queryFn: () => fetchRecentDocuments(forwarderId)
  })

  // Preview mutation
  const previewMutation = useMutation({
    mutationFn: () => executePreview(rule.id, selectedDocument)
  })

  const handlePreview = () => {
    if (selectedDocument) {
      previewMutation.mutate()
    }
  }

  return (
    <div className="space-y-6">
      {/* Document Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">選擇測試文件</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            {isLoadingDocs ? (
              <Skeleton className="h-10 w-[300px]" />
            ) : (
              <Select value={selectedDocument} onValueChange={setSelectedDocument}>
                <SelectTrigger className="w-[300px]">
                  <SelectValue placeholder="選擇文件..." />
                </SelectTrigger>
                <SelectContent>
                  {documents?.map((doc: any) => (
                    <SelectItem key={doc.id} value={doc.id}>
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        <span className="truncate max-w-[250px]">{doc.fileName}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <Button
              onClick={handlePreview}
              disabled={!selectedDocument || previewMutation.isPending}
            >
              {previewMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              執行預覽
            </Button>
          </div>

          {documents?.length === 0 && (
            <p className="text-sm text-muted-foreground">
              此 Forwarder 尚無可用的測試文件
            </p>
          )}
        </CardContent>
      </Card>

      {/* Preview Results */}
      {previewMutation.data && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              預覽結果
              {previewMutation.data.result.extractedValue ? (
                <Badge variant="default" className="gap-1">
                  <CheckCircle className="h-3 w-3" />
                  成功
                </Badge>
              ) : (
                <Badge variant="destructive" className="gap-1">
                  <AlertCircle className="h-3 w-3" />
                  未匹配
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Main Result */}
            <div className="grid grid-cols-2 gap-6">
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">提取結果</p>
                <p className="text-2xl font-bold">
                  {previewMutation.data.result.extractedValue || '(未提取到)'}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">信心度</p>
                <div className="flex items-center gap-2">
                  <p className={`text-2xl font-bold ${
                    previewMutation.data.result.confidence >= 0.9 ? 'text-green-600' :
                    previewMutation.data.result.confidence >= 0.7 ? 'text-yellow-600' :
                    'text-red-600'
                  }`}>
                    {(previewMutation.data.result.confidence * 100).toFixed(1)}%
                  </p>
                </div>
              </div>
            </div>

            {/* Processing Time */}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              處理時間: {previewMutation.data.result.processingTime}ms
            </div>

            {/* Match Position */}
            {previewMutation.data.result.matchPosition && (
              <div className="border-t pt-4">
                <p className="text-sm font-medium mb-2">匹配位置</p>
                <div className="grid grid-cols-5 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">頁碼</p>
                    <p>{previewMutation.data.result.matchPosition.page}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">X</p>
                    <p>{previewMutation.data.result.matchPosition.x.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Y</p>
                    <p>{previewMutation.data.result.matchPosition.y.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">寬度</p>
                    <p>{previewMutation.data.result.matchPosition.width.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">高度</p>
                    <p>{previewMutation.data.result.matchPosition.height.toFixed(2)}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Debug Info */}
            {previewMutation.data.result.debugInfo && (
              <div className="border-t pt-4">
                <p className="text-sm font-medium mb-2">除錯資訊</p>
                <div className="rounded bg-muted p-4 text-sm">
                  <p>Pattern 匹配: {previewMutation.data.result.debugInfo.patternMatched ? '是' : '否'}</p>
                  {previewMutation.data.result.debugInfo.matchDetails && (
                    <p className="mt-1">詳情: {previewMutation.data.result.debugInfo.matchDetails}</p>
                  )}
                  {previewMutation.data.result.debugInfo.errorMessage && (
                    <p className="mt-1 text-destructive">錯誤: {previewMutation.data.result.debugInfo.errorMessage}</p>
                  )}
                </div>
              </div>
            )}

            {/* Raw OCR Text Preview */}
            {previewMutation.data.result.rawOcrText && (
              <div className="border-t pt-4">
                <p className="text-sm font-medium mb-2">OCR 文字預覽 (前 500 字)</p>
                <pre className="rounded bg-muted p-4 text-xs overflow-x-auto whitespace-pre-wrap max-h-48">
                  {previewMutation.data.result.rawOcrText}
                </pre>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Error State */}
      {previewMutation.error && (
        <Card className="border-destructive">
          <CardContent className="py-6">
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              <span>預覽失敗: {previewMutation.error.message}</span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
```

---

## 6. Rule Executor Service

**File**: `src/lib/extraction/rule-executor.ts`

```typescript
import { ExtractionType } from '@prisma/client'

interface ExecuteParams {
  extractionType: ExtractionType
  pattern: Record<string, unknown> | null
  document: {
    id: string
    fileUrl: string
    ocrText: string
    ocrData?: any
  }
}

interface ExecuteResult {
  value: string | null
  confidence: number
  position?: {
    page: number
    x: number
    y: number
    width: number
    height: number
  }
  matchDetails?: string
}

export class RuleExecutor {
  async execute(params: ExecuteParams): Promise<ExecuteResult> {
    const { extractionType, pattern, document } = params

    if (!pattern) {
      return { value: null, confidence: 0, matchDetails: 'No pattern defined' }
    }

    switch (extractionType) {
      case 'REGEX':
        return this.executeRegex(pattern, document.ocrText)
      case 'KEYWORD':
        return this.executeKeyword(pattern, document.ocrText)
      case 'POSITION':
        return this.executePosition(pattern, document.ocrData)
      case 'TABLE':
        return this.executeTable(pattern, document.ocrData)
      case 'AI_ASSISTED':
        return this.executeAIAssisted(pattern, document)
      default:
        return { value: null, confidence: 0, matchDetails: 'Unknown extraction type' }
    }
  }

  private executeRegex(
    pattern: Record<string, unknown>,
    text: string
  ): ExecuteResult {
    const { expression, flags, groupIndex, preprocessing } = pattern as any

    let processedText = text
    if (preprocessing?.trim) processedText = processedText.trim()
    if (preprocessing?.removeSpaces) processedText = processedText.replace(/\s/g, '')

    try {
      const regex = new RegExp(expression, flags || '')
      const match = regex.exec(processedText)

      if (!match) {
        return { value: null, confidence: 0, matchDetails: 'No regex match found' }
      }

      let value = match[groupIndex ?? 0] ?? match[0]

      if (preprocessing?.toUpperCase) value = value.toUpperCase()
      if (preprocessing?.toLowerCase) value = value.toLowerCase()

      return {
        value,
        confidence: 0.9, // High confidence for regex matches
        matchDetails: `Matched at index ${match.index}`
      }
    } catch (error) {
      return {
        value: null,
        confidence: 0,
        matchDetails: `Regex error: ${error instanceof Error ? error.message : 'Unknown'}`
      }
    }
  }

  private executeKeyword(
    pattern: Record<string, unknown>,
    text: string
  ): ExecuteResult {
    const { keywords, searchDirection, maxDistance, caseSensitive, extractLength } = pattern as any

    const searchText = caseSensitive ? text : text.toLowerCase()

    for (const keyword of keywords) {
      const searchKeyword = caseSensitive ? keyword : keyword.toLowerCase()
      const keywordIndex = searchText.indexOf(searchKeyword)

      if (keywordIndex === -1) continue

      let startIndex: number
      let endIndex: number

      switch (searchDirection) {
        case 'right':
          startIndex = keywordIndex + keyword.length
          endIndex = Math.min(startIndex + extractLength, text.length)
          break
        case 'left':
          endIndex = keywordIndex
          startIndex = Math.max(0, endIndex - extractLength)
          break
        default:
          startIndex = keywordIndex + keyword.length
          endIndex = Math.min(startIndex + extractLength, text.length)
      }

      const extracted = text.substring(startIndex, endIndex).trim()

      if (extracted) {
        return {
          value: extracted,
          confidence: 0.75,
          matchDetails: `Found keyword "${keyword}" at index ${keywordIndex}`
        }
      }
    }

    return { value: null, confidence: 0, matchDetails: 'No keyword match found' }
  }

  private executePosition(
    pattern: Record<string, unknown>,
    ocrData: any
  ): ExecuteResult {
    const { coordinates, unit, pageNumber } = pattern as any

    if (!ocrData?.pages) {
      return { value: null, confidence: 0, matchDetails: 'No OCR data available' }
    }

    const page = ocrData.pages[pageNumber - 1] ?? ocrData.pages[0]
    if (!page?.words) {
      return { value: null, confidence: 0, matchDetails: 'No words in page' }
    }

    // Find words within bounding box
    const matchingWords: string[] = []

    for (const word of page.words) {
      const wordBox = word.boundingBox
      if (
        wordBox.x >= coordinates.x1 &&
        wordBox.x + wordBox.width <= coordinates.x2 &&
        wordBox.y >= coordinates.y1 &&
        wordBox.y + wordBox.height <= coordinates.y2
      ) {
        matchingWords.push(word.text)
      }
    }

    if (matchingWords.length === 0) {
      return { value: null, confidence: 0, matchDetails: 'No words in position' }
    }

    return {
      value: matchingWords.join(' '),
      confidence: 0.85,
      position: {
        page: pageNumber || 1,
        x: coordinates.x1,
        y: coordinates.y1,
        width: coordinates.x2 - coordinates.x1,
        height: coordinates.y2 - coordinates.y1
      },
      matchDetails: `Found ${matchingWords.length} words in region`
    }
  }

  private executeTable(
    pattern: Record<string, unknown>,
    ocrData: any
  ): ExecuteResult {
    // Table extraction logic would be more complex
    // This is a simplified placeholder
    return {
      value: null,
      confidence: 0,
      matchDetails: 'Table extraction not fully implemented'
    }
  }

  private async executeAIAssisted(
    pattern: Record<string, unknown>,
    document: { ocrText: string }
  ): Promise<ExecuteResult> {
    const { prompt, modelConfig } = pattern as any

    // AI-assisted extraction would call an AI model
    // This is a placeholder for the actual implementation
    return {
      value: null,
      confidence: 0,
      matchDetails: 'AI-assisted extraction requires AI service integration'
    }
  }
}
```

---

## 7. Test Specifications

### 7.1 API Tests

**File**: `__tests__/api/forwarders/[id]/rules/route.test.ts`

```typescript
import { PUT } from '@/app/api/forwarders/[id]/rules/[ruleId]/route'
import { POST } from '@/app/api/forwarders/[id]/rules/route'
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'

jest.mock('@/lib/auth')
jest.mock('@/lib/prisma')
jest.mock('@/lib/notifications')

const mockAuth = auth as jest.MockedFunction<typeof auth>

describe('PUT /api/forwarders/[id]/rules/[ruleId]', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should create change request for rule update', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'user-1', name: 'Test User', role: 'SUPER_USER' }
    } as any)

    const existingRule = {
      id: 'rule-1',
      forwarderId: 'forwarder-1',
      fieldName: 'invoiceNumber',
      extractionType: 'REGEX',
      pattern: { expression: 'INV-(\\d+)' },
      priority: 50,
      confidence: 0.8,
      forwarder: { id: 'forwarder-1', name: 'Test Forwarder' }
    }

    ;(prisma.mappingRule.findUnique as jest.Mock).mockResolvedValue(existingRule)
    ;(prisma.ruleChangeRequest.findFirst as jest.Mock).mockResolvedValue(null)
    ;(prisma.ruleChangeRequest.create as jest.Mock).mockResolvedValue({
      id: 'cr-1',
      status: 'PENDING'
    })
    ;(prisma.auditLog.create as jest.Mock).mockResolvedValue({})

    const request = new NextRequest('http://localhost/api/forwarders/forwarder-1/rules/rule-1', {
      method: 'PUT',
      body: JSON.stringify({
        pattern: { expression: 'INV-(\\d{6})' },
        reason: 'Improve pattern accuracy'
      })
    })

    const response = await PUT(request, {
      params: { id: 'forwarder-1', ruleId: 'rule-1' }
    })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.data.status).toBe('PENDING')
  })

  it('should reject when pending change exists', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'user-1', role: 'SUPER_USER' }
    } as any)

    ;(prisma.mappingRule.findUnique as jest.Mock).mockResolvedValue({
      id: 'rule-1',
      forwarderId: 'forwarder-1'
    })
    ;(prisma.ruleChangeRequest.findFirst as jest.Mock).mockResolvedValue({
      id: 'existing-cr',
      status: 'PENDING'
    })

    const request = new NextRequest('http://localhost/api/forwarders/forwarder-1/rules/rule-1', {
      method: 'PUT',
      body: JSON.stringify({
        pattern: { expression: 'test' },
        reason: 'Test'
      })
    })

    const response = await PUT(request, {
      params: { id: 'forwarder-1', ruleId: 'rule-1' }
    })

    expect(response.status).toBe(409)
  })
})

describe('POST /api/forwarders/[id]/rules', () => {
  it('should create change request for new rule', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'user-1', name: 'Test User', role: 'SUPER_USER' }
    } as any)

    ;(prisma.forwarder.findUnique as jest.Mock).mockResolvedValue({
      id: 'forwarder-1',
      name: 'Test Forwarder'
    })
    ;(prisma.mappingRule.findFirst as jest.Mock).mockResolvedValue(null)
    ;(prisma.ruleChangeRequest.findFirst as jest.Mock).mockResolvedValue(null)
    ;(prisma.ruleChangeRequest.create as jest.Mock).mockResolvedValue({
      id: 'cr-1',
      status: 'PENDING'
    })
    ;(prisma.auditLog.create as jest.Mock).mockResolvedValue({})

    const request = new NextRequest('http://localhost/api/forwarders/forwarder-1/rules', {
      method: 'POST',
      body: JSON.stringify({
        fieldName: 'newField',
        extractionType: 'REGEX',
        pattern: { expression: 'test' },
        reason: 'Add new field extraction'
      })
    })

    const response = await POST(request, { params: { id: 'forwarder-1' } })
    const data = await response.json()

    expect(response.status).toBe(201)
    expect(data.success).toBe(true)
    expect(data.data.status).toBe('PENDING')
  })
})
```

### 7.2 Component Tests

**File**: `__tests__/components/rules/RuleEditForm.test.tsx`

```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { RuleEditForm } from '@/components/rules/RuleEditForm'

describe('RuleEditForm', () => {
  const mockRule = {
    id: 'rule-1',
    fieldName: 'invoiceNumber',
    extractionType: 'REGEX' as const,
    pattern: { expression: 'INV-(\\d+)', flags: 'gi' },
    priority: 50,
    confidence: 0.8
  }

  const mockOnSubmit = jest.fn()
  const mockOnCancel = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should render form with existing rule data', () => {
    render(
      <RuleEditForm
        rule={mockRule}
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
        isSubmitting={false}
      />
    )

    expect(screen.getByDisplayValue('invoiceNumber')).toBeInTheDocument()
    expect(screen.getByText('正則表達式')).toBeInTheDocument()
  })

  it('should require reason for submission', async () => {
    render(
      <RuleEditForm
        rule={mockRule}
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
        isSubmitting={false}
      />
    )

    fireEvent.click(screen.getByText('提交變更申請'))

    await waitFor(() => {
      expect(screen.getByText('請說明變更原因')).toBeInTheDocument()
    })

    expect(mockOnSubmit).not.toHaveBeenCalled()
  })

  it('should call onSubmit with form data', async () => {
    render(
      <RuleEditForm
        rule={mockRule}
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
        isSubmitting={false}
      />
    )

    fireEvent.change(screen.getByLabelText(/變更原因/), {
      target: { value: 'Improve accuracy' }
    })

    fireEvent.click(screen.getByText('提交變更申請'))

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          reason: 'Improve accuracy'
        })
      )
    })
  })

  it('should show new rule form when isNew is true', () => {
    render(
      <RuleEditForm
        forwarderId="forwarder-1"
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
        isSubmitting={false}
        isNew
      />
    )

    expect(screen.getByPlaceholderText('例如: invoiceNumber, totalAmount')).toBeEnabled()
    expect(screen.getByText('提交新增申請')).toBeInTheDocument()
  })
})
```

---

## 8. Implementation Checklist

### Phase 1: Database & Models
- [ ] Add RuleChangeRequest model to Prisma schema
- [ ] Add Notification model to Prisma schema
- [ ] Run database migrations
- [ ] Seed test data

### Phase 2: API Development
- [ ] Implement PUT /api/forwarders/[id]/rules/[ruleId]
- [ ] Implement POST /api/forwarders/[id]/rules
- [ ] Implement POST /api/rules/[ruleId]/preview
- [ ] Implement notification service
- [ ] Write API unit tests

### Phase 3: Pattern Editors
- [ ] Create RegexEditor component
- [ ] Create KeywordEditor component
- [ ] Create PositionEditor component
- [ ] Create AIPromptEditor component
- [ ] Create TableEditor component

### Phase 4: UI Components
- [ ] Create ForwarderRulesPage
- [ ] Create RuleEditForm component
- [ ] Create RulePreview component
- [ ] Integrate pattern editors

### Phase 5: Rule Executor
- [ ] Implement RuleExecutor service
- [ ] Add regex execution
- [ ] Add keyword execution
- [ ] Add position execution

### Phase 6: Testing & QA
- [ ] Write component tests
- [ ] Write E2E tests
- [ ] Accessibility testing
- [ ] Performance testing

---

## 9. Dependencies

### NPM Packages
```json
{
  "react-hook-form": "^7.48.0",
  "@hookform/resolvers": "^3.3.0",
  "zod": "^3.22.0"
}
```

### Related Stories
- Story 5.2: Forwarder 詳細配置查看（前置依賴）
- Story 4.6: 規則審核流程（前置依賴）
- Story 5.4: 測試規則變更效果

---

*Tech Spec created: 2025-12-16*
*Last updated: 2025-12-16*
