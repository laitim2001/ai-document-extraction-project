/**
 * @fileoverview 備份管理 API - 儲存使用量
 * @description
 *   提供備份儲存空間使用量統計與趨勢資料
 *
 * @module src/app/api/admin/backups/storage
 * @since Epic 12 - Story 12-5 (數據備份管理)
 * @lastModified 2025-12-21
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { backupService } from '@/services/backup.service'
import { z } from 'zod'

// ============================================================
// Validation Schema
// ============================================================

const storageTrendSchema = z.object({
  days: z.coerce.number().int().min(1).max(365).optional(),
  groupBy: z.enum(['day', 'week', 'month']).optional(),
})

// ============================================================
// GET /api/admin/backups/storage - 取得儲存使用量
// ============================================================

export async function GET(request: NextRequest) {
  try {
    // 驗證身分
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // 檢查權限（需要全局管理者）
    if (!session.user.isGlobalAdmin) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Global admin access required' },
        { status: 403 }
      )
    }

    // 解析查詢參數
    const searchParams = Object.fromEntries(request.nextUrl.searchParams)
    const validation = storageTrendSchema.safeParse(searchParams)

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid query parameters',
          details: validation.error.flatten().fieldErrors,
        },
        { status: 400 }
      )
    }

    // 取得儲存使用量和趨勢
    const [summary, trend] = await Promise.all([
      backupService.getStorageUsage(),
      backupService.getStorageTrend(validation.data),
    ])

    return NextResponse.json({
      success: true,
      data: {
        summary,
        trend,
      },
    })
  } catch (error) {
    console.error('[GET /api/admin/backups/storage] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    )
  }
}
