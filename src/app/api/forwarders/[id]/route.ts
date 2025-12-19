/**
 * @fileoverview Forwarder 詳情 API 端點
 * @description
 *   提供單一 Forwarder 的詳情查詢 API。
 *   需要認證和 FORWARDER_VIEW 權限才能存取。
 *
 *   端點：
 *   - GET /api/forwarders/[id] - 獲取 Forwarder 詳情（含統計、規則摘要、近期文件）
 *
 * @module src/app/api/forwarders/[id]/route
 * @author Development Team
 * @since Epic 5 - Story 5.2 (Forwarder Detail Config View)
 * @lastModified 2025-12-19
 *
 * @features
 *   - Forwarder 基本資訊
 *   - 規則摘要（按狀態分組）
 *   - 處理統計（成功率、信心度、趨勢）
 *   - 近期文件列表
 *
 * @dependencies
 *   - next/server - Next.js API 處理
 *   - @/lib/auth - NextAuth 認證
 *   - @/services/forwarder.service - Forwarder 服務
 *   - @/types/forwarder - 類型定義
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getForwarderDetailView } from '@/services/forwarder.service'
import { ForwarderIdSchema } from '@/types/forwarder'
import { hasPermission } from '@/lib/auth/city-permission'
import { PERMISSIONS } from '@/types/permissions'

/**
 * GET /api/forwarders/[id]
 * 獲取 Forwarder 詳情
 *
 * @description
 *   獲取單一 Forwarder 的完整詳情，包含：
 *   - 基本資訊（名稱、代碼、狀態等）
 *   - 識別模式
 *   - 規則摘要（按狀態分組的數量）
 *   - 處理統計（成功率、平均信心度、30 天趨勢）
 *   - 近期文件列表（最多 10 筆）
 *
 *   需要 FORWARDER_VIEW 權限。
 *
 * @param request - HTTP 請求
 * @param context - 路由參數（包含 id）
 * @returns Forwarder 詳情
 *
 * @example
 *   GET /api/forwarders/cuid123
 *
 *   Response:
 *   {
 *     "success": true,
 *     "data": {
 *       "id": "cuid123",
 *       "name": "DHL Express",
 *       "code": "DHL",
 *       "displayName": "DHL Express",
 *       "isActive": true,
 *       "priority": 100,
 *       "ruleCount": 25,
 *       "documentCount": 1500,
 *       "identificationPatterns": [...],
 *       "rulesSummary": {
 *         "total": 25,
 *         "byStatus": { "active": 20, "draft": 3, "pendingReview": 2, "deprecated": 0 }
 *       },
 *       "stats": {
 *         "totalDocuments": 1500,
 *         "processedLast30Days": 150,
 *         "successRate": 92,
 *         "avgConfidence": 87,
 *         "dailyTrend": [...]
 *       },
 *       "recentDocuments": [...]
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
            detail: 'You do not have permission to view forwarders',
          },
        },
        { status: 403 }
      )
    }

    // 3. 獲取並驗證路由參數
    const resolvedParams = await params
    const validationResult = ForwarderIdSchema.safeParse({ id: resolvedParams.id })

    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            type: 'https://api.example.com/errors/validation',
            title: 'Validation Error',
            status: 400,
            detail: 'Invalid forwarder ID',
            errors: validationResult.error.flatten().fieldErrors,
          },
        },
        { status: 400 }
      )
    }

    // 4. 獲取 Forwarder 詳情
    const forwarder = await getForwarderDetailView(validationResult.data.id)

    if (!forwarder) {
      return NextResponse.json(
        {
          success: false,
          error: {
            type: 'https://api.example.com/errors/not-found',
            title: 'Not Found',
            status: 404,
            detail: `Forwarder with ID '${validationResult.data.id}' not found`,
            instance: `/api/forwarders/${validationResult.data.id}`,
          },
        },
        { status: 404 }
      )
    }

    // 5. 返回成功響應
    return NextResponse.json({
      success: true,
      data: forwarder,
    })
  } catch (error) {
    console.error('Get forwarder detail error:', error)

    return NextResponse.json(
      {
        success: false,
        error: {
          type: 'https://api.example.com/errors/internal-server-error',
          title: 'Internal Server Error',
          status: 500,
          detail: 'Failed to fetch forwarder details',
        },
      },
      { status: 500 }
    )
  }
}
