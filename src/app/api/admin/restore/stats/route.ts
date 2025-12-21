/**
 * @fileoverview 恢復操作統計 API
 * @description
 *   提供恢復操作的統計資料，用於管理儀表板
 *   - GET: 取得恢復操作統計（總數、成功率、平均時間等）
 *
 * @module src/app/api/admin/restore/stats
 * @since Epic 12 - Story 12-6 (數據恢復功能)
 * @lastModified 2025-12-21
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { RestoreService } from '@/services/restore.service'

// ============================================================
// Service Instance
// ============================================================

const restoreService = new RestoreService()

// ============================================================
// GET /api/admin/restore/stats - 取得恢復統計
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

    // 取得恢復統計
    const stats = await restoreService.getRestoreStats()

    return NextResponse.json({
      success: true,
      data: stats,
    })
  } catch (error) {
    console.error('[GET /api/admin/restore/stats] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    )
  }
}
