/**
 * @fileoverview 批量處理取消 API
 * @description
 *   取消進行中或暫停的批量處理：
 *   - 更新批次狀態為 CANCELLED
 *   - 停止所有處理
 *   - 將待處理文件標記為已取消
 *
 * @module src/app/api/admin/historical-data/batches/[id]/cancel
 * @since Epic 0 - Story 0.4
 * @lastModified 2025-12-23
 *
 * @features
 *   - 取消批量處理
 *   - 權限驗證
 *   - 批量文件狀態更新
 *
 * @dependencies
 *   - prisma - 數據庫操作
 *   - auth - 認證
 *
 * @related
 *   - src/app/api/admin/historical-data/batches/[id]/pause/route.ts - 暫停處理
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { hasPermission } from '@/lib/auth/city-permission'
import { PERMISSIONS } from '@/types/permissions'
import { prisma } from '@/lib/prisma'
import { HistoricalBatchStatus, HistoricalFileStatus } from '@prisma/client'

// ============================================================
// Types
// ============================================================

interface RouteContext {
  params: Promise<{ id: string }>
}

// ============================================================
// POST Handler
// ============================================================

/**
 * POST /api/admin/historical-data/batches/[id]/cancel
 *
 * @description 取消批量處理
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
    const { id: batchId } = await context.params

    // 查詢批次
    const batch = await prisma.historicalBatch.findUnique({
      where: { id: batchId },
      select: { id: true, status: true },
    })

    if (!batch) {
      return NextResponse.json(
        { success: false, error: 'Batch not found' },
        { status: 404 }
      )
    }

    // 只有 PROCESSING 或 PAUSED 狀態可以取消
    const cancellableStatuses: HistoricalBatchStatus[] = [
      HistoricalBatchStatus.PROCESSING,
      HistoricalBatchStatus.PAUSED,
      HistoricalBatchStatus.PENDING,
    ]

    if (!cancellableStatuses.includes(batch.status)) {
      return NextResponse.json(
        {
          success: false,
          error: `Cannot cancel batch in ${batch.status} status.`,
        },
        { status: 400 }
      )
    }

    // 使用事務更新批次和文件狀態
    const result = await prisma.$transaction(async (tx) => {
      // 更新批次狀態
      const updatedBatch = await tx.historicalBatch.update({
        where: { id: batchId },
        data: {
          status: HistoricalBatchStatus.CANCELLED,
          completedAt: new Date(),
        },
        select: {
          id: true,
          name: true,
          status: true,
          processedFiles: true,
          failedFiles: true,
          skippedFiles: true,
          totalFiles: true,
        },
      })

      // 將待處理的文件標記為跳過
      const updateResult = await tx.historicalFile.updateMany({
        where: {
          batchId,
          status: {
            in: [
              HistoricalFileStatus.PENDING,
              HistoricalFileStatus.DETECTING,
              HistoricalFileStatus.DETECTED,
            ],
          },
        },
        data: {
          status: HistoricalFileStatus.SKIPPED,
          errorMessage: 'Batch cancelled by user',
        },
      })

      return {
        batch: updatedBatch,
        skippedCount: updateResult.count,
      }
    })

    return NextResponse.json({
      success: true,
      data: result.batch,
      meta: {
        skippedFiles: result.skippedCount,
      },
      message: `Batch cancelled. ${result.skippedCount} pending files were skipped.`,
    })
  } catch (error) {
    console.error('Error cancelling batch:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to cancel batch processing',
      },
      { status: 500 }
    )
  }
}
