/**
 * @fileoverview 處理統計 API 端點
 * @description
 *   提供文件處理統計的查詢功能，包含：
 *   - 數量統計（處理中、完成、失敗）
 *   - 時間統計（平均、最短、最長處理時間）
 *   - 階段統計（各階段平均時間、失敗率）
 *   - 來源分布
 *
 * @module src/app/api/documents/processing/stats/route
 * @since Epic 10 - Story 10.6 (文件處理進度追蹤)
 * @lastModified 2025-12-20
 *
 * @features
 *   - GET: 獲取處理統計
 *   - 支援日/週/月統計週期
 *   - 城市權限驗證
 *
 * @dependencies
 *   - @/lib/auth - 認證函數
 *   - @/services/document-progress.service - 進度服務
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { documentProgressService } from '@/services/document-progress.service'

// ============================================================
// GET Handler
// ============================================================

/**
 * GET /api/documents/processing/stats
 * 獲取處理統計
 *
 * @description
 *   返回指定城市和時間段的處理統計資料：
 *   - 數量統計：總處理數、完成數、失敗數、處理中數
 *   - 時間統計：平均、最短、最長、P95 處理時間
 *   - 階段統計：各階段平均時間、失敗率、跳過率
 *   - 來源分布：各來源類型的數量和百分比
 *
 * Query Parameters:
 *   - cityCode: string - 城市代碼（必填）
 *   - period: 'day' | 'week' | 'month' - 統計週期（預設 'day'）
 *
 * Response:
 *   - 200: { success: true, data: ProcessingStatistics }
 *   - 400: Missing cityCode or invalid period
 *   - 401: Unauthorized
 *   - 403: Access denied
 *   - 500: Internal server error
 *
 * @param request - Next.js 請求對象
 * @returns 處理統計資料
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  // 驗證認證
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    )
  }

  try {
    // 解析查詢參數
    const searchParams = request.nextUrl.searchParams
    const cityCode = searchParams.get('cityCode')
    const period = searchParams.get('period') || 'day'

    // 驗證必填參數
    if (!cityCode) {
      return NextResponse.json(
        { success: false, error: 'cityCode is required' },
        { status: 400 }
      )
    }

    // 驗證週期參數
    if (!['day', 'week', 'month'].includes(period)) {
      return NextResponse.json(
        { success: false, error: 'Invalid period. Must be day, week, or month' },
        { status: 400 }
      )
    }

    // 驗證城市權限
    const user = session.user as { cityAccess?: string[]; role?: string }
    const userCities = user.cityAccess || []
    const isGlobalAdmin = user.role === 'GLOBAL_ADMIN'

    if (!isGlobalAdmin && !userCities.includes(cityCode) && !userCities.includes('*')) {
      return NextResponse.json(
        { success: false, error: 'Access denied' },
        { status: 403 }
      )
    }

    // 獲取處理統計
    const statistics = await documentProgressService.getProcessingStatistics(
      cityCode,
      period as 'day' | 'week' | 'month'
    )

    return NextResponse.json({
      success: true,
      data: statistics,
    })
  } catch (error) {
    console.error('Get processing statistics error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get processing statistics',
      },
      { status: 500 }
    )
  }
}
