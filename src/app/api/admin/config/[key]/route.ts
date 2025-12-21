'use server'

/**
 * @fileoverview 單一配置操作 API
 * @description
 *   提供單一系統配置的操作：
 *   - 獲取配置詳情
 *   - 更新配置值（帶驗證和版本控制）
 *   - 刪除配置
 *   - 僅限全局管理者訪問
 *
 * @module src/app/api/admin/config/[key]
 * @author Development Team
 * @since Epic 6 - Story 6.4 (Global Admin Full Access)
 * @lastModified 2025-12-21
 *
 * @features
 *   - 配置詳情查詢
 *   - 配置更新（帶版本控制、驗證）
 *   - 配置刪除
 *   - 敏感值自動遮罩
 *
 * @dependencies
 *   - @/lib/auth - 認證服務
 *   - @/services/system-config.service - 配置服務
 *   - zod - 請求驗證
 *
 * @related
 *   - src/app/api/admin/config/route.ts - 配置列表 API
 *   - src/app/api/admin/config/[key]/history/route.ts - 配置歷史 API
 *   - src/app/api/admin/config/[key]/reset/route.ts - 配置重置 API
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { SystemConfigService, SystemConfigError } from '@/services/system-config.service'
import { z } from 'zod'

// ============================================================
// Validation Schema
// ============================================================

/**
 * 更新配置請求驗證
 */
const updateConfigSchema = z.object({
  value: z.unknown(),
  changeReason: z.string().max(500).optional(),
})

// ============================================================
// Route Handlers
// ============================================================

/**
 * GET /api/admin/config/[key]
 *
 * @description
 *   獲取單一配置的詳細資訊。
 *   敏感值會自動遮罩。
 *   僅限全局管理者訪問。
 *
 * @params
 *   - key: 配置鍵
 *
 * @returns 配置詳情
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

  try {
    // 使用 Story 12-4 新方法
    const config = await SystemConfigService.getConfigByKey(decodedKey)

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

    return NextResponse.json({
      success: true,
      data: config,
    })
  } catch (error) {
    console.error('[Admin Config API] Get error:', error)

    return NextResponse.json(
      {
        type: 'https://api.example.com/errors/internal',
        title: 'Internal Server Error',
        status: 500,
        detail: 'Failed to fetch configuration',
      },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/admin/config/[key]
 *
 * @description
 *   更新配置值。會自動驗證值類型、記錄歷史並檢查生效類型。
 *   僅限全局管理者訪問。
 *
 * @params
 *   - key: 配置鍵
 *
 * @body
 *   - value: 新配置值（根據 valueType 驗證）
 *   - changeReason: 變更原因（可選）
 *
 * @returns 更新結果（包含是否需要重啟）
 */
export async function PUT(
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

  const validation = updateConfigSchema.safeParse(body)

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

  const { value, changeReason } = validation.data

  try {
    // 使用 Story 12-4 新方法（帶驗證和生效類型檢查）
    const result = await SystemConfigService.updateConfig(
      decodedKey,
      { value, changeReason },
      session.user.id
    )

    if (!result.success) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/validation',
          title: 'Validation Error',
          status: 400,
          detail: result.error || 'Failed to update configuration',
        },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Configuration updated successfully',
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
      if (error.code === 'CONFIG_READ_ONLY') {
        return NextResponse.json(
          {
            type: 'https://api.example.com/errors/forbidden',
            title: 'Forbidden',
            status: 403,
            detail: error.message,
          },
          { status: 403 }
        )
      }
    }

    console.error('[Admin Config API] Update error:', error)

    return NextResponse.json(
      {
        type: 'https://api.example.com/errors/internal',
        title: 'Internal Server Error',
        status: 500,
        detail: 'Failed to update configuration',
      },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/admin/config/[key]
 *
 * @description
 *   刪除配置。此操作會同時刪除所有歷史記錄。
 *   僅限全局管理者訪問。
 *
 * @params
 *   - key: 配置鍵
 *
 * @returns 刪除成功訊息
 */
export async function DELETE(
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
    await SystemConfigService.delete(decodedKey, session.user.id)

    return NextResponse.json({
      success: true,
      message: 'Configuration deleted successfully',
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
    }

    console.error('[Admin Config API] Delete error:', error)

    return NextResponse.json(
      {
        type: 'https://api.example.com/errors/internal',
        title: 'Internal Server Error',
        status: 500,
        detail: 'Failed to delete configuration',
      },
      { status: 500 }
    )
  }
}
