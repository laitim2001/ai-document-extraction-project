/**
 * @fileoverview 取消工作流執行 API
 * @description
 *   提供取消等待中或排隊中工作流執行的端點：
 *   - 驗證用戶角色權限
 *   - 驗證執行記錄存在且可取消
 *   - 更新執行狀態為 CANCELLED
 *
 *   ## 權限控制
 *   僅 SUPER_USER 和 ADMIN 角色可以取消執行。
 *
 *   ## 端點
 *   POST /api/workflows/executions/[id]/cancel
 *
 * @module src/app/api/workflows/executions/[id]/cancel/route
 * @author Development Team
 * @since Epic 10 - Story 10.4 (Manual Trigger Workflow)
 * @lastModified 2025-12-20
 *
 * @features
 *   - 角色權限檢查（SUPER_USER/ADMIN）
 *   - 取消等待中/排隊中的執行
 *   - 記錄取消者資訊
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
import type { CancelExecutionResponse } from '@/types/workflow-trigger';

// ============================================================
// Constants
// ============================================================

/** 允許取消工作流的角色 */
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
 * POST /api/workflows/executions/[id]/cancel
 *
 * @description
 *   取消等待中或排隊中的工作流執行。
 *   僅 SUPER_USER 和 ADMIN 角色可以訪問。
 *
 * @param id - 執行記錄 ID
 *
 * @returns {CancelExecutionResponse}
 *   - data.success: 是否成功取消
 *   - data.executionId: 執行記錄 ID
 */
export async function POST(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse<CancelExecutionResponse | ErrorResponse>> {
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
          error: '權限不足，僅 Super User 和 Admin 可以取消工作流',
          code: 'FORBIDDEN',
        },
        { status: 403 }
      );
    }

    // --- 取消執行 ---
    const success = await workflowTriggerService.cancelExecution(id, session.user.id);

    // --- 處理結果 ---
    if (!success) {
      return NextResponse.json(
        {
          success: false,
          error: '無法取消此執行（可能不存在或狀態不允許取消）',
          code: 'CANCEL_FAILED',
        },
        { status: 400 }
      );
    }

    // --- 返回成功響應 ---
    return NextResponse.json({
      data: {
        success: true,
        executionId: id,
      },
    });
  } catch (error) {
    console.error('[Cancel Execution API] Error:', error);

    return NextResponse.json(
      {
        success: false,
        error: '取消工作流執行失敗',
        code: 'CANCEL_FAILED',
      },
      { status: 500 }
    );
  }
}
