/**
 * @fileoverview 備份內容預覽 API
 * @description
 *   提供備份內容的預覽功能，用於恢復前確認備份資料
 *   - GET: 取得備份內容摘要（資料表、記錄數、檔案列表等）
 *
 * @module src/app/api/admin/backups/[id]/preview
 * @since Epic 12 - Story 12-6 (數據恢復功能)
 * @lastModified 2025-12-21
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { RestoreService } from '@/services/restore.service'

// ============================================================
// Service Instance
// ============================================================

const restoreService = new RestoreService()

// ============================================================
// GET /api/admin/backups/:id/preview - 預覽備份內容
// ============================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 驗證身分
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // 檢查權限（需要全局管理者）
    if (!session.user.isGlobalAdmin) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Global admin access required' },
        { status: 403 }
      )
    }

    const { id } = await params

    // 取得備份內容預覽
    const preview = await restoreService.previewBackupContents(id)

    return NextResponse.json({
      success: true,
      data: preview,
    })
  } catch (error) {
    console.error('[GET /api/admin/backups/:id/preview] Error:', error)

    // 處理業務邏輯錯誤（回傳 400 或 404）
    if (error instanceof Error && error.message.includes('不存在')) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 404 }
      )
    }

    if (error instanceof Error && error.message.includes('無法預覽')) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 400 }
      )
    }

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    )
  }
}
