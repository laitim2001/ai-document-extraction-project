# Tech Spec: Story 5-4 - 測試規則變更效果

## Story Reference
- **Story ID**: 5.4
- **Epic**: Epic 5 - Forwarder 配置管理
- **Story File**: `docs/04-implementation/stories/5-4-test-rule-change-effect.md`
- **Status**: ready-for-dev
- **Dependencies**: Story 5.3 (規則編輯), Story 4.5 (規則影響分析)

---

## 1. Overview

### 1.1 Purpose
實現規則變更的批量測試功能，讓 Super User 能夠在規則正式生效前，使用歷史發票測試變更效果，並提供詳細的對比結果和影響分析報告，確保規則變更不會造成負面影響。

### 1.2 User Story
**As a** Super User,
**I want** 在規則生效前測試變更效果,
**So that** 可以驗證規則變更不會造成負面影響。

### 1.3 Scope
- 測試配置界面（範圍、文件選擇、時間篩選）
- 歷史發票批量測試
- 原規則 vs 新規則對比結果
- 影響統計與視覺化
- PDF/Excel 測試報告生成與下載

---

## 2. Technical Architecture

### 2.1 System Context

```
┌─────────────────────────────────────────────────────────────────┐
│                    Rule Testing Workflow                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌────────────┐      ┌────────────┐      ┌────────────┐        │
│  │   Config   │ ──▶  │   Start    │ ──▶  │   Create   │        │
│  │   Test     │      │   Test     │      │   Task     │        │
│  └────────────┘      └────────────┘      └────────────┘        │
│                              │                   │              │
│                              ▼                   ▼              │
│  ┌────────────────────────────────────────────────────────┐    │
│  │              Background Job Queue                       │    │
│  │  Execute test for each document in batch                │    │
│  │  1. Apply original rule → get result                    │    │
│  │  2. Apply test rule → get result                        │    │
│  │  3. Compare with actual value                           │    │
│  │  4. Classify change type                                │    │
│  │  5. Update progress (SSE)                               │    │
│  └────────────────────────────────────────────────────────┘    │
│                              │                                  │
│                              ▼                                  │
│  ┌────────────────────────────────────────────────────────┐    │
│  │              Test Results                               │    │
│  │  - Improved (原錯 → 新對)                               │    │
│  │  - Regressed (原對 → 新錯)                              │    │
│  │  - Both Right (都對)                                    │    │
│  │  - Both Wrong (都錯)                                    │    │
│  │  - Unchanged (無變化)                                   │    │
│  └────────────────────────────────────────────────────────┘    │
│                              │                                  │
│                              ▼                                  │
│  ┌────────────────────────────────────────────────────────┐    │
│  │              Report Generation                          │    │
│  │  - PDF Report (summary + details)                       │    │
│  │  - Excel Report (all test cases)                        │    │
│  └────────────────────────────────────────────────────────┘    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 API Architecture

```
POST /api/forwarders/[id]/rules/[ruleId]/test      → 啟動測試任務
GET  /api/test-tasks/[taskId]                       → 取得測試狀態
GET  /api/test-tasks/[taskId]/details               → 取得測試詳情
GET  /api/test-tasks/[taskId]/report?format=pdf     → 下載測試報告
POST /api/test-tasks/[taskId]/cancel                → 取消測試任務
```

### 2.3 Component Architecture

```
RuleTestPage (Client Component)
├── PageHeader
│   ├── Title
│   └── BackButton
├── TestConfigSection (before test starts)
│   └── RuleTestConfig
│       ├── ScopeSelector (all/recent/custom)
│       ├── DateRangeFilter
│       ├── DocumentSelector (for custom scope)
│       └── MaxDocumentsInput
├── TestProgressSection (during test)
│   └── TestProgress
│       ├── ProgressBar
│       ├── DocumentCount
│       └── ElapsedTime
├── TestResultsSection (after completion)
│   ├── ImpactStatistics
│   │   ├── OverviewCards
│   │   ├── ChangeTypePieChart
│   │   └── DecisionRecommendation
│   ├── TestResultComparison
│   │   ├── FilterTabs (improved/regressed/unchanged/all)
│   │   ├── ResultsTable
│   │   └── DetailDialog
│   └── ReportDownloadSection
│       ├── PDFDownloadButton
│       └── ExcelDownloadButton
```

---

## 3. Database Schema

### 3.1 RuleTestTask Model

```prisma
model RuleTestTask {
  id              String          @id @default(uuid())
  ruleId          String          @map("rule_id")
  forwarderId     String          @map("forwarder_id")
  originalPattern Json?           @map("original_pattern")
  testPattern     Json            @map("test_pattern")
  config          Json            // 測試配置
  status          TestTaskStatus  @default(PENDING)
  progress        Int             @default(0)
  totalDocuments  Int             @map("total_documents")
  testedDocuments Int             @default(0) @map("tested_documents")
  results         Json?           // 測試結果摘要
  errorMessage    String?         @map("error_message")
  startedAt       DateTime?       @map("started_at")
  completedAt     DateTime?       @map("completed_at")
  createdById     String          @map("created_by")
  createdAt       DateTime        @default(now()) @map("created_at")

  // Relations
  rule            MappingRule     @relation(fields: [ruleId], references: [id])
  forwarder       Forwarder       @relation(fields: [forwarderId], references: [id])
  creator         User            @relation(fields: [createdById], references: [id])
  details         RuleTestDetail[]

  @@index([status])
  @@index([ruleId])
  @@index([createdById])
  @@map("rule_test_tasks")
}

enum TestTaskStatus {
  PENDING     // 等待執行
  RUNNING     // 執行中
  COMPLETED   // 已完成
  FAILED      // 失敗
  CANCELLED   // 已取消
}
```

### 3.2 RuleTestDetail Model

```prisma
model RuleTestDetail {
  id                String          @id @default(uuid())
  taskId            String          @map("task_id")
  documentId        String          @map("document_id")
  originalResult    String?         @map("original_result")
  originalConfidence Float?         @map("original_confidence")
  testResult        String?         @map("test_result")
  testConfidence    Float?          @map("test_confidence")
  actualValue       String?         @map("actual_value")
  originalAccurate  Boolean         @map("original_accurate")
  testAccurate      Boolean         @map("test_accurate")
  changeType        TestChangeType  @map("change_type")
  notes             String?
  createdAt         DateTime        @default(now()) @map("created_at")

  // Relations
  task              RuleTestTask    @relation(fields: [taskId], references: [id], onDelete: Cascade)
  document          Document        @relation(fields: [documentId], references: [id])

  @@index([taskId])
  @@index([taskId, changeType])
  @@map("rule_test_details")
}

enum TestChangeType {
  IMPROVED    // 改善（原錯 → 新對）
  REGRESSED   // 惡化（原對 → 新錯）
  UNCHANGED   // 無變化
  BOTH_WRONG  // 都錯
  BOTH_RIGHT  // 都對
}
```

### 3.3 Test Config Schema

```typescript
interface TestConfig {
  scope: 'all' | 'recent' | 'custom'
  recentCount?: number          // scope='recent' 時，測試最近 N 筆
  documentIds?: string[]        // scope='custom' 時，指定文件 ID
  dateRange?: {
    start: string               // ISO date string
    end: string
  }
  maxDocuments?: number         // 最大測試數量限制（防止過大任務）
  includeUnconfirmed?: boolean  // 是否包含未確認的文件
}

interface TestResults {
  improved: number
  regressed: number
  unchanged: number
  bothWrong: number
  bothRight: number
  total: number
  improvementRate: number       // improved / total
  regressionRate: number        // regressed / total
  netImprovement: number        // improved - regressed
}
```

---

## 4. API Implementation

### 4.1 POST /api/forwarders/[id]/rules/[ruleId]/test

**Purpose**: 啟動規則測試任務

**File**: `src/app/api/forwarders/[id]/rules/[ruleId]/test/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { hasPermission, PERMISSIONS } from '@/lib/permissions'
import { prisma } from '@/lib/prisma'
import { TestTaskStatus, DocumentStatus } from '@prisma/client'
import { ruleTestingQueue } from '@/lib/queues/rule-testing'

// Request Schema
const testConfigSchema = z.object({
  testPattern: z.record(z.unknown()),
  config: z.object({
    scope: z.enum(['all', 'recent', 'custom']),
    recentCount: z.number().int().min(1).max(1000).optional(),
    documentIds: z.array(z.string().uuid()).optional(),
    dateRange: z.object({
      start: z.string().datetime(),
      end: z.string().datetime()
    }).optional(),
    maxDocuments: z.number().int().min(1).max(1000).default(500),
    includeUnconfirmed: z.boolean().default(false)
  })
})

export async function POST(
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
          detail: '您沒有測試規則的權限'
        },
        { status: 403 }
      )
    }

    // 2. Validate request body
    const body = await request.json()
    const parseResult = testConfigSchema.safeParse(body)

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

    const { testPattern, config } = parseResult.data

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

    if (rule.forwarderId !== params.id) {
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

    // 4. Check for existing running task
    const existingTask = await prisma.ruleTestTask.findFirst({
      where: {
        ruleId: params.ruleId,
        status: { in: [TestTaskStatus.PENDING, TestTaskStatus.RUNNING] }
      }
    })

    if (existingTask) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/conflict',
          title: 'Conflict',
          status: 409,
          detail: '此規則已有進行中的測試任務'
        },
        { status: 409 }
      )
    }

    // 5. Build document query
    const documentWhere = buildDocumentWhereClause(params.id, config)

    // 6. Count documents
    const documentCount = await prisma.document.count({ where: documentWhere })

    if (documentCount === 0) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/bad-request',
          title: 'Bad Request',
          status: 400,
          detail: '沒有符合條件的測試文件'
        },
        { status: 400 }
      )
    }

    const totalDocuments = Math.min(documentCount, config.maxDocuments)

    // 7. Create test task
    const testTask = await prisma.ruleTestTask.create({
      data: {
        ruleId: params.ruleId,
        forwarderId: params.id,
        originalPattern: rule.pattern,
        testPattern,
        config,
        status: TestTaskStatus.PENDING,
        progress: 0,
        totalDocuments,
        testedDocuments: 0,
        createdById: session.user.id
      }
    })

    // 8. Create audit log
    await prisma.auditLog.create({
      data: {
        action: 'RULE_TEST_STARTED',
        entityType: 'RuleTestTask',
        entityId: testTask.id,
        userId: session.user.id,
        details: {
          ruleId: params.ruleId,
          fieldName: rule.fieldName,
          totalDocuments,
          config
        }
      }
    })

    // 9. Queue the test job
    await ruleTestingQueue.add('execute-test', {
      taskId: testTask.id
    }, {
      attempts: 1,
      removeOnComplete: true
    })

    // 10. Return response
    return NextResponse.json({
      success: true,
      data: {
        taskId: testTask.id,
        status: 'PENDING',
        totalDocuments,
        message: `測試任務已建立，將測試 ${totalDocuments} 份文件`
      }
    }, { status: 201 })
  } catch (error) {
    console.error('Error starting rule test:', error)
    return NextResponse.json(
      {
        type: 'https://api.example.com/errors/internal',
        title: 'Internal Server Error',
        status: 500,
        detail: '啟動測試任務時發生錯誤'
      },
      { status: 500 }
    )
  }
}

// Helper function to build document where clause
function buildDocumentWhereClause(
  forwarderId: string,
  config: z.infer<typeof testConfigSchema>['config']
) {
  const baseWhere = {
    forwarderId,
    status: DocumentStatus.COMPLETED
  }

  switch (config.scope) {
    case 'all':
      return {
        ...baseWhere,
        ...(config.dateRange && {
          createdAt: {
            gte: new Date(config.dateRange.start),
            lte: new Date(config.dateRange.end)
          }
        })
      }

    case 'recent':
      return baseWhere

    case 'custom':
      return {
        ...baseWhere,
        id: { in: config.documentIds ?? [] }
      }

    default:
      return baseWhere
  }
}
```

### 4.2 GET /api/test-tasks/[taskId]

**Purpose**: 取得測試任務狀態與結果

**File**: `src/app/api/test-tasks/[taskId]/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { hasPermission, PERMISSIONS } from '@/lib/permissions'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: { taskId: string } }
) {
  try {
    // 1. Authentication
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

    // 2. Validate UUID
    const uuidSchema = z.string().uuid()
    if (!uuidSchema.safeParse(params.taskId).success) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/validation',
          title: 'Validation Error',
          status: 400,
          detail: '無效的任務 ID 格式'
        },
        { status: 400 }
      )
    }

    // 3. Get task
    const task = await prisma.ruleTestTask.findUnique({
      where: { id: params.taskId },
      include: {
        rule: {
          select: {
            id: true,
            fieldName: true,
            extractionType: true
          }
        },
        forwarder: {
          select: {
            id: true,
            name: true
          }
        }
      }
    })

    if (!task) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/not-found',
          title: 'Not Found',
          status: 404,
          detail: '找不到指定的測試任務'
        },
        { status: 404 }
      )
    }

    // 4. Build response
    const response = {
      success: true,
      data: {
        id: task.id,
        ruleId: task.ruleId,
        forwarderId: task.forwarderId,
        rule: task.rule,
        forwarder: task.forwarder,
        status: task.status,
        progress: task.progress,
        totalDocuments: task.totalDocuments,
        testedDocuments: task.testedDocuments,
        results: task.results,
        errorMessage: task.errorMessage,
        startedAt: task.startedAt?.toISOString() ?? null,
        completedAt: task.completedAt?.toISOString() ?? null,
        createdAt: task.createdAt.toISOString()
      }
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Error fetching test task:', error)
    return NextResponse.json(
      {
        type: 'https://api.example.com/errors/internal',
        title: 'Internal Server Error',
        status: 500,
        detail: '取得測試任務時發生錯誤'
      },
      { status: 500 }
    )
  }
}
```

### 4.3 GET /api/test-tasks/[taskId]/details

**Purpose**: 取得測試詳情列表

**File**: `src/app/api/test-tasks/[taskId]/details/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { TestChangeType } from '@prisma/client'

// Query params schema
const querySchema = z.object({
  changeType: z.nativeEnum(TestChangeType).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(10).max(100).default(20)
})

export async function GET(
  request: NextRequest,
  { params }: { params: { taskId: string } }
) {
  try {
    // 1. Authentication
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

    // 2. Validate task ID
    const uuidSchema = z.string().uuid()
    if (!uuidSchema.safeParse(params.taskId).success) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/validation',
          title: 'Validation Error',
          status: 400,
          detail: '無效的任務 ID 格式'
        },
        { status: 400 }
      )
    }

    // 3. Check task exists
    const taskExists = await prisma.ruleTestTask.findUnique({
      where: { id: params.taskId },
      select: { id: true }
    })

    if (!taskExists) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/not-found',
          title: 'Not Found',
          status: 404,
          detail: '找不到指定的測試任務'
        },
        { status: 404 }
      )
    }

    // 4. Parse query params
    const { searchParams } = new URL(request.url)
    const queryParseResult = querySchema.safeParse({
      changeType: searchParams.get('changeType') || undefined,
      page: searchParams.get('page') || 1,
      pageSize: searchParams.get('pageSize') || 20
    })

    if (!queryParseResult.success) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/validation',
          title: 'Validation Error',
          status: 400,
          detail: '無效的查詢參數',
          errors: queryParseResult.error.flatten().fieldErrors
        },
        { status: 400 }
      )
    }

    const { changeType, page, pageSize } = queryParseResult.data

    // 5. Build where clause
    const where = {
      taskId: params.taskId,
      ...(changeType && { changeType })
    }

    // 6. Get details with pagination
    const [totalItems, details] = await Promise.all([
      prisma.ruleTestDetail.count({ where }),
      prisma.ruleTestDetail.findMany({
        where,
        include: {
          document: {
            select: {
              id: true,
              fileName: true,
              thumbnailUrl: true,
              createdAt: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize
      })
    ])

    // 7. Build response
    return NextResponse.json({
      success: true,
      data: {
        taskId: params.taskId,
        items: details.map(detail => ({
          id: detail.id,
          document: detail.document,
          originalResult: detail.originalResult,
          originalConfidence: detail.originalConfidence,
          testResult: detail.testResult,
          testConfidence: detail.testConfidence,
          actualValue: detail.actualValue,
          originalAccurate: detail.originalAccurate,
          testAccurate: detail.testAccurate,
          changeType: detail.changeType,
          notes: detail.notes,
          createdAt: detail.createdAt.toISOString()
        })),
        pagination: {
          page,
          pageSize,
          totalItems,
          totalPages: Math.ceil(totalItems / pageSize)
        }
      }
    })
  } catch (error) {
    console.error('Error fetching test details:', error)
    return NextResponse.json(
      {
        type: 'https://api.example.com/errors/internal',
        title: 'Internal Server Error',
        status: 500,
        detail: '取得測試詳情時發生錯誤'
      },
      { status: 500 }
    )
  }
}
```

### 4.4 GET /api/test-tasks/[taskId]/report

**Purpose**: 下載測試報告（PDF 或 Excel）

**File**: `src/app/api/test-tasks/[taskId]/report/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { TestTaskStatus } from '@prisma/client'
import { generatePDFReport } from '@/lib/reports/pdf-generator'
import { generateExcelReport } from '@/lib/reports/excel-generator'

export async function GET(
  request: NextRequest,
  { params }: { params: { taskId: string } }
) {
  try {
    // 1. Authentication
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

    // 2. Get format from query
    const { searchParams } = new URL(request.url)
    const format = searchParams.get('format') ?? 'pdf'

    if (!['pdf', 'xlsx'].includes(format)) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/validation',
          title: 'Validation Error',
          status: 400,
          detail: '不支援的報告格式，請使用 pdf 或 xlsx'
        },
        { status: 400 }
      )
    }

    // 3. Get task with all details
    const task = await prisma.ruleTestTask.findUnique({
      where: { id: params.taskId },
      include: {
        rule: {
          select: {
            id: true,
            fieldName: true,
            extractionType: true
          }
        },
        forwarder: {
          select: {
            id: true,
            name: true,
            code: true
          }
        },
        creator: {
          select: {
            id: true,
            name: true
          }
        },
        details: {
          include: {
            document: {
              select: {
                id: true,
                fileName: true
              }
            }
          },
          orderBy: { createdAt: 'asc' }
        }
      }
    })

    if (!task) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/not-found',
          title: 'Not Found',
          status: 404,
          detail: '找不到指定的測試任務'
        },
        { status: 404 }
      )
    }

    if (task.status !== TestTaskStatus.COMPLETED) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/bad-request',
          title: 'Bad Request',
          status: 400,
          detail: '測試尚未完成，無法生成報告'
        },
        { status: 400 }
      )
    }

    // 4. Generate report
    let reportBuffer: Buffer
    let contentType: string
    let filename: string

    const reportData = {
      task,
      results: task.results as any,
      details: task.details,
      generatedAt: new Date(),
      generatedBy: session.user.name ?? 'Unknown'
    }

    if (format === 'pdf') {
      reportBuffer = await generatePDFReport(reportData)
      contentType = 'application/pdf'
      filename = `rule-test-report-${task.id}.pdf`
    } else {
      reportBuffer = await generateExcelReport(reportData)
      contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      filename = `rule-test-report-${task.id}.xlsx`
    }

    // 5. Return file
    return new NextResponse(reportBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': reportBuffer.length.toString()
      }
    })
  } catch (error) {
    console.error('Error generating report:', error)
    return NextResponse.json(
      {
        type: 'https://api.example.com/errors/internal',
        title: 'Internal Server Error',
        status: 500,
        detail: '生成報告時發生錯誤'
      },
      { status: 500 }
    )
  }
}
```

---

## 5. Rule Testing Service

### 5.1 Rule Testing Queue Worker

**File**: `src/lib/queues/rule-testing.ts`

```typescript
import { Queue, Worker, Job } from 'bullmq'
import { prisma } from '@/lib/prisma'
import { RuleTestingService } from '@/services/rule-testing'
import { redis } from '@/lib/redis'

// Create queue
export const ruleTestingQueue = new Queue('rule-testing', {
  connection: redis,
  defaultJobOptions: {
    attempts: 1,
    removeOnComplete: true,
    removeOnFail: false
  }
})

// Create worker
const worker = new Worker(
  'rule-testing',
  async (job: Job) => {
    const { taskId } = job.data

    const service = new RuleTestingService()

    // Set up progress reporting
    service.on('progress', async (data) => {
      await job.updateProgress(data.progress)
    })

    await service.executeTest(taskId)
  },
  {
    connection: redis,
    concurrency: 2 // Max 2 concurrent tests
  }
)

worker.on('completed', (job) => {
  console.log(`Rule test job ${job.id} completed`)
})

worker.on('failed', (job, error) => {
  console.error(`Rule test job ${job?.id} failed:`, error)
})
```

### 5.2 Rule Testing Service

**File**: `src/services/rule-testing.ts`

```typescript
import { EventEmitter } from 'events'
import { prisma } from '@/lib/prisma'
import { RuleExecutor } from '@/lib/extraction/rule-executor'
import {
  RuleTestTask,
  Document,
  TestTaskStatus,
  TestChangeType,
  DocumentStatus,
  ExtractionType
} from '@prisma/client'

interface TestResults {
  improved: number
  regressed: number
  unchanged: number
  bothWrong: number
  bothRight: number
  total: number
  improvementRate: number
  regressionRate: number
  netImprovement: number
}

interface TestConfig {
  scope: 'all' | 'recent' | 'custom'
  recentCount?: number
  documentIds?: string[]
  dateRange?: { start: string; end: string }
  maxDocuments: number
  includeUnconfirmed?: boolean
}

export class RuleTestingService extends EventEmitter {
  private executor: RuleExecutor

  constructor() {
    super()
    this.executor = new RuleExecutor()
  }

  async executeTest(taskId: string): Promise<void> {
    // 1. Get task
    const task = await prisma.ruleTestTask.findUnique({
      where: { id: taskId },
      include: {
        rule: true,
        forwarder: true
      }
    })

    if (!task) {
      throw new Error('Test task not found')
    }

    // 2. Update status to RUNNING
    await prisma.ruleTestTask.update({
      where: { id: taskId },
      data: {
        status: TestTaskStatus.RUNNING,
        startedAt: new Date()
      }
    })

    try {
      // 3. Get test documents
      const documents = await this.getTestDocuments(task)

      // 4. Initialize results
      const results: TestResults = {
        improved: 0,
        regressed: 0,
        unchanged: 0,
        bothWrong: 0,
        bothRight: 0,
        total: documents.length,
        improvementRate: 0,
        regressionRate: 0,
        netImprovement: 0
      }

      // 5. Test each document
      for (let i = 0; i < documents.length; i++) {
        const document = documents[i]

        try {
          const detail = await this.testDocument(task, document)

          // Update results counter
          switch (detail.changeType) {
            case TestChangeType.IMPROVED:
              results.improved++
              break
            case TestChangeType.REGRESSED:
              results.regressed++
              break
            case TestChangeType.BOTH_RIGHT:
              results.bothRight++
              break
            case TestChangeType.BOTH_WRONG:
              results.bothWrong++
              break
            default:
              results.unchanged++
          }
        } catch (error) {
          console.error(`Error testing document ${document.id}:`, error)
          // Continue with next document
        }

        // 6. Update progress
        const progress = Math.round(((i + 1) / documents.length) * 100)
        await prisma.ruleTestTask.update({
          where: { id: taskId },
          data: {
            progress,
            testedDocuments: i + 1
          }
        })

        // Emit progress event
        this.emit('progress', {
          taskId,
          progress,
          tested: i + 1,
          total: documents.length
        })
      }

      // 7. Calculate final rates
      results.improvementRate = results.total > 0 ? results.improved / results.total : 0
      results.regressionRate = results.total > 0 ? results.regressed / results.total : 0
      results.netImprovement = results.improved - results.regressed

      // 8. Complete task
      await prisma.ruleTestTask.update({
        where: { id: taskId },
        data: {
          status: TestTaskStatus.COMPLETED,
          completedAt: new Date(),
          results
        }
      })

      this.emit('completed', { taskId, results })
    } catch (error) {
      // Handle failure
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'

      await prisma.ruleTestTask.update({
        where: { id: taskId },
        data: {
          status: TestTaskStatus.FAILED,
          errorMessage,
          completedAt: new Date()
        }
      })

      this.emit('failed', { taskId, error: errorMessage })
      throw error
    }
  }

  private async getTestDocuments(task: RuleTestTask & { forwarder: any }): Promise<Document[]> {
    const config = task.config as TestConfig

    const baseWhere = {
      forwarderId: task.forwarderId,
      status: DocumentStatus.COMPLETED
    }

    let orderBy: any = { createdAt: 'desc' as const }
    let take = config.maxDocuments

    switch (config.scope) {
      case 'custom':
        return prisma.document.findMany({
          where: {
            ...baseWhere,
            id: { in: config.documentIds ?? [] }
          },
          take
        })

      case 'recent':
        return prisma.document.findMany({
          where: baseWhere,
          orderBy,
          take: Math.min(config.recentCount ?? 100, take)
        })

      case 'all':
      default:
        const where = {
          ...baseWhere,
          ...(config.dateRange && {
            createdAt: {
              gte: new Date(config.dateRange.start),
              lte: new Date(config.dateRange.end)
            }
          })
        }
        return prisma.document.findMany({
          where,
          orderBy,
          take
        })
    }
  }

  private async testDocument(
    task: RuleTestTask & { rule: any },
    document: Document
  ): Promise<{ changeType: TestChangeType }> {
    // 1. Get actual value (confirmed extraction result)
    const actualValue = await this.getActualValue(document.id, task.rule.fieldName)

    // 2. Get document OCR data
    const ocrResult = await prisma.ocrResult.findUnique({
      where: { documentId: document.id }
    })

    const docData = {
      id: document.id,
      fileUrl: document.fileUrl,
      ocrText: ocrResult?.text ?? '',
      ocrData: ocrResult?.data
    }

    // 3. Apply original rule
    let originalResult: { value: string | null; confidence: number } = { value: null, confidence: 0 }
    if (task.originalPattern) {
      try {
        originalResult = await this.executor.execute({
          extractionType: task.rule.extractionType as ExtractionType,
          pattern: task.originalPattern as Record<string, unknown>,
          document: docData
        })
      } catch {
        // Original rule failed
      }
    }

    // 4. Apply test rule
    let testResult: { value: string | null; confidence: number } = { value: null, confidence: 0 }
    try {
      testResult = await this.executor.execute({
        extractionType: task.rule.extractionType as ExtractionType,
        pattern: task.testPattern as Record<string, unknown>,
        document: docData
      })
    } catch {
      // Test rule failed
    }

    // 5. Determine accuracy
    const originalAccurate = this.isAccurate(originalResult.value, actualValue)
    const testAccurate = this.isAccurate(testResult.value, actualValue)

    // 6. Determine change type
    const changeType = this.determineChangeType(originalAccurate, testAccurate)

    // 7. Create detail record
    await prisma.ruleTestDetail.create({
      data: {
        taskId: task.id,
        documentId: document.id,
        originalResult: originalResult.value,
        originalConfidence: originalResult.confidence,
        testResult: testResult.value,
        testConfidence: testResult.confidence,
        actualValue,
        originalAccurate,
        testAccurate,
        changeType
      }
    })

    return { changeType }
  }

  private async getActualValue(documentId: string, fieldName: string): Promise<string | null> {
    // Get confirmed extraction result as actual value
    const result = await prisma.extractionResult.findFirst({
      where: {
        documentId,
        fieldName,
        status: { in: ['CONFIRMED', 'CORRECTED'] }
      },
      orderBy: { createdAt: 'desc' }
    })

    if (result?.status === 'CORRECTED') {
      return result.correctedValue
    }
    return result?.extractedValue ?? null
  }

  private isAccurate(extractedValue: string | null, actualValue: string | null): boolean {
    if (extractedValue === null && actualValue === null) return true
    if (extractedValue === null || actualValue === null) return false

    // Normalize for comparison
    const normalize = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ')
    return normalize(extractedValue) === normalize(actualValue)
  }

  private determineChangeType(originalAccurate: boolean, testAccurate: boolean): TestChangeType {
    if (!originalAccurate && testAccurate) return TestChangeType.IMPROVED
    if (originalAccurate && !testAccurate) return TestChangeType.REGRESSED
    if (originalAccurate && testAccurate) return TestChangeType.BOTH_RIGHT
    if (!originalAccurate && !testAccurate) return TestChangeType.BOTH_WRONG
    return TestChangeType.UNCHANGED
  }
}
```

---

## 6. Report Generation

### 6.1 PDF Report Generator

**File**: `src/lib/reports/pdf-generator.ts`

```typescript
import PDFDocument from 'pdfkit'
import { TestChangeType } from '@prisma/client'

interface ReportData {
  task: {
    id: string
    rule: { fieldName: string; extractionType: string }
    forwarder: { name: string; code: string }
    totalDocuments: number
    startedAt: Date | null
    completedAt: Date | null
  }
  results: {
    improved: number
    regressed: number
    unchanged: number
    bothWrong: number
    bothRight: number
    improvementRate: number
    regressionRate: number
    netImprovement: number
  }
  details: {
    document: { fileName: string }
    originalResult: string | null
    testResult: string | null
    actualValue: string | null
    changeType: TestChangeType
  }[]
  generatedAt: Date
  generatedBy: string
}

export async function generatePDFReport(data: ReportData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' })
    const chunks: Buffer[] = []

    doc.on('data', (chunk) => chunks.push(chunk))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    // Title
    doc.fontSize(20).text('規則測試報告', { align: 'center' })
    doc.moveDown()

    // Basic Info
    doc.fontSize(14).text('基本資訊', { underline: true })
    doc.fontSize(10)
    doc.text(`Forwarder: ${data.task.forwarder.name} (${data.task.forwarder.code})`)
    doc.text(`欄位名稱: ${data.task.rule.fieldName}`)
    doc.text(`提取類型: ${data.task.rule.extractionType}`)
    doc.text(`測試文件數: ${data.task.totalDocuments}`)
    doc.text(`開始時間: ${data.task.startedAt?.toLocaleString('zh-TW') ?? 'N/A'}`)
    doc.text(`完成時間: ${data.task.completedAt?.toLocaleString('zh-TW') ?? 'N/A'}`)
    doc.moveDown()

    // Results Summary
    doc.fontSize(14).text('測試結果摘要', { underline: true })
    doc.fontSize(10)
    doc.text(`改善 (原錯→新對): ${data.results.improved} (${(data.results.improvementRate * 100).toFixed(1)}%)`)
    doc.text(`惡化 (原對→新錯): ${data.results.regressed} (${(data.results.regressionRate * 100).toFixed(1)}%)`)
    doc.text(`都對: ${data.results.bothRight}`)
    doc.text(`都錯: ${data.results.bothWrong}`)
    doc.text(`淨改善: ${data.results.netImprovement}`)
    doc.moveDown()

    // Recommendation
    doc.fontSize(14).text('決策建議', { underline: true })
    doc.fontSize(10)
    const recommendation = generateRecommendation(data.results)
    doc.text(recommendation)
    doc.moveDown()

    // Details (first 50)
    doc.addPage()
    doc.fontSize(14).text('測試詳情 (前 50 筆)', { underline: true })
    doc.fontSize(8)

    const detailsToShow = data.details.slice(0, 50)
    detailsToShow.forEach((detail, index) => {
      const changeLabel = getChangeTypeLabel(detail.changeType)
      doc.text(`${index + 1}. ${detail.document.fileName}`)
      doc.text(`   原結果: ${detail.originalResult ?? '(無)'} | 新結果: ${detail.testResult ?? '(無)'}`)
      doc.text(`   實際值: ${detail.actualValue ?? '(無)'} | 變化: ${changeLabel}`)
      doc.moveDown(0.5)
    })

    // Footer
    doc.fontSize(8)
    doc.text(`報告產生時間: ${data.generatedAt.toLocaleString('zh-TW')}`, { align: 'right' })
    doc.text(`產生者: ${data.generatedBy}`, { align: 'right' })

    doc.end()
  })
}

function generateRecommendation(results: ReportData['results']): string {
  const { improvementRate, regressionRate, netImprovement, regressed } = results

  if (regressed > 0 && regressionRate > 0.05) {
    return `不建議採用此變更。惡化案例達 ${regressed} 筆 (${(regressionRate * 100).toFixed(1)}%)，超過 5% 閾值。建議重新檢視規則 Pattern 或增加更多測試案例。`
  }

  if (netImprovement > 0 && regressionRate <= 0.02) {
    return `建議採用此變更。淨改善 ${netImprovement} 筆，惡化率 ${(regressionRate * 100).toFixed(1)}% 在可接受範圍內。`
  }

  if (netImprovement <= 0) {
    return `此變更無明顯改善效果 (淨改善: ${netImprovement})。建議重新評估變更的必要性。`
  }

  return `變更效果中等。改善率 ${(improvementRate * 100).toFixed(1)}%，惡化率 ${(regressionRate * 100).toFixed(1)}%。建議根據實際業務需求決定是否採用。`
}

function getChangeTypeLabel(type: TestChangeType): string {
  const labels: Record<TestChangeType, string> = {
    IMPROVED: '改善',
    REGRESSED: '惡化',
    BOTH_RIGHT: '都對',
    BOTH_WRONG: '都錯',
    UNCHANGED: '無變化'
  }
  return labels[type]
}
```

### 6.2 Excel Report Generator

**File**: `src/lib/reports/excel-generator.ts`

```typescript
import ExcelJS from 'exceljs'
import { TestChangeType } from '@prisma/client'

interface ReportData {
  task: {
    id: string
    rule: { fieldName: string; extractionType: string }
    forwarder: { name: string; code: string }
    totalDocuments: number
    startedAt: Date | null
    completedAt: Date | null
  }
  results: {
    improved: number
    regressed: number
    unchanged: number
    bothWrong: number
    bothRight: number
    improvementRate: number
    regressionRate: number
    netImprovement: number
  }
  details: {
    document: { fileName: string }
    originalResult: string | null
    originalConfidence: number | null
    testResult: string | null
    testConfidence: number | null
    actualValue: string | null
    changeType: TestChangeType
  }[]
  generatedAt: Date
  generatedBy: string
}

export async function generateExcelReport(data: ReportData): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = data.generatedBy
  workbook.created = data.generatedAt

  // Summary Sheet
  const summarySheet = workbook.addWorksheet('摘要')

  summarySheet.columns = [
    { header: '項目', key: 'item', width: 20 },
    { header: '值', key: 'value', width: 40 }
  ]

  summarySheet.addRows([
    { item: 'Forwarder', value: `${data.task.forwarder.name} (${data.task.forwarder.code})` },
    { item: '欄位名稱', value: data.task.rule.fieldName },
    { item: '提取類型', value: data.task.rule.extractionType },
    { item: '測試文件數', value: data.task.totalDocuments },
    { item: '開始時間', value: data.task.startedAt?.toLocaleString('zh-TW') ?? 'N/A' },
    { item: '完成時間', value: data.task.completedAt?.toLocaleString('zh-TW') ?? 'N/A' },
    { item: '', value: '' },
    { item: '改善數量', value: data.results.improved },
    { item: '改善率', value: `${(data.results.improvementRate * 100).toFixed(1)}%` },
    { item: '惡化數量', value: data.results.regressed },
    { item: '惡化率', value: `${(data.results.regressionRate * 100).toFixed(1)}%` },
    { item: '都對數量', value: data.results.bothRight },
    { item: '都錯數量', value: data.results.bothWrong },
    { item: '淨改善', value: data.results.netImprovement }
  ])

  // Style header row
  summarySheet.getRow(1).font = { bold: true }
  summarySheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE0E0E0' }
  }

  // Details Sheet
  const detailsSheet = workbook.addWorksheet('測試詳情')

  detailsSheet.columns = [
    { header: '序號', key: 'index', width: 8 },
    { header: '文件名稱', key: 'fileName', width: 40 },
    { header: '原規則結果', key: 'originalResult', width: 25 },
    { header: '原信心度', key: 'originalConfidence', width: 12 },
    { header: '新規則結果', key: 'testResult', width: 25 },
    { header: '新信心度', key: 'testConfidence', width: 12 },
    { header: '實際值', key: 'actualValue', width: 25 },
    { header: '變化類型', key: 'changeType', width: 12 }
  ]

  // Add data rows
  data.details.forEach((detail, index) => {
    const row = detailsSheet.addRow({
      index: index + 1,
      fileName: detail.document.fileName,
      originalResult: detail.originalResult ?? '',
      originalConfidence: detail.originalConfidence ? `${(detail.originalConfidence * 100).toFixed(1)}%` : '',
      testResult: detail.testResult ?? '',
      testConfidence: detail.testConfidence ? `${(detail.testConfidence * 100).toFixed(1)}%` : '',
      actualValue: detail.actualValue ?? '',
      changeType: getChangeTypeLabel(detail.changeType)
    })

    // Color code by change type
    const color = getChangeTypeColor(detail.changeType)
    row.eachCell((cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: color }
      }
    })
  })

  // Style header row
  detailsSheet.getRow(1).font = { bold: true }
  detailsSheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF4472C4' }
  }
  detailsSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }

  // Auto filter
  detailsSheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: data.details.length + 1, column: 8 }
  }

  // Generate buffer
  const buffer = await workbook.xlsx.writeBuffer()
  return Buffer.from(buffer)
}

function getChangeTypeLabel(type: TestChangeType): string {
  const labels: Record<TestChangeType, string> = {
    IMPROVED: '改善',
    REGRESSED: '惡化',
    BOTH_RIGHT: '都對',
    BOTH_WRONG: '都錯',
    UNCHANGED: '無變化'
  }
  return labels[type]
}

function getChangeTypeColor(type: TestChangeType): string {
  const colors: Record<TestChangeType, string> = {
    IMPROVED: 'FFD4EDDA',   // Light green
    REGRESSED: 'FFF8D7DA', // Light red
    BOTH_RIGHT: 'FFD1ECF1', // Light blue
    BOTH_WRONG: 'FFFFF3CD', // Light yellow
    UNCHANGED: 'FFFFFFFF'  // White
  }
  return colors[type]
}
```

---

## 7. Frontend Components

### 7.1 RuleTestPage

**File**: `src/app/(dashboard)/forwarders/[id]/rules/[ruleId]/test/page.tsx`

```typescript
'use client'

import { useState, useEffect } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { RuleTestConfig } from '@/components/rules/RuleTestConfig'
import { ImpactStatistics } from '@/components/rules/ImpactStatistics'
import { TestResultComparison } from '@/components/rules/TestResultComparison'
import { ArrowLeft, Play, Loader2, Download, AlertCircle, CheckCircle } from 'lucide-react'
import { toast } from 'sonner'

interface Props {
  params: { id: string; ruleId: string }
  searchParams: { pattern?: string }
}

interface TestConfig {
  scope: 'all' | 'recent' | 'custom'
  recentCount?: number
  documentIds?: string[]
  dateRange?: { start: string; end: string }
  maxDocuments: number
}

// API functions
async function fetchRule(ruleId: string) {
  const response = await fetch(`/api/rules/${ruleId}`)
  if (!response.ok) throw new Error('Failed to fetch rule')
  return response.json()
}

async function startTest(
  forwarderId: string,
  ruleId: string,
  data: { testPattern: any; config: TestConfig }
) {
  const response = await fetch(`/api/forwarders/${forwarderId}/rules/${ruleId}/test`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  })
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.detail || 'Failed to start test')
  }
  return response.json()
}

async function fetchTestStatus(taskId: string) {
  const response = await fetch(`/api/test-tasks/${taskId}`)
  if (!response.ok) throw new Error('Failed to fetch status')
  return response.json()
}

async function downloadReport(taskId: string, format: 'pdf' | 'xlsx') {
  const response = await fetch(`/api/test-tasks/${taskId}/report?format=${format}`)
  if (!response.ok) throw new Error('Failed to download report')

  const blob = await response.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `rule-test-report-${taskId}.${format}`
  a.click()
  URL.revokeObjectURL(url)
}

export default function RuleTestPage({ params, searchParams }: Props) {
  const router = useRouter()
  const [taskId, setTaskId] = useState<string | null>(null)
  const [config, setConfig] = useState<TestConfig>({
    scope: 'recent',
    recentCount: 100,
    maxDocuments: 500
  })

  // Fetch rule info
  const { data: ruleData, isLoading: isLoadingRule } = useQuery({
    queryKey: ['rule', params.ruleId],
    queryFn: () => fetchRule(params.ruleId)
  })

  // Start test mutation
  const startTestMutation = useMutation({
    mutationFn: (testConfig: TestConfig) => {
      const testPattern = searchParams.pattern
        ? JSON.parse(searchParams.pattern)
        : ruleData?.data?.pattern

      return startTest(params.id, params.ruleId, {
        testPattern,
        config: testConfig
      })
    },
    onSuccess: (result) => {
      setTaskId(result.data.taskId)
      toast.success(result.data.message)
    },
    onError: (error: Error) => {
      toast.error(error.message)
    }
  })

  // Poll test status
  const { data: taskStatus, isLoading: isLoadingStatus } = useQuery({
    queryKey: ['test-task', taskId],
    queryFn: () => fetchTestStatus(taskId!),
    enabled: !!taskId,
    refetchInterval: (data) => {
      const status = data?.data?.status
      return status === 'RUNNING' || status === 'PENDING' ? 1000 : false
    }
  })

  // Download mutation
  const downloadMutation = useMutation({
    mutationFn: (format: 'pdf' | 'xlsx') => downloadReport(taskId!, format),
    onSuccess: () => {
      toast.success('報告下載中...')
    },
    onError: (error: Error) => {
      toast.error(error.message)
    }
  })

  const status = taskStatus?.data?.status
  const results = taskStatus?.data?.results

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push(`/forwarders/${params.id}/rules`)}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">規則測試</h1>
          <p className="text-muted-foreground">
            測試規則變更對歷史發票的影響
          </p>
        </div>
      </div>

      {/* Rule Info */}
      {isLoadingRule ? (
        <Skeleton className="h-20" />
      ) : ruleData?.data && (
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center gap-4">
              <div>
                <p className="text-sm text-muted-foreground">欄位名稱</p>
                <p className="font-medium">{ruleData.data.fieldName}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">提取類型</p>
                <p className="font-medium">{ruleData.data.extractionType}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Test Configuration (before test starts) */}
      {!taskId && (
        <Card>
          <CardHeader>
            <CardTitle>測試配置</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <RuleTestConfig
              forwarderId={params.id}
              value={config}
              onChange={setConfig}
            />
            <div className="flex justify-end">
              <Button
                onClick={() => startTestMutation.mutate(config)}
                disabled={startTestMutation.isPending}
              >
                {startTestMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                <Play className="mr-2 h-4 w-4" />
                開始測試
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Test Progress */}
      {taskId && (status === 'PENDING' || status === 'RUNNING') && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin" />
              測試進行中
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Progress value={taskStatus?.data?.progress ?? 0} />
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>
                已測試 {taskStatus?.data?.testedDocuments ?? 0} / {taskStatus?.data?.totalDocuments ?? 0} 份文件
              </span>
              <span>{taskStatus?.data?.progress ?? 0}%</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Test Failed */}
      {status === 'FAILED' && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>測試失敗</AlertTitle>
          <AlertDescription>
            {taskStatus?.data?.errorMessage ?? '發生未知錯誤'}
          </AlertDescription>
        </Alert>
      )}

      {/* Test Results */}
      {status === 'COMPLETED' && results && (
        <>
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertTitle>測試完成</AlertTitle>
            <AlertDescription>
              共測試 {taskStatus?.data?.totalDocuments} 份文件
            </AlertDescription>
          </Alert>

          <ImpactStatistics results={results} />

          <TestResultComparison taskId={taskId!} />

          {/* Download Section */}
          <Card>
            <CardHeader>
              <CardTitle>下載報告</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4">
                <Button
                  variant="outline"
                  onClick={() => downloadMutation.mutate('xlsx')}
                  disabled={downloadMutation.isPending}
                >
                  <Download className="mr-2 h-4 w-4" />
                  下載 Excel 報告
                </Button>
                <Button
                  onClick={() => downloadMutation.mutate('pdf')}
                  disabled={downloadMutation.isPending}
                >
                  <Download className="mr-2 h-4 w-4" />
                  下載 PDF 報告
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
```

### 7.2 ImpactStatistics Component

**File**: `src/components/rules/ImpactStatistics.tsx`

```typescript
'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts'
import { TrendingUp, TrendingDown, CheckCircle, XCircle, AlertTriangle } from 'lucide-react'

interface TestResults {
  improved: number
  regressed: number
  unchanged: number
  bothWrong: number
  bothRight: number
  total: number
  improvementRate: number
  regressionRate: number
  netImprovement: number
}

interface ImpactStatisticsProps {
  results: TestResults
}

const COLORS = {
  improved: '#22c55e',
  regressed: '#ef4444',
  bothRight: '#3b82f6',
  bothWrong: '#eab308',
  unchanged: '#9ca3af'
}

export function ImpactStatistics({ results }: ImpactStatisticsProps) {
  const {
    improved,
    regressed,
    bothRight,
    bothWrong,
    total,
    improvementRate,
    regressionRate,
    netImprovement
  } = results

  // Pie chart data
  const chartData = [
    { name: '改善', value: improved, color: COLORS.improved },
    { name: '惡化', value: regressed, color: COLORS.regressed },
    { name: '都對', value: bothRight, color: COLORS.bothRight },
    { name: '都錯', value: bothWrong, color: COLORS.bothWrong }
  ].filter(item => item.value > 0)

  // Generate recommendation
  const recommendation = generateRecommendation(results)

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard
          icon={<TrendingUp className="h-4 w-4 text-green-600" />}
          title="改善"
          value={improved}
          percentage={improvementRate}
          description="原錯 → 新對"
          variant="success"
        />
        <StatCard
          icon={<TrendingDown className="h-4 w-4 text-red-600" />}
          title="惡化"
          value={regressed}
          percentage={regressionRate}
          description="原對 → 新錯"
          variant="destructive"
        />
        <StatCard
          icon={<CheckCircle className="h-4 w-4 text-blue-600" />}
          title="都對"
          value={bothRight}
          percentage={total > 0 ? bothRight / total : 0}
          description="兩者都正確"
          variant="default"
        />
        <StatCard
          icon={<XCircle className="h-4 w-4 text-yellow-600" />}
          title="都錯"
          value={bothWrong}
          percentage={total > 0 ? bothWrong / total : 0}
          description="兩者都錯誤"
          variant="warning"
        />
      </div>

      {/* Net Improvement */}
      <Card>
        <CardContent className="py-6">
          <div className="flex items-center justify-center gap-8">
            <div className="text-center">
              <p className="text-sm text-muted-foreground">淨改善</p>
              <p className={`text-4xl font-bold ${
                netImprovement > 0 ? 'text-green-600' :
                netImprovement < 0 ? 'text-red-600' :
                'text-muted-foreground'
              }`}>
                {netImprovement > 0 ? '+' : ''}{netImprovement}
              </p>
              <p className="text-sm text-muted-foreground">
                改善數 - 惡化數
              </p>
            </div>
            <div className="h-16 w-px bg-border" />
            <div className="text-center">
              <p className="text-sm text-muted-foreground">測試總數</p>
              <p className="text-4xl font-bold">{total}</p>
              <p className="text-sm text-muted-foreground">份文件</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Distribution Chart */}
      <Card>
        <CardHeader>
          <CardTitle>結果分布</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={chartData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={80}
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(1)}%`}
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip formatter={(value: number) => value.toLocaleString()} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Recommendation */}
      <Alert variant={recommendation.variant}>
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>決策建議</AlertTitle>
        <AlertDescription>{recommendation.message}</AlertDescription>
      </Alert>
    </div>
  )
}

// Stat Card Component
interface StatCardProps {
  icon: React.ReactNode
  title: string
  value: number
  percentage: number
  description: string
  variant: 'success' | 'destructive' | 'default' | 'warning'
}

function StatCard({ icon, title, value, percentage, description, variant }: StatCardProps) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center gap-2 mb-2">
          {icon}
          <span className="text-sm font-medium">{title}</span>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold">{value}</span>
          <Badge variant={variant === 'warning' ? 'outline' : variant as any}>
            {(percentage * 100).toFixed(1)}%
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground mt-1">{description}</p>
      </CardContent>
    </Card>
  )
}

// Generate recommendation
function generateRecommendation(results: TestResults): { variant: 'default' | 'destructive'; message: string } {
  const { improvementRate, regressionRate, netImprovement, regressed } = results

  if (regressed > 0 && regressionRate > 0.05) {
    return {
      variant: 'destructive',
      message: `不建議採用此變更。惡化案例達 ${regressed} 筆 (${(regressionRate * 100).toFixed(1)}%)，超過 5% 閾值。建議重新檢視規則 Pattern 或增加更多測試案例。`
    }
  }

  if (netImprovement > 0 && regressionRate <= 0.02) {
    return {
      variant: 'default',
      message: `建議採用此變更。淨改善 ${netImprovement} 筆，惡化率 ${(regressionRate * 100).toFixed(1)}% 在可接受範圍內。`
    }
  }

  if (netImprovement <= 0) {
    return {
      variant: 'default',
      message: `此變更無明顯改善效果 (淨改善: ${netImprovement})。建議重新評估變更的必要性。`
    }
  }

  return {
    variant: 'default',
    message: `變更效果中等。改善率 ${(improvementRate * 100).toFixed(1)}%，惡化率 ${(regressionRate * 100).toFixed(1)}%。建議根據實際業務需求決定是否採用。`
  }
}
```

### 7.3 TestResultComparison Component

**File**: `src/components/rules/TestResultComparison.tsx`

```typescript
'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { Eye, FileText } from 'lucide-react'
import { TestChangeType } from '@prisma/client'

interface TestResultComparisonProps {
  taskId: string
}

interface TestDetail {
  id: string
  document: {
    id: string
    fileName: string
    thumbnailUrl: string | null
  }
  originalResult: string | null
  originalConfidence: number | null
  testResult: string | null
  testConfidence: number | null
  actualValue: string | null
  originalAccurate: boolean
  testAccurate: boolean
  changeType: TestChangeType
}

// Fetch function
async function fetchTestDetails(
  taskId: string,
  changeType?: TestChangeType,
  page: number = 1
) {
  const params = new URLSearchParams()
  if (changeType) params.set('changeType', changeType)
  params.set('page', page.toString())
  params.set('pageSize', '20')

  const response = await fetch(`/api/test-tasks/${taskId}/details?${params}`)
  if (!response.ok) throw new Error('Failed to fetch details')
  return response.json()
}

// Change type labels and colors
const changeTypeConfig: Record<TestChangeType, { label: string; variant: 'default' | 'destructive' | 'secondary' | 'outline' }> = {
  IMPROVED: { label: '改善', variant: 'default' },
  REGRESSED: { label: '惡化', variant: 'destructive' },
  BOTH_RIGHT: { label: '都對', variant: 'secondary' },
  BOTH_WRONG: { label: '都錯', variant: 'outline' },
  UNCHANGED: { label: '無變化', variant: 'outline' }
}

export function TestResultComparison({ taskId }: TestResultComparisonProps) {
  const [filter, setFilter] = useState<TestChangeType | 'ALL'>('ALL')
  const [page, setPage] = useState(1)
  const [selectedDetail, setSelectedDetail] = useState<TestDetail | null>(null)

  // Fetch details
  const { data, isLoading } = useQuery({
    queryKey: ['test-details', taskId, filter, page],
    queryFn: () => fetchTestDetails(
      taskId,
      filter === 'ALL' ? undefined : filter,
      page
    )
  })

  const items = data?.data?.items ?? []
  const pagination = data?.data?.pagination

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>測試詳情</CardTitle>
          <Tabs value={filter} onValueChange={(v) => { setFilter(v as any); setPage(1); }}>
            <TabsList>
              <TabsTrigger value="ALL">全部</TabsTrigger>
              <TabsTrigger value="IMPROVED">改善</TabsTrigger>
              <TabsTrigger value="REGRESSED">惡化</TabsTrigger>
              <TabsTrigger value="BOTH_RIGHT">都對</TabsTrigger>
              <TabsTrigger value="BOTH_WRONG">都錯</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="py-10 text-center text-muted-foreground">
            沒有符合條件的測試結果
          </div>
        ) : (
          <>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>文件</TableHead>
                    <TableHead>原規則結果</TableHead>
                    <TableHead>新規則結果</TableHead>
                    <TableHead>實際值</TableHead>
                    <TableHead>變化</TableHead>
                    <TableHead className="w-[50px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((detail: TestDetail) => (
                    <TableRow key={detail.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <span className="truncate max-w-[150px]">
                            {detail.document.fileName}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className={detail.originalAccurate ? 'text-green-600' : 'text-red-600'}>
                            {detail.originalResult ?? '(無)'}
                          </span>
                          {detail.originalConfidence && (
                            <Badge variant="outline" className="text-xs">
                              {(detail.originalConfidence * 100).toFixed(0)}%
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className={detail.testAccurate ? 'text-green-600' : 'text-red-600'}>
                            {detail.testResult ?? '(無)'}
                          </span>
                          {detail.testConfidence && (
                            <Badge variant="outline" className="text-xs">
                              {(detail.testConfidence * 100).toFixed(0)}%
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="font-medium">
                          {detail.actualValue ?? '(無)'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant={changeTypeConfig[detail.changeType].variant}>
                          {changeTypeConfig[detail.changeType].label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setSelectedDetail(detail)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            {pagination && pagination.totalPages > 1 && (
              <div className="flex items-center justify-between mt-4">
                <p className="text-sm text-muted-foreground">
                  共 {pagination.totalItems} 筆結果
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage(page - 1)}
                  >
                    上一頁
                  </Button>
                  <span className="text-sm">
                    {page} / {pagination.totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= pagination.totalPages}
                    onClick={() => setPage(page + 1)}
                  >
                    下一頁
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>

      {/* Detail Dialog */}
      <Dialog open={!!selectedDetail} onOpenChange={() => setSelectedDetail(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>測試詳情</DialogTitle>
          </DialogHeader>
          {selectedDetail && (
            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">文件名稱</p>
                <p className="font-medium">{selectedDetail.document.fileName}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-lg bg-muted">
                  <p className="text-sm font-medium mb-2">原規則結果</p>
                  <p className={`text-lg ${selectedDetail.originalAccurate ? 'text-green-600' : 'text-red-600'}`}>
                    {selectedDetail.originalResult ?? '(無)'}
                  </p>
                  {selectedDetail.originalConfidence && (
                    <p className="text-sm text-muted-foreground mt-1">
                      信心度: {(selectedDetail.originalConfidence * 100).toFixed(1)}%
                    </p>
                  )}
                  <Badge variant={selectedDetail.originalAccurate ? 'default' : 'destructive'} className="mt-2">
                    {selectedDetail.originalAccurate ? '正確' : '錯誤'}
                  </Badge>
                </div>
                <div className="p-4 rounded-lg bg-muted">
                  <p className="text-sm font-medium mb-2">新規則結果</p>
                  <p className={`text-lg ${selectedDetail.testAccurate ? 'text-green-600' : 'text-red-600'}`}>
                    {selectedDetail.testResult ?? '(無)'}
                  </p>
                  {selectedDetail.testConfidence && (
                    <p className="text-sm text-muted-foreground mt-1">
                      信心度: {(selectedDetail.testConfidence * 100).toFixed(1)}%
                    </p>
                  )}
                  <Badge variant={selectedDetail.testAccurate ? 'default' : 'destructive'} className="mt-2">
                    {selectedDetail.testAccurate ? '正確' : '錯誤'}
                  </Badge>
                </div>
              </div>
              <div className="p-4 rounded-lg border">
                <p className="text-sm font-medium mb-2">實際值（確認值）</p>
                <p className="text-lg font-bold">{selectedDetail.actualValue ?? '(無)'}</p>
              </div>
              <div className="flex items-center justify-center">
                <Badge
                  variant={changeTypeConfig[selectedDetail.changeType].variant}
                  className="text-lg px-4 py-2"
                >
                  {changeTypeConfig[selectedDetail.changeType].label}
                </Badge>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  )
}
```

---

## 8. Implementation Checklist

### Phase 1: Database & Models
- [ ] Add RuleTestTask model to Prisma schema
- [ ] Add RuleTestDetail model to Prisma schema
- [ ] Run database migrations
- [ ] Add indexes for performance

### Phase 2: Background Job Setup
- [ ] Set up BullMQ queue for rule testing
- [ ] Create rule testing worker
- [ ] Configure Redis connection

### Phase 3: API Development
- [ ] Implement POST /api/forwarders/[id]/rules/[ruleId]/test
- [ ] Implement GET /api/test-tasks/[taskId]
- [ ] Implement GET /api/test-tasks/[taskId]/details
- [ ] Implement GET /api/test-tasks/[taskId]/report

### Phase 4: Rule Testing Service
- [ ] Implement RuleTestingService
- [ ] Add document fetching logic
- [ ] Add result comparison logic
- [ ] Add progress tracking

### Phase 5: Report Generation
- [ ] Install pdfkit and exceljs
- [ ] Implement PDF report generator
- [ ] Implement Excel report generator

### Phase 6: Frontend Components
- [ ] Create RuleTestPage
- [ ] Create RuleTestConfig component
- [ ] Create ImpactStatistics component
- [ ] Create TestResultComparison component

### Phase 7: Testing & QA
- [ ] Write API tests
- [ ] Write component tests
- [ ] Test batch execution performance
- [ ] Test report generation

---

## 9. Dependencies

### NPM Packages
```json
{
  "bullmq": "^4.15.0",
  "ioredis": "^5.3.0",
  "pdfkit": "^0.14.0",
  "exceljs": "^4.4.0"
}
```

### Related Stories
- Story 5.3: 編輯 Forwarder 映射規則（前置依賴）
- Story 4.5: 規則影響分析（前置依賴）

---

*Tech Spec created: 2025-12-16*
*Last updated: 2025-12-16*
