/**
 * @fileoverview 批量處理進度追蹤服務
 * @description
 *   提供批量處理的進度追蹤功能：
 *   - 即時進度計算
 *   - 處理速率估算
 *   - 剩餘時間預估
 *   - 詳細統計資訊
 *
 * @module src/services/batch-progress
 * @since Epic 0 - Story 0.4
 * @lastModified 2025-12-23
 *
 * @features
 *   - 即時進度查詢
 *   - 處理速率計算（files/minute）
 *   - 剩餘時間估算
 *   - 錯誤文件列表
 *   - 處理統計摘要
 *
 * @dependencies
 *   - Prisma Client - 數據庫操作
 *
 * @related
 *   - src/services/batch-processor.service.ts - 批量處理執行器
 *   - src/app/api/admin/historical-data/batches/[id]/progress/route.ts - SSE 端點
 */

import { prisma } from '@/lib/prisma'
import {
  HistoricalBatchStatus,
  HistoricalFileStatus,
  type HistoricalBatch,
  type HistoricalFile,
} from '@prisma/client'

// ============================================================
// Types
// ============================================================

/**
 * 進度詳情
 */
export interface BatchProgress {
  /** 批次 ID */
  batchId: string
  /** 批次名稱 */
  batchName: string
  /** 批次狀態 */
  status: HistoricalBatchStatus
  /** 總文件數 */
  totalFiles: number
  /** 已處理文件數 */
  processedFiles: number
  /** 失敗文件數 */
  failedFiles: number
  /** 跳過文件數 */
  skippedFiles: number
  /** 當前處理中的文件 ID */
  currentFileId: string | null
  /** 當前處理中的文件名 */
  currentFileName: string | null
  /** 進度百分比 (0-100) */
  percentage: number
  /** 處理速率 (files/minute) */
  processingRate: number
  /** 估計剩餘時間 (秒) */
  estimatedRemainingTime: number | null
  /** 開始時間 */
  startedAt: Date | null
  /** 暫停時間 */
  pausedAt: Date | null
  /** 完成時間 */
  completedAt: Date | null
  /** 總成本 (USD) */
  totalCost: number
  /** 新發現公司數 */
  newCompaniesCount: number
  /** 提取費用項數 */
  extractedTermsCount: number
  /** 各狀態文件數 */
  filesByStatus: FileStatusCounts
}

/**
 * 各狀態文件數統計
 */
export interface FileStatusCounts {
  pending: number
  detecting: number
  detected: number
  processing: number
  completed: number
  failed: number
  skipped: number
}

/**
 * 錯誤文件資訊
 */
export interface FailedFileInfo {
  id: string
  fileName: string
  originalName: string
  errorMessage: string | null
  failedAt: Date | null
  retryCount: number
}

/**
 * 處理摘要
 */
export interface BatchSummary {
  batchId: string
  batchName: string
  status: HistoricalBatchStatus
  totalFiles: number
  successCount: number
  failedCount: number
  skippedCount: number
  totalCost: number
  averageCostPerFile: number
  newCompaniesCount: number
  extractedTermsCount: number
  durationMs: number | null
  processingRate: number
  startedAt: Date | null
  completedAt: Date | null
}

// ============================================================
// Constants
// ============================================================

/** 處理速率計算的時間窗口（秒） */
const RATE_CALCULATION_WINDOW_SECONDS = 60

// ============================================================
// Core Functions
// ============================================================

/**
 * 獲取批次進度詳情
 *
 * @param batchId - 批次 ID
 * @returns 進度詳情，若批次不存在則返回 null
 */
export async function getBatchProgress(batchId: string): Promise<BatchProgress | null> {
  const batch = await prisma.historicalBatch.findUnique({
    where: { id: batchId },
  })

  if (!batch) {
    return null
  }

  // 獲取各狀態文件數
  const fileStatusCounts = await getFileStatusCounts(batchId)

  // 獲取當前處理中的文件
  let currentFileName: string | null = null
  if (batch.currentFileId) {
    const currentFile = await prisma.historicalFile.findUnique({
      where: { id: batch.currentFileId },
      select: { originalName: true },
    })
    currentFileName = currentFile?.originalName ?? null
  }

  // 計算處理速率
  const processingRate = await calculateProcessingRate(batchId, batch.startedAt)

  // 計算進度百分比
  const completedCount = fileStatusCounts.completed + fileStatusCounts.failed + fileStatusCounts.skipped
  const percentage = batch.totalFiles > 0
    ? Math.round((completedCount / batch.totalFiles) * 100)
    : 0

  // 估算剩餘時間
  const remainingFiles = batch.totalFiles - completedCount
  const estimatedRemainingTime = processingRate > 0
    ? Math.round((remainingFiles / processingRate) * 60)
    : null

  return {
    batchId: batch.id,
    batchName: batch.name,
    status: batch.status,
    totalFiles: batch.totalFiles,
    processedFiles: batch.processedFiles,
    failedFiles: batch.failedFiles,
    skippedFiles: batch.skippedFiles,
    currentFileId: batch.currentFileId,
    currentFileName,
    percentage,
    processingRate,
    estimatedRemainingTime,
    startedAt: batch.startedAt,
    pausedAt: batch.pausedAt,
    completedAt: batch.completedAt,
    totalCost: batch.totalCost,
    newCompaniesCount: batch.newCompaniesCount,
    extractedTermsCount: batch.extractedTermsCount,
    filesByStatus: fileStatusCounts,
  }
}

/**
 * 獲取各狀態文件數統計
 *
 * @param batchId - 批次 ID
 * @returns 各狀態文件數
 */
export async function getFileStatusCounts(batchId: string): Promise<FileStatusCounts> {
  const stats = await prisma.historicalFile.groupBy({
    by: ['status'],
    where: { batchId },
    _count: true,
  })

  const statusMap = new Map(stats.map((s) => [s.status, s._count]))

  return {
    pending: statusMap.get(HistoricalFileStatus.PENDING) ?? 0,
    detecting: statusMap.get(HistoricalFileStatus.DETECTING) ?? 0,
    detected: statusMap.get(HistoricalFileStatus.DETECTED) ?? 0,
    processing: statusMap.get(HistoricalFileStatus.PROCESSING) ?? 0,
    completed: statusMap.get(HistoricalFileStatus.COMPLETED) ?? 0,
    failed: statusMap.get(HistoricalFileStatus.FAILED) ?? 0,
    skipped: statusMap.get(HistoricalFileStatus.SKIPPED) ?? 0,
  }
}

/**
 * 計算處理速率（files/minute）
 *
 * @param batchId - 批次 ID
 * @param startedAt - 開始時間
 * @returns 處理速率
 */
export async function calculateProcessingRate(
  batchId: string,
  startedAt: Date | null
): Promise<number> {
  if (!startedAt) {
    return 0
  }

  // 計算最近時間窗口內完成的文件數
  const windowStart = new Date(Date.now() - RATE_CALCULATION_WINDOW_SECONDS * 1000)
  const effectiveStart = windowStart > startedAt ? windowStart : startedAt

  const completedInWindow = await prisma.historicalFile.count({
    where: {
      batchId,
      status: { in: [HistoricalFileStatus.COMPLETED, HistoricalFileStatus.FAILED] },
      processedAt: {
        gte: effectiveStart,
      },
    },
  })

  // 計算時間窗口長度（分鐘）
  const windowDurationMs = Date.now() - effectiveStart.getTime()
  const windowDurationMinutes = windowDurationMs / 60000

  if (windowDurationMinutes < 0.1) {
    // 時間太短，無法準確計算
    return 0
  }

  return Math.round((completedInWindow / windowDurationMinutes) * 10) / 10
}

/**
 * 獲取失敗文件列表
 *
 * @param batchId - 批次 ID
 * @param limit - 最大返回數量
 * @param offset - 偏移量
 * @returns 失敗文件列表
 */
export async function getFailedFiles(
  batchId: string,
  limit: number = 50,
  offset: number = 0
): Promise<{ files: FailedFileInfo[]; total: number }> {
  const [files, total] = await Promise.all([
    prisma.historicalFile.findMany({
      where: {
        batchId,
        status: HistoricalFileStatus.FAILED,
      },
      select: {
        id: true,
        fileName: true,
        originalName: true,
        errorMessage: true,
        processedAt: true,
        metadata: true,
      },
      orderBy: { processedAt: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.historicalFile.count({
      where: {
        batchId,
        status: HistoricalFileStatus.FAILED,
      },
    }),
  ])

  return {
    files: files.map((file) => ({
      id: file.id,
      fileName: file.fileName,
      originalName: file.originalName,
      errorMessage: file.errorMessage,
      failedAt: file.processedAt,
      retryCount: (file.metadata as Record<string, unknown>)?.retryCount as number ?? 0,
    })),
    total,
  }
}

/**
 * 獲取批次處理摘要
 *
 * @param batchId - 批次 ID
 * @returns 處理摘要，若批次不存在則返回 null
 */
export async function getBatchSummary(batchId: string): Promise<BatchSummary | null> {
  const batch = await prisma.historicalBatch.findUnique({
    where: { id: batchId },
  })

  if (!batch) {
    return null
  }

  // 計算持續時間
  let durationMs: number | null = null
  if (batch.startedAt) {
    const endTime = batch.completedAt ?? new Date()
    durationMs = endTime.getTime() - batch.startedAt.getTime()
  }

  // 計算處理速率
  const processingRate = durationMs && durationMs > 0
    ? Math.round((batch.processedFiles / (durationMs / 60000)) * 10) / 10
    : 0

  // 計算平均成本
  const successCount = batch.processedFiles - batch.failedFiles - batch.skippedFiles
  const averageCostPerFile = successCount > 0
    ? Math.round((batch.totalCost / successCount) * 10000) / 10000
    : 0

  return {
    batchId: batch.id,
    batchName: batch.name,
    status: batch.status,
    totalFiles: batch.totalFiles,
    successCount,
    failedCount: batch.failedFiles,
    skippedCount: batch.skippedFiles,
    totalCost: batch.totalCost,
    averageCostPerFile,
    newCompaniesCount: batch.newCompaniesCount,
    extractedTermsCount: batch.extractedTermsCount,
    durationMs,
    processingRate,
    startedAt: batch.startedAt,
    completedAt: batch.completedAt,
  }
}

/**
 * 更新批次進度統計
 *
 * @description
 *   在處理文件時調用，更新批次的進度統計。
 *   包括：處理數、成本、新公司數、費用項數等。
 *
 * @param batchId - 批次 ID
 * @param update - 更新資料
 */
export async function updateBatchProgress(
  batchId: string,
  update: {
    currentFileId?: string | null
    incrementProcessed?: boolean
    incrementFailed?: boolean
    incrementSkipped?: boolean
    addCost?: number
    addNewCompanies?: number
    addExtractedTerms?: number
  }
): Promise<void> {
  const data: Record<string, unknown> = {}

  if (update.currentFileId !== undefined) {
    data.currentFileId = update.currentFileId
  }

  if (update.incrementProcessed) {
    data.processedFiles = { increment: 1 }
  }

  if (update.incrementFailed) {
    data.failedFiles = { increment: 1 }
  }

  if (update.incrementSkipped) {
    data.skippedFiles = { increment: 1 }
  }

  if (update.addCost && update.addCost > 0) {
    data.totalCost = { increment: update.addCost }
  }

  if (update.addNewCompanies && update.addNewCompanies > 0) {
    data.newCompaniesCount = { increment: update.addNewCompanies }
  }

  if (update.addExtractedTerms && update.addExtractedTerms > 0) {
    data.extractedTermsCount = { increment: update.addExtractedTerms }
  }

  if (Object.keys(data).length > 0) {
    await prisma.historicalBatch.update({
      where: { id: batchId },
      data,
    })
  }
}

/**
 * 檢查批次是否可以繼續處理
 *
 * @param batchId - 批次 ID
 * @returns 是否可以繼續處理
 */
export async function canContinueProcessing(batchId: string): Promise<boolean> {
  const batch = await prisma.historicalBatch.findUnique({
    where: { id: batchId },
    select: { status: true },
  })

  if (!batch) {
    return false
  }

  // 只有 PROCESSING 狀態的批次可以繼續處理
  return batch.status === HistoricalBatchStatus.PROCESSING
}

/**
 * 獲取下一個待處理的文件
 *
 * @param batchId - 批次 ID
 * @returns 下一個待處理的文件，若無則返回 null
 */
export async function getNextPendingFile(batchId: string): Promise<HistoricalFile | null> {
  const file = await prisma.historicalFile.findFirst({
    where: {
      batchId,
      status: HistoricalFileStatus.DETECTED,
      detectedType: { not: null },
    },
    orderBy: { createdAt: 'asc' },
  })

  return file
}
