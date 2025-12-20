/**
 * @fileoverview n8n Webhook 連接測試 API
 * @description
 *   提供 Webhook 配置的連接測試功能。
 *   測試連接到 n8n 端點，驗證配置是否正確。
 *   僅限管理員存取。
 *
 * @module src/app/api/admin/integrations/n8n/webhook-configs/[id]/test/route
 * @author Development Team
 * @since Epic 10 - Story 10.2 (Webhook Configuration Management)
 * @lastModified 2025-12-20
 *
 * @endpoints
 *   - POST /api/admin/integrations/n8n/webhook-configs/[id]/test - 測試連接
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { webhookConfigService } from '@/services/n8n';

// ============================================================
// Types
// ============================================================

interface RouteContext {
  params: Promise<{ id: string }>;
}

// ============================================================
// Handlers
// ============================================================

/**
 * POST /api/admin/integrations/n8n/webhook-configs/[id]/test
 * 測試 Webhook 連接
 */
export async function POST(
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

    // 執行連接測試
    const result = await webhookConfigService.testConnection({ configId: id });

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Error testing webhook connection:', error);

    if (error instanceof Error && error.message === 'Webhook config not found') {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/not-found',
          title: 'Not Found',
          status: 404,
          detail: '找不到指定的配置',
        },
        { status: 404 }
      );
    }

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
