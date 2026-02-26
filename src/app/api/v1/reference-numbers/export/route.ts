/**
 * @fileoverview Reference Number API - 批次導出
 * @description
 *   提供 Reference Number 的批次導出功能。
 *   支援按年份、地區、類型、狀態、啟用狀態篩選。
 *   返回 JSON 格式，使用 code 和 regionCode。
 *
 * @module src/app/api/v1/reference-numbers/export
 * @since Epic 20 - Story 20.4
 * @lastModified 2026-02-05
 *
 * @endpoints
 *   GET /api/v1/reference-numbers/export - 批次導出
 */

import { NextRequest, NextResponse } from 'next/server'
import { exportReferenceNumbers } from '@/services/reference-number.service'
import { exportReferenceNumbersQuerySchema } from '@/lib/validations/reference-number.schema'

// =====================
// API Handlers
// =====================

/**
 * GET /api/v1/reference-numbers/export
 * 批次導出 Reference Numbers
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const queryParams = Object.fromEntries(searchParams.entries())

    // 驗證查詢參數
    const parsed = exportReferenceNumbersQuerySchema.safeParse(queryParams)
    if (!parsed.success) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/validation',
          title: 'Validation Error',
          status: 400,
          detail: 'Invalid export query parameters',
          errors: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      )
    }

    // 執行導出
    const result = await exportReferenceNumbers(parsed.data)

    return NextResponse.json({
      success: true,
      data: result,
    })
  } catch (error) {
    console.error('[ReferenceNumber:Export] Error:', error)

    return NextResponse.json(
      {
        type: 'https://api.example.com/errors/internal',
        title: 'Internal Server Error',
        status: 500,
        detail: 'An unexpected error occurred while exporting reference numbers',
      },
      { status: 500 }
    )
  }
}
