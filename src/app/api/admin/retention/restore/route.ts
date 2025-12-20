'use server'

/**
 * @fileoverview 資料還原管理 API
 * @description
 *   提供歸檔資料的還原功能：
 *   - 查詢還原請求列表
 *   - 發起資料還原請求
 *   - 支援延遲載入（COOL: 30秒, ARCHIVE: 12小時）
 *   - 僅限全局管理者訪問
 *
 * @module src/app/api/admin/retention/restore
 * @author Development Team
 * @since Epic 8 - Story 8.6 (Long-term Data Retention)
 * @lastModified 2025-12-20
 *
 * @features
 *   - 還原請求列表（支援分頁）
 *   - 發起還原請求
 *   - 層級感知的等待時間估算
 *   - 全局管理者權限驗證
 *
 * @dependencies
 *   - @/lib/auth - 認證服務
 *   - @/services/data-retention.service - 資料保留服務
 *   - zod - 請求驗證
 *
 * @related
 *   - src/app/api/admin/retention/archives/route.ts - 歸檔 API
 *   - src/app/(dashboard)/admin/retention/page.tsx - 資料保留管理頁面
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { dataRetentionService } from '@/services/data-retention.service'
import { RestoreRequestStatus } from '@prisma/client'
import { z } from 'zod'

// ============================================================
// Validation Schemas
// ============================================================

const querySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(10),
  archiveRecordId: z.string().optional(),
  status: z.nativeEnum(RestoreRequestStatus).optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
})

const createRestoreSchema = z.object({
  archiveRecordId: z.string().min(1),
  reason: z.string().min(1).max(1000),
  notes: z.string().max(2000).optional(),
})

// ============================================================
// Route Handlers
// ============================================================

/**
 * GET /api/admin/retention/restore
 *
 * @description
 *   獲取還原請求列表。支援分頁和篩選。
 *   僅限全局管理者訪問。
 *
 * @query
 *   - page: 頁碼（預設 1）
 *   - limit: 每頁筆數（預設 10，最大 100）
 *   - archiveRecordId: 歸檔記錄 ID 篩選（可選）
 *   - status: 狀態篩選（可選）
 *   - dateFrom: 起始日期（可選）
 *   - dateTo: 結束日期（可選）
 *
 * @returns 還原請求列表及分頁資訊
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  // --- 認證檢查 ---
  const session = await auth()

  if (!session?.user) {
    return NextResponse.json(
      {
        type: 'https://api.example.com/errors/unauthorized',
        title: 'Unauthorized',
        status: 401,
        detail: 'Authentication required',
      },
      { status: 401 }
    )
  }

  if (!session.user.isGlobalAdmin) {
    return NextResponse.json(
      {
        type: 'https://api.example.com/errors/forbidden',
        title: 'Forbidden',
        status: 403,
        detail: 'Global admin access required',
      },
      { status: 403 }
    )
  }

  // --- 解析查詢參數 ---
  const searchParams = Object.fromEntries(request.nextUrl.searchParams.entries())
  const validation = querySchema.safeParse(searchParams)

  if (!validation.success) {
    return NextResponse.json(
      {
        type: 'https://api.example.com/errors/validation',
        title: 'Validation Error',
        status: 400,
        detail: 'Invalid query parameters',
        errors: validation.error.flatten().fieldErrors,
      },
      { status: 400 }
    )
  }

  const { page, limit, archiveRecordId, status, dateFrom, dateTo } = validation.data

  try {
    const { requests, total } = await dataRetentionService.getRestoreRequests({
      page,
      limit,
      archiveRecordId,
      status,
      dateFrom,
      dateTo,
    })

    const totalPages = Math.ceil(total / limit)

    return NextResponse.json({
      success: true,
      data: requests,
      meta: {
        pagination: {
          page,
          limit,
          total,
          totalPages,
        },
      },
    })
  } catch (error) {
    console.error('[Restore API] Error:', error)

    return NextResponse.json(
      {
        type: 'https://api.example.com/errors/internal',
        title: 'Internal Server Error',
        status: 500,
        detail: 'Failed to fetch restore requests',
      },
      { status: 500 }
    )
  }
}

/**
 * POST /api/admin/retention/restore
 *
 * @description
 *   發起資料還原請求。根據存儲層級有不同的等待時間：
 *   - HOT: 即時（0 秒）
 *   - COOL: 約 30 秒
 *   - COLD: 約 1 分鐘
 *   - ARCHIVE: 約 12 小時
 *   僅限全局管理者訪問。
 *
 * @body
 *   - archiveRecordId: 歸檔記錄 ID（必填）
 *   - reason: 還原原因（必填）
 *   - notes: 備註（可選）
 *
 * @returns 還原請求結果，包含預估等待時間
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  // --- 認證檢查 ---
  const session = await auth()

  if (!session?.user) {
    return NextResponse.json(
      {
        type: 'https://api.example.com/errors/unauthorized',
        title: 'Unauthorized',
        status: 401,
        detail: 'Authentication required',
      },
      { status: 401 }
    )
  }

  if (!session.user.isGlobalAdmin) {
    return NextResponse.json(
      {
        type: 'https://api.example.com/errors/forbidden',
        title: 'Forbidden',
        status: 403,
        detail: 'Global admin access required',
      },
      { status: 403 }
    )
  }

  // --- 解析請求體 ---
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      {
        type: 'https://api.example.com/errors/validation',
        title: 'Invalid JSON',
        status: 400,
        detail: 'Request body must be valid JSON',
      },
      { status: 400 }
    )
  }

  const validation = createRestoreSchema.safeParse(body)

  if (!validation.success) {
    return NextResponse.json(
      {
        type: 'https://api.example.com/errors/validation',
        title: 'Validation Error',
        status: 400,
        detail: 'Invalid request data',
        errors: validation.error.flatten().fieldErrors,
      },
      { status: 400 }
    )
  }

  try {
    const result = await dataRetentionService.restoreFromArchive(
      validation.data,
      session.user.id
    )

    if (!result.success) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/restore-failed',
          title: 'Restore Failed',
          status: 500,
          detail: result.error || 'Restore request failed',
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Restore request submitted successfully',
      data: {
        restoreRequestId: result.restoreRequestId,
        archiveRecordId: result.archiveRecordId,
        status: result.status,
        estimatedWaitTime: result.estimatedWaitTime,
        blobUrl: result.blobUrl,
        expiresAt: result.expiresAt,
      },
    })
  } catch (error) {
    const err = error as Error

    if (err.message.includes('not found')) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/not-found',
          title: 'Not Found',
          status: 404,
          detail: err.message,
        },
        { status: 404 }
      )
    }

    if (err.message.includes('already being restored')) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/conflict',
          title: 'Conflict',
          status: 409,
          detail: err.message,
        },
        { status: 409 }
      )
    }

    console.error('[Restore API] Restore request error:', error)

    return NextResponse.json(
      {
        type: 'https://api.example.com/errors/internal',
        title: 'Internal Server Error',
        status: 500,
        detail: 'Failed to submit restore request',
      },
      { status: 500 }
    )
  }
}
