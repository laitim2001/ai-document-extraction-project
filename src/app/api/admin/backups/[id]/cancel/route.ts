/**
 * @fileoverview 備份管理 API - 取消備份
 * @description
 *   提供取消進行中備份的功能
 *
 * @module src/app/api/admin/backups/[id]/cancel
 * @since Epic 12 - Story 12-5 (數據備份管理)
 * @lastModified 2025-12-21
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { backupService } from '@/services/backup.service'

// ============================================================
// POST /api/admin/backups/[id]/cancel - 取消備份
// ============================================================

export async function POST(
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

    await backupService.cancelBackup(id)

    return NextResponse.json({
      success: true,
      data: { message: '備份已取消' },
    })
  } catch (error) {
    console.error('[POST /api/admin/backups/[id]/cancel] Error:', error)

    if (error instanceof Error && error.message.includes('not found')) {
      return NextResponse.json(
        { success: false, error: 'Backup not found' },
        { status: 404 }
      )
    }

    if (error instanceof Error && error.message.includes('Cannot cancel')) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 400 }
      )
    }

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    )
  }
}
