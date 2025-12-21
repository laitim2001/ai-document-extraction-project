/**
 * @fileoverview 文件處理進度 API 端點
 * @description
 *   提供文件處理進度的查詢功能，包含：
 *   - 完整處理時間軸
 *   - 即時進度更新（輪詢用）
 *
 * @module src/app/api/documents/[id]/progress/route
 * @since Epic 10 - Story 10.6 (文件處理進度追蹤)
 * @lastModified 2025-12-20
 *
 * @features
 *   - GET: 獲取文件處理進度
 *   - 支援完整時間軸 (full=true) 或簡要進度
 *   - 城市權限驗證
 *
 * @dependencies
 *   - @/lib/auth - 認證函數
 *   - @/services/document-progress.service - 進度服務
 *   - @/lib/prisma - 資料庫客戶端
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { documentProgressService } from '@/services/document-progress.service'
import { prisma } from '@/lib/prisma'

// ============================================================
// Types
// ============================================================

interface RouteParams {
  id: string
}

// ============================================================
// GET Handler
// ============================================================

/**
 * GET /api/documents/[id]/progress
 * 獲取文件處理進度
 *
 * @description
 *   返回文件的處理進度資訊：
 *   - full=true: 完整處理時間軸（含所有階段詳情）
 *   - full=false（預設）: 簡要進度（用於輪詢）
 *
 * Query Parameters:
 *   - full: boolean - 是否返回完整時間軸（預設 false）
 *
 * Response:
 *   - 200: { success: true, data: ProcessingTimeline | ProcessingProgress }
 *   - 401: Unauthorized
 *   - 403: Access denied
 *   - 404: Document not found
 *   - 500: Internal server error
 *
 * @param request - Next.js 請求對象
 * @param context - 路由參數
 * @returns 文件處理進度
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<RouteParams> }
): Promise<NextResponse> {
  // 驗證認證
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    )
  }

  const { id } = await context.params

  try {
    // 先獲取文件以驗證權限
    const document = await prisma.document.findUnique({
      where: { id },
      select: { cityCode: true },
    })

    if (!document) {
      return NextResponse.json(
        { success: false, error: 'Document not found' },
        { status: 404 }
      )
    }

    // 驗證城市權限
    const user = session.user as { cityAccess?: string[]; role?: string }
    const userCities = user.cityAccess || []
    const isGlobalAdmin = user.role === 'GLOBAL_ADMIN'

    if (!isGlobalAdmin && !userCities.includes(document.cityCode) && !userCities.includes('*')) {
      return NextResponse.json(
        { success: false, error: 'Access denied' },
        { status: 403 }
      )
    }

    // 解析查詢參數
    const searchParams = request.nextUrl.searchParams
    const full = searchParams.get('full') === 'true'

    if (full) {
      // 完整時間軸
      const timeline = await documentProgressService.getProcessingTimeline(id)
      return NextResponse.json({ success: true, data: timeline })
    } else {
      // 簡要進度（用於輪詢）
      const progress = await documentProgressService.getProgressUpdate(id)
      return NextResponse.json({ success: true, data: progress })
    }
  } catch (error) {
    console.error('Get document progress error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get document progress',
      },
      { status: 500 }
    )
  }
}
