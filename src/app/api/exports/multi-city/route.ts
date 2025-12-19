'use server'

/**
 * @fileoverview 多城市報表匯出 API
 * @description
 *   提供跨城市數據報表匯出功能：
 *   - 驗證用戶城市訪問權限
 *   - 收集各城市數據
 *   - 生成 Excel 或 PDF 報表
 *   - 支援個別城市或合併報表
 *
 * @module src/app/api/exports/multi-city
 * @author Development Team
 * @since Epic 6 - Story 6.3 (Regional Manager Cross-City Access)
 * @lastModified 2025-12-19
 *
 * @features
 *   - 多城市數據收集
 *   - Excel/PDF 格式支援
 *   - 日期範圍篩選
 *   - 城市分組報表
 *
 * @dependencies
 *   - @/lib/auth - 認證服務
 *   - @/lib/db-context - 資料庫上下文
 *   - zod - 請求驗證
 *
 * @related
 *   - src/components/export/MultiCityExportDialog.tsx - 匯出對話框
 *   - src/app/api/analytics/city-comparison/route.ts - 城市對比 API
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { withServiceRole } from '@/lib/db-context'
import { z } from 'zod'

// ============================================================
// Validation Schema
// ============================================================

const exportSchema = z.object({
  cityCodes: z.array(z.string()).min(1, '必須選擇至少一個城市'),
  format: z.enum(['xlsx', 'pdf', 'json']),
  aggregation: z.enum(['individual', 'combined']),
  includeCityBreakdown: z.boolean().default(true),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  reportType: z.enum(['summary', 'detailed', 'comparison']).default('summary'),
})

type ExportInput = z.infer<typeof exportSchema>

// ============================================================
// Types
// ============================================================

interface CityExportData {
  cityCode: string
  cityName: string
  regionName: string
  stats: {
    totalDocuments: number
    avgConfidence: number | null
    avgProcessingTime: number | null
    completedDocuments: number
    pendingDocuments: number
    failedDocuments: number
  }
  documents?: Array<{
    id: string
    fileName: string
    status: string
    confidence: number | null
    processingTime: number | null
    createdAt: Date
  }>
}

interface ExportData {
  generatedAt: Date
  period: { from?: Date; to?: Date }
  cities: CityExportData[]
}

// ============================================================
// Helper Functions
// ============================================================

/**
 * 收集匯出數據
 */
async function gatherExportData(options: {
  cityCodes: string[]
  dateFrom?: Date
  dateTo?: Date
  includeCityBreakdown: boolean
  includeDocuments: boolean
}): Promise<ExportData> {
  const { cityCodes, dateFrom, dateTo, includeDocuments } = options

  const dateFilter = {
    ...(dateFrom && { gte: dateFrom }),
    ...(dateTo && { lte: dateTo }),
  }

  const cityData = await Promise.all(
    cityCodes.map(async (cityCode): Promise<CityExportData> => {
      return withServiceRole(async (tx) => {
        const where = {
          cityCode,
          ...(Object.keys(dateFilter).length > 0 && { createdAt: dateFilter }),
        }

        const [stats, city, documents] = await Promise.all([
          // 統計數據
          tx.document.groupBy({
            by: ['status'],
            where,
            _count: { id: true },
          }),

          // 城市信息
          tx.city.findUnique({
            where: { code: cityCode },
            include: { region: { select: { name: true } } },
          }),

          // 文件列表（如果需要）
          includeDocuments
            ? tx.document.findMany({
                where,
                select: {
                  id: true,
                  fileName: true,
                  status: true,
                  createdAt: true,
                  extractionResult: {
                    select: {
                      averageConfidence: true,
                      processingTime: true,
                    },
                  },
                },
                orderBy: { createdAt: 'desc' },
                take: 1000,
              })
            : Promise.resolve([]),
        ])

        // 計算統計
        const statusCounts = Object.fromEntries(
          stats.map((s) => [s.status, s._count.id])
        ) as Record<string, number>

        const totalDocuments = Object.values(statusCounts).reduce(
          (a, b) => a + b,
          0
        )
        const completedDocuments = statusCounts['COMPLETED'] || 0
        const pendingDocuments =
          (statusCounts['PENDING_REVIEW'] || 0) +
          (statusCounts['IN_REVIEW'] || 0) +
          (statusCounts['MAPPING_PROCESSING'] || 0) +
          (statusCounts['OCR_PROCESSING'] || 0)
        const failedDocuments =
          (statusCounts['FAILED'] || 0) + (statusCounts['OCR_FAILED'] || 0)

        // 計算平均值
        const aggregates = await tx.extractionResult.aggregate({
          where: { document: where },
          _avg: {
            averageConfidence: true,
            processingTime: true,
          },
        })

        return {
          cityCode,
          cityName: city?.name || cityCode,
          regionName: city?.region.name || 'Unknown',
          stats: {
            totalDocuments,
            avgConfidence: aggregates._avg.averageConfidence,
            avgProcessingTime: aggregates._avg.processingTime,
            completedDocuments,
            pendingDocuments,
            failedDocuments,
          },
          documents: includeDocuments
            ? documents.map((doc) => ({
                id: doc.id,
                fileName: doc.fileName,
                status: doc.status,
                confidence: doc.extractionResult?.averageConfidence ?? null,
                processingTime: doc.extractionResult?.processingTime ?? null,
                createdAt: doc.createdAt,
              }))
            : undefined,
        }
      })
    })
  )

  return {
    generatedAt: new Date(),
    period: { from: dateFrom, to: dateTo },
    cities: cityData,
  }
}

/**
 * 生成 JSON 報表
 */
function generateJsonReport(data: ExportData): Buffer {
  return Buffer.from(JSON.stringify(data, null, 2))
}

/**
 * 生成簡單的 CSV 報表（作為 Excel 的臨時替代）
 */
function generateCsvReport(data: ExportData): Buffer {
  const headers = [
    '城市代碼',
    '城市名稱',
    '區域',
    '總文件數',
    '完成數',
    '待處理數',
    '失敗數',
    '平均信心度',
    '平均處理時間(ms)',
  ]

  const rows = data.cities.map((city) => [
    city.cityCode,
    city.cityName,
    city.regionName,
    city.stats.totalDocuments,
    city.stats.completedDocuments,
    city.stats.pendingDocuments,
    city.stats.failedDocuments,
    city.stats.avgConfidence?.toFixed(2) ?? 'N/A',
    city.stats.avgProcessingTime?.toFixed(0) ?? 'N/A',
  ])

  const csvContent = [
    headers.join(','),
    ...rows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
  ].join('\n')

  // 添加 BOM 以確保 Excel 正確識別 UTF-8
  const bom = Buffer.from([0xef, 0xbb, 0xbf])
  return Buffer.concat([bom, Buffer.from(csvContent, 'utf-8')])
}

// ============================================================
// Route Handler
// ============================================================

/**
 * POST /api/exports/multi-city
 *
 * @description
 *   生成多城市數據報表。
 *
 * @body
 *   - cityCodes: 城市代碼列表
 *   - format: 報表格式 (xlsx/pdf/json)
 *   - aggregation: 聚合方式 (individual/combined)
 *   - includeCityBreakdown: 是否包含城市分組
 *   - dateFrom: 開始日期（可選）
 *   - dateTo: 結束日期（可選）
 *   - reportType: 報表類型 (summary/detailed/comparison)
 *
 * @returns 報表文件
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  // --- 認證檢查 ---
  const session = await auth()

  if (!session?.user) {
    return NextResponse.json(
      {
        type: 'https://api.example.com/errors/unauthorized',
        title: 'Unauthorized',
        status: 401,
        detail: 'Authentication required',
      },
      { status: 401 }
    )
  }

  // --- 解析請求 ---
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      {
        type: 'https://api.example.com/errors/validation',
        title: 'Invalid JSON',
        status: 400,
        detail: 'Request body must be valid JSON',
      },
      { status: 400 }
    )
  }

  const validation = exportSchema.safeParse(body)

  if (!validation.success) {
    return NextResponse.json(
      {
        type: 'https://api.example.com/errors/validation',
        title: 'Validation Error',
        status: 400,
        detail: 'Invalid export configuration',
        errors: validation.error.flatten().fieldErrors,
      },
      { status: 400 }
    )
  }

  const {
    cityCodes,
    format,
    includeCityBreakdown,
    dateFrom,
    dateTo,
    reportType,
  }: ExportInput = validation.data

  const { user } = session
  const userCities = user.cityCodes ?? []
  const isGlobalAdmin = user.isGlobalAdmin ?? false

  // --- 驗證城市訪問權限 ---
  if (!isGlobalAdmin) {
    const unauthorized = cityCodes.filter((c) => !userCities.includes(c))
    if (unauthorized.length > 0) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/forbidden',
          title: 'Unauthorized city access',
          status: 403,
          detail: `No access to: ${unauthorized.join(', ')}`,
        },
        { status: 403 }
      )
    }
  }

  try {
    // --- 收集數據 ---
    const exportData = await gatherExportData({
      cityCodes,
      dateFrom: dateFrom ? new Date(dateFrom) : undefined,
      dateTo: dateTo ? new Date(dateTo) : undefined,
      includeCityBreakdown,
      includeDocuments: reportType === 'detailed',
    })

    // --- 生成報表 ---
    let buffer: Buffer
    let contentType: string
    let filename: string
    const timestamp = Date.now()

    switch (format) {
      case 'json':
        buffer = generateJsonReport(exportData)
        contentType = 'application/json'
        filename = `multi-city-report-${timestamp}.json`
        break

      case 'xlsx':
        // 臨時使用 CSV 格式（需要額外安裝 xlsx 庫來生成真正的 Excel）
        buffer = generateCsvReport(exportData)
        contentType = 'text/csv; charset=utf-8'
        filename = `multi-city-report-${timestamp}.csv`
        break

      case 'pdf':
        // PDF 生成需要額外的庫，暫時返回 JSON
        buffer = generateJsonReport(exportData)
        contentType = 'application/json'
        filename = `multi-city-report-${timestamp}.json`
        break

      default:
        buffer = generateJsonReport(exportData)
        contentType = 'application/json'
        filename = `multi-city-report-${timestamp}.json`
    }

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    console.error('[Multi-City Export API] Error:', error)

    return NextResponse.json(
      {
        type: 'https://api.example.com/errors/internal',
        title: 'Internal Server Error',
        status: 500,
        detail: 'Failed to generate export',
      },
      { status: 500 }
    )
  }
}
