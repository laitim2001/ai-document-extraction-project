/**
 * @fileoverview 用戶語言偏好 API
 * @description
 *   管理當前登入用戶的語言偏好設定。
 *   提供 GET 和 PATCH 端點以獲取和更新語言偏好。
 *
 * @module src/app/api/v1/users/me/locale
 * @author Development Team
 * @since Epic 17 - Story 17.5 (Language Preference Settings)
 * @lastModified 2026-01-17
 *
 * @api
 *   - GET /api/v1/users/me/locale - 獲取用戶語言偏好
 *   - PATCH /api/v1/users/me/locale - 更新用戶語言偏好
 *
 * @related
 *   - src/hooks/use-locale-preference.ts - 前端 Hook
 *   - src/components/features/locale/LocaleSwitcher.tsx - 語言切換組件
 *   - src/i18n/config.ts - 語言配置
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { locales } from '@/i18n/config'

// ============================================================
// Validation Schema
// ============================================================

/**
 * 語言偏好更新驗證 Schema
 */
const UpdateLocaleSchema = z.object({
  locale: z
    .string()
    .refine((val) => locales.includes(val as typeof locales[number]), {
      message: `Invalid locale. Supported locales: ${locales.join(', ')}`,
    }),
})

// ============================================================
// API Handlers
// ============================================================

/**
 * PATCH /api/v1/users/me/locale
 * 更新用戶語言偏好
 *
 * @param request - Next.js Request 物件
 * @returns 成功時返回更新後的 locale，失敗時返回錯誤
 *
 * @example Request
 * ```json
 * { "locale": "zh-TW" }
 * ```
 *
 * @example Response (Success)
 * ```json
 * { "success": true, "data": { "locale": "zh-TW" } }
 * ```
 */
export async function PATCH(request: NextRequest) {
  try {
    // 1. 驗證認證
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json(
        {
          success: false,
          error: {
            type: 'https://api.example.com/errors/unauthorized',
            title: 'Unauthorized',
            status: 401,
            detail: 'Authentication required',
          },
        },
        { status: 401 }
      )
    }

    // 2. 解析和驗證請求
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: {
            type: 'https://api.example.com/errors/invalid-json',
            title: 'Invalid JSON',
            status: 400,
            detail: 'Request body must be valid JSON',
          },
        },
        { status: 400 }
      )
    }

    const validationResult = UpdateLocaleSchema.safeParse(body)

    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            type: 'https://api.example.com/errors/validation',
            title: 'Validation Error',
            status: 400,
            detail: 'Invalid locale value',
            errors: validationResult.error.flatten().fieldErrors,
          },
        },
        { status: 400 }
      )
    }

    const { locale } = validationResult.data

    // 3. 更新資料庫
    await prisma.user.update({
      where: { id: session.user.id },
      data: { preferredLocale: locale },
    })

    // 4. 返回成功
    return NextResponse.json({
      success: true,
      data: { locale },
    })
  } catch (error) {
    console.error('Failed to update locale preference:', error)
    return NextResponse.json(
      {
        success: false,
        error: {
          type: 'https://api.example.com/errors/internal',
          title: 'Internal Server Error',
          status: 500,
          detail: 'Failed to update locale preference',
        },
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/v1/users/me/locale
 * 獲取用戶語言偏好
 *
 * @returns 用戶的語言偏好，未設定則返回預設值 'en'
 *
 * @example Response (Success)
 * ```json
 * { "success": true, "data": { "locale": "zh-TW" } }
 * ```
 */
export async function GET() {
  try {
    // 1. 驗證認證
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json(
        {
          success: false,
          error: {
            type: 'https://api.example.com/errors/unauthorized',
            title: 'Unauthorized',
            status: 401,
            detail: 'Authentication required',
          },
        },
        { status: 401 }
      )
    }

    // 2. 查詢資料庫
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { preferredLocale: true },
    })

    // 3. 返回結果
    return NextResponse.json({
      success: true,
      data: { locale: user?.preferredLocale || 'en' },
    })
  } catch (error) {
    console.error('Failed to get locale preference:', error)
    return NextResponse.json(
      {
        success: false,
        error: {
          type: 'https://api.example.com/errors/internal',
          title: 'Internal Server Error',
          status: 500,
          detail: 'Failed to get locale preference',
        },
      },
      { status: 500 }
    )
  }
}
