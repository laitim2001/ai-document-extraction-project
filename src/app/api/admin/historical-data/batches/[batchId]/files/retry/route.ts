/**
 * @fileoverview 批量文件重試 API
 * @description
 *   批量重試失敗的文件：
 *   - 接收多個文件 ID
 *   - 批量重置文件狀態
 *   - 更新批次統計
 *
 * @module src/app/api/admin/historical-data/batches/[batchId]/files/retry
 * @since Epic 0 - Story 0.4
 * @lastModified 2025-12-27
 *
 * @features
 *   - 批量文件重試
 *   - 重試次數限制
 *   - 權限驗證
 *
 * @dependencies
 *   - prisma - 數據庫操作
 *   - auth - 認證
 *   - zod - 輸入驗證
 *
 * @related
 *   - src/app/api/admin/historical-data/files/[id]/retry/route.ts - 單文件重試
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { hasPermission } from '@/lib/auth/city-permission'
import { PERMISSIONS } from '@/types/permissions'
import { prisma } from '@/lib/prisma'
import { HistoricalFileStatus } from '@prisma/client'

// ============================================================
// Constants
// ============================================================

/** 最大重試次數 */
const MAX_RETRY_COUNT = 5

/** 單次批量操作最大文件數 */
const MAX_BATCH_SIZE = 100

// ============================================================
// Types
// ============================================================

interface RouteContext {
  params: Promise<{ batchId: string }>
}

// ============================================================
// Validation Schema
// ============================================================

const batchRetrySchema = z.object({
  fileIds: z.array(z.string().cuid()).min(1).max(MAX_BATCH_SIZE),
})

// ============================================================
// POST Handler
// ============================================================

/**
 * POST /api/admin/historical-data/batches/[batchId]/files/retry
 *
 * @description 批量重試失敗的文件
 * @body { fileIds: string[] }
 */
export async function POST(
  request: NextRequest,
  context: RouteContext
) {
  try {
    // 驗證認證
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // 檢查權限
    const hasAdminPerm = hasPermission(session.user, PERMISSIONS.ADMIN_MANAGE)
    if (!hasAdminPerm) {
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      )
    }

    // 獲取批次 ID
    const { batchId } = await context.params

    // 解析和驗證輸入
    const body = await request.json()
    const parseResult = batchRetrySchema.safeParse(body)

    if (!parseResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid input',
          details: parseResult.error.flatten(),
        },
        { status: 400 }
      )
    }

    const { fileIds } = parseResult.data

    // 查詢批次是否存在
    const batch = await prisma.historicalBatch.findUnique({
      where: { id: batchId },
      select: { id: true },
    })

    if (!batch) {
      return NextResponse.json(
        { success: false, error: 'Batch not found' },
        { status: 404 }
      )
    }

    // 查詢符合條件的文件
    const files = await prisma.historicalFile.findMany({
      where: {
        id: { in: fileIds },
        batchId,
        status: HistoricalFileStatus.FAILED,
      },
      select: {
        id: true,
        metadata: true,
      },
    })

    if (files.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'No valid files found for retry',
        },
        { status: 400 }
      )
    }

    // 過濾超過重試次數的文件
    const eligibleFiles = files.filter((file) => {
      const metadata = (file.metadata as Record<string, unknown>) || {}
      const retryCount = (metadata.retryCount as number) || 0
      return retryCount < MAX_RETRY_COUNT
    })

    const skippedCount = files.length - eligibleFiles.length

    // 批量更新文件
    const results = await prisma.$transaction(async (tx) => {
      const updates = await Promise.all(
        eligibleFiles.map(async (file) => {
          const metadata = (file.metadata as Record<string, unknown>) || {}
          const currentRetryCount = (metadata.retryCount as number) || 0

          return tx.historicalFile.update({
            where: { id: file.id },
            data: {
              status: HistoricalFileStatus.DETECTED,
              errorMessage: null,
              processedAt: null,
              metadata: {
                ...metadata,
                retryCount: currentRetryCount + 1,
                lastRetryAt: new Date().toISOString(),
              },
            },
            select: { id: true },
          })
        })
      )

      // 更新批次統計
      if (updates.length > 0) {
        await tx.historicalBatch.update({
          where: { id: batchId },
          data: {
            failedFiles: { decrement: updates.length },
          },
        })
      }

      return updates
    })

    return NextResponse.json({
      success: true,
      data: {
        retriedCount: results.length,
        skippedCount,
        fileIds: results.map((r) => r.id),
      },
      message: `${results.length} files queued for retry. ${skippedCount} files skipped due to max retry limit.`,
    })
  } catch (error) {
    console.error('Error batch retrying files:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to batch retry files',
      },
      { status: 500 }
    )
  }
}
