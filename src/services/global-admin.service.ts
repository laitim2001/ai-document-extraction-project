/**
 * @fileoverview Global Admin Service - 全局管理者角色管理服務
 * @description
 *   本服務提供全局管理者角色的管理功能，包括：
 *   - 授予/撤銷全局管理者角色
 *   - 驗證全局管理者權限
 *   - 獲取全局管理者列表
 *   - 保護最後一位管理者不被移除
 *
 * @module src/services/global-admin.service
 * @author Development Team
 * @since Epic 6 - Story 6.4 (Global Admin Full Access)
 * @lastModified 2025-12-19
 *
 * @features
 *   - 全局管理者角色授予/撤銷
 *   - 權限驗證
 *   - 防止移除最後一位管理者
 *   - 審計日誌記錄
 *
 * @dependencies
 *   - @prisma/client - Prisma ORM 客戶端
 *   - @/lib/db-context - RLS 上下文管理
 *   - @/lib/prisma - Prisma 實例
 *
 * @related
 *   - src/services/city-access.service.ts - 城市訪問權限服務
 *   - src/app/api/admin/global-admins - 全局管理者 API
 *   - prisma/schema.prisma - User 模型
 */

import { prisma } from '@/lib/prisma'
import { withServiceRole } from '@/lib/db-context'

// ============================================================
// Types
// ============================================================

/**
 * 全局管理者資訊
 */
export interface GlobalAdminInfo {
  /** 用戶 ID */
  id: string
  /** 用戶名稱 */
  name: string | null
  /** 電子郵件 */
  email: string
  /** 成為管理者的時間 */
  createdAt: Date
}

/**
 * 授予管理者權限的結果
 */
export interface GrantAdminResult {
  /** 是否成功 */
  success: boolean
  /** 用戶 ID */
  userId: string
  /** 訊息 */
  message: string
}

/**
 * 撤銷管理者權限的結果
 */
export interface RevokeAdminResult {
  /** 是否成功 */
  success: boolean
  /** 用戶 ID */
  userId: string
  /** 訊息 */
  message: string
}

// ============================================================
// Custom Errors
// ============================================================

/**
 * 全局管理者操作錯誤
 */
export class GlobalAdminError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: Record<string, unknown>
  ) {
    super(message)
    this.name = 'GlobalAdminError'
  }
}

// ============================================================
// Service Class
// ============================================================

/**
 * 全局管理者角色管理服務
 *
 * @description
 *   提供全局管理者角色的完整管理功能，包括授予、撤銷、查詢等操作。
 *   所有操作都使用 withServiceRole 繞過 RLS，確保能正確處理權限變更。
 *
 * @example
 * ```typescript
 * // 授予全局管理者角色
 * await GlobalAdminService.grantGlobalAdminRole('user-1', 'admin-1')
 *
 * // 檢查是否為全局管理者
 * const isAdmin = await GlobalAdminService.isGlobalAdmin('user-1')
 *
 * // 撤銷全局管理者角色
 * await GlobalAdminService.revokeGlobalAdminRole('user-1', 'admin-1')
 * ```
 */
export class GlobalAdminService {
  /**
   * 授予全局管理者角色
   *
   * @description
   *   將指定用戶提升為全局管理者。只有現有的全局管理者才能授予此權限。
   *   操作會記錄審計日誌。
   *
   * @param userId - 要授予權限的用戶 ID
   * @param grantedBy - 授權者的用戶 ID
   * @returns Promise<GrantAdminResult> - 操作結果
   *
   * @throws {GlobalAdminError} 當授權者不是全局管理者時
   * @throws {GlobalAdminError} 當目標用戶不存在時
   *
   * @example
   * ```typescript
   * const result = await GlobalAdminService.grantGlobalAdminRole(
   *   'user-123',
   *   'admin-456'
   * )
   * console.log(result.message) // "Successfully granted global admin role"
   * ```
   */
  static async grantGlobalAdminRole(
    userId: string,
    grantedBy: string
  ): Promise<GrantAdminResult> {
    return withServiceRole(async (tx) => {
      // 1. 驗證授權者是否為全局管理者
      const granter = await tx.user.findUnique({
        where: { id: grantedBy },
        select: { isGlobalAdmin: true, name: true },
      })

      if (!granter?.isGlobalAdmin) {
        throw new GlobalAdminError(
          'Only global admins can grant global admin role',
          'PERMISSION_DENIED',
          { grantedBy }
        )
      }

      // 2. 驗證目標用戶是否存在
      const targetUser = await tx.user.findUnique({
        where: { id: userId },
        select: { id: true, name: true, isGlobalAdmin: true },
      })

      if (!targetUser) {
        throw new GlobalAdminError(
          'Target user not found',
          'USER_NOT_FOUND',
          { userId }
        )
      }

      // 3. 檢查是否已經是全局管理者
      if (targetUser.isGlobalAdmin) {
        return {
          success: true,
          userId,
          message: 'User is already a global admin',
        }
      }

      // 4. 更新用戶角色
      await tx.user.update({
        where: { id: userId },
        data: { isGlobalAdmin: true },
      })

      // 5. 記錄審計日誌
      await tx.auditLog.create({
        data: {
          userId: grantedBy,
          action: 'GRANT_GLOBAL_ADMIN',
          entityType: 'User',
          entityId: userId,
          details: {
            targetUserName: targetUser.name,
            grantedByName: granter.name,
          },
        },
      })

      return {
        success: true,
        userId,
        message: 'Successfully granted global admin role',
      }
    })
  }

  /**
   * 撤銷全局管理者角色
   *
   * @description
   *   移除指定用戶的全局管理者角色。有以下限制：
   *   - 無法撤銷自己的角色
   *   - 無法移除最後一位全局管理者
   *   操作會記錄審計日誌。
   *
   * @param userId - 要撤銷權限的用戶 ID
   * @param revokedBy - 撤銷者的用戶 ID
   * @returns Promise<RevokeAdminResult> - 操作結果
   *
   * @throws {GlobalAdminError} 當試圖撤銷自己的角色時
   * @throws {GlobalAdminError} 當試圖移除最後一位管理者時
   * @throws {GlobalAdminError} 當撤銷者不是全局管理者時
   *
   * @example
   * ```typescript
   * const result = await GlobalAdminService.revokeGlobalAdminRole(
   *   'user-123',
   *   'admin-456'
   * )
   * console.log(result.message) // "Successfully revoked global admin role"
   * ```
   */
  static async revokeGlobalAdminRole(
    userId: string,
    revokedBy: string
  ): Promise<RevokeAdminResult> {
    return withServiceRole(async (tx) => {
      // 1. 防止撤銷自己的角色
      if (userId === revokedBy) {
        throw new GlobalAdminError(
          'Cannot revoke your own global admin role',
          'SELF_REVOCATION_DENIED',
          { userId }
        )
      }

      // 2. 驗證撤銷者是否為全局管理者
      const revoker = await tx.user.findUnique({
        where: { id: revokedBy },
        select: { isGlobalAdmin: true, name: true },
      })

      if (!revoker?.isGlobalAdmin) {
        throw new GlobalAdminError(
          'Only global admins can revoke global admin role',
          'PERMISSION_DENIED',
          { revokedBy }
        )
      }

      // 3. 計算剩餘的全局管理者數量
      const adminCount = await tx.user.count({
        where: { isGlobalAdmin: true },
      })

      if (adminCount <= 1) {
        throw new GlobalAdminError(
          'Cannot remove the last global admin',
          'LAST_ADMIN_PROTECTION',
          { currentAdminCount: adminCount }
        )
      }

      // 4. 獲取目標用戶資訊
      const targetUser = await tx.user.findUnique({
        where: { id: userId },
        select: { id: true, name: true, isGlobalAdmin: true },
      })

      if (!targetUser) {
        throw new GlobalAdminError(
          'Target user not found',
          'USER_NOT_FOUND',
          { userId }
        )
      }

      if (!targetUser.isGlobalAdmin) {
        return {
          success: true,
          userId,
          message: 'User is not a global admin',
        }
      }

      // 5. 更新用戶角色
      await tx.user.update({
        where: { id: userId },
        data: { isGlobalAdmin: false },
      })

      // 6. 記錄審計日誌
      await tx.auditLog.create({
        data: {
          userId: revokedBy,
          action: 'REVOKE_GLOBAL_ADMIN',
          entityType: 'User',
          entityId: userId,
          details: {
            targetUserName: targetUser.name,
            revokedByName: revoker.name,
          },
        },
      })

      return {
        success: true,
        userId,
        message: 'Successfully revoked global admin role',
      }
    })
  }

  /**
   * 檢查用戶是否為全局管理者
   *
   * @description
   *   快速驗證指定用戶是否具有全局管理者權限。
   *
   * @param userId - 要檢查的用戶 ID
   * @returns Promise<boolean> - 是否為全局管理者
   *
   * @example
   * ```typescript
   * const isAdmin = await GlobalAdminService.isGlobalAdmin('user-123')
   * if (isAdmin) {
   *   // 允許訪問全局功能
   * }
   * ```
   */
  static async isGlobalAdmin(userId: string): Promise<boolean> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { isGlobalAdmin: true },
    })

    return user?.isGlobalAdmin ?? false
  }

  /**
   * 獲取所有全局管理者列表
   *
   * @description
   *   返回系統中所有全局管理者的列表。
   *
   * @returns Promise<GlobalAdminInfo[]> - 全局管理者列表
   *
   * @example
   * ```typescript
   * const admins = await GlobalAdminService.getGlobalAdmins()
   * console.log(`System has ${admins.length} global admins`)
   * ```
   */
  static async getGlobalAdmins(): Promise<GlobalAdminInfo[]> {
    const admins = await prisma.user.findMany({
      where: { isGlobalAdmin: true },
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    })

    return admins
  }

  /**
   * 獲取全局管理者數量
   *
   * @description
   *   返回系統中全局管理者的總數。
   *
   * @returns Promise<number> - 全局管理者數量
   *
   * @example
   * ```typescript
   * const count = await GlobalAdminService.getGlobalAdminCount()
   * if (count < 2) {
   *   console.warn('Recommend having at least 2 global admins')
   * }
   * ```
   */
  static async getGlobalAdminCount(): Promise<number> {
    return prisma.user.count({
      where: { isGlobalAdmin: true },
    })
  }
}
