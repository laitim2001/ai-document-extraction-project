/**
 * @fileoverview 批量處理術語聚合統計 API
 * @description
 *   提供批量處理後的術語聚合統計資料：
 *   - 唯一術語總數
 *   - 術語出現頻率
 *   - 通用術語（跨公司）統計
 *   - 按公司分組的術語統計
 *   - 術語分佈摘要
 *   - 手動觸發術語聚合
 *
 * @module src/app/api/admin/historical-data/batches/[batchId]/term-stats
 * @since Epic 0 - Story 0.7
 * @lastModified 2025-12-25
 *
 * @features
 *   - 術語聚合統計查詢
 *   - 通用術語識別
 *   - 按公司分類統計
 *   - 術語分佈摘要（用於快速預覽）
 *   - 手動觸發術語聚合
 *
 * @dependencies
 *   - Prisma Client - 數據庫操作
 *   - batch-term-aggregation.service - 術語聚合服務
 *
 * @related
 *   - src/services/batch-term-aggregation.service.ts - 術語聚合服務
 *   - src/types/batch-term-aggregation.ts - 類型定義
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import {
  getAggregationSummary,
  triggerTermAggregation,
  hasAggregationResult,
} from '@/services/batch-term-aggregation.service'
import type {
  TermAggregationResponse,
  StartTermAggregationRequest,
} from '@/types/batch-term-aggregation'

// ============================================================
// Types
// ============================================================

interface RouteContext {
  params: Promise<{
    batchId: string
  }>
}

// ============================================================
// Validation Schemas
// ============================================================

/**
 * 手動觸發術語聚合請求 Schema
 */
const triggerAggregationSchema = z.object({
  config: z
    .object({
      enabled: z.boolean().optional(),
      similarityThreshold: z.number().min(0).max(1).optional(),
      autoClassify: z.boolean().optional(),
    })
    .optional(),
})

// ============================================================
// GET Handler
// ============================================================

/**
 * 獲取批次的術語聚合統計
 *
 * @description
 *   返回指定批次的術語聚合統計資料，包含：
 *   - 唯一術語總數
 *   - 術語出現總次數
 *   - 通用術語數量（跨多個公司）
 *   - 公司特定術語數量
 *   - 已分類術語數量
 *   - 術語分佈摘要（top 術語、類別分佈、公司分佈）
 *
 * @param request - Next.js 請求對象
 * @param context - 路由上下文（包含 batchId）
 * @returns 術語聚合統計
 */
export async function GET(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse<TermAggregationResponse | { error: string }>> {
  try {
    const { batchId } = await context.params

    // 檢查是否有聚合結果
    const hasResult = await hasAggregationResult(batchId)

    if (!hasResult) {
      // 返回待處理狀態
      return NextResponse.json({
        batchId,
        status: 'pending',
        error: 'Term aggregation has not been performed for this batch',
      })
    }

    // 獲取聚合摘要（用於 API 響應）
    const summary = await getAggregationSummary(batchId)

    if (!summary) {
      return NextResponse.json({
        batchId,
        status: 'failed',
        error: 'Failed to retrieve aggregation result',
      })
    }

    return NextResponse.json(summary)
  } catch (error) {
    console.error('Failed to get term aggregation stats:', error)
    return NextResponse.json(
      {
        batchId: '',
        status: 'failed' as const,
        error: error instanceof Error ? error.message : 'Failed to get term aggregation statistics',
      },
      { status: 500 }
    )
  }
}

// ============================================================
// POST Handler
// ============================================================

/**
 * 手動觸發術語聚合
 *
 * @description
 *   手動觸發指定批次的術語聚合，可覆蓋預設配置：
 *   - enabled: 是否啟用（預設 true）
 *   - similarityThreshold: 相似度閾值（預設 0.85）
 *   - autoClassify: 是否自動分類（預設 false）
 *
 *   注意：如果批次已有聚合結果，將會覆蓋。
 *
 * @param request - Next.js 請求對象
 * @param context - 路由上下文（包含 batchId）
 * @returns 術語聚合結果
 */
export async function POST(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse<TermAggregationResponse | { error: string }>> {
  try {
    const { batchId } = await context.params

    // 解析請求體
    let body: StartTermAggregationRequest = { batchId }
    try {
      const rawBody = await request.json()
      const validated = triggerAggregationSchema.parse(rawBody)
      body = {
        batchId,
        config: validated.config,
      }
    } catch {
      // 如果解析失敗，使用預設配置
      body = { batchId }
    }

    // 觸發術語聚合
    const result = await triggerTermAggregation(batchId, body.config)

    if (!result) {
      return NextResponse.json(
        {
          batchId,
          status: 'failed' as const,
          error: 'Failed to trigger term aggregation',
        },
        { status: 500 }
      )
    }

    // 返回聚合摘要
    const summary = await getAggregationSummary(batchId)

    if (!summary) {
      return NextResponse.json({
        batchId,
        status: 'completed' as const,
        stats: result.stats,
        aggregatedAt: result.aggregatedAt,
      })
    }

    return NextResponse.json(summary)
  } catch (error) {
    console.error('Failed to trigger term aggregation:', error)
    return NextResponse.json(
      {
        batchId: '',
        status: 'failed' as const,
        error: error instanceof Error ? error.message : 'Failed to trigger term aggregation',
      },
      { status: 500 }
    )
  }
}

// ============================================================
// DELETE Handler
// ============================================================

/**
 * 刪除術語聚合結果
 *
 * @description
 *   刪除指定批次的術語聚合結果，用於重新執行聚合。
 *
 * @param request - Next.js 請求對象
 * @param context - 路由上下文（包含 batchId）
 * @returns 刪除結果
 */
export async function DELETE(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse<{ success: boolean } | { error: string }>> {
  try {
    const { batchId } = await context.params

    // 動態導入以避免循環依賴
    const { deleteAggregationResult } = await import(
      '@/services/batch-term-aggregation.service'
    )

    const deleted = await deleteAggregationResult(batchId)

    if (!deleted) {
      return NextResponse.json(
        { error: 'No aggregation result found for this batch' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete term aggregation:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete term aggregation' },
      { status: 500 }
    )
  }
}
