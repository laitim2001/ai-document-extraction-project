/**
 * @fileoverview 格式術語 API 端點
 * @description
 *   獲取特定文件格式的術語聚合資料。
 *   返回該格式下的所有術語及其頻率統計。
 *
 * @module src/app/api/v1/formats/[id]/terms
 * @since Epic 0 - Story 0.9
 * @lastModified 2025-12-26
 *
 * @features
 *   - 格式術語聚合查詢
 *   - 術語頻率統計
 *   - 術語範例展示
 *
 * @dependencies
 *   - hierarchical-term-aggregation.service - 術語聚合服務
 */

import { NextRequest, NextResponse } from 'next/server';
import { getFormatTermAggregation } from '@/services/hierarchical-term-aggregation.service';

// ============================================================================
// API Handler
// ============================================================================

/**
 * GET /api/v1/formats/:id/terms
 * 獲取特定格式的術語聚合
 *
 * @description
 *   返回指定格式 ID 的完整術語聚合資料，
 *   包含術語列表、頻率統計和範例。
 *
 * @param request - Next.js 請求物件
 * @param params - 路由參數，包含格式 ID
 * @returns 格式術語聚合資料
 *
 * @example
 * ```
 * GET /api/v1/formats/format-123/terms
 * ```
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const terms = await getFormatTermAggregation(id);

    if (!terms) {
      return NextResponse.json(
        { success: false, error: 'Format not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: terms,
    });
  } catch (error) {
    console.error('[API] Error fetching format terms:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch format terms' },
      { status: 500 }
    );
  }
}
