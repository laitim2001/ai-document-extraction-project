/**
 * @fileoverview SharePoint 新配置連線測試 API
 * @description
 *   測試新 SharePoint 配置的連線狀態（不儲存配置）。
 *   用於在儲存前驗證連線設定是否正確。
 *   僅限管理員存取。
 *
 * @module src/app/api/admin/integrations/sharepoint/test/route
 * @author Development Team
 * @since Epic 9 - Story 9.2 (SharePoint 連線配置)
 * @lastModified 2025-12-20
 *
 * @endpoints
 *   - POST /api/admin/integrations/sharepoint/test - 測試新配置連線
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { SharePointConfigService } from '@/services/sharepoint-config.service';

// ============================================================
// Validation Schemas
// ============================================================

const testSchema = z.object({
  tenantId: z.string().uuid('Tenant ID 格式不正確'),
  clientId: z.string().uuid('Client ID 格式不正確'),
  clientSecret: z.string().min(1, 'Client Secret 不能為空'),
  siteUrl: z.string().url('請輸入有效的 URL'),
  libraryPath: z.string().min(1, '文件庫路徑不能為空'),
});

// ============================================================
// Service Instance
// ============================================================

const configService = new SharePointConfigService();

// ============================================================
// Handlers
// ============================================================

/**
 * POST /api/admin/integrations/sharepoint/test
 * 測試新 SharePoint 配置連線（不儲存）
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
    const input = testSchema.parse(body);

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

    console.error('[SharePoint Config Test API] POST error:', error);
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
