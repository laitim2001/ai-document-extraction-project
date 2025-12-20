/**
 * @fileoverview n8n Webhook 配置列表 API
 * @description
 *   提供 Webhook 配置的列表查詢和新建功能。
 *   僅限管理員存取。
 *
 * @module src/app/api/admin/integrations/n8n/webhook-configs/route
 * @author Development Team
 * @since Epic 10 - Story 10.2 (Webhook Configuration Management)
 * @lastModified 2025-12-20
 *
 * @endpoints
 *   - GET /api/admin/integrations/n8n/webhook-configs - 獲取配置列表
 *   - POST /api/admin/integrations/n8n/webhook-configs - 建立新配置
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { webhookConfigService } from '@/services/n8n';
import { DEFAULT_RETRY_STRATEGY } from '@/types/n8n';

// ============================================================
// Validation Schemas
// ============================================================

const querySchema = z.object({
  cityCode: z.string().optional(),
  isActive: z.string().optional().transform((v) => v === undefined ? undefined : v === 'true'),
  page: z.string().optional().transform((v) => (v ? parseInt(v, 10) : 1)),
  pageSize: z.string().optional().transform((v) => (v ? parseInt(v, 10) : 20)),
  orderBy: z.enum(['createdAt', 'name', 'lastTestAt']).optional(),
  order: z.enum(['asc', 'desc']).optional(),
});

const retryStrategySchema = z.object({
  maxAttempts: z.number().min(1).max(5),
  delays: z.array(z.number().min(100).max(60000)),
});

const createSchema = z.object({
  name: z.string().min(1, '名稱不能為空').max(100, '名稱不能超過 100 字元'),
  description: z.string().max(500, '說明不能超過 500 字元').optional().nullable(),
  baseUrl: z.string().url('請輸入有效的 URL'),
  endpointPath: z.string().min(1, '端點路徑不能為空').startsWith('/', '端點路徑必須以 / 開頭'),
  authToken: z.string().min(1, '認證令牌不能為空'),
  cityCode: z.string().optional().nullable(),
  retryStrategy: retryStrategySchema.optional(),
  timeoutMs: z.number().min(1000).max(60000).optional(),
  subscribedEvents: z.array(z.string()).optional(),
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
 * GET /api/admin/integrations/n8n/webhook-configs
 * 獲取 Webhook 配置列表
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
    const queryResult = querySchema.safeParse({
      cityCode: searchParams.get('cityCode') ?? undefined,
      isActive: searchParams.get('isActive') ?? undefined,
      page: searchParams.get('page') ?? undefined,
      pageSize: searchParams.get('pageSize') ?? undefined,
      orderBy: searchParams.get('orderBy') ?? undefined,
      order: searchParams.get('order') ?? undefined,
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

    // 獲取配置列表
    const result = await webhookConfigService.list(queryResult.data);

    return NextResponse.json({
      success: true,
      data: result.items,
      meta: {
        pagination: {
          page: result.page,
          pageSize: result.pageSize,
          total: result.total,
          totalPages: result.totalPages,
        },
      },
    });
  } catch (error) {
    console.error('Error listing webhook configs:', error);
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
 * POST /api/admin/integrations/n8n/webhook-configs
 * 建立新的 Webhook 配置
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
    const parseResult = createSchema.safeParse(body);

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

    const input = parseResult.data;

    // 建立配置
    const config = await webhookConfigService.create(
      {
        name: input.name,
        description: input.description ?? undefined,
        baseUrl: input.baseUrl,
        endpointPath: input.endpointPath,
        authToken: input.authToken,
        cityCode: input.cityCode ?? undefined,
        retryStrategy: input.retryStrategy ?? DEFAULT_RETRY_STRATEGY,
        timeoutMs: input.timeoutMs,
        subscribedEvents: input.subscribedEvents as import('@/types/n8n').N8nEventType[],
      },
      session.user.id,
      getClientIp(request),
      getUserAgent(request)
    );

    return NextResponse.json(
      {
        success: true,
        data: config,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating webhook config:', error);
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
