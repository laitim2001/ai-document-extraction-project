/**
 * @fileoverview 文件類型檢測服務
 * @description
 *   提供批量上傳文件的類型檢測功能：
 *   - NATIVE_PDF: 原生數位 PDF（有文字層）
 *   - SCANNED_PDF: 掃描型 PDF（純圖片，需 OCR）
 *   - IMAGE: 圖片文件（JPG/PNG/TIFF）
 *
 * @module src/services/file-detection.service
 * @since Epic 0 - Story 0.1
 * @lastModified 2025-12-24
 *
 * @features
 *   - PDF 文字層檢測
 *   - 文件類型識別
 *   - 元數據提取（頁數、檔案大小）
 *   - 批量檢測處理
 *
 * @dependencies
 *   - pdf-parse: PDF 解析與文字提取（使用動態導入）
 */

import { DetectedFileType } from '@prisma/client'

// ============================================================
// Types
// ============================================================

/** 文件檢測結果 */
export interface FileDetectionResult {
  /** 檢測到的文件類型 */
  detectedType: DetectedFileType
  /** 檢測信心度 (0-100) */
  confidence: number
  /** 文件元數據 */
  metadata: FileMetadata
  /** 錯誤訊息（如檢測失敗） */
  error?: string
}

/** 文件元數據 */
export interface FileMetadata {
  /** 頁數（PDF 類型） */
  pageCount?: number
  /** 文字字元數（用於判斷是否有文字層） */
  textLength?: number
  /** 每頁平均字元數 */
  avgCharsPerPage?: number
  /** 圖片寬度（IMAGE 類型） */
  width?: number
  /** 圖片高度（IMAGE 類型） */
  height?: number
  /** MIME 類型 */
  mimeType: string
  /** 檔案大小（bytes） */
  fileSize: number
}

/** 批量檢測結果 */
export interface BatchDetectionResult {
  /** 成功檢測的文件數 */
  successCount: number
  /** 失敗的文件數 */
  failedCount: number
  /** 各文件的檢測結果 */
  results: Map<string, FileDetectionResult>
}

// ============================================================
// Constants
// ============================================================

/** 支援的文件類型 */
export const SUPPORTED_MIME_TYPES = {
  PDF: ['application/pdf'],
  IMAGE: ['image/jpeg', 'image/png', 'image/tiff'],
} as const

/** PDF 文字層判斷閾值 */
const PDF_TEXT_THRESHOLD = {
  /** 每頁至少需要的字元數才算有文字層 */
  MIN_CHARS_PER_PAGE: 50,
  /** 高信心度的字元數閾值 */
  HIGH_CONFIDENCE_CHARS: 200,
} as const

/** 文件大小限制 */
export const FILE_SIZE_LIMITS = {
  /** 最大檔案大小（50MB） */
  MAX_SIZE_BYTES: 50 * 1024 * 1024,
  /** 最大批量檔案數 */
  MAX_BATCH_SIZE: 500,
} as const

// ============================================================
// Service Class
// ============================================================

/**
 * 文件類型檢測服務
 *
 * @description 提供文件類型檢測與元數據提取功能
 * @example
 * ```typescript
 * const result = await FileDetectionService.detectFileType(buffer, 'document.pdf', 'application/pdf');
 * console.log(result.detectedType); // 'NATIVE_PDF' | 'SCANNED_PDF'
 * ```
 */
export class FileDetectionService {
  /**
   * 檢測單一文件的類型
   *
   * @param buffer - 文件內容 Buffer
   * @param fileName - 文件名稱
   * @param mimeType - MIME 類型
   * @returns 檢測結果
   */
  static async detectFileType(
    buffer: Buffer,
    fileName: string,
    mimeType: string
  ): Promise<FileDetectionResult> {
    try {
      const fileSize = buffer.length

      // 驗證文件大小
      if (fileSize > FILE_SIZE_LIMITS.MAX_SIZE_BYTES) {
        return {
          detectedType: DetectedFileType.IMAGE, // 預設值
          confidence: 0,
          metadata: { mimeType, fileSize },
          error: `文件大小超過限制 (${FILE_SIZE_LIMITS.MAX_SIZE_BYTES / 1024 / 1024}MB)`,
        }
      }

      // 根據 MIME 類型分流處理
      if ((SUPPORTED_MIME_TYPES.PDF as readonly string[]).includes(mimeType)) {
        return await this.detectPdfType(buffer, mimeType, fileSize)
      } else if (SUPPORTED_MIME_TYPES.IMAGE.some((type) => mimeType.startsWith(type.split('/')[0]))) {
        return this.detectImageType(buffer, mimeType, fileSize)
      } else {
        return {
          detectedType: DetectedFileType.IMAGE,
          confidence: 0,
          metadata: { mimeType, fileSize },
          error: `不支援的文件類型: ${mimeType}`,
        }
      }
    } catch (error) {
      return {
        detectedType: DetectedFileType.IMAGE,
        confidence: 0,
        metadata: { mimeType, fileSize: buffer.length },
        error: error instanceof Error ? error.message : '檢測過程發生未知錯誤',
      }
    }
  }

  /**
   * 檢測 PDF 文件類型（原生/掃描）
   *
   * @param buffer - PDF 內容 Buffer
   * @param mimeType - MIME 類型
   * @param fileSize - 文件大小
   * @returns 檢測結果
   */
  private static async detectPdfType(
    buffer: Buffer,
    mimeType: string,
    fileSize: number
  ): Promise<FileDetectionResult> {
    try {
      // 直接導入 pdf-parse 的核心模組，避開 index.js 中的測試文件讀取
      // pdf-parse 的 index.js 會在載入時嘗試讀取測試文件，導致 ENOENT 錯誤
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const pdfParse = require('pdf-parse/lib/pdf-parse')

      // 使用 pdf-parse v1.x 的函數式 API
      const data = await pdfParse(buffer)

      const textLength = data.text?.length || 0
      const pageCount = data.numpages || 1
      const avgCharsPerPage = textLength / pageCount

      // 判斷是否為原生 PDF（有足夠的文字內容）
      const isNativePdf = avgCharsPerPage >= PDF_TEXT_THRESHOLD.MIN_CHARS_PER_PAGE

      // 計算信心度
      let confidence: number
      if (isNativePdf) {
        // 原生 PDF 信心度：基於每頁字元數
        confidence = Math.min(
          100,
          50 + (avgCharsPerPage / PDF_TEXT_THRESHOLD.HIGH_CONFIDENCE_CHARS) * 50
        )
      } else {
        // 掃描 PDF 信心度：字元越少越確定是掃描件
        confidence = Math.min(100, 100 - avgCharsPerPage * 2)
      }

      return {
        detectedType: isNativePdf ? DetectedFileType.NATIVE_PDF : DetectedFileType.SCANNED_PDF,
        confidence: Math.round(confidence),
        metadata: {
          pageCount,
          textLength,
          avgCharsPerPage: Math.round(avgCharsPerPage),
          mimeType,
          fileSize,
        },
      }
    } catch (error) {
      // PDF 解析失敗，可能是損壞的文件或加密 PDF
      return {
        detectedType: DetectedFileType.SCANNED_PDF,
        confidence: 30,
        metadata: { mimeType, fileSize },
        error: `PDF 解析失敗: ${error instanceof Error ? error.message : '未知錯誤'}`,
      }
    }
  }

  /**
   * 檢測圖片文件類型
   *
   * @param buffer - 圖片內容 Buffer
   * @param mimeType - MIME 類型
   * @param fileSize - 文件大小
   * @returns 檢測結果
   */
  private static detectImageType(
    buffer: Buffer,
    mimeType: string,
    fileSize: number
  ): FileDetectionResult {
    // 嘗試解析圖片尺寸（簡易實現，實際可用 sharp 或 image-size）
    const dimensions = this.getImageDimensions(buffer, mimeType)

    return {
      detectedType: DetectedFileType.IMAGE,
      confidence: 95,
      metadata: {
        ...dimensions,
        mimeType,
        fileSize,
      },
    }
  }

  /**
   * 獲取圖片尺寸（簡易實現）
   *
   * @param buffer - 圖片 Buffer
   * @param mimeType - MIME 類型
   * @returns 圖片尺寸
   */
  private static getImageDimensions(
    buffer: Buffer,
    mimeType: string
  ): { width?: number; height?: number } {
    try {
      // JPEG: 從 SOF0/SOF2 marker 讀取尺寸
      if (mimeType === 'image/jpeg') {
        return this.getJpegDimensions(buffer)
      }
      // PNG: 從 IHDR chunk 讀取尺寸
      if (mimeType === 'image/png') {
        return this.getPngDimensions(buffer)
      }
      // 其他格式暫不支援尺寸讀取
      return {}
    } catch {
      return {}
    }
  }

  /**
   * 讀取 JPEG 圖片尺寸
   */
  private static getJpegDimensions(buffer: Buffer): { width?: number; height?: number } {
    let offset = 2 // Skip SOI marker
    while (offset < buffer.length) {
      const marker = buffer.readUInt16BE(offset)
      offset += 2

      // SOF0 or SOF2 markers contain dimensions
      if (marker === 0xffc0 || marker === 0xffc2) {
        const height = buffer.readUInt16BE(offset + 3)
        const width = buffer.readUInt16BE(offset + 5)
        return { width, height }
      }

      // Skip to next marker
      const length = buffer.readUInt16BE(offset)
      offset += length
    }
    return {}
  }

  /**
   * 讀取 PNG 圖片尺寸
   */
  private static getPngDimensions(buffer: Buffer): { width?: number; height?: number } {
    // PNG IHDR chunk starts at offset 16 (after signature and chunk header)
    if (buffer.length > 24) {
      const width = buffer.readUInt32BE(16)
      const height = buffer.readUInt32BE(20)
      return { width, height }
    }
    return {}
  }

  /**
   * 批量檢測文件類型
   *
   * @param files - 文件列表 Map<fileName, {buffer, mimeType}>
   * @returns 批量檢測結果
   */
  static async detectBatch(
    files: Map<string, { buffer: Buffer; mimeType: string }>
  ): Promise<BatchDetectionResult> {
    const results = new Map<string, FileDetectionResult>()
    let successCount = 0
    let failedCount = 0

    // 並行處理所有文件（限制並行數避免記憶體問題）
    const entries = Array.from(files.entries())
    const BATCH_SIZE = 10

    for (let i = 0; i < entries.length; i += BATCH_SIZE) {
      const batch = entries.slice(i, i + BATCH_SIZE)
      const batchResults = await Promise.all(
        batch.map(async ([fileName, { buffer, mimeType }]) => {
          const result = await this.detectFileType(buffer, fileName, mimeType)
          return { fileName, result }
        })
      )

      for (const { fileName, result } of batchResults) {
        results.set(fileName, result)
        if (result.error) {
          failedCount++
        } else {
          successCount++
        }
      }
    }

    return {
      successCount,
      failedCount,
      results,
    }
  }

  /**
   * 驗證文件是否為支援的類型
   *
   * @param mimeType - MIME 類型
   * @returns 是否支援
   */
  static isSupportedType(mimeType: string): boolean {
    return (
      (SUPPORTED_MIME_TYPES.PDF as readonly string[]).includes(mimeType) ||
      (SUPPORTED_MIME_TYPES.IMAGE as readonly string[]).includes(mimeType)
    )
  }

  /**
   * 獲取支援的文件副檔名列表
   *
   * @returns 副檔名列表（不含點號）
   */
  static getSupportedExtensions(): string[] {
    return ['pdf', 'jpg', 'jpeg', 'png', 'tiff', 'tif']
  }
}
