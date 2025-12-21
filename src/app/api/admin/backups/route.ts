/**
 * @fileoverview 備份管理 API - 列表與建立
 * @description
 *   提供備份列表查詢與手動建立備份功能
 *
 * @module src/app/api/admin/backups
 * @since Epic 12 - Story 12-5 (數據備份管理)
 * @lastModified 2025-12-21
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { backupService } from '@/services/backup.service'
import { z } from 'zod'

// ============================================================
// Validation Schemas
// ============================================================

const listBackupsSchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  status: z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'CANCELLED']).optional(),
  source: z.enum(['DATABASE', 'FILES', 'CONFIG', 'FULL_SYSTEM']).optional(),
  type: z.enum(['FULL', 'INCREMENTAL', 'DIFFERENTIAL']).optional(),
  trigger: z.enum(['SCHEDULED', 'MANUAL', 'PRE_RESTORE']).optional(),
  scheduleId: z.string().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  sortBy: z.enum(['createdAt', 'completedAt', 'sizeBytes', 'name']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
})

const createBackupSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  source: z.enum(['DATABASE', 'FILES', 'CONFIG', 'FULL_SYSTEM']),
  type: z.enum(['FULL', 'INCREMENTAL', 'DIFFERENTIAL']),
  options: z.object({
    compress: z.boolean().optional(),
    encrypt: z.boolean().optional(),
    includeTables: z.array(z.string()).optional(),
    excludeTables: z.array(z.string()).optional(),
    includeConfigs: z.array(z.string()).optional(),
  }).optional(),
})

// ============================================================
// GET /api/admin/backups - 取得備份列表
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
    const validation = listBackupsSchema.safeParse(searchParams)

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

    // 取得備份列表
    const result = await backupService.getBackups(validation.data)

    return NextResponse.json({
      success: true,
      data: {
        backups: result.backups,
        pagination: {
          page: result.page,
          limit: result.limit,
          total: result.total,
          totalPages: result.totalPages,
        },
      },
    })
  } catch (error) {
    console.error('[GET /api/admin/backups] Error:', error)
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
// POST /api/admin/backups - 建立手動備份
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
    const validation = createBackupSchema.safeParse(body)

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

    // 建立備份
    const userId = session.user.id || ''
    const backup = await backupService.createBackup(validation.data, userId)

    return NextResponse.json(
      {
        success: true,
        data: {
          backup,
          message: '備份任務已建立，正在後台執行',
        },
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('[POST /api/admin/backups] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    )
  }
}
