/**
 * @fileoverview 批量處理執行器服務
 * @description
 *   負責執行批量文件處理任務：
 *   - 並發控制（最多 5 個並發任務，使用 p-queue-compat）
 *   - 速率限制（防止 Azure API 429 錯誤）
 *   - 錯誤處理和重試邏輯
 *   - 進度更新和狀態追蹤
 *   - 整合 Azure Document Intelligence 和 GPT Vision
 *   - 公司識別整合（Story 0.6）
 *   - 術語聚合整合（Story 0.7）
 *   - 文件發行者識別整合（Story 0.8）
 *   - 格式識別與三層術語聚合整合（Story 0.9）
 *   - Native PDF 雙重處理架構（CHANGE-001）
 *   - 整合 UnifiedDocumentProcessor 11 步管道（CHANGE-006）
 *   - 並發處理優化（CHANGE-010）
 *
 * @module src/services/batch-processor
 * @since Epic 0 - Story 0.2
 * @lastModified 2026-01-19
 *
 * @features
 *   - 分塊並發處理（使用 p-queue-compat 控制並發）
 *   - 速率限制（intervalCap 防止 Azure API 429）
 *   - 處理進度回報
 *   - 錯誤重試機制
 *   - 處理結果記錄
 *   - Azure DI 原生 PDF 處理
 *   - GPT Vision 掃描 PDF/圖片處理
 *   - GC 暫停機制（分塊之間）
 *   - Story 0.6: 公司識別整合（JIT 公司 Profile 建立）
 *   - Story 0.7: 術語聚合整合（批量完成後自動觸發）
 *   - Story 0.8: 文件發行者識別（從 Logo/Header/Letterhead/Footer 識別發行公司）
 *   - Story 0.9: 格式識別與三層術語聚合（Company → Format → Terms）
 *   - CHANGE-001: Native PDF 雙重處理（GPT Vision 分類 + Azure DI 數據提取）
 *   - CHANGE-006: 整合 UnifiedDocumentProcessor 11 步管道（包含 GPT Enhanced Extraction）
 *   - CHANGE-010: 並發處理優化（p-queue-compat 取代順序處理）
 *
 * @dependencies
 *   - Prisma Client - 數據庫操作
 *   - p-queue-compat - 並發控制（CHANGE-010）
 *   - processing-router.service - 路由決策
 *   - azure-di.service - Azure Document Intelligence
 *   - gpt-vision.service - GPT Vision
 *   - company-auto-create.service - 公司自動建立（Story 0.6）
 *   - batch-term-aggregation.service - 術語聚合服務（Story 0.7）
 *   - document-issuer.service - 文件發行者識別服務（Story 0.8）
 *   - document-format.service - 格式識別服務（Story 0.9）
 *   - unified-processor - UnifiedDocumentProcessor 11 步管道（CHANGE-006）
 *
 * @related
 *   - src/services/processing-router.service.ts - 處理路由服務
 *   - src/services/azure-di.service.ts - Azure DI 服務
 *   - src/services/gpt-vision.service.ts - GPT Vision 服務
 *   - src/services/company-auto-create.service.ts - 公司自動建立服務
 *   - src/services/batch-term-aggregation.service.ts - 術語聚合服務
 *   - src/services/document-issuer.service.ts - 文件發行者識別服務
 *   - src/services/document-format.service.ts - 格式識別服務
 */

import * as fs from 'fs/promises'
import PQueue from 'p-queue-compat'
import { prisma } from '@/lib/prisma'
import {
  HistoricalFile,
  ProcessingMethod,
  HistoricalFileStatus,
  IssuerIdentificationMethod,
} from '@prisma/client'
import { determineProcessingMethod } from './processing-router.service'
import { calculateActualCost } from './cost-estimation.service'
import { processPdfWithAzureDI } from './azure-di.service'
import { processImageWithVision, classifyDocument } from './gpt-vision.service'
import {
  identifyCompaniesFromExtraction,
  SYSTEM_USER_ID,
} from './company-auto-create.service'
import {
  aggregateTermsForBatch,
  saveAggregationResult,
} from './batch-term-aggregation.service'
import {
  processFileIssuerIdentification,
} from './document-issuer.service'
import {
  processDocumentFormat,
  linkFileToFormat,
} from './document-format.service'
// CHANGE-006: 導入 UnifiedDocumentProcessor 以使用 11 步處理管道
import {
  getUnifiedDocumentProcessor,
  type ProcessOptions,
} from './unified-processor'
import type {
  ProcessFileInput,
  UnifiedProcessingResult,
} from '@/types/unified-processor'
import type {
  FileCompanyIdentification,
  BatchCompanyConfig,
  CompanyMatchType,
} from '@/types/batch-company'
import type { TermAggregationConfig } from '@/types/batch-term-aggregation'
import type {
  DocumentIssuerResult,
  TransactionParty,
  IssuerIdentificationConfig,
} from '@/types/document-issuer'
import type {
  FormatIdentificationResult,
  FormatIdentificationConfig,
  DocumentType,
  DocumentSubtype,
} from '@/types/document-format'

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
  /** Story 0.6: 公司識別結果 */
  companyIdentification?: FileCompanyIdentification
  /** Story 0.8: 文件發行者識別結果 */
  documentIssuer?: DocumentIssuerResult | null
  /** Story 0.8: 交易對象列表 */
  transactionParties?: TransactionParty[]
  /** Story 0.9: 格式識別結果 */
  formatIdentification?: FormatIdentificationResult | null
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
  /** 最大並發數（建議在開發模式使用 1） */
  maxConcurrency?: number
  /** 最大重試次數 */
  maxRetries?: number
  /** 重試延遲（毫秒） */
  retryDelayMs?: number
  /** 進度回調 */
  onProgress?: ProcessingProgressCallback
  /** 每個分塊的文件數量（用於避免 async hooks 溢出） */
  chunkSize?: number
  /** 分塊之間的延遲（毫秒），讓 GC 有時間清理 */
  chunkDelayMs?: number
  // CHANGE-010: 並發控制選項
  /** 並發處理數量（預設 5） */
  concurrency?: number
  /** 每秒最大請求數（預設 10，防止 Azure API 429） */
  intervalCap?: number
  /** 速率限制間隔（毫秒，預設 1000） */
  intervalMs?: number
  /** 是否啟用並發處理（預設 true） */
  enableParallelProcessing?: boolean
}

// ============================================================
// Constants
// ============================================================

/** 預設最大重試次數 */
const DEFAULT_MAX_RETRIES = 2

/** 預設重試延遲（毫秒） */
const DEFAULT_RETRY_DELAY_MS = 1000

/** 預設分塊大小 */
const DEFAULT_CHUNK_SIZE = 5

/** 預設分塊延遲（毫秒） */
const DEFAULT_CHUNK_DELAY_MS = 2000

// CHANGE-010: 並發控制配置
/** 預設並發數（同時處理的文件數量） */
const DEFAULT_CONCURRENCY = 5

/** 每秒最大請求數（防止 Azure API 429 錯誤） */
const DEFAULT_INTERVAL_CAP = 10

/** 速率限制間隔（毫秒） */
const DEFAULT_INTERVAL_MS = 1000

// CHANGE-006: 是否使用 UnifiedProcessor（Feature Flag）
// 設置為 true 以啟用 11 步處理管道，包含 GPT Enhanced Extraction
const USE_UNIFIED_PROCESSOR = true

/**
 * CHANGE-006: 根據文件類型獲取 MIME 類型
 */
function getMimeType(detectedType: string): string {
  const mimeTypeMap: Record<string, string> = {
    NATIVE_PDF: 'application/pdf',
    SCANNED_PDF: 'application/pdf',
    IMAGE_JPG: 'image/jpeg',
    IMAGE_PNG: 'image/png',
    IMAGE_TIFF: 'image/tiff',
  }
  return mimeTypeMap[detectedType] || 'application/octet-stream'
}

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
 * CHANGE-006: 使用 UnifiedDocumentProcessor 處理文件
 * @description 調用 11 步處理管道，包含 GPT Enhanced Extraction
 */
async function executeWithUnifiedProcessor(
  file: HistoricalFile
): Promise<{
  result: UnifiedProcessingResult
  extractionResult: Record<string, unknown>
  actualPages: number
}> {
  // 讀取文件 Buffer
  const filePath = file.storagePath || file.originalName
  let fileBuffer: Buffer

  try {
    fileBuffer = await fs.readFile(filePath)
  } catch (readError) {
    throw new Error(`Failed to read file: ${filePath} - ${readError instanceof Error ? readError.message : 'Unknown error'}`)
  }

  // 準備 ProcessFileInput
  const input: ProcessFileInput = {
    fileId: file.id,
    batchId: file.batchId,
    fileName: file.originalName,
    fileBuffer,
    mimeType: getMimeType(file.detectedType || 'NATIVE_PDF'),
    userId: SYSTEM_USER_ID,
  }

  // 獲取 UnifiedDocumentProcessor 單例並處理
  const processor = getUnifiedDocumentProcessor({
    enableUnifiedProcessor: true,
    enableIssuerIdentification: true,
    enableFormatMatching: true,
    enableDynamicConfig: true,
    enableTermRecording: true,
    enableEnhancedConfidence: true,
    autoCreateCompany: true,
    autoCreateFormat: true,
  })

  console.log(`[UnifiedProcessor] Processing file: ${file.originalName}`)
  const result = await processor.processFile(input)

  if (!result.success) {
    throw new Error(result.error || 'UnifiedProcessor processing failed')
  }

  // 轉換為與舊版兼容的 extractionResult 格式
  const extractedData = result.extractedData || {}
  const extractionResult: Record<string, unknown> = {
    method: result.processingMethod || 'DUAL_PROCESSING',
    fileName: file.originalName,
    processedAt: new Date().toISOString(),
    pages: extractedData.pageCount || 1,
    invoiceData: extractedData.invoiceData || {},
    rawText: extractedData.rawText || '',
    confidence: result.overallConfidence ? result.overallConfidence * 100 : 75,
    // CHANGE-006: 保存 gptExtraction 結果（這是關鍵！）
    gptExtraction: extractedData.gptExtraction,
    // 發行者識別結果
    documentIssuer: extractedData.documentIssuer,
    // 分類是否成功
    classificationSuccess: !!result.companyId,
    // 文件格式
    documentFormat: result.documentFormatName ? {
      documentType: 'INVOICE',
      documentSubtype: 'GENERAL',
    } : undefined,
    // 新增：步驟執行信息（用於調試）
    _unifiedProcessorInfo: {
      usedLegacyProcessor: result.usedLegacyProcessor,
      stepResults: result.stepResults?.map(s => ({
        step: s.step,
        success: s.success,
        skipped: s.skipped,
        durationMs: s.durationMs,
        // CHANGE-006 Fix: 保留 data 和 error 欄位以便調試
        data: s.data,
        error: s.error,
      })),
      warnings: result.warnings,
    },
  }

  // 計算頁數
  const actualPages = extractedData.pageCount || 1

  console.log(
    `[UnifiedProcessor] Processing complete for ${file.originalName}: ` +
    `confidence=${result.overallConfidence}, gptExtraction=${!!extractedData.gptExtraction}`
  )

  return { result, extractionResult, actualPages }
}

/**
 * Story 0.6: 為單個文件執行公司識別
 *
 * @description
 *   從 OCR 提取結果中識別公司資訊：
 *   1. 調用 identifyCompaniesFromExtraction 取得所有識別到的公司
 *   2. 返回第一個識別結果（通常是主要的 forwarder/vendor）
 *   3. 將 CompanyIdentificationResult 轉換為 FileCompanyIdentification 格式
 *
 * @param fileId - 文件 ID
 * @param extractionResult - OCR 提取結果
 * @param fuzzyThreshold - 模糊匹配閾值（目前未使用，保留擴展）
 * @returns 公司識別結果，若無法識別則返回 undefined
 */
async function identifyCompanyForFile(
  fileId: string,
  extractionResult: Record<string, unknown>,
  fuzzyThreshold: number
): Promise<FileCompanyIdentification | undefined> {
  // 調用公司識別服務
  const identificationResults = await identifyCompaniesFromExtraction(
    extractionResult,
    {
      createdById: SYSTEM_USER_ID,
      firstSeenDocumentId: fileId,
      findDuplicateSuggestions: false, // 批量處理時不查找重複建議以提升效能
    }
  )

  // 如果沒有識別到任何公司
  if (identificationResults.length === 0) {
    return undefined
  }

  // 返回第一個識別結果（通常是主要的 forwarder/vendor）
  const primaryResult = identificationResults[0]

  // 確定匹配類型
  let matchType: CompanyMatchType
  let matchScore: number

  if (primaryResult.isNewCompany) {
    matchType = 'NEW'
    matchScore = 1.0 // 新建公司視為完全匹配
  } else if (primaryResult.matchResult) {
    // 根據匹配類型確定
    const resultMatchType = primaryResult.matchResult.matchType
    switch (resultMatchType) {
      case 'EXACT':
        matchType = 'EXACT'
        matchScore = 1.0
        break
      case 'VARIANT':
        matchType = 'VARIANT'
        matchScore = primaryResult.matchResult.matchScore || 0.95
        break
      case 'FUZZY':
        matchType = 'FUZZY'
        matchScore = primaryResult.matchResult.matchScore || fuzzyThreshold
        break
      case 'NONE':
      default:
        matchType = 'EXACT'
        matchScore = 1.0
    }
  } else {
    matchType = 'EXACT'
    matchScore = 1.0
  }

  return {
    fileId,
    companyId: primaryResult.companyId,
    companyName: primaryResult.companyName,
    matchType,
    matchScore,
    isNew: primaryResult.isNewCompany,
  }
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
  } else if (method === ProcessingMethod.DUAL_PROCESSING) {
    // CHANGE-001: 雙重處理模式 - Native PDF 專用
    // 第一階段：GPT Vision 分類（取得 documentIssuer 和 documentFormat）
    // 第二階段：Azure DI 數據提取（取得發票欄位）
    console.log(`[DUAL_PROCESSING] Starting dual processing for: ${file.originalName}`)

    // 第一階段：GPT Vision 輕量分類
    console.log(`[DUAL_PROCESSING] Phase 1: GPT Vision classification...`)
    const classificationResult = await classifyDocument(filePath)

    if (!classificationResult.success) {
      console.warn(
        `[DUAL_PROCESSING] Classification failed for ${file.originalName}: ${classificationResult.error}. ` +
        `Continuing with Azure DI only.`
      )
    } else {
      console.log(
        `[DUAL_PROCESSING] Classification complete: ` +
        `issuer=${classificationResult.documentIssuer?.name || 'unknown'}, ` +
        `type=${classificationResult.documentFormat?.documentType || 'unknown'}`
      )
    }

    // 第二階段：Azure DI 數據提取
    console.log(`[DUAL_PROCESSING] Phase 2: Azure DI data extraction...`)
    const dataResult = await processPdfWithAzureDI(filePath)

    if (!dataResult.success) {
      throw new Error(dataResult.error || 'Azure DI processing failed in dual processing mode')
    }

    console.log(`[DUAL_PROCESSING] Data extraction complete: ${dataResult.pageCount} pages`)

    // 合併結果
    return {
      extractionResult: {
        method: 'DUAL_PROCESSING',
        fileName: file.originalName,
        processedAt: new Date().toISOString(),
        pages: dataResult.pageCount,
        invoiceData: dataResult.invoiceData,
        rawText: dataResult.rawText,
        confidence: dataResult.confidence,
        // CHANGE-001: 從 GPT Vision 分類結果中取得 documentIssuer 和 documentFormat
        documentIssuer: classificationResult.success ? classificationResult.documentIssuer : undefined,
        documentFormat: classificationResult.success ? classificationResult.documentFormat : undefined,
        // 標記分類是否成功
        classificationSuccess: classificationResult.success,
        classificationError: classificationResult.error,
      },
      actualPages: dataResult.pageCount,
    }
  } else {
    // 使用 GPT Vision 處理掃描 PDF 或圖片
    // FIX-005: 同時執行 OCR 提取和文件分類，以獲取 documentIssuer 和 documentFormat
    console.log(`[GPT_VISION] Starting processing for: ${file.originalName}`)

    // 並行執行 OCR 提取和分類
    const [visionResult, classificationResult] = await Promise.all([
      processImageWithVision(filePath),
      classifyDocument(filePath),
    ])

    if (!visionResult.success) {
      throw new Error(visionResult.error || 'GPT Vision processing failed')
    }

    // 分類失敗不影響主流程，只記錄警告
    if (!classificationResult.success) {
      console.warn(
        `[GPT_VISION] Classification failed for ${file.originalName}: ${classificationResult.error}. ` +
        `Continuing with OCR result only.`
      )
    } else {
      console.log(
        `[GPT_VISION] Classification complete: ` +
        `issuer=${classificationResult.documentIssuer?.name || 'unknown'}, ` +
        `type=${classificationResult.documentFormat?.documentType || 'unknown'}`
      )
    }

    return {
      extractionResult: {
        method: 'GPT_VISION',
        fileName: file.originalName,
        processedAt: new Date().toISOString(),
        pages: visionResult.pageCount,
        invoiceData: visionResult.invoiceData,
        rawText: visionResult.rawText,
        confidence: visionResult.confidence,
        // FIX-005: 從 GPT Vision 分類結果中取得 documentIssuer 和 documentFormat
        documentIssuer: classificationResult.success ? classificationResult.documentIssuer : undefined,
        documentFormat: classificationResult.success ? classificationResult.documentFormat : undefined,
        // 標記分類是否成功
        classificationSuccess: classificationResult.success,
        classificationError: classificationResult.error,
      },
      actualPages: visionResult.pageCount,
    }
  }
}

// ============================================================
// Core Functions
// ============================================================

/**
 * 處理單個文件
 *
 * @description
 *   執行 OCR 處理並可選地進行：
 *   - 公司識別（Story 0.6）
 *   - 文件發行者識別（Story 0.8）
 *   - 格式識別（Story 0.9）
 *
 * @param file - 要處理的文件
 * @param options - 處理選項
 * @returns 處理結果
 */
export async function processFile(
  file: HistoricalFile,
  options: {
    maxRetries?: number
    retryDelayMs?: number
    /** Story 0.6: 公司識別配置 */
    companyConfig?: BatchCompanyConfig
    /** Story 0.8: 發行者識別配置 */
    issuerConfig?: IssuerIdentificationConfig
    /** Story 0.9: 格式識別配置 */
    formatConfig?: FormatIdentificationConfig
  } = {}
): Promise<FileProcessingResult> {
  const {
    maxRetries = DEFAULT_MAX_RETRIES,
    retryDelayMs = DEFAULT_RETRY_DELAY_MS,
    companyConfig,
    issuerConfig,
    formatConfig,
  } = options
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
      // CHANGE-006: 根據 Feature Flag 選擇處理器
      // 使用 UnifiedProcessor 時會執行 11 步管道，包含 GPT Enhanced Extraction
      let extractionResult: Record<string, unknown>
      let actualPages: number
      let unifiedResult: UnifiedProcessingResult | undefined

      if (USE_UNIFIED_PROCESSOR) {
        console.log(`[BatchProcessor] Using UnifiedProcessor for file: ${file.originalName}`)
        const unifiedOutput = await executeWithUnifiedProcessor(file)
        extractionResult = unifiedOutput.extractionResult
        actualPages = unifiedOutput.actualPages
        unifiedResult = unifiedOutput.result
      } else {
        // 舊版處理邏輯
        const legacyOutput = await executeAIProcessing(file, method)
        extractionResult = legacyOutput.extractionResult
        actualPages = legacyOutput.actualPages
      }

      // 計算實際成本
      const actualCost = calculateActualCost(method, actualPages)
      const endTime = Date.now()

      // CHANGE-006: 公司識別和發行者識別邏輯
      // 當使用 UnifiedProcessor 時，這些步驟已在 11 步管道中完成
      let companyIdentification: FileCompanyIdentification | undefined
      let documentIssuer: DocumentIssuerResult | null = null
      let transactionParties: TransactionParty[] = []
      let formatIdentification: FormatIdentificationResult | null = null

      if (USE_UNIFIED_PROCESSOR && unifiedResult) {
        // 從 UnifiedProcessor 結果中獲取已處理的識別結果
        if (unifiedResult.companyId) {
          companyIdentification = {
            fileId: file.id,
            companyId: unifiedResult.companyId,
            companyName: unifiedResult.companyName || '',
            matchType: unifiedResult.isNewCompany ? 'NEW' : 'EXACT',
            matchScore: 1.0,
            isNew: unifiedResult.isNewCompany || false,
          }

          // 設置 documentIssuer（從 UnifiedProcessor 的發行者識別結果）
          documentIssuer = {
            name: unifiedResult.companyName || '',
            identificationMethod: 'LOGO',
            confidence: unifiedResult.overallConfidence ? unifiedResult.overallConfidence * 100 : 75,
            companyId: unifiedResult.companyId,
          }
        }

        // 從 UnifiedProcessor 結果中獲取格式識別結果
        if (unifiedResult.documentFormatId) {
          formatIdentification = {
            fileId: file.id,
            formatId: unifiedResult.documentFormatId,
            documentType: 'INVOICE' as DocumentType,
            documentSubtype: 'GENERAL' as DocumentSubtype,
            confidence: unifiedResult.overallConfidence ? unifiedResult.overallConfidence * 100 : 75,
            isNewFormat: unifiedResult.isNewFormat || false,
          }
          console.log(
            `[BatchProcessor/Unified] Format from UnifiedProcessor: ${unifiedResult.documentFormatName} (${unifiedResult.isNewFormat ? 'NEW' : 'EXISTING'})`
          )
        }

        console.log(
          `[BatchProcessor/Unified] Using UnifiedProcessor results: ` +
          `companyId=${unifiedResult.companyId}, formatId=${unifiedResult.documentFormatId}`
        )
      } else {
        // 舊版處理邏輯：分別調用各識別服務

        // Story 0.6: 公司識別（在 OCR 完成後執行）
        if (companyConfig?.enabled && extractionResult) {
          try {
            companyIdentification = await identifyCompanyForFile(
              file.id,
              extractionResult,
              companyConfig.fuzzyThreshold
            )
          } catch (companyError) {
            // 公司識別失敗不影響主流程，只記錄警告
            console.warn(
              `Company identification failed for file ${file.id}:`,
              companyError instanceof Error ? companyError.message : companyError
            )
          }
        }

        // Story 0.8: 文件發行者識別（識別發行文件的公司，而非交易對象）
        if (issuerConfig?.enabled && extractionResult) {
          try {
            const issuerResult = await processFileIssuerIdentification(
              file.id,
              extractionResult,
              {
                createIfNotFound: issuerConfig.createCompanyIfNotFound,
                source: 'BATCH_PROCESSING',
                fuzzyThreshold: issuerConfig.fuzzyMatchThreshold,
                confidenceThreshold: issuerConfig.confidenceThreshold,
                createdById: SYSTEM_USER_ID,
              }
            )

            if (issuerResult.success) {
              documentIssuer = issuerResult.issuer
              transactionParties = issuerResult.parties
            }
          } catch (issuerError) {
            // 發行者識別失敗不影響主流程，只記錄警告
            console.warn(
              `Document issuer identification failed for file ${file.id}:`,
              issuerError instanceof Error ? issuerError.message : issuerError
            )
          }
        }

        // Story 0.9: 文件格式識別（需要發行者識別完成後執行，因為需要 companyId）
        if (formatConfig?.enabled && extractionResult && documentIssuer?.companyId) {
          try {
            // 從 extractionResult.documentFormat 中提取格式識別資訊
            // FIX-006: GPT Vision 返回的格式資訊在 documentFormat 嵌套物件中
            const extractionWithFormat = extractionResult as {
              documentFormat?: {
                documentType?: string
                documentSubtype?: string
                formatConfidence?: number
                formatFeatures?: Record<string, unknown>
              }
            }
            const formatExtractionData = extractionWithFormat.documentFormat

            if (formatExtractionData?.documentType) {
              const formatResult = await processDocumentFormat(
                documentIssuer.companyId,
                {
                  documentType: formatExtractionData.documentType as DocumentType,
                  documentSubtype: (formatExtractionData.documentSubtype || 'GENERAL') as DocumentSubtype,
                  formatConfidence: formatExtractionData.formatConfidence || 75,
                  formatFeatures: {
                    hasLineItems: !!formatExtractionData.formatFeatures?.hasLineItems,
                    hasHeaderLogo: !!formatExtractionData.formatFeatures?.hasHeaderLogo,
                    currency: formatExtractionData.formatFeatures?.currency as string | undefined,
                    language: formatExtractionData.formatFeatures?.language as string | undefined,
                    typicalFields: formatExtractionData.formatFeatures?.typicalFields as string[] | undefined,
                    layoutPattern: formatExtractionData.formatFeatures?.layoutPattern as string | undefined,
                  },
                },
                {
                  enabled: formatConfig.enabled,
                  confidenceThreshold: formatConfig.confidenceThreshold,
                  autoCreateFormat: formatConfig.autoCreateFormat,
                  learnFeatures: formatConfig.learnFeatures ?? true,
                }
              )

              if (formatResult) {
                // 關聯文件與格式
                await linkFileToFormat(file.id, formatResult.formatId, formatResult.confidence)

                formatIdentification = {
                  fileId: file.id,
                  formatId: formatResult.formatId,
                  documentType: formatResult.documentType,
                  documentSubtype: formatResult.documentSubtype,
                  confidence: formatResult.confidence,
                  isNewFormat: formatResult.isNewFormat,
                }

                console.log(
                  `[BatchProcessor] Format identified for file ${file.id}: ${formatResult.formatName} (${formatResult.isNewFormat ? 'NEW' : 'EXISTING'})`
                )
              }
            }
          } catch (formatError) {
            // 格式識別失敗不影響主流程，只記錄警告
            console.warn(
              `Document format identification failed for file ${file.id}:`,
              formatError instanceof Error ? formatError.message : formatError
            )
          }
        }
      }

      // FIX-023: 從統一處理流程結果中提取發行者識別結果
      // 當使用 UnifiedProcessor 時，ISSUER_IDENTIFICATION 步驟的結果存在於 extractionResult._unifiedProcessorInfo
      const unifiedProcessorInfo = (extractionResult as Record<string, unknown>)._unifiedProcessorInfo as {
        stepResults?: Array<{
          step: string
          data?: {
            matchedCompanyId?: string
            identificationMethod?: string
            confidence?: number
          }
        }>
      } | undefined

      const issuerStepResult = unifiedProcessorInfo?.stepResults?.find(
        (s) => s.step === 'ISSUER_IDENTIFICATION'
      )
      const issuerData = issuerStepResult?.data

      // 更新文件記錄（包含公司識別和發行者識別結果）
      // 構建更新數據對象，避免 TypeScript 條件展開類型推斷問題
      const updateData: Parameters<typeof prisma.historicalFile.update>[0]['data'] = {
        status: HistoricalFileStatus.COMPLETED,
        processingEndAt: new Date(),
        processedAt: new Date(),
        extractionResult: extractionResult as object,
        actualCost,
      }

      // Story 0.6: 公司識別結果
      if (companyIdentification) {
        updateData.identifiedCompanyId = companyIdentification.companyId
        updateData.companyMatchType = companyIdentification.matchType
        updateData.companyMatchScore = companyIdentification.matchScore
      }

      // FIX-023: 從統一處理流程結果同步發行者識別欄位
      // 當使用 UnifiedProcessor 時，從 stepResults 中提取 ISSUER_IDENTIFICATION 結果
      if (issuerData?.matchedCompanyId) {
        updateData.documentIssuerId = issuerData.matchedCompanyId
        // IssuerIdentificationMethod enum: LOGO, HEADER, LETTERHEAD, FOOTER, AI_INFERENCE
        // 如果方法不匹配任何有效值，使用 AI_INFERENCE 作為默認
        const validMethods = ['LOGO', 'HEADER', 'LETTERHEAD', 'FOOTER', 'AI_INFERENCE'] as const
        const method = issuerData.identificationMethod
        updateData.issuerIdentificationMethod = method && validMethods.includes(method as typeof validMethods[number])
          ? (method as IssuerIdentificationMethod)
          : IssuerIdentificationMethod.AI_INFERENCE
        updateData.issuerConfidence = issuerData.confidence || null
      }
      // Story 0.8: 發行者識別結果（舊版：updateFileIssuerResult 已在 processFileIssuerIdentification 中執行）
      // 當使用舊版處理流程時，documentIssuerId 等欄位在 processFileIssuerIdentification 中更新
      // 當使用 UnifiedProcessor 時，上方的 issuerData 展開會處理這些欄位

      await prisma.historicalFile.update({
        where: { id: file.id },
        data: updateData,
      })

      return {
        fileId: file.id,
        success: true,
        method,
        extractionResult,
        actualCost,
        processingTime: endTime - startTime,
        companyIdentification,
        documentIssuer,
        transactionParties,
        formatIdentification,
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
 * 將數組分割成指定大小的分塊
 */
function chunkArray<T>(array: T[], chunkSize: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize))
  }
  return chunks
}

/**
 * 批量處理文件
 *
 * @description
 *   使用分塊順序處理避免 Next.js 開發模式的 async hooks 溢出。
 *   文件被分成小塊，每塊內順序處理，塊之間有延遲讓 GC 清理。
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
    maxRetries = DEFAULT_MAX_RETRIES,
    retryDelayMs = DEFAULT_RETRY_DELAY_MS,
    onProgress,
    chunkSize = DEFAULT_CHUNK_SIZE,
    chunkDelayMs = DEFAULT_CHUNK_DELAY_MS,
    // CHANGE-010: 並發控制選項
    concurrency = DEFAULT_CONCURRENCY,
    intervalCap = DEFAULT_INTERVAL_CAP,
    intervalMs = DEFAULT_INTERVAL_MS,
    enableParallelProcessing = true,
  } = options

  const startTime = new Date()

  // Story 0.6, 0.7, 0.8 & 0.9: 獲取批次記錄以讀取公司識別、術語聚合、發行者識別和格式識別配置
  const batch = await prisma.historicalBatch.findUnique({
    where: { id: batchId },
    select: {
      // Story 0.6: 公司識別配置
      enableCompanyIdentification: true,
      fuzzyMatchThreshold: true,
      autoMergeSimilar: true,
      // Story 0.7: 術語聚合配置
      enableTermAggregation: true,
      termSimilarityThreshold: true,
      autoClassifyTerms: true,
      // Story 0.8: 發行者識別配置
      enableIssuerIdentification: true,
      issuerConfidenceThreshold: true,
      autoCreateIssuerCompany: true,
      issuerFuzzyThreshold: true,
      // Story 0.9: 格式識別配置
      enableFormatIdentification: true,
      formatConfidenceThreshold: true,
      autoCreateFormat: true,
    },
  })

  // 建立公司識別配置
  const companyConfig: BatchCompanyConfig | undefined = batch?.enableCompanyIdentification
    ? {
        enabled: true,
        fuzzyThreshold: batch.fuzzyMatchThreshold,
        autoMergeSimilar: batch.autoMergeSimilar,
      }
    : undefined

  // Story 0.7: 建立術語聚合配置
  const termAggregationConfig: TermAggregationConfig | undefined = batch?.enableTermAggregation
    ? {
        enabled: true,
        similarityThreshold: batch.termSimilarityThreshold,
        autoClassify: batch.autoClassifyTerms,
      }
    : undefined

  // Story 0.8: 建立發行者識別配置
  const issuerConfig: IssuerIdentificationConfig | undefined = batch?.enableIssuerIdentification
    ? {
        enabled: true,
        confidenceThreshold: batch.issuerConfidenceThreshold,
        methodPriority: ['LOGO', 'HEADER', 'LETTERHEAD', 'FOOTER', 'AI_INFERENCE'],
        createCompanyIfNotFound: batch.autoCreateIssuerCompany,
        fuzzyMatchThreshold: batch.issuerFuzzyThreshold,
      }
    : undefined

  // Story 0.9: 建立格式識別配置
  const formatConfig: FormatIdentificationConfig | undefined = batch?.enableFormatIdentification
    ? {
        enabled: true,
        confidenceThreshold: batch.formatConfidenceThreshold * 100, // 轉換為 0-100 範圍
        autoCreateFormat: batch.autoCreateFormat,
        learnFeatures: true, // 預設啟用特徵學習
      }
    : undefined

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
  let completedCount = 0
  let companiesIdentified = 0 // Story 0.6: 追蹤識別到的公司數量
  let issuersIdentified = 0 // Story 0.8: 追蹤識別到的發行者數量
  let formatsIdentified = 0 // Story 0.9: 追蹤識別到的格式數量

  // 進度回報
  const reportProgress = (currentFile?: string, processingCount = 0) => {
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

  // 將文件分成小塊處理
  const chunks = chunkArray(files, chunkSize)

  // CHANGE-010: 創建並發控制隊列
  const queue = new PQueue({
    concurrency: enableParallelProcessing ? concurrency : 1,
    interval: intervalMs,
    intervalCap,
  })

  console.log(
    `[Batch ${batchId}] Processing ${files.length} files in ${chunks.length} chunks ` +
    `(size: ${chunkSize}, concurrency: ${enableParallelProcessing ? concurrency : 1}, ` +
    `intervalCap: ${intervalCap}/s)`
  )

  for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
    const chunk = chunks[chunkIndex]
    console.log(`[Batch ${batchId}] Starting chunk ${chunkIndex + 1}/${chunks.length} (${chunk.length} files)`)

    // CHANGE-010: 並發處理每個分塊內的文件
    // 使用 p-queue 控制並發數和速率，避免 Azure API 429 錯誤
    const chunkPromises = chunk.map(file =>
      queue.add(async (): Promise<FileProcessingResult> => {
        // 報告開始處理（顯示當前正在處理的文件和隊列中的任務數）
        reportProgress(file.originalName, queue.pending + 1)

        try {
          // Story 0.6, 0.8 & 0.9: 傳遞公司識別、發行者識別和格式識別配置給 processFile
          const result = await processFile(file, { maxRetries, retryDelayMs, companyConfig, issuerConfig, formatConfig })

          // CHANGE-010: 在任務完成後立即更新數據庫進度
          // 使用 Prisma 的原子操作確保並發安全
          await prisma.historicalBatch.update({
            where: { id: batchId },
            data: {
              processedFiles: { increment: 1 },
              failedFiles: result.success ? undefined : { increment: 1 },
              // Story 0.6: 更新識別的公司數量
              companiesIdentified: result.companyIdentification
                ? { increment: 1 }
                : undefined,
              // Story 0.8: 更新識別的發行者數量
              issuersIdentified: result.documentIssuer
                ? { increment: 1 }
                : undefined,
              // Story 0.9: 更新識別的格式數量
              formatsIdentified: result.formatIdentification
                ? { increment: 1 }
                : undefined,
            },
          })

          return result
        } catch (error) {
          // 處理意外錯誤
          console.error(`[Batch ${batchId}] Unexpected error processing ${file.originalName}:`, error)

          // 返回失敗結果
          return {
            fileId: file.id,
            success: false,
            error: error instanceof Error ? error.message : 'Unexpected error',
          }
        }
      })
    )

    // CHANGE-010: 等待所有任務完成（使用 allSettled 確保即使有錯誤也能繼續）
    const chunkResults = await Promise.allSettled(chunkPromises)

    // 處理結果並更新統計
    for (const settledResult of chunkResults) {
      if (settledResult.status === 'fulfilled' && settledResult.value) {
        const result = settledResult.value
        results.push(result)

        if (result.success) {
          successCount++
          totalCost += result.actualCost || 0
          // Story 0.6: 追蹤成功識別公司的文件數
          if (result.companyIdentification) {
            companiesIdentified++
          }
          // Story 0.8: 追蹤成功識別發行者的文件數
          if (result.documentIssuer) {
            issuersIdentified++
          }
          // Story 0.9: 追蹤成功識別格式的文件數
          if (result.formatIdentification) {
            formatsIdentified++
          }
        } else {
          failedCount++
        }

        completedCount++
      } else if (settledResult.status === 'rejected') {
        // 這種情況不應該發生，因為我們在 queue.add 中已經捕獲了錯誤
        // 但為了安全起見，還是處理一下
        console.error(`[Batch ${batchId}] Promise rejected unexpectedly:`, settledResult.reason)
        failedCount++
        completedCount++
      }
    }

    // 報告 chunk 完成後的進度
    reportProgress(undefined, 0)

    // 在分塊之間添加延遲，讓 GC 有時間清理
    if (chunkIndex < chunks.length - 1) {
      console.log(`[Batch ${batchId}] Chunk ${chunkIndex + 1} complete. Waiting ${chunkDelayMs}ms before next chunk...`)
      await delay(chunkDelayMs)

      // 嘗試觸發 GC（如果可用）
      if (global.gc) {
        global.gc()
        console.log(`[Batch ${batchId}] Garbage collection triggered`)
      }
    }
  }

  // ============================================================
  // Story 0.7: 術語聚合階段（在 OCR 處理完成後觸發）
  // ============================================================
  let termAggregationCompleted = false

  if (termAggregationConfig?.enabled && successCount > 0) {
    console.log(`[Batch ${batchId}] Starting term aggregation...`)

    try {
      // 更新批次狀態為術語聚合中
      await prisma.historicalBatch.update({
        where: { id: batchId },
        data: {
          status: 'AGGREGATING',
          aggregationStartedAt: new Date(),
        },
      })

      // 執行術語聚合
      const aggregationResult = await aggregateTermsForBatch(batchId, termAggregationConfig)

      // 保存聚合結果
      await saveAggregationResult(batchId, aggregationResult)

      // 更新批次狀態為術語聚合完成
      await prisma.historicalBatch.update({
        where: { id: batchId },
        data: {
          status: 'AGGREGATED',
          aggregationCompletedAt: new Date(),
        },
      })

      termAggregationCompleted = true
      console.log(
        `[Batch ${batchId}] Term aggregation complete: ${aggregationResult.stats.totalUniqueTerms} unique terms, ` +
        `${aggregationResult.stats.universalTermsCount} universal terms across ` +
        `${aggregationResult.stats.companiesWithTerms} companies`
      )
    } catch (aggregationError) {
      // 術語聚合失敗不影響批次整體完成狀態，只記錄錯誤
      console.error(
        `[Batch ${batchId}] Term aggregation failed:`,
        aggregationError instanceof Error ? aggregationError.message : aggregationError
      )

      // 恢復批次狀態（跳過 AGGREGATED，直接到 COMPLETED）
      await prisma.historicalBatch.update({
        where: { id: batchId },
        data: {
          aggregationCompletedAt: new Date(),
        },
      })
    }
  }

  const endTime = new Date()

  // 更新批次狀態為完成
  // FIX-003: 統一使用 COMPLETED 作為最終狀態
  // 術語聚合是否完成由 aggregationCompletedAt 欄位判斷，而非狀態值
  // 原邏輯的問題：術語聚合成功 → AGGREGATED，失敗 → COMPLETED，語義矛盾
  const finalStatus = failedCount === files.length ? 'FAILED' : 'COMPLETED'

  await prisma.historicalBatch.update({
    where: { id: batchId },
    data: {
      status: finalStatus,
      completedAt: endTime,
    },
  })

  // Story 0.6, 0.7, 0.8 & 0.9: 包含公司識別、術語聚合、發行者識別和格式識別統計
  console.log(
    `[Batch ${batchId}] Processing complete: ${successCount} success, ${failedCount} failed, ` +
    `$${totalCost.toFixed(2)} total cost, ${companiesIdentified} companies identified, ` +
    `${issuersIdentified} issuers identified, ${formatsIdentified} formats identified` +
    (termAggregationCompleted ? `, term aggregation completed` : '')
  )

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
