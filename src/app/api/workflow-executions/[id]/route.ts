/**
 * @fileoverview 工作流執行詳情 API
 * @description
 *   提供工作流執行詳情查詢功能：
 *   - 完整執行資訊
 *   - 執行步驟列表
 *   - 關聯文件列表
 *   - 錯誤詳情（如有）
 *
 *   ## 城市數據隔離
 *   使用 withCityFilter 中間件自動驗證城市訪問權限。
 *
 *   ## 端點
 *   GET /api/workflow-executions/[id]
 *
 * @module src/app/api/workflow-executions/[id]/route
 * @author Development Team
 * @since Epic 10 - Story 10.3 (Workflow Execution Status View)
 * @lastModified 2025-12-20
 *
 * @features
 *   - 城市數據隔離
 *   - 完整執行詳情
 *   - 步驟追蹤
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
import type { ExecutionDetailResponse } from '@/types/workflow-execution';

// ============================================================
// Route Handler
// ============================================================

/**
 * GET /api/workflow-executions/[id]
 *
 * @description
 *   獲取工作流執行詳情。
 *   包含完整執行資訊、步驟列表和關聯文件。
 *
 * @param id - 執行記錄 ID
 *
 * @returns {ExecutionDetailResponse}
 *   - success: 請求是否成功
 *   - data: 執行詳情
 *     - id: 執行 ID
 *     - workflowName: 工作流名稱
 *     - status: 執行狀態
 *     - progress: 執行進度
 *     - steps: 執行步驟列表
 *     - documents: 關聯文件列表
 *     - errorDetails: 錯誤詳情（如有）
 */
export const GET = withCityFilter(
  async (
    request: NextRequest,
    cityContext: CityFilterContext,
    context?: { params: Promise<{ id: string }> }
  ): Promise<NextResponse<ExecutionDetailResponse | { success: false; error: string }>> => {
    try {
      // --- 驗證路由參數 ---
      if (!context?.params) {
        return NextResponse.json(
          {
            success: false,
            error: '缺少路由參數',
          },
          { status: 400 }
        );
      }

      const { id } = await context.params;

      // --- 獲取執行詳情 ---
      const execution = await workflowExecutionService.getExecutionDetail(id);

      if (!execution) {
        return NextResponse.json(
          {
            success: false,
            error: '找不到指定的執行記錄',
          },
          { status: 404 }
        );
      }

      // --- 驗證城市訪問權限 ---
      if (
        !cityContext.isGlobalAdmin &&
        !cityContext.cityCodes.includes(execution.cityCode)
      ) {
        return NextResponse.json(
          {
            success: false,
            error: '無權訪問此執行記錄',
          },
          { status: 403 }
        );
      }

      // --- 返回成功響應 ---
      return NextResponse.json({
        data: execution,
      });
    } catch (error) {
      console.error('[Workflow Execution Detail API] Error:', error);

      return NextResponse.json(
        {
          success: false,
          error: '獲取工作流執行詳情失敗',
        },
        { status: 500 }
      );
    }
  }
);
