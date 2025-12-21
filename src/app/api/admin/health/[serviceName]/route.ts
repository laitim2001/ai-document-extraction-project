/**
 * @fileoverview 單一服務健康狀態詳情 API
 * @description
 *   提供單一服務的詳細健康狀態資訊，包含：
 *   - 當前狀態
 *   - 歷史記錄
 *   - 錯誤日誌
 *   - 效能指標
 *
 *   僅限管理員（ADMIN、SUPER_USER）存取。
 *
 * @module src/app/api/admin/health/[serviceName]/route
 * @author Development Team
 * @since Epic 12 - Story 12.1 (System Health Monitoring Dashboard)
 * @lastModified 2025-12-21
 *
 * @endpoints
 *   - GET /api/admin/health/{serviceName} - 獲取特定服務的詳細健康資訊
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { healthCheckService } from '@/services/health-check.service';
import { STATUS_LABELS } from '@/types/monitoring';
import { HealthStatus } from '@prisma/client';

// ============================================================
// Validation Schemas
// ============================================================

const querySchema = z.object({
  hours: z
    .string()
    .optional()
    .transform((v) => (v ? parseInt(v, 10) : 24))
    .refine((v) => v > 0 && v <= 168, { message: 'hours must be between 1 and 168' }),
});

// ============================================================
// Route Params Type
// ============================================================

interface RouteParams {
  params: Promise<{
    serviceName: string;
  }>;
}

// ============================================================
// Handlers
// ============================================================

/**
 * GET /api/admin/health/{serviceName}
 * 獲取特定服務的詳細健康資訊
 *
 * @description
 *   返回指定服務的詳細健康資訊，包含：
 *   - 當前狀態
 *   - 歷史記錄（可配置時間範圍）
 *   - 錯誤日誌（最近 20 筆）
 *   - 效能指標（平均/最大/最小響應時間、錯誤率）
 *
 * @query hours - 查詢時間範圍（小時），預設 24，最大 168（7 天）
 */
export async function GET(request: NextRequest, context: RouteParams) {
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

    // 檢查管理員權限（ADMIN 或 SUPER_USER）
    const isAdmin =
      session.user.isGlobalAdmin ||
      session.user.roles?.some((r) => ['GLOBAL_ADMIN', 'ADMIN', 'SUPER_USER'].includes(r.name));
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

    // 獲取路由參數
    const params = await context.params;
    const { serviceName } = params;

    // 驗證服務名稱
    const validServices = healthCheckService.getServicesConfig().map((s) => s.name);
    if (!validServices.includes(serviceName)) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/not-found',
          title: 'Not Found',
          status: 404,
          detail: `服務 "${serviceName}" 不存在。有效服務：${validServices.join(', ')}`,
        },
        { status: 404 }
      );
    }

    // 解析查詢參數
    const searchParams = request.nextUrl.searchParams;
    const queryResult = querySchema.safeParse({
      hours: searchParams.get('hours') ?? undefined,
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

    const { hours } = queryResult.data;

    // 獲取服務詳情
    const serviceDetails = await healthCheckService.getServiceDetails(serviceName, hours);

    // 格式化響應
    const response = {
      service: serviceDetails.service
        ? {
            serviceName: serviceDetails.service.serviceName,
            serviceType: serviceDetails.service.serviceType,
            status: serviceDetails.service.status,
            statusText: STATUS_LABELS[serviceDetails.service.status as HealthStatus] || serviceDetails.service.status,
            responseTime: serviceDetails.service.responseTime ?? null,
            errorMessage: serviceDetails.service.errorMessage ?? null,
            details: serviceDetails.service.details ?? null,
            checkedAt: serviceDetails.service.checkedAt.toISOString(),
          }
        : null,
      history: serviceDetails.history.map((h) => ({
        checkedAt: h.checkedAt.toISOString(),
        status: h.status,
        statusText: STATUS_LABELS[h.status as HealthStatus] || h.status,
        responseTime: h.responseTime,
      })),
      errorLogs: serviceDetails.errorLogs.map((e) => ({
        checkedAt: e.checkedAt.toISOString(),
        errorMessage: e.errorMessage,
        errorCode: e.errorCode,
      })),
      metrics: {
        avgResponseTime: Math.round(serviceDetails.metrics.avgResponseTime * 100) / 100,
        maxResponseTime: serviceDetails.metrics.maxResponseTime,
        minResponseTime: serviceDetails.metrics.minResponseTime,
        errorRate: Math.round(serviceDetails.metrics.errorRate * 100) / 100,
      },
      queryParams: {
        hours,
      },
    };

    return NextResponse.json({
      success: true,
      data: response,
    });
  } catch (error) {
    console.error('Error getting service health details:', error);
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
