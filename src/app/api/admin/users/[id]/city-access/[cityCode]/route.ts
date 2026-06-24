/**
 * @fileoverview 用戶單一城市存取權限操作 API（撤銷 / 設為主要）
 * @description
 *   端點：
 *   - DELETE /api/admin/users/[id]/city-access/[cityCode]  - 撤銷指定城市存取權限
 *   - PATCH  /api/admin/users/[id]/city-access/[cityCode]  - 將指定城市設為主要城市
 *
 *   權限要求：USER_MANAGE（全域）。被授予者需重新登入才生效。
 *
 * @module src/app/api/admin/users/[id]/city-access/[cityCode]/route
 * @author Development Team
 * @since CHANGE-090 - 城市/區域存取權限管理 UI/API
 * @lastModified 2026-06-24
 *
 * @related
 *   - src/services/city-access.service.ts - CityAccessService（revokeAccess / setPrimaryCity）
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getUserByIdWithRoles } from '@/services/user.service'
import { CityAccessService } from '@/services/city-access.service'
import { hasPermission } from '@/lib/auth/city-permission'
import { PERMISSIONS } from '@/types/permissions'

interface RouteParams {
  params: Promise<{ id: string; cityCode: string }>
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
// DELETE Handler — 撤銷城市存取權限
// ============================================================

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth()
    if (!session?.user) {
      return errorResponse(401, 'unauthorized', 'Unauthorized', 'Authentication required')
    }
    if (!hasPermission(session.user, PERMISSIONS.USER_MANAGE)) {
      return errorResponse(403, 'forbidden', 'Forbidden', 'USER_MANAGE permission required')
    }

    const { id, cityCode } = await params
    const targetUser = await getUserByIdWithRoles(id)
    if (!targetUser) {
      return errorResponse(404, 'not-found', 'Not Found', 'User not found')
    }

    await CityAccessService.revokeAccess({
      userId: id,
      cityCode,
      revokedBy: session.user.id,
    })

    const accesses = await CityAccessService.getUserCityAccesses(id)
    return NextResponse.json({ success: true, data: accesses })
  } catch (error) {
    console.error('Revoke city access error:', error)
    return errorResponse(500, 'internal-server-error', 'Internal Server Error', 'Failed to revoke city access')
  }
}

// ============================================================
// PATCH Handler — 設為主要城市
// ============================================================

export async function PATCH(_request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth()
    if (!session?.user) {
      return errorResponse(401, 'unauthorized', 'Unauthorized', 'Authentication required')
    }
    if (!hasPermission(session.user, PERMISSIONS.USER_MANAGE)) {
      return errorResponse(403, 'forbidden', 'Forbidden', 'USER_MANAGE permission required')
    }

    const { id, cityCode } = await params
    const targetUser = await getUserByIdWithRoles(id)
    if (!targetUser) {
      return errorResponse(404, 'not-found', 'Not Found', 'User not found')
    }

    await CityAccessService.setPrimaryCity(id, cityCode)

    const accesses = await CityAccessService.getUserCityAccesses(id)
    return NextResponse.json({ success: true, data: accesses })
  } catch (error) {
    console.error('Set primary city error:', error)
    if (error instanceof Error && error.message.startsWith('City not found')) {
      return errorResponse(404, 'not-found', 'Not Found', error.message)
    }
    return errorResponse(500, 'internal-server-error', 'Internal Server Error', 'Failed to set primary city')
  }
}
