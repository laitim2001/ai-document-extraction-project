/**
 * @fileoverview 角色 API 端點
 * @description
 *   提供角色相關的 RESTful API。
 *   需要認證和適當的權限才能存取。
 *
 *   端點：
 *   - GET /api/roles - 獲取所有角色列表
 *
 *   權限要求：
 *   - USER_MANAGE 或 SYSTEM_CONFIG 權限
 *
 * @module src/app/api/roles/route
 * @author Development Team
 * @since Epic 1 - Story 1.2 (User Database & Role Foundation)
 * @lastModified 2025-12-18
 *
 * @dependencies
 *   - next/server - Next.js API 處理
 *   - @/lib/auth - NextAuth 認證
 *   - @/services - 服務層
 *   - @/types/permissions - 權限常量
 */

import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getAllRoles, getRolesWithUserCount } from '@/services/role.service'
import { PERMISSIONS } from '@/types/permissions'

/**
 * GET /api/roles
 * 獲取所有角色列表
 *
 * @query includeCount - 是否包含用戶數量統計 (true/false)
 *
 * @returns 角色列表
 *
 * @example
 *   GET /api/roles
 *   GET /api/roles?includeCount=true
 */
export async function GET(request: Request) {
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

    // 檢查權限：需要 USER_VIEW、USER_MANAGE 或 SYSTEM_CONFIG 權限（支援 wildcard）
    const hasPermission = session.user.roles?.some(
      (role) =>
        role.permissions.includes('*') ||
        role.permissions.includes(PERMISSIONS.USER_VIEW) ||
        role.permissions.includes(PERMISSIONS.USER_MANAGE) ||
        role.permissions.includes(PERMISSIONS.SYSTEM_CONFIG)
    )

    if (!hasPermission) {
      return NextResponse.json(
        {
          success: false,
          error: {
            type: 'https://api.example.com/errors/forbidden',
            title: 'Forbidden',
            status: 403,
            detail: 'Insufficient permissions to view roles',
          },
        },
        { status: 403 }
      )
    }

    // 解析查詢參數
    const { searchParams } = new URL(request.url)
    const includeCount = searchParams.get('includeCount') === 'true'

    // 獲取角色列表
    const roles = includeCount
      ? await getRolesWithUserCount()
      : await getAllRoles()

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
