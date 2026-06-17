/**
 * @fileoverview Admin 重設用戶密碼 API 端點
 * @description
 *   提供管理員直接為本地帳號設定新密碼（不需舊密碼）。
 *   需要認證 + USER_MANAGE（含城市範圍）權限。
 *   Azure AD 用戶不可重設（密碼由 Azure AD 管理，於服務層擋下）。
 *
 *   端點：
 *   - PATCH /api/admin/users/[id]/password - 重設指定用戶密碼
 *
 * @module src/app/api/admin/users/[id]/password/route
 * @author Development Team
 * @since CHANGE-082 - Admin 用戶密碼管理
 * @lastModified 2026-06-17
 *
 * @related
 *   - src/app/api/admin/users/[id]/route.ts - 用戶更新 API（共用權限模式）
 *   - src/services/user.service.ts - adminResetPassword
 *   - src/lib/validations/user.schema.ts - adminResetPasswordSchema
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getUserByIdWithRoles, adminResetPassword } from '@/services/user.service'
import { adminResetPasswordSchema } from '@/lib/validations/user.schema'
import { isAppError } from '@/lib/errors'
import { checkCityEditPermission } from '@/lib/auth/city-permission'

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
 * PATCH /api/admin/users/[id]/password
 * 重設指定用戶密碼（僅本地帳號）
 *
 * @body newPassword - 新密碼（強密碼）
 * @body confirmPassword - 確認密碼（需與 newPassword 相符）
 *
 * @returns 成功訊息
 *
 * @example
 *   PATCH /api/admin/users/cm5abcdef123456/password
 *   { "newPassword": "NewPass123", "confirmPassword": "NewPass123" }
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    // 1. 驗證認證狀態
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

    // 2. 獲取路由參數
    const { id } = await params

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

    // 3. 獲取目標用戶以檢查城市權限
    const targetUser = await getUserByIdWithRoles(id)

    if (!targetUser) {
      return NextResponse.json(
        {
          success: false,
          error: {
            type: 'https://api.example.com/errors/not-found',
            title: 'Not Found',
            status: 404,
            detail: 'User not found',
          },
        },
        { status: 404 }
      )
    }

    // 4. 檢查城市編輯權限（USER_MANAGE / USER_MANAGE_CITY + 城市範圍）
    const targetUserCityId = targetUser.roles.find((r) => r.cityId)?.cityId ?? null
    const editPermission = checkCityEditPermission(session.user, targetUserCityId)

    if (!editPermission.hasPermission) {
      return NextResponse.json(
        {
          success: false,
          error: {
            type: 'https://api.example.com/errors/forbidden',
            title: 'Forbidden',
            status: 403,
            detail: editPermission.errorMessage || 'Permission denied',
          },
        },
        { status: 403 }
      )
    }

    // 5. 解析並驗證請求內容
    const body = await request.json()
    const validationResult = adminResetPasswordSchema.safeParse(body)

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

    // 6. 重設密碼（Azure AD 擋下 + 強度驗證於服務層）
    await adminResetPassword(
      id,
      validationResult.data.newPassword,
      session.user.id
    )

    return NextResponse.json({
      success: true,
      data: { message: 'Password reset successfully' },
    })
  } catch (error) {
    console.error('Reset user password error:', error)

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
          detail: 'Failed to reset password',
        },
      },
      { status: 500 }
    )
  }
}
