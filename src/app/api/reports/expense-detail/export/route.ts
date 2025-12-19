/**
 * @fileoverview 費用明細報表匯出 API
 * @description
 *   提供費用明細報表的匯出端點：
 *   - 小量數據直接生成並下載
 *   - 大量數據（> 10,000 筆）轉為背景處理
 *   - 自動應用城市過濾
 *   - 需要 EXPORT_REPORTS 權限
 *
 * @module src/app/api/reports/expense-detail/export
 * @since Epic 7 - Story 7.4 (費用明細報表匯出)
 * @lastModified 2025-12-19
 */

import { NextRequest, NextResponse } from 'next/server'
import { withCityFilter, CityFilterContext } from '@/middleware/city-filter'
import { expenseReportService } from '@/services/expense-report.service'
import { ExportConfig, ExportResponse, LARGE_EXPORT_THRESHOLD } from '@/types/report-export'
import { hasPermissionById } from '@/lib/auth/city-permission'
import { PERMISSIONS } from '@/types/permissions'

/**
 * POST /api/reports/expense-detail/export
 *
 * @description
 *   匯出費用明細報表。根據數據量自動選擇處理方式：
 *   - 數據量 ≤ 10,000: 直接生成並返回 Excel 檔案
 *   - 數據量 > 10,000: 創建背景任務，返回任務 ID
 *
 * @param request - 包含 ExportConfig 的 POST 請求
 * @returns Excel 檔案或任務資訊
 */
export const POST = withCityFilter(
  async (
    request: NextRequest,
    cityContext: CityFilterContext
  ): Promise<NextResponse> => {
    try {
      // 權限檢查 - 全球管理員或擁有 REPORT_EXPORT 權限
      if (!cityContext.isGlobalAdmin) {
        const canExport = await hasPermissionById(cityContext.userId, PERMISSIONS.REPORT_EXPORT)
        if (!canExport) {
          return NextResponse.json<ExportResponse>(
            { success: false, error: 'Permission denied: report:export required' },
            { status: 403 }
          )
        }
      }

      const config: ExportConfig = await request.json()

      // 驗證配置
      if (!config.dateRange?.startDate || !config.dateRange?.endDate) {
        return NextResponse.json<ExportResponse>(
          { success: false, error: 'Date range is required' },
          { status: 400 }
        )
      }

      if (!config.fields?.length) {
        return NextResponse.json<ExportResponse>(
          { success: false, error: 'At least one field must be selected' },
          { status: 400 }
        )
      }

      // 估算數據量
      const estimatedCount = await expenseReportService.getEstimatedCount(
        cityContext,
        config
      )

      // 大量數據使用背景處理
      if (estimatedCount > LARGE_EXPORT_THRESHOLD) {
        const jobId = await expenseReportService.createBackgroundJob(
          cityContext.userId,
          config
        )

        // 異步處理（不等待完成）
        expenseReportService.processBackgroundJob(jobId, cityContext)
          .catch(error => console.error('Background job failed:', error))

        return NextResponse.json<ExportResponse>({
          success: true,
          data: {
            mode: 'background',
            jobId,
            estimatedCount,
            message: '報表正在背景生成，完成後將發送通知'
          }
        })
      }

      // 小量數據直接生成
      const buffer = await expenseReportService.exportToExcel(cityContext, config)
      const dateStr = new Date().toISOString().split('T')[0]
      const fileName = `expense-report-${dateStr}.xlsx`

      // 轉換為 Uint8Array 以符合 Web API 規範
      const uint8Array = new Uint8Array(buffer)

      return new NextResponse(uint8Array, {
        status: 200,
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="${fileName}"`,
          'Content-Length': buffer.length.toString()
        }
      })
    } catch (error) {
      console.error('Export error:', error)
      return NextResponse.json<ExportResponse>(
        { success: false, error: 'Failed to export report' },
        { status: 500 }
      )
    }
  }
)
