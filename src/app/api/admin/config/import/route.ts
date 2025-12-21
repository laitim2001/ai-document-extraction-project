'use server'

/**
 * @fileoverview 配置匯入 API
 * @description
 *   從 JSON 格式匯入系統配置。
 *   只會更新已存在的配置，不會創建新配置。
 *   僅限全局管理者訪問。
 *
 * @module src/app/api/admin/config/import
 * @author Development Team
 * @since Epic 12 - Story 12-4 (系統設定管理)
 * @lastModified 2025-12-21
 *
 * @features
 *   - 從 JSON 匯入配置
 *   - 驗證配置值
 *   - 匯入結果報告
 *   - 全局管理者權限驗證
 *
 * @dependencies
 *   - @/lib/auth - 認證服務
 *   - @/services/system-config.service - 配置服務
 *   - zod - 請求驗證
 *
 * @related
 *   - src/app/api/admin/config/export/route.ts - 配置匯出
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { SystemConfigService } from '@/services/system-config.service'
import { z } from 'zod'

// ============================================================
// Validation Schema
// ============================================================

const importSchema = z.object({
  configs: z.record(z.string(), z.unknown()),
})

// ============================================================
// Route Handlers
// ============================================================

/**
 * POST /api/admin/config/import
 *
 * @description
 *   從 JSON 匯入配置。只會更新已存在的配置。
 *   僅限全局管理者訪問。
 *
 * @body
 *   - configs: 配置鍵值對
 *
 * @returns 匯入結果（成功/跳過/錯誤數量）
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
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

  const validation = importSchema.safeParse(body)

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
    const result = await SystemConfigService.importConfigs(
      validation.data.configs,
      session.user.id
    )

    return NextResponse.json({
      success: true,
      message: `Import completed: ${result.imported} imported, ${result.skipped} skipped`,
      data: {
        imported: result.imported,
        skipped: result.skipped,
        errors: result.errors,
      },
    })
  } catch (error) {
    console.error('[Admin Config API] Import error:', error)

    return NextResponse.json(
      {
        type: 'https://api.example.com/errors/internal',
        title: 'Internal Server Error',
        status: 500,
        detail: 'Failed to import configurations',
      },
      { status: 500 }
    )
  }
}
