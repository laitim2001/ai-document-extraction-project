'use server'

/**
 * @fileoverview 全局分析 API
 * @description
 *   提供全局管理者的跨區域/城市分析數據：
 *   - 全局統計摘要（文件總數、成功率、活躍城市等）
 *   - 區域級統計數據
 *   - 城市排名（按處理量、成功率、效率）
 *   - 每日趨勢數據
 *
 * @module src/app/api/analytics/global
 * @author Development Team
 * @since Epic 6 - Story 6.4 (Global Admin Full Access)
 * @lastModified 2025-12-19
 *
 * @features
 *   - 全局統計摘要
 *   - 區域級聚合數據
 *   - 多維度城市排名
 *   - 時間趨勢分析
 *
 * @dependencies
 *   - @/lib/auth - 認證服務
 *   - @/lib/db-context - 資料庫上下文
 *   - zod - 請求驗證
 *
 * @related
 *   - src/app/(dashboard)/global/page.tsx - 全局儀表板頁面
 *   - src/components/global/GlobalStats.tsx - 全局統計組件
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

// ============================================================
// Validation Schema
// ============================================================

const querySchema = z.object({
  period: z.enum(['7d', '30d', '90d', '1y']).default('30d'),
  groupBy: z.enum(['city', 'region']).default('region'),
})

// ============================================================
// Types
// ============================================================

interface RegionStat {
  regionCode: string
  regionName: string
  cities: number
  documents: number
  successRate: number
  confidence: number
  trend: 'up' | 'down' | 'stable'
  trendValue: number
}

interface CityRanking {
  cityCode: string
  cityName: string
  value: number
}

interface DailyTrend {
  date: string
  documents: number
  successRate: number
}

// ============================================================
// Helper Functions
// ============================================================

/**
 * 獲取區域統計數據
 */
async function getRegionStats(startDate: Date): Promise<RegionStat[]> {
  const regions = await withServiceRole(async (tx) => {
    return tx.region.findMany({
      where: { status: 'ACTIVE' },
      include: {
        cities: {
          where: { status: 'ACTIVE' },
          select: { code: true },
        },
      },
    })
  })

  const stats = await Promise.all(
    regions.map(async (region) => {
      const cityCodes = region.cities.map((c) => c.code)

      if (cityCodes.length === 0) {
        return {
          regionCode: region.code,
          regionName: region.name,
          cities: 0,
          documents: 0,
          successRate: 0,
          confidence: 0,
          trend: 'stable' as const,
          trendValue: 0,
        }
      }

      const [docCount, completedCount, avgConf, prevPeriodCount] =
        await withServiceRole(async (tx) => {
          // 計算前一期間的起始日期
          const prevStartDate = new Date(
            startDate.getTime() - (Date.now() - startDate.getTime())
          )

          return Promise.all([
            // 當期文件數
            tx.document.count({
              where: {
                cityCode: { in: cityCodes },
                createdAt: { gte: startDate },
              },
            }),

            // 當期完成數
            tx.document.count({
              where: {
                cityCode: { in: cityCodes },
                createdAt: { gte: startDate },
                status: 'COMPLETED',
              },
            }),

            // 平均信心度（從 ExtractionResult）
            tx.extractionResult.aggregate({
              where: {
                document: {
                  cityCode: { in: cityCodes },
                  createdAt: { gte: startDate },
                },
              },
              _avg: { averageConfidence: true },
            }),

            // 前一期間文件數（用於計算趨勢）
            tx.document.count({
              where: {
                cityCode: { in: cityCodes },
                createdAt: {
                  gte: prevStartDate,
                  lt: startDate,
                },
              },
            }),
          ])
        })

      const trendValue =
        prevPeriodCount > 0
          ? ((docCount - prevPeriodCount) / prevPeriodCount) * 100
          : 0

      return {
        regionCode: region.code,
        regionName: region.name,
        cities: cityCodes.length,
        documents: docCount,
        successRate: docCount > 0 ? completedCount / docCount : 0,
        confidence: (avgConf._avg.averageConfidence ?? 0) / 100,
        trend: (trendValue > 5
          ? 'up'
          : trendValue < -5
            ? 'down'
            : 'stable') as 'up' | 'down' | 'stable',
        trendValue,
      }
    })
  )

  return stats.sort((a, b) => b.documents - a.documents)
}

/**
 * 獲取城市排名
 */
async function getCityRankings(startDate: Date): Promise<{
  byVolume: CityRanking[]
  bySuccessRate: CityRanking[]
  byEfficiency: CityRanking[]
}> {
  // 按處理量排名
  const byVolume = await withServiceRole(async (tx) => {
    return tx.document.groupBy({
      by: ['cityCode'],
      where: { createdAt: { gte: startDate } },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 10,
    })
  })

  // 獲取城市名稱
  const allCityCodes = byVolume.map((v) => v.cityCode)
  const cities = await withServiceRole(async (tx) => {
    return tx.city.findMany({
      where: { code: { in: allCityCodes } },
      select: { code: true, name: true },
    })
  })
  const cityNameMap = Object.fromEntries(cities.map((c) => [c.code, c.name]))

  // 按成功率排名（最少 100 筆文件）
  const bySuccessRate = await withServiceRole(async (tx) => {
    return tx.$queryRaw<
      Array<{
        city_code: string
        success_rate: number
      }>
    >`
      SELECT
        city_code,
        AVG(CASE WHEN status = 'COMPLETED' THEN 1.0 ELSE 0.0 END) as success_rate
      FROM documents
      WHERE created_at >= ${startDate}
      GROUP BY city_code
      HAVING COUNT(*) >= 100
      ORDER BY success_rate DESC
      LIMIT 10
    `
  })

  // 按效率排名（平均處理時間，越低越好）
  const byEfficiency = await withServiceRole(async (tx) => {
    return tx.$queryRaw<
      Array<{
        city_code: string
        avg_time: number
      }>
    >`
      SELECT
        d.city_code,
        AVG(e.processing_time) as avg_time
      FROM documents d
      JOIN extraction_results e ON d.id = e.document_id
      WHERE d.created_at >= ${startDate}
        AND e.processing_time IS NOT NULL
      GROUP BY d.city_code
      HAVING COUNT(*) >= 100
      ORDER BY avg_time ASC
      LIMIT 10
    `
  })

  return {
    byVolume: byVolume.map((v) => ({
      cityCode: v.cityCode,
      cityName: cityNameMap[v.cityCode] || v.cityCode,
      value: v._count.id,
    })),
    bySuccessRate: bySuccessRate.map((v) => ({
      cityCode: v.city_code,
      cityName: cityNameMap[v.city_code] || v.city_code,
      value: v.success_rate,
    })),
    byEfficiency: byEfficiency.map((v) => ({
      cityCode: v.city_code,
      cityName: cityNameMap[v.city_code] || v.city_code,
      value: v.avg_time / 1000, // 轉換為秒
    })),
  }
}

/**
 * 獲取每日趨勢數據
 */
async function getDailyTrend(startDate: Date): Promise<DailyTrend[]> {
  const trend = await withServiceRole(async (tx) => {
    return tx.$queryRaw<
      Array<{
        date: Date
        documents: bigint
        success_rate: number
      }>
    >`
      SELECT
        DATE(created_at) as date,
        COUNT(*) as documents,
        AVG(CASE WHEN status = 'COMPLETED' THEN 1.0 ELSE 0.0 END) as success_rate
      FROM documents
      WHERE created_at >= ${startDate}
      GROUP BY DATE(created_at)
      ORDER BY date
    `
  })

  return trend.map((t) => ({
    date: t.date.toISOString().split('T')[0],
    documents: Number(t.documents),
    successRate: t.success_rate,
  }))
}

// ============================================================
// Route Handler
// ============================================================

/**
 * GET /api/analytics/global
 *
 * @description
 *   獲取全局分析數據。僅限全局管理者訪問。
 *
 * @query
 *   - period: 時間週期 (7d/30d/90d/1y，預設 30d)
 *   - groupBy: 分組方式 (city/region，預設 region)
 *
 * @returns 全局統計、區域數據、城市排名、趨勢數據
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
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

  // 只有全局管理者可以訪問
  if (!session.user.isGlobalAdmin) {
    return NextResponse.json(
      {
        type: 'https://api.example.com/errors/forbidden',
        title: 'Forbidden',
        status: 403,
        detail: 'Global admin access required',
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

  const { period } = validation.data

  // --- 計算日期範圍 ---
  const now = new Date()
  const startDate = new Date(now)
  startDate.setDate(startDate.getDate() - PERIOD_DAYS[period])

  try {
    // --- 並行獲取所有數據 ---
    const [
      totalDocuments,
      processedDocuments,
      avgConfidence,
      activeCities,
      activeUsers,
      regionStats,
      cityRankings,
      dailyTrend,
    ] = await Promise.all([
      // 總文件數
      withServiceRole((tx) =>
        tx.document.count({
          where: { createdAt: { gte: startDate } },
        })
      ),

      // 已完成文件數
      withServiceRole((tx) =>
        tx.document.count({
          where: {
            createdAt: { gte: startDate },
            status: 'COMPLETED',
          },
        })
      ),

      // 平均信心度
      withServiceRole((tx) =>
        tx.extractionResult.aggregate({
          where: {
            document: { createdAt: { gte: startDate } },
          },
          _avg: { averageConfidence: true },
        })
      ),

      // 活躍城市數
      withServiceRole((tx) =>
        tx.city.count({
          where: { status: 'ACTIVE' },
        })
      ),

      // 活躍用戶數（在期間內有登入）
      withServiceRole((tx) =>
        tx.user.count({
          where: {
            status: 'ACTIVE',
            lastLoginAt: { gte: startDate },
          },
        })
      ),

      // 區域統計
      getRegionStats(startDate),

      // 城市排名
      getCityRankings(startDate),

      // 每日趨勢
      getDailyTrend(startDate),
    ])

    // --- 返回結果 ---
    return NextResponse.json({
      success: true,
      data: {
        period: {
          start: startDate.toISOString(),
          end: now.toISOString(),
        },
        global: {
          totalDocuments,
          processedDocuments,
          successRate:
            totalDocuments > 0 ? processedDocuments / totalDocuments : 0,
          averageConfidence: (avgConfidence._avg.averageConfidence ?? 0) / 100,
          activeCities,
          activeUsers,
        },
        regions: regionStats,
        cityRankings,
        trend: dailyTrend,
      },
    })
  } catch (error) {
    console.error('[Global Analytics API] Error:', error)

    return NextResponse.json(
      {
        type: 'https://api.example.com/errors/internal',
        title: 'Internal Server Error',
        status: 500,
        detail: 'Failed to fetch global analytics',
      },
      { status: 500 }
    )
  }
}
