/**
 * @fileoverview 用戶服務層
 * @description
 *   提供用戶相關的業務邏輯，包含用戶查詢、創建、更新等功能。
 *   與角色服務配合實現完整的用戶管理功能。
 *
 *   主要功能：
 *   - 用戶 CRUD 操作
 *   - Azure AD 用戶同步
 *   - 用戶狀態管理
 *   - 用戶搜尋和列表
 *
 * @module src/services/user.service
 * @author Development Team
 * @since Epic 1 - Story 1.2 (User Database & Role Foundation)
 * @lastModified 2025-12-18
 *
 * @dependencies
 *   - @prisma/client - Prisma ORM 客戶端
 *   - @/lib/prisma - Prisma 單例實例
 *
 * @related
 *   - src/services/role.service.ts - 角色服務
 *   - src/types/user.ts - 用戶類型定義
 *   - src/lib/auth.ts - NextAuth 配置
 */

import { prisma } from '@/lib/prisma'
import type { User, UserStatus } from '@prisma/client'
import { assignDefaultRole } from './role.service'
import type { UserWithRoles, CreateUserFromAzureAD } from '@/types/user'

// ============================================================
// 用戶查詢
// ============================================================

/**
 * 根據 ID 獲取用戶
 * @param id - 用戶 ID
 * @returns 用戶或 null
 */
export async function getUserById(id: string): Promise<User | null> {
  return prisma.user.findUnique({
    where: { id },
  })
}

/**
 * 根據電子郵件獲取用戶
 * @param email - 電子郵件
 * @returns 用戶或 null
 */
export async function getUserByEmail(email: string): Promise<User | null> {
  return prisma.user.findUnique({
    where: { email },
  })
}

/**
 * 根據 Azure AD ID 獲取用戶
 * @param azureAdId - Azure AD 用戶 ID
 * @returns 用戶或 null
 */
export async function getUserByAzureAdId(azureAdId: string): Promise<User | null> {
  return prisma.user.findUnique({
    where: { azureAdId },
  })
}

/**
 * 獲取用戶（含角色資訊）
 * @param id - 用戶 ID
 * @returns 用戶（含角色）或 null
 */
export async function getUserWithRoles(id: string): Promise<UserWithRoles | null> {
  return prisma.user.findUnique({
    where: { id },
    include: {
      roles: {
        include: { role: true },
      },
    },
  })
}

/**
 * 檢查用戶是否存在
 * @param email - 電子郵件
 * @returns 是否存在
 */
export async function userExists(email: string): Promise<boolean> {
  const count = await prisma.user.count({
    where: { email },
  })
  return count > 0
}

// ============================================================
// 用戶創建與更新
// ============================================================

/**
 * 創建新用戶（從 Azure AD 登入）
 * @param data - Azure AD 用戶資料
 * @returns 創建的用戶
 */
export async function createUserFromAzureAD(
  data: CreateUserFromAzureAD
): Promise<User> {
  const user = await prisma.user.create({
    data: {
      email: data.email,
      name: data.name,
      image: data.image,
      azureAdId: data.azureAdId,
      status: 'ACTIVE',
    },
  })

  // 分配預設角色
  await assignDefaultRole(user.id)

  return user
}

/**
 * 更新用戶資料
 * @param id - 用戶 ID
 * @param data - 更新資料
 * @returns 更新後的用戶
 */
export async function updateUser(
  id: string,
  data: Partial<Pick<User, 'name' | 'image' | 'status'>>
): Promise<User> {
  return prisma.user.update({
    where: { id },
    data,
  })
}

/**
 * 更新用戶狀態
 * @param id - 用戶 ID
 * @param status - 新狀態
 * @returns 更新後的用戶
 */
export async function updateUserStatus(
  id: string,
  status: UserStatus
): Promise<User> {
  return prisma.user.update({
    where: { id },
    data: { status },
  })
}

/**
 * 更新用戶最後登入時間
 * @param id - 用戶 ID
 * @returns 更新後的用戶
 */
export async function updateLastLoginAt(id: string): Promise<User> {
  return prisma.user.update({
    where: { id },
    data: { lastLoginAt: new Date() },
  })
}

// ============================================================
// Azure AD 同步
// ============================================================

/**
 * 從 Azure AD 同步用戶（創建或更新）
 * @param data - Azure AD 用戶資料
 * @returns 同步後的用戶
 */
export async function syncUserFromAzureAD(
  data: CreateUserFromAzureAD
): Promise<User> {
  const existing = await getUserByEmail(data.email)

  if (existing) {
    // 更新現有用戶
    return prisma.user.update({
      where: { id: existing.id },
      data: {
        name: data.name,
        image: data.image,
        azureAdId: data.azureAdId,
        lastLoginAt: new Date(),
      },
    })
  }

  // 創建新用戶
  return createUserFromAzureAD(data)
}

// ============================================================
// 用戶列表和搜尋
// ============================================================

/**
 * 獲取所有用戶（含角色資訊）
 * @returns 用戶列表
 */
export async function getAllUsersWithRoles(): Promise<UserWithRoles[]> {
  return prisma.user.findMany({
    orderBy: { name: 'asc' },
    include: {
      roles: {
        include: { role: true },
      },
    },
  })
}

/**
 * 搜尋用戶（分頁）
 * @param params - 搜尋參數
 * @returns 用戶列表和總數
 */
export async function searchUsers(params: {
  search?: string
  status?: UserStatus
  roleId?: string
  page?: number
  limit?: number
}): Promise<{ users: UserWithRoles[]; total: number }> {
  const { search, status, roleId, page = 1, limit = 20 } = params
  const skip = (page - 1) * limit

  const where = {
    AND: [
      // 搜尋條件
      search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' as const } },
              { email: { contains: search, mode: 'insensitive' as const } },
            ],
          }
        : {},
      // 狀態篩選
      status ? { status } : {},
      // 角色篩選
      roleId
        ? {
            roles: {
              some: { roleId },
            },
          }
        : {},
    ],
  }

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      skip,
      take: limit,
      orderBy: { name: 'asc' },
      include: {
        roles: {
          include: { role: true },
        },
      },
    }),
    prisma.user.count({ where }),
  ])

  return { users, total }
}

// ============================================================
// 用戶狀態檢查
// ============================================================

/**
 * 檢查用戶是否為活躍狀態
 * @param userId - 用戶 ID
 * @returns 是否為活躍狀態
 */
export async function isUserActive(userId: string): Promise<boolean> {
  const user = await getUserById(userId)
  return user?.status === 'ACTIVE'
}

/**
 * 檢查用戶是否可以登入
 * @param userId - 用戶 ID
 * @returns 是否可以登入（只有 ACTIVE 狀態可登入）
 */
export async function canUserLogin(userId: string): Promise<boolean> {
  return isUserActive(userId)
}
