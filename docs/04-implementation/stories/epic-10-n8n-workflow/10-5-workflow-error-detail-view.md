# Story 10-5: 工作流錯誤詳情查看

## Story 資訊

- **Epic**: 10 - n8n 工作流整合
- **功能需求**: FR57 (錯誤診斷)
- **優先級**: Medium
- **故事點數**: 5
- **相關 Stories**:
  - Story 10-3 (工作流執行狀態查看)
  - Story 10-4 (手動觸發工作流)
  - Story 10-7 (n8n 連接狀態監控)

## 使用者故事

**As a** 用戶,
**I want** 查看工作流執行錯誤的詳細資訊,
**So that** 我可以診斷問題並採取修正措施。

## 驗收標準

### AC1: 錯誤詳情頁面

**Given** 工作流執行失敗
**When** 點擊「查看詳情」
**Then** 顯示錯誤詳情頁面：
- 錯誤發生時間
- 錯誤類型（連線失敗/逾時/業務錯誤/系統錯誤）
- 錯誤訊息
- 失敗的步驟
- 相關的文件或資源

### AC2: 技術細節展示

**Given** 錯誤詳情頁面
**When** 查看技術細節
**Then** 可以展開查看：
- 錯誤堆疊追蹤
- 請求/回應詳情
- n8n 執行日誌（如有）

### AC3: 重試功能

**Given** 可恢復的錯誤
**When** 查看錯誤詳情
**Then** 顯示「重試」按鈕
**And** 點擊後重新觸發工作流

### AC4: 跳轉至 n8n

**Given** 需要進一步調查
**When** 點擊「在 n8n 中查看」
**Then** 跳轉至 n8n 的執行詳情頁面（新視窗）

## 技術規格

### 1. 擴展資料模型

```prisma
// 擴展 WorkflowExecution（見 Story 10-3）增加詳細錯誤資訊
// errorDetails JSON 結構定義

// 錯誤分類
enum WorkflowErrorType {
  CONNECTION_ERROR    // 連線失敗
  TIMEOUT_ERROR       // 逾時
  AUTHENTICATION_ERROR // 認證錯誤
  VALIDATION_ERROR    // 資料驗證錯誤
  BUSINESS_ERROR      // 業務邏輯錯誤
  SYSTEM_ERROR        // 系統錯誤
  EXTERNAL_ERROR      // 外部服務錯誤
  UNKNOWN_ERROR       // 未知錯誤
}
```

### 2. 錯誤詳情結構

```typescript
// lib/types/workflowError.ts

export interface WorkflowErrorDetails {
  // 基本資訊
  type: WorkflowErrorType
  message: string
  timestamp: string

  // 錯誤位置
  failedStep?: {
    stepNumber: number
    stepName: string
    stepType: string
  }

  // 技術詳情
  technical?: {
    stackTrace?: string
    errorCode?: string
    originalError?: string
  }

  // 請求/回應（如果是 HTTP 錯誤）
  http?: {
    requestUrl?: string
    requestMethod?: string
    requestHeaders?: Record<string, string>
    requestBody?: any
    responseStatus?: number
    responseHeaders?: Record<string, string>
    responseBody?: any
  }

  // n8n 相關資訊
  n8n?: {
    executionId?: string
    workflowId?: string
    nodeId?: string
    nodeName?: string
    errorOutput?: any
  }

  // 上下文資訊
  context?: {
    documentIds?: string[]
    parameters?: Record<string, any>
    triggeredBy?: string
    cityCode?: string
  }

  // 可恢復性
  recoverable: boolean
  recoveryHint?: string
}

export type WorkflowErrorType =
  | 'CONNECTION_ERROR'
  | 'TIMEOUT_ERROR'
  | 'AUTHENTICATION_ERROR'
  | 'VALIDATION_ERROR'
  | 'BUSINESS_ERROR'
  | 'SYSTEM_ERROR'
  | 'EXTERNAL_ERROR'
  | 'UNKNOWN_ERROR'
```

### 3. 錯誤詳情服務

```typescript
// lib/services/n8n/workflowErrorService.ts
import { prisma } from '@/lib/prisma'
import { WorkflowErrorDetails, WorkflowErrorType } from '@/lib/types/workflowError'

export interface ErrorDetailResponse {
  execution: {
    id: string
    workflowName: string
    status: string
    startedAt?: Date
    completedAt?: Date
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

export class WorkflowErrorService {
  // 獲取錯誤詳情
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

    if (execution.status !== 'FAILED' && execution.status !== 'TIMEOUT') {
      return null // 只處理失敗狀態
    }

    const errorDetails = this.parseErrorDetails(execution.errorDetails)

    // 構建 n8n URL（如果有配置）
    const n8nUrl = await this.buildN8nUrl(execution)

    return {
      execution: {
        id: execution.id,
        workflowName: execution.workflowName,
        status: execution.status,
        startedAt: execution.startedAt || undefined,
        completedAt: execution.completedAt || undefined,
        durationMs: execution.durationMs || undefined,
      },
      error: errorDetails,
      documents: execution.documents,
      canRetry: errorDetails.recoverable,
      n8nUrl,
    }
  }

  // 解析錯誤詳情
  parseErrorDetails(rawDetails: any): WorkflowErrorDetails {
    if (!rawDetails) {
      return {
        type: 'UNKNOWN_ERROR',
        message: 'Unknown error occurred',
        timestamp: new Date().toISOString(),
        recoverable: false,
      }
    }

    // 標準化錯誤詳情
    const details = rawDetails as Partial<WorkflowErrorDetails>

    return {
      type: this.classifyError(details),
      message: details.message || 'Unknown error',
      timestamp: details.timestamp || new Date().toISOString(),
      failedStep: details.failedStep,
      technical: details.technical,
      http: this.sanitizeHttpDetails(details.http),
      n8n: details.n8n,
      context: details.context,
      recoverable: this.isRecoverable(details),
      recoveryHint: this.getRecoveryHint(details),
    }
  }

  // 錯誤分類
  private classifyError(details: Partial<WorkflowErrorDetails>): WorkflowErrorType {
    if (details.type) return details.type

    const message = (details.message || '').toLowerCase()

    if (message.includes('timeout') || message.includes('timed out')) {
      return 'TIMEOUT_ERROR'
    }
    if (message.includes('connection') || message.includes('network') || message.includes('econnrefused')) {
      return 'CONNECTION_ERROR'
    }
    if (message.includes('unauthorized') || message.includes('authentication') || message.includes('401')) {
      return 'AUTHENTICATION_ERROR'
    }
    if (message.includes('validation') || message.includes('invalid')) {
      return 'VALIDATION_ERROR'
    }
    if (details.http?.responseStatus && details.http.responseStatus >= 500) {
      return 'EXTERNAL_ERROR'
    }

    return 'UNKNOWN_ERROR'
  }

  // 判斷是否可恢復
  private isRecoverable(details: Partial<WorkflowErrorDetails>): boolean {
    const type = this.classifyError(details)

    // 這些類型通常是暫時性的，可以重試
    const recoverableTypes: WorkflowErrorType[] = [
      'CONNECTION_ERROR',
      'TIMEOUT_ERROR',
      'EXTERNAL_ERROR',
    ]

    return recoverableTypes.includes(type)
  }

  // 獲取恢復建議
  private getRecoveryHint(details: Partial<WorkflowErrorDetails>): string | undefined {
    const type = this.classifyError(details)

    const hints: Record<WorkflowErrorType, string> = {
      CONNECTION_ERROR: '請檢查網路連線和 n8n 服務狀態後重試',
      TIMEOUT_ERROR: '操作逾時，請稍後重試或檢查目標服務回應時間',
      AUTHENTICATION_ERROR: '請檢查 API Key 或認證設定是否正確',
      VALIDATION_ERROR: '請檢查輸入資料格式是否正確',
      BUSINESS_ERROR: '請根據錯誤訊息修正業務資料',
      SYSTEM_ERROR: '系統內部錯誤，請聯繫技術支援',
      EXTERNAL_ERROR: '外部服務錯誤，請稍後重試',
      UNKNOWN_ERROR: '發生未知錯誤，請聯繫技術支援',
    }

    return hints[type]
  }

  // 清理敏感 HTTP 資訊
  private sanitizeHttpDetails(http?: any): WorkflowErrorDetails['http'] {
    if (!http) return undefined

    const sanitizedHeaders = { ...http.requestHeaders }
    const sensitiveHeaders = ['authorization', 'x-api-key', 'cookie', 'set-cookie']

    sensitiveHeaders.forEach((header) => {
      if (sanitizedHeaders[header]) {
        sanitizedHeaders[header] = '[REDACTED]'
      }
    })

    return {
      ...http,
      requestHeaders: sanitizedHeaders,
    }
  }

  // 構建 n8n URL
  private async buildN8nUrl(execution: any): Promise<string | undefined> {
    if (!execution.n8nExecutionId) return undefined

    // 從系統配置獲取 n8n 基礎 URL
    const config = await prisma.systemConfig.findFirst({
      where: { key: 'n8n.baseUrl' },
    })

    if (!config?.value) return undefined

    const baseUrl = config.value.replace(/\/$/, '')

    // 構建執行詳情 URL
    // n8n 執行 URL 格式：{baseUrl}/execution/{executionId}
    return `${baseUrl}/execution/${execution.n8nExecutionId}`
  }

  // 獲取錯誤統計
  async getErrorStatistics(options: {
    cityCode?: string
    startDate?: Date
    endDate?: Date
  }): Promise<{
    byType: Record<string, number>
    byStep: Record<string, number>
    recoverableRate: number
    totalErrors: number
  }> {
    const { cityCode, startDate, endDate } = options

    const where: any = {
      status: { in: ['FAILED', 'TIMEOUT'] },
    }

    if (cityCode) where.cityCode = cityCode
    if (startDate || endDate) {
      where.completedAt = {}
      if (startDate) where.completedAt.gte = startDate
      if (endDate) where.completedAt.lte = endDate
    }

    const errors = await prisma.workflowExecution.findMany({
      where,
      select: {
        errorDetails: true,
      },
    })

    const byType: Record<string, number> = {}
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
      recoverableRate: errors.length > 0 ? (recoverableCount / errors.length) * 100 : 0,
      totalErrors: errors.length,
    }
  }
}

export const workflowErrorService = new WorkflowErrorService()
```

### 4. API 路由實現

```typescript
// app/api/workflow-executions/[id]/error/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { workflowErrorService } from '@/lib/services/n8n/workflowErrorService'
import { getUserCityAccess } from '@/lib/utils/permissions'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // 先獲取執行記錄以驗證權限
    const execution = await prisma.workflowExecution.findUnique({
      where: { id: params.id },
      select: { cityCode: true },
    })

    if (!execution) {
      return NextResponse.json({ error: 'Execution not found' }, { status: 404 })
    }

    // 驗證城市權限
    const userCities = await getUserCityAccess(session.user)
    if (!userCities.includes(execution.cityCode) && !userCities.includes('*')) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const errorDetail = await workflowErrorService.getErrorDetail(params.id)

    if (!errorDetail) {
      return NextResponse.json(
        { error: 'No error details available' },
        { status: 404 }
      )
    }

    return NextResponse.json({ data: errorDetail })
  } catch (error) {
    console.error('Get error detail error:', error)
    return NextResponse.json(
      { error: 'Failed to get error details' },
      { status: 500 }
    )
  }
}
```

```typescript
// app/api/workflow-errors/statistics/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { workflowErrorService } from '@/lib/services/n8n/workflowErrorService'
import { getUserCityAccess, hasRole } from '@/lib/utils/permissions'

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 只有管理員可以查看統計
  if (!hasRole(session.user, 'ADMIN') && !hasRole(session.user, 'SUPER_USER')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }

  const searchParams = request.nextUrl.searchParams
  const cityCode = searchParams.get('cityCode') || undefined
  const startDate = searchParams.get('startDate')
    ? new Date(searchParams.get('startDate')!)
    : undefined
  const endDate = searchParams.get('endDate')
    ? new Date(searchParams.get('endDate')!)
    : undefined

  // 驗證城市權限
  if (cityCode) {
    const userCities = await getUserCityAccess(session.user)
    if (!userCities.includes(cityCode) && !userCities.includes('*')) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }
  }

  try {
    const statistics = await workflowErrorService.getErrorStatistics({
      cityCode,
      startDate,
      endDate,
    })

    return NextResponse.json({ data: statistics })
  } catch (error) {
    console.error('Get error statistics error:', error)
    return NextResponse.json(
      { error: 'Failed to get error statistics' },
      { status: 500 }
    )
  }
}
```

### 5. React 組件

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
} from '@mui/material'
import {
  Error as ErrorIcon,
  ExpandMore,
  Refresh,
  OpenInNew,
  ContentCopy,
  Warning,
  Info,
  CheckCircle,
} from '@mui/icons-material'
import { format } from 'date-fns'
import { zhTW } from 'date-fns/locale'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'

interface WorkflowErrorDetailProps {
  executionId: string
  error: {
    type: string
    message: string
    timestamp: string
    failedStep?: {
      stepNumber: number
      stepName: string
      stepType: string
    }
    technical?: {
      stackTrace?: string
      errorCode?: string
      originalError?: string
    }
    http?: {
      requestUrl?: string
      requestMethod?: string
      requestHeaders?: Record<string, string>
      requestBody?: any
      responseStatus?: number
      responseHeaders?: Record<string, string>
      responseBody?: any
    }
    n8n?: {
      executionId?: string
      workflowId?: string
      nodeId?: string
      nodeName?: string
      errorOutput?: any
    }
    recoverable: boolean
    recoveryHint?: string
  }
  execution: {
    workflowName: string
    startedAt?: Date
    completedAt?: Date
    durationMs?: number
  }
  documents: Array<{ id: string; fileName: string; status: string }>
  canRetry: boolean
  n8nUrl?: string
  onRetry: () => Promise<void>
}

const errorTypeConfig: Record<string, {
  label: string
  color: 'error' | 'warning' | 'info'
  icon: React.ReactNode
}> = {
  CONNECTION_ERROR: { label: '連線失敗', color: 'error', icon: <ErrorIcon /> },
  TIMEOUT_ERROR: { label: '逾時', color: 'warning', icon: <Warning /> },
  AUTHENTICATION_ERROR: { label: '認證錯誤', color: 'error', icon: <ErrorIcon /> },
  VALIDATION_ERROR: { label: '驗證錯誤', color: 'warning', icon: <Warning /> },
  BUSINESS_ERROR: { label: '業務錯誤', color: 'warning', icon: <Info /> },
  SYSTEM_ERROR: { label: '系統錯誤', color: 'error', icon: <ErrorIcon /> },
  EXTERNAL_ERROR: { label: '外部服務錯誤', color: 'error', icon: <ErrorIcon /> },
  UNKNOWN_ERROR: { label: '未知錯誤', color: 'error', icon: <ErrorIcon /> },
}

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
  const [copied, setCopied] = useState(false)

  const errorConfig = errorTypeConfig[error.type] || errorTypeConfig.UNKNOWN_ERROR

  const handleRetry = async () => {
    setRetrying(true)
    try {
      await onRetry()
    } finally {
      setRetrying(false)
    }
  }

  const handleCopyError = async () => {
    const errorText = JSON.stringify(error, null, 2)
    await navigator.clipboard.writeText(errorText)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Paper sx={{ p: 3 }}>
      {/* 標題區 */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Chip
            icon={errorConfig.icon as React.ReactElement}
            label={errorConfig.label}
            color={errorConfig.color}
          />
          <Typography variant="h6">
            {execution.workflowName}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Tooltip title={copied ? '已複製' : '複製錯誤資訊'}>
            <IconButton onClick={handleCopyError}>
              {copied ? <CheckCircle color="success" /> : <ContentCopy />}
            </IconButton>
          </Tooltip>
          {n8nUrl && (
            <Button
              variant="outlined"
              startIcon={<OpenInNew />}
              href={n8nUrl}
              target="_blank"
            >
              在 n8n 中查看
            </Button>
          )}
          {canRetry && (
            <Button
              variant="contained"
              startIcon={retrying ? <CircularProgress size={20} /> : <Refresh />}
              onClick={handleRetry}
              disabled={retrying}
            >
              重試
            </Button>
          )}
        </Box>
      </Box>

      {/* 恢復提示 */}
      {error.recoveryHint && (
        <Alert severity={error.recoverable ? 'info' : 'warning'} sx={{ mb: 3 }}>
          {error.recoveryHint}
        </Alert>
      )}

      {/* 基本錯誤資訊 */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
          錯誤訊息
        </Typography>
        <Typography variant="body1" sx={{ fontFamily: 'monospace', bgcolor: 'grey.100', p: 2, borderRadius: 1 }}>
          {error.message}
        </Typography>
      </Box>

      {/* 執行資訊 */}
      <Table size="small" sx={{ mb: 3 }}>
        <TableBody>
          <TableRow>
            <TableCell component="th" sx={{ width: 150 }}>錯誤發生時間</TableCell>
            <TableCell>
              {format(new Date(error.timestamp), 'PPpp', { locale: zhTW })}
            </TableCell>
          </TableRow>
          {execution.startedAt && (
            <TableRow>
              <TableCell component="th">開始時間</TableCell>
              <TableCell>
                {format(new Date(execution.startedAt), 'PPpp', { locale: zhTW })}
              </TableCell>
            </TableRow>
          )}
          {execution.durationMs && (
            <TableRow>
              <TableCell component="th">執行時長</TableCell>
              <TableCell>{(execution.durationMs / 1000).toFixed(2)} 秒</TableCell>
            </TableRow>
          )}
          {error.failedStep && (
            <TableRow>
              <TableCell component="th">失敗步驟</TableCell>
              <TableCell>
                Step {error.failedStep.stepNumber}: {error.failedStep.stepName}
                {error.failedStep.stepType && (
                  <Chip label={error.failedStep.stepType} size="small" sx={{ ml: 1 }} />
                )}
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
                  customStyle={{ fontSize: '12px', maxHeight: '300px' }}
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
            <Box sx={{ display: 'grid', gap: 2 }}>
              {/* 請求 */}
              <Box>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  請求
                </Typography>
                <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                  {error.http.requestMethod} {error.http.requestUrl}
                </Typography>
                {error.http.requestHeaders && (
                  <Box sx={{ mt: 1 }}>
                    <SyntaxHighlighter language="json" style={vscDarkPlus} customStyle={{ fontSize: '11px' }}>
                      {JSON.stringify(error.http.requestHeaders, null, 2)}
                    </SyntaxHighlighter>
                  </Box>
                )}
              </Box>

              {/* 回應 */}
              {error.http.responseStatus && (
                <Box>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    回應 (HTTP {error.http.responseStatus})
                  </Typography>
                  {error.http.responseBody && (
                    <SyntaxHighlighter language="json" style={vscDarkPlus} customStyle={{ fontSize: '11px' }}>
                      {typeof error.http.responseBody === 'string'
                        ? error.http.responseBody
                        : JSON.stringify(error.http.responseBody, null, 2)}
                    </SyntaxHighlighter>
                  )}
                </Box>
              )}
            </Box>
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
                    <TableCell component="th">執行 ID</TableCell>
                    <TableCell sx={{ fontFamily: 'monospace' }}>{error.n8n.executionId}</TableCell>
                  </TableRow>
                )}
                {error.n8n.workflowId && (
                  <TableRow>
                    <TableCell component="th">工作流 ID</TableCell>
                    <TableCell sx={{ fontFamily: 'monospace' }}>{error.n8n.workflowId}</TableCell>
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
                <SyntaxHighlighter language="json" style={vscDarkPlus} customStyle={{ fontSize: '11px' }}>
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
                    <TableCell>
                      <Chip label={doc.status} size="small" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </AccordionDetails>
        </Accordion>
      )}
    </Paper>
  )
}
```

## 測試案例

### 單元測試

```typescript
// __tests__/services/n8n/workflowErrorService.test.ts
import { workflowErrorService } from '@/lib/services/n8n/workflowErrorService'

describe('WorkflowErrorService', () => {
  describe('parseErrorDetails', () => {
    it('should classify timeout errors correctly', () => {
      const result = workflowErrorService.parseErrorDetails({
        message: 'Request timed out after 30000ms',
      })

      expect(result.type).toBe('TIMEOUT_ERROR')
      expect(result.recoverable).toBe(true)
    })

    it('should classify connection errors correctly', () => {
      const result = workflowErrorService.parseErrorDetails({
        message: 'ECONNREFUSED - Connection refused',
      })

      expect(result.type).toBe('CONNECTION_ERROR')
      expect(result.recoverable).toBe(true)
    })

    it('should classify authentication errors correctly', () => {
      const result = workflowErrorService.parseErrorDetails({
        message: '401 Unauthorized',
      })

      expect(result.type).toBe('AUTHENTICATION_ERROR')
      expect(result.recoverable).toBe(false)
    })

    it('should sanitize sensitive HTTP headers', () => {
      const result = workflowErrorService.parseErrorDetails({
        message: 'HTTP error',
        http: {
          requestHeaders: {
            'Authorization': 'Bearer secret-token',
            'Content-Type': 'application/json',
          },
        },
      })

      expect(result.http?.requestHeaders?.['Authorization']).toBe('[REDACTED]')
      expect(result.http?.requestHeaders?.['Content-Type']).toBe('application/json')
    })
  })
})
```

## 部署注意事項

1. **敏感資訊處理**
   - HTTP headers 中的認證資訊會被遮蔽
   - 錯誤日誌不包含敏感資料

2. **n8n 整合**
   - 需配置 n8n 基礎 URL 以支援跳轉功能
   - 確保 n8n 執行 ID 正確傳遞

3. **監控指標**
   - 錯誤類型分佈
   - 可恢復錯誤比例
   - 重試成功率

## 相依性

- Story 10-3: 工作流執行狀態查看（基礎資料）
- Story 10-4: 手動觸發工作流（重試功能）
- Story 10-7: n8n 連接狀態監控（連線錯誤關聯）

---

## Implementation Notes

### 實作日期
2025-12-20

### 實作摘要

本 Story 完成工作流錯誤診斷系統的後端服務層和 React Query Hooks，為前端組件提供完整的錯誤詳情獲取和統計分析能力。

### 已實作項目

#### 1. 類型定義 (`src/types/workflow-error.ts`)
- `WorkflowErrorType`: 8 種錯誤類型定義
- `ErrorStage`: 錯誤發生階段（trigger/execution/callback/unknown）
- `FailedStepInfo`: 失敗步驟資訊
- `TechnicalDetails`: 技術詳情（堆疊追蹤、錯誤代碼）
- `HttpDetails`: HTTP 請求/回應詳情
- `N8nDetails`: n8n 執行資訊
- `ErrorContext`: 錯誤上下文
- `WorkflowErrorDetails`: 完整錯誤詳情
- `ErrorDetailResponse`: API 回應格式
- `ErrorStatistics`: 統計資料格式
- `ErrorTypeConfig`: 錯誤類型配置
- `CreateErrorDetailsInput`: 建立錯誤詳情輸入

#### 2. 常數定義 (`src/lib/constants/error-types.ts`)
- `ERROR_TYPE_CONFIG`: 8 種錯誤類型的配置（標籤、顏色、圖示、可恢復性、預設提示）
- `SENSITIVE_HEADERS`: 敏感 HTTP 標頭列表（9 種）
- `TIMEOUT_KEYWORDS`: 逾時錯誤關鍵字
- `CONNECTION_KEYWORDS`: 連線錯誤關鍵字
- `AUTHENTICATION_KEYWORDS`: 認證錯誤關鍵字
- `VALIDATION_KEYWORDS`: 驗證錯誤關鍵字
- Helper functions: `getErrorTypeConfig`, `isSensitiveHeader`, `isErrorRecoverable`

#### 3. 服務層 (`src/services/n8n/workflow-error.service.ts`)
- `WorkflowErrorService` 類別
- `getErrorDetail(executionId)`: 獲取錯誤詳情（含文件列表、n8n URL）
- `getErrorStatistics(options)`: 獲取錯誤統計（按類型/步驟分組、可恢復率）
- `parseErrorDetails(rawDetails)`: 解析和標準化錯誤詳情
- `createErrorDetails(input)`: 創建新錯誤詳情
- 私有方法：錯誤分類、關鍵字匹配、敏感資訊遮蔽、n8n URL 建構

#### 4. API 路由
- `GET /api/workflows/executions/[id]/error`: 錯誤詳情端點
  - 身份驗證和城市權限檢查
  - 只處理 FAILED/TIMEOUT 狀態
  - 返回完整錯誤詳情
- `GET /api/workflow-errors/statistics`: 錯誤統計端點
  - 僅 SUPER_USER/ADMIN 可存取
  - 支援 cityCode、startDate、endDate 篩選
  - 返回統計資料

#### 5. React Query Hooks (`src/hooks/useWorkflowError.ts`)
- `useWorkflowErrorDetail(executionId, options)`: 錯誤詳情查詢（1 分鐘快取）
- `useErrorStatistics(options)`: 錯誤統計查詢（5 分鐘快取）
- `workflowErrorKeys`: 查詢鍵定義

### 錯誤分類邏輯

1. 如果錯誤已有類型 → 直接使用
2. 關鍵字匹配（優先順序）：逾時 > 連線 > 認證 > 驗證
3. HTTP 狀態碼判斷：5xx → EXTERNAL_ERROR，4xx → BUSINESS_ERROR
4. 其他 → UNKNOWN_ERROR

### 敏感資訊處理

自動遮蔽以下 HTTP 標頭：
- authorization, x-api-key, cookie, set-cookie
- x-auth-token, x-access-token, x-refresh-token
- proxy-authorization, www-authenticate

### 技術決策

1. **類型安全**: 使用 Prisma JsonValue 類型守衛確保 config.value 為字串
2. **錯誤可恢復性**: CONNECTION_ERROR、TIMEOUT_ERROR、EXTERNAL_ERROR 標記為可恢復
3. **快取策略**: 錯誤詳情 1 分鐘、統計 5 分鐘（資料相對靜態）
4. **retry: false**: 錯誤詳情不自動重試（避免無謂的重複請求）

### 未實作項目（前端組件）

以下項目在 Tech Spec 中定義但未在本次實作，留待後續或整合時實作：
- `WorkflowErrorDetail` React 組件（展示錯誤詳情）
- 錯誤統計圖表組件

### 驗證結果

- ✅ TypeScript 類型檢查通過 (`npm run type-check`)
- ✅ ESLint 檢查通過 (`npm run lint`)
