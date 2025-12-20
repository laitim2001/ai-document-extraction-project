/**
 * @fileoverview 來源類型統計 API
 * @description
 *   獲取文件來源類型的統計數據
 *
 * @module src/app/api/documents/sources/stats
 * @author Development Team
 * @since Epic 9 - Story 9.5 (自動獲取來源追蹤)
 * @lastModified 2025-12-20
 *
 * @api GET /api/documents/sources/stats
 * @query cityId - 城市 ID 篩選
 * @query dateFrom - 開始日期
 * @query dateTo - 結束日期
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { DocumentSourceService } from '@/services/document-source.service'

/**
 * GET /api/documents/sources/stats
 * 獲取來源類型統計
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
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')

    const service = new DocumentSourceService(prisma)
    const stats = await service.getSourceTypeStats({
      cityId,
      dateFrom: dateFrom ? new Date(dateFrom) : undefined,
      dateTo: dateTo ? new Date(dateTo) : undefined,
    })

    return NextResponse.json({
      success: true,
      data: stats,
    })
  } catch (error) {
    console.error('Failed to fetch source type stats:', error)
    return NextResponse.json(
      { error: 'InternalError', message: '獲取統計資料失敗' },
      { status: 500 }
    )
  }
}
