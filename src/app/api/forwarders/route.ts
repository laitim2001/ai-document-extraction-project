/**
 * @fileoverview Forwarder API 端點
 * @description
 *   提供 Forwarder 相關的 RESTful API。
 *   需要認證和 FORWARDER_VIEW 權限才能存取。
 *
 *   端點：
 *   - GET /api/forwarders - 獲取 Forwarder 列表（支援分頁、搜尋、篩選、排序）
 *
 *   查詢參數：
 *   - search: 搜尋關鍵字（name, code, displayName）
 *   - isActive: 狀態篩選 (true/false)
 *   - page: 頁碼（預設 1）
 *   - limit: 每頁數量（預設 10，最大 100）
 *   - sortBy: 排序欄位 (name/code/updatedAt/createdAt/priority/ruleCount)
 *   - sortOrder: 排序方向 (asc/desc，預設 desc)
 *
 * @module src/app/api/forwarders/route
 * @author Development Team
 * @since Epic 2 - Story 2.3 (Forwarder Auto-Identification)
 * @lastModified 2025-12-19
 *
 * @features
 *   - 分頁查詢
 *   - 關鍵字搜尋
 *   - 狀態篩選
 *   - 多欄位排序
 *   - 規則數量統計
 *
 * @dependencies
 *   - next/server - Next.js API 處理
 *   - @/lib/auth - NextAuth 認證
 *   - @/services/forwarder.service - Forwarder 服務
 *   - @/types/forwarder - 類型定義
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getForwardersFromQuery } from '@/services/forwarder.service'
import { ForwardersQuerySchema } from '@/types/forwarder'
import { hasPermission } from '@/lib/auth/city-permission'
import { PERMISSIONS } from '@/types/permissions'

/**
 * GET /api/forwarders
 * 獲取 Forwarder 列表
 *
 * @description
 *   支援分頁、搜尋、篩選、排序的 Forwarder 列表查詢。
 *   需要 FORWARDER_VIEW 權限。
 *
 * @param request - HTTP 請求
 * @returns Forwarder 列表和分頁資訊
 *
 * @example
 *   GET /api/forwarders
 *   GET /api/forwarders?search=DHL&isActive=true&page=1&limit=10
 *   GET /api/forwarders?sortBy=name&sortOrder=asc
 *
 *   Response:
 *   {
 *     "success": true,
 *     "data": [
 *       {
 *         "id": "xxx",
 *         "code": "DHL",
 *         "name": "DHL Express",
 *         "displayName": "DHL Express",
 *         "isActive": true,
 *         "priority": 100,
 *         "ruleCount": 25,
 *         "updatedAt": "2025-12-19T10:00:00Z",
 *         "createdAt": "2025-01-01T00:00:00Z"
 *       }
 *     ],
 *     "meta": {
 *       "pagination": {
 *         "page": 1,
 *         "limit": 10,
 *         "total": 15,
 *         "totalPages": 2
 *       }
 *     }
 *   }
 */
export async function GET(request: NextRequest) {
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
            detail: 'You do not have permission to view forwarders',
          },
        },
        { status: 403 }
      )
    }

    // 3. 解析查詢參數
    const { searchParams } = new URL(request.url)
    const queryParams = {
      search: searchParams.get('search') || undefined,
      isActive: searchParams.get('isActive') || undefined,
      page: searchParams.get('page') || undefined,
      limit: searchParams.get('limit') || undefined,
      sortBy: searchParams.get('sortBy') || undefined,
      sortOrder: searchParams.get('sortOrder') || undefined,
    }

    // 4. 驗證查詢參數
    const validationResult = ForwardersQuerySchema.safeParse(queryParams)

    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            type: 'https://api.example.com/errors/validation',
            title: 'Validation Error',
            status: 400,
            detail: 'Invalid query parameters',
            errors: validationResult.error.flatten().fieldErrors,
          },
        },
        { status: 400 }
      )
    }

    // 5. 獲取 Forwarder 列表
    const result = await getForwardersFromQuery(validationResult.data)

    // 6. 返回成功響應
    return NextResponse.json({
      success: true,
      data: result.data,
      meta: {
        pagination: result.pagination,
      },
    })
  } catch (error) {
    console.error('Get forwarders error:', error)

    return NextResponse.json(
      {
        success: false,
        error: {
          type: 'https://api.example.com/errors/internal-server-error',
          title: 'Internal Server Error',
          status: 500,
          detail: 'Failed to fetch forwarders',
        },
      },
      { status: 500 }
    )
  }
}
