/**
 * @fileoverview 工作流錯誤詳情 API
 * @description
 *   提供獲取工作流執行錯誤詳情的端點：
 *   - 驗證用戶身份和城市權限
 *   - 檢查執行記錄是否為失敗狀態
 *   - 返回結構化的錯誤資訊
 *
 *   ## 權限控制
 *   用戶需要有對應城市的存取權限才能查看錯誤詳情。
 *
 *   ## 端點
 *   GET /api/workflows/executions/[id]/error
 *
 * @module src/app/api/workflows/executions/[id]/error/route
 * @author Development Team
 * @since Epic 10 - Story 10.5 (Workflow Error Detail View)
 * @lastModified 2025-12-20
 *
 * @features
 *   - 身份驗證
 *   - 城市權限檢查
 *   - 錯誤詳情獲取
 *   - 敏感資訊遮蔽
 *
 * @dependencies
 *   - @/services/n8n/workflow-error.service - 錯誤服務
 *   - @/lib/auth - 認證
 *   - @/lib/prisma - 資料庫
 *
 * @related
 *   - src/types/workflow-error.ts - 類型定義
 *   - src/hooks/useWorkflowError.ts - React Query Hook
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { workflowErrorService } from '@/services/n8n/workflow-error.service';
import type { ErrorDetailResponse } from '@/types/workflow-error';

// ============================================================
// Types
// ============================================================

/**
 * 路由參數
 */
interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * 成功響應類型
 */
interface SuccessResponse {
  data: ErrorDetailResponse;
}

/**
 * 錯誤響應類型
 */
interface ErrorResponse {
  success: false;
  error: string;
  code: string;
}

// ============================================================
// Helper Functions
// ============================================================

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
 * GET /api/workflows/executions/[id]/error
 *
 * @description
 *   獲取工作流執行的錯誤詳情。
 *   包含錯誤類型、訊息、技術詳情、HTTP 詳情等資訊。
 *
 * @param id - 執行記錄 ID
 *
 * @returns {SuccessResponse}
 *   - data.execution: 執行基本資訊
 *   - data.error: 錯誤詳情
 *   - data.documents: 相關文件列表
 *   - data.canRetry: 是否可重試
 *   - data.n8nUrl: n8n 執行頁面 URL
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse<SuccessResponse | ErrorResponse>> {
  try {
    // --- 獲取路由參數 ---
    const { id } = await params;

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

    // --- 獲取執行記錄（驗證存在性和權限） ---
    const execution = await prisma.workflowExecution.findUnique({
      where: { id },
      select: {
        cityCode: true,
        status: true,
      },
    });

    if (!execution) {
      return NextResponse.json(
        {
          success: false,
          error: '找不到執行記錄',
          code: 'NOT_FOUND',
        },
        { status: 404 }
      );
    }

    // --- 驗證城市權限 ---
    const userCities = getUserCityAccess(session.user);
    if (!hasCityAccess(userCities, execution.cityCode)) {
      return NextResponse.json(
        {
          success: false,
          error: '無權存取此城市的資料',
          code: 'CITY_ACCESS_DENIED',
        },
        { status: 403 }
      );
    }

    // --- 檢查是否為失敗狀態 ---
    if (execution.status !== 'FAILED' && execution.status !== 'TIMEOUT') {
      return NextResponse.json(
        {
          success: false,
          error: '此執行記錄不是失敗狀態',
          code: 'NOT_FAILED',
        },
        { status: 400 }
      );
    }

    // --- 獲取錯誤詳情 ---
    const errorDetail = await workflowErrorService.getErrorDetail(id);

    if (!errorDetail) {
      return NextResponse.json(
        {
          success: false,
          error: '無法獲取錯誤詳情',
          code: 'NO_ERROR_DETAILS',
        },
        { status: 404 }
      );
    }

    // --- 返回成功響應 ---
    return NextResponse.json({ data: errorDetail });
  } catch (error) {
    console.error('[Workflow Error Detail API] Error:', error);

    return NextResponse.json(
      {
        success: false,
        error: '獲取錯誤詳情失敗',
        code: 'GET_ERROR_FAILED',
      },
      { status: 500 }
    );
  }
}
