/**
 * @fileoverview Company 識別 API 端點
 * @description
 *   提供 Company 自動識別功能的 RESTful API。
 *   從 OCR 文本識別對應的 Company。
 *
 *   端點：
 *   - POST /api/companies/identify - 識別 Company
 *
 *   信心度路由規則：
 *   - >= 80%: IDENTIFIED（自動識別，關聯文件）
 *   - 50-79%: NEEDS_REVIEW（需要人工審核）
 *   - < 50%: UNIDENTIFIED（無法識別）
 *
 * @module src/app/api/companies/identify/route
 * @author Development Team
 * @since Epic 2 - Story 2.3 (Company Auto-Identification)
 * @lastModified 2026-01-12
 *
 * @dependencies
 *   - next/server - Next.js API 處理
 *   - @/lib/auth - NextAuth 認證
 *   - @/services/identification - 識別服務
 *   - zod - 輸入驗證
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { identifyForwarder } from '@/services/identification'

// ============================================================
// Input Validation Schema
// ============================================================

/**
 * 識別請求 Schema
 */
const IdentifyRequestSchema = z.object({
  documentId: z.string().uuid('Invalid document ID format'),
  text: z.string().min(1, 'Text is required'),
})

// ============================================================
// API Handler
// ============================================================

/**
 * POST /api/companies/identify
 * 從 OCR 文本識別 Company
 *
 * @param request - HTTP 請求
 * @returns 識別結果
 *
 * @example
 *   POST /api/companies/identify
 *   Content-Type: application/json
 *
 *   {
 *     "documentId": "xxx-xxx-xxx",
 *     "text": "DHL Express Invoice..."
 *   }
 *
 *   Response:
 *   {
 *     "success": true,
 *     "data": {
 *       "documentId": "xxx-xxx-xxx",
 *       "companyId": "xxx",
 *       "companyCode": "DHL",
 *       "companyName": "DHL Express",
 *       "confidence": 85.5,
 *       "matchMethod": "name",
 *       "matchedPatterns": ["name:DHL Express", "keyword:waybill"],
 *       "isIdentified": true,
 *       "needsReview": false,
 *       "status": "IDENTIFIED"
 *     }
 *   }
 */
export async function POST(request: NextRequest) {
  try {
    // 驗證認證狀態
    const session = await auth()

    if (!session?.user) {
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

    // 解析請求體
    const body = await request.json()

    // 驗證輸入
    const validationResult = IdentifyRequestSchema.safeParse(body)

    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            type: 'https://api.example.com/errors/validation',
            title: 'Validation Error',
            status: 400,
            detail: 'Invalid request body',
            errors: validationResult.error.flatten().fieldErrors,
          },
        },
        { status: 400 }
      )
    }

    const { documentId, text } = validationResult.data

    // 執行識別
    const result = await identifyForwarder(documentId, text)

    // 檢查識別是否成功
    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            type: 'https://api.example.com/errors/identification-failed',
            title: 'Identification Failed',
            status: 500,
            detail: result.errorMessage || 'Failed to identify company',
          },
        },
        { status: 500 }
      )
    }

    // 返回成功結果
    return NextResponse.json({
      success: true,
      data: {
        documentId: result.documentId,
        companyId: result.forwarderId,
        companyCode: result.forwarderCode,
        companyName: result.forwarderName,
        confidence: result.confidence,
        matchMethod: result.matchMethod,
        matchedPatterns: result.matchedPatterns,
        matchDetails: result.matchDetails,
        isIdentified: result.isIdentified,
        needsReview: result.needsReview,
        status: result.status,
      },
    })
  } catch (error) {
    console.error('Identify company error:', error)

    // 檢查是否為 JSON 解析錯誤
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        {
          success: false,
          error: {
            type: 'https://api.example.com/errors/invalid-json',
            title: 'Invalid JSON',
            status: 400,
            detail: 'Request body is not valid JSON',
          },
        },
        { status: 400 }
      )
    }

    return NextResponse.json(
      {
        success: false,
        error: {
          type: 'https://api.example.com/errors/internal-server-error',
          title: 'Internal Server Error',
          status: 500,
          detail: 'Failed to identify company',
        },
      },
      { status: 500 }
    )
  }
}
