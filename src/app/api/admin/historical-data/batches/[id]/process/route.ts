/**
 * @fileoverview 歷史數據批次處理 API
 * @description
 *   提供批次處理的控制：
 *   - POST: 開始處理批次
 *
 * @module src/app/api/admin/historical-data/batches/[id]/process
 * @since Epic 0 - Story 0.1
 * @lastModified 2025-12-23
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { HistoricalBatchStatus, HistoricalFileStatus } from '@prisma/client'

// ============================================================
// Types
// ============================================================

interface RouteContext {
  params: Promise<{ id: string }>
}

// ============================================================
// POST /api/admin/historical-data/batches/[id]/process
// ============================================================

/**
 * 開始處理批次
 *
 * @description
 *   將批次狀態改為 PROCESSING，
 *   並將所有 DETECTED 狀態的文件設為 PROCESSING
 *
 *   注意：實際的處理邏輯會由 n8n 工作流程或背景任務處理
 *   此 API 僅負責狀態變更和觸發
 */
export async function POST(request: NextRequest, context: RouteContext) {
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

    // 取得批次資訊
    const batch = await prisma.historicalBatch.findUnique({
      where: { id },
      include: {
        _count: {
          select: { files: true },
        },
        files: {
          where: {
            status: {
              in: [HistoricalFileStatus.DETECTED, HistoricalFileStatus.PENDING],
            },
          },
          select: { id: true },
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

    // 驗證批次狀態
    if (batch.status !== HistoricalBatchStatus.PENDING) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/conflict',
          title: 'Conflict',
          status: 409,
          detail: `批次狀態為 ${batch.status}，只有 PENDING 狀態的批次可以開始處理`,
        },
        { status: 409 }
      )
    }

    // 驗證是否有文件
    if (batch._count.files === 0) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/validation',
          title: 'Validation Error',
          status: 400,
          detail: '批次內沒有文件，無法開始處理',
        },
        { status: 400 }
      )
    }

    // 驗證是否有可處理的文件
    const processableFileIds = batch.files.map((f) => f.id)
    if (processableFileIds.length === 0) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/validation',
          title: 'Validation Error',
          status: 400,
          detail: '批次內沒有可處理的文件（所有文件都已處理或失敗）',
        },
        { status: 400 }
      )
    }

    // 更新批次和文件狀態
    const now = new Date()

    await prisma.$transaction([
      // 更新批次狀態
      prisma.historicalBatch.update({
        where: { id },
        data: {
          status: HistoricalBatchStatus.PROCESSING,
          startedAt: now,
          errorMessage: null,
        },
      }),
      // 更新所有待處理文件的狀態
      prisma.historicalFile.updateMany({
        where: {
          id: { in: processableFileIds },
        },
        data: {
          status: HistoricalFileStatus.PROCESSING,
        },
      }),
    ])

    // TODO: 觸發 n8n 工作流程或背景任務
    // 這裡可以呼叫 n8n webhook 或加入任務佇列

    return NextResponse.json({
      success: true,
      data: {
        id: batch.id,
        status: HistoricalBatchStatus.PROCESSING,
        startedAt: now.toISOString(),
        processingFiles: processableFileIds.length,
        message: '批次處理已開始',
      },
    })
  } catch (error) {
    console.error('[POST /api/admin/historical-data/batches/[id]/process] Error:', error)
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
