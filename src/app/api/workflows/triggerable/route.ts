/**
 * @fileoverview 可觸發工作流列表 API
 * @description
 *   提供可手動觸發的工作流列表查詢：
 *   - 根據用戶城市和角色過濾
 *   - 支持分類篩選
 *   - 解析參數 Schema
 *
 *   ## 權限控制
 *   僅 SUPER_USER 和 ADMIN 角色可以訪問此端點。
 *
 *   ## 端點
 *   GET /api/workflows/triggerable
 *
 * @module src/app/api/workflows/triggerable/route
 * @author Development Team
 * @since Epic 10 - Story 10.4 (Manual Trigger Workflow)
 * @lastModified 2025-12-20
 *
 * @features
 *   - 角色權限檢查（SUPER_USER/ADMIN）
 *   - 城市數據隔離
 *   - 分類篩選
 *
 * @dependencies
 *   - @/middlewares/city-filter - 城市過濾中間件
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
} from '@/middlewares/city-filter';
import { workflowTriggerService } from '@/services/n8n/workflow-trigger.service';
import type { TriggerableWorkflowsResponse } from '@/types/workflow-trigger';

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
}

// ============================================================
// Validation Schema
// ============================================================

/**
 * 查詢參數驗證 Schema
 */
const querySchema = z.object({
  cityCode: z.string().optional(),
  category: z.string().optional(),
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
 * GET /api/workflows/triggerable
 *
 * @description
 *   獲取用戶可手動觸發的工作流列表。
 *   僅 SUPER_USER 和 ADMIN 角色可以訪問。
 *
 * @query
 *   - cityCode: 城市代碼篩選（可選）
 *   - category: 分類篩選（可選）
 *
 * @returns {TriggerableWorkflowsResponse}
 *   - data: 可觸發工作流列表
 */
export const GET = withCityFilter(
  async (
    request: NextRequest,
    cityContext: CityFilterContext
  ): Promise<NextResponse<TriggerableWorkflowsResponse | ErrorResponse>> => {
    try {
      // --- 獲取 session 並檢查角色權限 ---
      // cityContext 已經驗證了認證，現在需要檢查角色
      // 從 auth() 獲取完整 session 以檢查角色
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

      // --- 解析參數 ---
      const searchParams = Object.fromEntries(request.nextUrl.searchParams);
      const validation = querySchema.safeParse(searchParams);

      if (!validation.success) {
        return NextResponse.json(
          {
            success: false,
            error: '無效的查詢參數',
            code: 'VALIDATION_ERROR',
          },
          { status: 400 }
        );
      }

      const { cityCode, category } = validation.data;

      // --- 驗證城市權限 ---
      // 如果指定了 cityCode，檢查用戶是否有權限
      let targetCityCode: string;

      if (cityCode) {
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
        targetCityCode = cityCode;
      } else {
        // 使用用戶的主要城市或第一個授權城市
        targetCityCode = cityContext.primaryCityCode || cityContext.cityCodes[0] || '';
      }

      // --- 獲取用戶角色名稱列表 ---
      const userRoles = session?.user?.roles?.map((r) => r.name) || [];

      // --- 獲取可觸發的工作流 ---
      const workflows = await workflowTriggerService.listTriggerableWorkflows({
        cityCode: targetCityCode,
        userRoles,
        category,
      });

      // --- 返回成功響應 ---
      return NextResponse.json({
        data: workflows,
      });
    } catch (error) {
      console.error('[Triggerable Workflows API] Error:', error);

      return NextResponse.json(
        {
          success: false,
          error: '獲取可觸發工作流列表失敗',
          code: 'LIST_FAILED',
        },
        { status: 500 }
      );
    }
  }
);
