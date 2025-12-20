/**
 * @fileoverview 文件處理進度追蹤服務
 * @description
 *   提供文件處理進度的追蹤與管理功能，包含：
 *   - 獲取完整處理時間軸
 *   - 即時進度輪詢更新
 *   - 階段狀態更新
 *   - 處理統計分析
 *
 * @module src/services/document-progress.service
 * @author Development Team
 * @since Epic 10 - Story 10.6 (文件處理進度追蹤)
 * @lastModified 2025-12-20
 *
 * @features
 *   - 10 階段處理流程追蹤
 *   - 權重計算進度百分比
 *   - 預估剩餘時間
 *   - 來源識別與顯示
 *   - 統計報表
 *
 * @dependencies
 *   - @prisma/client - 資料庫操作
 *   - @/types/document-progress - 類型定義
 *
 * @related
 *   - src/types/document-progress.ts - 類型定義
 *   - prisma/schema.prisma - DocumentProcessingStage 模型
 *   - src/app/api/documents/[id]/progress/route.ts - API 路由
 */

import { PrismaClient, ProcessingStage, ProcessingStageStatus, Prisma, DocumentStatus } from '@prisma/client'
import type {
  ProcessingTimeline,
  ProcessingProgress,
  ProcessingDocument,
  ProcessingStatistics,
  ProcessingTimelineSource,
  ProcessingTimelineStage,
  StageStatisticsItem,
  SourceDistributionItem,
  UpdateStageParams,
  InitializeStagesParams,
} from '@/types/document-progress'
import { STAGE_CONFIG, SOURCE_TYPE_CONFIG } from '@/types/document-progress'

// ============================================================
// 類型定義
// ============================================================

type DocumentWithStages = Prisma.DocumentGetPayload<{
  include: {
    processingStages: true
    workflowExecution: {
      select: {
        id: true
        workflowName: true
        startedAt: true
      }
    }
  }
}>

type StageRecord = Prisma.DocumentProcessingStageGetPayload<object>

// ============================================================
// 服務類
// ============================================================

export class DocumentProgressService {
  constructor(private prisma: PrismaClient) {}

  // ============================================
  // 公開方法
  // ============================================

  /**
   * 獲取文件處理完整時間軸
   *
   * @description 返回文件從接收到完成的完整處理時間軸
   * @param documentId - 文件 ID
   * @returns 完整處理時間軸或 null
   */
  async getProcessingTimeline(documentId: string): Promise<ProcessingTimeline | null> {
    const document = await this.prisma.document.findUnique({
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
    const stages: ProcessingTimelineStage[] = document.processingStages.map((stage) => ({
      stage: stage.stage,
      stageName: stage.stageName,
      status: stage.status,
      startedAt: stage.startedAt?.toISOString(),
      completedAt: stage.completedAt?.toISOString(),
      durationMs: stage.durationMs ?? undefined,
      error: stage.error ?? undefined,
      result: stage.result as Record<string, unknown> | undefined,
    }))

    return {
      documentId: document.id,
      fileName: document.fileName,
      fileSize: document.fileSize,
      mimeType: document.fileType,
      cityCode: document.cityCode,
      currentStage,
      currentStatus,
      progress,
      estimatedRemainingMs,
      estimatedCompletionAt,
      stages,
      source,
      totalDurationMs: document.processingDuration ?? undefined,
      startedAt: document.processingStartedAt?.toISOString(),
      completedAt: document.processingEndedAt?.toISOString(),
    }
  }

  /**
   * 獲取即時進度更新（用於輪詢）
   *
   * @description 返回簡化的進度資訊，適合用於輪詢更新
   * @param documentId - 文件 ID
   * @returns 即時進度或 null
   */
  async getProgressUpdate(documentId: string): Promise<ProcessingProgress | null> {
    const document = await this.prisma.document.findUnique({
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
      (s) => s.status === ProcessingStageStatus.FAILED
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
      isComplete: progress >= 100 && currentStatus === ProcessingStageStatus.COMPLETED,
      hasFailed: !!failedStage,
      failedStage: failedStage?.stage,
      failedError: failedStage?.error ?? undefined,
    }
  }

  /**
   * 更新處理階段
   *
   * @description 更新指定階段的狀態，並計算持續時間
   * @param params - 更新參數
   */
  async updateProcessingStage(params: UpdateStageParams): Promise<void> {
    const { documentId, stage, status, result, error, sourceType, sourceId } = params
    const config = STAGE_CONFIG[stage]
    const now = new Date()

    await this.prisma.$transaction(async (tx) => {
      // 查找現有階段記錄
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

        if (status === ProcessingStageStatus.IN_PROGRESS && !existingStage.startedAt) {
          updateData.startedAt = now
        }

        const completionStatuses: ProcessingStageStatus[] = [
          ProcessingStageStatus.COMPLETED,
          ProcessingStageStatus.FAILED,
          ProcessingStageStatus.SKIPPED,
        ]

        if (completionStatuses.includes(status)) {
          updateData.completedAt = now

          // 計算持續時間
          if (existingStage.startedAt) {
            updateData.durationMs = now.getTime() - existingStage.startedAt.getTime()
          }
        }

        if (result) updateData.result = result as Prisma.InputJsonValue
        if (error) updateData.error = error

        await tx.documentProcessingStage.update({
          where: { id: existingStage.id },
          data: updateData,
        })
      } else {
        // 建立新記錄
        const completionStatuses: ProcessingStageStatus[] = [
          ProcessingStageStatus.COMPLETED,
          ProcessingStageStatus.FAILED,
          ProcessingStageStatus.SKIPPED,
        ]

        await tx.documentProcessingStage.create({
          data: {
            documentId,
            stage,
            stageName: config.name,
            stageOrder: config.order,
            status,
            startedAt: status === ProcessingStageStatus.IN_PROGRESS ? now : undefined,
            completedAt: completionStatuses.includes(status) ? now : undefined,
            result: result as Prisma.InputJsonValue | undefined,
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
   *
   * @description 為新文件建立所有處理階段記錄
   * @param params - 初始化參數
   */
  async initializeProcessingStages(params: InitializeStagesParams): Promise<void> {
    const { documentId, sourceType, sourceId, skipStages = [] } = params

    const stages = Object.entries(STAGE_CONFIG).map(([stage, config]) => ({
      documentId,
      stage: stage as ProcessingStage,
      stageName: config.name,
      stageOrder: config.order,
      status: skipStages.includes(stage as ProcessingStage)
        ? ProcessingStageStatus.SKIPPED
        : ProcessingStageStatus.PENDING,
      sourceType,
      sourceId,
    }))

    await this.prisma.$transaction(async (tx) => {
      // 批次建立階段記錄
      await tx.documentProcessingStage.createMany({
        data: stages,
        skipDuplicates: true,
      })

      // 標記第一階段為已完成（已接收）
      await tx.documentProcessingStage.update({
        where: {
          documentId_stage: { documentId, stage: ProcessingStage.RECEIVED },
        },
        data: {
          status: ProcessingStageStatus.COMPLETED,
          completedAt: new Date(),
        },
      })

      // 更新文件處理開始時間和來源類型
      await tx.document.update({
        where: { id: documentId },
        data: {
          processingStartedAt: new Date(),
          ...(sourceType && { sourceType: sourceType as Prisma.DocumentUpdateInput['sourceType'] }),
        },
      })
    })
  }

  /**
   * 獲取處理中的文件列表
   *
   * @description 返回目前正在處理中的文件清單
   * @param options - 查詢選項
   * @returns 處理中的文件列表
   */
  async getProcessingDocuments(options: {
    cityCode?: string
    limit?: number
    sourceType?: string
  }): Promise<ProcessingDocument[]> {
    const { cityCode, limit = 20, sourceType } = options

    // 「處理中」的狀態包含：上傳中、已上傳（待處理）、OCR處理中、映射處理中、待審核、審核中
    const inProgressStatuses: DocumentStatus[] = [
      DocumentStatus.UPLOADING,
      DocumentStatus.UPLOADED,
      DocumentStatus.OCR_PROCESSING,
      DocumentStatus.MAPPING_PROCESSING,
      DocumentStatus.PENDING_REVIEW,
      DocumentStatus.IN_REVIEW,
    ]

    const documents = await this.prisma.document.findMany({
      where: {
        status: {
          in: inProgressStatuses,
        },
        ...(cityCode && { cityCode }),
        ...(sourceType && { sourceType: sourceType as Prisma.EnumDocumentSourceTypeFilter['equals'] }),
      },
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
   *
   * @description 返回指定城市和時間段的處理統計資料
   * @param cityCode - 城市代碼
   * @param period - 統計週期
   * @returns 處理統計資料
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

    // 並行執行所有統計查詢
    const [counts, durationStats, stageStats, sourceStats] = await Promise.all([
      // 數量統計
      this.prisma.document.groupBy({
        by: ['status'],
        where: {
          cityCode,
          createdAt: { gte: startDate },
        },
        _count: true,
      }),

      // 時間統計
      this.prisma.document.aggregate({
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
      this.prisma.documentProcessingStage.groupBy({
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
      this.prisma.document.groupBy({
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
    const stageStatistics: StageStatisticsItem[] = Object.values(ProcessingStage).map((stage) => {
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
    const sourceDistribution: SourceDistributionItem[] = sourceStats.map((s) => ({
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

  // ============================================
  // 私有方法
  // ============================================

  /**
   * 計算進度
   */
  private calculateProgress(stages: StageRecord[]): {
    currentStage: ProcessingStage
    currentStatus: ProcessingStageStatus
    progress: number
  } {
    let totalWeight = 0
    let completedWeight = 0
    let currentStage: ProcessingStage = ProcessingStage.RECEIVED
    let currentStatus: ProcessingStageStatus = ProcessingStageStatus.PENDING

    // 計算總權重
    Object.values(STAGE_CONFIG).forEach((config) => {
      totalWeight += config.weight
    })

    // 計算完成的權重
    for (const stage of stages) {
      const config = STAGE_CONFIG[stage.stage]
      if (!config) continue

      switch (stage.status) {
        case ProcessingStageStatus.COMPLETED:
        case ProcessingStageStatus.SKIPPED:
          completedWeight += config.weight
          break

        case ProcessingStageStatus.IN_PROGRESS:
          currentStage = stage.stage
          currentStatus = ProcessingStageStatus.IN_PROGRESS
          // 進行中的階段算一半權重
          completedWeight += config.weight * 0.5
          break

        case ProcessingStageStatus.PENDING:
          if (currentStatus !== ProcessingStageStatus.IN_PROGRESS) {
            currentStage = stage.stage
            currentStatus = ProcessingStageStatus.PENDING
          }
          break

        case ProcessingStageStatus.FAILED:
          currentStage = stage.stage
          currentStatus = ProcessingStageStatus.FAILED
          return {
            currentStage,
            currentStatus,
            progress: Math.round((completedWeight / totalWeight) * 100),
          }
      }
    }

    // 如果所有階段都完成
    const allCompleted = stages.every(
      (s) =>
        s.status === ProcessingStageStatus.COMPLETED ||
        s.status === ProcessingStageStatus.SKIPPED
    )
    if (allCompleted && stages.length > 0) {
      currentStage = ProcessingStage.COMPLETED
      currentStatus = ProcessingStageStatus.COMPLETED
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
    const avgDuration = await this.prisma.document.aggregate({
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
    _currentProgress: number
  ): number {
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
  private buildSourceInfo(document: DocumentWithStages): ProcessingTimelineSource {
    const sourceType = document.sourceType || 'MANUAL_UPLOAD'
    const sourceConfig = SOURCE_TYPE_CONFIG[sourceType] || SOURCE_TYPE_CONFIG.MANUAL_UPLOAD
    const sourceMetadata = document.sourceMetadata as Record<string, unknown> | null

    // 安全取得 n8n 元資料
    const n8nMetadata = sourceMetadata?.n8n as Record<string, unknown> | undefined

    return {
      type: sourceType,
      workflowName:
        document.workflowExecution?.workflowName ||
        (n8nMetadata?.workflowName as string | undefined),
      workflowExecutionId:
        document.workflowExecution?.id ||
        (n8nMetadata?.executionId as string | undefined),
      triggeredAt:
        document.workflowExecution?.startedAt ||
        (n8nMetadata?.triggeredAt
          ? new Date(n8nMetadata.triggeredAt as string)
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
    status: ProcessingStageStatus
  ): Promise<void> {
    const now = new Date()

    // 如果是第一個開始的階段，更新處理開始時間
    if (stage === ProcessingStage.UPLOADED && status === ProcessingStageStatus.IN_PROGRESS) {
      await tx.document.update({
        where: { id: documentId },
        data: { processingStartedAt: now },
      })
    }

    // 如果是完成階段，更新處理結束時間和總時長
    if (stage === ProcessingStage.COMPLETED && status === ProcessingStageStatus.COMPLETED) {
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

// ============================================================
// 單例實例
// ============================================================

import { prisma } from '@/lib/prisma'

/**
 * DocumentProgressService 單例實例
 */
export const documentProgressService = new DocumentProgressService(prisma)
