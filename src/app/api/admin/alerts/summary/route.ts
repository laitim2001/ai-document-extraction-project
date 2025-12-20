/**
 * @fileoverview 告警摘要 API
 * @description
 *   提供告警摘要統計功能。
 *   僅限管理員存取。
 *
 * @module src/app/api/admin/alerts/summary/route
 * @author Development Team
 * @since Epic 10 - Story 10.7 (n8n Connection Status Monitoring)
 * @lastModified 2025-12-20
 *
 * @endpoints
 *   - GET /api/admin/alerts/summary - 獲取告警摘要
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { alertService } from '@/services/alert.service';

// ============================================================
// Handlers
// ============================================================

/**
 * GET /api/admin/alerts/summary
 * 獲取告警摘要
 */
export async function GET(request: NextRequest) {
  // Suppress unused variable warning
  void request;

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

    // 獲取告警摘要
    const summary = await alertService.getAlertSummary();

    return NextResponse.json({
      success: true,
      data: {
        total: summary.total,
        bySeverity: summary.bySeverity,
        byStatus: summary.byStatus,
        byService: summary.byService,
        recentAlerts: summary.recentAlerts.map((alert) => ({
          id: alert.id,
          title: alert.title,
          severity: alert.severity,
          createdAt: alert.createdAt.toISOString(),
        })),
      },
    });
  } catch (error) {
    console.error('Error getting alert summary:', error);
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
