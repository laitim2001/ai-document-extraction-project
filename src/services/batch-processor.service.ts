/**
 * @fileoverview 批量處理執行器服務
 * @description
 *   負責執行批量文件處理任務：
 *   - 並發控制（最多 5 個並發任務）
 *   - 錯誤處理和重試邏輯
 *   - 進度更新和狀態追蹤
 *   - 整合 Azure Document Intelligence 和 GPT Vision
 *   - 公司識別整合（Story 0.6）
 *   - 術語聚合整合（Story 0.7）
 *   - 文件發行者識別整合（Story 0.8）
 *   - 格式識別與三層術語聚合整合（Story 0.9）
 *   - Native PDF 雙重處理架構（CHANGE-001）
 *
 * @module src/services/batch-processor
 * @since Epic 0 - Story 0.2
 * @lastModified 2025-12-27
 *
 * @features
 *   - 分塊順序處理（避免 async hooks 溢出）
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
 *
 * @dependencies
 *   - Prisma Client - 數據庫操作
 *   - processing-router.service - 路由決策
 *   - azure-di.service - Azure Document Intelligence
 *   - gpt-vision.service - GPT Vision
 *   - company-auto-create.service - 公司自動建立（Story 0.6）
 *   - batch-term-aggregation.service - 術語聚合服務（Story 0.7）
 *   - document-issuer.service - 文件發行者識別服務（Story 0.8）
 *   - document-format.service - 格式識別服務（Story 0.9）
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

import { prisma } from '@/lib/prisma'
import {
  HistoricalFile,
  ProcessingMethod,
  HistoricalFileStatus,
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
      // 執行 AI 處理（Azure DI 或 GPT Vision）
      const { extractionResult, actualPages } = await executeAIProcessing(file, method)

      // 計算實際成本
      const actualCost = calculateActualCost(method, actualPages)
      const endTime = Date.now()

      // Story 0.6: 公司識別（在 OCR 完成後執行）
      let companyIdentification: FileCompanyIdentification | undefined
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
      let documentIssuer: DocumentIssuerResult | null = null
      let transactionParties: TransactionParty[] = []
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
      let formatIdentification: FormatIdentificationResult | null = null
      if (formatConfig?.enabled && extractionResult && documentIssuer?.companyId) {
        try {
          // 從 extractionResult 中提取格式識別資訊
          // extractionResult 包含 GPT Vision 提取的 documentType, documentSubtype 等
          const formatExtractionData = extractionResult as {
            documentType?: string
            documentSubtype?: string
            formatConfidence?: number
            formatFeatures?: Record<string, unknown>
          }

          if (formatExtractionData.documentType) {
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

      // 更新文件記錄（包含公司識別和發行者識別結果）
      await prisma.historicalFile.update({
        where: { id: file.id },
        data: {
          status: HistoricalFileStatus.COMPLETED,
          processingEndAt: new Date(),
          processedAt: new Date(),
          extractionResult: extractionResult as object,
          actualCost,
          // Story 0.6: 公司識別結果
          ...(companyIdentification && {
            identifiedCompanyId: companyIdentification.companyId,
            companyMatchType: companyIdentification.matchType,
            companyMatchScore: companyIdentification.matchScore,
          }),
          // Story 0.8: 發行者識別結果（注意：updateFileIssuerResult 已在 processFileIssuerIdentification 中執行）
          // 這裡無需重複更新 documentIssuerId 等欄位
        },
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
  console.log(`[Batch ${batchId}] Processing ${files.length} files in ${chunks.length} chunks (size: ${chunkSize})`)

  for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
    const chunk = chunks[chunkIndex]
    console.log(`[Batch ${batchId}] Starting chunk ${chunkIndex + 1}/${chunks.length} (${chunk.length} files)`)

    // 順序處理每個分塊內的文件
    for (const file of chunk) {
      reportProgress(file.originalName, 1)

      try {
        // Story 0.6, 0.8 & 0.9: 傳遞公司識別、發行者識別和格式識別配置給 processFile
        const result = await processFile(file, { maxRetries, retryDelayMs, companyConfig, issuerConfig, formatConfig })
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
        reportProgress(undefined, 0)

        // 更新批次進度（包含公司識別、發行者識別和格式識別計數）
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
      } catch (error) {
        // 處理意外錯誤
        console.error(`[Batch ${batchId}] Unexpected error processing ${file.originalName}:`, error)
        failedCount++
        completedCount++
        results.push({
          fileId: file.id,
          success: false,
          error: error instanceof Error ? error.message : 'Unexpected error',
        })
      }
    }

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
  // 注意：如果術語聚合已完成，狀態應為 AGGREGATED，否則為 COMPLETED 或 FAILED
  const finalStatus = failedCount === files.length
    ? 'FAILED'
    : termAggregationCompleted
      ? 'AGGREGATED' // 術語聚合已完成
      : 'COMPLETED'

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
