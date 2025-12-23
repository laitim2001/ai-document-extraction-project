/**
 * @fileoverview Company Activate API Route
 * @description
 *   啟用 Company 的 API 端點
 *   可選擇同時重新啟用相關的映射規則
 *
 * @module src/app/api/companies/[id]/activate
 * @since REFACTOR-001 (Forwarder → Company)
 * @lastModified 2025-12-22
 *
 * @features
 *   - POST: 啟用指定的 Company
 *   - 可選重新啟用相關規則
 *   - 自動記錄審計日誌
 *
 * @related
 *   - src/services/company.service.ts - activateCompany
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getCompanyById, activateCompany } from '@/services/company.service'
import { z } from 'zod'

interface RouteParams {
  params: Promise<{ id: string }>
}

// 請求體 Schema
const ActivateRequestSchema = z.object({
  reactivateRules: z.boolean().optional().default(false),
})

// ============================================================
// POST /api/companies/[id]/activate - 啟用 Company
// ============================================================

export async function POST(
  request: NextRequest,
  { params }: RouteParams
) {
  const { id } = await params

  try {
    // 1. 驗證用戶身份
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/unauthorized',
          title: 'Unauthorized',
          status: 401,
          detail: 'Authentication required',
          instance: `/api/companies/${id}/activate`,
        },
        { status: 401 }
      )
    }

    // 2. 檢查 Company 是否存在
    const existingCompany = await getCompanyById(id)
    if (!existingCompany) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/not-found',
          title: 'Not Found',
          status: 404,
          detail: `Company with id '${id}' not found`,
          instance: `/api/companies/${id}/activate`,
        },
        { status: 404 }
      )
    }

    // 3. 解析請求體
    let options = { reactivateRules: false }
    try {
      const body = await request.json()
      options = ActivateRequestSchema.parse(body)
    } catch {
      // 空請求體或解析失敗，使用預設值
    }

    // 4. 啟用 Company
    const activatedCompany = await activateCompany(id, {
      reactivateRules: options.reactivateRules,
    })

    // 5. 返回結果
    return NextResponse.json({
      success: true,
      data: activatedCompany,
      message: options.reactivateRules
        ? 'Company activated with rules reactivated'
        : 'Company activated',
    })
  } catch (error) {
    // Zod 驗證錯誤
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/validation',
          title: 'Validation Error',
          status: 400,
          detail: 'Request body validation failed',
          instance: `/api/companies/${id}/activate`,
          errors: error.flatten().fieldErrors,
        },
        { status: 400 }
      )
    }

    // 業務錯誤（如已啟用）
    if (error instanceof Error && error.message.includes('already active')) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/conflict',
          title: 'Conflict',
          status: 409,
          detail: error.message,
          instance: `/api/companies/${id}/activate`,
        },
        { status: 409 }
      )
    }

    // 其他錯誤
    console.error(`[API] POST /api/companies/${id}/activate error:`, error)
    return NextResponse.json(
      {
        type: 'https://api.example.com/errors/internal',
        title: 'Internal Server Error',
        status: 500,
        detail: 'An unexpected error occurred',
        instance: `/api/companies/${id}/activate`,
      },
      { status: 500 }
    )
  }
}
