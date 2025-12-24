/**
 * @fileoverview 影響分析 API 端點
 * @description
 *   提供規則變更影響分析報告：
 *   - GET /api/rules/suggestions/[id]/impact - 獲取影響分析報告
 *
 * @module src/app/api/rules/suggestions/[id]/impact/route
 * @since Epic 4 - Story 4.5 (規則影響範圍分析)
 * @lastModified 2025-12-19
 *
 * @features
 *   - 分析受影響的歷史文件數量
 *   - 計算預計改善率和惡化率
 *   - 識別風險案例
 *   - 生成時間軸趨勢數據
 *
 * @dependencies
 *   - next/server - Next.js API 處理
 *   - @/lib/auth - NextAuth 認證
 *   - @/services/impact-analysis - 影響分析服務
 *   - @/types/permissions - 權限常量
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { impactAnalysisService } from '@/services/impact-analysis'
import { PERMISSIONS } from '@/types/permissions'

// ============================================================
// Helper Functions
// ============================================================

/**
 * 檢查用戶是否有規則查看權限
 *
 * @note 支援 wildcard ('*') 權限，開發模式下用戶擁有所有權限
 */
function hasRuleViewPermission(roles: { permissions: string[] }[] | undefined): boolean {
  if (!roles) return false
  return roles.some((r) =>
    r.permissions.includes('*') || r.permissions.includes(PERMISSIONS.RULE_VIEW)
  )
}

// ============================================================
// GET /api/rules/suggestions/[id]/impact
// ============================================================

/**
 * GET /api/rules/suggestions/[id]/impact
 * 獲取影響分析報告
 *
 * @description
 *   返回規則變更的影響分析，包括：
 *   - 統計數據（受影響文件、改善率、惡化率）
 *   - 風險案例列表（最多 20 個）
 *   - 時間軸趨勢數據（最近 30 天）
 *
 * @returns ImpactAnalysisResult
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: suggestionId } = await params

    // 認證檢查
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
          },
        },
        { status: 401 }
      )
    }

    // 權限檢查
    if (!hasRuleViewPermission(session.user.roles)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            type: 'forbidden',
            title: 'Forbidden',
            status: 403,
            detail: 'RULE_VIEW permission required',
          },
        },
        { status: 403 }
      )
    }

    // 執行影響分析
    const result = await impactAnalysisService.analyze(suggestionId)

    return NextResponse.json({
      success: true,
      data: result,
    })
  } catch (error) {
    console.error('Failed to analyze impact:', error)

    const message = error instanceof Error ? error.message : 'Unknown error'
    const status = message.includes('not found') ? 404 : 500

    return NextResponse.json(
      {
        success: false,
        error: {
          type: status === 404 ? 'not_found' : 'internal_error',
          title: status === 404 ? 'Not Found' : 'Internal Server Error',
          status,
          detail: message,
        },
      },
      { status }
    )
  }
}
