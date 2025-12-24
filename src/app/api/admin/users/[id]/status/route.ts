/**
 * @fileoverview 用戶狀態管理 API 端點
 * @description
 *   提供用戶狀態更新的 RESTful API 操作。
 *   支援啟用/停用用戶帳戶功能。
 *
 *   端點：
 *   - PATCH /api/admin/users/[id]/status - 更新用戶狀態
 *
 *   權限要求：
 *   - USER_MANAGE 權限
 *
 *   業務規則：
 *   - 用戶無法停用自己的帳戶
 *   - 所有狀態變更都記錄審計日誌
 *
 * @module src/app/api/admin/users/[id]/status/route
 * @author Development Team
 * @since Epic 1 - Story 1.6 (Disable/Enable User Account)
 * @lastModified 2025-12-18
 *
 * @dependencies
 *   - next/server - Next.js API 處理
 *   - @/lib/auth - NextAuth 認證
 *   - @/services - 服務層
 *   - @/types/permissions - 權限常量
 *   - @/lib/validations - Zod 驗證 Schema
 *   - @/lib/errors - 錯誤處理
 *
 * @related
 *   - src/app/api/admin/users/[id]/route.ts - 用戶 CRUD API
 *   - src/services/user.service.ts - 用戶服務
 *   - src/lib/audit/logger.ts - 審計日誌
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { updateUserStatusWithAudit } from '@/services/user.service'
import { PERMISSIONS } from '@/types/permissions'
import { updateUserStatusSchema } from '@/lib/validations/user.schema'
import { isAppError } from '@/lib/errors'

// ============================================================
// Types
// ============================================================

interface RouteParams {
  params: Promise<{ id: string }>
}

// ============================================================
// PATCH Handler
// ============================================================

/**
 * PATCH /api/admin/users/[id]/status
 * 更新用戶狀態
 *
 * @description
 *   更新指定用戶的帳戶狀態（啟用/停用）。
 *   需要 USER_MANAGE 權限。
 *   用戶無法停用自己的帳戶。
 *   所有變更都會記錄到審計日誌。
 *
 * @param request - Next.js 請求物件
 * @param params - 路由參數，包含用戶 ID
 *
 * @body status - 新狀態 ('ACTIVE' | 'INACTIVE')
 *
 * @returns 更新後的用戶資料
 *
 * @example
 *   PATCH /api/admin/users/cm5abcdef123456/status
 *   {
 *     "status": "INACTIVE"
 *   }
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    // 驗證認證狀態
    const session = await auth()

    if (!session?.user) {
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

    // 檢查權限：需要 USER_MANAGE 權限（支援 wildcard）
    const hasPermission = session.user.roles?.some((role) =>
      role.permissions.includes('*') || role.permissions.includes(PERMISSIONS.USER_MANAGE)
    )

    if (!hasPermission) {
      return NextResponse.json(
        {
          success: false,
          error: {
            type: 'https://api.example.com/errors/forbidden',
            title: 'Forbidden',
            status: 403,
            detail: 'USER_MANAGE permission required',
          },
        },
        { status: 403 }
      )
    }

    // 獲取路由參數
    const { id } = await params

    // 驗證 ID 格式
    if (!id || typeof id !== 'string') {
      return NextResponse.json(
        {
          success: false,
          error: {
            type: 'https://api.example.com/errors/validation',
            title: 'Validation Error',
            status: 400,
            detail: 'Invalid user ID',
          },
        },
        { status: 400 }
      )
    }

    // 解析並驗證請求內容
    const body = await request.json()
    const validationResult = updateUserStatusSchema.safeParse(body)

    if (!validationResult.success) {
      const firstError = validationResult.error.issues[0]
      return NextResponse.json(
        {
          success: false,
          error: {
            type: 'https://api.example.com/errors/validation',
            title: 'Validation Error',
            status: 400,
            detail: firstError.message,
            errors: validationResult.error.issues.map((issue) => ({
              field: issue.path.join('.'),
              message: issue.message,
            })),
          },
        },
        { status: 400 }
      )
    }

    // 更新用戶狀態
    const updatedUser = await updateUserStatusWithAudit(
      id,
      validationResult.data.status,
      session.user.id
    )

    return NextResponse.json({
      success: true,
      data: {
        id: updatedUser.id,
        status: updatedUser.status,
      },
    })
  } catch (error) {
    console.error('Update user status error:', error)

    // 處理業務邏輯錯誤
    if (isAppError(error)) {
      return NextResponse.json(
        {
          success: false,
          error: error.toJSON(),
        },
        { status: error.status }
      )
    }

    return NextResponse.json(
      {
        success: false,
        error: {
          type: 'https://api.example.com/errors/internal-server-error',
          title: 'Internal Server Error',
          status: 500,
          detail: 'Failed to update user status',
        },
      },
      { status: 500 }
    )
  }
}
