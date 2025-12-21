/**
 * @fileoverview 備份排程管理 API - 詳情、更新與刪除
 * @description
 *   提供單一備份排程的詳情查詢、更新與刪除功能
 *
 * @module src/app/api/admin/backup-schedules/[id]
 * @since Epic 12 - Story 12-5 (數據備份管理)
 * @lastModified 2025-12-21
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { backupSchedulerService } from '@/services/backup-scheduler.service'
import { z } from 'zod'

// ============================================================
// Validation Schema
// ============================================================

const updateScheduleSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  backupType: z.enum(['FULL', 'INCREMENTAL', 'DIFFERENTIAL']).optional(),
  backupSource: z.enum(['DATABASE', 'FILES', 'CONFIG', 'FULL_SYSTEM']).optional(),
  cronExpression: z.string().min(9).max(100).optional(),
  timezone: z.string().optional(),
  retentionDays: z.number().int().min(1).max(365).optional(),
  maxBackups: z.number().int().min(1).max(100).optional(),
  isEnabled: z.boolean().optional(),
})

// ============================================================
// GET /api/admin/backup-schedules/[id] - 取得排程詳情
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
    const schedule = await backupSchedulerService.getScheduleById(id)

    if (!schedule) {
      return NextResponse.json(
        { success: false, error: 'Schedule not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: schedule,
    })
  } catch (error) {
    console.error('[GET /api/admin/backup-schedules/[id]] Error:', error)
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
// PATCH /api/admin/backup-schedules/[id] - 更新排程
// ============================================================

export async function PATCH(
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

    // 解析請求體
    const body = await request.json()
    const validation = updateScheduleSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid request body',
          details: validation.error.flatten().fieldErrors,
        },
        { status: 400 }
      )
    }

    // 更新排程
    const schedule = await backupSchedulerService.updateSchedule(id, validation.data)

    return NextResponse.json({
      success: true,
      data: {
        schedule,
        message: '備份排程已更新',
      },
    })
  } catch (error) {
    console.error('[PATCH /api/admin/backup-schedules/[id]] Error:', error)

    if (error instanceof Error && error.message.includes('not found')) {
      return NextResponse.json(
        { success: false, error: 'Schedule not found' },
        { status: 404 }
      )
    }

    if (error instanceof Error && error.message.includes('Invalid cron')) {
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

// ============================================================
// DELETE /api/admin/backup-schedules/[id] - 刪除排程
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

    await backupSchedulerService.deleteSchedule(id)

    return NextResponse.json({
      success: true,
      data: { message: '備份排程已刪除' },
    })
  } catch (error) {
    console.error('[DELETE /api/admin/backup-schedules/[id]] Error:', error)

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
