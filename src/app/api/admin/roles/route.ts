/**
 * @fileoverview 角色管理 API 端點
 * @description
 *   提供角色管理相關的 RESTful API。
 *   需要認證和適當權限才能存取。
 *
 *   端點：
 *   - GET /api/admin/roles - 獲取角色列表
 *   - POST /api/admin/roles - 創建新角色
 *
 *   權限要求：
 *   - USER_VIEW 權限（查看角色列表）
 *   - USER_MANAGE 權限（創建角色）
 *
 * @module src/app/api/admin/roles/route
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
import { getRolesWithUserCount, createRole } from '@/services/role.service'
import { PERMISSIONS } from '@/types/permissions'
import { createRoleSchema } from '@/lib/validations/role.schema'
import { isAppError } from '@/lib/errors'

/**
 * GET /api/admin/roles
 * 獲取角色列表（含用戶數量統計）
 *
 * @returns 角色列表
 *
 * @example
 *   GET /api/admin/roles
 */
export async function GET() {
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

    // 檢查權限：需要 USER_VIEW 權限（支援 wildcard）
    const hasPermission = session.user.roles?.some((role) =>
      role.permissions.includes('*') || role.permissions.includes(PERMISSIONS.USER_VIEW)
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

    // 獲取角色列表
    const roles = await getRolesWithUserCount()

    return NextResponse.json({
      success: true,
      data: roles,
    })
  } catch (error) {
    console.error('Get roles error:', error)

    return NextResponse.json(
      {
        success: false,
        error: {
          type: 'https://api.example.com/errors/internal-server-error',
          title: 'Internal Server Error',
          status: 500,
          detail: 'Failed to fetch roles',
        },
      },
      { status: 500 }
    )
  }
}

/**
 * POST /api/admin/roles
 * 創建新角色
 *
 * @description
 *   創建自訂角色。
 *   需要 USER_MANAGE 權限。
 *   系統角色無法透過 API 創建（只能透過 seed）。
 *
 * @body name - 角色名稱
 * @body description - 角色描述（可選）
 * @body permissions - 權限列表
 *
 * @returns 創建的角色資料
 *
 * @example
 *   POST /api/admin/roles
 *   {
 *     "name": "Custom Role",
 *     "description": "A custom role description",
 *     "permissions": ["invoice:view", "report:view"]
 *   }
 */
export async function POST(request: NextRequest) {
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

    // 解析並驗證請求內容
    const body = await request.json()
    const validationResult = createRoleSchema.safeParse(body)

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

    // 創建角色
    const role = await createRole(validationResult.data)

    return NextResponse.json(
      {
        success: true,
        data: role,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Create role error:', error)

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
          detail: 'Failed to create role',
        },
      },
      { status: 500 }
    )
  }
}
