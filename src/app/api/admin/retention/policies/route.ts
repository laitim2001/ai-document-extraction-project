'use server'

/**
 * @fileoverview 資料保留策略管理 API
 * @description
 *   提供資料保留策略的列表和創建功能：
 *   - 列出所有保留策略（支援分頁和篩選）
 *   - 創建新保留策略
 *   - 僅限全局管理者訪問
 *
 * @module src/app/api/admin/retention/policies
 * @author Development Team
 * @since Epic 8 - Story 8.6 (Long-term Data Retention)
 * @lastModified 2025-12-20
 *
 * @features
 *   - 策略列表（支援分頁）
 *   - 創建新策略
 *   - 全局管理者權限驗證
 *
 * @dependencies
 *   - @/lib/auth - 認證服務
 *   - @/services/data-retention.service - 資料保留服務
 *   - zod - 請求驗證
 *
 * @related
 *   - src/app/api/admin/retention/policies/[id]/route.ts - 單一策略操作
 *   - src/app/(dashboard)/admin/retention/page.tsx - 資料保留管理頁面
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { dataRetentionService } from '@/services/data-retention.service'
import { DataType } from '@prisma/client'
import { z } from 'zod'

// ============================================================
// Validation Schemas
// ============================================================

const querySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(10),
  dataType: z.nativeEnum(DataType).optional(),
  isActive: z.enum(['true', 'false']).transform(v => v === 'true').optional(),
})

const createPolicySchema = z.object({
  policyName: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
  dataType: z.nativeEnum(DataType),
  hotStorageDays: z.number().min(0).max(365),
  warmStorageDays: z.number().min(0).max(730),
  coldStorageDays: z.number().min(0).max(3650),
  deletionProtection: z.boolean().default(true),
  requireApproval: z.boolean().default(true),
  minApprovalLevel: z.string().default('GLOBAL_ADMIN'),
  archiveSchedule: z.string().optional(),
  isActive: z.boolean().default(true),
})

// ============================================================
// Route Handlers
// ============================================================

/**
 * GET /api/admin/retention/policies
 *
 * @description
 *   獲取資料保留策略列表。支援分頁和篩選。
 *   僅限全局管理者訪問。
 *
 * @query
 *   - page: 頁碼（預設 1）
 *   - limit: 每頁筆數（預設 10，最大 100）
 *   - dataType: 資料類型篩選（可選）
 *   - isActive: 是否啟用篩選（可選）
 *
 * @returns 策略列表及分頁資訊
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

  const { page, limit, dataType, isActive } = validation.data

  try {
    const { policies, total } = await dataRetentionService.getPolicies({
      page,
      limit,
      dataType,
      isActive,
    })

    const totalPages = Math.ceil(total / limit)

    return NextResponse.json({
      success: true,
      data: policies,
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
    console.error('[Retention Policies API] Error:', error)

    return NextResponse.json(
      {
        type: 'https://api.example.com/errors/internal',
        title: 'Internal Server Error',
        status: 500,
        detail: 'Failed to fetch retention policies',
      },
      { status: 500 }
    )
  }
}

/**
 * POST /api/admin/retention/policies
 *
 * @description
 *   創建新的資料保留策略。
 *   僅限全局管理者訪問。
 *
 * @body
 *   - policyName: 策略名稱（必填）
 *   - description: 描述（可選）
 *   - dataType: 資料類型（必填）
 *   - hotStorageDays: 熱存儲天數（必填）
 *   - warmStorageDays: 溫存儲天數（必填）
 *   - coldStorageDays: 冷存儲天數（必填）
 *   - deletionProtection: 刪除保護（預設 true）
 *   - requireApproval: 需要審批（預設 true）
 *   - minApprovalLevel: 最低審批級別（預設 GLOBAL_ADMIN）
 *   - archiveSchedule: 歸檔排程（可選，cron 表達式）
 *   - isActive: 是否啟用（預設 true）
 *
 * @returns 創建的策略
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

  const validation = createPolicySchema.safeParse(body)

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
    const policy = await dataRetentionService.createPolicy(
      validation.data,
      session.user.id
    )

    return NextResponse.json(
      {
        success: true,
        message: 'Retention policy created successfully',
        data: policy,
      },
      { status: 201 }
    )
  } catch (error) {
    const err = error as Error

    if (err.message.includes('already exists')) {
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

    console.error('[Retention Policies API] Create error:', error)

    return NextResponse.json(
      {
        type: 'https://api.example.com/errors/internal',
        title: 'Internal Server Error',
        status: 500,
        detail: 'Failed to create retention policy',
      },
      { status: 500 }
    )
  }
}
