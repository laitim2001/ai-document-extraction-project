/**
 * @fileoverview 用戶單一區域存取權限操作 API（撤銷）
 * @description
 *   端點：
 *   - DELETE /api/admin/users/[id]/region-access/[regionCode]  - 撤銷指定區域存取權限
 *
 *   撤銷區域存取會連帶撤銷該區域內所有城市的存取權限；若用戶無其他區域權限，
 *   一併清除 isRegionalManager 標誌（由 RegionalManagerService 處理）。
 *
 *   權限要求：USER_MANAGE（全域）。被授予者需重新登入才生效。
 *
 * @module src/app/api/admin/users/[id]/region-access/[regionCode]/route
 * @author Development Team
 * @since CHANGE-090 - 城市/區域存取權限管理 UI/API
 * @lastModified 2026-06-24
 *
 * @related
 *   - src/services/regional-manager.service.ts - RegionalManagerService（revokeRegionalManagerRole）
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getUserByIdWithRoles } from '@/services/user.service'
import { RegionalManagerService } from '@/services/regional-manager.service'
import { hasPermission } from '@/lib/auth/city-permission'
import { PERMISSIONS } from '@/types/permissions'

interface RouteParams {
  params: Promise<{ id: string; regionCode: string }>
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
// DELETE Handler — 撤銷區域存取權限
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

    const { id, regionCode } = await params
    const targetUser = await getUserByIdWithRoles(id)
    if (!targetUser) {
      return errorResponse(404, 'not-found', 'Not Found', 'User not found')
    }

    await RegionalManagerService.revokeRegionalManagerRole({
      userId: id,
      regionCode,
      revokedBy: session.user.id,
    })

    const regions = await RegionalManagerService.getManagerRegions(id)
    return NextResponse.json({ success: true, data: regions })
  } catch (error) {
    console.error('Revoke region access error:', error)
    return errorResponse(500, 'internal-server-error', 'Internal Server Error', 'Failed to revoke region access')
  }
}
