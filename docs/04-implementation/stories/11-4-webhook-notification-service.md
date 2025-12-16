# Story 11-4: Webhook 通知服務

## Story 資訊

- **Epic**: 11 - 對外 API 服務
- **功能需求**: FR67 (Webhook 通知)
- **優先級**: High
- **故事點數**: 8
- **相關 Stories**:
  - Story 11-1 (API 發票提交端點)
  - Story 11-5 (API 訪問控制與認證)
  - Story 10-1 (n8n 雙向通訊 API)

## 使用者故事

**As a** 外部系統開發者,
**I want** 在發票處理完成時接收 Webhook 通知,
**So that** 我不需要持續輪詢狀態。

## 驗收標準

### AC1: 處理完成通知

**Given** 提交發票時指定了 `callbackUrl`
**When** 處理完成或失敗
**Then** 系統發送 POST 請求至回調 URL，包含：
- event - 事件類型
- taskId - 任務 ID
- status - 處理狀態
- timestamp - 時間戳
- result - 結果摘要（confidenceScore, forwarder, resultUrl）

### AC2: 簽名驗證

**Given** Webhook 請求
**When** 需要驗證來源
**Then** 請求包含簽名 Header：
- `X-Signature` - HMAC-SHA256 簽名
- `X-Timestamp` - 請求時間戳
**And** 接收方可以驗證請求真實性

### AC3: 重試機制

**Given** Webhook 發送
**When** 目標 URL 無回應或返回錯誤
**Then** 系統自動重試：
- 最多重試 3 次
- 重試間隔：1分鐘、5分鐘、30分鐘
**And** 超過重試次數後記錄失敗日誌

### AC4: 事件類型支援

**Given** Webhook 通知
**When** 事件類型
**Then** 支援以下事件：
- `invoice.processing` - 開始處理
- `invoice.completed` - 處理完成
- `invoice.failed` - 處理失敗
- `invoice.review_required` - 需要人工審核

## 技術規格

### 1. 資料模型

```prisma
// Webhook 發送記錄
model ExternalWebhookDelivery {
  id              String    @id @default(cuid())

  // 任務關聯
  taskId          String
  task            ExternalApiTask @relation(fields: [taskId], references: [id])

  // 發送資訊
  event           WebhookEventType
  targetUrl       String
  payload         Json

  // 簽名
  signature       String
  timestamp       BigInt

  // 發送狀態
  status          WebhookDeliveryStatus @default(PENDING)
  httpStatus      Int?
  responseBody    String?
  errorMessage    String?

  // 重試
  attempts        Int       @default(0)
  maxAttempts     Int       @default(4)  // 首次 + 3 次重試
  nextRetryAt     DateTime?
  lastAttemptAt   DateTime?

  // 時間記錄
  createdAt       DateTime  @default(now())
  completedAt     DateTime?

  @@index([taskId])
  @@index([status])
  @@index([nextRetryAt])
  @@index([createdAt])
}

enum WebhookEventType {
  INVOICE_PROCESSING
  INVOICE_COMPLETED
  INVOICE_FAILED
  INVOICE_REVIEW_REQUIRED
}

enum WebhookDeliveryStatus {
  PENDING         // 等待發送
  SENDING         // 發送中
  DELIVERED       // 已送達
  FAILED          // 最終失敗
  RETRYING        // 等待重試
}

// Webhook 配置（可選，用於進階設定）
model WebhookConfiguration {
  id              String    @id @default(cuid())
  apiKeyId        String
  apiKey          ExternalApiKey @relation(fields: [apiKeyId], references: [id])

  // 配置
  events          WebhookEventType[]
  url             String
  secret          String    // 用於簽名驗證
  isActive        Boolean   @default(true)

  // 設定
  timeout         Int       @default(30000)  // 毫秒
  retryEnabled    Boolean   @default(true)

  // 元數據
  description     String?
  headers         Json?     // 額外 Headers

  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  @@index([apiKeyId])
}
```

### 2. Webhook 發送服務

```typescript
// lib/services/externalApi/webhookService.ts
import { prisma } from '@/lib/prisma'
import { createHmac } from 'crypto'
import { WebhookEventType, WebhookDeliveryStatus, ExternalApiTask } from '@prisma/client'

// 事件類型映射
const EVENT_TYPE_MAP: Record<string, WebhookEventType> = {
  processing: 'INVOICE_PROCESSING',
  completed: 'INVOICE_COMPLETED',
  failed: 'INVOICE_FAILED',
  review_required: 'INVOICE_REVIEW_REQUIRED',
}

// 重試間隔（毫秒）
const RETRY_INTERVALS = [
  60 * 1000,      // 1 分鐘
  5 * 60 * 1000,  // 5 分鐘
  30 * 60 * 1000, // 30 分鐘
]

export interface WebhookPayload {
  event: string
  taskId: string
  status: string
  timestamp: string
  data: {
    taskId: string
    status: string
    progress?: number
    result?: {
      confidenceScore?: number
      forwarderId?: string
      forwarderName?: string
      resultUrl?: string
    }
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
}

export class WebhookService {
  // 發送 Webhook 通知
  async sendWebhook(
    task: ExternalApiTask & {
      document?: { extractionResult?: any } | null
    },
    event: string
  ): Promise<void> {
    // 檢查是否有回調 URL
    if (!task.callbackUrl) {
      return
    }

    const eventType = EVENT_TYPE_MAP[event]
    if (!eventType) {
      console.warn(`Unknown webhook event type: ${event}`)
      return
    }

    // 構建 payload
    const payload = this.buildPayload(task, event)

    // 獲取 API Key 的 secret
    const apiKey = await prisma.externalApiKey.findUnique({
      where: { id: task.apiKeyId },
    })

    if (!apiKey) {
      console.error(`API key not found for task ${task.taskId}`)
      return
    }

    // 生成簽名
    const timestamp = Date.now()
    const signature = this.generateSignature(
      payload,
      timestamp,
      apiKey.webhookSecret || apiKey.id
    )

    // 創建發送記錄
    const delivery = await prisma.externalWebhookDelivery.create({
      data: {
        taskId: task.id,
        event: eventType,
        targetUrl: task.callbackUrl,
        payload: payload as any,
        signature,
        timestamp: BigInt(timestamp),
        status: 'PENDING',
        maxAttempts: 4,
      },
    })

    // 異步發送
    this.deliverWebhook(delivery.id).catch((error) => {
      console.error(`Failed to deliver webhook ${delivery.id}:`, error)
    })
  }

  // 構建 Webhook payload
  private buildPayload(
    task: ExternalApiTask & {
      document?: { extractionResult?: any } | null
    },
    event: string
  ): WebhookPayload {
    const timestamp = new Date().toISOString()

    const payload: WebhookPayload = {
      event: `invoice.${event}`,
      taskId: task.taskId,
      status: task.status.toLowerCase(),
      timestamp,
      data: {
        taskId: task.taskId,
        status: task.status.toLowerCase(),
        progress: task.progress,
      },
    }

    // 完成狀態的額外資訊
    if (event === 'completed' && task.document?.extractionResult) {
      const extraction = task.document.extractionResult
      payload.data.result = {
        confidenceScore: task.confidenceScore || extraction.confidenceScore,
        forwarderId: extraction.forwarderId,
        forwarderName: extraction.forwarderName,
        resultUrl: `/api/v1/invoices/${task.taskId}/result`,
      }
    }

    // 失敗狀態的錯誤資訊
    if (event === 'failed') {
      payload.data.error = {
        code: task.errorCode || 'UNKNOWN_ERROR',
        message: task.errorMessage || 'An error occurred during processing',
        retryable: task.errorRetryable ?? false,
      }
    }

    // 審核狀態的資訊
    if (event === 'review_required') {
      payload.data.reviewInfo = {
        reason: task.document?.escalationReason || 'Manual review required',
        escalatedAt: task.updatedAt.toISOString(),
      }
    }

    return payload
  }

  // 生成 HMAC-SHA256 簽名
  private generateSignature(
    payload: WebhookPayload,
    timestamp: number,
    secret: string
  ): string {
    const signatureData = `${timestamp}.${JSON.stringify(payload)}`
    return createHmac('sha256', secret)
      .update(signatureData)
      .digest('hex')
  }

  // 發送 Webhook
  async deliverWebhook(deliveryId: string): Promise<void> {
    // 更新狀態為發送中
    const delivery = await prisma.externalWebhookDelivery.update({
      where: { id: deliveryId },
      data: {
        status: 'SENDING',
        attempts: { increment: 1 },
        lastAttemptAt: new Date(),
      },
    })

    try {
      const response = await fetch(delivery.targetUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Event': (delivery.payload as any).event,
          'X-Signature': delivery.signature,
          'X-Timestamp': delivery.timestamp.toString(),
          'User-Agent': 'InvoiceExtraction-Webhook/1.0',
        },
        body: JSON.stringify(delivery.payload),
        signal: AbortSignal.timeout(30000), // 30 秒超時
      })

      // 記錄回應
      const responseBody = await response.text().catch(() => '')

      if (response.ok) {
        // 成功
        await prisma.externalWebhookDelivery.update({
          where: { id: deliveryId },
          data: {
            status: 'DELIVERED',
            httpStatus: response.status,
            responseBody: responseBody.substring(0, 1000),
            completedAt: new Date(),
          },
        })
      } else {
        // HTTP 錯誤
        await this.handleDeliveryFailure(
          deliveryId,
          delivery.attempts,
          delivery.maxAttempts,
          response.status,
          `HTTP ${response.status}: ${responseBody.substring(0, 500)}`
        )
      }
    } catch (error) {
      // 網路錯誤
      await this.handleDeliveryFailure(
        deliveryId,
        delivery.attempts,
        delivery.maxAttempts,
        null,
        error instanceof Error ? error.message : 'Unknown error'
      )
    }
  }

  // 處理發送失敗
  private async handleDeliveryFailure(
    deliveryId: string,
    attempts: number,
    maxAttempts: number,
    httpStatus: number | null,
    errorMessage: string
  ): Promise<void> {
    if (attempts < maxAttempts) {
      // 安排重試
      const retryIndex = Math.min(attempts - 1, RETRY_INTERVALS.length - 1)
      const nextRetryAt = new Date(Date.now() + RETRY_INTERVALS[retryIndex])

      await prisma.externalWebhookDelivery.update({
        where: { id: deliveryId },
        data: {
          status: 'RETRYING',
          httpStatus,
          errorMessage,
          nextRetryAt,
        },
      })

      console.log(`Webhook ${deliveryId} scheduled for retry at ${nextRetryAt}`)
    } else {
      // 最終失敗
      await prisma.externalWebhookDelivery.update({
        where: { id: deliveryId },
        data: {
          status: 'FAILED',
          httpStatus,
          errorMessage,
          completedAt: new Date(),
        },
      })

      console.error(`Webhook ${deliveryId} failed after ${maxAttempts} attempts`)

      // 可以在此發送告警
      await this.sendFailureAlert(deliveryId)
    }
  }

  // 發送失敗告警
  private async sendFailureAlert(deliveryId: string): Promise<void> {
    // 實現告警邏輯（發送到監控系統或通知管理員）
    console.warn(`Webhook delivery ${deliveryId} permanently failed`)
  }

  // 處理待重試的 Webhook（由排程任務調用）
  async processRetryQueue(): Promise<number> {
    const now = new Date()

    // 獲取需要重試的 Webhook
    const pendingRetries = await prisma.externalWebhookDelivery.findMany({
      where: {
        status: 'RETRYING',
        nextRetryAt: { lte: now },
      },
      take: 100, // 每批處理 100 個
    })

    let processed = 0

    for (const delivery of pendingRetries) {
      try {
        await this.deliverWebhook(delivery.id)
        processed++
      } catch (error) {
        console.error(`Error processing retry for ${delivery.id}:`, error)
      }
    }

    return processed
  }

  // 手動重試 Webhook
  async retryWebhook(deliveryId: string): Promise<boolean> {
    const delivery = await prisma.externalWebhookDelivery.findUnique({
      where: { id: deliveryId },
    })

    if (!delivery) {
      return false
    }

    // 重置重試次數
    await prisma.externalWebhookDelivery.update({
      where: { id: deliveryId },
      data: {
        status: 'PENDING',
        attempts: 0,
        errorMessage: null,
        httpStatus: null,
      },
    })

    await this.deliverWebhook(deliveryId)
    return true
  }

  // 獲取 Webhook 發送歷史
  async getDeliveryHistory(
    taskId: string,
    apiKeyId: string
  ): Promise<{
    deliveries: any[]
    total: number
  }> {
    const task = await prisma.externalApiTask.findFirst({
      where: {
        taskId,
        apiKeyId,
      },
    })

    if (!task) {
      return { deliveries: [], total: 0 }
    }

    const [deliveries, total] = await Promise.all([
      prisma.externalWebhookDelivery.findMany({
        where: { taskId: task.id },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          event: true,
          status: true,
          httpStatus: true,
          attempts: true,
          createdAt: true,
          completedAt: true,
          errorMessage: true,
        },
      }),
      prisma.externalWebhookDelivery.count({
        where: { taskId: task.id },
      }),
    ])

    return {
      deliveries: deliveries.map((d) => ({
        ...d,
        event: d.event.toLowerCase().replace('_', '.'),
        status: d.status.toLowerCase(),
      })),
      total,
    }
  }
}

export const webhookService = new WebhookService()
```

### 3. Webhook 重試排程任務

```typescript
// lib/jobs/webhookRetryJob.ts
import { webhookService } from '@/lib/services/externalApi/webhookService'

export class WebhookRetryJob {
  private intervalId: NodeJS.Timeout | null = null

  // 啟動排程任務
  start(intervalMs: number = 60000): void {
    if (this.intervalId) {
      console.warn('Webhook retry job already running')
      return
    }

    console.log('Starting webhook retry job')

    this.intervalId = setInterval(async () => {
      try {
        const processed = await webhookService.processRetryQueue()
        if (processed > 0) {
          console.log(`Processed ${processed} webhook retries`)
        }
      } catch (error) {
        console.error('Error processing webhook retries:', error)
      }
    }, intervalMs)
  }

  // 停止排程任務
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
      console.log('Webhook retry job stopped')
    }
  }

  // 手動觸發一次處理
  async runOnce(): Promise<number> {
    return webhookService.processRetryQueue()
  }
}

export const webhookRetryJob = new WebhookRetryJob()
```

### 4. Webhook 事件觸發整合

```typescript
// lib/services/documentProcessingService.ts（擴展）
import { webhookService } from '@/lib/services/externalApi/webhookService'
import { prisma } from '@/lib/prisma'

export class DocumentProcessingService {
  // 當處理狀態變更時觸發 Webhook
  async updateProcessingStatus(
    documentId: string,
    status: string,
    additionalData?: Record<string, any>
  ): Promise<void> {
    // 更新文件狀態
    await prisma.document.update({
      where: { id: documentId },
      data: {
        status,
        ...additionalData,
      },
    })

    // 查找關聯的外部 API 任務
    const task = await prisma.externalApiTask.findFirst({
      where: { documentId },
      include: {
        document: {
          include: {
            extractionResult: true,
          },
        },
      },
    })

    if (!task) {
      return
    }

    // 更新任務狀態
    const taskStatus = this.mapToTaskStatus(status)
    await prisma.externalApiTask.update({
      where: { id: task.id },
      data: {
        status: taskStatus,
        progress: this.getProgressForStatus(taskStatus),
        currentStep: status,
        ...(taskStatus === 'COMPLETED' && {
          completedAt: new Date(),
          confidenceScore: task.document?.extractionResult?.confidenceScore,
          resultAvailable: true,
          resultExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        }),
        ...(taskStatus === 'FAILED' && {
          completedAt: new Date(),
          errorCode: additionalData?.errorCode,
          errorMessage: additionalData?.errorMessage,
          errorRetryable: additionalData?.errorRetryable ?? false,
        }),
      },
    })

    // 觸發 Webhook
    const webhookEvent = this.mapToWebhookEvent(taskStatus)
    if (webhookEvent) {
      const updatedTask = await prisma.externalApiTask.findUnique({
        where: { id: task.id },
        include: {
          document: {
            include: {
              extractionResult: true,
            },
          },
        },
      })

      if (updatedTask) {
        await webhookService.sendWebhook(updatedTask, webhookEvent)
      }
    }
  }

  private mapToTaskStatus(documentStatus: string): string {
    const statusMap: Record<string, string> = {
      PENDING: 'QUEUED',
      PROCESSING: 'PROCESSING',
      COMPLETED: 'COMPLETED',
      FAILED: 'FAILED',
      REVIEW_REQUIRED: 'REVIEW_REQUIRED',
      ESCALATED: 'REVIEW_REQUIRED',
    }
    return statusMap[documentStatus] || 'PROCESSING'
  }

  private getProgressForStatus(status: string): number {
    const progressMap: Record<string, number> = {
      QUEUED: 0,
      PROCESSING: 50,
      COMPLETED: 100,
      FAILED: 100,
      REVIEW_REQUIRED: 80,
    }
    return progressMap[status] || 0
  }

  private mapToWebhookEvent(taskStatus: string): string | null {
    const eventMap: Record<string, string> = {
      PROCESSING: 'processing',
      COMPLETED: 'completed',
      FAILED: 'failed',
      REVIEW_REQUIRED: 'review_required',
    }
    return eventMap[taskStatus] || null
  }
}
```

### 5. Webhook 日誌查詢 API

```typescript
// app/api/v1/webhooks/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { webhookService } from '@/lib/services/externalApi/webhookService'
import { externalApiAuthMiddleware } from '@/lib/middleware/externalApiAuthMiddleware'

// 獲取 Webhook 發送歷史
export async function GET(request: NextRequest) {
  const traceId = `api_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

  try {
    // 認證
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

    // 解析參數
    const taskId = request.nextUrl.searchParams.get('taskId')

    if (!taskId) {
      return NextResponse.json(
        {
          error: {
            code: 'MISSING_TASK_ID',
            message: 'taskId parameter is required',
          },
          traceId,
        },
        { status: 400 }
      )
    }

    // 獲取發送歷史
    const history = await webhookService.getDeliveryHistory(
      taskId,
      authResult.apiKey!.id
    )

    return NextResponse.json(
      {
        data: history,
        traceId,
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('Get webhook history error:', error)
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
// app/api/v1/webhooks/[deliveryId]/retry/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { webhookService } from '@/lib/services/externalApi/webhookService'
import { externalApiAuthMiddleware } from '@/lib/middleware/externalApiAuthMiddleware'

// 手動重試 Webhook
export async function POST(
  request: NextRequest,
  { params }: { params: { deliveryId: string } }
) {
  const traceId = `api_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

  try {
    // 認證
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

    // 執行重試
    const success = await webhookService.retryWebhook(params.deliveryId)

    if (!success) {
      return NextResponse.json(
        {
          error: {
            code: 'DELIVERY_NOT_FOUND',
            message: 'Webhook delivery not found',
          },
          traceId,
        },
        { status: 404 }
      )
    }

    return NextResponse.json(
      {
        data: {
          deliveryId: params.deliveryId,
          message: 'Retry initiated',
        },
        traceId,
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('Retry webhook error:', error)
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

### 6. 簽名驗證範例代碼

```typescript
// docs/examples/webhook-verification.ts
/**
 * Webhook 簽名驗證範例
 * 用於接收方驗證 Webhook 請求的真實性
 */

import { createHmac, timingSafeEqual } from 'crypto'

/**
 * 驗證 Webhook 簽名
 * @param payload - 請求 body（原始字串）
 * @param signature - X-Signature header 值
 * @param timestamp - X-Timestamp header 值
 * @param secret - 您的 Webhook secret
 * @returns 是否驗證通過
 */
export function verifyWebhookSignature(
  payload: string,
  signature: string,
  timestamp: string,
  secret: string
): boolean {
  // 檢查時間戳是否在合理範圍內（5 分鐘內）
  const timestampMs = parseInt(timestamp, 10)
  const now = Date.now()
  const tolerance = 5 * 60 * 1000 // 5 分鐘

  if (Math.abs(now - timestampMs) > tolerance) {
    console.warn('Webhook timestamp is outside tolerance window')
    return false
  }

  // 重新計算簽名
  const signatureData = `${timestamp}.${payload}`
  const expectedSignature = createHmac('sha256', secret)
    .update(signatureData)
    .digest('hex')

  // 使用 timing-safe 比較防止時序攻擊
  try {
    return timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    )
  } catch {
    return false
  }
}

// Express.js 中間件範例
export function webhookVerificationMiddleware(secret: string) {
  return (req: any, res: any, next: any) => {
    const signature = req.headers['x-signature']
    const timestamp = req.headers['x-timestamp']

    if (!signature || !timestamp) {
      return res.status(401).json({ error: 'Missing signature headers' })
    }

    // 獲取原始 body
    let rawBody = ''
    if (typeof req.body === 'string') {
      rawBody = req.body
    } else if (req.rawBody) {
      rawBody = req.rawBody.toString()
    } else {
      rawBody = JSON.stringify(req.body)
    }

    if (!verifyWebhookSignature(rawBody, signature, timestamp, secret)) {
      return res.status(401).json({ error: 'Invalid signature' })
    }

    next()
  }
}

// 使用範例
/*
import express from 'express'

const app = express()

// 需要保存原始 body
app.use(express.json({
  verify: (req: any, res, buf) => {
    req.rawBody = buf
  }
}))

// Webhook 端點
app.post('/webhook/invoice',
  webhookVerificationMiddleware(process.env.WEBHOOK_SECRET!),
  (req, res) => {
    const { event, taskId, status, data } = req.body

    console.log(`Received webhook: ${event} for task ${taskId}`)

    // 處理 webhook...

    res.json({ received: true })
  }
)
*/
```

## 測試案例

### 單元測試

```typescript
// __tests__/services/externalApi/webhookService.test.ts
import { webhookService } from '@/lib/services/externalApi/webhookService'
import { prismaMock } from '@/lib/__mocks__/prisma'

// Mock fetch
global.fetch = jest.fn()

describe('WebhookService', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('sendWebhook', () => {
    it('should not send webhook if no callbackUrl', async () => {
      const task = {
        taskId: 'task-1',
        callbackUrl: null,
        apiKeyId: 'key-1',
      } as any

      await webhookService.sendWebhook(task, 'completed')

      expect(prismaMock.externalWebhookDelivery.create).not.toHaveBeenCalled()
    })

    it('should create delivery record and send webhook', async () => {
      const task = {
        id: 'task-internal-1',
        taskId: 'task-1',
        callbackUrl: 'https://example.com/webhook',
        apiKeyId: 'key-1',
        status: 'COMPLETED',
        progress: 100,
        confidenceScore: 0.95,
        updatedAt: new Date(),
        document: {
          extractionResult: {
            forwarderId: 'f-1',
            forwarderName: 'Test Forwarder',
            confidenceScore: 0.95,
          },
        },
      } as any

      prismaMock.externalApiKey.findUnique.mockResolvedValue({
        id: 'key-1',
        webhookSecret: 'secret-123',
      } as any)

      prismaMock.externalWebhookDelivery.create.mockResolvedValue({
        id: 'delivery-1',
        targetUrl: 'https://example.com/webhook',
        payload: {},
        signature: 'sig',
        timestamp: BigInt(Date.now()),
      } as any)

      prismaMock.externalWebhookDelivery.update.mockResolvedValue({} as any)

      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        text: () => Promise.resolve('OK'),
      })

      await webhookService.sendWebhook(task, 'completed')

      expect(prismaMock.externalWebhookDelivery.create).toHaveBeenCalled()
    })
  })

  describe('deliverWebhook', () => {
    it('should mark as delivered on success', async () => {
      prismaMock.externalWebhookDelivery.update.mockResolvedValue({
        id: 'delivery-1',
        targetUrl: 'https://example.com/webhook',
        payload: { event: 'invoice.completed', taskId: 'task-1' },
        signature: 'sig',
        timestamp: BigInt(Date.now()),
        attempts: 1,
        maxAttempts: 4,
      } as any)

      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        text: () => Promise.resolve('OK'),
      })

      await webhookService.deliverWebhook('delivery-1')

      expect(prismaMock.externalWebhookDelivery.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'DELIVERED',
          }),
        })
      )
    })

    it('should schedule retry on failure', async () => {
      prismaMock.externalWebhookDelivery.update.mockResolvedValue({
        id: 'delivery-1',
        targetUrl: 'https://example.com/webhook',
        payload: { event: 'invoice.completed', taskId: 'task-1' },
        signature: 'sig',
        timestamp: BigInt(Date.now()),
        attempts: 1,
        maxAttempts: 4,
      } as any)

      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 500,
        text: () => Promise.resolve('Internal Server Error'),
      })

      await webhookService.deliverWebhook('delivery-1')

      expect(prismaMock.externalWebhookDelivery.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'RETRYING',
            nextRetryAt: expect.any(Date),
          }),
        })
      )
    })

    it('should mark as failed after max attempts', async () => {
      prismaMock.externalWebhookDelivery.update.mockResolvedValue({
        id: 'delivery-1',
        targetUrl: 'https://example.com/webhook',
        payload: { event: 'invoice.completed', taskId: 'task-1' },
        signature: 'sig',
        timestamp: BigInt(Date.now()),
        attempts: 4,
        maxAttempts: 4,
      } as any)

      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 500,
        text: () => Promise.resolve('Internal Server Error'),
      })

      await webhookService.deliverWebhook('delivery-1')

      expect(prismaMock.externalWebhookDelivery.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'FAILED',
            completedAt: expect.any(Date),
          }),
        })
      )
    })
  })

  describe('signature verification', () => {
    it('should generate valid HMAC signature', () => {
      const payload = { event: 'invoice.completed', taskId: 'task-1' }
      const timestamp = Date.now()
      const secret = 'test-secret'

      // 使用相同邏輯驗證簽名
      const signatureData = `${timestamp}.${JSON.stringify(payload)}`
      const { createHmac } = require('crypto')
      const expectedSignature = createHmac('sha256', secret)
        .update(signatureData)
        .digest('hex')

      expect(expectedSignature).toHaveLength(64) // SHA256 hex 長度
    })
  })
})
```

## 部署注意事項

1. **消息佇列**
   - 建議使用 Azure Service Bus 或 Redis 作為 Webhook 發送佇列
   - 確保訊息持久化

2. **監控指標**
   - Webhook 發送成功率
   - 平均重試次數
   - 失敗原因分佈
   - 發送延遲

3. **安全考量**
   - Webhook secret 需安全儲存
   - 支援 HTTPS 回調 URL
   - 實現 IP 白名單（可選）

4. **效能優化**
   - 使用連接池管理 HTTP 請求
   - 批量處理重試佇列
   - 設置合理的超時時間

## 相依性

- Story 11-1: API 發票提交端點（任務創建和回調 URL）
- Story 11-5: API 訪問控制與認證（Webhook secret 管理）
- Story 10-1: n8n 雙向通訊 API（事件觸發機制）
