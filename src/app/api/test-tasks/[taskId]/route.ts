/**
 * @fileoverview 測試任務狀態 API 端點
 * @description
 *   Story 5-4: 測試規則變更效果 - 任務狀態查詢
 *   提供測試任務狀態和結果的查詢功能：
 *   - 查詢任務執行狀態
 *   - 取得測試結果摘要
 *   - 監控測試進度
 *
 *   端點：
 *   - GET /api/test-tasks/[taskId] - 取得任務狀態
 *
 * @module src/app/api/test-tasks/[taskId]/route
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
 *   - src/app/api/rules/[id]/test/route.ts - 啟動測試
 *   - src/app/api/test-tasks/[taskId]/details/route.ts - 測試詳情
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { getTestTask } from '@/services/rule-testing.service'

// ============================================================
// GET /api/test-tasks/[taskId]
// ============================================================

/**
 * GET /api/test-tasks/[taskId]
 * 取得測試任務狀態與結果
 *
 * @description
 *   Story 5-4: 測試規則變更效果
 *   取得指定測試任務的執行狀態和結果摘要
 *
 * @param request - Next.js 請求物件
 * @param params - 路由參數，包含任務 ID
 *
 * @returns 任務狀態和結果
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

    // 3. 取得任務
    const task = await getTestTask(taskId)

    if (!task) {
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

    // 4. 返回響應
    return NextResponse.json({
      success: true,
      data: task,
    })
  } catch (error) {
    console.error('Error fetching test task:', error)
    return NextResponse.json(
      {
        type: 'https://api.example.com/errors/internal',
        title: 'Internal Server Error',
        status: 500,
        detail: '取得測試任務時發生錯誤',
      },
      { status: 500 }
    )
  }
}
