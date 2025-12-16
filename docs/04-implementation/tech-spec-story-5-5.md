# Tech Spec: Story 5-5 - 新增與停用 Forwarder Profile

## Story Reference
- **Story ID**: 5.5
- **Epic**: Epic 5 - Forwarder 配置管理
- **Story File**: `docs/04-implementation/stories/5-5-add-disable-forwarder-profile.md`
- **Status**: ready-for-dev
- **Dependencies**: Story 5.1 (Forwarder 列表), Story 5.2 (Forwarder 詳情)

---

## 1. Overview

### 1.1 Purpose
實現 Forwarder Profile 的完整生命週期管理，包括新增、編輯、停用和重新啟用功能，讓系統管理員能夠支援新的貨運代理商或停止不再使用的 Forwarder。

### 1.2 User Story
**As a** 系統管理員,
**I want** 新增或停用 Forwarder Profile,
**So that** 可以支援新的 Forwarder 或停止不再使用的 Forwarder。

### 1.3 Scope
- 新增 Forwarder 表單（含 Logo 上傳）
- 表單驗證（必填欄位、代碼唯一性）
- 停用 Forwarder（含自動停用相關規則）
- 重新啟用 Forwarder（含可選規則恢復）
- 操作日誌記錄

---

## 2. Technical Architecture

### 2.1 System Context

```
┌─────────────────────────────────────────────────────────────────┐
│                  Forwarder Lifecycle Management                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌────────────────────────────────────────────────────────┐    │
│  │                   Create Forwarder                      │    │
│  │                                                         │    │
│  │  [Form] ──▶ [Validate] ──▶ [Upload Logo] ──▶ [Create]  │    │
│  │                                         │               │    │
│  │                                         ▼               │    │
│  │                              [Azure Blob Storage]       │    │
│  │                                                         │    │
│  │  Initial Status: PENDING                                │    │
│  └────────────────────────────────────────────────────────┘    │
│                                                                 │
│  ┌────────────────────────────────────────────────────────┐    │
│  │                 Forwarder Status Flow                   │    │
│  │                                                         │    │
│  │  [PENDING] ──configure──▶ [ACTIVE] ◀──activate──┐      │    │
│  │                              │                   │      │    │
│  │                          deactivate              │      │    │
│  │                              ▼                   │      │    │
│  │                         [INACTIVE] ─────────────┘      │    │
│  └────────────────────────────────────────────────────────┘    │
│                                                                 │
│  ┌────────────────────────────────────────────────────────┐    │
│  │                 Deactivate Side Effects                 │    │
│  │                                                         │    │
│  │  1. Update Forwarder status to INACTIVE                 │    │
│  │  2. Deprecate all ACTIVE rules (optional)               │    │
│  │  3. Create audit log entry                              │    │
│  │  4. Send notification (optional)                        │    │
│  └────────────────────────────────────────────────────────┘    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 API Architecture

```
POST   /api/forwarders                       → 創建 Forwarder
PUT    /api/forwarders/[id]                  → 更新 Forwarder 基本資訊
PATCH  /api/forwarders/[id]/deactivate       → 停用 Forwarder
PATCH  /api/forwarders/[id]/activate         → 啟用 Forwarder
GET    /api/forwarders/check-code            → 檢查代碼唯一性
POST   /api/upload/logo                      → 上傳 Logo 圖片
```

### 2.3 Component Architecture

```
NewForwarderPage (Client Component)
├── Breadcrumb
├── PageHeader
└── ForwarderForm
    ├── LogoUploader
    │   ├── DropZone
    │   ├── ImagePreview
    │   └── CropDialog (optional)
    ├── BasicInfoFields
    │   ├── NameInput
    │   ├── CodeInput (with async validation)
    │   ├── DescriptionTextarea
    │   └── ContactEmailInput
    ├── ConfidenceSlider
    └── SubmitButton

ForwarderActions (in Detail Page)
├── EditButton
├── DeactivateButton (when ACTIVE)
│   └── DeactivateDialog
│       ├── WarningMessage
│       ├── ReasonInput
│       └── ConfirmButton
└── ActivateButton (when INACTIVE)
    └── ActivateDialog
        ├── RuleReactivationOptions
        └── ConfirmButton
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
  status           ForwarderStatus @default(PENDING)
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
  changeRequests   RuleChangeRequest[]
  testTasks        RuleTestTask[]

  @@map("forwarders")
}

enum ForwarderStatus {
  ACTIVE    // 啟用中 - 可處理文件
  INACTIVE  // 已停用 - 暫停所有處理
  PENDING   // 待設定 - 新建立，尚未配置規則
}
```

### 3.2 AuditLog Model

```prisma
model AuditLog {
  id           String   @id @default(uuid())
  userId       String   @map("user_id")
  action       String
  entityType   String   @map("entity_type")
  entityId     String   @map("entity_id")
  details      Json?
  ipAddress    String?  @map("ip_address")
  userAgent    String?  @map("user_agent")
  createdAt    DateTime @default(now()) @map("created_at")

  // Relations
  user         User     @relation(fields: [userId], references: [id])

  @@index([entityType, entityId])
  @@index([userId])
  @@index([action])
  @@index([createdAt])
  @@map("audit_logs")
}
```

---

## 4. API Implementation

### 4.1 POST /api/forwarders

**Purpose**: 創建新的 Forwarder Profile

**File**: `src/app/api/forwarders/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { hasPermission, PERMISSIONS } from '@/lib/permissions'
import { prisma } from '@/lib/prisma'
import { ForwarderStatus } from '@prisma/client'
import { uploadToBlob } from '@/lib/azure-blob'

// Request Schema
const createForwarderSchema = z.object({
  name: z.string()
    .min(1, '名稱為必填')
    .max(100, '名稱最多 100 個字符'),
  code: z.string()
    .min(2, '代碼至少 2 個字符')
    .max(20, '代碼最多 20 個字符')
    .regex(/^[A-Z0-9_]+$/, '代碼只能包含大寫字母、數字和底線')
    .transform(v => v.toUpperCase()),
  description: z.string().max(500).optional().nullable(),
  contactEmail: z.string().email('請輸入有效的電子郵件').optional().nullable(),
  defaultConfidence: z.number().min(0).max(1).default(0.8)
})

export async function POST(request: NextRequest) {
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

    if (!hasPermission(session, PERMISSIONS.FORWARDER_MANAGE)) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/forbidden',
          title: 'Forbidden',
          status: 403,
          detail: '您沒有創建 Forwarder 的權限'
        },
        { status: 403 }
      )
    }

    // 2. Parse form data
    const formData = await request.formData()
    const bodyData = {
      name: formData.get('name') as string,
      code: (formData.get('code') as string)?.toUpperCase(),
      description: formData.get('description') as string | null,
      contactEmail: formData.get('contactEmail') as string | null,
      defaultConfidence: parseFloat(formData.get('defaultConfidence') as string) || 0.8
    }
    const logoFile = formData.get('logo') as File | null

    // 3. Validate request
    const parseResult = createForwarderSchema.safeParse(bodyData)
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

    const { name, code, description, contactEmail, defaultConfidence } = parseResult.data

    // 4. Check name uniqueness
    const existingByName = await prisma.forwarder.findUnique({
      where: { name }
    })

    if (existingByName) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/conflict',
          title: 'Conflict',
          status: 409,
          detail: '此名稱已被使用'
        },
        { status: 409 }
      )
    }

    // 5. Check code uniqueness
    const existingByCode = await prisma.forwarder.findUnique({
      where: { code }
    })

    if (existingByCode) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/conflict',
          title: 'Conflict',
          status: 409,
          detail: '此代碼已被使用'
        },
        { status: 409 }
      )
    }

    // 6. Upload logo if provided
    let logoUrl: string | null = null
    if (logoFile && logoFile.size > 0) {
      try {
        logoUrl = await uploadToBlob(logoFile, `forwarders/${code}/logo`)
      } catch (error) {
        console.error('Error uploading logo:', error)
        return NextResponse.json(
          {
            type: 'https://api.example.com/errors/internal',
            title: 'Upload Error',
            status: 500,
            detail: 'Logo 上傳失敗，請稍後再試'
          },
          { status: 500 }
        )
      }
    }

    // 7. Create Forwarder
    const forwarder = await prisma.forwarder.create({
      data: {
        name,
        code,
        description,
        contactEmail,
        defaultConfidence,
        logoUrl,
        status: ForwarderStatus.PENDING,
        createdById: session.user.id
      }
    })

    // 8. Create audit log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'FORWARDER_CREATED',
        entityType: 'Forwarder',
        entityId: forwarder.id,
        details: {
          name: forwarder.name,
          code: forwarder.code
        }
      }
    })

    // 9. Return response
    return NextResponse.json({
      success: true,
      data: {
        id: forwarder.id,
        name: forwarder.name,
        code: forwarder.code,
        status: forwarder.status,
        message: 'Forwarder 創建成功'
      }
    }, { status: 201 })
  } catch (error) {
    console.error('Error creating forwarder:', error)
    return NextResponse.json(
      {
        type: 'https://api.example.com/errors/internal',
        title: 'Internal Server Error',
        status: 500,
        detail: '創建 Forwarder 時發生錯誤'
      },
      { status: 500 }
    )
  }
}
```

### 4.2 PUT /api/forwarders/[id]

**Purpose**: 更新 Forwarder 基本資訊

**File**: `src/app/api/forwarders/[id]/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { hasPermission, PERMISSIONS } from '@/lib/permissions'
import { prisma } from '@/lib/prisma'
import { uploadToBlob, deleteFromBlob } from '@/lib/azure-blob'

// Update Schema
const updateForwarderSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional().nullable(),
  contactEmail: z.string().email().optional().nullable(),
  defaultConfidence: z.number().min(0).max(1).optional()
})

export async function PUT(
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

    if (!hasPermission(session, PERMISSIONS.FORWARDER_MANAGE)) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/forbidden',
          title: 'Forbidden',
          status: 403,
          detail: '您沒有編輯 Forwarder 的權限'
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

    // 3. Check forwarder exists
    const existingForwarder = await prisma.forwarder.findUnique({
      where: { id: params.id }
    })

    if (!existingForwarder) {
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

    // 4. Parse form data
    const formData = await request.formData()
    const bodyData: Record<string, any> = {}

    if (formData.has('name')) bodyData.name = formData.get('name')
    if (formData.has('description')) bodyData.description = formData.get('description')
    if (formData.has('contactEmail')) bodyData.contactEmail = formData.get('contactEmail')
    if (formData.has('defaultConfidence')) {
      bodyData.defaultConfidence = parseFloat(formData.get('defaultConfidence') as string)
    }

    const logoFile = formData.get('logo') as File | null
    const removeLogo = formData.get('removeLogo') === 'true'

    // 5. Validate request
    const parseResult = updateForwarderSchema.safeParse(bodyData)
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

    const updateData = parseResult.data

    // 6. Check name uniqueness if changed
    if (updateData.name && updateData.name !== existingForwarder.name) {
      const existingByName = await prisma.forwarder.findFirst({
        where: {
          name: updateData.name,
          id: { not: params.id }
        }
      })

      if (existingByName) {
        return NextResponse.json(
          {
            type: 'https://api.example.com/errors/conflict',
            title: 'Conflict',
            status: 409,
            detail: '此名稱已被使用'
          },
          { status: 409 }
        )
      }
    }

    // 7. Handle logo update
    let logoUrl = existingForwarder.logoUrl

    if (removeLogo && logoUrl) {
      // Delete existing logo
      await deleteFromBlob(logoUrl)
      logoUrl = null
    } else if (logoFile && logoFile.size > 0) {
      // Delete old logo if exists
      if (existingForwarder.logoUrl) {
        await deleteFromBlob(existingForwarder.logoUrl)
      }
      // Upload new logo
      logoUrl = await uploadToBlob(logoFile, `forwarders/${existingForwarder.code}/logo`)
    }

    // 8. Update Forwarder
    const forwarder = await prisma.forwarder.update({
      where: { id: params.id },
      data: {
        ...updateData,
        logoUrl
      }
    })

    // 9. Create audit log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'FORWARDER_UPDATED',
        entityType: 'Forwarder',
        entityId: forwarder.id,
        details: {
          changes: Object.keys(updateData),
          logoUpdated: !!logoFile || removeLogo
        }
      }
    })

    // 10. Return response
    return NextResponse.json({
      success: true,
      data: {
        id: forwarder.id,
        name: forwarder.name,
        code: forwarder.code,
        description: forwarder.description,
        logoUrl: forwarder.logoUrl,
        contactEmail: forwarder.contactEmail,
        defaultConfidence: forwarder.defaultConfidence,
        status: forwarder.status,
        message: 'Forwarder 更新成功'
      }
    })
  } catch (error) {
    console.error('Error updating forwarder:', error)
    return NextResponse.json(
      {
        type: 'https://api.example.com/errors/internal',
        title: 'Internal Server Error',
        status: 500,
        detail: '更新 Forwarder 時發生錯誤'
      },
      { status: 500 }
    )
  }
}
```

### 4.3 PATCH /api/forwarders/[id]/deactivate

**Purpose**: 停用 Forwarder

**File**: `src/app/api/forwarders/[id]/deactivate/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { hasPermission, PERMISSIONS } from '@/lib/permissions'
import { prisma } from '@/lib/prisma'
import { ForwarderStatus, RuleStatus } from '@prisma/client'

// Request Schema
const deactivateSchema = z.object({
  reason: z.string().max(500).optional(),
  deactivateRules: z.boolean().default(true)
})

export async function PATCH(
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

    if (!hasPermission(session, PERMISSIONS.FORWARDER_MANAGE)) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/forbidden',
          title: 'Forbidden',
          status: 403,
          detail: '您沒有停用 Forwarder 的權限'
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

    // 3. Parse request body
    const body = await request.json()
    const parseResult = deactivateSchema.safeParse(body)

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

    const { reason, deactivateRules } = parseResult.data

    // 4. Check forwarder exists and is not already inactive
    const existingForwarder = await prisma.forwarder.findUnique({
      where: { id: params.id }
    })

    if (!existingForwarder) {
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

    if (existingForwarder.status === ForwarderStatus.INACTIVE) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/bad-request',
          title: 'Bad Request',
          status: 400,
          detail: '此 Forwarder 已經是停用狀態'
        },
        { status: 400 }
      )
    }

    // 5. Execute deactivation in transaction
    const result = await prisma.$transaction(async (tx) => {
      // Update Forwarder status
      const forwarder = await tx.forwarder.update({
        where: { id: params.id },
        data: { status: ForwarderStatus.INACTIVE }
      })

      let deactivatedRulesCount = 0

      // Deactivate related rules if requested
      if (deactivateRules) {
        const updateResult = await tx.mappingRule.updateMany({
          where: {
            forwarderId: params.id,
            status: RuleStatus.ACTIVE
          },
          data: { status: RuleStatus.DEPRECATED }
        })
        deactivatedRulesCount = updateResult.count
      }

      // Create audit log
      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: 'FORWARDER_DEACTIVATED',
          entityType: 'Forwarder',
          entityId: params.id,
          details: {
            name: forwarder.name,
            code: forwarder.code,
            reason,
            deactivatedRules: deactivatedRulesCount
          }
        }
      })

      return { forwarder, deactivatedRulesCount }
    })

    // 6. Return response
    return NextResponse.json({
      success: true,
      data: {
        id: params.id,
        name: result.forwarder.name,
        status: ForwarderStatus.INACTIVE,
        deactivatedRules: result.deactivatedRulesCount,
        message: `Forwarder 已停用${result.deactivatedRulesCount > 0 ? `，同時停用了 ${result.deactivatedRulesCount} 條規則` : ''}`
      }
    })
  } catch (error) {
    console.error('Error deactivating forwarder:', error)
    return NextResponse.json(
      {
        type: 'https://api.example.com/errors/internal',
        title: 'Internal Server Error',
        status: 500,
        detail: '停用 Forwarder 時發生錯誤'
      },
      { status: 500 }
    )
  }
}
```

### 4.4 PATCH /api/forwarders/[id]/activate

**Purpose**: 啟用 Forwarder

**File**: `src/app/api/forwarders/[id]/activate/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { hasPermission, PERMISSIONS } from '@/lib/permissions'
import { prisma } from '@/lib/prisma'
import { ForwarderStatus, RuleStatus } from '@prisma/client'

// Request Schema
const activateSchema = z.object({
  reactivateRules: z.boolean().default(false),
  ruleIds: z.array(z.string().uuid()).optional()
})

export async function PATCH(
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

    if (!hasPermission(session, PERMISSIONS.FORWARDER_MANAGE)) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/forbidden',
          title: 'Forbidden',
          status: 403,
          detail: '您沒有啟用 Forwarder 的權限'
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

    // 3. Parse request body
    const body = await request.json()
    const parseResult = activateSchema.safeParse(body)

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

    const { reactivateRules, ruleIds } = parseResult.data

    // 4. Check forwarder exists and is inactive
    const existingForwarder = await prisma.forwarder.findUnique({
      where: { id: params.id }
    })

    if (!existingForwarder) {
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

    if (existingForwarder.status === ForwarderStatus.ACTIVE) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/bad-request',
          title: 'Bad Request',
          status: 400,
          detail: '此 Forwarder 已經是啟用狀態'
        },
        { status: 400 }
      )
    }

    // 5. Execute activation in transaction
    const result = await prisma.$transaction(async (tx) => {
      // Update Forwarder status
      const forwarder = await tx.forwarder.update({
        where: { id: params.id },
        data: { status: ForwarderStatus.ACTIVE }
      })

      let reactivatedRulesCount = 0

      // Reactivate rules if requested
      if (reactivateRules) {
        const whereClause = {
          forwarderId: params.id,
          status: RuleStatus.DEPRECATED,
          ...(ruleIds && ruleIds.length > 0 ? { id: { in: ruleIds } } : {})
        }

        const updateResult = await tx.mappingRule.updateMany({
          where: whereClause,
          data: { status: RuleStatus.ACTIVE }
        })
        reactivatedRulesCount = updateResult.count
      }

      // Create audit log
      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: 'FORWARDER_ACTIVATED',
          entityType: 'Forwarder',
          entityId: params.id,
          details: {
            name: forwarder.name,
            code: forwarder.code,
            reactivatedRules: reactivatedRulesCount,
            specificRuleIds: ruleIds
          }
        }
      })

      return { forwarder, reactivatedRulesCount }
    })

    // 6. Return response
    return NextResponse.json({
      success: true,
      data: {
        id: params.id,
        name: result.forwarder.name,
        status: ForwarderStatus.ACTIVE,
        reactivatedRules: result.reactivatedRulesCount,
        message: `Forwarder 已啟用${result.reactivatedRulesCount > 0 ? `，同時恢復了 ${result.reactivatedRulesCount} 條規則` : ''}`
      }
    })
  } catch (error) {
    console.error('Error activating forwarder:', error)
    return NextResponse.json(
      {
        type: 'https://api.example.com/errors/internal',
        title: 'Internal Server Error',
        status: 500,
        detail: '啟用 Forwarder 時發生錯誤'
      },
      { status: 500 }
    )
  }
}
```

### 4.5 GET /api/forwarders/check-code

**Purpose**: 檢查代碼唯一性（用於表單即時驗證）

**File**: `src/app/api/forwarders/check-code/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    // 1. Authentication
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json(
        { available: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // 2. Get code from query
    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')?.toUpperCase()
    const excludeId = searchParams.get('excludeId')

    if (!code) {
      return NextResponse.json(
        { available: false, error: 'Code is required' },
        { status: 400 }
      )
    }

    // 3. Validate code format
    const codeSchema = z.string().regex(/^[A-Z0-9_]+$/)
    if (!codeSchema.safeParse(code).success) {
      return NextResponse.json({
        available: false,
        error: '代碼只能包含大寫字母、數字和底線'
      })
    }

    // 4. Check if code exists
    const existing = await prisma.forwarder.findFirst({
      where: {
        code,
        ...(excludeId ? { id: { not: excludeId } } : {})
      }
    })

    return NextResponse.json({
      available: !existing
    })
  } catch (error) {
    console.error('Error checking code:', error)
    return NextResponse.json(
      { available: false, error: 'Internal error' },
      { status: 500 }
    )
  }
}
```

---

## 5. Azure Blob Storage Service

**File**: `src/lib/azure-blob.ts`

```typescript
import { BlobServiceClient, ContainerClient } from '@azure/storage-blob'
import { v4 as uuidv4 } from 'uuid'

// Initialize Blob Service Client
const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING!
const containerName = process.env.AZURE_STORAGE_CONTAINER_NAME || 'uploads'

let containerClient: ContainerClient | null = null

async function getContainerClient(): Promise<ContainerClient> {
  if (!containerClient) {
    const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString)
    containerClient = blobServiceClient.getContainerClient(containerName)

    // Create container if not exists
    await containerClient.createIfNotExists({
      access: 'blob' // Public read access for blobs
    })
  }
  return containerClient
}

/**
 * Upload file to Azure Blob Storage
 * @param file - File to upload
 * @param path - Path prefix (e.g., 'forwarders/DHL/logo')
 * @returns URL of the uploaded file
 */
export async function uploadToBlob(file: File, path: string): Promise<string> {
  const container = await getContainerClient()

  // Generate unique blob name
  const extension = file.name.split('.').pop() || 'png'
  const blobName = `${path}/${uuidv4()}.${extension}`

  // Get blob client
  const blockBlobClient = container.getBlockBlobClient(blobName)

  // Convert file to buffer
  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  // Upload with content type
  await blockBlobClient.uploadData(buffer, {
    blobHTTPHeaders: {
      blobContentType: file.type || 'image/png'
    }
  })

  return blockBlobClient.url
}

/**
 * Delete file from Azure Blob Storage
 * @param url - Full URL of the blob to delete
 */
export async function deleteFromBlob(url: string): Promise<void> {
  try {
    const container = await getContainerClient()

    // Extract blob name from URL
    const urlObj = new URL(url)
    const blobName = urlObj.pathname.split('/').slice(2).join('/')

    const blockBlobClient = container.getBlockBlobClient(blobName)
    await blockBlobClient.deleteIfExists()
  } catch (error) {
    console.error('Error deleting blob:', error)
    // Don't throw - deletion failure shouldn't fail the operation
  }
}

/**
 * Generate SAS URL for temporary access
 * @param blobName - Name of the blob
 * @param expiresInMinutes - Expiration time in minutes
 * @returns SAS URL
 */
export async function generateSasUrl(
  blobName: string,
  expiresInMinutes: number = 60
): Promise<string> {
  const container = await getContainerClient()
  const blockBlobClient = container.getBlockBlobClient(blobName)

  const expiresOn = new Date()
  expiresOn.setMinutes(expiresOn.getMinutes() + expiresInMinutes)

  const sasUrl = await blockBlobClient.generateSasUrl({
    permissions: { read: true } as any,
    expiresOn
  })

  return sasUrl
}
```

---

## 6. Frontend Components

### 6.1 NewForwarderPage

**File**: `src/app/(dashboard)/forwarders/new/page.tsx`

```typescript
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { hasPermission, PERMISSIONS } from '@/lib/permissions'
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb'
import { ForwarderForm } from '@/components/forwarders/ForwarderForm'

export default async function NewForwarderPage() {
  // Check authentication and permission
  const session = await auth()

  if (!session?.user?.id) {
    redirect('/login')
  }

  if (!hasPermission(session, PERMISSIONS.FORWARDER_MANAGE)) {
    redirect('/unauthorized')
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Breadcrumb */}
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/forwarders">Forwarders</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>新增</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">新增 Forwarder</h1>
        <p className="text-muted-foreground">
          創建新的貨運代理商配置
        </p>
      </div>

      {/* Form */}
      <ForwarderForm />
    </div>
  )
}
```

### 6.2 ForwarderForm Component

**File**: `src/components/forwarders/ForwarderForm.tsx`

```typescript
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useMutation } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Slider } from '@/components/ui/slider'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { LogoUploader } from './LogoUploader'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { useDebouncedCallback } from 'use-debounce'

// Form Schema
const formSchema = z.object({
  name: z.string()
    .min(1, '名稱為必填')
    .max(100, '名稱最多 100 個字符'),
  code: z.string()
    .min(2, '代碼至少 2 個字符')
    .max(20, '代碼最多 20 個字符')
    .regex(/^[A-Z0-9_]+$/i, '代碼只能包含字母、數字和底線'),
  description: z.string().max(500).optional(),
  contactEmail: z.string().email('請輸入有效的電子郵件').optional().or(z.literal('')),
  defaultConfidence: z.number().min(0).max(1),
  logo: z.any().optional()
})

type FormValues = z.infer<typeof formSchema>

interface ForwarderFormProps {
  forwarder?: {
    id: string
    name: string
    code: string
    description: string | null
    logoUrl: string | null
    contactEmail: string | null
    defaultConfidence: number
  }
  onSuccess?: () => void
}

export function ForwarderForm({ forwarder, onSuccess }: ForwarderFormProps) {
  const router = useRouter()
  const [codeAvailable, setCodeAvailable] = useState<boolean | null>(null)
  const [checkingCode, setCheckingCode] = useState(false)
  const isEdit = !!forwarder

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: forwarder?.name ?? '',
      code: forwarder?.code ?? '',
      description: forwarder?.description ?? '',
      contactEmail: forwarder?.contactEmail ?? '',
      defaultConfidence: forwarder?.defaultConfidence ?? 0.8
    }
  })

  // Debounced code check
  const checkCodeAvailability = useDebouncedCallback(async (code: string) => {
    if (code.length < 2) {
      setCodeAvailable(null)
      return
    }

    setCheckingCode(true)
    try {
      const params = new URLSearchParams({ code: code.toUpperCase() })
      if (forwarder?.id) {
        params.set('excludeId', forwarder.id)
      }

      const response = await fetch(`/api/forwarders/check-code?${params}`)
      const data = await response.json()
      setCodeAvailable(data.available)
    } catch {
      setCodeAvailable(null)
    } finally {
      setCheckingCode(false)
    }
  }, 500)

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const formData = new FormData()
      formData.append('name', values.name)
      formData.append('code', values.code.toUpperCase())
      if (values.description) formData.append('description', values.description)
      if (values.contactEmail) formData.append('contactEmail', values.contactEmail)
      formData.append('defaultConfidence', values.defaultConfidence.toString())
      if (values.logo instanceof File) formData.append('logo', values.logo)

      const url = isEdit ? `/api/forwarders/${forwarder.id}` : '/api/forwarders'
      const method = isEdit ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        body: formData
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.detail || 'Failed to save forwarder')
      }

      return response.json()
    },
    onSuccess: (data) => {
      toast.success(isEdit ? 'Forwarder 更新成功' : 'Forwarder 創建成功')
      if (onSuccess) {
        onSuccess()
      } else {
        router.push(`/forwarders/${data.data.id}`)
      }
    },
    onError: (error: Error) => {
      toast.error(error.message)
    }
  })

  const onSubmit = (values: FormValues) => {
    createMutation.mutate(values)
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Logo */}
            <FormField
              control={form.control}
              name="logo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Logo</FormLabel>
                  <FormControl>
                    <LogoUploader
                      value={field.value}
                      existingUrl={forwarder?.logoUrl}
                      onChange={field.onChange}
                    />
                  </FormControl>
                  <FormDescription>
                    建議尺寸 200x200 像素，支援 PNG、JPG 格式
                  </FormDescription>
                </FormItem>
              )}
            />

            {/* Name & Code */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>名稱 *</FormLabel>
                    <FormControl>
                      <Input placeholder="例如：DHL Express" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>代碼 *</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          placeholder="例如：DHL"
                          {...field}
                          disabled={isEdit}
                          onChange={(e) => {
                            const value = e.target.value.toUpperCase()
                            field.onChange(value)
                            if (!isEdit) {
                              checkCodeAvailability(value)
                            }
                          }}
                        />
                        {!isEdit && (
                          <div className="absolute right-3 top-1/2 -translate-y-1/2">
                            {checkingCode && (
                              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                            )}
                            {!checkingCode && codeAvailable === true && (
                              <span className="text-green-600 text-sm">可用</span>
                            )}
                            {!checkingCode && codeAvailable === false && (
                              <span className="text-red-600 text-sm">已存在</span>
                            )}
                          </div>
                        )}
                      </div>
                    </FormControl>
                    <FormDescription>
                      唯一識別碼，只能包含大寫字母、數字和底線
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Description */}
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>描述</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="關於此 Forwarder 的備註說明..."
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Contact Email */}
            <FormField
              control={form.control}
              name="contactEmail"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>聯絡郵箱</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="contact@forwarder.com"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Default Confidence */}
            <FormField
              control={form.control}
              name="defaultConfidence"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center justify-between">
                    <FormLabel>預設信心度閾值</FormLabel>
                    <span className="text-sm font-medium">
                      {(field.value * 100).toFixed(0)}%
                    </span>
                  </div>
                  <FormControl>
                    <Slider
                      min={0}
                      max={1}
                      step={0.05}
                      value={[field.value]}
                      onValueChange={([value]) => field.onChange(value)}
                    />
                  </FormControl>
                  <FormDescription>
                    低於此閾值的提取結果將需要人工審核
                  </FormDescription>
                </FormItem>
              )}
            />

            {/* Actions */}
            <div className="flex justify-end gap-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
              >
                取消
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending || (!isEdit && codeAvailable === false)}
              >
                {createMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {isEdit ? '更新 Forwarder' : '創建 Forwarder'}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}
```

### 6.3 LogoUploader Component

**File**: `src/components/forwarders/LogoUploader.tsx`

```typescript
'use client'

import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { Button } from '@/components/ui/button'
import { Upload, X, Image as ImageIcon } from 'lucide-react'
import Image from 'next/image'

interface LogoUploaderProps {
  value?: File | null
  existingUrl?: string | null
  onChange: (file: File | null) => void
}

export function LogoUploader({ value, existingUrl, onChange }: LogoUploaderProps) {
  const [preview, setPreview] = useState<string | null>(null)
  const [removed, setRemoved] = useState(false)

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0]
    if (file) {
      onChange(file)
      setPreview(URL.createObjectURL(file))
      setRemoved(false)
    }
  }, [onChange])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/png': ['.png'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/webp': ['.webp']
    },
    maxSize: 5 * 1024 * 1024, // 5MB
    maxFiles: 1
  })

  const handleRemove = () => {
    onChange(null)
    setPreview(null)
    setRemoved(true)
  }

  // Determine what to display
  const displayUrl = preview || (!removed && existingUrl) || null

  return (
    <div className="space-y-4">
      {displayUrl ? (
        <div className="relative inline-block">
          <div className="relative h-32 w-32 rounded-lg border overflow-hidden">
            <Image
              src={displayUrl}
              alt="Logo preview"
              fill
              className="object-contain"
            />
          </div>
          <Button
            type="button"
            variant="destructive"
            size="icon"
            className="absolute -top-2 -right-2 h-6 w-6"
            onClick={handleRemove}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <div
          {...getRootProps()}
          className={`
            border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
            transition-colors
            ${isDragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'}
          `}
        >
          <input {...getInputProps()} />
          <div className="flex flex-col items-center gap-2">
            <div className="p-3 rounded-full bg-muted">
              {isDragActive ? (
                <Upload className="h-6 w-6 text-primary" />
              ) : (
                <ImageIcon className="h-6 w-6 text-muted-foreground" />
              )}
            </div>
            {isDragActive ? (
              <p className="text-sm text-primary">放開以上傳圖片</p>
            ) : (
              <>
                <p className="text-sm font-medium">拖放圖片或點擊選擇</p>
                <p className="text-xs text-muted-foreground">
                  支援 PNG、JPG、WebP，最大 5MB
                </p>
              </>
            )}
          </div>
        </div>
      )}

      {/* Change button when logo exists */}
      {displayUrl && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          {...getRootProps()}
        >
          <input {...getInputProps()} />
          <Upload className="mr-2 h-4 w-4" />
          更換圖片
        </Button>
      )}
    </div>
  )
}
```

### 6.4 Enhanced ForwarderActions Component

**File**: `src/components/forwarders/ForwarderActions.tsx` (完整版)

```typescript
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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
import { MoreHorizontal, Edit, Power, PowerOff, FileCode, Settings } from 'lucide-react'
import { Forwarder, ForwarderStatus } from '@prisma/client'
import { toast } from 'sonner'

interface ForwarderActionsProps {
  forwarder: Forwarder & {
    _count?: {
      mappingRules: number
    }
  }
}

export function ForwarderActions({ forwarder }: ForwarderActionsProps) {
  const router = useRouter()
  const queryClient = useQueryClient()

  // Dialog states
  const [showDeactivateDialog, setShowDeactivateDialog] = useState(false)
  const [showActivateDialog, setShowActivateDialog] = useState(false)

  // Form states
  const [deactivateReason, setDeactivateReason] = useState('')
  const [deactivateRules, setDeactivateRules] = useState(true)
  const [reactivateRules, setReactivateRules] = useState(false)

  // Get rules count for inactive forwarder
  const { data: rulesData } = useQuery({
    queryKey: ['forwarder-rules-count', forwarder.id],
    queryFn: async () => {
      const response = await fetch(`/api/forwarders/${forwarder.id}/rules?pageSize=1`)
      return response.json()
    },
    enabled: forwarder.status === ForwarderStatus.INACTIVE
  })

  const deprecatedRulesCount = rulesData?.data?.summary?.deprecated ?? 0

  // Deactivate mutation
  const deactivateMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/forwarders/${forwarder.id}/deactivate`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason: deactivateReason || undefined,
          deactivateRules
        })
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.detail || 'Failed to deactivate')
      }
      return response.json()
    },
    onSuccess: (data) => {
      toast.success(data.data.message)
      queryClient.invalidateQueries({ queryKey: ['forwarder', forwarder.id] })
      queryClient.invalidateQueries({ queryKey: ['forwarders'] })
      setShowDeactivateDialog(false)
      setDeactivateReason('')
      router.refresh()
    },
    onError: (error: Error) => {
      toast.error(error.message)
    }
  })

  // Activate mutation
  const activateMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/forwarders/${forwarder.id}/activate`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reactivateRules
        })
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.detail || 'Failed to activate')
      }
      return response.json()
    },
    onSuccess: (data) => {
      toast.success(data.data.message)
      queryClient.invalidateQueries({ queryKey: ['forwarder', forwarder.id] })
      queryClient.invalidateQueries({ queryKey: ['forwarders'] })
      setShowActivateDialog(false)
      setReactivateRules(false)
      router.refresh()
    },
    onError: (error: Error) => {
      toast.error(error.message)
    }
  })

  const isActive = forwarder.status === ForwarderStatus.ACTIVE
  const isPending = forwarder.status === ForwarderStatus.PENDING

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem asChild>
            <Link href={`/forwarders/${forwarder.id}/edit`}>
              <Edit className="mr-2 h-4 w-4" />
              編輯資訊
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href={`/forwarders/${forwarder.id}/rules`}>
              <FileCode className="mr-2 h-4 w-4" />
              管理規則
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href={`/forwarders/${forwarder.id}/settings`}>
              <Settings className="mr-2 h-4 w-4" />
              進階設定
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {isActive || isPending ? (
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

      {/* Deactivate Dialog */}
      <AlertDialog open={showDeactivateDialog} onOpenChange={setShowDeactivateDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>確認停用 {forwarder.name}？</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                停用後，此 Forwarder 將無法處理新的發票。
                {forwarder._count?.mappingRules && forwarder._count.mappingRules > 0 && (
                  <span className="text-destructive">
                    此 Forwarder 目前有 {forwarder._count.mappingRules} 條映射規則。
                  </span>
                )}
              </p>
              <p>歷史數據將保留，可隨時重新啟用。</p>
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-4 py-4">
            {/* Reason Input */}
            <div className="space-y-2">
              <Label htmlFor="reason">停用原因（可選）</Label>
              <Textarea
                id="reason"
                value={deactivateReason}
                onChange={(e) => setDeactivateReason(e.target.value)}
                placeholder="請說明停用原因..."
                rows={2}
              />
            </div>

            {/* Deactivate Rules Option */}
            {forwarder._count?.mappingRules && forwarder._count.mappingRules > 0 && (
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="deactivateRules"
                  checked={deactivateRules}
                  onCheckedChange={(checked) => setDeactivateRules(!!checked)}
                />
                <Label htmlFor="deactivateRules" className="text-sm">
                  同時停用所有映射規則
                </Label>
              </div>
            )}
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={deactivateMutation.isPending}>
              取消
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deactivateMutation.mutate()}
              disabled={deactivateMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deactivateMutation.isPending ? '停用中...' : '確認停用'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Activate Dialog */}
      <AlertDialog open={showActivateDialog} onOpenChange={setShowActivateDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>確認啟用 {forwarder.name}？</AlertDialogTitle>
            <AlertDialogDescription>
              啟用後，此 Forwarder 將可以接收新的發票進行處理。
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-4 py-4">
            {/* Reactivate Rules Option */}
            {deprecatedRulesCount > 0 && (
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="reactivateRules"
                  checked={reactivateRules}
                  onCheckedChange={(checked) => setReactivateRules(!!checked)}
                />
                <Label htmlFor="reactivateRules" className="text-sm">
                  同時恢復 {deprecatedRulesCount} 條已停用的規則
                </Label>
              </div>
            )}
            {deprecatedRulesCount === 0 && (
              <p className="text-sm text-muted-foreground">
                您可以在啟用後手動設定映射規則。
              </p>
            )}
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={activateMutation.isPending}>
              取消
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => activateMutation.mutate()}
              disabled={activateMutation.isPending}
            >
              {activateMutation.isPending ? '啟用中...' : '確認啟用'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
```

---

## 7. Test Specifications

### 7.1 API Tests

**File**: `__tests__/api/forwarders/route.test.ts`

```typescript
import { POST } from '@/app/api/forwarders/route'
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'

jest.mock('@/lib/auth')
jest.mock('@/lib/prisma')
jest.mock('@/lib/azure-blob')

const mockAuth = auth as jest.MockedFunction<typeof auth>

describe('POST /api/forwarders', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should create a new forwarder', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'user-1', role: 'ADMIN' }
    } as any)

    ;(prisma.forwarder.findUnique as jest.Mock)
      .mockResolvedValueOnce(null) // name check
      .mockResolvedValueOnce(null) // code check

    ;(prisma.forwarder.create as jest.Mock).mockResolvedValue({
      id: 'new-id',
      name: 'Test Forwarder',
      code: 'TEST',
      status: 'PENDING'
    })

    ;(prisma.auditLog.create as jest.Mock).mockResolvedValue({})

    const formData = new FormData()
    formData.append('name', 'Test Forwarder')
    formData.append('code', 'TEST')
    formData.append('defaultConfidence', '0.8')

    const request = new NextRequest('http://localhost/api/forwarders', {
      method: 'POST',
      body: formData
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(201)
    expect(data.success).toBe(true)
    expect(data.data.code).toBe('TEST')
    expect(data.data.status).toBe('PENDING')
  })

  it('should reject duplicate code', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'user-1', role: 'ADMIN' }
    } as any)

    ;(prisma.forwarder.findUnique as jest.Mock)
      .mockResolvedValueOnce(null) // name check
      .mockResolvedValueOnce({ id: 'existing' }) // code check - exists

    const formData = new FormData()
    formData.append('name', 'New Forwarder')
    formData.append('code', 'EXISTING')
    formData.append('defaultConfidence', '0.8')

    const request = new NextRequest('http://localhost/api/forwarders', {
      method: 'POST',
      body: formData
    })

    const response = await POST(request)

    expect(response.status).toBe(409)
  })
})

describe('PATCH /api/forwarders/[id]/deactivate', () => {
  it('should deactivate forwarder and rules', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'user-1', role: 'ADMIN' }
    } as any)

    ;(prisma.forwarder.findUnique as jest.Mock).mockResolvedValue({
      id: 'forwarder-1',
      status: 'ACTIVE'
    })

    ;(prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
      return callback({
        forwarder: { update: jest.fn().mockResolvedValue({ id: 'forwarder-1', name: 'Test' }) },
        mappingRule: { updateMany: jest.fn().mockResolvedValue({ count: 5 }) },
        auditLog: { create: jest.fn().mockResolvedValue({}) }
      })
    })

    // Test implementation...
  })
})
```

### 7.2 E2E Tests

**File**: `e2e/forwarder-lifecycle.spec.ts`

```typescript
import { test, expect } from '@playwright/test'

test.describe('Forwarder Lifecycle', () => {
  test.beforeEach(async ({ page }) => {
    // Login as admin
    await page.goto('/login')
    await page.fill('[name="email"]', 'admin@example.com')
    await page.fill('[name="password"]', 'password')
    await page.click('button[type="submit"]')
    await page.waitForURL('/dashboard')
  })

  test('should create a new forwarder', async ({ page }) => {
    await page.goto('/forwarders/new')

    // Fill form
    await page.fill('[name="name"]', 'Test Forwarder E2E')
    await page.fill('[name="code"]', 'TESTE2E')
    await page.fill('[name="description"]', 'Test description')
    await page.fill('[name="contactEmail"]', 'test@example.com')

    // Wait for code validation
    await page.waitForSelector('text=可用')

    // Submit
    await page.click('button[type="submit"]')

    // Verify redirect to detail page
    await expect(page).toHaveURL(/\/forwarders\//)
    await expect(page.locator('h1')).toContainText('Test Forwarder E2E')
  })

  test('should deactivate a forwarder', async ({ page }) => {
    await page.goto('/forwarders/test-forwarder-id')

    // Open actions menu
    await page.click('[data-testid="forwarder-actions"]')
    await page.click('text=停用 Forwarder')

    // Fill reason
    await page.fill('[id="reason"]', 'Testing deactivation')

    // Confirm
    await page.click('text=確認停用')

    // Verify status changed
    await expect(page.locator('.badge')).toContainText('已停用')
  })

  test('should reactivate a forwarder', async ({ page }) => {
    await page.goto('/forwarders/inactive-forwarder-id')

    // Open actions menu
    await page.click('[data-testid="forwarder-actions"]')
    await page.click('text=啟用 Forwarder')

    // Confirm
    await page.click('text=確認啟用')

    // Verify status changed
    await expect(page.locator('.badge')).toContainText('啟用中')
  })
})
```

---

## 8. Implementation Checklist

### Phase 1: API Development
- [ ] Implement POST /api/forwarders
- [ ] Implement PUT /api/forwarders/[id]
- [ ] Implement PATCH /api/forwarders/[id]/deactivate
- [ ] Implement PATCH /api/forwarders/[id]/activate
- [ ] Implement GET /api/forwarders/check-code

### Phase 2: Azure Blob Storage
- [ ] Set up Azure Blob Storage service
- [ ] Implement uploadToBlob function
- [ ] Implement deleteFromBlob function
- [ ] Configure environment variables

### Phase 3: Frontend Components
- [ ] Create NewForwarderPage
- [ ] Create ForwarderForm component
- [ ] Create LogoUploader component
- [ ] Enhance ForwarderActions component

### Phase 4: Integration
- [ ] Install react-dropzone
- [ ] Configure image upload handling
- [ ] Add code uniqueness validation

### Phase 5: Testing & QA
- [ ] Write API tests
- [ ] Write component tests
- [ ] Write E2E tests
- [ ] Test logo upload flow

---

## 9. Dependencies

### NPM Packages
```json
{
  "@azure/storage-blob": "^12.17.0",
  "react-dropzone": "^14.2.0",
  "uuid": "^9.0.0"
}
```

### Environment Variables
```env
AZURE_STORAGE_CONNECTION_STRING=your_connection_string
AZURE_STORAGE_CONTAINER_NAME=uploads
```

### Related Stories
- Story 5.1: Forwarder Profile 列表（前置依賴）
- Story 5.2: Forwarder 詳細配置查看（前置依賴）

---

*Tech Spec created: 2025-12-16*
*Last updated: 2025-12-16*
