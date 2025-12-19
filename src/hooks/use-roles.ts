'use client'

/**
 * @fileoverview 角色查詢和管理 Hook
 * @description
 *   提供客戶端角色 CRUD 操作功能。
 *   使用 React Query 進行資料緩存和狀態管理。
 *
 *   主要功能：
 *   - 獲取角色列表
 *   - 獲取角色（含用戶數量）
 *   - 創建角色
 *   - 更新角色
 *   - 刪除角色
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
 *   const { mutate: createRole } = useCreateRole()
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { Role } from '@prisma/client'
import type { CreateRoleInput, UpdateRoleInput } from '@/lib/validations/role.schema'

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
  /** 是否啟用查詢 */
  enabled?: boolean
}

/** API 基礎路徑 */
const ROLES_API_BASE = '/api/admin/roles'

/**
 * 從 API 獲取角色列表
 * @returns 角色列表（含用戶數量）
 */
async function fetchRoles(): Promise<RoleWithCount[]> {
  const response = await fetch(ROLES_API_BASE)
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
 * 創建角色
 * @param data - 角色資料
 * @returns 創建的角色
 */
async function createRoleApi(data: CreateRoleInput): Promise<Role> {
  const response = await fetch(ROLES_API_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  const json = await response.json()

  if (!response.ok) {
    throw new Error(json.error?.detail || 'Failed to create role')
  }

  return json.data
}

/**
 * 更新角色
 * @param id - 角色 ID
 * @param data - 更新資料
 * @returns 更新後的角色
 */
async function updateRoleApi(id: string, data: UpdateRoleInput): Promise<Role> {
  const response = await fetch(`${ROLES_API_BASE}/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  const json = await response.json()

  if (!response.ok) {
    throw new Error(json.error?.detail || 'Failed to update role')
  }

  return json.data
}

/**
 * 刪除角色
 * @param id - 角色 ID
 */
async function deleteRoleApi(id: string): Promise<void> {
  const response = await fetch(`${ROLES_API_BASE}/${id}`, {
    method: 'DELETE',
  })
  const json = await response.json()

  if (!response.ok) {
    throw new Error(json.error?.detail || 'Failed to delete role')
  }
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
 *   // 條件查詢
 *   const { data: roles } = useRoles({ enabled: isAdmin })
 */
export function useRoles(options?: UseRolesOptions) {
  const { enabled = true } = options ?? {}

  return useQuery({
    queryKey: ['roles'],
    queryFn: () => fetchRoles(),
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

// ============================================================
// 角色 CRUD Mutation Hooks
// ============================================================

/**
 * 創建角色 Hook
 * 創建成功後自動刷新角色列表
 *
 * @returns Mutation 物件
 *
 * @example
 *   const { mutate: createRole, isPending } = useCreateRole()
 *   createRole({ name: 'Custom Role', permissions: ['invoice:view'] })
 */
export function useCreateRole() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: createRoleApi,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] })
    },
  })
}

/**
 * 更新角色 Hook 輸入
 */
interface UpdateRoleMutationInput {
  id: string
  data: UpdateRoleInput
}

/**
 * 更新角色 Hook
 * 更新成功後自動刷新角色列表
 *
 * @returns Mutation 物件
 *
 * @example
 *   const { mutate: updateRole, isPending } = useUpdateRole()
 *   updateRole({ id: 'roleId', data: { name: 'New Name' } })
 */
export function useUpdateRole() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, data }: UpdateRoleMutationInput) => updateRoleApi(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] })
    },
  })
}

/**
 * 刪除角色 Hook
 * 刪除成功後自動刷新角色列表
 *
 * @returns Mutation 物件
 *
 * @example
 *   const { mutate: deleteRole, isPending } = useDeleteRole()
 *   deleteRole('roleId')
 */
export function useDeleteRole() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: deleteRoleApi,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] })
    },
  })
}
