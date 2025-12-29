/**
 * @fileoverview 批量文件跳過 API
 * @description
 *   批量跳過失敗的文件：
 *   - 接收多個文件 ID
 *   - 批量更新文件狀態為 SKIPPED
 *   - 更新批次統計
 *
 * @module src/app/api/admin/historical-data/batches/[batchId]/files/skip
 * @since Epic 0 - Story 0.4
 * @lastModified 2025-12-27
 *
 * @features
 *   - 批量文件跳過
 *   - 權限驗證
 *   - 批次統計更新
 *
 * @dependencies
 *   - prisma - 數據庫操作
 *   - auth - 認證
 *   - zod - 輸入驗證
 *
 * @related
 *   - src/app/api/admin/historical-data/files/[id]/skip/route.ts - 單文件跳過
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

const batchSkipSchema = z.object({
  fileIds: z.array(z.string().cuid()).min(1).max(MAX_BATCH_SIZE),
})

// ============================================================
// POST Handler
// ============================================================

/**
 * POST /api/admin/historical-data/batches/[batchId]/files/skip
 *
 * @description 批量跳過失敗的文件
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
    const parseResult = batchSkipSchema.safeParse(body)

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

    // 使用事務批量更新
    const result = await prisma.$transaction(async (tx) => {
      // 更新文件狀態
      const updateResult = await tx.historicalFile.updateMany({
        where: {
          id: { in: fileIds },
          batchId,
          status: HistoricalFileStatus.FAILED,
        },
        data: {
          status: HistoricalFileStatus.SKIPPED,
          errorMessage: 'Skipped by user (batch operation)',
        },
      })

      // 更新批次統計
      if (updateResult.count > 0) {
        await tx.historicalBatch.update({
          where: { id: batchId },
          data: {
            failedFiles: { decrement: updateResult.count },
            skippedFiles: { increment: updateResult.count },
          },
        })
      }

      return updateResult.count
    })

    return NextResponse.json({
      success: true,
      data: {
        skippedCount: result,
      },
      message: `${result} files skipped successfully`,
    })
  } catch (error) {
    console.error('Error batch skipping files:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to batch skip files',
      },
      { status: 500 }
    )
  }
}
