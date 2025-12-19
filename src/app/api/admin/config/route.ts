'use server'

/**
 * @fileoverview 系統配置管理 API
 * @description
 *   提供系統配置的列表和創建功能：
 *   - 列出所有配置或按類別篩選
 *   - 創建新配置
 *   - 僅限全局管理者訪問
 *
 * @module src/app/api/admin/config
 * @author Development Team
 * @since Epic 6 - Story 6.4 (Global Admin Full Access)
 * @lastModified 2025-12-19
 *
 * @features
 *   - 配置列表（支援分類篩選）
 *   - 創建新配置
 *   - 全局管理者權限驗證
 *
 * @dependencies
 *   - @/lib/auth - 認證服務
 *   - @/services/system-config.service - 配置服務
 *   - zod - 請求驗證
 *
 * @related
 *   - src/app/api/admin/config/[key]/route.ts - 單一配置操作
 *   - src/app/(dashboard)/admin/config/page.tsx - 配置管理頁面
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { SystemConfigService } from '@/services/system-config.service'
import { ConfigCategory, ConfigScope } from '@prisma/client'
import { z } from 'zod'

// ============================================================
// Validation Schema
// ============================================================

const createConfigSchema = z.object({
  key: z.string().min(1).max(255),
  value: z.record(z.string(), z.unknown()),
  description: z.string().max(500).optional(),
  category: z.nativeEnum(ConfigCategory),
  scope: z.nativeEnum(ConfigScope).optional().default('GLOBAL'),
  cityCode: z.string().optional(),
})

// ============================================================
// Route Handlers
// ============================================================

/**
 * GET /api/admin/config
 *
 * @description
 *   獲取系統配置列表。可選擇按類別篩選。
 *   僅限全局管理者訪問。
 *
 * @query
 *   - category: 配置類別（可選）
 *   - includeInactive: 是否包含停用的配置（預設 false）
 *
 * @returns 配置列表（按類別分組或單一類別）
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

  // --- 解析參數 ---
  const category = request.nextUrl.searchParams.get('category')
  const includeInactive =
    request.nextUrl.searchParams.get('includeInactive') === 'true'

  try {
    // 如果指定了類別，返回該類別的配置
    if (category && Object.values(ConfigCategory).includes(category as ConfigCategory)) {
      const configs = await SystemConfigService.getByCategory(
        category as ConfigCategory
      )
      return NextResponse.json({
        success: true,
        data: configs,
      })
    }

    // 否則返回所有類別的配置（按類別分組）
    const allCategories = Object.values(ConfigCategory)
    const categorizedConfigs: Record<string, Awaited<ReturnType<typeof SystemConfigService.getByCategory>>> = {}

    for (const cat of allCategories) {
      categorizedConfigs[cat] = await SystemConfigService.getByCategory(cat)
    }

    // 如果需要包含停用的配置
    if (includeInactive) {
      const allConfigs = await SystemConfigService.getAll(true)
      return NextResponse.json({
        success: true,
        data: {
          byCategory: categorizedConfigs,
          all: allConfigs,
        },
      })
    }

    return NextResponse.json({
      success: true,
      data: categorizedConfigs,
    })
  } catch (error) {
    console.error('[Admin Config API] Error:', error)

    return NextResponse.json(
      {
        type: 'https://api.example.com/errors/internal',
        title: 'Internal Server Error',
        status: 500,
        detail: 'Failed to fetch configurations',
      },
      { status: 500 }
    )
  }
}

/**
 * POST /api/admin/config
 *
 * @description
 *   創建新的系統配置。
 *   僅限全局管理者訪問。
 *
 * @body
 *   - key: 配置鍵（必填，唯一）
 *   - value: 配置值（JSON 物件）
 *   - description: 描述（可選）
 *   - category: 類別（必填）
 *   - scope: 範圍（可選，預設 GLOBAL）
 *   - cityCode: 城市代碼（當 scope 為 CITY 時必填）
 *
 * @returns 創建成功訊息
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

  const validation = createConfigSchema.safeParse(body)

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

  const { key, value, description, category, scope, cityCode } = validation.data

  try {
    await SystemConfigService.create({
      key,
      value,
      description,
      category,
      scope,
      cityCode,
      createdBy: session.user.id,
    })

    return NextResponse.json(
      {
        success: true,
        message: 'Configuration created successfully',
        data: { key },
      },
      { status: 201 }
    )
  } catch (error) {
    const err = error as Error

    if (err.message.includes('already exists')) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/conflict',
          title: 'Conflict',
          status: 409,
          detail: err.message,
        },
        { status: 409 }
      )
    }

    console.error('[Admin Config API] Create error:', error)

    return NextResponse.json(
      {
        type: 'https://api.example.com/errors/internal',
        title: 'Internal Server Error',
        status: 500,
        detail: 'Failed to create configuration',
      },
      { status: 500 }
    )
  }
}
