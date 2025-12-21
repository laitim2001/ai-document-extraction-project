'use server'

/**
 * @fileoverview 配置重置 API
 * @description
 *   重置配置為預設值。
 *   僅限全局管理者訪問。
 *
 * @module src/app/api/admin/config/[key]/reset
 * @author Development Team
 * @since Epic 12 - Story 12-4 (系統設定管理)
 * @lastModified 2025-12-21
 *
 * @features
 *   - 重置為預設值
 *   - 變更歷史追蹤
 *   - 全局管理者權限驗證
 *
 * @dependencies
 *   - @/lib/auth - 認證服務
 *   - @/services/system-config.service - 配置服務
 *
 * @related
 *   - src/app/api/admin/config/[key]/route.ts - 配置 CRUD
 *   - src/app/api/admin/config/[key]/rollback/route.ts - 配置回滾
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { SystemConfigService, SystemConfigError } from '@/services/system-config.service'
import { z } from 'zod'

// ============================================================
// Validation Schema
// ============================================================

const resetRequestSchema = z.object({
  reason: z.string().max(500).optional(),
})

// ============================================================
// Route Handlers
// ============================================================

/**
 * POST /api/admin/config/[key]/reset
 *
 * @description
 *   重置配置為預設值。會記錄到變更歷史。
 *   僅限全局管理者訪問。
 *
 * @params
 *   - key: 配置鍵
 *
 * @body
 *   - reason: 重置原因（可選）
 *
 * @returns 重置結果
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
  let body: unknown = {}
  try {
    const text = await request.text()
    if (text) {
      body = JSON.parse(text)
    }
  } catch {
    // Empty body is acceptable
  }

  const validation = resetRequestSchema.safeParse(body)

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

  try {
    const result = await SystemConfigService.resetToDefault(
      decodedKey,
      session.user.id,
      validation.data.reason
    )

    if (!result.success) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/validation',
          title: 'Reset Failed',
          status: 400,
          detail: result.error || 'Failed to reset configuration',
        },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Configuration reset to default value',
      requiresRestart: result.requiresRestart,
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
      if (error.code === 'NO_DEFAULT_VALUE') {
        return NextResponse.json(
          {
            type: 'https://api.example.com/errors/validation',
            title: 'No Default Value',
            status: 400,
            detail: error.message,
          },
          { status: 400 }
        )
      }
    }

    console.error('[Admin Config API] Reset error:', error)

    return NextResponse.json(
      {
        type: 'https://api.example.com/errors/internal',
        title: 'Internal Server Error',
        status: 500,
        detail: 'Failed to reset configuration',
      },
      { status: 500 }
    )
  }
}
