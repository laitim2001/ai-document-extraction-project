/**
 * @fileoverview 歷史數據文件處理結果 API
 * @description
 *   提供文件 AI 處理結果的查詢功能：
 *   - GET: 取得文件的 AI 處理結果
 *   - 包含處理方式、耗時、成本、提取結果
 *
 * @module src/app/api/admin/historical-data/files/[id]/result
 * @since Epic 0 - Story 0.2
 * @lastModified 2025-12-23
 *
 * @features
 *   - 處理方式查詢（Azure DI / GPT Vision）
 *   - 處理耗時計算
 *   - 實際成本顯示
 *   - 提取結果資料
 *
 * @dependencies
 *   - Prisma Client - 數據庫操作
 *   - auth - 認證檢查
 *
 * @related
 *   - src/services/batch-processor.service.ts - 批量處理執行器
 *   - src/services/gpt-vision.service.ts - GPT Vision 服務
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { HistoricalFileStatus } from '@prisma/client'

// ============================================================
// Types
// ============================================================

interface RouteContext {
  params: Promise<{ id: string }>
}

/**
 * 處理結果響應資料
 */
interface ProcessingResultData {
  /** 文件 ID */
  fileId: string
  /** 文件名稱 */
  fileName: string
  /** 處理狀態 */
  status: HistoricalFileStatus
  /** 處理方式 */
  processingMethod: string | null
  /** 處理開始時間 */
  processingStartAt: string | null
  /** 處理結束時間 */
  processingEndAt: string | null
  /** 處理耗時（毫秒） */
  processingDurationMs: number | null
  /** 實際成本（USD） */
  actualCost: number | null
  /** 提取結果 */
  extractionResult: Record<string, unknown> | null
  /** 錯誤訊息（如果處理失敗） */
  errorMessage: string | null
  /** 信心度（如果有） */
  confidence: number | null
}

// ============================================================
// Helper Functions
// ============================================================

/**
 * 計算處理耗時（毫秒）
 *
 * @param startAt - 開始時間
 * @param endAt - 結束時間
 * @returns 耗時（毫秒）或 null
 */
function calculateDuration(
  startAt: Date | null,
  endAt: Date | null
): number | null {
  if (!startAt || !endAt) {
    return null
  }
  return endAt.getTime() - startAt.getTime()
}

/**
 * 從提取結果中取得信心度
 *
 * @param extractionResult - 提取結果 JSON
 * @returns 信心度（0-1）或 null
 */
function getConfidenceFromResult(
  extractionResult: unknown
): number | null {
  if (!extractionResult || typeof extractionResult !== 'object') {
    return null
  }

  const result = extractionResult as Record<string, unknown>

  // 嘗試從不同位置取得信心度
  if (typeof result.confidence === 'number') {
    return result.confidence
  }

  return null
}

// ============================================================
// GET /api/admin/historical-data/files/[id]/result
// ============================================================

/**
 * 取得文件處理結果
 *
 * @description
 *   返回 AI 處理的詳細結果，包含：
 *   - 使用的處理方式（Azure DI / GPT Vision）
 *   - 處理耗時
 *   - 實際成本
 *   - 提取的結構化資料
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    // 認證檢查
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/unauthorized',
          title: 'Unauthorized',
          status: 401,
          detail: '請先登入',
        },
        { status: 401 }
      )
    }

    const { id } = await context.params

    // 查詢文件資料
    const file = await prisma.historicalFile.findUnique({
      where: { id },
      select: {
        id: true,
        fileName: true,
        originalName: true,
        status: true,
        processingMethod: true,
        processingStartAt: true,
        processingEndAt: true,
        actualCost: true,
        extractionResult: true,
        errorMessage: true,
        batch: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    if (!file) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/not-found',
          title: 'Not Found',
          status: 404,
          detail: '找不到指定的文件',
        },
        { status: 404 }
      )
    }

    // 檢查文件是否已處理
    if (
      file.status !== HistoricalFileStatus.COMPLETED &&
      file.status !== HistoricalFileStatus.FAILED
    ) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/precondition-failed',
          title: 'Precondition Failed',
          status: 412,
          detail: '文件尚未完成處理',
          instance: `/api/admin/historical-data/files/${id}/result`,
          currentStatus: file.status,
        },
        { status: 412 }
      )
    }

    // 計算處理耗時
    const processingDurationMs = calculateDuration(
      file.processingStartAt,
      file.processingEndAt
    )

    // 取得信心度
    const confidence = getConfidenceFromResult(file.extractionResult)

    // 構建響應資料
    const resultData: ProcessingResultData = {
      fileId: file.id,
      fileName: file.originalName || file.fileName,
      status: file.status,
      processingMethod: file.processingMethod,
      processingStartAt: file.processingStartAt?.toISOString() || null,
      processingEndAt: file.processingEndAt?.toISOString() || null,
      processingDurationMs,
      actualCost: file.actualCost,
      extractionResult: file.extractionResult as Record<string, unknown> | null,
      errorMessage: file.errorMessage,
      confidence,
    }

    return NextResponse.json({
      success: true,
      data: resultData,
      meta: {
        batch: file.batch,
        costCurrency: 'USD',
        durationUnit: 'milliseconds',
      },
    })
  } catch (error) {
    console.error('[GET /api/admin/historical-data/files/[id]/result] Error:', error)
    return NextResponse.json(
      {
        type: 'https://api.example.com/errors/internal',
        title: 'Internal Server Error',
        status: 500,
        detail: error instanceof Error ? error.message : '伺服器錯誤',
      },
      { status: 500 }
    )
  }
}
