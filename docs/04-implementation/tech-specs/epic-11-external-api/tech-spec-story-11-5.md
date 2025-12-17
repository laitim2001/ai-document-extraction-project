# Tech Spec: Story 11-5 - API 存取控制與驗證

## 1. 總覽

### 1.1 功能描述
實現完整的 API 存取控制與認證系統，包含 API Key 生命週期管理、權限控制、速率限制及審計日誌功能，確保外部 API 服務的安全性與可追蹤性。

### 1.2 目標
- 實現 API Key 認證機制（Bearer Token）
- 提供 API Key 管理介面（CRUD）
- 支援細粒度權限控制（城市、操作類型）
- 實現 Redis 基礎的速率限制
- 完整的審計日誌記錄
- 支援 IP 白名單/黑名單

### 1.3 範圍
- API Key 服務 `ApiKeyService`
- 認證中間件 `ExternalApiAuthMiddleware`
- 速率限制服務 `RateLimitService`
- 審計日誌服務 `AuditLogService`
- 管理介面 API 與前端組件

### 1.4 關聯 Story
- **被依賴**: Story 11-1 ~ 11-4（所有 API 端點）
- **依賴**: Story 1-1（管理員認證）

---

## 2. 驗收標準對照

| AC | 描述 | 實作方式 | 驗證方法 |
|----|------|----------|----------|
| AC1 | API Key 認證 | Bearer Token + SHA-256 Hash 驗證 | 認證測試 |
| AC2 | API Key 管理 | 管理介面 CRUD API | 管理功能測試 |
| AC3 | 權限配置 | allowedCities、allowedOperations、rateLimit | 權限檢查測試 |
| AC4 | 速率限制 | Redis 滑動窗口 + 429 回應 | 限流測試 |
| AC5 | 審計日誌 | 所有請求記錄至 ApiAuditLog | 日誌查詢測試 |

---

## 3. 資料庫設計

### 3.1 ExternalApiKey 模型

```prisma
model ExternalApiKey {
  id                String    @id @default(cuid())

  // 基本資訊
  name              String    @db.VarChar(100)
  description       String?   @db.VarChar(500)
  keyHash           String    @unique @db.VarChar(64)  // SHA-256 hash
  keyPrefix         String    @db.VarChar(12)          // 前綴識別（如 inv_a1b2c3d4）

  // 所有者
  createdById       String
  createdBy         User      @relation("ApiKeyCreator", fields: [createdById], references: [id])
  organizationId    String?

  // 權限設定
  allowedCities     Json      // string[] - 城市代碼列表，'*' 表示全部
  allowedOperations Json      // string[] - 允許操作：submit, query, result
  scopes            Json?     // 額外細粒度權限

  // 速率限制
  rateLimit         Int       @default(60)   // 每分鐘請求數
  rateLimitBurst    Int?                     // 突發請求限制

  // Webhook 設定
  webhookSecret     String?   @db.VarChar(64)

  // 狀態
  isActive          Boolean   @default(true)
  expiresAt         DateTime?

  // 使用統計
  lastUsedAt        DateTime?
  usageCount        BigInt    @default(0)
  monthlyUsage      Int       @default(0)
  monthlyReset      DateTime?

  // IP 限制
  allowedIps        Json?     // string[] - 允許的 IP
  blockedIps        Json?     // string[] - 封鎖的 IP

  // 時間記錄
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt
  deletedAt         DateTime?

  // 關聯
  tasks             ExternalApiTask[]
  webhookConfigs    WebhookConfiguration[]
  auditLogs         ApiAuditLog[]

  @@index([keyHash])
  @@index([createdById])
  @@index([isActive])
  @@index([expiresAt])
}
```

### 3.2 ApiAuthAttempt 模型

```prisma
// 認證嘗試記錄（用於安全監控）
model ApiAuthAttempt {
  id              String    @id @default(cuid())
  keyPrefix       String?   @db.VarChar(12)  // API Key 前綴
  ip              String    @db.VarChar(45)  // 支援 IPv6
  userAgent       String?   @db.VarChar(500)
  success         Boolean
  failureReason   String?   @db.VarChar(100)
  createdAt       DateTime  @default(now())

  @@index([ip])
  @@index([createdAt])
  @@index([keyPrefix])
  @@index([success, createdAt])
}
```

### 3.3 ApiAuditLog 模型

```prisma
// API 審計日誌
model ApiAuditLog {
  id              String    @id @default(cuid())

  // API Key 資訊
  apiKeyId        String
  apiKey          ExternalApiKey @relation(fields: [apiKeyId], references: [id], onDelete: Cascade)

  // 請求資訊
  method          String    @db.VarChar(10)
  endpoint        String    @db.VarChar(100)  // 正規化端點
  path            String    @db.VarChar(500)  // 完整路徑
  queryParams     Json?
  requestBody     Json?     // 敏感資訊已過濾

  // 回應資訊
  statusCode      Int
  responseTime    Int       // 毫秒
  errorCode       String?   @db.VarChar(50)
  errorMessage    String?   @db.VarChar(500)

  // 客戶端資訊
  clientIp        String    @db.VarChar(45)
  userAgent       String?   @db.VarChar(500)
  country         String?   @db.VarChar(2)
  city            String?   @db.VarChar(100)

  // 追蹤
  traceId         String?   @db.VarChar(50)

  // 時間記錄
  createdAt       DateTime  @default(now())

  @@index([apiKeyId])
  @@index([endpoint])
  @@index([statusCode])
  @@index([createdAt])
  @@index([clientIp])
  @@index([traceId])
}
```

---

## 4. 型別定義

### 4.1 核心型別

```typescript
// lib/types/externalApi/auth.ts

/**
 * 允許的操作類型
 */
export type ApiOperation = 'submit' | 'query' | 'result'

/**
 * API Key 創建請求
 */
export interface CreateApiKeyRequest {
  name: string
  description?: string
  allowedCities: string[]
  allowedOperations: ApiOperation[]
  rateLimit?: number
  expiresAt?: Date
  allowedIps?: string[]
}

/**
 * API Key 更新請求
 */
export interface UpdateApiKeyRequest {
  name?: string
  description?: string
  allowedCities?: string[]
  allowedOperations?: ApiOperation[]
  rateLimit?: number
  expiresAt?: Date | null
  allowedIps?: string[] | null
}

/**
 * API Key 回應（不含敏感資訊）
 */
export interface ApiKeyResponse {
  id: string
  name: string
  description?: string
  keyPrefix: string
  allowedCities: string[]
  allowedOperations: ApiOperation[]
  rateLimit: number
  isActive: boolean
  expiresAt?: string
  createdAt: string
  lastUsedAt?: string
  usageCount: number
}

/**
 * 創建 API Key 回應（含完整金鑰，僅創建時返回）
 */
export interface CreateApiKeyResponse extends ApiKeyResponse {
  apiKey: string        // 完整 API Key（僅此時顯示）
  webhookSecret: string // Webhook 簽名密鑰
}

/**
 * 認證結果
 */
export interface AuthResult {
  authorized: boolean
  apiKey?: ExternalApiKey
  errorCode?: AuthErrorCode
  errorMessage?: string
  statusCode: number
}

/**
 * 認證錯誤碼
 */
export type AuthErrorCode =
  | 'MISSING_API_KEY'
  | 'INVALID_API_KEY'
  | 'API_KEY_EXPIRED'
  | 'API_KEY_INACTIVE'
  | 'PERMISSION_DENIED'
  | 'IP_NOT_ALLOWED'
  | 'RATE_LIMIT_EXCEEDED'

/**
 * 速率限制結果
 */
export interface RateLimitResult {
  allowed: boolean
  limit: number
  remaining: number
  reset: number       // Unix timestamp
  retryAfter?: number // 秒
}

/**
 * 審計日誌條目
 */
export interface AuditLogEntry {
  apiKeyId: string
  method: string
  endpoint: string
  path: string
  queryParams?: Record<string, any>
  requestBody?: Record<string, any>
  statusCode: number
  responseTime: number
  errorCode?: string
  errorMessage?: string
  clientIp: string
  userAgent?: string
  traceId?: string
}

/**
 * API Key 使用統計
 */
export interface ApiKeyStats {
  totalRequests: number
  successRate: number
  avgResponseTime: number
  requestsByEndpoint: Record<string, number>
  requestsByStatus: Record<string, number>
  requestsByDay: Array<{ date: string; count: number }>
}
```

### 4.2 常數定義

```typescript
// lib/constants/apiAuth.ts

/**
 * API Key 格式前綴
 */
export const API_KEY_PREFIX = 'inv'

/**
 * API Key 隨機部分長度（bytes）
 */
export const API_KEY_RANDOM_LENGTH = 16

/**
 * 預設速率限制（每分鐘）
 */
export const DEFAULT_RATE_LIMIT = 60

/**
 * 最大速率限制
 */
export const MAX_RATE_LIMIT = 1000

/**
 * 速率限制窗口（秒）
 */
export const RATE_LIMIT_WINDOW = 60

/**
 * 敏感欄位列表（需過濾）
 */
export const SENSITIVE_FIELDS = [
  'password',
  'secret',
  'apiKey',
  'token',
  'authorization',
  'base64Content',
  'content',
  'file',
] as const

/**
 * 操作對應的權限
 */
export const OPERATION_PERMISSIONS: Record<string, ApiOperation> = {
  'POST /api/v1/invoices': 'submit',
  'GET /api/v1/invoices': 'query',
  'GET /api/v1/invoices/{id}/status': 'query',
  'POST /api/v1/invoices/batch-status': 'query',
  'GET /api/v1/invoices/{id}/result': 'result',
  'GET /api/v1/invoices/{id}/document': 'result',
  'POST /api/v1/invoices/batch-results': 'result',
  'GET /api/v1/webhooks': 'query',
  'POST /api/v1/webhooks/{id}/retry': 'submit',
}
```

---

## 5. 服務層設計

### 5.1 ApiKeyService

```typescript
// lib/services/externalApi/apiKeyService.ts

import { prisma } from '@/lib/prisma'
import { createHash, randomBytes } from 'crypto'
import { ExternalApiKey } from '@prisma/client'
import {
  CreateApiKeyRequest,
  UpdateApiKeyRequest,
  ApiKeyResponse,
  CreateApiKeyResponse,
  ApiKeyStats,
} from '@/lib/types/externalApi/auth'
import {
  API_KEY_PREFIX,
  API_KEY_RANDOM_LENGTH,
  DEFAULT_RATE_LIMIT,
} from '@/lib/constants/apiAuth'

/**
 * API Key 管理服務
 */
export class ApiKeyService {
  /**
   * 創建新 API Key
   */
  async createApiKey(
    request: CreateApiKeyRequest,
    userId: string
  ): Promise<CreateApiKeyResponse> {
    // 生成 API Key
    const rawKey = this.generateApiKey()
    const keyHash = this.hashApiKey(rawKey)
    const keyPrefix = rawKey.substring(0, 12)

    // 生成 Webhook Secret
    const webhookSecret = randomBytes(32).toString('hex')

    // 創建記錄
    const apiKey = await prisma.externalApiKey.create({
      data: {
        name: request.name,
        description: request.description,
        keyHash,
        keyPrefix,
        createdById: userId,
        allowedCities: request.allowedCities,
        allowedOperations: request.allowedOperations,
        rateLimit: request.rateLimit || DEFAULT_RATE_LIMIT,
        expiresAt: request.expiresAt,
        allowedIps: request.allowedIps,
        webhookSecret,
      },
    })

    return {
      ...this.toResponse(apiKey),
      apiKey: rawKey,
      webhookSecret,
    }
  }

  /**
   * 生成 API Key
   * 格式: inv_<32個十六進制字元>
   */
  private generateApiKey(): string {
    const randomPart = randomBytes(API_KEY_RANDOM_LENGTH).toString('hex')
    return `${API_KEY_PREFIX}_${randomPart}`
  }

  /**
   * Hash API Key（SHA-256）
   */
  private hashApiKey(key: string): string {
    return createHash('sha256').update(key).digest('hex')
  }

  /**
   * 驗證 API Key
   */
  async validateApiKey(rawKey: string): Promise<ExternalApiKey | null> {
    // 檢查格式
    if (!rawKey.startsWith(`${API_KEY_PREFIX}_`)) {
      return null
    }

    const keyHash = this.hashApiKey(rawKey)

    const apiKey = await prisma.externalApiKey.findUnique({
      where: { keyHash },
    })

    if (!apiKey) {
      return null
    }

    // 檢查是否啟用
    if (!apiKey.isActive) {
      return null
    }

    // 檢查是否過期
    if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
      return null
    }

    // 檢查是否已刪除
    if (apiKey.deletedAt) {
      return null
    }

    // 更新使用統計（異步，不阻塞）
    this.updateUsageStats(apiKey.id).catch(console.error)

    return apiKey
  }

  /**
   * 更新使用統計
   */
  private async updateUsageStats(apiKeyId: string): Promise<void> {
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

    await prisma.externalApiKey.update({
      where: { id: apiKeyId },
      data: {
        lastUsedAt: now,
        usageCount: { increment: 1 },
        monthlyUsage: { increment: 1 },
        // 每月重置
        ...(await this.shouldResetMonthly(apiKeyId, monthStart) && {
          monthlyUsage: 1,
          monthlyReset: now,
        }),
      },
    })
  }

  /**
   * 檢查是否需要重置月度計數
   */
  private async shouldResetMonthly(
    apiKeyId: string,
    monthStart: Date
  ): Promise<boolean> {
    const apiKey = await prisma.externalApiKey.findUnique({
      where: { id: apiKeyId },
      select: { monthlyReset: true },
    })

    if (!apiKey?.monthlyReset) {
      return true
    }

    return apiKey.monthlyReset < monthStart
  }

  /**
   * 列出 API Keys
   */
  async listApiKeys(
    userId: string,
    options?: {
      includeInactive?: boolean
      page?: number
      pageSize?: number
    }
  ): Promise<{
    items: ApiKeyResponse[]
    total: number
    page: number
    pageSize: number
  }> {
    const { includeInactive = false, page = 1, pageSize = 20 } = options || {}

    const where: any = {
      createdById: userId,
      deletedAt: null,
    }

    if (!includeInactive) {
      where.isActive = true
    }

    const [apiKeys, total] = await Promise.all([
      prisma.externalApiKey.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.externalApiKey.count({ where }),
    ])

    return {
      items: apiKeys.map((key) => this.toResponse(key)),
      total,
      page,
      pageSize,
    }
  }

  /**
   * 獲取 API Key 詳情
   */
  async getApiKey(keyId: string, userId: string): Promise<ApiKeyResponse | null> {
    const apiKey = await prisma.externalApiKey.findFirst({
      where: {
        id: keyId,
        createdById: userId,
        deletedAt: null,
      },
    })

    return apiKey ? this.toResponse(apiKey) : null
  }

  /**
   * 更新 API Key
   */
  async updateApiKey(
    keyId: string,
    userId: string,
    updates: UpdateApiKeyRequest
  ): Promise<ApiKeyResponse | null> {
    const existing = await prisma.externalApiKey.findFirst({
      where: {
        id: keyId,
        createdById: userId,
        deletedAt: null,
      },
    })

    if (!existing) {
      return null
    }

    const apiKey = await prisma.externalApiKey.update({
      where: { id: keyId },
      data: {
        name: updates.name,
        description: updates.description,
        allowedCities: updates.allowedCities,
        allowedOperations: updates.allowedOperations,
        rateLimit: updates.rateLimit,
        expiresAt: updates.expiresAt,
        allowedIps: updates.allowedIps,
      },
    })

    return this.toResponse(apiKey)
  }

  /**
   * 啟用/停用 API Key
   */
  async toggleApiKey(
    keyId: string,
    userId: string,
    isActive: boolean
  ): Promise<ApiKeyResponse | null> {
    const existing = await prisma.externalApiKey.findFirst({
      where: {
        id: keyId,
        createdById: userId,
        deletedAt: null,
      },
    })

    if (!existing) {
      return null
    }

    const apiKey = await prisma.externalApiKey.update({
      where: { id: keyId },
      data: { isActive },
    })

    return this.toResponse(apiKey)
  }

  /**
   * 刪除 API Key（軟刪除）
   */
  async deleteApiKey(keyId: string, userId: string): Promise<boolean> {
    const existing = await prisma.externalApiKey.findFirst({
      where: {
        id: keyId,
        createdById: userId,
        deletedAt: null,
      },
    })

    if (!existing) {
      return false
    }

    await prisma.externalApiKey.update({
      where: { id: keyId },
      data: {
        deletedAt: new Date(),
        isActive: false,
      },
    })

    return true
  }

  /**
   * 重新生成 Webhook Secret
   */
  async regenerateWebhookSecret(keyId: string, userId: string): Promise<string | null> {
    const existing = await prisma.externalApiKey.findFirst({
      where: {
        id: keyId,
        createdById: userId,
        deletedAt: null,
      },
    })

    if (!existing) {
      return null
    }

    const newSecret = randomBytes(32).toString('hex')

    await prisma.externalApiKey.update({
      where: { id: keyId },
      data: { webhookSecret: newSecret },
    })

    return newSecret
  }

  /**
   * 獲取 API Key 使用統計
   */
  async getApiKeyStats(
    keyId: string,
    userId: string,
    options?: {
      startDate?: Date
      endDate?: Date
    }
  ): Promise<ApiKeyStats | null> {
    const existing = await prisma.externalApiKey.findFirst({
      where: {
        id: keyId,
        createdById: userId,
        deletedAt: null,
      },
    })

    if (!existing) {
      return null
    }

    const { startDate, endDate } = options || {}
    const dateFilter: any = {}
    if (startDate) dateFilter.gte = startDate
    if (endDate) dateFilter.lte = endDate

    const logs = await prisma.apiAuditLog.findMany({
      where: {
        apiKeyId: keyId,
        ...(Object.keys(dateFilter).length > 0 && { createdAt: dateFilter }),
      },
    })

    return this.calculateStats(logs)
  }

  /**
   * 計算統計數據
   */
  private calculateStats(logs: any[]): ApiKeyStats {
    const totalRequests = logs.length
    const successfulRequests = logs.filter((l) => l.statusCode < 400).length
    const successRate = totalRequests > 0 ? successfulRequests / totalRequests : 0
    const avgResponseTime =
      totalRequests > 0
        ? logs.reduce((sum, l) => sum + l.responseTime, 0) / totalRequests
        : 0

    const requestsByEndpoint: Record<string, number> = {}
    const requestsByStatus: Record<string, number> = {}
    const dayMap = new Map<string, number>()

    logs.forEach((l) => {
      // 按端點
      requestsByEndpoint[l.endpoint] = (requestsByEndpoint[l.endpoint] || 0) + 1

      // 按狀態碼分組
      const statusGroup = `${Math.floor(l.statusCode / 100)}xx`
      requestsByStatus[statusGroup] = (requestsByStatus[statusGroup] || 0) + 1

      // 按日期
      const date = l.createdAt.toISOString().split('T')[0]
      dayMap.set(date, (dayMap.get(date) || 0) + 1)
    })

    const requestsByDay: Array<{ date: string; count: number }> = []
    dayMap.forEach((count, date) => {
      requestsByDay.push({ date, count })
    })
    requestsByDay.sort((a, b) => a.date.localeCompare(b.date))

    return {
      totalRequests,
      successRate: Math.round(successRate * 10000) / 100, // 百分比
      avgResponseTime: Math.round(avgResponseTime),
      requestsByEndpoint,
      requestsByStatus,
      requestsByDay,
    }
  }

  /**
   * 轉換為回應格式
   */
  private toResponse(apiKey: ExternalApiKey): ApiKeyResponse {
    return {
      id: apiKey.id,
      name: apiKey.name,
      description: apiKey.description || undefined,
      keyPrefix: apiKey.keyPrefix,
      allowedCities: apiKey.allowedCities as string[],
      allowedOperations: apiKey.allowedOperations as string[],
      rateLimit: apiKey.rateLimit,
      isActive: apiKey.isActive,
      expiresAt: apiKey.expiresAt?.toISOString(),
      createdAt: apiKey.createdAt.toISOString(),
      lastUsedAt: apiKey.lastUsedAt?.toISOString(),
      usageCount: Number(apiKey.usageCount),
    }
  }
}

export const apiKeyService = new ApiKeyService()
```

### 5.2 ExternalApiAuthMiddleware

```typescript
// lib/middleware/externalApiAuthMiddleware.ts

import { NextRequest } from 'next/server'
import { ExternalApiKey } from '@prisma/client'
import { apiKeyService } from '@/lib/services/externalApi/apiKeyService'
import { prisma } from '@/lib/prisma'
import { AuthResult, AuthErrorCode, ApiOperation } from '@/lib/types/externalApi/auth'

/**
 * 外部 API 認證中間件
 */
export async function externalApiAuthMiddleware(
  request: NextRequest,
  requiredOperations: ApiOperation[]
): Promise<AuthResult> {
  const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown'
  const userAgent = request.headers.get('user-agent') || undefined

  // 1. 提取 API Key
  const authHeader = request.headers.get('authorization')
  const apiKeyPrefix = authHeader?.startsWith('Bearer ')
    ? authHeader.substring(7, 19)
    : undefined

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    await logAuthAttempt(apiKeyPrefix, clientIp, userAgent, false, 'MISSING_API_KEY')
    return {
      authorized: false,
      errorCode: 'MISSING_API_KEY',
      errorMessage: 'Authorization header with Bearer token is required',
      statusCode: 401,
    }
  }

  const rawKey = authHeader.substring(7)

  // 2. 驗證 API Key
  const apiKey = await apiKeyService.validateApiKey(rawKey)

  if (!apiKey) {
    await logAuthAttempt(apiKeyPrefix, clientIp, userAgent, false, 'INVALID_API_KEY')
    return {
      authorized: false,
      errorCode: 'INVALID_API_KEY',
      errorMessage: 'Invalid or expired API key',
      statusCode: 401,
    }
  }

  // 3. 檢查 IP 限制
  const ipCheckResult = checkIpRestriction(apiKey, clientIp)
  if (!ipCheckResult.allowed) {
    await logAuthAttempt(apiKey.keyPrefix, clientIp, userAgent, false, 'IP_NOT_ALLOWED')
    return {
      authorized: false,
      errorCode: 'IP_NOT_ALLOWED',
      errorMessage: 'Request from this IP address is not allowed',
      statusCode: 403,
    }
  }

  // 4. 檢查操作權限
  const allowedOperations = apiKey.allowedOperations as string[]
  const hasPermission = requiredOperations.every((op) =>
    allowedOperations.includes(op)
  )

  if (!hasPermission) {
    await logAuthAttempt(apiKey.keyPrefix, clientIp, userAgent, false, 'PERMISSION_DENIED')
    return {
      authorized: false,
      errorCode: 'PERMISSION_DENIED',
      errorMessage: `This API key does not have permission for: ${requiredOperations.join(', ')}`,
      statusCode: 403,
    }
  }

  // 5. 認證成功
  await logAuthAttempt(apiKey.keyPrefix, clientIp, userAgent, true)

  return {
    authorized: true,
    apiKey,
    statusCode: 200,
  }
}

/**
 * 檢查 IP 限制
 */
function checkIpRestriction(
  apiKey: ExternalApiKey,
  clientIp: string
): { allowed: boolean } {
  const allowedIps = apiKey.allowedIps as string[] | null
  const blockedIps = apiKey.blockedIps as string[] | null

  // 檢查黑名單
  if (blockedIps && blockedIps.length > 0) {
    if (blockedIps.includes(clientIp)) {
      return { allowed: false }
    }
  }

  // 檢查白名單
  if (allowedIps && allowedIps.length > 0) {
    if (!allowedIps.includes(clientIp)) {
      return { allowed: false }
    }
  }

  return { allowed: true }
}

/**
 * 檢查城市權限
 */
export function checkCityPermission(
  apiKey: ExternalApiKey,
  cityCode: string
): boolean {
  const allowedCities = apiKey.allowedCities as string[]

  // '*' 表示允許所有城市
  if (allowedCities.includes('*')) {
    return true
  }

  return allowedCities.includes(cityCode)
}

/**
 * 記錄認證嘗試
 */
async function logAuthAttempt(
  keyPrefix: string | undefined,
  ip: string,
  userAgent: string | undefined,
  success: boolean,
  failureReason?: AuthErrorCode
): Promise<void> {
  try {
    await prisma.apiAuthAttempt.create({
      data: {
        keyPrefix,
        ip,
        userAgent,
        success,
        failureReason,
      },
    })
  } catch (error) {
    console.error('Failed to log auth attempt:', error)
  }
}
```

### 5.3 RateLimitService

```typescript
// lib/services/externalApi/rateLimitService.ts

import { Redis } from 'ioredis'
import { ExternalApiKey } from '@prisma/client'
import { RateLimitResult } from '@/lib/types/externalApi/auth'
import { RATE_LIMIT_WINDOW } from '@/lib/constants/apiAuth'

/**
 * 速率限制服務（Redis 滑動窗口實現）
 */
export class RateLimitService {
  private redis: Redis

  constructor() {
    this.redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379')
  }

  /**
   * 檢查速率限制
   */
  async checkRateLimit(apiKey: ExternalApiKey): Promise<RateLimitResult> {
    const key = `ratelimit:${apiKey.id}`
    const limit = apiKey.rateLimit
    const now = Date.now()
    const windowStart = now - RATE_LIMIT_WINDOW * 1000

    // 使用 Redis 事務執行滑動窗口
    const multi = this.redis.multi()

    // 移除過期的請求記錄
    multi.zremrangebyscore(key, 0, windowStart)

    // 計算當前窗口內的請求數
    multi.zcard(key)

    // 添加當前請求
    multi.zadd(key, now.toString(), `${now}-${Math.random()}`)

    // 設置 key 過期時間
    multi.expire(key, RATE_LIMIT_WINDOW + 1)

    const results = await multi.exec()

    if (!results) {
      throw new Error('Redis transaction failed')
    }

    const currentCount = results[1][1] as number

    if (currentCount >= limit) {
      // 計算重試時間
      const oldestRequest = await this.redis.zrange(key, 0, 0, 'WITHSCORES')
      const oldestTimestamp = oldestRequest.length > 1 ? parseInt(oldestRequest[1]) : now
      const retryAfter = Math.ceil((oldestTimestamp + RATE_LIMIT_WINDOW * 1000 - now) / 1000)

      return {
        allowed: false,
        limit,
        remaining: 0,
        reset: Math.ceil((now + RATE_LIMIT_WINDOW * 1000) / 1000),
        retryAfter: Math.max(1, retryAfter),
      }
    }

    return {
      allowed: true,
      limit,
      remaining: Math.max(0, limit - currentCount - 1),
      reset: Math.ceil((now + RATE_LIMIT_WINDOW * 1000) / 1000),
    }
  }

  /**
   * 獲取當前使用量
   */
  async getCurrentUsage(apiKeyId: string): Promise<number> {
    const key = `ratelimit:${apiKeyId}`
    const now = Date.now()
    const windowStart = now - RATE_LIMIT_WINDOW * 1000

    // 移除過期記錄並計數
    await this.redis.zremrangebyscore(key, 0, windowStart)
    return await this.redis.zcard(key)
  }

  /**
   * 重置速率限制
   */
  async resetRateLimit(apiKeyId: string): Promise<void> {
    const key = `ratelimit:${apiKeyId}`
    await this.redis.del(key)
  }

  /**
   * 關閉連接
   */
  async close(): Promise<void> {
    await this.redis.quit()
  }
}

// 單例導出
export const rateLimitService = new RateLimitService()

/**
 * 速率限制中間件
 */
export async function rateLimitMiddleware(
  request: any,
  apiKey: ExternalApiKey
): Promise<RateLimitResult> {
  return rateLimitService.checkRateLimit(apiKey)
}
```

### 5.4 AuditLogService

```typescript
// lib/services/externalApi/auditLogService.ts

import { prisma } from '@/lib/prisma'
import { NextRequest } from 'next/server'
import { AuditLogEntry } from '@/lib/types/externalApi/auth'
import { SENSITIVE_FIELDS } from '@/lib/constants/apiAuth'

/**
 * 審計日誌服務
 */
export class AuditLogService {
  /**
   * 記錄 API 請求
   */
  async logRequest(entry: AuditLogEntry): Promise<void> {
    try {
      const sanitizedBody = this.sanitizeRequestBody(entry.requestBody)

      await prisma.apiAuditLog.create({
        data: {
          apiKeyId: entry.apiKeyId,
          method: entry.method,
          endpoint: entry.endpoint,
          path: entry.path,
          queryParams: entry.queryParams,
          requestBody: sanitizedBody,
          statusCode: entry.statusCode,
          responseTime: entry.responseTime,
          errorCode: entry.errorCode,
          errorMessage: entry.errorMessage,
          clientIp: entry.clientIp,
          userAgent: entry.userAgent,
          traceId: entry.traceId,
        },
      })
    } catch (error) {
      console.error('[AuditLog] Failed to log request:', error)
      // 不拋出錯誤，避免影響主請求
    }
  }

  /**
   * 過濾敏感資料
   */
  private sanitizeRequestBody(
    body?: Record<string, any>
  ): Record<string, any> | undefined {
    if (!body) return undefined

    const sanitized = { ...body }

    for (const field of SENSITIVE_FIELDS) {
      if (sanitized[field]) {
        sanitized[field] = '[REDACTED]'
      }
    }

    // 遞迴處理嵌套物件
    for (const key of Object.keys(sanitized)) {
      if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
        sanitized[key] = this.sanitizeRequestBody(sanitized[key])
      }
    }

    return sanitized
  }

  /**
   * 從請求提取審計資訊
   */
  extractFromRequest(
    request: NextRequest,
    startTime: number
  ): Omit<AuditLogEntry, 'apiKeyId' | 'statusCode' | 'errorCode' | 'errorMessage'> {
    const url = new URL(request.url)
    const queryParams: Record<string, any> = {}
    url.searchParams.forEach((value, key) => {
      queryParams[key] = value
    })

    return {
      method: request.method,
      endpoint: this.normalizeEndpoint(url.pathname),
      path: url.pathname,
      queryParams: Object.keys(queryParams).length > 0 ? queryParams : undefined,
      responseTime: Date.now() - startTime,
      clientIp: request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown',
      userAgent: request.headers.get('user-agent') || undefined,
    }
  }

  /**
   * 正規化端點（移除動態參數）
   */
  private normalizeEndpoint(path: string): string {
    return path
      .replace(/\/[a-zA-Z0-9_-]{20,}(?=\/|$)/g, '/{id}')  // CUID
      .replace(/\/\d+(?=\/|$)/g, '/{id}')                  // 數字 ID
  }

  /**
   * 查詢審計日誌
   */
  async queryLogs(
    apiKeyId: string,
    options?: {
      startDate?: Date
      endDate?: Date
      endpoint?: string
      statusCode?: number
      page?: number
      pageSize?: number
    }
  ): Promise<{
    items: any[]
    total: number
    page: number
    pageSize: number
  }> {
    const {
      startDate,
      endDate,
      endpoint,
      statusCode,
      page = 1,
      pageSize = 50,
    } = options || {}

    const where: any = { apiKeyId }

    if (startDate || endDate) {
      where.createdAt = {}
      if (startDate) where.createdAt.gte = startDate
      if (endDate) where.createdAt.lte = endDate
    }

    if (endpoint) {
      where.endpoint = endpoint
    }

    if (statusCode) {
      where.statusCode = statusCode
    }

    const [items, total] = await Promise.all([
      prisma.apiAuditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          method: true,
          endpoint: true,
          path: true,
          statusCode: true,
          responseTime: true,
          errorCode: true,
          clientIp: true,
          createdAt: true,
          traceId: true,
        },
      }),
      prisma.apiAuditLog.count({ where }),
    ])

    return {
      items,
      total,
      page,
      pageSize,
    }
  }

  /**
   * 獲取端點統計
   */
  async getEndpointStats(
    apiKeyId: string,
    startDate: Date,
    endDate: Date
  ): Promise<Array<{
    endpoint: string
    count: number
    avgResponseTime: number
    errorRate: number
  }>> {
    const logs = await prisma.apiAuditLog.groupBy({
      by: ['endpoint'],
      where: {
        apiKeyId,
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      _count: true,
      _avg: {
        responseTime: true,
      },
    })

    // 獲取錯誤計數
    const errorCounts = await prisma.apiAuditLog.groupBy({
      by: ['endpoint'],
      where: {
        apiKeyId,
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
        statusCode: { gte: 400 },
      },
      _count: true,
    })

    const errorMap = new Map(errorCounts.map((e) => [e.endpoint, e._count]))

    return logs.map((log) => ({
      endpoint: log.endpoint,
      count: log._count,
      avgResponseTime: Math.round(log._avg.responseTime || 0),
      errorRate:
        Math.round(((errorMap.get(log.endpoint) || 0) / log._count) * 10000) / 100,
    }))
  }
}

export const auditLogService = new AuditLogService()
```

---

## 6. API 路由設計

### 6.1 API Key 管理端點

```typescript
// app/api/admin/api-keys/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { apiKeyService } from '@/lib/services/externalApi/apiKeyService'
import { authOptions } from '@/lib/auth'

// 創建 API Key 驗證
const createApiKeySchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  allowedCities: z.array(z.string()).min(1),
  allowedOperations: z.array(z.enum(['submit', 'query', 'result'])).min(1),
  rateLimit: z.number().min(1).max(1000).optional(),
  expiresAt: z.string().datetime().optional(),
  allowedIps: z.array(z.string().ip()).optional(),
})

/**
 * POST /api/admin/api-keys - 創建 API Key
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || !['ADMIN', 'SUPER_USER'].includes(session.user.role)) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Admin access required' } },
        { status: 403 }
      )
    }

    const body = await request.json()
    const validated = createApiKeySchema.parse(body)

    const result = await apiKeyService.createApiKey(
      {
        ...validated,
        expiresAt: validated.expiresAt ? new Date(validated.expiresAt) : undefined,
      },
      session.user.id
    )

    return NextResponse.json(
      {
        data: result,
        message: 'API Key created. Please save the key securely - it will not be shown again.',
      },
      { status: 201 }
    )
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request',
            details: error.errors,
          },
        },
        { status: 400 }
      )
    }

    console.error('Create API key error:', error)
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to create API key' } },
      { status: 500 }
    )
  }
}

/**
 * GET /api/admin/api-keys - 列出 API Keys
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || !['ADMIN', 'SUPER_USER'].includes(session.user.role)) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Admin access required' } },
        { status: 403 }
      )
    }

    const searchParams = request.nextUrl.searchParams
    const result = await apiKeyService.listApiKeys(session.user.id, {
      includeInactive: searchParams.get('includeInactive') === 'true',
      page: parseInt(searchParams.get('page') || '1'),
      pageSize: Math.min(parseInt(searchParams.get('pageSize') || '20'), 100),
    })

    return NextResponse.json({ data: result }, { status: 200 })
  } catch (error) {
    console.error('List API keys error:', error)
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to list API keys' } },
      { status: 500 }
    )
  }
}
```

### 6.2 單一 API Key 操作端點

```typescript
// app/api/admin/api-keys/[keyId]/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { apiKeyService } from '@/lib/services/externalApi/apiKeyService'
import { authOptions } from '@/lib/auth'

const updateApiKeySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  allowedCities: z.array(z.string()).optional(),
  allowedOperations: z.array(z.enum(['submit', 'query', 'result'])).optional(),
  rateLimit: z.number().min(1).max(1000).optional(),
  expiresAt: z.string().datetime().nullable().optional(),
  allowedIps: z.array(z.string().ip()).nullable().optional(),
})

/**
 * GET /api/admin/api-keys/{keyId} - 獲取 API Key 詳情
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { keyId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || !['ADMIN', 'SUPER_USER'].includes(session.user.role)) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Admin access required' } },
        { status: 403 }
      )
    }

    const apiKey = await apiKeyService.getApiKey(params.keyId, session.user.id)

    if (!apiKey) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'API key not found' } },
        { status: 404 }
      )
    }

    return NextResponse.json({ data: apiKey }, { status: 200 })
  } catch (error) {
    console.error('Get API key error:', error)
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to get API key' } },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/admin/api-keys/{keyId} - 更新 API Key
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { keyId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || !['ADMIN', 'SUPER_USER'].includes(session.user.role)) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Admin access required' } },
        { status: 403 }
      )
    }

    const body = await request.json()
    const validated = updateApiKeySchema.parse(body)

    const result = await apiKeyService.updateApiKey(
      params.keyId,
      session.user.id,
      {
        ...validated,
        expiresAt:
          validated.expiresAt === null
            ? null
            : validated.expiresAt
              ? new Date(validated.expiresAt)
              : undefined,
      }
    )

    if (!result) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'API key not found' } },
        { status: 404 }
      )
    }

    return NextResponse.json({ data: result }, { status: 200 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request',
            details: error.errors,
          },
        },
        { status: 400 }
      )
    }

    console.error('Update API key error:', error)
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to update API key' } },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/admin/api-keys/{keyId} - 刪除 API Key
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { keyId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || !['ADMIN', 'SUPER_USER'].includes(session.user.role)) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Admin access required' } },
        { status: 403 }
      )
    }

    const success = await apiKeyService.deleteApiKey(params.keyId, session.user.id)

    if (!success) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'API key not found' } },
        { status: 404 }
      )
    }

    return NextResponse.json(
      { message: 'API key deleted successfully' },
      { status: 200 }
    )
  } catch (error) {
    console.error('Delete API key error:', error)
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to delete API key' } },
      { status: 500 }
    )
  }
}
```

### 6.3 API Key 統計端點

```typescript
// app/api/admin/api-keys/[keyId]/stats/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { apiKeyService } from '@/lib/services/externalApi/apiKeyService'
import { authOptions } from '@/lib/auth'

export async function GET(
  request: NextRequest,
  { params }: { params: { keyId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || !['ADMIN', 'SUPER_USER'].includes(session.user.role)) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Admin access required' } },
        { status: 403 }
      )
    }

    const searchParams = request.nextUrl.searchParams
    const startDate = searchParams.get('startDate')
      ? new Date(searchParams.get('startDate')!)
      : undefined
    const endDate = searchParams.get('endDate')
      ? new Date(searchParams.get('endDate')!)
      : undefined

    const stats = await apiKeyService.getApiKeyStats(
      params.keyId,
      session.user.id,
      { startDate, endDate }
    )

    if (!stats) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'API key not found' } },
        { status: 404 }
      )
    }

    return NextResponse.json({ data: stats }, { status: 200 })
  } catch (error) {
    console.error('Get API key stats error:', error)
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to get stats' } },
      { status: 500 }
    )
  }
}
```

---

## 7. 前端組件

### 7.1 API Key 管理頁面

```typescript
// app/admin/api-keys/page.tsx

import { ApiKeyManagement } from '@/components/admin/ApiKeyManagement'
import { requireAdminAuth } from '@/lib/auth/requireAuth'

export default async function ApiKeysPage() {
  await requireAdminAuth()

  return (
    <div className="container mx-auto py-8">
      <ApiKeyManagement />
    </div>
  )
}
```

### 7.2 API Key 管理組件

由於組件代碼較長，主要功能包括：
- API Key 列表顯示（含分頁）
- 創建 API Key 表單
- 編輯 API Key 設定
- 啟用/停用切換
- 刪除確認
- 複製金鑰到剪貼簿
- 使用統計圖表

詳細實作請參考 Story 原文中的 `ApiKeyManagement.tsx`。

---

## 8. 測試計劃

### 8.1 單元測試

```typescript
// __tests__/services/externalApi/apiKeyService.test.ts

import { apiKeyService } from '@/lib/services/externalApi/apiKeyService'
import { prismaMock } from '@/lib/__mocks__/prisma'

describe('ApiKeyService', () => {
  describe('createApiKey', () => {
    it('應創建有效的 API Key', async () => {
      prismaMock.externalApiKey.create.mockResolvedValue({
        id: 'key-1',
        name: 'Test Key',
        keyHash: 'hashed',
        keyPrefix: 'inv_abc12345',
        allowedCities: ['*'],
        allowedOperations: ['submit', 'query', 'result'],
        rateLimit: 60,
        isActive: true,
        createdAt: new Date(),
        usageCount: BigInt(0),
      } as any)

      const result = await apiKeyService.createApiKey(
        {
          name: 'Test Key',
          allowedCities: ['*'],
          allowedOperations: ['submit', 'query', 'result'],
        },
        'user-1'
      )

      expect(result.apiKey).toMatch(/^inv_[a-f0-9]{32}$/)
      expect(result.webhookSecret).toHaveLength(64)
      expect(result.name).toBe('Test Key')
    })
  })

  describe('validateApiKey', () => {
    it('有效 API Key 應返回物件', async () => {
      prismaMock.externalApiKey.findUnique.mockResolvedValue({
        id: 'key-1',
        isActive: true,
        expiresAt: null,
        deletedAt: null,
      } as any)

      prismaMock.externalApiKey.update.mockResolvedValue({} as any)

      const result = await apiKeyService.validateApiKey('inv_validkey12345678901234567890')
      expect(result).toBeDefined()
    })

    it('停用的 API Key 應返回 null', async () => {
      prismaMock.externalApiKey.findUnique.mockResolvedValue({
        id: 'key-1',
        isActive: false,
      } as any)

      const result = await apiKeyService.validateApiKey('inv_inactivekey12345678901234567')
      expect(result).toBeNull()
    })

    it('過期的 API Key 應返回 null', async () => {
      prismaMock.externalApiKey.findUnique.mockResolvedValue({
        id: 'key-1',
        isActive: true,
        expiresAt: new Date(Date.now() - 1000),
      } as any)

      const result = await apiKeyService.validateApiKey('inv_expiredkey12345678901234567')
      expect(result).toBeNull()
    })

    it('格式錯誤的 API Key 應返回 null', async () => {
      const result = await apiKeyService.validateApiKey('invalid_format')
      expect(result).toBeNull()
    })
  })

  describe('toggleApiKey', () => {
    it('應正確切換啟用狀態', async () => {
      prismaMock.externalApiKey.findFirst.mockResolvedValue({
        id: 'key-1',
        isActive: true,
      } as any)

      prismaMock.externalApiKey.update.mockResolvedValue({
        id: 'key-1',
        isActive: false,
        usageCount: BigInt(0),
      } as any)

      const result = await apiKeyService.toggleApiKey('key-1', 'user-1', false)
      expect(result?.isActive).toBe(false)
    })
  })
})
```

### 8.2 認證中間件測試

```typescript
// __tests__/middleware/externalApiAuthMiddleware.test.ts

import { externalApiAuthMiddleware } from '@/lib/middleware/externalApiAuthMiddleware'
import { apiKeyService } from '@/lib/services/externalApi/apiKeyService'
import { createMockRequest } from '@/lib/test-utils/mockRequest'

jest.mock('@/lib/services/externalApi/apiKeyService')

describe('externalApiAuthMiddleware', () => {
  it('缺少 Authorization 應返回 401', async () => {
    const request = createMockRequest({
      method: 'GET',
    })

    const result = await externalApiAuthMiddleware(request, ['query'])

    expect(result.authorized).toBe(false)
    expect(result.errorCode).toBe('MISSING_API_KEY')
    expect(result.statusCode).toBe(401)
  })

  it('無效 API Key 應返回 401', async () => {
    ;(apiKeyService.validateApiKey as jest.Mock).mockResolvedValue(null)

    const request = createMockRequest({
      method: 'GET',
      headers: {
        Authorization: 'Bearer inv_invalid12345678901234567890',
      },
    })

    const result = await externalApiAuthMiddleware(request, ['query'])

    expect(result.authorized).toBe(false)
    expect(result.errorCode).toBe('INVALID_API_KEY')
  })

  it('權限不足應返回 403', async () => {
    ;(apiKeyService.validateApiKey as jest.Mock).mockResolvedValue({
      id: 'key-1',
      allowedOperations: ['query'],
      allowedIps: null,
      blockedIps: null,
    })

    const request = createMockRequest({
      method: 'POST',
      headers: {
        Authorization: 'Bearer inv_validkey12345678901234567890',
      },
    })

    const result = await externalApiAuthMiddleware(request, ['submit'])

    expect(result.authorized).toBe(false)
    expect(result.errorCode).toBe('PERMISSION_DENIED')
    expect(result.statusCode).toBe(403)
  })

  it('有效認證應返回成功', async () => {
    const mockApiKey = {
      id: 'key-1',
      allowedOperations: ['submit', 'query', 'result'],
      allowedIps: null,
      blockedIps: null,
    }

    ;(apiKeyService.validateApiKey as jest.Mock).mockResolvedValue(mockApiKey)

    const request = createMockRequest({
      method: 'GET',
      headers: {
        Authorization: 'Bearer inv_validkey12345678901234567890',
      },
    })

    const result = await externalApiAuthMiddleware(request, ['query'])

    expect(result.authorized).toBe(true)
    expect(result.apiKey).toEqual(mockApiKey)
  })
})
```

### 8.3 速率限制測試

```typescript
// __tests__/services/externalApi/rateLimitService.test.ts

import { rateLimitService } from '@/lib/services/externalApi/rateLimitService'

describe('RateLimitService', () => {
  const mockApiKey = {
    id: 'test-key-id',
    rateLimit: 5,
  } as any

  beforeEach(async () => {
    await rateLimitService.resetRateLimit(mockApiKey.id)
  })

  it('未超限應允許請求', async () => {
    const result = await rateLimitService.checkRateLimit(mockApiKey)

    expect(result.allowed).toBe(true)
    expect(result.remaining).toBe(4)
  })

  it('超過限制應拒絕請求', async () => {
    // 發送 5 個請求
    for (let i = 0; i < 5; i++) {
      await rateLimitService.checkRateLimit(mockApiKey)
    }

    // 第 6 個請求應被拒絕
    const result = await rateLimitService.checkRateLimit(mockApiKey)

    expect(result.allowed).toBe(false)
    expect(result.remaining).toBe(0)
    expect(result.retryAfter).toBeGreaterThan(0)
  })
})
```

---

## 9. 實作注意事項

### 9.1 安全考量
- API Key 使用 SHA-256 儲存，原始值不保留
- 審計日誌自動過濾敏感欄位
- 支援 IP 白名單/黑名單
- 認證失敗記錄用於安全監控

### 9.2 效能優化
- Redis 快取 API Key 驗證結果（短期）
- 使用統計異步更新，不阻塞請求
- 審計日誌批量寫入

### 9.3 高可用性
- Redis 連接池管理
- 認證失敗時的降級策略
- 審計日誌寫入失敗不影響主請求

---

## 10. 部署注意事項

### 10.1 環境變數
```bash
# Redis（速率限制）
REDIS_URL=redis://localhost:6379

# API Key 設定
API_KEY_DEFAULT_RATE_LIMIT=60
API_KEY_MAX_RATE_LIMIT=1000
```

### 10.2 資料庫遷移
```bash
npx prisma migrate dev --name add_external_api_auth
```

### 10.3 監控指標
| 指標 | 說明 | 告警閾值 |
|------|------|----------|
| auth_success_rate | 認證成功率 | < 95% |
| rate_limit_hit_count | 速率限制觸發次數 | > 1000/hour |
| api_key_usage_distribution | API Key 使用分佈 | - |
| auth_failure_by_reason | 認證失敗原因分佈 | - |

---

## 11. 相依性

### 11.1 內部相依
| 相依項目 | 說明 |
|----------|------|
| Story 1-1 | Azure AD SSO（管理員認證） |

### 11.2 外部相依
| 相依項目 | 版本 | 說明 |
|----------|------|------|
| ioredis | ^5.3.0 | Redis 客戶端（速率限制） |
| crypto (Node.js) | Built-in | SHA-256 雜湊 |
| next-auth | ^4.x | 管理員認證 |
| zod | ^3.22.0 | 請求驗證 |

### 11.3 API 端點摘要
| 端點 | 方法 | 說明 | 權限 |
|------|------|------|------|
| `/api/admin/api-keys` | GET | 列出 API Keys | Admin |
| `/api/admin/api-keys` | POST | 創建 API Key | Admin |
| `/api/admin/api-keys/{keyId}` | GET | 獲取詳情 | Admin |
| `/api/admin/api-keys/{keyId}` | PATCH | 更新設定 | Admin |
| `/api/admin/api-keys/{keyId}` | DELETE | 刪除 | Admin |
| `/api/admin/api-keys/{keyId}/toggle` | POST | 啟用/停用 | Admin |
| `/api/admin/api-keys/{keyId}/stats` | GET | 使用統計 | Admin |
| `/api/admin/api-keys/{keyId}/audit-logs` | GET | 審計日誌 | Admin |
