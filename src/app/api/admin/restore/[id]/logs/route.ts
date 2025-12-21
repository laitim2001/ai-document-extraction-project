/**
 * @fileoverview 恢復操作日誌 API
 * @description
 *   提供恢復操作的詳細日誌查詢
 *   - GET: 取得指定恢復記錄的所有操作日誌
 *
 * @module src/app/api/admin/restore/[id]/logs
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
// GET /api/admin/restore/:id/logs - 取得恢復日誌
// ============================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params

    // 取得恢復日誌
    const logs = await restoreService.getRestoreLogs(id)

    return NextResponse.json({
      success: true,
      data: { logs },
    })
  } catch (error) {
    console.error('[GET /api/admin/restore/:id/logs] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    )
  }
}
