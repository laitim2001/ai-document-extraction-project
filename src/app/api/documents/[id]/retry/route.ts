/**
 * @fileoverview 文件重試處理 API 端點
 * @description
 *   提供失敗文件的重試處理功能：
 *   - 重置文件狀態
 *   - 重新觸發 OCR 處理
 *   - 僅允許失敗狀態的文件重試
 *
 *   端點：
 *   - POST /api/documents/[id]/retry - 重試處理失敗的文件
 *
 * @module src/app/api/documents/[id]/retry/route
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
 *   - src/components/features/invoice/RetryButton.tsx - 重試按鈕組件
 *   - src/hooks/useDocuments.ts - React Query Hook
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { retryProcessing } from '@/services/document.service'

// ============================================================
// Types
// ============================================================

interface RouteParams {
  params: Promise<{ id: string }>
}

// ============================================================
// POST /api/documents/[id]/retry
// ============================================================

/**
 * POST /api/documents/[id]/retry
 * 重試失敗的文件處理
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
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

    // 執行重試
    await retryProcessing(id)

    return NextResponse.json({
      success: true,
      message: 'Processing retry initiated',
    })
  } catch (error) {
    console.error('Retry error:', error)

    if (error instanceof Error) {
      // 文件不存在
      if (error.message.includes('not found')) {
        return NextResponse.json(
          {
            success: false,
            error: error.message,
          },
          { status: 404 }
        )
      }

      // 狀態不允許重試
      if (error.message.includes('Cannot retry')) {
        return NextResponse.json(
          {
            success: false,
            error: error.message,
          },
          { status: 400 }
        )
      }
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    )
  }
}
