'use client'

/**
 * @fileoverview 數據備份管理頁面
 * @description
 *   全局管理者備份管理介面：
 *   - 備份狀態總覽
 *   - 儲存使用量監控
 *   - 備份記錄查詢與操作
 *   - 備份排程配置
 *   - 手動備份建立
 *   - 僅限全局管理者訪問
 *
 * @module src/app/(dashboard)/admin/backup/page
 * @author Development Team
 * @since Epic 12 - Story 12-5 (數據備份管理)
 * @lastModified 2025-12-21
 *
 * @features
 *   - 備份狀態即時顯示
 *   - 儲存空間使用量追蹤
 *   - 備份記錄篩選與操作
 *   - 排程建立與編輯
 *   - 手動備份功能
 *   - 權限保護（僅限全局管理者）
 *
 * @dependencies
 *   - next-auth - 認證
 *   - BackupManagement - 備份管理組件
 *
 * @related
 *   - src/components/features/admin/backup/ - 備份管理組件
 *   - src/app/api/admin/backups/ - 備份 API
 *   - src/services/backup.service.ts - 備份服務
 */

import { useSession } from 'next-auth/react'
import { redirect } from 'next/navigation'
import { HardDrive, Loader2 } from 'lucide-react'
import { BackupManagement } from '@/components/features/admin/backup'

// ============================================================
// Page Component
// ============================================================

/**
 * @page BackupPage
 * @description 數據備份管理頁面（僅限全局管理者）
 */
export default function BackupPage() {
  const { data: session, status } = useSession()

  // --- Auth Check ---
  if (status === 'loading') {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">載入中...</span>
      </div>
    )
  }

  if (!session?.user) {
    redirect('/login')
  }

  if (!session.user.isGlobalAdmin) {
    redirect('/dashboard')
  }

  return (
    <div className="space-y-6">
      {/* 頁面標題 */}
      <div className="flex items-center gap-3">
        <HardDrive className="h-8 w-8 text-muted-foreground" />
        <div>
          <h1 className="text-3xl font-bold">數據備份管理</h1>
          <p className="text-muted-foreground">
            管理系統備份、排程配置與儲存空間
          </p>
        </div>
      </div>

      {/* 備份管理組件 */}
      <BackupManagement />
    </div>
  )
}
