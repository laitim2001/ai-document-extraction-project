# Tech Spec: Story 11-1 - API 發票提交端點

## 概述

### Story 資訊
- **Story ID**: 11-1
- **標題**: API 發票提交端點
- **Epic**: 11 - 對外 API 服務
- **故事點數**: 8
- **優先級**: High

### 目標
建立完整的 RESTful API 端點，供外部系統提交發票文件進行處理。支援多種提交方式（文件上傳、Base64 編碼、URL 引用），實現標準化的錯誤處理和回應格式，並整合速率限制與認證機制。

### 相依性
- Story 11-2: API 處理狀態查詢端點（狀態查詢 URL）
- Story 11-5: API 訪問控制與認證（API Key 管理）
- Story 10-1: n8n 雙向通訊 API（處理觸發機制）

---

## 1. 資料庫設計

### 1.1 Prisma Schema

```prisma
// ============================================
// 外部 API 任務記錄
// ============================================
model ExternalApiTask {
  id                String    @id @default(cuid())
  taskId            String    @unique @default(cuid())  // 公開的任務 ID

  // API Key 關聯
  apiKeyId          String
  apiKey            ExternalApiKey @relation(fields: [apiKeyId], references: [id])

  // 文件資訊
  documentId        String?   @unique
  document          Document? @relation(fields: [documentId], references: [id])

  // 提交方式
  submissionType    SubmissionType
  originalFileName  String
  fileSize          Int
  mimeType          String

  // 來源資訊
  sourceUrl         String?   // URL 引用時的原始 URL

  // 處理配置
  cityCode          String
  city              City      @relation(fields: [cityCode], references: [code])
  priority          TaskPriority @default(NORMAL)
  callbackUrl       String?
  metadata          Json?

  // 狀態
  status            ApiTaskStatus @default(QUEUED)
  progress          Int       @default(0)
  currentStep       String?

  // 結果
  resultAvailable   Boolean   @default(false)
  resultExpiresAt   DateTime?
  confidenceScore   Float?

  // 錯誤資訊
  errorCode         String?
  errorMessage      String?
  errorRetryable    Boolean?

  // 時間記錄
  estimatedCompletion DateTime?
  processingStartedAt DateTime?
  completedAt       DateTime?

  // 審計
  clientIp          String
  userAgent         String?
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt

  // 關聯
  webhookDeliveries ExternalWebhookDelivery[]

  @@index([taskId])
  @@index([apiKeyId])
  @@index([status])
  @@index([cityCode])
  @@index([createdAt])
}

// ============================================
// 枚舉定義
// ============================================
enum SubmissionType {
  FILE_UPLOAD       // multipart/form-data 直接上傳
  BASE64            // Base64 編碼內容
  URL_REFERENCE     // 外部 URL 引用
}

enum TaskPriority {
  NORMAL            // 標準優先級
  HIGH              // 高優先級（加速處理）
}

enum ApiTaskStatus {
  QUEUED            // 排隊中
  PROCESSING        // 處理中
  COMPLETED         // 已完成
  FAILED            // 失敗
  REVIEW_REQUIRED   // 需要審核
  EXPIRED           // 已過期
}
```

### 1.2 索引策略

| 表名 | 索引 | 用途 |
|------|------|------|
| ExternalApiTask | `taskId` (unique) | 公開任務 ID 快速查詢 |
| ExternalApiTask | `apiKeyId` | API Key 關聯查詢 |
| ExternalApiTask | `status` | 狀態過濾查詢 |
| ExternalApiTask | `cityCode` | 城市級別任務列表 |
| ExternalApiTask | `createdAt` | 時間範圍查詢、排序 |
| ExternalApiTask | `apiKeyId, status, createdAt` | 複合查詢最佳化 |

### 1.3 資料生命週期

| 狀態 | 保留期限 | 清理策略 |
|------|----------|----------|
| COMPLETED | 90 天 | 標記為 EXPIRED，保留 metadata |
| FAILED | 30 天 | 自動刪除 |
| EXPIRED | 7 天 | 永久刪除 |

---

## 2. 類型定義

### 2.1 提交請求類型

```typescript
// types/externalApi/submission.ts

/**
 * 發票提交請求 - 支援三種提交方式
 */
export interface SubmitInvoiceRequest {
  // 文件內容（三選一，必填其中一種）
  file?: FileUploadContent
  base64Content?: Base64Content
  urlReference?: UrlReferenceContent

  // 必填參數
  cityCode: string

  // 可選參數
  priority?: TaskPriority
  callbackUrl?: string
  metadata?: Record<string, unknown>
}

/**
 * 文件直接上傳內容
 */
export interface FileUploadContent {
  buffer: Buffer
  originalName: string
  mimeType: string
  size: number
}

/**
 * Base64 編碼內容
 */
export interface Base64Content {
  content: string    // Base64 編碼的文件內容
  fileName: string   // 文件名稱
  mimeType: string   // MIME 類型
}

/**
 * URL 引用內容
 */
export interface UrlReferenceContent {
  url: string        // 外部 URL
  fileName?: string  // 可選的文件名稱覆蓋
}

/**
 * 任務優先級
 */
export type TaskPriority = 'NORMAL' | 'HIGH'
```

### 2.2 提交回應類型

```typescript
// types/externalApi/response.ts

/**
 * 發票提交成功回應
 */
export interface SubmitInvoiceResponse {
  taskId: string                    // 公開的任務 ID
  status: 'queued'                  // 初始狀態
  estimatedProcessingTime: number   // 預估處理時間（秒）
  statusUrl: string                 // 狀態查詢 URL
  createdAt: string                 // ISO 8601 格式
}

/**
 * API 錯誤回應
 */
export interface ApiErrorResponse {
  error: {
    code: ExternalApiErrorCode
    message: string
    details?: unknown
  }
  traceId: string
}

/**
 * 錯誤代碼定義
 */
export type ExternalApiErrorCode =
  // 認證錯誤 (401)
  | 'MISSING_API_KEY'
  | 'INVALID_API_KEY'
  | 'EXPIRED_API_KEY'
  | 'API_KEY_DISABLED'

  // 授權錯誤 (403)
  | 'CITY_NOT_ALLOWED'
  | 'OPERATION_NOT_ALLOWED'
  | 'INSUFFICIENT_PERMISSIONS'

  // 請求錯誤 (400)
  | 'INVALID_SUBMISSION'
  | 'VALIDATION_ERROR'
  | 'FILE_TOO_LARGE'
  | 'UNSUPPORTED_FORMAT'
  | 'EMPTY_FILE'
  | 'INVALID_CALLBACK_URL'
  | 'URL_FETCH_FAILED'
  | 'INVALID_SUBMISSION_TYPE'
  | 'UNSUPPORTED_CONTENT_TYPE'
  | 'MISSING_FILE'

  // 速率限制 (429)
  | 'RATE_LIMIT_EXCEEDED'

  // 伺服器錯誤 (500)
  | 'INTERNAL_ERROR'
```

### 2.3 驗證 Schema

```typescript
// types/externalApi/validation.ts

import { z } from 'zod'

/**
 * Base64 提交驗證 Schema
 */
export const base64SubmissionSchema = z.object({
  type: z.literal('base64'),
  content: z.string().min(1, 'Base64 content is required'),
  fileName: z.string().min(1, 'File name is required').max(255),
  mimeType: z.string().min(1, 'MIME type is required'),
})

/**
 * URL 提交驗證 Schema
 */
export const urlSubmissionSchema = z.object({
  type: z.literal('url'),
  url: z.string().url('Invalid URL format'),
  fileName: z.string().max(255).optional(),
})

/**
 * 通用參數驗證 Schema
 */
export const commonParamsSchema = z.object({
  cityCode: z.string().min(1, 'City code is required').max(10),
  priority: z.enum(['normal', 'high']).optional().default('normal'),
  callbackUrl: z.string().url('Invalid callback URL').optional(),
  metadata: z.record(z.unknown()).optional(),
})

/**
 * 支援的 MIME 類型
 */
export const SUPPORTED_MIME_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/tiff',
] as const

/**
 * 文件大小限制 (50MB)
 */
export const MAX_FILE_SIZE = 50 * 1024 * 1024

/**
 * URL 獲取超時時間 (30 秒)
 */
export const URL_FETCH_TIMEOUT = 30000
```

---

## 3. 服務實現

### 3.1 發票提交服務

```typescript
// lib/services/externalApi/invoiceSubmissionService.ts

import { prisma } from '@/lib/prisma'
import { blobStorageService } from '@/lib/services/blobStorageService'
import { documentProcessingService } from '@/lib/services/documentProcessingService'
import { ExternalApiKey, SubmissionType, TaskPriority } from '@prisma/client'
import {
  SubmitInvoiceRequest,
  SubmitInvoiceResponse,
  SUPPORTED_MIME_TYPES,
  MAX_FILE_SIZE,
  URL_FETCH_TIMEOUT,
} from '@/types/externalApi'

/**
 * API 錯誤類別
 */
export class ApiError extends Error {
  constructor(
    public code: string,
    public message: string,
    public statusCode: number
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

/**
 * 發票提交服務
 */
export class InvoiceSubmissionService {
  /**
   * 提交發票
   */
  async submitInvoice(
    request: SubmitInvoiceRequest,
    apiKey: ExternalApiKey,
    clientInfo: { ip: string; userAgent?: string }
  ): Promise<SubmitInvoiceResponse> {
    // 1. 驗證請求
    await this.validateRequest(request, apiKey)

    // 2. 處理文件內容
    const fileData = await this.processFileContent(request)

    // 3. 上傳至 Blob Storage
    const blobUrl = await blobStorageService.uploadDocument(
      fileData.buffer,
      fileData.fileName,
      fileData.mimeType,
      {
        source: 'external_api',
        apiKeyId: apiKey.id,
        cityCode: request.cityCode,
      }
    )

    // 4. 創建文件記錄
    const document = await prisma.document.create({
      data: {
        fileName: fileData.fileName,
        originalFileName: fileData.fileName,
        fileSize: fileData.buffer.length,
        mimeType: fileData.mimeType,
        blobUrl,
        cityCode: request.cityCode,
        sourceType: 'EXTERNAL_API',
        sourceMetadata: {
          apiKeyId: apiKey.id,
          apiKeyName: apiKey.name,
          submissionType: fileData.submissionType,
          priority: request.priority || 'NORMAL',
          callbackUrl: request.callbackUrl,
          clientIp: clientInfo.ip,
        },
        status: 'PENDING',
        metadata: request.metadata,
      },
    })

    // 5. 創建任務記錄
    const estimatedCompletion = this.calculateEstimatedCompletion(
      request.cityCode,
      request.priority
    )

    const task = await prisma.externalApiTask.create({
      data: {
        apiKeyId: apiKey.id,
        documentId: document.id,
        submissionType: fileData.submissionType,
        originalFileName: fileData.fileName,
        fileSize: fileData.buffer.length,
        mimeType: fileData.mimeType,
        sourceUrl: request.urlReference?.url,
        cityCode: request.cityCode,
        priority: request.priority || 'NORMAL',
        callbackUrl: request.callbackUrl,
        metadata: request.metadata,
        status: 'QUEUED',
        estimatedCompletion,
        clientIp: clientInfo.ip,
        userAgent: clientInfo.userAgent,
      },
    })

    // 6. 觸發處理流程
    await documentProcessingService.startProcessing(document.id, {
      priority: request.priority === 'HIGH' ? 'high' : 'normal',
      source: 'external_api',
      taskId: task.taskId,
    })

    // 7. 計算預估處理時間
    const estimatedProcessingTime = await this.getEstimatedProcessingTime(
      request.cityCode,
      request.priority
    )

    return {
      taskId: task.taskId,
      status: 'queued',
      estimatedProcessingTime,
      statusUrl: `/api/v1/invoices/${task.taskId}/status`,
      createdAt: task.createdAt.toISOString(),
    }
  }

  /**
   * 驗證請求
   */
  private async validateRequest(
    request: SubmitInvoiceRequest,
    apiKey: ExternalApiKey
  ): Promise<void> {
    // 驗證城市權限
    const allowedCities = apiKey.allowedCities as string[]
    if (!allowedCities.includes('*') && !allowedCities.includes(request.cityCode)) {
      throw new ApiError('CITY_NOT_ALLOWED', 'API key is not authorized for this city', 403)
    }

    // 驗證操作權限
    const allowedOperations = apiKey.allowedOperations as string[]
    if (!allowedOperations.includes('*') && !allowedOperations.includes('submit')) {
      throw new ApiError('OPERATION_NOT_ALLOWED', 'API key is not authorized for submit operation', 403)
    }

    // 驗證提交內容
    const hasFile = !!request.file
    const hasBase64 = !!request.base64Content
    const hasUrl = !!request.urlReference

    if ([hasFile, hasBase64, hasUrl].filter(Boolean).length !== 1) {
      throw new ApiError(
        'INVALID_SUBMISSION',
        'Exactly one of file, base64Content, or urlReference must be provided',
        400
      )
    }

    // 驗證回調 URL 格式
    if (request.callbackUrl) {
      try {
        const url = new URL(request.callbackUrl)
        if (!['http:', 'https:'].includes(url.protocol)) {
          throw new Error('Invalid protocol')
        }
      } catch {
        throw new ApiError('INVALID_CALLBACK_URL', 'Invalid callback URL format', 400)
      }
    }
  }

  /**
   * 處理文件內容
   */
  private async processFileContent(request: SubmitInvoiceRequest): Promise<{
    buffer: Buffer
    fileName: string
    mimeType: string
    submissionType: SubmissionType
  }> {
    // 直接上傳
    if (request.file) {
      this.validateFile(request.file.buffer, request.file.mimeType)
      return {
        buffer: request.file.buffer,
        fileName: request.file.originalName,
        mimeType: request.file.mimeType,
        submissionType: 'FILE_UPLOAD',
      }
    }

    // Base64 內容
    if (request.base64Content) {
      const buffer = Buffer.from(request.base64Content.content, 'base64')
      this.validateFile(buffer, request.base64Content.mimeType)
      return {
        buffer,
        fileName: request.base64Content.fileName,
        mimeType: request.base64Content.mimeType,
        submissionType: 'BASE64',
      }
    }

    // URL 引用
    if (request.urlReference) {
      const { buffer, fileName, mimeType } = await this.fetchFromUrl(request.urlReference.url)
      this.validateFile(buffer, mimeType)
      return {
        buffer,
        fileName: request.urlReference.fileName || fileName,
        mimeType,
        submissionType: 'URL_REFERENCE',
      }
    }

    throw new ApiError('INVALID_SUBMISSION', 'No file content provided', 400)
  }

  /**
   * 驗證文件
   */
  private validateFile(buffer: Buffer, mimeType: string): void {
    // 檢查文件是否為空
    if (buffer.length === 0) {
      throw new ApiError('EMPTY_FILE', 'File content is empty', 400)
    }

    // 檢查文件大小
    if (buffer.length > MAX_FILE_SIZE) {
      throw new ApiError(
        'FILE_TOO_LARGE',
        `File size exceeds maximum limit of ${MAX_FILE_SIZE / 1024 / 1024}MB`,
        400
      )
    }

    // 檢查文件格式
    const normalizedMimeType = mimeType.toLowerCase()
    if (!SUPPORTED_MIME_TYPES.includes(normalizedMimeType as any)) {
      throw new ApiError(
        'UNSUPPORTED_FORMAT',
        `File format not supported. Supported formats: PDF, PNG, JPG, TIFF`,
        400
      )
    }
  }

  /**
   * 從 URL 獲取文件
   */
  private async fetchFromUrl(url: string): Promise<{
    buffer: Buffer
    fileName: string
    mimeType: string
  }> {
    try {
      // 驗證 URL 協議
      const parsedUrl = new URL(url)
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        throw new Error('Only HTTP and HTTPS protocols are supported')
      }

      const response = await fetch(url, {
        signal: AbortSignal.timeout(URL_FETCH_TIMEOUT),
        headers: {
          'User-Agent': 'InvoiceExtractionAPI/1.0',
        },
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const contentType = response.headers.get('content-type') || 'application/octet-stream'
      const mimeType = contentType.split(';')[0].trim()

      // 從 URL 或 Content-Disposition 提取文件名
      let fileName = 'document'
      const contentDisposition = response.headers.get('content-disposition')
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="?([^";\n]+)"?/)
        if (match) fileName = match[1]
      } else {
        const segments = parsedUrl.pathname.split('/')
        const lastSegment = segments[segments.length - 1]
        if (lastSegment && lastSegment.includes('.')) {
          fileName = lastSegment
        }
      }

      const arrayBuffer = await response.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)

      return { buffer, fileName, mimeType }
    } catch (error) {
      if (error instanceof Error && error.name === 'TimeoutError') {
        throw new ApiError('URL_FETCH_FAILED', 'URL fetch timed out', 400)
      }
      throw new ApiError(
        'URL_FETCH_FAILED',
        `Failed to fetch file from URL: ${error instanceof Error ? error.message : 'Unknown error'}`,
        400
      )
    }
  }

  /**
   * 計算預估完成時間
   */
  private calculateEstimatedCompletion(cityCode: string, priority?: TaskPriority): Date {
    // 基礎處理時間（秒）
    const baseTime = priority === 'HIGH' ? 60 : 120

    // 考慮當前隊列深度（實際實現中應查詢當前隊列狀態）
    const queueFactor = 1

    const estimatedSeconds = baseTime * queueFactor
    return new Date(Date.now() + estimatedSeconds * 1000)
  }

  /**
   * 獲取預估處理時間（秒）
   */
  private async getEstimatedProcessingTime(
    cityCode: string,
    priority?: TaskPriority
  ): Promise<number> {
    // 嘗試基於歷史數據計算
    try {
      const recentTasks = await prisma.externalApiTask.findMany({
        where: {
          cityCode,
          status: 'COMPLETED',
          completedAt: { not: null },
          createdAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 過去 7 天
          },
        },
        select: {
          createdAt: true,
          completedAt: true,
        },
        take: 100,
        orderBy: { createdAt: 'desc' },
      })

      if (recentTasks.length >= 10) {
        const durations = recentTasks.map(
          task => (task.completedAt!.getTime() - task.createdAt.getTime()) / 1000
        )
        const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length
        const adjustedDuration = priority === 'HIGH' ? avgDuration * 0.5 : avgDuration
        return Math.ceil(adjustedDuration)
      }
    } catch (error) {
      console.error('Failed to calculate estimated processing time:', error)
    }

    // 預設值
    return priority === 'HIGH' ? 60 : 120
  }
}

export const invoiceSubmissionService = new InvoiceSubmissionService()
```

### 3.2 速率限制服務

```typescript
// lib/services/externalApi/rateLimitService.ts

import { Redis } from '@upstash/redis'
import { ExternalApiKey } from '@prisma/client'

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

export interface RateLimitResult {
  allowed: boolean
  limit: number
  remaining: number
  reset: number       // Unix timestamp
  retryAfter?: number // 秒
}

/**
 * 滑動窗口速率限制服務
 */
export class RateLimitService {
  private readonly windowMs = 60 * 1000 // 1 分鐘窗口

  /**
   * 檢查速率限制
   */
  async checkLimit(apiKey: ExternalApiKey): Promise<RateLimitResult> {
    const rateLimit = (apiKey.rateLimit as number) || 60
    const key = `rate_limit:external_api:${apiKey.id}`
    const now = Date.now()
    const windowStart = now - this.windowMs

    try {
      // 使用 Redis 管道執行多個操作
      const pipeline = redis.pipeline()

      // 1. 移除過期的請求記錄
      pipeline.zremrangebyscore(key, 0, windowStart)

      // 2. 獲取當前窗口內的請求數
      pipeline.zcard(key)

      const results = await pipeline.exec()
      const currentCount = (results[1] as number) || 0

      if (currentCount >= rateLimit) {
        // 計算重試時間
        const oldestRequest = await redis.zrange(key, 0, 0, { withScores: true })
        const retryAfter = oldestRequest.length > 0
          ? Math.ceil((oldestRequest[0].score + this.windowMs - now) / 1000)
          : 60

        return {
          allowed: false,
          limit: rateLimit,
          remaining: 0,
          reset: Math.ceil((now + this.windowMs) / 1000),
          retryAfter,
        }
      }

      // 記錄此次請求
      await redis.zadd(key, { score: now, member: `${now}:${Math.random().toString(36).substr(2, 9)}` })

      // 設置過期時間
      await redis.expire(key, 120) // 2 分鐘過期

      return {
        allowed: true,
        limit: rateLimit,
        remaining: rateLimit - currentCount - 1,
        reset: Math.ceil((now + this.windowMs) / 1000),
      }
    } catch (error) {
      console.error('Rate limit check error:', error)
      // 如果 Redis 出錯，默認允許請求（優雅降級）
      return {
        allowed: true,
        limit: rateLimit,
        remaining: rateLimit - 1,
        reset: Math.ceil((now + this.windowMs) / 1000),
      }
    }
  }

  /**
   * 重置速率限制（管理用途）
   */
  async resetLimit(apiKeyId: string): Promise<void> {
    const key = `rate_limit:external_api:${apiKeyId}`
    await redis.del(key)
  }

  /**
   * 獲取當前使用量（監控用途）
   */
  async getCurrentUsage(apiKeyId: string): Promise<number> {
    const key = `rate_limit:external_api:${apiKeyId}`
    const windowStart = Date.now() - this.windowMs

    await redis.zremrangebyscore(key, 0, windowStart)
    return await redis.zcard(key)
  }
}

export const rateLimitService = new RateLimitService()
```

---

## 4. API 路由

### 4.1 發票提交端點

```typescript
// app/api/v1/invoices/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { invoiceSubmissionService, ApiError } from '@/lib/services/externalApi/invoiceSubmissionService'
import { externalApiAuthMiddleware } from '@/lib/middleware/externalApiAuthMiddleware'
import { rateLimitService } from '@/lib/services/externalApi/rateLimitService'
import { auditLogService } from '@/lib/services/externalApi/auditLogService'
import {
  base64SubmissionSchema,
  urlSubmissionSchema,
  commonParamsSchema,
} from '@/types/externalApi/validation'
import { z } from 'zod'

export async function POST(request: NextRequest) {
  const traceId = generateTraceId()
  const startTime = Date.now()

  try {
    // 1. 認證
    const authResult = await externalApiAuthMiddleware(request, ['submit'])

    if (!authResult.authorized) {
      await logApiCall(request, null, authResult.statusCode, startTime, traceId)

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
      await logApiCall(request, apiKey.id, 429, startTime, traceId)

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

    // 3. 解析請求內容
    const contentType = request.headers.get('content-type') || ''
    let submissionRequest: any

    if (contentType.includes('multipart/form-data')) {
      submissionRequest = await parseMultipartRequest(request)
    } else if (contentType.includes('application/json')) {
      submissionRequest = await parseJsonRequest(request)
    } else {
      return NextResponse.json(
        {
          error: {
            code: 'UNSUPPORTED_CONTENT_TYPE',
            message: 'Content-Type must be multipart/form-data or application/json',
          },
          traceId,
        },
        { status: 415 }
      )
    }

    // 4. 提交處理
    const result = await invoiceSubmissionService.submitInvoice(
      submissionRequest,
      apiKey,
      {
        ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
            request.headers.get('x-real-ip') ||
            'unknown',
        userAgent: request.headers.get('user-agent') || undefined,
      }
    )

    await logApiCall(request, apiKey.id, 202, startTime, traceId)

    // 5. 返回結果
    return NextResponse.json(
      {
        data: result,
        traceId,
      },
      {
        status: 202,
        headers: {
          'X-RateLimit-Limit': rateLimitResult.limit.toString(),
          'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
          'X-RateLimit-Reset': rateLimitResult.reset.toString(),
        },
      }
    )
  } catch (error) {
    return handleError(error, traceId, startTime, request)
  }
}

/**
 * 解析 Multipart 請求
 */
async function parseMultipartRequest(request: NextRequest): Promise<any> {
  const formData = await request.formData()
  const file = formData.get('file') as File | null
  const params = formData.get('params') as string | null

  if (!file) {
    throw new ApiError('MISSING_FILE', 'File is required for multipart upload', 400)
  }

  const parsedParams = params ? JSON.parse(params) : {}
  const validatedParams = commonParamsSchema.parse(parsedParams)
  const arrayBuffer = await file.arrayBuffer()

  return {
    file: {
      buffer: Buffer.from(arrayBuffer),
      originalName: file.name,
      mimeType: file.type,
      size: file.size,
    },
    ...validatedParams,
    priority: validatedParams.priority === 'high' ? 'HIGH' : 'NORMAL',
  }
}

/**
 * 解析 JSON 請求
 */
async function parseJsonRequest(request: NextRequest): Promise<any> {
  const body = await request.json()
  const validatedParams = commonParamsSchema.parse(body)

  if (body.type === 'base64') {
    const base64Data = base64SubmissionSchema.parse(body)
    return {
      base64Content: {
        content: base64Data.content,
        fileName: base64Data.fileName,
        mimeType: base64Data.mimeType,
      },
      ...validatedParams,
      priority: validatedParams.priority === 'high' ? 'HIGH' : 'NORMAL',
    }
  }

  if (body.type === 'url') {
    const urlData = urlSubmissionSchema.parse(body)
    return {
      urlReference: {
        url: urlData.url,
        fileName: urlData.fileName,
      },
      ...validatedParams,
      priority: validatedParams.priority === 'high' ? 'HIGH' : 'NORMAL',
    }
  }

  throw new ApiError(
    'INVALID_SUBMISSION_TYPE',
    'type must be "base64" or "url" for JSON requests',
    400
  )
}

/**
 * 處理錯誤
 */
function handleError(
  error: unknown,
  traceId: string,
  startTime: number,
  request: NextRequest
): NextResponse {
  if (error instanceof ApiError) {
    return NextResponse.json(
      {
        error: {
          code: error.code,
          message: error.message,
        },
        traceId,
      },
      { status: error.statusCode }
    )
  }

  if (error instanceof z.ZodError) {
    return NextResponse.json(
      {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request parameters',
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

  console.error('Invoice submission error:', error)
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

/**
 * 生成追蹤 ID
 */
function generateTraceId(): string {
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).substr(2, 9)
  return `api_${timestamp}_${random}`
}

/**
 * 記錄 API 調用
 */
async function logApiCall(
  request: NextRequest,
  apiKeyId: string | null,
  statusCode: number,
  startTime: number,
  traceId: string
): Promise<void> {
  try {
    await auditLogService.logApiRequest({
      apiKeyId,
      endpoint: '/api/v1/invoices',
      method: 'POST',
      statusCode,
      durationMs: Date.now() - startTime,
      traceId,
      ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown',
      userAgent: request.headers.get('user-agent'),
    })
  } catch (error) {
    console.error('Failed to log API call:', error)
  }
}
```

### 4.2 外部 API 認證中間件

```typescript
// lib/middleware/externalApiAuthMiddleware.ts

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createHash } from 'crypto'
import { ExternalApiKey } from '@prisma/client'

export interface ExternalApiAuthResult {
  authorized: boolean
  apiKey?: ExternalApiKey
  statusCode: number
  errorCode?: string
  errorMessage?: string
}

/**
 * 外部 API 認證中間件
 */
export async function externalApiAuthMiddleware(
  request: NextRequest,
  requiredOperations?: string[]
): Promise<ExternalApiAuthResult> {
  // 從 Header 獲取 API Key
  const authHeader = request.headers.get('Authorization')

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return {
      authorized: false,
      statusCode: 401,
      errorCode: 'MISSING_API_KEY',
      errorMessage: 'API key is required. Use Authorization: Bearer {api_key}',
    }
  }

  const rawKey = authHeader.slice(7)

  // 基本格式驗證
  if (!rawKey || rawKey.length < 20) {
    await recordFailedAttempt(request, rawKey?.substring(0, 8) || 'unknown')
    return {
      authorized: false,
      statusCode: 401,
      errorCode: 'INVALID_API_KEY',
      errorMessage: 'Invalid API key format',
    }
  }

  const hashedKey = createHash('sha256').update(rawKey).digest('hex')

  // 查找 API Key
  const apiKey = await prisma.externalApiKey.findUnique({
    where: { keyHash: hashedKey },
  })

  if (!apiKey) {
    await recordFailedAttempt(request, rawKey.substring(0, 8))
    return {
      authorized: false,
      statusCode: 401,
      errorCode: 'INVALID_API_KEY',
      errorMessage: 'Invalid API key',
    }
  }

  // 檢查是否啟用
  if (!apiKey.isActive) {
    return {
      authorized: false,
      statusCode: 403,
      errorCode: 'API_KEY_DISABLED',
      errorMessage: 'API key is disabled',
    }
  }

  // 檢查是否過期
  if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
    return {
      authorized: false,
      statusCode: 403,
      errorCode: 'EXPIRED_API_KEY',
      errorMessage: 'API key has expired',
    }
  }

  // 檢查 IP 限制
  if (apiKey.allowedIps && (apiKey.allowedIps as string[]).length > 0) {
    const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
                     request.headers.get('x-real-ip') ||
                     'unknown'

    const allowedIps = apiKey.allowedIps as string[]
    if (!allowedIps.includes(clientIp) && !allowedIps.includes('*')) {
      return {
        authorized: false,
        statusCode: 403,
        errorCode: 'IP_NOT_ALLOWED',
        errorMessage: 'Request from unauthorized IP address',
      }
    }
  }

  // 檢查操作權限
  if (requiredOperations && requiredOperations.length > 0) {
    const allowedOps = apiKey.allowedOperations as string[]
    const hasPermission = allowedOps.includes('*') ||
      requiredOperations.every(op => allowedOps.includes(op))

    if (!hasPermission) {
      return {
        authorized: false,
        statusCode: 403,
        errorCode: 'INSUFFICIENT_PERMISSIONS',
        errorMessage: `API key does not have required permissions: ${requiredOperations.join(', ')}`,
        apiKey,
      }
    }
  }

  // 更新使用統計（異步，不阻塞）
  updateUsageStats(apiKey.id).catch(console.error)

  return {
    authorized: true,
    apiKey,
    statusCode: 200,
  }
}

/**
 * 記錄失敗的認證嘗試
 */
async function recordFailedAttempt(request: NextRequest, keyPrefix: string): Promise<void> {
  try {
    await prisma.apiAuthAttempt.create({
      data: {
        keyPrefix,
        ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown',
        userAgent: request.headers.get('user-agent'),
        success: false,
      },
    })
  } catch (error) {
    console.error('Failed to record auth attempt:', error)
  }
}

/**
 * 更新使用統計
 */
async function updateUsageStats(apiKeyId: string): Promise<void> {
  await prisma.externalApiKey.update({
    where: { id: apiKeyId },
    data: {
      lastUsedAt: new Date(),
      usageCount: { increment: 1 },
    },
  })
}
```

---

## 5. 前端組件

### 5.1 API 文件上傳測試組件

```typescript
// components/admin/api/InvoiceSubmissionTester.tsx

'use client'

import React, { useState } from 'react'
import {
  Card,
  CardContent,
  CardHeader,
  Button,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Box,
  Typography,
  Alert,
  CircularProgress,
  Tabs,
  Tab,
  Paper,
} from '@mui/material'
import { CloudUpload, Send, ContentCopy } from '@mui/icons-material'

interface TabPanelProps {
  children?: React.ReactNode
  index: number
  value: number
}

function TabPanel({ children, value, index }: TabPanelProps) {
  return (
    <div hidden={value !== index} style={{ paddingTop: 16 }}>
      {value === index && children}
    </div>
  )
}

export function InvoiceSubmissionTester() {
  const [activeTab, setActiveTab] = useState(0)
  const [apiKey, setApiKey] = useState('')
  const [cityCode, setCityCode] = useState('TPE')
  const [priority, setPriority] = useState('normal')
  const [callbackUrl, setCallbackUrl] = useState('')

  // File upload state
  const [file, setFile] = useState<File | null>(null)

  // Base64 state
  const [base64Content, setBase64Content] = useState('')
  const [base64FileName, setBase64FileName] = useState('')
  const [base64MimeType, setBase64MimeType] = useState('application/pdf')

  // URL state
  const [urlReference, setUrlReference] = useState('')

  // Result state
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      setFile(e.target.files[0])
    }
  }

  const handleSubmit = async () => {
    setLoading(true)
    setResult(null)
    setError(null)

    try {
      let response: Response

      if (activeTab === 0 && file) {
        // File upload
        const formData = new FormData()
        formData.append('file', file)
        formData.append('params', JSON.stringify({
          cityCode,
          priority,
          callbackUrl: callbackUrl || undefined,
        }))

        response = await fetch('/api/v1/invoices', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
          },
          body: formData,
        })
      } else if (activeTab === 1) {
        // Base64
        response = await fetch('/api/v1/invoices', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            type: 'base64',
            content: base64Content,
            fileName: base64FileName,
            mimeType: base64MimeType,
            cityCode,
            priority,
            callbackUrl: callbackUrl || undefined,
          }),
        })
      } else {
        // URL
        response = await fetch('/api/v1/invoices', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            type: 'url',
            url: urlReference,
            cityCode,
            priority,
            callbackUrl: callbackUrl || undefined,
          }),
        })
      }

      const data = await response.json()

      if (response.ok) {
        setResult(data)
      } else {
        setError(data.error?.message || 'Unknown error')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit')
    } finally {
      setLoading(false)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  return (
    <Card>
      <CardHeader title="發票提交 API 測試" />
      <CardContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {/* API Key */}
          <TextField
            label="API Key"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            fullWidth
            type="password"
            placeholder="輸入您的 API Key"
          />

          {/* Common params */}
          <Box sx={{ display: 'flex', gap: 2 }}>
            <FormControl sx={{ minWidth: 120 }}>
              <InputLabel>城市</InputLabel>
              <Select value={cityCode} onChange={(e) => setCityCode(e.target.value)} label="城市">
                <MenuItem value="TPE">台北</MenuItem>
                <MenuItem value="HKG">香港</MenuItem>
                <MenuItem value="SGP">新加坡</MenuItem>
              </Select>
            </FormControl>

            <FormControl sx={{ minWidth: 120 }}>
              <InputLabel>優先級</InputLabel>
              <Select value={priority} onChange={(e) => setPriority(e.target.value)} label="優先級">
                <MenuItem value="normal">標準</MenuItem>
                <MenuItem value="high">高優先</MenuItem>
              </Select>
            </FormControl>

            <TextField
              label="回調 URL（可選）"
              value={callbackUrl}
              onChange={(e) => setCallbackUrl(e.target.value)}
              fullWidth
              placeholder="https://your-webhook.com/callback"
            />
          </Box>

          {/* Submission type tabs */}
          <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)}>
            <Tab label="文件上傳" />
            <Tab label="Base64" />
            <Tab label="URL 引用" />
          </Tabs>

          <TabPanel value={activeTab} index={0}>
            <Button
              component="label"
              variant="outlined"
              startIcon={<CloudUpload />}
              fullWidth
            >
              選擇文件
              <input
                type="file"
                hidden
                accept=".pdf,.png,.jpg,.jpeg,.tiff"
                onChange={handleFileChange}
              />
            </Button>
            {file && (
              <Typography variant="body2" sx={{ mt: 1 }}>
                已選擇: {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
              </Typography>
            )}
          </TabPanel>

          <TabPanel value={activeTab} index={1}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <TextField
                label="文件名稱"
                value={base64FileName}
                onChange={(e) => setBase64FileName(e.target.value)}
                fullWidth
              />
              <FormControl fullWidth>
                <InputLabel>MIME 類型</InputLabel>
                <Select
                  value={base64MimeType}
                  onChange={(e) => setBase64MimeType(e.target.value)}
                  label="MIME 類型"
                >
                  <MenuItem value="application/pdf">PDF</MenuItem>
                  <MenuItem value="image/png">PNG</MenuItem>
                  <MenuItem value="image/jpeg">JPEG</MenuItem>
                </Select>
              </FormControl>
              <TextField
                label="Base64 內容"
                value={base64Content}
                onChange={(e) => setBase64Content(e.target.value)}
                multiline
                rows={4}
                fullWidth
              />
            </Box>
          </TabPanel>

          <TabPanel value={activeTab} index={2}>
            <TextField
              label="文件 URL"
              value={urlReference}
              onChange={(e) => setUrlReference(e.target.value)}
              fullWidth
              placeholder="https://example.com/invoice.pdf"
            />
          </TabPanel>

          {/* Submit button */}
          <Button
            variant="contained"
            startIcon={loading ? <CircularProgress size={20} /> : <Send />}
            onClick={handleSubmit}
            disabled={loading || !apiKey}
            fullWidth
          >
            {loading ? '提交中...' : '提交發票'}
          </Button>

          {/* Result */}
          {error && (
            <Alert severity="error">{error}</Alert>
          )}

          {result && (
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Typography variant="subtitle2">回應結果</Typography>
                <Button
                  size="small"
                  startIcon={<ContentCopy />}
                  onClick={() => copyToClipboard(JSON.stringify(result, null, 2))}
                >
                  複製
                </Button>
              </Box>
              <pre style={{
                backgroundColor: '#f5f5f5',
                padding: 12,
                borderRadius: 4,
                overflow: 'auto',
                fontSize: 12,
              }}>
                {JSON.stringify(result, null, 2)}
              </pre>
            </Paper>
          )}
        </Box>
      </CardContent>
    </Card>
  )
}
```

---

## 6. 測試計畫

### 6.1 單元測試

```typescript
// __tests__/services/externalApi/invoiceSubmissionService.test.ts

import { invoiceSubmissionService, ApiError } from '@/lib/services/externalApi/invoiceSubmissionService'
import { prismaMock } from '@/lib/__mocks__/prisma'
import { blobStorageService } from '@/lib/services/blobStorageService'

jest.mock('@/lib/services/blobStorageService')
jest.mock('@/lib/services/documentProcessingService')

describe('InvoiceSubmissionService', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('validateFile', () => {
    it('should throw error for empty file', () => {
      const emptyBuffer = Buffer.alloc(0)

      expect(() => {
        invoiceSubmissionService['validateFile'](emptyBuffer, 'application/pdf')
      }).toThrow(ApiError)

      try {
        invoiceSubmissionService['validateFile'](emptyBuffer, 'application/pdf')
      } catch (error) {
        expect((error as ApiError).code).toBe('EMPTY_FILE')
        expect((error as ApiError).statusCode).toBe(400)
      }
    })

    it('should throw error for oversized file', () => {
      const largeBuffer = Buffer.alloc(60 * 1024 * 1024) // 60MB

      expect(() => {
        invoiceSubmissionService['validateFile'](largeBuffer, 'application/pdf')
      }).toThrow(ApiError)

      try {
        invoiceSubmissionService['validateFile'](largeBuffer, 'application/pdf')
      } catch (error) {
        expect((error as ApiError).code).toBe('FILE_TOO_LARGE')
      }
    })

    it('should throw error for unsupported format', () => {
      const buffer = Buffer.from('test content')

      expect(() => {
        invoiceSubmissionService['validateFile'](buffer, 'application/zip')
      }).toThrow(ApiError)

      try {
        invoiceSubmissionService['validateFile'](buffer, 'application/zip')
      } catch (error) {
        expect((error as ApiError).code).toBe('UNSUPPORTED_FORMAT')
      }
    })

    it('should pass for valid PDF file', () => {
      const buffer = Buffer.from('test content')

      expect(() => {
        invoiceSubmissionService['validateFile'](buffer, 'application/pdf')
      }).not.toThrow()
    })

    it('should handle case-insensitive MIME types', () => {
      const buffer = Buffer.from('test content')

      expect(() => {
        invoiceSubmissionService['validateFile'](buffer, 'Application/PDF')
      }).not.toThrow()

      expect(() => {
        invoiceSubmissionService['validateFile'](buffer, 'IMAGE/PNG')
      }).not.toThrow()
    })
  })

  describe('validateRequest', () => {
    const mockApiKey = {
      id: 'key-1',
      allowedCities: ['TPE', 'HKG'],
      allowedOperations: ['submit', 'query'],
    } as any

    it('should reject unauthorized city', async () => {
      const request = {
        file: { buffer: Buffer.from('test'), originalName: 'test.pdf', mimeType: 'application/pdf', size: 4 },
        cityCode: 'SGP', // Not in allowed cities
      }

      await expect(
        invoiceSubmissionService['validateRequest'](request as any, mockApiKey)
      ).rejects.toThrow('not authorized for this city')
    })

    it('should allow wildcard city access', async () => {
      const wildcardKey = { ...mockApiKey, allowedCities: ['*'] }
      const request = {
        file: { buffer: Buffer.from('test'), originalName: 'test.pdf', mimeType: 'application/pdf', size: 4 },
        cityCode: 'ANY',
      }

      await expect(
        invoiceSubmissionService['validateRequest'](request as any, wildcardKey)
      ).resolves.not.toThrow()
    })

    it('should reject multiple content types', async () => {
      const request = {
        file: { buffer: Buffer.from('test'), originalName: 'test.pdf', mimeType: 'application/pdf', size: 4 },
        base64Content: { content: 'dGVzdA==', fileName: 'test.pdf', mimeType: 'application/pdf' },
        cityCode: 'TPE',
      }

      await expect(
        invoiceSubmissionService['validateRequest'](request as any, mockApiKey)
      ).rejects.toThrow('Exactly one of')
    })

    it('should reject invalid callback URL', async () => {
      const request = {
        file: { buffer: Buffer.from('test'), originalName: 'test.pdf', mimeType: 'application/pdf', size: 4 },
        cityCode: 'TPE',
        callbackUrl: 'not-a-valid-url',
      }

      await expect(
        invoiceSubmissionService['validateRequest'](request as any, mockApiKey)
      ).rejects.toThrow('Invalid callback URL')
    })
  })

  describe('submitInvoice', () => {
    it('should create task and document for valid submission', async () => {
      const apiKey = {
        id: 'key-1',
        name: 'Test Key',
        allowedCities: ['*'],
        allowedOperations: ['submit'],
      } as any

      ;(blobStorageService.uploadDocument as jest.Mock).mockResolvedValue('https://blob.storage/doc.pdf')

      prismaMock.document.create.mockResolvedValue({ id: 'doc-1' } as any)
      prismaMock.externalApiTask.create.mockResolvedValue({
        taskId: 'task-123',
        createdAt: new Date('2025-01-01'),
      } as any)

      const result = await invoiceSubmissionService.submitInvoice(
        {
          file: {
            buffer: Buffer.from('test'),
            originalName: 'test.pdf',
            mimeType: 'application/pdf',
            size: 4,
          },
          cityCode: 'TPE',
        },
        apiKey,
        { ip: '127.0.0.1' }
      )

      expect(result.taskId).toBe('task-123')
      expect(result.status).toBe('queued')
      expect(result.statusUrl).toBe('/api/v1/invoices/task-123/status')
    })
  })
})
```

### 6.2 API 整合測試

```typescript
// __tests__/api/v1/invoices/submit.test.ts

import { POST } from '@/app/api/v1/invoices/route'
import { NextRequest } from 'next/server'
import { prismaMock } from '@/lib/__mocks__/prisma'

// Mock dependencies
jest.mock('@/lib/services/externalApi/rateLimitService')
jest.mock('@/lib/services/blobStorageService')
jest.mock('@/lib/services/documentProcessingService')

describe('POST /api/v1/invoices', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should reject request without API key', async () => {
    const request = new NextRequest('http://localhost/api/v1/invoices', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    })

    const response = await POST(request)
    expect(response.status).toBe(401)

    const data = await response.json()
    expect(data.error.code).toBe('MISSING_API_KEY')
  })

  it('should reject request with invalid API key', async () => {
    prismaMock.externalApiKey.findUnique.mockResolvedValue(null)

    const request = new NextRequest('http://localhost/api/v1/invoices', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer invalid-api-key',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    })

    const response = await POST(request)
    expect(response.status).toBe(401)

    const data = await response.json()
    expect(data.error.code).toBe('INVALID_API_KEY')
  })

  it('should include rate limit headers', async () => {
    // Setup valid API key
    prismaMock.externalApiKey.findUnique.mockResolvedValue({
      id: 'key-1',
      isActive: true,
      allowedCities: ['*'],
      allowedOperations: ['*'],
      rateLimit: 60,
    } as any)

    // Mock rate limit service
    const { rateLimitService } = require('@/lib/services/externalApi/rateLimitService')
    rateLimitService.checkLimit.mockResolvedValue({
      allowed: true,
      limit: 60,
      remaining: 59,
      reset: Math.floor(Date.now() / 1000) + 60,
    })

    // Setup other mocks for successful submission
    const { blobStorageService } = require('@/lib/services/blobStorageService')
    blobStorageService.uploadDocument.mockResolvedValue('https://blob/doc.pdf')

    prismaMock.document.create.mockResolvedValue({ id: 'doc-1' } as any)
    prismaMock.externalApiTask.create.mockResolvedValue({
      taskId: 'task-1',
      createdAt: new Date(),
    } as any)

    const request = new NextRequest('http://localhost/api/v1/invoices', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer valid-key',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'base64',
        content: Buffer.from('test').toString('base64'),
        fileName: 'test.pdf',
        mimeType: 'application/pdf',
        cityCode: 'TPE',
      }),
    })

    const response = await POST(request)

    expect(response.headers.get('X-RateLimit-Limit')).toBe('60')
    expect(response.headers.get('X-RateLimit-Remaining')).toBeDefined()
  })

  it('should return 429 when rate limited', async () => {
    prismaMock.externalApiKey.findUnique.mockResolvedValue({
      id: 'key-1',
      isActive: true,
      allowedCities: ['*'],
      allowedOperations: ['*'],
      rateLimit: 60,
    } as any)

    const { rateLimitService } = require('@/lib/services/externalApi/rateLimitService')
    rateLimitService.checkLimit.mockResolvedValue({
      allowed: false,
      limit: 60,
      remaining: 0,
      reset: Math.floor(Date.now() / 1000) + 45,
      retryAfter: 45,
    })

    const request = new NextRequest('http://localhost/api/v1/invoices', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer valid-key',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    })

    const response = await POST(request)

    expect(response.status).toBe(429)
    expect(response.headers.get('Retry-After')).toBe('45')

    const data = await response.json()
    expect(data.error.code).toBe('RATE_LIMIT_EXCEEDED')
  })
})
```

### 6.3 E2E 測試

```typescript
// e2e/external-api-submission.spec.ts

import { test, expect } from '@playwright/test'

test.describe('External API Invoice Submission', () => {
  const API_KEY = process.env.TEST_EXTERNAL_API_KEY!
  const BASE_URL = process.env.TEST_API_BASE_URL || 'http://localhost:3000'

  test('should submit invoice via file upload', async ({ request }) => {
    const formData = new FormData()
    formData.append('file', new Blob(['test content'], { type: 'application/pdf' }), 'test.pdf')
    formData.append('params', JSON.stringify({
      cityCode: 'TPE',
      priority: 'normal',
    }))

    const response = await request.post(`${BASE_URL}/api/v1/invoices`, {
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
      },
      multipart: {
        file: {
          name: 'test.pdf',
          mimeType: 'application/pdf',
          buffer: Buffer.from('test content'),
        },
        params: JSON.stringify({
          cityCode: 'TPE',
          priority: 'normal',
        }),
      },
    })

    expect(response.status()).toBe(202)

    const data = await response.json()
    expect(data.data.taskId).toBeDefined()
    expect(data.data.status).toBe('queued')
    expect(data.data.statusUrl).toContain(data.data.taskId)
  })

  test('should submit invoice via Base64', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/v1/invoices`, {
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
      },
      data: {
        type: 'base64',
        content: Buffer.from('test content').toString('base64'),
        fileName: 'test.pdf',
        mimeType: 'application/pdf',
        cityCode: 'TPE',
      },
    })

    expect(response.status()).toBe(202)
  })

  test('should submit invoice via URL reference', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/v1/invoices`, {
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
      },
      data: {
        type: 'url',
        url: 'https://example.com/sample-invoice.pdf',
        cityCode: 'TPE',
      },
    })

    // Note: This may fail if the URL is not accessible
    expect([202, 400]).toContain(response.status())
  })

  test('should reject oversized file', async ({ request }) => {
    // Create a buffer larger than 50MB
    const largeContent = 'x'.repeat(51 * 1024 * 1024)

    const response = await request.post(`${BASE_URL}/api/v1/invoices`, {
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
      },
      data: {
        type: 'base64',
        content: Buffer.from(largeContent).toString('base64'),
        fileName: 'large.pdf',
        mimeType: 'application/pdf',
        cityCode: 'TPE',
      },
    })

    expect(response.status()).toBe(400)

    const data = await response.json()
    expect(data.error.code).toBe('FILE_TOO_LARGE')
  })

  test('should enforce rate limiting', async ({ request }) => {
    // Make many requests quickly
    const promises = Array(100).fill(null).map(() =>
      request.post(`${BASE_URL}/api/v1/invoices`, {
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
          'Content-Type': 'application/json',
        },
        data: {
          type: 'base64',
          content: Buffer.from('test').toString('base64'),
          fileName: 'test.pdf',
          mimeType: 'application/pdf',
          cityCode: 'TPE',
        },
      })
    )

    const responses = await Promise.all(promises)
    const rateLimited = responses.filter(r => r.status() === 429)

    // Some requests should be rate limited
    expect(rateLimited.length).toBeGreaterThan(0)
  })
})
```

---

## 7. 部署注意事項

### 7.1 環境變數

```env
# Redis (速率限制)
UPSTASH_REDIS_REST_URL=your-redis-url
UPSTASH_REDIS_REST_TOKEN=your-redis-token

# 文件處理
EXTERNAL_API_MAX_FILE_SIZE=52428800  # 50MB in bytes
EXTERNAL_API_URL_FETCH_TIMEOUT=30000  # 30 seconds

# 速率限制預設值
EXTERNAL_API_DEFAULT_RATE_LIMIT=60
EXTERNAL_API_RATE_LIMIT_WINDOW=60000  # 1 minute in milliseconds

# Blob Storage
AZURE_STORAGE_CONNECTION_STRING=your-connection-string
AZURE_STORAGE_CONTAINER_NAME=invoices
```

### 7.2 監控指標

| 指標 | 描述 | 告警閾值 |
|------|------|----------|
| `external_api_requests_total` | API 請求總數 | - |
| `external_api_errors_total` | API 錯誤總數 | >5% 錯誤率 |
| `external_api_latency_ms` | API 回應時間 | p95 > 2000ms |
| `external_api_rate_limit_hits` | 速率限制觸發次數 | >50/min |
| `external_api_file_size_bytes` | 上傳文件大小分佈 | - |
| `external_api_submission_type` | 提交方式分佈 | - |

### 7.3 安全考量

1. **API Key 安全**
   - 使用 SHA-256 hash 儲存
   - 支援 IP 白名單限制
   - 支援到期時間設定
   - 記錄所有認證嘗試

2. **文件上傳安全**
   - 嚴格驗證 MIME 類型
   - 限制文件大小 (50MB)
   - 掃描惡意內容（可選）
   - 使用臨時 URL 存取

3. **請求驗證**
   - 使用 Zod 驗證所有輸入
   - 拒絕不支援的 Content-Type
   - 驗證回調 URL 協議

### 7.4 效能最佳化

1. **非同步處理**
   - 文件處理使用佇列
   - 審計日誌異步寫入
   - 使用統計異步更新

2. **快取策略**
   - Redis 快取 API Key 驗證結果（短期）
   - 快取城市配置資訊

3. **連線池**
   - 配置適當的資料庫連線池
   - 使用 Redis 連線池

---

## 8. 驗收標準對應

| AC | 描述 | 實現狀態 |
|----|------|----------|
| AC1 | 多種提交方式 | ✅ 支援文件上傳、Base64、URL 引用 |
| AC2 | 成功回應格式 | ✅ HTTP 202 + taskId + 預估時間 + 狀態 URL |
| AC3 | 可選參數支援 | ✅ cityCode、priority、callbackUrl、metadata |
| AC4 | 錯誤處理 | ✅ 標準錯誤格式 + 詳細錯誤代碼 |

---

## 9. 開放問題

1. **文件防重**: 是否需要基於文件 hash 檢測重複提交？
2. **批次提交**: 未來是否需要支援單次 API 調用提交多個文件？
3. **優先級隊列**: HIGH 優先級的具體實現機制？
4. **文件預覽**: 是否需要提供上傳文件的預覽 URL？

---

## 10. 參考資料

- [REST API 設計最佳實踐](https://restfulapi.net/)
- [HTTP 狀態碼參考](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status)
- [RFC 7807 - Problem Details for HTTP APIs](https://tools.ietf.org/html/rfc7807)
- [Zod 驗證庫文檔](https://zod.dev/)
- [Azure Blob Storage SDK](https://docs.microsoft.com/en-us/azure/storage/blobs/)
