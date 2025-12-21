/**
 * @fileoverview 單個警報規則 API
 * @description
 *   提供單個警報規則的查詢、更新和刪除功能。
 *   僅限管理員存取。
 *
 * @module src/app/api/admin/alerts/rules/[id]/route
 * @since Epic 12 - Story 12-3 (錯誤警報設定)
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { alertRuleService } from '@/services/alert-rule.service';

// ============================================================
// Validation Schemas
// ============================================================

const updateSchema = z.object({
  name: z.string().min(1, '名稱不能為空').max(100, '名稱不能超過 100 字元').optional(),
  description: z.string().max(500, '描述不能超過 500 字元').optional(),
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
  metric: z.string().min(1, '指標名稱不能為空').optional(),
  operator: z
    .enum([
      'GREATER_THAN',
      'GREATER_THAN_EQ',
      'LESS_THAN',
      'LESS_THAN_EQ',
      'EQUALS',
      'NOT_EQUALS',
    ])
    .optional(),
  threshold: z.number().optional(),
  duration: z.number().int().positive().optional(),
  serviceName: z.string().optional().nullable(),
  endpoint: z.string().optional().nullable(),
  severity: z.enum(['INFO', 'WARNING', 'ERROR', 'CRITICAL', 'EMERGENCY']).optional(),
  channels: z.array(z.enum(['EMAIL', 'TEAMS', 'WEBHOOK'])).min(1, '至少選擇一個通知頻道').optional(),
  recipients: z.array(z.string()).min(1, '至少設定一個收件人').optional(),
  cooldownMinutes: z.number().int().min(1).max(1440).optional().nullable(),
  cityId: z.string().cuid().optional().nullable(),
});

// ============================================================
// Handlers
// ============================================================

/**
 * GET /api/admin/alerts/rules/[id]
 * 獲取單個警報規則詳情
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;
    const rule = await alertRuleService.getById(id);

    if (!rule) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/not-found',
          title: 'Not Found',
          status: 404,
          detail: '警報規則不存在',
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: rule,
    });
  } catch (error) {
    console.error('Error getting alert rule:', error);
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
 * PUT /api/admin/alerts/rules/[id]
 * 更新警報規則
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;

    // 檢查規則是否存在
    const existingRule = await alertRuleService.getById(id);
    if (!existingRule) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/not-found',
          title: 'Not Found',
          status: 404,
          detail: '警報規則不存在',
        },
        { status: 404 }
      );
    }

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

    // 如果更新名稱，檢查是否與其他規則重複
    if (parseResult.data.name && parseResult.data.name !== existingRule.name) {
      const nameExists = await alertRuleService.isNameExists(parseResult.data.name, id);
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
    }

    const updatedRule = await alertRuleService.update(id, parseResult.data);

    return NextResponse.json({
      success: true,
      data: updatedRule,
    });
  } catch (error) {
    console.error('Error updating alert rule:', error);
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
 * DELETE /api/admin/alerts/rules/[id]
 * 刪除警報規則
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;

    // 檢查規則是否存在
    const existingRule = await alertRuleService.getById(id);
    if (!existingRule) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/not-found',
          title: 'Not Found',
          status: 404,
          detail: '警報規則不存在',
        },
        { status: 404 }
      );
    }

    await alertRuleService.delete(id);

    return NextResponse.json({
      success: true,
      message: '警報規則已刪除',
    });
  } catch (error) {
    console.error('Error deleting alert rule:', error);
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
