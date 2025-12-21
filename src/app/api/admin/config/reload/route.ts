'use server'

/**
 * @fileoverview 配置快取重載 API
 * @description
 *   重新載入配置快取（熱載入）。
 *   僅限全局管理者訪問。
 *
 * @module src/app/api/admin/config/reload
 * @author Development Team
 * @since Epic 12 - Story 12-4 (系統設定管理)
 * @lastModified 2025-12-21
 *
 * @features
 *   - 重新載入配置快取
 *   - 全局管理者權限驗證
 *
 * @dependencies
 *   - @/lib/auth - 認證服務
 *   - @/services/system-config.service - 配置服務
 *
 * @related
 *   - src/app/api/admin/config/route.ts - 配置列表
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { SystemConfigService } from '@/services/system-config.service'

// ============================================================
// Route Handlers
// ============================================================

/**
 * POST /api/admin/config/reload
 *
 * @description
 *   重新載入配置快取。用於在配置更新後強制刷新快取。
 *   僅限全局管理者訪問。
 *
 * @returns 重載結果
 */
export async function POST(_request: NextRequest): Promise<NextResponse> {
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

  try {
    await SystemConfigService.reloadAllConfigs()

    return NextResponse.json({
      success: true,
      message: 'Configuration cache reloaded successfully',
      reloadedAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[Admin Config API] Reload error:', error)

    return NextResponse.json(
      {
        type: 'https://api.example.com/errors/internal',
        title: 'Internal Server Error',
        status: 500,
        detail: 'Failed to reload configuration cache',
      },
      { status: 500 }
    )
  }
}
