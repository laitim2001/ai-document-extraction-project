/**
 * @fileoverview Reference Number API - 批次驗證
 * @description
 *   提供 Reference Number 的批次驗證功能。
 *   供文件處理流程檢查號碼是否存在於系統中。
 *   匹配成功時自動增加 matchCount。
 *
 * @module src/app/api/v1/reference-numbers/validate
 * @since Epic 20 - Story 20.4
 * @lastModified 2026-02-05
 *
 * @endpoints
 *   POST /api/v1/reference-numbers/validate - 批次驗證
 */

import { NextRequest, NextResponse } from 'next/server'
import { validateReferenceNumbers } from '@/services/reference-number.service'
import { validateReferenceNumbersSchema } from '@/lib/validations/reference-number.schema'

// =====================
// API Handlers
// =====================

/**
 * POST /api/v1/reference-numbers/validate
 * 批次驗證 Reference Numbers
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // 驗證請求體
    const parsed = validateReferenceNumbersSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/validation',
          title: 'Validation Error',
          status: 400,
          detail: 'Invalid validation request',
          errors: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      )
    }

    // 執行驗證
    const result = await validateReferenceNumbers(parsed.data)

    return NextResponse.json({
      success: true,
      data: result,
    })
  } catch (error) {
    console.error('[ReferenceNumber:Validate] Error:', error)

    return NextResponse.json(
      {
        type: 'https://api.example.com/errors/internal',
        title: 'Internal Server Error',
        status: 500,
        detail: 'An unexpected error occurred while validating reference numbers',
      },
      { status: 500 }
    )
  }
}
