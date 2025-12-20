'use server'

/**
 * @fileoverview 存儲指標查詢 API
 * @description
 *   提供資料保留系統的存儲指標查詢：
 *   - 各層級存儲使用量和成本
 *   - 各資料類型存儲分佈
 *   - 壓縮效率統計
 *   - 歸檔、刪除、還原統計
 *   - 僅限全局管理者訪問
 *
 * @module src/app/api/admin/retention/metrics
 * @author Development Team
 * @since Epic 8 - Story 8.6 (Long-term Data Retention)
 * @lastModified 2025-12-20
 *
 * @features
 *   - 分層存儲統計（HOT, COOL, COLD, ARCHIVE）
 *   - 資料類型分佈
 *   - 壓縮節省計算
 *   - 歸檔/刪除/還原活動統計
 *   - 全局管理者權限驗證
 *
 * @dependencies
 *   - @/lib/auth - 認證服務
 *   - @/services/data-retention.service - 資料保留服務
 *
 * @related
 *   - src/components/features/retention/StorageMetrics.tsx - 指標顯示組件
 *   - src/app/(dashboard)/admin/retention/page.tsx - 資料保留管理頁面
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { dataRetentionService } from '@/services/data-retention.service'

// ============================================================
// Route Handlers
// ============================================================

/**
 * GET /api/admin/retention/metrics
 *
 * @description
 *   獲取資料保留系統的存儲指標。包含：
 *   - 總存儲大小
 *   - 各層級（HOT, COOL, COLD, ARCHIVE）的存儲量、記錄數、預估成本
 *   - 各資料類型的存儲分佈
 *   - 壓縮統計（原始大小、壓縮後大小、節省百分比）
 *   - 歸檔統計（已歸檔、待處理、失敗）
 *   - 刪除統計（待處理、已完成、總刪除記錄數）
 *   - 還原統計（待處理、已完成、平均還原時間）
 *   僅限全局管理者訪問。
 *
 * @returns 存儲指標
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  // --- 認證檢查 ---
  const session = await auth()

  if (!session?.user) {
    return NextResponse.json(
      {
        type: 'https://api.example.com/errors/unauthorized',
        title: 'Unauthorized',
        status: 401,
        detail: 'Authentication required',
      },
      { status: 401 }
    )
  }

  if (!session.user.isGlobalAdmin) {
    return NextResponse.json(
      {
        type: 'https://api.example.com/errors/forbidden',
        title: 'Forbidden',
        status: 403,
        detail: 'Global admin access required',
      },
      { status: 403 }
    )
  }

  try {
    const metrics = await dataRetentionService.getStorageMetrics()

    return NextResponse.json({
      success: true,
      data: metrics,
    })
  } catch (error) {
    console.error('[Retention Metrics API] Error:', error)

    return NextResponse.json(
      {
        type: 'https://api.example.com/errors/internal',
        title: 'Internal Server Error',
        status: 500,
        detail: 'Failed to fetch storage metrics',
      },
      { status: 500 }
    )
  }
}
