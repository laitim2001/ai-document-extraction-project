/**
 * @fileoverview 測試詳情 API 端點
 * @description
 *   Story 5-4: 測試規則變更效果 - 測試詳情查詢
 *   提供測試任務詳細結果的分頁查詢：
 *   - 分頁顯示所有測試案例
 *   - 篩選特定變更類型
 *   - 排序和搜尋功能
 *
 *   端點：
 *   - GET /api/test-tasks/[taskId]/details - 取得測試詳情列表
 *
 * @module src/app/api/test-tasks/[taskId]/details/route
 * @since Epic 5 - Story 5.4 (測試規則變更效果)
 * @lastModified 2025-12-19
 *
 * @dependencies
 *   - next/server - Next.js API 處理
 *   - @/lib/auth - NextAuth 認證
 *   - @/services/rule-testing.service - 規則測試服務
 *   - zod - 輸入驗證
 *
 * @related
 *   - src/app/api/test-tasks/[taskId]/route.ts - 任務狀態
 *   - src/app/api/test-tasks/[taskId]/report/route.ts - 報告下載
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { getTestDetails } from '@/services/rule-testing.service'
import type { TestChangeType } from '@prisma/client'

// ============================================================
// Validation Schema
// ============================================================

/**
 * 查詢參數驗證 Schema
 */
const querySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(100).default(20),
  changeType: z
    .enum(['IMPROVED', 'REGRESSED', 'UNCHANGED', 'BOTH_WRONG', 'BOTH_RIGHT'])
    .optional(),
  sortBy: z.enum(['createdAt', 'changeType', 'confidence']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
})

// ============================================================
// GET /api/test-tasks/[taskId]/details
// ============================================================

/**
 * GET /api/test-tasks/[taskId]/details
 * 取得測試詳情列表（分頁）
 *
 * @description
 *   Story 5-4: 測試規則變更效果
 *   取得指定測試任務的詳細測試結果
 *
 * @param request - Next.js 請求物件
 * @param params - 路由參數，包含任務 ID
 *
 * @query
 *   - page: 頁碼（預設 1）
 *   - pageSize: 每頁筆數（預設 20）
 *   - changeType: 篩選變更類型
 *   - sortBy: 排序欄位
 *   - sortOrder: 排序方向
 *
 * @returns 測試詳情列表和分頁資訊
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    const { taskId } = await params

    // 1. 認證檢查
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/unauthorized',
          title: 'Unauthorized',
          status: 401,
          detail: '請先登入',
        },
        { status: 401 }
      )
    }

    // 2. 驗證任務 ID 格式
    const uuidSchema = z.string().uuid()
    if (!uuidSchema.safeParse(taskId).success) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/validation',
          title: 'Validation Error',
          status: 400,
          detail: '無效的任務 ID 格式',
        },
        { status: 400 }
      )
    }

    // 3. 解析查詢參數
    const searchParams = request.nextUrl.searchParams
    const queryParams = {
      page: searchParams.get('page') ?? '1',
      pageSize: searchParams.get('pageSize') ?? '20',
      changeType: searchParams.get('changeType') ?? undefined,
      sortBy: searchParams.get('sortBy') ?? 'createdAt',
      sortOrder: searchParams.get('sortOrder') ?? 'desc',
    }

    const validation = querySchema.safeParse(queryParams)
    if (!validation.success) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/validation',
          title: 'Validation Error',
          status: 400,
          detail: '無效的查詢參數',
          errors: validation.error.flatten().fieldErrors,
        },
        { status: 400 }
      )
    }

    const { page, pageSize, changeType, sortBy, sortOrder } = validation.data

    // 4. 取得測試詳情
    const result = await getTestDetails(taskId, {
      page,
      pageSize,
      changeType: changeType as TestChangeType | undefined,
      sortBy,
      sortOrder,
    })

    if (!result) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/not-found',
          title: 'Not Found',
          status: 404,
          detail: '找不到指定的測試任務',
        },
        { status: 404 }
      )
    }

    // 5. 返回響應
    return NextResponse.json({
      success: true,
      data: result,
    })
  } catch (error) {
    console.error('Error fetching test details:', error)
    return NextResponse.json(
      {
        type: 'https://api.example.com/errors/internal',
        title: 'Internal Server Error',
        status: 500,
        detail: '取得測試詳情時發生錯誤',
      },
      { status: 500 }
    )
  }
}
