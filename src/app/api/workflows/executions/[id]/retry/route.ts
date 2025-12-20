/**
 * @fileoverview 重試工作流執行 API
 * @description
 *   提供重試失敗工作流執行的端點：
 *   - 驗證用戶角色權限
 *   - 驗證執行記錄存在且為失敗狀態
 *   - 使用原始參數重新觸發
 *
 *   ## 權限控制
 *   僅 SUPER_USER 和 ADMIN 角色可以重試執行。
 *
 *   ## 端點
 *   POST /api/workflows/executions/[id]/retry
 *
 * @module src/app/api/workflows/executions/[id]/retry/route
 * @author Development Team
 * @since Epic 10 - Story 10.4 (Manual Trigger Workflow)
 * @lastModified 2025-12-20
 *
 * @features
 *   - 角色權限檢查（SUPER_USER/ADMIN）
 *   - 失敗執行重試
 *   - 保留原始參數和文件
 *
 * @dependencies
 *   - @/services/n8n/workflow-trigger.service - 觸發服務
 *   - @/lib/auth - 認證
 *
 * @related
 *   - src/types/workflow-trigger.ts - 類型定義
 *   - src/hooks/useWorkflowTrigger.ts - React Query Hook
 */

import { NextRequest, NextResponse } from 'next/server';
import { workflowTriggerService } from '@/services/n8n/workflow-trigger.service';
import type { RetryWorkflowResponse } from '@/types/workflow-trigger';

// ============================================================
// Constants
// ============================================================

/** 允許重試工作流的角色 */
const ALLOWED_ROLES = ['SUPER_USER', 'ADMIN'];

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
 * 錯誤響應類型
 */
interface ErrorResponse {
  success: false;
  error: string;
  code?: string;
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

// ============================================================
// Route Handler
// ============================================================

/**
 * POST /api/workflows/executions/[id]/retry
 *
 * @description
 *   重試失敗的工作流執行。
 *   僅 SUPER_USER 和 ADMIN 角色可以訪問。
 *
 * @param id - 執行記錄 ID
 *
 * @returns {RetryWorkflowResponse}
 *   - data.executionId: 新執行記錄 ID
 *   - data.n8nExecutionId: n8n 執行 ID
 */
export async function POST(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse<RetryWorkflowResponse | ErrorResponse>> {
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

    // --- 檢查角色權限 ---
    if (!hasAnyRole(session.user, ALLOWED_ROLES)) {
      return NextResponse.json(
        {
          success: false,
          error: '權限不足，僅 Super User 和 Admin 可以重試工作流',
          code: 'FORBIDDEN',
        },
        { status: 403 }
      );
    }

    // --- 重試觸發 ---
    const result = await workflowTriggerService.retryTrigger(id, session.user.id);

    // --- 處理結果 ---
    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error ?? '重試失敗',
          code: result.errorCode ?? 'RETRY_FAILED',
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
    console.error('[Retry Workflow API] Error:', error);

    return NextResponse.json(
      {
        success: false,
        error: '重試工作流執行失敗',
        code: 'RETRY_FAILED',
      },
      { status: 500 }
    );
  }
}
