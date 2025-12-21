/**
 * @fileoverview 系統健康狀態 API
 * @description
 *   提供系統整體健康狀態查詢和手動健康檢查功能。
 *   僅限管理員（ADMIN、SUPER_USER）存取。
 *
 * @module src/app/api/admin/health/route
 * @author Development Team
 * @since Epic 12 - Story 12.1 (System Health Monitoring Dashboard)
 * @lastModified 2025-12-21
 *
 * @endpoints
 *   - GET /api/admin/health - 獲取系統整體健康狀態
 *   - POST /api/admin/health - 手動觸發所有服務健康檢查
 */

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { healthCheckService } from '@/services/health-check.service';
import { STATUS_LABELS } from '@/types/monitoring';
import { HealthStatus } from '@prisma/client';

// ============================================================
// Handlers
// ============================================================

/**
 * GET /api/admin/health
 * 獲取系統整體健康狀態
 *
 * @description
 *   返回系統整體健康狀態，包含：
 *   - 整體狀態（HEALTHY/DEGRADED/UNHEALTHY）
 *   - 各服務狀態
 *   - 活躍用戶數
 *   - 24 小時可用性
 */
export async function GET() {
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

    // 獲取健康狀態
    const healthStatus = await healthCheckService.getOverallHealth();

    // 格式化響應
    const response = {
      status: healthStatus.status,
      statusText: STATUS_LABELS[healthStatus.status] || healthStatus.status,
      services: healthStatus.services.map((service) => ({
        serviceName: service.serviceName,
        serviceType: service.serviceType,
        status: service.status,
        statusText: STATUS_LABELS[service.status as HealthStatus] || service.status,
        responseTime: service.responseTime ?? null,
        errorMessage: service.errorMessage ?? null,
        details: service.details ?? null,
        checkedAt: service.checkedAt.toISOString(),
      })),
      activeUsers: healthStatus.activeUsers,
      availability24h: healthStatus.availability24h,
      lastUpdated: healthStatus.lastUpdated.toISOString(),
    };

    return NextResponse.json({
      success: true,
      data: response,
    });
  } catch (error) {
    console.error('Error getting system health status:', error);
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
 * POST /api/admin/health
 * 手動觸發所有服務健康檢查
 *
 * @description
 *   執行所有配置服務的健康檢查，並返回結果。
 *   結果會同時記錄到資料庫。
 */
export async function POST() {
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

    // 執行健康檢查
    const results = await healthCheckService.checkAllServices();

    // 格式化響應
    const response = results.map((result) => ({
      serviceName: result.serviceName,
      serviceType: result.serviceType,
      status: result.status,
      statusText: STATUS_LABELS[result.status as HealthStatus] || result.status,
      responseTime: result.responseTime ?? null,
      errorMessage: result.errorMessage ?? null,
      details: result.details ?? null,
      checkedAt: result.checkedAt.toISOString(),
    }));

    return NextResponse.json({
      success: true,
      data: response,
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
