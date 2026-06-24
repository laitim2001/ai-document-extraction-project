/**
 * @fileoverview 用戶區域存取權限管理 API（列出 / 授予）
 * @description
 *   管理單一用戶的「區域資料存取權限」（UserRegionAccess）。授予區域存取會
 *   連帶授予該區域內所有城市的存取權限（由 RegionalManagerService 處理），
 *   適合一次給予整個區域（如 APAC）的資料存取。
 *
 *   端點：
 *   - GET    /api/admin/users/[id]/region-access  - 列出該用戶所有區域存取權限
 *   - POST   /api/admin/users/[id]/region-access  - 授予區域存取權限
 *
 *   權限要求：USER_MANAGE（全域）。被授予者需重新登入才生效。
 *
 * @module src/app/api/admin/users/[id]/region-access/route
 * @author Development Team
 * @since CHANGE-090 - 城市/區域存取權限管理 UI/API
 * @lastModified 2026-06-24
 *
 * @related
 *   - src/services/regional-manager.service.ts - RegionalManagerService（grantRegionAccess / getManagerRegions）
 *   - src/lib/validations/city-region-access.schema.ts - 輸入驗證
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getUserByIdWithRoles } from '@/services/user.service'
import { RegionalManagerService } from '@/services/regional-manager.service'
import { hasPermission } from '@/lib/auth/city-permission'
import { PERMISSIONS } from '@/types/permissions'
import { grantRegionAccessSchema } from '@/lib/validations/city-region-access.schema'

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
// GET Handler — 列出用戶區域存取權限
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

    const regions = await RegionalManagerService.getManagerRegions(id)
    return NextResponse.json({ success: true, data: regions })
  } catch (error) {
    console.error('List region access error:', error)
    return errorResponse(500, 'internal-server-error', 'Internal Server Error', 'Failed to list region access')
  }
}

// ============================================================
// POST Handler — 授予區域存取權限
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
    const parsed = grantRegionAccessSchema.safeParse(body)
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

    const { regionCode, accessLevel, expiresAt, reason } = parsed.data

    await RegionalManagerService.grantRegionAccess({
      userId: id,
      regionCode,
      grantedBy: session.user.id,
      accessLevel,
      expiresAt: expiresAt ?? undefined,
      reason,
    })

    const regions = await RegionalManagerService.getManagerRegions(id)
    return NextResponse.json({ success: true, data: regions }, { status: 201 })
  } catch (error) {
    console.error('Grant region access error:', error)
    // service 對不存在的區域會 throw Error(`Region not found: ...`)
    if (error instanceof Error && error.message.startsWith('Region not found')) {
      return errorResponse(404, 'not-found', 'Not Found', error.message)
    }
    return errorResponse(500, 'internal-server-error', 'Internal Server Error', 'Failed to grant region access')
  }
}
