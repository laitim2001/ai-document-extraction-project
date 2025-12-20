/**
 * @fileoverview Outlook 單一過濾規則操作 API
 * @description
 *   提供單一過濾規則的查詢、更新、刪除功能。
 *   僅限管理員存取。
 *
 * @module src/app/api/admin/integrations/outlook/[configId]/rules/[ruleId]/route
 * @author Development Team
 * @since Epic 9 - Story 9.4 (Outlook 連線設定)
 * @lastModified 2025-12-20
 *
 * @endpoints
 *   - PUT /api/admin/integrations/outlook/:configId/rules/:ruleId - 更新規則
 *   - DELETE /api/admin/integrations/outlook/:configId/rules/:ruleId - 刪除規則
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { OutlookConfigService, OutlookConfigError } from '@/services/outlook-config.service';
import { updateFilterRuleSchema } from '@/lib/validations/outlook-config.schema';

// ============================================================
// Types
// ============================================================

interface RouteContext {
  params: Promise<{ configId: string; ruleId: string }>;
}

// ============================================================
// Service Instance
// ============================================================

const configService = new OutlookConfigService();

// ============================================================
// Handlers
// ============================================================

/**
 * PUT /api/admin/integrations/outlook/:configId/rules/:ruleId
 * 更新過濾規則
 */
export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    // 驗證權限
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

    // 檢查管理員權限
    const isAdmin = session.user.isGlobalAdmin ||
      session.user.roles?.some((r) => r.name === 'GLOBAL_ADMIN');
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

    const { ruleId } = await context.params;

    // 解析請求內容
    const body = await request.json();
    const input = updateFilterRuleSchema.parse(body);

    // 更新規則
    const rule = await configService.updateFilterRule(ruleId, input);

    return NextResponse.json({
      success: true,
      data: rule,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/validation',
          title: 'Validation Error',
          status: 400,
          detail: '輸入驗證失敗',
          errors: error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    if (error instanceof OutlookConfigError) {
      if (error.code === 'RULE_NOT_FOUND') {
        return NextResponse.json(
          {
            type: 'https://api.example.com/errors/not-found',
            title: 'Not Found',
            status: 404,
            detail: error.message,
          },
          { status: 404 }
        );
      }
    }

    console.error('[Outlook Rules API] PUT error:', error);
    return NextResponse.json(
      {
        type: 'https://api.example.com/errors/internal',
        title: 'Internal Server Error',
        status: 500,
        detail: '無法更新規則',
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/integrations/outlook/:configId/rules/:ruleId
 * 刪除過濾規則
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    // 驗證權限
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

    // 檢查管理員權限
    const isAdmin = session.user.isGlobalAdmin ||
      session.user.roles?.some((r) => r.name === 'GLOBAL_ADMIN');
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

    const { ruleId } = await context.params;

    // 刪除規則
    await configService.deleteFilterRule(ruleId);

    return NextResponse.json({
      success: true,
      data: { message: '規則已刪除' },
    });
  } catch (error) {
    if (error instanceof OutlookConfigError) {
      if (error.code === 'RULE_NOT_FOUND') {
        return NextResponse.json(
          {
            type: 'https://api.example.com/errors/not-found',
            title: 'Not Found',
            status: 404,
            detail: error.message,
          },
          { status: 404 }
        );
      }
    }

    console.error('[Outlook Rules API] DELETE error:', error);
    return NextResponse.json(
      {
        type: 'https://api.example.com/errors/internal',
        title: 'Internal Server Error',
        status: 500,
        detail: '無法刪除規則',
      },
      { status: 500 }
    );
  }
}
