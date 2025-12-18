/**
 * @fileoverview 處理隊列 API 端點
 * @description
 *   提供處理隊列查詢相關操作：
 *   - GET /api/routing/queue - 取得處理隊列列表和統計
 *
 *   ## 隊列功能
 *
 *   - 按處理路徑過濾（QUICK_REVIEW, FULL_REVIEW, MANUAL_REQUIRED）
 *   - 按狀態過濾（PENDING, IN_PROGRESS, COMPLETED 等）
 *   - 按優先級和時間排序
 *   - 包含隊列統計資訊
 *
 * @module src/app/api/routing/queue/route
 * @since Epic 2 - Story 2.6 (Processing Path Auto Routing)
 * @lastModified 2025-12-18
 *
 * @dependencies
 *   - next/server - Next.js API 處理
 *   - @/lib/auth - NextAuth 認證
 *   - @/services/routing.service - 路由服務
 *
 * @related
 *   - src/services/routing.service.ts - 路由業務邏輯
 *   - src/types/routing.ts - 路由類型定義
 *   - prisma/schema.prisma - ProcessingQueue 模型
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { ProcessingPath, QueueStatus } from '@prisma/client'
import { getProcessingQueue, getQueueStats } from '@/services/routing.service'

// ============================================================
// GET /api/routing/queue - 取得處理隊列
// ============================================================

/**
 * 取得處理隊列列表和統計
 *
 * @description
 *   查詢處理隊列，支援按路徑和狀態過濾。
 *   同時返回隊列統計資訊。
 *
 * @query path - 處理路徑過濾（QUICK_REVIEW, FULL_REVIEW, MANUAL_REQUIRED）
 * @query status - 狀態過濾（預設 PENDING）
 * @query limit - 數量限制（預設 50，最大 100）
 * @query includeStats - 是否包含統計資訊（預設 true）
 *
 * @returns 隊列列表和統計
 *
 * @example
 *   GET /api/routing/queue
 *   GET /api/routing/queue?path=QUICK_REVIEW&status=PENDING
 *   GET /api/routing/queue?limit=20&includeStats=true
 */
export async function GET(request: NextRequest) {
  try {
    // 驗證認證狀態
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json(
        {
          success: false,
          error: {
            type: 'https://api.example.com/errors/unauthorized',
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
    const pathParam = searchParams.get('path')
    const statusParam = searchParams.get('status')
    const limitParam = searchParams.get('limit')
    const includeStatsParam = searchParams.get('includeStats')

    // 驗證 path 參數
    let path: ProcessingPath | undefined
    if (pathParam) {
      const validPaths: ProcessingPath[] = [
        'AUTO_APPROVE',
        'QUICK_REVIEW',
        'FULL_REVIEW',
        'MANUAL_REQUIRED',
      ]
      if (!validPaths.includes(pathParam as ProcessingPath)) {
        return NextResponse.json(
          {
            success: false,
            error: {
              type: 'https://api.example.com/errors/validation',
              title: 'Validation Error',
              status: 400,
              detail: `Invalid path parameter. Must be one of: ${validPaths.join(', ')}`,
            },
          },
          { status: 400 }
        )
      }
      path = pathParam as ProcessingPath
    }

    // 驗證 status 參數
    let status: QueueStatus = QueueStatus.PENDING
    if (statusParam) {
      const validStatuses: QueueStatus[] = [
        'PENDING',
        'IN_PROGRESS',
        'COMPLETED',
        'SKIPPED',
        'CANCELLED',
      ]
      if (!validStatuses.includes(statusParam as QueueStatus)) {
        return NextResponse.json(
          {
            success: false,
            error: {
              type: 'https://api.example.com/errors/validation',
              title: 'Validation Error',
              status: 400,
              detail: `Invalid status parameter. Must be one of: ${validStatuses.join(', ')}`,
            },
          },
          { status: 400 }
        )
      }
      status = statusParam as QueueStatus
    }

    // 解析 limit 參數
    const limit = Math.min(Math.max(parseInt(limitParam || '50', 10) || 50, 1), 100)

    // 是否包含統計
    const includeStats = includeStatsParam !== 'false'

    // 並行查詢隊列和統計
    const [queue, stats] = await Promise.all([
      getProcessingQueue(path, status, limit),
      includeStats ? getQueueStats() : null,
    ])

    return NextResponse.json({
      success: true,
      data: queue,
      meta: {
        count: queue.length,
        limit,
        filters: {
          path: path || null,
          status,
        },
        ...(stats && { stats }),
      },
    })
  } catch (error) {
    console.error('[QueueAPI] GET error:', error)

    return NextResponse.json(
      {
        success: false,
        error: {
          type: 'https://api.example.com/errors/internal',
          title: 'Internal Server Error',
          status: 500,
          detail: error instanceof Error ? error.message : 'Failed to get processing queue',
        },
      },
      { status: 500 }
    )
  }
}
