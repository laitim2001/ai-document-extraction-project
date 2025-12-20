/**
 * @fileoverview 執行中工作流 API
 * @description
 *   提供執行中工作流查詢功能：
 *   - 獲取所有執行中的工作流
 *   - 支援實時輪詢（3-5 秒間隔）
 *   - 進度指示器數據
 *
 *   ## 城市數據隔離
 *   使用 withCityFilter 中間件自動過濾用戶授權城市的數據。
 *
 *   ## 端點
 *   GET /api/workflow-executions/running
 *
 * @module src/app/api/workflow-executions/running/route
 * @author Development Team
 * @since Epic 10 - Story 10.3 (Workflow Execution Status View)
 * @lastModified 2025-12-20
 *
 * @features
 *   - 城市數據隔離
 *   - 實時狀態追蹤
 *   - 進度指示器支援
 *
 * @dependencies
 *   - @/middleware/city-filter - 城市過濾中間件
 *   - @/services/n8n/workflow-execution.service - 執行服務
 *
 * @related
 *   - src/types/workflow-execution.ts - 類型定義
 *   - src/hooks/useWorkflowExecutions.ts - React Query Hook
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  withCityFilter,
  CityFilterContext,
} from '@/middleware/city-filter';
import { workflowExecutionService } from '@/services/n8n/workflow-execution.service';
import type { RunningExecutionsResponse } from '@/types/workflow-execution';

// ============================================================
// Route Handler
// ============================================================

/**
 * GET /api/workflow-executions/running
 *
 * @description
 *   獲取所有執行中的工作流。
 *   包含 PENDING、QUEUED、RUNNING 狀態的執行記錄。
 *   用於實時狀態追蹤和進度指示器。
 *
 * @returns {RunningExecutionsResponse}
 *   - data: 執行中工作流摘要列表
 *     - id: 執行 ID
 *     - workflowName: 工作流名稱
 *     - status: 執行狀態
 *     - progress: 執行進度 (0-100)
 *     - currentStep: 當前步驟名稱
 *     - startedAt: 開始時間
 */
export const GET = withCityFilter(
  async (
    _request: NextRequest,
    cityContext: CityFilterContext
  ): Promise<NextResponse<RunningExecutionsResponse | { success: false; error: string }>> => {
    try {
      // --- 確定城市代碼 ---
      const cityCode = cityContext.isGlobalAdmin
        ? undefined
        : cityContext.cityCodes[0];

      // --- 獲取執行中的工作流 ---
      const executions = await workflowExecutionService.getRunningExecutions(cityCode);

      // --- 返回成功響應 ---
      return NextResponse.json({
        data: executions,
      });
    } catch (error) {
      console.error('[Running Executions API] Error:', error);

      return NextResponse.json(
        {
          success: false,
          error: '獲取執行中工作流失敗',
        },
        { status: 500 }
      );
    }
  }
);
