/**
 * @fileoverview 信心度服務
 * @description
 *   整合信心度計算邏輯與歷史準確率服務，提供文件級別的信心度評估：
 *   - 計算文件整體信心度
 *   - 計算單一欄位信心度
 *   - 整合歷史準確率數據
 *   - 更新提取結果的信心度分數
 *   - 生成處理路徑建議
 *
 *   ## 信心度計算流程
 *
 *   ```
 *   ExtractionResult → 取得 FieldMappings
 *                    → 查詢歷史準確率
 *                    → 計算各欄位信心度
 *                    → 計算文件整體信心度
 *                    → 生成處理建議
 *                    → 儲存結果
 *   ```
 *
 * @module src/services/confidence
 * @since Epic 2 - Story 2.5 (Confidence Score Calculation)
 * @lastModified 2025-12-18
 *
 * @dependencies
 *   - @/lib/confidence - 信心度計算模組
 *   - @/services/historical-accuracy.service - 歷史準確率服務
 *   - @/lib/prisma - Prisma 客戶端
 *
 * @related
 *   - src/services/extraction.service.ts - 提取服務
 *   - src/app/api/confidence/ - API 端點
 *   - prisma/schema.prisma - ExtractionResult model
 */

import { prisma } from '@/lib/prisma'
import {
  calculateFieldConfidence,
  calculateDocumentConfidence,
  calculateWeightedDocumentConfidence,
  ROUTING_THRESHOLDS,
} from '@/lib/confidence'
import {
  getHistoricalAccuracy,
  getForwarderFieldAccuracy,
  recordFieldCorrections,
} from './historical-accuracy.service'
import type {
  DocumentConfidenceResult,
  FieldConfidenceResult,
  ForwarderFieldAccuracy,
  ProcessingRecommendation,
} from '@/types/confidence'
import type { FieldMappings, FieldMappingResult } from '@/types/field-mapping'
import { getRequiredFields } from '@/types/invoice-fields'
import type { ProcessingPath } from '@prisma/client'

// ============================================================
// Types
// ============================================================

/**
 * 信心度計算選項
 */
export interface ConfidenceCalculationOptions {
  /** 是否包含歷史準確率數據 */
  includeHistorical?: boolean
  /** 是否應用關鍵欄位懲罰 */
  applyCriticalPenalty?: boolean
  /** 自定義關鍵欄位列表 */
  criticalFields?: string[]
}

/**
 * 信心度計算結果（包含儲存狀態）
 */
export interface ConfidenceServiceResult {
  /** 文件信心度結果 */
  confidence: DocumentConfidenceResult
  /** 處理路徑建議 */
  processingPath: ProcessingPath
  /** 是否已儲存到資料庫 */
  saved: boolean
}

// ============================================================
// Main Service Functions
// ============================================================

/**
 * 計算並儲存文件的信心度分數
 *
 * @description
 *   完整的信心度計算流程：
 *   1. 從 ExtractionResult 取得欄位映射
 *   2. 查詢歷史準確率（如啟用）
 *   3. 計算各欄位信心度
 *   4. 計算文件整體信心度（含關鍵欄位懲罰）
 *   5. 生成處理路徑建議
 *   6. 儲存結果到資料庫
 *
 * @param extractionResultId - 提取結果 ID
 * @param options - 計算選項
 * @returns 信心度服務結果
 *
 * @example
 *   const result = await calculateAndSaveConfidence('ext_123')
 *   // { confidence: {...}, processingPath: 'AUTO_APPROVE', saved: true }
 */
export async function calculateAndSaveConfidence(
  extractionResultId: string,
  options: ConfidenceCalculationOptions = {}
): Promise<ConfidenceServiceResult> {
  const {
    includeHistorical = true,
    applyCriticalPenalty = true,
    criticalFields,
  } = options

  // 1. 取得提取結果
  const extractionResult = await prisma.extractionResult.findUnique({
    where: { id: extractionResultId },
    include: {
      document: true,
      forwarder: true,
    },
  })

  if (!extractionResult) {
    throw new Error(`ExtractionResult not found: ${extractionResultId}`)
  }

  // 2. 解析欄位映射
  const fieldMappings = extractionResult.fieldMappings as unknown as FieldMappings

  // 3. 查詢歷史準確率
  let historicalData: ForwarderFieldAccuracy | undefined
  if (includeHistorical && extractionResult.forwarderId) {
    historicalData = await getForwarderFieldAccuracy(extractionResult.forwarderId)
  }

  // 4. 計算信心度
  let confidence: DocumentConfidenceResult

  if (applyCriticalPenalty) {
    // 取得關鍵欄位列表
    const criticalFieldNames =
      criticalFields ?? getRequiredFields().map((f) => f.name)

    confidence = calculateWeightedDocumentConfidence(
      fieldMappings,
      criticalFieldNames,
      historicalData
    )
  } else {
    confidence = calculateDocumentConfidence(fieldMappings, historicalData)
  }

  // 5. 生成處理路徑
  const processingPath = mapRecommendationToProcessingPath(confidence.recommendation)

  // 6. 儲存結果
  await prisma.extractionResult.update({
    where: { id: extractionResultId },
    data: {
      confidenceScores: JSON.parse(JSON.stringify(confidence)),
      averageConfidence: confidence.overallScore,
    },
  })

  // 7. 更新文件的處理路徑
  await prisma.document.update({
    where: { id: extractionResult.documentId },
    data: {
      processingPath,
    },
  })

  return {
    confidence,
    processingPath,
    saved: true,
  }
}

/**
 * 計算文件信心度（不儲存）
 *
 * @description
 *   純計算信心度，不進行資料庫操作。
 *   適用於預覽或驗證場景。
 *
 * @param fieldMappings - 欄位映射結果
 * @param forwarderId - Forwarder ID（用於查詢歷史準確率）
 * @param options - 計算選項
 * @returns 文件信心度結果
 */
export async function calculateConfidenceOnly(
  fieldMappings: FieldMappings,
  forwarderId?: string | null,
  options: ConfidenceCalculationOptions = {}
): Promise<DocumentConfidenceResult> {
  const {
    includeHistorical = true,
    applyCriticalPenalty = true,
    criticalFields,
  } = options

  // 查詢歷史準確率
  let historicalData: ForwarderFieldAccuracy | undefined
  if (includeHistorical && forwarderId) {
    historicalData = await getForwarderFieldAccuracy(forwarderId)
  }

  // 計算信心度
  if (applyCriticalPenalty) {
    const criticalFieldNames =
      criticalFields ?? getRequiredFields().map((f) => f.name)
    return calculateWeightedDocumentConfidence(
      fieldMappings,
      criticalFieldNames,
      historicalData
    )
  }

  return calculateDocumentConfidence(fieldMappings, historicalData)
}

/**
 * 計算單一欄位的信心度
 *
 * @param fieldMapping - 欄位映射結果
 * @param fieldName - 欄位名稱
 * @param forwarderId - Forwarder ID（用於查詢歷史準確率）
 * @returns 欄位信心度結果
 */
export async function calculateFieldConfidenceWithHistory(
  fieldMapping: FieldMappingResult,
  fieldName: string,
  forwarderId?: string | null
): Promise<FieldConfidenceResult> {
  // 查詢歷史準確率
  const historicalData = await getHistoricalAccuracy(fieldName, forwarderId)

  return calculateFieldConfidence(fieldMapping, historicalData)
}

// ============================================================
// Query Functions
// ============================================================

/**
 * 取得文件的信心度結果
 *
 * @param documentId - 文件 ID
 * @returns 文件信心度結果（如已計算）
 */
export async function getDocumentConfidence(
  documentId: string
): Promise<DocumentConfidenceResult | null> {
  const extractionResult = await prisma.extractionResult.findUnique({
    where: { documentId },
    select: { confidenceScores: true },
  })

  if (!extractionResult?.confidenceScores) {
    return null
  }

  return extractionResult.confidenceScores as unknown as DocumentConfidenceResult
}

/**
 * 取得提取結果的信心度
 *
 * @param extractionResultId - 提取結果 ID
 * @returns 文件信心度結果（如已計算）
 */
export async function getExtractionConfidence(
  extractionResultId: string
): Promise<DocumentConfidenceResult | null> {
  const extractionResult = await prisma.extractionResult.findUnique({
    where: { id: extractionResultId },
    select: { confidenceScores: true },
  })

  if (!extractionResult?.confidenceScores) {
    return null
  }

  return extractionResult.confidenceScores as unknown as DocumentConfidenceResult
}

// ============================================================
// Update Functions
// ============================================================

/**
 * 記錄審核結果並更新歷史準確率
 *
 * @description
 *   當用戶完成審核後，記錄每個欄位是否被修正。
 *   這些數據會更新歷史準確率，影響未來的信心度計算。
 *
 * @param documentId - 文件 ID
 * @param corrections - 修正記錄（欄位名稱 → 是否正確）
 *
 * @example
 *   await recordReviewResult('doc_123', {
 *     invoice_number: true,  // 正確，無修正
 *     total_amount: false,   // 被修正
 *   })
 */
export async function recordReviewResult(
  documentId: string,
  corrections: Record<string, boolean>
): Promise<void> {
  // 取得文件關聯的 forwarderId
  const document = await prisma.document.findUnique({
    where: { id: documentId },
    select: { forwarderId: true },
  })

  const forwarderId = document?.forwarderId ?? null

  // 轉換為批量記錄格式
  const correctionRecords = Object.entries(corrections).map(
    ([fieldName, wasCorrect]) => ({
      fieldName,
      forwarderId,
      wasCorrect,
    })
  )

  await recordFieldCorrections(correctionRecords)
}

/**
 * 重新計算文件的信心度
 *
 * @description
 *   當欄位映射被更新後，重新計算信心度。
 *
 * @param extractionResultId - 提取結果 ID
 * @param options - 計算選項
 * @returns 更新後的信心度結果
 */
export async function recalculateConfidence(
  extractionResultId: string,
  options: ConfidenceCalculationOptions = {}
): Promise<ConfidenceServiceResult> {
  return calculateAndSaveConfidence(extractionResultId, options)
}

// ============================================================
// Batch Operations
// ============================================================

/**
 * 批量計算多個文件的信心度
 *
 * @param extractionResultIds - 提取結果 ID 列表
 * @param options - 計算選項
 * @returns 計算結果映射
 */
export async function batchCalculateConfidence(
  extractionResultIds: string[],
  options: ConfidenceCalculationOptions = {}
): Promise<Map<string, ConfidenceServiceResult>> {
  const results = new Map<string, ConfidenceServiceResult>()

  // 使用 Promise.allSettled 避免單個失敗影響其他
  const calculations = await Promise.allSettled(
    extractionResultIds.map(async (id) => {
      const result = await calculateAndSaveConfidence(id, options)
      return { id, result }
    })
  )

  for (const calculation of calculations) {
    if (calculation.status === 'fulfilled') {
      results.set(calculation.value.id, calculation.value.result)
    } else {
      console.error('[ConfidenceService] Batch calculation failed:', calculation.reason)
    }
  }

  return results
}

// ============================================================
// Helper Functions
// ============================================================

/**
 * 將處理建議映射到 Prisma 的 ProcessingPath enum
 */
function mapRecommendationToProcessingPath(
  recommendation: ProcessingRecommendation
): ProcessingPath {
  switch (recommendation) {
    case 'auto_approve':
      return 'AUTO_APPROVE'
    case 'quick_review':
      return 'QUICK_REVIEW'
    case 'full_review':
      return 'FULL_REVIEW'
    default:
      return 'FULL_REVIEW'
  }
}

/**
 * 檢查信心度是否達到自動批准閾值
 */
export function isAutoApprovable(score: number): boolean {
  return score >= ROUTING_THRESHOLDS.autoApprove
}

/**
 * 檢查信心度是否達到快速審核閾值
 */
export function isQuickReviewable(score: number): boolean {
  return score >= ROUTING_THRESHOLDS.quickReview && score < ROUTING_THRESHOLDS.autoApprove
}

/**
 * 檢查信心度是否需要完整審核
 */
export function requiresFullReview(score: number): boolean {
  return score < ROUTING_THRESHOLDS.quickReview
}
