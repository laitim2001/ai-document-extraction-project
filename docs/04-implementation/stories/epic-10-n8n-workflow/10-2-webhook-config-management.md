# Story 10-2: Webhook 配置管理

## Story 資訊

- **Epic**: 10 - n8n 工作流整合
- **功能需求**: FR55 (工作流觸發)
- **優先級**: High
- **故事點數**: 8
- **相關 Stories**:
  - Story 10-1 (n8n 雙向通訊 API)
  - Story 10-7 (n8n 連接狀態監控)

## 使用者故事

**As a** 系統管理員,
**I want** 配置 n8n Webhook 設定,
**So that** 平台可以正確地向 n8n 發送通知。

## 驗收標準

### AC1: Webhook 配置表單

**Given** 系統管理員在系統設定頁面
**When** 導航至「n8n 整合」區塊
**Then** 顯示 Webhook 配置表單：
- n8n 基礎 URL
- Webhook 端點路徑
- 認證 Token
- 重試策略設定

### AC2: 連線測試功能

**Given** 配置完成
**When** 點擊「測試連線」
**Then** 系統發送測試請求至 n8n
**And** 顯示連線結果（成功/失敗/逾時）

### AC3: 城市級別配置

**Given** Webhook 配置
**When** 按城市配置
**Then** 支援城市級別的 Webhook 配置
**And** 不同城市可以連接不同的 n8n 實例

### AC4: 重試策略

**Given** Webhook 發送失敗
**When** 配置重試策略
**Then** 系統自動重試（最多 3 次）
**And** 重試間隔遞增（1秒、5秒、30秒）
**And** 超過重試次數後記錄失敗日誌

## 技術規格

### 1. 資料模型

```prisma
// Webhook 配置模型
model WebhookConfig {
  id              String    @id @default(cuid())

  // 基本配置
  name            String    // 配置名稱
  description     String?   // 描述

  // 連線設定
  baseUrl         String    // n8n 基礎 URL
  endpointPath    String    // Webhook 端點路徑
  authToken       String    // 加密儲存的認證 Token

  // 城市關聯
  cityCode        String?   // null 表示全域配置
  city            City?     @relation(fields: [cityCode], references: [code])

  // 重試策略
  retryStrategy   Json      // { maxAttempts: 3, delays: [1000, 5000, 30000] }
  timeoutMs       Int       @default(30000)

  // 事件訂閱
  subscribedEvents String[] // 訂閱的事件類型

  // 狀態
  isActive        Boolean   @default(true)

  // 連線狀態
  lastTestAt      DateTime?
  lastTestResult  WebhookTestResult?
  lastTestError   String?

  // 審計
  createdBy       String
  createdAt       DateTime  @default(now())
  updatedBy       String?
  updatedAt       DateTime  @updatedAt

  @@unique([cityCode, name])
  @@index([cityCode])
  @@index([isActive])
}

enum WebhookTestResult {
  SUCCESS
  FAILED
  TIMEOUT
  ERROR
}

// Webhook 配置變更歷史
model WebhookConfigHistory {
  id              String    @id @default(cuid())
  configId        String

  // 變更內容
  changeType      ConfigChangeType
  previousValue   Json?
  newValue        Json?

  // 審計
  changedBy       String
  changedAt       DateTime  @default(now())
  reason          String?

  @@index([configId])
  @@index([changedAt])
}

enum ConfigChangeType {
  CREATED
  UPDATED
  ACTIVATED
  DEACTIVATED
  DELETED
}
```

### 2. Webhook 配置服務

```typescript
// lib/services/n8n/webhookConfigService.ts
import { prisma } from '@/lib/prisma'
import { encrypt, decrypt } from '@/lib/utils/encryption'
import { WebhookConfig, WebhookTestResult } from '@prisma/client'

export interface CreateWebhookConfigInput {
  name: string
  description?: string
  baseUrl: string
  endpointPath: string
  authToken: string
  cityCode?: string
  retryStrategy?: {
    maxAttempts: number
    delays: number[]
  }
  timeoutMs?: number
  subscribedEvents: string[]
  createdBy: string
}

export interface UpdateWebhookConfigInput {
  name?: string
  description?: string
  baseUrl?: string
  endpointPath?: string
  authToken?: string
  retryStrategy?: {
    maxAttempts: number
    delays: number[]
  }
  timeoutMs?: number
  subscribedEvents?: string[]
  isActive?: boolean
  updatedBy: string
}

export interface WebhookTestResponse {
  success: boolean
  result: WebhookTestResult
  responseTime?: number
  statusCode?: number
  error?: string
}

const DEFAULT_RETRY_STRATEGY = {
  maxAttempts: 3,
  delays: [1000, 5000, 30000],
}

export class WebhookConfigService {
  // 創建配置
  async createConfig(input: CreateWebhookConfigInput): Promise<WebhookConfig> {
    // 加密 authToken
    const encryptedToken = await encrypt(input.authToken)

    const config = await prisma.webhookConfig.create({
      data: {
        name: input.name,
        description: input.description,
        baseUrl: input.baseUrl.replace(/\/$/, ''), // 移除尾部斜線
        endpointPath: input.endpointPath.startsWith('/')
          ? input.endpointPath
          : `/${input.endpointPath}`,
        authToken: encryptedToken,
        cityCode: input.cityCode,
        retryStrategy: input.retryStrategy || DEFAULT_RETRY_STRATEGY,
        timeoutMs: input.timeoutMs || 30000,
        subscribedEvents: input.subscribedEvents,
        createdBy: input.createdBy,
      },
    })

    // 記錄歷史
    await this.recordHistory(config.id, 'CREATED', null, config, input.createdBy)

    return config
  }

  // 更新配置
  async updateConfig(id: string, input: UpdateWebhookConfigInput): Promise<WebhookConfig> {
    const existing = await prisma.webhookConfig.findUnique({
      where: { id },
    })

    if (!existing) {
      throw new Error('Webhook config not found')
    }

    const updateData: any = {
      updatedBy: input.updatedBy,
    }

    if (input.name !== undefined) updateData.name = input.name
    if (input.description !== undefined) updateData.description = input.description
    if (input.baseUrl !== undefined) updateData.baseUrl = input.baseUrl.replace(/\/$/, '')
    if (input.endpointPath !== undefined) {
      updateData.endpointPath = input.endpointPath.startsWith('/')
        ? input.endpointPath
        : `/${input.endpointPath}`
    }
    if (input.authToken !== undefined) {
      updateData.authToken = await encrypt(input.authToken)
    }
    if (input.retryStrategy !== undefined) updateData.retryStrategy = input.retryStrategy
    if (input.timeoutMs !== undefined) updateData.timeoutMs = input.timeoutMs
    if (input.subscribedEvents !== undefined) updateData.subscribedEvents = input.subscribedEvents
    if (input.isActive !== undefined) updateData.isActive = input.isActive

    const updated = await prisma.webhookConfig.update({
      where: { id },
      data: updateData,
    })

    // 記錄歷史
    const changeType = input.isActive !== undefined && input.isActive !== existing.isActive
      ? (input.isActive ? 'ACTIVATED' : 'DEACTIVATED')
      : 'UPDATED'

    await this.recordHistory(id, changeType, existing, updated, input.updatedBy)

    return updated
  }

  // 測試連線
  async testConnection(id: string): Promise<WebhookTestResponse> {
    const config = await prisma.webhookConfig.findUnique({
      where: { id },
    })

    if (!config) {
      throw new Error('Webhook config not found')
    }

    const webhookUrl = `${config.baseUrl}${config.endpointPath}`
    const decryptedToken = await decrypt(config.authToken)

    const startTime = Date.now()

    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), config.timeoutMs)

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${decryptedToken}`,
          'X-Test-Request': 'true',
        },
        body: JSON.stringify({
          event: 'test',
          timestamp: new Date().toISOString(),
          message: 'Connection test from Invoice Processing Platform',
        }),
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      const responseTime = Date.now() - startTime

      const result: WebhookTestResult = response.ok ? 'SUCCESS' : 'FAILED'

      // 更新測試結果
      await prisma.webhookConfig.update({
        where: { id },
        data: {
          lastTestAt: new Date(),
          lastTestResult: result,
          lastTestError: response.ok ? null : `HTTP ${response.status}`,
        },
      })

      return {
        success: response.ok,
        result,
        responseTime,
        statusCode: response.status,
        error: response.ok ? undefined : `HTTP ${response.status}: ${response.statusText}`,
      }
    } catch (error) {
      const responseTime = Date.now() - startTime

      let result: WebhookTestResult = 'ERROR'
      let errorMessage = 'Unknown error'

      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          result = 'TIMEOUT'
          errorMessage = `Request timeout after ${config.timeoutMs}ms`
        } else {
          errorMessage = error.message
        }
      }

      // 更新測試結果
      await prisma.webhookConfig.update({
        where: { id },
        data: {
          lastTestAt: new Date(),
          lastTestResult: result,
          lastTestError: errorMessage,
        },
      })

      return {
        success: false,
        result,
        responseTime,
        error: errorMessage,
      }
    }
  }

  // 獲取配置（解密 Token）
  async getConfigWithToken(id: string): Promise<WebhookConfig & { decryptedToken: string }> {
    const config = await prisma.webhookConfig.findUnique({
      where: { id },
    })

    if (!config) {
      throw new Error('Webhook config not found')
    }

    const decryptedToken = await decrypt(config.authToken)

    return { ...config, decryptedToken }
  }

  // 列出配置
  async listConfigs(options?: {
    cityCode?: string
    isActive?: boolean
    includeGlobal?: boolean
  }): Promise<WebhookConfig[]> {
    const where: any = {}

    if (options?.isActive !== undefined) {
      where.isActive = options.isActive
    }

    if (options?.cityCode) {
      if (options.includeGlobal) {
        where.OR = [
          { cityCode: options.cityCode },
          { cityCode: null },
        ]
      } else {
        where.cityCode = options.cityCode
      }
    }

    return prisma.webhookConfig.findMany({
      where,
      orderBy: [
        { cityCode: 'asc' },
        { name: 'asc' },
      ],
    })
  }

  // 獲取城市的有效配置
  async getActiveConfigForCity(cityCode: string): Promise<WebhookConfig | null> {
    // 優先使用城市特定配置，其次使用全域配置
    const config = await prisma.webhookConfig.findFirst({
      where: {
        isActive: true,
        OR: [
          { cityCode },
          { cityCode: null },
        ],
      },
      orderBy: {
        cityCode: 'desc', // 城市特定配置優先
      },
    })

    return config
  }

  // 刪除配置
  async deleteConfig(id: string, deletedBy: string): Promise<void> {
    const config = await prisma.webhookConfig.findUnique({
      where: { id },
    })

    if (!config) {
      throw new Error('Webhook config not found')
    }

    // 記錄刪除歷史
    await this.recordHistory(id, 'DELETED', config, null, deletedBy)

    await prisma.webhookConfig.delete({
      where: { id },
    })
  }

  // 記錄變更歷史
  private async recordHistory(
    configId: string,
    changeType: string,
    previousValue: any,
    newValue: any,
    changedBy: string,
    reason?: string
  ): Promise<void> {
    // 移除敏感資訊
    const sanitize = (value: any) => {
      if (!value) return value
      const { authToken, ...rest } = value
      return { ...rest, authToken: '[REDACTED]' }
    }

    await prisma.webhookConfigHistory.create({
      data: {
        configId,
        changeType: changeType as any,
        previousValue: sanitize(previousValue),
        newValue: sanitize(newValue),
        changedBy,
        reason,
      },
    })
  }

  // 獲取變更歷史
  async getConfigHistory(configId: string, limit: number = 50): Promise<any[]> {
    return prisma.webhookConfigHistory.findMany({
      where: { configId },
      orderBy: { changedAt: 'desc' },
      take: limit,
    })
  }
}

export const webhookConfigService = new WebhookConfigService()
```

### 3. API 路由實現

```typescript
// app/api/admin/webhook-configs/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { webhookConfigService } from '@/lib/services/n8n/webhookConfigService'
import { hasPermission } from '@/lib/utils/permissions'
import { z } from 'zod'

const createConfigSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  baseUrl: z.string().url(),
  endpointPath: z.string().min(1),
  authToken: z.string().min(1),
  cityCode: z.string().optional(),
  retryStrategy: z.object({
    maxAttempts: z.number().min(1).max(10),
    delays: z.array(z.number().min(100).max(300000)),
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

  try {
    const configs = await webhookConfigService.listConfigs({
      cityCode,
      isActive: isActive === null ? undefined : isActive === 'true',
      includeGlobal: true,
    })

    // 移除敏感資訊
    const sanitizedConfigs = configs.map(({ authToken, ...config }) => ({
      ...config,
      hasAuthToken: !!authToken,
    }))

    return NextResponse.json({ data: sanitizedConfigs })
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

    // 移除敏感資訊
    const { authToken, ...sanitizedConfig } = config

    return NextResponse.json({ data: sanitizedConfig }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Create webhook config error:', error)
    return NextResponse.json(
      { error: 'Failed to create webhook config' },
      { status: 500 }
    )
  }
}
```

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
  description: z.string().max(500).optional(),
  baseUrl: z.string().url().optional(),
  endpointPath: z.string().min(1).optional(),
  authToken: z.string().min(1).optional(),
  retryStrategy: z.object({
    maxAttempts: z.number().min(1).max(10),
    delays: z.array(z.number().min(100).max(300000)),
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
    const config = await prisma.webhookConfig.findUnique({
      where: { id: params.id },
    })

    if (!config) {
      return NextResponse.json({ error: 'Config not found' }, { status: 404 })
    }

    // 移除敏感資訊
    const { authToken, ...sanitizedConfig } = config

    return NextResponse.json({ data: sanitizedConfig })
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

    // 移除敏感資訊
    const { authToken, ...sanitizedConfig } = config

    return NextResponse.json({ data: sanitizedConfig })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Update webhook config error:', error)
    return NextResponse.json(
      { error: 'Failed to update webhook config' },
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
      { error: 'Failed to delete webhook config' },
      { status: 500 }
    )
  }
}
```

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
      { error: 'Failed to test webhook connection' },
      { status: 500 }
    )
  }
}
```

### 4. React 組件

```typescript
// components/admin/webhook/WebhookConfigForm.tsx
'use client'

import React, { useState } from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Button,
  TextField,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  Alert,
  CircularProgress,
  IconButton,
  Chip,
  Box,
  Typography,
  Divider,
} from '@mui/material'
import { Add, Delete, PlayArrow, Check, Error, Timer } from '@mui/icons-material'

const formSchema = z.object({
  name: z.string().min(1, '請輸入名稱'),
  description: z.string().optional(),
  baseUrl: z.string().url('請輸入有效的 URL'),
  endpointPath: z.string().min(1, '請輸入端點路徑'),
  authToken: z.string().min(1, '請輸入認證 Token'),
  cityCode: z.string().optional(),
  timeoutMs: z.number().min(1000).max(300000),
  maxAttempts: z.number().min(1).max(10),
  delays: z.array(z.object({
    value: z.number().min(100).max(300000),
  })),
  subscribedEvents: z.array(z.string()),
  isActive: z.boolean(),
})

type FormData = z.infer<typeof formSchema>

interface WebhookConfigFormProps {
  initialData?: Partial<FormData>
  cities: Array<{ code: string; name: string }>
  onSubmit: (data: FormData) => Promise<void>
  onCancel: () => void
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

  const handleTest = async () => {
    setTesting(true)
    setTestResult(null)

    try {
      const response = await fetch(`/api/admin/webhook-configs/test-adhoc`, {
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

      setTestResult({
        success: data.data?.success || false,
        message: data.data?.success
          ? '連線成功'
          : data.data?.error || '連線失敗',
        responseTime: data.data?.responseTime,
      })
    } catch (error) {
      setTestResult({
        success: false,
        message: '測試請求失敗',
      })
    } finally {
      setTesting(false)
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
    <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-6">
      {/* 基本資訊 */}
      <Box>
        <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
          基本資訊
        </Typography>

        <TextField
          {...register('name')}
          label="配置名稱"
          fullWidth
          margin="normal"
          error={!!errors.name}
          helperText={errors.name?.message}
        />

        <TextField
          {...register('description')}
          label="描述"
          fullWidth
          margin="normal"
          multiline
          rows={2}
        />

        <Select
          {...register('cityCode')}
          label="適用城市"
          fullWidth
          displayEmpty
          defaultValue=""
        >
          <MenuItem value="">全域（所有城市）</MenuItem>
          {cities.map((city) => (
            <MenuItem key={city.code} value={city.code}>
              {city.name}
            </MenuItem>
          ))}
        </Select>
      </Box>

      <Divider />

      {/* 連線設定 */}
      <Box>
        <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
          連線設定
        </Typography>

        <TextField
          {...register('baseUrl')}
          label="n8n 基礎 URL"
          fullWidth
          margin="normal"
          placeholder="https://n8n.example.com"
          error={!!errors.baseUrl}
          helperText={errors.baseUrl?.message}
        />

        <TextField
          {...register('endpointPath')}
          label="Webhook 端點路徑"
          fullWidth
          margin="normal"
          placeholder="/webhook/invoice-platform"
          error={!!errors.endpointPath}
          helperText={errors.endpointPath?.message}
        />

        <TextField
          {...register('authToken')}
          label="認證 Token"
          type="password"
          fullWidth
          margin="normal"
          error={!!errors.authToken}
          helperText={errors.authToken?.message || '儲存後 Token 將被加密'}
        />

        <TextField
          {...register('timeoutMs', { valueAsNumber: true })}
          label="超時時間（毫秒）"
          type="number"
          fullWidth
          margin="normal"
          error={!!errors.timeoutMs}
          helperText={errors.timeoutMs?.message}
        />

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
      </Box>

      <Divider />

      {/* 重試策略 */}
      <Box>
        <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
          重試策略
        </Typography>

        <TextField
          {...register('maxAttempts', { valueAsNumber: true })}
          label="最大重試次數"
          type="number"
          fullWidth
          margin="normal"
          error={!!errors.maxAttempts}
          helperText={errors.maxAttempts?.message}
        />

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
              sx={{ flex: 1 }}
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
      </Box>

      <Divider />

      {/* 事件訂閱 */}
      <Box>
        <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
          訂閱事件
        </Typography>

        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          {EVENT_OPTIONS.map((event) => {
            const isSelected = watch('subscribedEvents')?.includes(event.value)
            return (
              <Chip
                key={event.value}
                label={event.label}
                onClick={() => {
                  const current = watch('subscribedEvents') || []
                  if (isSelected) {
                    // 移除
                    const newValue = current.filter(e => e !== event.value)
                    // 需要使用 setValue
                  } else {
                    // 添加
                    const newValue = [...current, event.value]
                  }
                }}
                color={isSelected ? 'primary' : 'default'}
                variant={isSelected ? 'filled' : 'outlined'}
              />
            )
          })}
        </Box>
      </Box>

      <Divider />

      {/* 狀態 */}
      <FormControlLabel
        control={<Switch {...register('isActive')} defaultChecked />}
        label="啟用此配置"
      />

      {/* 操作按鈕 */}
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
        <Button variant="outlined" onClick={onCancel}>
          取消
        </Button>
        <Button
          type="submit"
          variant="contained"
          disabled={submitting}
          startIcon={submitting && <CircularProgress size={20} />}
        >
          {initialData ? '更新' : '創建'}
        </Button>
      </Box>
    </form>
  )
}
```

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
} from '@mui/material'
import {
  Edit,
  Delete,
  PlayArrow,
  Check,
  Error,
  Timer,
  Public,
} from '@mui/icons-material'
import { formatDistanceToNow } from 'date-fns'
import { zhTW } from 'date-fns/locale'

interface WebhookConfig {
  id: string
  name: string
  description?: string
  baseUrl: string
  endpointPath: string
  cityCode?: string
  cityName?: string
  isActive: boolean
  lastTestAt?: Date
  lastTestResult?: 'SUCCESS' | 'FAILED' | 'TIMEOUT' | 'ERROR'
  lastTestError?: string
}

interface WebhookConfigListProps {
  configs: WebhookConfig[]
  onEdit: (config: WebhookConfig) => void
  onDelete: (config: WebhookConfig) => void
  onTest: (config: WebhookConfig) => void
  testing?: string // 正在測試的配置 ID
}

export function WebhookConfigList({
  configs,
  onEdit,
  onDelete,
  onTest,
  testing,
}: WebhookConfigListProps) {
  const getTestResultIcon = (result?: string) => {
    switch (result) {
      case 'SUCCESS':
        return <Check color="success" />
      case 'FAILED':
      case 'ERROR':
        return <Error color="error" />
      case 'TIMEOUT':
        return <Timer color="warning" />
      default:
        return null
    }
  }

  const getTestResultLabel = (result?: string) => {
    switch (result) {
      case 'SUCCESS':
        return '成功'
      case 'FAILED':
        return '失敗'
      case 'ERROR':
        return '錯誤'
      case 'TIMEOUT':
        return '逾時'
      default:
        return '未測試'
    }
  }

  return (
    <TableContainer component={Paper}>
      <Table>
        <TableHead>
          <TableRow>
            <TableCell>名稱</TableCell>
            <TableCell>URL</TableCell>
            <TableCell>適用城市</TableCell>
            <TableCell>狀態</TableCell>
            <TableCell>最後測試</TableCell>
            <TableCell align="right">操作</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {configs.map((config) => (
            <TableRow key={config.id}>
              <TableCell>
                <Typography variant="body2" fontWeight="medium">
                  {config.name}
                </Typography>
                {config.description && (
                  <Typography variant="caption" color="text.secondary">
                    {config.description}
                  </Typography>
                )}
              </TableCell>
              <TableCell>
                <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                  {config.baseUrl}{config.endpointPath}
                </Typography>
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
                <Chip
                  label={config.isActive ? '啟用' : '停用'}
                  color={config.isActive ? 'success' : 'default'}
                  size="small"
                />
              </TableCell>
              <TableCell>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  {getTestResultIcon(config.lastTestResult)}
                  <Box>
                    <Typography variant="body2">
                      {getTestResultLabel(config.lastTestResult)}
                    </Typography>
                    {config.lastTestAt && (
                      <Typography variant="caption" color="text.secondary">
                        {formatDistanceToNow(new Date(config.lastTestAt), {
                          addSuffix: true,
                          locale: zhTW,
                        })}
                      </Typography>
                    )}
                  </Box>
                </Box>
              </TableCell>
              <TableCell align="right">
                <Tooltip title="測試連線">
                  <IconButton
                    onClick={() => onTest(config)}
                    disabled={testing === config.id}
                    size="small"
                  >
                    <PlayArrow />
                  </IconButton>
                </Tooltip>
                <Tooltip title="編輯">
                  <IconButton onClick={() => onEdit(config)} size="small">
                    <Edit />
                  </IconButton>
                </Tooltip>
                <Tooltip title="刪除">
                  <IconButton
                    onClick={() => onDelete(config)}
                    color="error"
                    size="small"
                  >
                    <Delete />
                  </IconButton>
                </Tooltip>
              </TableCell>
            </TableRow>
          ))}

          {configs.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} align="center">
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

## 測試案例

### 單元測試

```typescript
// __tests__/services/n8n/webhookConfigService.test.ts
import { webhookConfigService } from '@/lib/services/n8n/webhookConfigService'
import { prismaMock } from '@/lib/__mocks__/prisma'
import * as encryption from '@/lib/utils/encryption'

jest.mock('@/lib/utils/encryption')

describe('WebhookConfigService', () => {
  describe('createConfig', () => {
    it('should create config with encrypted token', async () => {
      const mockEncrypt = jest.spyOn(encryption, 'encrypt')
      mockEncrypt.mockResolvedValue('encrypted-token')

      prismaMock.webhookConfig.create.mockResolvedValue({
        id: 'config-1',
        name: 'Test Config',
        baseUrl: 'https://n8n.example.com',
        endpointPath: '/webhook',
        authToken: 'encrypted-token',
        cityCode: null,
        retryStrategy: { maxAttempts: 3, delays: [1000, 5000, 30000] },
        timeoutMs: 30000,
        subscribedEvents: [],
        isActive: true,
        createdBy: 'admin-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any)

      prismaMock.webhookConfigHistory.create.mockResolvedValue({} as any)

      const result = await webhookConfigService.createConfig({
        name: 'Test Config',
        baseUrl: 'https://n8n.example.com/',
        endpointPath: 'webhook',
        authToken: 'secret-token',
        subscribedEvents: [],
        createdBy: 'admin-1',
      })

      expect(mockEncrypt).toHaveBeenCalledWith('secret-token')
      expect(result.baseUrl).toBe('https://n8n.example.com') // 尾部斜線被移除
      expect(result.endpointPath).toBe('/webhook') // 開頭斜線被添加
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
      })

      prismaMock.webhookConfig.update.mockResolvedValue({} as any)

      const result = await webhookConfigService.testConnection('config-1')

      expect(result.success).toBe(true)
      expect(result.result).toBe('SUCCESS')
    })

    it('should handle timeout', async () => {
      const mockDecrypt = jest.spyOn(encryption, 'decrypt')
      mockDecrypt.mockResolvedValue('decrypted-token')

      prismaMock.webhookConfig.findUnique.mockResolvedValue({
        id: 'config-1',
        baseUrl: 'https://n8n.example.com',
        endpointPath: '/webhook',
        authToken: 'encrypted',
        timeoutMs: 100, // 很短的超時
      } as any)

      global.fetch = jest.fn().mockImplementation(() =>
        new Promise((_, reject) => {
          setTimeout(() => reject(new Error('AbortError')), 200)
        })
      )

      prismaMock.webhookConfig.update.mockResolvedValue({} as any)

      const result = await webhookConfigService.testConnection('config-1')

      expect(result.success).toBe(false)
      expect(result.result).toBe('TIMEOUT')
    })
  })
})
```

## 部署注意事項

1. **環境變數配置**
   - `WEBHOOK_ENCRYPTION_KEY`: Token 加密金鑰（32 字元）
   - `WEBHOOK_DEFAULT_TIMEOUT`: 預設超時時間（毫秒）

2. **監控指標**
   - Webhook 發送成功率
   - 平均回應時間
   - 重試次數分佈
   - 配置變更頻率

3. **安全考量**
   - Auth Token 使用 AES-256-GCM 加密儲存
   - 歷史記錄不包含敏感資訊
   - 支援配置的啟用/停用控制

## 相依性

- Story 10-1: n8n 雙向通訊 API（使用 Webhook 配置）
- Story 10-7: n8n 連接狀態監控（監控 Webhook 健康狀態）

---

## Implementation Notes

### 完成日期
2025-12-20

### 實際實現摘要

#### 1. 資料庫模型 (Prisma Schema)
- **WebhookConfig**: Webhook 配置模型，包含 n8n 連線資訊、重試策略、城市關聯
- **WebhookConfigHistory**: 配置變更歷史記錄，支持審計追蹤
- **WebhookTestResult**: 測試結果枚舉 (SUCCESS, FAILED, TIMEOUT, ERROR)
- **ConfigChangeType**: 變更類型枚舉 (CREATED, UPDATED, ACTIVATED, DEACTIVATED, DELETED)

#### 2. 加密工具 (src/lib/encryption.ts)
- 使用 AES-256-GCM 加密算法保護 Auth Token
- 使用 scrypt 進行密鑰衍生
- 環境變數: `ENCRYPTION_KEY` (32 字元密鑰)

#### 3. 類型定義 (src/types/n8n.ts)
新增類型:
- `WebhookConfigDto`: 完整配置 DTO
- `WebhookConfigListItem`: 列表項目（簡化版）
- `CreateWebhookConfigInput`: 創建輸入
- `UpdateWebhookConfigInput`: 更新輸入
- `TestConnectionRequest/Result`: 連線測試
- `WebhookConfigHistoryDto`: 歷史記錄 DTO
- `ListWebhookConfigsOptions/Result`: 列表查詢
- `ListConfigHistoryOptions/Result`: 歷史查詢
- `RetryStrategy`: 重試策略
- `DEFAULT_RETRY_STRATEGY`: 預設重試策略常數

#### 4. 服務層 (src/services/n8n/webhook-config.service.ts)
`WebhookConfigService` 類別實現:
- `create()`: 創建配置（自動加密 Token）
- `update()`: 更新配置（支持部分更新）
- `delete()`: 刪除配置（軟刪除歷史記錄）
- `getById()`: 獲取單一配置
- `getList()`: 列表查詢（支持分頁、篩選、排序）
- `testConnection()`: 連線測試（支持現有配置或臨時配置）
- `getHistory()`: 獲取變更歷史

#### 5. API 路由
| 端點 | 方法 | 功能 |
|------|------|------|
| `/api/admin/integrations/n8n/webhook-configs` | GET | 獲取配置列表 |
| `/api/admin/integrations/n8n/webhook-configs` | POST | 創建新配置 |
| `/api/admin/integrations/n8n/webhook-configs/[id]` | GET | 獲取配置詳情 |
| `/api/admin/integrations/n8n/webhook-configs/[id]` | PATCH | 更新配置 |
| `/api/admin/integrations/n8n/webhook-configs/[id]` | DELETE | 刪除配置 |
| `/api/admin/integrations/n8n/webhook-configs/[id]/test` | POST | 測試連線 |
| `/api/admin/integrations/n8n/webhook-configs/[id]/history` | GET | 獲取變更歷史 |

#### 6. React Query Hooks (src/hooks/use-webhook-config.ts)
- `useWebhookConfigs()`: 獲取配置列表
- `useWebhookConfig(id)`: 獲取單一配置
- `useCreateWebhookConfig()`: 創建配置
- `useUpdateWebhookConfig()`: 更新配置
- `useDeleteWebhookConfig()`: 刪除配置
- `useToggleWebhookConfigActive()`: 切換啟用狀態
- `useTestWebhookConfig()`: 測試連線
- `useWebhookConfigHistory()`: 獲取變更歷史

### 技術決策

1. **加密方式**: 選擇 AES-256-GCM 而非其他方式，因為:
   - 提供認證加密（AEAD）
   - Node.js 原生支持
   - 行業標準安全等級

2. **Prisma 關聯處理**: 使用 relation 而非直接字段更新:
   - `city: { connect: { code } }` 或 `{ disconnect: true }`
   - `updatedByUser: { connect: { id } }`
   - 確保參考完整性

3. **歷史記錄設計**:
   - 敏感資訊（authToken）在歷史中以 `[ENCRYPTED]` 標記
   - 記錄 changedFields 陣列以便快速識別變更欄位
   - 記錄 IP 地址和 User-Agent 用於審計

### 待完成項目

- [ ] 前端 UI 組件（WebhookConfigForm, WebhookConfigList）
- [ ] 單元測試和整合測試
- [ ] 監控儀表板整合 (Story 10-7)

### 檔案清單

```
prisma/schema.prisma                                           # 更新 - 新增模型
src/lib/encryption.ts                                          # 新建 - 加密工具
src/types/n8n.ts                                               # 更新 - 新增類型
src/services/n8n/webhook-config.service.ts                     # 新建 - 配置服務
src/services/n8n/index.ts                                      # 更新 - 導出
src/app/api/admin/integrations/n8n/webhook-configs/route.ts    # 新建 - 列表/創建
src/app/api/admin/integrations/n8n/webhook-configs/[id]/route.ts      # 新建 - CRUD
src/app/api/admin/integrations/n8n/webhook-configs/[id]/test/route.ts # 新建 - 測試
src/app/api/admin/integrations/n8n/webhook-configs/[id]/history/route.ts # 新建 - 歷史
src/hooks/use-webhook-config.ts                                # 新建 - React Query hooks
src/hooks/index.ts                                             # 更新 - 導出
```