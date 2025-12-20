/**
 * @fileoverview 文件來源資訊 API
 * @description
 *   獲取指定文件的來源詳細資訊
 *
 * @module src/app/api/documents/[documentId]/source
 * @author Development Team
 * @since Epic 9 - Story 9.5 (自動獲取來源追蹤)
 * @lastModified 2025-12-20
 *
 * @api GET /api/documents/:documentId/source
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { DocumentSourceService } from '@/services/document-source.service'

interface RouteParams {
  params: Promise<{ documentId: string }>
}

/**
 * GET /api/documents/:documentId/source
 * 獲取文件來源資訊
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized', message: '請先登入' },
        { status: 401 }
      )
    }

    const { documentId } = await params
    const service = new DocumentSourceService(prisma)
    const sourceInfo = await service.getSourceInfo(documentId)

    if (!sourceInfo) {
      return NextResponse.json(
        { error: 'NotFound', message: '找不到指定的文件' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: sourceInfo,
    })
  } catch (error) {
    console.error('Failed to fetch document source info:', error)
    return NextResponse.json(
      { error: 'InternalError', message: '獲取來源資訊失敗' },
      { status: 500 }
    )
  }
}
