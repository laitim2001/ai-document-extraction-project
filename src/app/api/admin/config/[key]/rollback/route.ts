'use server'

/**
 * @fileoverview 配置回滾 API
 * @description
 *   提供配置回滾功能：
 *   - 將配置回滾到指定歷史版本
 *   - 記錄回滾操作到歷史
 *   - 僅限全局管理者訪問
 *
 * @module src/app/api/admin/config/[key]/rollback
 * @author Development Team
 * @since Epic 6 - Story 6.4 (Global Admin Full Access)
 * @lastModified 2025-12-19
 *
 * @features
 *   - 配置版本回滾
 *   - 回滾原因記錄
 *   - 審計追蹤
 *
 * @dependencies
 *   - @/lib/auth - 認證服務
 *   - @/services/system-config.service - 配置服務
 *   - zod - 請求驗證
 *
 * @related
 *   - src/app/api/admin/config/[key]/history/route.ts - 歷史 API
 *   - src/app/api/admin/config/[key]/route.ts - 單一配置 API
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { SystemConfigService, SystemConfigError } from '@/services/system-config.service'
import { z } from 'zod'

// ============================================================
// Validation Schema
// ============================================================

const rollbackSchema = z.object({
  targetVersion: z.number().int().positive(),
  reason: z.string().min(1).max(500),
})

// ============================================================
// Route Handler
// ============================================================

/**
 * POST /api/admin/config/[key]/rollback
 *
 * @description
 *   將配置回滾到指定的歷史版本。
 *   回滾操作本身也會記錄到歷史中。
 *   僅限全局管理者訪問。
 *
 * @params
 *   - key: 配置鍵
 *
 * @body
 *   - targetVersion: 目標版本號（必填）
 *   - reason: 回滾原因（必填）
 *
 * @returns 回滾成功訊息
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
): Promise<NextResponse> {
  // --- 認證檢查 ---
  const session = await auth()

  if (!session?.user) {
    return NextResponse.json(
      {
        type: 'https://api.example.com/errors/unauthorized',
        title: 'Unauthorized',
        status: 401,
        detail: 'Authentication required',
      },
      { status: 401 }
    )
  }

  if (!session.user.isGlobalAdmin) {
    return NextResponse.json(
      {
        type: 'https://api.example.com/errors/forbidden',
        title: 'Forbidden',
        status: 403,
        detail: 'Global admin access required',
      },
      { status: 403 }
    )
  }

  // --- 獲取配置鍵 ---
  const { key } = await params
  const decodedKey = decodeURIComponent(key)

  // --- 解析請求體 ---
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      {
        type: 'https://api.example.com/errors/validation',
        title: 'Invalid JSON',
        status: 400,
        detail: 'Request body must be valid JSON',
      },
      { status: 400 }
    )
  }

  const validation = rollbackSchema.safeParse(body)

  if (!validation.success) {
    return NextResponse.json(
      {
        type: 'https://api.example.com/errors/validation',
        title: 'Validation Error',
        status: 400,
        detail: 'Invalid request data',
        errors: validation.error.flatten().fieldErrors,
      },
      { status: 400 }
    )
  }

  const { targetVersion, reason } = validation.data

  try {
    await SystemConfigService.rollback({
      key: decodedKey,
      targetVersion,
      rolledBackBy: session.user.id,
      reason,
    })

    return NextResponse.json({
      success: true,
      message: `Configuration rolled back to version ${targetVersion}`,
    })
  } catch (error) {
    if (error instanceof SystemConfigError) {
      if (error.code === 'CONFIG_NOT_FOUND') {
        return NextResponse.json(
          {
            type: 'https://api.example.com/errors/not-found',
            title: 'Not Found',
            status: 404,
            detail: error.message,
          },
          { status: 404 }
        )
      }

      if (error.code === 'VERSION_NOT_FOUND') {
        return NextResponse.json(
          {
            type: 'https://api.example.com/errors/not-found',
            title: 'Version Not Found',
            status: 404,
            detail: error.message,
          },
          { status: 404 }
        )
      }
    }

    console.error('[Admin Config Rollback API] Error:', error)

    return NextResponse.json(
      {
        type: 'https://api.example.com/errors/internal',
        title: 'Internal Server Error',
        status: 500,
        detail: 'Failed to rollback configuration',
      },
      { status: 500 }
    )
  }
}
