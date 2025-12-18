'use client'

/**
 * @fileoverview 認證 Hook
 * @description
 *   提供客戶端認證狀態存取和權限檢查功能。
 *   封裝 NextAuth 的 useSession，並提供便利的權限檢查方法。
 *
 *   主要功能：
 *   - 獲取當前用戶資訊
 *   - 檢查認證狀態
 *   - 權限檢查
 *   - 角色檢查
 *
 * @module src/hooks/use-auth
 * @author Development Team
 * @since Epic 1 - Story 1.2 (User Database & Role Foundation)
 * @lastModified 2025-12-18
 *
 * @dependencies
 *   - next-auth/react - NextAuth React 客戶端
 *
 * @example
 *   const { user, isAuthenticated, hasPermission } = useAuth()
 *
 *   if (hasPermission(PERMISSIONS.INVOICE_APPROVE)) {
 *     // 顯示批准按鈕
 *   }
 */

import { useSession } from 'next-auth/react'
import { useMemo, useCallback } from 'react'
import type { Session } from 'next-auth'
import type { Permission } from '@/types/permissions'

/**
 * useAuth Hook 返回類型
 */
export interface UseAuthReturn {
  /** 當前用戶資訊 */
  user: Session['user'] | null
  /** 是否正在載入 */
  isLoading: boolean
  /** 是否已認證 */
  isAuthenticated: boolean
  /** 用戶的所有權限（聚合） */
  permissions: string[]
  /** 檢查是否擁有特定權限 */
  hasPermission: (permission: Permission) => boolean
  /** 檢查是否擁有任一權限 */
  hasAnyPermission: (permissions: Permission[]) => boolean
  /** 檢查是否擁有所有權限 */
  hasAllPermissions: (permissions: Permission[]) => boolean
  /** 檢查是否擁有特定角色 */
  hasRole: (roleName: string) => boolean
  /** 檢查是否擁有任一角色 */
  hasAnyRole: (roleNames: string[]) => boolean
}

/**
 * 認證 Hook
 * 提供認證狀態存取和權限檢查功能
 *
 * @returns 認證狀態和權限檢查方法
 *
 * @example
 *   function ProtectedComponent() {
 *     const { user, isLoading, hasPermission } = useAuth()
 *
 *     if (isLoading) return <Loading />
 *
 *     if (!hasPermission(PERMISSIONS.INVOICE_VIEW)) {
 *       return <NoAccess />
 *     }
 *
 *     return <InvoiceList />
 *   }
 */
export function useAuth(): UseAuthReturn {
  const { data: session, status } = useSession()

  const isLoading = status === 'loading'
  const isAuthenticated = status === 'authenticated'
  const user = session?.user ?? null

  /**
   * 聚合用戶的所有權限（從所有角色）
   */
  const permissions = useMemo(() => {
    if (!user?.roles) return []

    const permissionSet = new Set<string>()
    for (const role of user.roles) {
      for (const permission of role.permissions) {
        permissionSet.add(permission)
      }
    }
    return Array.from(permissionSet)
  }, [user?.roles])

  /**
   * 檢查是否擁有特定權限
   */
  const hasPermission = useCallback(
    (permission: Permission): boolean => {
      return permissions.includes(permission)
    },
    [permissions]
  )

  /**
   * 檢查是否擁有任一權限
   */
  const hasAnyPermission = useCallback(
    (requiredPermissions: Permission[]): boolean => {
      return requiredPermissions.some((p) => permissions.includes(p))
    },
    [permissions]
  )

  /**
   * 檢查是否擁有所有權限
   */
  const hasAllPermissions = useCallback(
    (requiredPermissions: Permission[]): boolean => {
      return requiredPermissions.every((p) => permissions.includes(p))
    },
    [permissions]
  )

  /**
   * 檢查是否擁有特定角色
   */
  const hasRole = useCallback(
    (roleName: string): boolean => {
      return user?.roles?.some((r) => r.name === roleName) ?? false
    },
    [user?.roles]
  )

  /**
   * 檢查是否擁有任一角色
   */
  const hasAnyRole = useCallback(
    (roleNames: string[]): boolean => {
      return roleNames.some((name) => hasRole(name))
    },
    [hasRole]
  )

  return {
    user,
    isLoading,
    isAuthenticated,
    permissions,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    hasRole,
    hasAnyRole,
  }
}
