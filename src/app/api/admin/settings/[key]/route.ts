'use server'

/**
 * @fileoverview System Settings 單一設定操作 API
 * @description
 *   提供單一系統設定的查詢、更新和刪除（重置為預設值）功能：
 *   - GET: 取得單一設定（含預設值資訊）
 *   - PUT: 更新單一設定值
 *   - DELETE: 刪除自訂設定（恢復為預設值）
 *   - 僅限已認證用戶訪問
 *
 * @module src/app/api/admin/settings/[key]
 * @since CHANGE-050 - System Settings Hub
 * @lastModified 2026-02-26
 *
 * @features
 *   - 單一設定查詢（含預設值 fallback）
 *   - 設定值更新
 *   - 重置為預設值（刪除 DB 記錄）
 *   - Zod 驗證
 *   - 認證檢查
 *
 * @dependencies
 *   - @/lib/auth - 認證服務
 *   - @/services/system-settings.service - 設定服務
 *   - zod - 請求驗證
 *
 * @related
 *   - src/app/api/admin/settings/route.ts - 設定列表 API
 *   - src/hooks/use-system-settings.ts - 前端 hooks
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { systemSettingsService } from '@/services/system-settings.service'
import { z } from 'zod'

// ============================================================
// Types
// ============================================================

/**
 * 動態路由參數
 */
interface RouteParams {
  params: Promise<{ key: string }>
}

// ============================================================
// Validation Schema
// ============================================================

/**
 * 更新設定值請求驗證
 */
const updateSettingSchema = z.object({
  value: z.unknown(),
})

// ============================================================
// Route Handlers
// ============================================================

/**
 * GET /api/admin/settings/[key]
 *
 * @description
 *   取得單一系統設定。若 DB 中不存在但有預設值，
 *   回傳預設值作為 fallback。同時附帶該 key 的預設值資訊。
 *
 * @returns 設定資料和預設值
 */
export async function GET(
  _request: NextRequest,
  { params }: RouteParams
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

  const { key } = await params
  const decodedKey = decodeURIComponent(key)

  try {
    const setting = await systemSettingsService.get(decodedKey)
    const defaults = systemSettingsService.getDefaults()
    const defaultValue = defaults[decodedKey] ?? null

    if (!setting) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/not-found',
          title: 'Not Found',
          status: 404,
          detail: `Setting "${decodedKey}" not found`,
        },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        setting,
        default: defaultValue,
      },
    })
  } catch (error) {
    console.error(`[Admin Settings API] Error fetching setting "${decodedKey}":`, error)

    return NextResponse.json(
      {
        type: 'https://api.example.com/errors/internal',
        title: 'Internal Server Error',
        status: 500,
        detail: 'Failed to fetch system setting',
      },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/admin/settings/[key]
 *
 * @description
 *   更新單一系統設定值。使用 upsert 模式，若不存在則建立。
 *
 * @body
 *   - value: unknown（JSON 相容類型）
 *
 * @returns 更新後的設定
 */
export async function PUT(
  request: NextRequest,
  { params }: RouteParams
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

  const validation = updateSettingSchema.safeParse(body)

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
    const setting = await systemSettingsService.set(
      decodedKey,
      validation.data.value,
      undefined,
      session.user.id
    )

    return NextResponse.json({
      success: true,
      data: setting,
    })
  } catch (error) {
    console.error(`[Admin Settings API] Error updating setting "${decodedKey}":`, error)

    return NextResponse.json(
      {
        type: 'https://api.example.com/errors/internal',
        title: 'Internal Server Error',
        status: 500,
        detail: 'Failed to update system setting',
      },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/admin/settings/[key]
 *
 * @description
 *   刪除自訂系統設定，恢復為預設值。
 *   實際操作是從 DB 中刪除記錄，後續 get() 呼叫會回傳預設值。
 *
 * @returns 重置確認
 */
export async function DELETE(
  _request: NextRequest,
  { params }: RouteParams
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

  const { key } = await params
  const decodedKey = decodeURIComponent(key)

  try {
    await systemSettingsService.delete(decodedKey)

    return NextResponse.json({
      success: true,
      data: {
        key: decodedKey,
        resetToDefault: true,
      },
    })
  } catch (error) {
    console.error(`[Admin Settings API] Error deleting setting "${decodedKey}":`, error)

    return NextResponse.json(
      {
        type: 'https://api.example.com/errors/internal',
        title: 'Internal Server Error',
        status: 500,
        detail: 'Failed to reset system setting',
      },
      { status: 500 }
    )
  }
}
