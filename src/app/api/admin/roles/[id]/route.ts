/**
 * @fileoverview 單一角色管理 API 端點
 * @description
 *   提供單一角色的 RESTful API 操作。
 *   需要認證和適當權限才能存取。
 *
 *   端點：
 *   - GET /api/admin/roles/[id] - 獲取單一角色詳情
 *   - PATCH /api/admin/roles/[id] - 更新角色
 *   - DELETE /api/admin/roles/[id] - 刪除角色
 *
 *   權限要求：
 *   - USER_VIEW 權限（查看角色）
 *   - USER_MANAGE 權限（更新、刪除角色）
 *
 *   保護機制：
 *   - 系統角色（isSystem = true）無法被修改或刪除
 *   - 有用戶分配的角色無法刪除
 *
 * @module src/app/api/admin/roles/[id]/route
 * @author Development Team
 * @since Epic 1 - Story 1.7 (Custom Role Management)
 * @lastModified 2025-12-18
 *
 * @dependencies
 *   - next/server - Next.js API 處理
 *   - @/lib/auth - NextAuth 認證
 *   - @/services/role.service - 角色服務
 *   - @/types/permissions - 權限常量
 *   - @/lib/validations/role.schema - Zod 驗證 Schema
 *   - @/lib/errors - 錯誤處理
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import {
  getRoleWithUserCount,
  updateRole,
  deleteRole,
} from '@/services/role.service'
import { PERMISSIONS } from '@/types/permissions'
import { updateRoleSchema, roleIdParamSchema } from '@/lib/validations/role.schema'
import { isAppError } from '@/lib/errors'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * GET /api/admin/roles/[id]
 * 獲取單一角色詳情（含用戶數量）
 *
 * @param params.id - 角色 ID
 * @returns 角色詳情
 *
 * @example
 *   GET /api/admin/roles/clxxxxx
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params

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

    // 檢查權限：需要 USER_VIEW 權限
    const hasPermission = session.user.roles?.some((role) =>
      role.permissions.includes(PERMISSIONS.USER_VIEW)
    )

    if (!hasPermission) {
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

    // 驗證 ID 格式
    const idValidation = roleIdParamSchema.safeParse({ id })
    if (!idValidation.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            type: 'https://api.example.com/errors/validation',
            title: 'Validation Error',
            status: 400,
            detail: 'Invalid role ID format',
          },
        },
        { status: 400 }
      )
    }

    // 獲取角色
    const role = await getRoleWithUserCount(id)

    if (!role) {
      return NextResponse.json(
        {
          success: false,
          error: {
            type: 'https://api.example.com/errors/not-found',
            title: 'Not Found',
            status: 404,
            detail: `Role with ID ${id} not found`,
          },
        },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: role,
    })
  } catch (error) {
    console.error('Get role error:', error)

    return NextResponse.json(
      {
        success: false,
        error: {
          type: 'https://api.example.com/errors/internal-server-error',
          title: 'Internal Server Error',
          status: 500,
          detail: 'Failed to fetch role',
        },
      },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/admin/roles/[id]
 * 更新角色
 *
 * @description
 *   更新自訂角色的名稱、描述和權限。
 *   系統角色無法被修改。
 *
 * @param params.id - 角色 ID
 * @body name - 角色名稱（可選）
 * @body description - 角色描述（可選）
 * @body permissions - 權限列表（可選）
 *
 * @returns 更新後的角色資料
 *
 * @example
 *   PATCH /api/admin/roles/clxxxxx
 *   {
 *     "name": "Updated Role Name",
 *     "permissions": ["invoice:view", "report:view", "report:export"]
 *   }
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params

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

    // 檢查權限：需要 USER_MANAGE 權限
    const hasPermission = session.user.roles?.some((role) =>
      role.permissions.includes(PERMISSIONS.USER_MANAGE)
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

    // 驗證 ID 格式
    const idValidation = roleIdParamSchema.safeParse({ id })
    if (!idValidation.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            type: 'https://api.example.com/errors/validation',
            title: 'Validation Error',
            status: 400,
            detail: 'Invalid role ID format',
          },
        },
        { status: 400 }
      )
    }

    // 解析並驗證請求內容
    const body = await request.json()
    const validationResult = updateRoleSchema.safeParse(body)

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

    // 更新角色
    const role = await updateRole(id, validationResult.data)

    return NextResponse.json({
      success: true,
      data: role,
    })
  } catch (error) {
    console.error('Update role error:', error)

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
          detail: 'Failed to update role',
        },
      },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/admin/roles/[id]
 * 刪除角色
 *
 * @description
 *   刪除自訂角色。
 *   - 系統角色無法刪除
 *   - 有用戶分配的角色無法刪除
 *
 * @param params.id - 角色 ID
 *
 * @returns 成功訊息
 *
 * @example
 *   DELETE /api/admin/roles/clxxxxx
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params

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

    // 檢查權限：需要 USER_MANAGE 權限
    const hasPermission = session.user.roles?.some((role) =>
      role.permissions.includes(PERMISSIONS.USER_MANAGE)
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

    // 驗證 ID 格式
    const idValidation = roleIdParamSchema.safeParse({ id })
    if (!idValidation.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            type: 'https://api.example.com/errors/validation',
            title: 'Validation Error',
            status: 400,
            detail: 'Invalid role ID format',
          },
        },
        { status: 400 }
      )
    }

    // 刪除角色
    await deleteRole(id)

    return NextResponse.json({
      success: true,
      data: { message: 'Role deleted successfully' },
    })
  } catch (error) {
    console.error('Delete role error:', error)

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
          detail: 'Failed to delete role',
        },
      },
      { status: 500 }
    )
  }
}
