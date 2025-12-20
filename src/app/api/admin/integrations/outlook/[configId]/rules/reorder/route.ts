/**
 * @fileoverview Outlook 過濾規則排序 API
 * @description
 *   提供過濾規則的優先級重新排序功能。
 *   僅限管理員存取。
 *
 * @module src/app/api/admin/integrations/outlook/[configId]/rules/reorder/route
 * @author Development Team
 * @since Epic 9 - Story 9.4 (Outlook 連線設定)
 * @lastModified 2025-12-20
 *
 * @endpoints
 *   - POST /api/admin/integrations/outlook/:configId/rules/reorder - 重新排序規則
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { OutlookConfigService } from '@/services/outlook-config.service';
import { reorderRulesSchema } from '@/lib/validations/outlook-config.schema';

// ============================================================
// Types
// ============================================================

interface RouteContext {
  params: Promise<{ configId: string }>;
}

// ============================================================
// Service Instance
// ============================================================

const configService = new OutlookConfigService();

// ============================================================
// Handlers
// ============================================================

/**
 * POST /api/admin/integrations/outlook/:configId/rules/reorder
 * 重新排序過濾規則
 */
export async function POST(request: NextRequest, context: RouteContext) {
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

    const { configId } = await context.params;

    // 解析請求內容
    const body = await request.json();
    const { ruleIds } = reorderRulesSchema.parse(body);

    // 重新排序規則
    await configService.reorderFilterRules(ruleIds);

    // 獲取更新後的規則列表
    const rules = await configService.getFilterRules(configId);

    return NextResponse.json({
      success: true,
      data: rules,
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

    console.error('[Outlook Rules API] Reorder error:', error);
    return NextResponse.json(
      {
        type: 'https://api.example.com/errors/internal',
        title: 'Internal Server Error',
        status: 500,
        detail: '無法重新排序規則',
      },
      { status: 500 }
    );
  }
}
