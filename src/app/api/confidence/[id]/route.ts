/**
 * @fileoverview 文件信心度 API 端點
 * @description
 *   提供文件信心度相關操作：
 *   - GET /api/confidence/[id] - 取得文件的信心度結果
 *   - POST /api/confidence/[id] - 計算並儲存文件的信心度
 *   - POST /api/confidence/[id]/review - 記錄審核結果
 *
 * @module src/app/api/confidence/[id]/route
 * @since Epic 2 - Story 2.5 (Confidence Score Calculation)
 * @lastModified 2025-12-21
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import {
  getDocumentConfidence,
  calculateAndSaveConfidence,
} from '@/services/confidence.service'
import { prisma } from '@/lib/prisma'

// ============================================================
// Validation Schemas
// ============================================================

const paramsSchema = z.object({
  id: z.string().uuid(),
})

const calculateOptionsSchema = z.object({
  includeHistorical: z.boolean().optional().default(true),
  applyCriticalPenalty: z.boolean().optional().default(true),
  criticalFields: z.array(z.string()).optional(),
})

// ============================================================
// GET /api/confidence/[id] - 取得文件信心度
// ============================================================

/**
 * 取得文件的信心度結果
 *
 * @description
 *   查詢已計算的文件信心度分數。
 *   如果尚未計算，返回 404。
 *
 * @returns 文件信心度結果
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params
    const { id: documentId } = paramsSchema.parse(resolvedParams)

    // 檢查文件是否存在
    const document = await prisma.document.findUnique({
      where: { id: documentId },
      select: { id: true, processingPath: true },
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

    // 取得信心度結果
    const confidence = await getDocumentConfidence(documentId)

    if (!confidence) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/not-found',
          title: 'Not Found',
          status: 404,
          detail: `Confidence scores not yet calculated for document: ${documentId}`,
          instance: `/api/confidence/${documentId}`,
        },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        documentId,
        processingPath: document.processingPath,
        confidence,
      },
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/validation',
          title: 'Validation Error',
          status: 400,
          detail: 'Invalid document ID',
          errors: error.flatten().fieldErrors,
        },
        { status: 400 }
      )
    }

    console.error('[ConfidenceAPI] GET error:', error)
    return NextResponse.json(
      {
        type: 'https://api.example.com/errors/internal',
        title: 'Internal Server Error',
        status: 500,
        detail: error instanceof Error ? error.message : 'Failed to get confidence scores',
      },
      { status: 500 }
    )
  }
}

// ============================================================
// POST /api/confidence/[id] - 計算並儲存信心度
// ============================================================

/**
 * 計算並儲存文件的信心度
 *
 * @description
 *   觸發文件信心度計算，包含：
 *   - 查詢歷史準確率
 *   - 計算各欄位信心度
 *   - 計算文件整體信心度
 *   - 應用關鍵欄位懲罰
 *   - 生成處理路徑建議
 *   - 儲存結果到資料庫
 *
 * @param body.includeHistorical - 是否包含歷史準確率（預設 true）
 * @param body.applyCriticalPenalty - 是否應用關鍵欄位懲罰（預設 true）
 * @param body.criticalFields - 自定義關鍵欄位列表
 * @returns 信心度計算結果
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params
    const { id: documentId } = paramsSchema.parse(resolvedParams)

    // 解析請求體
    const body = await request.json().catch(() => ({}))
    const options = calculateOptionsSchema.parse(body)

    // 檢查文件是否存在
    const document = await prisma.document.findUnique({
      where: { id: documentId },
      select: { id: true },
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

    // 檢查是否有提取結果
    const extractionResult = await prisma.extractionResult.findUnique({
      where: { documentId },
      select: { id: true },
    })

    if (!extractionResult) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/precondition-failed',
          title: 'Precondition Failed',
          status: 412,
          detail: `No extraction result found for document: ${documentId}. Please run extraction first.`,
        },
        { status: 412 }
      )
    }

    // 計算並儲存信心度
    const result = await calculateAndSaveConfidence(extractionResult.id, options)

    return NextResponse.json({
      success: true,
      data: {
        documentId,
        extractionResultId: extractionResult.id,
        processingPath: result.processingPath,
        confidence: result.confidence,
        saved: result.saved,
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

    console.error('[ConfidenceAPI] POST error:', error)
    return NextResponse.json(
      {
        type: 'https://api.example.com/errors/internal',
        title: 'Internal Server Error',
        status: 500,
        detail: error instanceof Error ? error.message : 'Failed to calculate confidence scores',
      },
      { status: 500 }
    )
  }
}
