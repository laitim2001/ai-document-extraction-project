/**
 * @fileoverview 備份管理 API - 狀態摘要
 * @description
 *   提供備份系統狀態摘要，包括自動備份設定、最近備份、下次排程等
 *
 * @module src/app/api/admin/backups/summary
 * @since Epic 12 - Story 12-5 (數據備份管理)
 * @lastModified 2025-12-21
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { backupService } from '@/services/backup.service'

// ============================================================
// GET /api/admin/backups/summary - 取得備份狀態摘要
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

    // 取得備份狀態摘要
    const summary = await backupService.getStatusSummary()

    return NextResponse.json({
      success: true,
      data: summary,
    })
  } catch (error) {
    console.error('[GET /api/admin/backups/summary] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    )
  }
}
