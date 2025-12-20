'use server'

/**
 * @fileoverview 資料歸檔記錄管理 API
 * @description
 *   提供資料歸檔記錄的列表和手動執行歸檔功能：
 *   - 列出所有歸檔記錄（支援分頁和篩選）
 *   - 手動執行歸檔任務
 *   - 僅限全局管理者訪問
 *
 * @module src/app/api/admin/retention/archives
 * @author Development Team
 * @since Epic 8 - Story 8.6 (Long-term Data Retention)
 * @lastModified 2025-12-20
 *
 * @features
 *   - 歸檔記錄列表（支援分頁和多種篩選）
 *   - 手動觸發歸檔任務
 *   - gzip 壓縮和 SHA-256 校驗
 *   - 全局管理者權限驗證
 *
 * @dependencies
 *   - @/lib/auth - 認證服務
 *   - @/services/data-retention.service - 資料保留服務
 *   - zod - 請求驗證
 *
 * @related
 *   - src/app/api/admin/retention/restore/route.ts - 還原 API
 *   - src/app/(dashboard)/admin/retention/page.tsx - 資料保留管理頁面
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { dataRetentionService } from '@/services/data-retention.service'
import { DataType, StorageTier, ArchiveStatus } from '@prisma/client'
import { z } from 'zod'

// ============================================================
// Validation Schemas
// ============================================================

const querySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(10),
  policyId: z.string().optional(),
  dataType: z.nativeEnum(DataType).optional(),
  storageTier: z.nativeEnum(StorageTier).optional(),
  status: z.nativeEnum(ArchiveStatus).optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
})

const runArchiveSchema = z.object({
  policyId: z.string().min(1),
  dateRangeStart: z.coerce.date(),
  dateRangeEnd: z.coerce.date(),
})

// ============================================================
// Route Handlers
// ============================================================

/**
 * GET /api/admin/retention/archives
 *
 * @description
 *   獲取資料歸檔記錄列表。支援分頁和多種篩選條件。
 *   僅限全局管理者訪問。
 *
 * @query
 *   - page: 頁碼（預設 1）
 *   - limit: 每頁筆數（預設 10，最大 100）
 *   - policyId: 策略 ID 篩選（可選）
 *   - dataType: 資料類型篩選（可選）
 *   - storageTier: 存儲層級篩選（可選）
 *   - status: 狀態篩選（可選）
 *   - dateFrom: 起始日期（可選）
 *   - dateTo: 結束日期（可選）
 *
 * @returns 歸檔記錄列表及分頁資訊
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

  const { page, limit, policyId, dataType, storageTier, status, dateFrom, dateTo } = validation.data

  try {
    const { records, total } = await dataRetentionService.getArchiveRecords({
      page,
      limit,
      policyId,
      dataType,
      storageTier,
      status,
      dateFrom,
      dateTo,
    })

    const totalPages = Math.ceil(total / limit)

    return NextResponse.json({
      success: true,
      data: records,
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
    console.error('[Archives API] Error:', error)

    return NextResponse.json(
      {
        type: 'https://api.example.com/errors/internal',
        title: 'Internal Server Error',
        status: 500,
        detail: 'Failed to fetch archive records',
      },
      { status: 500 }
    )
  }
}

/**
 * POST /api/admin/retention/archives
 *
 * @description
 *   手動執行歸檔任務。將指定時間範圍內的資料歸檔到冷存儲。
 *   使用 gzip 壓縮和 SHA-256 校驗確保資料完整性。
 *   僅限全局管理者訪問。
 *
 * @body
 *   - policyId: 保留策略 ID（必填）
 *   - dateRangeStart: 歸檔資料起始日期（必填）
 *   - dateRangeEnd: 歸檔資料結束日期（必填）
 *
 * @returns 歸檔任務結果
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

  const validation = runArchiveSchema.safeParse(body)

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

  const { policyId, dateRangeStart, dateRangeEnd } = validation.data

  // 驗證日期範圍
  if (dateRangeStart >= dateRangeEnd) {
    return NextResponse.json(
      {
        type: 'https://api.example.com/errors/validation',
        title: 'Validation Error',
        status: 400,
        detail: 'dateRangeStart must be before dateRangeEnd',
      },
      { status: 400 }
    )
  }

  try {
    const result = await dataRetentionService.runArchiveJob(
      policyId,
      dateRangeStart,
      dateRangeEnd
    )

    if (!result.success) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/archive-failed',
          title: 'Archive Failed',
          status: 500,
          detail: result.error || 'Archive job failed',
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Archive job completed successfully',
      data: {
        archiveRecordId: result.archiveRecordId,
        recordCount: result.recordCount,
        originalSizeBytes: result.originalSizeBytes,
        compressedSizeBytes: result.compressedSizeBytes,
        compressionRatio: result.compressionRatio,
        duration: result.duration,
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

    console.error('[Archives API] Archive job error:', error)

    return NextResponse.json(
      {
        type: 'https://api.example.com/errors/internal',
        title: 'Internal Server Error',
        status: 500,
        detail: 'Failed to run archive job',
      },
      { status: 500 }
    )
  }
}
