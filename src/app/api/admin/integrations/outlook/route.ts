/**
 * @fileoverview Outlook 配置列表 API
 * @description
 *   提供 Outlook 配置的列表查詢和新建功能。
 *   僅限管理員存取。
 *
 * @module src/app/api/admin/integrations/outlook/route
 * @author Development Team
 * @since Epic 9 - Story 9.4 (Outlook 連線設定)
 * @lastModified 2025-12-20
 *
 * @endpoints
 *   - GET /api/admin/integrations/outlook - 獲取配置列表
 *   - POST /api/admin/integrations/outlook - 建立新配置
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { OutlookConfigService, OutlookConfigError } from '@/services/outlook-config.service';
import { createOutlookConfigSchema } from '@/lib/validations/outlook-config.schema';

// ============================================================
// Validation Schemas
// ============================================================

const querySchema = z.object({
  cityId: z.string().optional(),
  includeInactive: z.string().optional().transform((v) => v === 'true'),
  includeRules: z.string().optional().transform((v) => v === 'true'),
});

// ============================================================
// Service Instance
// ============================================================

const configService = new OutlookConfigService();

// ============================================================
// Handlers
// ============================================================

/**
 * GET /api/admin/integrations/outlook
 * 獲取 Outlook 配置列表
 */
export async function GET(request: NextRequest) {
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

    // 解析查詢參數
    const searchParams = request.nextUrl.searchParams;
    const query = querySchema.parse({
      cityId: searchParams.get('cityId') ?? undefined,
      includeInactive: searchParams.get('includeInactive') ?? undefined,
      includeRules: searchParams.get('includeRules') ?? undefined,
    });

    // 獲取配置列表
    const configs = await configService.getConfigs(query);

    return NextResponse.json({
      success: true,
      data: configs,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/validation',
          title: 'Validation Error',
          status: 400,
          detail: '查詢參數驗證失敗',
          errors: error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    console.error('[Outlook Config API] GET error:', error);
    return NextResponse.json(
      {
        type: 'https://api.example.com/errors/internal',
        title: 'Internal Server Error',
        status: 500,
        detail: '無法獲取配置列表',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/integrations/outlook
 * 建立新的 Outlook 配置
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
    const input = createOutlookConfigSchema.parse(body);

    // 建立配置
    const config = await configService.createConfig(input, session.user.id);

    return NextResponse.json(
      {
        success: true,
        data: config,
      },
      { status: 201 }
    );
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
      const statusMap: Record<string, number> = {
        DUPLICATE_CITY: 409,
        DUPLICATE_GLOBAL: 409,
        VALIDATION_ERROR: 400,
      };
      const status = statusMap[error.code] ?? 500;

      return NextResponse.json(
        {
          type: `https://api.example.com/errors/${error.code.toLowerCase()}`,
          title: error.code,
          status,
          detail: error.message,
        },
        { status }
      );
    }

    console.error('[Outlook Config API] POST error:', error);
    return NextResponse.json(
      {
        type: 'https://api.example.com/errors/internal',
        title: 'Internal Server Error',
        status: 500,
        detail: '無法建立配置',
      },
      { status: 500 }
    );
  }
}
