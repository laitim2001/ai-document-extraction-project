# Tech Spec: Story 10-4 手動觸發工作流

## 1. 概述

### Story 資訊
- **Story ID**: 10-4
- **標題**: 手動觸發工作流
- **Epic**: 10 - n8n 工作流整合
- **功能需求**: FR55 (工作流觸發), FR56 (執行狀態監控)
- **優先級**: Medium
- **故事點數**: 5
- **相關 Stories**: Story 10-1, 10-2, 10-3

### 目標
實現手動觸發 n8n 工作流的功能，讓 Super User 可以：
- 查看可觸發的工作流列表
- 輸入執行參數並選擇目標文件
- 手動觸發工作流並追蹤執行狀態
- 在觸發失敗時重試

### 相依性
- **前置**:
  - Story 10-1 (n8n 雙向通訊 API)
  - Story 10-2 (Webhook 配置管理)
  - Story 10-3 (工作流執行狀態查看)
- **後置**: 無

---

## 2. 資料庫設計

### 2.1 Prisma Schema

```prisma
// ===========================================
// 工作流定義
// ===========================================
model WorkflowDefinition {
  id              String    @id @default(cuid())

  // 工作流基本資訊
  name            String                  // 工作流名稱
  description     String?                 // 工作流描述
  n8nWorkflowId   String    @unique       // n8n 側的工作流 ID

  // 觸發配置
  triggerUrl      String                  // n8n Webhook URL
  triggerMethod   String    @default("POST")  // HTTP 方法

  // 參數定義 (JSON Schema 格式)
  parameters      Json?                   // 參數 schema 定義

  // 城市配置
  cityCode        String?                 // null 表示全域可用
  city            City?     @relation(fields: [cityCode], references: [code])

  // 權限控制
  allowedRoles    String[]  @default([])  // 允許觸發的角色，空陣列表示所有角色

  // 狀態
  isActive        Boolean   @default(true)

  // 分類標籤
  category        String?                 // 工作流分類
  tags            String[]  @default([])  // 標籤

  // 審計
  createdBy       String
  createdAt       DateTime  @default(now())
  updatedBy       String?
  updatedAt       DateTime  @updatedAt

  // 關聯
  executions      WorkflowExecution[]

  // 索引
  @@index([cityCode])
  @@index([isActive])
  @@index([category])
  @@index([n8nWorkflowId])
}
```

### 2.2 參數 Schema 格式

```typescript
// 參數 Schema 定義格式
interface WorkflowParametersSchema {
  parameters: WorkflowParameter[]
  documentSelection?: {
    enabled: boolean
    required: boolean
    maxCount?: number
    allowedTypes?: string[]  // e.g., ['pdf', 'xlsx']
  }
}

interface WorkflowParameter {
  name: string
  type: 'string' | 'number' | 'boolean' | 'date' | 'select' | 'multiselect' | 'text'
  label: string
  description?: string
  required: boolean
  default?: unknown
  options?: Array<{ value: string; label: string }>
  validation?: {
    min?: number
    max?: number
    minLength?: number
    maxLength?: number
    pattern?: string
    message?: string
  }
  dependsOn?: {
    field: string
    value: unknown
  }
}
```

### 2.3 索引策略

| 索引名稱 | 欄位 | 目的 |
|---------|------|------|
| `cityCode` | `cityCode` | 城市過濾查詢 |
| `isActive` | `isActive` | 啟用狀態篩選 |
| `category` | `category` | 分類篩選 |
| `n8nWorkflowId` | `n8nWorkflowId` | n8n 工作流 ID 查詢 |

### 2.4 資料庫遷移

```bash
npx prisma migrate dev --name add_workflow_definition
npx prisma generate
```

---

## 3. 類型定義

### 3.1 共用類型

```typescript
// lib/types/workflow-trigger.ts
import type { WorkflowDefinition as PrismaWorkflowDefinition } from '@prisma/client'

// ===========================================
// 工作流參數類型
// ===========================================
export type WorkflowParameterType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'date'
  | 'select'
  | 'multiselect'
  | 'text'

export interface WorkflowParameter {
  name: string
  type: WorkflowParameterType
  label: string
  description?: string
  required: boolean
  default?: unknown
  options?: Array<{ value: string; label: string }>
  validation?: ParameterValidation
  dependsOn?: ParameterDependency
}

export interface ParameterValidation {
  min?: number
  max?: number
  minLength?: number
  maxLength?: number
  pattern?: string
  message?: string
}

export interface ParameterDependency {
  field: string
  value: unknown
}

// ===========================================
// 文件選擇配置
// ===========================================
export interface DocumentSelectionConfig {
  enabled: boolean
  required: boolean
  maxCount?: number
  allowedTypes?: string[]
}

// ===========================================
// 參數 Schema
// ===========================================
export interface WorkflowParametersSchema {
  parameters: WorkflowParameter[]
  documentSelection?: DocumentSelectionConfig
}

// ===========================================
// 可觸發工作流（含解析後的 schema）
// ===========================================
export interface TriggerableWorkflow extends PrismaWorkflowDefinition {
  parameterSchema: WorkflowParameter[]
  documentSelection?: DocumentSelectionConfig
}

// ===========================================
// 觸發輸入
// ===========================================
export interface TriggerWorkflowInput {
  workflowId: string
  parameters?: Record<string, unknown>
  documentIds?: string[]
  triggeredBy: string
  cityCode: string
}

// ===========================================
// 觸發結果
// ===========================================
export interface TriggerResult {
  success: boolean
  executionId?: string
  n8nExecutionId?: string
  error?: string
  errorCode?: string
}

// ===========================================
// Webhook 請求 Payload
// ===========================================
export interface WebhookTriggerPayload {
  executionId: string
  workflowId: string
  triggerType: 'manual'
  triggeredBy: string
  cityCode: string
  timestamp: string
  parameters: Record<string, unknown>
  documents: Array<{
    id: string
    fileName: string
    blobUrl?: string
  }>
}

// ===========================================
// API 回應類型
// ===========================================
export interface TriggerableWorkflowsResponse {
  data: TriggerableWorkflow[]
}

export interface TriggerWorkflowResponse {
  data: {
    executionId: string
    n8nExecutionId?: string
  }
}

export interface RetryWorkflowResponse {
  data: {
    executionId: string
    n8nExecutionId?: string
  }
}
```

### 3.2 驗證錯誤類型

```typescript
// lib/types/workflow-trigger.ts (continued)

export type TriggerErrorCode =
  | 'WORKFLOW_NOT_FOUND'
  | 'WORKFLOW_INACTIVE'
  | 'CITY_ACCESS_DENIED'
  | 'VALIDATION_ERROR'
  | 'WEBHOOK_FAILED'
  | 'NETWORK_ERROR'
  | 'TIMEOUT'
  | 'UNKNOWN'

export interface TriggerError {
  code: TriggerErrorCode
  message: string
  details?: Record<string, unknown>
}
```

---

## 4. 服務實現

### 4.1 WorkflowTriggerService

```typescript
// lib/services/n8n/workflowTriggerService.ts
import { prisma } from '@/lib/prisma'
import { webhookConfigService } from './webhookConfigService'
import { decrypt } from '@/lib/utils/encryption'
import type { WorkflowDefinition, WorkflowExecution } from '@prisma/client'
import type {
  TriggerWorkflowInput,
  TriggerResult,
  WorkflowParameter,
  WorkflowParametersSchema,
  DocumentSelectionConfig,
  WebhookTriggerPayload,
  TriggerErrorCode,
} from '@/lib/types/workflow-trigger'

// 觸發超時時間（毫秒）
const TRIGGER_TIMEOUT_MS = 30000

export class WorkflowTriggerService {
  // ===========================================
  // 列出可觸發的工作流
  // ===========================================
  async listTriggerableWorkflows(options: {
    cityCode: string
    userRoles: string[]
    category?: string
  }): Promise<(WorkflowDefinition & { parameterSchema: WorkflowParameter[]; documentSelection?: DocumentSelectionConfig })[]> {
    const { cityCode, userRoles, category } = options

    const where: Record<string, unknown> = {
      isActive: true,
      OR: [
        { cityCode },
        { cityCode: null },
      ],
    }

    if (category) {
      where.category = category
    }

    const workflows = await prisma.workflowDefinition.findMany({
      where,
      orderBy: [
        { category: 'asc' },
        { name: 'asc' },
      ],
    })

    // 過濾有權限的工作流並解析參數 schema
    return workflows
      .filter((workflow) => this.hasRolePermission(workflow, userRoles))
      .map((workflow) => ({
        ...workflow,
        ...this.parseParametersSchema(workflow),
      }))
  }

  // ===========================================
  // 獲取工作流詳情
  // ===========================================
  async getWorkflowDefinition(id: string): Promise<WorkflowDefinition | null> {
    return prisma.workflowDefinition.findUnique({
      where: { id },
    })
  }

  // ===========================================
  // 解析參數 Schema
  // ===========================================
  parseParametersSchema(workflow: WorkflowDefinition): {
    parameterSchema: WorkflowParameter[]
    documentSelection?: DocumentSelectionConfig
  } {
    if (!workflow.parameters) {
      return { parameterSchema: [] }
    }

    try {
      const schema = workflow.parameters as WorkflowParametersSchema
      return {
        parameterSchema: schema.parameters || [],
        documentSelection: schema.documentSelection,
      }
    } catch {
      return { parameterSchema: [] }
    }
  }

  // ===========================================
  // 觸發工作流
  // ===========================================
  async triggerWorkflow(input: TriggerWorkflowInput): Promise<TriggerResult> {
    const { workflowId, parameters = {}, documentIds, triggeredBy, cityCode } = input

    // 獲取工作流定義
    const workflow = await this.getWorkflowDefinition(workflowId)

    if (!workflow) {
      return this.createErrorResult('WORKFLOW_NOT_FOUND', 'Workflow not found')
    }

    if (!workflow.isActive) {
      return this.createErrorResult('WORKFLOW_INACTIVE', 'Workflow is not active')
    }

    // 驗證城市權限
    if (workflow.cityCode && workflow.cityCode !== cityCode) {
      return this.createErrorResult('CITY_ACCESS_DENIED', 'Access denied for this city')
    }

    // 驗證參數
    const { parameterSchema, documentSelection } = this.parseParametersSchema(workflow)
    const validationError = this.validateParameters(parameters, parameterSchema)
    if (validationError) {
      return this.createErrorResult('VALIDATION_ERROR', validationError)
    }

    // 驗證文件選擇
    if (documentSelection?.required && (!documentIds || documentIds.length === 0)) {
      return this.createErrorResult('VALIDATION_ERROR', 'At least one document is required')
    }

    if (documentSelection?.maxCount && documentIds && documentIds.length > documentSelection.maxCount) {
      return this.createErrorResult(
        'VALIDATION_ERROR',
        `Maximum ${documentSelection.maxCount} documents allowed`
      )
    }

    // 獲取相關文件資訊
    let documents: Array<{ id: string; fileName: string; blobUrl: string | null; status: string }> = []
    if (documentIds && documentIds.length > 0) {
      documents = await prisma.document.findMany({
        where: { id: { in: documentIds } },
        select: {
          id: true,
          fileName: true,
          blobUrl: true,
          status: true,
        },
      })

      // 驗證所有文件都存在
      if (documents.length !== documentIds.length) {
        return this.createErrorResult('VALIDATION_ERROR', 'Some documents were not found')
      }
    }

    // 創建執行記錄
    const execution = await prisma.workflowExecution.create({
      data: {
        workflowName: workflow.name,
        workflowId: workflow.n8nWorkflowId,
        triggerType: 'MANUAL',
        triggerSource: `Manual trigger by user`,
        triggeredBy,
        cityCode,
        status: 'PENDING',
        documentCount: documents.length,
        documents: documentIds
          ? { connect: documentIds.map((id) => ({ id })) }
          : undefined,
      },
    })

    // 準備 Webhook 請求
    const webhookPayload: WebhookTriggerPayload = {
      executionId: execution.id,
      workflowId: workflow.n8nWorkflowId,
      triggerType: 'manual',
      triggeredBy,
      cityCode,
      timestamp: new Date().toISOString(),
      parameters,
      documents: documents.map((doc) => ({
        id: doc.id,
        fileName: doc.fileName,
        blobUrl: doc.blobUrl ?? undefined,
      })),
    }

    try {
      // 發送觸發請求
      const response = await this.sendTriggerRequest(workflow, execution.id, webhookPayload, cityCode)

      // 更新執行記錄
      await prisma.workflowExecution.update({
        where: { id: execution.id },
        data: {
          status: 'QUEUED',
          n8nExecutionId: response.executionId,
        },
      })

      return {
        success: true,
        executionId: execution.id,
        n8nExecutionId: response.executionId,
      }
    } catch (error) {
      // 更新執行記錄為失敗
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      const errorCode = this.parseErrorCode(error)

      await prisma.workflowExecution.update({
        where: { id: execution.id },
        data: {
          status: 'FAILED',
          completedAt: new Date(),
          errorDetails: {
            message: errorMessage,
            code: errorCode,
            stage: 'trigger',
            timestamp: new Date().toISOString(),
          },
        },
      })

      return {
        success: false,
        executionId: execution.id,
        error: errorMessage,
        errorCode,
      }
    }
  }

  // ===========================================
  // 重試觸發
  // ===========================================
  async retryTrigger(executionId: string, triggeredBy: string): Promise<TriggerResult> {
    const execution = await prisma.workflowExecution.findUnique({
      where: { id: executionId },
      include: {
        documents: {
          select: { id: true },
        },
      },
    })

    if (!execution) {
      return this.createErrorResult('WORKFLOW_NOT_FOUND', 'Execution not found')
    }

    if (execution.status !== 'FAILED') {
      return this.createErrorResult('VALIDATION_ERROR', 'Only failed executions can be retried')
    }

    // 查找原始工作流定義
    const workflow = await prisma.workflowDefinition.findFirst({
      where: { n8nWorkflowId: execution.workflowId ?? undefined },
    })

    if (!workflow) {
      return this.createErrorResult('WORKFLOW_NOT_FOUND', 'Workflow definition not found')
    }

    // 重新觸發
    return this.triggerWorkflow({
      workflowId: workflow.id,
      documentIds: execution.documents.map((d) => d.id),
      triggeredBy,
      cityCode: execution.cityCode,
    })
  }

  // ===========================================
  // 取消執行
  // ===========================================
  async cancelExecution(executionId: string, cancelledBy: string): Promise<boolean> {
    const execution = await prisma.workflowExecution.findUnique({
      where: { id: executionId },
    })

    if (!execution) {
      return false
    }

    // 只有 PENDING 或 QUEUED 狀態可以取消
    if (!['PENDING', 'QUEUED'].includes(execution.status)) {
      return false
    }

    await prisma.workflowExecution.update({
      where: { id: executionId },
      data: {
        status: 'CANCELLED',
        completedAt: new Date(),
        errorDetails: {
          message: 'Cancelled by user',
          cancelledBy,
          timestamp: new Date().toISOString(),
        },
      },
    })

    return true
  }

  // ===========================================
  // 私有方法: 發送觸發請求
  // ===========================================
  private async sendTriggerRequest(
    workflow: WorkflowDefinition,
    executionId: string,
    payload: WebhookTriggerPayload,
    cityCode: string
  ): Promise<{ executionId: string }> {
    // 建構請求標頭
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Execution-Id': executionId,
      'X-Trigger-Type': 'manual',
      'X-City-Code': cityCode,
    }

    // 獲取認證 Token
    const webhookConfig = await webhookConfigService.getActiveConfigForCity(cityCode)
    if (webhookConfig) {
      const token = await decrypt(webhookConfig.authToken)
      headers['Authorization'] = `Bearer ${token}`
    }

    // 發送請求
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), TRIGGER_TIMEOUT_MS)

    try {
      const response = await fetch(workflow.triggerUrl, {
        method: workflow.triggerMethod,
        headers,
        body: JSON.stringify(payload),
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`HTTP ${response.status}: ${errorText}`)
      }

      const responseData = await response.json()
      return {
        executionId: responseData.executionId || responseData.id || executionId,
      }
    } catch (error) {
      clearTimeout(timeoutId)

      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Trigger request timeout')
      }
      throw error
    }
  }

  // ===========================================
  // 私有方法: 驗證參數
  // ===========================================
  private validateParameters(
    values: Record<string, unknown>,
    schema: WorkflowParameter[]
  ): string | null {
    for (const param of schema) {
      const value = values[param.name]

      // 檢查依賴條件
      if (param.dependsOn) {
        const dependValue = values[param.dependsOn.field]
        if (dependValue !== param.dependsOn.value) {
          continue // 跳過不符合依賴條件的參數
        }
      }

      // 檢查必填
      if (param.required && (value === undefined || value === null || value === '')) {
        return `Parameter "${param.label}" is required`
      }

      if (value === undefined || value === null) continue

      // 類型驗證
      const typeError = this.validateParameterType(param, value)
      if (typeError) return typeError
    }

    return null
  }

  // ===========================================
  // 私有方法: 驗證參數類型
  // ===========================================
  private validateParameterType(param: WorkflowParameter, value: unknown): string | null {
    switch (param.type) {
      case 'number': {
        if (typeof value !== 'number' || isNaN(value)) {
          return `Parameter "${param.label}" must be a number`
        }
        const { min, max, message } = param.validation ?? {}
        if (min !== undefined && value < min) {
          return message ?? `Parameter "${param.label}" must be at least ${min}`
        }
        if (max !== undefined && value > max) {
          return message ?? `Parameter "${param.label}" must be at most ${max}`
        }
        break
      }

      case 'string':
      case 'text': {
        if (typeof value !== 'string') {
          return `Parameter "${param.label}" must be a string`
        }
        const { minLength, maxLength, pattern, message } = param.validation ?? {}
        if (minLength !== undefined && value.length < minLength) {
          return message ?? `Parameter "${param.label}" must be at least ${minLength} characters`
        }
        if (maxLength !== undefined && value.length > maxLength) {
          return message ?? `Parameter "${param.label}" must be at most ${maxLength} characters`
        }
        if (pattern) {
          const regex = new RegExp(pattern)
          if (!regex.test(value)) {
            return message ?? `Parameter "${param.label}" has invalid format`
          }
        }
        break
      }

      case 'boolean': {
        if (typeof value !== 'boolean') {
          return `Parameter "${param.label}" must be a boolean`
        }
        break
      }

      case 'date': {
        if (!(value instanceof Date) && isNaN(Date.parse(value as string))) {
          return `Parameter "${param.label}" must be a valid date`
        }
        break
      }

      case 'select': {
        if (param.options && !param.options.some((opt) => opt.value === value)) {
          return `Parameter "${param.label}" has invalid value`
        }
        break
      }

      case 'multiselect': {
        if (!Array.isArray(value)) {
          return `Parameter "${param.label}" must be an array`
        }
        if (param.options) {
          const validValues = param.options.map((opt) => opt.value)
          if (!(value as unknown[]).every((v) => validValues.includes(v as string))) {
            return `Parameter "${param.label}" contains invalid values`
          }
        }
        break
      }
    }

    return null
  }

  // ===========================================
  // 私有方法: 檢查角色權限
  // ===========================================
  private hasRolePermission(workflow: WorkflowDefinition, userRoles: string[]): boolean {
    if (workflow.allowedRoles.length === 0) return true
    return workflow.allowedRoles.some((role) => userRoles.includes(role))
  }

  // ===========================================
  // 私有方法: 創建錯誤結果
  // ===========================================
  private createErrorResult(code: TriggerErrorCode, message: string): TriggerResult {
    return { success: false, error: message, errorCode: code }
  }

  // ===========================================
  // 私有方法: 解析錯誤代碼
  // ===========================================
  private parseErrorCode(error: unknown): TriggerErrorCode {
    if (error instanceof Error) {
      if (error.message.includes('timeout')) return 'TIMEOUT'
      if (error.message.includes('network')) return 'NETWORK_ERROR'
      if (error.message.includes('HTTP')) return 'WEBHOOK_FAILED'
    }
    return 'UNKNOWN'
  }
}

// 單例導出
export const workflowTriggerService = new WorkflowTriggerService()
```

### 4.2 工作流定義管理服務

```typescript
// lib/services/n8n/workflowDefinitionService.ts
import { prisma } from '@/lib/prisma'
import type { WorkflowDefinition, Prisma } from '@prisma/client'
import type { WorkflowParametersSchema } from '@/lib/types/workflow-trigger'

export interface CreateWorkflowDefinitionInput {
  name: string
  description?: string
  n8nWorkflowId: string
  triggerUrl: string
  triggerMethod?: string
  parameters?: WorkflowParametersSchema
  cityCode?: string
  allowedRoles?: string[]
  category?: string
  tags?: string[]
  createdBy: string
}

export interface UpdateWorkflowDefinitionInput {
  name?: string
  description?: string
  triggerUrl?: string
  triggerMethod?: string
  parameters?: WorkflowParametersSchema
  allowedRoles?: string[]
  category?: string
  tags?: string[]
  isActive?: boolean
  updatedBy: string
}

export class WorkflowDefinitionService {
  // ===========================================
  // 列出工作流定義
  // ===========================================
  async listDefinitions(options: {
    cityCode?: string
    category?: string
    isActive?: boolean
    page?: number
    pageSize?: number
  } = {}): Promise<{ items: WorkflowDefinition[]; total: number }> {
    const { cityCode, category, isActive, page = 1, pageSize = 20 } = options

    const where: Prisma.WorkflowDefinitionWhereInput = {}
    if (cityCode !== undefined) where.cityCode = cityCode
    if (category !== undefined) where.category = category
    if (isActive !== undefined) where.isActive = isActive

    const [items, total] = await Promise.all([
      prisma.workflowDefinition.findMany({
        where,
        orderBy: [{ category: 'asc' }, { name: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.workflowDefinition.count({ where }),
    ])

    return { items, total }
  }

  // ===========================================
  // 創建工作流定義
  // ===========================================
  async createDefinition(input: CreateWorkflowDefinitionInput): Promise<WorkflowDefinition> {
    return prisma.workflowDefinition.create({
      data: {
        name: input.name,
        description: input.description,
        n8nWorkflowId: input.n8nWorkflowId,
        triggerUrl: input.triggerUrl,
        triggerMethod: input.triggerMethod ?? 'POST',
        parameters: input.parameters as Prisma.InputJsonValue,
        cityCode: input.cityCode,
        allowedRoles: input.allowedRoles ?? [],
        category: input.category,
        tags: input.tags ?? [],
        createdBy: input.createdBy,
      },
    })
  }

  // ===========================================
  // 更新工作流定義
  // ===========================================
  async updateDefinition(
    id: string,
    input: UpdateWorkflowDefinitionInput
  ): Promise<WorkflowDefinition | null> {
    const existing = await prisma.workflowDefinition.findUnique({ where: { id } })
    if (!existing) return null

    return prisma.workflowDefinition.update({
      where: { id },
      data: {
        name: input.name,
        description: input.description,
        triggerUrl: input.triggerUrl,
        triggerMethod: input.triggerMethod,
        parameters: input.parameters as Prisma.InputJsonValue,
        allowedRoles: input.allowedRoles,
        category: input.category,
        tags: input.tags,
        isActive: input.isActive,
        updatedBy: input.updatedBy,
      },
    })
  }

  // ===========================================
  // 刪除工作流定義
  // ===========================================
  async deleteDefinition(id: string): Promise<boolean> {
    const existing = await prisma.workflowDefinition.findUnique({ where: { id } })
    if (!existing) return false

    await prisma.workflowDefinition.delete({ where: { id } })
    return true
  }

  // ===========================================
  // 啟用/停用工作流
  // ===========================================
  async toggleActive(id: string, isActive: boolean, updatedBy: string): Promise<WorkflowDefinition | null> {
    return prisma.workflowDefinition.update({
      where: { id },
      data: { isActive, updatedBy },
    })
  }
}

export const workflowDefinitionService = new WorkflowDefinitionService()
```

---

## 5. API 路由

### 5.1 可觸發工作流列表 API

```typescript
// app/api/workflows/triggerable/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { workflowTriggerService } from '@/lib/services/n8n/workflowTriggerService'
import { getUserCityAccess, getUserRoles, hasRole } from '@/lib/utils/permissions'
import { z } from 'zod'

const querySchema = z.object({
  cityCode: z.string().optional(),
  category: z.string().optional(),
})

export async function GET(request: NextRequest) {
  try {
    // 驗證身份
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized', code: 'UNAUTHORIZED' },
        { status: 401 }
      )
    }

    // 檢查權限（僅 Super User 和 Admin）
    if (!hasRole(session.user, 'SUPER_USER') && !hasRole(session.user, 'ADMIN')) {
      return NextResponse.json(
        { error: 'Insufficient permissions', code: 'FORBIDDEN' },
        { status: 403 }
      )
    }

    // 解析查詢參數
    const searchParams = Object.fromEntries(request.nextUrl.searchParams)
    const parseResult = querySchema.safeParse(searchParams)

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: parseResult.error.issues },
        { status: 400 }
      )
    }

    const { cityCode, category } = parseResult.data

    // 驗證城市權限
    const userCities = await getUserCityAccess(session.user)
    const targetCity = cityCode ?? userCities[0]

    if (cityCode && !userCities.includes(cityCode) && !userCities.includes('*')) {
      return NextResponse.json(
        { error: 'Access denied for this city', code: 'CITY_ACCESS_DENIED' },
        { status: 403 }
      )
    }

    const userRoles = await getUserRoles(session.user)

    // 獲取可觸發的工作流
    const workflows = await workflowTriggerService.listTriggerableWorkflows({
      cityCode: targetCity,
      userRoles,
      category,
    })

    return NextResponse.json({ data: workflows })
  } catch (error) {
    console.error('List triggerable workflows error:', error)
    return NextResponse.json(
      { error: 'Failed to list workflows', code: 'LIST_FAILED' },
      { status: 500 }
    )
  }
}
```

### 5.2 觸發工作流 API

```typescript
// app/api/workflows/trigger/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { workflowTriggerService } from '@/lib/services/n8n/workflowTriggerService'
import { getUserCityAccess, hasRole } from '@/lib/utils/permissions'
import { z } from 'zod'

const triggerSchema = z.object({
  workflowId: z.string().min(1, 'Workflow ID is required'),
  parameters: z.record(z.unknown()).optional(),
  documentIds: z.array(z.string()).optional(),
  cityCode: z.string().min(1, 'City code is required'),
})

export async function POST(request: NextRequest) {
  try {
    // 驗證身份
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized', code: 'UNAUTHORIZED' },
        { status: 401 }
      )
    }

    // 檢查 Super User 權限
    if (!hasRole(session.user, 'SUPER_USER') && !hasRole(session.user, 'ADMIN')) {
      return NextResponse.json(
        { error: 'Insufficient permissions', code: 'FORBIDDEN' },
        { status: 403 }
      )
    }

    // 解析請求內容
    const body = await request.json()
    const parseResult = triggerSchema.safeParse(body)

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Validation error', details: parseResult.error.issues },
        { status: 400 }
      )
    }

    const { workflowId, parameters, documentIds, cityCode } = parseResult.data

    // 驗證城市權限
    const userCities = await getUserCityAccess(session.user)
    if (!userCities.includes(cityCode) && !userCities.includes('*')) {
      return NextResponse.json(
        { error: 'Access denied for this city', code: 'CITY_ACCESS_DENIED' },
        { status: 403 }
      )
    }

    // 觸發工作流
    const result = await workflowTriggerService.triggerWorkflow({
      workflowId,
      parameters,
      documentIds,
      triggeredBy: session.user.id,
      cityCode,
    })

    if (!result.success) {
      return NextResponse.json(
        {
          error: result.error,
          code: result.errorCode,
          executionId: result.executionId,
        },
        { status: 400 }
      )
    }

    return NextResponse.json({
      data: {
        executionId: result.executionId,
        n8nExecutionId: result.n8nExecutionId,
      },
    })
  } catch (error) {
    console.error('Trigger workflow error:', error)
    return NextResponse.json(
      { error: 'Failed to trigger workflow', code: 'TRIGGER_FAILED' },
      { status: 500 }
    )
  }
}
```

### 5.3 重試工作流 API

```typescript
// app/api/workflows/executions/[id]/retry/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { workflowTriggerService } from '@/lib/services/n8n/workflowTriggerService'
import { hasRole } from '@/lib/utils/permissions'

interface RouteParams {
  params: { id: string }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    // 驗證身份
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized', code: 'UNAUTHORIZED' },
        { status: 401 }
      )
    }

    // 檢查權限
    if (!hasRole(session.user, 'SUPER_USER') && !hasRole(session.user, 'ADMIN')) {
      return NextResponse.json(
        { error: 'Insufficient permissions', code: 'FORBIDDEN' },
        { status: 403 }
      )
    }

    // 重試觸發
    const result = await workflowTriggerService.retryTrigger(
      params.id,
      session.user.id
    )

    if (!result.success) {
      return NextResponse.json(
        { error: result.error, code: result.errorCode },
        { status: 400 }
      )
    }

    return NextResponse.json({
      data: {
        executionId: result.executionId,
        n8nExecutionId: result.n8nExecutionId,
      },
    })
  } catch (error) {
    console.error('Retry workflow error:', error)
    return NextResponse.json(
      { error: 'Failed to retry workflow', code: 'RETRY_FAILED' },
      { status: 500 }
    )
  }
}
```

### 5.4 取消執行 API

```typescript
// app/api/workflows/executions/[id]/cancel/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { workflowTriggerService } from '@/lib/services/n8n/workflowTriggerService'
import { hasRole } from '@/lib/utils/permissions'

interface RouteParams {
  params: { id: string }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized', code: 'UNAUTHORIZED' },
        { status: 401 }
      )
    }

    if (!hasRole(session.user, 'SUPER_USER') && !hasRole(session.user, 'ADMIN')) {
      return NextResponse.json(
        { error: 'Insufficient permissions', code: 'FORBIDDEN' },
        { status: 403 }
      )
    }

    const success = await workflowTriggerService.cancelExecution(
      params.id,
      session.user.id
    )

    if (!success) {
      return NextResponse.json(
        { error: 'Cannot cancel execution', code: 'CANCEL_FAILED' },
        { status: 400 }
      )
    }

    return NextResponse.json({ data: { success: true } })
  } catch (error) {
    console.error('Cancel execution error:', error)
    return NextResponse.json(
      { error: 'Failed to cancel execution', code: 'CANCEL_FAILED' },
      { status: 500 }
    )
  }
}
```

---

## 6. 前端組件

### 6.1 手動觸發對話框

```typescript
// components/workflow/ManualTriggerDialog.tsx
'use client'

import React, { useState, useEffect, useCallback } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Stepper,
  Step,
  StepLabel,
  List,
  ListItemButton,
  ListItemText,
  ListItemIcon,
  Radio,
  Typography,
  Box,
  Alert,
  CircularProgress,
  Chip,
  Divider,
} from '@mui/material'
import {
  PlayArrow,
  CheckCircle,
  Error as ErrorIcon,
  Category,
} from '@mui/icons-material'
import { useRouter } from 'next/navigation'
import { ParameterForm } from './ParameterForm'
import { DocumentSelector } from './DocumentSelector'
import type { TriggerableWorkflow, WorkflowParameter, DocumentSelectionConfig } from '@/lib/types/workflow-trigger'

interface ManualTriggerDialogProps {
  open: boolean
  onClose: () => void
  cityCode: string
  preselectedDocumentIds?: string[]
}

const steps = ['選擇工作流', '設定參數', '完成']

export function ManualTriggerDialog({
  open,
  onClose,
  cityCode,
  preselectedDocumentIds = [],
}: ManualTriggerDialogProps) {
  const router = useRouter()

  // 步驟狀態
  const [activeStep, setActiveStep] = useState(0)

  // 工作流選擇
  const [workflows, setWorkflows] = useState<TriggerableWorkflow[]>([])
  const [selectedWorkflow, setSelectedWorkflow] = useState<TriggerableWorkflow | null>(null)
  const [loadingWorkflows, setLoadingWorkflows] = useState(false)

  // 參數與文件
  const [parameters, setParameters] = useState<Record<string, unknown>>({})
  const [documentIds, setDocumentIds] = useState<string[]>(preselectedDocumentIds)

  // 觸發狀態
  const [triggering, setTriggering] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{ executionId: string } | null>(null)

  // 載入可觸發的工作流
  const loadWorkflows = useCallback(async () => {
    setLoadingWorkflows(true)
    setError(null)

    try {
      const response = await fetch(`/api/workflows/triggerable?cityCode=${cityCode}`)
      if (!response.ok) {
        throw new Error('Failed to load workflows')
      }
      const data = await response.json()
      setWorkflows(data.data || [])
    } catch (err) {
      setError('載入工作流失敗，請稍後重試')
    } finally {
      setLoadingWorkflows(false)
    }
  }, [cityCode])

  useEffect(() => {
    if (open) {
      loadWorkflows()
    }
  }, [open, loadWorkflows])

  // 選擇工作流
  const handleWorkflowSelect = (workflow: TriggerableWorkflow) => {
    setSelectedWorkflow(workflow)

    // 初始化參數預設值
    const defaults: Record<string, unknown> = {}
    workflow.parameterSchema.forEach((param) => {
      if (param.default !== undefined) {
        defaults[param.name] = param.default
      }
    })
    setParameters(defaults)

    setActiveStep(1)
  }

  // 觸發工作流
  const handleTrigger = async () => {
    if (!selectedWorkflow) return

    setTriggering(true)
    setError(null)

    try {
      const response = await fetch('/api/workflows/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workflowId: selectedWorkflow.id,
          parameters,
          documentIds: documentIds.length > 0 ? documentIds : undefined,
          cityCode,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Trigger failed')
      }

      setResult({ executionId: data.data.executionId })
      setActiveStep(2)
    } catch (err) {
      setError(err instanceof Error ? err.message : '觸發失敗')
    } finally {
      setTriggering(false)
    }
  }

  // 跳轉到執行詳情
  const handleGoToExecution = () => {
    if (result?.executionId) {
      router.push(`/workflow-monitor/${result.executionId}`)
      handleClose()
    }
  }

  // 關閉對話框
  const handleClose = () => {
    setActiveStep(0)
    setSelectedWorkflow(null)
    setParameters({})
    setDocumentIds(preselectedDocumentIds)
    setError(null)
    setResult(null)
    onClose()
  }

  // 檢查是否可以繼續
  const canProceed = (): boolean => {
    if (activeStep === 0) {
      return !!selectedWorkflow
    }
    if (activeStep === 1 && selectedWorkflow) {
      // 檢查必填參數
      const allRequiredFilled = selectedWorkflow.parameterSchema.every((param) => {
        if (!param.required) return true
        const value = parameters[param.name]
        return value !== undefined && value !== null && value !== ''
      })

      // 檢查必填文件
      const documentRequired = selectedWorkflow.documentSelection?.required
      const hasDocuments = documentIds.length > 0

      return allRequiredFilled && (!documentRequired || hasDocuments)
    }
    return false
  }

  // 渲染工作流列表（按分類分組）
  const renderWorkflowList = () => {
    const grouped = workflows.reduce((acc, workflow) => {
      const category = workflow.category || '未分類'
      if (!acc[category]) acc[category] = []
      acc[category].push(workflow)
      return acc
    }, {} as Record<string, TriggerableWorkflow[]>)

    return (
      <Box>
        {Object.entries(grouped).map(([category, items]) => (
          <Box key={category} sx={{ mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <Category fontSize="small" color="action" />
              <Typography variant="subtitle2" color="text.secondary">
                {category}
              </Typography>
            </Box>
            <List disablePadding>
              {items.map((workflow) => (
                <ListItemButton
                  key={workflow.id}
                  onClick={() => handleWorkflowSelect(workflow)}
                  selected={selectedWorkflow?.id === workflow.id}
                  sx={{ borderRadius: 1, mb: 0.5 }}
                >
                  <ListItemIcon>
                    <Radio checked={selectedWorkflow?.id === workflow.id} />
                  </ListItemIcon>
                  <ListItemText
                    primary={workflow.name}
                    secondary={workflow.description}
                  />
                  <Box sx={{ display: 'flex', gap: 0.5 }}>
                    {workflow.parameterSchema.length > 0 && (
                      <Chip
                        label={`${workflow.parameterSchema.length} 參數`}
                        size="small"
                        variant="outlined"
                      />
                    )}
                    {workflow.documentSelection?.enabled && (
                      <Chip
                        label="可選文件"
                        size="small"
                        variant="outlined"
                        color="primary"
                      />
                    )}
                  </Box>
                </ListItemButton>
              ))}
            </List>
          </Box>
        ))}
      </Box>
    )
  }

  // 渲染步驟內容
  const renderStepContent = () => {
    switch (activeStep) {
      case 0:
        return (
          <Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              選擇要觸發的工作流
            </Typography>

            {loadingWorkflows ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress />
              </Box>
            ) : workflows.length === 0 ? (
              <Alert severity="info">目前沒有可用的工作流</Alert>
            ) : (
              renderWorkflowList()
            )}
          </Box>
        )

      case 1:
        return (
          <Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              設定執行參數
            </Typography>

            {/* 參數表單 */}
            {selectedWorkflow && selectedWorkflow.parameterSchema.length > 0 && (
              <ParameterForm
                parameters={selectedWorkflow.parameterSchema}
                values={parameters}
                onChange={setParameters}
              />
            )}

            {selectedWorkflow?.parameterSchema.length === 0 && (
              <Alert severity="info" sx={{ mb: 2 }}>
                此工作流不需要輸入參數
              </Alert>
            )}

            {/* 文件選擇器 */}
            {selectedWorkflow?.documentSelection?.enabled && (
              <>
                <Divider sx={{ my: 2 }} />
                <DocumentSelector
                  config={selectedWorkflow.documentSelection}
                  selectedIds={documentIds}
                  onChange={setDocumentIds}
                  cityCode={cityCode}
                />
              </>
            )}
          </Box>
        )

      case 2:
        return (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            {result ? (
              <>
                <CheckCircle color="success" sx={{ fontSize: 64, mb: 2 }} />
                <Typography variant="h6" gutterBottom>
                  工作流已觸發
                </Typography>
                <Typography color="text.secondary" sx={{ mb: 2 }}>
                  執行 ID: {result.executionId}
                </Typography>
                <Button
                  variant="contained"
                  startIcon={<PlayArrow />}
                  onClick={handleGoToExecution}
                >
                  查看執行狀態
                </Button>
              </>
            ) : (
              <>
                <ErrorIcon color="error" sx={{ fontSize: 64, mb: 2 }} />
                <Typography variant="h6" gutterBottom>
                  觸發失敗
                </Typography>
                <Typography color="error" sx={{ mb: 2 }}>
                  {error}
                </Typography>
                <Button variant="outlined" onClick={() => setActiveStep(1)}>
                  返回重試
                </Button>
              </>
            )}
          </Box>
        )

      default:
        return null
    }
  }

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <PlayArrow color="primary" />
          手動觸發工作流
        </Box>
      </DialogTitle>

      <DialogContent>
        <Stepper activeStep={activeStep} sx={{ mb: 3 }}>
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        {error && activeStep !== 2 && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {renderStepContent()}
      </DialogContent>

      <DialogActions>
        {activeStep < 2 && (
          <>
            <Button onClick={handleClose}>取消</Button>
            {activeStep > 0 && (
              <Button onClick={() => setActiveStep((prev) => prev - 1)}>
                上一步
              </Button>
            )}
            {activeStep === 1 ? (
              <Button
                variant="contained"
                onClick={handleTrigger}
                disabled={!canProceed() || triggering}
                startIcon={triggering ? <CircularProgress size={20} /> : <PlayArrow />}
              >
                {triggering ? '觸發中...' : '觸發'}
              </Button>
            ) : (
              <Button
                variant="contained"
                onClick={() => setActiveStep((prev) => prev + 1)}
                disabled={!canProceed()}
              >
                下一步
              </Button>
            )}
          </>
        )}
        {activeStep === 2 && (
          <Button onClick={handleClose}>關閉</Button>
        )}
      </DialogActions>
    </Dialog>
  )
}
```

### 6.2 參數表單組件

```typescript
// components/workflow/ParameterForm.tsx
'use client'

import React from 'react'
import {
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Checkbox,
  FormControlLabel,
  Box,
  Typography,
  Chip,
  ListItemText,
} from '@mui/material'
import { DatePicker } from '@mui/x-date-pickers'
import type { WorkflowParameter } from '@/lib/types/workflow-trigger'

interface ParameterFormProps {
  parameters: WorkflowParameter[]
  values: Record<string, unknown>
  onChange: (values: Record<string, unknown>) => void
}

export function ParameterForm({ parameters, values, onChange }: ParameterFormProps) {
  const handleChange = (name: string, value: unknown) => {
    onChange({ ...values, [name]: value })
  }

  // 檢查依賴條件
  const shouldShow = (param: WorkflowParameter): boolean => {
    if (!param.dependsOn) return true
    return values[param.dependsOn.field] === param.dependsOn.value
  }

  const renderInput = (param: WorkflowParameter) => {
    if (!shouldShow(param)) return null

    const value = values[param.name]
    const commonProps = {
      fullWidth: true,
      size: 'small' as const,
      required: param.required,
      helperText: param.description,
    }

    switch (param.type) {
      case 'select':
        return (
          <FormControl {...commonProps}>
            <InputLabel>{param.label}</InputLabel>
            <Select
              value={value ?? ''}
              label={param.label}
              onChange={(e) => handleChange(param.name, e.target.value)}
            >
              {param.options?.map((opt) => (
                <MenuItem key={opt.value} value={opt.value}>
                  {opt.label}
                </MenuItem>
              ))}
            </Select>
            {param.description && (
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
                {param.description}
              </Typography>
            )}
          </FormControl>
        )

      case 'multiselect':
        return (
          <FormControl {...commonProps}>
            <InputLabel>{param.label}</InputLabel>
            <Select
              multiple
              value={(value as string[]) ?? []}
              label={param.label}
              onChange={(e) => handleChange(param.name, e.target.value)}
              renderValue={(selected) => (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {(selected as string[]).map((val) => (
                    <Chip
                      key={val}
                      label={param.options?.find((o) => o.value === val)?.label ?? val}
                      size="small"
                    />
                  ))}
                </Box>
              )}
            >
              {param.options?.map((opt) => (
                <MenuItem key={opt.value} value={opt.value}>
                  <Checkbox checked={((value as string[]) ?? []).includes(opt.value)} />
                  <ListItemText primary={opt.label} />
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )

      case 'boolean':
        return (
          <FormControlLabel
            control={
              <Checkbox
                checked={(value as boolean) ?? false}
                onChange={(e) => handleChange(param.name, e.target.checked)}
              />
            }
            label={
              <Box>
                <Typography variant="body2">{param.label}</Typography>
                {param.description && (
                  <Typography variant="caption" color="text.secondary">
                    {param.description}
                  </Typography>
                )}
              </Box>
            }
          />
        )

      case 'number':
        return (
          <TextField
            {...commonProps}
            type="number"
            label={param.label}
            value={value ?? ''}
            onChange={(e) => handleChange(param.name, parseFloat(e.target.value))}
            inputProps={{
              min: param.validation?.min,
              max: param.validation?.max,
            }}
          />
        )

      case 'date':
        return (
          <DatePicker
            label={param.label}
            value={value ? new Date(value as string) : null}
            onChange={(date) => handleChange(param.name, date?.toISOString())}
            slotProps={{
              textField: commonProps,
            }}
          />
        )

      case 'text':
        return (
          <TextField
            {...commonProps}
            multiline
            rows={3}
            label={param.label}
            value={value ?? ''}
            onChange={(e) => handleChange(param.name, e.target.value)}
          />
        )

      default:
        return (
          <TextField
            {...commonProps}
            label={param.label}
            value={value ?? ''}
            onChange={(e) => handleChange(param.name, e.target.value)}
          />
        )
    }
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {parameters.map((param) => (
        <Box key={param.name}>{renderInput(param)}</Box>
      ))}
    </Box>
  )
}
```

### 6.3 React Query Hooks

```typescript
// hooks/useWorkflowTrigger.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type {
  TriggerableWorkflow,
  TriggerableWorkflowsResponse,
  TriggerWorkflowResponse,
} from '@/lib/types/workflow-trigger'

// ===========================================
// 獲取可觸發工作流
// ===========================================
export function useTriggerableWorkflows(
  cityCode: string,
  options: { enabled?: boolean; category?: string } = {}
) {
  const { enabled = true, category } = options

  return useQuery({
    queryKey: ['triggerable-workflows', cityCode, category],
    queryFn: async (): Promise<TriggerableWorkflow[]> => {
      const params = new URLSearchParams({ cityCode })
      if (category) params.set('category', category)

      const response = await fetch(`/api/workflows/triggerable?${params}`)
      if (!response.ok) throw new Error('Failed to fetch workflows')

      const data: TriggerableWorkflowsResponse = await response.json()
      return data.data
    },
    enabled,
    staleTime: 60000, // 1 分鐘
  })
}

// ===========================================
// 觸發工作流
// ===========================================
export function useTriggerWorkflow() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: {
      workflowId: string
      parameters?: Record<string, unknown>
      documentIds?: string[]
      cityCode: string
    }) => {
      const response = await fetch('/api/workflows/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Trigger failed')
      }

      return data.data as TriggerWorkflowResponse['data']
    },
    onSuccess: () => {
      // 刷新執行列表
      queryClient.invalidateQueries({ queryKey: ['workflow-executions'] })
      queryClient.invalidateQueries({ queryKey: ['running-executions'] })
    },
  })
}

// ===========================================
// 重試工作流
// ===========================================
export function useRetryWorkflow() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (executionId: string) => {
      const response = await fetch(`/api/workflows/executions/${executionId}/retry`, {
        method: 'POST',
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Retry failed')
      }

      return data.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflow-executions'] })
    },
  })
}

// ===========================================
// 取消執行
// ===========================================
export function useCancelExecution() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (executionId: string) => {
      const response = await fetch(`/api/workflows/executions/${executionId}/cancel`, {
        method: 'POST',
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Cancel failed')
      }

      return data.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflow-executions'] })
    },
  })
}
```

---

## 7. 測試計畫

### 7.1 單元測試

```typescript
// __tests__/services/n8n/workflowTriggerService.test.ts
import { WorkflowTriggerService } from '@/lib/services/n8n/workflowTriggerService'
import { prismaMock } from '@/lib/__mocks__/prisma'

describe('WorkflowTriggerService', () => {
  let service: WorkflowTriggerService

  beforeEach(() => {
    service = new WorkflowTriggerService()
    jest.clearAllMocks()
  })

  describe('validateParameters', () => {
    it('應該驗證必填參數', () => {
      const schema = [
        { name: 'name', type: 'string' as const, label: 'Name', required: true },
      ]

      const error = service['validateParameters']({}, schema)
      expect(error).toContain('required')
    })

    it('應該驗證數字範圍', () => {
      const schema = [
        {
          name: 'count',
          type: 'number' as const,
          label: 'Count',
          required: true,
          validation: { min: 1, max: 10 },
        },
      ]

      const error = service['validateParameters']({ count: 15 }, schema)
      expect(error).toContain('at most 10')
    })

    it('應該驗證字串格式', () => {
      const schema = [
        {
          name: 'email',
          type: 'string' as const,
          label: 'Email',
          required: true,
          validation: { pattern: '^[^@]+@[^@]+$', message: 'Invalid email' },
        },
      ]

      const error = service['validateParameters']({ email: 'invalid' }, schema)
      expect(error).toBe('Invalid email')
    })

    it('應該驗證選擇項', () => {
      const schema = [
        {
          name: 'status',
          type: 'select' as const,
          label: 'Status',
          required: true,
          options: [
            { value: 'active', label: 'Active' },
            { value: 'inactive', label: 'Inactive' },
          ],
        },
      ]

      const error = service['validateParameters']({ status: 'unknown' }, schema)
      expect(error).toContain('invalid value')
    })

    it('應該處理依賴條件', () => {
      const schema = [
        { name: 'type', type: 'string' as const, label: 'Type', required: true },
        {
          name: 'details',
          type: 'string' as const,
          label: 'Details',
          required: true,
          dependsOn: { field: 'type', value: 'custom' },
        },
      ]

      // 當 type 不是 custom 時，details 不需驗證
      const error1 = service['validateParameters']({ type: 'standard' }, schema)
      expect(error1).toBeNull()

      // 當 type 是 custom 時，details 需要驗證
      const error2 = service['validateParameters']({ type: 'custom' }, schema)
      expect(error2).toContain('required')
    })
  })

  describe('triggerWorkflow', () => {
    it('應該成功觸發工作流', async () => {
      // Mock 工作流定義
      prismaMock.workflowDefinition.findUnique.mockResolvedValue({
        id: 'wf-1',
        name: 'Test Workflow',
        n8nWorkflowId: 'n8n-wf-1',
        triggerUrl: 'https://n8n.example.com/webhook/test',
        triggerMethod: 'POST',
        isActive: true,
        cityCode: null,
        allowedRoles: [],
        parameters: null,
      } as any)

      // Mock 執行記錄創建
      prismaMock.workflowExecution.create.mockResolvedValue({
        id: 'exec-1',
      } as any)

      // Mock fetch
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ executionId: 'n8n-exec-1' }),
      })

      // Mock 更新
      prismaMock.workflowExecution.update.mockResolvedValue({} as any)

      const result = await service.triggerWorkflow({
        workflowId: 'wf-1',
        triggeredBy: 'user-1',
        cityCode: 'TPE',
      })

      expect(result.success).toBe(true)
      expect(result.executionId).toBe('exec-1')
      expect(result.n8nExecutionId).toBe('n8n-exec-1')
    })

    it('應該在工作流不存在時返回錯誤', async () => {
      prismaMock.workflowDefinition.findUnique.mockResolvedValue(null)

      const result = await service.triggerWorkflow({
        workflowId: 'non-existent',
        triggeredBy: 'user-1',
        cityCode: 'TPE',
      })

      expect(result.success).toBe(false)
      expect(result.errorCode).toBe('WORKFLOW_NOT_FOUND')
    })

    it('應該在城市權限不符時返回錯誤', async () => {
      prismaMock.workflowDefinition.findUnique.mockResolvedValue({
        id: 'wf-1',
        cityCode: 'KHH', // 不同城市
        isActive: true,
      } as any)

      const result = await service.triggerWorkflow({
        workflowId: 'wf-1',
        triggeredBy: 'user-1',
        cityCode: 'TPE',
      })

      expect(result.success).toBe(false)
      expect(result.errorCode).toBe('CITY_ACCESS_DENIED')
    })
  })

  describe('retryTrigger', () => {
    it('應該只允許重試失敗的執行', async () => {
      prismaMock.workflowExecution.findUnique.mockResolvedValue({
        id: 'exec-1',
        status: 'COMPLETED', // 不是 FAILED
      } as any)

      const result = await service.retryTrigger('exec-1', 'user-1')

      expect(result.success).toBe(false)
      expect(result.error).toContain('Only failed')
    })
  })
})
```

### 7.2 API 整合測試

```typescript
// __tests__/api/workflows/trigger.test.ts
import { POST } from '@/app/api/workflows/trigger/route'
import { createMocks } from 'node-mocks-http'
import { getServerSession } from 'next-auth'
import { workflowTriggerService } from '@/lib/services/n8n/workflowTriggerService'

jest.mock('next-auth', () => ({
  getServerSession: jest.fn(),
}))

jest.mock('@/lib/services/n8n/workflowTriggerService', () => ({
  workflowTriggerService: {
    triggerWorkflow: jest.fn(),
  },
}))

jest.mock('@/lib/utils/permissions', () => ({
  hasRole: jest.fn().mockReturnValue(true),
  getUserCityAccess: jest.fn().mockResolvedValue(['TPE', '*']),
}))

describe('POST /api/workflows/trigger', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('應該要求身份驗證', async () => {
    (getServerSession as jest.Mock).mockResolvedValue(null)

    const { req } = createMocks({
      method: 'POST',
      body: { workflowId: 'wf-1', cityCode: 'TPE' },
    })

    const response = await POST(req as any)
    expect(response.status).toBe(401)
  })

  it('應該成功觸發工作流', async () => {
    (getServerSession as jest.Mock).mockResolvedValue({
      user: { id: 'user-1' },
    })

    ;(workflowTriggerService.triggerWorkflow as jest.Mock).mockResolvedValue({
      success: true,
      executionId: 'exec-1',
      n8nExecutionId: 'n8n-exec-1',
    })

    const { req } = createMocks({
      method: 'POST',
      body: { workflowId: 'wf-1', cityCode: 'TPE' },
    })

    // 模擬 request.json()
    req.json = jest.fn().mockResolvedValue({
      workflowId: 'wf-1',
      cityCode: 'TPE',
    })

    const response = await POST(req as any)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.data.executionId).toBe('exec-1')
  })
})
```

---

## 8. 部署注意事項

### 8.1 權限控制

```yaml
permissions:
  manual_trigger:
    allowed_roles:
      - SUPER_USER
      - ADMIN
    city_isolation: true

  workflow_definition:
    per_workflow_roles: true
    empty_means_all: true
```

### 8.2 監控指標

```yaml
metrics:
  - name: workflow_manual_trigger_total
    type: counter
    labels: [workflow_id, city_code, status]

  - name: workflow_trigger_latency_seconds
    type: histogram
    buckets: [0.5, 1, 2, 5, 10, 30]

  - name: workflow_trigger_success_rate
    type: gauge
    labels: [workflow_id]

alerting:
  - name: high_trigger_failure_rate
    condition: success_rate < 0.9
    duration: 5m
    severity: warning

  - name: trigger_timeout
    condition: latency > 30s
    severity: critical
```

### 8.3 安全考量

```yaml
security:
  input_validation:
    - parameter_sanitization
    - sql_injection_prevention
    - xss_prevention

  rate_limiting:
    enabled: true
    max_triggers_per_minute: 10
    max_triggers_per_hour: 100

  audit_logging:
    log_all_triggers: true
    log_parameters: true  # 需注意敏感資料
    retention_days: 90
```

### 8.4 環境變數

```bash
# .env.example

# 觸發配置
WORKFLOW_TRIGGER_TIMEOUT_MS=30000
WORKFLOW_TRIGGER_MAX_RETRIES=3

# 限流配置
WORKFLOW_TRIGGER_RATE_LIMIT_MINUTE=10
WORKFLOW_TRIGGER_RATE_LIMIT_HOUR=100
```

---

## 9. 驗收標準對應

| AC | 描述 | 實現方式 |
|----|------|---------|
| AC1 | 可觸發工作流列表 | `GET /api/workflows/triggerable` + 分類分組顯示 |
| AC2 | 參數輸入表單 | `ParameterForm` 組件 + 動態欄位渲染 + 文件選擇器 |
| AC3 | 觸發執行 | `POST /api/workflows/trigger` + 執行記錄創建 |
| AC4 | 觸發成功處理 | 跳轉執行詳情頁 + 即時狀態監控 |
| AC5 | 觸發失敗處理 | 錯誤訊息顯示 + 重試 API |

---

## 10. 開放問題

1. **參數敏感資料處理**: 某些參數可能包含敏感資訊，是否需要加密儲存？
   - 建議：敏感參數不儲存在執行記錄中

2. **批次觸發**: 是否需要支援一次觸發多個工作流？
   - 建議：初期不支援，後續根據需求評估

3. **觸發排程**: 是否需要支援延遲觸發或排程觸發？
   - 建議：延後至未來迭代

4. **工作流版本控制**: n8n 工作流更新後，是否需要同步更新 WorkflowDefinition？
   - 建議：提供手動同步機制

---

## 11. 參考資料

- [Story 10-4: 手動觸發工作流](../stories/10-4-manual-trigger-workflow.md)
- [Tech Spec Story 10-1: n8n 雙向通訊 API](./tech-spec-story-10-1.md)
- [Tech Spec Story 10-2: Webhook 配置管理](./tech-spec-story-10-2.md)
- [Tech Spec Story 10-3: 工作流執行狀態檢視](./tech-spec-story-10-3.md)
- [n8n Webhook Trigger Documentation](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.webhook/)
