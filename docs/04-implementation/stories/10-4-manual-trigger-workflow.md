# Story 10-4: 手動觸發工作流

## Story 資訊

- **Epic**: 10 - n8n 工作流整合
- **功能需求**: FR55 (工作流觸發), FR56 (執行狀態監控)
- **優先級**: Medium
- **故事點數**: 5
- **相關 Stories**:
  - Story 10-1 (n8n 雙向通訊 API)
  - Story 10-2 (Webhook 配置管理)
  - Story 10-3 (工作流執行狀態查看)

## 使用者故事

**As a** Super User,
**I want** 手動觸發特定的 n8n 工作流,
**So that** 我可以在需要時重新處理文件或執行特定任務。

## 驗收標準

### AC1: 可觸發工作流列表

**Given** Super User 在工作流監控頁面
**When** 點擊「手動觸發」按鈕
**Then** 顯示可觸發的工作流列表

### AC2: 參數輸入表單

**Given** 選擇工作流
**When** 需要輸入參數
**Then** 顯示參數輸入表單
**And** 包含：目標文件（可選）、執行參數

### AC3: 觸發執行

**Given** 確認觸發
**When** 提交請求
**Then** 系統調用 n8n Webhook 觸發工作流
**And** 創建執行記錄
**And** 顯示執行 ID 供追蹤

### AC4: 觸發成功處理

**Given** 手動觸發
**When** 觸發成功
**Then** 跳轉至執行詳情頁面
**And** 可以即時監控執行狀態

### AC5: 觸發失敗處理

**Given** 手動觸發
**When** 觸發失敗
**Then** 顯示錯誤訊息
**And** 提供重試選項

## 技術規格

### 1. 資料模型

```prisma
// 可觸發工作流定義
model WorkflowDefinition {
  id              String    @id @default(cuid())

  // 工作流資訊
  name            String
  description     String?
  n8nWorkflowId   String    @unique  // n8n 側的工作流 ID

  // 觸發配置
  triggerUrl      String    // n8n Webhook URL
  triggerMethod   String    @default("POST")

  // 參數定義
  parameters      Json?     // 參數 schema 定義

  // 城市配置
  cityCode        String?   // null 表示全域可用
  city            City?     @relation(fields: [cityCode], references: [code])

  // 權限控制
  allowedRoles    String[]  // 允許觸發的角色

  // 狀態
  isActive        Boolean   @default(true)

  // 審計
  createdBy       String
  createdAt       DateTime  @default(now())
  updatedBy       String?
  updatedAt       DateTime  @updatedAt

  // 關聯
  executions      WorkflowExecution[]

  @@index([cityCode])
  @@index([isActive])
}

// 擴展 WorkflowExecution 增加手動觸發資訊
// 見 Story 10-3
```

### 2. 工作流觸發服務

```typescript
// lib/services/n8n/workflowTriggerService.ts
import { prisma } from '@/lib/prisma'
import { webhookConfigService } from './webhookConfigService'
import { decrypt } from '@/lib/utils/encryption'
import {
  WorkflowDefinition,
  WorkflowExecution,
  WorkflowTriggerType,
} from '@prisma/client'

export interface WorkflowParameter {
  name: string
  type: 'string' | 'number' | 'boolean' | 'date' | 'select' | 'multiselect' | 'file'
  label: string
  description?: string
  required: boolean
  default?: any
  options?: Array<{ value: string; label: string }>  // for select/multiselect
  validation?: {
    min?: number
    max?: number
    pattern?: string
    message?: string
  }
}

export interface TriggerWorkflowInput {
  workflowId: string
  parameters?: Record<string, any>
  documentIds?: string[]
  triggeredBy: string
  cityCode: string
}

export interface TriggerResult {
  success: boolean
  executionId?: string
  n8nExecutionId?: string
  error?: string
}

export class WorkflowTriggerService {
  // 列出可觸發的工作流
  async listTriggerableWorkflows(options: {
    cityCode: string
    userRoles: string[]
  }): Promise<WorkflowDefinition[]> {
    const { cityCode, userRoles } = options

    const workflows = await prisma.workflowDefinition.findMany({
      where: {
        isActive: true,
        OR: [
          { cityCode },
          { cityCode: null },
        ],
      },
      orderBy: { name: 'asc' },
    })

    // 過濾有權限的工作流
    return workflows.filter((workflow) => {
      if (workflow.allowedRoles.length === 0) return true
      return workflow.allowedRoles.some((role) => userRoles.includes(role))
    })
  }

  // 獲取工作流詳情（含參數定義）
  async getWorkflowDefinition(id: string): Promise<WorkflowDefinition | null> {
    return prisma.workflowDefinition.findUnique({
      where: { id },
    })
  }

  // 解析參數定義
  parseParameterSchema(workflow: WorkflowDefinition): WorkflowParameter[] {
    if (!workflow.parameters) return []

    const schema = workflow.parameters as { parameters?: WorkflowParameter[] }
    return schema.parameters || []
  }

  // 觸發工作流
  async triggerWorkflow(input: TriggerWorkflowInput): Promise<TriggerResult> {
    const { workflowId, parameters, documentIds, triggeredBy, cityCode } = input

    // 獲取工作流定義
    const workflow = await prisma.workflowDefinition.findUnique({
      where: { id: workflowId },
    })

    if (!workflow) {
      return { success: false, error: 'Workflow not found' }
    }

    if (!workflow.isActive) {
      return { success: false, error: 'Workflow is not active' }
    }

    // 驗證城市權限
    if (workflow.cityCode && workflow.cityCode !== cityCode) {
      return { success: false, error: 'Access denied for this city' }
    }

    // 驗證參數
    const parameterSchema = this.parseParameterSchema(workflow)
    const validationError = this.validateParameters(parameters || {}, parameterSchema)
    if (validationError) {
      return { success: false, error: validationError }
    }

    // 獲取相關文件資訊
    let documents: any[] = []
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
        documents: documentIds ? {
          connect: documentIds.map((id) => ({ id })),
        } : undefined,
      },
    })

    // 準備 Webhook 請求
    const webhookPayload = {
      executionId: execution.id,
      workflowId: workflow.n8nWorkflowId,
      triggerType: 'manual',
      triggeredBy,
      cityCode,
      timestamp: new Date().toISOString(),
      parameters: parameters || {},
      documents: documents.map((doc) => ({
        id: doc.id,
        fileName: doc.fileName,
        blobUrl: doc.blobUrl,
      })),
    }

    try {
      // 獲取認證 Token（如果需要）
      const webhookConfig = await webhookConfigService.getActiveConfigForCity(cityCode)
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-Execution-Id': execution.id,
        'X-Trigger-Type': 'manual',
      }

      if (webhookConfig) {
        const token = await decrypt(webhookConfig.authToken)
        headers['Authorization'] = `Bearer ${token}`
      }

      // 發送觸發請求
      const response = await fetch(workflow.triggerUrl, {
        method: workflow.triggerMethod,
        headers,
        body: JSON.stringify(webhookPayload),
        signal: AbortSignal.timeout(30000),
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`HTTP ${response.status}: ${errorText}`)
      }

      const responseData = await response.json()

      // 更新執行記錄
      await prisma.workflowExecution.update({
        where: { id: execution.id },
        data: {
          status: 'QUEUED',
          n8nExecutionId: responseData.executionId || responseData.id,
        },
      })

      return {
        success: true,
        executionId: execution.id,
        n8nExecutionId: responseData.executionId || responseData.id,
      }
    } catch (error) {
      // 更新執行記錄為失敗
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'

      await prisma.workflowExecution.update({
        where: { id: execution.id },
        data: {
          status: 'FAILED',
          completedAt: new Date(),
          errorDetails: {
            message: errorMessage,
            stage: 'trigger',
            timestamp: new Date().toISOString(),
          },
        },
      })

      return {
        success: false,
        executionId: execution.id,
        error: errorMessage,
      }
    }
  }

  // 重試觸發
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
      return { success: false, error: 'Execution not found' }
    }

    if (execution.status !== 'FAILED') {
      return { success: false, error: 'Only failed executions can be retried' }
    }

    // 查找原始工作流定義
    const workflow = await prisma.workflowDefinition.findFirst({
      where: { n8nWorkflowId: execution.workflowId || undefined },
    })

    if (!workflow) {
      return { success: false, error: 'Workflow definition not found' }
    }

    // 重新觸發
    return this.triggerWorkflow({
      workflowId: workflow.id,
      documentIds: execution.documents.map((d) => d.id),
      triggeredBy,
      cityCode: execution.cityCode,
    })
  }

  // 驗證參數
  private validateParameters(
    values: Record<string, any>,
    schema: WorkflowParameter[]
  ): string | null {
    for (const param of schema) {
      const value = values[param.name]

      // 檢查必填
      if (param.required && (value === undefined || value === null || value === '')) {
        return `Parameter "${param.label}" is required`
      }

      if (value === undefined || value === null) continue

      // 類型驗證
      switch (param.type) {
        case 'number':
          if (typeof value !== 'number' || isNaN(value)) {
            return `Parameter "${param.label}" must be a number`
          }
          if (param.validation?.min !== undefined && value < param.validation.min) {
            return param.validation.message || `Parameter "${param.label}" must be at least ${param.validation.min}`
          }
          if (param.validation?.max !== undefined && value > param.validation.max) {
            return param.validation.message || `Parameter "${param.label}" must be at most ${param.validation.max}`
          }
          break

        case 'string':
          if (typeof value !== 'string') {
            return `Parameter "${param.label}" must be a string`
          }
          if (param.validation?.pattern) {
            const regex = new RegExp(param.validation.pattern)
            if (!regex.test(value)) {
              return param.validation.message || `Parameter "${param.label}" has invalid format`
            }
          }
          break

        case 'select':
          if (param.options && !param.options.some((opt) => opt.value === value)) {
            return `Parameter "${param.label}" has invalid value`
          }
          break

        case 'multiselect':
          if (!Array.isArray(value)) {
            return `Parameter "${param.label}" must be an array`
          }
          if (param.options) {
            const validValues = param.options.map((opt) => opt.value)
            if (!value.every((v) => validValues.includes(v))) {
              return `Parameter "${param.label}" contains invalid values`
            }
          }
          break
      }
    }

    return null
  }
}

export const workflowTriggerService = new WorkflowTriggerService()
```

### 3. API 路由實現

```typescript
// app/api/workflows/triggerable/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { workflowTriggerService } from '@/lib/services/n8n/workflowTriggerService'
import { getUserCityAccess, getUserRoles } from '@/lib/utils/permissions'

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const searchParams = request.nextUrl.searchParams
  const cityCode = searchParams.get('cityCode')

  // 驗證城市權限
  const userCities = await getUserCityAccess(session.user)
  if (cityCode && !userCities.includes(cityCode) && !userCities.includes('*')) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 })
  }

  const userRoles = await getUserRoles(session.user)

  try {
    const workflows = await workflowTriggerService.listTriggerableWorkflows({
      cityCode: cityCode || userCities[0],
      userRoles,
    })

    // 添加參數 schema
    const workflowsWithSchema = workflows.map((workflow) => ({
      ...workflow,
      parameterSchema: workflowTriggerService.parseParameterSchema(workflow),
    }))

    return NextResponse.json({ data: workflowsWithSchema })
  } catch (error) {
    console.error('List triggerable workflows error:', error)
    return NextResponse.json(
      { error: 'Failed to list workflows' },
      { status: 500 }
    )
  }
}
```

```typescript
// app/api/workflows/trigger/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { workflowTriggerService } from '@/lib/services/n8n/workflowTriggerService'
import { getUserCityAccess, getUserRoles, hasRole } from '@/lib/utils/permissions'
import { z } from 'zod'

const triggerSchema = z.object({
  workflowId: z.string().min(1),
  parameters: z.record(z.any()).optional(),
  documentIds: z.array(z.string()).optional(),
  cityCode: z.string().min(1),
})

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 檢查 Super User 權限
  if (!hasRole(session.user, 'SUPER_USER') && !hasRole(session.user, 'ADMIN')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }

  try {
    const body = await request.json()
    const validatedData = triggerSchema.parse(body)

    // 驗證城市權限
    const userCities = await getUserCityAccess(session.user)
    if (!userCities.includes(validatedData.cityCode) && !userCities.includes('*')) {
      return NextResponse.json({ error: 'Access denied for this city' }, { status: 403 })
    }

    const result = await workflowTriggerService.triggerWorkflow({
      ...validatedData,
      triggeredBy: session.user.id,
    })

    if (!result.success) {
      return NextResponse.json(
        { error: result.error, executionId: result.executionId },
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
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Trigger workflow error:', error)
    return NextResponse.json(
      { error: 'Failed to trigger workflow' },
      { status: 500 }
    )
  }
}
```

```typescript
// app/api/workflows/executions/[id]/retry/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { workflowTriggerService } from '@/lib/services/n8n/workflowTriggerService'
import { hasRole } from '@/lib/utils/permissions'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!hasRole(session.user, 'SUPER_USER') && !hasRole(session.user, 'ADMIN')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }

  try {
    const result = await workflowTriggerService.retryTrigger(
      params.id,
      session.user.id
    )

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
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
      { error: 'Failed to retry workflow' },
      { status: 500 }
    )
  }
}
```

### 4. React 組件

```typescript
// components/workflow/ManualTriggerDialog.tsx
'use client'

import React, { useState, useEffect } from 'react'
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
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Checkbox,
  FormControlLabel,
  Typography,
  Box,
  Alert,
  CircularProgress,
  Chip,
} from '@mui/material'
import { DatePicker } from '@mui/x-date-pickers'
import { PlayArrow, Description, CheckCircle, Error } from '@mui/icons-material'
import { useRouter } from 'next/navigation'

interface WorkflowParameter {
  name: string
  type: string
  label: string
  description?: string
  required: boolean
  default?: any
  options?: Array<{ value: string; label: string }>
  validation?: any
}

interface Workflow {
  id: string
  name: string
  description?: string
  parameterSchema: WorkflowParameter[]
}

interface ManualTriggerDialogProps {
  open: boolean
  onClose: () => void
  cityCode: string
  preselectedDocumentIds?: string[]
}

export function ManualTriggerDialog({
  open,
  onClose,
  cityCode,
  preselectedDocumentIds,
}: ManualTriggerDialogProps) {
  const router = useRouter()
  const [activeStep, setActiveStep] = useState(0)
  const [workflows, setWorkflows] = useState<Workflow[]>([])
  const [selectedWorkflow, setSelectedWorkflow] = useState<Workflow | null>(null)
  const [parameters, setParameters] = useState<Record<string, any>>({})
  const [documentIds, setDocumentIds] = useState<string[]>(preselectedDocumentIds || [])
  const [loading, setLoading] = useState(false)
  const [triggering, setTriggering] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{ executionId: string } | null>(null)

  // 載入可觸發的工作流
  useEffect(() => {
    if (open) {
      loadWorkflows()
    }
  }, [open, cityCode])

  const loadWorkflows = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/workflows/triggerable?cityCode=${cityCode}`)
      const data = await res.json()
      setWorkflows(data.data || [])
    } catch (err) {
      setError('載入工作流失敗')
    } finally {
      setLoading(false)
    }
  }

  const handleWorkflowSelect = (workflow: Workflow) => {
    setSelectedWorkflow(workflow)
    // 初始化參數預設值
    const defaults: Record<string, any> = {}
    workflow.parameterSchema.forEach((param) => {
      if (param.default !== undefined) {
        defaults[param.name] = param.default
      }
    })
    setParameters(defaults)
    setActiveStep(1)
  }

  const handleParameterChange = (name: string, value: any) => {
    setParameters((prev) => ({ ...prev, [name]: value }))
  }

  const handleTrigger = async () => {
    if (!selectedWorkflow) return

    setTriggering(true)
    setError(null)

    try {
      const res = await fetch('/api/workflows/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workflowId: selectedWorkflow.id,
          parameters,
          documentIds: documentIds.length > 0 ? documentIds : undefined,
          cityCode,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
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

  const handleGoToExecution = () => {
    if (result?.executionId) {
      router.push(`/workflow-monitor/${result.executionId}`)
      onClose()
    }
  }

  const handleClose = () => {
    setActiveStep(0)
    setSelectedWorkflow(null)
    setParameters({})
    setError(null)
    setResult(null)
    onClose()
  }

  const renderStepContent = () => {
    switch (activeStep) {
      case 0:
        return (
          <Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              選擇要觸發的工作流
            </Typography>

            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress />
              </Box>
            ) : (
              <List>
                {workflows.map((workflow) => (
                  <ListItemButton
                    key={workflow.id}
                    onClick={() => handleWorkflowSelect(workflow)}
                    sx={{ borderRadius: 1, mb: 1 }}
                  >
                    <ListItemIcon>
                      <Radio checked={selectedWorkflow?.id === workflow.id} />
                    </ListItemIcon>
                    <ListItemText
                      primary={workflow.name}
                      secondary={workflow.description}
                    />
                    {workflow.parameterSchema.length > 0 && (
                      <Chip
                        label={`${workflow.parameterSchema.length} 參數`}
                        size="small"
                        variant="outlined"
                      />
                    )}
                  </ListItemButton>
                ))}

                {workflows.length === 0 && !loading && (
                  <Typography color="text.secondary" align="center" sx={{ py: 4 }}>
                    沒有可用的工作流
                  </Typography>
                )}
              </List>
            )}
          </Box>
        )

      case 1:
        return (
          <Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              設定執行參數
            </Typography>

            {selectedWorkflow?.parameterSchema.map((param) => (
              <Box key={param.name} sx={{ mb: 2 }}>
                {renderParameterInput(param)}
              </Box>
            ))}

            {selectedWorkflow?.parameterSchema.length === 0 && (
              <Alert severity="info">
                此工作流不需要輸入參數
              </Alert>
            )}

            {documentIds.length > 0 && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  關聯文件
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {documentIds.map((id) => (
                    <Chip
                      key={id}
                      icon={<Description />}
                      label={id.substring(0, 8)}
                      onDelete={() => setDocumentIds((prev) => prev.filter((d) => d !== id))}
                      size="small"
                    />
                  ))}
                </Box>
              </Box>
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
                <Error color="error" sx={{ fontSize: 64, mb: 2 }} />
                <Typography variant="h6" gutterBottom>
                  觸發失敗
                </Typography>
                <Typography color="error" sx={{ mb: 2 }}>
                  {error}
                </Typography>
                <Button
                  variant="outlined"
                  onClick={() => setActiveStep(1)}
                >
                  返回重試
                </Button>
              </>
            )}
          </Box>
        )
    }
  }

  const renderParameterInput = (param: WorkflowParameter) => {
    const value = parameters[param.name]

    switch (param.type) {
      case 'select':
        return (
          <FormControl fullWidth size="small">
            <InputLabel>{param.label}{param.required && ' *'}</InputLabel>
            <Select
              value={value || ''}
              label={param.label}
              onChange={(e) => handleParameterChange(param.name, e.target.value)}
            >
              {param.options?.map((opt) => (
                <MenuItem key={opt.value} value={opt.value}>
                  {opt.label}
                </MenuItem>
              ))}
            </Select>
            {param.description && (
              <Typography variant="caption" color="text.secondary">
                {param.description}
              </Typography>
            )}
          </FormControl>
        )

      case 'multiselect':
        return (
          <FormControl fullWidth size="small">
            <InputLabel>{param.label}{param.required && ' *'}</InputLabel>
            <Select
              multiple
              value={value || []}
              label={param.label}
              onChange={(e) => handleParameterChange(param.name, e.target.value)}
              renderValue={(selected) => (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {(selected as string[]).map((val) => (
                    <Chip
                      key={val}
                      label={param.options?.find((o) => o.value === val)?.label || val}
                      size="small"
                    />
                  ))}
                </Box>
              )}
            >
              {param.options?.map((opt) => (
                <MenuItem key={opt.value} value={opt.value}>
                  <Checkbox checked={(value || []).includes(opt.value)} />
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
                checked={value || false}
                onChange={(e) => handleParameterChange(param.name, e.target.checked)}
              />
            }
            label={param.label}
          />
        )

      case 'number':
        return (
          <TextField
            fullWidth
            size="small"
            type="number"
            label={param.label}
            value={value || ''}
            onChange={(e) => handleParameterChange(param.name, parseFloat(e.target.value))}
            required={param.required}
            helperText={param.description}
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
            value={value || null}
            onChange={(date) => handleParameterChange(param.name, date)}
            slotProps={{
              textField: {
                fullWidth: true,
                size: 'small',
                required: param.required,
                helperText: param.description,
              },
            }}
          />
        )

      default:
        return (
          <TextField
            fullWidth
            size="small"
            label={param.label}
            value={value || ''}
            onChange={(e) => handleParameterChange(param.name, e.target.value)}
            required={param.required}
            helperText={param.description}
            multiline={param.type === 'text'}
            rows={param.type === 'text' ? 3 : 1}
          />
        )
    }
  }

  const canProceed = () => {
    if (activeStep === 0) return !!selectedWorkflow
    if (activeStep === 1) {
      // 檢查必填參數
      return selectedWorkflow?.parameterSchema.every((param) => {
        if (!param.required) return true
        const value = parameters[param.name]
        return value !== undefined && value !== null && value !== ''
      }) ?? true
    }
    return false
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
          <Step>
            <StepLabel>選擇工作流</StepLabel>
          </Step>
          <Step>
            <StepLabel>設定參數</StepLabel>
          </Step>
          <Step>
            <StepLabel>完成</StepLabel>
          </Step>
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
                startIcon={triggering && <CircularProgress size={20} />}
              >
                觸發
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

## 測試案例

### 單元測試

```typescript
// __tests__/services/n8n/workflowTriggerService.test.ts
import { workflowTriggerService } from '@/lib/services/n8n/workflowTriggerService'
import { prismaMock } from '@/lib/__mocks__/prisma'

describe('WorkflowTriggerService', () => {
  describe('validateParameters', () => {
    it('should validate required parameters', () => {
      const schema = [
        { name: 'name', type: 'string', label: 'Name', required: true },
      ]

      const error = workflowTriggerService['validateParameters']({}, schema as any)
      expect(error).toContain('required')
    })

    it('should validate number range', () => {
      const schema = [
        {
          name: 'count',
          type: 'number',
          label: 'Count',
          required: true,
          validation: { min: 1, max: 10 },
        },
      ]

      const error = workflowTriggerService['validateParameters']({ count: 15 }, schema as any)
      expect(error).toContain('at most 10')
    })
  })

  describe('triggerWorkflow', () => {
    it('should create execution and call webhook', async () => {
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

      prismaMock.workflowExecution.create.mockResolvedValue({
        id: 'exec-1',
      } as any)

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ executionId: 'n8n-exec-1' }),
      })

      prismaMock.workflowExecution.update.mockResolvedValue({} as any)

      const result = await workflowTriggerService.triggerWorkflow({
        workflowId: 'wf-1',
        triggeredBy: 'user-1',
        cityCode: 'TPE',
      })

      expect(result.success).toBe(true)
      expect(result.executionId).toBe('exec-1')
    })
  })
})
```

## 部署注意事項

1. **權限控制**
   - 僅 Super User 和 Admin 可手動觸發
   - 工作流可配置允許的角色列表

2. **監控指標**
   - 手動觸發次數統計
   - 觸發成功率
   - 平均觸發耗時

3. **安全考量**
   - 參數驗證防止注入攻擊
   - 城市權限隔離

## 相依性

- Story 10-1: n8n 雙向通訊 API（API 基礎）
- Story 10-2: Webhook 配置管理（認證 Token）
- Story 10-3: 工作流執行狀態查看（執行追蹤）
