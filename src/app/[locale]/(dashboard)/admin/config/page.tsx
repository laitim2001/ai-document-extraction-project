'use client'

/**
 * @fileoverview 系統配置管理頁面
 * @description
 *   全局管理者配置管理介面：
 *   - 配置列表瀏覽（分類標籤）
 *   - 配置編輯
 *   - 版本歷史查看
 *   - 配置回滾
 *   - 重置為預設值
 *   - 僅限全局管理者訪問
 *
 * @module src/app/(dashboard)/admin/config/page
 * @author Development Team
 * @since Epic 12 - Story 12-4 (系統設定管理)
 * @lastModified 2025-12-21
 *
 * @features
 *   - 配置分類標籤切換
 *   - 配置搜尋過濾
 *   - 配置值編輯
 *   - 歷史版本查看與回滾
 *   - 重置為預設值
 *   - 快取重新載入
 *   - 權限保護（僅限全局管理者）
 *
 * @dependencies
 *   - next-auth - 認證
 *   - ConfigManagement - 配置管理組件
 *
 * @related
 *   - src/components/features/admin/config/ - 配置管理組件
 *   - src/app/api/admin/config/ - 配置 API
 *   - src/services/system-config.service.ts - 配置服務
 */

import { useSession } from 'next-auth/react'
import { redirect } from 'next/navigation'
import { Settings, Loader2 } from 'lucide-react'
import { ConfigManagement } from '@/components/features/admin/config'

// ============================================================
// Page Component
// ============================================================

/**
 * @page SystemConfigPage
 * @description 系統配置管理頁面（僅限全局管理者）
 */
export default function SystemConfigPage() {
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
    redirect('/auth/login')
  }

  if (!session.user.isGlobalAdmin) {
    redirect('/dashboard')
  }

  return (
    <div className="space-y-6">
      {/* 頁面標題 */}
      <div className="flex items-center gap-3">
        <Settings className="h-8 w-8 text-muted-foreground" />
        <div>
          <h1 className="text-3xl font-bold">系統配置管理</h1>
          <p className="text-muted-foreground">
            管理全系統配置參數，支持版本控制與回滾
          </p>
        </div>
      </div>

      {/* 配置管理組件 */}
      <ConfigManagement />
    </div>
  )
}
