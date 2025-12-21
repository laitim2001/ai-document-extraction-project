'use server'

/**
 * @fileoverview 配置匯出 API
 * @description
 *   匯出系統配置為 JSON 格式。
 *   敏感值（SECRET 類型）不會被匯出。
 *   僅限全局管理者訪問。
 *
 * @module src/app/api/admin/config/export
 * @author Development Team
 * @since Epic 12 - Story 12-4 (系統設定管理)
 * @lastModified 2025-12-21
 *
 * @features
 *   - 匯出配置為 JSON
 *   - 自動排除敏感值
 *   - 包含匯出元資料
 *   - 全局管理者權限驗證
 *
 * @dependencies
 *   - @/lib/auth - 認證服務
 *   - @/services/system-config.service - 配置服務
 *
 * @related
 *   - src/app/api/admin/config/import/route.ts - 配置匯入
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { SystemConfigService } from '@/services/system-config.service'

// ============================================================
// Route Handlers
// ============================================================

/**
 * POST /api/admin/config/export
 *
 * @description
 *   匯出所有配置為 JSON 格式。敏感值會被排除。
 *   僅限全局管理者訪問。
 *
 * @returns 配置匯出資料
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
    const exportData = await SystemConfigService.exportConfigs(session.user.id)

    return NextResponse.json({
      success: true,
      data: {
        exportedAt: new Date().toISOString(),
        exportedBy: session.user.id,
        configs: exportData,
      },
    })
  } catch (error) {
    console.error('[Admin Config API] Export error:', error)

    return NextResponse.json(
      {
        type: 'https://api.example.com/errors/internal',
        title: 'Internal Server Error',
        status: 500,
        detail: 'Failed to export configurations',
      },
      { status: 500 }
    )
  }
}
