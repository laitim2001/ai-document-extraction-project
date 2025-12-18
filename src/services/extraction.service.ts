/**
 * @fileoverview OCR 提取服務
 * @description
 *   提供 OCR 提取功能的業務邏輯：
 *   - 調用 Python OCR 微服務
 *   - 管理 OCR 結果
 *   - 更新文件狀態
 *
 * @module src/services/extraction
 * @since Epic 2 - Story 2.2 (File OCR Extraction Service)
 * @lastModified 2025-12-18
 *
 * @features
 *   - 調用 Python FastAPI OCR 服務
 *   - 儲存 OCR 結果到資料庫
 *   - 文件狀態管理
 *   - 錯誤處理和重試
 *
 * @dependencies
 *   - @/lib/prisma - Prisma ORM
 *   - @/lib/azure - Azure Blob Storage
 *
 * @related
 *   - src/app/api/extraction/route.ts - Extraction API
 *   - python-services/extraction/ - Python OCR 服務
 */

import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { generateSasUrl } from '@/lib/azure'
import type {
  PythonOcrResponse,
  OcrResultRecord,
} from '@/types/extraction'

// ============================================================
// Constants
// ============================================================

/** Python OCR 服務 URL */
const OCR_SERVICE_URL = process.env.OCR_SERVICE_URL || 'http://localhost:8000'

/** SAS URL 有效時間（分鐘） */
const SAS_URL_EXPIRY_MINUTES = 60

/** 請求超時時間（毫秒） */
const REQUEST_TIMEOUT_MS = 120000 // 2 分鐘

// ============================================================
// Types
// ============================================================

/**
 * 提取選項
 */
interface ExtractionOptions {
  /** 是否強制重新處理 */
  force?: boolean
}

/**
 * 提取結果
 */
interface ExtractionResult {
  /** 是否成功 */
  success: boolean
  /** OCR 結果記錄 */
  ocrResult: OcrResultRecord | null
  /** 錯誤訊息 */
  error?: string
}

// ============================================================
// Service Functions
// ============================================================

/**
 * 執行文件 OCR 提取
 *
 * @description
 *   1. 獲取文件資訊
 *   2. 生成 SAS URL
 *   3. 調用 Python OCR 服務
 *   4. 儲存結果到資料庫
 *   5. 更新文件狀態
 *
 * @param documentId - 文件 ID
 * @param options - 提取選項
 * @returns 提取結果
 */
export async function extractDocument(
  documentId: string,
  options: ExtractionOptions = {}
): Promise<ExtractionResult> {
  const { force = false } = options

  try {
    // 1. 獲取文件資訊
    const document = await prisma.document.findUnique({
      where: { id: documentId },
      include: { ocrResult: true },
    })

    if (!document) {
      return {
        success: false,
        ocrResult: null,
        error: 'Document not found',
      }
    }

    // 檢查是否已有 OCR 結果
    if (document.ocrResult && !force) {
      return {
        success: true,
        ocrResult: document.ocrResult as OcrResultRecord,
      }
    }

    // 2. 更新文件狀態為處理中
    await prisma.document.update({
      where: { id: documentId },
      data: { status: 'OCR_PROCESSING' },
    })

    // 3. 生成 SAS URL
    const sasUrl = await generateSasUrl(
      document.blobName,
      SAS_URL_EXPIRY_MINUTES
    )

    // 4. 調用 Python OCR 服務
    const ocrResponse = await callOcrService(sasUrl, documentId)

    // 5. 儲存結果到資料庫
    const ocrResult = await saveOcrResult(documentId, ocrResponse, force)

    // 6. 更新文件狀態
    const newStatus = ocrResponse.success ? 'OCR_COMPLETED' : 'OCR_FAILED'
    await prisma.document.update({
      where: { id: documentId },
      data: {
        status: newStatus,
        errorMessage: ocrResponse.success ? null : ocrResponse.errorMessage,
      },
    })

    return {
      success: ocrResponse.success,
      ocrResult,
      error: ocrResponse.success ? undefined : ocrResponse.errorMessage ?? undefined,
    }
  } catch (error) {
    console.error('Extraction error:', error)

    // 更新文件狀態為失敗
    await prisma.document.update({
      where: { id: documentId },
      data: {
        status: 'OCR_FAILED',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      },
    })

    return {
      success: false,
      ocrResult: null,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * 調用 Python OCR 服務
 *
 * @param documentUrl - 文件 URL（含 SAS token）
 * @param documentId - 文件 ID
 * @returns OCR 響應
 */
async function callOcrService(
  documentUrl: string,
  documentId: string
): Promise<PythonOcrResponse> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    const response = await fetch(`${OCR_SERVICE_URL}/extract/url`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        documentUrl,
        documentId,
      }),
      signal: controller.signal,
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`OCR service error: ${response.status} - ${errorText}`)
    }

    return await response.json()
  } finally {
    clearTimeout(timeoutId)
  }
}

/**
 * 儲存 OCR 結果到資料庫
 *
 * @param documentId - 文件 ID
 * @param response - OCR 響應
 * @param force - 是否強制覆蓋
 * @returns OCR 結果記錄
 */
async function saveOcrResult(
  documentId: string,
  response: PythonOcrResponse,
  force: boolean
): Promise<OcrResultRecord> {
  // 處理 invoiceData 的 null 值（Prisma 需要特殊處理）
  const invoiceDataValue = response.invoiceData
    ? (response.invoiceData as unknown as Prisma.InputJsonValue)
    : Prisma.JsonNull

  const data = {
    rawResult: (response.rawResult ?? {}) as Prisma.InputJsonValue,
    extractedText: response.extractedText || '',
    invoiceData: invoiceDataValue,
    processingTime: response.processingTime,
    pageCount: response.pageCount,
    confidence: response.confidence,
    errorCode: response.success ? null : response.errorCode,
    errorMessage: response.success ? null : response.errorMessage,
    retryCount: response.retryCount,
  }

  if (force) {
    // 強制更新：先刪除再建立
    await prisma.ocrResult.deleteMany({
      where: { documentId },
    })
  }

  const result = await prisma.ocrResult.upsert({
    where: { documentId },
    update: data,
    create: {
      documentId,
      ...data,
    },
  })

  return result as OcrResultRecord
}

/**
 * 獲取文件的 OCR 結果
 *
 * @param documentId - 文件 ID
 * @returns OCR 結果或 null
 */
export async function getOcrResult(
  documentId: string
): Promise<OcrResultRecord | null> {
  const result = await prisma.ocrResult.findUnique({
    where: { documentId },
  })

  return result as OcrResultRecord | null
}

/**
 * 批量提取文件
 *
 * @param documentIds - 文件 ID 列表
 * @returns 提取結果列表
 */
export async function extractDocuments(
  documentIds: string[]
): Promise<ExtractionResult[]> {
  const results: ExtractionResult[] = []

  for (const documentId of documentIds) {
    const result = await extractDocument(documentId)
    results.push(result)
  }

  return results
}

/**
 * 重試失敗的 OCR
 *
 * @param documentId - 文件 ID
 * @returns 提取結果
 */
export async function retryExtraction(
  documentId: string
): Promise<ExtractionResult> {
  // 獲取當前 OCR 結果
  const existingResult = await getOcrResult(documentId)

  // 檢查重試次數
  if (existingResult && existingResult.retryCount >= 3) {
    return {
      success: false,
      ocrResult: existingResult,
      error: 'Maximum retry count exceeded',
    }
  }

  // 執行重新提取
  return extractDocument(documentId, { force: true })
}

/**
 * 檢查 OCR 服務健康狀態
 *
 * @returns 是否健康
 */
export async function checkOcrServiceHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${OCR_SERVICE_URL}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    })

    if (!response.ok) {
      return false
    }

    const data = await response.json()
    return data.status === 'healthy'
  } catch {
    return false
  }
}
