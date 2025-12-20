/**
 * @fileoverview Outlook 配置連線測試 API
 * @description
 *   測試已儲存的 Outlook 配置連線是否正常。
 *   僅限管理員存取。
 *
 * @module src/app/api/admin/integrations/outlook/[configId]/test/route
 * @author Development Team
 * @since Epic 9 - Story 9.4 (Outlook 連線設定)
 * @lastModified 2025-12-20
 *
 * @endpoints
 *   - POST /api/admin/integrations/outlook/:configId/test - 測試配置連線
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { OutlookConfigService, OutlookConfigError } from '@/services/outlook-config.service';

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
 * POST /api/admin/integrations/outlook/:configId/test
 * 測試已儲存的 Outlook 配置連線
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

    // 執行連線測試
    const result = await configService.testConnection(configId);

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    if (error instanceof OutlookConfigError) {
      if (error.code === 'CONFIG_NOT_FOUND') {
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

    console.error('[Outlook Config API] Test error:', error);
    return NextResponse.json(
      {
        type: 'https://api.example.com/errors/internal',
        title: 'Internal Server Error',
        status: 500,
        detail: '連線測試失敗',
      },
      { status: 500 }
    );
  }
}
