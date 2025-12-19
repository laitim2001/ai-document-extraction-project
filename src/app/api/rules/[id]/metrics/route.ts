/**
 * @fileoverview 規則統計 API 端點
 * @description
 *   提供單一規則的成效統計功能：
 *   - 整體應用統計（總次數、準確率）
 *   - 城市別成效分析
 *   - 應用歷史記錄
 *
 *   端點：
 *   - GET /api/rules/[id]/metrics - 獲取規則統計
 *
 * @module src/app/api/rules/[id]/metrics/route
 * @since Epic 6 - Story 6.5 (Global Rule Sharing)
 * @lastModified 2025-12-19
 *
 * @dependencies
 *   - next/server - Next.js API 處理
 *   - @/lib/auth - NextAuth 認證
 *   - @/services/rule-metrics - 規則統計服務
 *   - @/types/permissions - 權限常量
 *
 * @related
 *   - src/services/rule-metrics.ts - 統計服務
 *   - src/types/rule.ts - 類型定義
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { RuleMetricsService } from '@/services/rule-metrics';
import { PERMISSIONS } from '@/types/permissions';

// ============================================================
// Helper Functions
// ============================================================

/**
 * 檢查用戶是否有規則查看權限
 */
function hasRuleViewPermission(roles: { permissions: string[] }[] | undefined): boolean {
  if (!roles) return false;
  return roles.some((r) => r.permissions.includes(PERMISSIONS.RULE_VIEW));
}

// ============================================================
// Route Params Type
// ============================================================

interface RouteParams {
  params: Promise<{ id: string }>;
}

// ============================================================
// GET /api/rules/[id]/metrics
// ============================================================

/**
 * GET /api/rules/[id]/metrics
 * 獲取規則統計資料
 *
 * @description
 *   返回規則的成效統計，包括：
 *   - 整體統計（總應用次數、已驗證次數、準確率）
 *   - 城市別統計（各城市的應用次數和準確率）
 *
 *   查詢參數：
 *   - includeHistory=true - 包含最近應用記錄
 *   - historyLimit=50 - 歷史記錄數量上限
 *   - cityCode=xxx - 按城市過濾歷史記錄
 *
 * @param request - NextRequest 物件
 * @param params - 路由參數，包含規則 ID
 * @returns 規則統計資料
 *
 * @example
 *   GET /api/rules/rule-123/metrics
 *   GET /api/rules/rule-123/metrics?includeHistory=true&historyLimit=20
 *   GET /api/rules/rule-123/metrics?includeHistory=true&cityCode=TPE
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    // 認證檢查
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        {
          type: 'unauthorized',
          title: 'Unauthorized',
          status: 401,
          detail: 'Authentication required',
        },
        { status: 401 }
      );
    }

    // 權限檢查
    if (!hasRuleViewPermission(session.user.roles)) {
      return NextResponse.json(
        {
          type: 'forbidden',
          title: 'Forbidden',
          status: 403,
          detail: 'RULE_VIEW permission required',
        },
        { status: 403 }
      );
    }

    const { id: ruleId } = await params;

    // 解析查詢參數
    const { searchParams } = new URL(request.url);
    const includeHistory = searchParams.get('includeHistory') === 'true';
    const historyLimit = Math.min(
      parseInt(searchParams.get('historyLimit') || '50', 10),
      100
    );
    const cityCode = searchParams.get('cityCode') || undefined;

    // 取得規則成效統計
    const effectiveness = await RuleMetricsService.getRuleEffectiveness(ruleId);

    // 構建響應資料
    interface ResponseData {
      ruleId: string;
      effectiveness: typeof effectiveness;
      history?: {
        items: Awaited<ReturnType<typeof RuleMetricsService.getApplicationHistory>>['items'];
        total: number;
      };
    }

    const responseData: ResponseData = {
      ruleId,
      effectiveness,
    };

    // 如果請求包含歷史記錄
    if (includeHistory) {
      const history = await RuleMetricsService.getApplicationHistory(ruleId, {
        limit: historyLimit,
        cityCode,
      });
      responseData.history = history;
    }

    return NextResponse.json({
      success: true,
      data: responseData,
    });
  } catch (error) {
    console.error('[RuleMetricsAPI] Error:', error);

    return NextResponse.json(
      {
        type: 'internal_error',
        title: 'Internal Server Error',
        status: 500,
        detail: 'Failed to fetch rule metrics',
      },
      { status: 500 }
    );
  }
}
