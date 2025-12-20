/**
 * @fileoverview 來源類型趨勢 API
 * @description
 *   獲取文件來源類型的趨勢數據（按月）
 *
 * @module src/app/api/documents/sources/trend
 * @author Development Team
 * @since Epic 9 - Story 9.5 (自動獲取來源追蹤)
 * @lastModified 2025-12-20
 *
 * @api GET /api/documents/sources/trend
 * @query cityId - 城市 ID 篩選
 * @query months - 顯示月數 (預設 6，最多 12)
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { DocumentSourceService } from '@/services/document-source.service'

/**
 * GET /api/documents/sources/trend
 * 獲取來源類型趨勢
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized', message: '請先登入' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const cityId = searchParams.get('cityId') || undefined
    const months = parseInt(searchParams.get('months') || '6')

    const service = new DocumentSourceService(prisma)
    const trend = await service.getSourceTypeTrend({
      cityId,
      months: Math.min(months, 12), // 最多 12 個月
    })

    return NextResponse.json({
      success: true,
      data: trend,
    })
  } catch (error) {
    console.error('Failed to fetch source type trend:', error)
    return NextResponse.json(
      { error: 'InternalError', message: '獲取趨勢資料失敗' },
      { status: 500 }
    )
  }
}
