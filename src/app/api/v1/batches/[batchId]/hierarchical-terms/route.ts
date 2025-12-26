/**
 * @fileoverview 三層術語聚合 API 端點
 * @description
 *   提供批次的三層術語聚合功能。
 *   按 Company → DocumentFormat → Terms 結構組織術語。
 *
 * @module src/app/api/v1/batches/[batchId]/hierarchical-terms
 * @since Epic 0 - Story 0.9
 * @lastModified 2025-12-26
 *
 * @features
 *   - 三層術語聚合（Company → Format → Terms）
 *   - 可配置最小頻率和最大術語數
 *   - 可選 AI 術語分類
 *
 * @dependencies
 *   - hierarchical-term-aggregation.service - 術語聚合服務
 *   - zod - 參數驗證
 */

import { NextRequest, NextResponse } from 'next/server';
import { aggregateTermsHierarchically } from '@/services/hierarchical-term-aggregation.service';
import { z } from 'zod';

// ============================================================================
// Schema 驗證
// ============================================================================

/**
 * 查詢參數驗證 Schema
 */
const querySchema = z.object({
  includeClassification: z.coerce.boolean().default(false),
  minTermFrequency: z.coerce.number().min(1).default(1),
  maxTermsPerFormat: z.coerce.number().min(10).max(1000).default(500),
});

// ============================================================================
// API Handler
// ============================================================================

/**
 * GET /api/v1/batches/:batchId/hierarchical-terms
 * 獲取批次的三層術語聚合
 *
 * @description
 *   對指定批次執行三層術語聚合，
 *   返回按 Company → Format → Terms 結構組織的術語資料。
 *
 * @param request - Next.js 請求物件
 * @param params - 路由參數，包含批次 ID
 * @returns 三層術語聚合結果
 *
 * @example
 * ```
 * GET /api/v1/batches/batch-123/hierarchical-terms
 * GET /api/v1/batches/batch-123/hierarchical-terms?minTermFrequency=2&maxTermsPerFormat=100
 * ```
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ batchId: string }> }
) {
  try {
    const { batchId } = await params;
    const { searchParams } = new URL(request.url);
    const options = querySchema.parse(Object.fromEntries(searchParams));

    const aggregation = await aggregateTermsHierarchically(batchId, options);

    return NextResponse.json({
      success: true,
      data: aggregation,
    });
  } catch (error) {
    console.error('[API] Error aggregating terms:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid query parameters',
          details: error.issues,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Failed to aggregate terms' },
      { status: 500 }
    );
  }
}
