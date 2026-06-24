/**
 * @fileoverview 用戶城市存取權限管理 API（列出 / 授予）
 * @description
 *   管理單一用戶的「城市資料存取權限」（UserCityAccess）——即決定該用戶登入後
 *   能查看哪些城市業務資料、解除 withCityFilter 的 403。
 *
 *   端點：
 *   - GET    /api/admin/users/[id]/city-access  - 列出該用戶所有城市存取權限
 *   - POST   /api/admin/users/[id]/city-access  - 授予城市存取權限
 *
 *   權限要求：USER_MANAGE（全域）。城市資料存取屬敏感權限，City Manager scope
 *   授權列為未來增強，本階段僅全域管理者可操作（避免越權授權的權限提升風險）。
 *
 *   ⚠️ 被授予者需「重新登入」才生效（cityCodes 存於 JWT/session，見 auth.ts jwt callback）。
 *
 * @module src/app/api/admin/users/[id]/city-access/route
 * @author Development Team
 * @since CHANGE-090 - 城市/區域存取權限管理 UI/API
 * @lastModified 2026-06-24
 *
 * @related
 *   - src/services/city-access.service.ts - CityAccessService（grantAccess / getUserCityAccesses）
 *   - src/lib/validations/city-region-access.schema.ts - 輸入驗證
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getUserByIdWithRoles } from '@/services/user.service'
import { CityAccessService } from '@/services/city-access.service'
import { hasPermission } from '@/lib/auth/city-permission'
import { PERMISSIONS } from '@/types/permissions'
import { grantCityAccessSchema } from '@/lib/validations/city-region-access.schema'

interface RouteParams {
  params: Promise<{ id: string }>
}

/** 建立 RFC 7807 風格錯誤回應（沿用 admin/users 既有 nested 格式） */
function errorResponse(status: number, slug: string, title: string, detail: string) {
  return NextResponse.json(
    {
      success: false,
      error: {
        type: `https://api.example.com/errors/${slug}`,
        title,
        status,
        detail,
      },
    },
    { status }
  )
}

// ============================================================
// GET Handler — 列出用戶城市存取權限
// ============================================================

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth()
    if (!session?.user) {
      return errorResponse(401, 'unauthorized', 'Unauthorized', 'Authentication required')
    }
    if (!hasPermission(session.user, PERMISSIONS.USER_MANAGE)) {
      return errorResponse(403, 'forbidden', 'Forbidden', 'USER_MANAGE permission required')
    }

    const { id } = await params
    const targetUser = await getUserByIdWithRoles(id)
    if (!targetUser) {
      return errorResponse(404, 'not-found', 'Not Found', 'User not found')
    }

    const accesses = await CityAccessService.getUserCityAccesses(id)
    return NextResponse.json({ success: true, data: accesses })
  } catch (error) {
    console.error('List city access error:', error)
    return errorResponse(500, 'internal-server-error', 'Internal Server Error', 'Failed to list city access')
  }
}

// ============================================================
// POST Handler — 授予城市存取權限
// ============================================================

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth()
    if (!session?.user) {
      return errorResponse(401, 'unauthorized', 'Unauthorized', 'Authentication required')
    }
    if (!hasPermission(session.user, PERMISSIONS.USER_MANAGE)) {
      return errorResponse(403, 'forbidden', 'Forbidden', 'USER_MANAGE permission required')
    }

    const { id } = await params
    const targetUser = await getUserByIdWithRoles(id)
    if (!targetUser) {
      return errorResponse(404, 'not-found', 'Not Found', 'User not found')
    }

    const body = await request.json()
    const parsed = grantCityAccessSchema.safeParse(body)
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]
      return NextResponse.json(
        {
          success: false,
          error: {
            type: 'https://api.example.com/errors/validation',
            title: 'Validation Error',
            status: 400,
            detail: firstError.message,
            errors: parsed.error.issues.map((issue) => ({
              field: issue.path.join('.'),
              message: issue.message,
            })),
          },
        },
        { status: 400 }
      )
    }

    const { cityCode, isPrimary, accessLevel, expiresAt, reason } = parsed.data

    await CityAccessService.grantAccess({
      userId: id,
      cityCode,
      grantedBy: session.user.id,
      accessLevel,
      isPrimary,
      expiresAt: expiresAt ?? undefined,
      reason,
    })

    const accesses = await CityAccessService.getUserCityAccesses(id)
    return NextResponse.json({ success: true, data: accesses }, { status: 201 })
  } catch (error) {
    console.error('Grant city access error:', error)
    // service 對不存在的城市會 throw Error(`City not found: ...`)
    if (error instanceof Error && error.message.startsWith('City not found')) {
      return errorResponse(404, 'not-found', 'Not Found', error.message)
    }
    return errorResponse(500, 'internal-server-error', 'Internal Server Error', 'Failed to grant city access')
  }
}
