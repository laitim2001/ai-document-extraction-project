/**
 * @fileoverview 文件追溯鏈 API 端點
 * @description
 *   提供文件完整追溯鏈的查詢功能。
 *   包含從上傳到核准的完整處理歷程。
 *
 * @module src/app/api/documents/[id]/trace/route
 * @since Epic 8 - Story 8.4 (原始文件追溯)
 * @lastModified 2025-12-20
 *
 * @features
 *   - GET: 獲取完整追溯鏈
 *   - 權限控制：AUDITOR、GLOBAL_ADMIN、CITY_MANAGER
 *   - 審計日誌記錄
 *
 * @dependencies
 *   - @/lib/auth - 認證函數
 *   - @/services/traceability.service - 追溯服務
 *   - @/middleware/audit-log.middleware - 審計日誌中間件
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { traceabilityService } from '@/services/traceability.service';
import { withAuditLogParams } from '@/middleware/audit-log.middleware';

// ============================================================
// Types
// ============================================================

interface RouteParams {
  id: string;
}

/**
 * 允許存取追溯鏈的角色
 */
const ALLOWED_ROLES = ['AUDITOR', 'GLOBAL_ADMIN', 'CITY_MANAGER'];

// ============================================================
// GET Handler
// ============================================================

/**
 * 獲取完整追溯鏈
 *
 * @description
 *   返回文件的完整處理歷程，包含：
 *   - 文件基本資訊
 *   - 原始文件來源
 *   - OCR 處理結果
 *   - 欄位提取結果
 *   - 修正記錄
 *   - 核准記錄
 *   - 變更歷史
 *
 * @param request - Next.js 請求對象
 * @param context - 路由參數
 * @returns 完整追溯鏈
 */
async function handleGet(
  request: NextRequest,
  context: { params: RouteParams }
): Promise<NextResponse> {
  // 驗證認證
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }

  // 驗證角色權限
  const userRoles = (session.user as { roles?: Array<{ name: string }> }).roles;
  const hasAccess = userRoles?.some((r) => ALLOWED_ROLES.includes(r.name));

  if (!hasAccess) {
    return NextResponse.json(
      {
        success: false,
        error: 'Access denied. Required roles: AUDITOR, GLOBAL_ADMIN, or CITY_MANAGER',
      },
      { status: 403 }
    );
  }

  const { id } = await Promise.resolve(context.params);

  try {
    // 獲取完整追溯鏈
    const traceChain = await traceabilityService.getDocumentTraceChain(id);

    if (!traceChain) {
      return NextResponse.json(
        { success: false, error: 'Document not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: traceChain,
    });
  } catch (error) {
    console.error('Error fetching document trace chain:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}

// ============================================================
// Exports
// ============================================================

export const GET = withAuditLogParams<RouteParams>(
  {
    action: 'READ',
    resourceType: 'documentTrace',
    getResourceId: (_req: NextRequest, _result?: unknown, params?: RouteParams) => params?.id,
    getDescription: () => '獲取文件完整追溯鏈',
  },
  handleGet
);
