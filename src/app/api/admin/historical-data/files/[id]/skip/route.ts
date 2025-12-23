/**
 * @fileoverview 文件跳過 API
 * @description
 *   跳過失敗的文件處理：
 *   - 更新文件狀態為 SKIPPED
 *   - 更新批次統計
 *
 * @module src/app/api/admin/historical-data/files/[id]/skip
 * @since Epic 0 - Story 0.4
 * @lastModified 2025-12-23
 *
 * @features
 *   - 單文件跳過
 *   - 權限驗證
 *   - 批次統計更新
 *
 * @dependencies
 *   - prisma - 數據庫操作
 *   - auth - 認證
 *
 * @related
 *   - src/app/api/admin/historical-data/files/[id]/retry/route.ts - 重試文件
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { hasPermission } from '@/lib/auth/city-permission'
import { PERMISSIONS } from '@/types/permissions'
import { prisma } from '@/lib/prisma'
import { HistoricalFileStatus } from '@prisma/client'

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
 * POST /api/admin/historical-data/files/[id]/skip
 *
 * @description 跳過失敗的文件
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

    // 獲取文件 ID
    const { id: fileId } = await context.params

    // 查詢文件
    const file = await prisma.historicalFile.findUnique({
      where: { id: fileId },
      select: {
        id: true,
        status: true,
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
        { success: false, error: 'File not found' },
        { status: 404 }
      )
    }

    // 只有 FAILED 狀態可以跳過
    if (file.status !== HistoricalFileStatus.FAILED) {
      return NextResponse.json(
        {
          success: false,
          error: `Cannot skip file in ${file.status} status. Only FAILED files can be skipped.`,
        },
        { status: 400 }
      )
    }

    // 使用事務更新文件和批次
    const result = await prisma.$transaction(async (tx) => {
      // 更新文件狀態
      const updatedFile = await tx.historicalFile.update({
        where: { id: fileId },
        data: {
          status: HistoricalFileStatus.SKIPPED,
          errorMessage: 'Skipped by user',
        },
        select: {
          id: true,
          fileName: true,
          originalName: true,
          status: true,
        },
      })

      // 更新批次統計
      await tx.historicalBatch.update({
        where: { id: file.batch.id },
        data: {
          failedFiles: { decrement: 1 },
          skippedFiles: { increment: 1 },
        },
      })

      return updatedFile
    })

    return NextResponse.json({
      success: true,
      data: result,
      message: 'File skipped successfully',
    })
  } catch (error) {
    console.error('Error skipping file:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to skip file',
      },
      { status: 500 }
    )
  }
}
