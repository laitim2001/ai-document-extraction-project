/**
 * @fileoverview 批量處理執行器服務
 * @description
 *   負責執行批量文件處理任務：
 *   - 並發控制（最多 5 個並發任務）
 *   - 錯誤處理和重試邏輯
 *   - 進度更新和狀態追蹤
 *   - 整合 Azure Document Intelligence 和 GPT Vision
 *
 * @module src/services/batch-processor
 * @since Epic 0 - Story 0.2
 * @lastModified 2025-12-24
 *
 * @features
 *   - 並發處理控制
 *   - 處理進度回報
 *   - 錯誤重試機制
 *   - 處理結果記錄
 *   - Azure DI 原生 PDF 處理
 *   - GPT Vision 掃描 PDF/圖片處理
 *
 * @dependencies
 *   - Prisma Client - 數據庫操作
 *   - processing-router.service - 路由決策
 *   - azure-di.service - Azure Document Intelligence
 *   - gpt-vision.service - GPT Vision
 *
 * @related
 *   - src/services/processing-router.service.ts - 處理路由服務
 *   - src/services/azure-di.service.ts - Azure DI 服務
 *   - src/services/gpt-vision.service.ts - GPT Vision 服務
 */

import { prisma } from '@/lib/prisma'
import {
  HistoricalFile,
  ProcessingMethod,
  HistoricalFileStatus,
} from '@prisma/client'
import { determineProcessingMethod } from './processing-router.service'
import { calculateActualCost } from './cost-estimation.service'
import { processPdfWithAzureDI } from './azure-di.service'
import { processImageWithVision } from './gpt-vision.service'

// ============================================================
// Types
// ============================================================

/**
 * 處理進度回調
 */
export type ProcessingProgressCallback = (progress: ProcessingProgress) => void

/**
 * 處理進度資訊
 */
export interface ProcessingProgress {
  /** 總文件數 */
  total: number
  /** 已完成數 */
  completed: number
  /** 失敗數 */
  failed: number
  /** 正在處理數 */
  processing: number
  /** 當前處理的文件名（可選） */
  currentFile?: string
  /** 進度百分比 */
  percentage: number
}

/**
 * 單個文件處理結果
 */
export interface FileProcessingResult {
  fileId: string
  success: boolean
  method?: ProcessingMethod
  extractionResult?: Record<string, unknown>
  actualCost?: number
  processingTime?: number
  error?: string
}

/**
 * 批量處理結果
 */
export interface BatchProcessingResult {
  batchId: string
  totalFiles: number
  successCount: number
  failedCount: number
  totalCost: number
  results: FileProcessingResult[]
  startTime: Date
  endTime: Date
  durationMs: number
}

/**
 * 處理器選項
 */
export interface BatchProcessorOptions {
  /** 最大並發數 */
  maxConcurrency?: number
  /** 最大重試次數 */
  maxRetries?: number
  /** 重試延遲（毫秒） */
  retryDelayMs?: number
  /** 進度回調 */
  onProgress?: ProcessingProgressCallback
}

// ============================================================
// Constants
// ============================================================

/** 預設最大並發數（開發模式降低以避免 async hooks 溢出） */
const DEFAULT_MAX_CONCURRENCY = 2

/** 預設最大重試次數 */
const DEFAULT_MAX_RETRIES = 2

/** 預設重試延遲（毫秒） */
const DEFAULT_RETRY_DELAY_MS = 1000

// ============================================================
// Helper Functions
// ============================================================

/**
 * 延遲函數
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * 執行真實的 AI 處理
 *
 * @description
 *   根據處理方法調用對應的 Azure 服務：
 *   - AZURE_DI: 使用 Azure Document Intelligence 處理原生 PDF
 *   - GPT_VISION: 使用 GPT-5.2 Vision 處理掃描 PDF 和圖片
 *
 * @param file - 要處理的歷史文件
 * @param method - 處理方法（AZURE_DI 或 GPT_VISION）
 * @returns 提取結果和實際頁數
 */
async function executeAIProcessing(
  file: HistoricalFile,
  method: ProcessingMethod
): Promise<{
  extractionResult: Record<string, unknown>
  actualPages: number
}> {
  // 獲取文件路徑（假設 storagePath 包含完整路徑）
  // 在實際應用中，可能需要從 Azure Blob Storage 下載文件
  const filePath = file.storagePath || file.originalName

  console.log(`Processing file: ${file.originalName} with method: ${method}`)

  if (method === ProcessingMethod.AZURE_DI) {
    // 使用 Azure Document Intelligence 處理原生 PDF
    const result = await processPdfWithAzureDI(filePath)

    if (!result.success) {
      throw new Error(result.error || 'Azure DI processing failed')
    }

    return {
      extractionResult: {
        method: 'AZURE_DI',
        fileName: file.originalName,
        processedAt: new Date().toISOString(),
        pages: result.pageCount,
        invoiceData: result.invoiceData,
        rawText: result.rawText,
        confidence: result.confidence,
      },
      actualPages: result.pageCount,
    }
  } else {
    // 使用 GPT Vision 處理掃描 PDF 或圖片
    const result = await processImageWithVision(filePath)

    if (!result.success) {
      throw new Error(result.error || 'GPT Vision processing failed')
    }

    return {
      extractionResult: {
        method: 'GPT_VISION',
        fileName: file.originalName,
        processedAt: new Date().toISOString(),
        pages: result.pageCount,
        invoiceData: result.invoiceData,
        rawText: result.rawText,
        confidence: result.confidence,
      },
      actualPages: result.pageCount,
    }
  }
}

// ============================================================
// Core Functions
// ============================================================

/**
 * 處理單個文件
 *
 * @param file - 要處理的文件
 * @param options - 處理選項
 * @returns 處理結果
 */
export async function processFile(
  file: HistoricalFile,
  options: { maxRetries?: number; retryDelayMs?: number } = {}
): Promise<FileProcessingResult> {
  const { maxRetries = DEFAULT_MAX_RETRIES, retryDelayMs = DEFAULT_RETRY_DELAY_MS } = options
  const startTime = Date.now()

  // 確認文件有 detectedType
  if (!file.detectedType) {
    return {
      fileId: file.id,
      success: false,
      error: 'File has no detected type',
    }
  }

  // 決定處理方式
  const method = determineProcessingMethod(file.detectedType)

  // 更新文件狀態為處理中
  await prisma.historicalFile.update({
    where: { id: file.id },
    data: {
      status: HistoricalFileStatus.PROCESSING,
      processingMethod: method,
      processingStartAt: new Date(),
    },
  })

  let lastError: Error | null = null

  // 重試邏輯
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // 執行 AI 處理（Azure DI 或 GPT Vision）
      const { extractionResult, actualPages } = await executeAIProcessing(file, method)

      // 計算實際成本
      const actualCost = calculateActualCost(method, actualPages)
      const endTime = Date.now()

      // 更新文件記錄
      await prisma.historicalFile.update({
        where: { id: file.id },
        data: {
          status: HistoricalFileStatus.COMPLETED,
          processingEndAt: new Date(),
          processedAt: new Date(),
          extractionResult: extractionResult as object,
          actualCost,
        },
      })

      return {
        fileId: file.id,
        success: true,
        method,
        extractionResult,
        actualCost,
        processingTime: endTime - startTime,
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))

      // 如果還有重試機會，等待後重試
      if (attempt < maxRetries) {
        await delay(retryDelayMs * (attempt + 1)) // 指數退避
      }
    }
  }

  // 所有重試都失敗
  const errorMessage = lastError?.message || 'Unknown error'

  await prisma.historicalFile.update({
    where: { id: file.id },
    data: {
      status: HistoricalFileStatus.FAILED,
      processingEndAt: new Date(),
      errorMessage,
    },
  })

  return {
    fileId: file.id,
    success: false,
    method,
    error: errorMessage,
    processingTime: Date.now() - startTime,
  }
}

/**
 * 批量處理文件
 *
 * @description
 *   使用並發控制處理多個文件。
 *   支援進度回調和錯誤處理。
 *
 * @param batchId - 批次 ID
 * @param options - 處理選項
 * @returns 批量處理結果
 */
export async function processBatch(
  batchId: string,
  options: BatchProcessorOptions = {}
): Promise<BatchProcessingResult> {
  const {
    maxConcurrency = DEFAULT_MAX_CONCURRENCY,
    maxRetries = DEFAULT_MAX_RETRIES,
    retryDelayMs = DEFAULT_RETRY_DELAY_MS,
    onProgress,
  } = options

  const startTime = new Date()

  // 獲取所有待處理的文件
  // 注意：API route 已將文件狀態從 DETECTED 更新為 PROCESSING
  // 因此這裡查詢 PROCESSING 狀態的文件
  const files = await prisma.historicalFile.findMany({
    where: {
      batchId,
      status: HistoricalFileStatus.PROCESSING,
      detectedType: { not: null },
    },
  })

  if (files.length === 0) {
    return {
      batchId,
      totalFiles: 0,
      successCount: 0,
      failedCount: 0,
      totalCost: 0,
      results: [],
      startTime,
      endTime: new Date(),
      durationMs: 0,
    }
  }

  // 注意：批次狀態已由 API route 更新為 PROCESSING
  // 這裡不再重複更新，避免覆蓋 startedAt 時間戳

  // 處理結果
  const results: FileProcessingResult[] = []
  let successCount = 0
  let failedCount = 0
  let totalCost = 0
  let processingCount = 0
  let completedCount = 0

  // 進度回報
  const reportProgress = (currentFile?: string) => {
    if (onProgress) {
      onProgress({
        total: files.length,
        completed: completedCount,
        failed: failedCount,
        processing: processingCount,
        currentFile,
        percentage: Math.round((completedCount / files.length) * 100),
      })
    }
  }

  // 使用並發控制處理文件
  const processingQueue = [...files]
  const activePromises: Promise<void>[] = []

  while (processingQueue.length > 0 || activePromises.length > 0) {
    // 填充並發槽
    while (processingQueue.length > 0 && activePromises.length < maxConcurrency) {
      const file = processingQueue.shift()!
      processingCount++
      reportProgress(file.originalName)

      const promise = (async () => {
        const result = await processFile(file, { maxRetries, retryDelayMs })
        results.push(result)

        if (result.success) {
          successCount++
          totalCost += result.actualCost || 0
        } else {
          failedCount++
        }

        completedCount++
        processingCount--
        reportProgress()

        // 更新批次進度
        await prisma.historicalBatch.update({
          where: { id: batchId },
          data: {
            processedFiles: { increment: 1 },
            failedFiles: result.success ? undefined : { increment: 1 },
          },
        })
      })()

      activePromises.push(promise)
    }

    // 等待任一 Promise 完成
    if (activePromises.length > 0) {
      await Promise.race(activePromises)
      // 移除已完成的 Promise
      for (let i = activePromises.length - 1; i >= 0; i--) {
        const status = await Promise.race([
          activePromises[i].then(() => 'resolved'),
          Promise.resolve('pending'),
        ])
        if (status === 'resolved') {
          activePromises.splice(i, 1)
        }
      }
    }
  }

  const endTime = new Date()

  // 更新批次狀態為完成
  await prisma.historicalBatch.update({
    where: { id: batchId },
    data: {
      status: failedCount === files.length ? 'FAILED' : 'COMPLETED',
      completedAt: endTime,
    },
  })

  return {
    batchId,
    totalFiles: files.length,
    successCount,
    failedCount,
    totalCost,
    results,
    startTime,
    endTime,
    durationMs: endTime.getTime() - startTime.getTime(),
  }
}

/**
 * 獲取批次處理狀態
 *
 * @param batchId - 批次 ID
 * @returns 批次狀態摘要
 */
export async function getBatchProcessingStatus(batchId: string) {
  const batch = await prisma.historicalBatch.findUnique({
    where: { id: batchId },
    include: {
      _count: {
        select: {
          files: true,
        },
      },
    },
  })

  if (!batch) {
    return null
  }

  const fileStats = await prisma.historicalFile.groupBy({
    by: ['status'],
    where: { batchId },
    _count: true,
  })

  const statusMap = new Map(fileStats.map((s) => [s.status, s._count]))

  return {
    batchId,
    batchName: batch.name,
    status: batch.status,
    totalFiles: batch.totalFiles,
    processedFiles: batch.processedFiles,
    failedFiles: batch.failedFiles,
    startedAt: batch.startedAt,
    completedAt: batch.completedAt,
    filesByStatus: {
      pending: statusMap.get(HistoricalFileStatus.PENDING) || 0,
      detecting: statusMap.get(HistoricalFileStatus.DETECTING) || 0,
      detected: statusMap.get(HistoricalFileStatus.DETECTED) || 0,
      processing: statusMap.get(HistoricalFileStatus.PROCESSING) || 0,
      completed: statusMap.get(HistoricalFileStatus.COMPLETED) || 0,
      failed: statusMap.get(HistoricalFileStatus.FAILED) || 0,
    },
  }
}
