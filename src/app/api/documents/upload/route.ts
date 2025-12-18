/**
 * @fileoverview 文件上傳 API 端點
 * @description
 *   提供發票文件上傳功能，支援：
 *   - 單個或批量文件上傳（最多 20 個）
 *   - 文件格式驗證（PDF, JPG, PNG）
 *   - 文件大小驗證（最大 10MB）
 *   - 上傳到 Azure Blob Storage
 *   - 資料庫記錄創建
 *   - 自動觸發 OCR 提取（可選）
 *
 *   端點：
 *   - POST /api/documents/upload - 上傳文件
 *
 *   權限要求：
 *   - INVOICE_CREATE 權限
 *
 * @module src/app/api/documents/upload/route
 * @author Development Team
 * @since Epic 2 - Story 2.1 (File Upload Interface & Validation)
 * @lastModified 2025-12-18
 *
 * @dependencies
 *   - next/server - Next.js API 處理
 *   - @/lib/auth - NextAuth 認證
 *   - @/lib/azure/storage - Azure Blob Storage
 *   - @/lib/upload/constants - 上傳配置和驗證
 *   - @/lib/prisma - Prisma ORM
 *   - @/services/extraction.service - OCR 提取服務
 *
 * @related
 *   - src/components/features/invoice/FileUploader.tsx - 前端上傳組件
 *   - src/services/document.service.ts - Document 服務層
 *   - src/services/extraction.service.ts - OCR 提取服務
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { hasPermission } from '@/lib/auth/city-permission'
import { prisma } from '@/lib/prisma'
import { uploadFile, isStorageConfigured } from '@/lib/azure'
import {
  UPLOAD_CONFIG,
  UPLOAD_ERRORS,
  isAllowedType,
  isAllowedSize,
  getExtensionFromMime,
} from '@/lib/upload'
import { PERMISSIONS } from '@/types/permissions'
import { extractDocument } from '@/services/extraction.service'

// ===========================================
// Types
// ===========================================

/**
 * 成功上傳的文件資訊
 */
interface UploadedFile {
  /** 文件 ID */
  id: string
  /** 原始文件名 */
  fileName: string
  /** 處理狀態 */
  status: string
}

/**
 * 上傳失敗的文件資訊
 */
interface FailedFile {
  /** 原始文件名 */
  fileName: string
  /** 錯誤訊息 */
  error: string
}

/**
 * 上傳 API 響應
 */
interface UploadResponse {
  success: true
  data: {
    /** 成功上傳的文件列表 */
    uploaded: UploadedFile[]
    /** 上傳失敗的文件列表 */
    failed: FailedFile[]
    /** 總文件數 */
    total: number
    /** 成功數量 */
    successCount: number
    /** 失敗數量 */
    failedCount: number
  }
}

// ===========================================
// POST /api/documents/upload
// ===========================================

/**
 * 上傳發票文件
 *
 * @description
 *   處理文件上傳請求，包括：
 *   1. 認證和權限檢查
 *   2. 文件格式和大小驗證
 *   3. 上傳到 Azure Blob Storage
 *   4. 創建資料庫記錄
 *
 * @param request - Next.js 請求對象（multipart/form-data）
 * @returns 上傳結果
 *
 * @example
 *   // Request
 *   POST /api/documents/upload
 *   Content-Type: multipart/form-data
 *   Body: files=<File[]>, cityCode=<string>
 *
 *   // Response (201 Created)
 *   {
 *     "success": true,
 *     "data": {
 *       "uploaded": [{ "id": "xxx", "fileName": "invoice.pdf", "status": "UPLOADED" }],
 *       "failed": [],
 *       "total": 1,
 *       "successCount": 1,
 *       "failedCount": 0
 *     }
 *   }
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // ===========================================
    // 1. 認證檢查
    // ===========================================
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json(
        {
          success: false,
          error: {
            type: 'https://api.example.com/errors/unauthorized',
            title: 'Unauthorized',
            status: 401,
            detail: UPLOAD_ERRORS.UNAUTHORIZED,
          },
        },
        { status: 401 }
      )
    }

    // ===========================================
    // 2. 權限檢查
    // ===========================================
    if (!hasPermission(session.user, PERMISSIONS.INVOICE_CREATE)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            type: 'https://api.example.com/errors/forbidden',
            title: 'Forbidden',
            status: 403,
            detail: UPLOAD_ERRORS.FORBIDDEN,
          },
        },
        { status: 403 }
      )
    }

    // ===========================================
    // 3. 檢查 Azure Storage 配置
    // ===========================================
    if (!isStorageConfigured()) {
      return NextResponse.json(
        {
          success: false,
          error: {
            type: 'https://api.example.com/errors/service-unavailable',
            title: 'Service Unavailable',
            status: 503,
            detail: 'Storage service is not configured',
          },
        },
        { status: 503 }
      )
    }

    // ===========================================
    // 4. 解析 FormData
    // ===========================================
    const formData = await request.formData()
    const files = formData.getAll('files') as File[]
    const cityCode = formData.get('cityCode') as string | null
    const autoExtract = formData.get('autoExtract') !== 'false' // 默認啟用

    // ===========================================
    // 5. 驗證文件數量
    // ===========================================
    if (files.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: {
            type: 'https://api.example.com/errors/bad-request',
            title: 'Bad Request',
            status: 400,
            detail: UPLOAD_ERRORS.NO_FILES,
          },
        },
        { status: 400 }
      )
    }

    if (files.length > UPLOAD_CONFIG.MAX_FILES_PER_BATCH) {
      return NextResponse.json(
        {
          success: false,
          error: {
            type: 'https://api.example.com/errors/bad-request',
            title: 'Bad Request',
            status: 400,
            detail: UPLOAD_ERRORS.TOO_MANY_FILES,
          },
        },
        { status: 400 }
      )
    }

    // ===========================================
    // 6. 處理每個文件
    // ===========================================
    const uploaded: UploadedFile[] = []
    const failed: FailedFile[] = []

    for (const file of files) {
      try {
        // 驗證文件類型
        if (!isAllowedType(file.type)) {
          failed.push({
            fileName: file.name,
            error: UPLOAD_ERRORS.INVALID_TYPE,
          })
          continue
        }

        // 驗證文件大小
        if (!isAllowedSize(file.size)) {
          failed.push({
            fileName: file.name,
            error: UPLOAD_ERRORS.FILE_TOO_LARGE,
          })
          continue
        }

        // 轉換為 Buffer
        const buffer = Buffer.from(await file.arrayBuffer())

        // 上傳到 Azure Blob Storage
        const uploadResult = await uploadFile(buffer, file.name, {
          contentType: file.type,
          folder: cityCode || 'general',
          metadata: {
            originalName: file.name,
            uploadedBy: session.user.id,
          },
        })

        // 創建資料庫記錄
        const document = await prisma.document.create({
          data: {
            fileName: file.name,
            fileType: file.type,
            fileExtension: getExtensionFromMime(file.type),
            fileSize: file.size,
            filePath: uploadResult.blobUrl,
            blobName: uploadResult.blobName,
            status: 'UPLOADED',
            uploadedBy: session.user.id,
            cityCode,
          },
        })

        uploaded.push({
          id: document.id,
          fileName: document.fileName,
          status: document.status,
        })
      } catch (error) {
        console.error(`Failed to upload ${file.name}:`, error)
        failed.push({
          fileName: file.name,
          error: UPLOAD_ERRORS.UPLOAD_FAILED,
        })
      }
    }

    // ===========================================
    // 7. 自動觸發 OCR 提取（Fire-and-Forget）
    // ===========================================
    if (autoExtract && uploaded.length > 0) {
      // 使用 Promise.allSettled 確保所有請求都被發送
      // 不等待結果，讓 OCR 在背景執行
      Promise.allSettled(
        uploaded.map((doc) => extractDocument(doc.id))
      ).catch((error) => {
        console.error('Auto-extract trigger error:', error)
      })
    }

    // ===========================================
    // 8. 返回響應
    // ===========================================
    const response: UploadResponse = {
      success: true,
      data: {
        uploaded,
        failed,
        total: files.length,
        successCount: uploaded.length,
        failedCount: failed.length,
      },
    }

    // 部分成功返回 201，全部失敗返回 400
    const statusCode = uploaded.length > 0 ? 201 : 400

    return NextResponse.json(response, { status: statusCode })
  } catch (error) {
    console.error('Upload error:', error)

    return NextResponse.json(
      {
        success: false,
        error: {
          type: 'https://api.example.com/errors/internal',
          title: 'Internal Server Error',
          status: 500,
          detail: 'An unexpected error occurred during upload',
        },
      },
      { status: 500 }
    )
  }
}

// ===========================================
// Route Segment Config
// ===========================================

/**
 * 禁用 body 大小限制 (Next.js 15 App Router)
 * 這允許上傳大文件
 */
export const dynamic = 'force-dynamic'
