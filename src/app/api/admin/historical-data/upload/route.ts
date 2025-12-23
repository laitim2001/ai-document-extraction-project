/**
 * @fileoverview 歷史數據文件上傳 API
 * @description
 *   處理批量文件上傳：
 *   - POST: 上傳文件到指定批次
 *   - 支援 multipart/form-data
 *   - 自動執行文件類型檢測
 *   - 限制：最多 500 個文件，每個最大 50MB
 *
 * @module src/app/api/admin/historical-data/upload
 * @since Epic 0 - Story 0.1
 * @lastModified 2025-12-23
 *
 * @features
 *   - Multipart 文件上傳
 *   - 自動文件類型檢測 (NATIVE_PDF, SCANNED_PDF, IMAGE)
 *   - 批量處理優化
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { HistoricalBatchStatus, HistoricalFileStatus } from '@prisma/client'
import {
  FileDetectionService,
  FILE_SIZE_LIMITS,
  SUPPORTED_MIME_TYPES,
} from '@/services/file-detection.service'
import { v4 as uuidv4 } from 'uuid'
import path from 'path'
import fs from 'fs/promises'

// ============================================================
// Constants
// ============================================================

/** 暫存目錄路徑 */
const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads/historical'

/** 支援的副檔名 */
const SUPPORTED_EXTENSIONS = ['pdf', 'jpg', 'jpeg', 'png', 'tiff', 'tif']

// ============================================================
// Helper Functions
// ============================================================

/**
 * 確保上傳目錄存在
 */
async function ensureUploadDir(batchId: string): Promise<string> {
  const batchDir = path.join(UPLOAD_DIR, batchId)
  await fs.mkdir(batchDir, { recursive: true })
  return batchDir
}

/**
 * 驗證文件類型
 */
function isValidFileType(fileName: string, mimeType: string): boolean {
  const ext = fileName.split('.').pop()?.toLowerCase()
  if (!ext || !SUPPORTED_EXTENSIONS.includes(ext)) {
    return false
  }

  const allSupportedMimes: string[] = [...SUPPORTED_MIME_TYPES.PDF, ...SUPPORTED_MIME_TYPES.IMAGE]
  return allSupportedMimes.includes(mimeType)
}

// ============================================================
// POST /api/admin/historical-data/upload
// ============================================================

/**
 * 上傳文件到批次
 *
 * @description
 *   處理 multipart/form-data 格式的文件上傳
 *   - batchId: 目標批次 ID
 *   - files: 要上傳的文件（支援多檔）
 *
 * @returns 上傳結果，包含成功和失敗的文件清單
 */
export async function POST(request: NextRequest) {
  try {
    // 驗證用戶身份
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/unauthorized',
          title: 'Unauthorized',
          status: 401,
          detail: '請先登入',
        },
        { status: 401 }
      )
    }

    // 解析 multipart form data
    const formData = await request.formData()
    const batchId = formData.get('batchId') as string
    const files = formData.getAll('files') as File[]

    // 驗證 batchId
    if (!batchId) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/validation',
          title: 'Validation Error',
          status: 400,
          detail: '缺少批次 ID',
        },
        { status: 400 }
      )
    }

    // 驗證批次是否存在
    const batch = await prisma.historicalBatch.findUnique({
      where: { id: batchId },
      include: {
        _count: {
          select: { files: true },
        },
      },
    })

    if (!batch) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/not-found',
          title: 'Not Found',
          status: 404,
          detail: '找不到指定的批次',
        },
        { status: 404 }
      )
    }

    // 檢查批次狀態
    if (batch.status !== HistoricalBatchStatus.PENDING) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/conflict',
          title: 'Conflict',
          status: 409,
          detail: `批次狀態為 ${batch.status}，無法上傳文件。只有 PENDING 狀態的批次可以上傳文件。`,
        },
        { status: 409 }
      )
    }

    // 驗證文件數量
    if (files.length === 0) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/validation',
          title: 'Validation Error',
          status: 400,
          detail: '未選擇任何文件',
        },
        { status: 400 }
      )
    }

    const currentFileCount = batch._count.files
    const totalAfterUpload = currentFileCount + files.length

    if (totalAfterUpload > FILE_SIZE_LIMITS.MAX_BATCH_SIZE) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/validation',
          title: 'Validation Error',
          status: 400,
          detail: `超過批次文件數量限制。目前已有 ${currentFileCount} 個文件，最多可上傳 ${FILE_SIZE_LIMITS.MAX_BATCH_SIZE - currentFileCount} 個文件。`,
        },
        { status: 400 }
      )
    }

    // 確保上傳目錄存在
    const uploadDir = await ensureUploadDir(batchId)

    // 處理每個文件
    const results: {
      successful: Array<{
        id: string
        fileName: string
        originalName: string
        detectedType: string | null
        confidence: number
      }>
      failed: Array<{
        fileName: string
        error: string
      }>
    } = {
      successful: [],
      failed: [],
    }

    for (const file of files) {
      try {
        // 驗證文件類型
        if (!isValidFileType(file.name, file.type)) {
          results.failed.push({
            fileName: file.name,
            error: `不支援的文件類型: ${file.type}`,
          })
          continue
        }

        // 驗證文件大小
        if (file.size > FILE_SIZE_LIMITS.MAX_SIZE_BYTES) {
          results.failed.push({
            fileName: file.name,
            error: `文件大小超過限制 (${FILE_SIZE_LIMITS.MAX_SIZE_BYTES / 1024 / 1024}MB)`,
          })
          continue
        }

        // 讀取文件內容
        const buffer = Buffer.from(await file.arrayBuffer())

        // 執行文件類型檢測
        const detection = await FileDetectionService.detectFileType(buffer, file.name, file.type)

        // 生成唯一文件名
        const fileId = uuidv4()
        const ext = file.name.split('.').pop()?.toLowerCase() || 'bin'
        const storedFileName = `${fileId}.${ext}`
        const storagePath = path.join(uploadDir, storedFileName)

        // 儲存文件到本地（實際專案應使用 Azure Blob Storage）
        await fs.writeFile(storagePath, buffer)

        // 建立資料庫記錄
        const historicalFile = await prisma.historicalFile.create({
          data: {
            batchId,
            fileName: storedFileName,
            originalName: file.name,
            fileSize: file.size,
            mimeType: file.type,
            detectedType: detection.detectedType,
            storagePath,
            status: detection.error ? HistoricalFileStatus.FAILED : HistoricalFileStatus.DETECTED,
            errorMessage: detection.error || null,
            metadata: {
              pageCount: detection.metadata.pageCount,
              textLength: detection.metadata.textLength,
              avgCharsPerPage: detection.metadata.avgCharsPerPage,
              width: detection.metadata.width,
              height: detection.metadata.height,
              confidence: detection.confidence,
            },
            detectedAt: new Date(),
          },
        })

        results.successful.push({
          id: historicalFile.id,
          fileName: storedFileName,
          originalName: file.name,
          detectedType: detection.detectedType,
          confidence: detection.confidence,
        })
      } catch (fileError) {
        results.failed.push({
          fileName: file.name,
          error: fileError instanceof Error ? fileError.message : '處理文件時發生錯誤',
        })
      }
    }

    // 更新批次統計
    await prisma.historicalBatch.update({
      where: { id: batchId },
      data: {
        totalFiles: {
          increment: results.successful.length,
        },
        failedFiles: {
          increment: results.failed.length,
        },
      },
    })

    return NextResponse.json({
      success: true,
      data: {
        batchId,
        uploaded: results.successful.length,
        failed: results.failed.length,
        results,
      },
    })
  } catch (error) {
    console.error('[POST /api/admin/historical-data/upload] Error:', error)
    return NextResponse.json(
      {
        type: 'https://api.example.com/errors/internal',
        title: 'Internal Server Error',
        status: 500,
        detail: error instanceof Error ? error.message : '伺服器錯誤',
      },
      { status: 500 }
    )
  }
}

// ============================================================
// Config: Disable body parser for large file uploads
// ============================================================

export const config = {
  api: {
    bodyParser: false,
  },
}
