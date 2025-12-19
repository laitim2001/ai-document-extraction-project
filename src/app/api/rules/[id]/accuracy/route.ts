/**
 * @fileoverview 規則準確率 API 端點
 * @description
 *   提供規則準確率的查詢功能：
 *   - 取得指定規則的當前準確率指標
 *   - 取得歷史準確率趨勢
 *
 * @module src/app/api/rules/[id]/accuracy/route
 * @since Epic 4 - Story 4.8 (規則自動回滾)
 * @lastModified 2025-12-19
 *
 * @features
 *   - 當前版本準確率指標
 *   - 7 天歷史準確率趨勢
 *   - 樣本數量統計
 *
 * @dependencies
 *   - next/server - Next.js API 處理
 *   - @/lib/auth - NextAuth 認證
 *   - @/lib/prisma - Prisma 客戶端
 *   - @/services/rule-accuracy - 準確率服務
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { hasPermission } from '@/lib/auth/city-permission'
import { PERMISSIONS } from '@/types/permissions'
import { ruleAccuracyService } from '@/services/rule-accuracy'
import type { AccuracyApiResponse } from '@/types/accuracy'

// ============================================================
// GET /api/rules/[id]/accuracy
// ============================================================

/**
 * GET /api/rules/[id]/accuracy
 * 取得規則準確率指標
 *
 * @description
 *   查詢指定規則的準確率數據：
 *   1. 驗證用戶認證
 *   2. 檢查 RULE_VIEW 權限
 *   3. 驗證規則存在
 *   4. 返回當前準確率和歷史趨勢
 *
 * @param id - 規則 ID
 *
 * @returns AccuracyApiResponse
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: ruleId } = await params

    // 1. 認證檢查
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json(
        {
          success: false,
          error: {
            type: 'unauthorized',
            title: 'Unauthorized',
            status: 401,
            detail: 'Authentication required',
            instance: `/api/rules/${ruleId}/accuracy`,
          },
        },
        { status: 401 }
      )
    }

    // 2. 權限檢查
    if (!hasPermission(session.user, PERMISSIONS.RULE_VIEW)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            type: 'forbidden',
            title: 'Forbidden',
            status: 403,
            detail: 'RULE_VIEW permission required',
            instance: `/api/rules/${ruleId}/accuracy`,
          },
        },
        { status: 403 }
      )
    }

    // 3. 取得規則
    const rule = await prisma.mappingRule.findUnique({
      where: { id: ruleId },
      select: { version: true },
    })

    if (!rule) {
      return NextResponse.json(
        {
          success: false,
          error: {
            type: 'not_found',
            title: 'Rule Not Found',
            status: 404,
            detail: `Rule with ID ${ruleId} not found`,
            instance: `/api/rules/${ruleId}/accuracy`,
          },
        },
        { status: 404 }
      )
    }

    // 4. 計算當前準確率
    const currentMetrics = await ruleAccuracyService.calculateAccuracy(
      ruleId,
      rule.version
    )

    // 5. 獲取歷史趨勢
    const historicalTrend = await ruleAccuracyService.getHistoricalAccuracy(
      ruleId,
      7
    )

    const response: AccuracyApiResponse = {
      ruleId,
      currentVersion: rule.version,
      current: currentMetrics,
      historical: historicalTrend,
    }

    return NextResponse.json({
      success: true,
      data: response,
    })
  } catch (error) {
    console.error('Error fetching accuracy:', error)

    const ruleId = (await params).id
    return NextResponse.json(
      {
        success: false,
        error: {
          type: 'internal_error',
          title: 'Internal Server Error',
          status: 500,
          detail: 'An unexpected error occurred',
          instance: `/api/rules/${ruleId}/accuracy`,
        },
      },
      { status: 500 }
    )
  }
}
