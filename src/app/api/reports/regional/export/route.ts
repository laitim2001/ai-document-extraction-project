/**
 * @fileoverview 區域報表匯出 API
 * @description
 *   提供區域報表 Excel 匯出功能：
 *   - 匯出區域匯總數據
 *   - 匯出城市對比表格
 *   - 可選包含趨勢和 Company 數據
 *
 * @module src/app/api/reports/regional/export/route
 * @since Epic 7 - Story 7.5 (跨城市匯總報表)
 * @lastModified 2025-12-22
 * @refactor REFACTOR-001 (Forwarder → Company)
 *
 * @features
 *   - AC4: 區域報表匯出（Excel 格式）
 *
 * @dependencies
 *   - @/lib/api/city-filter - 城市篩選中間件
 *   - @/services - 區域報表服務
 */

import { NextRequest, NextResponse } from 'next/server'
import { withCityFilter, CityFilterContext } from '@/middlewares/city-filter'
import { regionalReportService } from '@/services'
import { z } from 'zod'

// ============================================================
// Validation Schema
// ============================================================

const exportParamsSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format'),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format'),
  includeTrend: z.enum(['true', 'false']).optional().default('false'),
  includeCompanies: z.enum(['true', 'false']).optional().default('false'), // REFACTOR-001: 原 includeForwarders
})

// ============================================================
// Route Handler
// ============================================================

/**
 * GET /api/reports/regional/export
 * 匯出區域報表為 Excel 檔案
 *
 * @description
 *   匯出區域報表數據，包含：
 *   - 區域匯總統計
 *   - 城市對比表格
 *   - 可選：各城市趨勢數據
 *   - 可選：各城市 Top Companies (REFACTOR-001: 原 Forwarders)
 *
 * @access 區域經理、全局管理員
 *
 * @query {string} startDate - 開始日期 (YYYY-MM-DD)
 * @query {string} endDate - 結束日期 (YYYY-MM-DD)
 * @query {string} [includeTrend=false] - 是否包含趨勢數據
 * @query {string} [includeCompanies=false] - 是否包含 Company 數據 (REFACTOR-001: 原 includeForwarders)
 *
 * @returns {Buffer} Excel 文件
 *
 * @example
 * GET /api/reports/regional/export?startDate=2025-01-01&endDate=2025-01-31&includeTrend=true
 */
export const GET = withCityFilter(
  async (
    request: NextRequest,
    cityFilter: CityFilterContext
  ): Promise<NextResponse> => {
    try {
      // 權限檢查：必須是區域經理或全局管理員
      if (!cityFilter.isGlobalAdmin && !cityFilter.isRegionalManager) {
        return NextResponse.json(
          {
            success: false,
            error: 'Access denied. Regional manager or global admin required.',
          },
          { status: 403 }
        )
      }

      // 解析查詢參數
      const { searchParams } = new URL(request.url)
      const rawParams = {
        startDate: searchParams.get('startDate') || '',
        endDate: searchParams.get('endDate') || '',
        includeTrend: searchParams.get('includeTrend') || 'false',
        includeCompanies: searchParams.get('includeCompanies') || 'false', // REFACTOR-001: 原 includeForwarders
      }

      // 驗證參數
      const parseResult = exportParamsSchema.safeParse(rawParams)
      if (!parseResult.success) {
        return NextResponse.json(
          {
            success: false,
            error: 'Invalid parameters',
            details: parseResult.error.flatten().fieldErrors,
          },
          { status: 400 }
        )
      }

      const params = parseResult.data
      const startDate = new Date(params.startDate)
      const endDate = new Date(params.endDate)
      const includeTrend = params.includeTrend === 'true'
      const includeCompanies = params.includeCompanies === 'true' // REFACTOR-001: 原 includeForwarders

      // 驗證日期範圍
      if (startDate > endDate) {
        return NextResponse.json(
          {
            success: false,
            error: 'Start date must be before end date',
          },
          { status: 400 }
        )
      }

      // 匯出 Excel
      const buffer = await regionalReportService.exportToExcel(
        cityFilter,
        startDate,
        endDate,
        { includeTrend, includeForwarders: includeCompanies } // REFACTOR-001: service 仍使用 includeForwarders
      )

      // 生成檔案名稱
      const fileName = `regional-report_${params.startDate}_${params.endDate}.xlsx`

      // 返回 Excel 文件
      return new NextResponse(new Uint8Array(buffer), {
        status: 200,
        headers: {
          'Content-Type':
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="${fileName}"`,
          'Content-Length': buffer.length.toString(),
        },
      })
    } catch (error) {
      console.error('Regional report export error:', error)
      return NextResponse.json(
        {
          success: false,
          error:
            error instanceof Error ? error.message : 'Failed to export report',
        },
        { status: 500 }
      )
    }
  }
)
