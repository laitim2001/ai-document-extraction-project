'use client'

/**
 * @fileoverview 角色查詢 Hook
 * @description
 *   提供客戶端角色列表查詢功能。
 *   使用 React Query 進行資料緩存和狀態管理。
 *
 *   主要功能：
 *   - 獲取角色列表
 *   - 獲取角色（含用戶數量）
 *   - 角色資料緩存
 *
 * @module src/hooks/use-roles
 * @author Development Team
 * @since Epic 1 - Story 1.2 (User Database & Role Foundation)
 * @lastModified 2025-12-18
 *
 * @dependencies
 *   - @tanstack/react-query - 資料查詢和緩存
 *
 * @example
 *   const { data: roles, isLoading } = useRoles()
 *   const { data: rolesWithCount } = useRoles({ includeCount: true })
 */

import { useQuery } from '@tanstack/react-query'
import type { Role } from '@prisma/client'

/**
 * 角色（含用戶數量）
 */
interface RoleWithCount extends Role {
  _count?: {
    users: number
  }
}

/**
 * 角色 API 響應
 */
interface RolesApiResponse {
  success: boolean
  data?: RoleWithCount[]
  error?: {
    title: string
    status: number
    detail?: string
  }
}

/**
 * useRoles Hook 選項
 */
interface UseRolesOptions {
  /** 是否包含用戶數量統計 */
  includeCount?: boolean
  /** 是否啟用查詢 */
  enabled?: boolean
}

/**
 * 從 API 獲取角色列表
 * @param includeCount - 是否包含用戶數量
 * @returns 角色列表
 */
async function fetchRoles(includeCount = false): Promise<RoleWithCount[]> {
  const url = `/api/roles${includeCount ? '?includeCount=true' : ''}`
  const response = await fetch(url)
  const json: RolesApiResponse = await response.json()

  if (!response.ok) {
    throw new Error(json.error?.detail || 'Failed to fetch roles')
  }

  if (!json.success || !json.data) {
    throw new Error(json.error?.detail || 'Failed to fetch roles')
  }

  return json.data
}

/**
 * 角色查詢 Hook
 * 使用 React Query 管理角色列表的獲取和緩存
 *
 * @param options - Hook 選項
 * @returns React Query 查詢結果
 *
 * @example
 *   // 基本用法
 *   const { data: roles, isLoading, error } = useRoles()
 *
 *   // 包含用戶數量
 *   const { data: roles } = useRoles({ includeCount: true })
 *
 *   // 條件查詢
 *   const { data: roles } = useRoles({ enabled: isAdmin })
 */
export function useRoles(options?: UseRolesOptions) {
  const { includeCount = false, enabled = true } = options ?? {}

  return useQuery({
    queryKey: ['roles', { includeCount }],
    queryFn: () => fetchRoles(includeCount),
    enabled,
    staleTime: 5 * 60 * 1000, // 5 分鐘
    gcTime: 30 * 60 * 1000, // 30 分鐘（舊名 cacheTime）
  })
}

/**
 * 單一角色查詢 Hook 選項
 */
interface UseRoleOptions {
  /** 是否啟用查詢 */
  enabled?: boolean
}

/**
 * 根據名稱查找角色 Hook
 * 從已獲取的角色列表中查找特定角色
 *
 * @param roleName - 角色名稱
 * @param options - Hook 選項
 * @returns 角色資料
 *
 * @example
 *   const { role, isLoading } = useRoleByName('System Admin')
 */
export function useRoleByName(roleName: string, options?: UseRoleOptions) {
  const { enabled = true } = options ?? {}

  const { data: roles, ...rest } = useRoles({ enabled })

  const role = roles?.find((r) => r.name === roleName) ?? null

  return {
    role,
    ...rest,
  }
}
