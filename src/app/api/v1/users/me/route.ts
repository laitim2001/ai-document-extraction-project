/**
 * @fileoverview 當前用戶個人資料 API
 * @description
 *   管理當前登入用戶的個人資訊。
 *   提供 GET（取得完整資料含角色/權限）和 PATCH（更新顯示名稱）端點。
 *
 * @module src/app/api/v1/users/me
 * @author Development Team
 * @since CHANGE-049 - User Profile Page
 * @lastModified 2026-02-26
 *
 * @api
 *   - GET /api/v1/users/me - 取得當前用戶完整資料
 *   - PATCH /api/v1/users/me - 更新當前用戶顯示名稱
 *
 * @related
 *   - src/hooks/use-profile.ts - 前端 Hook
 *   - src/app/[locale]/(dashboard)/profile/ - Profile 頁面
 *   - src/services/user.service.ts - 用戶服務
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// ============================================================
// Validation Schema
// ============================================================

/**
 * 用戶資料更新驗證 Schema
 * 目前僅允許修改 displayName（即 name 欄位）
 */
const UpdateProfileSchema = z.object({
  name: z
    .string()
    .min(1, 'Name must be at least 1 character')
    .max(255, 'Name must be at most 255 characters'),
})

// ============================================================
// API Handlers
// ============================================================

/**
 * GET /api/v1/users/me
 * 取得當前登入用戶的完整資料（含角色、城市、權限）
 *
 * @returns 用戶完整資料
 *
 * @example Response (Success)
 * ```json
 * {
 *   "success": true,
 *   "data": {
 *     "id": "...",
 *     "email": "john@example.com",
 *     "name": "John Doe",
 *     "provider": "azure-ad",
 *     "roles": [{ "id": "...", "name": "System Admin", "description": "..." }],
 *     "cities": [{ "id": "...", "name": "Hong Kong", "code": "HK" }],
 *     "permissions": ["user:view", "user:manage"],
 *     "locale": "en",
 *     "createdAt": "2026-01-15T00:00:00Z",
 *     "lastLoginAt": "2026-02-26T10:30:00Z"
 *   }
 * }
 * ```
 */
export async function GET() {
  try {
    // 1. 驗證認證
    const session = await auth()
    if (!session?.user?.id) {
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

    // 2. 查詢完整用戶資料（含角色、城市）
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: {
        roles: {
          include: {
            role: true,
            city: true,
          },
        },
      },
    })

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

    // 3. 整理角色和權限
    const roles = user.roles.map((ur) => ({
      id: ur.role.id,
      name: ur.role.name,
      description: ur.role.description,
      cityId: ur.city?.id ?? null,
      cityName: ur.city?.name ?? null,
      cityCode: ur.city?.code ?? null,
    }))

    const cities = user.roles
      .filter((ur) => ur.city)
      .map((ur) => ({
        id: ur.city!.id,
        name: ur.city!.name,
        code: ur.city!.code,
      }))
      .filter(
        (city, index, arr) => arr.findIndex((c) => c.id === city.id) === index
      )

    // Role.permissions 是 String[] 欄位
    const permissions = [
      ...new Set(user.roles.flatMap((ur) => ur.role.permissions)),
    ]

    // 4. 返回結果
    return NextResponse.json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        name: user.name,
        image: user.image,
        provider: user.azureAdId ? 'azure-ad' : 'local',
        status: user.status,
        roles,
        cities,
        permissions,
        locale: user.preferredLocale || 'en',
        createdAt: user.createdAt.toISOString(),
        lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
      },
    })
  } catch (error) {
    console.error('Failed to get user profile:', error)
    return NextResponse.json(
      {
        success: false,
        error: {
          type: 'https://api.example.com/errors/internal',
          title: 'Internal Server Error',
          status: 500,
          detail: 'Failed to get user profile',
        },
      },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/v1/users/me
 * 更新當前用戶的顯示名稱
 *
 * @param request - Next.js Request 物件
 * @returns 更新後的用戶資料
 *
 * @example Request
 * ```json
 * { "name": "New Display Name" }
 * ```
 */
export async function PATCH(request: NextRequest) {
  try {
    // 1. 驗證認證
    const session = await auth()
    if (!session?.user?.id) {
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

    // 2. 解析和驗證請求
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: {
            type: 'https://api.example.com/errors/invalid-json',
            title: 'Invalid JSON',
            status: 400,
            detail: 'Request body must be valid JSON',
          },
        },
        { status: 400 }
      )
    }

    const validationResult = UpdateProfileSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            type: 'https://api.example.com/errors/validation',
            title: 'Validation Error',
            status: 400,
            detail: 'Invalid input data',
            errors: validationResult.error.flatten().fieldErrors,
          },
        },
        { status: 400 }
      )
    }

    const { name } = validationResult.data

    // 3. 更新資料庫
    const updatedUser = await prisma.user.update({
      where: { id: session.user.id },
      select: {
        id: true,
        name: true,
        email: true,
      },
    data: { name },
    })

    // 4. 返回成功
    return NextResponse.json({
      success: true,
      data: {
        id: updatedUser.id,
        name: updatedUser.name,
        email: updatedUser.email,
      },
    })
  } catch (error) {
    console.error('Failed to update user profile:', error)
    return NextResponse.json(
      {
        success: false,
        error: {
          type: 'https://api.example.com/errors/internal',
          title: 'Internal Server Error',
          status: 500,
          detail: 'Failed to update user profile',
        },
      },
      { status: 500 }
    )
  }
}
