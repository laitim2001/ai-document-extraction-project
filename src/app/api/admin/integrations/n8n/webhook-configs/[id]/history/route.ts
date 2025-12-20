/**
 * @fileoverview n8n Webhook 配置歷史 API
 * @description
 *   提供 Webhook 配置的變更歷史查詢功能。
 *   記錄所有配置的建立、更新、刪除等操作。
 *   僅限管理員存取。
 *
 * @module src/app/api/admin/integrations/n8n/webhook-configs/[id]/history/route
 * @author Development Team
 * @since Epic 10 - Story 10.2 (Webhook Configuration Management)
 * @lastModified 2025-12-20
 *
 * @endpoints
 *   - GET /api/admin/integrations/n8n/webhook-configs/[id]/history - 獲取變更歷史
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { webhookConfigService } from '@/services/n8n';
import { ConfigChangeType } from '@/types/n8n';

// ============================================================
// Types
// ============================================================

interface RouteContext {
  params: Promise<{ id: string }>;
}

// ============================================================
// Validation Schemas
// ============================================================

const querySchema = z.object({
  changeType: z.enum(['CREATED', 'UPDATED', 'ACTIVATED', 'DEACTIVATED', 'DELETED']).optional(),
  page: z.string().optional().transform((v) => (v ? parseInt(v, 10) : 1)),
  pageSize: z.string().optional().transform((v) => (v ? parseInt(v, 10) : 20)),
});

// ============================================================
// Handlers
// ============================================================

/**
 * GET /api/admin/integrations/n8n/webhook-configs/[id]/history
 * 獲取 Webhook 配置變更歷史
 */
export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { id } = await context.params;

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

    // 解析查詢參數
    const searchParams = request.nextUrl.searchParams;
    const queryResult = querySchema.safeParse({
      changeType: searchParams.get('changeType') ?? undefined,
      page: searchParams.get('page') ?? undefined,
      pageSize: searchParams.get('pageSize') ?? undefined,
    });

    if (!queryResult.success) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/validation',
          title: 'Validation Error',
          status: 400,
          detail: '查詢參數驗證失敗',
          errors: queryResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    // 獲取歷史記錄
    const result = await webhookConfigService.getHistory({
      configId: id,
      changeType: queryResult.data.changeType as ConfigChangeType | undefined,
      page: queryResult.data.page,
      pageSize: queryResult.data.pageSize,
    });

    return NextResponse.json({
      success: true,
      data: result.items,
      meta: {
        pagination: {
          page: result.page,
          pageSize: result.pageSize,
          total: result.total,
        },
      },
    });
  } catch (error) {
    console.error('Error getting webhook config history:', error);
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
