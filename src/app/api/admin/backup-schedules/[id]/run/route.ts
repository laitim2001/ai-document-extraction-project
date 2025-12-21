/**
 * @fileoverview 備份排程管理 API - 手動執行
 * @description
 *   提供手動觸發備份排程執行的功能
 *
 * @module src/app/api/admin/backup-schedules/[id]/run
 * @since Epic 12 - Story 12-5 (數據備份管理)
 * @lastModified 2025-12-21
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { backupSchedulerService } from '@/services/backup-scheduler.service'

// ============================================================
// POST /api/admin/backup-schedules/[id]/run - 手動執行排程
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

    const result = await backupSchedulerService.runSchedule(id)

    return NextResponse.json({
      success: true,
      data: {
        backupId: result.backupId,
        scheduleName: result.scheduleName,
        message: '排程備份已開始執行',
      },
    })
  } catch (error) {
    console.error('[POST /api/admin/backup-schedules/[id]/run] Error:', error)

    if (error instanceof Error && error.message.includes('not found')) {
      return NextResponse.json(
        { success: false, error: 'Schedule not found' },
        { status: 404 }
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
