# Story 11-5: API 訪問控制與認證

## Story 資訊

- **Epic**: 11 - 對外 API 服務
- **功能需求**: FR68 (API 訪問控制)
- **優先級**: Critical
- **故事點數**: 8
- **相關 Stories**:
  - Story 11-1 (API 發票提交端點)
  - Story 11-2 (API 處理狀態查詢端點)
  - Story 11-3 (API 處理結果獲取端點)
  - Story 11-4 (Webhook 通知服務)
  - Story 1-1 (Azure AD SSO 登入)

## 使用者故事

**As a** 系統管理員,
**I want** 管理 API 訪問權限和認證,
**So that** 確保 API 安全並可追蹤使用情況。

## 驗收標準

### AC1: API Key 認證

**Given** 外部系統需要訪問 API
**When** 發送請求
**Then** 必須在 Header 中包含有效的 API Key：
- `Authorization: Bearer {api_key}`
**And** 無效或缺失的 API Key 返回 HTTP 401

### AC2: API Key 管理

**Given** 系統管理員在管理頁面
**When** 管理 API Key
**Then** 可以執行：
- 創建新 API Key（指定名稱、城市權限、速率限制）
- 查看現有 API Key 列表
- 停用/重新啟用 API Key
- 刪除 API Key（不可恢復）

### AC3: 權限配置

**Given** API Key 創建
**When** 設定權限
**Then** 可以配置：
- 允許訪問的城市（cityCode 列表）
- 允許的操作（submit/query/result）
- 速率限制（每分鐘請求數）
- 有效期限（可選）

### AC4: 速率限制

**Given** API 調用
**When** 超過速率限制
**Then** 返回 HTTP 429 Too Many Requests
**And** 包含 `Retry-After` Header

### AC5: 審計日誌

**Given** API 調用
**When** 任何請求
**Then** 記錄至審計日誌：
- API Key ID
- 調用端點
- 請求參數
- 回應狀態
- 調用時間
- 客戶端 IP

## 技術規格

### 1. 資料模型

```prisma
// 外部 API Key
model ExternalApiKey {
  id                String    @id @default(cuid())

  // 基本資訊
  name              String
  description       String?
  keyHash           String    @unique  // SHA-256 hash of the key
  keyPrefix         String               // 前 8 字符用於識別

  // 所有者
  createdById       String
  createdBy         User      @relation("ApiKeyCreator", fields: [createdById], references: [id])
  organizationId    String?

  // 權限設定
  allowedCities     Json      // string[] - 城市代碼列表，'*' 表示全部
  allowedOperations Json      // string[] - 操作列表：submit, query, result
  scopes            Json?     // 額外的細粒度權限

  // 速率限制
  rateLimit         Int       @default(60)  // 每分鐘請求數
  rateLimitBurst    Int?                    // 突發請求限制

  // Webhook 配置
  webhookSecret     String?   // 用於 Webhook 簽名

  // 狀態
  isActive          Boolean   @default(true)
  expiresAt         DateTime?

  // 使用統計
  lastUsedAt        DateTime?
  usageCount        BigInt    @default(0)
  monthlyUsage      Int       @default(0)
  monthlyReset      DateTime?

  // IP 限制（可選）
  allowedIps        Json?     // string[] - 允許的 IP 列表
  blockedIps        Json?     // string[] - 封鎖的 IP 列表

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

// API 認證嘗試記錄
model ApiAuthAttempt {
  id              String    @id @default(cuid())
  keyPrefix       String?   // API Key 前綴（用於追蹤）
  ip              String
  userAgent       String?
  success         Boolean
  failureReason   String?
  createdAt       DateTime  @default(now())

  @@index([ip])
  @@index([createdAt])
  @@index([keyPrefix])
}

// API 審計日誌
model ApiAuditLog {
  id              String    @id @default(cuid())

  // API Key 資訊
  apiKeyId        String
  apiKey          ExternalApiKey @relation(fields: [apiKeyId], references: [id])

  // 請求資訊
  method          String
  endpoint        String
  path            String
  queryParams     Json?
  requestBody     Json?     // 敏感資訊已過濾

  // 回應資訊
  statusCode      Int
  responseTime    Int       // 毫秒
  errorCode       String?
  errorMessage    String?

  // 客戶端資訊
  clientIp        String
  userAgent       String?
  country         String?   // GeoIP 查詢結果
  city            String?

  // 時間記錄
  createdAt       DateTime  @default(now())

  @@index([apiKeyId])
  @@index([endpoint])
  @@index([statusCode])
  @@index([createdAt])
  @@index([clientIp])
}
```

### 2. API Key 管理服務

```typescript
// lib/services/externalApi/apiKeyService.ts
import { prisma } from '@/lib/prisma'
import { createHash, randomBytes } from 'crypto'
import { ExternalApiKey } from '@prisma/client'

// API Key 格式：前綴_隨機字串（例如：inv_a1b2c3d4e5f6g7h8）
const KEY_PREFIX = 'inv'
const KEY_LENGTH = 32

export interface CreateApiKeyRequest {
  name: string
  description?: string
  allowedCities: string[]
  allowedOperations: string[]
  rateLimit?: number
  expiresAt?: Date
  allowedIps?: string[]
}

export interface ApiKeyResponse {
  id: string
  name: string
  description?: string
  keyPrefix: string
  allowedCities: string[]
  allowedOperations: string[]
  rateLimit: number
  isActive: boolean
  expiresAt?: string
  createdAt: string
  lastUsedAt?: string
  usageCount: number
}

export interface CreateApiKeyResponse extends ApiKeyResponse {
  apiKey: string  // 只在創建時返回完整 key
  webhookSecret: string
}

export class ApiKeyService {
  // 創建 API Key
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
        rateLimit: request.rateLimit || 60,
        expiresAt: request.expiresAt,
        allowedIps: request.allowedIps,
        webhookSecret,
      },
    })

    return {
      ...this.toResponse(apiKey),
      apiKey: rawKey,  // 只在創建時返回
      webhookSecret,
    }
  }

  // 生成 API Key
  private generateApiKey(): string {
    const randomPart = randomBytes(KEY_LENGTH / 2).toString('hex')
    return `${KEY_PREFIX}_${randomPart}`
  }

  // Hash API Key
  private hashApiKey(key: string): string {
    return createHash('sha256').update(key).digest('hex')
  }

  // 驗證 API Key
  async validateApiKey(rawKey: string): Promise<ExternalApiKey | null> {
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

    return apiKey
  }

  // 獲取 API Key 列表
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

  // 獲取 API Key 詳情
  async getApiKey(
    keyId: string,
    userId: string
  ): Promise<ApiKeyResponse | null> {
    const apiKey = await prisma.externalApiKey.findFirst({
      where: {
        id: keyId,
        createdById: userId,
        deletedAt: null,
      },
    })

    return apiKey ? this.toResponse(apiKey) : null
  }

  // 更新 API Key
  async updateApiKey(
    keyId: string,
    userId: string,
    updates: {
      name?: string
      description?: string
      allowedCities?: string[]
      allowedOperations?: string[]
      rateLimit?: number
      expiresAt?: Date | null
      allowedIps?: string[] | null
    }
  ): Promise<ApiKeyResponse | null> {
    // 驗證權限
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

  // 啟用/停用 API Key
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

  // 刪除 API Key（軟刪除）
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

  // 重新生成 Webhook Secret
  async regenerateWebhookSecret(
    keyId: string,
    userId: string
  ): Promise<string | null> {
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

  // 獲取 API Key 使用統計
  async getApiKeyStats(
    keyId: string,
    userId: string,
    options?: {
      startDate?: Date
      endDate?: Date
    }
  ): Promise<{
    totalRequests: number
    successRate: number
    avgResponseTime: number
    requestsByEndpoint: Record<string, number>
    requestsByStatus: Record<string, number>
    requestsByDay: Array<{ date: string; count: number }>
  } | null> {
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

    // 計算統計數據
    const totalRequests = logs.length
    const successfulRequests = logs.filter((l) => l.statusCode < 400).length
    const successRate = totalRequests > 0 ? successfulRequests / totalRequests : 0
    const avgResponseTime =
      totalRequests > 0
        ? logs.reduce((sum, l) => sum + l.responseTime, 0) / totalRequests
        : 0

    // 按端點分組
    const requestsByEndpoint: Record<string, number> = {}
    logs.forEach((l) => {
      requestsByEndpoint[l.endpoint] = (requestsByEndpoint[l.endpoint] || 0) + 1
    })

    // 按狀態碼分組
    const requestsByStatus: Record<string, number> = {}
    logs.forEach((l) => {
      const statusGroup = `${Math.floor(l.statusCode / 100)}xx`
      requestsByStatus[statusGroup] = (requestsByStatus[statusGroup] || 0) + 1
    })

    // 按日期分組
    const requestsByDay: Array<{ date: string; count: number }> = []
    const dayMap = new Map<string, number>()
    logs.forEach((l) => {
      const date = l.createdAt.toISOString().split('T')[0]
      dayMap.set(date, (dayMap.get(date) || 0) + 1)
    })
    dayMap.forEach((count, date) => {
      requestsByDay.push({ date, count })
    })
    requestsByDay.sort((a, b) => a.date.localeCompare(b.date))

    return {
      totalRequests,
      successRate,
      avgResponseTime,
      requestsByEndpoint,
      requestsByStatus,
      requestsByDay,
    }
  }

  // 轉換為回應格式
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

### 3. 審計日誌服務

```typescript
// lib/services/externalApi/auditLogService.ts
import { prisma } from '@/lib/prisma'
import { NextRequest } from 'next/server'

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
}

export class AuditLogService {
  // 記錄 API 調用
  async logRequest(entry: AuditLogEntry): Promise<void> {
    try {
      // 過濾敏感資料
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
        },
      })
    } catch (error) {
      console.error('Failed to log API request:', error)
      // 不拋出錯誤，避免影響主要請求
    }
  }

  // 過濾敏感資料
  private sanitizeRequestBody(body?: Record<string, any>): Record<string, any> | undefined {
    if (!body) return undefined

    const sensitiveFields = [
      'password',
      'secret',
      'apiKey',
      'token',
      'authorization',
      'base64Content',
      'content',
    ]

    const sanitized = { ...body }

    for (const field of sensitiveFields) {
      if (sanitized[field]) {
        sanitized[field] = '[REDACTED]'
      }
    }

    return sanitized
  }

  // 從請求提取審計資訊
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

  // 標準化端點（移除動態參數）
  private normalizeEndpoint(path: string): string {
    return path
      .replace(/\/[a-zA-Z0-9_-]{20,}(?=\/|$)/g, '/{id}')  // CUID
      .replace(/\/\d+(?=\/|$)/g, '/{id}')                  // 數字 ID
  }

  // 查詢審計日誌
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
}

export const auditLogService = new AuditLogService()
```

### 4. API Key 管理頁面 API

```typescript
// app/api/admin/api-keys/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { apiKeyService } from '@/lib/services/externalApi/apiKeyService'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { z } from 'zod'

const createApiKeySchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  allowedCities: z.array(z.string()).min(1),
  allowedOperations: z.array(z.enum(['submit', 'query', 'result'])).min(1),
  rateLimit: z.number().min(1).max(1000).optional(),
  expiresAt: z.string().datetime().optional(),
  allowedIps: z.array(z.string().ip()).optional(),
})

// 創建 API Key
export async function POST(request: NextRequest) {
  try {
    // 驗證管理員權限
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
        message: 'API Key created successfully. Please save the key securely - it will not be shown again.',
      },
      { status: 201 }
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

// 列出 API Keys
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
    const options = {
      includeInactive: searchParams.get('includeInactive') === 'true',
      page: parseInt(searchParams.get('page') || '1'),
      pageSize: Math.min(parseInt(searchParams.get('pageSize') || '20'), 100),
    }

    const result = await apiKeyService.listApiKeys(session.user.id, options)

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

```typescript
// app/api/admin/api-keys/[keyId]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { apiKeyService } from '@/lib/services/externalApi/apiKeyService'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { z } from 'zod'

const updateApiKeySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  allowedCities: z.array(z.string()).optional(),
  allowedOperations: z.array(z.enum(['submit', 'query', 'result'])).optional(),
  rateLimit: z.number().min(1).max(1000).optional(),
  expiresAt: z.string().datetime().nullable().optional(),
  allowedIps: z.array(z.string().ip()).nullable().optional(),
})

// 獲取 API Key 詳情
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

// 更新 API Key
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
        expiresAt: validated.expiresAt === null
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
            message: 'Invalid request parameters',
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

// 刪除 API Key
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

```typescript
// app/api/admin/api-keys/[keyId]/toggle/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { apiKeyService } from '@/lib/services/externalApi/apiKeyService'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function POST(
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

    const { isActive } = await request.json()

    const result = await apiKeyService.toggleApiKey(
      params.keyId,
      session.user.id,
      isActive
    )

    if (!result) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'API key not found' } },
        { status: 404 }
      )
    }

    return NextResponse.json(
      {
        data: result,
        message: `API key ${isActive ? 'enabled' : 'disabled'} successfully`,
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('Toggle API key error:', error)
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to toggle API key' } },
      { status: 500 }
    )
  }
}
```

### 5. API Key 管理前端組件

```typescript
// components/admin/ApiKeyManagement.tsx
'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Modal } from '@/components/ui/Modal'
import { Badge } from '@/components/ui/Badge'
import { Table } from '@/components/ui/Table'
import { toast } from '@/hooks/useToast'
import { Copy, Eye, EyeOff, Trash2, RefreshCw, Settings } from 'lucide-react'

interface ApiKey {
  id: string
  name: string
  description?: string
  keyPrefix: string
  allowedCities: string[]
  allowedOperations: string[]
  rateLimit: number
  isActive: boolean
  expiresAt?: string
  createdAt: string
  lastUsedAt?: string
  usageCount: number
}

export function ApiKeyManagement() {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newKeyData, setNewKeyData] = useState<{
    apiKey?: string
    webhookSecret?: string
  } | null>(null)

  // 載入 API Keys
  useEffect(() => {
    loadApiKeys()
  }, [])

  const loadApiKeys = async () => {
    try {
      const response = await fetch('/api/admin/api-keys?includeInactive=true')
      const data = await response.json()

      if (data.data) {
        setApiKeys(data.data.items)
      }
    } catch (error) {
      toast.error('Failed to load API keys')
    } finally {
      setLoading(false)
    }
  }

  // 創建 API Key
  const handleCreateKey = async (formData: any) => {
    try {
      const response = await fetch('/api/admin/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      const data = await response.json()

      if (response.ok) {
        setNewKeyData({
          apiKey: data.data.apiKey,
          webhookSecret: data.data.webhookSecret,
        })
        await loadApiKeys()
        toast.success('API Key created successfully')
      } else {
        toast.error(data.error?.message || 'Failed to create API key')
      }
    } catch (error) {
      toast.error('Failed to create API key')
    }
  }

  // 切換啟用狀態
  const handleToggle = async (keyId: string, isActive: boolean) => {
    try {
      const response = await fetch(`/api/admin/api-keys/${keyId}/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive }),
      })

      if (response.ok) {
        await loadApiKeys()
        toast.success(`API Key ${isActive ? 'enabled' : 'disabled'}`)
      }
    } catch (error) {
      toast.error('Failed to toggle API key')
    }
  }

  // 刪除 API Key
  const handleDelete = async (keyId: string) => {
    if (!confirm('Are you sure you want to delete this API key? This action cannot be undone.')) {
      return
    }

    try {
      const response = await fetch(`/api/admin/api-keys/${keyId}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        await loadApiKeys()
        toast.success('API Key deleted')
      }
    } catch (error) {
      toast.error('Failed to delete API key')
    }
  }

  // 複製到剪貼簿
  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    toast.success(`${label} copied to clipboard`)
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">API Key Management</h2>
        <Button onClick={() => setShowCreateModal(true)}>
          Create API Key
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      ) : (
        <Table>
          <Table.Header>
            <Table.Row>
              <Table.Head>Name</Table.Head>
              <Table.Head>Key Prefix</Table.Head>
              <Table.Head>Permissions</Table.Head>
              <Table.Head>Rate Limit</Table.Head>
              <Table.Head>Status</Table.Head>
              <Table.Head>Last Used</Table.Head>
              <Table.Head>Actions</Table.Head>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {apiKeys.map((key) => (
              <Table.Row key={key.id}>
                <Table.Cell>
                  <div>
                    <div className="font-medium">{key.name}</div>
                    {key.description && (
                      <div className="text-sm text-gray-500">{key.description}</div>
                    )}
                  </div>
                </Table.Cell>
                <Table.Cell>
                  <code className="text-sm bg-gray-100 px-2 py-1 rounded">
                    {key.keyPrefix}...
                  </code>
                </Table.Cell>
                <Table.Cell>
                  <div className="flex flex-wrap gap-1">
                    {key.allowedOperations.map((op) => (
                      <Badge key={op} variant="outline" size="sm">
                        {op}
                      </Badge>
                    ))}
                  </div>
                </Table.Cell>
                <Table.Cell>{key.rateLimit}/min</Table.Cell>
                <Table.Cell>
                  <Badge
                    variant={key.isActive ? 'success' : 'secondary'}
                  >
                    {key.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </Table.Cell>
                <Table.Cell>
                  {key.lastUsedAt
                    ? new Date(key.lastUsedAt).toLocaleDateString()
                    : 'Never'}
                </Table.Cell>
                <Table.Cell>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleToggle(key.id, !key.isActive)}
                    >
                      {key.isActive ? <EyeOff size={16} /> : <Eye size={16} />}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(key.id)}
                    >
                      <Trash2 size={16} />
                    </Button>
                  </div>
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      )}

      {/* 創建 API Key Modal */}
      {showCreateModal && (
        <CreateApiKeyModal
          onClose={() => setShowCreateModal(false)}
          onCreate={handleCreateKey}
        />
      )}

      {/* 顯示新建的 API Key */}
      {newKeyData && (
        <Modal onClose={() => setNewKeyData(null)}>
          <div className="space-y-4">
            <h3 className="text-lg font-bold">API Key Created</h3>
            <p className="text-sm text-yellow-600">
              Please copy these credentials now. They will not be shown again.
            </p>

            <div className="space-y-2">
              <label className="text-sm font-medium">API Key</label>
              <div className="flex gap-2">
                <Input
                  value={newKeyData.apiKey}
                  readOnly
                  className="font-mono"
                />
                <Button
                  variant="outline"
                  onClick={() => copyToClipboard(newKeyData.apiKey!, 'API Key')}
                >
                  <Copy size={16} />
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Webhook Secret</label>
              <div className="flex gap-2">
                <Input
                  value={newKeyData.webhookSecret}
                  readOnly
                  className="font-mono"
                />
                <Button
                  variant="outline"
                  onClick={() => copyToClipboard(newKeyData.webhookSecret!, 'Webhook Secret')}
                >
                  <Copy size={16} />
                </Button>
              </div>
            </div>

            <Button
              className="w-full"
              onClick={() => setNewKeyData(null)}
            >
              I have saved these credentials
            </Button>
          </div>
        </Modal>
      )}
    </div>
  )
}

// 創建 API Key 表單
function CreateApiKeyModal({
  onClose,
  onCreate,
}: {
  onClose: () => void
  onCreate: (data: any) => void
}) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    allowedCities: ['*'],
    allowedOperations: ['submit', 'query', 'result'],
    rateLimit: 60,
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onCreate(formData)
  }

  return (
    <Modal onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <h3 className="text-lg font-bold">Create API Key</h3>

        <div className="space-y-2">
          <label className="text-sm font-medium">Name *</label>
          <Input
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="e.g., Production API Key"
            required
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Description</label>
          <Input
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Optional description"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Allowed Operations</label>
          <div className="flex gap-2">
            {['submit', 'query', 'result'].map((op) => (
              <label key={op} className="flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={formData.allowedOperations.includes(op)}
                  onChange={(e) => {
                    const ops = e.target.checked
                      ? [...formData.allowedOperations, op]
                      : formData.allowedOperations.filter((o) => o !== op)
                    setFormData({ ...formData, allowedOperations: ops })
                  }}
                />
                {op}
              </label>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Rate Limit (per minute)</label>
          <Input
            type="number"
            value={formData.rateLimit}
            onChange={(e) => setFormData({ ...formData, rateLimit: parseInt(e.target.value) })}
            min={1}
            max={1000}
          />
        </div>

        <div className="flex gap-2 justify-end">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">Create</Button>
        </div>
      </form>
    </Modal>
  )
}
```

## 測試案例

### 單元測試

```typescript
// __tests__/services/externalApi/apiKeyService.test.ts
import { apiKeyService } from '@/lib/services/externalApi/apiKeyService'
import { prismaMock } from '@/lib/__mocks__/prisma'

describe('ApiKeyService', () => {
  describe('createApiKey', () => {
    it('should create API key with hashed value', async () => {
      prismaMock.externalApiKey.create.mockResolvedValue({
        id: 'key-1',
        name: 'Test Key',
        keyHash: 'hashed_value',
        keyPrefix: 'inv_abc123',
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

      expect(result.apiKey).toMatch(/^inv_[a-f0-9]+$/)
      expect(result.webhookSecret).toHaveLength(64)
    })
  })

  describe('validateApiKey', () => {
    it('should return API key for valid key', async () => {
      const mockApiKey = {
        id: 'key-1',
        keyHash: 'valid_hash',
        isActive: true,
        expiresAt: null,
        deletedAt: null,
      }

      prismaMock.externalApiKey.findUnique.mockResolvedValue(mockApiKey as any)

      // Note: Would need to mock the hash function or use actual hash
      const result = await apiKeyService.validateApiKey('inv_test_key')

      expect(result).toEqual(mockApiKey)
    })

    it('should return null for inactive key', async () => {
      prismaMock.externalApiKey.findUnique.mockResolvedValue({
        id: 'key-1',
        isActive: false,
      } as any)

      const result = await apiKeyService.validateApiKey('inv_test_key')

      expect(result).toBeNull()
    })

    it('should return null for expired key', async () => {
      prismaMock.externalApiKey.findUnique.mockResolvedValue({
        id: 'key-1',
        isActive: true,
        expiresAt: new Date(Date.now() - 1000), // 已過期
      } as any)

      const result = await apiKeyService.validateApiKey('inv_test_key')

      expect(result).toBeNull()
    })
  })
})
```

## 部署注意事項

1. **安全性**
   - API Key 使用 SHA-256 hash 儲存
   - 從不記錄完整 API Key
   - 審計日誌過濾敏感資訊

2. **效能優化**
   - API Key 驗證結果快取（短期）
   - 審計日誌批量寫入
   - 索引優化查詢

3. **監控指標**
   - 認證成功/失敗率
   - 速率限制觸發次數
   - API Key 使用分佈

## 相依性

- Story 1-1: Azure AD SSO 登入（管理員認證）
- Story 11-1: API 發票提交端點（使用 API Key 認證）
- Story 11-4: Webhook 通知服務（Webhook Secret 管理）

---

## Implementation Notes

### 實現日期
2025-12-21

### 實現摘要

本 Story 完成了 API 訪問控制與認證系統的核心實現，包括：

1. **API Key 服務層 (`src/services/api-key.service.ts`)**
   - SHA-256 哈希儲存 API Key（安全性考量，原始 Key 只在創建時顯示一次）
   - Bearer Token 認證模式 (`Authorization: Bearer {api_key}`)
   - 支援 Key 輪替功能（保留配置、生成新 Key、停用舊 Key）
   - 軟刪除機制（deletedAt 標記）
   - 使用量統計追蹤

2. **API 審計日誌服務 (`src/services/api-audit-log.service.ts`)**
   - 批量寫入優化（減少資料庫壓力）
   - 敏感欄位過濾（password、secret、apiKey、token、authorization、base64Content、content）
   - 端點標準化（移除動態 ID 參數以便統計）
   - 查詢和統計功能

3. **Admin API 路由**
   - `POST /api/admin/api-keys` - 創建 API Key
   - `GET /api/admin/api-keys` - 列出 API Key（支援分頁和篩選）
   - `GET /api/admin/api-keys/[keyId]` - 獲取單一 Key 詳情
   - `PATCH /api/admin/api-keys/[keyId]` - 更新 Key 配置
   - `DELETE /api/admin/api-keys/[keyId]` - 刪除 Key（軟刪除）
   - `POST /api/admin/api-keys/[keyId]/rotate` - 輪替 Key
   - `GET /api/admin/api-keys/[keyId]/stats` - 使用統計

4. **前端組件**
   - `ApiKeyManagement.tsx` - 主管理介面（搜尋、篩選、列表、分頁）
   - `ApiKeyTable.tsx` - 表格組件（顯示 Key 列表與操作按鈕）
   - `CreateApiKeyDialog.tsx` - 創建對話框（包含權限配置表單）

5. **類型與常數**
   - `src/types/external-api/auth.ts` - API 認證相關類型定義
   - `src/lib/constants/api-auth.ts` - API 認證常數（Key 前綴、長度、敏感欄位等）

### 實現細節

#### 權限檢查模式
Admin API 路由使用以下權限檢查模式：
```typescript
const isAdmin =
  session.user.isGlobalAdmin ||
  session.user.roles?.some((r) => r.name === 'ADMIN' || r.name === 'GLOBAL_ADMIN');
```

#### 表單類型處理
CreateApiKeyDialog 使用 `z.number()` 而非 `z.coerce.number()` 以確保 react-hook-form 類型推斷正確，並透過 `valueAsNumber` 處理輸入轉換。

### 建立的檔案

| 檔案路徑 | 用途 |
|---------|------|
| `src/types/external-api/auth.ts` | API 認證類型定義 |
| `src/lib/constants/api-auth.ts` | API 認證常數 |
| `src/services/api-key.service.ts` | API Key 管理服務 |
| `src/services/api-audit-log.service.ts` | API 審計日誌服務 |
| `src/app/api/admin/api-keys/route.ts` | 列出/創建 API Key |
| `src/app/api/admin/api-keys/[keyId]/route.ts` | 單一 Key CRUD |
| `src/app/api/admin/api-keys/[keyId]/rotate/route.ts` | Key 輪替 |
| `src/app/api/admin/api-keys/[keyId]/stats/route.ts` | 使用統計 |
| `src/components/features/admin/api-keys/ApiKeyManagement.tsx` | 主管理組件 |
| `src/components/features/admin/api-keys/ApiKeyTable.tsx` | 表格組件 |
| `src/components/features/admin/api-keys/CreateApiKeyDialog.tsx` | 創建對話框 |
| `src/components/features/admin/api-keys/index.ts` | 組件導出 |

### 待辦事項

- [ ] 實現 EditApiKeyDialog 組件（編輯現有 Key 配置）
- [ ] 實現速率限制中間件（檢查請求頻率、返回 429）
- [ ] 實現 API Key 驗證中間件（用於 `/api/v1/*` 外部 API 路由）
- [ ] 添加單元測試
- [ ] 添加 E2E 測試

### 驗證狀態

- [x] TypeScript 類型檢查通過
- [x] ESLint 檢查通過
- [ ] 單元測試（待實現）
- [ ] E2E 測試（待實現）
