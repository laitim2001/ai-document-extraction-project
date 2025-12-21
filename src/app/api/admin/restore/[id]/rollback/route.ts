/**
 * @fileoverview 恢復操作回滾 API
 * @description
 *   提供已完成恢復操作的回滾功能
 *   - POST: 使用預恢復備份回滾到恢復前的狀態
 *
 * @module src/app/api/admin/restore/[id]/rollback
 * @since Epic 12 - Story 12-6 (數據恢復功能)
 * @lastModified 2025-12-21
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { RestoreService } from '@/services/restore.service'
import { z } from 'zod'

// ============================================================
// Service Instance
// ============================================================

const restoreService = new RestoreService()

// ============================================================
// Validation Schema
// ============================================================

const rollbackSchema = z.object({
  confirmationText: z.string().min(1, '確認文字為必填'),
})

// ============================================================
// POST /api/admin/restore/:id/rollback - 回滾恢復操作
// ============================================================

export async function POST(
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

    // 解析請求體
    const body = await request.json()
    const validation = rollbackSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid request body',
          details: validation.error.flatten().fieldErrors,
        },
        { status: 400 }
      )
    }

    const userId = session.user.id || ''

    // 執行回滾
    const record = await restoreService.rollbackRestore(
      id,
      userId,
      validation.data.confirmationText
    )

    return NextResponse.json({
      success: true,
      data: {
        record,
        message: '回滾操作已開始',
      },
    })
  } catch (error) {
    console.error('[POST /api/admin/restore/:id/rollback] Error:', error)

    // 處理業務邏輯錯誤（回傳 400）
    const isBusinessError = error instanceof Error && (
      error.message.includes('不存在') ||
      error.message.includes('無法回滾') ||
      error.message.includes('確認文字') ||
      error.message.includes('預恢復備份') ||
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
