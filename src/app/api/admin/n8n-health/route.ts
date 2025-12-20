/**
 * @fileoverview n8n 健康狀態 API
 * @description
 *   提供 n8n 連線健康狀態查詢和手動健康檢查功能。
 *   僅限管理員存取。
 *
 * @module src/app/api/admin/n8n-health/route
 * @author Development Team
 * @since Epic 10 - Story 10.7 (n8n Connection Status Monitoring)
 * @lastModified 2025-12-20
 *
 * @endpoints
 *   - GET /api/admin/n8n-health - 獲取整體健康狀態
 *   - POST /api/admin/n8n-health - 觸發手動健康檢查
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { n8nHealthService } from '@/services/n8n';
import { getHealthStatusText } from '@/types/health-monitoring';

// ============================================================
// Validation Schemas
// ============================================================

const querySchema = z.object({
  cityCode: z.string().optional(),
  includeHistory: z
    .string()
    .optional()
    .transform((v) => v === 'true'),
  historyLimit: z
    .string()
    .optional()
    .transform((v) => (v ? parseInt(v, 10) : 10)),
});

const checkSchema = z.object({
  cityCode: z.string().optional(),
  checkType: z.enum(['SCHEDULED', 'MANUAL', 'ON_ERROR', 'ON_RECOVERY', 'STARTUP']).optional(),
});

// ============================================================
// Handlers
// ============================================================

/**
 * GET /api/admin/n8n-health
 * 獲取 n8n 整體健康狀態
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
      cityCode: searchParams.get('cityCode') ?? undefined,
      includeHistory: searchParams.get('includeHistory') ?? undefined,
      historyLimit: searchParams.get('historyLimit') ?? undefined,
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

    // 獲取健康狀態
    // Note: cityCode 參數將用於未來的城市過濾功能
    const healthStatus = await n8nHealthService.getOverallHealth();

    // 格式化響應
    const response = {
      status: healthStatus.status,
      statusText: getHealthStatusText(healthStatus.status),
      lastSuccessAt: healthStatus.lastSuccessAt?.toISOString() ?? null,
      lastCheckAt: healthStatus.lastCheckAt?.toISOString() ?? null,
      consecutiveFailures: healthStatus.consecutiveFailures,
      stats24h: {
        totalCalls: healthStatus.stats24h.totalCalls,
        successCalls: healthStatus.stats24h.successCalls,
        failedCalls: healthStatus.stats24h.failedCalls,
        successRate: healthStatus.stats24h.successRate,
        avgResponseMs: healthStatus.stats24h.avgResponseMs ?? null,
        maxResponseMs: healthStatus.stats24h.maxResponseMs ?? null,
        minResponseMs: healthStatus.stats24h.minResponseMs ?? null,
      },
      cityStatuses:
        healthStatus.cityStatuses?.map((city) => ({
          cityCode: city.cityCode,
          cityName: city.cityName,
          status: city.status,
          statusText: getHealthStatusText(city.status),
          lastCheckAt: city.lastCheckAt?.toISOString() ?? null,
          consecutiveFailures: city.consecutiveFailures,
        })) ?? [],
      activeAlerts: healthStatus.activeAlerts.map((alert) => ({
        id: alert.id,
        alertType: alert.alertType,
        severity: alert.severity,
        title: alert.title,
        message: alert.message,
        createdAt: alert.createdAt.toISOString(),
        status: alert.status,
      })),
    };

    return NextResponse.json({
      success: true,
      data: response,
    });
  } catch (error) {
    console.error('Error getting n8n health status:', error);
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
 * POST /api/admin/n8n-health
 * 觸發手動健康檢查
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
    let body = {};
    try {
      body = await request.json();
    } catch {
      // 允許空請求體
    }

    const parseResult = checkSchema.safeParse(body);
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

    // 執行健康檢查
    const result = await n8nHealthService.performHealthCheck({
      cityCode: parseResult.data.cityCode,
      checkType: parseResult.data.checkType ?? 'MANUAL',
    });

    return NextResponse.json({
      success: true,
      data: {
        success: result.success,
        status: result.status,
        statusText: getHealthStatusText(result.status),
        responseTimeMs: result.responseTimeMs ?? null,
        httpStatus: result.httpStatus ?? null,
        error: result.error ?? null,
        checkedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Error performing health check:', error);
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
