/**
 * @fileoverview Outlook 單一配置操作 API
 * @description
 *   提供單一 Outlook 配置的查詢、更新、刪除功能。
 *   僅限管理員存取。
 *
 * @module src/app/api/admin/integrations/outlook/[configId]/route
 * @author Development Team
 * @since Epic 9 - Story 9.4 (Outlook 連線設定)
 * @lastModified 2025-12-20
 *
 * @endpoints
 *   - GET /api/admin/integrations/outlook/:configId - 獲取配置詳情
 *   - PUT /api/admin/integrations/outlook/:configId - 更新配置
 *   - DELETE /api/admin/integrations/outlook/:configId - 刪除配置
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { OutlookConfigService, OutlookConfigError } from '@/services/outlook-config.service';
import { updateOutlookConfigSchema } from '@/lib/validations/outlook-config.schema';

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
 * GET /api/admin/integrations/outlook/:configId
 * 獲取 Outlook 配置詳情
 */
export async function GET(request: NextRequest, context: RouteContext) {
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

    // 獲取配置
    const config = await configService.getConfig(configId);

    return NextResponse.json({
      success: true,
      data: config,
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

    console.error('[Outlook Config API] GET error:', error);
    return NextResponse.json(
      {
        type: 'https://api.example.com/errors/internal',
        title: 'Internal Server Error',
        status: 500,
        detail: '無法獲取配置',
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/integrations/outlook/:configId
 * 更新 Outlook 配置
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

    const { configId } = await context.params;

    // 解析請求內容
    const body = await request.json();
    const input = updateOutlookConfigSchema.parse(body);

    // 處理 isActive 特殊情況
    if (input.isActive !== undefined && Object.keys(input).length === 1) {
      const config = await configService.toggleActive(
        configId,
        input.isActive,
        session.user.id
      );
      return NextResponse.json({
        success: true,
        data: config,
      });
    }

    // 更新配置
    const config = await configService.updateConfig(configId, input, session.user.id);

    return NextResponse.json({
      success: true,
      data: config,
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

    console.error('[Outlook Config API] PUT error:', error);
    return NextResponse.json(
      {
        type: 'https://api.example.com/errors/internal',
        title: 'Internal Server Error',
        status: 500,
        detail: '無法更新配置',
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/integrations/outlook/:configId
 * 刪除 Outlook 配置
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

    const { configId } = await context.params;

    // 刪除配置
    await configService.deleteConfig(configId);

    return NextResponse.json({
      success: true,
      data: { message: '配置已刪除' },
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

    console.error('[Outlook Config API] DELETE error:', error);
    return NextResponse.json(
      {
        type: 'https://api.example.com/errors/internal',
        title: 'Internal Server Error',
        status: 500,
        detail: '無法刪除配置',
      },
      { status: 500 }
    );
  }
}
