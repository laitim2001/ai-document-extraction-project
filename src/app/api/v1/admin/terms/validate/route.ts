/**
 * @fileoverview AI 術語驗證 API 端點
 * @description
 *   提供術語驗證功能，使用 GPT-4o 進行智能分類：
 *   - 批次驗證術語（50-100 術語/批次）
 *   - 區分有效費用術語 vs 無效地址/名稱術語
 *   - 返回分類結果、信心度和統計
 *
 * @module src/app/api/v1/admin/terms/validate
 * @author Development Team
 * @since Epic 0 - Story 0-10 (AI 術語驗證服務)
 * @lastModified 2025-01-01
 *
 * @features
 *   - POST: 批次驗證術語
 *   - 支援配置覆蓋
 *   - 返回有效/無效術語分類
 *   - 成本追蹤
 *
 * @related
 *   - src/services/ai-term-validator.service.ts - 核心驗證服務
 *   - src/types/term-validation.ts - 類型定義
 *   - docs/04-implementation/tech-specs/epic-00-historical-data/tech-spec-story-0-10.md
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { aiTermValidator } from '@/services/ai-term-validator.service'
import type { TermValidationResponse } from '@/types/term-validation'

// ============================================================================
// Validation Schemas
// ============================================================================

/**
 * 術語驗證請求 Schema
 */
const TermValidationRequestSchema = z.object({
  /** 要驗證的術語列表（1-500 個） */
  terms: z
    .array(z.string().min(1).max(500))
    .min(1, '至少需要一個術語')
    .max(500, '最多 500 個術語'),

  /** 可選的配置覆蓋 */
  config: z
    .object({
      enabled: z.boolean().optional(),
      batchSize: z.number().min(10).max(100).optional(),
      maxConcurrency: z.number().min(1).max(5).optional(),
      minConfidenceThreshold: z.number().min(0).max(100).optional(),
      timeout: z.number().min(5000).max(60000).optional(),
      retryCount: z.number().min(0).max(5).optional(),
      cacheEnabled: z.boolean().optional(),
      cacheTTL: z.number().min(60).max(86400).optional(),
      fallbackEnabled: z.boolean().optional(),
    })
    .optional(),

  /** 關聯的批次 ID（可選） */
  batchId: z.string().optional(),
})

// Type exported for external use
export type TermValidationRequestBody = z.infer<typeof TermValidationRequestSchema>

// ============================================================================
// API Handler
// ============================================================================

/**
 * POST /api/v1/admin/terms/validate
 *
 * @description 批次驗證術語，使用 GPT-4o 進行智能分類
 *
 * @requestBody {TermValidationRequestBody}
 *   - terms: string[] - 要驗證的術語列表
 *   - config: Partial<TermValidationConfig> - 可選配置
 *   - batchId: string - 可選的批次 ID
 *
 * @returns {TermValidationResponse} 驗證結果
 *
 * @example
 * // Request
 * POST /api/v1/admin/terms/validate
 * {
 *   "terms": ["OCEAN FREIGHT", "123 Main Street", "DHL Express"],
 *   "batchId": "batch-001"
 * }
 *
 * // Response
 * {
 *   "success": true,
 *   "results": [...],
 *   "validTerms": ["OCEAN FREIGHT"],
 *   "invalidTerms": ["123 Main Street", "DHL Express"],
 *   "summary": { "total": 3, "valid": 1, "invalid": 2, "validRate": 33.33 },
 *   "cost": { "tokensUsed": 150, "estimatedCost": 0.00135 },
 *   "processingTimeMs": 1250
 * }
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now()

  try {
    // 1. 解析請求體
    const body = await request.json()

    // 2. 驗證輸入
    const parseResult = TermValidationRequestSchema.safeParse(body)
    if (!parseResult.success) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/validation',
          title: 'Validation Error',
          status: 400,
          detail: '輸入驗證失敗',
          instance: '/api/v1/admin/terms/validate',
          errors: parseResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      )
    }

    const { terms, config, batchId } = parseResult.data

    // 3. 如果有配置覆蓋，更新服務配置
    if (config) {
      aiTermValidator.updateConfig(config)
    }

    // 4. 執行驗證
    const results = await aiTermValidator.validateTerms(terms, batchId)

    // 5. 分類結果
    const validTerms = results.filter((r) => r.isValid).map((r) => r.term)
    const invalidTerms = results.filter((r) => !r.isValid).map((r) => r.term)

    // 6. 計算統計
    const total = results.length
    const valid = validTerms.length
    const invalid = invalidTerms.length
    const validRate = total > 0 ? Number(((valid / total) * 100).toFixed(2)) : 0

    // 7. 取得成本資訊（最近一筆記錄）
    const recentCosts = aiTermValidator.getCostRecords({ limit: 1, batchId })
    const cost = recentCosts.length > 0
      ? {
          tokensUsed: recentCosts[0].totalTokens,
          estimatedCost: recentCosts[0].estimatedCost,
        }
      : undefined

    // 8. 建立回應
    const response: TermValidationResponse = {
      success: true,
      results,
      validTerms,
      invalidTerms,
      summary: {
        total,
        valid,
        invalid,
        validRate,
      },
      cost,
      processingTimeMs: Date.now() - startTime,
    }

    return NextResponse.json(response, { status: 200 })
  } catch (error) {
    console.error('[API] Term validation failed:', error)

    const errorMessage = error instanceof Error ? error.message : 'Unknown error'

    return NextResponse.json(
      {
        type: 'https://api.example.com/errors/internal',
        title: 'Internal Server Error',
        status: 500,
        detail: `術語驗證失敗: ${errorMessage}`,
        instance: '/api/v1/admin/terms/validate',
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/v1/admin/terms/validate
 *
 * @description 取得術語驗證服務狀態
 *
 * @returns 服務狀態資訊
 */
export async function GET() {
  try {
    const isAvailable = aiTermValidator.isAvailable()
    const config = aiTermValidator.getConfig()
    const cacheStats = aiTermValidator.getCacheStats()

    return NextResponse.json({
      success: true,
      data: {
        available: isAvailable,
        config: {
          enabled: config.enabled,
          batchSize: config.batchSize,
          maxConcurrency: config.maxConcurrency,
          minConfidenceThreshold: config.minConfidenceThreshold,
          cacheEnabled: config.cacheEnabled,
          cacheTTL: config.cacheTTL,
          fallbackEnabled: config.fallbackEnabled,
        },
        cache: cacheStats,
      },
    })
  } catch (error) {
    console.error('[API] Failed to get service status:', error)

    return NextResponse.json(
      {
        type: 'https://api.example.com/errors/internal',
        title: 'Internal Server Error',
        status: 500,
        detail: '無法取得服務狀態',
        instance: '/api/v1/admin/terms/validate',
      },
      { status: 500 }
    )
  }
}
