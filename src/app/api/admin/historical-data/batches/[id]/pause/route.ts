/**
 * @fileoverview 批量處理暫停 API
 * @description
 *   暫停進行中的批量處理：
 *   - 更新批次狀態為 PAUSED
 *   - 記錄暫停時間
 *   - 停止處理新文件
 *
 * @module src/app/api/admin/historical-data/batches/[id]/pause
 * @since Epic 0 - Story 0.4
 * @lastModified 2025-12-23
 *
 * @features
 *   - 暫停批量處理
 *   - 權限驗證
 *
 * @dependencies
 *   - prisma - 數據庫操作
 *   - auth - 認證
 *
 * @related
 *   - src/app/api/admin/historical-data/batches/[id]/resume/route.ts - 恢復處理
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
  params: Promise<{ id: string }>
}

// ============================================================
// POST Handler
// ============================================================

/**
 * POST /api/admin/historical-data/batches/[id]/pause
 *
 * @description 暫停批量處理
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

    // 只有 PROCESSING 狀態可以暫停
    if (batch.status !== HistoricalBatchStatus.PROCESSING) {
      return NextResponse.json(
        {
          success: false,
          error: `Cannot pause batch in ${batch.status} status. Only PROCESSING batches can be paused.`,
        },
        { status: 400 }
      )
    }

    // 更新批次狀態
    const updatedBatch = await prisma.historicalBatch.update({
      where: { id: batchId },
      data: {
        status: HistoricalBatchStatus.PAUSED,
        pausedAt: new Date(),
      },
      select: {
        id: true,
        name: true,
        status: true,
        pausedAt: true,
      },
    })

    return NextResponse.json({
      success: true,
      data: updatedBatch,
      message: 'Batch processing paused successfully',
    })
  } catch (error) {
    console.error('Error pausing batch:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to pause batch processing',
      },
      { status: 500 }
    )
  }
}
