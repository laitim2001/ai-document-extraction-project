/**
 * @fileoverview 規則模擬測試 API 端點
 * @description
 *   提供規則變更模擬測試功能：
 *   - POST /api/rules/suggestions/[id]/simulate - 執行模擬測試
 *
 * @module src/app/api/rules/suggestions/[id]/simulate/route
 * @since Epic 4 - Story 4.5 (規則影響範圍分析)
 * @lastModified 2025-12-19
 *
 * @features
 *   - 對歷史數據執行規則模擬
 *   - 可配置樣本數量和日期範圍
 *   - 返回改善/惡化/無變化統計
 *   - 計算準確率變化
 *
 * @dependencies
 *   - next/server - Next.js API 處理
 *   - @/lib/auth - NextAuth 認證
 *   - @/services/rule-simulation - 規則模擬服務
 *   - @/types/permissions - 權限常量
 *   - zod - 請求驗證
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { ruleSimulationService } from '@/services/rule-simulation'
import { PERMISSIONS } from '@/types/permissions'
import { z } from 'zod'

// ============================================================
// Validation Schema
// ============================================================

const SimulationRequestSchema = z.object({
  sampleSize: z.number().int().min(10).max(1000).optional().default(100),
  dateRange: z
    .object({
      start: z.string().datetime(),
      end: z.string().datetime(),
    })
    .optional(),
  includeUnverified: z.boolean().optional().default(false),
})

// ============================================================
// Helper Functions
// ============================================================

/**
 * 檢查用戶是否有規則管理權限
 *
 * @note 支援 wildcard ('*') 權限，開發模式下用戶擁有所有權限
 */
function hasRuleManagePermission(roles: { permissions: string[] }[] | undefined): boolean {
  if (!roles) return false
  return roles.some((r) =>
    r.permissions.includes('*') || r.permissions.includes(PERMISSIONS.RULE_MANAGE)
  )
}

// ============================================================
// POST /api/rules/suggestions/[id]/simulate
// ============================================================

/**
 * POST /api/rules/suggestions/[id]/simulate
 * 執行規則模擬測試
 *
 * @description
 *   對歷史數據執行規則變更模擬，返回：
 *   - 測試樣本統計
 *   - 改善/惡化/無變化分類結果
 *   - 準確率變化計算
 *
 * @body SimulationRequest
 * @returns SimulationResult
 */
export async function POST(
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

    // 權限檢查 - 模擬測試需要 RULE_MANAGE 權限
    if (!hasRuleManagePermission(session.user.roles)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            type: 'forbidden',
            title: 'Forbidden',
            status: 403,
            detail: 'RULE_MANAGE permission required',
          },
        },
        { status: 403 }
      )
    }

    // 解析並驗證請求體
    const body = await request.json()
    const parseResult = SimulationRequestSchema.safeParse(body)

    if (!parseResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            type: 'validation_error',
            title: 'Validation Error',
            status: 400,
            detail: 'Invalid request parameters',
            errors: parseResult.error.flatten().fieldErrors,
          },
        },
        { status: 400 }
      )
    }

    // 執行模擬測試
    const result = await ruleSimulationService.simulate(suggestionId, parseResult.data)

    return NextResponse.json({
      success: true,
      data: result,
    })
  } catch (error) {
    console.error('Failed to run simulation:', error)

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
