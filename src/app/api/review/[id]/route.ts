/**
 * @fileoverview 審核詳情 API 端點
 * @description
 *   提供單一文件的審核詳情查詢功能：
 *   - 文件基本資訊（檔名、URL、頁數）
 *   - Forwarder 資訊
 *   - 處理隊列狀態
 *   - 提取欄位結果（含信心度和來源位置）
 *
 *   端點：
 *   - GET /api/review/[id] - 獲取審核詳情
 *
 * @module src/app/api/review/[id]/route
 * @author Development Team
 * @since Epic 3 - Story 3.2 (並排 PDF 審核介面)
 * @lastModified 2025-12-18
 *
 * @dependencies
 *   - next/server - Next.js API 處理
 *   - @/lib/auth - NextAuth 認證
 *   - @/lib/prisma - Prisma 客戶端
 *
 * @related
 *   - src/hooks/useReviewDetail.ts - React Query Hook
 *   - src/app/(dashboard)/review/[id]/page.tsx - 審核詳情頁面
 *   - src/types/review.ts - 類型定義
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import type { ExtractedField, FieldSourcePosition, MappingSource } from '@/types/review'

// ============================================================
// Types
// ============================================================

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * 提取欄位映射結構（存於 fieldMappings JSON）
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

interface ConfidenceScores {
  overallScore: number
  level: string
  [key: string]: unknown
}

// ============================================================
// Constants
// ============================================================

/**
 * 欄位分組配置
 * 將欄位名稱映射到對應的分組
 */
const FIELD_GROUP_MAP: Record<string, string> = {
  // Header 資訊
  invoiceNumber: 'header',
  invoiceDate: 'header',
  dueDate: 'header',
  poNumber: 'header',
  currency: 'header',

  // 發貨人資訊
  shipperName: 'shipper',
  shipperAddress: 'shipper',
  shipperContact: 'shipper',

  // 收貨人資訊
  consigneeName: 'consignee',
  consigneeAddress: 'consignee',
  consigneeContact: 'consignee',

  // 運輸資訊
  vesselName: 'shipment',
  voyageNumber: 'shipment',
  containerNumber: 'shipment',
  blNumber: 'shipment',
  portOfLoading: 'shipment',
  portOfDischarge: 'shipment',
  etd: 'shipment',
  eta: 'shipment',

  // 費用明細
  oceanFreight: 'charges',
  thc: 'charges',
  docFee: 'charges',
  customsFee: 'charges',
  handlingFee: 'charges',

  // 金額合計
  totalAmount: 'totals',
  taxAmount: 'totals',
  netAmount: 'totals',
}

// ============================================================
// GET /api/review/[id]
// ============================================================

/**
 * GET /api/review/[id]
 * 獲取審核詳情（文件 + 提取結果）
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
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

    const { id } = await params

    // 查詢文件及相關資料
    const document = await prisma.document.findUnique({
      where: { id },
      include: {
        forwarder: {
          select: { id: true, name: true, code: true },
        },
        extractionResult: true,
        processingQueue: true,
        ocrResult: {
          select: { pageCount: true },
        },
      },
    })

    if (!document) {
      return NextResponse.json(
        {
          success: false,
          error: {
            type: 'not_found',
            title: 'Not Found',
            status: 404,
            detail: `Document with ID ${id} not found`,
            instance: `/api/review/${id}`,
          },
        },
        { status: 404 }
      )
    }

    // 檢查是否有提取結果
    if (!document.extractionResult) {
      return NextResponse.json(
        {
          success: false,
          error: {
            type: 'not_found',
            title: 'No Extraction Result',
            status: 404,
            detail: 'No extraction result found for this document',
            instance: `/api/review/${id}`,
          },
        },
        { status: 404 }
      )
    }

    // 解析欄位映射
    const fieldMappings = document.extractionResult.fieldMappings as unknown as FieldMappings
    const fields = convertFieldMappingsToFields(fieldMappings)

    // 計算整體信心度
    const overallConfidence = getOverallConfidence(
      document.extractionResult.confidenceScores as ConfidenceScores | null,
      document.extractionResult.averageConfidence
    )

    // 構建響應數據
    const data = {
      document: {
        id: document.id,
        fileName: document.fileName,
        fileUrl: document.filePath, // Azure Blob URL
        mimeType: document.fileType,
        pageCount: document.ocrResult?.pageCount || 1,
        createdAt: document.createdAt.toISOString(),
      },
      forwarder: document.forwarder
        ? {
            id: document.forwarder.id,
            name: document.forwarder.name,
            code: document.forwarder.code,
          }
        : null,
      processingQueue: document.processingQueue
        ? {
            id: document.processingQueue.id,
            processingPath: document.processingQueue.processingPath,
            overallConfidence,
            status: document.processingQueue.status,
          }
        : null,
      extraction: {
        id: document.extractionResult.id,
        overallConfidence,
        fields,
      },
    }

    return NextResponse.json({
      success: true,
      data,
    })
  } catch (error) {
    console.error('Get review detail error:', error)

    return NextResponse.json(
      {
        success: false,
        error: {
          type: 'internal_error',
          title: 'Internal Server Error',
          status: 500,
          detail: 'Failed to fetch review detail',
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
 * 將 fieldMappings JSON 轉換為 ExtractedField 陣列
 */
function convertFieldMappingsToFields(fieldMappings: FieldMappings): ExtractedField[] {
  const fields: ExtractedField[] = []

  for (const [fieldName, mapping] of Object.entries(fieldMappings)) {
    const field: ExtractedField = {
      id: `field-${fieldName}`,
      fieldName,
      fieldGroup: FIELD_GROUP_MAP[fieldName] || 'other',
      value: mapping.value,
      confidence: Math.round(mapping.confidence),
      sourcePosition: convertPosition(mapping.position),
      mappingSource: convertSource(mapping.source),
    }

    fields.push(field)
  }

  // 按欄位分組排序
  return fields.sort((a, b) => {
    const groupOrder = ['header', 'shipper', 'consignee', 'shipment', 'charges', 'totals', 'other']
    const aIdx = groupOrder.indexOf(a.fieldGroup)
    const bIdx = groupOrder.indexOf(b.fieldGroup)
    return aIdx - bIdx
  })
}

/**
 * 轉換位置資訊為百分比座標
 */
function convertPosition(
  position?: FieldMappingEntry['position']
): FieldSourcePosition | null {
  if (!position?.boundingBox) {
    return null
  }

  const { page, boundingBox } = position

  return {
    page,
    x: boundingBox.x,
    y: boundingBox.y,
    width: boundingBox.width,
    height: boundingBox.height,
  }
}

/**
 * 轉換來源類型
 */
function convertSource(source: FieldMappingEntry['source']): MappingSource {
  switch (source) {
    case 'tier1':
      return 'UNIVERSAL'
    case 'tier2':
      return 'FORWARDER'
    case 'tier3':
      return 'LLM'
    case 'azure':
      return 'UNIVERSAL' // Azure DI 也算通用映射
    default:
      return null
  }
}

/**
 * 從 ExtractionResult 獲取整體信心度分數
 */
function getOverallConfidence(
  confidenceScores: ConfidenceScores | null,
  averageConfidence: number
): number {
  // 優先使用 confidenceScores.overallScore
  if (confidenceScores && typeof confidenceScores.overallScore === 'number') {
    return Math.round(confidenceScores.overallScore)
  }

  // 回退到 averageConfidence
  return Math.round(averageConfidence)
}
