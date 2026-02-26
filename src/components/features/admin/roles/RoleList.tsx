'use client'

/**
 * @fileoverview 角色列表組件
 * @description
 *   顯示系統所有角色的列表，包含系統角色和自訂角色。
 *   提供編輯、刪除功能（自訂角色）和檢視功能（系統角色）。
 *
 *   功能特點：
 *   - 角色卡片列表展示
 *   - 系統角色標籤顯示
 *   - 使用者數量顯示
 *   - 權限摘要顯示
 *   - 編輯/刪除操作（自訂角色）
 *   - 檢視操作（系統角色）
 *
 *   權限要求：
 *   - USER_VIEW 權限（查看列表）
 *   - USER_MANAGE 權限（編輯/刪除）
 *
 * @module src/components/features/admin/roles/RoleList
 * @author Development Team
 * @since Epic 1 - Story 1.7 (Custom Role Management)
 * @lastModified 2025-12-18
 *
 * @dependencies
 *   - @/hooks/use-roles - 角色查詢 Hook
 *   - @/components/ui - UI 組件
 *
 * @related
 *   - src/app/(dashboard)/admin/roles/page.tsx - 角色管理頁面
 *   - src/components/features/admin/roles/EditRoleDialog.tsx - 編輯角色
 *   - src/components/features/admin/roles/DeleteRoleDialog.tsx - 刪除角色
 */

import { useTranslations } from 'next-intl'
import { useRoles } from '@/hooks/use-roles'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Shield, Users, Key } from 'lucide-react'
import { cn } from '@/lib/utils'

import { EditRoleDialog } from './EditRoleDialog'
import { DeleteRoleDialog } from './DeleteRoleDialog'

// ============================================================
// Types
// ============================================================

interface RoleWithCount {
  id: string
  name: string
  description: string | null
  permissions: string[]
  isSystem: boolean
  _count?: {
    users: number
  }
}

interface RoleListProps {
  /** 是否有管理權限（可編輯/刪除） */
  hasManagePermission?: boolean
  /** 自定義類名 */
  className?: string
}

// ============================================================
// Component
// ============================================================

/**
 * 角色列表組件
 *
 * @description
 *   以卡片形式展示系統中所有角色。
 *   系統角色顯示特殊標籤，自訂角色提供編輯/刪除操作。
 *
 * @example
 *   <RoleList hasManagePermission={true} />
 */
export function RoleList({ hasManagePermission = false, className }: RoleListProps) {
  // --- i18n ---
  const t = useTranslations('admin')

  // --- Hooks ---
  const { data: roles, isLoading, error } = useRoles()

  // --- Loading State ---
  if (isLoading) {
    return <RoleListSkeleton />
  }

  // --- Error State ---
  if (error) {
    return (
      <Card>
        <CardContent className="py-10 text-center">
          <p className="text-destructive">{t('roles.list.loadError')}</p>
          <p className="text-sm text-muted-foreground mt-2">
            {error instanceof Error ? error.message : t('common.unknownError')}
          </p>
        </CardContent>
      </Card>
    )
  }

  // --- Empty State ---
  if (!roles || roles.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center">
          <Shield className="mx-auto h-12 w-12 text-muted-foreground/50" />
          <p className="mt-4 text-muted-foreground">{t('roles.list.empty')}</p>
        </CardContent>
      </Card>
    )
  }

  // --- Render ---
  // 分離系統角色和自訂角色
  const systemRoles = roles.filter((role) => role.isSystem)
  const customRoles = roles.filter((role) => !role.isSystem)

  return (
    <div className={cn('space-y-6', className)}>
      {/* 系統角色 */}
      {systemRoles.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Shield className="h-4 w-4" />
            {t('roles.list.system.label')}
          </h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {systemRoles.map((role) => (
              <RoleCard
                key={role.id}
                role={role}
                hasManagePermission={hasManagePermission}
                t={t}
              />
            ))}
          </div>
        </div>
      )}

      {/* 自訂角色 */}
      <div className="space-y-4">
        <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          <Key className="h-4 w-4" />
          {t('roles.list.custom.label')}
        </h3>
        {customRoles.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {customRoles.map((role) => (
              <RoleCard
                key={role.id}
                role={role}
                hasManagePermission={hasManagePermission}
                t={t}
              />
            ))}
          </div>
        ) : (
          <Card className="border-dashed">
            <CardContent className="py-8 text-center">
              <p className="text-muted-foreground">
                {t('roles.list.custom.empty')}
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

// ============================================================
// Sub-components
// ============================================================

interface RoleCardProps {
  role: RoleWithCount
  hasManagePermission: boolean
  t: (key: string, values?: Record<string, string | number>) => string
}

/**
 * 角色卡片組件
 */
function RoleCard({ role, hasManagePermission, t }: RoleCardProps) {
  const userCount = role._count?.users ?? 0

  return (
    <Card className={cn(role.isSystem && 'border-primary/30 bg-primary/5')}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-base">
              {role.name}
              {role.isSystem && (
                <Badge variant="secondary" className="text-xs">
                  {t('roles.list.system.badge')}
                </Badge>
              )}
            </CardTitle>
            {role.description && (
              <CardDescription className="text-sm">
                {role.description}
              </CardDescription>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 統計資訊 */}
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Users className="h-4 w-4" />
            <span>{t('roles.card.users', { count: userCount })}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Key className="h-4 w-4" />
            <span>{t('roles.card.permissions', { count: role.permissions.length })}</span>
          </div>
        </div>

        {/* 操作按鈕 */}
        {hasManagePermission && (
          <div className="flex items-center gap-2 pt-2 border-t">
            <EditRoleDialog role={role} />
            {!role.isSystem && <DeleteRoleDialog role={role} />}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ============================================================
// Skeleton
// ============================================================

/**
 * 角色列表骨架屏
 */
export function RoleListSkeleton() {
  return (
    <div className="space-y-6">
      {/* 系統角色區塊 */}
      <div className="space-y-4">
        <Skeleton className="h-5 w-32" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-5 w-24" />
                  <Skeleton className="h-5 w-16" />
                </div>
                <Skeleton className="h-4 w-48 mt-1" />
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-4">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-20" />
                </div>
                <div className="flex items-center gap-2 pt-2 border-t">
                  <Skeleton className="h-9 w-16" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* 自訂角色區塊 */}
      <div className="space-y-4">
        <Skeleton className="h-5 w-24" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2].map((i) => (
            <Card key={i}>
              <CardHeader className="pb-3">
                <Skeleton className="h-5 w-28" />
                <Skeleton className="h-4 w-40 mt-1" />
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-4">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-20" />
                </div>
                <div className="flex items-center gap-2 pt-2 border-t">
                  <Skeleton className="h-9 w-16" />
                  <Skeleton className="h-9 w-16" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}

export default RoleList
