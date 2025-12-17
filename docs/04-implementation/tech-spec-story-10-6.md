# Tech Spec: Story 10-6 - 文件處理進度追蹤

## 1. 概述

### 1.1 Story 資訊
- **Story ID**: 10-6
- **標題**: 文件處理進度追蹤
- **Epic**: 10 - n8n 工作流整合
- **功能需求**: FR58 (進度追蹤)
- **優先級**: Medium
- **故事點數**: 5

### 1.2 目標
實現文件處理的完整進度追蹤系統，讓用戶能夠：
- 查看通過 n8n 工作流處理的文件完整時間軸
- 即時監控當前處理階段和預估剩餘時間
- 查看處理結果摘要並快速連結至審核頁面
- 識別來自 n8n 工作流的文件來源標記

### 1.3 相依性
| 類型 | Story | 說明 |
|------|-------|------|
| 前置 | 10-1 | n8n 雙向通訊 API（狀態回報機制） |
| 前置 | 10-3 | 工作流執行狀態查看（執行記錄關聯） |
| 相關 | 2-7 | 處理狀態追蹤顯示（UI 整合基礎） |

---

## 2. 資料庫設計

### 2.1 Prisma Schema

```prisma
// ===========================================
// 文件處理階段記錄
// ===========================================

model DocumentProcessingStage {
  id            String          @id @default(cuid())
  documentId    String
  document      Document        @relation(fields: [documentId], references: [id], onDelete: Cascade)

  // 階段資訊
  stage         ProcessingStage
  stageName     String          // 顯示名稱（中文）
  stageOrder    Int             // 排序順序 (1-10)

  // 狀態
  status        StageStatus     @default(PENDING)

  // 時間記錄
  scheduledAt   DateTime?       // 預定開始時間
  startedAt     DateTime?       // 實際開始時間
  completedAt   DateTime?       // 完成時間
  durationMs    Int?            // 持續時間（毫秒）

  // 結果
  result        Json?           // 階段處理結果 (StageResultSchema)
  error         String?         // 錯誤訊息

  // 來源追蹤
  sourceType    String?         // 'n8n' | 'api' | 'internal' | 'manual'
  sourceId      String?         // workflowExecutionId 或其他來源 ID

  // 元資料
  metadata      Json?           // 額外階段資訊 (StageMetadataSchema)

  createdAt     DateTime        @default(now())
  updatedAt     DateTime        @updatedAt

  @@unique([documentId, stage])
  @@index([documentId])
  @@index([stage])
  @@index([status])
  @@index([sourceType, sourceId])
  @@index([createdAt])
  @@map("document_processing_stages")
}

// ===========================================
// 處理階段枚舉
// ===========================================

enum ProcessingStage {
  RECEIVED                  // 已接收 - 文件已進入系統
  UPLOADED                  // 已上傳 - 文件已存儲
  OCR_PROCESSING            // OCR 處理 - 文字識別中
  AI_EXTRACTION             // AI 提取 - 欄位提取中
  FORWARDER_IDENTIFICATION  // Forwarder 識別 - 識別貨代
  FIELD_MAPPING             // 欄位映射 - 映射至標準欄位
  VALIDATION                // 驗證 - 資料驗證中
  REVIEW_PENDING            // 待審核 - 等待人工審核
  REVIEW_COMPLETED          // 審核完成 - 人工審核已完成
  COMPLETED                 // 完成 - 全部處理完成
}

// ===========================================
// 階段狀態枚舉
// ===========================================

enum StageStatus {
  PENDING       // 等待中 - 尚未開始
  IN_PROGRESS   // 處理中 - 正在執行
  COMPLETED     // 完成 - 成功完成
  FAILED        // 失敗 - 執行失敗
  SKIPPED       // 跳過 - 不需要此階段
}

// ===========================================
// Document 模型擴展
// ===========================================

model Document {
  // ... 現有欄位 ...

  // 來源追蹤（擴展）
  sourceType          String?         // 'MANUAL_UPLOAD' | 'N8N_WORKFLOW' | 'API' | 'SHAREPOINT' | 'OUTLOOK'
  sourceMetadata      Json?           // 來源詳細資訊 (DocumentSourceMetadataSchema)

  // 工作流關聯
  workflowExecutionId String?
  workflowExecution   WorkflowExecution? @relation(fields: [workflowExecutionId], references: [id])

  // 處理階段關聯
  processingStages    DocumentProcessingStage[]

  // 處理統計
  processingDuration  Int?            // 總處理時間（毫秒）
  processingStartedAt DateTime?       // 處理開始時間
  processingEndedAt   DateTime?       // 處理結束時間

  @@index([sourceType])
  @@index([workflowExecutionId])
}
```

### 2.2 JSON Schema 定義

```typescript
// ===========================================
// 階段結果 Schema
// ===========================================

interface StageResultSchema {
  // OCR 階段結果
  ocr?: {
    confidence: number          // 整體信心度 (0-1)
    pageCount: number           // 處理頁數
    charactersExtracted: number // 提取字元數
    language?: string           // 偵測語言
  }

  // AI 提取階段結果
  aiExtraction?: {
    fieldsExtracted: number     // 提取欄位數
    confidence: number          // 平均信心度 (0-1)
    modelUsed: string           // 使用的模型
    tokensUsed?: number         // Token 使用量
  }

  // Forwarder 識別結果
  forwarderIdentification?: {
    forwarderId?: string        // 識別的 Forwarder ID
    forwarderName?: string      // Forwarder 名稱
    confidence: number          // 信心度 (0-1)
    matchMethod: string         // 匹配方法
  }

  // 欄位映射結果
  fieldMapping?: {
    mappedFields: number        // 映射成功欄位數
    unmappedFields: number      // 未映射欄位數
    autoMapped: number          // 自動映射數
    manualRequired: number      // 需手動映射數
  }

  // 驗證結果
  validation?: {
    passed: boolean             // 是否通過
    errorsCount: number         // 錯誤數
    warningsCount: number       // 警告數
    rules: Array<{
      rule: string
      passed: boolean
      message?: string
    }>
  }

  // 審核結果
  review?: {
    reviewerId?: string         // 審核者 ID
    reviewerName?: string       // 審核者名稱
    decision: string            // 'APPROVED' | 'REJECTED' | 'NEEDS_REVISION'
    changesCount?: number       // 修改欄位數
    comments?: string           // 審核備註
  }

  // 通用結果
  summary?: string              // 結果摘要
  details?: Record<string, unknown> // 其他詳細資料
}

// ===========================================
// 階段元資料 Schema
// ===========================================

interface StageMetadataSchema {
  // 重試資訊
  retryCount?: number           // 重試次數
  lastRetryAt?: string          // 最後重試時間

  // 性能資訊
  queueWaitMs?: number          // 佇列等待時間
  actualProcessingMs?: number   // 實際處理時間

  // 來源追蹤
  triggeredBy?: string          // 觸發者（user/system/workflow）
  triggeredAt?: string          // 觸發時間
  workflowStepId?: string       // 對應的工作流步驟 ID

  // 關聯資訊
  relatedDocumentIds?: string[] // 相關文件 ID（批次處理）
  parentStageId?: string        // 父階段 ID（階段重做）
}

// ===========================================
// 文件來源元資料 Schema
// ===========================================

interface DocumentSourceMetadataSchema {
  // n8n 來源
  n8n?: {
    workflowId: string          // 工作流 ID
    workflowName: string        // 工作流名稱
    executionId: string         // 執行 ID
    nodeId?: string             // 節點 ID
    triggeredAt: string         // 觸發時間
  }

  // API 來源
  api?: {
    clientId?: string           // API 客戶端 ID
    requestId: string           // 請求 ID
    endpoint: string            // 呼叫端點
  }

  // SharePoint 來源
  sharepoint?: {
    siteId: string              // 網站 ID
    driveId: string             // 驅動器 ID
    itemId: string              // 項目 ID
    webUrl: string              // Web URL
  }

  // Outlook 來源
  outlook?: {
    messageId: string           // 郵件 ID
    subject: string             // 郵件主旨
    sender: string              // 寄件者
    receivedAt: string          // 收件時間
    attachmentName: string      // 附件名稱
  }

  // 手動上傳來源
  manual?: {
    uploadedBy: string          // 上傳者 ID
    uploadedAt: string          // 上傳時間
    uploadMethod: string        // 'drag-drop' | 'file-picker' | 'paste'
  }
}
```

### 2.3 索引策略

```sql
-- 複合索引：文件進度查詢
CREATE INDEX idx_processing_stages_document_order
ON document_processing_stages(document_id, stage_order);

-- 複合索引：狀態監控
CREATE INDEX idx_processing_stages_status_created
ON document_processing_stages(status, created_at DESC);

-- 複合索引：來源追蹤查詢
CREATE INDEX idx_processing_stages_source
ON document_processing_stages(source_type, source_id)
WHERE source_type IS NOT NULL;

-- 部分索引：進行中的階段（用於即時監控）
CREATE INDEX idx_processing_stages_in_progress
ON document_processing_stages(document_id, stage)
WHERE status = 'IN_PROGRESS';

-- 文件來源查詢
CREATE INDEX idx_documents_source_workflow
ON documents(source_type, workflow_execution_id)
WHERE source_type IS NOT NULL;
```

---

## 3. 類型定義

### 3.1 核心類型

```typescript
// lib/types/documentProgress.ts

import { ProcessingStage, StageStatus, Document } from '@prisma/client'

// ===========================================
// 階段配置
// ===========================================

export interface StageConfig {
  name: string              // 顯示名稱（中文）
  order: number             // 排序順序
  weight: number            // 進度權重（百分比貢獻）
  estimatedDurationMs: number // 預估持續時間
  canSkip: boolean          // 是否可跳過
  requiresReview: boolean   // 是否需要審核
}

export const STAGE_CONFIG: Record<ProcessingStage, StageConfig> = {
  RECEIVED: {
    name: '已接收',
    order: 1,
    weight: 5,
    estimatedDurationMs: 1000,
    canSkip: false,
    requiresReview: false,
  },
  UPLOADED: {
    name: '已上傳',
    order: 2,
    weight: 10,
    estimatedDurationMs: 5000,
    canSkip: false,
    requiresReview: false,
  },
  OCR_PROCESSING: {
    name: 'OCR 處理',
    order: 3,
    weight: 25,
    estimatedDurationMs: 30000,
    canSkip: false,
    requiresReview: false,
  },
  AI_EXTRACTION: {
    name: 'AI 提取',
    order: 4,
    weight: 30,
    estimatedDurationMs: 45000,
    canSkip: false,
    requiresReview: false,
  },
  FORWARDER_IDENTIFICATION: {
    name: 'Forwarder 識別',
    order: 5,
    weight: 10,
    estimatedDurationMs: 5000,
    canSkip: true,
    requiresReview: false,
  },
  FIELD_MAPPING: {
    name: '欄位映射',
    order: 6,
    weight: 10,
    estimatedDurationMs: 10000,
    canSkip: false,
    requiresReview: false,
  },
  VALIDATION: {
    name: '資料驗證',
    order: 7,
    weight: 5,
    estimatedDurationMs: 3000,
    canSkip: false,
    requiresReview: false,
  },
  REVIEW_PENDING: {
    name: '待審核',
    order: 8,
    weight: 0,
    estimatedDurationMs: 0, // 人工操作，無法預估
    canSkip: true,
    requiresReview: true,
  },
  REVIEW_COMPLETED: {
    name: '審核完成',
    order: 9,
    weight: 5,
    estimatedDurationMs: 1000,
    canSkip: true,
    requiresReview: false,
  },
  COMPLETED: {
    name: '完成',
    order: 10,
    weight: 0,
    estimatedDurationMs: 500,
    canSkip: false,
    requiresReview: false,
  },
}

// ===========================================
// 處理時間軸
// ===========================================

export interface ProcessingTimelineStage {
  stage: ProcessingStage
  stageName: string
  status: StageStatus
  startedAt?: Date
  completedAt?: Date
  durationMs?: number
  error?: string
  result?: StageResultSchema
}

export interface ProcessingTimelineSource {
  type: string                    // 'n8n' | 'api' | 'manual' | 'sharepoint' | 'outlook'
  workflowName?: string
  workflowExecutionId?: string
  triggeredAt?: Date
  displayLabel: string            // 顯示標籤
  displayIcon: string             // 顯示圖示
}

export interface ProcessingTimeline {
  documentId: string
  fileName: string
  fileSize: number
  mimeType: string
  cityCode: string

  // 當前狀態
  currentStage: ProcessingStage
  currentStatus: StageStatus
  progress: number                // 0-100

  // 時間估算
  estimatedRemainingMs?: number
  estimatedCompletionAt?: Date

  // 階段詳情
  stages: ProcessingTimelineStage[]

  // 來源資訊
  source: ProcessingTimelineSource

  // 統計
  totalDurationMs?: number
  startedAt?: Date
  completedAt?: Date
}

// ===========================================
// 即時進度更新
// ===========================================

export interface ProcessingProgress {
  documentId: string
  stage: ProcessingStage
  stageName: string
  progress: number                // 0-100
  stageProgress?: number          // 階段內進度 0-100
  estimatedRemainingMs?: number
  lastUpdatedAt: Date
  isComplete: boolean
  hasFailed: boolean
  failedStage?: ProcessingStage
  failedError?: string
}

// ===========================================
// 處理中的文件
// ===========================================

export interface ProcessingDocument {
  documentId: string
  fileName: string
  progress: number
  currentStage: ProcessingStage
  currentStageName: string
  startedAt: Date
  estimatedCompletionAt?: Date
  source: ProcessingTimelineSource
}

// ===========================================
// 處理統計
// ===========================================

export interface ProcessingStatistics {
  cityCode: string
  period: 'day' | 'week' | 'month'

  // 數量統計
  totalProcessed: number
  completedCount: number
  failedCount: number
  inProgressCount: number

  // 時間統計
  avgProcessingTimeMs: number
  minProcessingTimeMs: number
  maxProcessingTimeMs: number
  p95ProcessingTimeMs: number

  // 階段統計
  stageStatistics: Array<{
    stage: ProcessingStage
    avgDurationMs: number
    failureRate: number
    skipRate: number
  }>

  // 來源分布
  sourceDistribution: Array<{
    sourceType: string
    count: number
    percentage: number
  }>
}

// ===========================================
// API 請求/回應類型
// ===========================================

export interface GetProgressParams {
  documentId: string
  full?: boolean                  // true: 完整時間軸, false: 簡要進度
}

export interface GetProcessingDocumentsParams {
  cityCode?: string
  limit?: number
  sourceType?: string
}

export interface UpdateStageParams {
  documentId: string
  stage: ProcessingStage
  status: StageStatus
  result?: StageResultSchema
  error?: string
  sourceType?: string
  sourceId?: string
}

export interface InitializeStagesParams {
  documentId: string
  sourceType?: string
  sourceId?: string
  skipStages?: ProcessingStage[]  // 要跳過的階段
}
```

### 3.2 文件來源類型

```typescript
// lib/types/documentSource.ts

// ===========================================
// 來源類型枚舉
// ===========================================

export type DocumentSourceType =
  | 'MANUAL_UPLOAD'
  | 'N8N_WORKFLOW'
  | 'API'
  | 'SHAREPOINT'
  | 'OUTLOOK'

// ===========================================
// 來源配置
// ===========================================

export interface SourceTypeConfig {
  label: string                   // 顯示標籤
  icon: string                    // 圖示名稱
  color: 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'error'
  description: string             // 說明文字
}

export const SOURCE_TYPE_CONFIG: Record<DocumentSourceType, SourceTypeConfig> = {
  MANUAL_UPLOAD: {
    label: '手動上傳',
    icon: 'CloudUpload',
    color: 'default',
    description: '使用者透過網頁介面手動上傳的文件',
  },
  N8N_WORKFLOW: {
    label: 'n8n 工作流',
    icon: 'Workflow',
    color: 'primary',
    description: '透過 n8n 自動化工作流程提交的文件',
  },
  API: {
    label: 'API',
    icon: 'Api',
    color: 'secondary',
    description: '透過 REST API 直接提交的文件',
  },
  SHAREPOINT: {
    label: 'SharePoint',
    icon: 'Folder',
    color: 'success',
    description: '從 SharePoint 文件庫同步的文件',
  },
  OUTLOOK: {
    label: 'Outlook',
    icon: 'Email',
    color: 'warning',
    description: '從 Outlook 郵件附件擷取的文件',
  },
}

// ===========================================
// 來源徽章 Props
// ===========================================

export interface DocumentSourceBadgeProps {
  sourceType: DocumentSourceType
  workflowName?: string
  compact?: boolean
  showTooltip?: boolean
}
```

---

## 4. 服務實現

### 4.1 文件進度服務

```typescript
// lib/services/documentProgressService.ts

import { prisma } from '@/lib/prisma'
import { ProcessingStage, StageStatus, Prisma } from '@prisma/client'
import {
  ProcessingTimeline,
  ProcessingProgress,
  ProcessingDocument,
  ProcessingStatistics,
  ProcessingTimelineSource,
  STAGE_CONFIG,
  UpdateStageParams,
  InitializeStagesParams,
} from '@/lib/types/documentProgress'
import { SOURCE_TYPE_CONFIG, DocumentSourceType } from '@/lib/types/documentSource'

export class DocumentProgressService {
  // ===========================================
  // 公開方法
  // ===========================================

  /**
   * 獲取文件處理完整時間軸
   */
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
    const { currentStage, currentStatus, progress } = this.calculateProgress(
      document.processingStages
    )

    // 預估剩餘時間
    const estimatedRemainingMs = await this.estimateRemainingTime(
      document.cityCode,
      currentStage,
      progress
    )

    // 計算預估完成時間
    const estimatedCompletionAt = estimatedRemainingMs
      ? new Date(Date.now() + estimatedRemainingMs)
      : undefined

    // 構建來源資訊
    const source = this.buildSourceInfo(document)

    // 構建階段列表
    const stages = document.processingStages.map((stage) => ({
      stage: stage.stage,
      stageName: stage.stageName,
      status: stage.status,
      startedAt: stage.startedAt ?? undefined,
      completedAt: stage.completedAt ?? undefined,
      durationMs: stage.durationMs ?? undefined,
      error: stage.error ?? undefined,
      result: stage.result as any,
    }))

    return {
      documentId: document.id,
      fileName: document.fileName,
      fileSize: document.fileSize,
      mimeType: document.mimeType,
      cityCode: document.cityCode,
      currentStage,
      currentStatus,
      progress,
      estimatedRemainingMs,
      estimatedCompletionAt,
      stages,
      source,
      totalDurationMs: document.processingDuration ?? undefined,
      startedAt: document.processingStartedAt ?? undefined,
      completedAt: document.processingEndedAt ?? undefined,
    }
  }

  /**
   * 獲取即時進度更新（用於輪詢）
   */
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

    const { currentStage, currentStatus, progress } = this.calculateProgress(
      document.processingStages
    )
    const config = STAGE_CONFIG[currentStage]

    // 檢查是否失敗
    const failedStage = document.processingStages.find(
      (s) => s.status === StageStatus.FAILED
    )

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
      isComplete: progress >= 100 && currentStatus === StageStatus.COMPLETED,
      hasFailed: !!failedStage,
      failedStage: failedStage?.stage as ProcessingStage | undefined,
      failedError: failedStage?.error ?? undefined,
    }
  }

  /**
   * 更新處理階段
   */
  async updateProcessingStage(params: UpdateStageParams): Promise<void> {
    const { documentId, stage, status, result, error, sourceType, sourceId } = params
    const config = STAGE_CONFIG[stage]
    const now = new Date()

    await prisma.$transaction(async (tx) => {
      // 更新或建立階段記錄
      const existingStage = await tx.documentProcessingStage.findUnique({
        where: {
          documentId_stage: { documentId, stage },
        },
      })

      if (existingStage) {
        // 更新現有記錄
        const updateData: Prisma.DocumentProcessingStageUpdateInput = {
          status,
          updatedAt: now,
        }

        if (status === StageStatus.IN_PROGRESS && !existingStage.startedAt) {
          updateData.startedAt = now
        }

        if (
          [StageStatus.COMPLETED, StageStatus.FAILED, StageStatus.SKIPPED].includes(status)
        ) {
          updateData.completedAt = now

          // 計算持續時間
          if (existingStage.startedAt) {
            updateData.durationMs = now.getTime() - existingStage.startedAt.getTime()
          }
        }

        if (result) updateData.result = result as any
        if (error) updateData.error = error

        await tx.documentProcessingStage.update({
          where: { id: existingStage.id },
          data: updateData,
        })
      } else {
        // 建立新記錄
        await tx.documentProcessingStage.create({
          data: {
            documentId,
            stage,
            stageName: config.name,
            stageOrder: config.order,
            status,
            startedAt: status === StageStatus.IN_PROGRESS ? now : undefined,
            completedAt: [StageStatus.COMPLETED, StageStatus.FAILED, StageStatus.SKIPPED].includes(status)
              ? now
              : undefined,
            result: result as any,
            error,
            sourceType,
            sourceId,
          },
        })
      }

      // 更新文件的處理時間戳
      await this.updateDocumentTimestamps(tx, documentId, stage, status)
    })
  }

  /**
   * 初始化文件處理階段
   */
  async initializeProcessingStages(params: InitializeStagesParams): Promise<void> {
    const { documentId, sourceType, sourceId, skipStages = [] } = params

    const stages = Object.entries(STAGE_CONFIG).map(([stage, config]) => ({
      documentId,
      stage: stage as ProcessingStage,
      stageName: config.name,
      stageOrder: config.order,
      status: skipStages.includes(stage as ProcessingStage)
        ? StageStatus.SKIPPED
        : StageStatus.PENDING,
      sourceType,
      sourceId,
    }))

    await prisma.$transaction(async (tx) => {
      // 批次建立階段記錄
      await tx.documentProcessingStage.createMany({
        data: stages,
        skipDuplicates: true,
      })

      // 標記第一階段為已完成（已接收）
      await this.updateProcessingStage({
        documentId,
        stage: ProcessingStage.RECEIVED,
        status: StageStatus.COMPLETED,
        sourceType,
        sourceId,
      })

      // 更新文件處理開始時間
      await tx.document.update({
        where: { id: documentId },
        data: {
          processingStartedAt: new Date(),
          sourceType,
        },
      })
    })
  }

  /**
   * 獲取處理中的文件列表
   */
  async getProcessingDocuments(options: {
    cityCode?: string
    limit?: number
    sourceType?: string
  }): Promise<ProcessingDocument[]> {
    const { cityCode, limit = 20, sourceType } = options

    const documents = await prisma.document.findMany({
      where: {
        status: {
          in: ['PENDING', 'UPLOADING', 'OCR_PROCESSING', 'AI_EXTRACTING', 'VALIDATION'],
        },
        ...(cityCode && { cityCode }),
        ...(sourceType && { sourceType }),
      },
      include: {
        processingStages: {
          orderBy: { stageOrder: 'asc' },
        },
        workflowExecution: {
          select: {
            id: true,
            workflowName: true,
          },
        },
      },
      take: limit,
      orderBy: { createdAt: 'desc' },
    })

    return documents.map((doc) => {
      const { currentStage, progress } = this.calculateProgress(doc.processingStages)
      const config = STAGE_CONFIG[currentStage]

      // 計算預估完成時間
      const remainingWeight = this.getRemainingWeight(currentStage, progress)
      const avgTimePerWeight = 1000 // 預設每權重單位 1 秒
      const estimatedRemainingMs = remainingWeight * avgTimePerWeight
      const estimatedCompletionAt = new Date(Date.now() + estimatedRemainingMs)

      return {
        documentId: doc.id,
        fileName: doc.fileName,
        progress,
        currentStage,
        currentStageName: config.name,
        startedAt: doc.createdAt,
        estimatedCompletionAt,
        source: this.buildSourceInfo(doc),
      }
    })
  }

  /**
   * 獲取處理統計
   */
  async getProcessingStatistics(
    cityCode: string,
    period: 'day' | 'week' | 'month'
  ): Promise<ProcessingStatistics> {
    const now = new Date()
    let startDate: Date

    switch (period) {
      case 'day':
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000)
        break
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        break
      case 'month':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        break
    }

    // 基本統計
    const [counts, durationStats, stageStats, sourceStats] = await Promise.all([
      // 數量統計
      prisma.document.groupBy({
        by: ['status'],
        where: {
          cityCode,
          createdAt: { gte: startDate },
        },
        _count: true,
      }),

      // 時間統計
      prisma.document.aggregate({
        where: {
          cityCode,
          status: 'COMPLETED',
          createdAt: { gte: startDate },
          processingDuration: { not: null },
        },
        _avg: { processingDuration: true },
        _min: { processingDuration: true },
        _max: { processingDuration: true },
      }),

      // 階段統計
      prisma.documentProcessingStage.groupBy({
        by: ['stage', 'status'],
        where: {
          document: {
            cityCode,
            createdAt: { gte: startDate },
          },
        },
        _count: true,
        _avg: { durationMs: true },
      }),

      // 來源分布
      prisma.document.groupBy({
        by: ['sourceType'],
        where: {
          cityCode,
          createdAt: { gte: startDate },
        },
        _count: true,
      }),
    ])

    // 處理統計數據
    const totalProcessed = counts.reduce((sum, c) => sum + c._count, 0)
    const completedCount = counts.find((c) => c.status === 'COMPLETED')?._count || 0
    const failedCount = counts.find((c) => c.status === 'FAILED')?._count || 0
    const inProgressCount = totalProcessed - completedCount - failedCount

    // 階段統計處理
    const stageStatistics = Object.values(ProcessingStage).map((stage) => {
      const stageData = stageStats.filter((s) => s.stage === stage)
      const total = stageData.reduce((sum, s) => sum + s._count, 0)
      const failed = stageData.find((s) => s.status === 'FAILED')?._count || 0
      const skipped = stageData.find((s) => s.status === 'SKIPPED')?._count || 0
      const avgDuration = stageData.find((s) => s.status === 'COMPLETED')?._avg?.durationMs || 0

      return {
        stage,
        avgDurationMs: Math.round(avgDuration),
        failureRate: total > 0 ? failed / total : 0,
        skipRate: total > 0 ? skipped / total : 0,
      }
    })

    // 來源分布處理
    const sourceDistribution = sourceStats.map((s) => ({
      sourceType: s.sourceType || 'MANUAL_UPLOAD',
      count: s._count,
      percentage: totalProcessed > 0 ? (s._count / totalProcessed) * 100 : 0,
    }))

    return {
      cityCode,
      period,
      totalProcessed,
      completedCount,
      failedCount,
      inProgressCount,
      avgProcessingTimeMs: Math.round(durationStats._avg.processingDuration || 0),
      minProcessingTimeMs: durationStats._min.processingDuration || 0,
      maxProcessingTimeMs: durationStats._max.processingDuration || 0,
      p95ProcessingTimeMs: Math.round((durationStats._avg.processingDuration || 0) * 1.5), // 近似值
      stageStatistics,
      sourceDistribution,
    }
  }

  // ===========================================
  // 私有方法
  // ===========================================

  /**
   * 計算進度
   */
  private calculateProgress(stages: any[]): {
    currentStage: ProcessingStage
    currentStatus: StageStatus
    progress: number
  } {
    let totalWeight = 0
    let completedWeight = 0
    let currentStage: ProcessingStage = ProcessingStage.RECEIVED
    let currentStatus: StageStatus = StageStatus.PENDING

    // 計算總權重
    Object.values(STAGE_CONFIG).forEach((config) => {
      totalWeight += config.weight
    })

    // 計算完成的權重
    for (const stage of stages) {
      const config = STAGE_CONFIG[stage.stage as ProcessingStage]
      if (!config) continue

      switch (stage.status) {
        case StageStatus.COMPLETED:
        case StageStatus.SKIPPED:
          completedWeight += config.weight
          break

        case StageStatus.IN_PROGRESS:
          currentStage = stage.stage
          currentStatus = StageStatus.IN_PROGRESS
          // 進行中的階段算一半權重
          completedWeight += config.weight * 0.5
          break

        case StageStatus.PENDING:
          if (currentStatus !== StageStatus.IN_PROGRESS) {
            currentStage = stage.stage
            currentStatus = StageStatus.PENDING
          }
          break

        case StageStatus.FAILED:
          currentStage = stage.stage
          currentStatus = StageStatus.FAILED
          return { currentStage, currentStatus, progress: Math.round((completedWeight / totalWeight) * 100) }
      }
    }

    // 如果所有階段都完成
    const allCompleted = stages.every(
      (s) => s.status === StageStatus.COMPLETED || s.status === StageStatus.SKIPPED
    )
    if (allCompleted && stages.length > 0) {
      currentStage = ProcessingStage.COMPLETED
      currentStatus = StageStatus.COMPLETED
    }

    const progress = totalWeight > 0 ? Math.round((completedWeight / totalWeight) * 100) : 0

    return { currentStage, currentStatus, progress: Math.min(progress, 100) }
  }

  /**
   * 預估剩餘時間
   */
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

    if (!avgDuration._avg.processingDuration) {
      // 使用預設估算
      const remainingWeight = this.getRemainingWeight(currentStage, currentProgress)
      return remainingWeight * 1000 // 每權重單位預設 1 秒
    }

    const avgTotalMs = avgDuration._avg.processingDuration
    const remainingPercentage = (100 - currentProgress) / 100

    return Math.round(avgTotalMs * remainingPercentage)
  }

  /**
   * 計算剩餘權重
   */
  private getRemainingWeight(
    currentStage: ProcessingStage,
    currentProgress: number
  ): number {
    const currentConfig = STAGE_CONFIG[currentStage]
    let remainingWeight = 0
    let foundCurrent = false

    for (const [stage, config] of Object.entries(STAGE_CONFIG)) {
      if (stage === currentStage) {
        foundCurrent = true
        // 當前階段的剩餘權重
        remainingWeight += config.weight * 0.5
      } else if (foundCurrent) {
        remainingWeight += config.weight
      }
    }

    return remainingWeight
  }

  /**
   * 構建來源資訊
   */
  private buildSourceInfo(document: any): ProcessingTimelineSource {
    const sourceType = (document.sourceType || 'MANUAL_UPLOAD') as DocumentSourceType
    const sourceConfig = SOURCE_TYPE_CONFIG[sourceType] || SOURCE_TYPE_CONFIG.MANUAL_UPLOAD
    const sourceMetadata = document.sourceMetadata as Record<string, any> | null

    return {
      type: sourceType,
      workflowName:
        document.workflowExecution?.workflowName ||
        sourceMetadata?.n8n?.workflowName ||
        undefined,
      workflowExecutionId:
        document.workflowExecution?.id ||
        sourceMetadata?.n8n?.executionId ||
        undefined,
      triggeredAt:
        document.workflowExecution?.startedAt ||
        (sourceMetadata?.n8n?.triggeredAt
          ? new Date(sourceMetadata.n8n.triggeredAt)
          : undefined),
      displayLabel: sourceConfig.label,
      displayIcon: sourceConfig.icon,
    }
  }

  /**
   * 更新文件時間戳
   */
  private async updateDocumentTimestamps(
    tx: Prisma.TransactionClient,
    documentId: string,
    stage: ProcessingStage,
    status: StageStatus
  ): Promise<void> {
    const now = new Date()

    // 如果是第一個開始的階段，更新處理開始時間
    if (stage === ProcessingStage.UPLOADED && status === StageStatus.IN_PROGRESS) {
      await tx.document.update({
        where: { id: documentId },
        data: { processingStartedAt: now },
      })
    }

    // 如果是完成階段，更新處理結束時間和總時長
    if (stage === ProcessingStage.COMPLETED && status === StageStatus.COMPLETED) {
      const document = await tx.document.findUnique({
        where: { id: documentId },
        select: { processingStartedAt: true },
      })

      const processingDuration = document?.processingStartedAt
        ? now.getTime() - document.processingStartedAt.getTime()
        : undefined

      await tx.document.update({
        where: { id: documentId },
        data: {
          processingEndedAt: now,
          processingDuration,
        },
      })
    }
  }
}

// 匯出單例
export const documentProgressService = new DocumentProgressService()
```

### 4.2 進度事件發送器

```typescript
// lib/services/progressEventEmitter.ts

import { ProcessingStage, StageStatus } from '@prisma/client'
import { documentProgressService } from './documentProgressService'

export interface ProgressEvent {
  documentId: string
  stage: ProcessingStage
  status: StageStatus
  progress: number
  stageName: string
  timestamp: Date
}

type ProgressEventHandler = (event: ProgressEvent) => void

/**
 * 進度事件發送器
 * 用於在處理過程中發送即時進度更新
 */
export class ProgressEventEmitter {
  private handlers: Map<string, Set<ProgressEventHandler>> = new Map()

  /**
   * 訂閱文件進度事件
   */
  subscribe(documentId: string, handler: ProgressEventHandler): () => void {
    if (!this.handlers.has(documentId)) {
      this.handlers.set(documentId, new Set())
    }
    this.handlers.get(documentId)!.add(handler)

    // 返回取消訂閱函數
    return () => {
      this.handlers.get(documentId)?.delete(handler)
      if (this.handlers.get(documentId)?.size === 0) {
        this.handlers.delete(documentId)
      }
    }
  }

  /**
   * 發送進度事件
   */
  async emit(
    documentId: string,
    stage: ProcessingStage,
    status: StageStatus
  ): Promise<void> {
    const handlers = this.handlers.get(documentId)
    if (!handlers || handlers.size === 0) return

    // 獲取最新進度
    const progress = await documentProgressService.getProgressUpdate(documentId)
    if (!progress) return

    const event: ProgressEvent = {
      documentId,
      stage,
      status,
      progress: progress.progress,
      stageName: progress.stageName,
      timestamp: new Date(),
    }

    // 通知所有訂閱者
    handlers.forEach((handler) => {
      try {
        handler(event)
      } catch (error) {
        console.error('Progress event handler error:', error)
      }
    })
  }

  /**
   * 獲取訂閱數量
   */
  getSubscriberCount(documentId: string): number {
    return this.handlers.get(documentId)?.size || 0
  }
}

// 匯出單例
export const progressEventEmitter = new ProgressEventEmitter()
```

---

## 5. API 路由

### 5.1 文件進度 API

```typescript
// app/api/documents/[id]/progress/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { documentProgressService } from '@/lib/services/documentProgressService'
import { getUserCityAccess } from '@/lib/utils/permissions'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/documents/[id]/progress
 * 獲取文件處理進度
 *
 * Query Parameters:
 * - full: boolean - 是否返回完整時間軸（預設 false）
 *
 * Response:
 * - 200: { data: ProcessingTimeline | ProcessingProgress }
 * - 401: Unauthorized
 * - 403: Access denied
 * - 404: Document not found
 * - 500: Internal server error
 */
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

### 5.2 處理中文件列表 API

```typescript
// app/api/documents/processing/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { documentProgressService } from '@/lib/services/documentProgressService'
import { getUserCityAccess } from '@/lib/utils/permissions'

/**
 * GET /api/documents/processing
 * 獲取處理中的文件列表
 *
 * Query Parameters:
 * - cityCode: string - 城市代碼（可選）
 * - limit: number - 返回數量限制（預設 20）
 * - sourceType: string - 來源類型篩選（可選）
 *
 * Response:
 * - 200: { data: ProcessingDocument[] }
 * - 401: Unauthorized
 * - 403: Access denied
 * - 500: Internal server error
 */
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const searchParams = request.nextUrl.searchParams
  const cityCode = searchParams.get('cityCode') || undefined
  const limit = parseInt(searchParams.get('limit') || '20', 10)
  const sourceType = searchParams.get('sourceType') || undefined

  // 驗證城市權限
  const userCities = await getUserCityAccess(session.user)
  if (cityCode && !userCities.includes(cityCode) && !userCities.includes('*')) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 })
  }

  try {
    const documents = await documentProgressService.getProcessingDocuments({
      cityCode: cityCode || (userCities.includes('*') ? undefined : userCities[0]),
      limit: Math.min(limit, 100), // 最多 100 筆
      sourceType,
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

### 5.3 處理統計 API

```typescript
// app/api/documents/processing/stats/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { documentProgressService } from '@/lib/services/documentProgressService'
import { getUserCityAccess } from '@/lib/utils/permissions'

/**
 * GET /api/documents/processing/stats
 * 獲取處理統計
 *
 * Query Parameters:
 * - cityCode: string - 城市代碼（必填）
 * - period: 'day' | 'week' | 'month' - 統計週期（預設 'day'）
 *
 * Response:
 * - 200: { data: ProcessingStatistics }
 * - 400: Missing cityCode
 * - 401: Unauthorized
 * - 403: Access denied
 * - 500: Internal server error
 */
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const searchParams = request.nextUrl.searchParams
  const cityCode = searchParams.get('cityCode')
  const period = (searchParams.get('period') || 'day') as 'day' | 'week' | 'month'

  if (!cityCode) {
    return NextResponse.json({ error: 'cityCode is required' }, { status: 400 })
  }

  // 驗證城市權限
  const userCities = await getUserCityAccess(session.user)
  if (!userCities.includes(cityCode) && !userCities.includes('*')) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 })
  }

  // 驗證週期參數
  if (!['day', 'week', 'month'].includes(period)) {
    return NextResponse.json(
      { error: 'Invalid period. Must be day, week, or month' },
      { status: 400 }
    )
  }

  try {
    const statistics = await documentProgressService.getProcessingStatistics(
      cityCode,
      period
    )

    return NextResponse.json({ data: statistics })
  } catch (error) {
    console.error('Get processing statistics error:', error)
    return NextResponse.json(
      { error: 'Failed to get processing statistics' },
      { status: 500 }
    )
  }
}
```

### 5.4 內部階段更新 API

```typescript
// app/api/internal/documents/[id]/stage/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { documentProgressService } from '@/lib/services/documentProgressService'
import { ProcessingStage, StageStatus } from '@prisma/client'
import { z } from 'zod'

// 內部 API 金鑰驗證
const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY

// 請求 Schema
const UpdateStageSchema = z.object({
  stage: z.nativeEnum(ProcessingStage),
  status: z.nativeEnum(StageStatus),
  result: z.record(z.unknown()).optional(),
  error: z.string().optional(),
  sourceType: z.string().optional(),
  sourceId: z.string().optional(),
})

/**
 * POST /api/internal/documents/[id]/stage
 * 更新文件處理階段（內部使用）
 *
 * Headers:
 * - X-Internal-API-Key: string - 內部 API 金鑰
 *
 * Body:
 * - stage: ProcessingStage
 * - status: StageStatus
 * - result?: object
 * - error?: string
 * - sourceType?: string
 * - sourceId?: string
 *
 * Response:
 * - 200: { success: true }
 * - 400: Validation error
 * - 401: Unauthorized
 * - 500: Internal server error
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  // 驗證內部 API 金鑰
  const headersList = headers()
  const apiKey = headersList.get('X-Internal-API-Key')

  if (!apiKey || apiKey !== INTERNAL_API_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const validated = UpdateStageSchema.parse(body)

    await documentProgressService.updateProcessingStage({
      documentId: params.id,
      ...validated,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Update document stage error:', error)
    return NextResponse.json(
      { error: 'Failed to update document stage' },
      { status: 500 }
    )
  }
}
```

---

## 6. 前端組件

### 6.1 文件處理時間軸組件

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
  Alert,
  Button,
} from '@mui/material'
import {
  CheckCircle,
  Error,
  HourglassEmpty,
  PlayCircle,
  SkipNext,
  Refresh,
  OpenInNew,
} from '@mui/icons-material'
import { formatDistanceToNow, format } from 'date-fns'
import { zhTW } from 'date-fns/locale'
import Link from 'next/link'

import { ProcessingTimeline, ProcessingTimelineStage } from '@/lib/types/documentProgress'
import { DocumentSourceBadge } from './DocumentSourceBadge'

// ===========================================
// Props
// ===========================================

interface DocumentProcessingTimelineProps {
  timeline: ProcessingTimeline
  onRefresh?: () => void
  isRefreshing?: boolean
}

// ===========================================
// 常數
// ===========================================

const STATUS_ICON: Record<string, React.ReactNode> = {
  PENDING: <HourglassEmpty color="disabled" />,
  IN_PROGRESS: <PlayCircle color="primary" />,
  COMPLETED: <CheckCircle color="success" />,
  FAILED: <Error color="error" />,
  SKIPPED: <SkipNext color="disabled" />,
}

// ===========================================
// 輔助函數
// ===========================================

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)} 秒`
  const minutes = Math.floor(ms / 60000)
  const seconds = Math.floor((ms % 60000) / 1000)
  return `${minutes} 分 ${seconds} 秒`
}

function formatEstimatedTime(ms: number): string {
  if (ms < 60000) return '不到 1 分鐘'
  const minutes = Math.ceil(ms / 60000)
  if (minutes === 1) return '約 1 分鐘'
  return `約 ${minutes} 分鐘`
}

// ===========================================
// 子組件：進度區塊
// ===========================================

interface ProgressSectionProps {
  progress: number
  estimatedRemainingMs?: number
  currentStatus: string
}

function ProgressSection({
  progress,
  estimatedRemainingMs,
  currentStatus,
}: ProgressSectionProps) {
  const isInProgress = currentStatus === 'IN_PROGRESS'
  const isComplete = progress >= 100

  return (
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
        variant={isInProgress ? 'buffer' : 'determinate'}
        value={progress}
        valueBuffer={isInProgress ? Math.min(progress + 10, 100) : progress}
        sx={{
          height: 8,
          borderRadius: 4,
          '& .MuiLinearProgress-bar': {
            borderRadius: 4,
            backgroundColor: isComplete ? 'success.main' : undefined,
          },
        }}
      />

      {estimatedRemainingMs && isInProgress && (
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ mt: 0.5, display: 'block' }}
        >
          預估剩餘時間：{formatEstimatedTime(estimatedRemainingMs)}
        </Typography>
      )}
    </Box>
  )
}

// ===========================================
// 子組件：階段內容
// ===========================================

interface StageContentProps {
  stage: ProcessingTimelineStage
}

function StageContent({ stage }: StageContentProps) {
  if (stage.status === 'IN_PROGRESS') {
    return (
      <Box sx={{ mb: 1 }}>
        <LinearProgress sx={{ mb: 1 }} />
        <Typography variant="caption" color="text.secondary">
          處理中...
        </Typography>
      </Box>
    )
  }

  if (stage.error) {
    return (
      <Alert severity="error" sx={{ mb: 1 }}>
        <Typography variant="body2">{stage.error}</Typography>
      </Alert>
    )
  }

  // 顯示階段結果摘要
  if (stage.result?.summary) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
        {stage.result.summary}
      </Typography>
    )
  }

  return null
}

// ===========================================
// 主組件
// ===========================================

export function DocumentProcessingTimeline({
  timeline,
  onRefresh,
  isRefreshing,
}: DocumentProcessingTimelineProps) {
  // 找到當前階段的索引
  const activeStep = timeline.stages.findIndex(
    (s) => s.status === 'IN_PROGRESS' || s.status === 'PENDING'
  )

  const hasFailed = timeline.currentStatus === 'FAILED'
  const isComplete = timeline.progress >= 100

  return (
    <Paper sx={{ p: 3 }}>
      {/* 標題和來源資訊 */}
      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Box>
            <Typography variant="h6" gutterBottom>
              {timeline.fileName}
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
              <DocumentSourceBadge
                sourceType={timeline.source.type as any}
                workflowName={timeline.source.workflowName}
              />
              {timeline.source.triggeredAt && (
                <Typography variant="caption" color="text.secondary">
                  觸發於{' '}
                  {formatDistanceToNow(new Date(timeline.source.triggeredAt), {
                    addSuffix: true,
                    locale: zhTW,
                  })}
                </Typography>
              )}
            </Box>
          </Box>

          {onRefresh && (
            <Tooltip title="重新整理">
              <Button
                size="small"
                onClick={onRefresh}
                disabled={isRefreshing}
                startIcon={<Refresh />}
              >
                {isRefreshing ? '更新中...' : '重新整理'}
              </Button>
            </Tooltip>
          )}
        </Box>
      </Box>

      {/* 失敗警告 */}
      {hasFailed && (
        <Alert severity="error" sx={{ mb: 3 }}>
          處理過程中發生錯誤，請查看下方詳細資訊
        </Alert>
      )}

      {/* 完成提示 */}
      {isComplete && !hasFailed && (
        <Alert
          severity="success"
          sx={{ mb: 3 }}
          action={
            <Button
              component={Link}
              href={`/documents/${timeline.documentId}/review`}
              size="small"
              endIcon={<OpenInNew />}
            >
              前往審核
            </Button>
          }
        >
          文件處理完成
          {timeline.totalDurationMs && (
            <Typography variant="caption" display="block">
              總耗時：{formatDuration(timeline.totalDurationMs)}
            </Typography>
          )}
        </Alert>
      )}

      {/* 進度條 */}
      <ProgressSection
        progress={timeline.progress}
        estimatedRemainingMs={timeline.estimatedRemainingMs}
        currentStatus={timeline.currentStatus}
      />

      {/* 處理步驟 */}
      <Stepper
        activeStep={activeStep >= 0 ? activeStep : timeline.stages.length}
        orientation="vertical"
      >
        {timeline.stages.map((stage) => (
          <Step
            key={stage.stage}
            completed={stage.status === 'COMPLETED' || stage.status === 'SKIPPED'}
          >
            <StepLabel
              icon={STATUS_ICON[stage.status]}
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
                <span>{stage.stageName}</span>
                {stage.durationMs && stage.status === 'COMPLETED' && (
                  <Chip
                    label={formatDuration(stage.durationMs)}
                    size="small"
                    variant="outlined"
                    sx={{ height: 20, fontSize: '0.7rem' }}
                  />
                )}
                {stage.status === 'SKIPPED' && (
                  <Chip
                    label="已跳過"
                    size="small"
                    variant="outlined"
                    color="default"
                    sx={{ height: 20, fontSize: '0.7rem' }}
                  />
                )}
              </Box>
            </StepLabel>
            <StepContent>
              <StageContent stage={stage} />
            </StepContent>
          </Step>
        ))}
      </Stepper>
    </Paper>
  )
}
```

### 6.2 文件來源徽章組件

```typescript
// components/document/DocumentSourceBadge.tsx

'use client'

import React from 'react'
import { Chip, Tooltip, Box, SvgIcon } from '@mui/material'
import {
  CloudUpload,
  Api,
  Email,
  Folder,
} from '@mui/icons-material'

import { DocumentSourceType, SOURCE_TYPE_CONFIG } from '@/lib/types/documentSource'

// ===========================================
// 自定義圖示：Workflow
// ===========================================

function WorkflowIcon(props: React.ComponentProps<typeof SvgIcon>) {
  return (
    <SvgIcon {...props} viewBox="0 0 24 24">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" />
    </SvgIcon>
  )
}

// ===========================================
// Props
// ===========================================

interface DocumentSourceBadgeProps {
  sourceType: DocumentSourceType
  workflowName?: string
  compact?: boolean
  showTooltip?: boolean
}

// ===========================================
// 圖示對應
// ===========================================

const SOURCE_ICONS: Record<DocumentSourceType, React.ReactNode> = {
  MANUAL_UPLOAD: <CloudUpload fontSize="small" />,
  N8N_WORKFLOW: <WorkflowIcon fontSize="small" />,
  API: <Api fontSize="small" />,
  SHAREPOINT: <Folder fontSize="small" />,
  OUTLOOK: <Email fontSize="small" />,
}

// ===========================================
// 組件
// ===========================================

export function DocumentSourceBadge({
  sourceType,
  workflowName,
  compact = false,
  showTooltip = true,
}: DocumentSourceBadgeProps) {
  const config = SOURCE_TYPE_CONFIG[sourceType] || SOURCE_TYPE_CONFIG.MANUAL_UPLOAD
  const icon = SOURCE_ICONS[sourceType] || SOURCE_ICONS.MANUAL_UPLOAD

  const tooltipContent = workflowName
    ? `${config.label}: ${workflowName}`
    : config.description

  // 緊湊模式：只顯示圖示
  if (compact) {
    const iconElement = (
      <Box
        component="span"
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          color: `${config.color}.main`,
        }}
      >
        {icon}
      </Box>
    )

    if (showTooltip) {
      return <Tooltip title={tooltipContent}>{iconElement}</Tooltip>
    }

    return iconElement
  }

  // 完整模式：顯示 Chip
  const chipElement = (
    <Chip
      icon={icon as React.ReactElement}
      label={config.label}
      color={config.color}
      size="small"
      variant="outlined"
    />
  )

  if (showTooltip && workflowName) {
    return <Tooltip title={workflowName}>{chipElement}</Tooltip>
  }

  return chipElement
}
```

### 6.3 處理中文件列表組件

```typescript
// components/document/ProcessingDocumentsList.tsx

'use client'

import React from 'react'
import {
  Box,
  Paper,
  Typography,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  LinearProgress,
  Chip,
  Skeleton,
  Alert,
} from '@mui/material'
import { Description, AccessTime } from '@mui/icons-material'
import { formatDistanceToNow } from 'date-fns'
import { zhTW } from 'date-fns/locale'
import Link from 'next/link'

import { useProcessingDocuments } from '@/hooks/useDocumentProgress'
import { DocumentSourceBadge } from './DocumentSourceBadge'

// ===========================================
// Props
// ===========================================

interface ProcessingDocumentsListProps {
  cityCode?: string
  limit?: number
  title?: string
  emptyMessage?: string
}

// ===========================================
// 組件
// ===========================================

export function ProcessingDocumentsList({
  cityCode,
  limit = 10,
  title = '處理中的文件',
  emptyMessage = '目前沒有正在處理的文件',
}: ProcessingDocumentsListProps) {
  const { documents, isLoading, error } = useProcessingDocuments({
    cityCode,
    limit,
    refreshInterval: 5000, // 5 秒自動刷新
  })

  if (isLoading) {
    return (
      <Paper sx={{ p: 2 }}>
        <Typography variant="h6" gutterBottom>
          {title}
        </Typography>
        {[1, 2, 3].map((i) => (
          <Box key={i} sx={{ mb: 2 }}>
            <Skeleton variant="rectangular" height={60} />
          </Box>
        ))}
      </Paper>
    )
  }

  if (error) {
    return (
      <Paper sx={{ p: 2 }}>
        <Typography variant="h6" gutterBottom>
          {title}
        </Typography>
        <Alert severity="error">載入失敗，請稍後再試</Alert>
      </Paper>
    )
  }

  return (
    <Paper sx={{ p: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">{title}</Typography>
        {documents && documents.length > 0 && (
          <Chip label={`${documents.length} 個`} size="small" color="primary" />
        )}
      </Box>

      {!documents || documents.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
          {emptyMessage}
        </Typography>
      ) : (
        <List disablePadding>
          {documents.map((doc, index) => (
            <ListItem
              key={doc.documentId}
              component={Link}
              href={`/documents/${doc.documentId}`}
              divider={index < documents.length - 1}
              sx={{
                py: 2,
                '&:hover': { bgcolor: 'action.hover' },
                cursor: 'pointer',
                textDecoration: 'none',
                color: 'inherit',
              }}
            >
              <ListItemIcon>
                <Description color="action" />
              </ListItemIcon>
              <ListItemText
                primary={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="body2" noWrap sx={{ maxWidth: 200 }}>
                      {doc.fileName}
                    </Typography>
                    <DocumentSourceBadge
                      sourceType={doc.source.type as any}
                      compact
                    />
                  </Box>
                }
                secondary={
                  <Box sx={{ mt: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                      <Typography variant="caption" color="text.secondary">
                        {doc.currentStageName}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        •
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {doc.progress}%
                      </Typography>
                    </Box>
                    <LinearProgress
                      variant="determinate"
                      value={doc.progress}
                      sx={{ height: 4, borderRadius: 2 }}
                    />
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                      <AccessTime fontSize="inherit" sx={{ fontSize: 12, color: 'text.disabled' }} />
                      <Typography variant="caption" color="text.secondary">
                        {formatDistanceToNow(new Date(doc.startedAt), {
                          addSuffix: true,
                          locale: zhTW,
                        })}
                      </Typography>
                    </Box>
                  </Box>
                }
              />
              <Chip
                label={`${doc.progress}%`}
                size="small"
                color={doc.progress >= 80 ? 'success' : doc.progress >= 50 ? 'warning' : 'default'}
                variant="outlined"
              />
            </ListItem>
          ))}
        </List>
      )}
    </Paper>
  )
}
```

### 6.4 React Query Hooks

```typescript
// hooks/useDocumentProgress.ts

import useSWR from 'swr'
import {
  ProcessingTimeline,
  ProcessingProgress,
  ProcessingDocument,
  ProcessingStatistics,
} from '@/lib/types/documentProgress'

// ===========================================
// 通用 Fetcher
// ===========================================

async function fetcher<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(error.error || 'Request failed')
  }
  const json = await res.json()
  return json.data
}

// ===========================================
// 文件進度 Hook
// ===========================================

interface UseDocumentProgressOptions {
  documentId: string
  refreshInterval?: number
  enabled?: boolean
}

export function useDocumentProgress({
  documentId,
  refreshInterval = 3000,
  enabled = true,
}: UseDocumentProgressOptions) {
  const { data, error, isLoading, mutate } = useSWR<ProcessingProgress>(
    enabled ? `/api/documents/${documentId}/progress` : null,
    fetcher,
    {
      refreshInterval: enabled && data?.progress !== undefined && data.progress < 100
        ? refreshInterval
        : 0,
      revalidateOnFocus: true,
    }
  )

  return {
    progress: data ?? null,
    isLoading,
    error,
    refresh: mutate,
    isPolling: enabled && data?.progress !== undefined && data.progress < 100,
  }
}

// ===========================================
// 文件時間軸 Hook
// ===========================================

export function useDocumentTimeline(documentId: string, enabled = true) {
  const { data, error, isLoading, mutate } = useSWR<ProcessingTimeline>(
    enabled ? `/api/documents/${documentId}/progress?full=true` : null,
    fetcher,
    {
      revalidateOnFocus: true,
    }
  )

  return {
    timeline: data ?? null,
    isLoading,
    error,
    refresh: mutate,
  }
}

// ===========================================
// 處理中文件列表 Hook
// ===========================================

interface UseProcessingDocumentsOptions {
  cityCode?: string
  limit?: number
  sourceType?: string
  refreshInterval?: number
  enabled?: boolean
}

export function useProcessingDocuments({
  cityCode,
  limit = 20,
  sourceType,
  refreshInterval = 10000,
  enabled = true,
}: UseProcessingDocumentsOptions = {}) {
  const params = new URLSearchParams()
  if (cityCode) params.set('cityCode', cityCode)
  if (limit) params.set('limit', String(limit))
  if (sourceType) params.set('sourceType', sourceType)

  const queryString = params.toString()
  const url = `/api/documents/processing${queryString ? `?${queryString}` : ''}`

  const { data, error, isLoading, mutate } = useSWR<ProcessingDocument[]>(
    enabled ? url : null,
    fetcher,
    {
      refreshInterval: enabled ? refreshInterval : 0,
      revalidateOnFocus: true,
    }
  )

  return {
    documents: data ?? null,
    isLoading,
    error,
    refresh: mutate,
  }
}

// ===========================================
// 處理統計 Hook
// ===========================================

interface UseProcessingStatisticsOptions {
  cityCode: string
  period?: 'day' | 'week' | 'month'
  enabled?: boolean
}

export function useProcessingStatistics({
  cityCode,
  period = 'day',
  enabled = true,
}: UseProcessingStatisticsOptions) {
  const url = `/api/documents/processing/stats?cityCode=${cityCode}&period=${period}`

  const { data, error, isLoading, mutate } = useSWR<ProcessingStatistics>(
    enabled && cityCode ? url : null,
    fetcher,
    {
      revalidateOnFocus: false,
      refreshInterval: 60000, // 每分鐘刷新一次
    }
  )

  return {
    statistics: data ?? null,
    isLoading,
    error,
    refresh: mutate,
  }
}
```

---

## 7. 測試計畫

### 7.1 單元測試

```typescript
// __tests__/services/documentProgressService.test.ts

import { documentProgressService } from '@/lib/services/documentProgressService'
import { prismaMock } from '@/lib/__mocks__/prisma'
import { ProcessingStage, StageStatus } from '@prisma/client'
import { STAGE_CONFIG } from '@/lib/types/documentProgress'

describe('DocumentProgressService', () => {
  describe('calculateProgress', () => {
    it('should return 0% for empty stages', () => {
      const result = (documentProgressService as any).calculateProgress([])
      expect(result.progress).toBe(0)
      expect(result.currentStage).toBe(ProcessingStage.RECEIVED)
    })

    it('should calculate progress correctly for partial completion', () => {
      const stages = [
        { stage: ProcessingStage.RECEIVED, status: StageStatus.COMPLETED },
        { stage: ProcessingStage.UPLOADED, status: StageStatus.COMPLETED },
        { stage: ProcessingStage.OCR_PROCESSING, status: StageStatus.IN_PROGRESS },
        { stage: ProcessingStage.AI_EXTRACTION, status: StageStatus.PENDING },
      ]

      const result = (documentProgressService as any).calculateProgress(stages)

      expect(result.currentStage).toBe(ProcessingStage.OCR_PROCESSING)
      expect(result.currentStatus).toBe(StageStatus.IN_PROGRESS)
      expect(result.progress).toBeGreaterThan(0)
      expect(result.progress).toBeLessThan(100)
    })

    it('should return 100% for all completed stages', () => {
      const stages = Object.values(ProcessingStage).map((stage) => ({
        stage,
        status: StageStatus.COMPLETED,
      }))

      const result = (documentProgressService as any).calculateProgress(stages)

      expect(result.progress).toBe(100)
      expect(result.currentStage).toBe(ProcessingStage.COMPLETED)
      expect(result.currentStatus).toBe(StageStatus.COMPLETED)
    })

    it('should handle skipped stages correctly', () => {
      const stages = [
        { stage: ProcessingStage.RECEIVED, status: StageStatus.COMPLETED },
        { stage: ProcessingStage.UPLOADED, status: StageStatus.COMPLETED },
        { stage: ProcessingStage.OCR_PROCESSING, status: StageStatus.SKIPPED },
        { stage: ProcessingStage.AI_EXTRACTION, status: StageStatus.IN_PROGRESS },
      ]

      const result = (documentProgressService as any).calculateProgress(stages)

      expect(result.currentStage).toBe(ProcessingStage.AI_EXTRACTION)
      expect(result.currentStatus).toBe(StageStatus.IN_PROGRESS)
      // 跳過的階段應計入完成權重
      expect(result.progress).toBeGreaterThan(15) // RECEIVED + UPLOADED + OCR = 5 + 10 + 25 = 40%
    })

    it('should stop at failed stage', () => {
      const stages = [
        { stage: ProcessingStage.RECEIVED, status: StageStatus.COMPLETED },
        { stage: ProcessingStage.UPLOADED, status: StageStatus.COMPLETED },
        { stage: ProcessingStage.OCR_PROCESSING, status: StageStatus.FAILED },
        { stage: ProcessingStage.AI_EXTRACTION, status: StageStatus.PENDING },
      ]

      const result = (documentProgressService as any).calculateProgress(stages)

      expect(result.currentStage).toBe(ProcessingStage.OCR_PROCESSING)
      expect(result.currentStatus).toBe(StageStatus.FAILED)
    })
  })

  describe('updateProcessingStage', () => {
    it('should create new stage record if not exists', async () => {
      prismaMock.documentProcessingStage.findUnique.mockResolvedValue(null)
      prismaMock.documentProcessingStage.create.mockResolvedValue({} as any)
      prismaMock.$transaction.mockImplementation((fn) => fn(prismaMock))

      await documentProgressService.updateProcessingStage({
        documentId: 'doc-1',
        stage: ProcessingStage.OCR_PROCESSING,
        status: StageStatus.IN_PROGRESS,
      })

      expect(prismaMock.documentProcessingStage.create).toHaveBeenCalled()
    })

    it('should update existing stage record', async () => {
      const existingStage = {
        id: 'stage-1',
        documentId: 'doc-1',
        stage: ProcessingStage.OCR_PROCESSING,
        status: StageStatus.IN_PROGRESS,
        startedAt: new Date(),
      }
      prismaMock.documentProcessingStage.findUnique.mockResolvedValue(existingStage as any)
      prismaMock.documentProcessingStage.update.mockResolvedValue({} as any)
      prismaMock.$transaction.mockImplementation((fn) => fn(prismaMock))

      await documentProgressService.updateProcessingStage({
        documentId: 'doc-1',
        stage: ProcessingStage.OCR_PROCESSING,
        status: StageStatus.COMPLETED,
      })

      expect(prismaMock.documentProcessingStage.update).toHaveBeenCalled()
    })

    it('should calculate duration when completing stage', async () => {
      const startTime = new Date(Date.now() - 5000) // 5 seconds ago
      const existingStage = {
        id: 'stage-1',
        documentId: 'doc-1',
        stage: ProcessingStage.OCR_PROCESSING,
        status: StageStatus.IN_PROGRESS,
        startedAt: startTime,
      }
      prismaMock.documentProcessingStage.findUnique.mockResolvedValue(existingStage as any)
      prismaMock.documentProcessingStage.update.mockResolvedValue({} as any)
      prismaMock.$transaction.mockImplementation((fn) => fn(prismaMock))

      await documentProgressService.updateProcessingStage({
        documentId: 'doc-1',
        stage: ProcessingStage.OCR_PROCESSING,
        status: StageStatus.COMPLETED,
      })

      // 檢查更新時包含 durationMs
      expect(prismaMock.documentProcessingStage.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            completedAt: expect.any(Date),
          }),
        })
      )
    })
  })

  describe('initializeProcessingStages', () => {
    it('should create all processing stages', async () => {
      prismaMock.documentProcessingStage.createMany.mockResolvedValue({ count: 10 })
      prismaMock.documentProcessingStage.findUnique.mockResolvedValue(null)
      prismaMock.documentProcessingStage.create.mockResolvedValue({} as any)
      prismaMock.document.update.mockResolvedValue({} as any)
      prismaMock.$transaction.mockImplementation((fn) => fn(prismaMock))

      await documentProgressService.initializeProcessingStages({
        documentId: 'doc-1',
        sourceType: 'n8n',
        sourceId: 'exec-1',
      })

      expect(prismaMock.documentProcessingStage.createMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.arrayContaining([
            expect.objectContaining({ stage: ProcessingStage.RECEIVED }),
            expect.objectContaining({ stage: ProcessingStage.UPLOADED }),
          ]),
        })
      )
    })

    it('should skip specified stages', async () => {
      prismaMock.documentProcessingStage.createMany.mockResolvedValue({ count: 10 })
      prismaMock.documentProcessingStage.findUnique.mockResolvedValue(null)
      prismaMock.documentProcessingStage.create.mockResolvedValue({} as any)
      prismaMock.document.update.mockResolvedValue({} as any)
      prismaMock.$transaction.mockImplementation((fn) => fn(prismaMock))

      await documentProgressService.initializeProcessingStages({
        documentId: 'doc-1',
        skipStages: [ProcessingStage.REVIEW_PENDING],
      })

      expect(prismaMock.documentProcessingStage.createMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.arrayContaining([
            expect.objectContaining({
              stage: ProcessingStage.REVIEW_PENDING,
              status: StageStatus.SKIPPED,
            }),
          ]),
        })
      )
    })
  })

  describe('getProcessingTimeline', () => {
    it('should return null for non-existent document', async () => {
      prismaMock.document.findUnique.mockResolvedValue(null)

      const result = await documentProgressService.getProcessingTimeline('non-existent')

      expect(result).toBeNull()
    })

    it('should return complete timeline for existing document', async () => {
      const mockDocument = {
        id: 'doc-1',
        fileName: 'test.pdf',
        fileSize: 1024,
        mimeType: 'application/pdf',
        cityCode: 'TPE',
        sourceType: 'N8N_WORKFLOW',
        sourceMetadata: {
          n8n: {
            workflowName: 'Test Workflow',
            executionId: 'exec-1',
          },
        },
        processingStages: [
          {
            stage: ProcessingStage.RECEIVED,
            stageName: '已接收',
            status: StageStatus.COMPLETED,
            startedAt: new Date(),
            completedAt: new Date(),
            durationMs: 100,
          },
          {
            stage: ProcessingStage.UPLOADED,
            stageName: '已上傳',
            status: StageStatus.IN_PROGRESS,
            startedAt: new Date(),
          },
        ],
        workflowExecution: {
          id: 'exec-1',
          workflowName: 'Test Workflow',
          startedAt: new Date(),
        },
        updatedAt: new Date(),
      }
      prismaMock.document.findUnique.mockResolvedValue(mockDocument as any)
      prismaMock.document.aggregate.mockResolvedValue({ _avg: { processingDuration: 60000 } } as any)

      const result = await documentProgressService.getProcessingTimeline('doc-1')

      expect(result).not.toBeNull()
      expect(result?.documentId).toBe('doc-1')
      expect(result?.fileName).toBe('test.pdf')
      expect(result?.source.type).toBe('N8N_WORKFLOW')
      expect(result?.source.workflowName).toBe('Test Workflow')
      expect(result?.stages).toHaveLength(2)
    })
  })
})
```

### 7.2 API 整合測試

```typescript
// __tests__/api/documents/progress.test.ts

import { createMocks } from 'node-mocks-http'
import { GET } from '@/app/api/documents/[id]/progress/route'
import { prismaMock } from '@/lib/__mocks__/prisma'

// Mock next-auth
jest.mock('next-auth', () => ({
  getServerSession: jest.fn(),
}))

import { getServerSession } from 'next-auth'

describe('GET /api/documents/[id]/progress', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should return 401 for unauthenticated request', async () => {
    (getServerSession as jest.Mock).mockResolvedValue(null)

    const { req } = createMocks({ method: 'GET' })
    const response = await GET(req as any, { params: { id: 'doc-1' } })

    expect(response.status).toBe(401)
  })

  it('should return 404 for non-existent document', async () => {
    (getServerSession as jest.Mock).mockResolvedValue({
      user: { id: 'user-1', cities: ['TPE'] },
    })
    prismaMock.document.findUnique.mockResolvedValue(null)

    const { req } = createMocks({ method: 'GET' })
    const response = await GET(req as any, { params: { id: 'non-existent' } })

    expect(response.status).toBe(404)
  })

  it('should return 403 for unauthorized city access', async () => {
    (getServerSession as jest.Mock).mockResolvedValue({
      user: { id: 'user-1', cities: ['TPE'] },
    })
    prismaMock.document.findUnique.mockResolvedValue({
      id: 'doc-1',
      cityCode: 'KHH', // 不同城市
    } as any)

    const { req } = createMocks({ method: 'GET' })
    const response = await GET(req as any, { params: { id: 'doc-1' } })

    expect(response.status).toBe(403)
  })

  it('should return progress for authorized request', async () => {
    (getServerSession as jest.Mock).mockResolvedValue({
      user: { id: 'user-1', cities: ['TPE'] },
    })
    prismaMock.document.findUnique.mockResolvedValue({
      id: 'doc-1',
      cityCode: 'TPE',
      processingStages: [],
      updatedAt: new Date(),
    } as any)

    const { req } = createMocks({
      method: 'GET',
      url: '/api/documents/doc-1/progress',
    })
    const response = await GET(req as any, { params: { id: 'doc-1' } })

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.data).toBeDefined()
  })

  it('should return full timeline when full=true', async () => {
    (getServerSession as jest.Mock).mockResolvedValue({
      user: { id: 'user-1', cities: ['TPE'] },
    })
    prismaMock.document.findUnique.mockResolvedValue({
      id: 'doc-1',
      cityCode: 'TPE',
      fileName: 'test.pdf',
      fileSize: 1024,
      mimeType: 'application/pdf',
      processingStages: [],
      updatedAt: new Date(),
    } as any)

    const { req } = createMocks({
      method: 'GET',
      url: '/api/documents/doc-1/progress?full=true',
      query: { full: 'true' },
    })
    req.nextUrl = { searchParams: new URLSearchParams('full=true') }

    const response = await GET(req as any, { params: { id: 'doc-1' } })

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.data).toBeDefined()
    expect(body.data.stages).toBeDefined()
  })
})
```

### 7.3 組件測試

```typescript
// __tests__/components/DocumentProcessingTimeline.test.tsx

import { render, screen } from '@testing-library/react'
import { DocumentProcessingTimeline } from '@/components/document/DocumentProcessingTimeline'
import { ProcessingStage, StageStatus } from '@prisma/client'

const mockTimeline = {
  documentId: 'doc-1',
  fileName: 'test-invoice.pdf',
  fileSize: 1024,
  mimeType: 'application/pdf',
  cityCode: 'TPE',
  currentStage: ProcessingStage.OCR_PROCESSING,
  currentStatus: StageStatus.IN_PROGRESS,
  progress: 40,
  estimatedRemainingMs: 30000,
  stages: [
    {
      stage: ProcessingStage.RECEIVED,
      stageName: '已接收',
      status: StageStatus.COMPLETED,
      completedAt: new Date(),
      durationMs: 100,
    },
    {
      stage: ProcessingStage.UPLOADED,
      stageName: '已上傳',
      status: StageStatus.COMPLETED,
      completedAt: new Date(),
      durationMs: 5000,
    },
    {
      stage: ProcessingStage.OCR_PROCESSING,
      stageName: 'OCR 處理',
      status: StageStatus.IN_PROGRESS,
      startedAt: new Date(),
    },
    {
      stage: ProcessingStage.AI_EXTRACTION,
      stageName: 'AI 提取',
      status: StageStatus.PENDING,
    },
  ],
  source: {
    type: 'N8N_WORKFLOW',
    workflowName: 'Invoice Processing',
    workflowExecutionId: 'exec-1',
    triggeredAt: new Date(),
    displayLabel: 'n8n 工作流',
    displayIcon: 'Workflow',
  },
}

describe('DocumentProcessingTimeline', () => {
  it('should render file name', () => {
    render(<DocumentProcessingTimeline timeline={mockTimeline} />)
    expect(screen.getByText('test-invoice.pdf')).toBeInTheDocument()
  })

  it('should display progress percentage', () => {
    render(<DocumentProcessingTimeline timeline={mockTimeline} />)
    expect(screen.getByText('40%')).toBeInTheDocument()
  })

  it('should show source badge', () => {
    render(<DocumentProcessingTimeline timeline={mockTimeline} />)
    expect(screen.getByText('n8n 工作流')).toBeInTheDocument()
  })

  it('should display all stages', () => {
    render(<DocumentProcessingTimeline timeline={mockTimeline} />)
    expect(screen.getByText('已接收')).toBeInTheDocument()
    expect(screen.getByText('已上傳')).toBeInTheDocument()
    expect(screen.getByText('OCR 處理')).toBeInTheDocument()
    expect(screen.getByText('AI 提取')).toBeInTheDocument()
  })

  it('should show estimated remaining time', () => {
    render(<DocumentProcessingTimeline timeline={mockTimeline} />)
    expect(screen.getByText(/預估剩餘時間/)).toBeInTheDocument()
  })

  it('should show completion alert when progress is 100%', () => {
    const completedTimeline = {
      ...mockTimeline,
      progress: 100,
      currentStatus: StageStatus.COMPLETED,
      totalDurationMs: 60000,
    }
    render(<DocumentProcessingTimeline timeline={completedTimeline} />)
    expect(screen.getByText('文件處理完成')).toBeInTheDocument()
  })

  it('should show error alert when failed', () => {
    const failedTimeline = {
      ...mockTimeline,
      currentStatus: StageStatus.FAILED,
      stages: [
        ...mockTimeline.stages.slice(0, 2),
        {
          stage: ProcessingStage.OCR_PROCESSING,
          stageName: 'OCR 處理',
          status: StageStatus.FAILED,
          error: 'OCR service unavailable',
        },
      ],
    }
    render(<DocumentProcessingTimeline timeline={failedTimeline} />)
    expect(screen.getByText(/處理過程中發生錯誤/)).toBeInTheDocument()
  })
})
```

---

## 8. 部署注意事項

### 8.1 資料庫遷移

```bash
# 1. 建立遷移檔案
npx prisma migrate dev --name add_document_processing_stages

# 2. 生成 Prisma Client
npx prisma generate

# 3. 生產環境部署
npx prisma migrate deploy
```

### 8.2 環境變數

```env
# 內部 API 金鑰（用於處理服務間通訊）
INTERNAL_API_KEY=your-secure-internal-api-key-here

# 進度輪詢設定
PROGRESS_POLLING_INTERVAL_MS=3000
PROGRESS_MAX_POLLING_DURATION_MS=600000
```

### 8.3 監控指標

```typescript
// 建議的監控指標
const METRICS = {
  // 處理時間
  'document.processing.duration': 'histogram',
  'document.processing.stage.duration': 'histogram',

  // 成功/失敗率
  'document.processing.success_rate': 'gauge',
  'document.processing.failure_rate': 'gauge',
  'document.processing.stage.failure_rate': 'gauge',

  // 佇列
  'document.processing.queue_size': 'gauge',
  'document.processing.in_progress_count': 'gauge',

  // API 延遲
  'api.documents.progress.latency': 'histogram',
  'api.documents.processing.latency': 'histogram',
}
```

### 8.4 效能優化建議

1. **輪詢策略**
   - 預設 3 秒輪詢間隔
   - 進度 100% 後自動停止輪詢
   - 失敗後降低輪詢頻率或停止

2. **快取策略**
   - 使用 SWR 客戶端快取
   - 考慮 Redis 快取熱門文件進度
   - 統計數據可快取較長時間（1-5 分鐘）

3. **批次查詢**
   - 處理中文件列表使用批次查詢
   - 統計查詢使用聚合而非逐筆計算

---

## 9. 驗收標準對應

| AC | 描述 | 實現方式 |
|----|------|----------|
| AC1 | 完整處理時間軸 | `DocumentProcessingTimeline` 組件顯示所有階段的開始/完成時間 |
| AC2 | 即時進度顯示 | `useDocumentProgress` hook 支援 3 秒輪詢，顯示當前階段和預估剩餘時間 |
| AC3 | 處理結果摘要 | 完成時顯示總耗時，並提供「前往審核」按鈕連結 |
| AC4 | 來源標記顯示 | `DocumentSourceBadge` 組件顯示來源類型和工作流名稱 |

---

## 10. 開放問題

### 10.1 待確認事項

1. **預估時間演算法**
   - 目前使用城市歷史平均值計算
   - 是否需要考慮文件大小、類型等因素？

2. **輪詢間隔調整**
   - 是否需要根據處理階段動態調整輪詢間隔？
   - 例如：OCR 和 AI 提取階段可能需要更長間隔

3. **WebSocket 支援**
   - 未來是否需要改用 WebSocket 推送進度更新？
   - 目前輪詢方式對大量並發用戶可能有壓力

### 10.2 已知限制

1. **處理時間預估精確度**
   - 首次處理文件時無歷史數據參考
   - 不同文件類型處理時間差異大

2. **階段粒度**
   - 部分階段（如 AI 提取）內部還有子步驟
   - 目前不支援子步驟級別的進度追蹤

---

## 11. 參考資料

- [Story 10-6 需求文件](./stories/10-6-document-processing-progress-tracking.md)
- [Story 10-1 Tech Spec - n8n 雙向通訊 API](./tech-spec-story-10-1.md)
- [Story 10-3 Tech Spec - 工作流執行狀態檢視](./tech-spec-story-10-3.md)
- [MUI Stepper 組件文檔](https://mui.com/material-ui/react-stepper/)
- [SWR 資料獲取文檔](https://swr.vercel.app/)
