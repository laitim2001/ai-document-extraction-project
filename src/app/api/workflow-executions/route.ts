/**
 * @fileoverview 工作流執行列表 API
 * @description
 *   提供工作流執行列表查詢功能：
 *   - 分頁和排序
 *   - 狀態篩選
 *   - 觸發類型篩選
 *   - 時間範圍篩選
 *   - 工作流名稱搜尋
 *
 *   ## 城市數據隔離
 *   使用 withCityFilter 中間件自動過濾用戶授權城市的數據。
 *
 *   ## 端點
 *   GET /api/workflow-executions
 *
 * @module src/app/api/workflow-executions/route
 * @author Development Team
 * @since Epic 10 - Story 10.3 (Workflow Execution Status View)
 * @lastModified 2025-12-20
 *
 * @features
 *   - 城市數據隔離
 *   - 多條件篩選
 *   - 分頁支持
 *
 * @dependencies
 *   - @/middleware/city-filter - 城市過濾中間件
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
} from '@/middleware/city-filter';
import { workflowExecutionService } from '@/services/n8n/workflow-execution.service';
import type {
  ExecutionListResponse,
  WorkflowExecutionStatus,
  WorkflowTriggerType,
} from '@/types/workflow-execution';

// ============================================================
// Validation Schema
// ============================================================

/**
 * 查詢參數驗證 Schema
 */
const querySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  status: z
    .enum([
      'PENDING',
      'QUEUED',
      'RUNNING',
      'COMPLETED',
      'FAILED',
      'CANCELLED',
      'TIMEOUT',
    ])
    .optional(),
  triggerType: z
    .enum(['SCHEDULED', 'MANUAL', 'WEBHOOK', 'DOCUMENT', 'EVENT'])
    .optional(),
  workflowName: z.string().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  orderBy: z.enum(['startedAt', 'createdAt', 'completedAt']).default('startedAt'),
  orderDirection: z.enum(['asc', 'desc']).default('desc'),
});

// ============================================================
// Route Handler
// ============================================================

/**
 * GET /api/workflow-executions
 *
 * @description
 *   獲取工作流執行列表。
 *   數據會根據用戶的城市訪問權限自動過濾。
 *
 * @query
 *   - page: 頁碼（預設 1）
 *   - pageSize: 每頁數量（預設 20，最大 100）
 *   - status: 執行狀態篩選
 *   - triggerType: 觸發類型篩選
 *   - workflowName: 工作流名稱搜尋
 *   - startDate: 開始時間範圍（ISO 8601）
 *   - endDate: 結束時間範圍（ISO 8601）
 *   - orderBy: 排序欄位（startedAt, createdAt, completedAt）
 *   - orderDirection: 排序方向（asc, desc）
 *
 * @returns {ExecutionListResponse}
 *   - success: 請求是否成功
 *   - data: 執行摘要列表
 *   - pagination: 分頁資訊
 */
export const GET = withCityFilter(
  async (
    request: NextRequest,
    cityContext: CityFilterContext
  ): Promise<NextResponse<ExecutionListResponse | { success: false; error: string }>> => {
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

      const {
        page,
        pageSize,
        status,
        triggerType,
        workflowName,
        startDate,
        endDate,
        orderBy,
        orderDirection,
      } = validation.data;

      // --- 確定城市代碼 ---
      // 對於非全域管理員，使用授權的城市
      const cityCode = cityContext.isGlobalAdmin
        ? undefined
        : cityContext.cityCodes[0];

      // --- 獲取執行列表 ---
      const result = await workflowExecutionService.listExecutions({
        cityCode,
        status: status as WorkflowExecutionStatus | undefined,
        triggerType: triggerType as WorkflowTriggerType | undefined,
        workflowName,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        page,
        pageSize,
        orderBy,
        orderDirection,
      });

      // --- 計算分頁 ---
      const totalPages = Math.ceil(result.total / pageSize);

      // --- 返回成功響應 ---
      return NextResponse.json({
        data: result.items,
        pagination: {
          page,
          pageSize,
          total: result.total,
          totalPages,
        },
      });
    } catch (error) {
      console.error('[Workflow Executions API] Error:', error);

      return NextResponse.json(
        {
          success: false,
          error: '獲取工作流執行列表失敗',
        },
        { status: 500 }
      );
    }
  }
);
