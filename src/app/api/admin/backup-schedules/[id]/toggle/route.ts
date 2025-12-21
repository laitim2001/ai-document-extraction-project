/**
 * @fileoverview 備份排程管理 API - 啟用/停用切換
 * @description
 *   提供切換備份排程啟用狀態的功能
 *
 * @module src/app/api/admin/backup-schedules/[id]/toggle
 * @since Epic 12 - Story 12-5 (數據備份管理)
 * @lastModified 2025-12-21
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { backupSchedulerService } from '@/services/backup-scheduler.service'

// ============================================================
// POST /api/admin/backup-schedules/[id]/toggle - 切換排程啟用狀態
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

    const schedule = await backupSchedulerService.toggleSchedule(id)

    return NextResponse.json({
      success: true,
      data: {
        schedule,
        message: schedule.isEnabled ? '排程已啟用' : '排程已停用',
      },
    })
  } catch (error) {
    console.error('[POST /api/admin/backup-schedules/[id]/toggle] Error:', error)

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
