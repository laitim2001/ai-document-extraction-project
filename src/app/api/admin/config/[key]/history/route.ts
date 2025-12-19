'use server'

/**
 * @fileoverview 配置歷史 API
 * @description
 *   提供配置變更歷史的查詢功能：
 *   - 獲取配置的所有歷史版本
 *   - 包含變更者和變更原因
 *   - 僅限全局管理者訪問
 *
 * @module src/app/api/admin/config/[key]/history
 * @author Development Team
 * @since Epic 6 - Story 6.4 (Global Admin Full Access)
 * @lastModified 2025-12-19
 *
 * @features
 *   - 配置歷史查詢
 *   - 版本詳情
 *   - 變更追蹤
 *
 * @dependencies
 *   - @/lib/auth - 認證服務
 *   - @/services/system-config.service - 配置服務
 *
 * @related
 *   - src/app/api/admin/config/[key]/route.ts - 單一配置 API
 *   - src/app/api/admin/config/[key]/rollback/route.ts - 回滾 API
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { SystemConfigService } from '@/services/system-config.service'

// ============================================================
// Route Handler
// ============================================================

/**
 * GET /api/admin/config/[key]/history
 *
 * @description
 *   獲取配置的變更歷史記錄。
 *   僅限全局管理者訪問。
 *
 * @params
 *   - key: 配置鍵
 *
 * @returns 配置歷史記錄列表（按版本降序）
 */
export async function GET(
  _request: NextRequest,
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

  try {
    // 先驗證配置存在
    const config = await SystemConfigService.getByKey(decodedKey)

    if (!config) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/not-found',
          title: 'Not Found',
          status: 404,
          detail: `Configuration not found: ${decodedKey}`,
        },
        { status: 404 }
      )
    }

    // 獲取歷史
    const history = await SystemConfigService.getHistory(decodedKey)

    return NextResponse.json({
      success: true,
      data: {
        key: decodedKey,
        currentVersion: config.version,
        history,
      },
    })
  } catch (error) {
    console.error('[Admin Config History API] Error:', error)

    return NextResponse.json(
      {
        type: 'https://api.example.com/errors/internal',
        title: 'Internal Server Error',
        status: 500,
        detail: 'Failed to fetch configuration history',
      },
      { status: 500 }
    )
  }
}
