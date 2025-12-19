/**
 * @fileoverview Forwarder 統計資料 API 端點
 * @description
 *   提供 Forwarder 處理統計資料的查詢 API。
 *   需要認證和 FORWARDER_VIEW 權限才能存取。
 *
 *   端點：
 *   - GET /api/forwarders/[id]/stats - 獲取統計資料
 *
 * @module src/app/api/forwarders/[id]/stats/route
 * @author Development Team
 * @since Epic 5 - Story 5.2 (Forwarder Detail Config View)
 * @lastModified 2025-12-19
 *
 * @features
 *   - 總文件數
 *   - 過去 30 天處理數
 *   - 成功率
 *   - 平均信心度
 *   - 每日趨勢資料
 *
 * @dependencies
 *   - next/server - Next.js API 處理
 *   - @/lib/auth - NextAuth 認證
 *   - @/services/forwarder.service - Forwarder 服務
 *   - @/types/forwarder - 類型定義
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getForwarderStatsById, forwarderExists } from '@/services/forwarder.service'
import { ForwarderIdSchema } from '@/types/forwarder'
import { hasPermission } from '@/lib/auth/city-permission'
import { PERMISSIONS } from '@/types/permissions'

/**
 * GET /api/forwarders/[id]/stats
 * 獲取 Forwarder 的統計資料
 *
 * @description
 *   獲取指定 Forwarder 的處理統計，包含：
 *   - 總文件數
 *   - 過去 30 天處理數
 *   - 成功率（百分比）
 *   - 平均信心度（百分比）
 *   - 每日趨勢資料（過去 30 天）
 *
 *   需要 FORWARDER_VIEW 權限。
 *
 * @param request - HTTP 請求
 * @param context - 路由參數（包含 id）
 * @returns 統計資料
 *
 * @example
 *   GET /api/forwarders/cuid123/stats
 *
 *   Response:
 *   {
 *     "success": true,
 *     "data": {
 *       "totalDocuments": 1500,
 *       "processedLast30Days": 150,
 *       "successRate": 92,
 *       "avgConfidence": 87,
 *       "dailyTrend": [
 *         { "date": "2025-11-19", "count": 5, "successCount": 4 },
 *         { "date": "2025-11-20", "count": 8, "successCount": 7 },
 *         ...
 *       ]
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
            detail: 'You do not have permission to view forwarder statistics',
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
            instance: `/api/forwarders/${idValidation.data.id}/stats`,
          },
        },
        { status: 404 }
      )
    }

    // 5. 獲取統計資料
    const stats = await getForwarderStatsById(idValidation.data.id)

    // 6. 返回成功響應
    return NextResponse.json({
      success: true,
      data: stats,
    })
  } catch (error) {
    console.error('Get forwarder stats error:', error)

    return NextResponse.json(
      {
        success: false,
        error: {
          type: 'https://api.example.com/errors/internal-server-error',
          title: 'Internal Server Error',
          status: 500,
          detail: 'Failed to fetch forwarder statistics',
        },
      },
      { status: 500 }
    )
  }
}
