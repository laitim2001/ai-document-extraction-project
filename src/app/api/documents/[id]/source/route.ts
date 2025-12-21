/**
 * @fileoverview 文件來源 API 端點
 * @description
 *   提供文件原始來源的查詢功能，返回預簽名 URL。
 *   支援活躍、歸檔、冷儲存三種儲存層級。
 *
 * @module src/app/api/documents/[id]/source/route
 * @since Epic 8 - Story 8.4 (原始文件追溯)
 * @lastModified 2025-12-20
 *
 * @features
 *   - GET: 獲取文件來源資訊（含預簽名 URL）
 *   - 自動處理冷儲存解凍
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
 * 獲取文件來源
 *
 * @description
 *   返回文件的原始儲存資訊，包含：
 *   - 檔案名稱、類型、大小
 *   - 儲存層級（active/archive/cold）
 *   - 預簽名 URL（1 小時有效）
 *   - 上傳資訊
 *
 * @param request - Next.js 請求對象
 * @param context - 路由參數
 * @returns 文件來源資訊
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
    // 獲取文件來源
    const source = await traceabilityService.getDocumentSource(id);

    if (!source) {
      return NextResponse.json(
        { success: false, error: 'Document not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: source,
    });
  } catch (error) {
    console.error('Error fetching document source:', error);
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
    resourceType: 'documentSource',
    getResourceId: (_req: NextRequest, _result?: unknown, params?: RouteParams) => params?.id,
    getDescription: () => '獲取文件原始來源資訊',
  },
  handleGet
);
