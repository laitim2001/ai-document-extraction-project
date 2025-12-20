'use server'

/**
 * @fileoverview 資料刪除請求管理 API
 * @description
 *   提供資料刪除請求的列表和創建功能：
 *   - 列出所有刪除請求（支援分頁和篩選）
 *   - 創建新刪除請求（需要管理員審批）
 *   - 僅限全局管理者訪問
 *
 * @module src/app/api/admin/retention/deletion
 * @author Development Team
 * @since Epic 8 - Story 8.6 (Long-term Data Retention)
 * @lastModified 2025-12-20
 *
 * @features
 *   - 刪除請求列表（支援分頁和多種篩選）
 *   - 創建刪除請求（進入審批流程）
 *   - 刪除保護機制
 *   - 全局管理者權限驗證
 *
 * @dependencies
 *   - @/lib/auth - 認證服務
 *   - @/services/data-retention.service - 資料保留服務
 *   - zod - 請求驗證
 *
 * @related
 *   - src/app/api/admin/retention/deletion/[requestId]/approve/route.ts - 審批 API
 *   - src/app/(dashboard)/admin/retention/page.tsx - 資料保留管理頁面
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { dataRetentionService } from '@/services/data-retention.service'
import { DataType, DeletionRequestStatus } from '@prisma/client'
import { z } from 'zod'

// ============================================================
// Validation Schemas
// ============================================================

const querySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(10),
  policyId: z.string().optional(),
  dataType: z.nativeEnum(DataType).optional(),
  status: z.nativeEnum(DeletionRequestStatus).optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
})

const createDeletionSchema = z.object({
  policyId: z.string().min(1),
  dataType: z.nativeEnum(DataType),
  sourceTable: z.string().min(1).max(255),
  dateRangeStart: z.coerce.date(),
  dateRangeEnd: z.coerce.date(),
  reason: z.string().min(1).max(1000),
  notes: z.string().max(2000).optional(),
})

// ============================================================
// Route Handlers
// ============================================================

/**
 * GET /api/admin/retention/deletion
 *
 * @description
 *   獲取刪除請求列表。支援分頁和多種篩選條件。
 *   僅限全局管理者訪問。
 *
 * @query
 *   - page: 頁碼（預設 1）
 *   - limit: 每頁筆數（預設 10，最大 100）
 *   - policyId: 策略 ID 篩選（可選）
 *   - dataType: 資料類型篩選（可選）
 *   - status: 狀態篩選（可選）
 *   - dateFrom: 起始日期（可選）
 *   - dateTo: 結束日期（可選）
 *
 * @returns 刪除請求列表及分頁資訊
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

  const { page, limit, policyId, dataType, status, dateFrom, dateTo } = validation.data

  try {
    const { requests, total } = await dataRetentionService.getDeletionRequests({
      page,
      limit,
      policyId,
      dataType,
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
    console.error('[Deletion API] Error:', error)

    return NextResponse.json(
      {
        type: 'https://api.example.com/errors/internal',
        title: 'Internal Server Error',
        status: 500,
        detail: 'Failed to fetch deletion requests',
      },
      { status: 500 }
    )
  }
}

/**
 * POST /api/admin/retention/deletion
 *
 * @description
 *   創建新的刪除請求。請求將進入審批流程，需要管理員審批後才會執行。
 *   如果策略啟用了刪除保護，則需要更高級別的審批。
 *   僅限全局管理者訪問。
 *
 * @body
 *   - policyId: 保留策略 ID（必填）
 *   - dataType: 資料類型（必填）
 *   - sourceTable: 來源資料表（必填）
 *   - dateRangeStart: 刪除資料起始日期（必填）
 *   - dateRangeEnd: 刪除資料結束日期（必填）
 *   - reason: 刪除原因（必填）
 *   - notes: 備註（可選）
 *
 * @returns 創建的刪除請求
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

  const validation = createDeletionSchema.safeParse(body)

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

  const { dateRangeStart, dateRangeEnd } = validation.data

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
    const deletionRequest = await dataRetentionService.createDeletionRequest(
      validation.data,
      session.user.id
    )

    return NextResponse.json(
      {
        success: true,
        message: 'Deletion request created successfully. Awaiting approval.',
        data: deletionRequest,
      },
      { status: 201 }
    )
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

    console.error('[Deletion API] Create error:', error)

    return NextResponse.json(
      {
        type: 'https://api.example.com/errors/internal',
        title: 'Internal Server Error',
        status: 500,
        detail: 'Failed to create deletion request',
      },
      { status: 500 }
    )
  }
}
