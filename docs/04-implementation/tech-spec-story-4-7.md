# Tech Spec: Story 4-7 規則版本歷史管理

## 1. Overview

### 1.1 Story Reference
- **Story ID**: 4.7
- **Epic**: Epic 4 - 映射規則管理與自動學習
- **Title**: 規則版本歷史管理
- **Status**: Ready for Dev

### 1.2 Summary
實作規則版本歷史管理功能，允許 Super User 查看規則的版本演變歷史、進行版本對比以識別差異，並支援手動回滾至先前的穩定版本。系統至少保留 5 個版本記錄，確保可追溯性和版本控制能力。

### 1.3 Acceptance Criteria Overview
| AC ID | Description | Priority |
|-------|-------------|----------|
| AC1 | 版本歷史列表 - 顯示規則所有版本（至少保留 5 個） | Must Have |
| AC2 | 版本對比 - 選擇兩個版本進行對比，高亮顯示差異 | Must Have |

---

## 2. Technical Design

### 2.1 Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         Version History Management                       │
├─────────────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐    ┌─────────────────┐    ┌────────────────────────┐ │
│  │   Version    │    │    Version      │    │      Version           │ │
│  │  History     │───▶│    Compare      │───▶│      Rollback          │ │
│  │    Page      │    │    Dialog       │    │      Dialog            │ │
│  └──────────────┘    └─────────────────┘    └────────────────────────┘ │
│         │                    │                        │                 │
│         ▼                    ▼                        ▼                 │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                     React Query Hooks                             │  │
│  │  ┌──────────────┐ ┌─────────────────┐ ┌────────────────────────┐ │  │
│  │  │useVersions   │ │useVersionCompare│ │useManualRollback       │ │  │
│  │  └──────────────┘ └─────────────────┘ └────────────────────────┘ │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│         │                    │                        │                 │
│         ▼                    ▼                        ▼                 │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                         API Layer                                 │  │
│  │  GET /versions    GET /versions/compare   POST /versions/rollback │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│         │                    │                        │                 │
│         ▼                    ▼                        ▼                 │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                    VersionHistoryService                          │  │
│  │  ┌──────────────┐ ┌─────────────────┐ ┌────────────────────────┐ │  │
│  │  │getVersions   │ │compareVersions  │ │rollbackToVersion       │ │  │
│  │  └──────────────┘ └─────────────────┘ └────────────────────────┘ │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│         │                    │                        │                 │
│         ▼                    ▼                        ▼                 │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                    Prisma (RuleVersion)                           │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Data Models

#### 2.2.1 Prisma Schema

```prisma
// RuleVersion 模型 - 記錄規則每個版本的完整快照
model RuleVersion {
  id             String         @id @default(uuid())
  ruleId         String         @map("rule_id")
  version        Int            // 版本號（遞增）
  extractionType ExtractionType @map("extraction_type")
  pattern        String?        // 提取 pattern
  confidence     Float          @default(0.8) // 信心度
  priority       Int            @default(0)   // 優先級
  changeReason   String?        @map("change_reason") // 變更原因
  createdBy      String         @map("created_by")
  createdAt      DateTime       @default(now()) @map("created_at")

  rule    MappingRule @relation(fields: [ruleId], references: [id], onDelete: Cascade)
  creator User        @relation(fields: [createdBy], references: [id])

  @@unique([ruleId, version])
  @@index([ruleId])
  @@index([createdAt])
  @@map("rule_versions")
}
```

#### 2.2.2 TypeScript Types

```typescript
// src/types/version.ts

import type { ExtractionType } from '@prisma/client'

/**
 * 版本詳情
 */
export interface VersionDetail {
  id: string
  version: number
  extractionType: ExtractionType
  pattern: string | null
  confidence: number
  priority: number
  changeReason: string | null
  createdBy: {
    id: string
    name: string
    email: string
  }
  createdAt: string
  isActive: boolean
}

/**
 * 版本歷史列表響應
 */
export interface VersionsResponse {
  ruleId: string
  ruleName: string
  fieldName: string
  currentVersion: number
  totalVersions: number
  versions: VersionDetail[]
}

/**
 * 欄位差異項目
 */
export interface FieldDifference {
  field: string
  label: string
  value1: string | number | null
  value2: string | number | null
  changed: boolean
}

/**
 * Pattern 差異分析
 */
export interface PatternDiff {
  added: string[]
  removed: string[]
  unchanged: string[]
}

/**
 * 版本對比響應
 */
export interface CompareResponse {
  version1: VersionDetail
  version2: VersionDetail
  differences: FieldDifference[]
  patternDiff: PatternDiff
  summaryText: string // 人類可讀的差異摘要
}

/**
 * 回滾請求
 */
export interface RollbackRequest {
  targetVersionId: string
  reason?: string
}

/**
 * 回滾結果
 */
export interface RollbackResult {
  ruleId: string
  fromVersion: number
  toVersion: number
  newVersion: number
  message: string
  createdAt: string
}

/**
 * 版本選擇狀態
 */
export interface VersionSelectionState {
  selectedVersions: string[]
  maxSelection: 2
}
```

### 2.3 API Design

#### 2.3.1 GET /api/rules/[id]/versions - 取得版本歷史

**Purpose**: 取得指定規則的所有版本歷史記錄

**Route**: `src/app/api/rules/[id]/versions/route.ts`

**Request**:
```typescript
// Query Parameters
interface VersionsQueryParams {
  limit?: number    // 返回數量限制，預設 20
  offset?: number   // 分頁偏移，預設 0
}
```

**Response**:
```typescript
// 成功響應
interface VersionsSuccessResponse {
  success: true
  data: VersionsResponse
}

// 錯誤響應 (RFC 7807)
interface VersionsErrorResponse {
  success: false
  error: {
    type: string
    title: string
    status: number
    detail: string
    instance: string
  }
}
```

**Implementation**:
```typescript
// src/app/api/rules/[id]/versions/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { checkPermission } from '@/lib/permissions'
import { z } from 'zod'

const querySchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(20),
  offset: z.coerce.number().min(0).default(0),
})

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 1. Authentication
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json(
        {
          success: false,
          error: {
            type: 'https://api.example.com/errors/unauthorized',
            title: 'Unauthorized',
            status: 401,
            detail: 'Authentication required',
            instance: `/api/rules/${params.id}/versions`,
          },
        },
        { status: 401 }
      )
    }

    // 2. Authorization
    const hasPermission = await checkPermission(session.user.id, 'RULE_VIEW')
    if (!hasPermission) {
      return NextResponse.json(
        {
          success: false,
          error: {
            type: 'https://api.example.com/errors/forbidden',
            title: 'Forbidden',
            status: 403,
            detail: 'RULE_VIEW permission required',
            instance: `/api/rules/${params.id}/versions`,
          },
        },
        { status: 403 }
      )
    }

    // 3. Validate query params
    const searchParams = request.nextUrl.searchParams
    const queryResult = querySchema.safeParse({
      limit: searchParams.get('limit'),
      offset: searchParams.get('offset'),
    })

    if (!queryResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            type: 'https://api.example.com/errors/validation',
            title: 'Validation Error',
            status: 400,
            detail: queryResult.error.issues[0].message,
            instance: `/api/rules/${params.id}/versions`,
          },
        },
        { status: 400 }
      )
    }

    const { limit, offset } = queryResult.data

    // 4. Fetch rule with versions
    const rule = await prisma.mappingRule.findUnique({
      where: { id: params.id },
      include: {
        field: true,
      },
    })

    if (!rule) {
      return NextResponse.json(
        {
          success: false,
          error: {
            type: 'https://api.example.com/errors/not-found',
            title: 'Rule Not Found',
            status: 404,
            detail: `Rule with ID ${params.id} not found`,
            instance: `/api/rules/${params.id}/versions`,
          },
        },
        { status: 404 }
      )
    }

    // 5. Fetch versions with pagination
    const [versions, totalCount] = await Promise.all([
      prisma.ruleVersion.findMany({
        where: { ruleId: params.id },
        include: {
          creator: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: { version: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.ruleVersion.count({
        where: { ruleId: params.id },
      }),
    ])

    // 6. Transform response
    const versionDetails: VersionDetail[] = versions.map((v) => ({
      id: v.id,
      version: v.version,
      extractionType: v.extractionType,
      pattern: v.pattern,
      confidence: v.confidence,
      priority: v.priority,
      changeReason: v.changeReason,
      createdBy: v.creator,
      createdAt: v.createdAt.toISOString(),
      isActive: v.version === rule.version,
    }))

    return NextResponse.json({
      success: true,
      data: {
        ruleId: rule.id,
        ruleName: rule.name,
        fieldName: rule.field.name,
        currentVersion: rule.version,
        totalVersions: totalCount,
        versions: versionDetails,
      },
    })
  } catch (error) {
    console.error('Error fetching versions:', error)
    return NextResponse.json(
      {
        success: false,
        error: {
          type: 'https://api.example.com/errors/internal',
          title: 'Internal Server Error',
          status: 500,
          detail: 'An unexpected error occurred',
          instance: `/api/rules/${params.id}/versions`,
        },
      },
      { status: 500 }
    )
  }
}
```

#### 2.3.2 GET /api/rules/[id]/versions/compare - 版本對比

**Purpose**: 對比兩個版本的差異

**Route**: `src/app/api/rules/[id]/versions/compare/route.ts`

**Request**:
```typescript
// Query Parameters
interface CompareQueryParams {
  v1: string  // 版本 1 的 ID
  v2: string  // 版本 2 的 ID
}
```

**Implementation**:
```typescript
// src/app/api/rules/[id]/versions/compare/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { checkPermission } from '@/lib/permissions'
import { z } from 'zod'
import { diffLines, Change } from 'diff'

const querySchema = z.object({
  v1: z.string().uuid('Invalid version 1 ID'),
  v2: z.string().uuid('Invalid version 2 ID'),
})

/**
 * 計算兩個版本之間的差異
 */
function calculateDifferences(
  v1: RuleVersion,
  v2: RuleVersion
): FieldDifference[] {
  const fields: Array<{
    key: keyof RuleVersion
    label: string
    format?: (v: unknown) => string
  }> = [
    { key: 'extractionType', label: '提取類型' },
    {
      key: 'confidence',
      label: '信心度',
      format: (v) => `${((v as number) * 100).toFixed(0)}%`,
    },
    { key: 'priority', label: '優先級' },
    { key: 'changeReason', label: '變更原因' },
  ]

  return fields.map((field) => {
    const val1 = v1[field.key]
    const val2 = v2[field.key]
    const format = field.format || ((v) => String(v ?? '-'))

    return {
      field: field.key,
      label: field.label,
      value1: format(val1),
      value2: format(val2),
      changed: val1 !== val2,
    }
  })
}

/**
 * 計算 Pattern 差異
 */
function calculatePatternDiff(
  pattern1: string | null,
  pattern2: string | null
): PatternDiff {
  const p1 = pattern1 || ''
  const p2 = pattern2 || ''

  // 使用 diff 庫計算行級差異
  const changes = diffLines(p1, p2)

  const added: string[] = []
  const removed: string[] = []
  const unchanged: string[] = []

  changes.forEach((change: Change) => {
    const lines = change.value.split('\n').filter((line) => line.trim())
    if (change.added) {
      added.push(...lines)
    } else if (change.removed) {
      removed.push(...lines)
    } else {
      unchanged.push(...lines)
    }
  })

  return { added, removed, unchanged }
}

/**
 * 生成人類可讀的差異摘要
 */
function generateSummaryText(
  v1: RuleVersion,
  v2: RuleVersion,
  differences: FieldDifference[]
): string {
  const changedFields = differences.filter((d) => d.changed)

  if (changedFields.length === 0) {
    return '兩個版本完全相同'
  }

  const parts: string[] = []

  if (v1.extractionType !== v2.extractionType) {
    parts.push(`提取類型從 ${v1.extractionType} 變更為 ${v2.extractionType}`)
  }

  if (v1.confidence !== v2.confidence) {
    const diff = (v2.confidence - v1.confidence) * 100
    const direction = diff > 0 ? '提高' : '降低'
    parts.push(`信心度${direction}了 ${Math.abs(diff).toFixed(0)}%`)
  }

  if (v1.priority !== v2.priority) {
    parts.push(`優先級從 ${v1.priority} 變更為 ${v2.priority}`)
  }

  if (v1.pattern !== v2.pattern) {
    parts.push('Pattern 規則有變更')
  }

  return parts.join('；')
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 1. Authentication
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json(
        {
          success: false,
          error: {
            type: 'https://api.example.com/errors/unauthorized',
            title: 'Unauthorized',
            status: 401,
            detail: 'Authentication required',
            instance: `/api/rules/${params.id}/versions/compare`,
          },
        },
        { status: 401 }
      )
    }

    // 2. Authorization
    const hasPermission = await checkPermission(session.user.id, 'RULE_VIEW')
    if (!hasPermission) {
      return NextResponse.json(
        {
          success: false,
          error: {
            type: 'https://api.example.com/errors/forbidden',
            title: 'Forbidden',
            status: 403,
            detail: 'RULE_VIEW permission required',
            instance: `/api/rules/${params.id}/versions/compare`,
          },
        },
        { status: 403 }
      )
    }

    // 3. Validate query params
    const searchParams = request.nextUrl.searchParams
    const queryResult = querySchema.safeParse({
      v1: searchParams.get('v1'),
      v2: searchParams.get('v2'),
    })

    if (!queryResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            type: 'https://api.example.com/errors/validation',
            title: 'Validation Error',
            status: 400,
            detail: queryResult.error.issues[0].message,
            instance: `/api/rules/${params.id}/versions/compare`,
          },
        },
        { status: 400 }
      )
    }

    const { v1, v2 } = queryResult.data

    // 4. Validate same version not selected
    if (v1 === v2) {
      return NextResponse.json(
        {
          success: false,
          error: {
            type: 'https://api.example.com/errors/validation',
            title: 'Validation Error',
            status: 400,
            detail: 'Cannot compare a version with itself',
            instance: `/api/rules/${params.id}/versions/compare`,
          },
        },
        { status: 400 }
      )
    }

    // 5. Fetch both versions
    const [version1, version2] = await Promise.all([
      prisma.ruleVersion.findUnique({
        where: { id: v1 },
        include: {
          creator: {
            select: { id: true, name: true, email: true },
          },
        },
      }),
      prisma.ruleVersion.findUnique({
        where: { id: v2 },
        include: {
          creator: {
            select: { id: true, name: true, email: true },
          },
        },
      }),
    ])

    // 6. Validate versions exist and belong to same rule
    if (!version1 || !version2) {
      return NextResponse.json(
        {
          success: false,
          error: {
            type: 'https://api.example.com/errors/not-found',
            title: 'Version Not Found',
            status: 404,
            detail: 'One or both versions not found',
            instance: `/api/rules/${params.id}/versions/compare`,
          },
        },
        { status: 404 }
      )
    }

    if (version1.ruleId !== params.id || version2.ruleId !== params.id) {
      return NextResponse.json(
        {
          success: false,
          error: {
            type: 'https://api.example.com/errors/validation',
            title: 'Validation Error',
            status: 400,
            detail: 'Versions do not belong to the specified rule',
            instance: `/api/rules/${params.id}/versions/compare`,
          },
        },
        { status: 400 }
      )
    }

    // 7. Get current rule to check active version
    const rule = await prisma.mappingRule.findUnique({
      where: { id: params.id },
      select: { version: true },
    })

    // 8. Calculate differences
    const differences = calculateDifferences(version1, version2)
    const patternDiff = calculatePatternDiff(version1.pattern, version2.pattern)
    const summaryText = generateSummaryText(version1, version2, differences)

    // 9. Transform to response format
    const transformVersion = (v: typeof version1): VersionDetail => ({
      id: v!.id,
      version: v!.version,
      extractionType: v!.extractionType,
      pattern: v!.pattern,
      confidence: v!.confidence,
      priority: v!.priority,
      changeReason: v!.changeReason,
      createdBy: v!.creator,
      createdAt: v!.createdAt.toISOString(),
      isActive: v!.version === rule?.version,
    })

    return NextResponse.json({
      success: true,
      data: {
        version1: transformVersion(version1),
        version2: transformVersion(version2),
        differences,
        patternDiff,
        summaryText,
      },
    })
  } catch (error) {
    console.error('Error comparing versions:', error)
    return NextResponse.json(
      {
        success: false,
        error: {
          type: 'https://api.example.com/errors/internal',
          title: 'Internal Server Error',
          status: 500,
          detail: 'An unexpected error occurred',
          instance: `/api/rules/${params.id}/versions/compare`,
        },
      },
      { status: 500 }
    )
  }
}
```

#### 2.3.3 POST /api/rules/[id]/versions/rollback - 手動回滾

**Purpose**: 手動回滾規則至指定版本

**Route**: `src/app/api/rules/[id]/versions/rollback/route.ts`

**Request**:
```typescript
interface RollbackRequestBody {
  targetVersionId: string  // 要回滾到的版本 ID
  reason?: string          // 回滾原因（選填）
}
```

**Implementation**:
```typescript
// src/app/api/rules/[id]/versions/rollback/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { checkPermission } from '@/lib/permissions'
import { z } from 'zod'

const bodySchema = z.object({
  targetVersionId: z.string().uuid('Invalid target version ID'),
  reason: z.string().max(500).optional(),
})

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 1. Authentication
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json(
        {
          success: false,
          error: {
            type: 'https://api.example.com/errors/unauthorized',
            title: 'Unauthorized',
            status: 401,
            detail: 'Authentication required',
            instance: `/api/rules/${params.id}/versions/rollback`,
          },
        },
        { status: 401 }
      )
    }

    // 2. Authorization - Requires RULE_MANAGE permission
    const hasPermission = await checkPermission(session.user.id, 'RULE_MANAGE')
    if (!hasPermission) {
      return NextResponse.json(
        {
          success: false,
          error: {
            type: 'https://api.example.com/errors/forbidden',
            title: 'Forbidden',
            status: 403,
            detail: 'RULE_MANAGE permission required for rollback',
            instance: `/api/rules/${params.id}/versions/rollback`,
          },
        },
        { status: 403 }
      )
    }

    // 3. Validate request body
    const body = await request.json()
    const bodyResult = bodySchema.safeParse(body)

    if (!bodyResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            type: 'https://api.example.com/errors/validation',
            title: 'Validation Error',
            status: 400,
            detail: bodyResult.error.issues[0].message,
            instance: `/api/rules/${params.id}/versions/rollback`,
          },
        },
        { status: 400 }
      )
    }

    const { targetVersionId, reason } = bodyResult.data

    // 4. Fetch target version
    const targetVersion = await prisma.ruleVersion.findUnique({
      where: { id: targetVersionId },
    })

    if (!targetVersion) {
      return NextResponse.json(
        {
          success: false,
          error: {
            type: 'https://api.example.com/errors/not-found',
            title: 'Version Not Found',
            status: 404,
            detail: `Target version ${targetVersionId} not found`,
            instance: `/api/rules/${params.id}/versions/rollback`,
          },
        },
        { status: 404 }
      )
    }

    // 5. Validate version belongs to correct rule
    if (targetVersion.ruleId !== params.id) {
      return NextResponse.json(
        {
          success: false,
          error: {
            type: 'https://api.example.com/errors/validation',
            title: 'Validation Error',
            status: 400,
            detail: 'Target version does not belong to this rule',
            instance: `/api/rules/${params.id}/versions/rollback`,
          },
        },
        { status: 400 }
      )
    }

    // 6. Get current rule
    const currentRule = await prisma.mappingRule.findUnique({
      where: { id: params.id },
    })

    if (!currentRule) {
      return NextResponse.json(
        {
          success: false,
          error: {
            type: 'https://api.example.com/errors/not-found',
            title: 'Rule Not Found',
            status: 404,
            detail: `Rule ${params.id} not found`,
            instance: `/api/rules/${params.id}/versions/rollback`,
          },
        },
        { status: 404 }
      )
    }

    // 7. Validate not rolling back to current version
    if (targetVersion.version === currentRule.version) {
      return NextResponse.json(
        {
          success: false,
          error: {
            type: 'https://api.example.com/errors/validation',
            title: 'Validation Error',
            status: 400,
            detail: 'Cannot rollback to the current active version',
            instance: `/api/rules/${params.id}/versions/rollback`,
          },
        },
        { status: 400 }
      )
    }

    // 8. Execute rollback transaction
    const result = await prisma.$transaction(async (tx) => {
      const newVersionNumber = currentRule.version + 1
      const changeReason =
        reason || `Manual rollback to version ${targetVersion.version}`

      // 8.1 Update rule with target version's content
      const updatedRule = await tx.mappingRule.update({
        where: { id: params.id },
        data: {
          extractionType: targetVersion.extractionType,
          pattern: targetVersion.pattern,
          confidence: targetVersion.confidence,
          priority: targetVersion.priority,
          version: newVersionNumber,
          updatedAt: new Date(),
        },
      })

      // 8.2 Create new version record
      const newVersion = await tx.ruleVersion.create({
        data: {
          ruleId: params.id,
          version: newVersionNumber,
          extractionType: targetVersion.extractionType,
          pattern: targetVersion.pattern,
          confidence: targetVersion.confidence,
          priority: targetVersion.priority,
          changeReason,
          createdBy: session.user.id,
        },
      })

      // 8.3 Create rollback log
      const rollbackLog = await tx.rollbackLog.create({
        data: {
          ruleId: params.id,
          fromVersion: currentRule.version,
          toVersion: targetVersion.version,
          trigger: 'MANUAL',
          reason: changeReason,
          accuracyBefore: currentRule.confidence,
          accuracyAfter: targetVersion.confidence,
        },
      })

      return {
        rule: updatedRule,
        version: newVersion,
        log: rollbackLog,
      }
    })

    return NextResponse.json({
      success: true,
      data: {
        ruleId: params.id,
        fromVersion: currentRule.version,
        toVersion: targetVersion.version,
        newVersion: result.version.version,
        message: `Successfully rolled back to version ${targetVersion.version}`,
        createdAt: result.version.createdAt.toISOString(),
      },
    })
  } catch (error) {
    console.error('Error rolling back version:', error)
    return NextResponse.json(
      {
        success: false,
        error: {
          type: 'https://api.example.com/errors/internal',
          title: 'Internal Server Error',
          status: 500,
          detail: 'An unexpected error occurred during rollback',
          instance: `/api/rules/${params.id}/versions/rollback`,
        },
      },
      { status: 500 }
    )
  }
}
```

### 2.4 Service Layer

#### 2.4.1 VersionHistoryService

```typescript
// src/services/version-history.ts

import { prisma } from '@/lib/prisma'
import type { ExtractionType } from '@prisma/client'

/**
 * 版本歷史管理服務
 */
export class VersionHistoryService {
  /**
   * 創建新版本記錄
   * 在規則更新時自動調用
   */
  async createVersion(
    ruleId: string,
    version: number,
    data: {
      extractionType: ExtractionType
      pattern: string | null
      confidence: number
      priority: number
      changeReason: string
      createdBy: string
    }
  ) {
    return prisma.ruleVersion.create({
      data: {
        ruleId,
        version,
        ...data,
      },
    })
  }

  /**
   * 取得規則的版本數量
   */
  async getVersionCount(ruleId: string): Promise<number> {
    return prisma.ruleVersion.count({
      where: { ruleId },
    })
  }

  /**
   * 清理舊版本（保留至少 5 個）
   * 可選擇性調用以維護儲存空間
   */
  async cleanupOldVersions(
    ruleId: string,
    keepCount: number = 5
  ): Promise<number> {
    // 獲取要保留的版本 IDs
    const versionsToKeep = await prisma.ruleVersion.findMany({
      where: { ruleId },
      orderBy: { version: 'desc' },
      take: keepCount,
      select: { id: true },
    })

    const keepIds = versionsToKeep.map((v) => v.id)

    // 刪除舊版本
    const result = await prisma.ruleVersion.deleteMany({
      where: {
        ruleId,
        id: { notIn: keepIds },
      },
    })

    return result.count
  }

  /**
   * 獲取上一個穩定版本
   */
  async getPreviousStableVersion(ruleId: string, currentVersion: number) {
    return prisma.ruleVersion.findFirst({
      where: {
        ruleId,
        version: { lt: currentVersion },
      },
      orderBy: { version: 'desc' },
    })
  }

  /**
   * 檢查是否可以回滾
   */
  async canRollback(ruleId: string): Promise<boolean> {
    const count = await prisma.ruleVersion.count({
      where: { ruleId },
    })
    return count > 1
  }
}

export const versionHistoryService = new VersionHistoryService()
```

### 2.5 UI Components

#### 2.5.1 Version History Page

```typescript
// src/app/(dashboard)/rules/[id]/history/page.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useVersions, useVersionCompare } from '@/hooks/use-versions'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { VersionCompareDialog } from '@/components/rules/VersionCompareDialog'
import { formatDate } from '@/lib/utils'
import { ArrowLeft, GitCompare, History } from 'lucide-react'

interface Props {
  params: { id: string }
}

export default function VersionHistoryPage({ params }: Props) {
  const router = useRouter()
  const { data, isLoading, error } = useVersions(params.id)
  const [selectedVersions, setSelectedVersions] = useState<string[]>([])
  const [compareDialogOpen, setCompareDialogOpen] = useState(false)

  const handleVersionSelect = (versionId: string, checked: boolean) => {
    if (checked) {
      if (selectedVersions.length < 2) {
        setSelectedVersions([...selectedVersions, versionId])
      }
    } else {
      setSelectedVersions(selectedVersions.filter((id) => id !== versionId))
    }
  }

  const handleCompare = () => {
    if (selectedVersions.length === 2) {
      setCompareDialogOpen(true)
    }
  }

  const clearSelection = () => {
    setSelectedVersions([])
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <p className="text-destructive">載入版本歷史失敗</p>
        <Button variant="outline" onClick={() => router.back()}>
          返回
        </Button>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <History className="h-6 w-6" />
              版本歷史
            </h1>
            <p className="text-muted-foreground">
              {data.ruleName} - {data.fieldName}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {selectedVersions.length > 0 && (
            <Button variant="outline" size="sm" onClick={clearSelection}>
              清除選擇 ({selectedVersions.length})
            </Button>
          )}
          <Button
            onClick={handleCompare}
            disabled={selectedVersions.length !== 2}
          >
            <GitCompare className="h-4 w-4 mr-2" />
            對比版本
          </Button>
        </div>
      </div>

      {/* Version Info Card */}
      <Card>
        <CardHeader>
          <CardTitle>版本資訊</CardTitle>
          <CardDescription>
            目前版本: v{data.currentVersion} | 共 {data.totalVersions} 個版本
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Version List Table */}
      <Card>
        <CardHeader>
          <CardTitle>版本列表</CardTitle>
          <CardDescription>
            選擇兩個版本進行對比，或點擊版本查看詳情
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">選擇</TableHead>
                <TableHead className="w-20">版本</TableHead>
                <TableHead>提取類型</TableHead>
                <TableHead>信心度</TableHead>
                <TableHead>變更原因</TableHead>
                <TableHead>建立者</TableHead>
                <TableHead>建立時間</TableHead>
                <TableHead className="w-20">狀態</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.versions.map((version) => (
                <TableRow
                  key={version.id}
                  className={version.isActive ? 'bg-muted/50' : ''}
                >
                  <TableCell>
                    <Checkbox
                      checked={selectedVersions.includes(version.id)}
                      onCheckedChange={(checked) =>
                        handleVersionSelect(version.id, checked as boolean)
                      }
                      disabled={
                        !selectedVersions.includes(version.id) &&
                        selectedVersions.length >= 2
                      }
                    />
                  </TableCell>
                  <TableCell className="font-mono">
                    v{version.version}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{version.extractionType}</Badge>
                  </TableCell>
                  <TableCell>
                    {(version.confidence * 100).toFixed(0)}%
                  </TableCell>
                  <TableCell className="max-w-xs truncate">
                    {version.changeReason || '-'}
                  </TableCell>
                  <TableCell>{version.createdBy.name}</TableCell>
                  <TableCell>{formatDate(version.createdAt)}</TableCell>
                  <TableCell>
                    {version.isActive && (
                      <Badge variant="default">目前版本</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Compare Dialog */}
      <VersionCompareDialog
        open={compareDialogOpen}
        onOpenChange={setCompareDialogOpen}
        ruleId={params.id}
        versionId1={selectedVersions[0]}
        versionId2={selectedVersions[1]}
      />
    </div>
  )
}
```

#### 2.5.2 Version Compare Dialog

```typescript
// src/components/rules/VersionCompareDialog.tsx
'use client'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { useVersionCompare, useManualRollback } from '@/hooks/use-versions'
import { VersionDiffViewer } from './VersionDiffViewer'
import { RollbackConfirmDialog } from './RollbackConfirmDialog'
import { useState } from 'react'
import { RotateCcw, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  ruleId: string
  versionId1?: string
  versionId2?: string
}

export function VersionCompareDialog({
  open,
  onOpenChange,
  ruleId,
  versionId1,
  versionId2,
}: Props) {
  const [rollbackDialogOpen, setRollbackDialogOpen] = useState(false)
  const [rollbackTargetId, setRollbackTargetId] = useState<string | null>(null)

  const { data, isLoading, error } = useVersionCompare(
    ruleId,
    versionId1,
    versionId2,
    open
  )

  const rollbackMutation = useManualRollback(ruleId)

  const handleRollback = (targetVersionId: string) => {
    setRollbackTargetId(targetVersionId)
    setRollbackDialogOpen(true)
  }

  const confirmRollback = async (reason?: string) => {
    if (!rollbackTargetId) return

    try {
      await rollbackMutation.mutateAsync({
        targetVersionId: rollbackTargetId,
        reason,
      })
      toast.success('回滾成功')
      setRollbackDialogOpen(false)
      onOpenChange(false)
    } catch (error) {
      toast.error('回滾失敗，請稍後再試')
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>版本對比</DialogTitle>
            <DialogDescription>
              比較兩個版本之間的差異
            </DialogDescription>
          </DialogHeader>

          {isLoading && (
            <div className="flex items-center justify-center h-48">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          )}

          {error && (
            <div className="flex items-center justify-center h-48 text-destructive">
              載入對比資料失敗
            </div>
          )}

          {data && (
            <div className="space-y-6">
              {/* Summary */}
              <div className="bg-muted p-4 rounded-lg">
                <h4 className="font-medium mb-2">差異摘要</h4>
                <p className="text-sm text-muted-foreground">
                  {data.summaryText}
                </p>
              </div>

              {/* Version Headers with Rollback Buttons */}
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <span className="font-semibold">
                      版本 {data.version1.version}
                    </span>
                    {data.version1.isActive && (
                      <Badge className="ml-2" variant="default">
                        目前版本
                      </Badge>
                    )}
                  </div>
                  {!data.version1.isActive && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRollback(data.version1.id)}
                    >
                      <RotateCcw className="h-4 w-4 mr-1" />
                      回滾到此版本
                    </Button>
                  )}
                </div>
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <span className="font-semibold">
                      版本 {data.version2.version}
                    </span>
                    {data.version2.isActive && (
                      <Badge className="ml-2" variant="default">
                        目前版本
                      </Badge>
                    )}
                  </div>
                  {!data.version2.isActive && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRollback(data.version2.id)}
                    >
                      <RotateCcw className="h-4 w-4 mr-1" />
                      回滾到此版本
                    </Button>
                  )}
                </div>
              </div>

              <Separator />

              {/* Diff Viewer */}
              <VersionDiffViewer
                version1={data.version1}
                version2={data.version2}
                differences={data.differences}
                patternDiff={data.patternDiff}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Rollback Confirmation Dialog */}
      <RollbackConfirmDialog
        open={rollbackDialogOpen}
        onOpenChange={setRollbackDialogOpen}
        onConfirm={confirmRollback}
        isLoading={rollbackMutation.isPending}
        targetVersion={
          rollbackTargetId === data?.version1.id
            ? data?.version1.version
            : data?.version2.version
        }
      />
    </>
  )
}
```

#### 2.5.3 Version Diff Viewer

```typescript
// src/components/rules/VersionDiffViewer.tsx
'use client'

import { diffLines, Change } from 'diff'
import { cn } from '@/lib/utils'
import { formatDate } from '@/lib/utils'
import type { VersionDetail, FieldDifference, PatternDiff } from '@/types/version'

interface Props {
  version1: VersionDetail
  version2: VersionDetail
  differences: FieldDifference[]
  patternDiff: PatternDiff
}

export function VersionDiffViewer({
  version1,
  version2,
  differences,
  patternDiff,
}: Props) {
  // 計算 Pattern 的行級差異用於高亮顯示
  const patternChanges = diffLines(
    version1.pattern || '',
    version2.pattern || ''
  )

  return (
    <div className="space-y-6">
      {/* Field Differences Table */}
      <div>
        <h4 className="font-medium mb-3">欄位差異</h4>
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-muted">
              <tr>
                <th className="px-4 py-2 text-left text-sm font-medium">欄位</th>
                <th className="px-4 py-2 text-left text-sm font-medium">
                  版本 {version1.version}
                </th>
                <th className="px-4 py-2 text-left text-sm font-medium">
                  版本 {version2.version}
                </th>
              </tr>
            </thead>
            <tbody>
              {differences.map((diff) => (
                <tr
                  key={diff.field}
                  className={cn(
                    'border-t',
                    diff.changed && 'bg-yellow-50 dark:bg-yellow-900/10'
                  )}
                >
                  <td className="px-4 py-2 text-sm font-medium">
                    {diff.label}
                    {diff.changed && (
                      <span className="ml-2 text-xs text-yellow-600">已變更</span>
                    )}
                  </td>
                  <td
                    className={cn(
                      'px-4 py-2 text-sm',
                      diff.changed && 'text-red-600 line-through'
                    )}
                  >
                    {String(diff.value1)}
                  </td>
                  <td
                    className={cn(
                      'px-4 py-2 text-sm',
                      diff.changed && 'text-green-600 font-medium'
                    )}
                  >
                    {String(diff.value2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pattern Diff */}
      <div>
        <h4 className="font-medium mb-3">Pattern 差異</h4>
        <div className="grid grid-cols-2 gap-4">
          {/* Version 1 Pattern */}
          <div className="border rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <h5 className="text-sm font-medium text-muted-foreground">
                版本 {version1.version}
              </h5>
              <span className="text-xs text-muted-foreground">
                {formatDate(version1.createdAt)}
              </span>
            </div>
            <pre className="bg-muted p-3 rounded text-sm overflow-x-auto whitespace-pre-wrap">
              {version1.pattern || '(無 Pattern)'}
            </pre>
          </div>

          {/* Version 2 Pattern */}
          <div className="border rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <h5 className="text-sm font-medium text-muted-foreground">
                版本 {version2.version}
              </h5>
              <span className="text-xs text-muted-foreground">
                {formatDate(version2.createdAt)}
              </span>
            </div>
            <pre className="bg-muted p-3 rounded text-sm overflow-x-auto whitespace-pre-wrap">
              {version2.pattern || '(無 Pattern)'}
            </pre>
          </div>
        </div>

        {/* Unified Diff View */}
        <div className="mt-4 border rounded-lg p-4">
          <h5 className="text-sm font-medium text-muted-foreground mb-2">
            差異高亮
          </h5>
          <pre className="bg-muted p-3 rounded text-sm overflow-x-auto">
            {patternChanges.map((part: Change, index: number) => (
              <span
                key={index}
                className={cn(
                  part.added && 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
                  part.removed && 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                )}
              >
                {part.value}
              </span>
            ))}
          </pre>
        </div>

        {/* Pattern Diff Summary */}
        {(patternDiff.added.length > 0 || patternDiff.removed.length > 0) && (
          <div className="mt-4 grid grid-cols-2 gap-4">
            {patternDiff.removed.length > 0 && (
              <div className="p-3 bg-red-50 dark:bg-red-900/10 rounded-lg">
                <h6 className="text-sm font-medium text-red-700 dark:text-red-300 mb-2">
                  移除的內容
                </h6>
                <ul className="text-sm text-red-600 dark:text-red-400 space-y-1">
                  {patternDiff.removed.map((line, i) => (
                    <li key={i} className="font-mono">
                      - {line}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {patternDiff.added.length > 0 && (
              <div className="p-3 bg-green-50 dark:bg-green-900/10 rounded-lg">
                <h6 className="text-sm font-medium text-green-700 dark:text-green-300 mb-2">
                  新增的內容
                </h6>
                <ul className="text-sm text-green-600 dark:text-green-400 space-y-1">
                  {patternDiff.added.map((line, i) => (
                    <li key={i} className="font-mono">
                      + {line}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Metadata */}
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div className="p-3 bg-muted rounded-lg">
          <h5 className="font-medium mb-2">版本 {version1.version} 資訊</h5>
          <dl className="space-y-1">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">建立者</dt>
              <dd>{version1.createdBy.name}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">建立時間</dt>
              <dd>{formatDate(version1.createdAt)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">變更原因</dt>
              <dd>{version1.changeReason || '-'}</dd>
            </div>
          </dl>
        </div>
        <div className="p-3 bg-muted rounded-lg">
          <h5 className="font-medium mb-2">版本 {version2.version} 資訊</h5>
          <dl className="space-y-1">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">建立者</dt>
              <dd>{version2.createdBy.name}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">建立時間</dt>
              <dd>{formatDate(version2.createdAt)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">變更原因</dt>
              <dd>{version2.changeReason || '-'}</dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  )
}
```

#### 2.5.4 Rollback Confirm Dialog

```typescript
// src/components/rules/RollbackConfirmDialog.tsx
'use client'

import { useState } from 'react'
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
import { Loader2, AlertTriangle } from 'lucide-react'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (reason?: string) => void
  isLoading: boolean
  targetVersion?: number
}

export function RollbackConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
  isLoading,
  targetVersion,
}: Props) {
  const [reason, setReason] = useState('')

  const handleConfirm = () => {
    onConfirm(reason || undefined)
  }

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setReason('')
    }
    onOpenChange(newOpen)
  }

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
            確認回滾
          </AlertDialogTitle>
          <AlertDialogDescription>
            您確定要將規則回滾到版本 {targetVersion} 嗎？
            <br />
            此操作會創建一個新版本，內容與版本 {targetVersion} 相同。
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-2">
          <Label htmlFor="rollback-reason">回滾原因（選填）</Label>
          <Textarea
            id="rollback-reason"
            placeholder="請輸入回滾原因..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
          />
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>取消</AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirm} disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                處理中...
              </>
            ) : (
              '確認回滾'
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
```

### 2.6 React Query Hooks

```typescript
// src/hooks/use-versions.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import type {
  VersionsResponse,
  CompareResponse,
  RollbackRequest,
  RollbackResult,
} from '@/types/version'

/**
 * 版本歷史查詢 Hook
 */
export function useVersions(ruleId: string) {
  return useQuery({
    queryKey: ['rule-versions', ruleId],
    queryFn: async (): Promise<VersionsResponse> => {
      const response = await apiClient.get(`/api/rules/${ruleId}/versions`)
      if (!response.success) {
        throw new Error(response.error?.detail || 'Failed to fetch versions')
      }
      return response.data
    },
    enabled: !!ruleId,
  })
}

/**
 * 版本對比查詢 Hook
 */
export function useVersionCompare(
  ruleId: string,
  versionId1?: string,
  versionId2?: string,
  enabled: boolean = true
) {
  return useQuery({
    queryKey: ['rule-version-compare', ruleId, versionId1, versionId2],
    queryFn: async (): Promise<CompareResponse> => {
      const response = await apiClient.get(
        `/api/rules/${ruleId}/versions/compare`,
        {
          params: { v1: versionId1, v2: versionId2 },
        }
      )
      if (!response.success) {
        throw new Error(response.error?.detail || 'Failed to compare versions')
      }
      return response.data
    },
    enabled: enabled && !!ruleId && !!versionId1 && !!versionId2,
  })
}

/**
 * 手動回滾 Mutation Hook
 */
export function useManualRollback(ruleId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: RollbackRequest): Promise<RollbackResult> => {
      const response = await apiClient.post(
        `/api/rules/${ruleId}/versions/rollback`,
        data
      )
      if (!response.success) {
        throw new Error(response.error?.detail || 'Rollback failed')
      }
      return response.data
    },
    onSuccess: () => {
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ['rule-versions', ruleId] })
      queryClient.invalidateQueries({ queryKey: ['rule', ruleId] })
      queryClient.invalidateQueries({ queryKey: ['rules'] })
    },
  })
}
```

---

## 3. Test Specifications

### 3.1 Unit Tests

```typescript
// src/services/__tests__/version-history.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { VersionHistoryService } from '../version-history'
import { prisma } from '@/lib/prisma'

vi.mock('@/lib/prisma')

describe('VersionHistoryService', () => {
  let service: VersionHistoryService

  beforeEach(() => {
    service = new VersionHistoryService()
    vi.clearAllMocks()
  })

  describe('createVersion', () => {
    it('should create a new version record', async () => {
      const mockVersion = {
        id: 'version-1',
        ruleId: 'rule-1',
        version: 2,
        extractionType: 'REGEX',
        pattern: '\\d+',
        confidence: 0.85,
        priority: 1,
        changeReason: 'Updated pattern',
        createdBy: 'user-1',
        createdAt: new Date(),
      }

      vi.mocked(prisma.ruleVersion.create).mockResolvedValue(mockVersion)

      const result = await service.createVersion('rule-1', 2, {
        extractionType: 'REGEX',
        pattern: '\\d+',
        confidence: 0.85,
        priority: 1,
        changeReason: 'Updated pattern',
        createdBy: 'user-1',
      })

      expect(result).toEqual(mockVersion)
      expect(prisma.ruleVersion.create).toHaveBeenCalledWith({
        data: {
          ruleId: 'rule-1',
          version: 2,
          extractionType: 'REGEX',
          pattern: '\\d+',
          confidence: 0.85,
          priority: 1,
          changeReason: 'Updated pattern',
          createdBy: 'user-1',
        },
      })
    })
  })

  describe('cleanupOldVersions', () => {
    it('should keep at least 5 versions', async () => {
      const mockVersions = Array.from({ length: 5 }, (_, i) => ({
        id: `version-${i}`,
      }))

      vi.mocked(prisma.ruleVersion.findMany).mockResolvedValue(mockVersions)
      vi.mocked(prisma.ruleVersion.deleteMany).mockResolvedValue({ count: 3 })

      const result = await service.cleanupOldVersions('rule-1', 5)

      expect(result).toBe(3)
      expect(prisma.ruleVersion.findMany).toHaveBeenCalledWith({
        where: { ruleId: 'rule-1' },
        orderBy: { version: 'desc' },
        take: 5,
        select: { id: true },
      })
    })
  })

  describe('canRollback', () => {
    it('should return true when more than 1 version exists', async () => {
      vi.mocked(prisma.ruleVersion.count).mockResolvedValue(3)

      const result = await service.canRollback('rule-1')

      expect(result).toBe(true)
    })

    it('should return false when only 1 version exists', async () => {
      vi.mocked(prisma.ruleVersion.count).mockResolvedValue(1)

      const result = await service.canRollback('rule-1')

      expect(result).toBe(false)
    })
  })
})
```

### 3.2 API Tests

```typescript
// src/app/api/rules/[id]/versions/__tests__/route.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { GET } from '../route'
import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { checkPermission } from '@/lib/permissions'

vi.mock('@/lib/auth')
vi.mock('@/lib/prisma')
vi.mock('@/lib/permissions')

describe('GET /api/rules/[id]/versions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return 401 when not authenticated', async () => {
    vi.mocked(auth).mockResolvedValue(null)

    const request = new NextRequest('http://localhost/api/rules/rule-1/versions')
    const response = await GET(request, { params: { id: 'rule-1' } })
    const data = await response.json()

    expect(response.status).toBe(401)
    expect(data.success).toBe(false)
  })

  it('should return 403 when lacking permission', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'user-1' } })
    vi.mocked(checkPermission).mockResolvedValue(false)

    const request = new NextRequest('http://localhost/api/rules/rule-1/versions')
    const response = await GET(request, { params: { id: 'rule-1' } })
    const data = await response.json()

    expect(response.status).toBe(403)
    expect(data.success).toBe(false)
  })

  it('should return version list successfully', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'user-1' } })
    vi.mocked(checkPermission).mockResolvedValue(true)
    vi.mocked(prisma.mappingRule.findUnique).mockResolvedValue({
      id: 'rule-1',
      name: 'Test Rule',
      version: 3,
      field: { name: 'invoice_number' },
    })
    vi.mocked(prisma.ruleVersion.findMany).mockResolvedValue([
      {
        id: 'v3',
        version: 3,
        extractionType: 'REGEX',
        pattern: '\\d+',
        confidence: 0.9,
        priority: 1,
        changeReason: 'Improved accuracy',
        createdAt: new Date(),
        creator: { id: 'user-1', name: 'Test User', email: 'test@example.com' },
      },
    ])
    vi.mocked(prisma.ruleVersion.count).mockResolvedValue(3)

    const request = new NextRequest('http://localhost/api/rules/rule-1/versions')
    const response = await GET(request, { params: { id: 'rule-1' } })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.data.versions).toHaveLength(1)
    expect(data.data.currentVersion).toBe(3)
  })

  it('should return 404 when rule not found', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'user-1' } })
    vi.mocked(checkPermission).mockResolvedValue(true)
    vi.mocked(prisma.mappingRule.findUnique).mockResolvedValue(null)

    const request = new NextRequest('http://localhost/api/rules/rule-1/versions')
    const response = await GET(request, { params: { id: 'rule-1' } })
    const data = await response.json()

    expect(response.status).toBe(404)
    expect(data.success).toBe(false)
  })
})
```

### 3.3 Component Tests

```typescript
// src/components/rules/__tests__/VersionDiffViewer.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { VersionDiffViewer } from '../VersionDiffViewer'

describe('VersionDiffViewer', () => {
  const mockVersion1 = {
    id: 'v1',
    version: 1,
    extractionType: 'REGEX' as const,
    pattern: 'INV-\\d+',
    confidence: 0.8,
    priority: 0,
    changeReason: 'Initial version',
    createdBy: { id: 'user-1', name: 'User 1', email: 'user1@test.com' },
    createdAt: '2024-01-01T00:00:00Z',
    isActive: false,
  }

  const mockVersion2 = {
    id: 'v2',
    version: 2,
    extractionType: 'REGEX' as const,
    pattern: 'INV-\\d{6}',
    confidence: 0.9,
    priority: 1,
    changeReason: 'Improved pattern',
    createdBy: { id: 'user-2', name: 'User 2', email: 'user2@test.com' },
    createdAt: '2024-01-02T00:00:00Z',
    isActive: true,
  }

  const mockDifferences = [
    {
      field: 'confidence',
      label: '信心度',
      value1: '80%',
      value2: '90%',
      changed: true,
    },
    {
      field: 'priority',
      label: '優先級',
      value1: 0,
      value2: 1,
      changed: true,
    },
  ]

  const mockPatternDiff = {
    added: ['INV-\\d{6}'],
    removed: ['INV-\\d+'],
    unchanged: [],
  }

  it('should render field differences', () => {
    render(
      <VersionDiffViewer
        version1={mockVersion1}
        version2={mockVersion2}
        differences={mockDifferences}
        patternDiff={mockPatternDiff}
      />
    )

    expect(screen.getByText('信心度')).toBeInTheDocument()
    expect(screen.getByText('80%')).toBeInTheDocument()
    expect(screen.getByText('90%')).toBeInTheDocument()
  })

  it('should highlight changed fields', () => {
    render(
      <VersionDiffViewer
        version1={mockVersion1}
        version2={mockVersion2}
        differences={mockDifferences}
        patternDiff={mockPatternDiff}
      />
    )

    // Check for "已變更" indicator
    const changedIndicators = screen.getAllByText('已變更')
    expect(changedIndicators.length).toBe(2)
  })

  it('should display pattern diff', () => {
    render(
      <VersionDiffViewer
        version1={mockVersion1}
        version2={mockVersion2}
        differences={mockDifferences}
        patternDiff={mockPatternDiff}
      />
    )

    expect(screen.getByText('Pattern 差異')).toBeInTheDocument()
    expect(screen.getByText('移除的內容')).toBeInTheDocument()
    expect(screen.getByText('新增的內容')).toBeInTheDocument()
  })
})
```

---

## 4. Implementation Checklist

### Phase 1: Data Layer
- [ ] 確認 RuleVersion Prisma schema 已存在
- [ ] 建立 TypeScript types (`src/types/version.ts`)
- [ ] 實作 VersionHistoryService (`src/services/version-history.ts`)
- [ ] 撰寫 Service 單元測試

### Phase 2: API Layer
- [ ] 實作 GET `/api/rules/[id]/versions` endpoint
- [ ] 實作 GET `/api/rules/[id]/versions/compare` endpoint
- [ ] 實作 POST `/api/rules/[id]/versions/rollback` endpoint
- [ ] 撰寫 API 測試

### Phase 3: UI Layer
- [ ] 建立 Version History Page (`src/app/(dashboard)/rules/[id]/history/page.tsx`)
- [ ] 建立 VersionCompareDialog 組件
- [ ] 建立 VersionDiffViewer 組件
- [ ] 建立 RollbackConfirmDialog 組件
- [ ] 實作 React Query hooks (`src/hooks/use-versions.ts`)
- [ ] 撰寫組件測試

### Phase 4: Integration
- [ ] 在規則詳情頁面加入版本歷史入口
- [ ] 整合回滾功能與 RollbackLog
- [ ] 端對端測試驗證完整流程

---

## 5. Dependencies

### 5.1 Internal Dependencies
- **Story 4-6**: 審核功能（創建版本記錄）
- **MappingRule**: 規則主表
- **Permission System**: RULE_VIEW, RULE_MANAGE 權限

### 5.2 External Libraries
- `diff` - 用於計算文字差異
- `@tanstack/react-query` - 資料獲取與快取
- `zod` - 請求驗證
- `sonner` - Toast 通知

---

## 6. Security Considerations

### 6.1 Authentication & Authorization
- 所有 API 需要 NextAuth session
- 版本查看需要 `RULE_VIEW` 權限
- 回滾操作需要 `RULE_MANAGE` 權限

### 6.2 Data Validation
- 所有輸入使用 Zod schema 驗證
- Version ID 必須是有效 UUID
- 驗證版本屬於正確的規則

### 6.3 Transaction Safety
- 回滾操作使用 Prisma transaction
- 確保 Rule 更新與 Version 創建同時成功或失敗

---

## 7. Performance Considerations

### 7.1 Database Optimization
- `ruleId` 欄位建立索引
- 分頁查詢避免載入過多版本
- 預設 limit 為 20，最大 100

### 7.2 Frontend Optimization
- React Query 快取版本列表
- 對比資料只在 Dialog 開啟時載入
- 使用 skeleton loading 改善 UX

---

## 8. References

- [Story 4-7 定義](../stories/4-7-rule-version-history-management.md)
- [Epic 4 概覽](../../03-epics/sections/epic-4-mapping-rules-auto-learning.md)
- [diff library](https://www.npmjs.com/package/diff)
