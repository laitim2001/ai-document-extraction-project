/**
 * @fileoverview 審核隊列 API 端點
 * @description
 *   提供待審核發票列表查詢功能：
 *   - 獲取待審核（PENDING）狀態的發票
 *   - 支援 Forwarder、處理路徑、信心度範圍篩選
 *   - 分頁和排序（優先級優先，最舊優先）
 *
 *   端點：
 *   - GET /api/review - 獲取待審核列表
 *
 *   查詢參數：
 *   - page: 頁碼（預設 1）
 *   - pageSize: 每頁數量（預設 20）
 *   - forwarderId: Forwarder ID 篩選
 *   - processingPath: 處理路徑篩選
 *   - minConfidence: 最低信心度（0-100）
 *   - maxConfidence: 最高信心度（0-100）
 *
 * @module src/app/api/review/route
 * @author Development Team
 * @since Epic 3 - Story 3.1 (Pending Review Invoice List)
 * @lastModified 2025-12-18
 *
 * @dependencies
 *   - next/server - Next.js API 處理
 *   - @/lib/auth - NextAuth 認證
 *   - @/lib/prisma - Prisma 客戶端
 *
 * @related
 *   - src/hooks/useReviewQueue.ts - React Query Hook
 *   - src/app/(dashboard)/review/page.tsx - 審核列表頁面
 *   - src/types/review.ts - 類型定義
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ProcessingPath, QueueStatus, Prisma } from '@prisma/client'
import type { ReviewQueueItem } from '@/types/review'

// ============================================================
// Types
// ============================================================

interface ConfidenceScores {
  overallScore: number
  level: string
  [key: string]: unknown
}

// ============================================================
// GET /api/review
// ============================================================

/**
 * GET /api/review
 * 獲取待審核發票列表（含分頁和篩選）
 */
export async function GET(request: NextRequest) {
  try {
    // 認證檢查
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json(
        {
          success: false,
          error: {
            type: 'unauthorized',
            title: 'Unauthorized',
            status: 401,
            detail: 'Authentication required',
          },
        },
        { status: 401 }
      )
    }

    // 解析查詢參數
    const { searchParams } = new URL(request.url)

    const page = parseInt(searchParams.get('page') || '1', 10)
    const pageSize = parseInt(searchParams.get('pageSize') || '20', 10)
    const forwarderId = searchParams.get('forwarderId')
    const processingPath = searchParams.get('processingPath') as ProcessingPath | null
    const minConfidence = parseFloat(searchParams.get('minConfidence') || '0')
    const maxConfidence = parseFloat(searchParams.get('maxConfidence') || '100')

    // 驗證分頁參數
    const validPage = Math.max(1, page)
    const validPageSize = Math.min(Math.max(1, pageSize), 100)

    // 構建基礎查詢條件
    const baseWhere: Prisma.ProcessingQueueWhereInput = {
      status: QueueStatus.PENDING,
      // 只查詢需要人工審核的路徑（排除 AUTO_APPROVE）
      processingPath: processingPath || {
        in: [ProcessingPath.QUICK_REVIEW, ProcessingPath.FULL_REVIEW],
      },
      // Forwarder 篩選
      ...(forwarderId && {
        document: { forwarderId },
      }),
    }

    // 查詢數據（信心度篩選在應用層進行，因此需要查詢所有符合條件的記錄）
    const allItems = await prisma.processingQueue.findMany({
      where: baseWhere,
      include: {
        document: {
          include: {
            forwarder: {
              select: { id: true, name: true, code: true },
            },
            extractionResult: {
              select: {
                confidenceScores: true,
                averageConfidence: true,
              },
            },
          },
        },
      },
      orderBy: [
        { priority: 'desc' }, // 高優先級優先
        { enteredAt: 'asc' }, // 最舊優先
      ],
    })

    // 處理信心度篩選和轉換響應格式
    // 由於信心度存在於 JSON 欄位，需要在應用層進行篩選
    const filteredItems = allItems.filter((item) => {
      const confidence = getOverallConfidence(item.document.extractionResult)
      return confidence >= minConfidence && confidence <= maxConfidence
    })

    // 計算實際篩選後的分頁
    const filteredTotal = filteredItems.length
    const paginatedItems = filteredItems.slice(
      (validPage - 1) * validPageSize,
      validPage * validPageSize
    )

    // 轉換響應格式
    const data: ReviewQueueItem[] = paginatedItems.map((item) => ({
      id: item.id,
      document: {
        id: item.document.id,
        fileName: item.document.fileName,
        createdAt: item.document.createdAt.toISOString(),
      },
      forwarder: item.document.forwarder
        ? {
            id: item.document.forwarder.id,
            name: item.document.forwarder.name,
            code: item.document.forwarder.code,
          }
        : null,
      processingPath: item.processingPath,
      overallConfidence: getOverallConfidence(item.document.extractionResult),
      priority: item.priority,
      status: item.status,
      routingReason: item.routingReason,
    }))

    return NextResponse.json({
      success: true,
      data,
      meta: {
        total: filteredTotal,
        page: validPage,
        pageSize: validPageSize,
        totalPages: Math.ceil(filteredTotal / validPageSize),
      },
    })
  } catch (error) {
    console.error('Get review queue error:', error)

    return NextResponse.json(
      {
        success: false,
        error: {
          type: 'internal_error',
          title: 'Internal Server Error',
          status: 500,
          detail: 'Failed to fetch review queue',
        },
      },
      { status: 500 }
    )
  }
}

// ============================================================
// Helper Functions
// ============================================================

/**
 * 從 ExtractionResult 獲取整體信心度分數
 * @param extractionResult - 提取結果（含 confidenceScores）
 * @returns 信心度分數（0-100）
 */
function getOverallConfidence(
  extractionResult: {
    confidenceScores: Prisma.JsonValue
    averageConfidence: number
  } | null
): number {
  if (!extractionResult) {
    return 0
  }

  // 優先使用 confidenceScores.overallScore
  if (extractionResult.confidenceScores) {
    const scores = extractionResult.confidenceScores as ConfidenceScores
    if (typeof scores.overallScore === 'number') {
      return Math.round(scores.overallScore)
    }
  }

  // 回退到 averageConfidence
  return Math.round(extractionResult.averageConfidence)
}
