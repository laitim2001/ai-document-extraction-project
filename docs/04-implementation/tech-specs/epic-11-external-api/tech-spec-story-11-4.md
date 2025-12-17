# Tech Spec: Story 11-4 - Webhook 通知服務

## 1. 總覽

### 1.1 功能描述
實現 Webhook 通知服務，在發票處理完成、失敗或需要審核時，主動推送通知至外部系統指定的回調 URL，免除外部系統持續輪詢的需求。

### 1.2 目標
- 實現事件驅動的 Webhook 通知機制
- 支援 HMAC-SHA256 簽名驗證確保安全性
- 實現可靠的重試機制（指數退避）
- 支援多種事件類型（processing、completed、failed、review_required）
- 提供 Webhook 發送歷史查詢與手動重試功能

### 1.3 範圍
- Webhook 發送服務 `WebhookService`
- 發送記錄模型 `ExternalWebhookDelivery`
- 重試排程任務 `WebhookRetryJob`
- Webhook 歷史查詢 API
- 簽名驗證範例代碼

### 1.4 關聯 Story
- **依賴**: Story 11-1 (callbackUrl 來源)、Story 11-5 (Webhook Secret)
- **被依賴**: 外部系統整合

---

## 2. 驗收標準對照

| AC | 描述 | 實作方式 | 驗證方法 |
|----|------|----------|----------|
| AC1 | 處理完成通知 | 狀態變更時觸發 Webhook，包含完整 payload | Webhook 接收測試 |
| AC2 | 簽名驗證 | HMAC-SHA256 + X-Signature + X-Timestamp | 簽名驗證測試 |
| AC3 | 重試機制 | 最多 3 次重試，間隔 1/5/30 分鐘 | 重試邏輯測試 |
| AC4 | 事件類型支援 | 4 種事件類型對應不同狀態 | 各事件類型測試 |

---

## 3. 資料庫設計

### 3.1 Webhook 發送記錄模型

```prisma
// Webhook 發送記錄
model ExternalWebhookDelivery {
  id              String    @id @default(cuid())

  // 任務關聯
  taskId          String
  task            ExternalApiTask @relation(fields: [taskId], references: [id], onDelete: Cascade)

  // 發送資訊
  event           WebhookEventType
  targetUrl       String    @db.VarChar(2048)
  payload         Json

  // 安全簽名
  signature       String    @db.VarChar(128)
  timestamp       BigInt

  // 發送狀態
  status          WebhookDeliveryStatus @default(PENDING)
  httpStatus      Int?
  responseBody    String?   @db.Text
  errorMessage    String?   @db.VarChar(1000)

  // 重試控制
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

// Webhook 事件類型
enum WebhookEventType {
  INVOICE_PROCESSING      // 開始處理
  INVOICE_COMPLETED       // 處理完成
  INVOICE_FAILED          // 處理失敗
  INVOICE_REVIEW_REQUIRED // 需要人工審核
}

// Webhook 發送狀態
enum WebhookDeliveryStatus {
  PENDING   // 等待發送
  SENDING   // 發送中
  DELIVERED // 已送達
  FAILED    // 最終失敗
  RETRYING  // 等待重試
}
```

### 3.2 Webhook 配置模型（進階設定）

```prisma
// Webhook 配置（可選，用於預設回調設定）
model WebhookConfiguration {
  id              String    @id @default(cuid())
  apiKeyId        String
  apiKey          ExternalApiKey @relation(fields: [apiKeyId], references: [id], onDelete: Cascade)

  // 基本設定
  events          WebhookEventType[]
  url             String    @db.VarChar(2048)
  secret          String    @db.VarChar(128)  // 用於簽名驗證
  isActive        Boolean   @default(true)

  // 進階設定
  timeout         Int       @default(30000)  // 超時時間（毫秒）
  retryEnabled    Boolean   @default(true)
  maxRetries      Int       @default(3)

  // 元數據
  description     String?   @db.VarChar(500)
  headers         Json?     // 額外自訂 Headers

  // 時間記錄
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  @@unique([apiKeyId, url])
  @@index([apiKeyId])
  @@index([isActive])
}
```

### 3.3 ExternalApiKey 擴展

```prisma
model ExternalApiKey {
  // ... 現有欄位 ...

  // Webhook 設定
  webhookSecret   String?   @db.VarChar(128)  // 預設簽名密鑰

  // 關聯
  webhookConfigurations WebhookConfiguration[]
}
```

---

## 4. 型別定義

### 4.1 核心型別

```typescript
// lib/types/externalApi/webhook.ts

/**
 * Webhook 事件類型（API 格式）
 */
export type WebhookEvent =
  | 'invoice.processing'
  | 'invoice.completed'
  | 'invoice.failed'
  | 'invoice.review_required'

/**
 * 事件類型映射（內部 → API）
 */
export const EVENT_TYPE_TO_API: Record<string, WebhookEvent> = {
  INVOICE_PROCESSING: 'invoice.processing',
  INVOICE_COMPLETED: 'invoice.completed',
  INVOICE_FAILED: 'invoice.failed',
  INVOICE_REVIEW_REQUIRED: 'invoice.review_required',
}

/**
 * 事件類型映射（事件名 → 內部）
 */
export const EVENT_NAME_TO_TYPE: Record<string, string> = {
  processing: 'INVOICE_PROCESSING',
  completed: 'INVOICE_COMPLETED',
  failed: 'INVOICE_FAILED',
  review_required: 'INVOICE_REVIEW_REQUIRED',
}

/**
 * Webhook Payload
 */
export interface WebhookPayload {
  event: WebhookEvent
  taskId: string
  status: string
  timestamp: string
  data: WebhookPayloadData
}

/**
 * Webhook 資料內容
 */
export interface WebhookPayloadData {
  taskId: string
  status: string
  progress?: number

  // 完成時的結果摘要
  result?: {
    confidenceScore: number
    forwarderId?: string
    forwarderName?: string
    resultUrl: string
  }

  // 失敗時的錯誤資訊
  error?: {
    code: string
    message: string
    retryable: boolean
  }

  // 需要審核時的資訊
  reviewInfo?: {
    reason: string
    escalatedAt: string
  }
}

/**
 * Webhook 發送結果
 */
export interface WebhookDeliveryResult {
  success: boolean
  deliveryId: string
  httpStatus?: number
  error?: string
}

/**
 * Webhook 發送記錄（API 回傳格式）
 */
export interface WebhookDeliveryRecord {
  id: string
  event: WebhookEvent
  status: 'pending' | 'sending' | 'delivered' | 'failed' | 'retrying'
  httpStatus?: number
  attempts: number
  createdAt: string
  completedAt?: string
  errorMessage?: string
}

/**
 * 重試間隔設定（毫秒）
 */
export const RETRY_INTERVALS = [
  60 * 1000,       // 1 分鐘
  5 * 60 * 1000,   // 5 分鐘
  30 * 60 * 1000,  // 30 分鐘
] as const

/**
 * Webhook 發送設定
 */
export interface WebhookDeliveryOptions {
  timeout?: number      // 請求超時（毫秒）
  maxRetries?: number   // 最大重試次數
  customHeaders?: Record<string, string>
}

/**
 * Webhook 歷史查詢回應
 */
export interface WebhookHistoryResponse {
  deliveries: WebhookDeliveryRecord[]
  total: number
}
```

---

## 5. 服務層設計

### 5.1 WebhookService

```typescript
// lib/services/externalApi/webhookService.ts

import { prisma } from '@/lib/prisma'
import { createHmac } from 'crypto'
import { ExternalApiTask, WebhookEventType, WebhookDeliveryStatus } from '@prisma/client'
import {
  WebhookPayload,
  WebhookPayloadData,
  WebhookDeliveryResult,
  WebhookDeliveryRecord,
  WebhookHistoryResponse,
  EVENT_NAME_TO_TYPE,
  EVENT_TYPE_TO_API,
  RETRY_INTERVALS,
} from '@/lib/types/externalApi/webhook'
import { logWebhookDelivery } from '@/lib/services/externalApi/apiLogger'

/**
 * Webhook 通知服務
 * 負責發送、重試和管理 Webhook 通知
 */
export class WebhookService {
  /** 預設請求超時時間 */
  private readonly DEFAULT_TIMEOUT = 30000

  /** 最大回應 body 長度 */
  private readonly MAX_RESPONSE_LENGTH = 1000

  /**
   * 發送 Webhook 通知
   * @param task 任務物件（含關聯資料）
   * @param event 事件名稱
   */
  async sendWebhook(
    task: ExternalApiTask & {
      document?: {
        extractionResult?: any
        escalationReason?: string
      } | null
    },
    event: string
  ): Promise<WebhookDeliveryResult | null> {
    // 檢查是否有回調 URL
    if (!task.callbackUrl) {
      return null
    }

    // 驗證事件類型
    const eventType = EVENT_NAME_TO_TYPE[event] as WebhookEventType
    if (!eventType) {
      console.warn(`[Webhook] Unknown event type: ${event}`)
      return null
    }

    // 獲取 API Key 的 secret
    const apiKey = await prisma.externalApiKey.findUnique({
      where: { id: task.apiKeyId },
      select: { id: true, webhookSecret: true },
    })

    if (!apiKey) {
      console.error(`[Webhook] API key not found for task ${task.taskId}`)
      return null
    }

    // 構建 payload
    const payload = this.buildPayload(task, event)
    const timestamp = Date.now()
    const secret = apiKey.webhookSecret || apiKey.id

    // 生成簽名
    const signature = this.generateSignature(payload, timestamp, secret)

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

    // 異步發送（不阻塞主流程）
    this.deliverWebhookAsync(delivery.id).catch((error) => {
      console.error(`[Webhook] Failed to deliver ${delivery.id}:`, error)
    })

    return {
      success: true,
      deliveryId: delivery.id,
    }
  }

  /**
   * 構建 Webhook payload
   */
  private buildPayload(
    task: ExternalApiTask & {
      document?: {
        extractionResult?: any
        escalationReason?: string
      } | null
    },
    event: string
  ): WebhookPayload {
    const timestamp = new Date().toISOString()
    const apiEvent = `invoice.${event}` as WebhookPayload['event']

    const data: WebhookPayloadData = {
      taskId: task.taskId,
      status: task.status.toLowerCase(),
      progress: task.progress ?? undefined,
    }

    // 完成狀態：添加結果摘要
    if (event === 'completed' && task.document?.extractionResult) {
      const extraction = task.document.extractionResult
      data.result = {
        confidenceScore: task.confidenceScore ?? extraction.confidenceScore ?? 0,
        forwarderId: extraction.forwarderId ?? undefined,
        forwarderName: extraction.forwarderName ?? undefined,
        resultUrl: `/api/v1/invoices/${task.taskId}/result`,
      }
    }

    // 失敗狀態：添加錯誤資訊
    if (event === 'failed') {
      data.error = {
        code: task.errorCode || 'PROCESSING_FAILED',
        message: task.errorMessage || 'An error occurred during processing',
        retryable: task.errorRetryable ?? false,
      }
    }

    // 審核狀態：添加審核資訊
    if (event === 'review_required') {
      data.reviewInfo = {
        reason: task.document?.escalationReason || 'Low confidence score requires manual review',
        escalatedAt: task.updatedAt.toISOString(),
      }
    }

    return {
      event: apiEvent,
      taskId: task.taskId,
      status: task.status.toLowerCase(),
      timestamp,
      data,
    }
  }

  /**
   * 生成 HMAC-SHA256 簽名
   */
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

  /**
   * 異步發送 Webhook
   */
  private async deliverWebhookAsync(deliveryId: string): Promise<void> {
    // 使用 setImmediate 確保不阻塞當前執行
    setImmediate(async () => {
      await this.deliverWebhook(deliveryId)
    })
  }

  /**
   * 執行 Webhook 發送
   */
  async deliverWebhook(deliveryId: string): Promise<boolean> {
    // 更新狀態為發送中並增加嘗試次數
    const delivery = await prisma.externalWebhookDelivery.update({
      where: { id: deliveryId },
      data: {
        status: 'SENDING',
        attempts: { increment: 1 },
        lastAttemptAt: new Date(),
      },
    })

    const startTime = Date.now()

    try {
      // 發送 HTTP 請求
      const response = await fetch(delivery.targetUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Event': (delivery.payload as any).event,
          'X-Webhook-Id': delivery.id,
          'X-Signature': delivery.signature,
          'X-Timestamp': delivery.timestamp.toString(),
          'User-Agent': 'InvoiceExtraction-Webhook/1.0',
        },
        body: JSON.stringify(delivery.payload),
        signal: AbortSignal.timeout(this.DEFAULT_TIMEOUT),
      })

      // 讀取回應
      const responseBody = await response.text().catch(() => '')
      const responseTime = Date.now() - startTime

      if (response.ok) {
        // 成功送達
        await this.markAsDelivered(deliveryId, response.status, responseBody)
        await this.logDelivery(delivery, 'DELIVERED', response.status, responseTime)
        return true
      } else {
        // HTTP 錯誤
        const errorMsg = `HTTP ${response.status}: ${responseBody.substring(0, 500)}`
        await this.handleDeliveryFailure(delivery, response.status, errorMsg)
        await this.logDelivery(delivery, 'FAILED', response.status, responseTime, errorMsg)
        return false
      }
    } catch (error) {
      // 網路錯誤或超時
      const responseTime = Date.now() - startTime
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      await this.handleDeliveryFailure(delivery, null, errorMessage)
      await this.logDelivery(delivery, 'FAILED', null, responseTime, errorMessage)
      return false
    }
  }

  /**
   * 標記為已送達
   */
  private async markAsDelivered(
    deliveryId: string,
    httpStatus: number,
    responseBody: string
  ): Promise<void> {
    await prisma.externalWebhookDelivery.update({
      where: { id: deliveryId },
      data: {
        status: 'DELIVERED',
        httpStatus,
        responseBody: responseBody.substring(0, this.MAX_RESPONSE_LENGTH),
        completedAt: new Date(),
      },
    })
  }

  /**
   * 處理發送失敗
   */
  private async handleDeliveryFailure(
    delivery: any,
    httpStatus: number | null,
    errorMessage: string
  ): Promise<void> {
    const currentAttempts = delivery.attempts

    if (currentAttempts < delivery.maxAttempts) {
      // 安排重試
      const retryIndex = Math.min(currentAttempts - 1, RETRY_INTERVALS.length - 1)
      const nextRetryAt = new Date(Date.now() + RETRY_INTERVALS[retryIndex])

      await prisma.externalWebhookDelivery.update({
        where: { id: delivery.id },
        data: {
          status: 'RETRYING',
          httpStatus,
          errorMessage: errorMessage.substring(0, 1000),
          nextRetryAt,
        },
      })

      console.log(`[Webhook] ${delivery.id} scheduled for retry at ${nextRetryAt.toISOString()}`)
    } else {
      // 最終失敗
      await prisma.externalWebhookDelivery.update({
        where: { id: delivery.id },
        data: {
          status: 'FAILED',
          httpStatus,
          errorMessage: errorMessage.substring(0, 1000),
          completedAt: new Date(),
        },
      })

      console.error(`[Webhook] ${delivery.id} permanently failed after ${delivery.maxAttempts} attempts`)

      // 發送告警
      await this.sendFailureAlert(delivery.id)
    }
  }

  /**
   * 記錄發送日誌
   */
  private async logDelivery(
    delivery: any,
    status: string,
    httpStatus: number | null,
    responseTime: number,
    error?: string
  ): Promise<void> {
    await logWebhookDelivery({
      deliveryId: delivery.id,
      taskId: delivery.taskId,
      event: (delivery.payload as any).event,
      targetUrl: delivery.targetUrl,
      status,
      httpStatus,
      responseTime,
      error,
    })
  }

  /**
   * 發送失敗告警
   */
  private async sendFailureAlert(deliveryId: string): Promise<void> {
    // TODO: 整合告警系統（如 Azure Monitor、PagerDuty 等）
    console.warn(`[Webhook Alert] Delivery ${deliveryId} permanently failed`)
  }

  /**
   * 處理待重試的 Webhook（由排程任務調用）
   */
  async processRetryQueue(batchSize: number = 100): Promise<{
    processed: number
    succeeded: number
    failed: number
  }> {
    const now = new Date()

    // 獲取需要重試的記錄
    const pendingRetries = await prisma.externalWebhookDelivery.findMany({
      where: {
        status: 'RETRYING',
        nextRetryAt: { lte: now },
      },
      take: batchSize,
      orderBy: { nextRetryAt: 'asc' },
    })

    let succeeded = 0
    let failed = 0

    for (const delivery of pendingRetries) {
      try {
        const result = await this.deliverWebhook(delivery.id)
        if (result) {
          succeeded++
        } else {
          failed++
        }
      } catch (error) {
        console.error(`[Webhook] Error processing retry for ${delivery.id}:`, error)
        failed++
      }
    }

    return {
      processed: pendingRetries.length,
      succeeded,
      failed,
    }
  }

  /**
   * 手動重試 Webhook
   */
  async retryWebhook(deliveryId: string): Promise<boolean> {
    const delivery = await prisma.externalWebhookDelivery.findUnique({
      where: { id: deliveryId },
    })

    if (!delivery) {
      return false
    }

    // 重置重試狀態
    await prisma.externalWebhookDelivery.update({
      where: { id: deliveryId },
      data: {
        status: 'PENDING',
        attempts: 0,
        errorMessage: null,
        httpStatus: null,
        nextRetryAt: null,
        completedAt: null,
      },
    })

    await this.deliverWebhook(deliveryId)
    return true
  }

  /**
   * 獲取 Webhook 發送歷史
   */
  async getDeliveryHistory(
    taskId: string,
    apiKeyId: string
  ): Promise<WebhookHistoryResponse> {
    // 驗證任務所有權
    const task = await prisma.externalApiTask.findFirst({
      where: {
        taskId,
        apiKeyId,
      },
      select: { id: true },
    })

    if (!task) {
      return { deliveries: [], total: 0 }
    }

    // 查詢發送記錄
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
        id: d.id,
        event: EVENT_TYPE_TO_API[d.event],
        status: d.status.toLowerCase() as WebhookDeliveryRecord['status'],
        httpStatus: d.httpStatus ?? undefined,
        attempts: d.attempts,
        createdAt: d.createdAt.toISOString(),
        completedAt: d.completedAt?.toISOString(),
        errorMessage: d.errorMessage ?? undefined,
      })),
      total,
    }
  }

  /**
   * 獲取發送統計
   */
  async getDeliveryStats(apiKeyId: string): Promise<{
    total: number
    delivered: number
    failed: number
    pending: number
    successRate: number
  }> {
    const tasks = await prisma.externalApiTask.findMany({
      where: { apiKeyId },
      select: { id: true },
    })

    const taskIds = tasks.map((t) => t.id)

    const [total, delivered, failed, pending] = await Promise.all([
      prisma.externalWebhookDelivery.count({
        where: { taskId: { in: taskIds } },
      }),
      prisma.externalWebhookDelivery.count({
        where: { taskId: { in: taskIds }, status: 'DELIVERED' },
      }),
      prisma.externalWebhookDelivery.count({
        where: { taskId: { in: taskIds }, status: 'FAILED' },
      }),
      prisma.externalWebhookDelivery.count({
        where: {
          taskId: { in: taskIds },
          status: { in: ['PENDING', 'SENDING', 'RETRYING'] },
        },
      }),
    ])

    const completedTotal = delivered + failed
    const successRate = completedTotal > 0 ? (delivered / completedTotal) * 100 : 0

    return {
      total,
      delivered,
      failed,
      pending,
      successRate: Math.round(successRate * 100) / 100,
    }
  }
}

// 單例導出
export const webhookService = new WebhookService()
```

### 5.2 Webhook 重試排程任務

```typescript
// lib/jobs/webhookRetryJob.ts

import { webhookService } from '@/lib/services/externalApi/webhookService'

/**
 * Webhook 重試排程任務
 * 定期處理需要重試的 Webhook 發送
 */
export class WebhookRetryJob {
  private intervalId: NodeJS.Timeout | null = null
  private isRunning = false
  private readonly DEFAULT_INTERVAL = 60000 // 1 分鐘
  private readonly BATCH_SIZE = 100

  /**
   * 啟動排程任務
   * @param intervalMs 檢查間隔（毫秒）
   */
  start(intervalMs: number = this.DEFAULT_INTERVAL): void {
    if (this.intervalId) {
      console.warn('[WebhookRetryJob] Already running')
      return
    }

    console.log(`[WebhookRetryJob] Starting with ${intervalMs}ms interval`)

    this.intervalId = setInterval(async () => {
      await this.runOnce()
    }, intervalMs)

    // 立即執行一次
    this.runOnce()
  }

  /**
   * 停止排程任務
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
      console.log('[WebhookRetryJob] Stopped')
    }
  }

  /**
   * 手動執行一次處理
   */
  async runOnce(): Promise<{
    processed: number
    succeeded: number
    failed: number
  }> {
    // 防止重疊執行
    if (this.isRunning) {
      console.log('[WebhookRetryJob] Skip - already running')
      return { processed: 0, succeeded: 0, failed: 0 }
    }

    this.isRunning = true

    try {
      const result = await webhookService.processRetryQueue(this.BATCH_SIZE)

      if (result.processed > 0) {
        console.log(
          `[WebhookRetryJob] Processed ${result.processed} retries: ` +
          `${result.succeeded} succeeded, ${result.failed} failed`
        )
      }

      return result
    } catch (error) {
      console.error('[WebhookRetryJob] Error:', error)
      return { processed: 0, succeeded: 0, failed: 0 }
    } finally {
      this.isRunning = false
    }
  }

  /**
   * 檢查是否正在運行
   */
  isActive(): boolean {
    return this.intervalId !== null
  }
}

// 單例導出
export const webhookRetryJob = new WebhookRetryJob()
```

### 5.3 事件觸發整合

```typescript
// lib/services/externalApi/webhookEventTrigger.ts

import { prisma } from '@/lib/prisma'
import { webhookService } from './webhookService'

/**
 * Webhook 事件觸發器
 * 整合到文件處理流程中，在狀態變更時觸發 Webhook
 */
export class WebhookEventTrigger {
  /**
   * 處理任務狀態變更
   * @param taskId 外部任務 ID
   * @param newStatus 新狀態
   * @param additionalData 附加資料
   */
  async onTaskStatusChange(
    taskId: string,
    newStatus: string,
    additionalData?: {
      errorCode?: string
      errorMessage?: string
      errorRetryable?: boolean
      confidenceScore?: number
    }
  ): Promise<void> {
    // 查詢任務及關聯資料
    const task = await prisma.externalApiTask.findUnique({
      where: { taskId },
      include: {
        document: {
          include: {
            extractionResult: {
              include: {
                forwarder: true,
              },
            },
          },
        },
      },
    })

    if (!task) {
      console.warn(`[WebhookEventTrigger] Task not found: ${taskId}`)
      return
    }

    // 更新任務狀態
    const updatedTask = await prisma.externalApiTask.update({
      where: { id: task.id },
      data: {
        status: newStatus as any,
        progress: this.getProgressForStatus(newStatus),
        currentStep: newStatus,
        ...(newStatus === 'COMPLETED' && {
          completedAt: new Date(),
          confidenceScore: additionalData?.confidenceScore ||
            task.document?.extractionResult?.confidenceScore,
          resultAvailable: true,
          resultExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        }),
        ...(newStatus === 'FAILED' && {
          completedAt: new Date(),
          errorCode: additionalData?.errorCode,
          errorMessage: additionalData?.errorMessage,
          errorRetryable: additionalData?.errorRetryable ?? false,
        }),
      },
      include: {
        document: {
          include: {
            extractionResult: {
              include: {
                forwarder: true,
              },
            },
          },
        },
      },
    })

    // 決定 Webhook 事件
    const webhookEvent = this.mapStatusToEvent(newStatus)

    if (webhookEvent) {
      await webhookService.sendWebhook(updatedTask, webhookEvent)
    }
  }

  /**
   * 狀態對應進度
   */
  private getProgressForStatus(status: string): number {
    const progressMap: Record<string, number> = {
      QUEUED: 0,
      PROCESSING: 50,
      COMPLETED: 100,
      FAILED: 100,
      REVIEW_REQUIRED: 80,
    }
    return progressMap[status] ?? 0
  }

  /**
   * 狀態對應 Webhook 事件
   */
  private mapStatusToEvent(status: string): string | null {
    const eventMap: Record<string, string> = {
      PROCESSING: 'processing',
      COMPLETED: 'completed',
      FAILED: 'failed',
      REVIEW_REQUIRED: 'review_required',
    }
    return eventMap[status] ?? null
  }
}

export const webhookEventTrigger = new WebhookEventTrigger()
```

---

## 6. API 路由設計

### 6.1 Webhook 歷史查詢端點

```typescript
// app/api/v1/webhooks/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { webhookService } from '@/lib/services/externalApi/webhookService'
import { externalApiAuthMiddleware } from '@/lib/middleware/externalApiAuthMiddleware'
import { generateTraceId } from '@/lib/utils/traceId'

/**
 * 獲取 Webhook 發送歷史
 * GET /api/v1/webhooks?taskId={taskId}
 */
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

    // 2. 解析參數
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

    // 3. 獲取發送歷史
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

### 6.2 Webhook 手動重試端點

```typescript
// app/api/v1/webhooks/[deliveryId]/retry/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { webhookService } from '@/lib/services/externalApi/webhookService'
import { externalApiAuthMiddleware } from '@/lib/middleware/externalApiAuthMiddleware'
import { generateTraceId } from '@/lib/utils/traceId'

/**
 * 手動重試 Webhook 發送
 * POST /api/v1/webhooks/{deliveryId}/retry
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { deliveryId: string } }
) {
  const traceId = generateTraceId()

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

    // 2. 執行重試
    const success = await webhookService.retryWebhook(params.deliveryId)

    if (!success) {
      return NextResponse.json(
        {
          error: {
            code: 'DELIVERY_NOT_FOUND',
            message: 'Webhook delivery record not found',
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
          message: 'Retry initiated successfully',
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

### 6.3 Webhook 統計端點

```typescript
// app/api/v1/webhooks/stats/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { webhookService } from '@/lib/services/externalApi/webhookService'
import { externalApiAuthMiddleware } from '@/lib/middleware/externalApiAuthMiddleware'
import { generateTraceId } from '@/lib/utils/traceId'

/**
 * 獲取 Webhook 發送統計
 * GET /api/v1/webhooks/stats
 */
export async function GET(request: NextRequest) {
  const traceId = generateTraceId()

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

    // 獲取統計
    const stats = await webhookService.getDeliveryStats(authResult.apiKey!.id)

    return NextResponse.json(
      {
        data: stats,
        traceId,
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('Get webhook stats error:', error)
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

---

## 7. 簽名驗證範例

### 7.1 Node.js / TypeScript 驗證範例

```typescript
// docs/examples/webhook-verification.ts

/**
 * Webhook 簽名驗證範例
 * 供外部系統接收端使用
 */

import { createHmac, timingSafeEqual } from 'crypto'

/**
 * 驗證 Webhook 簽名
 * @param payload 請求 body（原始字串）
 * @param signature X-Signature header 值
 * @param timestamp X-Timestamp header 值
 * @param secret 您的 Webhook secret
 * @returns 是否驗證通過
 */
export function verifyWebhookSignature(
  payload: string,
  signature: string,
  timestamp: string,
  secret: string
): boolean {
  // 1. 檢查時間戳是否在合理範圍內（防止重放攻擊）
  const timestampMs = parseInt(timestamp, 10)
  const now = Date.now()
  const tolerance = 5 * 60 * 1000 // 5 分鐘容差

  if (isNaN(timestampMs) || Math.abs(now - timestampMs) > tolerance) {
    console.warn('Webhook timestamp is outside tolerance window')
    return false
  }

  // 2. 重新計算簽名
  const signatureData = `${timestamp}.${payload}`
  const expectedSignature = createHmac('sha256', secret)
    .update(signatureData)
    .digest('hex')

  // 3. 使用 timing-safe 比較防止時序攻擊
  try {
    return timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    )
  } catch {
    return false
  }
}

/**
 * Express.js 中間件
 */
export function webhookVerificationMiddleware(secret: string) {
  return (req: any, res: any, next: any) => {
    const signature = req.headers['x-signature']
    const timestamp = req.headers['x-timestamp']

    if (!signature || !timestamp) {
      return res.status(401).json({
        error: 'Missing signature headers'
      })
    }

    // 獲取原始 body
    const rawBody = typeof req.body === 'string'
      ? req.body
      : JSON.stringify(req.body)

    if (!verifyWebhookSignature(rawBody, signature, timestamp, secret)) {
      return res.status(401).json({
        error: 'Invalid signature'
      })
    }

    next()
  }
}

// ===== 使用範例 =====
/*
import express from 'express'

const app = express()

// 保存原始 body 以便驗證簽名
app.use(express.json({
  verify: (req: any, res, buf) => {
    req.rawBody = buf.toString()
  }
}))

// Webhook 接收端點
app.post('/webhook/invoice',
  webhookVerificationMiddleware(process.env.WEBHOOK_SECRET!),
  (req, res) => {
    const { event, taskId, status, data } = req.body

    console.log(`Received: ${event} for task ${taskId}`)

    switch (event) {
      case 'invoice.completed':
        console.log('Result URL:', data.result?.resultUrl)
        break
      case 'invoice.failed':
        console.log('Error:', data.error?.message)
        break
      case 'invoice.review_required':
        console.log('Reason:', data.reviewInfo?.reason)
        break
    }

    res.json({ received: true })
  }
)
*/
```

### 7.2 Python 驗證範例

```python
# docs/examples/webhook_verification.py

"""
Webhook 簽名驗證範例 (Python)
"""

import hmac
import hashlib
import time
from typing import Optional

def verify_webhook_signature(
    payload: str,
    signature: str,
    timestamp: str,
    secret: str,
    tolerance_seconds: int = 300
) -> bool:
    """
    驗證 Webhook 簽名

    Args:
        payload: 請求 body（原始字串）
        signature: X-Signature header 值
        timestamp: X-Timestamp header 值
        secret: 您的 Webhook secret
        tolerance_seconds: 時間戳容差（秒）

    Returns:
        是否驗證通過
    """
    # 1. 檢查時間戳
    try:
        timestamp_ms = int(timestamp)
        now_ms = int(time.time() * 1000)

        if abs(now_ms - timestamp_ms) > tolerance_seconds * 1000:
            print("Webhook timestamp is outside tolerance window")
            return False
    except ValueError:
        return False

    # 2. 計算預期簽名
    signature_data = f"{timestamp}.{payload}"
    expected_signature = hmac.new(
        secret.encode('utf-8'),
        signature_data.encode('utf-8'),
        hashlib.sha256
    ).hexdigest()

    # 3. 安全比較
    return hmac.compare_digest(signature, expected_signature)


# Flask 範例
"""
from flask import Flask, request, jsonify

app = Flask(__name__)
WEBHOOK_SECRET = os.environ.get('WEBHOOK_SECRET')

@app.route('/webhook/invoice', methods=['POST'])
def handle_webhook():
    signature = request.headers.get('X-Signature')
    timestamp = request.headers.get('X-Timestamp')

    if not signature or not timestamp:
        return jsonify({'error': 'Missing signature headers'}), 401

    raw_body = request.get_data(as_text=True)

    if not verify_webhook_signature(raw_body, signature, timestamp, WEBHOOK_SECRET):
        return jsonify({'error': 'Invalid signature'}), 401

    data = request.json
    event = data.get('event')
    task_id = data.get('taskId')

    print(f"Received: {event} for task {task_id}")

    return jsonify({'received': True})
"""
```

---

## 8. 測試計劃

### 8.1 單元測試

```typescript
// __tests__/services/externalApi/webhookService.test.ts

import { webhookService } from '@/lib/services/externalApi/webhookService'
import { prismaMock } from '@/lib/__mocks__/prisma'
import { createHmac } from 'crypto'

// Mock fetch
const mockFetch = jest.fn()
global.fetch = mockFetch

describe('WebhookService', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('sendWebhook', () => {
    it('當沒有 callbackUrl 時不應發送 Webhook', async () => {
      const task = {
        taskId: 'task-1',
        callbackUrl: null,
        apiKeyId: 'key-1',
      } as any

      const result = await webhookService.sendWebhook(task, 'completed')

      expect(result).toBeNull()
      expect(prismaMock.externalWebhookDelivery.create).not.toHaveBeenCalled()
    })

    it('應創建發送記錄並觸發發送', async () => {
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
        taskId: 'task-internal-1',
        event: 'INVOICE_COMPLETED',
        targetUrl: 'https://example.com/webhook',
        payload: {},
        signature: 'sig',
        timestamp: BigInt(Date.now()),
      } as any)

      const result = await webhookService.sendWebhook(task, 'completed')

      expect(result).toBeDefined()
      expect(result?.deliveryId).toBe('delivery-1')
      expect(prismaMock.externalWebhookDelivery.create).toHaveBeenCalled()
    })

    it('應正確構建 completed 事件的 payload', async () => {
      const task = {
        id: 'task-internal-1',
        taskId: 'task-1',
        callbackUrl: 'https://example.com/webhook',
        apiKeyId: 'key-1',
        status: 'COMPLETED',
        progress: 100,
        confidenceScore: 0.92,
        updatedAt: new Date(),
        document: {
          extractionResult: {
            forwarderId: 'f-1',
            forwarderName: 'Forwarder A',
            confidenceScore: 0.92,
          },
        },
      } as any

      prismaMock.externalApiKey.findUnique.mockResolvedValue({
        id: 'key-1',
        webhookSecret: 'secret',
      } as any)

      let capturedPayload: any
      prismaMock.externalWebhookDelivery.create.mockImplementation((args) => {
        capturedPayload = args.data.payload
        return Promise.resolve({ id: 'delivery-1', ...args.data } as any)
      })

      await webhookService.sendWebhook(task, 'completed')

      expect(capturedPayload.event).toBe('invoice.completed')
      expect(capturedPayload.data.result).toBeDefined()
      expect(capturedPayload.data.result.confidenceScore).toBe(0.92)
      expect(capturedPayload.data.result.forwarderName).toBe('Forwarder A')
    })

    it('應正確構建 failed 事件的 payload', async () => {
      const task = {
        id: 'task-internal-1',
        taskId: 'task-1',
        callbackUrl: 'https://example.com/webhook',
        apiKeyId: 'key-1',
        status: 'FAILED',
        errorCode: 'OCR_FAILED',
        errorMessage: 'Unable to extract text',
        errorRetryable: true,
        updatedAt: new Date(),
      } as any

      prismaMock.externalApiKey.findUnique.mockResolvedValue({
        id: 'key-1',
        webhookSecret: 'secret',
      } as any)

      let capturedPayload: any
      prismaMock.externalWebhookDelivery.create.mockImplementation((args) => {
        capturedPayload = args.data.payload
        return Promise.resolve({ id: 'delivery-1', ...args.data } as any)
      })

      await webhookService.sendWebhook(task, 'failed')

      expect(capturedPayload.event).toBe('invoice.failed')
      expect(capturedPayload.data.error).toBeDefined()
      expect(capturedPayload.data.error.code).toBe('OCR_FAILED')
      expect(capturedPayload.data.error.retryable).toBe(true)
    })
  })

  describe('deliverWebhook', () => {
    it('成功時應標記為 DELIVERED', async () => {
      prismaMock.externalWebhookDelivery.update
        .mockResolvedValueOnce({
          id: 'delivery-1',
          targetUrl: 'https://example.com/webhook',
          payload: { event: 'invoice.completed', taskId: 'task-1' },
          signature: 'sig',
          timestamp: BigInt(Date.now()),
          attempts: 1,
          maxAttempts: 4,
        } as any)
        .mockResolvedValueOnce({} as any)

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        text: () => Promise.resolve('OK'),
      })

      const result = await webhookService.deliverWebhook('delivery-1')

      expect(result).toBe(true)
      expect(prismaMock.externalWebhookDelivery.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'DELIVERED',
          }),
        })
      )
    })

    it('HTTP 錯誤時應安排重試', async () => {
      prismaMock.externalWebhookDelivery.update
        .mockResolvedValueOnce({
          id: 'delivery-1',
          targetUrl: 'https://example.com/webhook',
          payload: { event: 'invoice.completed' },
          signature: 'sig',
          timestamp: BigInt(Date.now()),
          attempts: 1,
          maxAttempts: 4,
        } as any)
        .mockResolvedValueOnce({} as any)

      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        text: () => Promise.resolve('Internal Server Error'),
      })

      const result = await webhookService.deliverWebhook('delivery-1')

      expect(result).toBe(false)
      expect(prismaMock.externalWebhookDelivery.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'RETRYING',
            nextRetryAt: expect.any(Date),
          }),
        })
      )
    })

    it('達到最大重試次數後應標記為 FAILED', async () => {
      prismaMock.externalWebhookDelivery.update
        .mockResolvedValueOnce({
          id: 'delivery-1',
          targetUrl: 'https://example.com/webhook',
          payload: { event: 'invoice.completed' },
          signature: 'sig',
          timestamp: BigInt(Date.now()),
          attempts: 4, // 已達最大次數
          maxAttempts: 4,
        } as any)
        .mockResolvedValueOnce({} as any)

      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        text: () => Promise.resolve('Error'),
      })

      const result = await webhookService.deliverWebhook('delivery-1')

      expect(result).toBe(false)
      expect(prismaMock.externalWebhookDelivery.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'FAILED',
            completedAt: expect.any(Date),
          }),
        })
      )
    })

    it('網路超時應處理為失敗', async () => {
      prismaMock.externalWebhookDelivery.update.mockResolvedValue({
        id: 'delivery-1',
        targetUrl: 'https://example.com/webhook',
        payload: { event: 'invoice.completed' },
        attempts: 1,
        maxAttempts: 4,
      } as any)

      mockFetch.mockRejectedValue(new Error('Request timeout'))

      const result = await webhookService.deliverWebhook('delivery-1')

      expect(result).toBe(false)
    })
  })

  describe('簽名驗證', () => {
    it('應生成有效的 HMAC-SHA256 簽名', () => {
      const payload = { event: 'invoice.completed', taskId: 'task-1' }
      const timestamp = Date.now()
      const secret = 'test-secret'

      // 使用相同邏輯驗證
      const signatureData = `${timestamp}.${JSON.stringify(payload)}`
      const signature = createHmac('sha256', secret)
        .update(signatureData)
        .digest('hex')

      expect(signature).toHaveLength(64) // SHA256 hex 長度
      expect(signature).toMatch(/^[a-f0-9]{64}$/)
    })
  })

  describe('processRetryQueue', () => {
    it('應處理待重試的 Webhook', async () => {
      prismaMock.externalWebhookDelivery.findMany.mockResolvedValue([
        {
          id: 'delivery-1',
          status: 'RETRYING',
          nextRetryAt: new Date(Date.now() - 1000),
        },
        {
          id: 'delivery-2',
          status: 'RETRYING',
          nextRetryAt: new Date(Date.now() - 1000),
        },
      ] as any)

      // Mock deliverWebhook
      prismaMock.externalWebhookDelivery.update.mockResolvedValue({
        attempts: 2,
        maxAttempts: 4,
        targetUrl: 'https://example.com',
        payload: {},
      } as any)

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        text: () => Promise.resolve('OK'),
      })

      const result = await webhookService.processRetryQueue()

      expect(result.processed).toBe(2)
    })
  })

  describe('getDeliveryHistory', () => {
    it('應返回任務的發送歷史', async () => {
      prismaMock.externalApiTask.findFirst.mockResolvedValue({
        id: 'task-internal-1',
      } as any)

      prismaMock.externalWebhookDelivery.findMany.mockResolvedValue([
        {
          id: 'd-1',
          event: 'INVOICE_COMPLETED',
          status: 'DELIVERED',
          httpStatus: 200,
          attempts: 1,
          createdAt: new Date(),
          completedAt: new Date(),
        },
      ] as any)

      prismaMock.externalWebhookDelivery.count.mockResolvedValue(1)

      const result = await webhookService.getDeliveryHistory('task-1', 'key-1')

      expect(result.total).toBe(1)
      expect(result.deliveries).toHaveLength(1)
      expect(result.deliveries[0].event).toBe('invoice.completed')
    })
  })
})
```

### 8.2 整合測試

```typescript
// __tests__/api/v1/webhooks/route.test.ts

import { GET } from '@/app/api/v1/webhooks/route'
import { createMockRequest } from '@/lib/test-utils/mockRequest'

describe('GET /api/v1/webhooks', () => {
  it('應返回 Webhook 發送歷史', async () => {
    const request = createMockRequest({
      method: 'GET',
      headers: {
        Authorization: 'Bearer valid-api-key',
      },
      url: '/api/v1/webhooks?taskId=task-123',
    })

    const response = await GET(request)

    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.data).toBeDefined()
    expect(data.data.deliveries).toBeDefined()
  })

  it('缺少 taskId 時應返回 400', async () => {
    const request = createMockRequest({
      method: 'GET',
      headers: {
        Authorization: 'Bearer valid-api-key',
      },
      url: '/api/v1/webhooks',
    })

    const response = await GET(request)

    expect(response.status).toBe(400)
    const data = await response.json()
    expect(data.error.code).toBe('MISSING_TASK_ID')
  })
})
```

---

## 9. 實作注意事項

### 9.1 安全考量
- Webhook Secret 應使用強隨機字串（建議 32+ 字元）
- 簽名驗證應使用 timing-safe 比較防止時序攻擊
- 時間戳驗證應設置合理容差（5 分鐘）防止重放攻擊
- 僅支援 HTTPS 回調 URL

### 9.2 效能優化
- 使用異步發送避免阻塞主流程
- 批次處理重試佇列（每次處理 100 筆）
- 設置合理的請求超時（30 秒）
- 使用連接池管理 HTTP 請求

### 9.3 可靠性保證
- 發送記錄持久化確保不丟失
- 重試機制採用指數退避策略
- 失敗後發送告警通知管理員
- 提供手動重試功能

### 9.4 監控需求
- 追蹤發送成功率（目標 > 99%）
- 監控平均重試次數
- 記錄失敗原因分佈
- 追蹤發送延遲

---

## 10. 部署注意事項

### 10.1 環境變數
```bash
# Webhook 設定
WEBHOOK_DEFAULT_SECRET=your-default-webhook-secret
WEBHOOK_TIMEOUT_MS=30000
WEBHOOK_MAX_RETRIES=3
WEBHOOK_RETRY_JOB_INTERVAL_MS=60000
```

### 10.2 啟動排程任務

```typescript
// 在應用程式啟動時初始化
// app/api/startup.ts 或 middleware 中

import { webhookRetryJob } from '@/lib/jobs/webhookRetryJob'

// 在生產環境啟動
if (process.env.NODE_ENV === 'production') {
  webhookRetryJob.start(
    parseInt(process.env.WEBHOOK_RETRY_JOB_INTERVAL_MS || '60000')
  )
}
```

### 10.3 監控指標
| 指標 | 說明 | 告警閾值 |
|------|------|----------|
| webhook_delivery_success_rate | 發送成功率 | < 99% |
| webhook_delivery_latency_p95 | P95 發送延遲 | > 5s |
| webhook_retry_count_avg | 平均重試次數 | > 1.5 |
| webhook_failure_count | 最終失敗次數 | > 10/hour |

### 10.4 告警設定
- 發送成功率低於 95% 時觸發告警
- 連續 3 次發送失敗時通知
- 待重試佇列超過 1000 筆時告警

---

## 11. 相依性

### 11.1 內部相依
| 相依項目 | 說明 |
|----------|------|
| Story 11-1 | 任務提交時指定 callbackUrl |
| Story 11-5 | Webhook Secret 管理 |
| Story 10-1 | 事件觸發機制參考 |

### 11.2 外部相依
| 相依項目 | 版本 | 說明 |
|----------|------|------|
| crypto (Node.js) | Built-in | HMAC-SHA256 簽名 |

### 11.3 API 端點摘要
| 端點 | 方法 | 說明 |
|------|------|------|
| `/api/v1/webhooks?taskId={taskId}` | GET | 獲取發送歷史 |
| `/api/v1/webhooks/{deliveryId}/retry` | POST | 手動重試 |
| `/api/v1/webhooks/stats` | GET | 發送統計 |
