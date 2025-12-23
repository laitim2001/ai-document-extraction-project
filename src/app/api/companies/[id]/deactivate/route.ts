/**
 * @fileoverview Company Deactivate API Route
 * @description
 *   停用 Company 的 API 端點
 *   可選擇同時停用相關的映射規則
 *
 * @module src/app/api/companies/[id]/deactivate
 * @since REFACTOR-001 (Forwarder → Company)
 * @lastModified 2025-12-22
 *
 * @features
 *   - POST: 停用指定的 Company
 *   - 可選停用相關規則
 *   - 支援停用原因記錄
 *   - 自動記錄審計日誌
 *
 * @related
 *   - src/services/company.service.ts - deactivateCompany
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getCompanyById, deactivateCompany } from '@/services/company.service'
import { z } from 'zod'

interface RouteParams {
  params: Promise<{ id: string }>
}

// 請求體 Schema
const DeactivateRequestSchema = z.object({
  reason: z.string().optional(),
  deactivateRules: z.boolean().optional().default(false),
})

// ============================================================
// POST /api/companies/[id]/deactivate - 停用 Company
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
          instance: `/api/companies/${id}/deactivate`,
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
          instance: `/api/companies/${id}/deactivate`,
        },
        { status: 404 }
      )
    }

    // 3. 解析請求體
    let options: { reason?: string; deactivateRules: boolean } = { deactivateRules: false }
    try {
      const body = await request.json()
      options = DeactivateRequestSchema.parse(body)
    } catch {
      // 空請求體或解析失敗，使用預設值
    }

    // 4. 停用 Company
    const deactivatedCompany = await deactivateCompany(id, {
      reason: options.reason, // REFACTOR-001: 直接傳遞 undefined
      deactivateRules: options.deactivateRules,
    })

    // 5. 返回結果
    return NextResponse.json({
      success: true,
      data: deactivatedCompany,
      message: options.deactivateRules
        ? 'Company deactivated with rules deactivated'
        : 'Company deactivated',
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
          instance: `/api/companies/${id}/deactivate`,
          errors: error.flatten().fieldErrors,
        },
        { status: 400 }
      )
    }

    // 業務錯誤（如已停用）
    if (error instanceof Error && error.message.includes('already inactive')) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/conflict',
          title: 'Conflict',
          status: 409,
          detail: error.message,
          instance: `/api/companies/${id}/deactivate`,
        },
        { status: 409 }
      )
    }

    // 其他錯誤
    console.error(`[API] POST /api/companies/${id}/deactivate error:`, error)
    return NextResponse.json(
      {
        type: 'https://api.example.com/errors/internal',
        title: 'Internal Server Error',
        status: 500,
        detail: 'An unexpected error occurred',
        instance: `/api/companies/${id}/deactivate`,
      },
      { status: 500 }
    )
  }
}
