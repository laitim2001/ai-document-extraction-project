/**
 * @fileoverview 告警詳情 API
 * @description
 *   提供告警詳情查詢功能。
 *   僅限管理員存取。
 *
 * @module src/app/api/admin/alerts/[id]/route
 * @author Development Team
 * @since Epic 10 - Story 10.7 (n8n Connection Status Monitoring)
 * @lastModified 2025-12-20
 *
 * @endpoints
 *   - GET /api/admin/alerts/[id] - 獲取告警詳情
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getAlertSeverityText, getAlertStatusText, getAlertTypeText } from '@/types/alert-service';

// ============================================================
// Handlers
// ============================================================

/**
 * GET /api/admin/alerts/[id]
 * 獲取告警詳情
 */
export async function GET(
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

    // 獲取告警詳情
    const alert = await prisma.alertRecord.findUnique({
      where: { id },
    });

    if (!alert) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/not-found',
          title: 'Not Found',
          status: 404,
          detail: '告警不存在',
        },
        { status: 404 }
      );
    }

    // 如果有確認者或解決者，獲取用戶資訊
    let acknowledgedByName: string | null = null;
    let resolvedByName: string | null = null;

    if (alert.acknowledgedBy || alert.resolvedBy) {
      const userIds = [alert.acknowledgedBy, alert.resolvedBy].filter(Boolean) as string[];
      const users = await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, name: true },
      });
      const userMap = new Map(users.map((u) => [u.id, u.name]));
      if (alert.acknowledgedBy) {
        acknowledgedByName = userMap.get(alert.acknowledgedBy) ?? null;
      }
      if (alert.resolvedBy) {
        resolvedByName = userMap.get(alert.resolvedBy) ?? null;
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        id: alert.id,
        alertType: alert.alertType,
        alertTypeText: getAlertTypeText(alert.alertType),
        severity: alert.severity,
        severityText: getAlertSeverityText(alert.severity),
        title: alert.title,
        message: alert.message,
        details: alert.details,
        service: alert.service,
        cityCode: alert.cityCode,
        status: alert.status,
        statusText: getAlertStatusText(alert.status),
        acknowledgedBy: alert.acknowledgedBy,
        acknowledgedByName,
        acknowledgedAt: alert.acknowledgedAt?.toISOString() ?? null,
        resolvedBy: alert.resolvedBy,
        resolvedByName,
        resolvedAt: alert.resolvedAt?.toISOString() ?? null,
        resolutionNote: alert.resolutionNote,
        createdAt: alert.createdAt.toISOString(),
        updatedAt: alert.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('Error getting alert detail:', error);
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
