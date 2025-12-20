/**
 * @fileoverview 解決告警 API
 * @description
 *   提供告警解決功能。
 *   僅限管理員存取。
 *
 * @module src/app/api/admin/alerts/[id]/resolve/route
 * @author Development Team
 * @since Epic 10 - Story 10.7 (n8n Connection Status Monitoring)
 * @lastModified 2025-12-20
 *
 * @endpoints
 *   - POST /api/admin/alerts/[id]/resolve - 解決告警
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { alertService } from '@/services/alert.service';
import { getAlertStatusText } from '@/types/alert-service';

// ============================================================
// Validation Schemas
// ============================================================

const resolveSchema = z.object({
  note: z.string().max(1000, '解決備註不能超過 1000 字元').optional(),
});

// ============================================================
// Handlers
// ============================================================

/**
 * POST /api/admin/alerts/[id]/resolve
 * 解決告警
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    // 解析請求內容
    let body = {};
    try {
      body = await request.json();
    } catch {
      // 允許空請求體
    }

    const parseResult = resolveSchema.safeParse(body);
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

    // 解決告警
    const alert = await alertService.resolveAlert({
      alertId: id,
      userId: session.user.id,
      note: parseResult.data.note,
    });

    return NextResponse.json({
      success: true,
      data: {
        id: alert.id,
        status: alert.status,
        statusText: getAlertStatusText(alert.status),
        resolvedAt: alert.resolvedAt?.toISOString() ?? null,
        resolutionNote: alert.resolutionNote,
      },
      message: '告警已解決',
    });
  } catch (error) {
    console.error('Error resolving alert:', error);

    // 處理告警不存在的情況
    if (error instanceof Error && error.message.includes('不存在')) {
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
