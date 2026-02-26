# Story 11-1: API 發票提交端點

## Story 資訊

- **Epic**: 11 - 對外 API 服務
- **功能需求**: FR64 (發票提交 API)
- **優先級**: High
- **故事點數**: 8
- **相關 Stories**:
  - Story 11-2 (API 處理狀態查詢端點)
  - Story 11-5 (API 訪問控制與認證)
  - Story 10-1 (n8n 雙向通訊 API)

## 使用者故事

**As a** 外部系統開發者,
**I want** 通過 API 提交發票文件進行處理,
**So that** 我可以將發票處理功能整合到我的應用中。

## 驗收標準

### AC1: 多種提交方式

**Given** 外部系統已獲得 API 訪問權限
**When** 調用 `POST /api/v1/invoices` 端點
**Then** 可以提交發票文件，支援以下方式：
- 文件直接上傳（multipart/form-data）
- Base64 編碼內容
- 外部 URL 引用

### AC2: 成功回應格式

**Given** 提交發票請求
**When** 請求包含有效內容
**Then** API 返回：
- HTTP 202 Accepted
- 處理任務 ID
- 預估處理時間
- 狀態查詢 URL

### AC3: 可選參數支援

**Given** 提交發票請求
**When** 請求包含可選參數
**Then** 支援以下參數：
- `cityCode` - 指定城市（必填）
- `priority` - 優先級（normal/high）
- `callbackUrl` - 完成回調 URL
- `metadata` - 自定義元數據（JSON）

### AC4: 錯誤處理

**Given** 提交發票請求
**When** 文件格式不支援或大小超限
**Then** 返回 HTTP 400 Bad Request
**And** 包含清晰的錯誤訊息和錯誤代碼

## 技術規格

### 1. 資料模型

```prisma
// 外部 API 任務記錄
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

enum SubmissionType {
  FILE_UPLOAD       // multipart/form-data
  BASE64            // Base64 編碼
  URL_REFERENCE     // 外部 URL
}

enum TaskPriority {
  NORMAL
  HIGH
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

### 2. 發票提交服務

```typescript
// lib/services/externalApi/invoiceSubmissionService.ts
import { prisma } from '@/lib/prisma'
import { blobStorageService } from '@/lib/services/blobStorageService'
import { documentProcessingService } from '@/lib/services/documentProcessingService'
import { ExternalApiKey, ApiTaskStatus, SubmissionType, TaskPriority } from '@prisma/client'

export interface SubmitInvoiceRequest {
  // 文件內容（三選一）
  file?: {
    buffer: Buffer
    originalName: string
    mimeType: string
    size: number
  }
  base64Content?: {
    content: string
    fileName: string
    mimeType: string
  }
  urlReference?: {
    url: string
    fileName?: string
  }

  // 必填參數
  cityCode: string

  // 可選參數
  priority?: TaskPriority
  callbackUrl?: string
  metadata?: Record<string, any>
}

export interface SubmitInvoiceResponse {
  taskId: string
  status: string
  estimatedProcessingTime: number  // 秒
  statusUrl: string
  createdAt: string
}

// 支援的文件格式
const SUPPORTED_MIME_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/tiff',
]

// 文件大小限制 (50MB)
const MAX_FILE_SIZE = 50 * 1024 * 1024

export class InvoiceSubmissionService {
  // 提交發票
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

  // 驗證請求
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

  // 處理文件內容
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

  // 驗證文件
  private validateFile(buffer: Buffer, mimeType: string): void {
    // 檢查文件大小
    if (buffer.length > MAX_FILE_SIZE) {
      throw new ApiError(
        'FILE_TOO_LARGE',
        `File size exceeds maximum limit of ${MAX_FILE_SIZE / 1024 / 1024}MB`,
        400
      )
    }

    // 檢查文件格式
    if (!SUPPORTED_MIME_TYPES.includes(mimeType.toLowerCase())) {
      throw new ApiError(
        'UNSUPPORTED_FORMAT',
        `File format not supported. Supported formats: PDF, PNG, JPG, TIFF`,
        400
      )
    }

    // 檢查文件是否為空
    if (buffer.length === 0) {
      throw new ApiError('EMPTY_FILE', 'File content is empty', 400)
    }
  }

  // 從 URL 獲取文件
  private async fetchFromUrl(url: string): Promise<{
    buffer: Buffer
    fileName: string
    mimeType: string
  }> {
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(30000), // 30 秒超時
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
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
        const urlPath = new URL(url).pathname
        const segments = urlPath.split('/')
        if (segments.length > 0) {
          fileName = segments[segments.length - 1] || 'document'
        }
      }

      const arrayBuffer = await response.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)

      return { buffer, fileName, mimeType }
    } catch (error) {
      throw new ApiError(
        'URL_FETCH_FAILED',
        `Failed to fetch file from URL: ${error instanceof Error ? error.message : 'Unknown error'}`,
        400
      )
    }
  }

  // 計算預估完成時間
  private calculateEstimatedCompletion(cityCode: string, priority?: TaskPriority): Date {
    // 基礎處理時間（秒）
    const baseTime = priority === 'HIGH' ? 60 : 120

    // 考慮當前隊列深度
    // 實際實現中應查詢當前隊列狀態
    const queueFactor = 1

    const estimatedSeconds = baseTime * queueFactor
    return new Date(Date.now() + estimatedSeconds * 1000)
  }

  // 獲取預估處理時間（秒）
  private async getEstimatedProcessingTime(
    cityCode: string,
    priority?: TaskPriority
  ): Promise<number> {
    // 基於歷史數據計算
    const avgDuration = await prisma.externalApiTask.aggregate({
      where: {
        cityCode,
        status: 'COMPLETED',
        completedAt: { not: null },
      },
      _avg: {
        // 計算平均處理時間
      },
    })

    // 預設值
    const baseTime = priority === 'HIGH' ? 60 : 120
    return baseTime
  }
}

// API 錯誤類
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

export const invoiceSubmissionService = new InvoiceSubmissionService()
```

### 3. API 路由實現

```typescript
// app/api/v1/invoices/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { invoiceSubmissionService, ApiError } from '@/lib/services/externalApi/invoiceSubmissionService'
import { externalApiAuthMiddleware } from '@/lib/middleware/externalApiAuthMiddleware'
import { rateLimitMiddleware } from '@/lib/middleware/rateLimitMiddleware'
import { z } from 'zod'

// Base64 提交 schema
const base64SubmissionSchema = z.object({
  type: z.literal('base64'),
  content: z.string().min(1),
  fileName: z.string().min(1),
  mimeType: z.string().min(1),
})

// URL 提交 schema
const urlSubmissionSchema = z.object({
  type: z.literal('url'),
  url: z.string().url(),
  fileName: z.string().optional(),
})

// 通用參數 schema
const commonParamsSchema = z.object({
  cityCode: z.string().min(1),
  priority: z.enum(['normal', 'high']).optional(),
  callbackUrl: z.string().url().optional(),
  metadata: z.record(z.any()).optional(),
})

export async function POST(request: NextRequest) {
  const traceId = `api_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

  try {
    // 1. 認證
    const authResult = await externalApiAuthMiddleware(request, ['submit'])
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
            'X-RateLimit-Limit': rateLimitResult.limit?.toString() || '60',
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': rateLimitResult.reset?.toString() || '',
          },
        }
      )
    }

    // 3. 解析請求內容
    const contentType = request.headers.get('content-type') || ''

    let submissionRequest: any

    if (contentType.includes('multipart/form-data')) {
      // 文件上傳
      const formData = await request.formData()
      const file = formData.get('file') as File | null
      const params = formData.get('params') as string | null

      if (!file) {
        return NextResponse.json(
          {
            error: {
              code: 'MISSING_FILE',
              message: 'File is required for multipart upload',
            },
            traceId,
          },
          { status: 400 }
        )
      }

      const parsedParams = params ? JSON.parse(params) : {}
      const validatedParams = commonParamsSchema.parse(parsedParams)

      const arrayBuffer = await file.arrayBuffer()

      submissionRequest = {
        file: {
          buffer: Buffer.from(arrayBuffer),
          originalName: file.name,
          mimeType: file.type,
          size: file.size,
        },
        ...validatedParams,
        priority: validatedParams.priority === 'high' ? 'HIGH' : 'NORMAL',
      }
    } else if (contentType.includes('application/json')) {
      // JSON 請求
      const body = await request.json()
      const validatedParams = commonParamsSchema.parse(body)

      if (body.type === 'base64') {
        const base64Data = base64SubmissionSchema.parse(body)
        submissionRequest = {
          base64Content: {
            content: base64Data.content,
            fileName: base64Data.fileName,
            mimeType: base64Data.mimeType,
          },
          ...validatedParams,
          priority: validatedParams.priority === 'high' ? 'HIGH' : 'NORMAL',
        }
      } else if (body.type === 'url') {
        const urlData = urlSubmissionSchema.parse(body)
        submissionRequest = {
          urlReference: {
            url: urlData.url,
            fileName: urlData.fileName,
          },
          ...validatedParams,
          priority: validatedParams.priority === 'high' ? 'HIGH' : 'NORMAL',
        }
      } else {
        return NextResponse.json(
          {
            error: {
              code: 'INVALID_SUBMISSION_TYPE',
              message: 'type must be "base64" or "url" for JSON requests',
            },
            traceId,
          },
          { status: 400 }
        )
      }
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
      authResult.apiKey!,
      {
        ip: request.headers.get('x-forwarded-for') || 'unknown',
        userAgent: request.headers.get('user-agent') || undefined,
      }
    )

    // 5. 返回結果
    return NextResponse.json(
      {
        data: result,
        traceId,
      },
      {
        status: 202,
        headers: {
          'X-RateLimit-Limit': rateLimitResult.limit?.toString() || '60',
          'X-RateLimit-Remaining': rateLimitResult.remaining?.toString() || '59',
        },
      }
    )
  } catch (error) {
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
            details: error.errors,
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
}
```

### 4. 速率限制中間件

```typescript
// lib/middleware/rateLimitMiddleware.ts
import { NextRequest } from 'next/server'
import { Redis } from '@upstash/redis'
import { ExternalApiKey } from '@prisma/client'

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

export interface RateLimitResult {
  allowed: boolean
  limit?: number
  remaining?: number
  reset?: number
  retryAfter?: number
}

export async function rateLimitMiddleware(
  request: NextRequest,
  apiKey: ExternalApiKey
): Promise<RateLimitResult> {
  const rateLimit = (apiKey.rateLimit as number) || 60  // 預設每分鐘 60 次
  const windowMs = 60 * 1000  // 1 分鐘窗口

  const key = `rate_limit:${apiKey.id}`
  const now = Date.now()
  const windowStart = now - windowMs

  try {
    // 使用滑動窗口算法
    // 移除過期的請求記錄
    await redis.zremrangebyscore(key, 0, windowStart)

    // 獲取當前窗口內的請求數
    const currentCount = await redis.zcard(key)

    if (currentCount >= rateLimit) {
      // 計算重試時間
      const oldestRequest = await redis.zrange(key, 0, 0, { withScores: true })
      const retryAfter = oldestRequest.length > 0
        ? Math.ceil((oldestRequest[0].score + windowMs - now) / 1000)
        : 60

      return {
        allowed: false,
        limit: rateLimit,
        remaining: 0,
        reset: Math.ceil((now + windowMs) / 1000),
        retryAfter,
      }
    }

    // 記錄此次請求
    await redis.zadd(key, { score: now, member: `${now}:${Math.random()}` })

    // 設置過期時間
    await redis.expire(key, 120)  // 2 分鐘過期

    return {
      allowed: true,
      limit: rateLimit,
      remaining: rateLimit - currentCount - 1,
      reset: Math.ceil((now + windowMs) / 1000),
    }
  } catch (error) {
    console.error('Rate limit check error:', error)
    // 如果 Redis 出錯，默認允許請求
    return { allowed: true }
  }
}
```

### 5. 外部 API 認證中間件

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
  const hashedKey = createHash('sha256').update(rawKey).digest('hex')

  // 查找 API Key
  const apiKey = await prisma.externalApiKey.findUnique({
    where: { keyHash: hashedKey },
  })

  if (!apiKey) {
    // 記錄失敗嘗試
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
      errorCode: 'API_KEY_EXPIRED',
      errorMessage: 'API key has expired',
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
        errorMessage: 'API key does not have required permissions',
        apiKey,
      }
    }
  }

  // 更新使用統計
  await prisma.externalApiKey.update({
    where: { id: apiKey.id },
    data: {
      lastUsedAt: new Date(),
      usageCount: { increment: 1 },
    },
  })

  return {
    authorized: true,
    apiKey,
    statusCode: 200,
  }
}

async function recordFailedAttempt(request: NextRequest, keyPrefix: string): Promise<void> {
  // 記錄失敗的認證嘗試
  await prisma.apiAuthAttempt.create({
    data: {
      keyPrefix,
      ip: request.headers.get('x-forwarded-for') || 'unknown',
      userAgent: request.headers.get('user-agent'),
      success: false,
    },
  })
}
```

## 測試案例

### 單元測試

```typescript
// __tests__/services/externalApi/invoiceSubmissionService.test.ts
import { invoiceSubmissionService, ApiError } from '@/lib/services/externalApi/invoiceSubmissionService'
import { prismaMock } from '@/lib/__mocks__/prisma'

describe('InvoiceSubmissionService', () => {
  describe('validateFile', () => {
    it('should throw error for oversized file', () => {
      const largeBuffer = Buffer.alloc(60 * 1024 * 1024) // 60MB

      expect(() => {
        invoiceSubmissionService['validateFile'](largeBuffer, 'application/pdf')
      }).toThrow(ApiError)
    })

    it('should throw error for unsupported format', () => {
      const buffer = Buffer.from('test')

      expect(() => {
        invoiceSubmissionService['validateFile'](buffer, 'application/zip')
      }).toThrow(ApiError)
    })

    it('should pass for valid PDF file', () => {
      const buffer = Buffer.from('test')

      expect(() => {
        invoiceSubmissionService['validateFile'](buffer, 'application/pdf')
      }).not.toThrow()
    })
  })

  describe('submitInvoice', () => {
    it('should create task and document for valid submission', async () => {
      const apiKey = {
        id: 'key-1',
        allowedCities: ['*'],
        allowedOperations: ['submit'],
      } as any

      prismaMock.document.create.mockResolvedValue({ id: 'doc-1' } as any)
      prismaMock.externalApiTask.create.mockResolvedValue({
        taskId: 'task-1',
        createdAt: new Date(),
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

      expect(result.taskId).toBe('task-1')
      expect(result.status).toBe('queued')
    })

    it('should reject unauthorized city', async () => {
      const apiKey = {
        id: 'key-1',
        allowedCities: ['HKG'],
        allowedOperations: ['submit'],
      } as any

      await expect(
        invoiceSubmissionService.submitInvoice(
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
      ).rejects.toThrow('not authorized for this city')
    })
  })
})
```

### API 整合測試

```typescript
// __tests__/api/v1/invoices/submit.test.ts
import { POST } from '@/app/api/v1/invoices/route'
import { createMocks } from 'node-mocks-http'

describe('POST /api/v1/invoices', () => {
  it('should reject request without API key', async () => {
    const { req } = createMocks({
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: {},
    })

    const response = await POST(req as any)
    expect(response.status).toBe(401)
  })

  it('should accept valid JSON submission', async () => {
    // Mock valid API key authentication
    const { req } = createMocks({
      method: 'POST',
      headers: {
        'Authorization': 'Bearer valid-api-key',
        'Content-Type': 'application/json',
      },
      body: {
        type: 'base64',
        content: Buffer.from('test').toString('base64'),
        fileName: 'test.pdf',
        mimeType: 'application/pdf',
        cityCode: 'TPE',
      },
    })

    const response = await POST(req as any)
    expect(response.status).toBe(202)
  })
})
```

## 部署注意事項

1. **環境變數配置**
   - `UPSTASH_REDIS_REST_URL`: Redis URL（用於速率限制）
   - `UPSTASH_REDIS_REST_TOKEN`: Redis Token
   - `API_MAX_FILE_SIZE`: 最大文件大小（預設 50MB）

2. **監控指標**
   - API 調用次數和成功率
   - 平均回應時間
   - 速率限制觸發次數
   - 各種錯誤類型分佈

3. **安全考量**
   - API Key 使用 SHA-256 hash 儲存
   - 所有調用記錄審計日誌
   - 實現 IP 黑名單機制

## 相依性

- Story 11-2: API 處理狀態查詢端點（狀態查詢 URL）
- Story 11-5: API 訪問控制與認證（API Key 管理）
- Story 10-1: n8n 雙向通訊 API（處理觸發機制）

---

## Implementation Notes

> 實際實現於 2025-12-20

### 實現的文件結構

```
src/
├── app/api/v1/invoices/
│   └── route.ts                    # POST /api/v1/invoices 端點
├── middleware/
│   ├── external-api-auth.ts        # API Key 認證中間件
│   └── index.ts                    # 中間件導出
├── services/
│   ├── invoice-submission.service.ts  # 發票提交服務
│   ├── rate-limit.service.ts       # 速率限制服務（內存實現）
│   └── index.ts                    # 服務導出
└── types/external-api/
    ├── index.ts                    # 類型統一導出
    ├── submission.ts               # 提交請求類型
    ├── response.ts                 # 回應類型和錯誤代碼
    └── validation.ts               # Zod 驗證 Schema
```

### 關鍵實現細節

#### 1. API Key 認證 (`external-api-auth.ts`)
- 從 `Authorization: Bearer {API_KEY}` 標頭提取 API Key
- 使用 SHA-256 hash 在資料庫中查找 API Key
- 驗證狀態（isActive）、過期時間、IP 限制
- 驗證操作權限（allowedOperations）
- 更新使用統計（lastUsedAt, usageCount）
- 記錄失敗的認證嘗試到 `ApiAuthAttempt` 表

#### 2. 速率限制 (`rate-limit.service.ts`)
- 採用滑動窗口算法（1 分鐘窗口）
- 使用內存 Map 實現（開發環境）
- 返回 `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset` 標頭
- 超過限制時返回 HTTP 429 和 `Retry-After` 標頭

#### 3. 三種提交方式
1. **Multipart/form-data**: 直接上傳文件
2. **Base64 JSON**: JSON 請求包含 Base64 編碼的文件內容
3. **URL JSON**: JSON 請求包含文件 URL，服務端自動下載

#### 4. 審計日誌
- 每個 API 調用記錄到 `ApiAuditLog` 表
- 包含：端點、方法、狀態碼、回應時間、traceId、客戶端 IP、User-Agent

### 與 Tech Spec 的差異

| 項目 | Tech Spec | 實際實現 | 原因 |
|------|-----------|---------|------|
| 速率限制 | Redis (Upstash) | 內存 Map | 開發環境簡化，生產環境可切換 |
| Blob Storage | Azure Blob | 臨時路徑 | 與現有文件上傳流程整合 |
| Document 狀態 | PENDING | UPLOADED | 配合現有 DocumentStatus enum |

### 依賴的 Prisma 模型

- `ExternalApiKey` - API Key 管理
- `ExternalApiTask` - 外部 API 任務記錄
- `ApiAuthAttempt` - 認證嘗試記錄
- `ApiAuditLog` - API 調用審計日誌
- `Document` - 文件記錄
- `City` - 城市驗證

### 測試建議

```bash
# 1. Multipart 上傳測試
curl -X POST http://localhost:3000/api/v1/invoices \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -F "file=@invoice.pdf" \
  -F 'params={"cityCode":"HKG","priority":"NORMAL"}'

# 2. Base64 提交測試
curl -X POST http://localhost:3000/api/v1/invoices \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "base64",
    "content": "JVBERi0xLjQK...",
    "fileName": "invoice.pdf",
    "mimeType": "application/pdf",
    "cityCode": "HKG"
  }'

# 3. URL 引用測試
curl -X POST http://localhost:3000/api/v1/invoices \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "url",
    "url": "https://example.com/invoice.pdf",
    "cityCode": "HKG"
  }'
```

### 後續改進建議

1. **生產環境速率限制**: 切換到 Redis 實現
2. **文件上傳**: 整合 Azure Blob Storage
3. **單元測試**: 添加完整的測試覆蓋
4. **API 文檔**: 生成 OpenAPI/Swagger 規格
