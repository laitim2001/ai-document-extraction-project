/**
 * @fileoverview 警報統計 API
 * @description
 *   提供警報相關統計數據，包括規則數量、警報計數、趨勢等。
 *   僅限管理員存取。
 *
 * @module src/app/api/admin/alerts/statistics/route
 * @since Epic 12 - Story 12-3 (錯誤警報設定)
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { alertRuleService } from '@/services/alert-rule.service';
import { alertEvaluationService } from '@/services/alert-evaluation.service';

// ============================================================
// Handlers
// ============================================================

/**
 * GET /api/admin/alerts/statistics
 * 獲取警報統計數據
 */
export async function GET(_request: NextRequest) {
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

    // 獲取各項統計數據
    const [
      alertStatistics,
      rulesBySeverity,
      rulesByConditionType,
    ] = await Promise.all([
      alertEvaluationService.getStatistics(),
      alertRuleService.getCountBySeverity(),
      alertRuleService.getCountByConditionType(),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        alerts: alertStatistics,
        rules: {
          bySeverity: rulesBySeverity,
          byConditionType: rulesByConditionType,
        },
      },
    });
  } catch (error) {
    console.error('Error getting alert statistics:', error);
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
