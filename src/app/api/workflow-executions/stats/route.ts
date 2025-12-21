/**
 * @fileoverview 工作流執行統計 API
 * @description
 *   提供工作流執行統計功能：
 *   - 總執行數
 *   - 按狀態分組統計
 *   - 按觸發類型分組統計
 *   - 平均執行時間
 *   - 成功率
 *
 *   ## 城市數據隔離
 *   使用 withCityFilter 中間件自動過濾用戶授權城市的數據。
 *
 *   ## 端點
 *   GET /api/workflow-executions/stats
 *
 * @module src/app/api/workflow-executions/stats/route
 * @author Development Team
 * @since Epic 10 - Story 10.3 (Workflow Execution Status View)
 * @lastModified 2025-12-20
 *
 * @features
 *   - 城市數據隔離
 *   - 時間範圍篩選
 *   - 多維度統計
 *
 * @dependencies
 *   - @/middlewares/city-filter - 城市過濾中間件
 *   - @/services/n8n/workflow-execution.service - 執行服務
 *   - zod - 請求驗證
 *
 * @related
 *   - src/types/workflow-execution.ts - 類型定義
 *   - src/hooks/useWorkflowExecutions.ts - React Query Hook
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  withCityFilter,
  CityFilterContext,
} from '@/middlewares/city-filter';
import { workflowExecutionService } from '@/services/n8n/workflow-execution.service';
import type { ExecutionStatsResponse } from '@/types/workflow-execution';

// ============================================================
// Validation Schema
// ============================================================

/**
 * 查詢參數驗證 Schema
 */
const querySchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

// ============================================================
// Route Handler
// ============================================================

/**
 * GET /api/workflow-executions/stats
 *
 * @description
 *   獲取工作流執行統計。
 *   包含總執行數、狀態分布、觸發類型分布等。
 *
 * @query
 *   - startDate: 開始時間範圍（ISO 8601，可選）
 *   - endDate: 結束時間範圍（ISO 8601，可選）
 *
 * @returns {ExecutionStatsResponse}
 *   - data: 執行統計
 *     - total: 總執行數
 *     - byStatus: 按狀態分組的數量
 *     - byTriggerType: 按觸發類型分組的數量
 *     - avgDurationMs: 平均執行時間（毫秒）
 *     - successRate: 成功率（0-100）
 */
export const GET = withCityFilter(
  async (
    request: NextRequest,
    cityContext: CityFilterContext
  ): Promise<NextResponse<ExecutionStatsResponse | { success: false; error: string }>> => {
    try {
      // --- 解析參數 ---
      const searchParams = Object.fromEntries(request.nextUrl.searchParams);
      const validation = querySchema.safeParse(searchParams);

      if (!validation.success) {
        return NextResponse.json(
          {
            success: false,
            error: '無效的查詢參數',
          },
          { status: 400 }
        );
      }

      const { startDate, endDate } = validation.data;

      // --- 確定城市代碼 ---
      const cityCode = cityContext.isGlobalAdmin
        ? undefined
        : cityContext.cityCodes[0];

      // --- 獲取執行統計 ---
      const stats = await workflowExecutionService.getExecutionStats({
        cityCode,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
      });

      // --- 返回成功響應 ---
      return NextResponse.json({
        data: stats,
      });
    } catch (error) {
      console.error('[Execution Stats API] Error:', error);

      return NextResponse.json(
        {
          success: false,
          error: '獲取執行統計失敗',
        },
        { status: 500 }
      );
    }
  }
);
