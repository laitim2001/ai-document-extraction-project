# Tech Spec: Story 10-2 - Webhook 配置管理

## 概述

### Story 資訊
- **Story ID**: 10-2
- **標題**: Webhook 配置管理
- **Epic**: 10 - n8n 工作流整合
- **故事點數**: 8
- **優先級**: High

### 目標
提供完整的 Webhook 配置管理功能，讓系統管理員可以配置 n8n Webhook 設定，包含基礎 URL、認證 Token、重試策略，並支援城市級別的獨立配置。

### 相依性
- Story 10-1: n8n 雙向通訊 API（使用 Webhook 配置發送事件）
- Story 10-7: n8n 連接狀態監控（監控 Webhook 健康狀態）

---

## 1. 資料庫設計

### 1.1 Prisma Schema

```prisma
// ============================================
// Webhook 配置模型
// ============================================
model WebhookConfig {
  id              String    @id @default(cuid())

  // 基本配置
  name            String    // 配置名稱
  description     String?   // 描述

  // 連線設定
  baseUrl         String    // n8n 基礎 URL (e.g., https://n8n.example.com)
  endpointPath    String    // Webhook 端點路徑 (e.g., /webhook/invoice)
  authToken       String    // AES-256-GCM 加密儲存的認證 Token

  // 城市關聯
  cityCode        String?   // null 表示全域配置
  city            City?     @relation(fields: [cityCode], references: [code])

  // 重試策略
  retryStrategy   Json      // { maxAttempts: 3, delays: [1000, 5000, 30000] }
  timeoutMs       Int       @default(30000) // 預設 30 秒超時

  // 事件訂閱
  subscribedEvents String[] // 訂閱的事件類型

  // 狀態
  isActive        Boolean   @default(true)

  // 連線測試狀態
  lastTestAt      DateTime?
  lastTestResult  WebhookTestResult?
  lastTestError   String?

  // 審計
  createdBy       String
  createdAt       DateTime  @default(now())
  updatedBy       String?
  updatedAt       DateTime  @updatedAt

  // 關聯
  history         WebhookConfigHistory[]

  @@unique([cityCode, name])
  @@index([cityCode])
  @@index([isActive])
}

// ============================================
// Webhook 測試結果枚舉
// ============================================
enum WebhookTestResult {
  SUCCESS   // 連線成功
  FAILED    // 連線失敗 (HTTP 錯誤)
  TIMEOUT   // 連線逾時
  ERROR     // 系統錯誤
}

// ============================================
// Webhook 配置變更歷史
// ============================================
model WebhookConfigHistory {
  id              String    @id @default(cuid())
  configId        String
  config          WebhookConfig @relation(fields: [configId], references: [id], onDelete: Cascade)

  // 變更內容
  changeType      ConfigChangeType
  previousValue   Json?     // 變更前的值（敏感欄位脫敏）
  newValue        Json?     // 變更後的值（敏感欄位脫敏）

  // 審計
  changedBy       String
  changedAt       DateTime  @default(now())
  reason          String?   // 變更原因（可選）

  @@index([configId])
  @@index([changedAt])
  @@index([changeType])
}

// ============================================
// 配置變更類型枚舉
// ============================================
enum ConfigChangeType {
  CREATED       // 創建配置
  UPDATED       // 更新配置
  ACTIVATED     // 啟用配置
  DEACTIVATED   // 停用配置
  DELETED       // 刪除配置
}
```

### 1.2 索引策略

| 表名 | 索引 | 用途 |
|------|------|------|
| WebhookConfig | `cityCode, name` (unique) | 確保城市內配置名稱唯一 |
| WebhookConfig | `cityCode, isActive` | 查詢城市的有效配置 |
| WebhookConfig | `isActive` | 列出所有啟用/停用的配置 |
| WebhookConfigHistory | `configId, changedAt` | 查詢配置變更歷史 |
| WebhookConfigHistory | `changeType` | 按變更類型統計 |

---

## 2. 類型定義

### 2.1 Webhook 配置類型

```typescript
// types/n8n/webhookConfig.ts

export interface WebhookConfigInfo {
  id: string
  name: string
  description?: string
  baseUrl: string
  endpointPath: string
  fullUrl: string  // computed: baseUrl + endpointPath
  cityCode?: string
  cityName?: string
  retryStrategy: RetryStrategy
  timeoutMs: number
  subscribedEvents: WebhookEventType[]
  isActive: boolean
  lastTestAt?: Date
  lastTestResult?: WebhookTestResult
  lastTestError?: string
  createdBy: string
  createdAt: Date
  updatedBy?: string
  updatedAt: Date
}

export interface RetryStrategy {
  maxAttempts: number  // 最大重試次數 (1-10)
  delays: number[]     // 重試間隔陣列，單位毫秒
}

export type WebhookEventType =
  | 'DOCUMENT_RECEIVED'
  | 'DOCUMENT_PROCESSING'
  | 'DOCUMENT_COMPLETED'
  | 'DOCUMENT_FAILED'
  | 'DOCUMENT_REVIEW_NEEDED'
  | 'WORKFLOW_STARTED'
  | 'WORKFLOW_COMPLETED'
  | 'WORKFLOW_FAILED'

export type WebhookTestResult = 'SUCCESS' | 'FAILED' | 'TIMEOUT' | 'ERROR'
```

### 2.2 配置操作類型

```typescript
// types/n8n/webhookConfigOperations.ts

export interface CreateWebhookConfigInput {
  name: string
  description?: string
  baseUrl: string
  endpointPath: string
  authToken: string
  cityCode?: string  // null = 全域配置
  retryStrategy?: RetryStrategy
  timeoutMs?: number
  subscribedEvents: WebhookEventType[]
  createdBy: string
}

export interface UpdateWebhookConfigInput {
  name?: string
  description?: string
  baseUrl?: string
  endpointPath?: string
  authToken?: string  // 只在提供時更新
  retryStrategy?: RetryStrategy
  timeoutMs?: number
  subscribedEvents?: WebhookEventType[]
  isActive?: boolean
  updatedBy: string
}

export interface WebhookTestRequest {
  baseUrl: string
  endpointPath: string
  authToken: string
  timeoutMs: number
}

export interface WebhookTestResponse {
  success: boolean
  result: WebhookTestResult
  responseTime?: number
  statusCode?: number
  error?: string
  testedAt: Date
}

export interface ListWebhookConfigsOptions {
  cityCode?: string
  isActive?: boolean
  includeGlobal?: boolean
  page?: number
  pageSize?: number
}
```

### 2.3 配置歷史類型

```typescript
// types/n8n/webhookConfigHistory.ts

export type ConfigChangeType =
  | 'CREATED'
  | 'UPDATED'
  | 'ACTIVATED'
  | 'DEACTIVATED'
  | 'DELETED'

export interface WebhookConfigHistoryEntry {
  id: string
  configId: string
  changeType: ConfigChangeType
  previousValue?: Record<string, unknown>
  newValue?: Record<string, unknown>
  changedBy: string
  changedByName?: string
  changedAt: Date
  reason?: string
}

export interface GetHistoryOptions {
  configId: string
  changeType?: ConfigChangeType
  startDate?: Date
  endDate?: Date
  limit?: number
}
```

---

## 3. 服務實現

### 3.1 加密工具

```typescript
// lib/utils/encryption.ts

import { createCipheriv, createDecipheriv, randomBytes, scrypt } from 'crypto'
import { promisify } from 'util'

const scryptAsync = promisify(scrypt)

const ALGORITHM = 'aes-256-gcm'
const KEY_LENGTH = 32
const IV_LENGTH = 16
const AUTH_TAG_LENGTH = 16
const SALT_LENGTH = 32

/**
 * 加密敏感資料
 */
export async function encrypt(plaintext: string): Promise<string> {
  const encryptionKey = process.env.WEBHOOK_ENCRYPTION_KEY
  if (!encryptionKey) {
    throw new Error('WEBHOOK_ENCRYPTION_KEY is not configured')
  }

  const salt = randomBytes(SALT_LENGTH)
  const key = (await scryptAsync(encryptionKey, salt, KEY_LENGTH)) as Buffer
  const iv = randomBytes(IV_LENGTH)

  const cipher = createCipheriv(ALGORITHM, key, iv)
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ])
  const authTag = cipher.getAuthTag()

  // 格式: salt:iv:authTag:encrypted (all base64)
  return [
    salt.toString('base64'),
    iv.toString('base64'),
    authTag.toString('base64'),
    encrypted.toString('base64'),
  ].join(':')
}

/**
 * 解密敏感資料
 */
export async function decrypt(ciphertext: string): Promise<string> {
  const encryptionKey = process.env.WEBHOOK_ENCRYPTION_KEY
  if (!encryptionKey) {
    throw new Error('WEBHOOK_ENCRYPTION_KEY is not configured')
  }

  const [saltB64, ivB64, authTagB64, encryptedB64] = ciphertext.split(':')

  if (!saltB64 || !ivB64 || !authTagB64 || !encryptedB64) {
    throw new Error('Invalid ciphertext format')
  }

  const salt = Buffer.from(saltB64, 'base64')
  const iv = Buffer.from(ivB64, 'base64')
  const authTag = Buffer.from(authTagB64, 'base64')
  const encrypted = Buffer.from(encryptedB64, 'base64')

  const key = (await scryptAsync(encryptionKey, salt, KEY_LENGTH)) as Buffer

  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)

  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ])

  return decrypted.toString('utf8')
}
```

### 3.2 Webhook 配置服務

```typescript
// lib/services/n8n/webhookConfigService.ts

import { prisma } from '@/lib/prisma'
import { encrypt, decrypt } from '@/lib/utils/encryption'
import {
  WebhookConfig,
  WebhookTestResult,
  ConfigChangeType,
} from '@prisma/client'
import {
  CreateWebhookConfigInput,
  UpdateWebhookConfigInput,
  WebhookTestResponse,
  WebhookConfigInfo,
  ListWebhookConfigsOptions,
  RetryStrategy,
} from '@/types/n8n'

const DEFAULT_RETRY_STRATEGY: RetryStrategy = {
  maxAttempts: 3,
  delays: [1000, 5000, 30000], // 1秒, 5秒, 30秒
}

const DEFAULT_TIMEOUT_MS = 30000 // 30 秒

export class WebhookConfigService {
  // ============================================
  // 創建配置
  // ============================================
  async createConfig(input: CreateWebhookConfigInput): Promise<WebhookConfigInfo> {
    // 驗證 URL 格式
    this.validateUrl(input.baseUrl, input.endpointPath)

    // 加密 authToken
    const encryptedToken = await encrypt(input.authToken)

    // 正規化 URL
    const normalizedBaseUrl = input.baseUrl.replace(/\/$/, '')
    const normalizedPath = input.endpointPath.startsWith('/')
      ? input.endpointPath
      : `/${input.endpointPath}`

    const config = await prisma.webhookConfig.create({
      data: {
        name: input.name,
        description: input.description,
        baseUrl: normalizedBaseUrl,
        endpointPath: normalizedPath,
        authToken: encryptedToken,
        cityCode: input.cityCode || null,
        retryStrategy: input.retryStrategy || DEFAULT_RETRY_STRATEGY,
        timeoutMs: input.timeoutMs || DEFAULT_TIMEOUT_MS,
        subscribedEvents: input.subscribedEvents,
        createdBy: input.createdBy,
      },
      include: {
        city: true,
      },
    })

    // 記錄歷史
    await this.recordHistory({
      configId: config.id,
      changeType: 'CREATED',
      newValue: this.sanitizeForHistory(config),
      changedBy: input.createdBy,
    })

    return this.toConfigInfo(config)
  }

  // ============================================
  // 更新配置
  // ============================================
  async updateConfig(
    id: string,
    input: UpdateWebhookConfigInput
  ): Promise<WebhookConfigInfo> {
    const existing = await prisma.webhookConfig.findUnique({
      where: { id },
      include: { city: true },
    })

    if (!existing) {
      throw new Error('Webhook config not found')
    }

    const updateData: any = {
      updatedBy: input.updatedBy,
      updatedAt: new Date(),
    }

    // 更新各欄位
    if (input.name !== undefined) {
      updateData.name = input.name
    }
    if (input.description !== undefined) {
      updateData.description = input.description
    }
    if (input.baseUrl !== undefined) {
      this.validateUrl(input.baseUrl, input.endpointPath || existing.endpointPath)
      updateData.baseUrl = input.baseUrl.replace(/\/$/, '')
    }
    if (input.endpointPath !== undefined) {
      this.validateUrl(input.baseUrl || existing.baseUrl, input.endpointPath)
      updateData.endpointPath = input.endpointPath.startsWith('/')
        ? input.endpointPath
        : `/${input.endpointPath}`
    }
    if (input.authToken !== undefined) {
      updateData.authToken = await encrypt(input.authToken)
    }
    if (input.retryStrategy !== undefined) {
      this.validateRetryStrategy(input.retryStrategy)
      updateData.retryStrategy = input.retryStrategy
    }
    if (input.timeoutMs !== undefined) {
      if (input.timeoutMs < 1000 || input.timeoutMs > 300000) {
        throw new Error('Timeout must be between 1000ms and 300000ms')
      }
      updateData.timeoutMs = input.timeoutMs
    }
    if (input.subscribedEvents !== undefined) {
      updateData.subscribedEvents = input.subscribedEvents
    }
    if (input.isActive !== undefined) {
      updateData.isActive = input.isActive
    }

    const updated = await prisma.webhookConfig.update({
      where: { id },
      data: updateData,
      include: { city: true },
    })

    // 決定變更類型
    let changeType: ConfigChangeType = 'UPDATED'
    if (input.isActive !== undefined && input.isActive !== existing.isActive) {
      changeType = input.isActive ? 'ACTIVATED' : 'DEACTIVATED'
    }

    // 記錄歷史
    await this.recordHistory({
      configId: id,
      changeType,
      previousValue: this.sanitizeForHistory(existing),
      newValue: this.sanitizeForHistory(updated),
      changedBy: input.updatedBy,
    })

    return this.toConfigInfo(updated)
  }

  // ============================================
  // 測試連線
  // ============================================
  async testConnection(id: string): Promise<WebhookTestResponse> {
    const config = await prisma.webhookConfig.findUnique({
      where: { id },
    })

    if (!config) {
      throw new Error('Webhook config not found')
    }

    return this.performTest({
      baseUrl: config.baseUrl,
      endpointPath: config.endpointPath,
      authToken: await decrypt(config.authToken),
      timeoutMs: config.timeoutMs,
      configId: id,
    })
  }

  /**
   * 即時測試連線（不需要保存配置）
   */
  async testConnectionAdhoc(input: {
    baseUrl: string
    endpointPath: string
    authToken: string
    timeoutMs?: number
  }): Promise<WebhookTestResponse> {
    return this.performTest({
      baseUrl: input.baseUrl,
      endpointPath: input.endpointPath,
      authToken: input.authToken,
      timeoutMs: input.timeoutMs || DEFAULT_TIMEOUT_MS,
    })
  }

  /**
   * 執行連線測試
   */
  private async performTest(input: {
    baseUrl: string
    endpointPath: string
    authToken: string
    timeoutMs: number
    configId?: string
  }): Promise<WebhookTestResponse> {
    const webhookUrl = `${input.baseUrl}${input.endpointPath}`
    const startTime = Date.now()
    const testedAt = new Date()

    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), input.timeoutMs)

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${input.authToken}`,
          'X-Test-Request': 'true',
          'X-Source': 'Invoice-Processing-Platform',
        },
        body: JSON.stringify({
          event: 'test',
          timestamp: testedAt.toISOString(),
          message: 'Connection test from Invoice Processing Platform',
        }),
        signal: controller.signal,
      })

      clearTimeout(timeoutId)
      const responseTime = Date.now() - startTime

      const result: WebhookTestResult = response.ok ? 'SUCCESS' : 'FAILED'
      const error = response.ok
        ? undefined
        : `HTTP ${response.status}: ${response.statusText}`

      // 更新配置的測試結果
      if (input.configId) {
        await prisma.webhookConfig.update({
          where: { id: input.configId },
          data: {
            lastTestAt: testedAt,
            lastTestResult: result,
            lastTestError: error || null,
          },
        })
      }

      return {
        success: response.ok,
        result,
        responseTime,
        statusCode: response.status,
        error,
        testedAt,
      }
    } catch (error) {
      const responseTime = Date.now() - startTime

      let result: WebhookTestResult = 'ERROR'
      let errorMessage = 'Unknown error'

      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          result = 'TIMEOUT'
          errorMessage = `Request timeout after ${input.timeoutMs}ms`
        } else {
          errorMessage = error.message
        }
      }

      // 更新配置的測試結果
      if (input.configId) {
        await prisma.webhookConfig.update({
          where: { id: input.configId },
          data: {
            lastTestAt: testedAt,
            lastTestResult: result,
            lastTestError: errorMessage,
          },
        })
      }

      return {
        success: false,
        result,
        responseTime,
        error: errorMessage,
        testedAt,
      }
    }
  }

  // ============================================
  // 查詢配置
  // ============================================
  async getConfig(id: string): Promise<WebhookConfigInfo | null> {
    const config = await prisma.webhookConfig.findUnique({
      where: { id },
      include: { city: true },
    })

    return config ? this.toConfigInfo(config) : null
  }

  /**
   * 獲取配置（含解密 Token）- 僅限內部使用
   */
  async getConfigWithToken(id: string): Promise<WebhookConfigInfo & { decryptedToken: string }> {
    const config = await prisma.webhookConfig.findUnique({
      where: { id },
      include: { city: true },
    })

    if (!config) {
      throw new Error('Webhook config not found')
    }

    const decryptedToken = await decrypt(config.authToken)

    return {
      ...this.toConfigInfo(config),
      decryptedToken,
    }
  }

  /**
   * 列出配置
   */
  async listConfigs(options: ListWebhookConfigsOptions = {}): Promise<{
    items: WebhookConfigInfo[]
    total: number
  }> {
    const {
      cityCode,
      isActive,
      includeGlobal = true,
      page = 1,
      pageSize = 20,
    } = options

    const where: any = {}

    if (isActive !== undefined) {
      where.isActive = isActive
    }

    if (cityCode) {
      if (includeGlobal) {
        where.OR = [
          { cityCode },
          { cityCode: null },
        ]
      } else {
        where.cityCode = cityCode
      }
    }

    const [items, total] = await Promise.all([
      prisma.webhookConfig.findMany({
        where,
        include: { city: true },
        orderBy: [
          { cityCode: 'asc' },
          { name: 'asc' },
        ],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.webhookConfig.count({ where }),
    ])

    return {
      items: items.map(this.toConfigInfo),
      total,
    }
  }

  /**
   * 獲取城市的有效配置（優先城市特定配置）
   */
  async getActiveConfigForCity(cityCode: string): Promise<WebhookConfigInfo | null> {
    const config = await prisma.webhookConfig.findFirst({
      where: {
        isActive: true,
        OR: [
          { cityCode },
          { cityCode: null },
        ],
      },
      orderBy: {
        cityCode: 'desc', // 城市特定配置優先於全域配置
      },
      include: { city: true },
    })

    return config ? this.toConfigInfo(config) : null
  }

  // ============================================
  // 刪除配置
  // ============================================
  async deleteConfig(id: string, deletedBy: string): Promise<void> {
    const config = await prisma.webhookConfig.findUnique({
      where: { id },
    })

    if (!config) {
      throw new Error('Webhook config not found')
    }

    // 記錄刪除歷史
    await this.recordHistory({
      configId: id,
      changeType: 'DELETED',
      previousValue: this.sanitizeForHistory(config),
      changedBy: deletedBy,
    })

    await prisma.webhookConfig.delete({
      where: { id },
    })
  }

  // ============================================
  // 歷史記錄
  // ============================================
  async getConfigHistory(
    configId: string,
    options: { limit?: number } = {}
  ): Promise<any[]> {
    const { limit = 50 } = options

    return prisma.webhookConfigHistory.findMany({
      where: { configId },
      orderBy: { changedAt: 'desc' },
      take: limit,
    })
  }

  /**
   * 記錄變更歷史
   */
  private async recordHistory(input: {
    configId: string
    changeType: ConfigChangeType
    previousValue?: any
    newValue?: any
    changedBy: string
    reason?: string
  }): Promise<void> {
    await prisma.webhookConfigHistory.create({
      data: {
        configId: input.configId,
        changeType: input.changeType,
        previousValue: input.previousValue,
        newValue: input.newValue,
        changedBy: input.changedBy,
        reason: input.reason,
      },
    })
  }

  // ============================================
  // 輔助方法
  // ============================================

  /**
   * 驗證 URL 格式
   */
  private validateUrl(baseUrl: string, endpointPath: string): void {
    try {
      const normalizedPath = endpointPath.startsWith('/') ? endpointPath : `/${endpointPath}`
      new URL(normalizedPath, baseUrl)
    } catch {
      throw new Error('Invalid URL format')
    }
  }

  /**
   * 驗證重試策略
   */
  private validateRetryStrategy(strategy: RetryStrategy): void {
    if (strategy.maxAttempts < 1 || strategy.maxAttempts > 10) {
      throw new Error('maxAttempts must be between 1 and 10')
    }
    if (!Array.isArray(strategy.delays) || strategy.delays.length === 0) {
      throw new Error('delays must be a non-empty array')
    }
    for (const delay of strategy.delays) {
      if (delay < 100 || delay > 300000) {
        throw new Error('Each delay must be between 100ms and 300000ms')
      }
    }
  }

  /**
   * 脫敏處理用於歷史記錄
   */
  private sanitizeForHistory(config: any): Record<string, unknown> {
    const { authToken, ...rest } = config
    return {
      ...rest,
      authToken: '[REDACTED]',
    }
  }

  /**
   * 轉換為配置資訊
   */
  private toConfigInfo(config: any): WebhookConfigInfo {
    return {
      id: config.id,
      name: config.name,
      description: config.description,
      baseUrl: config.baseUrl,
      endpointPath: config.endpointPath,
      fullUrl: `${config.baseUrl}${config.endpointPath}`,
      cityCode: config.cityCode,
      cityName: config.city?.name,
      retryStrategy: config.retryStrategy as RetryStrategy,
      timeoutMs: config.timeoutMs,
      subscribedEvents: config.subscribedEvents,
      isActive: config.isActive,
      lastTestAt: config.lastTestAt,
      lastTestResult: config.lastTestResult,
      lastTestError: config.lastTestError,
      createdBy: config.createdBy,
      createdAt: config.createdAt,
      updatedBy: config.updatedBy,
      updatedAt: config.updatedAt,
    }
  }
}

export const webhookConfigService = new WebhookConfigService()
```

---

## 4. API 路由

### 4.1 配置列表與創建

```typescript
// app/api/admin/webhook-configs/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { webhookConfigService } from '@/lib/services/n8n/webhookConfigService'
import { hasPermission } from '@/lib/utils/permissions'
import { z } from 'zod'

const createConfigSchema = z.object({
  name: z.string().min(1, '名稱不能為空').max(100, '名稱最多 100 字元'),
  description: z.string().max(500, '描述最多 500 字元').optional(),
  baseUrl: z.string().url('請輸入有效的 URL'),
  endpointPath: z.string().min(1, '端點路徑不能為空'),
  authToken: z.string().min(1, '認證 Token 不能為空'),
  cityCode: z.string().optional(),
  retryStrategy: z.object({
    maxAttempts: z.number().min(1).max(10),
    delays: z.array(z.number().min(100).max(300000)).min(1).max(10),
  }).optional(),
  timeoutMs: z.number().min(1000).max(300000).optional(),
  subscribedEvents: z.array(z.string()).default([]),
})

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)

  if (!session?.user || !hasPermission(session.user, 'admin:webhook:read')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const searchParams = request.nextUrl.searchParams
  const cityCode = searchParams.get('cityCode') || undefined
  const isActive = searchParams.get('isActive')
  const page = parseInt(searchParams.get('page') || '1')
  const pageSize = parseInt(searchParams.get('pageSize') || '20')

  try {
    const result = await webhookConfigService.listConfigs({
      cityCode,
      isActive: isActive === null ? undefined : isActive === 'true',
      includeGlobal: true,
      page,
      pageSize,
    })

    return NextResponse.json({
      data: result.items,
      pagination: {
        page,
        pageSize,
        total: result.total,
        totalPages: Math.ceil(result.total / pageSize),
      },
    })
  } catch (error) {
    console.error('List webhook configs error:', error)
    return NextResponse.json(
      { error: 'Failed to list webhook configs' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)

  if (!session?.user || !hasPermission(session.user, 'admin:webhook:write')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  try {
    const body = await request.json()
    const validatedData = createConfigSchema.parse(body)

    const config = await webhookConfigService.createConfig({
      ...validatedData,
      createdBy: session.user.id,
    })

    return NextResponse.json({ data: config }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Create webhook config error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create webhook config' },
      { status: 500 }
    )
  }
}
```

### 4.2 單一配置操作

```typescript
// app/api/admin/webhook-configs/[id]/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { webhookConfigService } from '@/lib/services/n8n/webhookConfigService'
import { hasPermission } from '@/lib/utils/permissions'
import { z } from 'zod'

const updateConfigSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional().nullable(),
  baseUrl: z.string().url().optional(),
  endpointPath: z.string().min(1).optional(),
  authToken: z.string().min(1).optional(),
  retryStrategy: z.object({
    maxAttempts: z.number().min(1).max(10),
    delays: z.array(z.number().min(100).max(300000)).min(1).max(10),
  }).optional(),
  timeoutMs: z.number().min(1000).max(300000).optional(),
  subscribedEvents: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
})

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)

  if (!session?.user || !hasPermission(session.user, 'admin:webhook:read')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  try {
    const config = await webhookConfigService.getConfig(params.id)

    if (!config) {
      return NextResponse.json({ error: 'Config not found' }, { status: 404 })
    }

    return NextResponse.json({ data: config })
  } catch (error) {
    console.error('Get webhook config error:', error)
    return NextResponse.json(
      { error: 'Failed to get webhook config' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)

  if (!session?.user || !hasPermission(session.user, 'admin:webhook:write')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  try {
    const body = await request.json()
    const validatedData = updateConfigSchema.parse(body)

    const config = await webhookConfigService.updateConfig(params.id, {
      ...validatedData,
      updatedBy: session.user.id,
    })

    return NextResponse.json({ data: config })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Update webhook config error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update webhook config' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)

  if (!session?.user || !hasPermission(session.user, 'admin:webhook:delete')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  try {
    await webhookConfigService.deleteConfig(params.id, session.user.id)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete webhook config error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete webhook config' },
      { status: 500 }
    )
  }
}
```

### 4.3 連線測試

```typescript
// app/api/admin/webhook-configs/[id]/test/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { webhookConfigService } from '@/lib/services/n8n/webhookConfigService'
import { hasPermission } from '@/lib/utils/permissions'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)

  if (!session?.user || !hasPermission(session.user, 'admin:webhook:write')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  try {
    const result = await webhookConfigService.testConnection(params.id)
    return NextResponse.json({ data: result })
  } catch (error) {
    console.error('Test webhook connection error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to test webhook connection' },
      { status: 500 }
    )
  }
}
```

### 4.4 即時測試（不需保存配置）

```typescript
// app/api/admin/webhook-configs/test-adhoc/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { webhookConfigService } from '@/lib/services/n8n/webhookConfigService'
import { hasPermission } from '@/lib/utils/permissions'
import { z } from 'zod'

const testAdhocSchema = z.object({
  baseUrl: z.string().url(),
  endpointPath: z.string().min(1),
  authToken: z.string().min(1),
  timeoutMs: z.number().min(1000).max(300000).optional(),
})

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)

  if (!session?.user || !hasPermission(session.user, 'admin:webhook:write')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  try {
    const body = await request.json()
    const validatedData = testAdhocSchema.parse(body)

    const result = await webhookConfigService.testConnectionAdhoc(validatedData)
    return NextResponse.json({ data: result })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Test adhoc webhook connection error:', error)
    return NextResponse.json(
      { error: 'Failed to test webhook connection' },
      { status: 500 }
    )
  }
}
```

### 4.5 配置歷史

```typescript
// app/api/admin/webhook-configs/[id]/history/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { webhookConfigService } from '@/lib/services/n8n/webhookConfigService'
import { hasPermission } from '@/lib/utils/permissions'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)

  if (!session?.user || !hasPermission(session.user, 'admin:webhook:read')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const searchParams = request.nextUrl.searchParams
  const limit = parseInt(searchParams.get('limit') || '50')

  try {
    const history = await webhookConfigService.getConfigHistory(params.id, { limit })
    return NextResponse.json({ data: history })
  } catch (error) {
    console.error('Get webhook config history error:', error)
    return NextResponse.json(
      { error: 'Failed to get webhook config history' },
      { status: 500 }
    )
  }
}
```

---

## 5. 前端組件

### 5.1 Webhook 配置表單

```typescript
// components/admin/webhook/WebhookConfigForm.tsx

'use client'

import React, { useState } from 'react'
import { useForm, useFieldArray, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Box,
  Button,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Switch,
  FormControlLabel,
  Alert,
  CircularProgress,
  IconButton,
  Chip,
  Typography,
  Divider,
  Paper,
  Grid,
  Tooltip,
} from '@mui/material'
import {
  Add,
  Delete,
  PlayArrow,
  Check,
  Error,
  Timer,
  Info,
} from '@mui/icons-material'

const formSchema = z.object({
  name: z.string().min(1, '請輸入名稱').max(100, '名稱最多 100 字元'),
  description: z.string().max(500).optional(),
  baseUrl: z.string().url('請輸入有效的 URL'),
  endpointPath: z.string().min(1, '請輸入端點路徑'),
  authToken: z.string().min(1, '請輸入認證 Token'),
  cityCode: z.string().optional(),
  timeoutMs: z.number().min(1000).max(300000),
  maxAttempts: z.number().min(1).max(10),
  delays: z.array(z.object({
    value: z.number().min(100).max(300000),
  })).min(1),
  subscribedEvents: z.array(z.string()),
  isActive: z.boolean(),
})

type FormData = z.infer<typeof formSchema>

interface WebhookConfigFormProps {
  initialData?: Partial<FormData>
  cities: Array<{ code: string; name: string }>
  onSubmit: (data: FormData) => Promise<void>
  onCancel: () => void
  isEdit?: boolean
}

const EVENT_OPTIONS = [
  { value: 'DOCUMENT_RECEIVED', label: '文件已接收' },
  { value: 'DOCUMENT_PROCESSING', label: '處理中' },
  { value: 'DOCUMENT_COMPLETED', label: '處理完成' },
  { value: 'DOCUMENT_FAILED', label: '處理失敗' },
  { value: 'DOCUMENT_REVIEW_NEEDED', label: '需要人工審核' },
  { value: 'WORKFLOW_STARTED', label: '工作流已啟動' },
  { value: 'WORKFLOW_COMPLETED', label: '工作流已完成' },
  { value: 'WORKFLOW_FAILED', label: '工作流失敗' },
]

export function WebhookConfigForm({
  initialData,
  cities,
  onSubmit,
  onCancel,
  isEdit = false,
}: WebhookConfigFormProps) {
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{
    success: boolean
    message: string
    responseTime?: number
  } | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: initialData?.name || '',
      description: initialData?.description || '',
      baseUrl: initialData?.baseUrl || '',
      endpointPath: initialData?.endpointPath || '/webhook',
      authToken: '',
      cityCode: initialData?.cityCode || '',
      timeoutMs: initialData?.timeoutMs || 30000,
      maxAttempts: initialData?.maxAttempts || 3,
      delays: initialData?.delays || [
        { value: 1000 },
        { value: 5000 },
        { value: 30000 },
      ],
      subscribedEvents: initialData?.subscribedEvents || [],
      isActive: initialData?.isActive ?? true,
    },
  })

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'delays',
  })

  const subscribedEvents = watch('subscribedEvents')

  const handleTest = async () => {
    setTesting(true)
    setTestResult(null)

    try {
      const response = await fetch('/api/admin/webhook-configs/test-adhoc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          baseUrl: watch('baseUrl'),
          endpointPath: watch('endpointPath'),
          authToken: watch('authToken'),
          timeoutMs: watch('timeoutMs'),
        }),
      })

      const data = await response.json()

      if (data.data) {
        setTestResult({
          success: data.data.success,
          message: data.data.success
            ? '連線成功'
            : data.data.error || '連線失敗',
          responseTime: data.data.responseTime,
        })
      } else {
        setTestResult({
          success: false,
          message: data.error || '測試請求失敗',
        })
      }
    } catch (error) {
      setTestResult({
        success: false,
        message: '測試請求失敗',
      })
    } finally {
      setTesting(false)
    }
  }

  const toggleEvent = (eventValue: string) => {
    const current = watch('subscribedEvents') || []
    if (current.includes(eventValue)) {
      setValue('subscribedEvents', current.filter(e => e !== eventValue))
    } else {
      setValue('subscribedEvents', [...current, eventValue])
    }
  }

  const onFormSubmit = async (data: FormData) => {
    setSubmitting(true)
    try {
      await onSubmit(data)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onFormSubmit)}>
      <Paper sx={{ p: 3 }}>
        {/* 基本資訊 */}
        <Typography variant="h6" gutterBottom>
          基本資訊
        </Typography>

        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <TextField
              {...register('name')}
              label="配置名稱"
              fullWidth
              error={!!errors.name}
              helperText={errors.name?.message}
              required
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <FormControl fullWidth>
              <InputLabel>適用城市</InputLabel>
              <Controller
                name="cityCode"
                control={control}
                render={({ field }) => (
                  <Select {...field} label="適用城市">
                    <MenuItem value="">全域（所有城市）</MenuItem>
                    {cities.map((city) => (
                      <MenuItem key={city.code} value={city.code}>
                        {city.name}
                      </MenuItem>
                    ))}
                  </Select>
                )}
              />
            </FormControl>
          </Grid>
          <Grid item xs={12}>
            <TextField
              {...register('description')}
              label="描述"
              fullWidth
              multiline
              rows={2}
              error={!!errors.description}
              helperText={errors.description?.message}
            />
          </Grid>
        </Grid>

        <Divider sx={{ my: 3 }} />

        {/* 連線設定 */}
        <Typography variant="h6" gutterBottom>
          連線設定
        </Typography>

        <Grid container spacing={2}>
          <Grid item xs={12} md={8}>
            <TextField
              {...register('baseUrl')}
              label="n8n 基礎 URL"
              fullWidth
              placeholder="https://n8n.example.com"
              error={!!errors.baseUrl}
              helperText={errors.baseUrl?.message}
              required
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <TextField
              {...register('endpointPath')}
              label="Webhook 端點路徑"
              fullWidth
              placeholder="/webhook/invoice"
              error={!!errors.endpointPath}
              helperText={errors.endpointPath?.message}
              required
            />
          </Grid>
          <Grid item xs={12} md={8}>
            <TextField
              {...register('authToken')}
              label={isEdit ? '認證 Token（留空保持不變）' : '認證 Token'}
              type="password"
              fullWidth
              error={!!errors.authToken}
              helperText={errors.authToken?.message || '儲存後 Token 將被加密'}
              required={!isEdit}
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <TextField
              {...register('timeoutMs', { valueAsNumber: true })}
              label="超時時間（毫秒）"
              type="number"
              fullWidth
              error={!!errors.timeoutMs}
              helperText={errors.timeoutMs?.message}
            />
          </Grid>
        </Grid>

        {/* 測試連線按鈕 */}
        <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
          <Button
            variant="outlined"
            startIcon={testing ? <CircularProgress size={20} /> : <PlayArrow />}
            onClick={handleTest}
            disabled={testing || !watch('baseUrl') || !watch('authToken')}
          >
            測試連線
          </Button>

          {testResult && (
            <Alert
              severity={testResult.success ? 'success' : 'error'}
              icon={testResult.success ? <Check /> : <Error />}
              sx={{ flex: 1 }}
            >
              {testResult.message}
              {testResult.responseTime && ` (${testResult.responseTime}ms)`}
            </Alert>
          )}
        </Box>

        <Divider sx={{ my: 3 }} />

        {/* 重試策略 */}
        <Typography variant="h6" gutterBottom>
          重試策略
          <Tooltip title="當 Webhook 發送失敗時的自動重試設定">
            <Info fontSize="small" sx={{ ml: 1, verticalAlign: 'middle' }} />
          </Tooltip>
        </Typography>

        <Grid container spacing={2}>
          <Grid item xs={12} md={4}>
            <TextField
              {...register('maxAttempts', { valueAsNumber: true })}
              label="最大重試次數"
              type="number"
              fullWidth
              error={!!errors.maxAttempts}
              helperText={errors.maxAttempts?.message || '1-10 次'}
            />
          </Grid>
        </Grid>

        <Typography variant="body2" color="text.secondary" sx={{ mt: 2, mb: 1 }}>
          重試間隔（毫秒）
        </Typography>

        {fields.map((field, index) => (
          <Box key={field.id} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <TextField
              {...register(`delays.${index}.value`, { valueAsNumber: true })}
              label={`第 ${index + 1} 次重試`}
              type="number"
              size="small"
              sx={{ width: 200 }}
              error={!!errors.delays?.[index]}
              helperText={index === 0 ? '預設 1 秒' : index === 1 ? '預設 5 秒' : '預設 30 秒'}
            />
            {fields.length > 1 && (
              <IconButton onClick={() => remove(index)} color="error" size="small">
                <Delete />
              </IconButton>
            )}
          </Box>
        ))}

        {fields.length < 5 && (
          <Button
            startIcon={<Add />}
            onClick={() => append({ value: 60000 })}
            size="small"
          >
            添加重試間隔
          </Button>
        )}

        <Divider sx={{ my: 3 }} />

        {/* 事件訂閱 */}
        <Typography variant="h6" gutterBottom>
          訂閱事件
          <Tooltip title="選擇要通知 n8n 的事件類型">
            <Info fontSize="small" sx={{ ml: 1, verticalAlign: 'middle' }} />
          </Tooltip>
        </Typography>

        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          {EVENT_OPTIONS.map((event) => {
            const isSelected = subscribedEvents?.includes(event.value)
            return (
              <Chip
                key={event.value}
                label={event.label}
                onClick={() => toggleEvent(event.value)}
                color={isSelected ? 'primary' : 'default'}
                variant={isSelected ? 'filled' : 'outlined'}
                sx={{ cursor: 'pointer' }}
              />
            )
          })}
        </Box>

        <Divider sx={{ my: 3 }} />

        {/* 狀態 */}
        <FormControlLabel
          control={
            <Controller
              name="isActive"
              control={control}
              render={({ field }) => (
                <Switch {...field} checked={field.value} />
              )}
            />
          }
          label="啟用此配置"
        />

        {/* 操作按鈕 */}
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2, mt: 3 }}>
          <Button variant="outlined" onClick={onCancel}>
            取消
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={submitting}
            startIcon={submitting ? <CircularProgress size={20} /> : undefined}
          >
            {isEdit ? '更新' : '創建'}
          </Button>
        </Box>
      </Paper>
    </form>
  )
}
```

### 5.2 Webhook 配置列表

```typescript
// components/admin/webhook/WebhookConfigList.tsx

'use client'

import React from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Chip,
  Tooltip,
  Box,
  Typography,
  CircularProgress,
} from '@mui/material'
import {
  Edit,
  Delete,
  PlayArrow,
  Check,
  Error,
  Timer,
  Public,
  History,
} from '@mui/icons-material'
import { formatDistanceToNow } from 'date-fns'
import { zhTW } from 'date-fns/locale'

interface WebhookConfig {
  id: string
  name: string
  description?: string
  baseUrl: string
  endpointPath: string
  fullUrl: string
  cityCode?: string
  cityName?: string
  isActive: boolean
  lastTestAt?: Date
  lastTestResult?: 'SUCCESS' | 'FAILED' | 'TIMEOUT' | 'ERROR'
  lastTestError?: string
  subscribedEvents: string[]
  createdAt: Date
}

interface WebhookConfigListProps {
  configs: WebhookConfig[]
  loading?: boolean
  onEdit: (config: WebhookConfig) => void
  onDelete: (config: WebhookConfig) => void
  onTest: (config: WebhookConfig) => void
  onViewHistory: (config: WebhookConfig) => void
  testingId?: string
}

const testResultConfig: Record<string, {
  icon: React.ReactNode
  color: 'success' | 'error' | 'warning' | 'default'
  label: string
}> = {
  SUCCESS: { icon: <Check />, color: 'success', label: '成功' },
  FAILED: { icon: <Error />, color: 'error', label: '失敗' },
  TIMEOUT: { icon: <Timer />, color: 'warning', label: '逾時' },
  ERROR: { icon: <Error />, color: 'error', label: '錯誤' },
}

export function WebhookConfigList({
  configs,
  loading,
  onEdit,
  onDelete,
  onTest,
  onViewHistory,
  testingId,
}: WebhookConfigListProps) {
  return (
    <TableContainer component={Paper}>
      <Table>
        <TableHead>
          <TableRow>
            <TableCell>名稱</TableCell>
            <TableCell>Webhook URL</TableCell>
            <TableCell>適用城市</TableCell>
            <TableCell>訂閱事件</TableCell>
            <TableCell>狀態</TableCell>
            <TableCell>最後測試</TableCell>
            <TableCell align="right">操作</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {loading && (
            <TableRow>
              <TableCell colSpan={7} align="center">
                <CircularProgress size={24} />
              </TableCell>
            </TableRow>
          )}

          {!loading && configs.map((config) => {
            const testResult = config.lastTestResult
              ? testResultConfig[config.lastTestResult]
              : null

            return (
              <TableRow key={config.id}>
                <TableCell>
                  <Typography variant="body2" fontWeight="medium">
                    {config.name}
                  </Typography>
                  {config.description && (
                    <Typography variant="caption" color="text.secondary" display="block">
                      {config.description}
                    </Typography>
                  )}
                </TableCell>
                <TableCell>
                  <Tooltip title={config.fullUrl}>
                    <Typography
                      variant="body2"
                      sx={{
                        fontFamily: 'monospace',
                        maxWidth: 250,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {config.fullUrl}
                    </Typography>
                  </Tooltip>
                </TableCell>
                <TableCell>
                  {config.cityCode ? (
                    <Chip label={config.cityName || config.cityCode} size="small" />
                  ) : (
                    <Chip
                      icon={<Public fontSize="small" />}
                      label="全域"
                      size="small"
                      variant="outlined"
                    />
                  )}
                </TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', maxWidth: 200 }}>
                    {config.subscribedEvents.length > 0 ? (
                      config.subscribedEvents.length > 2 ? (
                        <Tooltip title={config.subscribedEvents.join(', ')}>
                          <Chip
                            label={`${config.subscribedEvents.length} 個事件`}
                            size="small"
                            variant="outlined"
                          />
                        </Tooltip>
                      ) : (
                        config.subscribedEvents.map(event => (
                          <Chip
                            key={event}
                            label={event.replace(/_/g, ' ')}
                            size="small"
                            variant="outlined"
                          />
                        ))
                      )
                    ) : (
                      <Typography variant="caption" color="text.secondary">
                        無
                      </Typography>
                    )}
                  </Box>
                </TableCell>
                <TableCell>
                  <Chip
                    label={config.isActive ? '啟用' : '停用'}
                    color={config.isActive ? 'success' : 'default'}
                    size="small"
                  />
                </TableCell>
                <TableCell>
                  {config.lastTestAt ? (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {testResult && (
                        <Tooltip title={config.lastTestError || testResult.label}>
                          <Chip
                            icon={testResult.icon as React.ReactElement}
                            label={testResult.label}
                            color={testResult.color}
                            size="small"
                          />
                        </Tooltip>
                      )}
                      <Typography variant="caption" color="text.secondary">
                        {formatDistanceToNow(new Date(config.lastTestAt), {
                          addSuffix: true,
                          locale: zhTW,
                        })}
                      </Typography>
                    </Box>
                  ) : (
                    <Typography variant="caption" color="text.secondary">
                      從未測試
                    </Typography>
                  )}
                </TableCell>
                <TableCell align="right">
                  <Tooltip title="測試連線">
                    <IconButton
                      onClick={() => onTest(config)}
                      disabled={testingId === config.id}
                      size="small"
                    >
                      {testingId === config.id ? (
                        <CircularProgress size={20} />
                      ) : (
                        <PlayArrow />
                      )}
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="變更歷史">
                    <IconButton onClick={() => onViewHistory(config)} size="small">
                      <History />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="編輯">
                    <IconButton onClick={() => onEdit(config)} size="small">
                      <Edit />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="刪除">
                    <IconButton onClick={() => onDelete(config)} color="error" size="small">
                      <Delete />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            )
          })}

          {!loading && configs.length === 0 && (
            <TableRow>
              <TableCell colSpan={7} align="center">
                <Typography color="text.secondary" sx={{ py: 4 }}>
                  尚未配置任何 Webhook
                </Typography>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </TableContainer>
  )
}
```

### 5.3 React Query Hooks

```typescript
// hooks/useWebhookConfigs.ts

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { WebhookConfigInfo, CreateWebhookConfigInput, UpdateWebhookConfigInput } from '@/types/n8n'

const QUERY_KEY = 'webhook-configs'

export function useWebhookConfigs(options?: {
  cityCode?: string
  isActive?: boolean
}) {
  return useQuery({
    queryKey: [QUERY_KEY, options],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (options?.cityCode) params.set('cityCode', options.cityCode)
      if (options?.isActive !== undefined) params.set('isActive', String(options.isActive))

      const res = await fetch(`/api/admin/webhook-configs?${params}`)
      if (!res.ok) throw new Error('Failed to fetch webhook configs')
      return res.json()
    },
  })
}

export function useWebhookConfig(id: string) {
  return useQuery({
    queryKey: [QUERY_KEY, id],
    queryFn: async () => {
      const res = await fetch(`/api/admin/webhook-configs/${id}`)
      if (!res.ok) throw new Error('Failed to fetch webhook config')
      return res.json()
    },
    enabled: !!id,
  })
}

export function useCreateWebhookConfig() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: Omit<CreateWebhookConfigInput, 'createdBy'>) => {
      const res = await fetch('/api/admin/webhook-configs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to create webhook config')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] })
    },
  })
}

export function useUpdateWebhookConfig() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string
      data: Omit<UpdateWebhookConfigInput, 'updatedBy'>
    }) => {
      const res = await fetch(`/api/admin/webhook-configs/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to update webhook config')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] })
    },
  })
}

export function useDeleteWebhookConfig() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/webhook-configs/${id}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error('Failed to delete webhook config')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] })
    },
  })
}

export function useTestWebhookConfig() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/webhook-configs/${id}/test`, {
        method: 'POST',
      })
      if (!res.ok) throw new Error('Failed to test webhook config')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] })
    },
  })
}

export function useWebhookConfigHistory(configId: string, limit?: number) {
  return useQuery({
    queryKey: [QUERY_KEY, configId, 'history'],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (limit) params.set('limit', String(limit))

      const res = await fetch(`/api/admin/webhook-configs/${configId}/history?${params}`)
      if (!res.ok) throw new Error('Failed to fetch webhook config history')
      return res.json()
    },
    enabled: !!configId,
  })
}
```

---

## 6. 測試計畫

### 6.1 單元測試

```typescript
// __tests__/services/n8n/webhookConfigService.test.ts

import { webhookConfigService } from '@/lib/services/n8n/webhookConfigService'
import { prismaMock } from '@/lib/__mocks__/prisma'
import * as encryption from '@/lib/utils/encryption'

jest.mock('@/lib/utils/encryption')

describe('WebhookConfigService', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('createConfig', () => {
    it('should create config with encrypted token', async () => {
      const mockEncrypt = jest.spyOn(encryption, 'encrypt')
      mockEncrypt.mockResolvedValue('encrypted-token-value')

      prismaMock.webhookConfig.create.mockResolvedValue({
        id: 'config-1',
        name: 'Test Config',
        baseUrl: 'https://n8n.example.com',
        endpointPath: '/webhook',
        authToken: 'encrypted-token-value',
        cityCode: null,
        retryStrategy: { maxAttempts: 3, delays: [1000, 5000, 30000] },
        timeoutMs: 30000,
        subscribedEvents: ['DOCUMENT_RECEIVED'],
        isActive: true,
        createdBy: 'admin-1',
        createdAt: new Date(),
        updatedAt: new Date(),
        city: null,
      } as any)

      prismaMock.webhookConfigHistory.create.mockResolvedValue({} as any)

      const result = await webhookConfigService.createConfig({
        name: 'Test Config',
        baseUrl: 'https://n8n.example.com/',
        endpointPath: 'webhook',
        authToken: 'secret-token',
        subscribedEvents: ['DOCUMENT_RECEIVED'],
        createdBy: 'admin-1',
      })

      expect(mockEncrypt).toHaveBeenCalledWith('secret-token')
      expect(result.baseUrl).toBe('https://n8n.example.com')
      expect(result.endpointPath).toBe('/webhook')
      expect(result.fullUrl).toBe('https://n8n.example.com/webhook')
    })

    it('should normalize URL correctly', async () => {
      const mockEncrypt = jest.spyOn(encryption, 'encrypt')
      mockEncrypt.mockResolvedValue('encrypted')

      prismaMock.webhookConfig.create.mockImplementation(async (args: any) => ({
        id: 'config-1',
        ...args.data,
        city: null,
      }))

      prismaMock.webhookConfigHistory.create.mockResolvedValue({} as any)

      await webhookConfigService.createConfig({
        name: 'Test',
        baseUrl: 'https://n8n.example.com///',
        endpointPath: 'webhook/test',
        authToken: 'token',
        subscribedEvents: [],
        createdBy: 'admin',
      })

      expect(prismaMock.webhookConfig.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            baseUrl: 'https://n8n.example.com',
            endpointPath: '/webhook/test',
          }),
        })
      )
    })
  })

  describe('testConnection', () => {
    it('should return success for valid connection', async () => {
      const mockDecrypt = jest.spyOn(encryption, 'decrypt')
      mockDecrypt.mockResolvedValue('decrypted-token')

      prismaMock.webhookConfig.findUnique.mockResolvedValue({
        id: 'config-1',
        baseUrl: 'https://n8n.example.com',
        endpointPath: '/webhook',
        authToken: 'encrypted',
        timeoutMs: 5000,
      } as any)

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
      })

      prismaMock.webhookConfig.update.mockResolvedValue({} as any)

      const result = await webhookConfigService.testConnection('config-1')

      expect(result.success).toBe(true)
      expect(result.result).toBe('SUCCESS')
      expect(result.statusCode).toBe(200)
    })

    it('should handle timeout correctly', async () => {
      const mockDecrypt = jest.spyOn(encryption, 'decrypt')
      mockDecrypt.mockResolvedValue('decrypted-token')

      prismaMock.webhookConfig.findUnique.mockResolvedValue({
        id: 'config-1',
        baseUrl: 'https://n8n.example.com',
        endpointPath: '/webhook',
        authToken: 'encrypted',
        timeoutMs: 100,
      } as any)

      const abortError = new Error('Aborted')
      abortError.name = 'AbortError'
      global.fetch = jest.fn().mockRejectedValue(abortError)

      prismaMock.webhookConfig.update.mockResolvedValue({} as any)

      const result = await webhookConfigService.testConnection('config-1')

      expect(result.success).toBe(false)
      expect(result.result).toBe('TIMEOUT')
    })

    it('should handle HTTP errors correctly', async () => {
      const mockDecrypt = jest.spyOn(encryption, 'decrypt')
      mockDecrypt.mockResolvedValue('decrypted-token')

      prismaMock.webhookConfig.findUnique.mockResolvedValue({
        id: 'config-1',
        baseUrl: 'https://n8n.example.com',
        endpointPath: '/webhook',
        authToken: 'encrypted',
        timeoutMs: 5000,
      } as any)

      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
      })

      prismaMock.webhookConfig.update.mockResolvedValue({} as any)

      const result = await webhookConfigService.testConnection('config-1')

      expect(result.success).toBe(false)
      expect(result.result).toBe('FAILED')
      expect(result.statusCode).toBe(401)
    })
  })

  describe('getActiveConfigForCity', () => {
    it('should prioritize city-specific config over global', async () => {
      prismaMock.webhookConfig.findFirst.mockResolvedValue({
        id: 'city-config',
        cityCode: 'TPE',
        name: 'Taipei Config',
        city: { code: 'TPE', name: 'Taipei' },
      } as any)

      const result = await webhookConfigService.getActiveConfigForCity('TPE')

      expect(result?.cityCode).toBe('TPE')
      expect(prismaMock.webhookConfig.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { cityCode: 'desc' },
        })
      )
    })
  })
})
```

### 6.2 API 整合測試

```typescript
// __tests__/api/admin/webhook-configs.test.ts

import { testApiHandler } from 'next-test-api-route-handler'
import * as listHandler from '@/app/api/admin/webhook-configs/route'
import * as itemHandler from '@/app/api/admin/webhook-configs/[id]/route'
import * as testHandler from '@/app/api/admin/webhook-configs/[id]/test/route'

describe('Webhook Config API', () => {
  describe('GET /api/admin/webhook-configs', () => {
    it('should require admin permission', async () => {
      await testApiHandler({
        appHandler: listHandler,
        test: async ({ fetch }) => {
          const res = await fetch({ method: 'GET' })
          expect(res.status).toBe(403)
        },
      })
    })
  })

  describe('POST /api/admin/webhook-configs', () => {
    it('should validate required fields', async () => {
      // Mock admin session...
      await testApiHandler({
        appHandler: listHandler,
        test: async ({ fetch }) => {
          const res = await fetch({
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: '',
              baseUrl: 'invalid-url',
            }),
          })

          expect(res.status).toBe(400)
          const data = await res.json()
          expect(data.error).toBe('Validation error')
        },
      })
    })
  })

  describe('POST /api/admin/webhook-configs/[id]/test', () => {
    it('should test webhook connection', async () => {
      // Mock admin session and config...
      await testApiHandler({
        appHandler: testHandler,
        params: { id: 'config-1' },
        test: async ({ fetch }) => {
          const res = await fetch({ method: 'POST' })
          expect(res.status).toBe(200)
          const data = await res.json()
          expect(data.data).toHaveProperty('result')
        },
      })
    })
  })
})
```

---

## 7. 部署注意事項

### 7.1 環境變數

```env
# 必要：Webhook Token 加密金鑰 (32 字元以上)
WEBHOOK_ENCRYPTION_KEY=your-32-character-encryption-key-here

# 選用：預設配置
WEBHOOK_DEFAULT_TIMEOUT=30000
WEBHOOK_DEFAULT_MAX_ATTEMPTS=3
```

### 7.2 資料庫遷移

```bash
# 生成遷移
npx prisma migrate dev --name add_webhook_config

# 應用遷移
npx prisma migrate deploy
```

### 7.3 監控指標

| 指標 | 描述 | 告警閾值 |
|------|------|----------|
| `webhook_config_count` | 配置總數 | - |
| `webhook_test_success_rate` | 連線測試成功率 | <80% |
| `webhook_test_latency_ms` | 測試回應時間 | p95 > 5000ms |
| `webhook_config_changes` | 配置變更次數 | >10/hour |

### 7.4 安全考量

1. **Token 加密**
   - 使用 AES-256-GCM 加密儲存
   - 金鑰使用 scrypt 派生
   - 每次加密使用不同的 salt 和 IV

2. **權限控制**
   - 讀取：`admin:webhook:read`
   - 寫入：`admin:webhook:write`
   - 刪除：`admin:webhook:delete`

3. **審計追蹤**
   - 所有變更記錄在歷史表
   - 敏感資料脫敏後記錄
   - 保留操作者和時間戳

---

## 8. 驗收標準對應

| AC | 描述 | 實現狀態 |
|----|------|----------|
| AC1 | Webhook 配置表單 | ✅ 完整表單含 URL、Token、重試策略 |
| AC2 | 連線測試功能 | ✅ 即時測試與已保存配置測試 |
| AC3 | 城市級別配置 | ✅ 支援城市特定和全域配置 |
| AC4 | 重試策略 | ✅ 可配置重試次數和間隔 |

---

## 9. 開放問題

1. **Token 輪換**: 是否需要支援自動 Token 輪換機制？
2. **多 Webhook**: 同一城市是否可以配置多個 Webhook（不同事件）？
3. **健康檢查**: 是否需要定期自動測試 Webhook 健康狀態？

---

## 10. 參考資料

- [n8n Webhook 文檔](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.webhook/)
- [Node.js Crypto 文檔](https://nodejs.org/api/crypto.html)
- [React Hook Form 文檔](https://react-hook-form.com/)
- [TanStack Query 文檔](https://tanstack.com/query/latest)
