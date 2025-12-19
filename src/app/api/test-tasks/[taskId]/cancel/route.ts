/**
 * @fileoverview 取消測試任務 API 端點
 * @description
 *   Story 5-4: 測試規則變更效果 - 取消測試任務
 *   提供取消執行中測試任務的功能：
 *   - 只能取消 PENDING 或 RUNNING 狀態的任務
 *   - 取消後狀態變為 CANCELLED
 *
 *   端點：
 *   - POST /api/test-tasks/[taskId]/cancel - 取消測試任務
 *
 * @module src/app/api/test-tasks/[taskId]/cancel/route
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
 *   - src/app/api/rules/[id]/test/route.ts - 啟動測試
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { PERMISSIONS } from '@/types/permissions'
import { cancelTestTask } from '@/services/rule-testing.service'

// ============================================================
// Helper Functions
// ============================================================

/**
 * 檢查用戶是否有規則管理權限
 */
function hasRuleManagePermission(
  roles: { permissions: string[] }[] | undefined
): boolean {
  if (!roles) return false
  return roles.some((r) => r.permissions.includes(PERMISSIONS.RULE_MANAGE))
}

// ============================================================
// POST /api/test-tasks/[taskId]/cancel
// ============================================================

/**
 * POST /api/test-tasks/[taskId]/cancel
 * 取消測試任務
 *
 * @description
 *   Story 5-4: 測試規則變更效果
 *   取消執行中的測試任務
 *
 * @param request - Next.js 請求物件
 * @param params - 路由參數，包含任務 ID
 *
 * @returns 取消結果
 */
export async function POST(
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

    // 2. 權限檢查
    if (!hasRuleManagePermission(session.user.roles)) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/forbidden',
          title: 'Forbidden',
          status: 403,
          detail: '需要 RULE_MANAGE 權限',
        },
        { status: 403 }
      )
    }

    // 3. 驗證任務 ID 格式
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

    // 4. 取消任務
    const result = await cancelTestTask(taskId, session.user.id)

    if (!result.success) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/invalid-state',
          title: 'Invalid State',
          status: 400,
          detail: result.message,
        },
        { status: 400 }
      )
    }

    // 5. 返回響應
    return NextResponse.json({
      success: true,
      data: {
        taskId,
        status: 'CANCELLED',
        message: result.message,
      },
    })
  } catch (error) {
    console.error('Error cancelling test task:', error)
    return NextResponse.json(
      {
        type: 'https://api.example.com/errors/internal',
        title: 'Internal Server Error',
        status: 500,
        detail: '取消測試任務時發生錯誤',
      },
      { status: 500 }
    )
  }
}
