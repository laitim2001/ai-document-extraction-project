/**
 * @fileoverview 用戶 Global Admin 切換 API
 * @description
 *   切換指定用戶的 globalAdmin 狀態（User.isGlobalAdmin）。globalAdmin 擁有
 *   全域資料存取（繞過城市/區域過濾），屬高權限操作。
 *
 *   端點：
 *   - PATCH /api/admin/users/[id]/global-admin  - body { isGlobalAdmin: boolean }
 *
 *   權限要求：**操作者本身必須是 globalAdmin**（與 GlobalAdminService 內部要求一致：
 *   只有 globalAdmin 能授予/撤銷 globalAdmin）。service 另含「不能撤銷自己」與
 *   「不能移除最後一位 globalAdmin」保護。被切換者需重新登入才生效。
 *
 * @module src/app/api/admin/users/[id]/global-admin/route
 * @author Development Team
 * @since CHANGE-090 - 城市/區域存取權限管理 UI/API（OQ-4 globalAdmin 切換）
 * @lastModified 2026-06-24
 *
 * @related
 *   - src/services/global-admin.service.ts - GlobalAdminService（grantGlobalAdminRole / revokeGlobalAdminRole）
 *   - src/lib/validations/city-region-access.schema.ts - 輸入驗證
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getUserByIdWithRoles } from '@/services/user.service'
import { GlobalAdminService, GlobalAdminError } from '@/services/global-admin.service'
import { setGlobalAdminSchema } from '@/lib/validations/city-region-access.schema'

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

/** GlobalAdminService 錯誤碼 → HTTP 狀態碼 */
function statusForGlobalAdminError(code: string): number {
  switch (code) {
    case 'PERMISSION_DENIED':
      return 403
    case 'USER_NOT_FOUND':
      return 404
    case 'SELF_REVOCATION_DENIED':
    case 'LAST_ADMIN_PROTECTION':
      return 409
    default:
      return 400
  }
}

// ============================================================
// PATCH Handler — 切換 globalAdmin
// ============================================================

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth()
    if (!session?.user) {
      return errorResponse(401, 'unauthorized', 'Unauthorized', 'Authentication required')
    }
    // 只有 globalAdmin 能授予/撤銷 globalAdmin（與 service 內部要求一致）
    if (!session.user.isGlobalAdmin) {
      return errorResponse(403, 'forbidden', 'Forbidden', 'Only global admins can change global admin status')
    }

    const { id } = await params
    const targetUser = await getUserByIdWithRoles(id)
    if (!targetUser) {
      return errorResponse(404, 'not-found', 'Not Found', 'User not found')
    }

    const body = await request.json()
    const parsed = setGlobalAdminSchema.safeParse(body)
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

    const result = parsed.data.isGlobalAdmin
      ? await GlobalAdminService.grantGlobalAdminRole(id, session.user.id)
      : await GlobalAdminService.revokeGlobalAdminRole(id, session.user.id)

    return NextResponse.json({ success: true, data: result })
  } catch (error) {
    if (error instanceof GlobalAdminError) {
      const status = statusForGlobalAdminError(error.code)
      return errorResponse(status, 'global-admin-error', 'Global Admin Error', error.message)
    }
    console.error('Toggle global admin error:', error)
    return errorResponse(500, 'internal-server-error', 'Internal Server Error', 'Failed to change global admin status')
  }
}
