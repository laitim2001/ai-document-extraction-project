/**
 * @fileoverview Forwarder 規則列表 API 端點
 * @description
 *   提供 Forwarder 相關規則的分頁查詢 API。
 *   需要認證和 FORWARDER_VIEW 權限才能存取。
 *
 *   端點：
 *   - GET /api/forwarders/[id]/rules - 獲取規則列表（支援分頁、篩選、排序）
 *
 *   查詢參數：
 *   - status: 規則狀態篩選 (DRAFT/PENDING_REVIEW/ACTIVE/DEPRECATED)
 *   - search: 欄位名稱搜尋
 *   - page: 頁碼（預設 1）
 *   - limit: 每頁數量（預設 10，最大 100）
 *   - sortBy: 排序欄位 (fieldName/status/confidence/matchCount/updatedAt)
 *   - sortOrder: 排序方向 (asc/desc，預設 desc)
 *
 * @module src/app/api/forwarders/[id]/rules/route
 * @author Development Team
 * @since Epic 5 - Story 5.2 (Forwarder Detail Config View)
 * @lastModified 2025-12-19
 *
 * @dependencies
 *   - next/server - Next.js API 處理
 *   - @/lib/auth - NextAuth 認證
 *   - @/services/forwarder.service - Forwarder 服務
 *   - @/types/forwarder - 類型定義
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getForwarderRulesFromQuery, forwarderExists } from '@/services/forwarder.service'
import { ForwarderIdSchema, RulesQuerySchema } from '@/types/forwarder'
import { hasPermission } from '@/lib/auth/city-permission'
import { PERMISSIONS } from '@/types/permissions'

/**
 * GET /api/forwarders/[id]/rules
 * 獲取 Forwarder 的規則列表
 *
 * @description
 *   獲取指定 Forwarder 的映射規則列表，支援：
 *   - 狀態篩選
 *   - 欄位名稱搜尋
 *   - 分頁
 *   - 排序
 *
 *   需要 FORWARDER_VIEW 權限。
 *
 * @param request - HTTP 請求
 * @param context - 路由參數（包含 id）
 * @returns 規則列表和分頁資訊
 *
 * @example
 *   GET /api/forwarders/cuid123/rules
 *   GET /api/forwarders/cuid123/rules?status=ACTIVE&page=1&limit=10
 *
 *   Response:
 *   {
 *     "success": true,
 *     "data": [
 *       {
 *         "id": "rule123",
 *         "fieldName": "shipperName",
 *         "status": "ACTIVE",
 *         "version": 1,
 *         "confidence": 95,
 *         "matchCount": 150,
 *         "lastMatchedAt": "2025-12-19T10:00:00Z",
 *         "updatedAt": "2025-12-15T08:00:00Z"
 *       }
 *     ],
 *     "meta": {
 *       "pagination": {
 *         "page": 1,
 *         "limit": 10,
 *         "total": 25,
 *         "totalPages": 3
 *       }
 *     }
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
            detail: 'You do not have permission to view forwarder rules',
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
            detail: 'Invalid forwarder ID',
            errors: idValidation.error.flatten().fieldErrors,
          },
        },
        { status: 400 }
      )
    }

    // 4. 檢查 Forwarder 是否存在
    const exists = await forwarderExists(idValidation.data.id)
    if (!exists) {
      return NextResponse.json(
        {
          success: false,
          error: {
            type: 'https://api.example.com/errors/not-found',
            title: 'Not Found',
            status: 404,
            detail: `Forwarder with ID '${idValidation.data.id}' not found`,
            instance: `/api/forwarders/${idValidation.data.id}/rules`,
          },
        },
        { status: 404 }
      )
    }

    // 5. 解析並驗證查詢參數
    const { searchParams } = new URL(request.url)
    const queryParams = {
      status: searchParams.get('status') || undefined,
      search: searchParams.get('search') || undefined,
      page: searchParams.get('page') || undefined,
      limit: searchParams.get('limit') || undefined,
      sortBy: searchParams.get('sortBy') || undefined,
      sortOrder: searchParams.get('sortOrder') || undefined,
    }

    const queryValidation = RulesQuerySchema.safeParse(queryParams)

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

    // 6. 獲取規則列表
    const result = await getForwarderRulesFromQuery(idValidation.data.id, queryValidation.data)

    // 7. 返回成功響應
    return NextResponse.json({
      success: true,
      data: result.data,
      meta: {
        pagination: result.pagination,
      },
    })
  } catch (error) {
    console.error('Get forwarder rules error:', error)

    return NextResponse.json(
      {
        success: false,
        error: {
          type: 'https://api.example.com/errors/internal-server-error',
          title: 'Internal Server Error',
          status: 500,
          detail: 'Failed to fetch forwarder rules',
        },
      },
      { status: 500 }
    )
  }
}
