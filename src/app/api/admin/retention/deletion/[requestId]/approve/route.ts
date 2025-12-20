'use server'

/**
 * @fileoverview 刪除請求審批 API
 * @description
 *   提供刪除請求的審批功能：
 *   - 批准或拒絕刪除請求
 *   - 批准後自動執行刪除操作
 *   - 僅限全局管理者訪問
 *
 * @module src/app/api/admin/retention/deletion/[requestId]/approve
 * @author Development Team
 * @since Epic 8 - Story 8.6 (Long-term Data Retention)
 * @lastModified 2025-12-20
 *
 * @features
 *   - 批准/拒絕刪除請求
 *   - 自動執行已批准的刪除
 *   - 拒絕原因記錄
 *   - 全局管理者權限驗證
 *
 * @dependencies
 *   - @/lib/auth - 認證服務
 *   - @/services/data-retention.service - 資料保留服務
 *   - zod - 請求驗證
 *
 * @related
 *   - src/app/api/admin/retention/deletion/route.ts - 刪除請求 API
 *   - src/app/(dashboard)/admin/retention/page.tsx - 資料保留管理頁面
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { dataRetentionService } from '@/services/data-retention.service'
import { z } from 'zod'

// ============================================================
// Validation Schemas
// ============================================================

const approveSchema = z.object({
  approve: z.boolean(),
  rejectionReason: z.string().max(1000).optional(),
}).refine(
  (data) => data.approve || (data.rejectionReason && data.rejectionReason.length > 0),
  {
    message: 'Rejection reason is required when rejecting a request',
    path: ['rejectionReason'],
  }
)

// ============================================================
// Route Handlers
// ============================================================

interface RouteParams {
  params: Promise<{ requestId: string }>
}

/**
 * POST /api/admin/retention/deletion/[requestId]/approve
 *
 * @description
 *   審批刪除請求。可以批准或拒絕請求。
 *   批准後將自動執行刪除操作。
 *   拒絕時必須提供原因。
 *   僅限全局管理者訪問。
 *
 * @param requestId - 刪除請求 ID
 * @body
 *   - approve: 是否批准（必填）
 *   - rejectionReason: 拒絕原因（拒絕時必填）
 *
 * @returns 審批結果
 */
export async function POST(
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

  const { requestId } = await params

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

  const validation = approveSchema.safeParse(body)

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

  const { approve, rejectionReason } = validation.data

  try {
    // 執行審批
    const deletionRequest = await dataRetentionService.approveDeletionRequest(
      requestId,
      approve,
      session.user.id,
      rejectionReason
    )

    // 如果批准，執行刪除
    let deletedCount: number | undefined
    if (approve) {
      try {
        deletedCount = await dataRetentionService.executeDeletion(requestId)
      } catch (execError) {
        console.error('[Deletion Approve API] Execution error:', execError)
        // 刪除執行失敗不影響審批結果的返回
      }
    }

    return NextResponse.json({
      success: true,
      message: approve
        ? `Deletion request approved and executed. ${deletedCount ?? 0} records deleted.`
        : 'Deletion request rejected.',
      data: {
        ...deletionRequest,
        deletedCount,
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

    if (err.message.includes('not in PENDING status')) {
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

    if (err.message.includes('Cannot approve your own')) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/forbidden',
          title: 'Forbidden',
          status: 403,
          detail: err.message,
        },
        { status: 403 }
      )
    }

    console.error('[Deletion Approve API] Error:', error)

    return NextResponse.json(
      {
        type: 'https://api.example.com/errors/internal',
        title: 'Internal Server Error',
        status: 500,
        detail: 'Failed to process deletion request approval',
      },
      { status: 500 }
    )
  }
}
