/**
 * @fileoverview 歷史數據文件詳情 API
 * @description
 *   提供單一文件的操作：
 *   - GET: 取得文件詳情
 *   - PATCH: 更新文件資訊（手動修正類型）
 *   - DELETE: 刪除單一文件
 *
 * @module src/app/api/admin/historical-data/files/[id]
 * @since Epic 0 - Story 0.1
 * @lastModified 2025-12-23
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { DetectedFileType, HistoricalFileStatus, HistoricalBatchStatus } from '@prisma/client'
import fs from 'fs/promises'

// ============================================================
// Types
// ============================================================

interface RouteContext {
  params: Promise<{ id: string }>
}

// ============================================================
// Validation Schemas
// ============================================================

const UpdateFileSchema = z.object({
  detectedType: z.nativeEnum(DetectedFileType).optional(),
  status: z.nativeEnum(HistoricalFileStatus).optional(),
})

// ============================================================
// GET /api/admin/historical-data/files/[id]
// ============================================================

/**
 * 取得文件詳情
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
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

    const { id } = await context.params

    const file = await prisma.historicalFile.findUnique({
      where: { id },
      include: {
        batch: {
          select: {
            id: true,
            name: true,
            status: true,
          },
        },
      },
    })

    if (!file) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/not-found',
          title: 'Not Found',
          status: 404,
          detail: '找不到指定的文件',
        },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        id: file.id,
        fileName: file.fileName,
        originalName: file.originalName,
        fileSize: file.fileSize,
        mimeType: file.mimeType,
        detectedType: file.detectedType,
        status: file.status,
        storagePath: file.storagePath,
        metadata: file.metadata,
        errorMessage: file.errorMessage,
        createdAt: file.createdAt.toISOString(),
        updatedAt: file.updatedAt.toISOString(),
        detectedAt: file.detectedAt?.toISOString() || null,
        processedAt: file.processedAt?.toISOString() || null,
        batch: file.batch,
      },
    })
  } catch (error) {
    console.error('[GET /api/admin/historical-data/files/[id]] Error:', error)
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
// PATCH /api/admin/historical-data/files/[id]
// ============================================================

/**
 * 更新文件資訊
 *
 * @description
 *   主要用於手動修正文件類型（AC3）
 *   支援審計日誌記錄
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
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

    const { id } = await context.params
    const body = await request.json()
    const validation = UpdateFileSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/validation',
          title: 'Validation Error',
          status: 400,
          detail: '輸入驗證失敗',
          errors: validation.error.flatten().fieldErrors,
        },
        { status: 400 }
      )
    }

    // 取得現有文件資料
    const existingFile = await prisma.historicalFile.findUnique({
      where: { id },
      include: {
        batch: {
          select: {
            status: true,
          },
        },
      },
    })

    if (!existingFile) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/not-found',
          title: 'Not Found',
          status: 404,
          detail: '找不到指定的文件',
        },
        { status: 404 }
      )
    }

    // 處理中的批次不允許修改文件
    if (existingFile.batch.status === HistoricalBatchStatus.PROCESSING) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/conflict',
          title: 'Conflict',
          status: 409,
          detail: '批次處理中，無法修改文件',
        },
        { status: 409 }
      )
    }

    const updateData = validation.data

    // 如果修改了 detectedType，記錄審計日誌
    if (updateData.detectedType && updateData.detectedType !== existingFile.detectedType) {
      // 更新 metadata 以記錄手動修正
      const currentMetadata = (existingFile.metadata as Record<string, unknown>) || {}
      const updatedMetadata = {
        ...currentMetadata,
        manualCorrection: {
          previousType: existingFile.detectedType,
          correctedType: updateData.detectedType,
          correctedBy: session.user.id,
          correctedAt: new Date().toISOString(),
        },
      }

      const file = await prisma.historicalFile.update({
        where: { id },
        data: {
          ...updateData,
          metadata: updatedMetadata,
        },
      })

      return NextResponse.json({
        success: true,
        data: {
          id: file.id,
          detectedType: file.detectedType,
          status: file.status,
          metadata: file.metadata,
          updatedAt: file.updatedAt.toISOString(),
          message: '文件類型已手動修正',
        },
      })
    }

    // 一般更新
    const file = await prisma.historicalFile.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json({
      success: true,
      data: {
        id: file.id,
        detectedType: file.detectedType,
        status: file.status,
        updatedAt: file.updatedAt.toISOString(),
      },
    })
  } catch (error) {
    console.error('[PATCH /api/admin/historical-data/files/[id]] Error:', error)
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
// DELETE /api/admin/historical-data/files/[id]
// ============================================================

/**
 * 刪除單一文件
 *
 * @description 同時刪除實體文件和資料庫記錄
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
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

    const { id } = await context.params

    // 取得文件資料
    const file = await prisma.historicalFile.findUnique({
      where: { id },
      include: {
        batch: {
          select: {
            id: true,
            status: true,
          },
        },
      },
    })

    if (!file) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/not-found',
          title: 'Not Found',
          status: 404,
          detail: '找不到指定的文件',
        },
        { status: 404 }
      )
    }

    // 處理中的批次不允許刪除文件
    if (file.batch.status === HistoricalBatchStatus.PROCESSING) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/conflict',
          title: 'Conflict',
          status: 409,
          detail: '批次處理中，無法刪除文件',
        },
        { status: 409 }
      )
    }

    // 刪除實體文件
    try {
      await fs.unlink(file.storagePath)
    } catch (fsError) {
      // 文件可能已經不存在，記錄但不中斷流程
      console.warn(`[DELETE] Failed to delete physical file: ${file.storagePath}`, fsError)
    }

    // 刪除資料庫記錄並更新批次統計
    await prisma.$transaction([
      prisma.historicalFile.delete({
        where: { id },
      }),
      prisma.historicalBatch.update({
        where: { id: file.batch.id },
        data: {
          totalFiles: {
            decrement: 1,
          },
          // 如果是失敗的文件，也要減少失敗計數
          ...(file.status === HistoricalFileStatus.FAILED && {
            failedFiles: {
              decrement: 1,
            },
          }),
        },
      }),
    ])

    return NextResponse.json({
      success: true,
      data: {
        id,
        batchId: file.batch.id,
        message: '文件已成功刪除',
      },
    })
  } catch (error) {
    console.error('[DELETE /api/admin/historical-data/files/[id]] Error:', error)
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
