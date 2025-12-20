/**
 * @fileoverview 工作流錯誤統計 API
 * @description
 *   提供獲取工作流錯誤統計資訊的端點：
 *   - 按錯誤類型分組統計
 *   - 按失敗步驟分組統計
 *   - 可恢復錯誤比例
 *
 *   ## 權限控制
 *   僅 SUPER_USER 和 ADMIN 角色可以查看統計。
 *
 *   ## 端點
 *   GET /api/workflow-errors/statistics
 *
 * @module src/app/api/workflow-errors/statistics/route
 * @author Development Team
 * @since Epic 10 - Story 10.5 (Workflow Error Detail View)
 * @lastModified 2025-12-20
 *
 * @features
 *   - 角色權限檢查（SUPER_USER/ADMIN）
 *   - 城市篩選
 *   - 時間範圍篩選
 *   - 錯誤統計分析
 *
 * @dependencies
 *   - @/services/n8n/workflow-error.service - 錯誤服務
 *   - @/lib/auth - 認證
 *
 * @related
 *   - src/types/workflow-error.ts - 類型定義
 *   - src/hooks/useWorkflowError.ts - React Query Hook
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { workflowErrorService } from '@/services/n8n/workflow-error.service';
import type { ErrorStatistics } from '@/types/workflow-error';

// ============================================================
// Constants
// ============================================================

/** 允許查看統計的角色 */
const ALLOWED_ROLES = ['SUPER_USER', 'ADMIN'];

// ============================================================
// Validation Schema
// ============================================================

/**
 * 查詢參數驗證 Schema
 */
const querySchema = z.object({
  cityCode: z.string().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

// ============================================================
// Types
// ============================================================

/**
 * 成功響應類型
 */
interface SuccessResponse {
  data: ErrorStatistics;
}

/**
 * 錯誤響應類型
 */
interface ErrorResponse {
  success: false;
  error: string;
  code: string;
  details?: unknown;
}

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

/**
 * 獲取用戶可存取的城市列表
 *
 * @param user - Session 用戶
 * @returns 城市代碼列表
 */
function getUserCityAccess(
  user: { cityCode?: string | null; roles?: Array<{ name: string }> } | undefined
): string[] {
  if (!user) return [];

  // Super User 和 Global Admin 可以存取所有城市
  const hasGlobalAccess = user.roles?.some((role) =>
    ['SUPER_USER', 'GLOBAL_ADMIN'].includes(role.name)
  );

  if (hasGlobalAccess) return ['*'];

  // 其他用戶只能存取自己的城市
  return user.cityCode ? [user.cityCode] : [];
}

/**
 * 檢查用戶是否有權限存取指定城市
 *
 * @param userCities - 用戶可存取的城市列表
 * @param targetCity - 目標城市代碼
 * @returns 是否有權限
 */
function hasCityAccess(userCities: string[], targetCity: string): boolean {
  return userCities.includes('*') || userCities.includes(targetCity);
}

// ============================================================
// Route Handler
// ============================================================

/**
 * GET /api/workflow-errors/statistics
 *
 * @description
 *   獲取工作流錯誤統計資訊。
 *   僅 SUPER_USER 和 ADMIN 角色可以訪問。
 *
 * @query {string} [cityCode] - 城市代碼篩選
 * @query {string} [startDate] - 開始日期（ISO 8601 格式）
 * @query {string} [endDate] - 結束日期（ISO 8601 格式）
 *
 * @returns {SuccessResponse}
 *   - data.byType: 按錯誤類型統計
 *   - data.byStep: 按失敗步驟統計
 *   - data.recoverableRate: 可恢復錯誤比例
 *   - data.totalErrors: 總錯誤數
 */
export async function GET(
  request: NextRequest
): Promise<NextResponse<SuccessResponse | ErrorResponse>> {
  try {
    // --- 驗證身份 ---
    const { auth } = await import('@/lib/auth');
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json(
        {
          success: false,
          error: '未認證',
          code: 'UNAUTHORIZED',
        },
        { status: 401 }
      );
    }

    // --- 檢查角色權限 ---
    if (!hasAnyRole(session.user, ALLOWED_ROLES)) {
      return NextResponse.json(
        {
          success: false,
          error: '權限不足，僅 Super User 和 Admin 可以查看統計',
          code: 'FORBIDDEN',
        },
        { status: 403 }
      );
    }

    // --- 解析查詢參數 ---
    const searchParams = Object.fromEntries(request.nextUrl.searchParams);
    const parseResult = querySchema.safeParse(searchParams);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: '查詢參數格式錯誤',
          code: 'INVALID_PARAMETERS',
          details: parseResult.error.issues,
        },
        { status: 400 }
      );
    }

    const { cityCode, startDate, endDate } = parseResult.data;

    // --- 驗證城市權限 ---
    if (cityCode) {
      const userCities = getUserCityAccess(session.user);
      if (!hasCityAccess(userCities, cityCode)) {
        return NextResponse.json(
          {
            success: false,
            error: '無權存取此城市的資料',
            code: 'CITY_ACCESS_DENIED',
          },
          { status: 403 }
        );
      }
    }

    // --- 獲取統計資料 ---
    const statistics = await workflowErrorService.getErrorStatistics({
      cityCode,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    });

    // --- 返回成功響應 ---
    return NextResponse.json({ data: statistics });
  } catch (error) {
    console.error('[Workflow Error Statistics API] Error:', error);

    return NextResponse.json(
      {
        success: false,
        error: '獲取錯誤統計失敗',
        code: 'STATS_FAILED',
      },
      { status: 500 }
    );
  }
}
