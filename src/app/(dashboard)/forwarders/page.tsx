/**
 * @fileoverview Forwarder 管理頁面
 * @description
 *   顯示 Forwarder 列表的管理介面。
 *   提供 Forwarder 查看、搜尋、篩選和排序功能。
 *
 *   功能特點：
 *   - 分頁 Forwarder 列表（每頁 10 筆）
 *   - 名稱/代碼搜尋（300ms debounce）
 *   - 狀態篩選（全部/啟用/停用）
 *   - 多欄位排序（預設：更新時間降序）
 *   - 骨架屏載入狀態
 *
 *   權限要求：
 *   - FORWARDER_VIEW 權限（查看列表）
 *   - FORWARDER_MANAGE 權限（編輯功能，未來實作）
 *
 * @module src/app/(dashboard)/forwarders/page
 * @author Development Team
 * @since Epic 5 - Story 5.1 (Forwarder Profile List)
 * @lastModified 2025-12-19
 *
 * @features
 *   - 伺服器端權限檢查
 *   - Suspense 骨架屏載入
 *   - URL 狀態管理
 *
 * @dependencies
 *   - @/lib/auth - 認證和權限檢查
 *   - @/components/features/forwarders - Forwarder 組件
 *
 * @related
 *   - src/app/api/forwarders/route.ts - Forwarder API
 *   - src/hooks/use-forwarders.ts - Forwarder 查詢 Hook
 */

import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { PERMISSIONS } from '@/types/permissions'
import { ForwarderList, ForwarderTableSkeleton } from '@/components/features/forwarders'

export const metadata = {
  title: 'Forwarder 管理 | AI Document Extraction',
  description: '管理貨運代理商檔案和映射規則',
}

/**
 * Forwarder 管理頁面
 *
 * @description
 *   提供 Forwarder 資料的管理介面。
 *   需要 FORWARDER_VIEW 權限才能存取。
 *
 *   頁面流程：
 *   1. 伺服器端驗證認證狀態
 *   2. 檢查 FORWARDER_VIEW 權限
 *   3. 渲染 Forwarder 列表（帶 Suspense）
 */
export default async function ForwardersPage() {
  // 驗證認證狀態
  const session = await auth()

  if (!session?.user) {
    redirect('/auth/login')
  }

  // 檢查 FORWARDER_VIEW 權限
  const hasViewPermission = session.user.roles?.some((role) =>
    role.permissions.includes(PERMISSIONS.FORWARDER_VIEW)
  )

  if (!hasViewPermission) {
    redirect('/dashboard?error=access_denied')
  }

  // 檢查 FORWARDER_MANAGE 權限（未來用於新增按鈕）
  // const hasManagePermission = session.user.roles?.some((role) =>
  //   role.permissions.includes(PERMISSIONS.FORWARDER_MANAGE)
  // )

  return (
    <div className="space-y-6">
      {/* 頁面標題 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Forwarder 管理
          </h1>
          <p className="text-muted-foreground">
            管理貨運代理商檔案、映射規則和優先級設定
          </p>
        </div>
        {/* 未來可加入新增 Forwarder 按鈕（需要 FORWARDER_MANAGE 權限） */}
        {/* {hasManagePermission && <AddForwarderDialog />} */}
      </div>

      {/* Forwarder 列表 */}
      <Suspense fallback={<ForwarderTableSkeleton rows={10} />}>
        <ForwarderList />
      </Suspense>
    </div>
  )
}
