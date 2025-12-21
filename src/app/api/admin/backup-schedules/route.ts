/**
 * @fileoverview 備份排程管理 API - 列表與建立
 * @description
 *   提供備份排程列表查詢與建立功能
 *
 * @module src/app/api/admin/backup-schedules
 * @since Epic 12 - Story 12-5 (數據備份管理)
 * @lastModified 2025-12-21
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { backupSchedulerService } from '@/services/backup-scheduler.service'
import { z } from 'zod'

// ============================================================
// Validation Schemas
// ============================================================

const listSchedulesSchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  isEnabled: z.enum(['true', 'false']).transform((v) => v === 'true').optional(),
  backupSource: z.enum(['DATABASE', 'FILES', 'CONFIG', 'FULL_SYSTEM']).optional(),
  backupType: z.enum(['FULL', 'INCREMENTAL', 'DIFFERENTIAL']).optional(),
  sortBy: z.enum(['name', 'nextRunAt', 'lastRunAt', 'createdAt']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
})

const createScheduleSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  backupType: z.enum(['FULL', 'INCREMENTAL', 'DIFFERENTIAL']),
  backupSource: z.enum(['DATABASE', 'FILES', 'CONFIG', 'FULL_SYSTEM']),
  cronExpression: z.string().min(9).max(100), // 最小 "* * * * *"
  timezone: z.string().optional(),
  retentionDays: z.number().int().min(1).max(365).optional(),
  maxBackups: z.number().int().min(1).max(100).optional(),
  isEnabled: z.boolean().optional(),
})

// ============================================================
// GET /api/admin/backup-schedules - 取得排程列表
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
    const validation = listSchedulesSchema.safeParse(searchParams)

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

    // 取得排程列表
    const result = await backupSchedulerService.getSchedules(validation.data)

    return NextResponse.json({
      success: true,
      data: {
        schedules: result.schedules,
        pagination: {
          page: result.page,
          limit: result.limit,
          total: result.total,
          totalPages: result.totalPages,
        },
      },
    })
  } catch (error) {
    console.error('[GET /api/admin/backup-schedules] Error:', error)
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
// POST /api/admin/backup-schedules - 建立備份排程
// ============================================================

export async function POST(request: NextRequest) {
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

    // 解析請求體
    const body = await request.json()
    const validation = createScheduleSchema.safeParse(body)

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

    // 建立排程
    const userId = session.user.id || ''
    const schedule = await backupSchedulerService.createSchedule(validation.data, userId)

    return NextResponse.json(
      {
        success: true,
        data: {
          schedule,
          message: '備份排程已建立',
        },
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('[POST /api/admin/backup-schedules] Error:', error)

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
