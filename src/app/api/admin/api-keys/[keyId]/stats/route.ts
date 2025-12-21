/**
 * @fileoverview API Key 使用統計路由
 * @description
 *   提供 API Key 使用統計查詢功能：
 *   - 使用量統計
 *   - 請求分佈
 *   - 最近請求記錄
 *
 * @module src/app/api/admin/api-keys/[keyId]/stats/route
 * @author Development Team
 * @since Epic 11 - Story 11.5 (API 存取控制與認證)
 * @lastModified 2025-12-21
 *
 * @features
 *   - 使用量統計
 *   - 請求分佈分析
 *   - 最近請求記錄
 *
 * @dependencies
 *   - @/services/api-key.service - API Key 服務
 *   - @/services/api-audit-log.service - 審計日誌服務
 *   - @/lib/auth/session - Session 驗證
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { apiKeyService } from '@/services/api-key.service';
import { apiAuditLogService } from '@/services/api-audit-log.service';

// ============================================================
// 路由參數類型
// ============================================================

interface RouteParams {
  params: Promise<{
    keyId: string;
  }>;
}

// ============================================================
// GET - 獲取使用統計
// ============================================================

/**
 * GET /api/admin/api-keys/:keyId/stats
 *
 * @description 獲取 API Key 的使用統計
 *
 * @param keyId - API Key ID
 * @query startDate - 開始日期（可選）
 * @query endDate - 結束日期（可選）
 *
 * @returns 使用統計資訊
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { keyId } = await params;

    // 1. 驗證 Session
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/unauthorized',
          title: 'Unauthorized',
          status: 401,
          detail: 'Authentication required',
          instance: request.nextUrl.pathname,
        },
        { status: 401 }
      );
    }

    // 2. 檢查權限
    const isAdmin =
      session.user.isGlobalAdmin ||
      session.user.roles?.some((r) => r.name === 'ADMIN' || r.name === 'GLOBAL_ADMIN');
    if (!isAdmin) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/forbidden',
          title: 'Forbidden',
          status: 403,
          detail: 'Insufficient permissions to view API key stats',
          instance: request.nextUrl.pathname,
        },
        { status: 403 }
      );
    }

    // 3. 檢查 API Key 是否存在
    const apiKey = await apiKeyService.getById(keyId);
    if (!apiKey) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/not-found',
          title: 'Not Found',
          status: 404,
          detail: 'API key not found',
          instance: request.nextUrl.pathname,
        },
        { status: 404 }
      );
    }

    // 4. 解析日期參數
    const searchParams = request.nextUrl.searchParams;
    const startDateStr = searchParams.get('startDate');
    const endDateStr = searchParams.get('endDate');
    const startDate = startDateStr ? new Date(startDateStr) : undefined;
    const endDate = endDateStr ? new Date(endDateStr) : undefined;

    // 5. 獲取統計資料
    const [usageStats, basicStats, recentRequests] = await Promise.all([
      apiAuditLogService.getUsageStats(keyId, startDate, endDate),
      apiKeyService.getUsageStats(keyId),
      apiAuditLogService.getRecentRequests(keyId, 10),
    ]);

    // 6. 返回結果
    return NextResponse.json({
      success: true,
      data: {
        apiKey: {
          id: apiKey.id,
          name: apiKey.name,
          keyPrefix: apiKey.keyPrefix,
          isActive: apiKey.isActive,
        },
        usage: {
          totalUsage: basicStats?.totalUsage.toString() ?? '0',
          monthlyUsage: basicStats?.monthlyUsage ?? 0,
          lastUsedAt: basicStats?.lastUsedAt ?? null,
        },
        stats: usageStats,
        recentRequests,
      },
    });
  } catch (error) {
    console.error('GET /api/admin/api-keys/:keyId/stats error:', error);

    return NextResponse.json(
      {
        type: 'https://api.example.com/errors/internal',
        title: 'Internal Server Error',
        status: 500,
        detail: 'An unexpected error occurred',
        instance: request.nextUrl.pathname,
      },
      { status: 500 }
    );
  }
}
