/**
 * @fileoverview Document 服務層
 * @description
 *   提供文件（Document）相關的業務邏輯：
 *   - 文件列表查詢（分頁、篩選、排序）
 *   - 單個文件查詢
 *   - 文件刪除（含 Azure Blob）
 *   - 文件狀態更新
 *
 * @module src/services/document.service
 * @author Development Team
 * @since Epic 2 - Story 2.1 (File Upload Interface & Validation)
 * @lastModified 2025-12-18
 *
 * @features
 *   - 分頁文件列表
 *   - 多條件篩選
 *   - 文件刪除（DB + Azure Blob）
 *   - 狀態管理
 *
 * @dependencies
 *   - @prisma/client - Prisma ORM
 *   - @/lib/azure/storage - Azure Blob Storage
 *
 * @related
 *   - src/app/api/documents - Document API 端點
 *   - src/lib/azure/storage.ts - Azure 存儲服務
 *   - prisma/schema.prisma - Document 模型
 */

import { prisma } from '@/lib/prisma'
import { deleteFile } from '@/lib/azure'
import type { DocumentStatus, Prisma } from '@prisma/client'

// ===========================================
// Types
// ===========================================

/**
 * 獲取文件列表參數
 */
export interface GetDocumentsParams {
  /** 頁碼（從 1 開始）*/
  page: number
  /** 每頁數量 */
  pageSize: number
  /** 文件狀態篩選 */
  status?: DocumentStatus
  /** 搜尋關鍵字（文件名或 ID）*/
  search?: string
  /** 城市代碼篩選 */
  cityCode?: string
  /** 上傳者 ID 篩選 */
  uploadedBy?: string
  /** 排序欄位 */
  sortBy?: 'createdAt' | 'fileName' | 'status' | 'fileSize'
  /** 排序方向 */
  sortOrder?: 'asc' | 'desc'
}

/**
 * 文件列表結果
 */
export interface DocumentListResult {
  /** 文件列表 */
  data: DocumentSummary[]
  /** 分頁資訊 */
  meta: {
    total: number
    page: number
    pageSize: number
    totalPages: number
  }
}

/**
 * 文件摘要（列表用）
 */
export interface DocumentSummary {
  id: string
  fileName: string
  fileType: string
  fileSize: number
  status: DocumentStatus
  processingPath: string | null
  cityCode: string | null
  createdAt: Date
  updatedAt: Date
  uploader: {
    id: string
    name: string | null
    email: string
  }
}

/**
 * 文件詳情
 */
export interface DocumentDetail {
  id: string
  fileName: string
  fileType: string
  fileExtension: string
  fileSize: number
  filePath: string
  blobName: string
  status: DocumentStatus
  errorMessage: string | null
  processingPath: string | null
  routingDecision: Prisma.JsonValue | null
  cityCode: string | null
  createdAt: Date
  updatedAt: Date
  uploader: {
    id: string
    name: string | null
    email: string
  }
}

// ===========================================
// Functions
// ===========================================

/**
 * 獲取分頁文件列表
 *
 * @description 根據條件查詢文件列表，支援分頁、篩選、排序
 * @param params - 查詢參數
 * @returns 文件列表和分頁資訊
 *
 * @example
 * ```typescript
 * const result = await getDocuments({
 *   page: 1,
 *   pageSize: 20,
 *   status: 'UPLOADED',
 *   sortBy: 'createdAt',
 *   sortOrder: 'desc',
 * })
 * ```
 */
export async function getDocuments(
  params: GetDocumentsParams
): Promise<DocumentListResult> {
  const {
    page = 1,
    pageSize = 20,
    status,
    search,
    cityCode,
    uploadedBy,
    sortBy = 'createdAt',
    sortOrder = 'desc',
  } = params

  // 構建查詢條件
  const where: Prisma.DocumentWhereInput = {
    ...(status && { status }),
    ...(cityCode && { cityCode }),
    ...(uploadedBy && { uploadedBy }),
    ...(search && {
      OR: [
        { fileName: { contains: search, mode: 'insensitive' } },
        { id: { contains: search } },
      ],
    }),
  }

  // 並行執行查詢和計數
  const [data, total] = await prisma.$transaction([
    prisma.document.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { [sortBy]: sortOrder },
      select: {
        id: true,
        fileName: true,
        fileType: true,
        fileSize: true,
        status: true,
        processingPath: true,
        cityCode: true,
        createdAt: true,
        updatedAt: true,
        uploader: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    }),
    prisma.document.count({ where }),
  ])

  return {
    data: data as DocumentSummary[],
    meta: {
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    },
  }
}

/**
 * 根據 ID 獲取文件詳情
 *
 * @description 獲取單個文件的完整資訊
 * @param id - 文件 ID
 * @returns 文件詳情或 null
 *
 * @example
 * ```typescript
 * const document = await getDocumentById('xxx-xxx-xxx')
 * if (!document) {
 *   throw new Error('Document not found')
 * }
 * ```
 */
export async function getDocumentById(
  id: string
): Promise<DocumentDetail | null> {
  const document = await prisma.document.findUnique({
    where: { id },
    select: {
      id: true,
      fileName: true,
      fileType: true,
      fileExtension: true,
      fileSize: true,
      filePath: true,
      blobName: true,
      status: true,
      errorMessage: true,
      processingPath: true,
      routingDecision: true,
      cityCode: true,
      createdAt: true,
      updatedAt: true,
      uploader: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  })

  return document as DocumentDetail | null
}

/**
 * 刪除文件
 *
 * @description 刪除文件記錄和對應的 Azure Blob
 * @param id - 文件 ID
 * @throws {Error} 如果文件不存在或刪除失敗
 *
 * @example
 * ```typescript
 * await deleteDocument('xxx-xxx-xxx')
 * ```
 */
export async function deleteDocument(id: string): Promise<void> {
  // 獲取 blob 名稱
  const document = await prisma.document.findUnique({
    where: { id },
    select: { blobName: true },
  })

  if (!document) {
    throw new Error(`Document with ID ${id} not found`)
  }

  // 刪除 Azure Blob
  if (document.blobName) {
    try {
      await deleteFile(document.blobName)
    } catch (error) {
      console.error(`Failed to delete blob ${document.blobName}:`, error)
      // 繼續刪除資料庫記錄
    }
  }

  // 刪除資料庫記錄
  await prisma.document.delete({
    where: { id },
  })
}

/**
 * 更新文件狀態
 *
 * @description 更新文件的處理狀態，可選設置錯誤訊息
 * @param id - 文件 ID
 * @param status - 新狀態
 * @param errorMessage - 錯誤訊息（可選）
 *
 * @example
 * ```typescript
 * // 標記為 OCR 處理中
 * await updateDocumentStatus('xxx', 'OCR_PROCESSING')
 *
 * // 標記為失敗
 * await updateDocumentStatus('xxx', 'FAILED', 'OCR extraction failed')
 * ```
 */
export async function updateDocumentStatus(
  id: string,
  status: DocumentStatus,
  errorMessage?: string
): Promise<void> {
  await prisma.document.update({
    where: { id },
    data: {
      status,
      errorMessage: errorMessage ?? null,
      updatedAt: new Date(),
    },
  })
}

/**
 * 批量更新文件狀態
 *
 * @description 批量更新多個文件的狀態
 * @param ids - 文件 ID 列表
 * @param status - 新狀態
 *
 * @example
 * ```typescript
 * await batchUpdateDocumentStatus(['id1', 'id2'], 'OCR_PROCESSING')
 * ```
 */
export async function batchUpdateDocumentStatus(
  ids: string[],
  status: DocumentStatus
): Promise<void> {
  await prisma.document.updateMany({
    where: { id: { in: ids } },
    data: {
      status,
      updatedAt: new Date(),
    },
  })
}

/**
 * 獲取文件統計資訊
 *
 * @description 獲取各狀態的文件數量統計
 * @param cityCode - 城市代碼篩選（可選）
 * @returns 各狀態的文件數量
 *
 * @example
 * ```typescript
 * const stats = await getDocumentStats('TPE')
 * console.log(stats.UPLOADED) // 已上傳數量
 * ```
 */
export async function getDocumentStats(
  cityCode?: string
): Promise<Record<DocumentStatus, number>> {
  const where: Prisma.DocumentWhereInput = cityCode ? { cityCode } : {}

  const stats = await prisma.document.groupBy({
    by: ['status'],
    where,
    _count: { status: true },
  })

  // 初始化所有狀態為 0
  const result: Record<string, number> = {
    UPLOADING: 0,
    UPLOADED: 0,
    OCR_PROCESSING: 0,
    OCR_COMPLETED: 0,
    OCR_FAILED: 0,
    MAPPING_PROCESSING: 0,
    MAPPING_COMPLETED: 0,
    PENDING_REVIEW: 0,
    IN_REVIEW: 0,
    COMPLETED: 0,
    FAILED: 0,
  }

  // 填入實際數量
  stats.forEach((stat) => {
    result[stat.status] = stat._count.status
  })

  return result as Record<DocumentStatus, number>
}
