# Tech Spec: Story 10-3 工作流執行狀態檢視

## 1. 概述

### Story 資訊
- **Story ID**: 10-3
- **標題**: 工作流執行狀態查看
- **Epic**: 10 - n8n 工作流整合
- **功能需求**: FR56 (執行狀態監控)
- **優先級**: Medium
- **故事點數**: 8
- **相關 Stories**: Story 10-1, 10-5, 10-6

### 目標
實現完整的工作流執行狀態監控系統，讓用戶能夠：
- 查看近期工作流執行列表
- 即時追蹤執行中的工作流進度
- 按狀態、時間範圍、工作流類型進行篩選
- 查看執行詳情與關聯文件

### 相依性
- **前置**: Story 10-1 (n8n 雙向通訊 API - 提供狀態更新來源)
- **後置**: Story 10-5 (工作流錯誤詳情), Story 10-6 (文件處理進度追蹤)

---

## 2. 資料庫設計

### 2.1 Prisma Schema

```prisma
// ===========================================
// 工作流執行記錄
// ===========================================
model WorkflowExecution {
  id                String    @id @default(cuid())

  // n8n 工作流資訊
  n8nExecutionId    String?   @unique  // n8n 側的執行 ID
  workflowId        String?             // n8n 工作流 ID
  workflowName      String              // 工作流名稱

  // 觸發資訊
  triggerType       WorkflowTriggerType
  triggerSource     String?             // 觸發來源描述
  triggeredBy       String?             // 觸發者 (用戶 ID 或 'system')

  // 城市隔離
  cityCode          String
  city              City      @relation(fields: [cityCode], references: [code])

  // 執行狀態
  status            WorkflowExecutionStatus @default(PENDING)
  progress          Int       @default(0)      // 0-100 百分比
  currentStep       String?                    // 當前執行步驟描述

  // 時間記錄
  scheduledAt       DateTime?                  // 排程時間
  startedAt         DateTime?                  // 實際開始時間
  completedAt       DateTime?                  // 完成時間
  durationMs        Int?                       // 執行耗時（毫秒）

  // 結果資訊
  result            Json?               // 執行結果 JSON
  errorDetails      Json?               // 錯誤詳情 JSON

  // 相關文件
  documentCount     Int       @default(0)
  documents         Document[]          // 處理的文件

  // 執行步驟
  steps             WorkflowExecutionStep[]

  // 審計
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt

  // 索引
  @@index([status])
  @@index([workflowName])
  @@index([cityCode])
  @@index([startedAt])
  @@index([triggeredBy])
  @@index([triggerType])
  @@index([n8nExecutionId])
  @@index([createdAt])
}

// 工作流執行狀態枚舉
enum WorkflowExecutionStatus {
  PENDING       // 等待執行
  QUEUED        // 已排隊
  RUNNING       // 執行中
  COMPLETED     // 已完成
  FAILED        // 失敗
  CANCELLED     // 已取消
  TIMEOUT       // 超時
}

// 工作流觸發類型枚舉
enum WorkflowTriggerType {
  SCHEDULED     // 排程觸發
  MANUAL        // 手動觸發
  WEBHOOK       // Webhook 觸發
  DOCUMENT      // 文件觸發
  EVENT         // 事件觸發
}

// ===========================================
// 工作流執行步驟記錄
// ===========================================
model WorkflowExecutionStep {
  id              String    @id @default(cuid())
  executionId     String
  execution       WorkflowExecution @relation(fields: [executionId], references: [id], onDelete: Cascade)

  // 步驟資訊
  stepNumber      Int                 // 步驟順序
  stepName        String              // 步驟名稱
  stepType        String?             // n8n 節點類型

  // 狀態
  status          StepExecutionStatus @default(PENDING)

  // 時間
  startedAt       DateTime?
  completedAt     DateTime?
  durationMs      Int?

  // 輸入輸出資料
  inputData       Json?               // 輸入資料（可選記錄）
  outputData      Json?               // 輸出資料（可選記錄）
  errorMessage    String?             // 錯誤訊息

  createdAt       DateTime  @default(now())

  // 索引
  @@index([executionId])
  @@index([status])
  @@index([stepNumber])

  // 複合唯一約束
  @@unique([executionId, stepNumber])
}

// 步驟執行狀態枚舉
enum StepExecutionStatus {
  PENDING       // 等待執行
  RUNNING       // 執行中
  COMPLETED     // 已完成
  FAILED        // 失敗
  SKIPPED       // 跳過
}
```

### 2.2 索引策略

| 索引名稱 | 欄位 | 目的 |
|---------|------|------|
| `status` | `status` | 快速篩選執行狀態 |
| `workflowName` | `workflowName` | 工作流名稱搜尋 |
| `cityCode` | `cityCode` | 城市隔離查詢 |
| `startedAt` | `startedAt` | 時間範圍篩選 |
| `triggeredBy` | `triggeredBy` | 觸發者查詢 |
| `triggerType` | `triggerType` | 觸發類型篩選 |
| `n8nExecutionId` | `n8nExecutionId` | n8n 執行 ID 查詢 |
| `createdAt` | `createdAt` | 建立時間排序 |

### 2.3 資料庫遷移

```bash
# 生成遷移
npx prisma migrate dev --name add_workflow_execution_models

# 生成 Prisma Client
npx prisma generate
```

---

## 3. 類型定義

### 3.1 共用類型

```typescript
// lib/types/workflow-execution.ts
import {
  WorkflowExecution,
  WorkflowExecutionStatus,
  WorkflowTriggerType,
  StepExecutionStatus,
} from '@prisma/client'

// ===========================================
// 列表查詢選項
// ===========================================
export interface ListExecutionsOptions {
  cityCode?: string
  status?: WorkflowExecutionStatus | WorkflowExecutionStatus[]
  workflowName?: string
  triggerType?: WorkflowTriggerType
  triggeredBy?: string
  startDate?: Date
  endDate?: Date
  page?: number
  pageSize?: number
  orderBy?: 'startedAt' | 'createdAt' | 'completedAt'
  orderDirection?: 'asc' | 'desc'
}

// ===========================================
// 執行摘要 (列表顯示用)
// ===========================================
export interface ExecutionSummary {
  id: string
  workflowName: string
  triggerType: WorkflowTriggerType
  triggerSource?: string
  status: WorkflowExecutionStatus
  progress: number
  currentStep?: string
  startedAt?: Date
  completedAt?: Date
  durationMs?: number
  documentCount: number
  errorMessage?: string
}

// ===========================================
// 執行詳情 (詳情頁面用)
// ===========================================
export interface ExecutionDetail extends ExecutionSummary {
  n8nExecutionId?: string
  workflowId?: string
  triggeredBy?: string
  cityCode: string
  result?: Record<string, unknown>
  errorDetails?: ErrorDetails
  steps: ExecutionStepSummary[]
  documents: ExecutionDocumentSummary[]
}

// ===========================================
// 執行步驟摘要
// ===========================================
export interface ExecutionStepSummary {
  stepNumber: number
  stepName: string
  stepType?: string
  status: StepExecutionStatus
  startedAt?: Date
  completedAt?: Date
  durationMs?: number
  errorMessage?: string
}

// ===========================================
// 執行文件摘要
// ===========================================
export interface ExecutionDocumentSummary {
  id: string
  fileName: string
  status: string
}

// ===========================================
// 錯誤詳情結構
// ===========================================
export interface ErrorDetails {
  message: string
  code?: string
  stack?: string
  nodeType?: string
  nodeName?: string
  timestamp?: string
}

// ===========================================
// 執行統計
// ===========================================
export interface ExecutionStats {
  total: number
  byStatus: Record<WorkflowExecutionStatus, number>
  byTriggerType: Record<WorkflowTriggerType, number>
  avgDurationMs: number
  successRate: number
}

// ===========================================
// 執行統計查詢選項
// ===========================================
export interface ExecutionStatsOptions {
  cityCode?: string
  startDate?: Date
  endDate?: Date
}

// ===========================================
// 分頁結果
// ===========================================
export interface PaginatedExecutions {
  items: ExecutionSummary[]
  total: number
}

// ===========================================
// API 回應類型
// ===========================================
export interface ExecutionListResponse {
  data: ExecutionSummary[]
  pagination: {
    page: number
    pageSize: number
    total: number
    totalPages: number
  }
}

export interface ExecutionDetailResponse {
  data: ExecutionDetail
}

export interface RunningExecutionsResponse {
  data: ExecutionSummary[]
}

export interface ExecutionStatsResponse {
  data: ExecutionStats
}
```

### 3.2 前端狀態類型

```typescript
// lib/types/workflow-execution-ui.ts

// ===========================================
// 篩選值
// ===========================================
export interface ExecutionFilterValues {
  status?: string
  triggerType?: string
  workflowName?: string
  startDate?: Date | null
  endDate?: Date | null
}

// ===========================================
// 狀態配置
// ===========================================
export interface StatusConfig {
  label: string
  color: 'default' | 'primary' | 'success' | 'error' | 'warning'
  icon: React.ReactNode
}

// ===========================================
// 列表 Props
// ===========================================
export interface WorkflowExecutionListProps {
  executions: ExecutionSummary[]
  total: number
  page: number
  pageSize: number
  onPageChange: (page: number) => void
  onPageSizeChange: (pageSize: number) => void
  loading?: boolean
}

// ===========================================
// 篩選器 Props
// ===========================================
export interface WorkflowExecutionFiltersProps {
  values: ExecutionFilterValues
  onChange: (values: ExecutionFilterValues) => void
  onClear: () => void
}
```

---

## 4. 服務實現

### 4.1 WorkflowExecutionService

```typescript
// lib/services/n8n/workflowExecutionService.ts
import { prisma } from '@/lib/prisma'
import type {
  WorkflowExecution,
  WorkflowExecutionStatus,
  WorkflowTriggerType,
} from '@prisma/client'
import type {
  ListExecutionsOptions,
  ExecutionSummary,
  ExecutionDetail,
  PaginatedExecutions,
  ExecutionStats,
  ExecutionStatsOptions,
  ErrorDetails,
} from '@/lib/types/workflow-execution'

export class WorkflowExecutionService {
  // ===========================================
  // 列出執行記錄
  // ===========================================
  async listExecutions(
    options: ListExecutionsOptions
  ): Promise<PaginatedExecutions> {
    const {
      cityCode,
      status,
      workflowName,
      triggerType,
      triggeredBy,
      startDate,
      endDate,
      page = 1,
      pageSize = 20,
      orderBy = 'startedAt',
      orderDirection = 'desc',
    } = options

    // 建構查詢條件
    const where = this.buildWhereClause({
      cityCode,
      status,
      workflowName,
      triggerType,
      triggeredBy,
      startDate,
      endDate,
    })

    // 並行執行查詢和計數
    const [items, total] = await Promise.all([
      prisma.workflowExecution.findMany({
        where,
        orderBy: { [orderBy]: orderDirection },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          _count: {
            select: { documents: true },
          },
        },
      }),
      prisma.workflowExecution.count({ where }),
    ])

    return {
      items: items.map(this.mapToSummary),
      total,
    }
  }

  // ===========================================
  // 獲取執行詳情
  // ===========================================
  async getExecutionDetail(id: string): Promise<ExecutionDetail | null> {
    const execution = await prisma.workflowExecution.findUnique({
      where: { id },
      include: {
        documents: {
          select: {
            id: true,
            fileName: true,
            status: true,
          },
        },
        steps: {
          orderBy: { stepNumber: 'asc' },
        },
      },
    })

    if (!execution) return null

    const errorDetails = execution.errorDetails as ErrorDetails | null

    return {
      id: execution.id,
      n8nExecutionId: execution.n8nExecutionId ?? undefined,
      workflowId: execution.workflowId ?? undefined,
      workflowName: execution.workflowName,
      triggerType: execution.triggerType,
      triggerSource: execution.triggerSource ?? undefined,
      triggeredBy: execution.triggeredBy ?? undefined,
      cityCode: execution.cityCode,
      status: execution.status,
      progress: execution.progress,
      currentStep: execution.currentStep ?? undefined,
      startedAt: execution.startedAt ?? undefined,
      completedAt: execution.completedAt ?? undefined,
      durationMs: execution.durationMs ?? undefined,
      documentCount: execution.documents.length,
      result: execution.result as Record<string, unknown> | undefined,
      errorDetails: errorDetails ?? undefined,
      errorMessage: errorDetails?.message,
      steps: execution.steps.map((step) => ({
        stepNumber: step.stepNumber,
        stepName: step.stepName,
        stepType: step.stepType ?? undefined,
        status: step.status,
        startedAt: step.startedAt ?? undefined,
        completedAt: step.completedAt ?? undefined,
        durationMs: step.durationMs ?? undefined,
        errorMessage: step.errorMessage ?? undefined,
      })),
      documents: execution.documents,
    }
  }

  // ===========================================
  // 獲取執行統計
  // ===========================================
  async getExecutionStats(options: ExecutionStatsOptions): Promise<ExecutionStats> {
    const { cityCode, startDate, endDate } = options

    const where = this.buildWhereClause({ cityCode, startDate, endDate })

    // 並行查詢所有統計資料
    const [total, statusCounts, triggerTypeCounts, avgDuration] = await Promise.all([
      prisma.workflowExecution.count({ where }),
      prisma.workflowExecution.groupBy({
        by: ['status'],
        where,
        _count: true,
      }),
      prisma.workflowExecution.groupBy({
        by: ['triggerType'],
        where,
        _count: true,
      }),
      prisma.workflowExecution.aggregate({
        where: {
          ...where,
          status: 'COMPLETED',
          durationMs: { not: null },
        },
        _avg: {
          durationMs: true,
        },
      }),
    ])

    // 轉換狀態計數
    const byStatus = {} as Record<WorkflowExecutionStatus, number>
    statusCounts.forEach((item) => {
      byStatus[item.status] = item._count
    })

    // 轉換觸發類型計數
    const byTriggerType = {} as Record<WorkflowTriggerType, number>
    triggerTypeCounts.forEach((item) => {
      byTriggerType[item.triggerType] = item._count
    })

    // 計算成功率
    const completed = byStatus['COMPLETED'] || 0
    const failed = byStatus['FAILED'] || 0
    const successRate =
      completed + failed > 0
        ? Math.round((completed / (completed + failed)) * 10000) / 100
        : 0

    return {
      total,
      byStatus,
      byTriggerType,
      avgDurationMs: Math.round(avgDuration._avg.durationMs ?? 0),
      successRate,
    }
  }

  // ===========================================
  // 獲取執行中的工作流
  // ===========================================
  async getRunningExecutions(cityCode?: string): Promise<ExecutionSummary[]> {
    const executions = await prisma.workflowExecution.findMany({
      where: {
        status: { in: ['PENDING', 'QUEUED', 'RUNNING'] },
        ...(cityCode ? { cityCode } : {}),
      },
      orderBy: { startedAt: 'desc' },
      include: {
        _count: {
          select: { documents: true },
        },
      },
    })

    return executions.map(this.mapToSummary)
  }

  // ===========================================
  // 更新執行狀態 (從 n8n Webhook 調用)
  // ===========================================
  async updateExecutionStatus(
    n8nExecutionId: string,
    status: WorkflowExecutionStatus,
    data?: {
      progress?: number
      currentStep?: string
      result?: Record<string, unknown>
      errorDetails?: ErrorDetails
    }
  ): Promise<WorkflowExecution | null> {
    const execution = await prisma.workflowExecution.findUnique({
      where: { n8nExecutionId },
    })

    if (!execution) return null

    const updateData: Record<string, unknown> = {
      status,
      updatedAt: new Date(),
    }

    // 更新可選欄位
    if (data?.progress !== undefined) updateData.progress = data.progress
    if (data?.currentStep !== undefined) updateData.currentStep = data.currentStep
    if (data?.result !== undefined) updateData.result = data.result
    if (data?.errorDetails !== undefined) updateData.errorDetails = data.errorDetails

    // 根據狀態更新時間
    if (status === 'RUNNING' && !execution.startedAt) {
      updateData.startedAt = new Date()
    }

    // 終止狀態處理
    const terminalStatuses: WorkflowExecutionStatus[] = [
      'COMPLETED',
      'FAILED',
      'CANCELLED',
      'TIMEOUT',
    ]
    if (terminalStatuses.includes(status)) {
      updateData.completedAt = new Date()
      if (execution.startedAt) {
        updateData.durationMs = Date.now() - execution.startedAt.getTime()
      }
    }

    return prisma.workflowExecution.update({
      where: { n8nExecutionId },
      data: updateData,
    })
  }

  // ===========================================
  // 建立執行記錄
  // ===========================================
  async createExecution(data: {
    workflowId?: string
    workflowName: string
    triggerType: WorkflowTriggerType
    triggerSource?: string
    triggeredBy?: string
    cityCode: string
    scheduledAt?: Date
    n8nExecutionId?: string
  }): Promise<WorkflowExecution> {
    return prisma.workflowExecution.create({
      data: {
        ...data,
        status: 'PENDING',
        progress: 0,
      },
    })
  }

  // ===========================================
  // 新增執行步驟
  // ===========================================
  async addExecutionStep(
    executionId: string,
    stepData: {
      stepNumber: number
      stepName: string
      stepType?: string
    }
  ) {
    return prisma.workflowExecutionStep.create({
      data: {
        executionId,
        ...stepData,
        status: 'PENDING',
      },
    })
  }

  // ===========================================
  // 更新執行步驟狀態
  // ===========================================
  async updateStepStatus(
    executionId: string,
    stepNumber: number,
    status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'SKIPPED',
    data?: {
      inputData?: Record<string, unknown>
      outputData?: Record<string, unknown>
      errorMessage?: string
    }
  ) {
    const updateData: Record<string, unknown> = { status }

    if (status === 'RUNNING') {
      updateData.startedAt = new Date()
    }

    if (['COMPLETED', 'FAILED', 'SKIPPED'].includes(status)) {
      updateData.completedAt = new Date()

      // 取得開始時間以計算耗時
      const step = await prisma.workflowExecutionStep.findUnique({
        where: {
          executionId_stepNumber: { executionId, stepNumber },
        },
      })

      if (step?.startedAt) {
        updateData.durationMs = Date.now() - step.startedAt.getTime()
      }
    }

    if (data?.inputData) updateData.inputData = data.inputData
    if (data?.outputData) updateData.outputData = data.outputData
    if (data?.errorMessage) updateData.errorMessage = data.errorMessage

    return prisma.workflowExecutionStep.update({
      where: {
        executionId_stepNumber: { executionId, stepNumber },
      },
      data: updateData,
    })
  }

  // ===========================================
  // 私有方法: 建構查詢條件
  // ===========================================
  private buildWhereClause(options: {
    cityCode?: string
    status?: WorkflowExecutionStatus | WorkflowExecutionStatus[]
    workflowName?: string
    triggerType?: WorkflowTriggerType
    triggeredBy?: string
    startDate?: Date
    endDate?: Date
  }) {
    const where: Record<string, unknown> = {}

    if (options.cityCode) where.cityCode = options.cityCode

    if (options.status) {
      where.status = Array.isArray(options.status)
        ? { in: options.status }
        : options.status
    }

    if (options.workflowName) {
      where.workflowName = { contains: options.workflowName, mode: 'insensitive' }
    }

    if (options.triggerType) where.triggerType = options.triggerType
    if (options.triggeredBy) where.triggeredBy = options.triggeredBy

    if (options.startDate || options.endDate) {
      where.startedAt = {}
      if (options.startDate) (where.startedAt as Record<string, Date>).gte = options.startDate
      if (options.endDate) (where.startedAt as Record<string, Date>).lte = options.endDate
    }

    return where
  }

  // ===========================================
  // 私有方法: 轉換為摘要格式
  // ===========================================
  private mapToSummary = (
    item: WorkflowExecution & { _count: { documents: number } }
  ): ExecutionSummary => {
    const errorDetails = item.errorDetails as ErrorDetails | null

    return {
      id: item.id,
      workflowName: item.workflowName,
      triggerType: item.triggerType,
      triggerSource: item.triggerSource ?? undefined,
      status: item.status,
      progress: item.progress,
      currentStep: item.currentStep ?? undefined,
      startedAt: item.startedAt ?? undefined,
      completedAt: item.completedAt ?? undefined,
      durationMs: item.durationMs ?? undefined,
      documentCount: item._count.documents,
      errorMessage: errorDetails?.message,
    }
  }
}

// 單例導出
export const workflowExecutionService = new WorkflowExecutionService()
```

---

## 5. API 路由

### 5.1 執行列表 API

```typescript
// app/api/workflow-executions/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { workflowExecutionService } from '@/lib/services/n8n/workflowExecutionService'
import { getUserCityAccess } from '@/lib/utils/permissions'
import { z } from 'zod'

// 查詢參數驗證 Schema
const querySchema = z.object({
  cityCode: z.string().optional(),
  status: z.enum([
    'PENDING', 'QUEUED', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED', 'TIMEOUT'
  ]).optional(),
  triggerType: z.enum([
    'SCHEDULED', 'MANUAL', 'WEBHOOK', 'DOCUMENT', 'EVENT'
  ]).optional(),
  workflowName: z.string().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
  orderBy: z.enum(['startedAt', 'createdAt', 'completedAt']).default('startedAt'),
  orderDirection: z.enum(['asc', 'desc']).default('desc'),
})

export async function GET(request: NextRequest) {
  try {
    // 驗證身份
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized', code: 'UNAUTHORIZED' },
        { status: 401 }
      )
    }

    // 解析查詢參數
    const searchParams = Object.fromEntries(request.nextUrl.searchParams)
    const parseResult = querySchema.safeParse(searchParams)

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: parseResult.error.issues },
        { status: 400 }
      )
    }

    const params = parseResult.data

    // 獲取用戶可訪問的城市
    const userCities = await getUserCityAccess(session.user)

    // 驗證城市權限
    let cityCode: string | undefined
    if (params.cityCode) {
      if (!userCities.includes(params.cityCode) && !userCities.includes('*')) {
        return NextResponse.json(
          { error: 'Access denied to requested city', code: 'CITY_ACCESS_DENIED' },
          { status: 403 }
        )
      }
      cityCode = params.cityCode
    } else if (!userCities.includes('*')) {
      cityCode = userCities[0] // 預設使用第一個可訪問城市
    }

    // 查詢執行記錄
    const result = await workflowExecutionService.listExecutions({
      cityCode,
      status: params.status as any,
      triggerType: params.triggerType as any,
      workflowName: params.workflowName,
      startDate: params.startDate ? new Date(params.startDate) : undefined,
      endDate: params.endDate ? new Date(params.endDate) : undefined,
      page: params.page,
      pageSize: params.pageSize,
      orderBy: params.orderBy,
      orderDirection: params.orderDirection,
    })

    return NextResponse.json({
      data: result.items,
      pagination: {
        page: params.page,
        pageSize: params.pageSize,
        total: result.total,
        totalPages: Math.ceil(result.total / params.pageSize),
      },
    })
  } catch (error) {
    console.error('List workflow executions error:', error)
    return NextResponse.json(
      { error: 'Failed to list workflow executions', code: 'LIST_FAILED' },
      { status: 500 }
    )
  }
}
```

### 5.2 執行詳情 API

```typescript
// app/api/workflow-executions/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { workflowExecutionService } from '@/lib/services/n8n/workflowExecutionService'
import { getUserCityAccess } from '@/lib/utils/permissions'

interface RouteParams {
  params: { id: string }
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    // 驗證身份
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized', code: 'UNAUTHORIZED' },
        { status: 401 }
      )
    }

    // 獲取執行詳情
    const execution = await workflowExecutionService.getExecutionDetail(params.id)

    if (!execution) {
      return NextResponse.json(
        { error: 'Execution not found', code: 'NOT_FOUND' },
        { status: 404 }
      )
    }

    // 驗證城市權限
    const userCities = await getUserCityAccess(session.user)
    if (!userCities.includes(execution.cityCode) && !userCities.includes('*')) {
      return NextResponse.json(
        { error: 'Access denied', code: 'CITY_ACCESS_DENIED' },
        { status: 403 }
      )
    }

    return NextResponse.json({ data: execution })
  } catch (error) {
    console.error('Get workflow execution error:', error)
    return NextResponse.json(
      { error: 'Failed to get workflow execution', code: 'GET_FAILED' },
      { status: 500 }
    )
  }
}
```

### 5.3 執行中工作流 API

```typescript
// app/api/workflow-executions/running/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { workflowExecutionService } from '@/lib/services/n8n/workflowExecutionService'
import { getUserCityAccess } from '@/lib/utils/permissions'

export async function GET(request: NextRequest) {
  try {
    // 驗證身份
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized', code: 'UNAUTHORIZED' },
        { status: 401 }
      )
    }

    // 獲取用戶城市權限
    const userCities = await getUserCityAccess(session.user)
    const requestedCity = request.nextUrl.searchParams.get('cityCode')

    let cityCode: string | undefined
    if (requestedCity) {
      if (!userCities.includes(requestedCity) && !userCities.includes('*')) {
        return NextResponse.json(
          { error: 'Access denied', code: 'CITY_ACCESS_DENIED' },
          { status: 403 }
        )
      }
      cityCode = requestedCity
    }

    // 獲取執行中的工作流
    const executions = await workflowExecutionService.getRunningExecutions(cityCode)

    return NextResponse.json({ data: executions })
  } catch (error) {
    console.error('Get running executions error:', error)
    return NextResponse.json(
      { error: 'Failed to get running executions', code: 'GET_RUNNING_FAILED' },
      { status: 500 }
    )
  }
}
```

### 5.4 執行統計 API

```typescript
// app/api/workflow-executions/stats/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { workflowExecutionService } from '@/lib/services/n8n/workflowExecutionService'
import { getUserCityAccess } from '@/lib/utils/permissions'
import { z } from 'zod'

const querySchema = z.object({
  cityCode: z.string().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
})

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized', code: 'UNAUTHORIZED' },
        { status: 401 }
      )
    }

    const searchParams = Object.fromEntries(request.nextUrl.searchParams)
    const parseResult = querySchema.safeParse(searchParams)

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: parseResult.error.issues },
        { status: 400 }
      )
    }

    const params = parseResult.data
    const userCities = await getUserCityAccess(session.user)

    // 城市權限驗證
    let cityCode: string | undefined
    if (params.cityCode) {
      if (!userCities.includes(params.cityCode) && !userCities.includes('*')) {
        return NextResponse.json(
          { error: 'Access denied', code: 'CITY_ACCESS_DENIED' },
          { status: 403 }
        )
      }
      cityCode = params.cityCode
    }

    const stats = await workflowExecutionService.getExecutionStats({
      cityCode,
      startDate: params.startDate ? new Date(params.startDate) : undefined,
      endDate: params.endDate ? new Date(params.endDate) : undefined,
    })

    return NextResponse.json({ data: stats })
  } catch (error) {
    console.error('Get execution stats error:', error)
    return NextResponse.json(
      { error: 'Failed to get execution stats', code: 'STATS_FAILED' },
      { status: 500 }
    )
  }
}
```

---

## 6. 前端組件

### 6.1 執行列表組件

```typescript
// components/workflow/WorkflowExecutionList.tsx
'use client'

import React, { useState, useEffect } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  IconButton,
  Tooltip,
  Box,
  Typography,
  LinearProgress,
  TablePagination,
} from '@mui/material'
import {
  Visibility,
  CheckCircle,
  Error,
  Schedule,
  PlayArrow,
  Cancel,
  Timer,
  HourglassEmpty,
} from '@mui/icons-material'
import { formatDistanceToNow, format } from 'date-fns'
import { zhTW } from 'date-fns/locale'
import Link from 'next/link'
import type {
  ExecutionSummary,
  WorkflowExecutionListProps,
  StatusConfig,
} from '@/lib/types/workflow-execution'

// ===========================================
// 狀態配置映射
// ===========================================
const statusConfig: Record<string, StatusConfig> = {
  PENDING: {
    label: '等待中',
    color: 'default',
    icon: <HourglassEmpty fontSize="small" />,
  },
  QUEUED: {
    label: '已排隊',
    color: 'default',
    icon: <Schedule fontSize="small" />,
  },
  RUNNING: {
    label: '執行中',
    color: 'primary',
    icon: <PlayArrow fontSize="small" />,
  },
  COMPLETED: {
    label: '已完成',
    color: 'success',
    icon: <CheckCircle fontSize="small" />,
  },
  FAILED: {
    label: '失敗',
    color: 'error',
    icon: <Error fontSize="small" />,
  },
  CANCELLED: {
    label: '已取消',
    color: 'warning',
    icon: <Cancel fontSize="small" />,
  },
  TIMEOUT: {
    label: '超時',
    color: 'error',
    icon: <Timer fontSize="small" />,
  },
}

// ===========================================
// 觸發類型標籤
// ===========================================
const triggerTypeLabels: Record<string, string> = {
  SCHEDULED: '排程',
  MANUAL: '手動',
  WEBHOOK: 'Webhook',
  DOCUMENT: '文件',
  EVENT: '事件',
}

// ===========================================
// 格式化持續時間
// ===========================================
function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  if (ms < 3600000) {
    const minutes = Math.floor(ms / 60000)
    const seconds = Math.floor((ms % 60000) / 1000)
    return `${minutes}m ${seconds}s`
  }
  const hours = Math.floor(ms / 3600000)
  const minutes = Math.floor((ms % 3600000) / 60000)
  return `${hours}h ${minutes}m`
}

// ===========================================
// 執行中計時器組件
// ===========================================
function RunningTimer({ startedAt }: { startedAt: Date }) {
  const [elapsed, setElapsed] = useState(Date.now() - startedAt.getTime())

  useEffect(() => {
    const timer = setInterval(() => {
      setElapsed(Date.now() - startedAt.getTime())
    }, 1000)

    return () => clearInterval(timer)
  }, [startedAt])

  return (
    <Typography variant="body2" color="primary" sx={{ fontFamily: 'monospace' }}>
      {formatDuration(elapsed)}
    </Typography>
  )
}

// ===========================================
// 主組件
// ===========================================
export function WorkflowExecutionList({
  executions,
  total,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  loading,
}: WorkflowExecutionListProps) {
  return (
    <Paper elevation={1}>
      <TableContainer>
        {loading && <LinearProgress />}
        <Table>
          <TableHead>
            <TableRow sx={{ backgroundColor: 'grey.50' }}>
              <TableCell>工作流</TableCell>
              <TableCell>觸發方式</TableCell>
              <TableCell>狀態</TableCell>
              <TableCell>進度</TableCell>
              <TableCell>開始時間</TableCell>
              <TableCell>耗時</TableCell>
              <TableCell align="center">文件數</TableCell>
              <TableCell align="right">操作</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {executions.map((execution) => {
              const status = statusConfig[execution.status] ?? statusConfig.PENDING

              return (
                <TableRow
                  key={execution.id}
                  hover
                  sx={{ '&:last-child td': { borderBottom: 0 } }}
                >
                  {/* 工作流名稱 */}
                  <TableCell>
                    <Typography variant="body2" fontWeight="medium">
                      {execution.workflowName}
                    </Typography>
                    {execution.triggerSource && (
                      <Typography variant="caption" color="text.secondary">
                        {execution.triggerSource}
                      </Typography>
                    )}
                  </TableCell>

                  {/* 觸發方式 */}
                  <TableCell>
                    <Chip
                      label={triggerTypeLabels[execution.triggerType] ?? execution.triggerType}
                      size="small"
                      variant="outlined"
                    />
                  </TableCell>

                  {/* 狀態 */}
                  <TableCell>
                    <Box>
                      <Chip
                        icon={status.icon as React.ReactElement}
                        label={status.label}
                        color={status.color}
                        size="small"
                      />
                      {execution.status === 'FAILED' && execution.errorMessage && (
                        <Tooltip title={execution.errorMessage} arrow>
                          <Typography
                            variant="caption"
                            color="error"
                            sx={{
                              display: 'block',
                              maxWidth: 200,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              mt: 0.5,
                            }}
                          >
                            {execution.errorMessage}
                          </Typography>
                        </Tooltip>
                      )}
                    </Box>
                  </TableCell>

                  {/* 進度 */}
                  <TableCell>
                    {execution.status === 'RUNNING' ? (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Box sx={{ flex: 1, minWidth: 80 }}>
                          <LinearProgress
                            variant="determinate"
                            value={execution.progress}
                            sx={{ height: 6, borderRadius: 3 }}
                          />
                        </Box>
                        <Typography variant="caption" sx={{ minWidth: 35 }}>
                          {execution.progress}%
                        </Typography>
                      </Box>
                    ) : execution.status === 'COMPLETED' ? (
                      <Typography variant="body2" color="success.main">
                        100%
                      </Typography>
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        -
                      </Typography>
                    )}
                    {execution.currentStep && (
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        display="block"
                        sx={{ mt: 0.5 }}
                      >
                        {execution.currentStep}
                      </Typography>
                    )}
                  </TableCell>

                  {/* 開始時間 */}
                  <TableCell>
                    {execution.startedAt ? (
                      <Tooltip
                        title={format(new Date(execution.startedAt), 'PPpp', { locale: zhTW })}
                        arrow
                      >
                        <Typography variant="body2">
                          {formatDistanceToNow(new Date(execution.startedAt), {
                            addSuffix: true,
                            locale: zhTW,
                          })}
                        </Typography>
                      </Tooltip>
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        -
                      </Typography>
                    )}
                  </TableCell>

                  {/* 耗時 */}
                  <TableCell>
                    {execution.durationMs ? (
                      <Typography variant="body2">
                        {formatDuration(execution.durationMs)}
                      </Typography>
                    ) : execution.status === 'RUNNING' && execution.startedAt ? (
                      <RunningTimer startedAt={new Date(execution.startedAt)} />
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        -
                      </Typography>
                    )}
                  </TableCell>

                  {/* 文件數 */}
                  <TableCell align="center">
                    <Chip
                      label={execution.documentCount}
                      size="small"
                      variant="outlined"
                      color={execution.documentCount > 0 ? 'primary' : 'default'}
                    />
                  </TableCell>

                  {/* 操作 */}
                  <TableCell align="right">
                    <Tooltip title="查看詳情" arrow>
                      <IconButton
                        component={Link}
                        href={`/workflow-monitor/${execution.id}`}
                        size="small"
                        color="primary"
                      >
                        <Visibility />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              )
            })}

            {/* 空狀態 */}
            {executions.length === 0 && !loading && (
              <TableRow>
                <TableCell colSpan={8} align="center">
                  <Box sx={{ py: 6 }}>
                    <Typography color="text.secondary">
                      沒有找到工作流執行記錄
                    </Typography>
                  </Box>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* 分頁 */}
      <TablePagination
        component="div"
        count={total}
        page={page - 1}
        onPageChange={(_, newPage) => onPageChange(newPage + 1)}
        rowsPerPage={pageSize}
        onRowsPerPageChange={(e) => onPageSizeChange(parseInt(e.target.value))}
        rowsPerPageOptions={[10, 20, 50, 100]}
        labelRowsPerPage="每頁筆數"
        labelDisplayedRows={({ from, to, count }) =>
          `${from}-${to} / 共 ${count} 筆`
        }
      />
    </Paper>
  )
}
```

### 6.2 篩選器組件

```typescript
// components/workflow/WorkflowExecutionFilters.tsx
'use client'

import React from 'react'
import {
  Box,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Button,
  Paper,
} from '@mui/material'
import { DatePicker } from '@mui/x-date-pickers'
import { Clear, Search } from '@mui/icons-material'
import type { ExecutionFilterValues, WorkflowExecutionFiltersProps } from '@/lib/types/workflow-execution-ui'

// ===========================================
// 狀態選項
// ===========================================
const statusOptions = [
  { value: '', label: '全部狀態' },
  { value: 'PENDING', label: '等待中' },
  { value: 'QUEUED', label: '已排隊' },
  { value: 'RUNNING', label: '執行中' },
  { value: 'COMPLETED', label: '已完成' },
  { value: 'FAILED', label: '失敗' },
  { value: 'CANCELLED', label: '已取消' },
  { value: 'TIMEOUT', label: '超時' },
]

// ===========================================
// 觸發類型選項
// ===========================================
const triggerTypeOptions = [
  { value: '', label: '全部類型' },
  { value: 'SCHEDULED', label: '排程' },
  { value: 'MANUAL', label: '手動' },
  { value: 'WEBHOOK', label: 'Webhook' },
  { value: 'DOCUMENT', label: '文件' },
  { value: 'EVENT', label: '事件' },
]

export function WorkflowExecutionFilters({
  values,
  onChange,
  onClear,
}: WorkflowExecutionFiltersProps) {
  // 檢查是否有任何篩選條件
  const hasFilters = Object.values(values).some(
    (v) => v !== undefined && v !== null && v !== ''
  )

  return (
    <Paper elevation={0} sx={{ p: 2, mb: 3, backgroundColor: 'grey.50' }}>
      <Box
        sx={{
          display: 'flex',
          gap: 2,
          flexWrap: 'wrap',
          alignItems: 'center',
        }}
      >
        {/* 狀態篩選 */}
        <FormControl size="small" sx={{ minWidth: 130 }}>
          <InputLabel>狀態</InputLabel>
          <Select
            value={values.status ?? ''}
            label="狀態"
            onChange={(e) =>
              onChange({ ...values, status: e.target.value || undefined })
            }
          >
            {statusOptions.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {/* 觸發類型篩選 */}
        <FormControl size="small" sx={{ minWidth: 130 }}>
          <InputLabel>觸發方式</InputLabel>
          <Select
            value={values.triggerType ?? ''}
            label="觸發方式"
            onChange={(e) =>
              onChange({ ...values, triggerType: e.target.value || undefined })
            }
          >
            {triggerTypeOptions.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {/* 工作流名稱搜尋 */}
        <TextField
          size="small"
          label="工作流名稱"
          placeholder="搜尋..."
          value={values.workflowName ?? ''}
          onChange={(e) =>
            onChange({ ...values, workflowName: e.target.value || undefined })
          }
          sx={{ minWidth: 160 }}
          InputProps={{
            endAdornment: values.workflowName ? null : (
              <Search fontSize="small" color="action" />
            ),
          }}
        />

        {/* 開始日期 */}
        <DatePicker
          label="開始日期"
          value={values.startDate ?? null}
          onChange={(date) => onChange({ ...values, startDate: date })}
          slotProps={{
            textField: { size: 'small', sx: { width: 160 } },
          }}
        />

        {/* 結束日期 */}
        <DatePicker
          label="結束日期"
          value={values.endDate ?? null}
          onChange={(date) => onChange({ ...values, endDate: date })}
          slotProps={{
            textField: { size: 'small', sx: { width: 160 } },
          }}
        />

        {/* 清除按鈕 */}
        {hasFilters && (
          <Button
            startIcon={<Clear />}
            onClick={onClear}
            size="small"
            color="inherit"
          >
            清除篩選
          </Button>
        )}
      </Box>
    </Paper>
  )
}
```

### 6.3 執行詳情組件

```typescript
// components/workflow/WorkflowExecutionDetail.tsx
'use client'

import React from 'react'
import {
  Box,
  Paper,
  Typography,
  Chip,
  Divider,
  Grid,
  Card,
  CardContent,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  LinearProgress,
  Alert,
} from '@mui/material'
import {
  CheckCircle,
  Error,
  Schedule,
  PlayArrow,
  Description,
  Timer,
  Person,
  LocationCity,
} from '@mui/icons-material'
import { format } from 'date-fns'
import { zhTW } from 'date-fns/locale'
import type { ExecutionDetail } from '@/lib/types/workflow-execution'

interface WorkflowExecutionDetailProps {
  execution: ExecutionDetail
}

export function WorkflowExecutionDetail({ execution }: WorkflowExecutionDetailProps) {
  const getStepIcon = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return <CheckCircle color="success" />
      case 'FAILED':
        return <Error color="error" />
      case 'RUNNING':
        return <PlayArrow color="primary" />
      case 'SKIPPED':
        return <Schedule color="disabled" />
      default:
        return <Schedule color="action" />
    }
  }

  return (
    <Box>
      {/* 基本資訊 */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          {execution.workflowName}
        </Typography>

        <Grid container spacing={3} sx={{ mt: 1 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Timer color="action" />
              <Box>
                <Typography variant="caption" color="text.secondary">
                  耗時
                </Typography>
                <Typography variant="body2">
                  {execution.durationMs
                    ? `${(execution.durationMs / 1000).toFixed(2)} 秒`
                    : '-'}
                </Typography>
              </Box>
            </Box>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Person color="action" />
              <Box>
                <Typography variant="caption" color="text.secondary">
                  觸發者
                </Typography>
                <Typography variant="body2">
                  {execution.triggeredBy ?? 'System'}
                </Typography>
              </Box>
            </Box>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <LocationCity color="action" />
              <Box>
                <Typography variant="caption" color="text.secondary">
                  城市
                </Typography>
                <Typography variant="body2">{execution.cityCode}</Typography>
              </Box>
            </Box>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Description color="action" />
              <Box>
                <Typography variant="caption" color="text.secondary">
                  處理文件
                </Typography>
                <Typography variant="body2">{execution.documentCount} 個</Typography>
              </Box>
            </Box>
          </Grid>
        </Grid>

        {/* 進度條 */}
        {execution.status === 'RUNNING' && (
          <Box sx={{ mt: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="body2">{execution.currentStep}</Typography>
              <Typography variant="body2">{execution.progress}%</Typography>
            </Box>
            <LinearProgress variant="determinate" value={execution.progress} />
          </Box>
        )}

        {/* 錯誤訊息 */}
        {execution.status === 'FAILED' && execution.errorDetails && (
          <Alert severity="error" sx={{ mt: 3 }}>
            <Typography variant="body2" fontWeight="medium">
              {execution.errorDetails.message}
            </Typography>
            {execution.errorDetails.nodeName && (
              <Typography variant="caption">
                發生於節點: {execution.errorDetails.nodeName}
              </Typography>
            )}
          </Alert>
        )}
      </Paper>

      {/* 執行步驟 */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          執行步驟
        </Typography>
        <List>
          {execution.steps.map((step, index) => (
            <React.Fragment key={step.stepNumber}>
              {index > 0 && <Divider />}
              <ListItem>
                <ListItemIcon>{getStepIcon(step.status)}</ListItemIcon>
                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="body2">
                        {step.stepNumber}. {step.stepName}
                      </Typography>
                      {step.stepType && (
                        <Chip label={step.stepType} size="small" variant="outlined" />
                      )}
                    </Box>
                  }
                  secondary={
                    <Box sx={{ mt: 0.5 }}>
                      {step.durationMs && (
                        <Typography variant="caption" color="text.secondary">
                          耗時: {step.durationMs}ms
                        </Typography>
                      )}
                      {step.errorMessage && (
                        <Typography variant="caption" color="error" display="block">
                          {step.errorMessage}
                        </Typography>
                      )}
                    </Box>
                  }
                />
              </ListItem>
            </React.Fragment>
          ))}
        </List>
      </Paper>

      {/* 關聯文件 */}
      {execution.documents.length > 0 && (
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            關聯文件
          </Typography>
          <List>
            {execution.documents.map((doc) => (
              <ListItem key={doc.id}>
                <ListItemIcon>
                  <Description />
                </ListItemIcon>
                <ListItemText
                  primary={doc.fileName}
                  secondary={doc.status}
                />
              </ListItem>
            ))}
          </List>
        </Paper>
      )}
    </Box>
  )
}
```

### 6.4 React Query Hooks

```typescript
// hooks/useWorkflowExecutions.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type {
  ExecutionListResponse,
  ExecutionDetailResponse,
  RunningExecutionsResponse,
  ExecutionStatsResponse,
  ListExecutionsOptions,
} from '@/lib/types/workflow-execution'

// ===========================================
// API 請求函數
// ===========================================
async function fetchExecutions(
  options: ListExecutionsOptions
): Promise<ExecutionListResponse> {
  const params = new URLSearchParams()

  if (options.cityCode) params.set('cityCode', options.cityCode)
  if (options.status) {
    params.set('status', Array.isArray(options.status) ? options.status.join(',') : options.status)
  }
  if (options.triggerType) params.set('triggerType', options.triggerType)
  if (options.workflowName) params.set('workflowName', options.workflowName)
  if (options.startDate) params.set('startDate', options.startDate.toISOString())
  if (options.endDate) params.set('endDate', options.endDate.toISOString())
  if (options.page) params.set('page', options.page.toString())
  if (options.pageSize) params.set('pageSize', options.pageSize.toString())
  if (options.orderBy) params.set('orderBy', options.orderBy)
  if (options.orderDirection) params.set('orderDirection', options.orderDirection)

  const response = await fetch(`/api/workflow-executions?${params.toString()}`)
  if (!response.ok) {
    throw new Error('Failed to fetch executions')
  }
  return response.json()
}

async function fetchExecutionDetail(id: string): Promise<ExecutionDetailResponse> {
  const response = await fetch(`/api/workflow-executions/${id}`)
  if (!response.ok) {
    throw new Error('Failed to fetch execution detail')
  }
  return response.json()
}

async function fetchRunningExecutions(
  cityCode?: string
): Promise<RunningExecutionsResponse> {
  const url = cityCode
    ? `/api/workflow-executions/running?cityCode=${cityCode}`
    : '/api/workflow-executions/running'
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error('Failed to fetch running executions')
  }
  return response.json()
}

async function fetchExecutionStats(options: {
  cityCode?: string
  startDate?: Date
  endDate?: Date
}): Promise<ExecutionStatsResponse> {
  const params = new URLSearchParams()
  if (options.cityCode) params.set('cityCode', options.cityCode)
  if (options.startDate) params.set('startDate', options.startDate.toISOString())
  if (options.endDate) params.set('endDate', options.endDate.toISOString())

  const response = await fetch(`/api/workflow-executions/stats?${params.toString()}`)
  if (!response.ok) {
    throw new Error('Failed to fetch execution stats')
  }
  return response.json()
}

// ===========================================
// 執行列表 Hook
// ===========================================
export function useWorkflowExecutions(options: ListExecutionsOptions & {
  enabled?: boolean
  autoRefresh?: boolean
  refreshInterval?: number
} = {}) {
  const {
    enabled = true,
    autoRefresh = false,
    refreshInterval = 5000,
    ...filterOptions
  } = options

  return useQuery({
    queryKey: ['workflow-executions', filterOptions],
    queryFn: () => fetchExecutions(filterOptions),
    enabled,
    refetchInterval: autoRefresh ? refreshInterval : false,
    staleTime: autoRefresh ? 0 : 30000,
  })
}

// ===========================================
// 執行詳情 Hook
// ===========================================
export function useWorkflowExecutionDetail(
  id: string | null,
  options: { enabled?: boolean; autoRefresh?: boolean } = {}
) {
  const { enabled = true, autoRefresh = false } = options

  return useQuery({
    queryKey: ['workflow-execution', id],
    queryFn: () => fetchExecutionDetail(id!),
    enabled: enabled && !!id,
    refetchInterval: autoRefresh ? 3000 : false,
  })
}

// ===========================================
// 執行中工作流 Hook
// ===========================================
export function useRunningExecutions(cityCode?: string) {
  return useQuery({
    queryKey: ['running-executions', cityCode],
    queryFn: () => fetchRunningExecutions(cityCode),
    refetchInterval: 3000, // 每 3 秒自動刷新
    staleTime: 0,
  })
}

// ===========================================
// 執行統計 Hook
// ===========================================
export function useExecutionStats(options: {
  cityCode?: string
  startDate?: Date
  endDate?: Date
  enabled?: boolean
} = {}) {
  const { enabled = true, ...queryOptions } = options

  return useQuery({
    queryKey: ['execution-stats', queryOptions],
    queryFn: () => fetchExecutionStats(queryOptions),
    enabled,
    staleTime: 60000, // 1 分鐘快取
  })
}
```

---

## 7. 測試計畫

### 7.1 單元測試

```typescript
// __tests__/services/n8n/workflowExecutionService.test.ts
import { WorkflowExecutionService } from '@/lib/services/n8n/workflowExecutionService'
import { prismaMock } from '@/lib/__mocks__/prisma'

describe('WorkflowExecutionService', () => {
  let service: WorkflowExecutionService

  beforeEach(() => {
    service = new WorkflowExecutionService()
    jest.clearAllMocks()
  })

  describe('listExecutions', () => {
    it('應該返回分頁的執行記錄列表', async () => {
      const mockExecutions = [
        {
          id: 'exec-1',
          workflowName: 'Invoice Processing',
          triggerType: 'DOCUMENT',
          status: 'COMPLETED',
          progress: 100,
          startedAt: new Date(),
          completedAt: new Date(),
          durationMs: 5000,
          _count: { documents: 3 },
        },
      ]

      prismaMock.workflowExecution.findMany.mockResolvedValue(mockExecutions as any)
      prismaMock.workflowExecution.count.mockResolvedValue(1)

      const result = await service.listExecutions({ page: 1, pageSize: 20 })

      expect(result.items).toHaveLength(1)
      expect(result.total).toBe(1)
      expect(result.items[0].documentCount).toBe(3)
    })

    it('應該正確過濾狀態', async () => {
      prismaMock.workflowExecution.findMany.mockResolvedValue([])
      prismaMock.workflowExecution.count.mockResolvedValue(0)

      await service.listExecutions({ status: 'RUNNING' })

      expect(prismaMock.workflowExecution.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'RUNNING',
          }),
        })
      )
    })

    it('應該支援多狀態篩選', async () => {
      prismaMock.workflowExecution.findMany.mockResolvedValue([])
      prismaMock.workflowExecution.count.mockResolvedValue(0)

      await service.listExecutions({ status: ['RUNNING', 'PENDING'] as any })

      expect(prismaMock.workflowExecution.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: { in: ['RUNNING', 'PENDING'] },
          }),
        })
      )
    })

    it('應該支援日期範圍篩選', async () => {
      const startDate = new Date('2024-01-01')
      const endDate = new Date('2024-01-31')

      prismaMock.workflowExecution.findMany.mockResolvedValue([])
      prismaMock.workflowExecution.count.mockResolvedValue(0)

      await service.listExecutions({ startDate, endDate })

      expect(prismaMock.workflowExecution.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            startedAt: { gte: startDate, lte: endDate },
          }),
        })
      )
    })
  })

  describe('getExecutionDetail', () => {
    it('應該返回包含步驟和文件的詳細資訊', async () => {
      const mockExecution = {
        id: 'exec-1',
        n8nExecutionId: 'n8n-1',
        workflowName: 'Test Workflow',
        triggerType: 'MANUAL',
        cityCode: 'TPE',
        status: 'COMPLETED',
        progress: 100,
        startedAt: new Date(),
        completedAt: new Date(),
        durationMs: 5000,
        steps: [
          { stepNumber: 1, stepName: 'Start', status: 'COMPLETED' },
          { stepNumber: 2, stepName: 'Process', status: 'COMPLETED' },
        ],
        documents: [
          { id: 'doc-1', fileName: 'invoice.pdf', status: 'PROCESSED' },
        ],
      }

      prismaMock.workflowExecution.findUnique.mockResolvedValue(mockExecution as any)

      const result = await service.getExecutionDetail('exec-1')

      expect(result).not.toBeNull()
      expect(result?.steps).toHaveLength(2)
      expect(result?.documents).toHaveLength(1)
    })

    it('應該在找不到記錄時返回 null', async () => {
      prismaMock.workflowExecution.findUnique.mockResolvedValue(null)

      const result = await service.getExecutionDetail('non-existent')

      expect(result).toBeNull()
    })
  })

  describe('updateExecutionStatus', () => {
    it('應該在完成時計算耗時', async () => {
      const startedAt = new Date(Date.now() - 10000)

      prismaMock.workflowExecution.findUnique.mockResolvedValue({
        id: 'exec-1',
        n8nExecutionId: 'n8n-exec-1',
        startedAt,
        status: 'RUNNING',
      } as any)

      prismaMock.workflowExecution.update.mockResolvedValue({} as any)

      await service.updateExecutionStatus('n8n-exec-1', 'COMPLETED', {
        result: { success: true },
      })

      expect(prismaMock.workflowExecution.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'COMPLETED',
            completedAt: expect.any(Date),
            durationMs: expect.any(Number),
            result: { success: true },
          }),
        })
      )
    })

    it('應該在開始執行時設定 startedAt', async () => {
      prismaMock.workflowExecution.findUnique.mockResolvedValue({
        id: 'exec-1',
        n8nExecutionId: 'n8n-exec-1',
        startedAt: null,
        status: 'PENDING',
      } as any)

      prismaMock.workflowExecution.update.mockResolvedValue({} as any)

      await service.updateExecutionStatus('n8n-exec-1', 'RUNNING')

      expect(prismaMock.workflowExecution.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'RUNNING',
            startedAt: expect.any(Date),
          }),
        })
      )
    })
  })

  describe('getExecutionStats', () => {
    it('應該正確計算成功率', async () => {
      prismaMock.workflowExecution.count.mockResolvedValue(100)
      prismaMock.workflowExecution.groupBy
        .mockResolvedValueOnce([
          { status: 'COMPLETED', _count: 80 },
          { status: 'FAILED', _count: 20 },
        ] as any)
        .mockResolvedValueOnce([
          { triggerType: 'MANUAL', _count: 50 },
          { triggerType: 'SCHEDULED', _count: 50 },
        ] as any)
      prismaMock.workflowExecution.aggregate.mockResolvedValue({
        _avg: { durationMs: 5000 },
      } as any)

      const result = await service.getExecutionStats({})

      expect(result.total).toBe(100)
      expect(result.successRate).toBe(80)
      expect(result.avgDurationMs).toBe(5000)
    })
  })
})
```

### 7.2 API 整合測試

```typescript
// __tests__/api/workflow-executions.test.ts
import { createMocks } from 'node-mocks-http'
import { GET } from '@/app/api/workflow-executions/route'
import { GET as GetDetail } from '@/app/api/workflow-executions/[id]/route'

jest.mock('next-auth', () => ({
  getServerSession: jest.fn(),
}))

jest.mock('@/lib/services/n8n/workflowExecutionService', () => ({
  workflowExecutionService: {
    listExecutions: jest.fn(),
    getExecutionDetail: jest.fn(),
  },
}))

describe('Workflow Executions API', () => {
  describe('GET /api/workflow-executions', () => {
    it('應該要求身份驗證', async () => {
      const { req } = createMocks({ method: 'GET' })
      const response = await GET(req as any)
      expect(response.status).toBe(401)
    })

    it('應該驗證城市權限', async () => {
      // 模擬已登入用戶
      require('next-auth').getServerSession.mockResolvedValue({
        user: { id: 'user-1' },
      })

      jest.mock('@/lib/utils/permissions', () => ({
        getUserCityAccess: jest.fn().mockResolvedValue(['TPE']),
      }))

      const { req } = createMocks({
        method: 'GET',
        url: '/api/workflow-executions?cityCode=KHH',
      })

      const response = await GET(req as any)
      expect(response.status).toBe(403)
    })
  })
})
```

### 7.3 組件測試

```typescript
// __tests__/components/workflow/WorkflowExecutionList.test.tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { WorkflowExecutionList } from '@/components/workflow/WorkflowExecutionList'

const mockExecutions = [
  {
    id: 'exec-1',
    workflowName: 'Invoice Processing',
    triggerType: 'DOCUMENT',
    status: 'COMPLETED',
    progress: 100,
    startedAt: new Date(),
    completedAt: new Date(),
    durationMs: 5000,
    documentCount: 3,
  },
  {
    id: 'exec-2',
    workflowName: 'Data Export',
    triggerType: 'MANUAL',
    status: 'RUNNING',
    progress: 60,
    currentStep: 'Processing documents...',
    startedAt: new Date(),
    documentCount: 1,
  },
]

describe('WorkflowExecutionList', () => {
  const defaultProps = {
    executions: mockExecutions,
    total: 2,
    page: 1,
    pageSize: 20,
    onPageChange: jest.fn(),
    onPageSizeChange: jest.fn(),
  }

  it('應該顯示執行記錄列表', () => {
    render(<WorkflowExecutionList {...defaultProps} />)

    expect(screen.getByText('Invoice Processing')).toBeInTheDocument()
    expect(screen.getByText('Data Export')).toBeInTheDocument()
  })

  it('應該顯示正確的狀態標籤', () => {
    render(<WorkflowExecutionList {...defaultProps} />)

    expect(screen.getByText('已完成')).toBeInTheDocument()
    expect(screen.getByText('執行中')).toBeInTheDocument()
  })

  it('應該在執行中顯示進度條', () => {
    render(<WorkflowExecutionList {...defaultProps} />)

    expect(screen.getByText('60%')).toBeInTheDocument()
    expect(screen.getByText('Processing documents...')).toBeInTheDocument()
  })

  it('應該顯示空狀態', () => {
    render(<WorkflowExecutionList {...defaultProps} executions={[]} total={0} />)

    expect(screen.getByText('沒有找到工作流執行記錄')).toBeInTheDocument()
  })

  it('應該觸發分頁變更', () => {
    render(<WorkflowExecutionList {...defaultProps} total={50} />)

    const nextButton = screen.getByLabelText('Go to next page')
    fireEvent.click(nextButton)

    expect(defaultProps.onPageChange).toHaveBeenCalledWith(2)
  })
})
```

---

## 8. 部署注意事項

### 8.1 即時更新策略

```yaml
# 輪詢配置（預設）
polling:
  running_executions: 3000ms    # 執行中列表每 3 秒刷新
  execution_list: 5000ms        # 一般列表每 5 秒刷新
  execution_detail: 3000ms      # 詳情頁每 3 秒刷新（執行中時）

# WebSocket 配置（可選升級）
websocket:
  enabled: false                # 預設關閉
  endpoint: /api/ws/executions
  heartbeat: 30000ms
```

### 8.2 性能優化

```yaml
database:
  indexes:
    - status               # 狀態篩選
    - cityCode             # 城市隔離
    - startedAt            # 時間範圍查詢
    - n8nExecutionId       # n8n 回調查詢

  archiving:
    enabled: true
    retention_days: 90     # 保留 90 天
    archive_table: workflow_execution_archive
    batch_size: 1000

query_optimization:
  default_page_size: 20
  max_page_size: 100
  use_cursor_pagination: false  # 考慮大量資料時啟用
```

### 8.3 監控指標

```yaml
metrics:
  - name: workflow_execution_total
    type: counter
    labels: [status, trigger_type, city_code]

  - name: workflow_execution_duration_seconds
    type: histogram
    buckets: [1, 5, 10, 30, 60, 300, 600]

  - name: workflow_success_rate
    type: gauge
    labels: [workflow_name, city_code]

  - name: active_executions
    type: gauge
    labels: [city_code]

alerting:
  - name: high_failure_rate
    condition: success_rate < 0.8
    duration: 5m
    severity: warning

  - name: execution_timeout
    condition: duration > 600s
    severity: critical
```

### 8.4 環境變數

```bash
# .env.example
# 執行狀態監控配置
EXECUTION_POLLING_INTERVAL=5000
EXECUTION_RUNNING_POLL_INTERVAL=3000
EXECUTION_RETENTION_DAYS=90

# 可選 WebSocket 配置
EXECUTION_WS_ENABLED=false
EXECUTION_WS_HEARTBEAT=30000
```

---

## 9. 驗收標準對應

| AC | 描述 | 實現方式 |
|----|------|---------|
| AC1 | 工作流執行列表 | `WorkflowExecutionList` 組件 + `listExecutions` API |
| AC2 | 篩選功能 | `WorkflowExecutionFilters` 組件 + 查詢參數處理 |
| AC3 | 執行中狀態顯示 | `RunningTimer` + 進度條 + 輪詢自動更新 |
| AC4 | 完成狀態顯示 | 綠色勾號 Chip + 耗時顯示 |
| AC5 | 失敗狀態顯示 | 紅色錯誤 Chip + 錯誤訊息 Tooltip + 詳情連結 |

---

## 10. 開放問題

1. **WebSocket vs 輪詢**: 目前使用輪詢實現即時更新，是否需要升級為 WebSocket？
   - 輪詢優點：實現簡單、伺服器壓力可控
   - WebSocket 優點：更即時、減少請求數量
   - 建議：初期使用輪詢，根據用戶數量和需求考慮升級

2. **執行記錄歸檔**: 長期執行記錄如何處理？
   - 建議：90 天後自動歸檔到歷史表
   - 可選：導出為 CSV/JSON 供下載

3. **大量執行記錄效能**: 如果執行記錄量很大，是否需要游標分頁？
   - 建議：目前使用偏移分頁，監控效能
   - 如有需要可升級為游標分頁

4. **步驟詳情儲存**: 是否需要儲存每個步驟的完整輸入/輸出資料？
   - 建議：預設只儲存錯誤步驟的資料
   - 可配置開啟詳細日誌模式

---

## 11. 參考資料

- [Story 10-3: 工作流執行狀態查看](../stories/10-3-workflow-execution-status-view.md)
- [Tech Spec Story 10-1: n8n 雙向通訊 API](./tech-spec-story-10-1.md)
- [n8n Execution API Documentation](https://docs.n8n.io/api/execution/)
- [React Query Documentation](https://tanstack.com/query/latest)
- [Material-UI Table Component](https://mui.com/material-ui/react-table/)
- [SWR Documentation](https://swr.vercel.app/)
