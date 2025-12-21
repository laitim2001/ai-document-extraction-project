/**
 * @fileoverview 備份管理 API - 詳情與刪除
 * @description
 *   提供單一備份的詳情查詢與刪除功能
 *
 * @module src/app/api/admin/backups/[id]
 * @since Epic 12 - Story 12-5 (數據備份管理)
 * @lastModified 2025-12-21
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { backupService } from '@/services/backup.service'

// ============================================================
// GET /api/admin/backups/[id] - 取得備份詳情
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
    const backup = await backupService.getBackupById(id)

    if (!backup) {
      return NextResponse.json(
        { success: false, error: 'Backup not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: backup,
    })
  } catch (error) {
    console.error('[GET /api/admin/backups/[id]] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    )
  }
}

// ============================================================
// DELETE /api/admin/backups/[id] - 刪除備份
// ============================================================

export async function DELETE(
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

    await backupService.deleteBackup(id)

    return NextResponse.json({
      success: true,
      data: { message: '備份已刪除' },
    })
  } catch (error) {
    console.error('[DELETE /api/admin/backups/[id]] Error:', error)

    if (error instanceof Error && error.message.includes('not found')) {
      return NextResponse.json(
        { success: false, error: 'Backup not found' },
        { status: 404 }
      )
    }

    if (error instanceof Error && error.message.includes('Cannot delete')) {
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
