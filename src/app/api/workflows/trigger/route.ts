/**
 * @fileoverview 手動觸發工作流 API
 * @description
 *   提供手動觸發 n8n 工作流的端點：
 *   - 驗證用戶角色權限
 *   - 驗證城市存取權限
 *   - 驗證工作流參數
 *   - 發送觸發請求到 n8n Webhook
 *
 *   ## 權限控制
 *   僅 SUPER_USER 和 ADMIN 角色可以觸發工作流。
 *
 *   ## 端點
 *   POST /api/workflows/trigger
 *
 * @module src/app/api/workflows/trigger/route
 * @author Development Team
 * @since Epic 10 - Story 10.4 (Manual Trigger Workflow)
 * @lastModified 2025-12-20
 *
 * @features
 *   - 角色權限檢查（SUPER_USER/ADMIN）
 *   - 城市數據隔離
 *   - 參數驗證
 *   - 文件選擇支持
 *
 * @dependencies
 *   - @/middleware/city-filter - 城市過濾中間件
 *   - @/services/n8n/workflow-trigger.service - 觸發服務
 *   - zod - 請求驗證
 *
 * @related
 *   - src/types/workflow-trigger.ts - 類型定義
 *   - src/hooks/useWorkflowTrigger.ts - React Query Hook
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  withCityFilter,
  CityFilterContext,
} from '@/middleware/city-filter';
import { workflowTriggerService } from '@/services/n8n/workflow-trigger.service';
import type { TriggerWorkflowResponse } from '@/types/workflow-trigger';

// ============================================================
// Constants
// ============================================================

/** 允許觸發工作流的角色 */
const ALLOWED_ROLES = ['SUPER_USER', 'ADMIN'];

// ============================================================
// Types
// ============================================================

/**
 * 錯誤響應類型
 */
interface ErrorResponse {
  success: false;
  error: string;
  code?: string;
  executionId?: string;
  details?: unknown;
}

// ============================================================
// Validation Schema
// ============================================================

/**
 * 觸發請求驗證 Schema
 */
const triggerSchema = z.object({
  workflowId: z.string().min(1, 'Workflow ID is required'),
  parameters: z.record(z.string(), z.unknown()).optional(),
  documentIds: z.array(z.string()).optional(),
  cityCode: z.string().min(1, 'City code is required'),
});

// ============================================================
// Helper Functions
// ============================================================

/**
 * 檢查用戶是否擁有指定角色
 *
 * @param user - Session 用戶
 * @param roleNames - 角色名稱列表
 * @returns 是否擁有其中任一角色
 */
function hasAnyRole(
  user: { roles?: Array<{ name: string }> } | undefined,
  roleNames: string[]
): boolean {
  if (!user?.roles) return false;
  return user.roles.some((role) => roleNames.includes(role.name));
}

// ============================================================
// Route Handler
// ============================================================

/**
 * POST /api/workflows/trigger
 *
 * @description
 *   手動觸發 n8n 工作流。
 *   僅 SUPER_USER 和 ADMIN 角色可以訪問。
 *
 * @body
 *   - workflowId: 工作流定義 ID（必填）
 *   - parameters: 參數值物件（選填）
 *   - documentIds: 選中的文件 ID 列表（選填）
 *   - cityCode: 城市代碼（必填）
 *
 * @returns {TriggerWorkflowResponse}
 *   - data.executionId: 執行記錄 ID
 *   - data.n8nExecutionId: n8n 執行 ID
 */
export const POST = withCityFilter(
  async (
    request: NextRequest,
    cityContext: CityFilterContext
  ): Promise<NextResponse<TriggerWorkflowResponse | ErrorResponse>> => {
    try {
      // --- 獲取 session 並檢查角色權限 ---
      const { auth } = await import('@/lib/auth');
      const session = await auth();

      if (!hasAnyRole(session?.user, ALLOWED_ROLES)) {
        return NextResponse.json(
          {
            success: false,
            error: '權限不足，僅 Super User 和 Admin 可以觸發工作流',
            code: 'FORBIDDEN',
          },
          { status: 403 }
        );
      }

      // --- 解析請求內容 ---
      let body: unknown;
      try {
        body = await request.json();
      } catch {
        return NextResponse.json(
          {
            success: false,
            error: '無效的 JSON 格式',
            code: 'INVALID_JSON',
          },
          { status: 400 }
        );
      }

      const validation = triggerSchema.safeParse(body);

      if (!validation.success) {
        return NextResponse.json(
          {
            success: false,
            error: '無效的請求參數',
            code: 'VALIDATION_ERROR',
            details: validation.error.issues,
          },
          { status: 400 }
        );
      }

      const { workflowId, parameters, documentIds, cityCode } = validation.data;

      // --- 驗證城市權限 ---
      if (!cityContext.isGlobalAdmin && !cityContext.cityCodes.includes(cityCode)) {
        return NextResponse.json(
          {
            success: false,
            error: '無權存取此城市的工作流',
            code: 'CITY_ACCESS_DENIED',
          },
          { status: 403 }
        );
      }

      // --- 觸發工作流 ---
      const result = await workflowTriggerService.triggerWorkflow({
        workflowId,
        parameters,
        documentIds,
        triggeredBy: session?.user?.id ?? 'unknown',
        cityCode,
      });

      // --- 處理觸發結果 ---
      if (!result.success) {
        return NextResponse.json(
          {
            success: false,
            error: result.error ?? '觸發工作流失敗',
            code: result.errorCode ?? 'TRIGGER_FAILED',
            executionId: result.executionId,
          },
          { status: 400 }
        );
      }

      // --- 返回成功響應 ---
      return NextResponse.json({
        data: {
          executionId: result.executionId!,
          n8nExecutionId: result.n8nExecutionId,
        },
      });
    } catch (error) {
      console.error('[Trigger Workflow API] Error:', error);

      return NextResponse.json(
        {
          success: false,
          error: '觸發工作流失敗',
          code: 'TRIGGER_FAILED',
        },
        { status: 500 }
      );
    }
  }
);
