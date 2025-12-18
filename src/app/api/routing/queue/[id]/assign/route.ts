/**
 * @fileoverview 隊列分配 API 端點
 * @description
 *   提供隊列項目分配相關操作：
 *   - POST /api/routing/queue/[id]/assign - 將隊列項目分配給審核者
 *
 *   ## 分配流程
 *
 *   1. 驗證隊列項目存在且狀態為 PENDING
 *   2. 分配給指定審核者或當前用戶
 *   3. 更新隊列狀態為 IN_PROGRESS
 *   4. 更新文件狀態為 IN_REVIEW
 *   5. 記錄審計日誌
 *
 * @module src/app/api/routing/queue/[id]/assign/route
 * @since Epic 2 - Story 2.6 (Processing Path Auto Routing)
 * @lastModified 2025-12-18
 *
 * @dependencies
 *   - next/server - Next.js API 處理
 *   - @/lib/auth - NextAuth 認證
 *   - @/services/routing.service - 路由服務
 *   - zod - 請求驗證
 *
 * @related
 *   - src/services/routing.service.ts - 路由業務邏輯
 *   - src/app/api/routing/queue/route.ts - 隊列查詢 API
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { assignToReviewer } from '@/services/routing.service'

// ============================================================
// Route Params Type
// ============================================================

interface RouteParams {
  params: Promise<{ id: string }>
}

// ============================================================
// Validation Schemas
// ============================================================

/**
 * 分配請求驗證
 */
const assignRequestSchema = z.object({
  reviewerId: z.string().uuid('Invalid reviewer ID format').optional(),
})

// ============================================================
// POST /api/routing/queue/[id]/assign - 分配隊列項目
// ============================================================

/**
 * 將隊列項目分配給審核者
 *
 * @description
 *   分配隊列項目給指定審核者或當前登入用戶。
 *   僅 PENDING 狀態的項目可以被分配。
 *
 * @param id - 隊列項目 ID（URL 參數）
 * @param body.reviewerId - 審核者 ID（可選，預設為當前用戶）
 *
 * @returns 分配結果
 *
 * @example
 *   // 分配給當前用戶
 *   POST /api/routing/queue/queue-123/assign
 *   {}
 *
 *   // 分配給指定審核者
 *   POST /api/routing/queue/queue-123/assign
 *   { "reviewerId": "user-456" }
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    // 驗證認證狀態
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json(
        {
          success: false,
          error: {
            type: 'https://api.example.com/errors/unauthorized',
            title: 'Unauthorized',
            status: 401,
            detail: 'Authentication required',
          },
        },
        { status: 401 }
      )
    }

    // 解析 URL 參數
    const { id: queueId } = await params

    if (!queueId) {
      return NextResponse.json(
        {
          success: false,
          error: {
            type: 'https://api.example.com/errors/validation',
            title: 'Validation Error',
            status: 400,
            detail: 'Queue item ID is required',
          },
        },
        { status: 400 }
      )
    }

    // 解析請求體（可能為空）
    let body = {}
    try {
      body = await request.json()
    } catch {
      // 允許空請求體
    }

    const validation = assignRequestSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            type: 'https://api.example.com/errors/validation',
            title: 'Validation Error',
            status: 400,
            detail: 'Invalid request parameters',
            errors: validation.error.flatten().fieldErrors,
          },
        },
        { status: 400 }
      )
    }

    // 使用指定的審核者或當前用戶
    const reviewerId = validation.data.reviewerId || session.user.id

    // 執行分配
    await assignToReviewer(queueId, reviewerId)

    return NextResponse.json({
      success: true,
      data: {
        queueId,
        assignedTo: reviewerId,
        assignedBy: session.user.id,
        assignedAt: new Date().toISOString(),
      },
      message: 'Queue item assigned successfully',
    })
  } catch (error) {
    console.error('[AssignAPI] POST error:', error)

    // 特定錯誤處理
    if (error instanceof Error) {
      if (error.message.includes('not found')) {
        return NextResponse.json(
          {
            success: false,
            error: {
              type: 'https://api.example.com/errors/not-found',
              title: 'Not Found',
              status: 404,
              detail: error.message,
            },
          },
          { status: 404 }
        )
      }

      if (error.message.includes('not pending')) {
        return NextResponse.json(
          {
            success: false,
            error: {
              type: 'https://api.example.com/errors/conflict',
              title: 'Conflict',
              status: 409,
              detail: error.message,
            },
          },
          { status: 409 }
        )
      }
    }

    return NextResponse.json(
      {
        success: false,
        error: {
          type: 'https://api.example.com/errors/internal',
          title: 'Internal Server Error',
          status: 500,
          detail: error instanceof Error ? error.message : 'Failed to assign queue item',
        },
      },
      { status: 500 }
    )
  }
}
