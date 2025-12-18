/**
 * @fileoverview 文件列表 API 端點
 * @description
 *   提供文件列表查詢功能：
 *   - 分頁和排序
 *   - 狀態篩選
 *   - 搜尋功能
 *   - 處理統計
 *
 *   端點：
 *   - GET /api/documents - 獲取文件列表
 *
 *   查詢參數：
 *   - page: 頁碼（預設 1）
 *   - pageSize: 每頁數量（預設 20）
 *   - status: 狀態篩選
 *   - search: 搜尋關鍵字
 *   - sortBy: 排序欄位
 *   - sortOrder: 排序方向
 *
 * @module src/app/api/documents/route
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
 *   - src/hooks/useDocuments.ts - React Query Hook
 *   - src/app/(dashboard)/invoices/page.tsx - 發票列表頁面
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import {
  getDocuments,
  getProcessingStatsEnhanced,
} from '@/services/document.service'
import type { DocumentStatus } from '@prisma/client'

// ============================================================
// GET /api/documents
// ============================================================

/**
 * GET /api/documents
 * 獲取文件列表（含分頁和統計）
 */
export async function GET(request: NextRequest) {
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

    // 解析查詢參數
    const { searchParams } = new URL(request.url)

    const page = parseInt(searchParams.get('page') || '1', 10)
    const pageSize = parseInt(searchParams.get('pageSize') || '20', 10)
    const status = searchParams.get('status') as DocumentStatus | null
    const search = searchParams.get('search') || undefined
    const sortBy =
      (searchParams.get('sortBy') as
        | 'createdAt'
        | 'fileName'
        | 'status'
        | 'fileSize') || 'createdAt'
    const sortOrder =
      (searchParams.get('sortOrder') as 'asc' | 'desc') || 'desc'

    // 並行獲取列表和統計
    const [result, stats] = await Promise.all([
      getDocuments({
        page,
        pageSize,
        status: status || undefined,
        search,
        sortBy,
        sortOrder,
      }),
      getProcessingStatsEnhanced(),
    ])

    return NextResponse.json({
      success: true,
      ...result,
      stats,
    })
  } catch (error) {
    console.error('Get documents error:', error)

    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    )
  }
}
