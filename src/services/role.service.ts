/**
 * @fileoverview 角色服務層
 * @description
 *   提供角色相關的業務邏輯，包含角色查詢、權限檢查、角色分配等功能。
 *   此服務是 RBAC 系統的核心組件。
 *
 *   主要功能：
 *   - 角色 CRUD 操作
 *   - 用戶角色分配/移除
 *   - 權限檢查
 *   - 用戶權限聚合
 *
 * @module src/services/role.service
 * @author Development Team
 * @since Epic 1 - Story 1.2 (User Database & Role Foundation)
 * @lastModified 2025-12-18
 *
 * @dependencies
 *   - @prisma/client - Prisma ORM 客戶端
 *   - @/lib/prisma - Prisma 單例實例
 *
 * @related
 *   - src/types/permissions.ts - 權限常量
 *   - src/types/role-permissions.ts - 角色權限映射
 *   - src/services/user.service.ts - 用戶服務
 */

import { prisma } from '@/lib/prisma'
import type { Role, UserRole } from '@prisma/client'
import { DEFAULT_ROLE } from '@/types/role-permissions'

// ============================================================
// 角色查詢
// ============================================================

/**
 * 獲取所有角色
 * @returns 角色列表（按名稱排序）
 */
export async function getAllRoles(): Promise<Role[]> {
  return prisma.role.findMany({
    orderBy: { name: 'asc' },
  })
}

/**
 * 獲取所有角色（含用戶數量統計）
 * @returns 角色列表（含用戶數量）
 */
export async function getRolesWithUserCount(): Promise<
  (Role & { _count: { users: number } })[]
> {
  return prisma.role.findMany({
    orderBy: { name: 'asc' },
    include: {
      _count: {
        select: { users: true },
      },
    },
  })
}

/**
 * 根據名稱獲取角色
 * @param name - 角色名稱
 * @returns 角色或 null
 */
export async function getRoleByName(name: string): Promise<Role | null> {
  return prisma.role.findUnique({
    where: { name },
  })
}

/**
 * 根據 ID 獲取角色
 * @param id - 角色 ID
 * @returns 角色或 null
 */
export async function getRoleById(id: string): Promise<Role | null> {
  return prisma.role.findUnique({
    where: { id },
  })
}

// ============================================================
// 用戶角色管理
// ============================================================

/**
 * 獲取用戶的所有角色
 * @param userId - 用戶 ID
 * @returns 用戶擁有的角色列表
 */
export async function getUserRoles(userId: string): Promise<Role[]> {
  const userRoles = await prisma.userRole.findMany({
    where: { userId },
    include: { role: true },
  })
  return userRoles.map((ur) => ur.role)
}

/**
 * 獲取用戶的所有權限（從所有角色聚合）
 * @param userId - 用戶 ID
 * @returns 權限字串陣列（去重）
 */
export async function getUserPermissions(userId: string): Promise<string[]> {
  const roles = await getUserRoles(userId)
  const permissionSet = new Set<string>()

  for (const role of roles) {
    for (const permission of role.permissions) {
      permissionSet.add(permission)
    }
  }

  return Array.from(permissionSet)
}

/**
 * 分配角色給用戶
 * @param userId - 用戶 ID
 * @param roleName - 角色名稱
 * @param cityId - 城市 ID（City Manager 等需要）
 * @returns 創建的 UserRole 記錄
 * @throws 角色不存在時拋出錯誤
 */
export async function assignRoleToUser(
  userId: string,
  roleName: string,
  cityId?: string
): Promise<UserRole> {
  const role = await getRoleByName(roleName)
  if (!role) {
    throw new Error(`Role not found: ${roleName}`)
  }

  // 檢查是否已經分配
  const existing = await prisma.userRole.findFirst({
    where: { userId, roleId: role.id },
  })

  if (existing) {
    throw new Error(`User already has role: ${roleName}`)
  }

  return prisma.userRole.create({
    data: {
      userId,
      roleId: role.id,
      cityId,
    },
  })
}

/**
 * 分配預設角色給新用戶
 * @param userId - 用戶 ID
 * @returns 創建的 UserRole 或 null（失敗時）
 */
export async function assignDefaultRole(userId: string): Promise<UserRole | null> {
  const defaultRole = await getRoleByName(DEFAULT_ROLE)

  if (!defaultRole) {
    console.error(`Default role not found: ${DEFAULT_ROLE}`)
    return null
  }

  try {
    // 檢查是否已經有角色
    const existingRoles = await prisma.userRole.findMany({
      where: { userId },
    })

    if (existingRoles.length > 0) {
      // 用戶已有角色，不分配預設角色
      return null
    }

    return await prisma.userRole.create({
      data: {
        userId,
        roleId: defaultRole.id,
      },
    })
  } catch (error) {
    console.error('Failed to assign default role:', error)
    return null
  }
}

/**
 * 從用戶移除角色
 * @param userId - 用戶 ID
 * @param roleId - 角色 ID
 */
export async function removeRoleFromUser(
  userId: string,
  roleId: string
): Promise<void> {
  await prisma.userRole.delete({
    where: {
      userId_roleId: { userId, roleId },
    },
  })
}

// ============================================================
// 權限檢查
// ============================================================

/**
 * 檢查用戶是否擁有特定權限
 * @param userId - 用戶 ID
 * @param permission - 權限字串
 * @returns 是否擁有該權限
 */
export async function hasPermission(
  userId: string,
  permission: string
): Promise<boolean> {
  const permissions = await getUserPermissions(userId)
  return permissions.includes(permission)
}

/**
 * 檢查用戶是否擁有任一指定權限
 * @param userId - 用戶 ID
 * @param permissions - 權限字串陣列
 * @returns 是否擁有任一權限
 */
export async function hasAnyPermission(
  userId: string,
  permissions: string[]
): Promise<boolean> {
  const userPermissions = await getUserPermissions(userId)
  return permissions.some((p) => userPermissions.includes(p))
}

/**
 * 檢查用戶是否擁有所有指定權限
 * @param userId - 用戶 ID
 * @param permissions - 權限字串陣列
 * @returns 是否擁有所有權限
 */
export async function hasAllPermissions(
  userId: string,
  permissions: string[]
): Promise<boolean> {
  const userPermissions = await getUserPermissions(userId)
  return permissions.every((p) => userPermissions.includes(p))
}

/**
 * 檢查用戶是否擁有特定角色
 * @param userId - 用戶 ID
 * @param roleName - 角色名稱
 * @returns 是否擁有該角色
 */
export async function hasRole(
  userId: string,
  roleName: string
): Promise<boolean> {
  const roles = await getUserRoles(userId)
  return roles.some((r) => r.name === roleName)
}

/**
 * 檢查用戶是否擁有任一指定角色
 * @param userId - 用戶 ID
 * @param roleNames - 角色名稱陣列
 * @returns 是否擁有任一角色
 */
export async function hasAnyRole(
  userId: string,
  roleNames: string[]
): Promise<boolean> {
  const roles = await getUserRoles(userId)
  return roleNames.some((name) => roles.some((r) => r.name === name))
}
