# Tech Spec: Story 11-2 - API 處理狀態查詢端點

## 概述

### Story 資訊
- **Story ID**: 11-2
- **標題**: API 處理狀態查詢端點
- **Epic**: 11 - 對外 API 服務
- **故事點數**: 5
- **優先級**: High

### 目標
建立處理狀態查詢 API 端點，允許外部系統追蹤已提交發票的處理進度，支援單一任務查詢、批量查詢及任務列表功能，並根據不同狀態返回相應的額外資訊。

### 相依性
- Story 11-1: API 發票提交端點（任務創建來源）
- Story 11-3: API 處理結果獲取端點（resultUrl 指向）
- Story 11-5: API 訪問控制與認證（認證機制）

---

## 1. 資料庫設計

### 1.1 依賴現有模型

本功能主要依賴 Story 11-1 中定義的 `ExternalApiTask` 模型，不需要新增資料表。

### 1.2 狀態枚舉回顧

```prisma
enum ApiTaskStatus {
  QUEUED            // 排隊中 → API 回應 "queued"
  PROCESSING        // 處理中 → API 回應 "processing"
  COMPLETED         // 已完成 → API 回應 "completed"
  FAILED            // 失敗 → API 回應 "failed"
  REVIEW_REQUIRED   // 需要審核 → API 回應 "review_required"
  EXPIRED           // 已過期 → API 回應 "expired"
}
```

### 1.3 索引優化建議

| 索引 | 用途 | 查詢場景 |
|------|------|----------|
| `taskId` (unique) | 單一任務查詢 | `GET /api/v1/invoices/{taskId}/status` |
| `apiKeyId, status` | 按狀態過濾 | `GET /api/v1/invoices?status=processing` |
| `apiKeyId, createdAt DESC` | 時間排序列表 | `GET /api/v1/invoices?page=1` |
| `apiKeyId, cityCode, status` | 城市+狀態過濾 | 多條件組合查詢 |

---

## 2. 類型定義

### 2.1 狀態回應類型

```typescript
// types/externalApi/status.ts

/**
 * 任務狀態回應
 */
export interface TaskStatusResponse {
  // 基本資訊
  taskId: string
  status: TaskStatus
  progress: number           // 0-100
  currentStep?: string       // 當前處理步驟描述
  createdAt: string          // ISO 8601
  updatedAt: string          // ISO 8601
  estimatedCompletion?: string  // ISO 8601，僅處理中時返回

  // 完成狀態額外資訊
  resultUrl?: string         // 結果獲取 URL
  completedAt?: string       // ISO 8601
  confidenceScore?: number   // 0-1

  // 失敗狀態額外資訊
  error?: TaskError

  // 審核狀態額外資訊
  reviewInfo?: ReviewInfo
}

/**
 * 任務狀態枚舉
 */
export type TaskStatus =
  | 'queued'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'review_required'
  | 'expired'

/**
 * 錯誤資訊
 */
export interface TaskError {
  code: string
  message: string
  retryable: boolean
}

/**
 * 審核資訊
 */
export interface ReviewInfo {
  reason: string
  escalatedAt: string
}

/**
 * 任務列表回應
 */
export interface TaskListResponse {
  data: TaskStatusResponse[]
  pagination: PaginationInfo
  traceId: string
}

/**
 * 分頁資訊
 */
export interface PaginationInfo {
  page: number
  pageSize: number
  total: number
  totalPages: number
}

/**
 * 批量查詢回應
 */
export interface BatchStatusResponse {
  data: Record<string, TaskStatusResponse | { error: TaskError }>
  traceId: string
}
```

### 2.2 查詢參數類型

```typescript
// types/externalApi/query.ts

import { z } from 'zod'

/**
 * 列表查詢參數 Schema
 */
export const listQuerySchema = z.object({
  status: z.enum(['queued', 'processing', 'completed', 'failed', 'review_required']).optional(),
  cityCode: z.string().max(10).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

export type ListQueryParams = z.infer<typeof listQuerySchema>

/**
 * 批量查詢 Schema
 */
export const batchStatusSchema = z.object({
  taskIds: z.array(z.string()).min(1).max(100),
})

export type BatchStatusParams = z.infer<typeof batchStatusSchema>
```

### 2.3 處理步驟映射

```typescript
// types/externalApi/steps.ts

/**
 * 內部步驟代碼到人類可讀描述的映射
 */
export const STEP_DESCRIPTIONS: Record<string, string> = {
  // 排隊階段
  QUEUED: 'Waiting in queue',

  // 上傳階段
  UPLOADING: 'Uploading document',
  UPLOADED: 'Document uploaded',

  // OCR 處理階段
  OCR_STARTING: 'Starting OCR process',
  OCR_PROCESSING: 'Extracting text with OCR',
  OCR_COMPLETED: 'Text extraction completed',

  // AI 提取階段
  AI_STARTING: 'Starting AI extraction',
  AI_EXTRACTING: 'AI extracting invoice data',
  AI_COMPLETED: 'AI extraction completed',

  // Forwarder 識別階段
  FORWARDER_IDENTIFYING: 'Identifying forwarder',
  FORWARDER_IDENTIFIED: 'Forwarder identified',

  // 欄位映射階段
  FIELD_MAPPING: 'Mapping fields',
  FIELD_MAPPED: 'Fields mapped',

  // 驗證階段
  VALIDATION: 'Validating extracted data',
  VALIDATED: 'Data validation completed',

  // 審核階段
  REVIEW_PENDING: 'Pending human review',
  REVIEWING: 'Under human review',

  // 完成
  COMPLETED: 'Processing completed',
  FAILED: 'Processing failed',
}

/**
 * 狀態對應的進度百分比
 */
export const STATUS_PROGRESS: Record<string, number> = {
  QUEUED: 0,
  UPLOADING: 5,
  UPLOADED: 10,
  OCR_STARTING: 15,
  OCR_PROCESSING: 25,
  OCR_COMPLETED: 35,
  AI_STARTING: 40,
  AI_EXTRACTING: 55,
  AI_COMPLETED: 70,
  FORWARDER_IDENTIFYING: 75,
  FORWARDER_IDENTIFIED: 80,
  FIELD_MAPPING: 85,
  FIELD_MAPPED: 90,
  VALIDATION: 95,
  VALIDATED: 98,
  COMPLETED: 100,
}
```

---

## 3. 服務實現

### 3.1 任務狀態服務

```typescript
// lib/services/externalApi/taskStatusService.ts

import { prisma } from '@/lib/prisma'
import { ExternalApiKey, ApiTaskStatus } from '@prisma/client'
import {
  TaskStatusResponse,
  TaskStatus,
  ListQueryParams,
  STEP_DESCRIPTIONS,
} from '@/types/externalApi'

/**
 * 內部狀態到 API 狀態的映射
 */
const STATUS_MAP: Record<ApiTaskStatus, TaskStatus> = {
  QUEUED: 'queued',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
  REVIEW_REQUIRED: 'review_required',
  EXPIRED: 'expired',
}

/**
 * API 狀態到內部狀態的反向映射
 */
const REVERSE_STATUS_MAP: Record<TaskStatus, ApiTaskStatus> = {
  queued: 'QUEUED',
  processing: 'PROCESSING',
  completed: 'COMPLETED',
  failed: 'FAILED',
  review_required: 'REVIEW_REQUIRED',
  expired: 'EXPIRED',
}

export class TaskStatusService {
  /**
   * 獲取單一任務狀態
   */
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

    // 驗證存取權限
    if (!this.hasAccessToTask(task, apiKey)) {
      return null  // 返回 null 避免洩露任務存在信息
    }

    return this.buildStatusResponse(task)
  }

  /**
   * 批量獲取任務狀態
   */
  async getTaskStatuses(
    taskIds: string[],
    apiKey: ExternalApiKey
  ): Promise<Map<string, TaskStatusResponse>> {
    const tasks = await prisma.externalApiTask.findMany({
      where: {
        taskId: { in: taskIds },
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
      // 只返回有權限存取的任務
      if (this.hasAccessToTask(task, apiKey)) {
        result.set(task.taskId, this.buildStatusResponse(task))
      }
    }

    return result
  }

  /**
   * 列出任務
   */
  async listTasks(
    apiKey: ExternalApiKey,
    options: ListQueryParams
  ): Promise<{
    items: TaskStatusResponse[]
    total: number
    page: number
    pageSize: number
  }> {
    const { status, cityCode, startDate, endDate, page, pageSize } = options

    // 構建查詢條件
    const where: any = {
      apiKeyId: apiKey.id,
    }

    // 狀態過濾
    if (status) {
      where.status = REVERSE_STATUS_MAP[status]
    }

    // 城市過濾（需要檢查權限）
    if (cityCode) {
      const allowedCities = apiKey.allowedCities as string[]
      if (allowedCities.includes('*') || allowedCities.includes(cityCode)) {
        where.cityCode = cityCode
      } else {
        // 沒有權限存取該城市，返回空結果
        return { items: [], total: 0, page, pageSize }
      }
    }

    // 時間範圍過濾
    if (startDate || endDate) {
      where.createdAt = {}
      if (startDate) where.createdAt.gte = new Date(startDate)
      if (endDate) where.createdAt.lte = new Date(endDate)
    }

    // 執行查詢
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
      items: tasks.map(task => this.buildStatusResponse(task)),
      total,
      page,
      pageSize,
    }
  }

  /**
   * 檢查是否有權限存取任務
   */
  private hasAccessToTask(task: any, apiKey: ExternalApiKey): boolean {
    // 自己創建的任務
    if (task.apiKeyId === apiKey.id) {
      return true
    }

    // 檢查城市權限（允許跨租戶查詢同城市任務）
    const allowedCities = apiKey.allowedCities as string[]
    if (allowedCities.includes('*') || allowedCities.includes(task.cityCode)) {
      // 需要額外的 crossTenantQuery 權限
      const allowedOps = apiKey.allowedOperations as string[]
      return allowedOps.includes('*') || allowedOps.includes('crossTenantQuery')
    }

    return false
  }

  /**
   * 構建狀態回應
   */
  private buildStatusResponse(task: any): TaskStatusResponse {
    const response: TaskStatusResponse = {
      taskId: task.taskId,
      status: STATUS_MAP[task.status as ApiTaskStatus] || 'processing',
      progress: task.progress,
      currentStep: this.getStepDescription(task.currentStep),
      createdAt: task.createdAt.toISOString(),
      updatedAt: task.updatedAt.toISOString(),
    }

    // 處理中狀態：添加預估完成時間
    if (!['COMPLETED', 'FAILED', 'EXPIRED'].includes(task.status)) {
      if (task.estimatedCompletion) {
        response.estimatedCompletion = task.estimatedCompletion.toISOString()
      } else {
        // 動態計算預估完成時間
        response.estimatedCompletion = this.estimateCompletion(task).toISOString()
      }
    }

    // 完成狀態：添加結果資訊
    if (task.status === 'COMPLETED') {
      response.resultUrl = `/api/v1/invoices/${task.taskId}/result`
      if (task.completedAt) {
        response.completedAt = task.completedAt.toISOString()
      }
      response.confidenceScore = task.confidenceScore ??
        task.document?.extractionResult?.confidenceScore
    }

    // 失敗狀態：添加錯誤資訊
    if (task.status === 'FAILED') {
      response.error = {
        code: task.errorCode || 'UNKNOWN_ERROR',
        message: task.errorMessage || 'An error occurred during processing',
        retryable: task.errorRetryable ?? this.isRetryableError(task.errorCode),
      }
    }

    // 審核狀態：添加審核資訊
    if (task.status === 'REVIEW_REQUIRED') {
      response.reviewInfo = {
        reason: task.document?.escalationReason ||
                this.getReviewReason(task.document?.extractionResult),
        escalatedAt: task.document?.escalatedAt?.toISOString() ||
                     task.updatedAt.toISOString(),
      }
    }

    return response
  }

  /**
   * 獲取步驟描述
   */
  private getStepDescription(step?: string): string | undefined {
    if (!step) return undefined
    return STEP_DESCRIPTIONS[step] || step
  }

  /**
   * 估算完成時間
   */
  private estimateCompletion(task: any): Date {
    const progress = task.progress || 0
    const elapsed = Date.now() - task.createdAt.getTime()

    if (progress <= 0) {
      // 尚未開始，預設 2 分鐘
      return new Date(Date.now() + 120000)
    }

    // 基於當前進度估算
    const estimatedTotal = (elapsed / progress) * 100
    const remaining = estimatedTotal - elapsed

    // 至少返回 5 秒後
    return new Date(Date.now() + Math.max(remaining, 5000))
  }

  /**
   * 判斷錯誤是否可重試
   */
  private isRetryableError(errorCode?: string): boolean {
    const retryableErrors = [
      'TIMEOUT',
      'TEMPORARY_FAILURE',
      'SERVICE_UNAVAILABLE',
      'RATE_LIMITED',
      'NETWORK_ERROR',
    ]
    return errorCode ? retryableErrors.includes(errorCode) : false
  }

  /**
   * 獲取審核原因
   */
  private getReviewReason(extractionResult?: any): string {
    if (!extractionResult) {
      return 'Manual review required'
    }

    const confidence = extractionResult.confidenceScore || 0
    if (confidence < 0.7) {
      return `Low confidence score (${(confidence * 100).toFixed(0)}%)`
    }

    const flaggedFields = extractionResult.flaggedFields || []
    if (flaggedFields.length > 0) {
      return `Flagged fields: ${flaggedFields.join(', ')}`
    }

    return 'Manual review required'
  }

  /**
   * 更新任務狀態（內部使用）
   */
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

    if (updates?.progress !== undefined) {
      updateData.progress = updates.progress
    }
    if (updates?.currentStep !== undefined) {
      updateData.currentStep = updates.currentStep
    }
    if (updates?.errorCode !== undefined) {
      updateData.errorCode = updates.errorCode
    }
    if (updates?.errorMessage !== undefined) {
      updateData.errorMessage = updates.errorMessage
    }
    if (updates?.errorRetryable !== undefined) {
      updateData.errorRetryable = updates.errorRetryable
    }
    if (updates?.confidenceScore !== undefined) {
      updateData.confidenceScore = updates.confidenceScore
    }

    // 終態設置
    if (['COMPLETED', 'FAILED'].includes(status)) {
      updateData.completedAt = new Date()
    }

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

  /**
   * 獲取處理統計（監控用途）
   */
  async getProcessingStats(
    apiKeyId: string,
    options?: { startDate?: Date; endDate?: Date }
  ): Promise<{
    total: number
    byStatus: Record<string, number>
    averageProcessingTime: number
    successRate: number
  }> {
    const where: any = { apiKeyId }

    if (options?.startDate || options?.endDate) {
      where.createdAt = {}
      if (options.startDate) where.createdAt.gte = options.startDate
      if (options.endDate) where.createdAt.lte = options.endDate
    }

    const [statusCounts, completedTasks] = await Promise.all([
      prisma.externalApiTask.groupBy({
        by: ['status'],
        where,
        _count: true,
      }),
      prisma.externalApiTask.findMany({
        where: {
          ...where,
          status: 'COMPLETED',
          completedAt: { not: null },
        },
        select: {
          createdAt: true,
          completedAt: true,
        },
      }),
    ])

    const byStatus: Record<string, number> = {}
    let total = 0
    statusCounts.forEach(item => {
      byStatus[STATUS_MAP[item.status as ApiTaskStatus]] = item._count
      total += item._count
    })

    // 計算平均處理時間
    let averageProcessingTime = 0
    if (completedTasks.length > 0) {
      const totalTime = completedTasks.reduce((sum, task) => {
        return sum + (task.completedAt!.getTime() - task.createdAt.getTime())
      }, 0)
      averageProcessingTime = totalTime / completedTasks.length / 1000 // 秒
    }

    // 計算成功率
    const completed = byStatus['completed'] || 0
    const failed = byStatus['failed'] || 0
    const successRate = (completed + failed) > 0
      ? (completed / (completed + failed)) * 100
      : 0

    return {
      total,
      byStatus,
      averageProcessingTime,
      successRate,
    }
  }
}

export const taskStatusService = new TaskStatusService()
```

---

## 4. API 路由

### 4.1 單一任務狀態查詢

```typescript
// app/api/v1/invoices/[taskId]/status/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { taskStatusService } from '@/lib/services/externalApi/taskStatusService'
import { externalApiAuthMiddleware } from '@/lib/middleware/externalApiAuthMiddleware'
import { rateLimitService } from '@/lib/services/externalApi/rateLimitService'
import { auditLogService } from '@/lib/services/externalApi/auditLogService'

export async function GET(
  request: NextRequest,
  { params }: { params: { taskId: string } }
) {
  const traceId = generateTraceId()
  const startTime = Date.now()

  try {
    // 1. 認證
    const authResult = await externalApiAuthMiddleware(request, ['query'])

    if (!authResult.authorized) {
      await logRequest(request, null, authResult.statusCode, startTime, traceId)
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

    const apiKey = authResult.apiKey!

    // 2. 速率限制
    const rateLimitResult = await rateLimitService.checkLimit(apiKey)

    if (!rateLimitResult.allowed) {
      await logRequest(request, apiKey.id, 429, startTime, traceId)
      return NextResponse.json(
        {
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Too many requests. Please try again later.',
          },
          traceId,
        },
        {
          status: 429,
          headers: {
            'Retry-After': rateLimitResult.retryAfter?.toString() || '60',
            'X-RateLimit-Limit': rateLimitResult.limit.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': rateLimitResult.reset.toString(),
          },
        }
      )
    }

    // 3. 獲取狀態
    const status = await taskStatusService.getTaskStatus(params.taskId, apiKey)

    if (!status) {
      await logRequest(request, apiKey.id, 404, startTime, traceId)
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

    await logRequest(request, apiKey.id, 200, startTime, traceId)

    // 4. 構建回應標頭
    const headers: Record<string, string> = {
      'X-RateLimit-Limit': rateLimitResult.limit.toString(),
      'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
      'X-RateLimit-Reset': rateLimitResult.reset.toString(),
    }

    // 處理中狀態：建議輪詢間隔
    if (status.status === 'processing') {
      headers['X-Poll-Interval'] = '5' // 建議 5 秒後再次查詢
    }

    // 5. 返回結果
    return NextResponse.json(
      {
        data: status,
        traceId,
      },
      { status: 200, headers }
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

function generateTraceId(): string {
  return `api_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 9)}`
}

async function logRequest(
  request: NextRequest,
  apiKeyId: string | null,
  statusCode: number,
  startTime: number,
  traceId: string
): Promise<void> {
  try {
    await auditLogService.logApiRequest({
      apiKeyId,
      endpoint: request.nextUrl.pathname,
      method: 'GET',
      statusCode,
      durationMs: Date.now() - startTime,
      traceId,
      ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown',
      userAgent: request.headers.get('user-agent'),
    })
  } catch (error) {
    console.error('Failed to log request:', error)
  }
}
```

### 4.2 任務列表查詢

```typescript
// app/api/v1/invoices/route.ts (添加 GET 方法)

import { NextRequest, NextResponse } from 'next/server'
import { taskStatusService } from '@/lib/services/externalApi/taskStatusService'
import { externalApiAuthMiddleware } from '@/lib/middleware/externalApiAuthMiddleware'
import { rateLimitService } from '@/lib/services/externalApi/rateLimitService'
import { listQuerySchema } from '@/types/externalApi/query'
import { z } from 'zod'

export async function GET(request: NextRequest) {
  const traceId = generateTraceId()

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

    const apiKey = authResult.apiKey!

    // 2. 速率限制
    const rateLimitResult = await rateLimitService.checkLimit(apiKey)

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

    // 3. 解析查詢參數
    const searchParams = Object.fromEntries(request.nextUrl.searchParams)
    const validatedParams = listQuerySchema.parse(searchParams)

    // 4. 獲取任務列表
    const result = await taskStatusService.listTasks(apiKey, validatedParams)

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
      {
        status: 200,
        headers: {
          'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
        },
      }
    )
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid query parameters',
            details: error.errors.map(e => ({
              field: e.path.join('.'),
              message: e.message,
            })),
          },
          traceId,
        },
        { status: 400 }
      )
    }

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

### 4.3 批量狀態查詢

```typescript
// app/api/v1/invoices/batch-status/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { taskStatusService } from '@/lib/services/externalApi/taskStatusService'
import { externalApiAuthMiddleware } from '@/lib/middleware/externalApiAuthMiddleware'
import { rateLimitService } from '@/lib/services/externalApi/rateLimitService'
import { batchStatusSchema } from '@/types/externalApi/query'
import { z } from 'zod'

export async function POST(request: NextRequest) {
  const traceId = generateTraceId()

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

    const apiKey = authResult.apiKey!

    // 2. 速率限制（批量查詢消耗多個配額）
    const rateLimitResult = await rateLimitService.checkLimit(apiKey)

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
    const statusMap = await taskStatusService.getTaskStatuses(taskIds, apiKey)

    // 5. 構建回應（包含未找到的任務）
    const results: Record<string, any> = {}

    for (const taskId of taskIds) {
      const status = statusMap.get(taskId)
      if (status) {
        results[taskId] = status
      } else {
        results[taskId] = {
          error: {
            code: 'NOT_FOUND',
            message: 'Task not found or access denied',
          },
        }
      }
    }

    // 6. 返回結果
    return NextResponse.json(
      {
        data: results,
        summary: {
          requested: taskIds.length,
          found: statusMap.size,
          notFound: taskIds.length - statusMap.size,
        },
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

function generateTraceId(): string {
  return `api_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 9)}`
}
```

---

## 5. 前端組件

### 5.1 狀態追蹤組件

```typescript
// components/admin/api/TaskStatusTracker.tsx

'use client'

import React, { useState, useEffect, useCallback } from 'react'
import {
  Card,
  CardContent,
  CardHeader,
  Box,
  Typography,
  LinearProgress,
  Chip,
  Alert,
  Button,
  TextField,
  CircularProgress,
  Paper,
  Divider,
} from '@mui/material'
import {
  CheckCircle,
  Error,
  HourglassEmpty,
  Autorenew,
  RateReview,
  Schedule,
  Refresh,
} from '@mui/icons-material'

interface TaskStatusTrackerProps {
  apiKey: string
  initialTaskId?: string
}

interface TaskStatus {
  taskId: string
  status: string
  progress: number
  currentStep?: string
  createdAt: string
  updatedAt: string
  estimatedCompletion?: string
  resultUrl?: string
  completedAt?: string
  confidenceScore?: number
  error?: {
    code: string
    message: string
    retryable: boolean
  }
  reviewInfo?: {
    reason: string
    escalatedAt: string
  }
}

const STATUS_CONFIG: Record<string, {
  icon: React.ReactNode
  color: 'default' | 'primary' | 'success' | 'error' | 'warning' | 'info'
  label: string
}> = {
  queued: { icon: <HourglassEmpty />, color: 'default', label: '排隊中' },
  processing: { icon: <Autorenew />, color: 'primary', label: '處理中' },
  completed: { icon: <CheckCircle />, color: 'success', label: '已完成' },
  failed: { icon: <Error />, color: 'error', label: '失敗' },
  review_required: { icon: <RateReview />, color: 'warning', label: '需審核' },
  expired: { icon: <Schedule />, color: 'default', label: '已過期' },
}

export function TaskStatusTracker({ apiKey, initialTaskId }: TaskStatusTrackerProps) {
  const [taskId, setTaskId] = useState(initialTaskId || '')
  const [status, setStatus] = useState<TaskStatus | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [autoRefresh, setAutoRefresh] = useState(false)

  const fetchStatus = useCallback(async () => {
    if (!taskId || !apiKey) return

    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/v1/invoices/${taskId}/status`, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
      })

      const data = await response.json()

      if (response.ok) {
        setStatus(data.data)

        // 根據狀態決定是否繼續自動刷新
        if (['completed', 'failed', 'expired'].includes(data.data.status)) {
          setAutoRefresh(false)
        }
      } else {
        setError(data.error?.message || 'Failed to fetch status')
        setStatus(null)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error')
      setStatus(null)
    } finally {
      setLoading(false)
    }
  }, [taskId, apiKey])

  // 自動刷新
  useEffect(() => {
    if (!autoRefresh || !taskId) return

    const interval = setInterval(fetchStatus, 5000)
    return () => clearInterval(interval)
  }, [autoRefresh, taskId, fetchStatus])

  const handleSearch = () => {
    fetchStatus()
    if (status?.status === 'processing' || status?.status === 'queued') {
      setAutoRefresh(true)
    }
  }

  const getStatusConfig = (statusCode: string) => {
    return STATUS_CONFIG[statusCode] || STATUS_CONFIG.queued
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('zh-TW')
  }

  return (
    <Card>
      <CardHeader title="任務狀態追蹤" />
      <CardContent>
        {/* 搜尋區域 */}
        <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
          <TextField
            label="Task ID"
            value={taskId}
            onChange={(e) => setTaskId(e.target.value)}
            fullWidth
            placeholder="輸入任務 ID"
          />
          <Button
            variant="contained"
            onClick={handleSearch}
            disabled={loading || !taskId}
            startIcon={loading ? <CircularProgress size={20} /> : <Refresh />}
          >
            查詢
          </Button>
        </Box>

        {/* 錯誤訊息 */}
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>
        )}

        {/* 狀態顯示 */}
        {status && (
          <Paper variant="outlined" sx={{ p: 3 }}>
            {/* 狀態標頭 */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
              <Chip
                icon={getStatusConfig(status.status).icon as React.ReactElement}
                label={getStatusConfig(status.status).label}
                color={getStatusConfig(status.status).color}
                size="medium"
              />
              <Typography variant="body2" color="text.secondary">
                Task ID: {status.taskId}
              </Typography>
              {autoRefresh && (
                <Chip
                  label="自動刷新中"
                  size="small"
                  variant="outlined"
                  color="info"
                />
              )}
            </Box>

            {/* 進度條 */}
            <Box sx={{ mb: 3 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="body2">
                  進度: {status.progress}%
                </Typography>
                {status.currentStep && (
                  <Typography variant="body2" color="text.secondary">
                    {status.currentStep}
                  </Typography>
                )}
              </Box>
              <LinearProgress
                variant="determinate"
                value={status.progress}
                color={getStatusConfig(status.status).color}
              />
            </Box>

            <Divider sx={{ my: 2 }} />

            {/* 時間資訊 */}
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  創建時間
                </Typography>
                <Typography variant="body2">
                  {formatDate(status.createdAt)}
                </Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  最後更新
                </Typography>
                <Typography variant="body2">
                  {formatDate(status.updatedAt)}
                </Typography>
              </Box>
              {status.estimatedCompletion && (
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    預估完成
                  </Typography>
                  <Typography variant="body2">
                    {formatDate(status.estimatedCompletion)}
                  </Typography>
                </Box>
              )}
              {status.completedAt && (
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    完成時間
                  </Typography>
                  <Typography variant="body2">
                    {formatDate(status.completedAt)}
                  </Typography>
                </Box>
              )}
            </Box>

            {/* 完成狀態 - 顯示結果連結 */}
            {status.status === 'completed' && (
              <Box sx={{ mt: 3 }}>
                <Alert severity="success">
                  處理完成！信心度: {((status.confidenceScore || 0) * 100).toFixed(1)}%
                </Alert>
                <Button
                  variant="contained"
                  sx={{ mt: 2 }}
                  href={status.resultUrl}
                >
                  查看結果
                </Button>
              </Box>
            )}

            {/* 失敗狀態 - 顯示錯誤資訊 */}
            {status.error && (
              <Box sx={{ mt: 3 }}>
                <Alert severity="error">
                  <Typography variant="subtitle2">
                    錯誤代碼: {status.error.code}
                  </Typography>
                  <Typography variant="body2">
                    {status.error.message}
                  </Typography>
                  {status.error.retryable && (
                    <Typography variant="caption" color="text.secondary">
                      此錯誤可重試
                    </Typography>
                  )}
                </Alert>
              </Box>
            )}

            {/* 審核狀態 - 顯示審核資訊 */}
            {status.reviewInfo && (
              <Box sx={{ mt: 3 }}>
                <Alert severity="warning">
                  <Typography variant="subtitle2">
                    需要人工審核
                  </Typography>
                  <Typography variant="body2">
                    原因: {status.reviewInfo.reason}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    升級時間: {formatDate(status.reviewInfo.escalatedAt)}
                  </Typography>
                </Alert>
              </Box>
            )}
          </Paper>
        )}
      </CardContent>
    </Card>
  )
}
```

---

## 6. 測試計畫

### 6.1 單元測試

```typescript
// __tests__/services/externalApi/taskStatusService.test.ts

import { taskStatusService } from '@/lib/services/externalApi/taskStatusService'
import { prismaMock } from '@/lib/__mocks__/prisma'

describe('TaskStatusService', () => {
  const mockApiKey = {
    id: 'key-1',
    allowedCities: ['*'],
    allowedOperations: ['query'],
  } as any

  describe('getTaskStatus', () => {
    it('should return status for valid task', async () => {
      prismaMock.externalApiTask.findUnique.mockResolvedValue({
        taskId: 'task-1',
        apiKeyId: 'key-1',
        status: 'PROCESSING',
        progress: 50,
        currentStep: 'AI_EXTRACTING',
        createdAt: new Date('2025-01-01T10:00:00Z'),
        updatedAt: new Date('2025-01-01T10:05:00Z'),
        cityCode: 'TPE',
        estimatedCompletion: new Date('2025-01-01T10:10:00Z'),
      } as any)

      const result = await taskStatusService.getTaskStatus('task-1', mockApiKey)

      expect(result).not.toBeNull()
      expect(result?.status).toBe('processing')
      expect(result?.progress).toBe(50)
      expect(result?.currentStep).toBe('AI extracting invoice data')
      expect(result?.estimatedCompletion).toBeDefined()
    })

    it('should return null for non-existent task', async () => {
      prismaMock.externalApiTask.findUnique.mockResolvedValue(null)

      const result = await taskStatusService.getTaskStatus('non-existent', mockApiKey)

      expect(result).toBeNull()
    })

    it('should return null for unauthorized task', async () => {
      prismaMock.externalApiTask.findUnique.mockResolvedValue({
        taskId: 'task-1',
        apiKeyId: 'other-key',
        cityCode: 'HKG',
      } as any)

      const restrictedApiKey = {
        id: 'key-2',
        allowedCities: ['TPE'],
        allowedOperations: ['query'],
      } as any

      const result = await taskStatusService.getTaskStatus('task-1', restrictedApiKey)

      expect(result).toBeNull()
    })

    it('should include error info for failed tasks', async () => {
      prismaMock.externalApiTask.findUnique.mockResolvedValue({
        taskId: 'task-1',
        apiKeyId: 'key-1',
        status: 'FAILED',
        errorCode: 'OCR_FAILED',
        errorMessage: 'Failed to extract text from document',
        errorRetryable: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        cityCode: 'TPE',
      } as any)

      const result = await taskStatusService.getTaskStatus('task-1', mockApiKey)

      expect(result?.status).toBe('failed')
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
        completedAt: new Date('2025-01-01T10:10:00Z'),
        createdAt: new Date('2025-01-01T10:00:00Z'),
        updatedAt: new Date('2025-01-01T10:10:00Z'),
        cityCode: 'TPE',
      } as any)

      const result = await taskStatusService.getTaskStatus('task-1', mockApiKey)

      expect(result?.status).toBe('completed')
      expect(result?.resultUrl).toBe('/api/v1/invoices/task-1/result')
      expect(result?.confidenceScore).toBe(0.95)
      expect(result?.completedAt).toBeDefined()
    })
  })

  describe('getTaskStatuses (batch)', () => {
    it('should return statuses for multiple tasks', async () => {
      prismaMock.externalApiTask.findMany.mockResolvedValue([
        {
          taskId: 'task-1',
          apiKeyId: 'key-1',
          status: 'COMPLETED',
          progress: 100,
          createdAt: new Date(),
          updatedAt: new Date(),
          cityCode: 'TPE',
        },
        {
          taskId: 'task-2',
          apiKeyId: 'key-1',
          status: 'PROCESSING',
          progress: 50,
          createdAt: new Date(),
          updatedAt: new Date(),
          cityCode: 'TPE',
        },
      ] as any[])

      const result = await taskStatusService.getTaskStatuses(
        ['task-1', 'task-2', 'task-3'],
        mockApiKey
      )

      expect(result.size).toBe(2)
      expect(result.has('task-1')).toBe(true)
      expect(result.has('task-2')).toBe(true)
      expect(result.has('task-3')).toBe(false) // Not found
    })
  })

  describe('listTasks', () => {
    it('should return paginated task list', async () => {
      prismaMock.externalApiTask.findMany.mockResolvedValue([
        { taskId: 'task-1', status: 'COMPLETED', progress: 100, createdAt: new Date(), updatedAt: new Date(), cityCode: 'TPE', apiKeyId: 'key-1' },
        { taskId: 'task-2', status: 'PROCESSING', progress: 50, createdAt: new Date(), updatedAt: new Date(), cityCode: 'TPE', apiKeyId: 'key-1' },
      ] as any[])
      prismaMock.externalApiTask.count.mockResolvedValue(25)

      const result = await taskStatusService.listTasks(mockApiKey, {
        page: 1,
        pageSize: 20,
      })

      expect(result.items).toHaveLength(2)
      expect(result.total).toBe(25)
      expect(result.page).toBe(1)
      expect(result.pageSize).toBe(20)
    })

    it('should filter by status', async () => {
      prismaMock.externalApiTask.findMany.mockResolvedValue([])
      prismaMock.externalApiTask.count.mockResolvedValue(0)

      await taskStatusService.listTasks(mockApiKey, {
        status: 'completed',
        page: 1,
        pageSize: 20,
      })

      expect(prismaMock.externalApiTask.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'COMPLETED',
          }),
        })
      )
    })
  })
})
```

### 6.2 API 整合測試

```typescript
// __tests__/api/v1/invoices/status.test.ts

import { GET } from '@/app/api/v1/invoices/[taskId]/status/route'
import { NextRequest } from 'next/server'
import { prismaMock } from '@/lib/__mocks__/prisma'

jest.mock('@/lib/services/externalApi/rateLimitService')

describe('GET /api/v1/invoices/{taskId}/status', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should return 401 without API key', async () => {
    const request = new NextRequest('http://localhost/api/v1/invoices/task-1/status')

    const response = await GET(request, { params: { taskId: 'task-1' } })

    expect(response.status).toBe(401)
  })

  it('should return 404 for non-existent task', async () => {
    prismaMock.externalApiKey.findUnique.mockResolvedValue({
      id: 'key-1',
      isActive: true,
      allowedCities: ['*'],
      allowedOperations: ['*'],
      rateLimit: 60,
    } as any)

    prismaMock.externalApiTask.findUnique.mockResolvedValue(null)

    const { rateLimitService } = require('@/lib/services/externalApi/rateLimitService')
    rateLimitService.checkLimit.mockResolvedValue({
      allowed: true,
      limit: 60,
      remaining: 59,
      reset: Date.now() + 60000,
    })

    const request = new NextRequest('http://localhost/api/v1/invoices/task-1/status', {
      headers: {
        'Authorization': 'Bearer valid-key',
      },
    })

    const response = await GET(request, { params: { taskId: 'task-1' } })

    expect(response.status).toBe(404)
  })

  it('should include X-Poll-Interval header for processing tasks', async () => {
    prismaMock.externalApiKey.findUnique.mockResolvedValue({
      id: 'key-1',
      isActive: true,
      allowedCities: ['*'],
      allowedOperations: ['*'],
    } as any)

    prismaMock.externalApiTask.findUnique.mockResolvedValue({
      taskId: 'task-1',
      apiKeyId: 'key-1',
      status: 'PROCESSING',
      progress: 50,
      createdAt: new Date(),
      updatedAt: new Date(),
      cityCode: 'TPE',
    } as any)

    const { rateLimitService } = require('@/lib/services/externalApi/rateLimitService')
    rateLimitService.checkLimit.mockResolvedValue({
      allowed: true,
      limit: 60,
      remaining: 59,
      reset: Date.now() + 60000,
    })

    const request = new NextRequest('http://localhost/api/v1/invoices/task-1/status', {
      headers: {
        'Authorization': 'Bearer valid-key',
      },
    })

    const response = await GET(request, { params: { taskId: 'task-1' } })

    expect(response.status).toBe(200)
    expect(response.headers.get('X-Poll-Interval')).toBe('5')
  })
})
```

---

## 7. 部署注意事項

### 7.1 環境變數

```env
# 狀態查詢相關
EXTERNAL_API_STATUS_CACHE_TTL=5000       # 狀態快取時間（毫秒）
EXTERNAL_API_BATCH_MAX_SIZE=100          # 批量查詢最大數量
EXTERNAL_API_LIST_MAX_PAGE_SIZE=100      # 列表查詢最大頁面大小
```

### 7.2 監控指標

| 指標 | 描述 | 告警閾值 |
|------|------|----------|
| `external_api_status_requests_total` | 狀態查詢總數 | - |
| `external_api_status_latency_ms` | 狀態查詢回應時間 | p95 > 200ms |
| `external_api_status_not_found_rate` | 404 錯誤率 | >10% |
| `external_api_batch_size` | 批量查詢平均大小 | - |
| `external_api_poll_interval_utilization` | 輪詢間隔遵循率 | <50% |

### 7.3 快取策略

```typescript
// 建議的快取策略
const CACHE_CONFIG = {
  // 處理中狀態：短快取（5秒）
  processing: 5000,

  // 已完成狀態：長快取（5分鐘）
  completed: 300000,

  // 失敗狀態：中等快取（1分鐘）
  failed: 60000,

  // 審核狀態：中等快取（30秒）
  review_required: 30000,
}
```

---

## 8. 驗收標準對應

| AC | 描述 | 實現狀態 |
|----|------|----------|
| AC1 | 基本狀態查詢 | ✅ 返回 status、progress、currentStep 等完整資訊 |
| AC2 | 完成狀態額外資訊 | ✅ 包含 resultUrl、completedAt、confidenceScore |
| AC3 | 失敗狀態錯誤資訊 | ✅ 包含 error.code、message、retryable |
| AC4 | 任務不存在處理 | ✅ 返回 HTTP 404 |

---

## 9. 開放問題

1. **長輪詢支援**: 是否需要實現 long polling 以減少請求數？
2. **WebSocket 推送**: 是否需要支援即時狀態推送？
3. **狀態歷史**: 是否需要提供狀態變更歷史記錄？
4. **快取失效**: 狀態更新時如何確保快取一致性？

---

## 10. 參考資料

- [Polling vs WebSocket](https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API)
- [HTTP Caching Headers](https://developer.mozilla.org/en-US/docs/Web/HTTP/Caching)
- [API Rate Limiting Best Practices](https://www.nginx.com/blog/rate-limiting-nginx/)
