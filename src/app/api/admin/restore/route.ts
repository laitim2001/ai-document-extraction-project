/**
 * @fileoverview 數據恢復管理 API - 列表與建立
 * @description
 *   提供恢復記錄列表查詢與啟動恢復操作功能
 *   - GET: 取得恢復記錄列表（支援分頁、過濾、排序）
 *   - POST: 啟動新的恢復操作
 *
 * @module src/app/api/admin/restore
 * @since Epic 12 - Story 12-6 (數據恢復功能)
 * @lastModified 2025-12-21
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { RestoreService } from '@/services/restore.service'
import { z } from 'zod'

// ============================================================
// Service Instance
// ============================================================

const restoreService = new RestoreService()

// ============================================================
// Validation Schemas
// ============================================================

const listRestoreSchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  status: z.enum([
    'PENDING',
    'VALIDATING',
    'PRE_BACKUP',
    'IN_PROGRESS',
    'VERIFYING',
    'COMPLETED',
    'FAILED',
    'CANCELLED',
    'ROLLED_BACK',
  ]).optional(),
  type: z.enum(['FULL', 'PARTIAL', 'DRILL', 'POINT_IN_TIME']).optional(),
  backupId: z.string().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  sortBy: z.enum(['createdAt', 'completedAt', 'status', 'type']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
})

const startRestoreSchema = z.object({
  backupId: z.string().min(1, '備份 ID 為必填'),
  type: z.enum(['FULL', 'PARTIAL', 'DRILL', 'POINT_IN_TIME']),
  scope: z.union([
    z.enum(['DATABASE', 'FILES', 'CONFIG', 'ALL']),
    z.array(z.enum(['DATABASE', 'FILES', 'CONFIG', 'ALL'])),
  ]),
  selectedTables: z.array(z.string()).optional(),
  selectedFiles: z.array(z.string()).optional(),
  confirmationText: z.string().min(1, '確認文字為必填'),
  targetPointInTime: z.string().datetime().optional(),
  drillName: z.string().max(100).optional(),
})

// ============================================================
// GET /api/admin/restore - 取得恢復記錄列表
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
    const validation = listRestoreSchema.safeParse(searchParams)

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

    // 計算 offset
    const page = validation.data.page || 1
    const limit = validation.data.limit || 20
    const offset = (page - 1) * limit

    // 取得恢復記錄列表
    const result = await restoreService.listRestoreRecords({
      status: validation.data.status,
      type: validation.data.type,
      backupId: validation.data.backupId,
      startDate: validation.data.startDate ? new Date(validation.data.startDate) : undefined,
      endDate: validation.data.endDate ? new Date(validation.data.endDate) : undefined,
      limit,
      offset,
      sortBy: validation.data.sortBy,
      sortOrder: validation.data.sortOrder,
    })

    return NextResponse.json({
      success: true,
      data: {
        records: result.records,
        pagination: {
          page,
          limit,
          total: result.total,
          totalPages: Math.ceil(result.total / limit),
        },
      },
    })
  } catch (error) {
    console.error('[GET /api/admin/restore] Error:', error)
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
// POST /api/admin/restore - 開始恢復操作
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
    const validation = startRestoreSchema.safeParse(body)

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

    // 開始恢復操作
    const userId = session.user.id || ''
    // 確保 scope 是陣列
    const scopeArray = Array.isArray(validation.data.scope)
      ? validation.data.scope
      : [validation.data.scope]
    const record = await restoreService.startRestore(
      {
        backupId: validation.data.backupId,
        type: validation.data.type,
        scope: scopeArray,
        selectedTables: validation.data.selectedTables,
        selectedFiles: validation.data.selectedFiles,
        confirmationText: validation.data.confirmationText,
      },
      userId
    )

    return NextResponse.json(
      {
        success: true,
        data: {
          record,
          message: '恢復操作已開始，正在後台執行',
        },
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('[POST /api/admin/restore] Error:', error)

    // 處理業務邏輯錯誤（回傳 400）
    const isBusinessError = error instanceof Error && (
      error.message.includes('確認文字') ||
      error.message.includes('備份') ||
      error.message.includes('進行中') ||
      error.message.includes('不存在')
    )

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: isBusinessError ? 400 : 500 }
    )
  }
}
