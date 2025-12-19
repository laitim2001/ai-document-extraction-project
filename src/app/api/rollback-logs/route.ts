/**
 * @fileoverview 回滾歷史 API 端點
 * @description
 *   提供回滾歷史的查詢功能：
 *   - 取得系統的回滾日誌列表
 *   - 支援按規則 ID 和觸發類型過濾
 *   - 支援分頁查詢
 *
 * @module src/app/api/rollback-logs/route
 * @since Epic 4 - Story 4.8 (規則自動回滾)
 * @lastModified 2025-12-19
 *
 * @features
 *   - 分頁查詢回滾日誌列表
 *   - 按規則 ID 過濾
 *   - 按觸發類型過濾 (AUTO, MANUAL, EMERGENCY)
 *
 * @dependencies
 *   - next/server - Next.js API 處理
 *   - @/lib/auth - NextAuth 認證
 *   - @/services/auto-rollback - 自動回滾服務
 *   - zod - 輸入驗證
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { hasPermission } from '@/lib/auth/city-permission'
import { PERMISSIONS } from '@/types/permissions'
import { autoRollbackService } from '@/services/auto-rollback'
import type { RollbackTrigger } from '@/types/accuracy'

// ============================================================
// Validation Schemas
// ============================================================

/**
 * 查詢參數驗證 Schema
 */
const querySchema = z.object({
  ruleId: z.string().uuid().optional(),
  trigger: z.enum(['AUTO', 'MANUAL', 'EMERGENCY']).optional(),
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(100).default(20),
})

// ============================================================
// GET /api/rollback-logs
// ============================================================

/**
 * GET /api/rollback-logs
 * 取得回滾歷史列表
 *
 * @description
 *   查詢系統的回滾歷史：
 *   1. 驗證用戶認證
 *   2. 檢查 RULE_VIEW 權限
 *   3. 返回分頁的回滾日誌列表
 *
 * @query ruleId - 規則 ID 過濾（可選）
 * @query trigger - 觸發類型過濾（可選）：AUTO, MANUAL, EMERGENCY
 * @query page - 頁碼（預設 1）
 * @query pageSize - 每頁數量（預設 20，最大 100）
 *
 * @returns RollbackHistoryResponse
 */
export async function GET(request: NextRequest) {
  try {
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
            instance: '/api/rollback-logs',
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
            instance: '/api/rollback-logs',
          },
        },
        { status: 403 }
      )
    }

    // 3. 解析查詢參數
    const searchParams = request.nextUrl.searchParams
    const queryResult = querySchema.safeParse({
      ruleId: searchParams.get('ruleId') ?? undefined,
      trigger: searchParams.get('trigger') ?? undefined,
      page: searchParams.get('page') ?? undefined,
      pageSize: searchParams.get('pageSize') ?? undefined,
    })

    if (!queryResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            type: 'validation_error',
            title: 'Validation Error',
            status: 400,
            detail: queryResult.error.issues[0].message,
            instance: '/api/rollback-logs',
          },
        },
        { status: 400 }
      )
    }

    const { ruleId, trigger, page, pageSize } = queryResult.data

    // 4. 獲取回滾歷史
    const history = await autoRollbackService.getRollbackHistory({
      ruleId,
      trigger: trigger as RollbackTrigger | undefined,
      page,
      pageSize,
    })

    return NextResponse.json({
      success: true,
      data: history,
    })
  } catch (error) {
    console.error('Error fetching rollback logs:', error)

    return NextResponse.json(
      {
        success: false,
        error: {
          type: 'internal_error',
          title: 'Internal Server Error',
          status: 500,
          detail: 'An unexpected error occurred',
          instance: '/api/rollback-logs',
        },
      },
      { status: 500 }
    )
  }
}
