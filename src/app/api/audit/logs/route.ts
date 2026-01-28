/**
 * @fileoverview 審計日誌查詢 API 端點（GET）
 * @description
 *   提供審計日誌的 GET 查詢功能，支援按實體類型和 ID 篩選。
 *   此端點供文件詳情頁等一般頁面使用，僅需認證即可訪問。
 *
 * @module src/app/api/audit/logs/route
 * @since FIX-034 - 文件詳情頁面修復
 * @lastModified 2026-01-28
 *
 * @features
 *   - GET: 按 entityType 和 entityId 查詢審計日誌
 *   - 認證控制：任何已認證用戶均可訪問
 *
 * @dependencies
 *   - @/lib/auth - 認證函數
 *   - @/lib/audit/logger - 審計日誌查詢
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getEntityAuditHistory } from '@/lib/audit/logger'

// ============================================================
// GET Handler
// ============================================================

/**
 * GET /api/audit/logs
 *
 * @description
 *   查詢審計日誌，支援按 entityType 和 entityId 篩選。
 *
 * @query entityType - 實體類型（如 DOCUMENT, USER）
 * @query entityId - 實體 ID
 * @query limit - 數量限制（預設 50）
 */
export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    )
  }

  const { searchParams } = new URL(request.url)
  const entityType = searchParams.get('entityType')
  const entityId = searchParams.get('entityId')
  const limit = parseInt(searchParams.get('limit') || '50', 10)

  if (!entityType || !entityId) {
    return NextResponse.json(
      {
        success: false,
        error: 'Missing required query parameters: entityType and entityId',
      },
      { status: 400 }
    )
  }

  try {
    const logs = await getEntityAuditHistory(
      entityType as Parameters<typeof getEntityAuditHistory>[0],
      entityId,
      limit
    )

    return NextResponse.json({
      success: true,
      data: logs,
    })
  } catch (error) {
    console.error('Error fetching audit logs:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    )
  }
}
