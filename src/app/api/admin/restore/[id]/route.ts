/**
 * @fileoverview 恢復記錄詳情 API - 查詢與取消
 * @description
 *   提供單一恢復記錄的詳情查詢與取消操作
 *   - GET: 取得恢復記錄詳情（含備份、日誌等關聯資料）
 *   - DELETE: 取消進行中的恢復操作
 *
 * @module src/app/api/admin/restore/[id]
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
// GET /api/admin/restore/:id - 取得恢復記錄詳情
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

    // 取得恢復記錄詳情
    const record = await restoreService.getRestoreRecord(id)

    if (!record) {
      return NextResponse.json(
        { success: false, error: '恢復記錄不存在' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: { record },
    })
  } catch (error) {
    console.error('[GET /api/admin/restore/:id] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    )
  }
}

// ============================================================
// DELETE /api/admin/restore/:id - 取消恢復操作
// ============================================================

export async function DELETE(
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
    const userId = session.user.id || ''

    // 取消恢復操作
    await restoreService.cancelRestore(id, userId)

    return NextResponse.json({
      success: true,
      data: {
        message: '恢復操作已取消',
      },
    })
  } catch (error) {
    console.error('[DELETE /api/admin/restore/:id] Error:', error)

    // 處理業務邏輯錯誤（回傳 400）
    const isBusinessError = error instanceof Error && (
      error.message.includes('不存在') ||
      error.message.includes('無法取消') ||
      error.message.includes('狀態')
    )

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: isBusinessError ? 400 : 500 }
    )
  }
}
