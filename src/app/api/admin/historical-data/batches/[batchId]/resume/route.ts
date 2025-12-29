/**
 * @fileoverview 批量處理恢復 API
 * @description
 *   恢復暫停的批量處理：
 *   - 更新批次狀態為 PROCESSING
 *   - 清除暫停時間
 *   - 繼續處理剩餘文件
 *
 * @module src/app/api/admin/historical-data/batches/[batchId]/resume
 * @since Epic 0 - Story 0.4
 * @lastModified 2025-12-27
 *
 * @features
 *   - 恢復批量處理
 *   - 權限驗證
 *
 * @dependencies
 *   - prisma - 數據庫操作
 *   - auth - 認證
 *
 * @related
 *   - src/app/api/admin/historical-data/batches/[batchId]/pause/route.ts - 暫停處理
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { hasPermission } from '@/lib/auth/city-permission'
import { PERMISSIONS } from '@/types/permissions'
import { prisma } from '@/lib/prisma'
import { HistoricalBatchStatus } from '@prisma/client'

// ============================================================
// Types
// ============================================================

interface RouteContext {
  params: Promise<{ batchId: string }>
}

// ============================================================
// POST Handler
// ============================================================

/**
 * POST /api/admin/historical-data/batches/[batchId]/resume
 *
 * @description 恢復暫停的批量處理
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

    // 只有 PAUSED 狀態可以恢復
    if (batch.status !== HistoricalBatchStatus.PAUSED) {
      return NextResponse.json(
        {
          success: false,
          error: `Cannot resume batch in ${batch.status} status. Only PAUSED batches can be resumed.`,
        },
        { status: 400 }
      )
    }

    // 更新批次狀態
    const updatedBatch = await prisma.historicalBatch.update({
      where: { id: batchId },
      data: {
        status: HistoricalBatchStatus.PROCESSING,
        pausedAt: null,
      },
      select: {
        id: true,
        name: true,
        status: true,
      },
    })

    return NextResponse.json({
      success: true,
      data: updatedBatch,
      message: 'Batch processing resumed successfully',
    })
  } catch (error) {
    console.error('Error resuming batch:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to resume batch processing',
      },
      { status: 500 }
    )
  }
}
