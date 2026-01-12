/**
 * @fileoverview 公司管理頁面
 * @description
 *   顯示公司列表的管理介面。
 *   提供公司查看、搜尋、篩選和排序功能。
 *
 *   功能特點：
 *   - 分頁公司列表（每頁 10 筆）
 *   - 名稱/代碼搜尋（300ms debounce）
 *   - 狀態篩選（全部/啟用/停用）
 *   - 多欄位排序（預設：更新時間降序）
 *   - 骨架屏載入狀態
 *
 *   權限要求：
 *   - FORWARDER_VIEW 權限（查看列表）
 *   - FORWARDER_MANAGE 權限（編輯功能，未來實作）
 *
 * @module src/app/(dashboard)/companies/page
 * @author Development Team
 * @since Epic 5 - Story 5.1 (Company Profile List)
 * @lastModified 2026-01-12
 *
 * @features
 *   - 伺服器端權限檢查
 *   - Suspense 骨架屏載入
 *   - URL 狀態管理
 *
 * @dependencies
 *   - @/lib/auth - 認證和權限檢查
 *   - @/components/features/forwarders - Company 組件
 *
 * @related
 *   - src/app/api/companies/route.ts - Company API
 *   - src/hooks/use-companies.ts - Company 查詢 Hook
 */

import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { auth } from '@/lib/auth'
import { hasPermission } from '@/lib/auth/city-permission'
import { PERMISSIONS } from '@/types/permissions'
import { ForwarderList, ForwarderTableSkeleton } from '@/components/features/forwarders'
import { Button } from '@/components/ui/button'

export const metadata = {
  title: '公司管理 | AI Document Extraction',
  description: '管理公司檔案和映射規則',
}

/**
 * 公司管理頁面
 *
 * @description
 *   提供公司資料的管理介面。
 *   需要 FORWARDER_VIEW 權限才能存取。
 *
 *   頁面流程：
 *   1. 伺服器端驗證認證狀態
 *   2. 檢查 FORWARDER_VIEW 權限
 *   3. 渲染公司列表（帶 Suspense）
 */
export default async function CompaniesPage() {
  // 驗證認證狀態
  const session = await auth()

  if (!session?.user) {
    redirect('/auth/login')
  }

  // 檢查 FORWARDER_VIEW 權限（支援 '*' 通配符）
  const hasViewPerm = hasPermission(session.user, PERMISSIONS.FORWARDER_VIEW)

  if (!hasViewPerm) {
    redirect('/dashboard?error=access_denied')
  }

  // 檢查 FORWARDER_MANAGE 權限（用於新增按鈕，支援 '*' 通配符）
  const hasManagePerm = hasPermission(session.user, PERMISSIONS.FORWARDER_MANAGE)

  return (
    <div className="space-y-6">
      {/* 頁面標題 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            公司管理
          </h1>
          <p className="text-muted-foreground">
            管理公司檔案、映射規則和優先級設定
          </p>
        </div>
        {/* 新增公司按鈕（需要 FORWARDER_MANAGE 權限） */}
        {hasManagePerm && (
          <Button asChild>
            <Link href="/companies/new">
              <Plus className="mr-2 h-4 w-4" />
              新增公司
            </Link>
          </Button>
        )}
      </div>

      {/* 公司列表 */}
      <Suspense fallback={<ForwarderTableSkeleton rows={10} />}>
        <ForwarderList />
      </Suspense>
    </div>
  )
}
