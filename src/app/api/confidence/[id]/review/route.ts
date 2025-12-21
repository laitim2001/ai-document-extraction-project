/**
 * @fileoverview 審核結果記錄 API 端點
 * @description
 *   記錄用戶審核結果以更新歷史準確率：
 *   - POST /api/confidence/[id]/review - 記錄審核結果
 *
 * @module src/app/api/confidence/[id]/review/route
 * @since Epic 2 - Story 2.5 (Confidence Score Calculation)
 * @lastModified 2025-12-21
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { recordReviewResult } from '@/services/confidence.service'
import { prisma } from '@/lib/prisma'

// ============================================================
// Validation Schemas
// ============================================================

const paramsSchema = z.object({
  id: z.string().uuid(),
})

const reviewBodySchema = z.object({
  /** 各欄位的審核結果：true = 正確，false = 被修正 */
  corrections: z.record(z.string(), z.boolean()),
})

// ============================================================
// POST /api/confidence/[id]/review - 記錄審核結果
// ============================================================

/**
 * 記錄審核結果
 *
 * @description
 *   當用戶完成文件審核後，記錄每個欄位的審核結果。
 *   這些數據用於更新歷史準確率，影響未來的信心度計算。
 *
 * @param body.corrections - 欄位修正記錄（欄位名稱 → 是否正確）
 * @returns 記錄結果
 *
 * @example
 *   POST /api/confidence/doc_123/review
 *   {
 *     "corrections": {
 *       "invoice_number": true,
 *       "total_amount": false,
 *       "invoice_date": true
 *     }
 *   }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params
    const { id: documentId } = paramsSchema.parse(resolvedParams)

    // 解析請求體
    const body = await request.json()
    const { corrections } = reviewBodySchema.parse(body)

    // 檢查文件是否存在
    const document = await prisma.document.findUnique({
      where: { id: documentId },
      select: { id: true, forwarderId: true },
    })

    if (!document) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/not-found',
          title: 'Not Found',
          status: 404,
          detail: `Document not found: ${documentId}`,
        },
        { status: 404 }
      )
    }

    // 記錄審核結果
    await recordReviewResult(documentId, corrections)

    // 計算統計
    const totalFields = Object.keys(corrections).length
    const correctFields = Object.values(corrections).filter(Boolean).length
    const correctedFields = totalFields - correctFields

    return NextResponse.json({
      success: true,
      data: {
        documentId,
        forwarderId: document.forwarderId,
        recorded: true,
        stats: {
          totalFields,
          correctFields,
          correctedFields,
          accuracy: totalFields > 0 ? Math.round((correctFields / totalFields) * 100) : 0,
        },
      },
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/validation',
          title: 'Validation Error',
          status: 400,
          detail: 'Invalid request parameters',
          errors: error.flatten().fieldErrors,
        },
        { status: 400 }
      )
    }

    console.error('[ConfidenceAPI] Review error:', error)
    return NextResponse.json(
      {
        type: 'https://api.example.com/errors/internal',
        title: 'Internal Server Error',
        status: 500,
        detail: error instanceof Error ? error.message : 'Failed to record review result',
      },
      { status: 500 }
    )
  }
}
