/**
 * @fileoverview Forwarder 識別服務
 * @description
 *   提供 Forwarder 自動識別功能：
 *   - 調用 Python Mapping 服務進行模式匹配
 *   - 處理識別結果並更新資料庫
 *   - 觸發後續工作流程
 *
 *   信心度路由規則：
 *   - >= 80%: IDENTIFIED（自動識別）
 *   - 50-79%: NEEDS_REVIEW（需要審核）
 *   - < 50%: UNIDENTIFIED（無法識別）
 *
 * @module src/services/identification/identification.service
 * @author Development Team
 * @since Epic 2 - Story 2.3 (Forwarder Auto-Identification)
 * @lastModified 2025-12-18
 *
 * @features
 *   - Python 服務整合
 *   - 信心度計算
 *   - 資料庫更新
 *   - Fire-and-forget 模式支援
 *
 * @dependencies
 *   - @/lib/prisma - Prisma 客戶端
 *
 * @related
 *   - python-services/mapping - Python Mapping 服務
 *   - src/app/api/forwarders/identify/route.ts - API 端點
 */

import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'

// ============================================================
// Types
// ============================================================

/**
 * 識別請求參數
 */
export interface IdentifyRequest {
  documentId: string
  text: string
}

/**
 * Python 服務識別響應
 */
interface MappingServiceResponse {
  success: boolean
  documentId?: string
  forwarderId?: string | null
  forwarderCode?: string | null
  forwarderName?: string | null
  confidence: number
  matchMethod: string
  matchedPatterns: string[]
  matchDetails: Record<string, unknown>[]
  isIdentified: boolean
  needsReview: boolean
  status: 'IDENTIFIED' | 'NEEDS_REVIEW' | 'UNIDENTIFIED'
}

/**
 * 識別結果
 */
export interface IdentificationResult {
  success: boolean
  documentId: string
  forwarderId: string | null
  forwarderCode: string | null
  forwarderName: string | null
  confidence: number
  matchMethod: string
  matchedPatterns: string[]
  matchDetails: Record<string, unknown>[]
  isIdentified: boolean
  needsReview: boolean
  status: 'IDENTIFIED' | 'NEEDS_REVIEW' | 'UNIDENTIFIED' | 'FAILED'
  errorMessage?: string
}

// ============================================================
// Configuration
// ============================================================

/**
 * Mapping 服務 URL
 */
const MAPPING_SERVICE_URL = process.env.MAPPING_SERVICE_URL || 'http://localhost:8001'

/**
 * 請求超時時間（毫秒）
 */
const REQUEST_TIMEOUT = 30000

/**
 * 信心度閾值
 */
export const CONFIDENCE_THRESHOLDS = {
  AUTO_IDENTIFY: 80,
  NEEDS_REVIEW: 50,
} as const

// ============================================================
// Service Class
// ============================================================

/**
 * Forwarder 識別服務
 */
export class IdentificationService {
  private readonly baseUrl: string
  private readonly timeout: number

  constructor(
    baseUrl: string = MAPPING_SERVICE_URL,
    timeout: number = REQUEST_TIMEOUT
  ) {
    this.baseUrl = baseUrl
    this.timeout = timeout
  }

  /**
   * 從 OCR 文本識別 Forwarder
   *
   * @param request - 識別請求
   * @returns 識別結果
   */
  async identify(request: IdentifyRequest): Promise<IdentificationResult> {
    const { documentId, text } = request

    try {
      // 調用 Python Mapping 服務
      const response = await this.callMappingService(text, documentId)

      if (!response.success) {
        return this.createFailedResult(documentId, 'Mapping service returned error')
      }

      // 查找 Forwarder ID（如果 Python 服務返回的是 code）
      let forwarderId = response.forwarderId
      if (!forwarderId && response.forwarderCode) {
        const forwarder = await prisma.forwarder.findUnique({
          where: { code: response.forwarderCode },
        })
        forwarderId = forwarder?.id || null
      }

      // 建立識別結果
      const result: IdentificationResult = {
        success: true,
        documentId,
        forwarderId: forwarderId || null,
        forwarderCode: response.forwarderCode || null,
        forwarderName: response.forwarderName || null,
        confidence: response.confidence,
        matchMethod: response.matchMethod,
        matchedPatterns: response.matchedPatterns,
        matchDetails: response.matchDetails,
        isIdentified: response.isIdentified,
        needsReview: response.needsReview,
        status: response.status,
      }

      // 保存識別結果到資料庫
      await this.saveIdentificationResult(result)

      return result
    } catch (error) {
      console.error('Identification error:', error)
      return this.createFailedResult(
        documentId,
        error instanceof Error ? error.message : 'Unknown error'
      )
    }
  }

  /**
   * 從 OCR 文本識別 Forwarder（Fire-and-forget 模式）
   *
   * 不等待結果，立即返回。適用於在文件上傳後自動觸發識別。
   *
   * @param request - 識別請求
   */
  async identifyAsync(request: IdentifyRequest): Promise<void> {
    // Fire and forget - 不等待結果
    this.identify(request).catch((error) => {
      console.error('Async identification error:', error)
    })
  }

  /**
   * 調用 Python Mapping 服務
   *
   * @param text - OCR 文本
   * @param documentId - 文件 ID
   * @returns Mapping 服務響應
   */
  private async callMappingService(
    text: string,
    documentId: string
  ): Promise<MappingServiceResponse> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), this.timeout)

    try {
      const response = await fetch(`${this.baseUrl}/identify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text,
          documentId,
        }),
        signal: controller.signal,
      })

      if (!response.ok) {
        throw new Error(`Mapping service error: ${response.status}`)
      }

      return await response.json()
    } finally {
      clearTimeout(timeoutId)
    }
  }

  /**
   * 保存識別結果到資料庫
   *
   * @param result - 識別結果
   */
  private async saveIdentificationResult(
    result: IdentificationResult
  ): Promise<void> {
    // 確定識別狀態
    const status = this.mapStatusToDb(result.status)

    // 使用 upsert 更新或創建識別記錄
    await prisma.forwarderIdentification.upsert({
      where: { documentId: result.documentId },
      update: {
        forwarderId: result.forwarderId,
        confidence: result.confidence,
        matchMethod: result.matchMethod,
        matchedPatterns: result.matchedPatterns,
        matchDetails: result.matchDetails as unknown as Prisma.InputJsonValue,
        isAutoMatched: result.isIdentified,
        status,
        updatedAt: new Date(),
      },
      create: {
        documentId: result.documentId,
        forwarderId: result.forwarderId,
        confidence: result.confidence,
        matchMethod: result.matchMethod,
        matchedPatterns: result.matchedPatterns,
        matchDetails: result.matchDetails as unknown as Prisma.InputJsonValue,
        isAutoMatched: result.isIdentified,
        isManual: false,
        status,
      },
    })

    // 如果識別成功，更新 Document 的 forwarderId
    if (result.forwarderId && result.isIdentified) {
      await prisma.document.update({
        where: { id: result.documentId },
        data: { forwarderId: result.forwarderId },
      })
    }
  }

  /**
   * 將狀態字串轉換為資料庫 enum
   *
   * @param status - 狀態字串
   * @returns 資料庫 enum 值
   */
  private mapStatusToDb(
    status: 'IDENTIFIED' | 'NEEDS_REVIEW' | 'UNIDENTIFIED' | 'FAILED'
  ) {
    switch (status) {
      case 'IDENTIFIED':
        return 'IDENTIFIED'
      case 'NEEDS_REVIEW':
        return 'NEEDS_REVIEW'
      case 'UNIDENTIFIED':
        return 'UNIDENTIFIED'
      case 'FAILED':
        return 'FAILED'
      default:
        return 'PENDING'
    }
  }

  /**
   * 創建失敗結果
   *
   * @param documentId - 文件 ID
   * @param errorMessage - 錯誤訊息
   * @returns 失敗的識別結果
   */
  private createFailedResult(
    documentId: string,
    errorMessage: string
  ): IdentificationResult {
    return {
      success: false,
      documentId,
      forwarderId: null,
      forwarderCode: null,
      forwarderName: null,
      confidence: 0,
      matchMethod: 'none',
      matchedPatterns: [],
      matchDetails: [],
      isIdentified: false,
      needsReview: false,
      status: 'FAILED',
      errorMessage,
    }
  }
}

// ============================================================
// Singleton Instance
// ============================================================

/**
 * 識別服務單例實例
 */
export const identificationService = new IdentificationService()

// ============================================================
// Convenience Functions
// ============================================================

/**
 * 從 OCR 文本識別 Forwarder
 *
 * @param documentId - 文件 ID
 * @param text - OCR 文本
 * @returns 識別結果
 */
export async function identifyForwarder(
  documentId: string,
  text: string
): Promise<IdentificationResult> {
  return identificationService.identify({ documentId, text })
}

/**
 * 從 OCR 文本識別 Forwarder（Fire-and-forget 模式）
 *
 * @param documentId - 文件 ID
 * @param text - OCR 文本
 */
export async function identifyForwarderAsync(
  documentId: string,
  text: string
): Promise<void> {
  return identificationService.identifyAsync({ documentId, text })
}
