/**
 * @fileoverview City Access Service - 城市訪問權限管理服務
 * @description
 *   本服務提供城市訪問權限的管理功能，包括：
 *   - 權限授予/撤銷
 *   - 權限查詢
 *   - 主要城市管理
 *   - 過期權限清理
 *
 * @module src/services/city-access.service
 * @author Development Team
 * @since Epic 6 - Story 6.1 (City Data Model and RLS Configuration)
 * @lastModified 2025-12-19
 *
 * @features
 *   - 城市權限授予/撤銷
 *   - 主要城市設置
 *   - 權限過期管理
 *   - 區域城市查詢
 *   - 審計日誌記錄
 *
 * @dependencies
 *   - @prisma/client - Prisma ORM 客戶端
 *   - @/lib/db-context - RLS 上下文管理
 *
 * @related
 *   - src/lib/db-context.ts - RLS 上下文管理
 *   - src/app/api/admin/cities - 城市管理 API
 *   - src/app/api/admin/users/[userId]/cities - 用戶城市權限 API
 */

import { AccessLevel } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { withServiceRole } from '@/lib/db-context'

// ============================================================
// Types
// ============================================================

/**
 * 授予城市權限的參數
 */
export interface GrantAccessParams {
  /** 用戶 ID */
  userId: string
  /** 城市代碼 */
  cityCode: string
  /** 授權者 ID */
  grantedBy: string
  /** 權限等級 */
  accessLevel?: AccessLevel
  /** 是否為主要城市 */
  isPrimary?: boolean
  /** 權限過期時間 */
  expiresAt?: Date
  /** 授權原因 */
  reason?: string
}

/**
 * 撤銷城市權限的參數
 */
export interface RevokeAccessParams {
  /** 用戶 ID */
  userId: string
  /** 城市代碼 */
  cityCode: string
  /** 撤銷者 ID */
  revokedBy: string
  /** 撤銷原因 */
  reason?: string
}

/**
 * 城市權限資訊
 */
export interface CityAccessInfo {
  /** 城市代碼 */
  cityCode: string
  /** 城市名稱 */
  cityName: string
  /** 權限等級 */
  accessLevel: AccessLevel
  /** 是否為主要城市 */
  isPrimary: boolean
  /** 過期時間 */
  expiresAt: Date | null
}

// ============================================================
// Service Class
// ============================================================

/**
 * 城市訪問權限管理服務
 *
 * @description
 *   提供城市訪問權限的完整管理功能，包括授予、撤銷、查詢等操作。
 *   所有操作都使用 withServiceRole 繞過 RLS，確保能正確處理跨城市權限。
 */
export class CityAccessService {
  /**
   * 檢查用戶是否有特定城市的訪問權限
   *
   * @param userId - 用戶 ID
   * @param cityCode - 城市代碼
   * @returns 是否有訪問權限
   */
  static async hasAccess(
    userId: string,
    cityCode: string
  ): Promise<boolean> {
    return withServiceRole(async (tx) => {
      const access = await tx.userCityAccess.findFirst({
        where: {
          userId,
          city: { code: cityCode, status: 'ACTIVE' },
          OR: [
            { expiresAt: null },
            { expiresAt: { gt: new Date() } },
          ],
        },
      })

      return !!access
    })
  }

  /**
   * 獲取用戶可訪問的所有城市代碼
   *
   * @description
   *   返回用戶具有有效權限的所有城市代碼列表。
   *   自動排除已過期和非活躍城市的權限。
   *
   * @param userId - 用戶 ID
   * @returns 城市代碼陣列
   */
  static async getUserCityCodes(userId: string): Promise<string[]> {
    return withServiceRole(async (tx) => {
      const accesses = await tx.userCityAccess.findMany({
        where: {
          userId,
          city: { status: 'ACTIVE' },
          OR: [
            { expiresAt: null },
            { expiresAt: { gt: new Date() } },
          ],
        },
        include: {
          city: { select: { code: true } },
        },
        orderBy: [
          { isPrimary: 'desc' },
          { grantedAt: 'asc' },
        ],
      })

      return accesses.map(a => a.city.code)
    })
  }

  /**
   * 獲取用戶的主要城市代碼
   *
   * @description
   *   返回用戶的主要城市代碼。如果沒有設置主要城市，
   *   則返回第一個授權的城市。
   *
   * @param userId - 用戶 ID
   * @returns 主要城市代碼或 null
   */
  static async getPrimaryCityCode(userId: string): Promise<string | null> {
    return withServiceRole(async (tx) => {
      // 嘗試獲取主要城市
      const primaryAccess = await tx.userCityAccess.findFirst({
        where: {
          userId,
          isPrimary: true,
          city: { status: 'ACTIVE' },
          OR: [
            { expiresAt: null },
            { expiresAt: { gt: new Date() } },
          ],
        },
        include: {
          city: { select: { code: true } },
        },
      })

      if (primaryAccess) {
        return primaryAccess.city.code
      }

      // 回退到第一個權限
      const firstAccess = await tx.userCityAccess.findFirst({
        where: {
          userId,
          city: { status: 'ACTIVE' },
          OR: [
            { expiresAt: null },
            { expiresAt: { gt: new Date() } },
          ],
        },
        include: {
          city: { select: { code: true } },
        },
        orderBy: { grantedAt: 'asc' },
      })

      return firstAccess?.city.code || null
    })
  }

  /**
   * 獲取用戶的完整城市權限資訊
   *
   * @param userId - 用戶 ID
   * @returns 城市權限資訊陣列
   */
  static async getUserCityAccesses(userId: string): Promise<CityAccessInfo[]> {
    return withServiceRole(async (tx) => {
      const accesses = await tx.userCityAccess.findMany({
        where: {
          userId,
          OR: [
            { expiresAt: null },
            { expiresAt: { gt: new Date() } },
          ],
        },
        include: {
          city: {
            select: {
              code: true,
              name: true,
              status: true,
            },
          },
        },
        orderBy: [
          { isPrimary: 'desc' },
          { grantedAt: 'asc' },
        ],
      })

      return accesses
        .filter(a => a.city.status === 'ACTIVE')
        .map(a => ({
          cityCode: a.city.code,
          cityName: a.city.name,
          accessLevel: a.accessLevel,
          isPrimary: a.isPrimary,
          expiresAt: a.expiresAt,
        }))
    })
  }

  /**
   * 授予用戶城市訪問權限
   *
   * @description
   *   授予用戶特定城市的訪問權限。如果設置為主要城市，
   *   會自動取消其他城市的主要狀態。
   *
   * @param params - 授權參數
   * @throws 如果城市不存在
   */
  static async grantAccess(params: GrantAccessParams): Promise<void> {
    const {
      userId,
      cityCode,
      grantedBy,
      accessLevel = 'FULL',
      isPrimary = false,
      expiresAt,
      reason,
    } = params

    await withServiceRole(async (tx) => {
      // 獲取城市
      const city = await tx.city.findUnique({
        where: { code: cityCode },
      })

      if (!city) {
        throw new Error(`City not found: ${cityCode}`)
      }

      // 如果設置為主要城市，先取消其他主要城市
      if (isPrimary) {
        await tx.userCityAccess.updateMany({
          where: { userId, isPrimary: true },
          data: { isPrimary: false },
        })
      }

      // 使用 upsert 授予或更新權限
      await tx.userCityAccess.upsert({
        where: {
          userId_cityId: { userId, cityId: city.id },
        },
        create: {
          userId,
          cityId: city.id,
          accessLevel,
          isPrimary,
          grantedBy,
          expiresAt,
          reason,
        },
        update: {
          accessLevel,
          isPrimary,
          grantedBy,
          grantedAt: new Date(),
          expiresAt,
          reason,
        },
      })

      // 記錄審計日誌
      await tx.auditLog.create({
        data: {
          userId: grantedBy,
          action: 'GRANT_CITY_ACCESS',
          entityType: 'UserCityAccess',
          entityId: userId,
          details: {
            targetUserId: userId,
            cityCode,
            accessLevel,
            isPrimary,
            expiresAt: expiresAt?.toISOString(),
            reason,
          },
        },
      })
    })
  }

  /**
   * 撤銷用戶城市訪問權限
   *
   * @param params - 撤銷參數
   */
  static async revokeAccess(params: RevokeAccessParams): Promise<void> {
    const { userId, cityCode, revokedBy, reason } = params

    await withServiceRole(async (tx) => {
      const city = await tx.city.findUnique({
        where: { code: cityCode },
      })

      if (!city) return

      // 刪除權限
      await tx.userCityAccess.deleteMany({
        where: {
          userId,
          cityId: city.id,
        },
      })

      // 記錄審計日誌
      await tx.auditLog.create({
        data: {
          userId: revokedBy,
          action: 'REVOKE_CITY_ACCESS',
          entityType: 'UserCityAccess',
          entityId: userId,
          details: {
            targetUserId: userId,
            cityCode,
            reason,
          },
        },
      })
    })
  }

  /**
   * 設置用戶的主要城市
   *
   * @param userId - 用戶 ID
   * @param cityCode - 城市代碼
   */
  static async setPrimaryCity(
    userId: string,
    cityCode: string
  ): Promise<void> {
    await withServiceRole(async (tx) => {
      const city = await tx.city.findUnique({
        where: { code: cityCode },
      })

      if (!city) {
        throw new Error(`City not found: ${cityCode}`)
      }

      // 取消所有主要城市
      await tx.userCityAccess.updateMany({
        where: { userId, isPrimary: true },
        data: { isPrimary: false },
      })

      // 設置新的主要城市
      await tx.userCityAccess.updateMany({
        where: { userId, cityId: city.id },
        data: { isPrimary: true },
      })
    })
  }

  /**
   * 獲取區域內的所有城市代碼
   *
   * @param regionCode - 區域代碼
   * @returns 城市代碼陣列
   */
  static async getCitiesByRegion(regionCode: string): Promise<string[]> {
    return withServiceRole(async (tx) => {
      const cities = await tx.city.findMany({
        where: {
          region: { code: regionCode },
          status: 'ACTIVE',
        },
        select: { code: true },
      })

      return cities.map(c => c.code)
    })
  }

  /**
   * 清理過期的城市訪問權限
   *
   * @description
   *   刪除所有已過期的城市訪問權限記錄。
   *   適合在定時任務中調用。
   *
   * @returns 刪除的記錄數量
   */
  static async cleanupExpiredAccesses(): Promise<number> {
    return withServiceRole(async (tx) => {
      const result = await tx.userCityAccess.deleteMany({
        where: {
          expiresAt: { lte: new Date() },
        },
      })

      return result.count
    })
  }

  /**
   * 檢查用戶是否為全域管理員
   *
   * @param userId - 用戶 ID
   * @returns 是否為全域管理員
   */
  static async isGlobalAdmin(userId: string): Promise<boolean> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { isGlobalAdmin: true },
    })

    return user?.isGlobalAdmin ?? false
  }

  /**
   * 檢查用戶是否為區域管理員
   *
   * @param userId - 用戶 ID
   * @returns 是否為區域管理員
   */
  static async isRegionalManager(userId: string): Promise<boolean> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { isRegionalManager: true },
    })

    return user?.isRegionalManager ?? false
  }

  /**
   * 獲取用戶可管理的區域列表（僅區域管理員）
   *
   * @description
   *   區域管理員可以管理其被分配區域內的所有城市。
   *   此方法返回區域管理員負責的區域代碼列表。
   *
   * @param userId - 用戶 ID
   * @returns 區域代碼陣列
   */
  static async getManagedRegionCodes(userId: string): Promise<string[]> {
    return withServiceRole(async (tx) => {
      // 獲取用戶的城市權限
      const accesses = await tx.userCityAccess.findMany({
        where: { userId },
        include: {
          city: {
            include: {
              region: { select: { code: true } },
            },
          },
        },
      })

      // 提取唯一的區域代碼
      const regionCodes = [...new Set(
        accesses.map(a => a.city.region.code)
      )]

      return regionCodes
    })
  }
}
