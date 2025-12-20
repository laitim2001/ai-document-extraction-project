/**
 * @fileoverview Outlook 連線測試 API（無需儲存配置）
 * @description
 *   測試 Outlook 連線參數是否正確，無需先儲存配置。
 *   用於配置建立前的驗證。
 *   僅限管理員存取。
 *
 * @module src/app/api/admin/integrations/outlook/test/route
 * @author Development Team
 * @since Epic 9 - Story 9.4 (Outlook 連線設定)
 * @lastModified 2025-12-20
 *
 * @endpoints
 *   - POST /api/admin/integrations/outlook/test - 測試連線參數
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { OutlookConfigService } from '@/services/outlook-config.service';
import { testConnectionSchema } from '@/lib/validations/outlook-config.schema';

// ============================================================
// Service Instance
// ============================================================

const configService = new OutlookConfigService();

// ============================================================
// Handlers
// ============================================================

/**
 * POST /api/admin/integrations/outlook/test
 * 測試連線參數（無需儲存配置）
 */
export async function POST(request: NextRequest) {
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

    // 解析請求內容
    const body = await request.json();
    const input = testConnectionSchema.parse(body);

    // 執行連線測試
    const result = await configService.testConnectionWithInput(input);

    return NextResponse.json({
      success: true,
      data: result,
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
