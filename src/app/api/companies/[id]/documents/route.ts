/**
 * @fileoverview Company 近期文件 API 端點
 * @description
 *   提供 Company 近期處理文件的查詢 API。
 *   需要認證和 FORWARDER_VIEW 權限才能存取。
 *
 *   端點：
 *   - GET /api/companies/[id]/documents - 獲取近期文件列表
 *
 *   查詢參數：
 *   - limit: 限制數量（預設 10，最大 50）
 *
 * @module src/app/api/companies/[id]/documents/route
 * @author Development Team
 * @since Epic 5 - Story 5.2 (Company Detail Config View)
 * @lastModified 2026-01-12
 *
 * @dependencies
 *   - next/server - Next.js API 處理
 *   - @/lib/auth - NextAuth 認證
 *   - @/services/forwarder.service - Company 服務
 *   - @/types/forwarder - 類型定義
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { getForwarderRecentDocuments, forwarderExists } from '@/services/forwarder.service'
import { ForwarderIdSchema } from '@/types/forwarder'
import { hasPermission } from '@/lib/auth/city-permission'
import { PERMISSIONS } from '@/types/permissions'

/**
 * 近期文件查詢參數 Schema
 */
const DocumentsQuerySchema = z.object({
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 10))
    .pipe(z.number().int().min(1).max(50)),
})

/**
 * GET /api/companies/[id]/documents
 * 獲取 Company 的近期文件列表
 *
 * @description
 *   獲取指定 Company 最近處理的文件列表，包含：
 *   - 文件 ID
 *   - 檔案名稱
 *   - 處理狀態
 *   - 信心度
 *   - 處理時間
 *   - 建立時間
 *
 *   需要 FORWARDER_VIEW 權限。
 *
 * @param request - HTTP 請求
 * @param context - 路由參數（包含 id）
 * @returns 近期文件列表
 *
 * @example
 *   GET /api/companies/cuid123/documents
 *   GET /api/companies/cuid123/documents?limit=5
 *
 *   Response:
 *   {
 *     "success": true,
 *     "data": [
 *       {
 *         "id": "doc123",
 *         "fileName": "invoice_2025001.pdf",
 *         "status": "COMPLETED",
 *         "confidence": 92,
 *         "processedAt": "2025-12-19T10:00:00Z",
 *         "createdAt": "2025-12-19T09:55:00Z"
 *       }
 *     ]
 *   }
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 1. 驗證認證狀態
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

    // 2. 驗證權限
    const canView = hasPermission(session.user, PERMISSIONS.FORWARDER_VIEW)
    if (!canView) {
      return NextResponse.json(
        {
          success: false,
          error: {
            type: 'https://api.example.com/errors/forbidden',
            title: 'Forbidden',
            status: 403,
            detail: 'You do not have permission to view company documents',
          },
        },
        { status: 403 }
      )
    }

    // 3. 獲取並驗證路由參數
    const resolvedParams = await params
    const idValidation = ForwarderIdSchema.safeParse({ id: resolvedParams.id })

    if (!idValidation.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            type: 'https://api.example.com/errors/validation',
            title: 'Validation Error',
            status: 400,
            detail: 'Invalid company ID',
            errors: idValidation.error.flatten().fieldErrors,
          },
        },
        { status: 400 }
      )
    }

    // 4. 檢查 Company 是否存在
    const exists = await forwarderExists(idValidation.data.id)
    if (!exists) {
      return NextResponse.json(
        {
          success: false,
          error: {
            type: 'https://api.example.com/errors/not-found',
            title: 'Not Found',
            status: 404,
            detail: `Company with ID '${idValidation.data.id}' not found`,
            instance: `/api/companies/${idValidation.data.id}/documents`,
          },
        },
        { status: 404 }
      )
    }

    // 5. 解析並驗證查詢參數
    const { searchParams } = new URL(request.url)
    const queryParams = {
      limit: searchParams.get('limit') || undefined,
    }

    const queryValidation = DocumentsQuerySchema.safeParse(queryParams)

    if (!queryValidation.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            type: 'https://api.example.com/errors/validation',
            title: 'Validation Error',
            status: 400,
            detail: 'Invalid query parameters',
            errors: queryValidation.error.flatten().fieldErrors,
          },
        },
        { status: 400 }
      )
    }

    // 6. 獲取近期文件
    const documents = await getForwarderRecentDocuments(
      idValidation.data.id,
      queryValidation.data.limit
    )

    // 7. 返回成功響應
    return NextResponse.json({
      success: true,
      data: documents,
    })
  } catch (error) {
    console.error('Get company documents error:', error)

    return NextResponse.json(
      {
        success: false,
        error: {
          type: 'https://api.example.com/errors/internal-server-error',
          title: 'Internal Server Error',
          status: 500,
          detail: 'Failed to fetch company documents',
        },
      },
      { status: 500 }
    )
  }
}
