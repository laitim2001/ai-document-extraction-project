/**
 * @fileoverview Regional Manager Service - 區域經理管理服務
 * @description
 *   本服務提供區域經理相關的管理功能，包括：
 *   - 區域經理角色授予/撤銷
 *   - 區域訪問權限管理
 *   - 跨城市數據訪問
 *   - 區域城市查詢
 *
 * @module src/services/regional-manager.service
 * @author Development Team
 * @since Epic 6 - Story 6.3 (Regional Manager Cross-City Access)
 * @lastModified 2025-12-19
 *
 * @features
 *   - 區域經理角色管理
 *   - 區域訪問權限授予
 *   - 區域城市自動授權
 *   - 審計日誌記錄
 *
 * @dependencies
 *   - @prisma/client - Prisma ORM 客戶端
 *   - @/lib/db-context - RLS 上下文管理
 *   - @/services/city-access.service - 城市權限服務
 *
 * @related
 *   - src/services/city-access.service.ts - 城市權限服務
 *   - src/lib/db-context.ts - RLS 上下文管理
 *   - src/app/api/admin/users/[userId]/regions - 區域權限 API
 */

import { AccessLevel } from '@prisma/client'
import { withServiceRole } from '@/lib/db-context'
import { CityAccessService } from './city-access.service'

// ============================================================
// Types
// ============================================================

/**
 * 授予區域權限的參數
 */
export interface GrantRegionAccessParams {
  /** 用戶 ID */
  userId: string
  /** 區域代碼 */
  regionCode: string
  /** 授權者 ID */
  grantedBy: string
  /** 權限等級 */
  accessLevel?: AccessLevel
  /** 授權原因 */
  reason?: string
  /** 權限過期時間 */
  expiresAt?: Date
}

/**
 * 撤銷區域權限的參數
 */
export interface RevokeRegionAccessParams {
  /** 用戶 ID */
  userId: string
  /** 區域代碼 */
  regionCode: string
  /** 撤銷者 ID */
  revokedBy: string
  /** 撤銷原因 */
  reason?: string
}

/**
 * 區域資訊
 */
export interface RegionInfo {
  /** 區域代碼 */
  code: string
  /** 區域名稱 */
  name: string
  /** 城市數量 */
  cityCount: number
}

/**
 * 區域城市資訊
 */
export interface RegionCityInfo {
  /** 城市代碼 */
  code: string
  /** 城市名稱 */
  name: string
  /** 區域代碼 */
  regionCode: string
  /** 區域名稱 */
  regionName: string
}

// ============================================================
// Service Class
// ============================================================

/**
 * 區域經理管理服務
 *
 * @description
 *   提供區域經理角色和權限的完整管理功能。
 *   區域經理可以管理其被分配區域內的所有城市。
 */
export class RegionalManagerService {
  /**
   * 授予用戶區域經理角色
   *
   * @description
   *   授予用戶區域經理角色，並自動授予該區域內所有城市的訪問權限。
   *
   * @param userId - 用戶 ID
   * @param regionCode - 區域代碼
   * @param grantedBy - 授權者 ID
   * @throws 如果區域不存在
   */
  static async grantRegionalManagerRole(
    userId: string,
    regionCode: string,
    grantedBy: string
  ): Promise<void> {
    await withServiceRole(async (tx) => {
      // 獲取區域
      const region = await tx.region.findUnique({
        where: { code: regionCode },
        include: {
          cities: {
            where: { status: 'ACTIVE' },
            select: { code: true, name: true },
          },
        },
      })

      if (!region) {
        throw new Error(`Region not found: ${regionCode}`)
      }

      // 更新用戶角色標誌
      await tx.user.update({
        where: { id: userId },
        data: { isRegionalManager: true },
      })

      // 授予區域訪問權限
      await tx.userRegionAccess.upsert({
        where: {
          userId_regionId: { userId, regionId: region.id },
        },
        create: {
          userId,
          regionId: region.id,
          accessLevel: 'FULL',
          grantedBy,
          reason: `Regional manager for ${regionCode}`,
        },
        update: {
          accessLevel: 'FULL',
          grantedBy,
          grantedAt: new Date(),
          reason: `Regional manager for ${regionCode}`,
        },
      })

      // 授予區域內所有城市的訪問權限
      const cityCodes: string[] = []
      for (const city of region.cities) {
        await CityAccessService.grantAccess({
          userId,
          cityCode: city.code,
          grantedBy,
          accessLevel: 'FULL',
          reason: `Regional manager for ${regionCode}`,
        })
        cityCodes.push(city.code)
      }

      // 記錄審計日誌
      await tx.auditLog.create({
        data: {
          userId: grantedBy,
          action: 'GRANT_REGIONAL_MANAGER',
          entityType: 'User',
          entityId: userId,
          details: {
            regionCode,
            citiesGranted: cityCodes,
            grantedAt: new Date().toISOString(),
          },
        },
      })
    })
  }

  /**
   * 撤銷用戶的區域經理角色
   *
   * @description
   *   撤銷用戶特定區域的區域經理權限。
   *   如果用戶沒有其他區域權限，則同時取消區域經理標誌。
   *
   * @param params - 撤銷參數
   */
  static async revokeRegionalManagerRole(
    params: RevokeRegionAccessParams
  ): Promise<void> {
    const { userId, regionCode, revokedBy, reason } = params

    await withServiceRole(async (tx) => {
      const region = await tx.region.findUnique({
        where: { code: regionCode },
        include: {
          cities: {
            where: { status: 'ACTIVE' },
            select: { code: true },
          },
        },
      })

      if (!region) return

      // 刪除區域訪問權限
      await tx.userRegionAccess.deleteMany({
        where: {
          userId,
          regionId: region.id,
        },
      })

      // 撤銷區域內所有城市的訪問權限
      for (const city of region.cities) {
        await CityAccessService.revokeAccess({
          userId,
          cityCode: city.code,
          revokedBy,
          reason: reason || `Revoked regional manager for ${regionCode}`,
        })
      }

      // 檢查是否還有其他區域權限
      const remainingRegions = await tx.userRegionAccess.count({
        where: { userId },
      })

      // 如果沒有其他區域權限，取消區域經理標誌
      if (remainingRegions === 0) {
        await tx.user.update({
          where: { id: userId },
          data: { isRegionalManager: false },
        })
      }

      // 記錄審計日誌
      await tx.auditLog.create({
        data: {
          userId: revokedBy,
          action: 'REVOKE_REGIONAL_MANAGER',
          entityType: 'User',
          entityId: userId,
          details: {
            regionCode,
            citiesRevoked: region.cities.map((c) => c.code),
            reason,
            revokedAt: new Date().toISOString(),
          },
        },
      })
    })
  }

  /**
   * 獲取區域經理管理的所有城市代碼
   *
   * @param userId - 用戶 ID
   * @returns 城市代碼陣列
   */
  static async getManagerCities(userId: string): Promise<string[]> {
    return withServiceRole(async (tx) => {
      const regionAccesses = await tx.userRegionAccess.findMany({
        where: {
          userId,
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        },
        include: {
          region: {
            include: {
              cities: {
                where: { status: 'ACTIVE' },
                select: { code: true },
              },
            },
          },
        },
      })

      const cityCodes = regionAccesses.flatMap((ra) =>
        ra.region.cities.map((c) => c.code)
      )

      return [...new Set(cityCodes)]
    })
  }

  /**
   * 獲取區域經理管理的區域資訊
   *
   * @param userId - 用戶 ID
   * @returns 區域資訊陣列
   */
  static async getManagerRegions(userId: string): Promise<RegionInfo[]> {
    return withServiceRole(async (tx) => {
      const regionAccesses = await tx.userRegionAccess.findMany({
        where: {
          userId,
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        },
        include: {
          region: {
            include: {
              _count: {
                select: {
                  cities: { where: { status: 'ACTIVE' } },
                },
              },
            },
          },
        },
      })

      return regionAccesses.map((ra) => ({
        code: ra.region.code,
        name: ra.region.name,
        cityCount: ra.region._count.cities,
      }))
    })
  }

  /**
   * 獲取用戶可訪問的所有城市（含區域資訊）
   *
   * @description
   *   返回用戶可訪問的所有城市，包含區域資訊。
   *   適用於城市篩選組件。
   *
   * @param userId - 用戶 ID
   * @param isGlobalAdmin - 是否為全域管理員
   * @returns 城市資訊陣列
   */
  static async getAccessibleCities(
    userId: string,
    isGlobalAdmin: boolean
  ): Promise<RegionCityInfo[]> {
    return withServiceRole(async (tx) => {
      if (isGlobalAdmin) {
        // 全域管理員可以訪問所有活躍城市
        const cities = await tx.city.findMany({
          where: { status: 'ACTIVE' },
          include: {
            region: { select: { code: true, name: true } },
          },
          orderBy: [{ region: { code: 'asc' } }, { code: 'asc' }],
        })

        return cities.map((city) => ({
          code: city.code,
          name: city.name,
          regionCode: city.region.code,
          regionName: city.region.name,
        }))
      }

      // 獲取用戶的城市訪問權限
      const cityAccesses = await tx.userCityAccess.findMany({
        where: {
          userId,
          city: { status: 'ACTIVE' },
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        },
        include: {
          city: {
            include: {
              region: { select: { code: true, name: true } },
            },
          },
        },
        orderBy: [{ city: { region: { code: 'asc' } } }, { city: { code: 'asc' } }],
      })

      return cityAccesses.map((access) => ({
        code: access.city.code,
        name: access.city.name,
        regionCode: access.city.region.code,
        regionName: access.city.region.name,
      }))
    })
  }

  /**
   * 檢查用戶是否有特定區域的訪問權限
   *
   * @param userId - 用戶 ID
   * @param regionCode - 區域代碼
   * @returns 是否有訪問權限
   */
  static async hasRegionAccess(
    userId: string,
    regionCode: string
  ): Promise<boolean> {
    return withServiceRole(async (tx) => {
      const access = await tx.userRegionAccess.findFirst({
        where: {
          userId,
          region: { code: regionCode },
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        },
      })

      return !!access
    })
  }

  /**
   * 授予區域訪問權限（不含角色標誌）
   *
   * @description
   *   僅授予區域訪問權限，不修改用戶的 isRegionalManager 標誌。
   *   適用於臨時或特定權限授予。
   *
   * @param params - 授權參數
   */
  static async grantRegionAccess(
    params: GrantRegionAccessParams
  ): Promise<void> {
    const {
      userId,
      regionCode,
      grantedBy,
      accessLevel = 'FULL',
      reason,
      expiresAt,
    } = params

    await withServiceRole(async (tx) => {
      const region = await tx.region.findUnique({
        where: { code: regionCode },
        include: {
          cities: {
            where: { status: 'ACTIVE' },
            select: { code: true },
          },
        },
      })

      if (!region) {
        throw new Error(`Region not found: ${regionCode}`)
      }

      // 授予區域訪問權限
      await tx.userRegionAccess.upsert({
        where: {
          userId_regionId: { userId, regionId: region.id },
        },
        create: {
          userId,
          regionId: region.id,
          accessLevel,
          grantedBy,
          reason,
          expiresAt,
        },
        update: {
          accessLevel,
          grantedBy,
          grantedAt: new Date(),
          reason,
          expiresAt,
        },
      })

      // 授予區域內所有城市的訪問權限
      for (const city of region.cities) {
        await CityAccessService.grantAccess({
          userId,
          cityCode: city.code,
          grantedBy,
          accessLevel,
          reason: reason || `Region access for ${regionCode}`,
          expiresAt,
        })
      }

      // 記錄審計日誌
      await tx.auditLog.create({
        data: {
          userId: grantedBy,
          action: 'GRANT_REGION_ACCESS',
          entityType: 'UserRegionAccess',
          entityId: userId,
          details: {
            regionCode,
            accessLevel,
            citiesGranted: region.cities.map((c) => c.code),
            expiresAt: expiresAt?.toISOString(),
            reason,
          },
        },
      })
    })
  }

  /**
   * 清理過期的區域訪問權限
   *
   * @returns 刪除的記錄數量
   */
  static async cleanupExpiredAccesses(): Promise<number> {
    return withServiceRole(async (tx) => {
      const result = await tx.userRegionAccess.deleteMany({
        where: {
          expiresAt: { lte: new Date() },
        },
      })

      return result.count
    })
  }

  /**
   * 同步區域城市權限
   *
   * @description
   *   當區域內新增城市時，自動授予區域經理訪問權限。
   *   通常由系統背景任務調用。
   *
   * @param regionCode - 區域代碼
   */
  static async syncRegionCityAccess(regionCode: string): Promise<void> {
    await withServiceRole(async (tx) => {
      const region = await tx.region.findUnique({
        where: { code: regionCode },
        include: {
          cities: {
            where: { status: 'ACTIVE' },
            select: { code: true },
          },
          userAccesses: {
            include: {
              user: { select: { id: true } },
              grantor: { select: { id: true } },
            },
          },
        },
      })

      if (!region) return

      // 為所有區域權限持有者授予新城市的訪問權限
      for (const access of region.userAccesses) {
        for (const city of region.cities) {
          await CityAccessService.grantAccess({
            userId: access.user.id,
            cityCode: city.code,
            grantedBy: access.grantor.id,
            accessLevel: access.accessLevel,
            reason: `Synced from region ${regionCode}`,
          })
        }
      }
    })
  }
}
