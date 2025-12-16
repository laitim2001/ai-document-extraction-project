# Story 10-1: n8n 雙向通訊 API

## Story 資訊

- **Epic**: 10 - n8n 工作流整合
- **功能需求**: FR54 (n8n 雙向通訊), FR55 (工作流觸發)
- **優先級**: High
- **故事點數**: 13
- **相關 Stories**:
  - Story 10-2 (Webhook 配置管理)
  - Story 9-1 (SharePoint 文件監控 API)
  - Story 11-5 (API 存取控制)

## 使用者故事

**As a** 系統,
**I want** 提供完整的 API 供 n8n 工作流調用,
**So that** n8n 可以與平台進行雙向通訊。

## 驗收標準

### AC1: n8n 專用 API 端點

**Given** n8n 工作流需要調用平台功能
**When** 發送 API 請求
**Then** 平台提供以下 API 端點：
- `POST /api/n8n/documents` - 提交文件處理
- `GET /api/n8n/documents/{id}/status` - 查詢處理狀態
- `GET /api/n8n/documents/{id}/result` - 獲取處理結果
- `POST /api/n8n/webhook` - 接收 n8n 回調通知

### AC2: API Key 認證機制

**Given** n8n 調用 API
**When** 需要認證
**Then** 使用 API Key 認證機制
**And** API Key 綁定特定城市權限
**And** 記錄所有 API 調用至審計日誌

### AC3: 平台回調通知

**Given** 平台需要通知 n8n
**When** 文件處理完成或發生錯誤
**Then** 平台調用配置的 n8n Webhook URL
**And** 傳送標準化的事件通知格式

### AC4: 標準錯誤格式

**Given** API 調用
**When** 發生錯誤
**Then** 返回標準錯誤格式：錯誤代碼、錯誤訊息、追蹤 ID

## 技術規格

### 1. 資料模型

```prisma
// n8n API Key 模型
model N8nApiKey {
  id            String    @id @default(cuid())
  key           String    @unique // hashed API key
  keyPrefix     String    // 前 8 字元用於顯示識別
  name          String    // 用途描述
  cityCode      String    // 綁定城市
  city          City      @relation(fields: [cityCode], references: [code])

  // 權限設定
  permissions   String[]  // ['documents:read', 'documents:write', 'webhook:receive']

  // 使用追蹤
  lastUsedAt    DateTime?
  usageCount    Int       @default(0)

  // 狀態管理
  isActive      Boolean   @default(true)
  expiresAt     DateTime?

  // 審計
  createdBy     String
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  // 關聯
  apiCalls      N8nApiCall[]

  @@index([key])
  @@index([cityCode])
  @@index([isActive])
}

// API 調用記錄
model N8nApiCall {
  id            String    @id @default(cuid())
  apiKeyId      String
  apiKey        N8nApiKey @relation(fields: [apiKeyId], references: [id])

  // 請求資訊
  endpoint      String
  method        String
  requestBody   Json?

  // 回應資訊
  statusCode    Int
  responseBody  Json?

  // 性能指標
  durationMs    Int

  // 追蹤
  traceId       String    @unique
  ipAddress     String
  userAgent     String?

  // 審計
  timestamp     DateTime  @default(now())

  @@index([apiKeyId])
  @@index([endpoint])
  @@index([timestamp])
  @@index([traceId])
}

// n8n 回調事件記錄
model N8nWebhookEvent {
  id                  String    @id @default(cuid())

  // 事件資訊
  eventType           N8nEventType
  documentId          String?
  document            Document? @relation(fields: [documentId], references: [id])
  workflowExecutionId String?

  // 回調資訊
  webhookUrl          String
  requestPayload      Json

  // 回應狀態
  status              WebhookDeliveryStatus @default(PENDING)
  responseCode        Int?
  responseBody        String?

  // 重試管理
  attemptCount        Int       @default(0)
  maxAttempts         Int       @default(3)
  nextRetryAt         DateTime?
  lastAttemptAt       DateTime?

  // 錯誤追蹤
  errorMessage        String?

  // 審計
  createdAt           DateTime  @default(now())
  completedAt         DateTime?

  @@index([eventType])
  @@index([documentId])
  @@index([status])
  @@index([nextRetryAt])
}

enum N8nEventType {
  DOCUMENT_RECEIVED       // 文件已接收
  DOCUMENT_PROCESSING     // 處理中
  DOCUMENT_COMPLETED      // 處理完成
  DOCUMENT_FAILED         // 處理失敗
  DOCUMENT_REVIEW_NEEDED  // 需要人工審核
  WORKFLOW_STARTED        // 工作流已啟動
  WORKFLOW_COMPLETED      // 工作流已完成
  WORKFLOW_FAILED         // 工作流失敗
}

enum WebhookDeliveryStatus {
  PENDING     // 待發送
  SENDING     // 發送中
  SUCCESS     // 發送成功
  FAILED      // 發送失敗
  RETRYING    // 重試中
  EXHAUSTED   // 重試次數耗盡
}
```

### 2. API 服務實現

```typescript
// lib/services/n8n/n8nApiKeyService.ts
import { prisma } from '@/lib/prisma'
import { createHash, randomBytes } from 'crypto'
import { N8nApiKey } from '@prisma/client'

export interface CreateApiKeyInput {
  name: string
  cityCode: string
  permissions: string[]
  expiresAt?: Date
  createdBy: string
}

export interface ValidateApiKeyResult {
  valid: boolean
  apiKey?: N8nApiKey
  error?: string
}

export class N8nApiKeyService {
  // 生成 API Key
  async createApiKey(input: CreateApiKeyInput): Promise<{ apiKey: N8nApiKey; rawKey: string }> {
    // 生成隨機 key
    const rawKey = `n8n_${randomBytes(32).toString('hex')}`
    const hashedKey = this.hashKey(rawKey)
    const keyPrefix = rawKey.substring(0, 12)

    const apiKey = await prisma.n8nApiKey.create({
      data: {
        key: hashedKey,
        keyPrefix,
        name: input.name,
        cityCode: input.cityCode,
        permissions: input.permissions,
        expiresAt: input.expiresAt,
        createdBy: input.createdBy,
      },
    })

    // 只在創建時返回原始 key
    return { apiKey, rawKey }
  }

  // 驗證 API Key
  async validateApiKey(rawKey: string): Promise<ValidateApiKeyResult> {
    const hashedKey = this.hashKey(rawKey)

    const apiKey = await prisma.n8nApiKey.findUnique({
      where: { key: hashedKey },
      include: { city: true },
    })

    if (!apiKey) {
      return { valid: false, error: 'Invalid API key' }
    }

    if (!apiKey.isActive) {
      return { valid: false, error: 'API key is disabled' }
    }

    if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
      return { valid: false, error: 'API key has expired' }
    }

    // 更新使用統計
    await prisma.n8nApiKey.update({
      where: { id: apiKey.id },
      data: {
        lastUsedAt: new Date(),
        usageCount: { increment: 1 },
      },
    })

    return { valid: true, apiKey }
  }

  // 檢查權限
  hasPermission(apiKey: N8nApiKey, requiredPermission: string): boolean {
    return apiKey.permissions.includes(requiredPermission) ||
           apiKey.permissions.includes('*')
  }

  // Hash key
  private hashKey(key: string): string {
    return createHash('sha256').update(key).digest('hex')
  }

  // 列出 API Keys
  async listApiKeys(cityCode?: string): Promise<N8nApiKey[]> {
    return prisma.n8nApiKey.findMany({
      where: cityCode ? { cityCode } : undefined,
      orderBy: { createdAt: 'desc' },
    })
  }

  // 撤銷 API Key
  async revokeApiKey(id: string): Promise<N8nApiKey> {
    return prisma.n8nApiKey.update({
      where: { id },
      data: { isActive: false },
    })
  }

  // 刪除 API Key
  async deleteApiKey(id: string): Promise<void> {
    await prisma.n8nApiKey.delete({
      where: { id },
    })
  }
}

export const n8nApiKeyService = new N8nApiKeyService()
```

### 3. n8n 文件服務

```typescript
// lib/services/n8n/n8nDocumentService.ts
import { prisma } from '@/lib/prisma'
import { blobStorageService } from '@/lib/services/blobStorageService'
import { documentProcessingService } from '@/lib/services/documentProcessingService'
import { n8nWebhookService } from './n8nWebhookService'
import { Document, DocumentStatus } from '@prisma/client'

export interface N8nDocumentSubmitRequest {
  // 文件資訊
  fileName: string
  fileContent: string  // Base64 encoded
  mimeType: string
  fileSize: number

  // 來源資訊
  workflowId?: string
  workflowName?: string
  triggerSource?: string  // 'sharepoint' | 'outlook' | 'manual' | 'api'

  // 業務資訊
  cityCode: string
  forwarderCode?: string
  metadata?: Record<string, any>

  // 回調設定
  callbackUrl?: string
  correlationId?: string
}

export interface N8nDocumentResponse {
  success: boolean
  documentId?: string
  status?: string
  message?: string
  traceId: string
}

export interface N8nDocumentStatusResponse {
  documentId: string
  status: DocumentStatus
  processingStage?: string
  progress?: number
  estimatedCompletionTime?: Date
  createdAt: Date
  updatedAt: Date
}

export interface N8nDocumentResultResponse {
  documentId: string
  status: DocumentStatus
  extractedData?: Record<string, any>
  confidenceScore?: number
  forwarderCode?: string
  forwarderName?: string
  reviewStatus?: string
  processingDuration?: number
  completedAt?: Date
}

export class N8nDocumentService {
  // 提交文件處理
  async submitDocument(
    request: N8nDocumentSubmitRequest,
    apiKeyId: string,
    traceId: string
  ): Promise<N8nDocumentResponse> {
    try {
      // 1. 解碼文件內容
      const fileBuffer = Buffer.from(request.fileContent, 'base64')

      // 2. 上傳到 Blob Storage
      const blobUrl = await blobStorageService.uploadDocument(
        fileBuffer,
        request.fileName,
        request.mimeType,
        {
          source: 'n8n',
          workflowId: request.workflowId,
          correlationId: request.correlationId,
        }
      )

      // 3. 創建文件記錄
      const document = await prisma.document.create({
        data: {
          fileName: request.fileName,
          originalFileName: request.fileName,
          fileSize: request.fileSize,
          mimeType: request.mimeType,
          blobUrl,
          cityCode: request.cityCode,

          // 來源追蹤
          sourceType: 'N8N_WORKFLOW',
          sourceMetadata: {
            workflowId: request.workflowId,
            workflowName: request.workflowName,
            triggerSource: request.triggerSource,
            correlationId: request.correlationId,
            callbackUrl: request.callbackUrl,
            apiKeyId,
            traceId,
          },

          // 初始狀態
          status: 'PENDING',

          // 可選的 forwarder
          forwarderCode: request.forwarderCode,

          // 額外 metadata
          metadata: request.metadata,
        },
      })

      // 4. 觸發處理流程
      await documentProcessingService.startProcessing(document.id)

      // 5. 發送接收確認回調
      if (request.callbackUrl) {
        await n8nWebhookService.sendEvent({
          eventType: 'DOCUMENT_RECEIVED',
          documentId: document.id,
          webhookUrl: request.callbackUrl,
          payload: {
            documentId: document.id,
            status: 'RECEIVED',
            correlationId: request.correlationId,
            traceId,
          },
        })
      }

      return {
        success: true,
        documentId: document.id,
        status: 'RECEIVED',
        message: 'Document submitted successfully',
        traceId,
      }
    } catch (error) {
      console.error('Failed to submit document:', error)
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
        traceId,
      }
    }
  }

  // 查詢處理狀態
  async getDocumentStatus(documentId: string): Promise<N8nDocumentStatusResponse | null> {
    const document = await prisma.document.findUnique({
      where: { id: documentId },
      include: {
        processingLogs: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    })

    if (!document) {
      return null
    }

    // 計算進度
    const progress = this.calculateProgress(document.status)

    // 預估完成時間（基於歷史數據）
    const estimatedCompletionTime = await this.estimateCompletionTime(document)

    return {
      documentId: document.id,
      status: document.status,
      processingStage: document.processingLogs[0]?.stage,
      progress,
      estimatedCompletionTime,
      createdAt: document.createdAt,
      updatedAt: document.updatedAt,
    }
  }

  // 獲取處理結果
  async getDocumentResult(documentId: string): Promise<N8nDocumentResultResponse | null> {
    const document = await prisma.document.findUnique({
      where: { id: documentId },
      include: {
        forwarder: true,
        extractionResult: true,
      },
    })

    if (!document) {
      return null
    }

    return {
      documentId: document.id,
      status: document.status,
      extractedData: document.extractionResult?.data as Record<string, any>,
      confidenceScore: document.extractionResult?.confidenceScore,
      forwarderCode: document.forwarderCode,
      forwarderName: document.forwarder?.name,
      reviewStatus: document.reviewStatus,
      processingDuration: document.processingDuration,
      completedAt: document.completedAt,
    }
  }

  // 計算處理進度
  private calculateProgress(status: DocumentStatus): number {
    const progressMap: Record<DocumentStatus, number> = {
      PENDING: 0,
      UPLOADING: 10,
      OCR_PROCESSING: 30,
      AI_EXTRACTING: 50,
      FORWARDER_IDENTIFYING: 70,
      VALIDATION: 80,
      PENDING_REVIEW: 90,
      APPROVED: 100,
      COMPLETED: 100,
      FAILED: 0,
      REJECTED: 0,
    }
    return progressMap[status] || 0
  }

  // 預估完成時間
  private async estimateCompletionTime(document: Document): Promise<Date | undefined> {
    if (['COMPLETED', 'FAILED', 'REJECTED', 'APPROVED'].includes(document.status)) {
      return undefined
    }

    // 獲取平均處理時間
    const avgDuration = await prisma.document.aggregate({
      where: {
        status: 'COMPLETED',
        cityCode: document.cityCode,
        completedAt: { not: null },
      },
      _avg: {
        processingDuration: true,
      },
    })

    const avgMs = avgDuration._avg.processingDuration || 60000 // 預設 1 分鐘
    const elapsedMs = Date.now() - document.createdAt.getTime()
    const remainingMs = Math.max(avgMs - elapsedMs, 0)

    return new Date(Date.now() + remainingMs)
  }
}

export const n8nDocumentService = new N8nDocumentService()
```

### 4. Webhook 服務

```typescript
// lib/services/n8n/n8nWebhookService.ts
import { prisma } from '@/lib/prisma'
import { N8nEventType, WebhookDeliveryStatus } from '@prisma/client'

export interface SendEventInput {
  eventType: N8nEventType
  documentId?: string
  workflowExecutionId?: string
  webhookUrl: string
  payload: Record<string, any>
}

export interface WebhookPayload {
  event: N8nEventType
  timestamp: string
  data: Record<string, any>
  metadata: {
    traceId: string
    retryCount: number
  }
}

export class N8nWebhookService {
  private readonly retryDelays = [1000, 5000, 30000] // 1秒, 5秒, 30秒

  // 發送事件
  async sendEvent(input: SendEventInput): Promise<void> {
    const event = await prisma.n8nWebhookEvent.create({
      data: {
        eventType: input.eventType,
        documentId: input.documentId,
        workflowExecutionId: input.workflowExecutionId,
        webhookUrl: input.webhookUrl,
        requestPayload: input.payload,
        status: 'PENDING',
      },
    })

    // 立即嘗試發送
    await this.deliverWebhook(event.id)
  }

  // 發送 Webhook
  async deliverWebhook(eventId: string): Promise<boolean> {
    const event = await prisma.n8nWebhookEvent.findUnique({
      where: { id: eventId },
    })

    if (!event || event.status === 'SUCCESS' || event.status === 'EXHAUSTED') {
      return false
    }

    // 更新狀態為發送中
    await prisma.n8nWebhookEvent.update({
      where: { id: eventId },
      data: { status: 'SENDING' },
    })

    const traceId = `wh_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    const payload: WebhookPayload = {
      event: event.eventType,
      timestamp: new Date().toISOString(),
      data: event.requestPayload as Record<string, any>,
      metadata: {
        traceId,
        retryCount: event.attemptCount,
      },
    }

    try {
      const response = await fetch(event.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Event': event.eventType,
          'X-Trace-Id': traceId,
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(30000), // 30 秒超時
      })

      const responseBody = await response.text()

      if (response.ok) {
        // 成功
        await prisma.n8nWebhookEvent.update({
          where: { id: eventId },
          data: {
            status: 'SUCCESS',
            responseCode: response.status,
            responseBody,
            attemptCount: event.attemptCount + 1,
            lastAttemptAt: new Date(),
            completedAt: new Date(),
          },
        })
        return true
      } else {
        // HTTP 錯誤
        throw new Error(`HTTP ${response.status}: ${responseBody}`)
      }
    } catch (error) {
      // 發送失敗，準備重試
      const newAttemptCount = event.attemptCount + 1
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'

      if (newAttemptCount >= event.maxAttempts) {
        // 重試次數耗盡
        await prisma.n8nWebhookEvent.update({
          where: { id: eventId },
          data: {
            status: 'EXHAUSTED',
            errorMessage,
            attemptCount: newAttemptCount,
            lastAttemptAt: new Date(),
          },
        })
        return false
      }

      // 設置下次重試時間
      const nextRetryDelay = this.retryDelays[newAttemptCount - 1] || 30000
      const nextRetryAt = new Date(Date.now() + nextRetryDelay)

      await prisma.n8nWebhookEvent.update({
        where: { id: eventId },
        data: {
          status: 'RETRYING',
          errorMessage,
          attemptCount: newAttemptCount,
          lastAttemptAt: new Date(),
          nextRetryAt,
        },
      })

      // 排程重試
      setTimeout(() => {
        this.deliverWebhook(eventId)
      }, nextRetryDelay)

      return false
    }
  }

  // 處理待重試的 Webhooks（用於應用重啟後恢復）
  async processRetryQueue(): Promise<void> {
    const pendingRetries = await prisma.n8nWebhookEvent.findMany({
      where: {
        status: 'RETRYING',
        nextRetryAt: { lte: new Date() },
      },
    })

    for (const event of pendingRetries) {
      await this.deliverWebhook(event.id)
    }
  }
}

export const n8nWebhookService = new N8nWebhookService()
```

### 5. API 路由實現

```typescript
// app/api/n8n/documents/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { n8nDocumentService, N8nDocumentSubmitRequest } from '@/lib/services/n8n/n8nDocumentService'
import { n8nApiKeyService } from '@/lib/services/n8n/n8nApiKeyService'
import { n8nApiMiddleware, N8nApiContext } from '@/lib/middleware/n8nApiMiddleware'
import { generateTraceId } from '@/lib/utils/tracing'
import { z } from 'zod'

const submitDocumentSchema = z.object({
  fileName: z.string().min(1),
  fileContent: z.string().min(1), // Base64
  mimeType: z.string().min(1),
  fileSize: z.number().positive(),
  workflowId: z.string().optional(),
  workflowName: z.string().optional(),
  triggerSource: z.enum(['sharepoint', 'outlook', 'manual', 'api']).optional(),
  cityCode: z.string().min(1),
  forwarderCode: z.string().optional(),
  metadata: z.record(z.any()).optional(),
  callbackUrl: z.string().url().optional(),
  correlationId: z.string().optional(),
})

export async function POST(request: NextRequest) {
  const traceId = generateTraceId()

  // 驗證 API Key
  const authResult = await n8nApiMiddleware(request, 'documents:write')
  if (!authResult.authorized) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: authResult.errorCode,
          message: authResult.errorMessage,
        },
        traceId,
      },
      { status: authResult.statusCode }
    )
  }

  try {
    const body = await request.json()
    const validatedData = submitDocumentSchema.parse(body)

    // 驗證城市權限
    if (validatedData.cityCode !== authResult.apiKey!.cityCode) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'CITY_MISMATCH',
            message: 'API key is not authorized for this city',
          },
          traceId,
        },
        { status: 403 }
      )
    }

    const result = await n8nDocumentService.submitDocument(
      validatedData as N8nDocumentSubmitRequest,
      authResult.apiKey!.id,
      traceId
    )

    return NextResponse.json(result, { status: result.success ? 201 : 400 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request body',
            details: error.errors,
          },
          traceId,
        },
        { status: 400 }
      )
    }

    console.error('Document submission error:', error)
    return NextResponse.json(
      {
        success: false,
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
// app/api/n8n/documents/[id]/status/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { n8nDocumentService } from '@/lib/services/n8n/n8nDocumentService'
import { n8nApiMiddleware } from '@/lib/middleware/n8nApiMiddleware'
import { generateTraceId } from '@/lib/utils/tracing'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const traceId = generateTraceId()

  // 驗證 API Key
  const authResult = await n8nApiMiddleware(request, 'documents:read')
  if (!authResult.authorized) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: authResult.errorCode,
          message: authResult.errorMessage,
        },
        traceId,
      },
      { status: authResult.statusCode }
    )
  }

  try {
    const status = await n8nDocumentService.getDocumentStatus(params.id)

    if (!status) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Document not found',
          },
          traceId,
        },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: status,
      traceId,
    })
  } catch (error) {
    console.error('Get document status error:', error)
    return NextResponse.json(
      {
        success: false,
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
// app/api/n8n/documents/[id]/result/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { n8nDocumentService } from '@/lib/services/n8n/n8nDocumentService'
import { n8nApiMiddleware } from '@/lib/middleware/n8nApiMiddleware'
import { generateTraceId } from '@/lib/utils/tracing'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const traceId = generateTraceId()

  // 驗證 API Key
  const authResult = await n8nApiMiddleware(request, 'documents:read')
  if (!authResult.authorized) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: authResult.errorCode,
          message: authResult.errorMessage,
        },
        traceId,
      },
      { status: authResult.statusCode }
    )
  }

  try {
    const result = await n8nDocumentService.getDocumentResult(params.id)

    if (!result) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Document not found',
          },
          traceId,
        },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: result,
      traceId,
    })
  } catch (error) {
    console.error('Get document result error:', error)
    return NextResponse.json(
      {
        success: false,
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
// app/api/n8n/webhook/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { n8nApiMiddleware } from '@/lib/middleware/n8nApiMiddleware'
import { generateTraceId } from '@/lib/utils/tracing'
import { z } from 'zod'

const webhookEventSchema = z.object({
  event: z.enum([
    'workflow.started',
    'workflow.completed',
    'workflow.failed',
    'document.status_changed',
  ]),
  workflowExecutionId: z.string().optional(),
  documentId: z.string().optional(),
  data: z.record(z.any()),
  timestamp: z.string().datetime(),
})

export async function POST(request: NextRequest) {
  const traceId = generateTraceId()

  // 驗證 API Key
  const authResult = await n8nApiMiddleware(request, 'webhook:receive')
  if (!authResult.authorized) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: authResult.errorCode,
          message: authResult.errorMessage,
        },
        traceId,
      },
      { status: authResult.statusCode }
    )
  }

  try {
    const body = await request.json()
    const validatedData = webhookEventSchema.parse(body)

    // 記錄接收的 Webhook 事件
    await prisma.n8nIncomingWebhook.create({
      data: {
        eventType: validatedData.event,
        workflowExecutionId: validatedData.workflowExecutionId,
        documentId: validatedData.documentId,
        payload: validatedData.data,
        receivedAt: new Date(validatedData.timestamp),
        apiKeyId: authResult.apiKey!.id,
        traceId,
      },
    })

    // 根據事件類型處理
    switch (validatedData.event) {
      case 'workflow.started':
        await handleWorkflowStarted(validatedData)
        break
      case 'workflow.completed':
        await handleWorkflowCompleted(validatedData)
        break
      case 'workflow.failed':
        await handleWorkflowFailed(validatedData)
        break
      case 'document.status_changed':
        await handleDocumentStatusChanged(validatedData)
        break
    }

    return NextResponse.json({
      success: true,
      message: 'Webhook received',
      traceId,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid webhook payload',
            details: error.errors,
          },
          traceId,
        },
        { status: 400 }
      )
    }

    console.error('Webhook processing error:', error)
    return NextResponse.json(
      {
        success: false,
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

async function handleWorkflowStarted(data: z.infer<typeof webhookEventSchema>) {
  if (data.workflowExecutionId) {
    await prisma.workflowExecution.upsert({
      where: { id: data.workflowExecutionId },
      update: {
        status: 'RUNNING',
        startedAt: new Date(data.timestamp),
      },
      create: {
        id: data.workflowExecutionId,
        status: 'RUNNING',
        startedAt: new Date(data.timestamp),
        workflowName: data.data.workflowName,
        triggerType: data.data.triggerType,
      },
    })
  }
}

async function handleWorkflowCompleted(data: z.infer<typeof webhookEventSchema>) {
  if (data.workflowExecutionId) {
    await prisma.workflowExecution.update({
      where: { id: data.workflowExecutionId },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(data.timestamp),
        result: data.data,
      },
    })
  }
}

async function handleWorkflowFailed(data: z.infer<typeof webhookEventSchema>) {
  if (data.workflowExecutionId) {
    await prisma.workflowExecution.update({
      where: { id: data.workflowExecutionId },
      data: {
        status: 'FAILED',
        completedAt: new Date(data.timestamp),
        errorDetails: data.data,
      },
    })
  }
}

async function handleDocumentStatusChanged(data: z.infer<typeof webhookEventSchema>) {
  if (data.documentId && data.data.status) {
    await prisma.document.update({
      where: { id: data.documentId },
      data: {
        status: data.data.status,
        updatedAt: new Date(data.timestamp),
      },
    })
  }
}
```

### 6. API 認證中間件

```typescript
// lib/middleware/n8nApiMiddleware.ts
import { NextRequest } from 'next/server'
import { n8nApiKeyService } from '@/lib/services/n8n/n8nApiKeyService'
import { prisma } from '@/lib/prisma'
import { N8nApiKey } from '@prisma/client'

export interface N8nApiContext {
  authorized: boolean
  apiKey?: N8nApiKey
  statusCode: number
  errorCode?: string
  errorMessage?: string
}

export async function n8nApiMiddleware(
  request: NextRequest,
  requiredPermission: string
): Promise<N8nApiContext> {
  const startTime = Date.now()

  // 從 header 獲取 API Key
  const authHeader = request.headers.get('Authorization')
  const apiKeyHeader = request.headers.get('X-API-Key')

  let rawKey: string | null = null

  if (authHeader?.startsWith('Bearer ')) {
    rawKey = authHeader.slice(7)
  } else if (apiKeyHeader) {
    rawKey = apiKeyHeader
  }

  if (!rawKey) {
    return {
      authorized: false,
      statusCode: 401,
      errorCode: 'MISSING_API_KEY',
      errorMessage: 'API key is required',
    }
  }

  // 驗證 API Key
  const validationResult = await n8nApiKeyService.validateApiKey(rawKey)

  if (!validationResult.valid) {
    // 記錄失敗的嘗試
    await recordApiCall(request, null, 401, startTime, validationResult.error)

    return {
      authorized: false,
      statusCode: 401,
      errorCode: 'INVALID_API_KEY',
      errorMessage: validationResult.error,
    }
  }

  const apiKey = validationResult.apiKey!

  // 檢查權限
  if (!n8nApiKeyService.hasPermission(apiKey, requiredPermission)) {
    await recordApiCall(request, apiKey.id, 403, startTime, 'Insufficient permissions')

    return {
      authorized: false,
      statusCode: 403,
      errorCode: 'INSUFFICIENT_PERMISSIONS',
      errorMessage: `Missing required permission: ${requiredPermission}`,
      apiKey,
    }
  }

  // 記錄成功的調用（在路由處理後由調用方記錄）

  return {
    authorized: true,
    apiKey,
    statusCode: 200,
  }
}

async function recordApiCall(
  request: NextRequest,
  apiKeyId: string | null,
  statusCode: number,
  startTime: number,
  errorMessage?: string
): Promise<void> {
  const durationMs = Date.now() - startTime

  if (apiKeyId) {
    await prisma.n8nApiCall.create({
      data: {
        apiKeyId,
        endpoint: new URL(request.url).pathname,
        method: request.method,
        statusCode,
        durationMs,
        traceId: `trace_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
        userAgent: request.headers.get('user-agent'),
        responseBody: errorMessage ? { error: errorMessage } : undefined,
      },
    })
  }
}
```

### 7. Trace ID 工具

```typescript
// lib/utils/tracing.ts
export function generateTraceId(): string {
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).substr(2, 9)
  return `n8n_${timestamp}_${random}`
}

export function parseTraceId(traceId: string): {
  prefix: string
  timestamp: number
  random: string
} | null {
  const parts = traceId.split('_')
  if (parts.length !== 3 || parts[0] !== 'n8n') {
    return null
  }

  return {
    prefix: parts[0],
    timestamp: parseInt(parts[1], 36),
    random: parts[2],
  }
}
```

## 測試案例

### 單元測試

```typescript
// __tests__/services/n8n/n8nApiKeyService.test.ts
import { n8nApiKeyService } from '@/lib/services/n8n/n8nApiKeyService'
import { prismaMock } from '@/lib/__mocks__/prisma'

describe('N8nApiKeyService', () => {
  describe('createApiKey', () => {
    it('should create a new API key with hashed value', async () => {
      const input = {
        name: 'Test Integration',
        cityCode: 'TPE',
        permissions: ['documents:read', 'documents:write'],
        createdBy: 'admin-1',
      }

      prismaMock.n8nApiKey.create.mockResolvedValue({
        id: 'key-1',
        key: 'hashed-key',
        keyPrefix: 'n8n_abc123',
        ...input,
        isActive: true,
        usageCount: 0,
        lastUsedAt: null,
        expiresAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const result = await n8nApiKeyService.createApiKey(input)

      expect(result.rawKey).toMatch(/^n8n_[a-f0-9]{64}$/)
      expect(result.apiKey.keyPrefix).toBe(result.rawKey.substring(0, 12))
    })
  })

  describe('validateApiKey', () => {
    it('should return valid for active key', async () => {
      const rawKey = 'n8n_test123'

      prismaMock.n8nApiKey.findUnique.mockResolvedValue({
        id: 'key-1',
        key: 'hashed',
        keyPrefix: 'n8n_test12',
        name: 'Test',
        cityCode: 'TPE',
        permissions: ['documents:read'],
        isActive: true,
        expiresAt: null,
        usageCount: 0,
        lastUsedAt: null,
        createdBy: 'admin',
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      prismaMock.n8nApiKey.update.mockResolvedValue({} as any)

      const result = await n8nApiKeyService.validateApiKey(rawKey)

      expect(result.valid).toBe(true)
      expect(result.apiKey).toBeDefined()
    })

    it('should return invalid for disabled key', async () => {
      prismaMock.n8nApiKey.findUnique.mockResolvedValue({
        id: 'key-1',
        isActive: false,
      } as any)

      const result = await n8nApiKeyService.validateApiKey('any-key')

      expect(result.valid).toBe(false)
      expect(result.error).toBe('API key is disabled')
    })

    it('should return invalid for expired key', async () => {
      prismaMock.n8nApiKey.findUnique.mockResolvedValue({
        id: 'key-1',
        isActive: true,
        expiresAt: new Date('2020-01-01'),
      } as any)

      const result = await n8nApiKeyService.validateApiKey('any-key')

      expect(result.valid).toBe(false)
      expect(result.error).toBe('API key has expired')
    })
  })

  describe('hasPermission', () => {
    it('should return true for exact permission match', () => {
      const apiKey = { permissions: ['documents:read', 'documents:write'] } as any

      expect(n8nApiKeyService.hasPermission(apiKey, 'documents:read')).toBe(true)
    })

    it('should return true for wildcard permission', () => {
      const apiKey = { permissions: ['*'] } as any

      expect(n8nApiKeyService.hasPermission(apiKey, 'any:permission')).toBe(true)
    })

    it('should return false for missing permission', () => {
      const apiKey = { permissions: ['documents:read'] } as any

      expect(n8nApiKeyService.hasPermission(apiKey, 'documents:write')).toBe(false)
    })
  })
})
```

### API 整合測試

```typescript
// __tests__/api/n8n/documents.test.ts
import { createMocks } from 'node-mocks-http'
import { POST } from '@/app/api/n8n/documents/route'

describe('POST /api/n8n/documents', () => {
  it('should reject request without API key', async () => {
    const { req } = createMocks({
      method: 'POST',
      body: {},
    })

    const response = await POST(req as any)
    const data = await response.json()

    expect(response.status).toBe(401)
    expect(data.error.code).toBe('MISSING_API_KEY')
  })

  it('should reject request with invalid API key', async () => {
    const { req } = createMocks({
      method: 'POST',
      headers: {
        'Authorization': 'Bearer invalid-key',
      },
      body: {},
    })

    const response = await POST(req as any)
    const data = await response.json()

    expect(response.status).toBe(401)
    expect(data.error.code).toBe('INVALID_API_KEY')
  })

  it('should accept valid document submission', async () => {
    // Mock valid API key
    jest.spyOn(n8nApiKeyService, 'validateApiKey').mockResolvedValue({
      valid: true,
      apiKey: {
        id: 'key-1',
        cityCode: 'TPE',
        permissions: ['documents:write'],
      } as any,
    })

    const { req } = createMocks({
      method: 'POST',
      headers: {
        'Authorization': 'Bearer valid-key',
      },
      body: {
        fileName: 'test.pdf',
        fileContent: Buffer.from('test').toString('base64'),
        mimeType: 'application/pdf',
        fileSize: 4,
        cityCode: 'TPE',
      },
    })

    const response = await POST(req as any)
    const data = await response.json()

    expect(response.status).toBe(201)
    expect(data.success).toBe(true)
    expect(data.documentId).toBeDefined()
  })
})
```

## 部署注意事項

1. **環境變數配置**
   - `N8N_API_KEY_SALT`: API Key hash 鹽值
   - `N8N_WEBHOOK_TIMEOUT`: Webhook 超時設定（預設 30 秒）
   - `N8N_MAX_RETRY_ATTEMPTS`: 最大重試次數（預設 3）

2. **監控指標**
   - API 調用成功/失敗率
   - 平均回應時間
   - Webhook 發送成功率
   - 重試佇列深度

3. **安全考量**
   - API Key 使用 SHA-256 hash 儲存
   - 所有 API 調用記錄審計日誌
   - 支援 API Key 到期和撤銷機制
   - 城市級別的權限隔離

## 相依性

- Story 9-1: SharePoint 文件監控 API（共用 API Key 機制）
- Story 10-2: Webhook 配置管理（Webhook URL 配置）
- Story 11-5: API 存取控制（統一認證機制）
