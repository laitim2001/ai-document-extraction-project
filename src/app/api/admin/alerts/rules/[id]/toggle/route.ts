/**
 * @fileoverview 切換警報規則啟用狀態 API
 * @description
 *   提供切換單個警報規則的啟用/停用狀態功能。
 *   僅限管理員存取。
 *
 * @module src/app/api/admin/alerts/rules/[id]/toggle/route
 * @since Epic 12 - Story 12-3 (錯誤警報設定)
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { alertRuleService } from '@/services/alert-rule.service';

// ============================================================
// Handlers
// ============================================================

/**
 * PATCH /api/admin/alerts/rules/[id]/toggle
 * 切換警報規則啟用狀態
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/unauthorized',
          title: 'Unauthorized',
          status: 401,
          detail: '需要登入',
        },
        { status: 401 }
      );
    }

    const isAdmin =
      session.user.isGlobalAdmin || session.user.roles?.some((r) => r.name === 'GLOBAL_ADMIN');
    if (!isAdmin) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/forbidden',
          title: 'Forbidden',
          status: 403,
          detail: '需要管理員權限',
        },
        { status: 403 }
      );
    }

    const { id } = await params;

    // 檢查規則是否存在
    const existingRule = await alertRuleService.getById(id);
    if (!existingRule) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/not-found',
          title: 'Not Found',
          status: 404,
          detail: '警報規則不存在',
        },
        { status: 404 }
      );
    }

    const updatedRule = await alertRuleService.toggle(id);

    return NextResponse.json({
      success: true,
      data: updatedRule,
      message: updatedRule.isActive ? '警報規則已啟用' : '警報規則已停用',
    });
  } catch (error) {
    console.error('Error toggling alert rule:', error);
    return NextResponse.json(
      {
        type: 'https://api.example.com/errors/internal',
        title: 'Internal Server Error',
        status: 500,
        detail: error instanceof Error ? error.message : '伺服器內部錯誤',
      },
      { status: 500 }
    );
  }
}
