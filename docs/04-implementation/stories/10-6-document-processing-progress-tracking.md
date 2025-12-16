# Story 10-6: 文件處理進度追蹤

## Story 資訊

- **Epic**: 10 - n8n 工作流整合
- **功能需求**: FR58 (進度追蹤)
- **優先級**: Medium
- **故事點數**: 5
- **相關 Stories**:
  - Story 10-1 (n8n 雙向通訊 API)
  - Story 10-3 (工作流執行狀態查看)
  - Story 2-7 (處理狀態追蹤顯示)

## 使用者故事

**As a** 用戶,
**I want** 追蹤通過 n8n 工作流處理的文件進度,
**So that** 我可以了解自動化處理的狀態。

## 驗收標準

### AC1: 完整處理時間軸

**Given** 文件通過 n8n 工作流提交
**When** 查看文件詳情
**Then** 顯示完整的處理時間軸：
- n8n 觸發時間
- 平台接收時間
- 各處理階段的開始/完成時間
- 當前狀態

### AC2: 即時進度顯示

**Given** 文件處理中
**When** 查看進度
**Then** 顯示當前步驟和預估剩餘時間
**And** 支援即時更新

### AC3: 處理結果摘要

**Given** 文件處理完成
**When** 查看結果
**Then** 顯示處理結果摘要
**And** 可以連結至審核頁面

### AC4: 來源標記顯示

**Given** 文件列表頁面
**When** 查看來自 n8n 的文件
**Then** 顯示來源標記「n8n 工作流」
**And** 顯示觸發的工作流名稱

## 技術規格

### 1. 資料模型

```prisma
// 文件處理階段記錄
model DocumentProcessingStage {
  id            String    @id @default(cuid())
  documentId    String
  document      Document  @relation(fields: [documentId], references: [id], onDelete: Cascade)

  // 階段資訊
  stage         ProcessingStage
  stageName     String    // 顯示名稱
  stageOrder    Int       // 排序順序

  // 狀態
  status        StageStatus @default(PENDING)

  // 時間記錄
  scheduledAt   DateTime?
  startedAt     DateTime?
  completedAt   DateTime?
  durationMs    Int?

  // 結果
  result        Json?     // 階段處理結果
  error         String?   // 錯誤訊息

  // 來源追蹤
  sourceType    String?   // 'n8n' | 'api' | 'internal'
  sourceId      String?   // workflowExecutionId 或其他

  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  @@unique([documentId, stage])
  @@index([documentId])
  @@index([stage])
  @@index([status])
}

enum ProcessingStage {
  RECEIVED              // 接收
  UPLOADED              // 上傳
  OCR_PROCESSING        // OCR 處理
  AI_EXTRACTION         // AI 提取
  FORWARDER_IDENTIFICATION  // Forwarder 識別
  FIELD_MAPPING         // 欄位映射
  VALIDATION            // 驗證
  REVIEW_PENDING        // 待審核
  REVIEW_COMPLETED      // 審核完成
  COMPLETED             // 完成
}

enum StageStatus {
  PENDING     // 等待中
  IN_PROGRESS // 處理中
  COMPLETED   // 完成
  FAILED      // 失敗
  SKIPPED     // 跳過
}

// 擴展 Document 模型（參考 Story 9-5）
// 增加 workflowExecutionId 關聯
```

### 2. 處理進度服務

```typescript
// lib/services/documentProgressService.ts
import { prisma } from '@/lib/prisma'
import { ProcessingStage, StageStatus, Document } from '@prisma/client'

export interface ProcessingTimeline {
  documentId: string
  fileName: string
  currentStage: ProcessingStage
  currentStatus: StageStatus
  progress: number  // 0-100
  estimatedRemainingMs?: number
  stages: Array<{
    stage: ProcessingStage
    stageName: string
    status: StageStatus
    startedAt?: Date
    completedAt?: Date
    durationMs?: number
    error?: string
  }>
  source: {
    type: string  // 'n8n' | 'api' | 'manual'
    workflowName?: string
    workflowExecutionId?: string
    triggeredAt?: Date
  }
}

export interface ProcessingProgress {
  documentId: string
  stage: ProcessingStage
  stageName: string
  progress: number
  estimatedRemainingMs?: number
  lastUpdatedAt: Date
}

// 階段配置
const STAGE_CONFIG: Record<ProcessingStage, { name: string; order: number; weight: number }> = {
  RECEIVED: { name: '已接收', order: 1, weight: 5 },
  UPLOADED: { name: '已上傳', order: 2, weight: 10 },
  OCR_PROCESSING: { name: 'OCR 處理', order: 3, weight: 25 },
  AI_EXTRACTION: { name: 'AI 提取', order: 4, weight: 30 },
  FORWARDER_IDENTIFICATION: { name: 'Forwarder 識別', order: 5, weight: 10 },
  FIELD_MAPPING: { name: '欄位映射', order: 6, weight: 10 },
  VALIDATION: { name: '資料驗證', order: 7, weight: 5 },
  REVIEW_PENDING: { name: '待審核', order: 8, weight: 0 },
  REVIEW_COMPLETED: { name: '審核完成', order: 9, weight: 5 },
  COMPLETED: { name: '完成', order: 10, weight: 0 },
}

export class DocumentProgressService {
  // 獲取文件處理時間軸
  async getProcessingTimeline(documentId: string): Promise<ProcessingTimeline | null> {
    const document = await prisma.document.findUnique({
      where: { id: documentId },
      include: {
        processingStages: {
          orderBy: { stageOrder: 'asc' },
        },
        workflowExecution: {
          select: {
            id: true,
            workflowName: true,
            startedAt: true,
          },
        },
      },
    })

    if (!document) return null

    // 計算當前階段和進度
    const { currentStage, currentStatus, progress } = this.calculateProgress(document.processingStages)

    // 預估剩餘時間
    const estimatedRemainingMs = await this.estimateRemainingTime(
      document.cityCode,
      currentStage,
      progress
    )

    // 構建來源資訊
    const sourceMetadata = document.sourceMetadata as Record<string, any> | null
    const source = {
      type: document.sourceType || 'manual',
      workflowName: document.workflowExecution?.workflowName || sourceMetadata?.workflowName,
      workflowExecutionId: document.workflowExecution?.id || sourceMetadata?.workflowExecutionId,
      triggeredAt: document.workflowExecution?.startedAt || sourceMetadata?.triggeredAt,
    }

    return {
      documentId: document.id,
      fileName: document.fileName,
      currentStage,
      currentStatus,
      progress,
      estimatedRemainingMs,
      stages: document.processingStages.map((stage) => ({
        stage: stage.stage,
        stageName: stage.stageName,
        status: stage.status,
        startedAt: stage.startedAt || undefined,
        completedAt: stage.completedAt || undefined,
        durationMs: stage.durationMs || undefined,
        error: stage.error || undefined,
      })),
      source,
    }
  }

  // 更新處理階段
  async updateProcessingStage(
    documentId: string,
    stage: ProcessingStage,
    status: StageStatus,
    options?: {
      result?: Record<string, any>
      error?: string
      sourceType?: string
      sourceId?: string
    }
  ): Promise<void> {
    const config = STAGE_CONFIG[stage]
    const now = new Date()

    await prisma.documentProcessingStage.upsert({
      where: {
        documentId_stage: {
          documentId,
          stage,
        },
      },
      create: {
        documentId,
        stage,
        stageName: config.name,
        stageOrder: config.order,
        status,
        startedAt: status === 'IN_PROGRESS' ? now : undefined,
        completedAt: ['COMPLETED', 'FAILED', 'SKIPPED'].includes(status) ? now : undefined,
        result: options?.result,
        error: options?.error,
        sourceType: options?.sourceType,
        sourceId: options?.sourceId,
      },
      update: {
        status,
        startedAt: status === 'IN_PROGRESS' ? now : undefined,
        completedAt: ['COMPLETED', 'FAILED', 'SKIPPED'].includes(status) ? now : undefined,
        result: options?.result,
        error: options?.error,
        updatedAt: now,
      },
    })

    // 如果是完成狀態，計算持續時間
    if (['COMPLETED', 'FAILED', 'SKIPPED'].includes(status)) {
      const stageRecord = await prisma.documentProcessingStage.findUnique({
        where: {
          documentId_stage: {
            documentId,
            stage,
          },
        },
      })

      if (stageRecord?.startedAt) {
        const durationMs = now.getTime() - stageRecord.startedAt.getTime()
        await prisma.documentProcessingStage.update({
          where: { id: stageRecord.id },
          data: { durationMs },
        })
      }
    }
  }

  // 初始化文件處理階段
  async initializeProcessingStages(
    documentId: string,
    sourceType?: string,
    sourceId?: string
  ): Promise<void> {
    const stages = Object.entries(STAGE_CONFIG).map(([stage, config]) => ({
      documentId,
      stage: stage as ProcessingStage,
      stageName: config.name,
      stageOrder: config.order,
      status: 'PENDING' as StageStatus,
      sourceType,
      sourceId,
    }))

    await prisma.documentProcessingStage.createMany({
      data: stages,
      skipDuplicates: true,
    })

    // 標記第一階段為已接收
    await this.updateProcessingStage(documentId, 'RECEIVED', 'COMPLETED', {
      sourceType,
      sourceId,
    })
  }

  // 計算進度
  private calculateProgress(stages: any[]): {
    currentStage: ProcessingStage
    currentStatus: StageStatus
    progress: number
  } {
    let totalWeight = 0
    let completedWeight = 0
    let currentStage: ProcessingStage = 'RECEIVED'
    let currentStatus: StageStatus = 'PENDING'

    // 計算權重
    Object.values(STAGE_CONFIG).forEach((config) => {
      totalWeight += config.weight
    })

    // 計算完成的權重
    for (const stage of stages) {
      const config = STAGE_CONFIG[stage.stage as ProcessingStage]

      if (stage.status === 'COMPLETED') {
        completedWeight += config.weight
      } else if (stage.status === 'IN_PROGRESS') {
        currentStage = stage.stage
        currentStatus = 'IN_PROGRESS'
        // 進行中的階段算一半權重
        completedWeight += config.weight * 0.5
      } else if (stage.status === 'PENDING') {
        currentStage = stage.stage
        currentStatus = 'PENDING'
        break
      } else if (stage.status === 'FAILED') {
        currentStage = stage.stage
        currentStatus = 'FAILED'
        break
      }
    }

    const progress = totalWeight > 0
      ? Math.round((completedWeight / totalWeight) * 100)
      : 0

    return { currentStage, currentStatus, progress }
  }

  // 預估剩餘時間
  private async estimateRemainingTime(
    cityCode: string,
    currentStage: ProcessingStage,
    currentProgress: number
  ): Promise<number | undefined> {
    if (currentProgress >= 100) return undefined

    // 獲取歷史平均處理時間
    const avgDuration = await prisma.document.aggregate({
      where: {
        cityCode,
        status: 'COMPLETED',
        processingDuration: { not: null },
      },
      _avg: {
        processingDuration: true,
      },
    })

    if (!avgDuration._avg.processingDuration) return undefined

    const avgTotalMs = avgDuration._avg.processingDuration
    const remainingPercentage = (100 - currentProgress) / 100

    return Math.round(avgTotalMs * remainingPercentage)
  }

  // 獲取即時進度（用於輪詢）
  async getProgressUpdate(documentId: string): Promise<ProcessingProgress | null> {
    const document = await prisma.document.findUnique({
      where: { id: documentId },
      include: {
        processingStages: {
          orderBy: { stageOrder: 'asc' },
        },
      },
    })

    if (!document) return null

    const { currentStage, progress } = this.calculateProgress(document.processingStages)
    const config = STAGE_CONFIG[currentStage]

    const estimatedRemainingMs = await this.estimateRemainingTime(
      document.cityCode,
      currentStage,
      progress
    )

    return {
      documentId: document.id,
      stage: currentStage,
      stageName: config.name,
      progress,
      estimatedRemainingMs,
      lastUpdatedAt: document.updatedAt,
    }
  }

  // 獲取處理中的文件列表
  async getProcessingDocuments(options: {
    cityCode?: string
    limit?: number
  }): Promise<Array<{
    documentId: string
    fileName: string
    progress: number
    currentStage: string
    startedAt: Date
  }>> {
    const documents = await prisma.document.findMany({
      where: {
        status: { in: ['PENDING', 'UPLOADING', 'OCR_PROCESSING', 'AI_EXTRACTING', 'VALIDATION'] },
        ...(options.cityCode ? { cityCode: options.cityCode } : {}),
      },
      include: {
        processingStages: {
          orderBy: { stageOrder: 'asc' },
        },
      },
      take: options.limit || 20,
      orderBy: { createdAt: 'desc' },
    })

    return documents.map((doc) => {
      const { currentStage, progress } = this.calculateProgress(doc.processingStages)
      const config = STAGE_CONFIG[currentStage]

      return {
        documentId: doc.id,
        fileName: doc.fileName,
        progress,
        currentStage: config.name,
        startedAt: doc.createdAt,
      }
    })
  }
}

export const documentProgressService = new DocumentProgressService()
```

### 3. API 路由實現

```typescript
// app/api/documents/[id]/progress/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { documentProgressService } from '@/lib/services/documentProgressService'
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
    // 先獲取文件以驗證權限
    const document = await prisma.document.findUnique({
      where: { id: params.id },
      select: { cityCode: true },
    })

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    // 驗證城市權限
    const userCities = await getUserCityAccess(session.user)
    if (!userCities.includes(document.cityCode) && !userCities.includes('*')) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const searchParams = request.nextUrl.searchParams
    const full = searchParams.get('full') === 'true'

    if (full) {
      // 完整時間軸
      const timeline = await documentProgressService.getProcessingTimeline(params.id)
      return NextResponse.json({ data: timeline })
    } else {
      // 簡要進度（用於輪詢）
      const progress = await documentProgressService.getProgressUpdate(params.id)
      return NextResponse.json({ data: progress })
    }
  } catch (error) {
    console.error('Get document progress error:', error)
    return NextResponse.json(
      { error: 'Failed to get document progress' },
      { status: 500 }
    )
  }
}
```

```typescript
// app/api/documents/processing/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { documentProgressService } from '@/lib/services/documentProgressService'
import { getUserCityAccess } from '@/lib/utils/permissions'

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const searchParams = request.nextUrl.searchParams
  const cityCode = searchParams.get('cityCode') || undefined
  const limit = parseInt(searchParams.get('limit') || '20')

  // 驗證城市權限
  const userCities = await getUserCityAccess(session.user)
  if (cityCode && !userCities.includes(cityCode) && !userCities.includes('*')) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 })
  }

  try {
    const documents = await documentProgressService.getProcessingDocuments({
      cityCode: cityCode || (userCities.includes('*') ? undefined : userCities[0]),
      limit,
    })

    return NextResponse.json({ data: documents })
  } catch (error) {
    console.error('Get processing documents error:', error)
    return NextResponse.json(
      { error: 'Failed to get processing documents' },
      { status: 500 }
    )
  }
}
```

### 4. React 組件

```typescript
// components/document/DocumentProcessingTimeline.tsx
'use client'

import React from 'react'
import {
  Box,
  Paper,
  Typography,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Chip,
  LinearProgress,
  Tooltip,
} from '@mui/material'
import {
  CheckCircle,
  Error,
  HourglassEmpty,
  PlayCircle,
  SkipNext,
} from '@mui/icons-material'
import { formatDistanceToNow, format } from 'date-fns'
import { zhTW } from 'date-fns/locale'

interface ProcessingStage {
  stage: string
  stageName: string
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'SKIPPED'
  startedAt?: Date
  completedAt?: Date
  durationMs?: number
  error?: string
}

interface DocumentProcessingTimelineProps {
  documentId: string
  fileName: string
  stages: ProcessingStage[]
  currentStage: string
  currentStatus: string
  progress: number
  estimatedRemainingMs?: number
  source: {
    type: string
    workflowName?: string
    triggeredAt?: Date
  }
}

const statusIcon: Record<string, React.ReactNode> = {
  PENDING: <HourglassEmpty color="disabled" />,
  IN_PROGRESS: <PlayCircle color="primary" />,
  COMPLETED: <CheckCircle color="success" />,
  FAILED: <Error color="error" />,
  SKIPPED: <SkipNext color="disabled" />,
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}秒`
  return `${Math.floor(ms / 60000)}分${Math.floor((ms % 60000) / 1000)}秒`
}

export function DocumentProcessingTimeline({
  documentId,
  fileName,
  stages,
  currentStage,
  currentStatus,
  progress,
  estimatedRemainingMs,
  source,
}: DocumentProcessingTimelineProps) {
  // 找到當前階段的索引
  const activeStep = stages.findIndex(
    (s) => s.status === 'IN_PROGRESS' || s.status === 'PENDING'
  )

  return (
    <Paper sx={{ p: 3 }}>
      {/* 標題和來源資訊 */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          {fileName}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Chip
            label={source.type === 'n8n' ? 'n8n 工作流' : source.type === 'api' ? 'API' : '手動上傳'}
            size="small"
            color={source.type === 'n8n' ? 'primary' : 'default'}
          />
          {source.workflowName && (
            <Typography variant="body2" color="text.secondary">
              {source.workflowName}
            </Typography>
          )}
          {source.triggeredAt && (
            <Typography variant="caption" color="text.secondary">
              觸發於 {formatDistanceToNow(new Date(source.triggeredAt), {
                addSuffix: true,
                locale: zhTW,
              })}
            </Typography>
          )}
        </Box>
      </Box>

      {/* 進度條 */}
      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
          <Typography variant="body2" color="text.secondary">
            處理進度
          </Typography>
          <Typography variant="body2" fontWeight="medium">
            {progress}%
          </Typography>
        </Box>
        <LinearProgress
          variant="determinate"
          value={progress}
          sx={{ height: 8, borderRadius: 4 }}
        />
        {estimatedRemainingMs && currentStatus === 'IN_PROGRESS' && (
          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
            預估剩餘時間：{formatDuration(estimatedRemainingMs)}
          </Typography>
        )}
      </Box>

      {/* 處理步驟 */}
      <Stepper
        activeStep={activeStep >= 0 ? activeStep : stages.length}
        orientation="vertical"
      >
        {stages.map((stage, index) => (
          <Step key={stage.stage} completed={stage.status === 'COMPLETED'}>
            <StepLabel
              icon={statusIcon[stage.status]}
              error={stage.status === 'FAILED'}
              optional={
                stage.completedAt && (
                  <Typography variant="caption">
                    {format(new Date(stage.completedAt), 'HH:mm:ss')}
                  </Typography>
                )
              }
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {stage.stageName}
                {stage.durationMs && stage.status === 'COMPLETED' && (
                  <Chip
                    label={formatDuration(stage.durationMs)}
                    size="small"
                    variant="outlined"
                  />
                )}
              </Box>
            </StepLabel>
            <StepContent>
              {stage.status === 'IN_PROGRESS' && (
                <Box sx={{ mb: 1 }}>
                  <LinearProgress />
                  <Typography variant="caption" color="text.secondary">
                    處理中...
                  </Typography>
                </Box>
              )}
              {stage.error && (
                <Typography variant="body2" color="error">
                  {stage.error}
                </Typography>
              )}
            </StepContent>
          </Step>
        ))}
      </Stepper>
    </Paper>
  )
}
```

```typescript
// components/document/DocumentSourceBadge.tsx
'use client'

import React from 'react'
import { Chip, Tooltip, Box, Typography } from '@mui/material'
import {
  CloudUpload,
  Workflow,
  Api,
  Email,
  Folder,
} from '@mui/icons-material'

interface DocumentSourceBadgeProps {
  sourceType: string
  workflowName?: string
  compact?: boolean
}

const sourceConfig: Record<string, {
  label: string
  icon: React.ReactNode
  color: 'default' | 'primary' | 'secondary' | 'success' | 'warning'
}> = {
  MANUAL_UPLOAD: {
    label: '手動上傳',
    icon: <CloudUpload fontSize="small" />,
    color: 'default',
  },
  N8N_WORKFLOW: {
    label: 'n8n 工作流',
    icon: <Workflow fontSize="small" />,
    color: 'primary',
  },
  API: {
    label: 'API',
    icon: <Api fontSize="small" />,
    color: 'secondary',
  },
  SHAREPOINT: {
    label: 'SharePoint',
    icon: <Folder fontSize="small" />,
    color: 'success',
  },
  OUTLOOK: {
    label: 'Outlook',
    icon: <Email fontSize="small" />,
    color: 'warning',
  },
}

export function DocumentSourceBadge({
  sourceType,
  workflowName,
  compact = false,
}: DocumentSourceBadgeProps) {
  const config = sourceConfig[sourceType] || sourceConfig.MANUAL_UPLOAD

  if (compact) {
    return (
      <Tooltip title={workflowName ? `${config.label}: ${workflowName}` : config.label}>
        <Box component="span" sx={{ display: 'inline-flex' }}>
          {config.icon}
        </Box>
      </Tooltip>
    )
  }

  return (
    <Tooltip title={workflowName || ''}>
      <Chip
        icon={config.icon as React.ReactElement}
        label={config.label}
        color={config.color}
        size="small"
        variant="outlined"
      />
    </Tooltip>
  )
}
```

```typescript
// hooks/useDocumentProgress.ts
import { useState, useEffect, useCallback } from 'react'
import useSWR from 'swr'

interface UseDocumentProgressOptions {
  documentId: string
  refreshInterval?: number  // 毫秒
  enabled?: boolean
}

export function useDocumentProgress({
  documentId,
  refreshInterval = 3000,
  enabled = true,
}: UseDocumentProgressOptions) {
  const { data, error, isLoading, mutate } = useSWR(
    enabled ? `/api/documents/${documentId}/progress` : null,
    async (url) => {
      const res = await fetch(url)
      if (!res.ok) throw new Error('Failed to fetch')
      return res.json()
    },
    {
      refreshInterval: enabled ? refreshInterval : 0,
    }
  )

  // 當進度達到 100% 時停止輪詢
  const shouldRefresh = data?.data?.progress < 100

  return {
    progress: data?.data || null,
    isLoading,
    error,
    refresh: mutate,
    isPolling: enabled && shouldRefresh,
  }
}

export function useDocumentTimeline(documentId: string) {
  const { data, error, isLoading, mutate } = useSWR(
    `/api/documents/${documentId}/progress?full=true`,
    async (url) => {
      const res = await fetch(url)
      if (!res.ok) throw new Error('Failed to fetch')
      return res.json()
    }
  )

  return {
    timeline: data?.data || null,
    isLoading,
    error,
    refresh: mutate,
  }
}
```

## 測試案例

### 單元測試

```typescript
// __tests__/services/documentProgressService.test.ts
import { documentProgressService } from '@/lib/services/documentProgressService'
import { prismaMock } from '@/lib/__mocks__/prisma'

describe('DocumentProgressService', () => {
  describe('calculateProgress', () => {
    it('should calculate progress correctly', () => {
      const stages = [
        { stage: 'RECEIVED', status: 'COMPLETED' },
        { stage: 'UPLOADED', status: 'COMPLETED' },
        { stage: 'OCR_PROCESSING', status: 'IN_PROGRESS' },
        { stage: 'AI_EXTRACTION', status: 'PENDING' },
      ]

      const result = documentProgressService['calculateProgress'](stages)

      expect(result.currentStage).toBe('OCR_PROCESSING')
      expect(result.currentStatus).toBe('IN_PROGRESS')
      expect(result.progress).toBeGreaterThan(0)
      expect(result.progress).toBeLessThan(100)
    })

    it('should return 100% for completed documents', () => {
      const stages = [
        { stage: 'RECEIVED', status: 'COMPLETED' },
        { stage: 'UPLOADED', status: 'COMPLETED' },
        { stage: 'OCR_PROCESSING', status: 'COMPLETED' },
        { stage: 'AI_EXTRACTION', status: 'COMPLETED' },
        { stage: 'VALIDATION', status: 'COMPLETED' },
        { stage: 'COMPLETED', status: 'COMPLETED' },
      ]

      const result = documentProgressService['calculateProgress'](stages)

      expect(result.progress).toBe(100)
    })
  })

  describe('updateProcessingStage', () => {
    it('should upsert stage record', async () => {
      prismaMock.documentProcessingStage.upsert.mockResolvedValue({} as any)

      await documentProgressService.updateProcessingStage(
        'doc-1',
        'OCR_PROCESSING',
        'IN_PROGRESS'
      )

      expect(prismaMock.documentProcessingStage.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            documentId_stage: {
              documentId: 'doc-1',
              stage: 'OCR_PROCESSING',
            },
          },
        })
      )
    })
  })
})
```

## 部署注意事項

1. **即時更新策略**
   - 預設輪詢間隔 3 秒
   - 處理完成後自動停止輪詢

2. **性能優化**
   - 使用 SWR 快取避免重複請求
   - 進度計算使用權重而非固定百分比

3. **監控指標**
   - 各階段平均處理時間
   - 階段失敗率
   - 整體處理成功率

## 相依性

- Story 10-1: n8n 雙向通訊 API（狀態回報）
- Story 10-3: 工作流執行狀態查看（關聯查詢）
- Story 2-7: 處理狀態追蹤顯示（UI 整合）
