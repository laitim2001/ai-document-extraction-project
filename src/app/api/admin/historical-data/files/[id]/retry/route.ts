/**
 * @fileoverview 文件重試 API
 * @description
 *   重試失敗的文件處理：
 *   - 重置文件狀態為 DETECTED
 *   - 增加重試計數
 *   - 清除錯誤訊息
 *
 * @module src/app/api/admin/historical-data/files/[id]/retry
 * @since Epic 0 - Story 0.4
 * @lastModified 2025-12-23
 *
 * @features
 *   - 單文件重試
 *   - 重試次數限制
 *   - 權限驗證
 *
 * @dependencies
 *   - prisma - 數據庫操作
 *   - auth - 認證
 *
 * @related
 *   - src/app/api/admin/historical-data/files/[id]/skip/route.ts - 跳過文件
 */

import { NextRequest, NextResponse } from 'next/server'
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
 * POST /api/admin/historical-data/files/[id]/retry
 *
 * @description 重試失敗的文件
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
        metadata: true,
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

    // 只有 FAILED 狀態可以重試
    if (file.status !== HistoricalFileStatus.FAILED) {
      return NextResponse.json(
        {
          success: false,
          error: `Cannot retry file in ${file.status} status. Only FAILED files can be retried.`,
        },
        { status: 400 }
      )
    }

    // 檢查重試次數
    const metadata = (file.metadata as Record<string, unknown>) || {}
    const currentRetryCount = (metadata.retryCount as number) || 0

    if (currentRetryCount >= MAX_RETRY_COUNT) {
      return NextResponse.json(
        {
          success: false,
          error: `Maximum retry count (${MAX_RETRY_COUNT}) exceeded.`,
        },
        { status: 400 }
      )
    }

    // 更新文件狀態
    const updatedFile = await prisma.historicalFile.update({
      where: { id: fileId },
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
      select: {
        id: true,
        fileName: true,
        originalName: true,
        status: true,
        metadata: true,
      },
    })

    // 更新批次的失敗計數
    await prisma.historicalBatch.update({
      where: { id: file.batch.id },
      data: {
        failedFiles: { decrement: 1 },
      },
    })

    return NextResponse.json({
      success: true,
      data: updatedFile,
      meta: {
        retryCount: currentRetryCount + 1,
        maxRetries: MAX_RETRY_COUNT,
      },
      message: 'File queued for retry',
    })
  } catch (error) {
    console.error('Error retrying file:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to retry file',
      },
      { status: 500 }
    )
  }
}
