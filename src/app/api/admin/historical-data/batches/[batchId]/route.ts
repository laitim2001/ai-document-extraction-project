/**
 * @fileoverview 歷史數據批次詳情 API
 * @description
 *   提供單一批次的操作：
 *   - GET: 取得批次詳情（含文件列表）
 *   - PATCH: 更新批次資訊
 *   - DELETE: 刪除批次及其所有文件
 *
 * @module src/app/api/admin/historical-data/batches/[batchId]
 * @since Epic 0 - Story 0.1
 * @lastModified 2025-12-27
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { HistoricalBatchStatus } from '@prisma/client'

// ============================================================
// Types
// ============================================================

interface RouteContext {
  params: Promise<{ batchId: string }>
}

// ============================================================
// Validation Schemas
// ============================================================

const UpdateBatchSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  status: z.nativeEnum(HistoricalBatchStatus).optional(),
})

// ============================================================
// GET /api/admin/historical-data/batches/[batchId]
// ============================================================

/**
 * 取得批次詳情
 *
 * @description 包含批次基本資訊和文件列表摘要
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

    const { batchId } = await context.params

    const batch = await prisma.historicalBatch.findUnique({
      where: { id: batchId },
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        files: {
          select: {
            id: true,
            fileName: true,
            originalName: true,
            fileSize: true,
            mimeType: true,
            detectedType: true,
            status: true,
            metadata: true,
            createdAt: true,
            detectedAt: true,
            errorMessage: true,
          },
          orderBy: {
            createdAt: 'desc',
          },
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

    // 統計各狀態的文件數量
    const statusCounts = batch.files.reduce(
      (acc, file) => {
        acc[file.status] = (acc[file.status] || 0) + 1
        return acc
      },
      {} as Record<string, number>
    )

    // 統計各類型的文件數量
    const typeCounts = batch.files.reduce(
      (acc, file) => {
        const type = file.detectedType || 'UNKNOWN'
        acc[type] = (acc[type] || 0) + 1
        return acc
      },
      {} as Record<string, number>
    )

    return NextResponse.json({
      success: true,
      data: {
        id: batch.id,
        name: batch.name,
        description: batch.description,
        status: batch.status,
        totalFiles: batch.totalFiles,
        processedFiles: batch.processedFiles,
        failedFiles: batch.failedFiles,
        errorMessage: batch.errorMessage,
        createdAt: batch.createdAt.toISOString(),
        updatedAt: batch.updatedAt.toISOString(),
        startedAt: batch.startedAt?.toISOString() || null,
        completedAt: batch.completedAt?.toISOString() || null,
        creator: batch.creator,
        statistics: {
          statusCounts,
          typeCounts,
          totalSize: batch.files.reduce((sum, f) => sum + f.fileSize, 0),
        },
        files: batch.files.map((file) => ({
          id: file.id,
          fileName: file.fileName,
          originalName: file.originalName,
          fileSize: file.fileSize,
          mimeType: file.mimeType,
          detectedType: file.detectedType,
          status: file.status,
          metadata: file.metadata,
          errorMessage: file.errorMessage,
          createdAt: file.createdAt.toISOString(),
          detectedAt: file.detectedAt?.toISOString() || null,
        })),
      },
    })
  } catch (error) {
    console.error('[GET /api/admin/historical-data/batches/[batchId]] Error:', error)
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
// PATCH /api/admin/historical-data/batches/[batchId]
// ============================================================

/**
 * 更新批次資訊
 *
 * @description 可更新名稱、描述或狀態
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

    const { batchId } = await context.params
    const body = await request.json()
    const validation = UpdateBatchSchema.safeParse(body)

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

    // 檢查批次是否存在
    const existingBatch = await prisma.historicalBatch.findUnique({
      where: { id: batchId },
    })

    if (!existingBatch) {
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

    // 處理中的批次不允許更新
    if (existingBatch.status === HistoricalBatchStatus.PROCESSING) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/conflict',
          title: 'Conflict',
          status: 409,
          detail: '處理中的批次不允許更新',
        },
        { status: 409 }
      )
    }

    const batch = await prisma.historicalBatch.update({
      where: { id: batchId },
      data: validation.data,
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    })

    return NextResponse.json({
      success: true,
      data: {
        id: batch.id,
        name: batch.name,
        description: batch.description,
        status: batch.status,
        updatedAt: batch.updatedAt.toISOString(),
      },
    })
  } catch (error) {
    console.error('[PATCH /api/admin/historical-data/batches/[batchId]] Error:', error)
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
// DELETE /api/admin/historical-data/batches/[batchId]
// ============================================================

/**
 * 刪除批次
 *
 * @description 刪除批次及其所有關聯文件（級聯刪除）
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

    const { batchId } = await context.params

    // 檢查批次是否存在
    const existingBatch = await prisma.historicalBatch.findUnique({
      where: { id: batchId },
      include: {
        _count: {
          select: { files: true },
        },
      },
    })

    if (!existingBatch) {
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

    // 處理中的批次不允許刪除
    if (existingBatch.status === HistoricalBatchStatus.PROCESSING) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/conflict',
          title: 'Conflict',
          status: 409,
          detail: '處理中的批次不允許刪除，請先取消處理',
        },
        { status: 409 }
      )
    }

    // TODO: 刪除實際存儲的文件（Azure Blob Storage）

    // 刪除批次（級聯刪除文件記錄）
    await prisma.historicalBatch.delete({
      where: { id: batchId },
    })

    return NextResponse.json({
      success: true,
      data: {
        id: batchId,
        deletedFilesCount: existingBatch._count.files,
        message: '批次已成功刪除',
      },
    })
  } catch (error) {
    console.error('[DELETE /api/admin/historical-data/batches/[batchId]] Error:', error)
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
