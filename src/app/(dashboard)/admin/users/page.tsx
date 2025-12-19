/**
 * @fileoverview 用戶管理頁面
 * @description
 *   系統管理員的用戶管理介面。
 *   提供用戶列表查看、搜尋、篩選和新增功能。
 *
 *   功能特點：
 *   - 分頁用戶列表（每頁 20 筆）
 *   - 名稱/電子郵件搜尋
 *   - 角色/城市/狀態篩選
 *   - 骨架屏載入狀態
 *   - 新增用戶對話框（Story 1.4）
 *
 *   權限要求：
 *   - USER_VIEW 權限（查看列表）
 *   - USER_MANAGE 權限（新增用戶）
 *
 * @module src/app/(dashboard)/admin/users/page
 * @author Development Team
 * @since Epic 1 - Story 1.3 (User List & Search)
 * @lastModified 2025-12-18
 *
 * @features
 *   - 伺服器端權限檢查
 *   - Suspense 骨架屏載入
 *   - URL 狀態管理
 *   - 權限控制的新增按鈕
 *
 * @dependencies
 *   - @/lib/auth - 認證和權限檢查
 *   - @/components/features/admin - 用戶管理組件
 *
 * @related
 *   - src/app/api/admin/users/route.ts - 用戶 API
 *   - src/hooks/use-users.ts - 用戶查詢 Hook
 */

import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { PERMISSIONS } from '@/types/permissions'
import { UserList, UserListSkeleton, AddUserDialog } from '@/components/features/admin'

export const metadata = {
  title: '用戶管理 | AI Document Extraction',
  description: '管理系統用戶、角色和權限',
}

/**
 * 用戶管理頁面
 *
 * @description
 *   提供系統管理員管理用戶的介面。
 *   需要 USER_VIEW 權限才能存取。
 *   需要 USER_MANAGE 權限才能新增用戶。
 *
 *   頁面流程：
 *   1. 伺服器端驗證認證狀態
 *   2. 檢查 USER_VIEW 權限
 *   3. 檢查 USER_MANAGE 權限（用於新增按鈕）
 *   4. 渲染用戶列表（帶 Suspense）
 */
export default async function UsersPage() {
  // 驗證認證狀態
  const session = await auth()

  if (!session?.user) {
    redirect('/auth/login')
  }

  // 檢查 USER_VIEW 權限
  const hasViewPermission = session.user.roles?.some((role) =>
    role.permissions.includes(PERMISSIONS.USER_VIEW)
  )

  if (!hasViewPermission) {
    redirect('/dashboard?error=access_denied')
  }

  // 檢查 USER_MANAGE 權限（用於新增按鈕）
  const hasManagePermission = session.user.roles?.some((role) =>
    role.permissions.includes(PERMISSIONS.USER_MANAGE)
  )

  return (
    <div className="space-y-6">
      {/* 頁面標題 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            用戶管理
          </h1>
          <p className="text-muted-foreground">
            管理系統用戶、角色和權限
          </p>
        </div>
        {/* 新增用戶按鈕（需要 USER_MANAGE 權限） */}
        {hasManagePermission && <AddUserDialog />}
      </div>

      {/* 用戶列表 */}
      <Suspense fallback={<UserListSkeleton />}>
        <UserList />
      </Suspense>
    </div>
  )
}
