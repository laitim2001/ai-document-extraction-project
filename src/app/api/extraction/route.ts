/**
 * @fileoverview OCR 提取 API 端點
 * @description
 *   提供 OCR 文件提取功能的 RESTful API：
 *   - POST /api/extraction - 執行 OCR 提取
 *
 *   權限要求：
 *   - INVOICE_CREATE 權限
 *
 * @module src/app/api/extraction/route
 * @since Epic 2 - Story 2.2 (File OCR Extraction Service)
 * @lastModified 2025-12-18
 *
 * @dependencies
 *   - next/server - Next.js API 處理
 *   - @/lib/auth - NextAuth 認證
 *   - @/services/extraction.service - 提取服務
 *
 * @related
 *   - src/services/extraction.service.ts - 提取業務邏輯
 *   - python-services/extraction/ - Python OCR 服務
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { hasPermission } from '@/lib/auth/city-permission'
import { extractDocument, checkOcrServiceHealth } from '@/services/extraction.service'
import { PERMISSIONS } from '@/types/permissions'
import { z } from 'zod'

// ============================================================
// Validation Schemas
// ============================================================

const extractRequestSchema = z.object({
  documentId: z.string().uuid('Invalid document ID'),
  force: z.boolean().optional().default(false),
})

// ============================================================
// POST /api/extraction
// ============================================================

/**
 * 執行 OCR 提取
 *
 * @description
 *   處理 OCR 提取請求：
 *   1. 認證和權限檢查
 *   2. 驗證請求參數
 *   3. 調用提取服務
 *   4. 返回結果
 *
 * @param request - Next.js 請求對象
 * @returns 提取結果
 *
 * @example
 *   // Request
 *   POST /api/extraction
 *   Content-Type: application/json
 *   Body: { "documentId": "uuid", "force": false }
 *
 *   // Response (200 OK)
 *   {
 *     "success": true,
 *     "data": {
 *       "id": "uuid",
 *       "documentId": "uuid",
 *       "extractedText": "...",
 *       "invoiceData": {...},
 *       "confidence": 0.95
 *     }
 *   }
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // ===========================================
    // 1. 認證檢查
    // ===========================================
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json(
        {
          success: false,
          error: {
            type: 'https://api.example.com/errors/unauthorized',
            title: 'Unauthorized',
            status: 401,
            detail: '請先登入',
          },
        },
        { status: 401 }
      )
    }

    // ===========================================
    // 2. 權限檢查
    // ===========================================
    if (!hasPermission(session.user, PERMISSIONS.INVOICE_CREATE)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            type: 'https://api.example.com/errors/forbidden',
            title: 'Forbidden',
            status: 403,
            detail: '您沒有執行 OCR 提取的權限',
          },
        },
        { status: 403 }
      )
    }

    // ===========================================
    // 3. 檢查 OCR 服務健康狀態
    // ===========================================
    const isHealthy = await checkOcrServiceHealth()
    if (!isHealthy) {
      return NextResponse.json(
        {
          success: false,
          error: {
            type: 'https://api.example.com/errors/service-unavailable',
            title: 'Service Unavailable',
            status: 503,
            detail: 'OCR 服務暫時無法使用，請稍後再試',
          },
        },
        { status: 503 }
      )
    }

    // ===========================================
    // 4. 解析和驗證請求
    // ===========================================
    const body = await request.json()
    const parseResult = extractRequestSchema.safeParse(body)

    if (!parseResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            type: 'https://api.example.com/errors/validation',
            title: 'Validation Error',
            status: 400,
            detail: 'Request validation failed',
            errors: parseResult.error.flatten().fieldErrors,
          },
        },
        { status: 400 }
      )
    }

    const { documentId, force } = parseResult.data

    // ===========================================
    // 5. 執行提取
    // ===========================================
    const result = await extractDocument(documentId, { force })

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            type: 'https://api.example.com/errors/extraction-failed',
            title: 'Extraction Failed',
            status: 422,
            detail: result.error || 'OCR extraction failed',
          },
          data: result.ocrResult,
        },
        { status: 422 }
      )
    }

    // ===========================================
    // 6. 返回成功響應
    // ===========================================
    return NextResponse.json(
      {
        success: true,
        data: result.ocrResult,
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('Extraction API error:', error)

    return NextResponse.json(
      {
        success: false,
        error: {
          type: 'https://api.example.com/errors/internal',
          title: 'Internal Server Error',
          status: 500,
          detail: 'An unexpected error occurred during extraction',
        },
      },
      { status: 500 }
    )
  }
}

// ============================================================
// Route Segment Config
// ============================================================

export const dynamic = 'force-dynamic'
