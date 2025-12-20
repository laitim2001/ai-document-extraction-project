/**
 * @fileoverview SharePoint 單一配置操作 API
 * @description
 *   提供單一 SharePoint 配置的查詢、更新、刪除功能。
 *   僅限管理員存取。
 *
 * @module src/app/api/admin/integrations/sharepoint/[configId]/route
 * @author Development Team
 * @since Epic 9 - Story 9.2 (SharePoint 連線配置)
 * @lastModified 2025-12-20
 *
 * @endpoints
 *   - GET /api/admin/integrations/sharepoint/:configId - 獲取配置詳情
 *   - PUT /api/admin/integrations/sharepoint/:configId - 更新配置
 *   - DELETE /api/admin/integrations/sharepoint/:configId - 刪除配置
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { SharePointConfigService, SharePointConfigError } from '@/services/sharepoint-config.service';

// ============================================================
// Types
// ============================================================

interface RouteContext {
  params: Promise<{ configId: string }>;
}

// ============================================================
// Validation Schemas
// ============================================================

const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional().nullable(),
  siteUrl: z.string().url().optional(),
  tenantId: z.string().uuid().optional(),
  clientId: z.string().uuid().optional(),
  clientSecret: z.string().min(1).optional(),
  libraryPath: z.string().min(1).optional(),
  rootFolderPath: z.string().optional().nullable(),
  fileExtensions: z.array(z.string()).optional(),
  maxFileSizeMb: z.number().min(1).max(100).optional(),
  excludeFolders: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
});

// ============================================================
// Service Instance
// ============================================================

const configService = new SharePointConfigService();

// ============================================================
// Handlers
// ============================================================

/**
 * GET /api/admin/integrations/sharepoint/:configId
 * 獲取 SharePoint 配置詳情
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
    if (error instanceof SharePointConfigError) {
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

    console.error('[SharePoint Config API] GET error:', error);
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
 * PUT /api/admin/integrations/sharepoint/:configId
 * 更新 SharePoint 配置
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
    const input = updateSchema.parse(body);

    // 處理 isActive 特殊情況
    if (input.isActive !== undefined) {
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

    if (error instanceof SharePointConfigError) {
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

    console.error('[SharePoint Config API] PUT error:', error);
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
 * DELETE /api/admin/integrations/sharepoint/:configId
 * 刪除 SharePoint 配置
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
    if (error instanceof SharePointConfigError) {
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

    console.error('[SharePoint Config API] DELETE error:', error);
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
