/**
 * @fileoverview 單個文件詳情 API 端點
 * @description
 *   提供單個文件的詳細資訊查詢，支援動態關聯加載：
 *   - 文件基本資訊 + blobUrl（SAS URL）
 *   - 上傳者 / 公司 / 城市資訊（透過 include 參數）
 *   - 提取欄位（從 ExtractionResult.fieldMappings 轉換）
 *   - 信心度（從 ExtractionResult.averageConfidence）
 *
 *   端點：
 *   - GET /api/documents/[id]?include=extractedFields,uploadedBy,company,city
 *
 * @module src/app/api/documents/[id]/route
 * @author Development Team
 * @since Epic 2 - Story 2.7 (Processing Status Tracking & Display)
 * @lastModified 2026-01-28
 *
 * @dependencies
 *   - next/server - Next.js API 處理
 *   - @/lib/auth - NextAuth 認證
 *   - @/lib/prisma - Prisma Client
 *   - @/lib/azure-blob - Azure Blob SAS URL 生成
 *
 * @related
 *   - src/hooks/use-invoice-detail.ts - React Query Hook
 *   - CHANGE-018 - Invoice 詳情頁 API 增強
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { generateSasUrl } from '@/lib/azure-blob'
import type { ExtractedField } from '@/types/extracted-field'
import { getConfidenceLevelFromScore } from '@/types/extracted-field'

// ============================================================
// Types
// ============================================================

interface RouteParams {
  params: Promise<{ id: string }>
}

/** ExtractionResult.fieldMappings JSON 中單一欄位的結構 */
interface FieldMappingEntry {
  value: string | number | null
  rawValue: string | null
  confidence: number
  source: string
  ruleId?: string
  extractionMethod?: string
  category?: string
  position?: {
    page?: number
    boundingBox?: {
      x: number
      y: number
      width: number
      height: number
    }
  }
}

// ============================================================
// Helper Functions
// ============================================================

/**
 * 將 ExtractionResult.fieldMappings JSON 轉換為 ExtractedField[] 陣列
 */
function mapFieldMappingsToExtractedFields(
  fieldMappings: Record<string, FieldMappingEntry>
): ExtractedField[] {
  return Object.entries(fieldMappings).map(([fieldName, entry], index) => {
    const confidence = typeof entry.confidence === 'number'
      ? entry.confidence / 100  // 0-100 → 0-1
      : 0

    // 映射 source 到 FieldSource 類型
    const sourceMap: Record<string, ExtractedField['source']> = {
      azure: 'AZURE_DI',
      azure_di: 'AZURE_DI',
      gpt_vision: 'GPT_VISION',
      tier1: 'MAPPING',
      tier2: 'MAPPING',
      tier3: 'GPT_VISION',
      manual: 'MANUAL',
    }
    const source = sourceMap[entry.source?.toLowerCase() ?? ''] ?? 'AZURE_DI'

    return {
      id: `field-${index}-${fieldName}`,
      fieldName,
      displayName: fieldName,
      value: entry.value,
      rawValue: entry.rawValue ?? null,
      confidence,
      confidenceLevel: getConfidenceLevelFromScore(confidence),
      source,
      isEdited: false,
      category: entry.category ?? 'other',
      boundingBox: entry.position?.boundingBox
        ? {
            page: entry.position.page ?? 1,
            x: entry.position.boundingBox.x,
            y: entry.position.boundingBox.y,
            width: entry.position.boundingBox.width,
            height: entry.position.boundingBox.height,
          }
        : undefined,
    }
  })
}

// ============================================================
// GET /api/documents/[id]
// ============================================================

/**
 * GET /api/documents/[id]
 * 獲取單個文件詳情
 *
 * @query include - 逗號分隔的關聯資料名稱
 *   可選值: extractedFields, uploadedBy, company, city, processingSteps
 *   範例: ?include=extractedFields,uploadedBy,company,city
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    // 認證檢查
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { id } = await params
    const { searchParams } = new URL(request.url)
    const includes = new Set(
      (searchParams.get('include') ?? '').split(',').filter(Boolean)
    )

    // 1. 查詢文件（含動態關聯）
    const document = await prisma.document.findUnique({
      where: { id },
      include: {
        uploader: includes.has('uploadedBy')
          ? { select: { id: true, name: true, email: true } }
          : false,
        company: includes.has('company')
          ? { select: { id: true, name: true, code: true } }
          : false,
        city: includes.has('city')
          ? { select: { id: true, name: true, code: true } }
          : false,
        extractionResult: {
          select: {
            averageConfidence: true,
            confidenceScores: true,
            fieldMappings: includes.has('extractedFields'),
            totalFields: true,
            mappedFields: true,
            status: true,
          },
        },
      },
    })

    if (!document) {
      return NextResponse.json(
        { success: false, error: 'Document not found' },
        { status: 404 }
      )
    }

    // 2. 生成 blobUrl（SAS URL）
    let blobUrl: string | null = null
    if (document.blobName) {
      try {
        blobUrl = await generateSasUrl(document.blobName, 60)
      } catch (err) {
        console.error(`[Document Detail] Failed to generate SAS URL for ${document.blobName}:`, err)
      }
    }

    // 3. 提取 confidence 資料
    const overallConfidence = document.extractionResult?.averageConfidence ?? null

    // 4. 轉換 extractedFields
    let extractedFields: ExtractedField[] | undefined
    if (includes.has('extractedFields') && document.extractionResult?.fieldMappings) {
      try {
        const fieldMappings = document.extractionResult.fieldMappings as unknown as Record<string, FieldMappingEntry>
        extractedFields = mapFieldMappingsToExtractedFields(fieldMappings)
      } catch (err) {
        console.error(`[Document Detail] Failed to parse fieldMappings for ${id}:`, err)
        extractedFields = []
      }
    }

    // 5. 組裝回應
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { extractionResult: _er, filePath: _fp, blobName: _bn, uploader, uploadedBy: _fk, ...documentBase } = document as Record<string, unknown>

    const responseData = {
      ...documentBase,
      blobUrl,
      overallConfidence,
      sourceType: document.sourceType,
      // 前端期望 uploadedBy 為 { id, name, email } 物件
      uploadedBy: uploader ?? null,
      ...(includes.has('extractedFields') && { extractedFields: extractedFields ?? [] }),
    }

    return NextResponse.json({
      success: true,
      data: responseData,
    })
  } catch (error) {
    console.error('Get document error:', error)

    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
