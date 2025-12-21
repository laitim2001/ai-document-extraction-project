/**
 * @fileoverview 城市成本異常分析 API
 * @description
 *   提供城市成本異常分析數據：
 *   - GET: 獲取指定城市的成本異常
 *   - 權限控制：FINANCE, ADMIN, REGIONAL_MANAGER, CITY_MANAGER
 *
 * @module src/app/api/reports/city-cost/anomaly/[cityCode]
 * @since Epic 7 - Story 7.9 (城市成本報表)
 * @lastModified 2025-12-19
 */

import { NextRequest, NextResponse } from 'next/server'
import { withCityFilter, CityFilterContext } from '@/middlewares/city-filter'
import { cityCostReportService } from '@/services/city-cost-report.service'
import type {
  AnomalyAnalysisParams,
  AnomalySeverity,
  AnomalyType,
} from '@/types/city-cost'

interface RouteParams {
  params: Promise<{
    cityCode: string
  }>
}

/**
 * 獲取城市成本異常分析
 *
 * @description
 *   返回城市成本異常分析結果：
 *   - 異常類型（處理量、成本、自動化率等）
 *   - 嚴重度（high, medium, low）
 *   - 異常詳情與建議
 *
 * @method GET
 * @route /api/reports/city-cost/anomaly/[cityCode]
 *
 * @param cityCode - 城市代碼（路徑參數）
 *
 * @query startDate - 開始日期（可選，ISO 格式，預設 30 天前）
 * @query endDate - 結束日期（可選，ISO 格式，預設今天）
 * @query severity - 嚴重度過濾（可選，逗號分隔：high,medium,low）
 * @query types - 異常類型過濾（可選，逗號分隔）
 *
 * @returns {AnomalyAnalysisResponse} 異常分析數據
 *
 * @example
 * GET /api/reports/city-cost/anomaly/HKG
 * GET /api/reports/city-cost/anomaly/SHA?severity=high,medium
 * GET /api/reports/city-cost/anomaly/BJS?types=volume_spike,cost_per_doc_increase
 */
export const GET = withCityFilter(
  async (
    request: NextRequest,
    cityFilter: CityFilterContext,
    context?: RouteParams
  ): Promise<NextResponse> => {
    try {
      // 權限檢查：全球管理員或區域管理員可訪問
      // 一般城市用戶也可透過 cityFilter.cityCodes 訪問其授權城市的報表
      // 此處 withCityFilter 已驗證用戶有授權城市

      // 獲取路徑參數
      const params = context?.params ? await context.params : null
      const cityCode = params?.cityCode

      if (!cityCode) {
        return NextResponse.json(
          {
            success: false,
            error: 'Missing required parameter: cityCode',
          },
          { status: 400 }
        )
      }

      // 驗證城市權限
      if (
        cityFilter.cityCodes.length > 0 &&
        !cityFilter.cityCodes.includes(cityCode)
      ) {
        return NextResponse.json(
          {
            success: false,
            error: `Access denied: Not authorized for city: ${cityCode}`,
          },
          { status: 403 }
        )
      }

      // 解析查詢參數
      const searchParams = request.nextUrl.searchParams
      const startDateStr = searchParams.get('startDate')
      const endDateStr = searchParams.get('endDate')
      const severityStr = searchParams.get('severity')
      const typesStr = searchParams.get('types')

      // 驗證日期格式
      if (startDateStr) {
        const startDate = new Date(startDateStr)
        if (isNaN(startDate.getTime())) {
          return NextResponse.json(
            {
              success: false,
              error: 'Invalid startDate format. Use ISO 8601 format (YYYY-MM-DD)',
            },
            { status: 400 }
          )
        }
      }

      if (endDateStr) {
        const endDate = new Date(endDateStr)
        if (isNaN(endDate.getTime())) {
          return NextResponse.json(
            {
              success: false,
              error: 'Invalid endDate format. Use ISO 8601 format (YYYY-MM-DD)',
            },
            { status: 400 }
          )
        }
      }

      // 解析 severity 過濾
      const validSeverities: AnomalySeverity[] = ['high', 'medium', 'low']
      let severity: AnomalySeverity[] | undefined
      if (severityStr) {
        severity = severityStr
          .split(',')
          .map((s) => s.trim() as AnomalySeverity)
          .filter((s) => validSeverities.includes(s))
      }

      // 解析 types 過濾
      const validTypes: AnomalyType[] = [
        'volume_spike',
        'volume_drop',
        'cost_per_doc_increase',
        'cost_per_doc_decrease',
        'api_cost_spike',
        'labor_cost_spike',
        'automation_rate_drop',
        'unknown',
      ]
      let types: AnomalyType[] | undefined
      if (typesStr) {
        types = typesStr
          .split(',')
          .map((t) => t.trim() as AnomalyType)
          .filter((t) => validTypes.includes(t))
      }

      // 構建查詢參數
      const queryParams: AnomalyAnalysisParams = {
        cityCode,
        startDate: startDateStr || undefined,
        endDate: endDateStr || undefined,
        severity,
        types,
      }

      // 獲取異常分析數據
      const analysis = await cityCostReportService.analyzeAnomaly(
        queryParams,
        cityFilter
      )

      return NextResponse.json({
        success: true,
        data: analysis,
      })
    } catch (error) {
      console.error('[City Cost Anomaly API] Error:', error)

      // 處理權限錯誤
      if (error instanceof Error && error.message.includes('Access denied')) {
        return NextResponse.json(
          {
            success: false,
            error: error.message,
          },
          { status: 403 }
        )
      }

      return NextResponse.json(
        {
          success: false,
          error: error instanceof Error ? error.message : 'Internal server error',
        },
        { status: 500 }
      )
    }
  }
)
