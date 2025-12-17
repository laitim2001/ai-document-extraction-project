# Tech Spec: Story 10-5 工作流錯誤詳情檢視

## 1. 概述

### Story 資訊
- **Story ID**: 10-5
- **標題**: 工作流錯誤詳情查看
- **Epic**: 10 - n8n 工作流整合
- **功能需求**: FR57 (錯誤診斷)
- **優先級**: Medium
- **故事點數**: 5
- **相關 Stories**: Story 10-3, 10-4, 10-7

### 目標
實現完整的工作流錯誤診斷系統，讓用戶能夠：
- 查看詳細的錯誤資訊和分類
- 展開技術細節（堆疊追蹤、HTTP 請求/回應）
- 判斷錯誤是否可恢復並進行重試
- 跳轉至 n8n 進行進一步調查

### 相依性
- **前置**:
  - Story 10-3 (工作流執行狀態查看)
  - Story 10-4 (手動觸發工作流 - 重試功能)
- **後置**: Story 10-7 (n8n 連接狀態監控)

---

## 2. 資料庫設計

### 2.1 錯誤類型枚舉

```prisma
// 錯誤分類枚舉（邏輯層使用，不需要資料庫遷移）
// 儲存在 WorkflowExecution.errorDetails JSON 欄位中

// 錯誤類型定義
enum WorkflowErrorType {
  CONNECTION_ERROR      // 連線失敗（網路問題、服務不可達）
  TIMEOUT_ERROR         // 逾時（請求超時、處理超時）
  AUTHENTICATION_ERROR  // 認證錯誤（API Key 無效、Token 過期）
  VALIDATION_ERROR      // 資料驗證錯誤（格式錯誤、必填欄位缺失）
  BUSINESS_ERROR        // 業務邏輯錯誤（規則驗證失敗）
  SYSTEM_ERROR          // 系統錯誤（內部錯誤、未預期異常）
  EXTERNAL_ERROR        // 外部服務錯誤（第三方 API 錯誤）
  UNKNOWN_ERROR         // 未知錯誤
}
```

### 2.2 ErrorDetails JSON 結構

```typescript
// WorkflowExecution.errorDetails 欄位的 JSON 結構
interface ErrorDetailsSchema {
  // 基本資訊（必填）
  type: WorkflowErrorType
  message: string
  timestamp: string  // ISO 8601 格式

  // 錯誤位置
  failedStep?: {
    stepNumber: number
    stepName: string
    stepType: string  // n8n 節點類型
  }

  // 技術詳情
  technical?: {
    stackTrace?: string
    errorCode?: string
    originalError?: string
  }

  // HTTP 詳情（如果是 HTTP 相關錯誤）
  http?: {
    requestUrl?: string
    requestMethod?: string
    requestHeaders?: Record<string, string>  // 敏感資訊會被遮蔽
    requestBody?: unknown
    responseStatus?: number
    responseHeaders?: Record<string, string>
    responseBody?: unknown
  }

  // n8n 相關資訊
  n8n?: {
    executionId?: string
    workflowId?: string
    nodeId?: string
    nodeName?: string
    errorOutput?: unknown
  }

  // 上下文資訊
  context?: {
    documentIds?: string[]
    parameters?: Record<string, unknown>
    triggeredBy?: string
    cityCode?: string
  }

  // 可恢復性
  recoverable: boolean
  recoveryHint?: string

  // 觸發階段
  stage?: 'trigger' | 'execution' | 'callback' | 'unknown'
}
```

### 2.3 系統配置表（用於 n8n URL）

```prisma
// 系統配置（如果尚未存在）
model SystemConfig {
  id        String   @id @default(cuid())
  key       String   @unique
  value     String
  category  String   @default("general")
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([category])
}
```

---

## 3. 類型定義

### 3.1 錯誤詳情類型

```typescript
// lib/types/workflow-error.ts

// ===========================================
// 錯誤類型
// ===========================================
export type WorkflowErrorType =
  | 'CONNECTION_ERROR'
  | 'TIMEOUT_ERROR'
  | 'AUTHENTICATION_ERROR'
  | 'VALIDATION_ERROR'
  | 'BUSINESS_ERROR'
  | 'SYSTEM_ERROR'
  | 'EXTERNAL_ERROR'
  | 'UNKNOWN_ERROR'

// ===========================================
// 錯誤觸發階段
// ===========================================
export type ErrorStage =
  | 'trigger'
  | 'execution'
  | 'callback'
  | 'unknown'

// ===========================================
// 失敗步驟資訊
// ===========================================
export interface FailedStepInfo {
  stepNumber: number
  stepName: string
  stepType: string
}

// ===========================================
// 技術詳情
// ===========================================
export interface TechnicalDetails {
  stackTrace?: string
  errorCode?: string
  originalError?: string
}

// ===========================================
// HTTP 詳情
// ===========================================
export interface HttpDetails {
  requestUrl?: string
  requestMethod?: string
  requestHeaders?: Record<string, string>
  requestBody?: unknown
  responseStatus?: number
  responseHeaders?: Record<string, string>
  responseBody?: unknown
}

// ===========================================
// n8n 詳情
// ===========================================
export interface N8nDetails {
  executionId?: string
  workflowId?: string
  nodeId?: string
  nodeName?: string
  errorOutput?: unknown
}

// ===========================================
// 上下文資訊
// ===========================================
export interface ErrorContext {
  documentIds?: string[]
  parameters?: Record<string, unknown>
  triggeredBy?: string
  cityCode?: string
}

// ===========================================
// 完整錯誤詳情
// ===========================================
export interface WorkflowErrorDetails {
  type: WorkflowErrorType
  message: string
  timestamp: string
  failedStep?: FailedStepInfo
  technical?: TechnicalDetails
  http?: HttpDetails
  n8n?: N8nDetails
  context?: ErrorContext
  recoverable: boolean
  recoveryHint?: string
  stage?: ErrorStage
}

// ===========================================
// 錯誤詳情 API 回應
// ===========================================
export interface ErrorDetailResponse {
  execution: {
    id: string
    workflowName: string
    status: string
    startedAt?: string
    completedAt?: string
    durationMs?: number
  }
  error: WorkflowErrorDetails
  documents: Array<{
    id: string
    fileName: string
    status: string
  }>
  canRetry: boolean
  n8nUrl?: string
}

// ===========================================
// 錯誤統計
// ===========================================
export interface ErrorStatistics {
  byType: Record<WorkflowErrorType, number>
  byStep: Record<string, number>
  recoverableRate: number
  totalErrors: number
}

// ===========================================
// 錯誤類型配置
// ===========================================
export interface ErrorTypeConfig {
  label: string
  color: 'error' | 'warning' | 'info'
  icon: string
  recoverable: boolean
  defaultHint: string
}
```

### 3.2 錯誤類型配置

```typescript
// lib/constants/error-types.ts
import type { WorkflowErrorType, ErrorTypeConfig } from '@/lib/types/workflow-error'

export const ERROR_TYPE_CONFIG: Record<WorkflowErrorType, ErrorTypeConfig> = {
  CONNECTION_ERROR: {
    label: '連線失敗',
    color: 'error',
    icon: 'WifiOff',
    recoverable: true,
    defaultHint: '請檢查網路連線和 n8n 服務狀態後重試',
  },
  TIMEOUT_ERROR: {
    label: '逾時',
    color: 'warning',
    icon: 'Timer',
    recoverable: true,
    defaultHint: '操作逾時，請稍後重試或檢查目標服務回應時間',
  },
  AUTHENTICATION_ERROR: {
    label: '認證錯誤',
    color: 'error',
    icon: 'Lock',
    recoverable: false,
    defaultHint: '請檢查 API Key 或認證設定是否正確',
  },
  VALIDATION_ERROR: {
    label: '驗證錯誤',
    color: 'warning',
    icon: 'Warning',
    recoverable: false,
    defaultHint: '請檢查輸入資料格式是否正確',
  },
  BUSINESS_ERROR: {
    label: '業務錯誤',
    color: 'warning',
    icon: 'Info',
    recoverable: false,
    defaultHint: '請根據錯誤訊息修正業務資料',
  },
  SYSTEM_ERROR: {
    label: '系統錯誤',
    color: 'error',
    icon: 'Error',
    recoverable: false,
    defaultHint: '系統內部錯誤，請聯繫技術支援',
  },
  EXTERNAL_ERROR: {
    label: '外部服務錯誤',
    color: 'error',
    icon: 'Cloud',
    recoverable: true,
    defaultHint: '外部服務錯誤，請稍後重試',
  },
  UNKNOWN_ERROR: {
    label: '未知錯誤',
    color: 'error',
    icon: 'Help',
    recoverable: false,
    defaultHint: '發生未知錯誤，請聯繫技術支援',
  },
}

// 敏感 HTTP 標頭列表
export const SENSITIVE_HEADERS = [
  'authorization',
  'x-api-key',
  'cookie',
  'set-cookie',
  'x-auth-token',
  'x-access-token',
]
```

---

## 4. 服務實現

### 4.1 WorkflowErrorService

```typescript
// lib/services/n8n/workflowErrorService.ts
import { prisma } from '@/lib/prisma'
import { ERROR_TYPE_CONFIG, SENSITIVE_HEADERS } from '@/lib/constants/error-types'
import type {
  WorkflowErrorDetails,
  WorkflowErrorType,
  ErrorDetailResponse,
  ErrorStatistics,
  HttpDetails,
} from '@/lib/types/workflow-error'

export class WorkflowErrorService {
  // ===========================================
  // 獲取錯誤詳情
  // ===========================================
  async getErrorDetail(executionId: string): Promise<ErrorDetailResponse | null> {
    const execution = await prisma.workflowExecution.findUnique({
      where: { id: executionId },
      include: {
        documents: {
          select: {
            id: true,
            fileName: true,
            status: true,
          },
        },
      },
    })

    if (!execution) return null

    // 只處理失敗狀態
    if (execution.status !== 'FAILED' && execution.status !== 'TIMEOUT') {
      return null
    }

    const errorDetails = this.parseErrorDetails(execution.errorDetails)
    const n8nUrl = await this.buildN8nUrl(execution.n8nExecutionId)

    return {
      execution: {
        id: execution.id,
        workflowName: execution.workflowName,
        status: execution.status,
        startedAt: execution.startedAt?.toISOString(),
        completedAt: execution.completedAt?.toISOString(),
        durationMs: execution.durationMs ?? undefined,
      },
      error: errorDetails,
      documents: execution.documents,
      canRetry: errorDetails.recoverable,
      n8nUrl,
    }
  }

  // ===========================================
  // 解析錯誤詳情
  // ===========================================
  parseErrorDetails(rawDetails: unknown): WorkflowErrorDetails {
    if (!rawDetails || typeof rawDetails !== 'object') {
      return this.createDefaultError()
    }

    const details = rawDetails as Partial<WorkflowErrorDetails>
    const errorType = this.classifyError(details)

    return {
      type: errorType,
      message: details.message || 'Unknown error',
      timestamp: details.timestamp || new Date().toISOString(),
      failedStep: details.failedStep,
      technical: details.technical,
      http: this.sanitizeHttpDetails(details.http),
      n8n: details.n8n,
      context: details.context,
      recoverable: details.recoverable ?? this.isRecoverable(errorType),
      recoveryHint: details.recoveryHint ?? ERROR_TYPE_CONFIG[errorType].defaultHint,
      stage: details.stage ?? 'unknown',
    }
  }

  // ===========================================
  // 錯誤分類
  // ===========================================
  private classifyError(details: Partial<WorkflowErrorDetails>): WorkflowErrorType {
    // 如果已經有類型，直接使用
    if (details.type && details.type in ERROR_TYPE_CONFIG) {
      return details.type
    }

    const message = (details.message || '').toLowerCase()
    const errorCode = details.technical?.errorCode?.toLowerCase() || ''

    // 逾時錯誤
    if (
      message.includes('timeout') ||
      message.includes('timed out') ||
      errorCode.includes('timeout')
    ) {
      return 'TIMEOUT_ERROR'
    }

    // 連線錯誤
    if (
      message.includes('connection') ||
      message.includes('network') ||
      message.includes('econnrefused') ||
      message.includes('enotfound') ||
      message.includes('ehostunreach')
    ) {
      return 'CONNECTION_ERROR'
    }

    // 認證錯誤
    if (
      message.includes('unauthorized') ||
      message.includes('authentication') ||
      message.includes('forbidden') ||
      message.includes('401') ||
      message.includes('403')
    ) {
      return 'AUTHENTICATION_ERROR'
    }

    // 驗證錯誤
    if (
      message.includes('validation') ||
      message.includes('invalid') ||
      message.includes('required') ||
      message.includes('400')
    ) {
      return 'VALIDATION_ERROR'
    }

    // 外部服務錯誤（HTTP 5xx）
    if (details.http?.responseStatus && details.http.responseStatus >= 500) {
      return 'EXTERNAL_ERROR'
    }

    // 業務錯誤（HTTP 4xx，但不是 400/401/403）
    if (
      details.http?.responseStatus &&
      details.http.responseStatus >= 400 &&
      details.http.responseStatus < 500
    ) {
      return 'BUSINESS_ERROR'
    }

    return 'UNKNOWN_ERROR'
  }

  // ===========================================
  // 判斷是否可恢復
  // ===========================================
  private isRecoverable(errorType: WorkflowErrorType): boolean {
    return ERROR_TYPE_CONFIG[errorType].recoverable
  }

  // ===========================================
  // 清理敏感 HTTP 資訊
  // ===========================================
  private sanitizeHttpDetails(http?: Partial<HttpDetails>): HttpDetails | undefined {
    if (!http) return undefined

    const sanitizedRequestHeaders = this.sanitizeHeaders(http.requestHeaders)
    const sanitizedResponseHeaders = this.sanitizeHeaders(http.responseHeaders)

    return {
      ...http,
      requestHeaders: sanitizedRequestHeaders,
      responseHeaders: sanitizedResponseHeaders,
    }
  }

  // ===========================================
  // 清理敏感標頭
  // ===========================================
  private sanitizeHeaders(
    headers?: Record<string, string>
  ): Record<string, string> | undefined {
    if (!headers) return undefined

    const sanitized = { ...headers }

    Object.keys(sanitized).forEach((key) => {
      if (SENSITIVE_HEADERS.includes(key.toLowerCase())) {
        sanitized[key] = '[REDACTED]'
      }
    })

    return sanitized
  }

  // ===========================================
  // 建立預設錯誤
  // ===========================================
  private createDefaultError(): WorkflowErrorDetails {
    return {
      type: 'UNKNOWN_ERROR',
      message: 'Unknown error occurred',
      timestamp: new Date().toISOString(),
      recoverable: false,
      recoveryHint: ERROR_TYPE_CONFIG.UNKNOWN_ERROR.defaultHint,
    }
  }

  // ===========================================
  // 構建 n8n URL
  // ===========================================
  private async buildN8nUrl(n8nExecutionId?: string | null): Promise<string | undefined> {
    if (!n8nExecutionId) return undefined

    try {
      const config = await prisma.systemConfig.findFirst({
        where: { key: 'n8n.baseUrl' },
      })

      if (!config?.value) return undefined

      const baseUrl = config.value.replace(/\/$/, '')
      return `${baseUrl}/execution/${n8nExecutionId}`
    } catch {
      return undefined
    }
  }

  // ===========================================
  // 獲取錯誤統計
  // ===========================================
  async getErrorStatistics(options: {
    cityCode?: string
    startDate?: Date
    endDate?: Date
  }): Promise<ErrorStatistics> {
    const { cityCode, startDate, endDate } = options

    const where: Record<string, unknown> = {
      status: { in: ['FAILED', 'TIMEOUT'] },
    }

    if (cityCode) where.cityCode = cityCode

    if (startDate || endDate) {
      where.completedAt = {}
      if (startDate) (where.completedAt as Record<string, Date>).gte = startDate
      if (endDate) (where.completedAt as Record<string, Date>).lte = endDate
    }

    const errors = await prisma.workflowExecution.findMany({
      where,
      select: {
        errorDetails: true,
      },
    })

    const byType: Record<WorkflowErrorType, number> = {
      CONNECTION_ERROR: 0,
      TIMEOUT_ERROR: 0,
      AUTHENTICATION_ERROR: 0,
      VALIDATION_ERROR: 0,
      BUSINESS_ERROR: 0,
      SYSTEM_ERROR: 0,
      EXTERNAL_ERROR: 0,
      UNKNOWN_ERROR: 0,
    }

    const byStep: Record<string, number> = {}
    let recoverableCount = 0

    errors.forEach((error) => {
      const details = this.parseErrorDetails(error.errorDetails)

      // 按類型統計
      byType[details.type] = (byType[details.type] || 0) + 1

      // 按步驟統計
      if (details.failedStep?.stepName) {
        byStep[details.failedStep.stepName] = (byStep[details.failedStep.stepName] || 0) + 1
      }

      // 可恢復統計
      if (details.recoverable) {
        recoverableCount++
      }
    })

    return {
      byType,
      byStep,
      recoverableRate: errors.length > 0
        ? Math.round((recoverableCount / errors.length) * 10000) / 100
        : 0,
      totalErrors: errors.length,
    }
  }

  // ===========================================
  // 儲存錯誤詳情
  // ===========================================
  createErrorDetails(options: {
    message: string
    type?: WorkflowErrorType
    stage?: 'trigger' | 'execution' | 'callback'
    failedStep?: { stepNumber: number; stepName: string; stepType: string }
    technical?: { stackTrace?: string; errorCode?: string; originalError?: string }
    http?: HttpDetails
    n8n?: { executionId?: string; workflowId?: string; nodeName?: string }
    context?: { documentIds?: string[]; parameters?: Record<string, unknown>; triggeredBy?: string; cityCode?: string }
  }): WorkflowErrorDetails {
    const errorType = options.type ?? this.classifyError({ message: options.message })

    return {
      type: errorType,
      message: options.message,
      timestamp: new Date().toISOString(),
      stage: options.stage ?? 'unknown',
      failedStep: options.failedStep,
      technical: options.technical,
      http: this.sanitizeHttpDetails(options.http),
      n8n: options.n8n,
      context: options.context,
      recoverable: this.isRecoverable(errorType),
      recoveryHint: ERROR_TYPE_CONFIG[errorType].defaultHint,
    }
  }
}

// 單例導出
export const workflowErrorService = new WorkflowErrorService()
```

---

## 5. API 路由

### 5.1 錯誤詳情 API

```typescript
// app/api/workflow-executions/[id]/error/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { workflowErrorService } from '@/lib/services/n8n/workflowErrorService'
import { getUserCityAccess } from '@/lib/utils/permissions'
import { prisma } from '@/lib/prisma'

interface RouteParams {
  params: { id: string }
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    // 驗證身份
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized', code: 'UNAUTHORIZED' },
        { status: 401 }
      )
    }

    // 先獲取執行記錄以驗證權限
    const execution = await prisma.workflowExecution.findUnique({
      where: { id: params.id },
      select: { cityCode: true, status: true },
    })

    if (!execution) {
      return NextResponse.json(
        { error: 'Execution not found', code: 'NOT_FOUND' },
        { status: 404 }
      )
    }

    // 驗證城市權限
    const userCities = await getUserCityAccess(session.user)
    if (!userCities.includes(execution.cityCode) && !userCities.includes('*')) {
      return NextResponse.json(
        { error: 'Access denied', code: 'CITY_ACCESS_DENIED' },
        { status: 403 }
      )
    }

    // 檢查是否為失敗狀態
    if (execution.status !== 'FAILED' && execution.status !== 'TIMEOUT') {
      return NextResponse.json(
        { error: 'Execution is not in failed state', code: 'NOT_FAILED' },
        { status: 400 }
      )
    }

    // 獲取錯誤詳情
    const errorDetail = await workflowErrorService.getErrorDetail(params.id)

    if (!errorDetail) {
      return NextResponse.json(
        { error: 'No error details available', code: 'NO_ERROR_DETAILS' },
        { status: 404 }
      )
    }

    return NextResponse.json({ data: errorDetail })
  } catch (error) {
    console.error('Get error detail error:', error)
    return NextResponse.json(
      { error: 'Failed to get error details', code: 'GET_ERROR_FAILED' },
      { status: 500 }
    )
  }
}
```

### 5.2 錯誤統計 API

```typescript
// app/api/workflow-errors/statistics/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { workflowErrorService } from '@/lib/services/n8n/workflowErrorService'
import { getUserCityAccess, hasRole } from '@/lib/utils/permissions'
import { z } from 'zod'

const querySchema = z.object({
  cityCode: z.string().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
})

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized', code: 'UNAUTHORIZED' },
        { status: 401 }
      )
    }

    // 只有管理員可以查看統計
    if (!hasRole(session.user, 'ADMIN') && !hasRole(session.user, 'SUPER_USER')) {
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

    const { cityCode, startDate, endDate } = parseResult.data

    // 驗證城市權限
    if (cityCode) {
      const userCities = await getUserCityAccess(session.user)
      if (!userCities.includes(cityCode) && !userCities.includes('*')) {
        return NextResponse.json(
          { error: 'Access denied', code: 'CITY_ACCESS_DENIED' },
          { status: 403 }
        )
      }
    }

    const statistics = await workflowErrorService.getErrorStatistics({
      cityCode,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    })

    return NextResponse.json({ data: statistics })
  } catch (error) {
    console.error('Get error statistics error:', error)
    return NextResponse.json(
      { error: 'Failed to get error statistics', code: 'STATS_FAILED' },
      { status: 500 }
    )
  }
}
```

---

## 6. 前端組件

### 6.1 錯誤詳情組件

```typescript
// components/workflow/WorkflowErrorDetail.tsx
'use client'

import React, { useState } from 'react'
import {
  Box,
  Paper,
  Typography,
  Chip,
  Button,
  Divider,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableRow,
  IconButton,
  Tooltip,
  CircularProgress,
  Snackbar,
} from '@mui/material'
import {
  Error as ErrorIcon,
  Warning,
  Info,
  ExpandMore,
  Refresh,
  OpenInNew,
  ContentCopy,
  CheckCircle,
  WifiOff,
  Timer,
  Lock,
  Cloud,
  Help,
} from '@mui/icons-material'
import { format } from 'date-fns'
import { zhTW } from 'date-fns/locale'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'
import type { WorkflowErrorDetails, WorkflowErrorType } from '@/lib/types/workflow-error'

// ===========================================
// Props 類型
// ===========================================
interface WorkflowErrorDetailProps {
  executionId: string
  error: WorkflowErrorDetails
  execution: {
    workflowName: string
    startedAt?: string
    completedAt?: string
    durationMs?: number
  }
  documents: Array<{ id: string; fileName: string; status: string }>
  canRetry: boolean
  n8nUrl?: string
  onRetry: () => Promise<void>
}

// ===========================================
// 錯誤類型配置
// ===========================================
const errorTypeConfig: Record<WorkflowErrorType, {
  label: string
  color: 'error' | 'warning' | 'info'
  icon: React.ReactNode
}> = {
  CONNECTION_ERROR: { label: '連線失敗', color: 'error', icon: <WifiOff /> },
  TIMEOUT_ERROR: { label: '逾時', color: 'warning', icon: <Timer /> },
  AUTHENTICATION_ERROR: { label: '認證錯誤', color: 'error', icon: <Lock /> },
  VALIDATION_ERROR: { label: '驗證錯誤', color: 'warning', icon: <Warning /> },
  BUSINESS_ERROR: { label: '業務錯誤', color: 'warning', icon: <Info /> },
  SYSTEM_ERROR: { label: '系統錯誤', color: 'error', icon: <ErrorIcon /> },
  EXTERNAL_ERROR: { label: '外部服務錯誤', color: 'error', icon: <Cloud /> },
  UNKNOWN_ERROR: { label: '未知錯誤', color: 'error', icon: <Help /> },
}

// ===========================================
// 主組件
// ===========================================
export function WorkflowErrorDetail({
  executionId,
  error,
  execution,
  documents,
  canRetry,
  n8nUrl,
  onRetry,
}: WorkflowErrorDetailProps) {
  const [retrying, setRetrying] = useState(false)
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string }>({
    open: false,
    message: '',
  })

  const config = errorTypeConfig[error.type] || errorTypeConfig.UNKNOWN_ERROR

  // 重試處理
  const handleRetry = async () => {
    setRetrying(true)
    try {
      await onRetry()
      setSnackbar({ open: true, message: '已重新觸發工作流' })
    } catch (err) {
      setSnackbar({ open: true, message: '重試失敗，請稍後再試' })
    } finally {
      setRetrying(false)
    }
  }

  // 複製錯誤資訊
  const handleCopyError = async () => {
    const errorText = JSON.stringify({
      executionId,
      error: {
        type: error.type,
        message: error.message,
        timestamp: error.timestamp,
        failedStep: error.failedStep,
      },
    }, null, 2)

    await navigator.clipboard.writeText(errorText)
    setSnackbar({ open: true, message: '已複製錯誤資訊' })
  }

  return (
    <Paper sx={{ p: 3 }}>
      {/* 標題區 */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Chip
            icon={config.icon as React.ReactElement}
            label={config.label}
            color={config.color}
          />
          <Typography variant="h6">
            {execution.workflowName}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Tooltip title="複製錯誤資訊">
            <IconButton onClick={handleCopyError} size="small">
              <ContentCopy />
            </IconButton>
          </Tooltip>
          {n8nUrl && (
            <Button
              variant="outlined"
              size="small"
              startIcon={<OpenInNew />}
              href={n8nUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              在 n8n 中查看
            </Button>
          )}
          {canRetry && (
            <Button
              variant="contained"
              size="small"
              startIcon={retrying ? <CircularProgress size={16} /> : <Refresh />}
              onClick={handleRetry}
              disabled={retrying}
            >
              {retrying ? '重試中...' : '重試'}
            </Button>
          )}
        </Box>
      </Box>

      {/* 恢復提示 */}
      {error.recoveryHint && (
        <Alert
          severity={error.recoverable ? 'info' : 'warning'}
          sx={{ mb: 3 }}
          icon={error.recoverable ? <Info /> : <Warning />}
        >
          <Typography variant="body2">{error.recoveryHint}</Typography>
        </Alert>
      )}

      {/* 錯誤訊息 */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
          錯誤訊息
        </Typography>
        <Box
          sx={{
            p: 2,
            bgcolor: 'grey.100',
            borderRadius: 1,
            fontFamily: 'monospace',
            fontSize: '0.875rem',
            wordBreak: 'break-word',
          }}
        >
          {error.message}
        </Box>
      </Box>

      {/* 基本資訊表格 */}
      <Table size="small" sx={{ mb: 3 }}>
        <TableBody>
          <TableRow>
            <TableCell component="th" sx={{ width: 150, border: 0 }}>
              錯誤發生時間
            </TableCell>
            <TableCell sx={{ border: 0 }}>
              {format(new Date(error.timestamp), 'PPpp', { locale: zhTW })}
            </TableCell>
          </TableRow>
          {execution.startedAt && (
            <TableRow>
              <TableCell component="th" sx={{ border: 0 }}>開始時間</TableCell>
              <TableCell sx={{ border: 0 }}>
                {format(new Date(execution.startedAt), 'PPpp', { locale: zhTW })}
              </TableCell>
            </TableRow>
          )}
          {execution.durationMs !== undefined && (
            <TableRow>
              <TableCell component="th" sx={{ border: 0 }}>執行時長</TableCell>
              <TableCell sx={{ border: 0 }}>
                {(execution.durationMs / 1000).toFixed(2)} 秒
              </TableCell>
            </TableRow>
          )}
          {error.stage && (
            <TableRow>
              <TableCell component="th" sx={{ border: 0 }}>發生階段</TableCell>
              <TableCell sx={{ border: 0 }}>
                <Chip
                  label={{
                    trigger: '觸發階段',
                    execution: '執行階段',
                    callback: '回調階段',
                    unknown: '未知',
                  }[error.stage]}
                  size="small"
                  variant="outlined"
                />
              </TableCell>
            </TableRow>
          )}
          {error.failedStep && (
            <TableRow>
              <TableCell component="th" sx={{ border: 0 }}>失敗步驟</TableCell>
              <TableCell sx={{ border: 0 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="body2">
                    Step {error.failedStep.stepNumber}: {error.failedStep.stepName}
                  </Typography>
                  {error.failedStep.stepType && (
                    <Chip label={error.failedStep.stepType} size="small" variant="outlined" />
                  )}
                </Box>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <Divider sx={{ my: 3 }} />

      {/* 技術詳情 */}
      {error.technical && (
        <Accordion defaultExpanded={false}>
          <AccordionSummary expandIcon={<ExpandMore />}>
            <Typography fontWeight="medium">技術詳情</Typography>
          </AccordionSummary>
          <AccordionDetails>
            {error.technical.errorCode && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle2" color="text.secondary">
                  錯誤代碼
                </Typography>
                <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                  {error.technical.errorCode}
                </Typography>
              </Box>
            )}
            {error.technical.stackTrace && (
              <Box>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  堆疊追蹤
                </Typography>
                <SyntaxHighlighter
                  language="text"
                  style={vscDarkPlus}
                  customStyle={{
                    fontSize: '11px',
                    maxHeight: '300px',
                    margin: 0,
                  }}
                  wrapLines
                  wrapLongLines
                >
                  {error.technical.stackTrace}
                </SyntaxHighlighter>
              </Box>
            )}
          </AccordionDetails>
        </Accordion>
      )}

      {/* HTTP 詳情 */}
      {error.http && (
        <Accordion defaultExpanded={false}>
          <AccordionSummary expandIcon={<ExpandMore />}>
            <Typography fontWeight="medium">HTTP 請求/回應</Typography>
          </AccordionSummary>
          <AccordionDetails>
            {/* 請求資訊 */}
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                請求
              </Typography>
              <Typography variant="body2" sx={{ fontFamily: 'monospace', mb: 1 }}>
                {error.http.requestMethod} {error.http.requestUrl}
              </Typography>
              {error.http.requestHeaders && (
                <SyntaxHighlighter
                  language="json"
                  style={vscDarkPlus}
                  customStyle={{ fontSize: '11px', margin: 0 }}
                >
                  {JSON.stringify(error.http.requestHeaders, null, 2)}
                </SyntaxHighlighter>
              )}
            </Box>

            {/* 回應資訊 */}
            {error.http.responseStatus && (
              <Box>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  回應 (HTTP {error.http.responseStatus})
                </Typography>
                {error.http.responseBody && (
                  <SyntaxHighlighter
                    language="json"
                    style={vscDarkPlus}
                    customStyle={{ fontSize: '11px', margin: 0, maxHeight: '200px' }}
                  >
                    {typeof error.http.responseBody === 'string'
                      ? error.http.responseBody
                      : JSON.stringify(error.http.responseBody, null, 2)}
                  </SyntaxHighlighter>
                )}
              </Box>
            )}
          </AccordionDetails>
        </Accordion>
      )}

      {/* n8n 詳情 */}
      {error.n8n && (
        <Accordion defaultExpanded={false}>
          <AccordionSummary expandIcon={<ExpandMore />}>
            <Typography fontWeight="medium">n8n 執行資訊</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Table size="small">
              <TableBody>
                {error.n8n.executionId && (
                  <TableRow>
                    <TableCell component="th" sx={{ width: 120 }}>執行 ID</TableCell>
                    <TableCell sx={{ fontFamily: 'monospace' }}>
                      {error.n8n.executionId}
                    </TableCell>
                  </TableRow>
                )}
                {error.n8n.workflowId && (
                  <TableRow>
                    <TableCell component="th">工作流 ID</TableCell>
                    <TableCell sx={{ fontFamily: 'monospace' }}>
                      {error.n8n.workflowId}
                    </TableCell>
                  </TableRow>
                )}
                {error.n8n.nodeName && (
                  <TableRow>
                    <TableCell component="th">失敗節點</TableCell>
                    <TableCell>{error.n8n.nodeName}</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            {error.n8n.errorOutput && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  錯誤輸出
                </Typography>
                <SyntaxHighlighter
                  language="json"
                  style={vscDarkPlus}
                  customStyle={{ fontSize: '11px', margin: 0 }}
                >
                  {JSON.stringify(error.n8n.errorOutput, null, 2)}
                </SyntaxHighlighter>
              </Box>
            )}
          </AccordionDetails>
        </Accordion>
      )}

      {/* 相關文件 */}
      {documents.length > 0 && (
        <Accordion defaultExpanded={false}>
          <AccordionSummary expandIcon={<ExpandMore />}>
            <Typography fontWeight="medium">
              相關文件 ({documents.length})
            </Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Table size="small">
              <TableBody>
                {documents.map((doc) => (
                  <TableRow key={doc.id}>
                    <TableCell>{doc.fileName}</TableCell>
                    <TableCell align="right">
                      <Chip label={doc.status} size="small" variant="outlined" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </AccordionDetails>
        </Accordion>
      )}

      {/* Snackbar 通知 */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        message={snackbar.message}
      />
    </Paper>
  )
}
```

### 6.2 錯誤統計組件

```typescript
// components/workflow/ErrorStatisticsCard.tsx
'use client'

import React from 'react'
import {
  Card,
  CardContent,
  Typography,
  Box,
  Chip,
  LinearProgress,
  Grid,
} from '@mui/material'
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from 'recharts'
import type { ErrorStatistics, WorkflowErrorType } from '@/lib/types/workflow-error'

interface ErrorStatisticsCardProps {
  statistics: ErrorStatistics
  loading?: boolean
}

const ERROR_COLORS: Record<WorkflowErrorType, string> = {
  CONNECTION_ERROR: '#f44336',
  TIMEOUT_ERROR: '#ff9800',
  AUTHENTICATION_ERROR: '#e91e63',
  VALIDATION_ERROR: '#ffeb3b',
  BUSINESS_ERROR: '#2196f3',
  SYSTEM_ERROR: '#9c27b0',
  EXTERNAL_ERROR: '#ff5722',
  UNKNOWN_ERROR: '#607d8b',
}

const ERROR_LABELS: Record<WorkflowErrorType, string> = {
  CONNECTION_ERROR: '連線失敗',
  TIMEOUT_ERROR: '逾時',
  AUTHENTICATION_ERROR: '認證錯誤',
  VALIDATION_ERROR: '驗證錯誤',
  BUSINESS_ERROR: '業務錯誤',
  SYSTEM_ERROR: '系統錯誤',
  EXTERNAL_ERROR: '外部服務錯誤',
  UNKNOWN_ERROR: '未知錯誤',
}

export function ErrorStatisticsCard({ statistics, loading }: ErrorStatisticsCardProps) {
  // 準備圖表資料
  const chartData = Object.entries(statistics.byType)
    .filter(([, count]) => count > 0)
    .map(([type, count]) => ({
      name: ERROR_LABELS[type as WorkflowErrorType],
      value: count,
      color: ERROR_COLORS[type as WorkflowErrorType],
    }))

  // 計算可恢復百分比
  const recoverablePercent = Math.round(statistics.recoverableRate)

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          錯誤統計
        </Typography>

        {loading ? (
          <Box sx={{ py: 4 }}>
            <LinearProgress />
          </Box>
        ) : (
          <Grid container spacing={3}>
            {/* 總數統計 */}
            <Grid item xs={12} md={4}>
              <Box sx={{ textAlign: 'center', py: 2 }}>
                <Typography variant="h3" color="error.main">
                  {statistics.totalErrors}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  總錯誤數
                </Typography>
              </Box>

              <Box sx={{ mt: 2 }}>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  可恢復率
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box sx={{ flex: 1 }}>
                    <LinearProgress
                      variant="determinate"
                      value={recoverablePercent}
                      color={recoverablePercent > 50 ? 'success' : 'warning'}
                    />
                  </Box>
                  <Typography variant="body2">{recoverablePercent}%</Typography>
                </Box>
              </Box>
            </Grid>

            {/* 圓餅圖 */}
            <Grid item xs={12} md={8}>
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={chartData}
                      cx="50%"
                      cy="50%"
                      outerRadius={70}
                      dataKey="value"
                      label={({ name, percent }) =>
                        `${name} (${(percent * 100).toFixed(0)}%)`
                      }
                      labelLine={false}
                    >
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <Box
                  sx={{
                    height: 200,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Typography color="text.secondary">暫無錯誤資料</Typography>
                </Box>
              )}
            </Grid>

            {/* 按步驟統計 */}
            {Object.keys(statistics.byStep).length > 0 && (
              <Grid item xs={12}>
                <Typography variant="subtitle2" gutterBottom>
                  按失敗步驟統計
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {Object.entries(statistics.byStep)
                    .sort(([, a], [, b]) => b - a)
                    .slice(0, 5)
                    .map(([step, count]) => (
                      <Chip
                        key={step}
                        label={`${step}: ${count}`}
                        size="small"
                        variant="outlined"
                      />
                    ))}
                </Box>
              </Grid>
            )}
          </Grid>
        )}
      </CardContent>
    </Card>
  )
}
```

### 6.3 React Query Hooks

```typescript
// hooks/useWorkflowError.ts
import { useQuery } from '@tanstack/react-query'
import type { ErrorDetailResponse, ErrorStatistics } from '@/lib/types/workflow-error'

// ===========================================
// 獲取錯誤詳情
// ===========================================
export function useWorkflowErrorDetail(
  executionId: string | null,
  options: { enabled?: boolean } = {}
) {
  const { enabled = true } = options

  return useQuery({
    queryKey: ['workflow-error', executionId],
    queryFn: async (): Promise<ErrorDetailResponse> => {
      const response = await fetch(`/api/workflow-executions/${executionId}/error`)

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to fetch error details')
      }

      const data = await response.json()
      return data.data
    },
    enabled: enabled && !!executionId,
    staleTime: 60000, // 1 分鐘
    retry: false,
  })
}

// ===========================================
// 獲取錯誤統計
// ===========================================
export function useErrorStatistics(options: {
  cityCode?: string
  startDate?: Date
  endDate?: Date
  enabled?: boolean
} = {}) {
  const { enabled = true, cityCode, startDate, endDate } = options

  return useQuery({
    queryKey: ['error-statistics', cityCode, startDate?.toISOString(), endDate?.toISOString()],
    queryFn: async (): Promise<ErrorStatistics> => {
      const params = new URLSearchParams()
      if (cityCode) params.set('cityCode', cityCode)
      if (startDate) params.set('startDate', startDate.toISOString())
      if (endDate) params.set('endDate', endDate.toISOString())

      const response = await fetch(`/api/workflow-errors/statistics?${params}`)

      if (!response.ok) {
        throw new Error('Failed to fetch error statistics')
      }

      const data = await response.json()
      return data.data
    },
    enabled,
    staleTime: 300000, // 5 分鐘
  })
}
```

---

## 7. 測試計畫

### 7.1 單元測試

```typescript
// __tests__/services/n8n/workflowErrorService.test.ts
import { WorkflowErrorService } from '@/lib/services/n8n/workflowErrorService'

describe('WorkflowErrorService', () => {
  let service: WorkflowErrorService

  beforeEach(() => {
    service = new WorkflowErrorService()
  })

  describe('parseErrorDetails', () => {
    it('應該正確分類逾時錯誤', () => {
      const result = service.parseErrorDetails({
        message: 'Request timed out after 30000ms',
      })

      expect(result.type).toBe('TIMEOUT_ERROR')
      expect(result.recoverable).toBe(true)
    })

    it('應該正確分類連線錯誤', () => {
      const result = service.parseErrorDetails({
        message: 'ECONNREFUSED - Connection refused',
      })

      expect(result.type).toBe('CONNECTION_ERROR')
      expect(result.recoverable).toBe(true)
    })

    it('應該正確分類認證錯誤', () => {
      const result = service.parseErrorDetails({
        message: '401 Unauthorized',
      })

      expect(result.type).toBe('AUTHENTICATION_ERROR')
      expect(result.recoverable).toBe(false)
    })

    it('應該正確分類驗證錯誤', () => {
      const result = service.parseErrorDetails({
        message: 'Validation failed: required field missing',
      })

      expect(result.type).toBe('VALIDATION_ERROR')
      expect(result.recoverable).toBe(false)
    })

    it('應該正確分類外部服務錯誤', () => {
      const result = service.parseErrorDetails({
        message: 'External API error',
        http: { responseStatus: 503 },
      })

      expect(result.type).toBe('EXTERNAL_ERROR')
      expect(result.recoverable).toBe(true)
    })

    it('應該清理敏感 HTTP 標頭', () => {
      const result = service.parseErrorDetails({
        message: 'HTTP error',
        http: {
          requestHeaders: {
            'Authorization': 'Bearer secret-token',
            'X-API-Key': 'api-key-123',
            'Content-Type': 'application/json',
          },
        },
      })

      expect(result.http?.requestHeaders?.['Authorization']).toBe('[REDACTED]')
      expect(result.http?.requestHeaders?.['X-API-Key']).toBe('[REDACTED]')
      expect(result.http?.requestHeaders?.['Content-Type']).toBe('application/json')
    })

    it('應該處理空的錯誤詳情', () => {
      const result = service.parseErrorDetails(null)

      expect(result.type).toBe('UNKNOWN_ERROR')
      expect(result.message).toBe('Unknown error occurred')
      expect(result.recoverable).toBe(false)
    })

    it('應該保留已有的錯誤類型', () => {
      const result = service.parseErrorDetails({
        type: 'BUSINESS_ERROR',
        message: 'Some business error',
      })

      expect(result.type).toBe('BUSINESS_ERROR')
    })
  })

  describe('createErrorDetails', () => {
    it('應該創建完整的錯誤詳情', () => {
      const result = service.createErrorDetails({
        message: 'Test error',
        type: 'CONNECTION_ERROR',
        stage: 'trigger',
        failedStep: { stepNumber: 1, stepName: 'HTTP Request', stepType: 'httpRequest' },
      })

      expect(result.type).toBe('CONNECTION_ERROR')
      expect(result.message).toBe('Test error')
      expect(result.stage).toBe('trigger')
      expect(result.failedStep?.stepNumber).toBe(1)
      expect(result.recoverable).toBe(true)
      expect(result.timestamp).toBeDefined()
    })
  })
})
```

### 7.2 API 整合測試

```typescript
// __tests__/api/workflow-executions/error.test.ts
import { GET } from '@/app/api/workflow-executions/[id]/error/route'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'

jest.mock('next-auth')
jest.mock('@/lib/prisma')

describe('GET /api/workflow-executions/[id]/error', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('應該要求身份驗證', async () => {
    (getServerSession as jest.Mock).mockResolvedValue(null)

    const request = new Request('http://localhost/api/workflow-executions/exec-1/error')
    const response = await GET(request as any, { params: { id: 'exec-1' } })

    expect(response.status).toBe(401)
  })

  it('應該返回錯誤詳情', async () => {
    (getServerSession as jest.Mock).mockResolvedValue({
      user: { id: 'user-1' },
    })

    ;(prisma.workflowExecution.findUnique as jest.Mock).mockResolvedValue({
      id: 'exec-1',
      cityCode: 'TPE',
      status: 'FAILED',
      workflowName: 'Test Workflow',
      errorDetails: {
        type: 'CONNECTION_ERROR',
        message: 'Connection failed',
        timestamp: new Date().toISOString(),
      },
      documents: [],
    })

    jest.mock('@/lib/utils/permissions', () => ({
      getUserCityAccess: jest.fn().mockResolvedValue(['TPE']),
    }))

    const request = new Request('http://localhost/api/workflow-executions/exec-1/error')
    const response = await GET(request as any, { params: { id: 'exec-1' } })

    expect(response.status).toBe(200)
  })
})
```

---

## 8. 部署注意事項

### 8.1 敏感資訊處理

```yaml
security:
  header_sanitization:
    - authorization
    - x-api-key
    - cookie
    - set-cookie
    - x-auth-token
    - x-access-token

  body_sanitization:
    enabled: true
    max_size: 10KB  # 限制回應 body 大小
    fields_to_redact:
      - password
      - secret
      - token
```

### 8.2 n8n 整合

```bash
# .env.example
# n8n 配置（用於跳轉連結）
N8N_BASE_URL=https://n8n.example.com
```

```typescript
// 初始化 SystemConfig
await prisma.systemConfig.upsert({
  where: { key: 'n8n.baseUrl' },
  update: { value: process.env.N8N_BASE_URL },
  create: {
    key: 'n8n.baseUrl',
    value: process.env.N8N_BASE_URL,
    category: 'n8n',
  },
})
```

### 8.3 監控指標

```yaml
metrics:
  - name: workflow_error_total
    type: counter
    labels: [error_type, city_code, workflow_name]

  - name: workflow_error_recoverable_ratio
    type: gauge
    labels: [city_code]

  - name: workflow_error_by_step
    type: counter
    labels: [step_name, error_type]

alerting:
  - name: high_error_rate
    condition: error_rate > 0.1  # 10% 錯誤率
    duration: 5m
    severity: warning

  - name: repeated_auth_errors
    condition: auth_error_count > 5
    duration: 10m
    severity: critical
```

---

## 9. 驗收標準對應

| AC | 描述 | 實現方式 |
|----|------|---------|
| AC1 | 錯誤詳情頁面 | `WorkflowErrorDetail` 組件 + 完整錯誤資訊顯示 |
| AC2 | 技術細節展示 | Accordion 展開區域 + 堆疊追蹤 + HTTP 詳情 |
| AC3 | 重試功能 | `canRetry` 判斷 + 重試按鈕 + Story 10-4 整合 |
| AC4 | 跳轉至 n8n | `n8nUrl` 連結 + 新視窗開啟 |

---

## 10. 開放問題

1. **錯誤資料保留期限**: 錯誤詳情應該保留多久？
   - 建議：跟隨執行記錄一起歸檔（90 天）

2. **堆疊追蹤顯示**: 是否應該對非技術用戶隱藏堆疊追蹤？
   - 建議：根據用戶角色決定顯示內容

3. **錯誤通知**: 是否需要在發生錯誤時發送通知？
   - 建議：延後至未來迭代

---

## 11. 參考資料

- [Story 10-5: 工作流錯誤詳情查看](../stories/10-5-workflow-error-detail-view.md)
- [Tech Spec Story 10-3: 工作流執行狀態檢視](./tech-spec-story-10-3.md)
- [Tech Spec Story 10-4: 手動觸發工作流](./tech-spec-story-10-4.md)
- [n8n Error Handling Documentation](https://docs.n8n.io/flow-logic/error-handling/)
