/**
 * @fileoverview AI 術語驗證成本查詢 API 端點
 * @description
 *   提供術語驗證成本追蹤和統計查詢功能：
 *   - 查詢驗證成本記錄
 *   - 取得統計摘要
 *   - 支援日期範圍和批次篩選
 *
 * @module src/app/api/v1/admin/costs/term-validation
 * @author Development Team
 * @since Epic 0 - Story 0-10 (AI 術語驗證服務)
 * @lastModified 2025-01-01
 *
 * @features
 *   - GET: 查詢成本統計和記錄
 *   - 支援日期範圍篩選
 *   - 支援批次 ID 篩選
 *   - 分頁支援
 *
 * @related
 *   - src/services/ai-term-validator.service.ts - 核心驗證服務
 *   - src/types/term-validation.ts - 類型定義
 *   - src/app/api/v1/admin/terms/validate/route.ts - 術語驗證 API
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { aiTermValidator } from '@/services/ai-term-validator.service'
import type { TermValidationCostResponse } from '@/types/term-validation'

// ============================================================================
// Validation Schemas
// ============================================================================

/**
 * 成本查詢參數 Schema
 */
const CostQuerySchema = z.object({
  /** 開始日期 (ISO 8601) */
  startDate: z.string().datetime().optional(),

  /** 結束日期 (ISO 8601) */
  endDate: z.string().datetime().optional(),

  /** 批次 ID */
  batchId: z.string().optional(),

  /** 分頁 - 頁碼 (1-based) */
  page: z.coerce.number().min(1).default(1),

  /** 分頁 - 每頁記錄數 */
  limit: z.coerce.number().min(1).max(100).default(20),

  /** 是否包含詳細記錄 */
  includeRecords: z.enum(['true', 'false']).default('false'),
})

// ============================================================================
// API Handler
// ============================================================================

/**
 * GET /api/v1/admin/costs/term-validation
 *
 * @description 查詢術語驗證成本統計和記錄
 *
 * @queryParams
 *   - startDate: string (ISO 8601) - 開始日期
 *   - endDate: string (ISO 8601) - 結束日期
 *   - batchId: string - 批次 ID 篩選
 *   - page: number - 頁碼 (預設: 1)
 *   - limit: number - 每頁記錄數 (預設: 20, 最大: 100)
 *   - includeRecords: 'true' | 'false' - 是否包含詳細記錄 (預設: false)
 *
 * @returns {TermValidationCostResponse} 成本統計和記錄
 *
 * @example
 * // Request
 * GET /api/v1/admin/costs/term-validation?startDate=2025-01-01T00:00:00Z&includeRecords=true
 *
 * // Response
 * {
 *   "success": true,
 *   "stats": {
 *     "periodStart": "2025-01-01T00:00:00.000Z",
 *     "periodEnd": "2025-01-01T23:59:59.999Z",
 *     "totalValidations": 50,
 *     "totalTermsProcessed": 2500,
 *     "totalCost": 5.50,
 *     "avgCostPerBatch": 0.11,
 *     ...
 *   },
 *   "records": [...],
 *   "pagination": {
 *     "total": 50,
 *     "page": 1,
 *     "limit": 20,
 *     "totalPages": 3
 *   }
 * }
 */
export async function GET(request: NextRequest) {
  try {
    // 1. 解析查詢參數
    const { searchParams } = new URL(request.url)
    const queryParams = {
      startDate: searchParams.get('startDate') || undefined,
      endDate: searchParams.get('endDate') || undefined,
      batchId: searchParams.get('batchId') || undefined,
      page: searchParams.get('page') || '1',
      limit: searchParams.get('limit') || '20',
      includeRecords: searchParams.get('includeRecords') || 'false',
    }

    // 2. 驗證參數
    const parseResult = CostQuerySchema.safeParse(queryParams)
    if (!parseResult.success) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/validation',
          title: 'Validation Error',
          status: 400,
          detail: '查詢參數驗證失敗',
          instance: '/api/v1/admin/costs/term-validation',
          errors: parseResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      )
    }

    const { startDate, endDate, batchId, page, limit, includeRecords } = parseResult.data

    // 3. 建立查詢條件
    const query = {
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      batchId,
    }

    // 4. 取得統計資訊
    const stats = await aiTermValidator.getValidationStats(query)

    // 5. 如果需要，取得詳細記錄
    let records = undefined
    let pagination = undefined

    if (includeRecords === 'true') {
      const offset = (page - 1) * limit
      const allRecords = aiTermValidator.getCostRecords({
        ...query,
        limit: 10000, // 取得所有記錄用於計算總數
        offset: 0,
      })

      const totalRecords = allRecords.length
      const totalPages = Math.ceil(totalRecords / limit)

      // 取得當前頁的記錄
      records = aiTermValidator.getCostRecords({
        ...query,
        limit,
        offset,
      })

      pagination = {
        total: totalRecords,
        page,
        limit,
        totalPages,
      }
    }

    // 6. 建立回應
    const response: TermValidationCostResponse = {
      success: true,
      stats,
      records,
      pagination,
    }

    return NextResponse.json(response, { status: 200 })
  } catch (error) {
    console.error('[API] Cost query failed:', error)

    const errorMessage = error instanceof Error ? error.message : 'Unknown error'

    return NextResponse.json(
      {
        type: 'https://api.example.com/errors/internal',
        title: 'Internal Server Error',
        status: 500,
        detail: `成本查詢失敗: ${errorMessage}`,
        instance: '/api/v1/admin/costs/term-validation',
      },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/v1/admin/costs/term-validation/cache
 *
 * @description 清除術語驗證快取（管理員功能）
 *
 * @returns 操作結果
 */
export async function DELETE() {
  try {
    const cacheStatsBefore = aiTermValidator.getCacheStats()
    aiTermValidator.clearCache()
    const cacheStatsAfter = aiTermValidator.getCacheStats()

    return NextResponse.json({
      success: true,
      message: '快取已清除',
      data: {
        before: cacheStatsBefore,
        after: cacheStatsAfter,
      },
    })
  } catch (error) {
    console.error('[API] Cache clear failed:', error)

    return NextResponse.json(
      {
        type: 'https://api.example.com/errors/internal',
        title: 'Internal Server Error',
        status: 500,
        detail: '清除快取失敗',
        instance: '/api/v1/admin/costs/term-validation',
      },
      { status: 500 }
    )
  }
}
