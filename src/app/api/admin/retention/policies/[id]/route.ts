'use server'

/**
 * @fileoverview 單一資料保留策略操作 API
 * @description
 *   提供單一資料保留策略的操作：
 *   - 獲取策略詳情
 *   - 更新策略
 *   - 刪除策略
 *   - 僅限全局管理者訪問
 *
 * @module src/app/api/admin/retention/policies/[id]
 * @author Development Team
 * @since Epic 8 - Story 8.6 (Long-term Data Retention)
 * @lastModified 2025-12-20
 *
 * @features
 *   - 策略詳情查詢
 *   - 策略更新
 *   - 策略刪除
 *   - 全局管理者權限驗證
 *
 * @dependencies
 *   - @/lib/auth - 認證服務
 *   - @/services/data-retention.service - 資料保留服務
 *   - zod - 請求驗證
 *
 * @related
 *   - src/app/api/admin/retention/policies/route.ts - 策略列表
 *   - src/app/(dashboard)/admin/retention/page.tsx - 資料保留管理頁面
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { dataRetentionService } from '@/services/data-retention.service'
import { z } from 'zod'

// ============================================================
// Validation Schemas
// ============================================================

const updatePolicySchema = z.object({
  policyName: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).optional(),
  hotStorageDays: z.number().min(0).max(365).optional(),
  warmStorageDays: z.number().min(0).max(730).optional(),
  coldStorageDays: z.number().min(0).max(3650).optional(),
  deletionProtection: z.boolean().optional(),
  requireApproval: z.boolean().optional(),
  minApprovalLevel: z.string().optional(),
  archiveSchedule: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
})

// ============================================================
// Route Handlers
// ============================================================

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * GET /api/admin/retention/policies/[id]
 *
 * @description
 *   獲取單一資料保留策略詳情。
 *   僅限全局管理者訪問。
 *
 * @param id - 策略 ID
 * @returns 策略詳情
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
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

  const { id } = await params

  try {
    const policy = await dataRetentionService.getPolicy(id)

    if (!policy) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/not-found',
          title: 'Not Found',
          status: 404,
          detail: 'Retention policy not found',
        },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: policy,
    })
  } catch (error) {
    console.error('[Retention Policy API] Error:', error)

    return NextResponse.json(
      {
        type: 'https://api.example.com/errors/internal',
        title: 'Internal Server Error',
        status: 500,
        detail: 'Failed to fetch retention policy',
      },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/admin/retention/policies/[id]
 *
 * @description
 *   更新資料保留策略。
 *   僅限全局管理者訪問。
 *
 * @param id - 策略 ID
 * @body 要更新的欄位
 * @returns 更新後的策略
 */
export async function PATCH(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
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

  const { id } = await params

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

  const validation = updatePolicySchema.safeParse(body)

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
    const policy = await dataRetentionService.updatePolicy(id, validation.data)

    return NextResponse.json({
      success: true,
      message: 'Retention policy updated successfully',
      data: policy,
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

    console.error('[Retention Policy API] Update error:', error)

    return NextResponse.json(
      {
        type: 'https://api.example.com/errors/internal',
        title: 'Internal Server Error',
        status: 500,
        detail: 'Failed to update retention policy',
      },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/admin/retention/policies/[id]
 *
 * @description
 *   刪除資料保留策略。
 *   僅限全局管理者訪問。
 *   注意：只能刪除沒有關聯歸檔記錄的策略。
 *
 * @param id - 策略 ID
 * @returns 刪除成功訊息
 */
export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
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

  const { id } = await params

  try {
    await dataRetentionService.deletePolicy(id)

    return NextResponse.json({
      success: true,
      message: 'Retention policy deleted successfully',
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

    if (err.message.includes('Cannot delete')) {
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

    console.error('[Retention Policy API] Delete error:', error)

    return NextResponse.json(
      {
        type: 'https://api.example.com/errors/internal',
        title: 'Internal Server Error',
        status: 500,
        detail: 'Failed to delete retention policy',
      },
      { status: 500 }
    )
  }
}
