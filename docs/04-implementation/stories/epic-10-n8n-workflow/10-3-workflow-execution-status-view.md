# Story 10-3: 工作流執行狀態查看

## Story 資訊

- **Epic**: 10 - n8n 工作流整合
- **功能需求**: FR56 (執行狀態監控)
- **優先級**: Medium
- **故事點數**: 8
- **相關 Stories**:
  - Story 10-1 (n8n 雙向通訊 API)
  - Story 10-5 (工作流錯誤詳情查看)
  - Story 10-6 (文件處理進度追蹤)

## 使用者故事

**As a** 用戶,
**I want** 查看 n8n 工作流的執行狀態,
**So that** 我可以了解自動化流程的運行情況。

## 驗收標準

### AC1: 工作流執行列表

**Given** 用戶已登入
**When** 導航至「工作流監控」頁面
**Then** 顯示近期工作流執行列表
**And** 包含：工作流名稱、觸發時間、狀態、耗時、相關文件

### AC2: 篩選功能

**Given** 工作流執行列表
**When** 篩選條件變更
**Then** 支援按狀態、時間範圍、工作流類型篩選

### AC3: 執行中狀態顯示

**Given** 工作流執行
**When** 狀態為「執行中」
**Then** 顯示進度指示器
**And** 支援即時更新（輪詢或 WebSocket）

### AC4: 完成狀態顯示

**Given** 工作流執行
**When** 狀態為「已完成」
**Then** 顯示綠色勾號圖標
**And** 顯示執行耗時

### AC5: 失敗狀態顯示

**Given** 工作流執行
**When** 狀態為「失敗」
**Then** 顯示紅色錯誤圖標
**And** 提供「查看詳情」連結

## 技術規格

### 1. 資料模型

```prisma
// 工作流執行記錄
model WorkflowExecution {
  id                String    @id @default(cuid())

  // n8n 工作流資訊
  n8nExecutionId    String?   @unique  // n8n 側的執行 ID
  workflowId        String?             // n8n 工作流 ID
  workflowName      String              // 工作流名稱

  // 觸發資訊
  triggerType       WorkflowTriggerType
  triggerSource     String?             // 觸發來源描述
  triggeredBy       String?             // 觸發者 (用戶 ID 或 'system')

  // 城市隔離
  cityCode          String
  city              City      @relation(fields: [cityCode], references: [code])

  // 執行狀態
  status            WorkflowExecutionStatus @default(PENDING)
  progress          Int       @default(0)      // 0-100
  currentStep       String?                    // 當前執行步驟

  // 時間記錄
  scheduledAt       DateTime?
  startedAt         DateTime?
  completedAt       DateTime?
  durationMs        Int?

  // 結果資訊
  result            Json?               // 執行結果
  errorDetails      Json?               // 錯誤詳情

  // 相關文件
  documentCount     Int       @default(0)
  documents         Document[]

  // 審計
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt

  @@index([status])
  @@index([workflowName])
  @@index([cityCode])
  @@index([startedAt])
  @@index([triggeredBy])
}

enum WorkflowExecutionStatus {
  PENDING       // 等待執行
  QUEUED        // 已排隊
  RUNNING       // 執行中
  COMPLETED     // 已完成
  FAILED        // 失敗
  CANCELLED     // 已取消
  TIMEOUT       // 超時
}

enum WorkflowTriggerType {
  SCHEDULED     // 排程觸發
  MANUAL        // 手動觸發
  WEBHOOK       // Webhook 觸發
  DOCUMENT      // 文件觸發
  EVENT         // 事件觸發
}

// 工作流執行步驟記錄
model WorkflowExecutionStep {
  id              String    @id @default(cuid())
  executionId     String
  execution       WorkflowExecution @relation(fields: [executionId], references: [id], onDelete: Cascade)

  // 步驟資訊
  stepNumber      Int
  stepName        String
  stepType        String?   // node type in n8n

  // 狀態
  status          StepExecutionStatus @default(PENDING)

  // 時間
  startedAt       DateTime?
  completedAt     DateTime?
  durationMs      Int?

  // 結果
  inputData       Json?
  outputData      Json?
  errorMessage    String?

  createdAt       DateTime  @default(now())

  @@index([executionId])
  @@index([status])
}

enum StepExecutionStatus {
  PENDING
  RUNNING
  COMPLETED
  FAILED
  SKIPPED
}
```

### 2. 工作流執行服務

```typescript
// lib/services/n8n/workflowExecutionService.ts
import { prisma } from '@/lib/prisma'
import {
  WorkflowExecution,
  WorkflowExecutionStatus,
  WorkflowTriggerType,
} from '@prisma/client'

export interface ListExecutionsOptions {
  cityCode?: string
  status?: WorkflowExecutionStatus | WorkflowExecutionStatus[]
  workflowName?: string
  triggerType?: WorkflowTriggerType
  startDate?: Date
  endDate?: Date
  triggeredBy?: string
  page?: number
  pageSize?: number
  orderBy?: 'startedAt' | 'createdAt' | 'completedAt'
  orderDirection?: 'asc' | 'desc'
}

export interface ExecutionSummary {
  id: string
  workflowName: string
  triggerType: WorkflowTriggerType
  triggerSource?: string
  status: WorkflowExecutionStatus
  progress: number
  currentStep?: string
  startedAt?: Date
  completedAt?: Date
  durationMs?: number
  documentCount: number
  errorMessage?: string
}

export interface ExecutionDetail extends ExecutionSummary {
  n8nExecutionId?: string
  workflowId?: string
  triggeredBy?: string
  cityCode: string
  result?: Record<string, any>
  errorDetails?: Record<string, any>
  steps: Array<{
    stepNumber: number
    stepName: string
    stepType?: string
    status: string
    durationMs?: number
    errorMessage?: string
  }>
  documents: Array<{
    id: string
    fileName: string
    status: string
  }>
}

export class WorkflowExecutionService {
  // 列出執行記錄
  async listExecutions(
    options: ListExecutionsOptions
  ): Promise<{ items: ExecutionSummary[]; total: number }> {
    const {
      cityCode,
      status,
      workflowName,
      triggerType,
      startDate,
      endDate,
      triggeredBy,
      page = 1,
      pageSize = 20,
      orderBy = 'startedAt',
      orderDirection = 'desc',
    } = options

    const where: any = {}

    if (cityCode) where.cityCode = cityCode
    if (status) {
      where.status = Array.isArray(status) ? { in: status } : status
    }
    if (workflowName) where.workflowName = { contains: workflowName }
    if (triggerType) where.triggerType = triggerType
    if (triggeredBy) where.triggeredBy = triggeredBy

    if (startDate || endDate) {
      where.startedAt = {}
      if (startDate) where.startedAt.gte = startDate
      if (endDate) where.startedAt.lte = endDate
    }

    const [items, total] = await Promise.all([
      prisma.workflowExecution.findMany({
        where,
        orderBy: { [orderBy]: orderDirection },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          _count: {
            select: { documents: true },
          },
        },
      }),
      prisma.workflowExecution.count({ where }),
    ])

    return {
      items: items.map((item) => ({
        id: item.id,
        workflowName: item.workflowName,
        triggerType: item.triggerType,
        triggerSource: item.triggerSource || undefined,
        status: item.status,
        progress: item.progress,
        currentStep: item.currentStep || undefined,
        startedAt: item.startedAt || undefined,
        completedAt: item.completedAt || undefined,
        durationMs: item.durationMs || undefined,
        documentCount: item._count.documents,
        errorMessage: item.errorDetails
          ? (item.errorDetails as any).message
          : undefined,
      })),
      total,
    }
  }

  // 獲取執行詳情
  async getExecutionDetail(id: string): Promise<ExecutionDetail | null> {
    const execution = await prisma.workflowExecution.findUnique({
      where: { id },
      include: {
        documents: {
          select: {
            id: true,
            fileName: true,
            status: true,
          },
        },
        steps: {
          orderBy: { stepNumber: 'asc' },
        },
      },
    })

    if (!execution) return null

    return {
      id: execution.id,
      n8nExecutionId: execution.n8nExecutionId || undefined,
      workflowId: execution.workflowId || undefined,
      workflowName: execution.workflowName,
      triggerType: execution.triggerType,
      triggerSource: execution.triggerSource || undefined,
      triggeredBy: execution.triggeredBy || undefined,
      cityCode: execution.cityCode,
      status: execution.status,
      progress: execution.progress,
      currentStep: execution.currentStep || undefined,
      startedAt: execution.startedAt || undefined,
      completedAt: execution.completedAt || undefined,
      durationMs: execution.durationMs || undefined,
      documentCount: execution.documents.length,
      result: execution.result as Record<string, any> | undefined,
      errorDetails: execution.errorDetails as Record<string, any> | undefined,
      errorMessage: execution.errorDetails
        ? (execution.errorDetails as any).message
        : undefined,
      steps: execution.steps.map((step) => ({
        stepNumber: step.stepNumber,
        stepName: step.stepName,
        stepType: step.stepType || undefined,
        status: step.status,
        durationMs: step.durationMs || undefined,
        errorMessage: step.errorMessage || undefined,
      })),
      documents: execution.documents,
    }
  }

  // 獲取執行統計
  async getExecutionStats(options: {
    cityCode?: string
    startDate?: Date
    endDate?: Date
  }): Promise<{
    total: number
    byStatus: Record<string, number>
    byTriggerType: Record<string, number>
    avgDurationMs: number
    successRate: number
  }> {
    const { cityCode, startDate, endDate } = options

    const where: any = {}
    if (cityCode) where.cityCode = cityCode
    if (startDate || endDate) {
      where.startedAt = {}
      if (startDate) where.startedAt.gte = startDate
      if (endDate) where.startedAt.lte = endDate
    }

    const [total, statusCounts, triggerTypeCounts, avgDuration] = await Promise.all([
      prisma.workflowExecution.count({ where }),

      prisma.workflowExecution.groupBy({
        by: ['status'],
        where,
        _count: true,
      }),

      prisma.workflowExecution.groupBy({
        by: ['triggerType'],
        where,
        _count: true,
      }),

      prisma.workflowExecution.aggregate({
        where: {
          ...where,
          status: 'COMPLETED',
          durationMs: { not: null },
        },
        _avg: {
          durationMs: true,
        },
      }),
    ])

    const byStatus: Record<string, number> = {}
    statusCounts.forEach((item) => {
      byStatus[item.status] = item._count
    })

    const byTriggerType: Record<string, number> = {}
    triggerTypeCounts.forEach((item) => {
      byTriggerType[item.triggerType] = item._count
    })

    const completed = byStatus['COMPLETED'] || 0
    const failed = byStatus['FAILED'] || 0
    const successRate = completed + failed > 0
      ? (completed / (completed + failed)) * 100
      : 0

    return {
      total,
      byStatus,
      byTriggerType,
      avgDurationMs: avgDuration._avg.durationMs || 0,
      successRate,
    }
  }

  // 更新執行狀態（從 n8n Webhook 調用）
  async updateExecutionStatus(
    n8nExecutionId: string,
    status: WorkflowExecutionStatus,
    data?: {
      progress?: number
      currentStep?: string
      result?: Record<string, any>
      errorDetails?: Record<string, any>
    }
  ): Promise<WorkflowExecution | null> {
    const execution = await prisma.workflowExecution.findUnique({
      where: { n8nExecutionId },
    })

    if (!execution) return null

    const updateData: any = {
      status,
      updatedAt: new Date(),
    }

    if (data?.progress !== undefined) updateData.progress = data.progress
    if (data?.currentStep !== undefined) updateData.currentStep = data.currentStep
    if (data?.result !== undefined) updateData.result = data.result
    if (data?.errorDetails !== undefined) updateData.errorDetails = data.errorDetails

    // 根據狀態更新時間
    if (status === 'RUNNING' && !execution.startedAt) {
      updateData.startedAt = new Date()
    }

    if (['COMPLETED', 'FAILED', 'CANCELLED', 'TIMEOUT'].includes(status)) {
      updateData.completedAt = new Date()
      if (execution.startedAt) {
        updateData.durationMs = Date.now() - execution.startedAt.getTime()
      }
    }

    return prisma.workflowExecution.update({
      where: { n8nExecutionId },
      data: updateData,
    })
  }

  // 獲取執行中的工作流（用於即時更新）
  async getRunningExecutions(cityCode?: string): Promise<ExecutionSummary[]> {
    const executions = await prisma.workflowExecution.findMany({
      where: {
        status: { in: ['PENDING', 'QUEUED', 'RUNNING'] },
        ...(cityCode ? { cityCode } : {}),
      },
      orderBy: { startedAt: 'desc' },
      include: {
        _count: {
          select: { documents: true },
        },
      },
    })

    return executions.map((item) => ({
      id: item.id,
      workflowName: item.workflowName,
      triggerType: item.triggerType,
      triggerSource: item.triggerSource || undefined,
      status: item.status,
      progress: item.progress,
      currentStep: item.currentStep || undefined,
      startedAt: item.startedAt || undefined,
      completedAt: item.completedAt || undefined,
      durationMs: item.durationMs || undefined,
      documentCount: item._count.documents,
    }))
  }
}

export const workflowExecutionService = new WorkflowExecutionService()
```

### 3. API 路由實現

```typescript
// app/api/workflow-executions/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { workflowExecutionService } from '@/lib/services/n8n/workflowExecutionService'
import { getUserCityAccess } from '@/lib/utils/permissions'

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const searchParams = request.nextUrl.searchParams

  // 獲取用戶可訪問的城市
  const userCities = await getUserCityAccess(session.user)
  const requestedCity = searchParams.get('cityCode')

  // 驗證城市權限
  let cityCode: string | undefined
  if (requestedCity) {
    if (!userCities.includes(requestedCity) && !userCities.includes('*')) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }
    cityCode = requestedCity
  } else if (!userCities.includes('*')) {
    cityCode = userCities[0] // 預設使用第一個可訪問城市
  }

  const options = {
    cityCode,
    status: searchParams.get('status') as any,
    workflowName: searchParams.get('workflowName') || undefined,
    triggerType: searchParams.get('triggerType') as any,
    startDate: searchParams.get('startDate')
      ? new Date(searchParams.get('startDate')!)
      : undefined,
    endDate: searchParams.get('endDate')
      ? new Date(searchParams.get('endDate')!)
      : undefined,
    page: parseInt(searchParams.get('page') || '1'),
    pageSize: parseInt(searchParams.get('pageSize') || '20'),
    orderBy: (searchParams.get('orderBy') || 'startedAt') as any,
    orderDirection: (searchParams.get('orderDirection') || 'desc') as any,
  }

  try {
    const result = await workflowExecutionService.listExecutions(options)

    return NextResponse.json({
      data: result.items,
      pagination: {
        page: options.page,
        pageSize: options.pageSize,
        total: result.total,
        totalPages: Math.ceil(result.total / options.pageSize!),
      },
    })
  } catch (error) {
    console.error('List workflow executions error:', error)
    return NextResponse.json(
      { error: 'Failed to list workflow executions' },
      { status: 500 }
    )
  }
}
```

```typescript
// app/api/workflow-executions/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { workflowExecutionService } from '@/lib/services/n8n/workflowExecutionService'
import { getUserCityAccess } from '@/lib/utils/permissions'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const execution = await workflowExecutionService.getExecutionDetail(params.id)

    if (!execution) {
      return NextResponse.json({ error: 'Execution not found' }, { status: 404 })
    }

    // 驗證城市權限
    const userCities = await getUserCityAccess(session.user)
    if (!userCities.includes(execution.cityCode) && !userCities.includes('*')) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    return NextResponse.json({ data: execution })
  } catch (error) {
    console.error('Get workflow execution error:', error)
    return NextResponse.json(
      { error: 'Failed to get workflow execution' },
      { status: 500 }
    )
  }
}
```

```typescript
// app/api/workflow-executions/running/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { workflowExecutionService } from '@/lib/services/n8n/workflowExecutionService'
import { getUserCityAccess } from '@/lib/utils/permissions'

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const searchParams = request.nextUrl.searchParams
  const userCities = await getUserCityAccess(session.user)
  const requestedCity = searchParams.get('cityCode')

  let cityCode: string | undefined
  if (requestedCity) {
    if (!userCities.includes(requestedCity) && !userCities.includes('*')) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }
    cityCode = requestedCity
  }

  try {
    const executions = await workflowExecutionService.getRunningExecutions(cityCode)

    return NextResponse.json({ data: executions })
  } catch (error) {
    console.error('Get running executions error:', error)
    return NextResponse.json(
      { error: 'Failed to get running executions' },
      { status: 500 }
    )
  }
}
```

### 4. React 組件

```typescript
// components/workflow/WorkflowExecutionList.tsx
'use client'

import React, { useState, useEffect } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  IconButton,
  Tooltip,
  Box,
  Typography,
  LinearProgress,
  TablePagination,
} from '@mui/material'
import {
  Visibility,
  CheckCircle,
  Error,
  Schedule,
  PlayArrow,
  Cancel,
  Timer,
} from '@mui/icons-material'
import { formatDistanceToNow, format } from 'date-fns'
import { zhTW } from 'date-fns/locale'
import Link from 'next/link'

interface ExecutionSummary {
  id: string
  workflowName: string
  triggerType: string
  triggerSource?: string
  status: string
  progress: number
  currentStep?: string
  startedAt?: Date
  completedAt?: Date
  durationMs?: number
  documentCount: number
  errorMessage?: string
}

interface WorkflowExecutionListProps {
  executions: ExecutionSummary[]
  total: number
  page: number
  pageSize: number
  onPageChange: (page: number) => void
  onPageSizeChange: (pageSize: number) => void
  loading?: boolean
}

const statusConfig: Record<string, {
  label: string
  color: 'default' | 'primary' | 'success' | 'error' | 'warning'
  icon: React.ReactNode
}> = {
  PENDING: { label: '等待中', color: 'default', icon: <Schedule /> },
  QUEUED: { label: '已排隊', color: 'default', icon: <Schedule /> },
  RUNNING: { label: '執行中', color: 'primary', icon: <PlayArrow /> },
  COMPLETED: { label: '已完成', color: 'success', icon: <CheckCircle /> },
  FAILED: { label: '失敗', color: 'error', icon: <Error /> },
  CANCELLED: { label: '已取消', color: 'warning', icon: <Cancel /> },
  TIMEOUT: { label: '超時', color: 'error', icon: <Timer /> },
}

const triggerTypeLabels: Record<string, string> = {
  SCHEDULED: '排程',
  MANUAL: '手動',
  WEBHOOK: 'Webhook',
  DOCUMENT: '文件',
  EVENT: '事件',
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  if (ms < 3600000) return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`
  return `${Math.floor(ms / 3600000)}h ${Math.floor((ms % 3600000) / 60000)}m`
}

export function WorkflowExecutionList({
  executions,
  total,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  loading,
}: WorkflowExecutionListProps) {
  return (
    <Paper>
      <TableContainer>
        {loading && <LinearProgress />}
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>工作流</TableCell>
              <TableCell>觸發方式</TableCell>
              <TableCell>狀態</TableCell>
              <TableCell>進度</TableCell>
              <TableCell>開始時間</TableCell>
              <TableCell>耗時</TableCell>
              <TableCell>文件數</TableCell>
              <TableCell align="right">操作</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {executions.map((execution) => {
              const status = statusConfig[execution.status] || statusConfig.PENDING

              return (
                <TableRow key={execution.id}>
                  <TableCell>
                    <Typography variant="body2" fontWeight="medium">
                      {execution.workflowName}
                    </Typography>
                    {execution.triggerSource && (
                      <Typography variant="caption" color="text.secondary">
                        {execution.triggerSource}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={triggerTypeLabels[execution.triggerType] || execution.triggerType}
                      size="small"
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell>
                    <Chip
                      icon={status.icon as React.ReactElement}
                      label={status.label}
                      color={status.color}
                      size="small"
                    />
                    {execution.status === 'FAILED' && execution.errorMessage && (
                      <Tooltip title={execution.errorMessage}>
                        <Typography
                          variant="caption"
                          color="error"
                          sx={{
                            display: 'block',
                            maxWidth: 200,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {execution.errorMessage}
                        </Typography>
                      </Tooltip>
                    )}
                  </TableCell>
                  <TableCell>
                    {execution.status === 'RUNNING' ? (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Box sx={{ flex: 1, minWidth: 100 }}>
                          <LinearProgress
                            variant="determinate"
                            value={execution.progress}
                          />
                        </Box>
                        <Typography variant="caption">
                          {execution.progress}%
                        </Typography>
                      </Box>
                    ) : execution.status === 'COMPLETED' ? (
                      <Typography variant="body2" color="success.main">
                        100%
                      </Typography>
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        -
                      </Typography>
                    )}
                    {execution.currentStep && (
                      <Typography variant="caption" color="text.secondary" display="block">
                        {execution.currentStep}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    {execution.startedAt ? (
                      <Tooltip title={format(new Date(execution.startedAt), 'PPpp', { locale: zhTW })}>
                        <Typography variant="body2">
                          {formatDistanceToNow(new Date(execution.startedAt), {
                            addSuffix: true,
                            locale: zhTW,
                          })}
                        </Typography>
                      </Tooltip>
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        -
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    {execution.durationMs ? (
                      <Typography variant="body2">
                        {formatDuration(execution.durationMs)}
                      </Typography>
                    ) : execution.status === 'RUNNING' && execution.startedAt ? (
                      <RunningTimer startedAt={new Date(execution.startedAt)} />
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        -
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={execution.documentCount}
                      size="small"
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title="查看詳情">
                      <IconButton
                        component={Link}
                        href={`/workflow-monitor/${execution.id}`}
                        size="small"
                      >
                        <Visibility />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              )
            })}

            {executions.length === 0 && !loading && (
              <TableRow>
                <TableCell colSpan={8} align="center">
                  <Typography color="text.secondary" sx={{ py: 4 }}>
                    沒有找到工作流執行記錄
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <TablePagination
        component="div"
        count={total}
        page={page - 1}
        onPageChange={(_, newPage) => onPageChange(newPage + 1)}
        rowsPerPage={pageSize}
        onRowsPerPageChange={(e) => onPageSizeChange(parseInt(e.target.value))}
        rowsPerPageOptions={[10, 20, 50, 100]}
        labelRowsPerPage="每頁筆數"
        labelDisplayedRows={({ from, to, count }) =>
          `${from}-${to} / 共 ${count} 筆`
        }
      />
    </Paper>
  )
}

// 執行中計時器組件
function RunningTimer({ startedAt }: { startedAt: Date }) {
  const [elapsed, setElapsed] = useState(Date.now() - startedAt.getTime())

  useEffect(() => {
    const timer = setInterval(() => {
      setElapsed(Date.now() - startedAt.getTime())
    }, 1000)

    return () => clearInterval(timer)
  }, [startedAt])

  return (
    <Typography variant="body2" color="primary">
      {formatDuration(elapsed)}
    </Typography>
  )
}
```

```typescript
// components/workflow/WorkflowExecutionFilters.tsx
'use client'

import React from 'react'
import {
  Box,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Button,
  Chip,
} from '@mui/material'
import { DatePicker } from '@mui/x-date-pickers'
import { FilterList, Clear } from '@mui/icons-material'

interface FilterValues {
  status?: string
  triggerType?: string
  workflowName?: string
  startDate?: Date | null
  endDate?: Date | null
}

interface WorkflowExecutionFiltersProps {
  values: FilterValues
  onChange: (values: FilterValues) => void
  onClear: () => void
}

export function WorkflowExecutionFilters({
  values,
  onChange,
  onClear,
}: WorkflowExecutionFiltersProps) {
  const hasFilters = Object.values(values).some(v => v !== undefined && v !== null && v !== '')

  return (
    <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center', mb: 3 }}>
      <FormControl size="small" sx={{ minWidth: 120 }}>
        <InputLabel>狀態</InputLabel>
        <Select
          value={values.status || ''}
          label="狀態"
          onChange={(e) => onChange({ ...values, status: e.target.value || undefined })}
        >
          <MenuItem value="">全部</MenuItem>
          <MenuItem value="PENDING">等待中</MenuItem>
          <MenuItem value="RUNNING">執行中</MenuItem>
          <MenuItem value="COMPLETED">已完成</MenuItem>
          <MenuItem value="FAILED">失敗</MenuItem>
          <MenuItem value="CANCELLED">已取消</MenuItem>
        </Select>
      </FormControl>

      <FormControl size="small" sx={{ minWidth: 120 }}>
        <InputLabel>觸發方式</InputLabel>
        <Select
          value={values.triggerType || ''}
          label="觸發方式"
          onChange={(e) => onChange({ ...values, triggerType: e.target.value || undefined })}
        >
          <MenuItem value="">全部</MenuItem>
          <MenuItem value="SCHEDULED">排程</MenuItem>
          <MenuItem value="MANUAL">手動</MenuItem>
          <MenuItem value="WEBHOOK">Webhook</MenuItem>
          <MenuItem value="DOCUMENT">文件</MenuItem>
        </Select>
      </FormControl>

      <TextField
        size="small"
        label="工作流名稱"
        value={values.workflowName || ''}
        onChange={(e) => onChange({ ...values, workflowName: e.target.value || undefined })}
        sx={{ minWidth: 150 }}
      />

      <DatePicker
        label="開始日期"
        value={values.startDate || null}
        onChange={(date) => onChange({ ...values, startDate: date })}
        slotProps={{ textField: { size: 'small' } }}
      />

      <DatePicker
        label="結束日期"
        value={values.endDate || null}
        onChange={(date) => onChange({ ...values, endDate: date })}
        slotProps={{ textField: { size: 'small' } }}
      />

      {hasFilters && (
        <Button
          startIcon={<Clear />}
          onClick={onClear}
          size="small"
        >
          清除篩選
        </Button>
      )}
    </Box>
  )
}
```

```typescript
// hooks/useWorkflowExecutions.ts
import { useState, useEffect, useCallback } from 'react'
import useSWR from 'swr'

interface UseWorkflowExecutionsOptions {
  cityCode?: string
  status?: string
  triggerType?: string
  workflowName?: string
  startDate?: Date
  endDate?: Date
  page?: number
  pageSize?: number
  autoRefresh?: boolean
  refreshInterval?: number
}

export function useWorkflowExecutions(options: UseWorkflowExecutionsOptions = {}) {
  const {
    autoRefresh = false,
    refreshInterval = 5000,
    ...filterOptions
  } = options

  // 構建查詢參數
  const buildQueryString = useCallback(() => {
    const params = new URLSearchParams()

    if (filterOptions.cityCode) params.set('cityCode', filterOptions.cityCode)
    if (filterOptions.status) params.set('status', filterOptions.status)
    if (filterOptions.triggerType) params.set('triggerType', filterOptions.triggerType)
    if (filterOptions.workflowName) params.set('workflowName', filterOptions.workflowName)
    if (filterOptions.startDate) params.set('startDate', filterOptions.startDate.toISOString())
    if (filterOptions.endDate) params.set('endDate', filterOptions.endDate.toISOString())
    if (filterOptions.page) params.set('page', filterOptions.page.toString())
    if (filterOptions.pageSize) params.set('pageSize', filterOptions.pageSize.toString())

    return params.toString()
  }, [filterOptions])

  const { data, error, isLoading, mutate } = useSWR(
    `/api/workflow-executions?${buildQueryString()}`,
    async (url) => {
      const res = await fetch(url)
      if (!res.ok) throw new Error('Failed to fetch')
      return res.json()
    },
    {
      refreshInterval: autoRefresh ? refreshInterval : 0,
    }
  )

  return {
    executions: data?.data || [],
    pagination: data?.pagination || { page: 1, pageSize: 20, total: 0, totalPages: 0 },
    isLoading,
    error,
    refresh: mutate,
  }
}

// Hook for running executions (for real-time updates)
export function useRunningExecutions(cityCode?: string) {
  const { data, error, isLoading } = useSWR(
    `/api/workflow-executions/running${cityCode ? `?cityCode=${cityCode}` : ''}`,
    async (url) => {
      const res = await fetch(url)
      if (!res.ok) throw new Error('Failed to fetch')
      return res.json()
    },
    {
      refreshInterval: 3000, // 每 3 秒更新
    }
  )

  return {
    runningExecutions: data?.data || [],
    isLoading,
    error,
  }
}
```

## 測試案例

### 單元測試

```typescript
// __tests__/services/n8n/workflowExecutionService.test.ts
import { workflowExecutionService } from '@/lib/services/n8n/workflowExecutionService'
import { prismaMock } from '@/lib/__mocks__/prisma'

describe('WorkflowExecutionService', () => {
  describe('listExecutions', () => {
    it('should list executions with pagination', async () => {
      prismaMock.workflowExecution.findMany.mockResolvedValue([
        {
          id: 'exec-1',
          workflowName: 'Invoice Processing',
          triggerType: 'DOCUMENT',
          status: 'COMPLETED',
          progress: 100,
          startedAt: new Date(),
          completedAt: new Date(),
          durationMs: 5000,
          _count: { documents: 3 },
        },
      ] as any)

      prismaMock.workflowExecution.count.mockResolvedValue(1)

      const result = await workflowExecutionService.listExecutions({
        page: 1,
        pageSize: 20,
      })

      expect(result.items).toHaveLength(1)
      expect(result.total).toBe(1)
      expect(result.items[0].documentCount).toBe(3)
    })

    it('should filter by status', async () => {
      prismaMock.workflowExecution.findMany.mockResolvedValue([])
      prismaMock.workflowExecution.count.mockResolvedValue(0)

      await workflowExecutionService.listExecutions({
        status: 'RUNNING',
      })

      expect(prismaMock.workflowExecution.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'RUNNING',
          }),
        })
      )
    })
  })

  describe('updateExecutionStatus', () => {
    it('should update status and calculate duration on completion', async () => {
      const startedAt = new Date(Date.now() - 10000)

      prismaMock.workflowExecution.findUnique.mockResolvedValue({
        id: 'exec-1',
        n8nExecutionId: 'n8n-exec-1',
        startedAt,
        status: 'RUNNING',
      } as any)

      prismaMock.workflowExecution.update.mockResolvedValue({} as any)

      await workflowExecutionService.updateExecutionStatus('n8n-exec-1', 'COMPLETED', {
        result: { success: true },
      })

      expect(prismaMock.workflowExecution.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'COMPLETED',
            completedAt: expect.any(Date),
            durationMs: expect.any(Number),
            result: { success: true },
          }),
        })
      )
    })
  })
})
```

## 部署注意事項

1. **即時更新策略**
   - 預設使用輪詢（每 3-5 秒）
   - 可選配置 WebSocket 以提升即時性

2. **性能優化**
   - 執行記錄建立適當索引
   - 考慮長期資料的歸檔策略

3. **監控指標**
   - 工作流執行成功率
   - 平均執行時間
   - 失敗原因分類

## 相依性

- Story 10-1: n8n 雙向通訊 API（狀態更新來源）
- Story 10-5: 工作流錯誤詳情查看（錯誤詳情展示）
- Story 10-6: 文件處理進度追蹤（關聯文件顯示）

---

## Implementation Notes

### 完成日期
2025-12-20

### 實際實現

#### 1. 資料模型更新 (Prisma Schema)
- 已在 Story 10-1 中創建 `WorkflowExecution` 模型
- 新增 `WorkflowExecutionStep` 模型用於追蹤執行步驟
- 新增枚舉：`WorkflowExecutionStatus`, `WorkflowTriggerType`, `StepExecutionStatus`

#### 2. 類型定義
- **文件**: `src/types/workflow-execution.ts`
- 包含：
  - `ListExecutionsOptions` - 查詢選項
  - `ExecutionSummary` - 列表摘要
  - `ExecutionDetail` - 完整詳情
  - `ExecutionStepSummary` - 步驟摘要
  - `ExecutionStats` - 統計資料
  - `ExecutionListResponse`, `ExecutionDetailResponse`, `RunningExecutionsResponse`, `ExecutionStatsResponse` - API 響應類型
  - `EXECUTION_STATUS_CONFIG`, `TRIGGER_TYPE_CONFIG` - 狀態顯示配置常數
  - 類型守衛函數：`isValidExecutionStatus`, `isValidTriggerType`, `isRunningExecution`, `isTerminalStatus`

#### 3. 服務層
- **文件**: `src/services/n8n/workflow-execution.service.ts`
- `WorkflowExecutionService` 類別提供：
  - `listExecutions()` - 分頁列表查詢
  - `getExecutionDetail()` - 詳情查詢
  - `getExecutionStats()` - 統計查詢
  - `getRunningExecutions()` - 執行中工作流查詢
  - `updateExecutionStatus()` - 狀態更新（供 Webhook 調用）

#### 4. API 路由
| 端點 | 方法 | 功能 |
|------|------|------|
| `/api/workflow-executions` | GET | 列表查詢（分頁、篩選、排序） |
| `/api/workflow-executions/[id]` | GET | 詳情查詢 |
| `/api/workflow-executions/running` | GET | 執行中工作流（用於輪詢） |
| `/api/workflow-executions/stats` | GET | 執行統計 |

所有 API 都使用 `withCityFilter` 中間件實現城市數據隔離。

#### 5. React Query Hooks
- **文件**: `src/hooks/useWorkflowExecutions.ts`
- Hooks：
  - `useWorkflowExecutions()` - 列表查詢
  - `useWorkflowExecutionDetail()` - 詳情查詢
  - `useRunningExecutions()` - 執行中工作流（支援輪詢，預設 5 秒）
  - `useExecutionStats()` - 統計查詢
  - `useRefreshWorkflowExecutions()` - 手動刷新

#### 6. 導出更新
- `src/types/index.ts` - 新增 workflow-execution 導出
- `src/services/n8n/index.ts` - 新增 WorkflowExecutionService 導出
- `src/hooks/index.ts` - 新增 useWorkflowExecutions hooks 導出

### 技術決策

1. **使用 React Query 替代 SWR**
   - 專案已統一使用 React Query
   - 更好的 TypeScript 支援
   - 更豐富的快取控制選項

2. **輪詢策略**
   - 使用 `refetchInterval` 實現實時更新
   - 預設 5 秒間隔（可配置）
   - 當工作流完成後自動停止輪詢

3. **城市數據隔離**
   - 所有 API 使用 `withCityFilter` 中間件
   - 全域管理員可查看所有城市
   - 普通用戶只能查看授權城市

### 與設計文件差異

1. **UI 組件**
   - Story 文件中的 React 組件範例使用 MUI
   - 實際專案使用 shadcn/ui
   - UI 組件將在後續整合時實現

2. **服務層位置**
   - 設計文件：`lib/services/n8n/`
   - 實際實現：`src/services/n8n/`

### 待後續實現

- 前端 UI 組件（WorkflowExecutionList, WorkflowExecutionFilters）
- 工作流監控頁面 (`/workflow-monitor`)
- WebSocket 實時更新（可選優化）
