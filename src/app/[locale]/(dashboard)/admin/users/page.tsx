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
import { getTranslations } from 'next-intl/server'
import { auth } from '@/lib/auth'
import { hasPermission } from '@/lib/auth/city-permission'
import { PERMISSIONS } from '@/types/permissions'
import { UserList, UserListSkeleton, AddUserDialog } from '@/components/features/admin'

export async function generateMetadata() {
  const t = await getTranslations('admin.users')
  return {
    title: `${t('title')} | AI Document Extraction`,
    description: t('description'),
  }
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
export default async function UsersPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params

  // 驗證認證狀態
  const session = await auth()

  if (!session?.user) {
    redirect(`/${locale}/auth/login`)
  }

  // 檢查 USER_VIEW 權限（支援 '*' 通配符）
  const hasViewPerm = hasPermission(session.user, PERMISSIONS.USER_VIEW)

  if (!hasViewPerm) {
    redirect(`/${locale}/dashboard?error=access_denied`)
  }

  // 檢查 USER_MANAGE 權限（用於新增按鈕，支援 '*' 通配符）
  const hasManagePerm = hasPermission(session.user, PERMISSIONS.USER_MANAGE)

  // 獲取翻譯
  const t = await getTranslations('admin.users')

  return (
    <div className="space-y-6">
      {/* 頁面標題 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {t('title')}
          </h1>
          <p className="text-muted-foreground">
            {t('description')}
          </p>
        </div>
        {/* 新增用戶按鈕（需要 USER_MANAGE 權限） */}
        {hasManagePerm && <AddUserDialog />}
      </div>

      {/* 用戶列表 */}
      <Suspense fallback={<UserListSkeleton />}>
        <UserList />
      </Suspense>
    </div>
  )
}
