/**
 * @fileoverview n8n Webhook 配置詳情 API
 * @description
 *   提供單一 Webhook 配置的讀取、更新和刪除功能。
 *   僅限管理員存取。
 *
 * @module src/app/api/admin/integrations/n8n/webhook-configs/[id]/route
 * @author Development Team
 * @since Epic 10 - Story 10.2 (Webhook Configuration Management)
 * @lastModified 2025-12-20
 *
 * @endpoints
 *   - GET /api/admin/integrations/n8n/webhook-configs/[id] - 獲取配置詳情
 *   - PATCH /api/admin/integrations/n8n/webhook-configs/[id] - 更新配置
 *   - DELETE /api/admin/integrations/n8n/webhook-configs/[id] - 刪除配置
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { webhookConfigService } from '@/services/n8n';
import type { UpdateWebhookConfigInput, N8nEventType } from '@/types/n8n';

// ============================================================
// Types
// ============================================================

interface RouteContext {
  params: Promise<{ id: string }>;
}

// ============================================================
// Validation Schemas
// ============================================================

const retryStrategySchema = z.object({
  maxAttempts: z.number().min(1).max(5),
  delays: z.array(z.number().min(100).max(60000)),
});

const updateSchema = z.object({
  name: z.string().min(1, '名稱不能為空').max(100, '名稱不能超過 100 字元').optional(),
  description: z.string().max(500, '說明不能超過 500 字元').optional().nullable(),
  baseUrl: z.string().url('請輸入有效的 URL').optional(),
  endpointPath: z.string().min(1, '端點路徑不能為空').startsWith('/', '端點路徑必須以 / 開頭').optional(),
  authToken: z.string().min(1, '認證令牌不能為空').optional(),
  cityCode: z.string().optional().nullable(),
  retryStrategy: retryStrategySchema.optional(),
  timeoutMs: z.number().min(1000).max(60000).optional(),
  subscribedEvents: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
});

// ============================================================
// Helper Functions
// ============================================================

/**
 * 獲取請求的 IP 地址
 */
function getClientIp(request: NextRequest): string | undefined {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    undefined
  );
}

/**
 * 獲取請求的 User-Agent
 */
function getUserAgent(request: NextRequest): string | undefined {
  return request.headers.get('user-agent') || undefined;
}

// ============================================================
// Handlers
// ============================================================

/**
 * GET /api/admin/integrations/n8n/webhook-configs/[id]
 * 獲取單一 Webhook 配置詳情
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

    // 獲取配置
    const config = await webhookConfigService.getById(id);

    if (!config) {
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

    return NextResponse.json({
      success: true,
      data: config,
    });
  } catch (error) {
    console.error('Error getting webhook config:', error);
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

/**
 * PATCH /api/admin/integrations/n8n/webhook-configs/[id]
 * 更新 Webhook 配置
 */
export async function PATCH(
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

    // 解析請求內容
    const body = await request.json();
    const parseResult = updateSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/validation',
          title: 'Validation Error',
          status: 400,
          detail: '請求內容驗證失敗',
          errors: parseResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    // 準備更新資料，轉換 subscribedEvents 類型
    const updateInput: UpdateWebhookConfigInput = {
      ...parseResult.data,
      subscribedEvents: parseResult.data.subscribedEvents as N8nEventType[] | undefined,
    };

    // 更新配置
    const config = await webhookConfigService.update(
      id,
      updateInput,
      session.user.id,
      getClientIp(request),
      getUserAgent(request)
    );

    return NextResponse.json({
      success: true,
      data: config,
    });
  } catch (error) {
    console.error('Error updating webhook config:', error);

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

/**
 * DELETE /api/admin/integrations/n8n/webhook-configs/[id]
 * 刪除 Webhook 配置
 */
export async function DELETE(
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

    // 刪除配置
    await webhookConfigService.delete(
      id,
      session.user.id,
      getClientIp(request),
      getUserAgent(request)
    );

    return NextResponse.json({
      success: true,
      message: '配置已成功刪除',
    });
  } catch (error) {
    console.error('Error deleting webhook config:', error);

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
