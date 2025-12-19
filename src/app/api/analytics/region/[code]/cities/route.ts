'use server'

/**
 * @fileoverview 區域城市詳情 API
 * @description
 *   提供指定區域下所有城市的詳細統計數據：
 *   - 各城市的處理量、成功率、信心度等指標
 *   - 修正率和升級率
 *   - 用於全局儀表板的區域展開視圖
 *
 * @module src/app/api/analytics/region/[code]/cities
 * @author Development Team
 * @since Epic 6 - Story 6.4 (Global Admin Full Access)
 * @lastModified 2025-12-19
 *
 * @features
 *   - 區域城市列表
 *   - 各城市績效指標
 *   - 僅限全局管理者訪問
 *
 * @dependencies
 *   - @/lib/auth - 認證服務
 *   - @/lib/db-context - 資料庫上下文
 *   - zod - 請求驗證
 *
 * @related
 *   - src/app/api/analytics/global/route.ts - 全局分析 API
 *   - src/components/global/RegionView.tsx - 區域視圖組件
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
})

// ============================================================
// Types
// ============================================================

interface CityStats {
  code: string
  name: string
  documents: number
  successRate: number
  confidence: number
  correctionRate: number
  escalationRate: number
  activeUsers: number
}

// ============================================================
// Route Handler
// ============================================================

/**
 * GET /api/analytics/region/[code]/cities
 *
 * @description
 *   獲取指定區域下所有城市的詳細統計數據。
 *   僅限全局管理者訪問。
 *
 * @params
 *   - code: 區域代碼
 *
 * @query
 *   - period: 時間週期 (7d/30d/90d/1y，預設 30d)
 *
 * @returns 區域城市列表及各城市統計數據
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
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

  // --- 獲取區域代碼 ---
  const { code: regionCode } = await params

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
    // --- 驗證區域存在 ---
    const region = await withServiceRole(async (tx) => {
      return tx.region.findUnique({
        where: { code: regionCode },
        select: { code: true, name: true },
      })
    })

    if (!region) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/not-found',
          title: 'Not Found',
          status: 404,
          detail: `Region not found: ${regionCode}`,
        },
        { status: 404 }
      )
    }

    // --- 獲取區域下的城市 ---
    const cities = await withServiceRole(async (tx) => {
      return tx.city.findMany({
        where: {
          region: { code: regionCode },
          status: 'ACTIVE',
        },
        select: { id: true, code: true, name: true },
        orderBy: { name: 'asc' },
      })
    })

    // --- 計算各城市指標 ---
    const cityStats: CityStats[] = await Promise.all(
      cities.map(async (city) => {
        const where = {
          cityCode: city.code,
          createdAt: { gte: startDate },
        }

        const [
          totalDocs,
          completedDocs,
          avgMetrics,
          corrections,
          escalations,
          activeUsers,
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
              where: { document: where },
              _avg: { averageConfidence: true },
            }),

            // 修正記錄數
            tx.correction.count({
              where: { document: where },
            }),

            // 升級記錄數
            tx.escalation.count({
              where: { document: where },
            }),

            // 活躍用戶數
            tx.userCityAccess.count({
              where: {
                cityId: city.id,
                user: {
                  status: 'ACTIVE',
                  lastLoginAt: { gte: startDate },
                },
              },
            }),
          ])
        })

        return {
          code: city.code,
          name: city.name,
          documents: totalDocs,
          successRate: totalDocs > 0 ? completedDocs / totalDocs : 0,
          confidence: (avgMetrics._avg.averageConfidence ?? 0) / 100,
          correctionRate: totalDocs > 0 ? corrections / totalDocs : 0,
          escalationRate: totalDocs > 0 ? escalations / totalDocs : 0,
          activeUsers,
        }
      })
    )

    // --- 按處理量排序 ---
    cityStats.sort((a, b) => b.documents - a.documents)

    // --- 返回結果 ---
    return NextResponse.json({
      success: true,
      data: {
        region: {
          code: region.code,
          name: region.name,
        },
        period: {
          start: startDate.toISOString(),
          end: now.toISOString(),
        },
        cities: cityStats,
        summary: {
          totalCities: cityStats.length,
          totalDocuments: cityStats.reduce((sum, c) => sum + c.documents, 0),
          averageSuccessRate:
            cityStats.length > 0
              ? cityStats.reduce((sum, c) => sum + c.successRate, 0) /
                cityStats.length
              : 0,
        },
      },
    })
  } catch (error) {
    console.error('[Region Cities API] Error:', error)

    return NextResponse.json(
      {
        type: 'https://api.example.com/errors/internal',
        title: 'Internal Server Error',
        status: 500,
        detail: 'Failed to fetch region cities',
      },
      { status: 500 }
    )
  }
}
