/**
 * @fileoverview 單個文件詳情 API 端點
 * @description
 *   提供單個文件的詳細資訊查詢：
 *   - 文件基本資訊
 *   - 上傳者資訊
 *   - OCR 結果
 *   - 處理狀態
 *
 *   端點：
 *   - GET /api/documents/[id] - 獲取文件詳情
 *
 * @module src/app/api/documents/[id]/route
 * @author Development Team
 * @since Epic 2 - Story 2.7 (Processing Status Tracking & Display)
 * @lastModified 2025-12-18
 *
 * @dependencies
 *   - next/server - Next.js API 處理
 *   - @/lib/auth - NextAuth 認證
 *   - @/services/document.service - Document 服務層
 *
 * @related
 *   - src/hooks/useDocument.ts - React Query Hook
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getDocumentWithRelations } from '@/services/document.service'

// ============================================================
// Types
// ============================================================

interface RouteParams {
  params: Promise<{ id: string }>
}

// ============================================================
// GET /api/documents/[id]
// ============================================================

/**
 * GET /api/documents/[id]
 * 獲取單個文件詳情
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    // 認證檢查
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json(
        {
          success: false,
          error: 'Unauthorized',
        },
        { status: 401 }
      )
    }

    const { id } = await params

    // 獲取文件詳情
    const document = await getDocumentWithRelations(id)

    if (!document) {
      return NextResponse.json(
        {
          success: false,
          error: 'Document not found',
        },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: document,
    })
  } catch (error) {
    console.error('Get document error:', error)

    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    )
  }
}
