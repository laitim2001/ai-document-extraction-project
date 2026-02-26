/**
 * @fileoverview Reference Number API - 批次導入
 * @description
 *   提供 Reference Number 的批次導入功能。
 *   使用 code 匹配現有記錄，regionCode 關聯地區。
 *   支援 overwriteExisting 和 skipInvalid 選項。
 *
 * @module src/app/api/v1/reference-numbers/import
 * @since Epic 20 - Story 20.4
 * @lastModified 2026-02-05
 *
 * @endpoints
 *   POST /api/v1/reference-numbers/import - 批次導入
 */

import { NextRequest, NextResponse } from 'next/server'
import { importReferenceNumbers } from '@/services/reference-number.service'
import { importReferenceNumbersSchema } from '@/lib/validations/reference-number.schema'
import { ZodError } from 'zod'

// =====================
// API Handlers
// =====================

/**
 * POST /api/v1/reference-numbers/import
 * 批次導入 Reference Numbers
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // 驗證請求體
    const parsed = importReferenceNumbersSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/validation',
          title: 'Validation Error',
          status: 400,
          detail: 'Invalid import data format',
          errors: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      )
    }

    // 執行導入
    // 目前使用固定的 createdById，後續整合認證後替換
    const createdById = 'system'
    const result = await importReferenceNumbers(parsed.data, createdById)

    return NextResponse.json({
      success: true,
      data: result,
    })
  } catch (error) {
    console.error('[ReferenceNumber:Import] Error:', error)

    // 處理 Zod 驗證錯誤（來自 schema.parse）
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/validation',
          title: 'Validation Error',
          status: 400,
          detail: 'Invalid import data format',
          errors: error.flatten().fieldErrors,
        },
        { status: 400 }
      )
    }

    // 處理業務邏輯錯誤（skipInvalid = false 時的整批失敗）
    if (error instanceof Error && error.message.startsWith('導入第')) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/import-failed',
          title: 'Import Failed',
          status: 422,
          detail: error.message,
        },
        { status: 422 }
      )
    }

    return NextResponse.json(
      {
        type: 'https://api.example.com/errors/internal',
        title: 'Internal Server Error',
        status: 500,
        detail: 'An unexpected error occurred while importing reference numbers',
      },
      { status: 500 }
    )
  }
}
