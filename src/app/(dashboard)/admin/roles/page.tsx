/**
 * @fileoverview 角色管理頁面
 * @description
 *   系統管理員的角色管理介面。
 *   提供角色列表查看、新增、編輯和刪除功能。
 *
 *   功能特點：
 *   - 系統角色列表（無法修改）
 *   - 自訂角色列表（可編輯/刪除）
 *   - 新增角色對話框
 *   - 骨架屏載入狀態
 *
 *   權限要求：
 *   - USER_VIEW 權限（查看列表）
 *   - USER_MANAGE 權限（新增/編輯/刪除角色）
 *
 * @module src/app/(dashboard)/admin/roles/page
 * @author Development Team
 * @since Epic 1 - Story 1.7 (Custom Role Management)
 * @lastModified 2025-12-18
 *
 * @features
 *   - 伺服器端權限檢查
 *   - Suspense 骨架屏載入
 *   - 權限控制的操作按鈕
 *
 * @dependencies
 *   - @/lib/auth - 認證和權限檢查
 *   - @/components/features/admin - 角色管理組件
 *
 * @related
 *   - src/app/api/admin/roles/route.ts - 角色 API
 *   - src/hooks/use-roles.ts - 角色查詢 Hook
 */

import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { PERMISSIONS } from '@/types/permissions'
import { RoleList, RoleListSkeleton, AddRoleDialog } from '@/components/features/admin'

export const metadata = {
  title: '角色管理 | AI Document Extraction',
  description: '管理系統角色和權限配置',
}

/**
 * 角色管理頁面
 *
 * @description
 *   提供系統管理員管理角色的介面。
 *   需要 USER_VIEW 權限才能存取。
 *   需要 USER_MANAGE 權限才能新增/編輯/刪除角色。
 *
 *   頁面流程：
 *   1. 伺服器端驗證認證狀態
 *   2. 檢查 USER_VIEW 權限
 *   3. 檢查 USER_MANAGE 權限（用於操作按鈕）
 *   4. 渲染角色列表（帶 Suspense）
 */
export default async function RolesPage() {
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

  // 檢查 USER_MANAGE 權限（用於新增/編輯/刪除按鈕）
  const hasManagePermission = session.user.roles?.some((role) =>
    role.permissions.includes(PERMISSIONS.USER_MANAGE)
  )

  return (
    <div className="space-y-6">
      {/* 頁面標題 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            角色管理
          </h1>
          <p className="text-muted-foreground">
            管理系統角色和權限配置
          </p>
        </div>
        {/* 新增角色按鈕（需要 USER_MANAGE 權限） */}
        {hasManagePermission && <AddRoleDialog />}
      </div>

      {/* 角色列表 */}
      <Suspense fallback={<RoleListSkeleton />}>
        <RoleList hasManagePermission={hasManagePermission} />
      </Suspense>
    </div>
  )
}
