/**
 * @fileoverview 用戶管理 API 端點
 * @description
 *   提供用戶管理相關的 RESTful API。
 *   需要認證和適當權限才能存取。
 *
 *   端點：
 *   - GET /api/admin/users - 獲取用戶列表（分頁、搜尋、篩選）
 *   - POST /api/admin/users - 創建新用戶
 *
 *   權限要求：
 *   - USER_VIEW 權限（查看用戶列表）
 *   - USER_MANAGE 權限（創建用戶）
 *
 * @module src/app/api/admin/users/route
 * @author Development Team
 * @since Epic 1 - Story 1.3 (User List & Search)
 * @lastModified 2025-12-18
 *
 * @dependencies
 *   - next/server - Next.js API 處理
 *   - @/lib/auth - NextAuth 認證
 *   - @/services - 服務層
 *   - @/types/permissions - 權限常量
 *   - @/lib/validations - Zod 驗證 Schema
 *   - @/lib/errors - 錯誤處理
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getUsers, createUser, type GetUsersParams } from '@/services/user.service'
import { createUserSchema } from '@/lib/validations/user.schema'
import { isAppError } from '@/lib/errors'
import type { UserStatus } from '@prisma/client'
import {
  checkCityCreatePermission,
  getCityFilter,
  hasViewPermission,
} from '@/lib/auth/city-permission'

/**
 * GET /api/admin/users
 * 獲取用戶列表（支援分頁、搜尋、篩選）
 *
 * @query page - 頁碼（從 1 開始，預設 1）
 * @query pageSize - 每頁數量（預設 20，最大 100）
 * @query search - 搜尋關鍵字（名稱或電子郵件）
 * @query roleId - 角色 ID 篩選
 * @query cityId - 城市 ID 篩選
 * @query status - 狀態篩選（ACTIVE, INACTIVE, SUSPENDED）
 * @query sortBy - 排序欄位（name, email, createdAt, lastLoginAt）
 * @query sortOrder - 排序方向（asc, desc）
 *
 * @returns 用戶列表和分頁資訊
 *
 * @example
 *   GET /api/admin/users?page=1&pageSize=20
 *   GET /api/admin/users?search=john&status=ACTIVE
 *   GET /api/admin/users?roleId=xxx&cityId=yyy
 */
export async function GET(request: NextRequest) {
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

    // 獲取城市過濾條件（City Manager 只能看到所屬城市的用戶）
    const cityFilter = getCityFilter(session.user)

    // 解析查詢參數
    const { searchParams } = new URL(request.url)
    // City Manager 強制使用其城市過濾，不允許查詢其他城市
    const requestedCityId = searchParams.get('cityId') || undefined
    const effectiveCityId = cityFilter ?? requestedCityId

    const params: GetUsersParams = {
      page: parseInt(searchParams.get('page') || '1', 10),
      pageSize: parseInt(searchParams.get('pageSize') || '20', 10),
      search: searchParams.get('search') || undefined,
      roleId: searchParams.get('roleId') || undefined,
      cityId: effectiveCityId,
      status: (searchParams.get('status') as UserStatus) || undefined,
      sortBy:
        (searchParams.get('sortBy') as GetUsersParams['sortBy']) || 'createdAt',
      sortOrder:
        (searchParams.get('sortOrder') as GetUsersParams['sortOrder']) ||
        'desc',
    }

    // 參數驗證和標準化
    if (params.page < 1) params.page = 1
    if (params.pageSize < 1 || params.pageSize > 100) params.pageSize = 20

    // 驗證 status 值
    if (
      params.status &&
      !['ACTIVE', 'INACTIVE', 'SUSPENDED'].includes(params.status)
    ) {
      params.status = undefined
    }

    // 獲取用戶列表
    const result = await getUsers(params)

    return NextResponse.json({
      success: true,
      data: result.data,
      meta: result.meta,
    })
  } catch (error) {
    console.error('Get users error:', error)

    return NextResponse.json(
      {
        success: false,
        error: {
          type: 'https://api.example.com/errors/internal-server-error',
          title: 'Internal Server Error',
          status: 500,
          detail: 'Failed to fetch users',
        },
      },
      { status: 500 }
    )
  }
}

/**
 * POST /api/admin/users
 * 創建新用戶
 *
 * @description
 *   由系統管理員手動創建用戶帳號。
 *   需要 USER_MANAGE 權限。
 *
 * @body email - 電子郵件（必須與 Azure AD 帳號一致）
 * @body name - 用戶名稱
 * @body roleIds - 角色 ID 列表
 * @body cityId - 城市 ID（可選）
 *
 * @returns 創建的用戶資料
 *
 * @since Story 1.4
 *
 * @example
 *   POST /api/admin/users
 *   {
 *     "email": "user@example.com",
 *     "name": "John Doe",
 *     "roleIds": ["role-id-1"],
 *     "cityId": "city-id-1"
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

    // 解析並驗證請求內容
    const body = await request.json()
    const validationResult = createUserSchema.safeParse(body)

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

    // 檢查城市創建權限
    // System Admin 可以在任何城市創建用戶
    // City Manager 只能在所屬城市創建用戶
    const cityPermission = checkCityCreatePermission(
      session.user,
      validationResult.data.cityId
    )

    if (!cityPermission.hasPermission) {
      return NextResponse.json(
        {
          success: false,
          error: {
            type: 'https://api.example.com/errors/forbidden',
            title: 'Forbidden',
            status: 403,
            detail: cityPermission.errorMessage || 'Permission denied',
          },
        },
        { status: 403 }
      )
    }

    // 如果是 City Manager 且沒有指定城市，自動使用其城市
    const createData = { ...validationResult.data }
    if (cityPermission.scope === 'city' && !createData.cityId) {
      createData.cityId = cityPermission.cityId
    }

    // 創建用戶
    const user = await createUser(createData, session.user.id)

    return NextResponse.json(
      {
        success: true,
        data: user,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Create user error:', error)

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
          detail: 'Failed to create user',
        },
      },
      { status: 500 }
    )
  }
}
