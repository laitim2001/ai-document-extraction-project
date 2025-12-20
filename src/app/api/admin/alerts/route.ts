/**
 * @fileoverview 告警列表 API
 * @description
 *   提供告警列表查詢和建立功能。
 *   僅限管理員存取。
 *
 * @module src/app/api/admin/alerts/route
 * @author Development Team
 * @since Epic 10 - Story 10.7 (n8n Connection Status Monitoring)
 * @lastModified 2025-12-20
 *
 * @endpoints
 *   - GET /api/admin/alerts - 獲取告警列表
 *   - POST /api/admin/alerts - 建立新告警
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { alertService } from '@/services/alert.service';
import { getAlertSeverityText, getAlertStatusText, getAlertTypeText } from '@/types/alert-service';

// ============================================================
// Validation Schemas
// ============================================================

const querySchema = z.object({
  service: z.string().optional(),
  cityCode: z.string().optional(),
  status: z.enum(['ACTIVE', 'ACKNOWLEDGED', 'RESOLVED', 'SUPPRESSED']).optional(),
  severity: z.enum(['INFO', 'WARNING', 'ERROR', 'CRITICAL']).optional(),
  alertType: z
    .enum([
      'CONNECTION_FAILURE',
      'HIGH_ERROR_RATE',
      'RESPONSE_TIMEOUT',
      'SERVICE_DEGRADED',
      'SERVICE_RECOVERED',
      'CONFIGURATION_ERROR',
      'AUTHENTICATION_FAILURE',
      'RATE_LIMIT_EXCEEDED',
    ])
    .optional(),
  page: z
    .string()
    .optional()
    .transform((v) => (v ? parseInt(v, 10) : 1)),
  pageSize: z
    .string()
    .optional()
    .transform((v) => (v ? parseInt(v, 10) : 20)),
  startDate: z
    .string()
    .optional()
    .transform((v) => (v ? new Date(v) : undefined)),
  endDate: z
    .string()
    .optional()
    .transform((v) => (v ? new Date(v) : undefined)),
});

const createSchema = z.object({
  alertType: z.enum([
    'CONNECTION_FAILURE',
    'HIGH_ERROR_RATE',
    'RESPONSE_TIMEOUT',
    'SERVICE_DEGRADED',
    'SERVICE_RECOVERED',
    'CONFIGURATION_ERROR',
    'AUTHENTICATION_FAILURE',
    'RATE_LIMIT_EXCEEDED',
  ]),
  severity: z.enum(['INFO', 'WARNING', 'ERROR', 'CRITICAL']),
  title: z.string().min(1, '標題不能為空').max(200, '標題不能超過 200 字元'),
  message: z.string().min(1, '訊息不能為空').max(2000, '訊息不能超過 2000 字元'),
  service: z.string().min(1, '服務名稱不能為空'),
  cityCode: z.string().optional(),
  details: z.record(z.string(), z.unknown()).optional(),
});

// ============================================================
// Handlers
// ============================================================

/**
 * GET /api/admin/alerts
 * 獲取告警列表
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
    const queryResult = querySchema.safeParse({
      service: searchParams.get('service') ?? undefined,
      cityCode: searchParams.get('cityCode') ?? undefined,
      status: searchParams.get('status') ?? undefined,
      severity: searchParams.get('severity') ?? undefined,
      alertType: searchParams.get('alertType') ?? undefined,
      page: searchParams.get('page') ?? undefined,
      pageSize: searchParams.get('pageSize') ?? undefined,
      startDate: searchParams.get('startDate') ?? undefined,
      endDate: searchParams.get('endDate') ?? undefined,
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

    // 獲取告警列表
    const result = await alertService.listAlerts(queryResult.data);

    // 格式化響應
    const items = result.items.map((alert) => ({
      id: alert.id,
      alertType: alert.alertType,
      alertTypeText: getAlertTypeText(alert.alertType),
      severity: alert.severity,
      severityText: getAlertSeverityText(alert.severity),
      title: alert.title,
      service: alert.service,
      cityCode: alert.cityCode,
      status: alert.status,
      statusText: getAlertStatusText(alert.status),
      createdAt: alert.createdAt.toISOString(),
    }));

    return NextResponse.json({
      success: true,
      data: items,
      meta: {
        pagination: result.pagination,
      },
    });
  } catch (error) {
    console.error('Error listing alerts:', error);
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
 * POST /api/admin/alerts
 * 建立新告警
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

    // 建立告警
    const alert = await alertService.createAlert(parseResult.data);

    return NextResponse.json(
      {
        success: true,
        data: {
          id: alert.id,
          alertType: alert.alertType,
          severity: alert.severity,
          title: alert.title,
          message: alert.message,
          service: alert.service,
          cityCode: alert.cityCode,
          status: alert.status,
          createdAt: alert.createdAt.toISOString(),
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating alert:', error);
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
