'use server'

/**
 * @fileoverview System Settings 系統設定管理 API（列表與批次更新）
 * @description
 *   提供系統設定的列表查詢和批次更新功能：
 *   - GET: 列出所有設定（支援 category 篩選），同時回傳預設值
 *   - PATCH: 批次更新多個設定值
 *   - 僅限已認證用戶訪問
 *
 * @module src/app/api/admin/settings
 * @since CHANGE-050 - System Settings Hub
 * @lastModified 2026-02-26
 *
 * @features
 *   - 設定列表查詢（含預設值映射）
 *   - 批次 upsert 設定
 *   - Zod 驗證
 *   - 認證檢查
 *
 * @dependencies
 *   - @/lib/auth - 認證服務
 *   - @/services/system-settings.service - 設定服務
 *   - zod - 請求驗證
 *
 * @related
 *   - src/app/api/admin/settings/[key]/route.ts - 單一設定操作
 *   - src/hooks/use-system-settings.ts - 前端 hooks
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { systemSettingsService } from '@/services/system-settings.service'
import { z } from 'zod'

// ============================================================
// Validation Schema
// ============================================================

/**
 * 批次更新設定請求驗證
 */
const bulkUpdateSchema = z.object({
  settings: z
    .array(
      z.object({
        key: z.string().min(1).max(255),
        value: z.unknown(),
        category: z.string().max(100).optional(),
      })
    )
    .min(1)
    .max(100),
})

// ============================================================
// Route Handlers
// ============================================================

/**
 * GET /api/admin/settings
 *
 * @description
 *   獲取系統設定列表。可選擇按 category 篩選。
 *   回傳 DB 中的設定以及預設值映射。
 *
 * @query
 *   - category: 設定分類（可選，例如 'general', 'notifications', 'retention'）
 *
 * @returns 設定列表和預設值
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
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

  // --- 解析參數 ---
  const { searchParams } = new URL(request.url)
  const category = searchParams.get('category') || undefined

  try {
    const [settings, defaults] = await Promise.all([
      systemSettingsService.getAll(category),
      Promise.resolve(systemSettingsService.getDefaults()),
    ])

    return NextResponse.json({
      success: true,
      data: {
        settings,
        defaults,
      },
    })
  } catch (error) {
    console.error('[Admin Settings API] Error fetching settings:', error)

    return NextResponse.json(
      {
        type: 'https://api.example.com/errors/internal',
        title: 'Internal Server Error',
        status: 500,
        detail: 'Failed to fetch system settings',
      },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/admin/settings
 *
 * @description
 *   批次更新多個系統設定。使用 transaction 確保一致性。
 *
 * @body
 *   - settings: Array<{ key: string; value: unknown; category?: string }>
 *
 * @returns 更新數量
 */
export async function PATCH(request: NextRequest): Promise<NextResponse> {
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

  const validation = bulkUpdateSchema.safeParse(body)

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
    const updated = await systemSettingsService.bulkSet(
      validation.data.settings,
      session.user.id
    )

    return NextResponse.json({
      success: true,
      data: { updated },
    })
  } catch (error) {
    console.error('[Admin Settings API] Error updating settings:', error)

    return NextResponse.json(
      {
        type: 'https://api.example.com/errors/internal',
        title: 'Internal Server Error',
        status: 500,
        detail: 'Failed to update system settings',
      },
      { status: 500 }
    )
  }
}
