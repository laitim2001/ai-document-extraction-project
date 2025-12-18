/**
 * @fileoverview 修正提取結果 API 端點
 * @description
 *   提供文件欄位修正功能：
 *   - 接收批量修正請求
 *   - 更新 ExtractionResult 中的 fieldMappings
 *   - 建立 Correction 記錄（用於機器學習）
 *   - 記錄審計日誌（合規要求）
 *   - Story 3.6: 支援修正類型標記（NORMAL/EXCEPTION）
 *   - Story 3.6: 觸發規則建議（當 NORMAL 修正達到閾值）
 *
 *   端點：
 *   - PATCH /api/review/[id]/correct - 修正提取欄位
 *
 * @module src/app/api/review/[id]/correct/route
 * @author Development Team
 * @since Epic 3 - Story 3.5 (修正提取結果)
 * @lastModified 2025-12-18
 *
 * @dependencies
 *   - next/server - Next.js API 處理
 *   - @/lib/auth - NextAuth 認證
 *   - @/lib/prisma - Prisma 客戶端
 *   - @/lib/audit - 審計日誌工具
 *   - @/lib/learning - 學習服務（Story 3.6）
 *   - zod - 輸入驗證
 *
 * @related
 *   - src/hooks/useSaveCorrections.ts - React Query Hook
 *   - src/components/features/review/ReviewPanel/FieldEditor.tsx - 編輯組件
 *   - src/types/review.ts - 類型定義
 *   - src/lib/learning/ruleSuggestionTrigger.ts - 規則建議觸發
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logDocumentCorrected } from '@/lib/audit'
import { triggerRuleSuggestionCheck } from '@/lib/learning/ruleSuggestionTrigger'
import { z } from 'zod'

// ============================================================
// Types
// ============================================================

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * ExtractionResult.fieldMappings 的結構
 */
interface FieldMappingEntry {
  value: string | null
  rawValue?: string | null
  confidence: number
  source: 'tier1' | 'tier2' | 'tier3' | 'azure'
  ruleId?: string
  extractionMethod?: string
  position?: {
    page: number
    boundingBox?: {
      x: number
      y: number
      width: number
      height: number
    }
  }
}

interface FieldMappings {
  [fieldName: string]: FieldMappingEntry
}

// ============================================================
// Validation Schema
// ============================================================

/**
 * 單個修正項目 Schema
 */
const CorrectionItemSchema = z.object({
  /** 欄位名稱 */
  fieldName: z.string().min(1, '欄位名稱不可為空'),
  /** 原始值 */
  originalValue: z.string().nullable(),
  /** 修正後的值 */
  correctedValue: z.string(),
  /** 修正類型 */
  correctionType: z.enum(['NORMAL', 'EXCEPTION']).default('NORMAL'),
  /** 特例原因（當 correctionType 為 EXCEPTION 時可選填） */
  exceptionReason: z.string().optional(),
})

/**
 * 修正請求 Schema
 */
const CorrectRequestSchema = z.object({
  corrections: z
    .array(CorrectionItemSchema)
    .min(1, '至少需要一個修正項目')
    .max(100, '一次最多修正 100 個欄位'),
})

// ============================================================
// PATCH /api/review/[id]/correct
// ============================================================

/**
 * PATCH /api/review/[id]/correct
 * 修正提取欄位
 *
 * @description
 *   使用 Prisma 交易確保原子性操作：
 *   1. 更新 ExtractionResult.fieldMappings 中的值
 *   2. 建立 Correction 記錄（用於機器學習回饋）
 *   3. 記錄審計日誌
 *
 * @requestBody
 * ```json
 * {
 *   "corrections": [
 *     {
 *       "fieldName": "invoiceDate",
 *       "originalValue": "2024-01-15",
 *       "correctedValue": "2024-01-16",
 *       "correctionType": "NORMAL"
 *     }
 *   ]
 * }
 * ```
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    // 認證檢查
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json(
        {
          type: 'unauthorized',
          title: 'Unauthorized',
          status: 401,
          detail: 'Authentication required',
        },
        { status: 401 }
      )
    }

    const { id: documentId } = await params
    const userId = session.user.id

    // 解析並驗證請求體
    let body: z.infer<typeof CorrectRequestSchema>
    try {
      const rawBody = await request.json()
      body = CorrectRequestSchema.parse(rawBody)
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          {
            type: 'validation_error',
            title: 'Validation Error',
            status: 400,
            detail: 'Invalid request body',
            errors: error.flatten().fieldErrors,
          },
          { status: 400 }
        )
      }
      throw error
    }

    const { corrections } = body

    // 獲取文件和提取結果
    const document = await prisma.document.findUnique({
      where: { id: documentId },
      include: {
        extractionResult: true,
      },
    })

    if (!document) {
      return NextResponse.json(
        {
          type: 'not_found',
          title: 'Not Found',
          status: 404,
          detail: `Document with ID ${documentId} not found`,
          instance: `/api/review/${documentId}/correct`,
        },
        { status: 404 }
      )
    }

    if (!document.extractionResult) {
      return NextResponse.json(
        {
          type: 'not_found',
          title: 'No Extraction Result',
          status: 404,
          detail: 'No extraction result found for this document',
          instance: `/api/review/${documentId}/correct`,
        },
        { status: 404 }
      )
    }

    // 檢查文件狀態是否可以修正
    const allowedStatuses = ['PENDING_REVIEW', 'IN_REVIEW']
    if (!allowedStatuses.includes(document.status)) {
      return NextResponse.json(
        {
          type: 'invalid_state',
          title: 'Invalid Document State',
          status: 400,
          detail: `Document cannot be corrected in current state: ${document.status}`,
          instance: `/api/review/${documentId}/correct`,
        },
        { status: 400 }
      )
    }

    // 獲取現有的 fieldMappings
    const currentMappings = document.extractionResult.fieldMappings as unknown as FieldMappings

    // 驗證所有欄位名稱都存在
    const invalidFields = corrections.filter((c) => !currentMappings[c.fieldName])
    if (invalidFields.length > 0) {
      return NextResponse.json(
        {
          type: 'validation_error',
          title: 'Invalid Field Names',
          status: 400,
          detail: `Unknown field names: ${invalidFields.map((f) => f.fieldName).join(', ')}`,
          instance: `/api/review/${documentId}/correct`,
        },
        { status: 400 }
      )
    }

    // 執行交易
    const result = await prisma.$transaction(async (tx) => {
      // 1. 更新 fieldMappings
      const updatedMappings = { ...currentMappings }
      const modifiedFields: Record<string, { before: unknown; after: unknown }> = {}

      for (const correction of corrections) {
        const currentEntry = updatedMappings[correction.fieldName]

        // 記錄修改前後的值
        modifiedFields[correction.fieldName] = {
          before: currentEntry.value,
          after: correction.correctedValue,
        }

        // 更新值，保持其他屬性不變
        updatedMappings[correction.fieldName] = {
          ...currentEntry,
          value: correction.correctedValue,
          // 修正後的信心度設為 100（人工確認）
          confidence: 100,
          // 標記來源為人工修正
          source: 'tier1' as const, // 人工修正視為最高優先級
        }
      }

      // 更新 ExtractionResult
      await tx.extractionResult.update({
        where: { id: document.extractionResult!.id },
        data: {
          fieldMappings: updatedMappings as unknown as Parameters<typeof tx.extractionResult.update>[0]['data']['fieldMappings'],
          // 更新平均信心度（可選，取決於業務邏輯）
        },
      })

      // 2. 建立 Correction 記錄
      const correctionRecords = await Promise.all(
        corrections.map((correction) =>
          tx.correction.create({
            data: {
              documentId,
              fieldName: correction.fieldName,
              originalValue: correction.originalValue,
              correctedValue: correction.correctedValue,
              correctionType: correction.correctionType,
              // Story 3.6: 儲存特例原因（僅當 EXCEPTION 類型時）
              exceptionReason:
                correction.correctionType === 'EXCEPTION'
                  ? correction.exceptionReason
                  : null,
              correctedBy: userId,
            },
          })
        )
      )

      // 3. 更新文件狀態為 IN_REVIEW（如果是 PENDING_REVIEW）
      if (document.status === 'PENDING_REVIEW') {
        await tx.document.update({
          where: { id: documentId },
          data: { status: 'IN_REVIEW' },
        })
      }

      return {
        correctionCount: correctionRecords.length,
        corrections: correctionRecords.map((r) => ({
          id: r.id,
          fieldName: r.fieldName,
          correctedValue: r.correctedValue,
          correctionType: r.correctionType,
        })),
        modifiedFields,
      }
    })

    // 獲取客戶端 IP（用於審計日誌）
    const ipAddress =
      request.headers.get('x-forwarded-for')?.split(',')[0] ||
      request.headers.get('x-real-ip') ||
      'unknown'

    // 記錄審計日誌（非阻斷式）
    await logDocumentCorrected(userId, documentId, result.modifiedFields, ipAddress)

    // Story 3.6: 為 NORMAL 類型的修正觸發規則建議檢查
    // 非阻斷式處理，錯誤不影響主流程
    const ruleSuggestionResults: Array<{
      fieldName: string
      triggered: boolean
      suggestionId?: string
    }> = []

    const normalCorrections = corrections.filter(
      (c) => c.correctionType === 'NORMAL'
    )

    if (normalCorrections.length > 0) {
      try {
        const triggerPromises = normalCorrections.map(async (correction) => {
          const triggerResult = await triggerRuleSuggestionCheck(
            documentId,
            correction.fieldName
          )
          return {
            fieldName: correction.fieldName,
            triggered: triggerResult.triggered,
            suggestionId: triggerResult.suggestionId,
          }
        })
        const results = await Promise.all(triggerPromises)
        ruleSuggestionResults.push(...results)
      } catch (error) {
        // 規則建議檢查失敗不應影響主流程
        console.error('Rule suggestion check failed:', error)
      }
    }

    // 返回成功響應
    return NextResponse.json({
      success: true,
      data: {
        documentId,
        correctionCount: result.correctionCount,
        corrections: result.corrections,
        // Story 3.6: 包含規則建議觸發結果
        ruleSuggestions: ruleSuggestionResults.filter((r) => r.triggered),
      },
    })
  } catch (error) {
    console.error('Correct fields error:', error)

    return NextResponse.json(
      {
        type: 'internal_error',
        title: 'Internal Server Error',
        status: 500,
        detail: 'Failed to correct fields',
      },
      { status: 500 }
    )
  }
}
