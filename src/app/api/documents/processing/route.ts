/**
 * @fileoverview 處理中文件列表 API 端點
 * @description
 *   提供處理中文件的查詢功能，包含：
 *   - 取得正在處理的文件清單
 *   - 支援城市和來源類型篩選
 *
 * @module src/app/api/documents/processing/route
 * @since Epic 10 - Story 10.6 (文件處理進度追蹤)
 * @lastModified 2025-12-20
 *
 * @features
 *   - GET: 獲取處理中文件列表
 *   - 城市篩選
 *   - 來源類型篩選
 *   - 數量限制
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
 * GET /api/documents/processing
 * 獲取處理中的文件列表
 *
 * @description
 *   返回目前正在處理中的文件清單，包含：
 *   - 文件基本資訊
 *   - 當前處理階段
 *   - 進度百分比
 *   - 預估完成時間
 *   - 來源資訊
 *
 * Query Parameters:
 *   - cityCode: string - 城市代碼（可選）
 *   - limit: number - 返回數量限制（預設 20，最多 100）
 *   - sourceType: string - 來源類型篩選（可選）
 *
 * Response:
 *   - 200: { success: true, data: ProcessingDocument[] }
 *   - 401: Unauthorized
 *   - 403: Access denied
 *   - 500: Internal server error
 *
 * @param request - Next.js 請求對象
 * @returns 處理中文件列表
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
    const cityCode = searchParams.get('cityCode') || undefined
    const limit = parseInt(searchParams.get('limit') || '20', 10)
    const sourceType = searchParams.get('sourceType') || undefined

    // 驗證城市權限
    const user = session.user as { cityAccess?: string[]; role?: string }
    const userCities = user.cityAccess || []
    const isGlobalAdmin = user.role === 'GLOBAL_ADMIN'

    if (cityCode && !isGlobalAdmin && !userCities.includes(cityCode) && !userCities.includes('*')) {
      return NextResponse.json(
        { success: false, error: 'Access denied' },
        { status: 403 }
      )
    }

    // 決定要查詢的城市
    let queryCityCode: string | undefined
    if (cityCode) {
      queryCityCode = cityCode
    } else if (!isGlobalAdmin && !userCities.includes('*') && userCities.length > 0) {
      // 如果用戶沒有指定城市且沒有全域權限，使用第一個可存取的城市
      queryCityCode = userCities[0]
    }

    // 獲取處理中文件
    const documents = await documentProgressService.getProcessingDocuments({
      cityCode: queryCityCode,
      limit: Math.min(limit, 100), // 最多 100 筆
      sourceType,
    })

    return NextResponse.json({
      success: true,
      data: documents,
      meta: {
        count: documents.length,
        limit: Math.min(limit, 100),
      },
    })
  } catch (error) {
    console.error('Get processing documents error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get processing documents',
      },
      { status: 500 }
    )
  }
}
