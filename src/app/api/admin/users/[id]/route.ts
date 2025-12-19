/**
 * @fileoverview 單一用戶管理 API 端點
 * @description
 *   提供單一用戶的 RESTful API 操作。
 *   需要認證和適當權限才能存取。
 *
 *   端點：
 *   - GET /api/admin/users/[id] - 獲取單一用戶詳情
 *   - PATCH /api/admin/users/[id] - 更新用戶資料
 *
 *   權限要求：
 *   - USER_VIEW 權限（查看用戶詳情）
 *   - USER_MANAGE 權限（更新用戶）
 *
 * @module src/app/api/admin/users/[id]/route
 * @author Development Team
 * @since Epic 1 - Story 1.5 (Modify User Role & City)
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
 *   - src/app/api/admin/users/route.ts - 用戶列表 API
 *   - src/services/user.service.ts - 用戶服務
 *   - src/lib/audit/logger.ts - 審計日誌
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getUserByIdWithRoles, updateUserWithRoles } from '@/services/user.service'
import { updateUserSchema } from '@/lib/validations/user.schema'
import { isAppError } from '@/lib/errors'
import {
  checkCityEditPermission,
  hasViewPermission,
} from '@/lib/auth/city-permission'

// ============================================================
// Types
// ============================================================

interface RouteParams {
  params: Promise<{ id: string }>
}

// ============================================================
// GET Handler
// ============================================================

/**
 * GET /api/admin/users/[id]
 * 獲取單一用戶詳情
 *
 * @description
 *   根據用戶 ID 獲取完整的用戶資料，包含角色和城市資訊。
 *   需要 USER_VIEW 權限。
 *
 * @param request - Next.js 請求物件
 * @param params - 路由參數，包含用戶 ID
 * @returns 用戶詳情資料
 *
 * @example
 *   GET /api/admin/users/cm5abcdef123456
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
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

    // 檢查權限：需要 USER_VIEW 或 USER_MANAGE 或 USER_MANAGE_CITY 權限
    if (!hasViewPermission(session.user)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            type: 'https://api.example.com/errors/forbidden',
            title: 'Forbidden',
            status: 403,
            detail: 'USER_VIEW permission required',
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

    // 獲取用戶詳情
    const user = await getUserByIdWithRoles(id)

    if (!user) {
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

    // City Manager 只能查看所屬城市的用戶
    const targetUserCityId = user.roles.find((r) => r.cityId)?.cityId ?? null
    const viewPermission = checkCityEditPermission(session.user, targetUserCityId)

    if (!viewPermission.hasPermission) {
      return NextResponse.json(
        {
          success: false,
          error: {
            type: 'https://api.example.com/errors/forbidden',
            title: 'Forbidden',
            status: 403,
            detail: viewPermission.errorMessage || 'Permission denied',
          },
        },
        { status: 403 }
      )
    }

    return NextResponse.json({
      success: true,
      data: user,
    })
  } catch (error) {
    console.error('Get user error:', error)

    return NextResponse.json(
      {
        success: false,
        error: {
          type: 'https://api.example.com/errors/internal-server-error',
          title: 'Internal Server Error',
          status: 500,
          detail: 'Failed to fetch user',
        },
      },
      { status: 500 }
    )
  }
}

// ============================================================
// PATCH Handler
// ============================================================

/**
 * PATCH /api/admin/users/[id]
 * 更新用戶資料
 *
 * @description
 *   更新指定用戶的資料，包含名稱、角色和城市。
 *   需要 USER_MANAGE 權限。
 *   所有變更都會記錄到審計日誌。
 *
 * @param request - Next.js 請求物件
 * @param params - 路由參數，包含用戶 ID
 *
 * @body name - 用戶名稱（可選）
 * @body roleIds - 角色 ID 列表（可選）
 * @body cityId - 城市 ID（可選，可為 null）
 *
 * @returns 更新後的用戶資料
 *
 * @example
 *   PATCH /api/admin/users/cm5abcdef123456
 *   {
 *     "name": "John Doe",
 *     "roleIds": ["role-id-1", "role-id-2"],
 *     "cityId": "city-id-1"
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

    // 獲取目標用戶以檢查城市權限
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

    // 檢查城市編輯權限
    // System Admin 可以編輯任何城市的用戶
    // City Manager 只能編輯所屬城市的用戶
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

    // 解析並驗證請求內容
    const body = await request.json()
    const validationResult = updateUserSchema.safeParse(body)

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

    // 檢查是否有任何需要更新的欄位
    const updateData = validationResult.data
    if (
      updateData.name === undefined &&
      updateData.roleIds === undefined &&
      updateData.cityId === undefined
    ) {
      return NextResponse.json(
        {
          success: false,
          error: {
            type: 'https://api.example.com/errors/validation',
            title: 'Validation Error',
            status: 400,
            detail: 'At least one field must be provided for update',
          },
        },
        { status: 400 }
      )
    }

    // City Manager 不能將用戶移到其他城市
    if (editPermission.scope === 'city' && updateData.cityId !== undefined) {
      // 如果要更新城市，必須是自己的城市或 null
      if (updateData.cityId !== null && updateData.cityId !== editPermission.cityId) {
        return NextResponse.json(
          {
            success: false,
            error: {
              type: 'https://api.example.com/errors/forbidden',
              title: 'Forbidden',
              status: 403,
              detail: '您只能在所屬城市管理用戶',
            },
          },
          { status: 403 }
        )
      }
    }

    // 更新用戶
    const updatedUser = await updateUserWithRoles(id, updateData, session.user.id)

    return NextResponse.json({
      success: true,
      data: updatedUser,
    })
  } catch (error) {
    console.error('Update user error:', error)

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
          detail: 'Failed to update user',
        },
      },
      { status: 500 }
    )
  }
}
