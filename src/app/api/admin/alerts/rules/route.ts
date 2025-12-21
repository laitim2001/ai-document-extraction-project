/**
 * @fileoverview 警報規則 API
 * @description
 *   提供警報規則的創建和列表查詢功能。
 *   僅限管理員存取。
 *
 * @module src/app/api/admin/alerts/rules/route
 * @since Epic 12 - Story 12-3 (錯誤警報設定)
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { alertRuleService } from '@/services/alert-rule.service';

// ============================================================
// Validation Schemas
// ============================================================

const listQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  isActive: z
    .string()
    .optional()
    .transform((v) => (v === 'true' ? true : v === 'false' ? false : undefined)),
  severity: z.enum(['INFO', 'WARNING', 'CRITICAL', 'EMERGENCY']).optional(),
  conditionType: z
    .enum([
      'SERVICE_DOWN',
      'ERROR_RATE',
      'RESPONSE_TIME',
      'QUEUE_BACKLOG',
      'STORAGE_LOW',
      'CPU_HIGH',
      'MEMORY_HIGH',
      'CUSTOM_METRIC',
    ])
    .optional(),
  cityId: z.string().cuid().optional(),
  search: z.string().optional(),
});

const createSchema = z.object({
  name: z.string().min(1, '名稱不能為空').max(100, '名稱不能超過 100 字元'),
  description: z.string().max(500, '描述不能超過 500 字元').optional(),
  conditionType: z.enum([
    'SERVICE_DOWN',
    'ERROR_RATE',
    'RESPONSE_TIME',
    'QUEUE_BACKLOG',
    'STORAGE_LOW',
    'CPU_HIGH',
    'MEMORY_HIGH',
    'CUSTOM_METRIC',
  ]),
  metric: z.string().min(1, '指標名稱不能為空'),
  operator: z.enum([
    'GREATER_THAN',
    'GREATER_THAN_EQ',
    'LESS_THAN',
    'LESS_THAN_EQ',
    'EQUALS',
    'NOT_EQUALS',
  ]),
  threshold: z.number(),
  duration: z.number().int().positive(),
  serviceName: z.string().optional(),
  endpoint: z.string().optional(),
  severity: z.enum(['INFO', 'WARNING', 'CRITICAL', 'EMERGENCY']),
  channels: z.array(z.enum(['EMAIL', 'TEAMS', 'WEBHOOK'])).min(1, '至少選擇一個通知頻道'),
  recipients: z.array(z.string()).min(1, '至少設定一個收件人'),
  cooldownMinutes: z.number().int().min(1).max(1440).optional(),
  cityId: z.string().cuid().optional(),
});

// ============================================================
// Handlers
// ============================================================

/**
 * GET /api/admin/alerts/rules
 * 獲取警報規則列表
 */
export async function GET(request: NextRequest) {
  try {
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
    const isAdmin =
      session.user.isGlobalAdmin || session.user.roles?.some((r) => r.name === 'GLOBAL_ADMIN');
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
    const queryResult = listQuerySchema.safeParse({
      page: searchParams.get('page') ?? undefined,
      limit: searchParams.get('limit') ?? undefined,
      isActive: searchParams.get('isActive') ?? undefined,
      severity: searchParams.get('severity') ?? undefined,
      conditionType: searchParams.get('conditionType') ?? undefined,
      cityId: searchParams.get('cityId') ?? undefined,
      search: searchParams.get('search') ?? undefined,
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

    const result = await alertRuleService.list(queryResult.data);

    return NextResponse.json({
      success: true,
      data: result.rules,
      meta: {
        pagination: {
          page: result.page,
          limit: result.limit,
          total: result.total,
          totalPages: result.totalPages,
        },
      },
    });
  } catch (error) {
    console.error('Error listing alert rules:', error);
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
 * POST /api/admin/alerts/rules
 * 創建警報規則
 */
export async function POST(request: NextRequest) {
  try {
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

    const isAdmin =
      session.user.isGlobalAdmin || session.user.roles?.some((r) => r.name === 'GLOBAL_ADMIN');
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

    // 檢查名稱是否已存在
    const nameExists = await alertRuleService.isNameExists(parseResult.data.name);
    if (nameExists) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/conflict',
          title: 'Conflict',
          status: 409,
          detail: '規則名稱已存在',
        },
        { status: 409 }
      );
    }

    const rule = await alertRuleService.create(parseResult.data, session.user.id);

    return NextResponse.json(
      {
        success: true,
        data: rule,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating alert rule:', error);
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
