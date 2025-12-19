/**
 * @fileoverview 即時統計 API
 * @description
 *   提供即時處理統計數據：
 *   - 今日統計數據
 *   - 每小時趨勢
 *   - 1 分鐘快取刷新
 *   - 城市數據隔離
 *
 * @module src/app/api/statistics/processing/realtime
 * @since Epic 7 - Story 7.7 (城市處理數量追蹤)
 * @lastModified 2025-12-19
 *
 * @features
 *   - AC3: 即時更新（1 分鐘快取）
 *   - 今日統計
 *   - 每小時趨勢
 *
 * @dependencies
 *   - @/middleware/city-filter - 城市過濾中間件
 *   - @/services/processing-stats.service - 處理統計服務
 *
 * @related
 *   - src/types/processing-statistics.ts - 類型定義
 *   - src/services/processing-stats.service.ts - 服務層
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  withCityFilter,
  CityFilterContext,
} from '@/middleware/city-filter'
import { processingStatsService } from '@/services/processing-stats.service'
import type { RealtimeStatsResponse } from '@/types/processing-statistics'

// ============================================================
// Route Handler
// ============================================================

/**
 * GET /api/statistics/processing/realtime
 *
 * @description
 *   獲取即時處理統計數據。
 *   包含今日統計和每小時處理趨勢。
 *   數據會根據用戶的城市訪問權限自動過濾。
 *
 * @returns {RealtimeStatsResponse}
 *   - success: 請求是否成功
 *   - data: 即時統計數據
 *     - todayStats: 今日統計（可能為 null）
 *     - hourlyTrend: 每小時趨勢
 *     - liveQueue: 即時隊列狀態（可選）
 */
export const GET = withCityFilter(
  async (
    request: NextRequest,
    cityContext: CityFilterContext
  ): Promise<NextResponse<RealtimeStatsResponse>> => {
    try {
      // --- 獲取即時統計 ---
      const realtimeStats = await processingStatsService.getRealtimeStats(cityContext)

      // --- 返回成功響應 ---
      return NextResponse.json({
        success: true,
        data: realtimeStats,
      } as RealtimeStatsResponse)
    } catch (error) {
      console.error('[Realtime Stats API] Error:', error)

      return NextResponse.json(
        {
          success: false,
          data: {
            todayStats: null,
            hourlyTrend: [],
          },
        } as RealtimeStatsResponse,
        { status: 500 }
      )
    }
  }
)
