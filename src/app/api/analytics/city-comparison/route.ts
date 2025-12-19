'use server'

/**
 * @fileoverview 城市對比分析 API
 * @description
 *   提供跨城市的績效指標對比分析：
 *   - 驗證用戶城市訪問權限
 *   - 計算各城市的處理量、成功率、信心度等指標
 *   - 提供時間趨勢數據
 *   - 計算跨城市比較統計
 *
 * @module src/app/api/analytics/city-comparison
 * @author Development Team
 * @since Epic 6 - Story 6.3 (Regional Manager Cross-City Access)
 * @lastModified 2025-12-19
 *
 * @features
 *   - 多城市指標對比
 *   - 時間週期篩選 (7d/30d/90d/1y)
 *   - 趨勢數據計算
 *   - 最佳/最差城市識別
 *
 * @dependencies
 *   - @/lib/auth - 認證服務
 *   - @/lib/db-context - 資料庫上下文
 *   - zod - 請求驗證
 *
 * @related
 *   - src/components/analytics/CityComparison.tsx - 城市對比組件
 *   - src/app/api/cities/accessible/route.ts - 可訪問城市 API
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { withServiceRole } from '@/lib/db-context'
import { z } from 'zod'

// ============================================================
// Constants
// ============================================================

/** 期間對應天數 */
const PERIOD_DAYS: Record<string, number> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
  '1y': 365,
}

/** 指標標籤 */
const METRIC_NAMES = [
  'documentsProcessed',
  'successRate',
  'averageConfidence',
  'averageProcessingTime',
  'correctionRate',
  'escalationRate',
] as const

// ============================================================
// Validation Schema
// ============================================================

const querySchema = z.object({
  cities: z
    .string()
    .min(1, '必須選擇至少一個城市')
    .transform((s) => s.split(',').filter(Boolean)),
  period: z.enum(['7d', '30d', '90d', '1y']).default('30d'),
  metrics: z
    .string()
    .optional()
    .transform((s) =>
      s?.split(',').filter(Boolean) || [...METRIC_NAMES]
    ),
})

// ============================================================
// Types
// ============================================================

interface CityMetrics {
  cityCode: string
  cityName: string
  metrics: {
    documentsProcessed: number
    successRate: number
    averageConfidence: number
    averageProcessingTime: number
    correctionRate: number
    escalationRate: number
  }
  trend: Array<{
    date: string
    processed: number
    successRate: number
  }>
}

interface ComparisonResult {
  metric: string
  best: { cityCode: string; value: number }
  worst: { cityCode: string; value: number }
  average: number
  standardDeviation: number
}

// ============================================================
// Helper Functions
// ============================================================

/**
 * 計算跨城市比較統計
 */
function calculateComparison(cityMetrics: CityMetrics[]): ComparisonResult[] {
  return METRIC_NAMES.map((metric) => {
    const values = cityMetrics.map((cm) => ({
      cityCode: cm.cityCode,
      value: cm.metrics[metric] ?? 0,
    }))

    // 根據指標類型決定排序方向
    // 處理時間、修正率、升級率越低越好
    const lowerIsBetter = [
      'averageProcessingTime',
      'correctionRate',
      'escalationRate',
    ].includes(metric)

    const sorted = [...values].sort((a, b) =>
      lowerIsBetter ? a.value - b.value : b.value - a.value
    )

    const numericValues = values.map((v) => v.value)
    const avg =
      numericValues.length > 0
        ? numericValues.reduce((a, b) => a + b, 0) / numericValues.length
        : 0
    const variance =
      numericValues.length > 0
        ? numericValues.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) /
          numericValues.length
        : 0
    const stdDev = Math.sqrt(variance)

    return {
      metric,
      best: sorted[0] || { cityCode: '', value: 0 },
      worst: sorted[sorted.length - 1] || { cityCode: '', value: 0 },
      average: avg,
      standardDeviation: stdDev,
    }
  })
}

// ============================================================
// Route Handler
// ============================================================

/**
 * GET /api/analytics/city-comparison
 *
 * @description
 *   獲取城市對比分析數據。
 *
 * @query
 *   - cities: 逗號分隔的城市代碼列表（必填）
 *   - period: 時間週期 (7d/30d/90d/1y，預設 30d)
 *   - metrics: 要查詢的指標（可選，預設所有）
 *
 * @returns 城市指標對比數據和統計
 */
export async function GET(
  request: NextRequest
): Promise<NextResponse> {
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

  const { user } = session
  const userCities = user.cityCodes ?? []
  const isGlobalAdmin = user.isGlobalAdmin ?? false

  // 必須有多城市訪問權限
  if (!isGlobalAdmin && userCities.length < 2) {
    return NextResponse.json(
      {
        type: 'https://api.example.com/errors/forbidden',
        title: 'Forbidden',
        status: 403,
        detail: 'Multi-city access required for comparison',
      },
      { status: 403 }
    )
  }

  // --- 解析參數 ---
  const searchParams = Object.fromEntries(request.nextUrl.searchParams)
  const validation = querySchema.safeParse(searchParams)

  if (!validation.success) {
    return NextResponse.json(
      {
        type: 'https://api.example.com/errors/validation',
        title: 'Validation Error',
        status: 400,
        detail: 'Invalid parameters',
        errors: validation.error.flatten().fieldErrors,
      },
      { status: 400 }
    )
  }

  const { cities, period } = validation.data

  // --- 驗證城市訪問權限 ---
  if (!isGlobalAdmin) {
    const unauthorized = cities.filter((c) => !userCities.includes(c))
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

  // --- 計算日期範圍 ---
  const now = new Date()
  const startDate = new Date(now)
  startDate.setDate(startDate.getDate() - PERIOD_DAYS[period])

  try {
    // --- 獲取城市信息 ---
    const cityInfos = await withServiceRole(async (tx) => {
      return tx.city.findMany({
        where: { code: { in: cities } },
        select: { code: true, name: true },
      })
    })

    const cityNameMap = new Map(
      cityInfos.map((c) => [c.code, c.name])
    )

    // --- 計算各城市指標 ---
    const cityMetrics = await Promise.all(
      cities.map(async (cityCode): Promise<CityMetrics> => {
        const where = {
          cityCode,
          createdAt: { gte: startDate },
        }

        const [
          totalDocs,
          completedDocs,
          avgMetrics,
          corrections,
          escalations,
          trendData,
        ] = await withServiceRole(async (tx) => {
          return Promise.all([
            // 總文件數
            tx.document.count({ where }),

            // 完成的文件數
            tx.document.count({
              where: { ...where, status: 'COMPLETED' },
            }),

            // 平均指標（從 ExtractionResult）
            tx.extractionResult.aggregate({
              where: {
                document: where,
              },
              _avg: {
                averageConfidence: true,
                processingTime: true,
              },
            }),

            // 修正記錄數
            tx.correction.count({
              where: { document: where },
            }),

            // 升級記錄數
            tx.escalation.count({
              where: { document: where },
            }),

            // 每日趨勢數據
            tx.$queryRaw<
              Array<{
                date: Date
                processed: bigint
                completed: bigint
              }>
            >`
              SELECT
                DATE(created_at) as date,
                COUNT(*) as processed,
                COUNT(*) FILTER (WHERE status = 'COMPLETED') as completed
              FROM documents
              WHERE city_code = ${cityCode}
                AND created_at >= ${startDate}
              GROUP BY DATE(created_at)
              ORDER BY date
            `,
          ])
        })

        return {
          cityCode,
          cityName: cityNameMap.get(cityCode) || cityCode,
          metrics: {
            documentsProcessed: totalDocs,
            successRate: totalDocs > 0 ? completedDocs / totalDocs : 0,
            averageConfidence: (avgMetrics._avg.averageConfidence ?? 0) / 100, // 轉換為 0-1 範圍
            averageProcessingTime: (avgMetrics._avg.processingTime ?? 0) / 1000, // 轉換為秒
            correctionRate: totalDocs > 0 ? corrections / totalDocs : 0,
            escalationRate: totalDocs > 0 ? escalations / totalDocs : 0,
          },
          trend: trendData.map((t) => ({
            date: t.date.toISOString().split('T')[0],
            processed: Number(t.processed),
            successRate:
              Number(t.processed) > 0
                ? Number(t.completed) / Number(t.processed)
                : 0,
          })),
        }
      })
    )

    // --- 計算比較統計 ---
    const comparison = calculateComparison(cityMetrics)

    // --- 返回結果 ---
    return NextResponse.json({
      success: true,
      data: {
        period: {
          start: startDate.toISOString(),
          end: now.toISOString(),
        },
        cities: cityMetrics,
        comparison,
      },
    })
  } catch (error) {
    console.error('[City Comparison API] Error:', error)

    return NextResponse.json(
      {
        type: 'https://api.example.com/errors/internal',
        title: 'Internal Server Error',
        status: 500,
        detail: 'Failed to calculate city comparison',
      },
      { status: 500 }
    )
  }
}
