# Story 11-2: API 處理狀態查詢端點

## Story 資訊

- **Epic**: 11 - 對外 API 服務
- **功能需求**: FR65 (狀態查詢 API)
- **優先級**: High
- **故事點數**: 5
- **相關 Stories**:
  - Story 11-1 (API 發票提交端點)
  - Story 11-3 (API 處理結果獲取端點)
  - Story 11-5 (API 訪問控制與認證)

## 使用者故事

**As a** 外部系統開發者,
**I want** 查詢已提交發票的處理狀態,
**So that** 我可以追蹤處理進度並在完成時獲取結果。

## 驗收標準

### AC1: 基本狀態查詢

**Given** 已提交發票並獲得任務 ID
**When** 調用 `GET /api/v1/invoices/{taskId}/status`
**Then** 返回處理狀態資訊：
- `status` - 狀態碼（queued/processing/completed/failed/review_required）
- `progress` - 進度百分比
- `currentStep` - 當前步驟描述
- `createdAt` - 創建時間
- `updatedAt` - 最後更新時間
- `estimatedCompletion` - 預估完成時間

### AC2: 完成狀態額外資訊

**Given** 查詢狀態
**When** 狀態為 `completed`
**Then** 額外返回：
- `resultUrl` - 結果獲取 URL
- `completedAt` - 完成時間
- `confidenceScore` - 整體信心度

### AC3: 失敗狀態錯誤資訊

**Given** 查詢狀態
**When** 狀態為 `failed`
**Then** 額外返回：
- `error.code` - 錯誤代碼
- `error.message` - 錯誤訊息
- `error.retryable` - 是否可重試

### AC4: 任務不存在處理

**Given** 查詢不存在的任務 ID
**When** 調用狀態查詢
**Then** 返回 HTTP 404 Not Found

## 技術規格

### 1. 狀態查詢服務

```typescript
// lib/services/externalApi/taskStatusService.ts
import { prisma } from '@/lib/prisma'
import { ExternalApiTask, ApiTaskStatus, ExternalApiKey } from '@prisma/client'

export interface TaskStatusResponse {
  taskId: string
  status: string
  progress: number
  currentStep?: string
  createdAt: string
  updatedAt: string
  estimatedCompletion?: string

  // 完成狀態額外資訊
  resultUrl?: string
  completedAt?: string
  confidenceScore?: number

  // 失敗狀態額外資訊
  error?: {
    code: string
    message: string
    retryable: boolean
  }

  // 審核狀態額外資訊
  reviewInfo?: {
    reason: string
    escalatedAt: string
  }
}

// 狀態映射（內部狀態 -> API 狀態）
const STATUS_MAP: Record<ApiTaskStatus, string> = {
  QUEUED: 'queued',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
  REVIEW_REQUIRED: 'review_required',
  EXPIRED: 'expired',
}

// 步驟描述
const STEP_DESCRIPTIONS: Record<string, string> = {
  QUEUED: 'Waiting in queue',
  UPLOADING: 'Uploading document',
  OCR_PROCESSING: 'Extracting text with OCR',
  AI_EXTRACTING: 'AI extracting invoice data',
  FORWARDER_IDENTIFYING: 'Identifying forwarder',
  FIELD_MAPPING: 'Mapping fields',
  VALIDATION: 'Validating extracted data',
  REVIEW_PENDING: 'Pending human review',
  COMPLETED: 'Processing completed',
}

export class TaskStatusService {
  // 獲取任務狀態
  async getTaskStatus(
    taskId: string,
    apiKey: ExternalApiKey
  ): Promise<TaskStatusResponse | null> {
    const task = await prisma.externalApiTask.findUnique({
      where: { taskId },
      include: {
        document: {
          include: {
            extractionResult: true,
            forwarder: true,
          },
        },
      },
    })

    if (!task) {
      return null
    }

    // 驗證 API Key 權限
    if (task.apiKeyId !== apiKey.id) {
      // 檢查是否有跨租戶查詢權限
      const allowedCities = apiKey.allowedCities as string[]
      if (!allowedCities.includes('*') && !allowedCities.includes(task.cityCode)) {
        return null  // 返回 null 而非錯誤，避免洩露任務存在信息
      }
    }

    return this.buildStatusResponse(task)
  }

  // 批量獲取任務狀態
  async getTaskStatuses(
    taskIds: string[],
    apiKey: ExternalApiKey
  ): Promise<Map<string, TaskStatusResponse>> {
    const tasks = await prisma.externalApiTask.findMany({
      where: {
        taskId: { in: taskIds },
        apiKeyId: apiKey.id,
      },
      include: {
        document: {
          include: {
            extractionResult: true,
            forwarder: true,
          },
        },
      },
    })

    const result = new Map<string, TaskStatusResponse>()

    for (const task of tasks) {
      const status = this.buildStatusResponse(task)
      result.set(task.taskId, status)
    }

    return result
  }

  // 列出任務
  async listTasks(
    apiKey: ExternalApiKey,
    options?: {
      status?: string
      cityCode?: string
      startDate?: Date
      endDate?: Date
      page?: number
      pageSize?: number
    }
  ): Promise<{
    items: TaskStatusResponse[]
    total: number
    page: number
    pageSize: number
  }> {
    const {
      status,
      cityCode,
      startDate,
      endDate,
      page = 1,
      pageSize = 20,
    } = options || {}

    const where: any = {
      apiKeyId: apiKey.id,
    }

    if (status) {
      // 將 API 狀態轉換為內部狀態
      const internalStatus = Object.entries(STATUS_MAP).find(
        ([_, v]) => v === status
      )?.[0]
      if (internalStatus) {
        where.status = internalStatus
      }
    }

    if (cityCode) {
      const allowedCities = apiKey.allowedCities as string[]
      if (allowedCities.includes('*') || allowedCities.includes(cityCode)) {
        where.cityCode = cityCode
      }
    }

    if (startDate || endDate) {
      where.createdAt = {}
      if (startDate) where.createdAt.gte = startDate
      if (endDate) where.createdAt.lte = endDate
    }

    const [tasks, total] = await Promise.all([
      prisma.externalApiTask.findMany({
        where,
        include: {
          document: {
            include: {
              extractionResult: true,
              forwarder: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.externalApiTask.count({ where }),
    ])

    return {
      items: tasks.map((task) => this.buildStatusResponse(task)),
      total,
      page,
      pageSize,
    }
  }

  // 構建狀態回應
  private buildStatusResponse(task: any): TaskStatusResponse {
    const response: TaskStatusResponse = {
      taskId: task.taskId,
      status: STATUS_MAP[task.status as ApiTaskStatus] || task.status.toLowerCase(),
      progress: task.progress,
      currentStep: task.currentStep
        ? STEP_DESCRIPTIONS[task.currentStep] || task.currentStep
        : undefined,
      createdAt: task.createdAt.toISOString(),
      updatedAt: task.updatedAt.toISOString(),
    }

    // 添加預估完成時間（僅未完成時）
    if (!['COMPLETED', 'FAILED', 'EXPIRED'].includes(task.status) && task.estimatedCompletion) {
      response.estimatedCompletion = task.estimatedCompletion.toISOString()
    }

    // 完成狀態
    if (task.status === 'COMPLETED') {
      response.resultUrl = `/api/v1/invoices/${task.taskId}/result`
      response.completedAt = task.completedAt?.toISOString()
      response.confidenceScore = task.confidenceScore || task.document?.extractionResult?.confidenceScore
    }

    // 失敗狀態
    if (task.status === 'FAILED') {
      response.error = {
        code: task.errorCode || 'UNKNOWN_ERROR',
        message: task.errorMessage || 'An error occurred during processing',
        retryable: task.errorRetryable ?? false,
      }
    }

    // 審核狀態
    if (task.status === 'REVIEW_REQUIRED') {
      response.reviewInfo = {
        reason: task.document?.escalationReason || 'Manual review required',
        escalatedAt: task.document?.escalatedAt?.toISOString() || task.updatedAt.toISOString(),
      }
    }

    return response
  }

  // 更新任務狀態（內部使用）
  async updateTaskStatus(
    taskId: string,
    status: ApiTaskStatus,
    updates?: {
      progress?: number
      currentStep?: string
      errorCode?: string
      errorMessage?: string
      errorRetryable?: boolean
      confidenceScore?: number
    }
  ): Promise<void> {
    const updateData: any = {
      status,
      updatedAt: new Date(),
    }

    if (updates?.progress !== undefined) updateData.progress = updates.progress
    if (updates?.currentStep !== undefined) updateData.currentStep = updates.currentStep
    if (updates?.errorCode !== undefined) updateData.errorCode = updates.errorCode
    if (updates?.errorMessage !== undefined) updateData.errorMessage = updates.errorMessage
    if (updates?.errorRetryable !== undefined) updateData.errorRetryable = updates.errorRetryable
    if (updates?.confidenceScore !== undefined) updateData.confidenceScore = updates.confidenceScore

    // 設置完成時間
    if (['COMPLETED', 'FAILED'].includes(status)) {
      updateData.completedAt = new Date()
    }

    // 設置結果可用標記和過期時間
    if (status === 'COMPLETED') {
      updateData.resultAvailable = true
      // 結果保留 30 天
      updateData.resultExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    }

    await prisma.externalApiTask.update({
      where: { taskId },
      data: updateData,
    })
  }
}

export const taskStatusService = new TaskStatusService()
```

### 2. API 路由實現

```typescript
// app/api/v1/invoices/[taskId]/status/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { taskStatusService } from '@/lib/services/externalApi/taskStatusService'
import { externalApiAuthMiddleware } from '@/lib/middleware/externalApiAuthMiddleware'
import { rateLimitMiddleware } from '@/lib/middleware/rateLimitMiddleware'

export async function GET(
  request: NextRequest,
  { params }: { params: { taskId: string } }
) {
  const traceId = `api_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

  try {
    // 1. 認證
    const authResult = await externalApiAuthMiddleware(request, ['query'])
    if (!authResult.authorized) {
      return NextResponse.json(
        {
          error: {
            code: authResult.errorCode,
            message: authResult.errorMessage,
          },
          traceId,
        },
        { status: authResult.statusCode }
      )
    }

    // 2. 速率限制
    const rateLimitResult = await rateLimitMiddleware(request, authResult.apiKey!)
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        {
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Too many requests',
          },
          traceId,
        },
        {
          status: 429,
          headers: {
            'Retry-After': rateLimitResult.retryAfter?.toString() || '60',
          },
        }
      )
    }

    // 3. 獲取狀態
    const status = await taskStatusService.getTaskStatus(
      params.taskId,
      authResult.apiKey!
    )

    if (!status) {
      return NextResponse.json(
        {
          error: {
            code: 'TASK_NOT_FOUND',
            message: 'Task not found or access denied',
          },
          traceId,
        },
        { status: 404 }
      )
    }

    // 4. 返回結果
    return NextResponse.json(
      {
        data: status,
        traceId,
      },
      {
        status: 200,
        headers: {
          'X-RateLimit-Remaining': rateLimitResult.remaining?.toString() || '59',
          // 如果正在處理中，建議的輪詢間隔
          ...(status.status === 'processing' && {
            'X-Poll-Interval': '5',
          }),
        },
      }
    )
  } catch (error) {
    console.error('Get task status error:', error)
    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred',
        },
        traceId,
      },
      { status: 500 }
    )
  }
}
```

```typescript
// app/api/v1/invoices/route.ts (GET - 列出任務)
import { NextRequest, NextResponse } from 'next/server'
import { taskStatusService } from '@/lib/services/externalApi/taskStatusService'
import { externalApiAuthMiddleware } from '@/lib/middleware/externalApiAuthMiddleware'
import { rateLimitMiddleware } from '@/lib/middleware/rateLimitMiddleware'

export async function GET(request: NextRequest) {
  const traceId = `api_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

  try {
    // 1. 認證
    const authResult = await externalApiAuthMiddleware(request, ['query'])
    if (!authResult.authorized) {
      return NextResponse.json(
        {
          error: {
            code: authResult.errorCode,
            message: authResult.errorMessage,
          },
          traceId,
        },
        { status: authResult.statusCode }
      )
    }

    // 2. 速率限制
    const rateLimitResult = await rateLimitMiddleware(request, authResult.apiKey!)
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        {
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Too many requests',
          },
          traceId,
        },
        { status: 429 }
      )
    }

    // 3. 解析查詢參數
    const searchParams = request.nextUrl.searchParams
    const options = {
      status: searchParams.get('status') || undefined,
      cityCode: searchParams.get('cityCode') || undefined,
      startDate: searchParams.get('startDate')
        ? new Date(searchParams.get('startDate')!)
        : undefined,
      endDate: searchParams.get('endDate')
        ? new Date(searchParams.get('endDate')!)
        : undefined,
      page: parseInt(searchParams.get('page') || '1'),
      pageSize: Math.min(parseInt(searchParams.get('pageSize') || '20'), 100),
    }

    // 4. 獲取任務列表
    const result = await taskStatusService.listTasks(authResult.apiKey!, options)

    // 5. 返回結果
    return NextResponse.json(
      {
        data: result.items,
        pagination: {
          page: result.page,
          pageSize: result.pageSize,
          total: result.total,
          totalPages: Math.ceil(result.total / result.pageSize),
        },
        traceId,
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('List tasks error:', error)
    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred',
        },
        traceId,
      },
      { status: 500 }
    )
  }
}
```

```typescript
// app/api/v1/invoices/batch-status/route.ts (批量查詢)
import { NextRequest, NextResponse } from 'next/server'
import { taskStatusService } from '@/lib/services/externalApi/taskStatusService'
import { externalApiAuthMiddleware } from '@/lib/middleware/externalApiAuthMiddleware'
import { rateLimitMiddleware } from '@/lib/middleware/rateLimitMiddleware'
import { z } from 'zod'

const batchStatusSchema = z.object({
  taskIds: z.array(z.string()).min(1).max(100),
})

export async function POST(request: NextRequest) {
  const traceId = `api_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

  try {
    // 1. 認證
    const authResult = await externalApiAuthMiddleware(request, ['query'])
    if (!authResult.authorized) {
      return NextResponse.json(
        {
          error: {
            code: authResult.errorCode,
            message: authResult.errorMessage,
          },
          traceId,
        },
        { status: authResult.statusCode }
      )
    }

    // 2. 速率限制
    const rateLimitResult = await rateLimitMiddleware(request, authResult.apiKey!)
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        {
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Too many requests',
          },
          traceId,
        },
        { status: 429 }
      )
    }

    // 3. 解析請求
    const body = await request.json()
    const { taskIds } = batchStatusSchema.parse(body)

    // 4. 批量獲取狀態
    const statusMap = await taskStatusService.getTaskStatuses(taskIds, authResult.apiKey!)

    // 5. 構建回應
    const results: Record<string, any> = {}
    for (const taskId of taskIds) {
      const status = statusMap.get(taskId)
      results[taskId] = status || { error: { code: 'NOT_FOUND', message: 'Task not found' } }
    }

    return NextResponse.json(
      {
        data: results,
        traceId,
      },
      { status: 200 }
    )
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request parameters',
            details: error.errors,
          },
          traceId,
        },
        { status: 400 }
      )
    }

    console.error('Batch status error:', error)
    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred',
        },
        traceId,
      },
      { status: 500 }
    )
  }
}
```

## 測試案例

### 單元測試

```typescript
// __tests__/services/externalApi/taskStatusService.test.ts
import { taskStatusService } from '@/lib/services/externalApi/taskStatusService'
import { prismaMock } from '@/lib/__mocks__/prisma'

describe('TaskStatusService', () => {
  describe('getTaskStatus', () => {
    it('should return status for valid task', async () => {
      prismaMock.externalApiTask.findUnique.mockResolvedValue({
        taskId: 'task-1',
        apiKeyId: 'key-1',
        status: 'PROCESSING',
        progress: 50,
        currentStep: 'AI_EXTRACTING',
        createdAt: new Date(),
        updatedAt: new Date(),
        cityCode: 'TPE',
      } as any)

      const apiKey = { id: 'key-1', allowedCities: ['*'] } as any

      const result = await taskStatusService.getTaskStatus('task-1', apiKey)

      expect(result).not.toBeNull()
      expect(result?.status).toBe('processing')
      expect(result?.progress).toBe(50)
    })

    it('should return null for unauthorized task', async () => {
      prismaMock.externalApiTask.findUnique.mockResolvedValue({
        taskId: 'task-1',
        apiKeyId: 'key-1',
        cityCode: 'HKG',
      } as any)

      const apiKey = { id: 'key-2', allowedCities: ['TPE'] } as any

      const result = await taskStatusService.getTaskStatus('task-1', apiKey)

      expect(result).toBeNull()
    })

    it('should include error info for failed tasks', async () => {
      prismaMock.externalApiTask.findUnique.mockResolvedValue({
        taskId: 'task-1',
        apiKeyId: 'key-1',
        status: 'FAILED',
        errorCode: 'OCR_FAILED',
        errorMessage: 'Failed to extract text',
        errorRetryable: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        cityCode: 'TPE',
      } as any)

      const apiKey = { id: 'key-1', allowedCities: ['*'] } as any

      const result = await taskStatusService.getTaskStatus('task-1', apiKey)

      expect(result?.error).toBeDefined()
      expect(result?.error?.code).toBe('OCR_FAILED')
      expect(result?.error?.retryable).toBe(true)
    })

    it('should include result URL for completed tasks', async () => {
      prismaMock.externalApiTask.findUnique.mockResolvedValue({
        taskId: 'task-1',
        apiKeyId: 'key-1',
        status: 'COMPLETED',
        progress: 100,
        confidenceScore: 0.95,
        completedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        cityCode: 'TPE',
      } as any)

      const apiKey = { id: 'key-1', allowedCities: ['*'] } as any

      const result = await taskStatusService.getTaskStatus('task-1', apiKey)

      expect(result?.resultUrl).toBe('/api/v1/invoices/task-1/result')
      expect(result?.confidenceScore).toBe(0.95)
    })
  })
})
```

## 部署注意事項

1. **回應格式一致性**
   - 所有回應包含 `traceId` 便於追蹤
   - 錯誤回應使用統一的 error 物件結構

2. **性能優化**
   - 批量查詢支援最多 100 個任務
   - 列表查詢分頁限制 100 筆/頁

3. **監控指標**
   - 狀態查詢延遲
   - 404 錯誤率（可能指示無效任務 ID）

## 相依性

- Story 11-1: API 發票提交端點（任務創建）
- Story 11-3: API 處理結果獲取端點（resultUrl 指向）
- Story 11-5: API 訪問控制與認證（認證機制）
