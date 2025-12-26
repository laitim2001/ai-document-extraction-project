/**
 * @fileoverview 文件發行者識別服務
 * @description
 *   負責從 GPT Vision 提取結果中識別文件發行者，並將其匹配到公司 Profile：
 *   - 從 AI 提取結果中獲取 documentIssuer 信息
 *   - 使用三層匹配策略關聯公司 Profile
 *   - 處理交易對象並建立多對多關聯
 *   - 統計發行者識別結果
 *
 * @module src/services/document-issuer
 * @since Epic 0 - Story 0.8 (文件發行者識別)
 * @lastModified 2025-12-26
 *
 * @features
 *   - extractDocumentIssuer: 從 AI 結果提取發行者
 *   - matchIssuerToCompany: 將發行者匹配到公司 Profile
 *   - processTransactionParties: 處理交易對象
 *   - 識別方法優先級權重計算
 *
 * @dependencies
 *   - Prisma Client - 資料庫操作
 *   - company-matcher.service - 公司匹配服務
 *   - company-auto-create.service - 公司自動建立服務
 *
 * @related
 *   - src/services/gpt-vision.service.ts - GPT Vision 處理服務
 *   - src/services/batch-processor.service.ts - 批量處理服務
 *   - src/types/document-issuer.ts - 類型定義
 */

import { prisma } from '@/lib/prisma'
import { IssuerIdentificationMethod, TransactionPartyRole } from '@prisma/client'
import {
  findMatchingCompany,
  DEFAULT_FUZZY_THRESHOLD,
} from './company-matcher.service'
import {
  identifyOrCreateCompany,
  type ExtractedCompanyInfo,
  type AutoCreateConfig,
} from './company-auto-create.service'
import type {
  DocumentIssuerResult,
  TransactionParty,
  IssuerIdentificationStats,
  TransactionPartyProcessingResult,
} from '@/types/document-issuer'

// Re-export constants from types for convenience
export { DEFAULT_ISSUER_CONFIG, METHOD_PRIORITY_WEIGHTS } from '@/types/document-issuer'

// ============================================================
// Types
// ============================================================

/**
 * GPT Vision 提取結果中的發行者信息結構
 */
interface ExtractionResultWithIssuer {
  documentIssuer?: {
    name: string
    identificationMethod?: string
    confidence?: number
    rawText?: string
  }
  vendor?: {
    name?: string
    address?: string
  }
  buyer?: {
    name?: string
    address?: string
  }
  shipper?: {
    name?: string
  }
  consignee?: {
    name?: string
  }
  [key: string]: unknown
}

/**
 * 發行者識別選項
 */
export interface IssuerExtractionOptions {
  /** 是否自動創建新公司 */
  createIfNotFound?: boolean
  /** 識別來源（用於追蹤） */
  source?: string
  /** 模糊匹配閾值 */
  fuzzyThreshold?: number
  /** 最小信心度閾值 */
  confidenceThreshold?: number
  /** 創建者 ID（創建新公司時使用） */
  createdById?: string
}

// ============================================================
// Core Functions
// ============================================================

/**
 * 從 AI 提取結果中提取文件發行者
 *
 * @description
 *   解析 GPT Vision 提取結果，獲取 documentIssuer 信息，
 *   並將其匹配到現有的公司 Profile 或創建新公司。
 *
 * @param extractionResult - GPT Vision 提取結果
 * @param options - 提取選項
 * @returns 發行者識別結果，如果無法識別則返回 null
 *
 * @example
 * ```typescript
 * const result = await extractDocumentIssuer(gptResult, {
 *   createIfNotFound: true,
 *   source: 'BATCH_PROCESSING',
 *   createdById: 'system',
 * })
 * if (result) {
 *   console.log(`Issuer: ${result.name} (${result.confidence}%)`)
 * }
 * ```
 */
export async function extractDocumentIssuer(
  extractionResult: ExtractionResultWithIssuer,
  options: IssuerExtractionOptions = {}
): Promise<DocumentIssuerResult | null> {
  const {
    createIfNotFound = true,
    // source - reserved for future tracking/logging
    fuzzyThreshold = DEFAULT_FUZZY_THRESHOLD,
    confidenceThreshold = 70,
    createdById,
  } = options

  // 從提取結果中獲取 documentIssuer
  const issuerData = extractionResult.documentIssuer
  if (!issuerData?.name) {
    return null
  }

  // 解析識別方法
  const identificationMethod = parseIdentificationMethod(
    issuerData.identificationMethod
  )

  // 計算調整後的信心度（考慮識別方法權重）
  const rawConfidence = issuerData.confidence ?? 0
  const methodWeight = getMethodWeight(identificationMethod)
  const adjustedConfidence = Math.round(rawConfidence * methodWeight)

  // 如果信心度過低，返回結果但標記需要人工確認
  if (adjustedConfidence < confidenceThreshold) {
    return {
      name: issuerData.name,
      identificationMethod,
      confidence: adjustedConfidence,
      rawText: issuerData.rawText,
      isNewCompany: false,
    }
  }

  // 匹配公司 Profile
  const matchResult = await findMatchingCompany(issuerData.name, {
    fuzzyThreshold,
    useCache: true,
  })

  // 如果找到匹配
  if (matchResult.matched && matchResult.companyId) {
    return {
      name: issuerData.name,
      identificationMethod,
      confidence: adjustedConfidence,
      rawText: issuerData.rawText,
      companyId: matchResult.companyId,
      isNewCompany: false,
      matchType: matchResult.matchType as 'EXACT' | 'VARIANT' | 'FUZZY',
      matchScore: matchResult.matchScore,
    }
  }

  // 如果未找到匹配且允許創建新公司
  if (createIfNotFound && createdById) {
    try {
      const companyInfo: ExtractedCompanyInfo = {
        name: issuerData.name,
      }
      const autoCreateConfig: AutoCreateConfig = {
        createdById,
        findDuplicateSuggestions: false, // 發行者識別時不需要重複建議
      }

      const result = await identifyOrCreateCompany(companyInfo, autoCreateConfig)

      return {
        name: issuerData.name,
        identificationMethod,
        confidence: adjustedConfidence,
        rawText: issuerData.rawText,
        companyId: result.companyId,
        isNewCompany: result.isNewCompany,
        matchType: result.isNewCompany ? 'NEW' : (result.matchResult?.matchType as 'EXACT' | 'VARIANT' | 'FUZZY' || 'EXACT'),
        matchScore: result.isNewCompany ? 1.0 : (result.matchResult?.matchScore || 1.0),
      }
    } catch (error) {
      console.error('[document-issuer] Failed to create company:', error)
      // 創建失敗時返回無公司匹配的結果
      return {
        name: issuerData.name,
        identificationMethod,
        confidence: adjustedConfidence,
        rawText: issuerData.rawText,
        isNewCompany: false,
      }
    }
  }

  // 未找到匹配且不創建新公司
  return {
    name: issuerData.name,
    identificationMethod,
    confidence: adjustedConfidence,
    rawText: issuerData.rawText,
    isNewCompany: false,
  }
}

/**
 * 處理交易對象
 *
 * @description
 *   從提取結果中收集所有交易對象（vendor, buyer, shipper, consignee），
 *   為每個對象匹配或創建公司 Profile，並建立 FileTransactionParty 關聯。
 *
 * @param fileId - 歷史文件 ID
 * @param extractionResult - GPT Vision 提取結果
 * @param options - 處理選項
 * @returns 處理結果
 *
 * @example
 * ```typescript
 * const result = await processTransactionParties('file-123', gptResult, {
 *   createdById: 'system',
 * })
 * console.log(`Processed ${result.parties.length} parties`)
 * ```
 */
export async function processTransactionParties(
  fileId: string,
  extractionResult: ExtractionResultWithIssuer,
  options: IssuerExtractionOptions = {}
): Promise<TransactionPartyProcessingResult> {
  const {
    createIfNotFound = true,
    fuzzyThreshold = DEFAULT_FUZZY_THRESHOLD,
    createdById,
  } = options

  const parties: TransactionParty[] = []
  const partyData: { role: TransactionPartyRole; name: string }[] = []

  // 收集所有交易對象
  if (extractionResult.vendor?.name) {
    partyData.push({ role: 'VENDOR', name: extractionResult.vendor.name })
  }
  if (extractionResult.buyer?.name) {
    partyData.push({ role: 'BUYER', name: extractionResult.buyer.name })
  }
  if (extractionResult.shipper?.name) {
    partyData.push({ role: 'SHIPPER', name: extractionResult.shipper.name })
  }
  if (extractionResult.consignee?.name) {
    partyData.push({ role: 'CONSIGNEE', name: extractionResult.consignee.name })
  }

  // 處理每個交易對象
  for (const party of partyData) {
    try {
      // 匹配公司
      const matchResult = await findMatchingCompany(party.name, {
        fuzzyThreshold,
        useCache: true,
      })

      let companyId: string | undefined
      let isNewCompany = false
      let matchType: 'EXACT' | 'VARIANT' | 'FUZZY' | 'NEW' | undefined
      let matchScore: number | undefined

      if (matchResult.matched && matchResult.companyId) {
        companyId = matchResult.companyId
        matchType = matchResult.matchType as 'EXACT' | 'VARIANT' | 'FUZZY'
        matchScore = matchResult.matchScore
      } else if (createIfNotFound && createdById) {
        // 創建新公司
        const partyCompanyInfo: ExtractedCompanyInfo = {
          name: party.name,
        }
        const partyAutoCreateConfig: AutoCreateConfig = {
          createdById,
          findDuplicateSuggestions: false,
        }
        const result = await identifyOrCreateCompany(partyCompanyInfo, partyAutoCreateConfig)
        companyId = result.companyId
        isNewCompany = result.isNewCompany
        matchType = result.isNewCompany ? 'NEW' : (result.matchResult?.matchType as 'EXACT' | 'VARIANT' | 'FUZZY' || 'EXACT')
        matchScore = result.isNewCompany ? 1.0 : (result.matchResult?.matchScore || 1.0)
      }

      // 建立 FileTransactionParty 關聯（如果有公司 ID）
      if (companyId) {
        await prisma.fileTransactionParty.upsert({
          where: {
            fileId_companyId_role: {
              fileId,
              companyId,
              role: party.role,
            },
          },
          create: {
            fileId,
            companyId,
            role: party.role,
          },
          update: {},
        })
      }

      parties.push({
        role: party.role,
        name: party.name,
        companyId,
        isNewCompany,
        matchType,
        matchScore,
      })
    } catch (error) {
      console.error(
        `[document-issuer] Failed to process party ${party.role}:`,
        error
      )
      // 添加處理失敗的 party（無公司 ID）
      parties.push({
        role: party.role,
        name: party.name,
      })
    }
  }

  return {
    fileId,
    parties,
    success: true,
  }
}

/**
 * 更新歷史文件的發行者識別結果
 *
 * @description
 *   將發行者識別結果保存到 HistoricalFile 記錄中。
 *
 * @param fileId - 歷史文件 ID
 * @param issuerResult - 發行者識別結果
 * @returns 更新後的文件記錄
 */
export async function updateFileIssuerResult(
  fileId: string,
  issuerResult: DocumentIssuerResult
): Promise<void> {
  await prisma.historicalFile.update({
    where: { id: fileId },
    data: {
      documentIssuerId: issuerResult.companyId || null,
      issuerIdentificationMethod: issuerResult.companyId
        ? (issuerResult.identificationMethod as IssuerIdentificationMethod)
        : null,
      issuerConfidence: issuerResult.confidence,
    },
  })
}

/**
 * 獲取批次發行者識別統計
 *
 * @param batchId - 批次 ID
 * @returns 識別統計結果
 */
export async function getBatchIssuerStats(
  batchId: string
): Promise<IssuerIdentificationStats> {
  // 查詢該批次的所有文件
  const files = await prisma.historicalFile.findMany({
    where: { batchId },
    select: {
      id: true,
      documentIssuerId: true,
      issuerIdentificationMethod: true,
      issuerConfidence: true,
    },
  })

  const stats: IssuerIdentificationStats = {
    totalFiles: files.length,
    identifiedCount: 0,
    failedCount: 0,
    lowConfidenceCount: 0,
    newCompanyCount: 0, // 需要額外查詢
    methodDistribution: {
      LOGO: 0,
      HEADER: 0,
      LETTERHEAD: 0,
      FOOTER: 0,
      AI_INFERENCE: 0,
    },
    issuerDistribution: {},
  }

  for (const file of files) {
    if (file.documentIssuerId) {
      stats.identifiedCount++

      // 統計識別方法分佈
      if (file.issuerIdentificationMethod) {
        stats.methodDistribution[file.issuerIdentificationMethod]++
      }

      // 統計發行者分佈
      if (file.documentIssuerId in stats.issuerDistribution) {
        stats.issuerDistribution[file.documentIssuerId]++
      } else {
        stats.issuerDistribution[file.documentIssuerId] = 1
      }
    } else {
      stats.failedCount++
    }

    // 統計低信心度
    if (
      file.issuerConfidence !== null &&
      file.issuerConfidence < 70
    ) {
      stats.lowConfidenceCount++
    }
  }

  return stats
}

// ============================================================
// Helper Functions
// ============================================================

/**
 * 解析識別方法字串為 enum 值
 */
function parseIdentificationMethod(
  method?: string
): IssuerIdentificationMethod {
  if (!method) return 'AI_INFERENCE'

  const normalizedMethod = method.toUpperCase()
  const validMethods: IssuerIdentificationMethod[] = [
    'LOGO',
    'HEADER',
    'LETTERHEAD',
    'FOOTER',
    'AI_INFERENCE',
  ]

  if (validMethods.includes(normalizedMethod as IssuerIdentificationMethod)) {
    return normalizedMethod as IssuerIdentificationMethod
  }

  return 'AI_INFERENCE'
}

/**
 * 獲取識別方法的優先級權重
 */
function getMethodWeight(method: IssuerIdentificationMethod): number {
  const weights: Record<IssuerIdentificationMethod, number> = {
    LOGO: 1.0,
    HEADER: 0.95,
    LETTERHEAD: 0.90,
    FOOTER: 0.85,
    AI_INFERENCE: 0.75,
  }
  return weights[method] ?? 0.75
}

/**
 * 批量處理文件的發行者識別
 *
 * @description
 *   為批量處理優化的發行者識別函數，
 *   處理單個文件的 documentIssuer 和 transactionParties。
 *
 * @param fileId - 歷史文件 ID
 * @param extractionResult - GPT Vision 提取結果
 * @param options - 處理選項
 * @returns 處理結果
 */
export async function processFileIssuerIdentification(
  fileId: string,
  extractionResult: ExtractionResultWithIssuer,
  options: IssuerExtractionOptions = {}
): Promise<{
  issuer: DocumentIssuerResult | null
  parties: TransactionParty[]
  success: boolean
  error?: string
}> {
  try {
    // 1. 提取發行者
    const issuerResult = await extractDocumentIssuer(extractionResult, options)

    // 2. 如果有發行者結果，更新文件記錄
    if (issuerResult) {
      await updateFileIssuerResult(fileId, issuerResult)
    }

    // 3. 處理交易對象
    const partyResult = await processTransactionParties(
      fileId,
      extractionResult,
      options
    )

    return {
      issuer: issuerResult,
      parties: partyResult.parties,
      success: true,
    }
  } catch (error) {
    console.error(
      `[document-issuer] Failed to process file ${fileId}:`,
      error
    )
    return {
      issuer: null,
      parties: [],
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
