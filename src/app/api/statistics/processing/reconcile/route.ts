/**
 * @fileoverview 統計校驗 API
 * @description
 *   提供統計數據校驗與修正功能：
 *   - 驗證統計與原始記錄一致性
 *   - 自動修正數據不一致
 *   - 記錄審計日誌
 *   - 城市數據隔離
 *
 * @module src/app/api/statistics/processing/reconcile
 * @since Epic 7 - Story 7.7 (城市處理數量追蹤)
 * @lastModified 2025-12-19
 *
 * @features
 *   - AC4: 數據準確性校驗
 *   - 差異檢測與自動修正
 *   - 審計日誌記錄
 *
 * @dependencies
 *   - @/middleware/city-filter - 城市過濾中間件
 *   - @/services/processing-stats.service - 處理統計服務
 *   - zod - 請求驗證
 *
 * @related
 *   - src/types/processing-statistics.ts - 類型定義
 *   - src/services/processing-stats.service.ts - 服務層
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import {
  withCityFilter,
  CityFilterContext,
} from '@/middleware/city-filter'
import { processingStatsService } from '@/services/processing-stats.service'
import type { ReconciliationResponse } from '@/types/processing-statistics'

// ============================================================
// Validation Schema
// ============================================================

/**
 * 請求體驗證 Schema
 */
const bodySchema = z.object({
  cityCode: z.string().min(1, '城市代碼為必填'),
  date: z.string().min(1, '日期為必填'),
})

// ============================================================
// Helper Functions
// ============================================================

/**
 * 驗證並解析日期
 */
function parseDate(dateStr: string): Date | null {
  const parsed = new Date(dateStr)
  return isNaN(parsed.getTime()) ? null : parsed
}

// ============================================================
// Route Handler
// ============================================================

/**
 * POST /api/statistics/processing/reconcile
 *
 * @description
 *   執行統計數據校驗與修正。
 *   驗證統計與原始文件記錄的一致性，
 *   自動修正發現的差異並記錄審計日誌。
 *
 * @body
 *   - cityCode: 城市代碼（必填）
 *   - date: 日期（ISO 8601，必填）
 *
 * @returns {ReconciliationResponse}
 *   - success: 請求是否成功
 *   - data: 校驗結果
 *     - verified: 數據是否一致
 *     - discrepancies: 差異列表
 *     - corrected: 是否已修正
 *     - auditLogId: 審計日誌 ID
 */
export const POST = withCityFilter(
  async (
    request: NextRequest,
    cityContext: CityFilterContext
  ): Promise<NextResponse<ReconciliationResponse>> => {
    try {
      // --- 解析請求體 ---
      let body: unknown
      try {
        body = await request.json()
      } catch {
        return NextResponse.json(
          {
            success: false,
            data: {
              verified: false,
              discrepancies: [],
              corrected: false,
              auditLogId: '',
            },
          } as ReconciliationResponse,
          { status: 400 }
        )
      }

      const validation = bodySchema.safeParse(body)

      if (!validation.success) {
        return NextResponse.json(
          {
            success: false,
            data: {
              verified: false,
              discrepancies: [],
              corrected: false,
              auditLogId: '',
            },
          } as ReconciliationResponse,
          { status: 400 }
        )
      }

      const { cityCode, date } = validation.data

      // --- 驗證日期格式 ---
      const parsedDate = parseDate(date)
      if (!parsedDate) {
        return NextResponse.json(
          {
            success: false,
            data: {
              verified: false,
              discrepancies: [],
              corrected: false,
              auditLogId: '',
            },
          } as ReconciliationResponse,
          { status: 400 }
        )
      }

      // --- 驗證城市訪問權限 ---
      if (!cityContext.isGlobalAdmin && !cityContext.cityCodes.includes(cityCode)) {
        return NextResponse.json(
          {
            success: false,
            data: {
              verified: false,
              discrepancies: [],
              corrected: false,
              auditLogId: '',
            },
          } as ReconciliationResponse,
          { status: 403 }
        )
      }

      // --- 執行校驗與修正 ---
      const result = await processingStatsService.verifyAndReconcile(
        cityCode,
        parsedDate,
        cityContext.userId
      )

      // --- 返回成功響應 ---
      return NextResponse.json({
        success: true,
        data: result,
      } as ReconciliationResponse)
    } catch (error) {
      console.error('[Reconciliation API] Error:', error)

      return NextResponse.json(
        {
          success: false,
          data: {
            verified: false,
            discrepancies: [],
            corrected: false,
            auditLogId: '',
          },
        } as ReconciliationResponse,
        { status: 500 }
      )
    }
  }
)
