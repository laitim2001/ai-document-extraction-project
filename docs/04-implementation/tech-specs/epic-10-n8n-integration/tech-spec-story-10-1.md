# Tech Spec: Story 10-1 - n8n 雙向通訊 API

## 概述

### Story 資訊
- **Story ID**: 10-1
- **標題**: n8n 雙向通訊 API
- **Epic**: 10 - n8n 工作流整合
- **故事點數**: 13
- **優先級**: High

### 目標
建立完整的 API 供 n8n 工作流調用，實現平台與 n8n 之間的雙向通訊，包含 API Key 認證、文件處理請求、狀態查詢及 Webhook 回調通知。

### 相依性
- Story 10-2: Webhook 配置管理（Webhook URL 配置）
- Story 9-1: SharePoint 文件監控 API（共用 API Key 機制）
- Story 11-5: API 存取控制（統一認證機制）

---

## 1. 資料庫設計

### 1.1 Prisma Schema

```prisma
// ============================================
// n8n API Key 模型
// ============================================
model N8nApiKey {
  id            String    @id @default(cuid())
  key           String    @unique // SHA-256 hashed API key
  keyPrefix     String    // 前 12 字元用於顯示識別 (n8n_xxxxxxxx)
  name          String    // 用途描述

  // 城市隔離
  cityCode      String
  city          City      @relation(fields: [cityCode], references: [code])

  // 權限設定
  permissions   String[]  // ['documents:read', 'documents:write', 'webhook:receive', '*']

  // 使用追蹤
  lastUsedAt    DateTime?
  usageCount    Int       @default(0)

  // 狀態管理
  isActive      Boolean   @default(true)
  expiresAt     DateTime?

  // 速率限制
  rateLimit     Int       @default(100)  // 每分鐘請求數
  rateLimitWindow Int     @default(60)   // 秒

  // 審計
  createdBy     String
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  // 關聯
  apiCalls      N8nApiCall[]
  incomingWebhooks N8nIncomingWebhook[]

  @@index([key])
  @@index([cityCode])
  @@index([isActive])
  @@index([keyPrefix])
}

// ============================================
// API 調用記錄
// ============================================
model N8nApiCall {
  id            String    @id @default(cuid())
  apiKeyId      String
  apiKey        N8nApiKey @relation(fields: [apiKeyId], references: [id], onDelete: Cascade)

  // 請求資訊
  endpoint      String
  method        String
  requestBody   Json?
  requestHeaders Json?

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
  @@index([statusCode])
}

// ============================================
// n8n 出站 Webhook 事件記錄 (平台 → n8n)
// ============================================
model N8nWebhookEvent {
  id                  String    @id @default(cuid())

  // 事件資訊
  eventType           N8nEventType
  documentId          String?
  document            Document? @relation(fields: [documentId], references: [id])
  workflowExecutionId String?

  // 城市隔離
  cityCode            String

  // 回調資訊
  webhookUrl          String
  requestPayload      Json
  requestHeaders      Json?

  // 回應狀態
  status              WebhookDeliveryStatus @default(PENDING)
  responseCode        Int?
  responseBody        String?
  responseHeaders     Json?

  // 重試管理
  attemptCount        Int       @default(0)
  maxAttempts         Int       @default(3)
  nextRetryAt         DateTime?
  lastAttemptAt       DateTime?

  // 性能追蹤
  durationMs          Int?

  // 錯誤追蹤
  errorMessage        String?
  errorStack          String?

  // 審計
  createdAt           DateTime  @default(now())
  completedAt         DateTime?

  @@index([eventType])
  @@index([documentId])
  @@index([status])
  @@index([nextRetryAt])
  @@index([cityCode])
  @@index([createdAt])
}

// ============================================
// n8n 入站 Webhook 記錄 (n8n → 平台)
// ============================================
model N8nIncomingWebhook {
  id                  String    @id @default(cuid())

  // API Key 關聯
  apiKeyId            String
  apiKey              N8nApiKey @relation(fields: [apiKeyId], references: [id])

  // 事件資訊
  eventType           String
  workflowExecutionId String?
  documentId          String?

  // 請求資訊
  payload             Json
  headers             Json?

  // 追蹤
  traceId             String    @unique
  ipAddress           String

  // 處理狀態
  processed           Boolean   @default(false)
  processedAt         DateTime?
  processingError     String?

  // 審計
  receivedAt          DateTime  @default(now())

  @@index([apiKeyId])
  @@index([eventType])
  @@index([traceId])
  @@index([receivedAt])
}

// ============================================
// 枚舉定義
// ============================================
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

### 1.2 索引策略

| 表名 | 索引 | 用途 |
|------|------|------|
| N8nApiKey | `key` (unique) | API Key 驗證查詢 |
| N8nApiKey | `cityCode, isActive` | 城市級別 API Key 列表 |
| N8nApiCall | `apiKeyId, timestamp` | API Key 使用歷史 |
| N8nApiCall | `traceId` (unique) | 追蹤 ID 查詢 |
| N8nWebhookEvent | `status, nextRetryAt` | 重試佇列處理 |
| N8nWebhookEvent | `documentId` | 文件相關事件查詢 |

---

## 2. 類型定義

### 2.1 API Key 類型

```typescript
// types/n8n/apiKey.ts

export type N8nPermission =
  | 'documents:read'
  | 'documents:write'
  | 'webhook:receive'
  | 'workflow:trigger'
  | 'status:read'
  | '*'

export interface N8nApiKeyInfo {
  id: string
  keyPrefix: string
  name: string
  cityCode: string
  cityName: string
  permissions: N8nPermission[]
  isActive: boolean
  expiresAt: Date | null
  lastUsedAt: Date | null
  usageCount: number
  rateLimit: number
  createdAt: Date
  createdBy: string
}

export interface CreateApiKeyInput {
  name: string
  cityCode: string
  permissions: N8nPermission[]
  expiresAt?: Date
  rateLimit?: number
  createdBy: string
}

export interface CreateApiKeyResult {
  apiKey: N8nApiKeyInfo
  rawKey: string  // 只在創建時返回一次
}

export interface ValidateApiKeyResult {
  valid: boolean
  apiKey?: N8nApiKeyInfo
  error?: string
  errorCode?: 'INVALID_KEY' | 'DISABLED' | 'EXPIRED' | 'RATE_LIMITED'
}
```

### 2.2 文件提交類型

```typescript
// types/n8n/document.ts

export interface N8nDocumentSubmitRequest {
  // 文件資訊
  fileName: string
  fileContent: string  // Base64 encoded
  mimeType: string
  fileSize: number

  // 來源資訊
  workflowId?: string
  workflowName?: string
  workflowExecutionId?: string
  triggerSource?: 'sharepoint' | 'outlook' | 'manual' | 'api'

  // 業務資訊
  cityCode: string
  forwarderCode?: string
  metadata?: Record<string, unknown>

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
  timestamp: string
}

export interface N8nDocumentStatusResponse {
  documentId: string
  status: DocumentStatus
  processingStage?: string
  progress: number
  estimatedCompletionTime?: Date
  createdAt: Date
  updatedAt: Date
}

export interface N8nDocumentResultResponse {
  documentId: string
  status: DocumentStatus
  extractedData?: Record<string, unknown>
  confidenceScore?: number
  forwarderCode?: string
  forwarderName?: string
  reviewStatus?: string
  processingDuration?: number
  completedAt?: Date
}
```

### 2.3 Webhook 類型

```typescript
// types/n8n/webhook.ts

export interface WebhookPayload<T = Record<string, unknown>> {
  event: N8nEventType
  timestamp: string
  data: T
  metadata: {
    traceId: string
    retryCount: number
    cityCode: string
  }
}

export interface SendEventInput {
  eventType: N8nEventType
  documentId?: string
  workflowExecutionId?: string
  webhookUrl: string
  cityCode: string
  payload: Record<string, unknown>
}

export interface WebhookDeliveryResult {
  success: boolean
  eventId: string
  status: WebhookDeliveryStatus
  responseCode?: number
  responseTime?: number
  error?: string
  retryScheduled?: Date
}

export interface IncomingWebhookEvent {
  event: 'workflow.started' | 'workflow.completed' | 'workflow.failed' | 'document.status_changed'
  workflowExecutionId?: string
  documentId?: string
  data: Record<string, unknown>
  timestamp: string
}
```

### 2.4 錯誤回應類型

```typescript
// types/n8n/error.ts

export interface N8nApiError {
  success: false
  error: {
    code: N8nErrorCode
    message: string
    details?: unknown
  }
  traceId: string
  timestamp: string
}

export type N8nErrorCode =
  | 'MISSING_API_KEY'
  | 'INVALID_API_KEY'
  | 'EXPIRED_API_KEY'
  | 'DISABLED_API_KEY'
  | 'RATE_LIMITED'
  | 'INSUFFICIENT_PERMISSIONS'
  | 'CITY_MISMATCH'
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'INTERNAL_ERROR'
  | 'WEBHOOK_DELIVERY_FAILED'
```

---

## 3. 服務實現

### 3.1 API Key 服務

```typescript
// lib/services/n8n/n8nApiKeyService.ts

import { prisma } from '@/lib/prisma'
import { createHash, randomBytes } from 'crypto'
import {
  CreateApiKeyInput,
  CreateApiKeyResult,
  ValidateApiKeyResult,
  N8nApiKeyInfo,
  N8nPermission
} from '@/types/n8n'

export class N8nApiKeyService {
  private readonly KEY_PREFIX = 'n8n_'
  private readonly KEY_LENGTH = 32 // bytes

  /**
   * 生成新的 API Key
   */
  async createApiKey(input: CreateApiKeyInput): Promise<CreateApiKeyResult> {
    // 生成隨機 key
    const randomPart = randomBytes(this.KEY_LENGTH).toString('hex')
    const rawKey = `${this.KEY_PREFIX}${randomPart}`
    const hashedKey = this.hashKey(rawKey)
    const keyPrefix = rawKey.substring(0, 12) // n8n_xxxxxxxx

    const apiKey = await prisma.n8nApiKey.create({
      data: {
        key: hashedKey,
        keyPrefix,
        name: input.name,
        cityCode: input.cityCode,
        permissions: input.permissions,
        expiresAt: input.expiresAt,
        rateLimit: input.rateLimit || 100,
        createdBy: input.createdBy,
      },
      include: {
        city: true,
      },
    })

    return {
      apiKey: this.toApiKeyInfo(apiKey),
      rawKey, // 只在創建時返回
    }
  }

  /**
   * 驗證 API Key
   */
  async validateApiKey(rawKey: string): Promise<ValidateApiKeyResult> {
    if (!rawKey || !rawKey.startsWith(this.KEY_PREFIX)) {
      return { valid: false, error: 'Invalid API key format', errorCode: 'INVALID_KEY' }
    }

    const hashedKey = this.hashKey(rawKey)

    const apiKey = await prisma.n8nApiKey.findUnique({
      where: { key: hashedKey },
      include: { city: true },
    })

    if (!apiKey) {
      return { valid: false, error: 'Invalid API key', errorCode: 'INVALID_KEY' }
    }

    if (!apiKey.isActive) {
      return { valid: false, error: 'API key is disabled', errorCode: 'DISABLED' }
    }

    if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
      return { valid: false, error: 'API key has expired', errorCode: 'EXPIRED' }
    }

    // 檢查速率限制
    const isRateLimited = await this.checkRateLimit(apiKey.id, apiKey.rateLimit)
    if (isRateLimited) {
      return { valid: false, error: 'Rate limit exceeded', errorCode: 'RATE_LIMITED' }
    }

    // 更新使用統計（異步，不阻塞）
    this.updateUsageStats(apiKey.id).catch(console.error)

    return {
      valid: true,
      apiKey: this.toApiKeyInfo(apiKey)
    }
  }

  /**
   * 檢查權限
   */
  hasPermission(apiKey: N8nApiKeyInfo, requiredPermission: N8nPermission): boolean {
    return apiKey.permissions.includes('*') ||
           apiKey.permissions.includes(requiredPermission)
  }

  /**
   * 檢查速率限制
   */
  private async checkRateLimit(apiKeyId: string, limit: number): Promise<boolean> {
    const windowStart = new Date(Date.now() - 60000) // 1 分鐘窗口

    const count = await prisma.n8nApiCall.count({
      where: {
        apiKeyId,
        timestamp: { gte: windowStart },
      },
    })

    return count >= limit
  }

  /**
   * 更新使用統計
   */
  private async updateUsageStats(apiKeyId: string): Promise<void> {
    await prisma.n8nApiKey.update({
      where: { id: apiKeyId },
      data: {
        lastUsedAt: new Date(),
        usageCount: { increment: 1 },
      },
    })
  }

  /**
   * Hash API Key
   */
  private hashKey(key: string): string {
    return createHash('sha256').update(key).digest('hex')
  }

  /**
   * 列出 API Keys
   */
  async listApiKeys(options: {
    cityCode?: string
    isActive?: boolean
    page?: number
    pageSize?: number
  }): Promise<{ items: N8nApiKeyInfo[]; total: number }> {
    const { cityCode, isActive, page = 1, pageSize = 20 } = options

    const where: any = {}
    if (cityCode) where.cityCode = cityCode
    if (isActive !== undefined) where.isActive = isActive

    const [items, total] = await Promise.all([
      prisma.n8nApiKey.findMany({
        where,
        include: { city: true },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.n8nApiKey.count({ where }),
    ])

    return {
      items: items.map(this.toApiKeyInfo),
      total,
    }
  }

  /**
   * 撤銷 API Key
   */
  async revokeApiKey(id: string, revokedBy: string): Promise<void> {
    await prisma.n8nApiKey.update({
      where: { id },
      data: {
        isActive: false,
        updatedAt: new Date(),
      },
    })
  }

  /**
   * 刪除 API Key
   */
  async deleteApiKey(id: string): Promise<void> {
    await prisma.n8nApiKey.delete({
      where: { id },
    })
  }

  /**
   * 轉換為 API Key Info
   */
  private toApiKeyInfo(apiKey: any): N8nApiKeyInfo {
    return {
      id: apiKey.id,
      keyPrefix: apiKey.keyPrefix,
      name: apiKey.name,
      cityCode: apiKey.cityCode,
      cityName: apiKey.city?.name || apiKey.cityCode,
      permissions: apiKey.permissions as N8nPermission[],
      isActive: apiKey.isActive,
      expiresAt: apiKey.expiresAt,
      lastUsedAt: apiKey.lastUsedAt,
      usageCount: apiKey.usageCount,
      rateLimit: apiKey.rateLimit,
      createdAt: apiKey.createdAt,
      createdBy: apiKey.createdBy,
    }
  }
}

export const n8nApiKeyService = new N8nApiKeyService()
```

### 3.2 文件服務

```typescript
// lib/services/n8n/n8nDocumentService.ts

import { prisma } from '@/lib/prisma'
import { blobStorageService } from '@/lib/services/blobStorageService'
import { documentProcessingService } from '@/lib/services/documentProcessingService'
import { n8nWebhookService } from './n8nWebhookService'
import {
  N8nDocumentSubmitRequest,
  N8nDocumentResponse,
  N8nDocumentStatusResponse,
  N8nDocumentResultResponse,
} from '@/types/n8n'

export class N8nDocumentService {
  /**
   * 提交文件處理
   */
  async submitDocument(
    request: N8nDocumentSubmitRequest,
    apiKeyId: string,
    traceId: string
  ): Promise<N8nDocumentResponse> {
    const timestamp = new Date().toISOString()

    try {
      // 1. 驗證文件大小 (最大 50MB)
      const maxSize = 50 * 1024 * 1024
      if (request.fileSize > maxSize) {
        return {
          success: false,
          message: `File size exceeds maximum allowed (${maxSize} bytes)`,
          traceId,
          timestamp,
        }
      }

      // 2. 驗證 MIME 類型
      const allowedTypes = [
        'application/pdf',
        'image/jpeg',
        'image/png',
        'image/tiff',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel',
      ]
      if (!allowedTypes.includes(request.mimeType)) {
        return {
          success: false,
          message: `Unsupported file type: ${request.mimeType}`,
          traceId,
          timestamp,
        }
      }

      // 3. 解碼文件內容
      const fileBuffer = Buffer.from(request.fileContent, 'base64')

      // 4. 上傳到 Blob Storage
      const blobUrl = await blobStorageService.uploadDocument(
        fileBuffer,
        request.fileName,
        request.mimeType,
        {
          source: 'n8n',
          workflowId: request.workflowId,
          workflowExecutionId: request.workflowExecutionId,
          correlationId: request.correlationId,
          traceId,
        }
      )

      // 5. 創建文件記錄
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
            workflowExecutionId: request.workflowExecutionId,
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
          metadata: request.metadata || {},
        },
      })

      // 6. 觸發處理流程
      await documentProcessingService.startProcessing(document.id)

      // 7. 發送接收確認回調
      if (request.callbackUrl) {
        await n8nWebhookService.sendEvent({
          eventType: 'DOCUMENT_RECEIVED',
          documentId: document.id,
          webhookUrl: request.callbackUrl,
          cityCode: request.cityCode,
          payload: {
            documentId: document.id,
            fileName: request.fileName,
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
        timestamp,
      }
    } catch (error) {
      console.error('Failed to submit document:', error)
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
        traceId,
        timestamp,
      }
    }
  }

  /**
   * 查詢處理狀態
   */
  async getDocumentStatus(
    documentId: string,
    cityCode: string
  ): Promise<N8nDocumentStatusResponse | null> {
    const document = await prisma.document.findFirst({
      where: {
        id: documentId,
        cityCode, // 確保城市隔離
      },
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

    const progress = this.calculateProgress(document.status)
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

  /**
   * 獲取處理結果
   */
  async getDocumentResult(
    documentId: string,
    cityCode: string
  ): Promise<N8nDocumentResultResponse | null> {
    const document = await prisma.document.findFirst({
      where: {
        id: documentId,
        cityCode,
      },
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
      extractedData: document.extractionResult?.data as Record<string, unknown>,
      confidenceScore: document.extractionResult?.confidenceScore,
      forwarderCode: document.forwarderCode,
      forwarderName: document.forwarder?.name,
      reviewStatus: document.reviewStatus,
      processingDuration: document.processingDuration,
      completedAt: document.completedAt,
    }
  }

  /**
   * 批次查詢多個文件狀態
   */
  async getDocumentStatuses(
    documentIds: string[],
    cityCode: string
  ): Promise<N8nDocumentStatusResponse[]> {
    const documents = await prisma.document.findMany({
      where: {
        id: { in: documentIds },
        cityCode,
      },
    })

    return documents.map(doc => ({
      documentId: doc.id,
      status: doc.status,
      progress: this.calculateProgress(doc.status),
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    }))
  }

  /**
   * 計算處理進度
   */
  private calculateProgress(status: string): number {
    const progressMap: Record<string, number> = {
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

  /**
   * 預估完成時間
   */
  private async estimateCompletionTime(document: any): Promise<Date | undefined> {
    const terminalStatuses = ['COMPLETED', 'FAILED', 'REJECTED', 'APPROVED']
    if (terminalStatuses.includes(document.status)) {
      return undefined
    }

    // 獲取同城市的平均處理時間
    const avgDuration = await prisma.document.aggregate({
      where: {
        status: 'COMPLETED',
        cityCode: document.cityCode,
        completedAt: { not: null },
        processingDuration: { not: null },
      },
      _avg: {
        processingDuration: true,
      },
    })

    const avgMs = avgDuration._avg.processingDuration || 60000
    const elapsedMs = Date.now() - document.createdAt.getTime()
    const remainingMs = Math.max(avgMs - elapsedMs, 5000) // 至少 5 秒

    return new Date(Date.now() + remainingMs)
  }
}

export const n8nDocumentService = new N8nDocumentService()
```

### 3.3 Webhook 服務

```typescript
// lib/services/n8n/n8nWebhookService.ts

import { prisma } from '@/lib/prisma'
import { webhookConfigService } from './webhookConfigService'
import {
  SendEventInput,
  WebhookPayload,
  WebhookDeliveryResult,
  N8nEventType
} from '@/types/n8n'

export class N8nWebhookService {
  private readonly retryDelays = [1000, 5000, 30000] // 1秒, 5秒, 30秒
  private readonly defaultTimeout = 30000 // 30 秒

  /**
   * 發送事件
   */
  async sendEvent(input: SendEventInput): Promise<WebhookDeliveryResult> {
    // 創建事件記錄
    const event = await prisma.n8nWebhookEvent.create({
      data: {
        eventType: input.eventType as N8nEventType,
        documentId: input.documentId,
        workflowExecutionId: input.workflowExecutionId,
        webhookUrl: input.webhookUrl,
        cityCode: input.cityCode,
        requestPayload: input.payload,
        status: 'PENDING',
      },
    })

    // 立即嘗試發送
    return this.deliverWebhook(event.id)
  }

  /**
   * 發送 Webhook
   */
  async deliverWebhook(eventId: string): Promise<WebhookDeliveryResult> {
    const event = await prisma.n8nWebhookEvent.findUnique({
      where: { id: eventId },
    })

    if (!event || event.status === 'SUCCESS' || event.status === 'EXHAUSTED') {
      return {
        success: false,
        eventId,
        status: event?.status || 'NOT_FOUND',
        error: 'Event not found or already completed',
      }
    }

    // 更新狀態為發送中
    await prisma.n8nWebhookEvent.update({
      where: { id: eventId },
      data: { status: 'SENDING' },
    })

    const traceId = this.generateTraceId()
    const startTime = Date.now()

    const payload: WebhookPayload = {
      event: event.eventType,
      timestamp: new Date().toISOString(),
      data: event.requestPayload as Record<string, unknown>,
      metadata: {
        traceId,
        retryCount: event.attemptCount,
        cityCode: event.cityCode,
      },
    }

    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(
        () => controller.abort(),
        this.defaultTimeout
      )

      const response = await fetch(event.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Event': event.eventType,
          'X-Trace-Id': traceId,
          'X-Retry-Count': event.attemptCount.toString(),
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      const durationMs = Date.now() - startTime
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
            durationMs,
          },
        })

        return {
          success: true,
          eventId,
          status: 'SUCCESS',
          responseCode: response.status,
          responseTime: durationMs,
        }
      } else {
        throw new Error(`HTTP ${response.status}: ${responseBody}`)
      }
    } catch (error) {
      const durationMs = Date.now() - startTime
      return this.handleDeliveryError(event, error, durationMs)
    }
  }

  /**
   * 處理發送錯誤
   */
  private async handleDeliveryError(
    event: any,
    error: unknown,
    durationMs: number
  ): Promise<WebhookDeliveryResult> {
    const newAttemptCount = event.attemptCount + 1
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    const isTimeout = error instanceof Error && error.name === 'AbortError'

    if (newAttemptCount >= event.maxAttempts) {
      // 重試次數耗盡
      await prisma.n8nWebhookEvent.update({
        where: { id: event.id },
        data: {
          status: 'EXHAUSTED',
          errorMessage,
          attemptCount: newAttemptCount,
          lastAttemptAt: new Date(),
          durationMs,
        },
      })

      return {
        success: false,
        eventId: event.id,
        status: 'EXHAUSTED',
        error: errorMessage,
        responseTime: durationMs,
      }
    }

    // 設置下次重試時間
    const nextRetryDelay = this.retryDelays[newAttemptCount - 1] || 30000
    const nextRetryAt = new Date(Date.now() + nextRetryDelay)

    await prisma.n8nWebhookEvent.update({
      where: { id: event.id },
      data: {
        status: 'RETRYING',
        errorMessage,
        attemptCount: newAttemptCount,
        lastAttemptAt: new Date(),
        nextRetryAt,
        durationMs,
      },
    })

    // 排程重試
    setTimeout(() => {
      this.deliverWebhook(event.id).catch(console.error)
    }, nextRetryDelay)

    return {
      success: false,
      eventId: event.id,
      status: 'RETRYING',
      error: errorMessage,
      responseTime: durationMs,
      retryScheduled: nextRetryAt,
    }
  }

  /**
   * 處理待重試的 Webhooks（用於應用重啟後恢復）
   */
  async processRetryQueue(): Promise<number> {
    const pendingRetries = await prisma.n8nWebhookEvent.findMany({
      where: {
        status: 'RETRYING',
        nextRetryAt: { lte: new Date() },
      },
      take: 100, // 批次處理
    })

    for (const event of pendingRetries) {
      await this.deliverWebhook(event.id)
    }

    return pendingRetries.length
  }

  /**
   * 獲取事件發送統計
   */
  async getDeliveryStats(options: {
    cityCode?: string
    startDate?: Date
    endDate?: Date
  }): Promise<{
    total: number
    success: number
    failed: number
    pending: number
    successRate: number
    avgResponseTime: number
  }> {
    const { cityCode, startDate, endDate } = options

    const where: any = {}
    if (cityCode) where.cityCode = cityCode
    if (startDate || endDate) {
      where.createdAt = {}
      if (startDate) where.createdAt.gte = startDate
      if (endDate) where.createdAt.lte = endDate
    }

    const [counts, avgDuration] = await Promise.all([
      prisma.n8nWebhookEvent.groupBy({
        by: ['status'],
        where,
        _count: true,
      }),
      prisma.n8nWebhookEvent.aggregate({
        where: {
          ...where,
          status: 'SUCCESS',
          durationMs: { not: null },
        },
        _avg: { durationMs: true },
      }),
    ])

    const statusMap: Record<string, number> = {}
    counts.forEach(c => { statusMap[c.status] = c._count })

    const total = Object.values(statusMap).reduce((a, b) => a + b, 0)
    const success = statusMap['SUCCESS'] || 0
    const failed = (statusMap['FAILED'] || 0) + (statusMap['EXHAUSTED'] || 0)
    const pending = (statusMap['PENDING'] || 0) +
                   (statusMap['SENDING'] || 0) +
                   (statusMap['RETRYING'] || 0)

    return {
      total,
      success,
      failed,
      pending,
      successRate: total > 0 ? (success / total) * 100 : 0,
      avgResponseTime: avgDuration._avg.durationMs || 0,
    }
  }

  /**
   * 生成 Trace ID
   */
  private generateTraceId(): string {
    const timestamp = Date.now().toString(36)
    const random = Math.random().toString(36).substring(2, 11)
    return `wh_${timestamp}_${random}`
  }
}

export const n8nWebhookService = new N8nWebhookService()
```

---

## 4. API 路由

### 4.1 API 認證中間件

```typescript
// lib/middleware/n8nApiMiddleware.ts

import { NextRequest } from 'next/server'
import { n8nApiKeyService } from '@/lib/services/n8n/n8nApiKeyService'
import { prisma } from '@/lib/prisma'
import { N8nApiKeyInfo, N8nPermission, N8nErrorCode } from '@/types/n8n'

export interface N8nApiContext {
  authorized: boolean
  apiKey?: N8nApiKeyInfo
  traceId: string
  statusCode: number
  errorCode?: N8nErrorCode
  errorMessage?: string
}

export async function n8nApiMiddleware(
  request: NextRequest,
  requiredPermission: N8nPermission
): Promise<N8nApiContext> {
  const startTime = Date.now()
  const traceId = generateTraceId()

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
    await recordApiCall(request, null, 401, startTime, traceId, 'Missing API key')
    return {
      authorized: false,
      traceId,
      statusCode: 401,
      errorCode: 'MISSING_API_KEY',
      errorMessage: 'API key is required. Provide via Authorization header or X-API-Key header.',
    }
  }

  // 驗證 API Key
  const validationResult = await n8nApiKeyService.validateApiKey(rawKey)

  if (!validationResult.valid) {
    await recordApiCall(request, null, 401, startTime, traceId, validationResult.error)

    const errorCodeMap: Record<string, N8nErrorCode> = {
      INVALID_KEY: 'INVALID_API_KEY',
      DISABLED: 'DISABLED_API_KEY',
      EXPIRED: 'EXPIRED_API_KEY',
      RATE_LIMITED: 'RATE_LIMITED',
    }

    return {
      authorized: false,
      traceId,
      statusCode: validationResult.errorCode === 'RATE_LIMITED' ? 429 : 401,
      errorCode: errorCodeMap[validationResult.errorCode || ''] || 'INVALID_API_KEY',
      errorMessage: validationResult.error,
    }
  }

  const apiKey = validationResult.apiKey!

  // 檢查權限
  if (!n8nApiKeyService.hasPermission(apiKey, requiredPermission)) {
    await recordApiCall(request, apiKey.id, 403, startTime, traceId, 'Insufficient permissions')

    return {
      authorized: false,
      apiKey,
      traceId,
      statusCode: 403,
      errorCode: 'INSUFFICIENT_PERMISSIONS',
      errorMessage: `Missing required permission: ${requiredPermission}`,
    }
  }

  return {
    authorized: true,
    apiKey,
    traceId,
    statusCode: 200,
  }
}

function generateTraceId(): string {
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).substring(2, 11)
  return `n8n_${timestamp}_${random}`
}

async function recordApiCall(
  request: NextRequest,
  apiKeyId: string | null,
  statusCode: number,
  startTime: number,
  traceId: string,
  errorMessage?: string
): Promise<void> {
  if (!apiKeyId) return

  const durationMs = Date.now() - startTime

  try {
    await prisma.n8nApiCall.create({
      data: {
        apiKeyId,
        endpoint: new URL(request.url).pathname,
        method: request.method,
        statusCode,
        durationMs,
        traceId,
        ipAddress: request.headers.get('x-forwarded-for') ||
                   request.headers.get('x-real-ip') ||
                   'unknown',
        userAgent: request.headers.get('user-agent'),
        responseBody: errorMessage ? { error: errorMessage } : undefined,
      },
    })
  } catch (error) {
    console.error('Failed to record API call:', error)
  }
}
```

### 4.2 文件提交 API

```typescript
// app/api/n8n/documents/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { n8nDocumentService } from '@/lib/services/n8n/n8nDocumentService'
import { n8nApiMiddleware } from '@/lib/middleware/n8nApiMiddleware'
import { z } from 'zod'

const submitDocumentSchema = z.object({
  fileName: z.string().min(1).max(255),
  fileContent: z.string().min(1), // Base64
  mimeType: z.string().min(1),
  fileSize: z.number().positive().max(50 * 1024 * 1024), // 50MB max
  workflowId: z.string().optional(),
  workflowName: z.string().optional(),
  workflowExecutionId: z.string().optional(),
  triggerSource: z.enum(['sharepoint', 'outlook', 'manual', 'api']).optional(),
  cityCode: z.string().min(1),
  forwarderCode: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
  callbackUrl: z.string().url().optional(),
  correlationId: z.string().optional(),
})

export async function POST(request: NextRequest) {
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
        traceId: authResult.traceId,
        timestamp: new Date().toISOString(),
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
          traceId: authResult.traceId,
          timestamp: new Date().toISOString(),
        },
        { status: 403 }
      )
    }

    const result = await n8nDocumentService.submitDocument(
      validatedData,
      authResult.apiKey!.id,
      authResult.traceId
    )

    return NextResponse.json(result, {
      status: result.success ? 201 : 400
    })
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
          traceId: authResult.traceId,
          timestamp: new Date().toISOString(),
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
        traceId: authResult.traceId,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}
```

### 4.3 文件狀態查詢 API

```typescript
// app/api/n8n/documents/[id]/status/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { n8nDocumentService } from '@/lib/services/n8n/n8nDocumentService'
import { n8nApiMiddleware } from '@/lib/middleware/n8nApiMiddleware'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const authResult = await n8nApiMiddleware(request, 'documents:read')

  if (!authResult.authorized) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: authResult.errorCode,
          message: authResult.errorMessage,
        },
        traceId: authResult.traceId,
        timestamp: new Date().toISOString(),
      },
      { status: authResult.statusCode }
    )
  }

  try {
    const status = await n8nDocumentService.getDocumentStatus(
      params.id,
      authResult.apiKey!.cityCode
    )

    if (!status) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Document not found',
          },
          traceId: authResult.traceId,
          timestamp: new Date().toISOString(),
        },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: status,
      traceId: authResult.traceId,
      timestamp: new Date().toISOString(),
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
        traceId: authResult.traceId,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}
```

### 4.4 文件結果查詢 API

```typescript
// app/api/n8n/documents/[id]/result/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { n8nDocumentService } from '@/lib/services/n8n/n8nDocumentService'
import { n8nApiMiddleware } from '@/lib/middleware/n8nApiMiddleware'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const authResult = await n8nApiMiddleware(request, 'documents:read')

  if (!authResult.authorized) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: authResult.errorCode,
          message: authResult.errorMessage,
        },
        traceId: authResult.traceId,
        timestamp: new Date().toISOString(),
      },
      { status: authResult.statusCode }
    )
  }

  try {
    const result = await n8nDocumentService.getDocumentResult(
      params.id,
      authResult.apiKey!.cityCode
    )

    if (!result) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Document not found',
          },
          traceId: authResult.traceId,
          timestamp: new Date().toISOString(),
        },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: result,
      traceId: authResult.traceId,
      timestamp: new Date().toISOString(),
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
        traceId: authResult.traceId,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}
```

### 4.5 Webhook 接收 API

```typescript
// app/api/n8n/webhook/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { n8nApiMiddleware } from '@/lib/middleware/n8nApiMiddleware'
import { z } from 'zod'

const webhookEventSchema = z.object({
  event: z.enum([
    'workflow.started',
    'workflow.completed',
    'workflow.failed',
    'workflow.progress',
    'document.status_changed',
  ]),
  workflowExecutionId: z.string().optional(),
  documentId: z.string().optional(),
  data: z.record(z.unknown()),
  timestamp: z.string().datetime(),
})

export async function POST(request: NextRequest) {
  const authResult = await n8nApiMiddleware(request, 'webhook:receive')

  if (!authResult.authorized) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: authResult.errorCode,
          message: authResult.errorMessage,
        },
        traceId: authResult.traceId,
        timestamp: new Date().toISOString(),
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
        apiKeyId: authResult.apiKey!.id,
        eventType: validatedData.event,
        workflowExecutionId: validatedData.workflowExecutionId,
        documentId: validatedData.documentId,
        payload: validatedData.data,
        headers: Object.fromEntries(request.headers.entries()),
        traceId: authResult.traceId,
        ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
        receivedAt: new Date(validatedData.timestamp),
      },
    })

    // 根據事件類型處理
    await processWebhookEvent(validatedData)

    return NextResponse.json({
      success: true,
      message: 'Webhook received and processed',
      traceId: authResult.traceId,
      timestamp: new Date().toISOString(),
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
          traceId: authResult.traceId,
          timestamp: new Date().toISOString(),
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
        traceId: authResult.traceId,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}

async function processWebhookEvent(
  data: z.infer<typeof webhookEventSchema>
): Promise<void> {
  switch (data.event) {
    case 'workflow.started':
      await handleWorkflowStarted(data)
      break
    case 'workflow.completed':
      await handleWorkflowCompleted(data)
      break
    case 'workflow.failed':
      await handleWorkflowFailed(data)
      break
    case 'workflow.progress':
      await handleWorkflowProgress(data)
      break
    case 'document.status_changed':
      await handleDocumentStatusChanged(data)
      break
  }
}

async function handleWorkflowStarted(data: any): Promise<void> {
  if (data.workflowExecutionId) {
    await prisma.workflowExecution.upsert({
      where: { n8nExecutionId: data.workflowExecutionId },
      update: {
        status: 'RUNNING',
        startedAt: new Date(data.timestamp),
        currentStep: data.data.currentStep,
      },
      create: {
        n8nExecutionId: data.workflowExecutionId,
        workflowId: data.data.workflowId,
        workflowName: data.data.workflowName || 'Unknown Workflow',
        status: 'RUNNING',
        startedAt: new Date(data.timestamp),
        triggerType: data.data.triggerType || 'WEBHOOK',
        cityCode: data.data.cityCode || 'DEFAULT',
      },
    })
  }
}

async function handleWorkflowCompleted(data: any): Promise<void> {
  if (data.workflowExecutionId) {
    await prisma.workflowExecution.updateMany({
      where: { n8nExecutionId: data.workflowExecutionId },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(data.timestamp),
        progress: 100,
        result: data.data,
      },
    })
  }
}

async function handleWorkflowFailed(data: any): Promise<void> {
  if (data.workflowExecutionId) {
    await prisma.workflowExecution.updateMany({
      where: { n8nExecutionId: data.workflowExecutionId },
      data: {
        status: 'FAILED',
        completedAt: new Date(data.timestamp),
        errorDetails: data.data,
      },
    })
  }
}

async function handleWorkflowProgress(data: any): Promise<void> {
  if (data.workflowExecutionId) {
    await prisma.workflowExecution.updateMany({
      where: { n8nExecutionId: data.workflowExecutionId },
      data: {
        progress: data.data.progress || 0,
        currentStep: data.data.currentStep,
      },
    })
  }
}

async function handleDocumentStatusChanged(data: any): Promise<void> {
  if (data.documentId && data.data.status) {
    await prisma.document.updateMany({
      where: { id: data.documentId },
      data: {
        status: data.data.status,
        updatedAt: new Date(data.timestamp),
      },
    })
  }
}
```

---

## 5. 前端組件

### 5.1 API Key 管理組件

```typescript
// components/admin/n8n/ApiKeyManagement.tsx

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
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Typography,
  Box,
  Tooltip,
} from '@mui/material'
import {
  Add,
  Delete,
  ContentCopy,
  Visibility,
  VisibilityOff,
  Block,
} from '@mui/icons-material'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { formatDistanceToNow } from 'date-fns'
import { zhTW } from 'date-fns/locale'

interface ApiKeyManagementProps {
  cityCode?: string
}

export function ApiKeyManagement({ cityCode }: ApiKeyManagementProps) {
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [newKeyVisible, setNewKeyVisible] = useState(false)
  const [createdKey, setCreatedKey] = useState<string | null>(null)
  const queryClient = useQueryClient()

  // 獲取 API Keys 列表
  const { data: apiKeys, isLoading } = useQuery({
    queryKey: ['n8n-api-keys', cityCode],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (cityCode) params.set('cityCode', cityCode)
      const res = await fetch(`/api/admin/n8n/api-keys?${params}`)
      if (!res.ok) throw new Error('Failed to fetch API keys')
      return res.json()
    },
  })

  // 創建 API Key
  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch('/api/admin/n8n/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error('Failed to create API key')
      return res.json()
    },
    onSuccess: (data) => {
      setCreatedKey(data.data.rawKey)
      setNewKeyVisible(true)
      queryClient.invalidateQueries({ queryKey: ['n8n-api-keys'] })
    },
  })

  // 撤銷 API Key
  const revokeMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/n8n/api-keys/${id}/revoke`, {
        method: 'POST',
      })
      if (!res.ok) throw new Error('Failed to revoke API key')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['n8n-api-keys'] })
    },
  })

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  return (
    <Card>
      <CardHeader
        title="n8n API Keys"
        action={
          <Button
            startIcon={<Add />}
            variant="contained"
            onClick={() => setCreateDialogOpen(true)}
          >
            建立 API Key
          </Button>
        }
      />
      <CardContent>
        <TableContainer component={Paper} variant="outlined">
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>名稱</TableCell>
                <TableCell>Key Prefix</TableCell>
                <TableCell>城市</TableCell>
                <TableCell>權限</TableCell>
                <TableCell>狀態</TableCell>
                <TableCell>最後使用</TableCell>
                <TableCell>使用次數</TableCell>
                <TableCell align="right">操作</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {apiKeys?.data?.map((key: any) => (
                <TableRow key={key.id}>
                  <TableCell>{key.name}</TableCell>
                  <TableCell>
                    <Typography variant="body2" fontFamily="monospace">
                      {key.keyPrefix}...
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip label={key.cityName} size="small" />
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                      {key.permissions.map((perm: string) => (
                        <Chip
                          key={perm}
                          label={perm}
                          size="small"
                          variant="outlined"
                        />
                      ))}
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={key.isActive ? '啟用' : '停用'}
                      color={key.isActive ? 'success' : 'default'}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    {key.lastUsedAt
                      ? formatDistanceToNow(new Date(key.lastUsedAt), {
                          addSuffix: true,
                          locale: zhTW,
                        })
                      : '從未使用'}
                  </TableCell>
                  <TableCell>{key.usageCount.toLocaleString()}</TableCell>
                  <TableCell align="right">
                    {key.isActive && (
                      <Tooltip title="撤銷">
                        <IconButton
                          onClick={() => revokeMutation.mutate(key.id)}
                          color="error"
                          size="small"
                        >
                          <Block />
                        </IconButton>
                      </Tooltip>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        {/* 新建 Key 對話框 */}
        <CreateApiKeyDialog
          open={createDialogOpen}
          onClose={() => setCreateDialogOpen(false)}
          onSubmit={(data) => createMutation.mutate(data)}
          cityCode={cityCode}
        />

        {/* 顯示新建的 Key */}
        <Dialog open={!!createdKey} maxWidth="sm" fullWidth>
          <DialogTitle>API Key 已建立</DialogTitle>
          <DialogContent>
            <Alert severity="warning" sx={{ mb: 2 }}>
              請立即複製此 API Key，關閉後將無法再次查看！
            </Alert>
            <Box
              sx={{
                p: 2,
                bgcolor: 'grey.100',
                borderRadius: 1,
                fontFamily: 'monospace',
                display: 'flex',
                alignItems: 'center',
                gap: 1,
              }}
            >
              <Typography sx={{ flex: 1, wordBreak: 'break-all' }}>
                {newKeyVisible ? createdKey : '••••••••••••••••••••••••••••••••'}
              </Typography>
              <IconButton onClick={() => setNewKeyVisible(!newKeyVisible)}>
                {newKeyVisible ? <VisibilityOff /> : <Visibility />}
              </IconButton>
              <IconButton onClick={() => copyToClipboard(createdKey!)}>
                <ContentCopy />
              </IconButton>
            </Box>
          </DialogContent>
          <DialogActions>
            <Button
              onClick={() => {
                setCreatedKey(null)
                setNewKeyVisible(false)
              }}
            >
              我已複製，關閉
            </Button>
          </DialogActions>
        </Dialog>
      </CardContent>
    </Card>
  )
}
```

---

## 6. 測試計畫

### 6.1 單元測試

```typescript
// __tests__/services/n8n/n8nApiKeyService.test.ts

import { n8nApiKeyService } from '@/lib/services/n8n/n8nApiKeyService'
import { prismaMock } from '@/lib/__mocks__/prisma'

describe('N8nApiKeyService', () => {
  describe('createApiKey', () => {
    it('should create API key with correct format', async () => {
      prismaMock.n8nApiKey.create.mockResolvedValue({
        id: 'key-1',
        key: 'hashed',
        keyPrefix: 'n8n_abcd1234',
        name: 'Test Key',
        cityCode: 'TPE',
        permissions: ['documents:read'],
        isActive: true,
        usageCount: 0,
        rateLimit: 100,
        createdBy: 'admin',
        createdAt: new Date(),
        updatedAt: new Date(),
        city: { code: 'TPE', name: 'Taipei' },
      } as any)

      const result = await n8nApiKeyService.createApiKey({
        name: 'Test Key',
        cityCode: 'TPE',
        permissions: ['documents:read'],
        createdBy: 'admin',
      })

      expect(result.rawKey).toMatch(/^n8n_[a-f0-9]{64}$/)
      expect(result.apiKey.keyPrefix).toHaveLength(12)
    })

    it('should hash API key before storing', async () => {
      let storedKey: string | undefined

      prismaMock.n8nApiKey.create.mockImplementation(async (args: any) => {
        storedKey = args.data.key
        return {
          id: 'key-1',
          ...args.data,
          city: { code: 'TPE', name: 'Taipei' },
        }
      })

      const result = await n8nApiKeyService.createApiKey({
        name: 'Test',
        cityCode: 'TPE',
        permissions: ['*'],
        createdBy: 'admin',
      })

      expect(storedKey).not.toEqual(result.rawKey)
      expect(storedKey).toHaveLength(64) // SHA-256 hex
    })
  })

  describe('validateApiKey', () => {
    it('should return valid for active key', async () => {
      prismaMock.n8nApiKey.findUnique.mockResolvedValue({
        id: 'key-1',
        isActive: true,
        expiresAt: null,
        rateLimit: 100,
        city: { code: 'TPE', name: 'Taipei' },
      } as any)

      prismaMock.n8nApiCall.count.mockResolvedValue(0)
      prismaMock.n8nApiKey.update.mockResolvedValue({} as any)

      const result = await n8nApiKeyService.validateApiKey('n8n_validkey123')

      expect(result.valid).toBe(true)
    })

    it('should reject invalid key format', async () => {
      const result = await n8nApiKeyService.validateApiKey('invalid-key')

      expect(result.valid).toBe(false)
      expect(result.errorCode).toBe('INVALID_KEY')
    })

    it('should reject rate limited key', async () => {
      prismaMock.n8nApiKey.findUnique.mockResolvedValue({
        id: 'key-1',
        isActive: true,
        rateLimit: 10,
      } as any)

      prismaMock.n8nApiCall.count.mockResolvedValue(15)

      const result = await n8nApiKeyService.validateApiKey('n8n_validkey')

      expect(result.valid).toBe(false)
      expect(result.errorCode).toBe('RATE_LIMITED')
    })
  })

  describe('hasPermission', () => {
    it('should return true for exact match', () => {
      const apiKey = { permissions: ['documents:read', 'documents:write'] } as any
      expect(n8nApiKeyService.hasPermission(apiKey, 'documents:read')).toBe(true)
    })

    it('should return true for wildcard', () => {
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

### 6.2 API 整合測試

```typescript
// __tests__/api/n8n/documents.test.ts

import { testApiHandler } from 'next-test-api-route-handler'
import * as appHandler from '@/app/api/n8n/documents/route'

describe('POST /api/n8n/documents', () => {
  it('should reject request without API key', async () => {
    await testApiHandler({
      appHandler,
      test: async ({ fetch }) => {
        const res = await fetch({
          method: 'POST',
          body: JSON.stringify({}),
        })

        expect(res.status).toBe(401)
        const data = await res.json()
        expect(data.error.code).toBe('MISSING_API_KEY')
      },
    })
  })

  it('should validate request body', async () => {
    // Mock valid API key...

    await testApiHandler({
      appHandler,
      test: async ({ fetch }) => {
        const res = await fetch({
          method: 'POST',
          headers: {
            'Authorization': 'Bearer n8n_validkey',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            fileName: '', // Invalid: empty
          }),
        })

        expect(res.status).toBe(400)
        const data = await res.json()
        expect(data.error.code).toBe('VALIDATION_ERROR')
      },
    })
  })

  it('should enforce city access', async () => {
    // API key for TPE, but request for KHH
    await testApiHandler({
      appHandler,
      test: async ({ fetch }) => {
        const res = await fetch({
          method: 'POST',
          headers: {
            'Authorization': 'Bearer n8n_tpe_key',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            fileName: 'test.pdf',
            fileContent: 'dGVzdA==',
            mimeType: 'application/pdf',
            fileSize: 4,
            cityCode: 'KHH', // Different city
          }),
        })

        expect(res.status).toBe(403)
        const data = await res.json()
        expect(data.error.code).toBe('CITY_MISMATCH')
      },
    })
  })
})
```

### 6.3 E2E 測試

```typescript
// e2e/n8n-api.spec.ts

import { test, expect } from '@playwright/test'

test.describe('n8n API Integration', () => {
  const API_KEY = process.env.TEST_N8N_API_KEY!

  test('complete document processing flow', async ({ request }) => {
    // 1. Submit document
    const submitRes = await request.post('/api/n8n/documents', {
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
      },
      data: {
        fileName: 'test-invoice.pdf',
        fileContent: Buffer.from('test content').toString('base64'),
        mimeType: 'application/pdf',
        fileSize: 12,
        cityCode: 'TPE',
        correlationId: 'test-123',
      },
    })

    expect(submitRes.ok()).toBe(true)
    const submitData = await submitRes.json()
    expect(submitData.success).toBe(true)
    expect(submitData.documentId).toBeDefined()

    const documentId = submitData.documentId

    // 2. Check status
    const statusRes = await request.get(
      `/api/n8n/documents/${documentId}/status`,
      {
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
        },
      }
    )

    expect(statusRes.ok()).toBe(true)
    const statusData = await statusRes.json()
    expect(statusData.data.documentId).toBe(documentId)
  })

  test('rate limiting works correctly', async ({ request }) => {
    // Make many requests quickly
    const promises = Array(150).fill(null).map(() =>
      request.get('/api/n8n/documents/test/status', {
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
        },
      })
    )

    const responses = await Promise.all(promises)
    const rateLimited = responses.filter(r => r.status() === 429)

    expect(rateLimited.length).toBeGreaterThan(0)
  })
})
```

---

## 7. 部署注意事項

### 7.1 環境變數

```env
# API Key 相關
N8N_API_KEY_PREFIX=n8n_
N8N_DEFAULT_RATE_LIMIT=100
N8N_RATE_LIMIT_WINDOW=60

# Webhook 相關
N8N_WEBHOOK_TIMEOUT=30000
N8N_WEBHOOK_MAX_RETRIES=3
N8N_WEBHOOK_RETRY_DELAYS=1000,5000,30000

# 文件處理
N8N_MAX_FILE_SIZE=52428800
N8N_ALLOWED_MIME_TYPES=application/pdf,image/jpeg,image/png
```

### 7.2 監控指標

| 指標 | 描述 | 告警閾值 |
|------|------|----------|
| `n8n_api_requests_total` | API 請求總數 | - |
| `n8n_api_errors_total` | API 錯誤總數 | >5% |
| `n8n_api_latency_ms` | API 回應時間 | p95 > 1000ms |
| `n8n_webhook_success_rate` | Webhook 發送成功率 | <95% |
| `n8n_webhook_retry_queue_size` | 重試佇列大小 | >100 |
| `n8n_rate_limit_hits` | 速率限制觸發次數 | >10/min |

### 7.3 安全考量

1. **API Key 安全**
   - 使用 SHA-256 hash 儲存
   - 支援到期時間設定
   - 支援即時撤銷
   - 記錄所有 API 調用

2. **城市隔離**
   - API Key 綁定城市
   - 所有操作驗證城市權限
   - 禁止跨城市存取

3. **速率限制**
   - 預設每分鐘 100 請求
   - 可自訂每個 API Key 的限制
   - 超過限制返回 429

---

## 8. 驗收標準對應

| AC | 描述 | 實現狀態 |
|----|------|----------|
| AC1 | n8n 專用 API 端點 | ✅ 完整實現四個端點 |
| AC2 | API Key 認證機制 | ✅ SHA-256 hash、城市綁定、審計日誌 |
| AC3 | 平台回調通知 | ✅ Webhook 服務含重試機制 |
| AC4 | 標準錯誤格式 | ✅ 統一錯誤格式含 traceId |

---

## 9. 開放問題

1. **Webhook 簽名驗證**: 是否需要為出站 Webhook 添加 HMAC 簽名？
2. **批次 API**: 是否需要支援批次提交多個文件？
3. **WebSocket 支援**: 是否需要即時推送替代輪詢？

---

## 10. 參考資料

- [n8n Webhook 文檔](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.webhook/)
- [Next.js API Routes](https://nextjs.org/docs/app/building-your-application/routing/route-handlers)
- [Prisma 最佳實踐](https://www.prisma.io/docs/guides/performance-and-optimization)
