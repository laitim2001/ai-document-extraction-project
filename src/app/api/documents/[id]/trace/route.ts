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
 *   - @/middlewares/audit-log.middleware - 審計日誌中間件
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { traceabilityService } from '@/services/traceability.service';
import { withAuditLogParams } from '@/middlewares/audit-log.middleware';

// ============================================================
// Types
// ============================================================

interface RouteParams {
  id: string;
}

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
 *   任何已認證用戶均可訪問，因為此端點也被文件詳情頁
 *   的 ProcessingTimeline 組件使用（Epic 13）。
 *
 * @param request - Next.js 請求對象
 * @param context - 路由參數
 * @returns 完整追溯鏈
 */
async function handleGet(
  request: NextRequest,
  context: { params: Promise<RouteParams> }
): Promise<NextResponse> {
  // 驗證認證
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }

  const { id } = await context.params;

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
