'use server'

/**
 * @fileoverview 配置變更歷史 API
 * @description
 *   獲取配置的變更歷史記錄，支援分頁查詢。
 *   僅限全局管理者訪問。
 *
 * @module src/app/api/admin/config/[key]/history
 * @author Development Team
 * @since Epic 6 - Story 6.4 (Global Admin Full Access)
 * @lastModified 2025-12-21
 *
 * @features
 *   - 變更歷史分頁查詢
 *   - 包含回滾標記
 *   - 全局管理者權限驗證
 *
 * @dependencies
 *   - @/lib/auth - 認證服務
 *   - @/services/system-config.service - 配置服務
 *   - zod - 請求驗證
 *
 * @related
 *   - src/app/api/admin/config/[key]/route.ts - 配置 CRUD
 *   - src/app/api/admin/config/[key]/rollback/route.ts - 配置回滾
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { SystemConfigService } from '@/services/system-config.service'
import { z } from 'zod'

// ============================================================
// Validation Schema
// ============================================================

const historyQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(20),
  offset: z.coerce.number().min(0).default(0),
})

// ============================================================
// Route Handlers
// ============================================================

/**
 * GET /api/admin/config/[key]/history
 *
 * @description
 *   獲取配置的變更歷史記錄。支援分頁。
 *   僅限全局管理者訪問。
 *
 * @params
 *   - key: 配置鍵
 *
 * @query
 *   - limit: 每頁數量（預設 20，最大 100）
 *   - offset: 偏移量（預設 0）
 *
 * @returns 歷史記錄列表（含總數）
 */
export async function GET(
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

  // --- 解析查詢參數 ---
  const { searchParams } = new URL(request.url)

  try {
    const query = historyQuerySchema.parse({
      limit: searchParams.get('limit') || 20,
      offset: searchParams.get('offset') || 0,
    })

    // 使用 Story 12-4 新方法
    const result = await SystemConfigService.getConfigHistory(decodedKey, {
      limit: query.limit,
      offset: query.offset,
    })

    return NextResponse.json({
      success: true,
      data: result.history,
      meta: {
        total: result.total,
        limit: query.limit,
        offset: query.offset,
      },
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/validation',
          title: 'Validation Error',
          status: 400,
          detail: 'Invalid query parameters',
          errors: error.flatten().fieldErrors,
        },
        { status: 400 }
      )
    }

    console.error('[Admin Config API] History error:', error)

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
