/**
 * @fileoverview 文件搜尋 API (支援來源篩選)
 * @description
 *   搜尋文件，支援按來源類型、寄件者、主旨等條件篩選
 *
 * @module src/app/api/documents/search
 * @author Development Team
 * @since Epic 9 - Story 9.5 (自動獲取來源追蹤)
 * @lastModified 2025-12-20
 *
 * @api GET /api/documents/search
 * @query sourceType - 來源類型篩選 (MANUAL_UPLOAD, SHAREPOINT, OUTLOOK, API)
 * @query senderEmail - 寄件者 Email (Outlook)
 * @query subject - 郵件主旨 (Outlook)
 * @query sharepointUrl - SharePoint URL
 * @query cityId - 城市 ID
 * @query page - 頁碼 (預設 1)
 * @query limit - 每頁數量 (預設 20)
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { DocumentSourceService } from '@/services/document-source.service'
import { DocumentSourceType } from '@prisma/client'

/**
 * GET /api/documents/search
 * 搜尋文件 (支援來源篩選)
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

    const sourceService = new DocumentSourceService(prisma)
    const result = await sourceService.searchBySource({
      sourceType:
        (searchParams.get('sourceType') as DocumentSourceType) || undefined,
      senderEmail: searchParams.get('senderEmail') || undefined,
      subject: searchParams.get('subject') || undefined,
      sharepointUrl: searchParams.get('sharepointUrl') || undefined,
      cityId: searchParams.get('cityId') || undefined,
      page: parseInt(searchParams.get('page') || '1'),
      limit: parseInt(searchParams.get('limit') || '20'),
    })

    return NextResponse.json({
      success: true,
      data: result,
    })
  } catch (error) {
    console.error('Failed to search documents:', error)
    return NextResponse.json(
      { error: 'InternalError', message: '搜尋文件失敗' },
      { status: 500 }
    )
  }
}
