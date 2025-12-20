/**
 * @fileoverview System Configuration Service - 系統配置管理服務
 * @description
 *   本服務提供系統配置的完整管理功能，包括：
 *   - 配置 CRUD 操作
 *   - 版本控制與歷史追蹤
 *   - 配置回滾功能
 *   - 按類別/範圍查詢配置
 *
 * @module src/services/system-config.service
 * @author Development Team
 * @since Epic 6 - Story 6.4 (Global Admin Full Access)
 * @lastModified 2025-12-19
 *
 * @features
 *   - 配置版本控制
 *   - 變更歷史追蹤
 *   - 支援回滾到任意版本
 *   - 按類別/範圍過濾
 *   - 審計日誌記錄
 *
 * @dependencies
 *   - @prisma/client - Prisma ORM 客戶端
 *   - @/lib/prisma - Prisma 實例
 *
 * @related
 *   - src/services/global-admin.service.ts - 全局管理者服務
 *   - src/app/api/admin/config - 配置管理 API
 *   - prisma/schema.prisma - SystemConfig, ConfigHistory 模型
 */

import { prisma } from '@/lib/prisma'
import { ConfigCategory, ConfigScope, Prisma } from '@prisma/client'

// ============================================================
// Types
// ============================================================

/**
 * 配置值類型
 */
export interface ConfigValue {
  [key: string]: unknown
}

/**
 * 配置項目資訊
 */
export interface ConfigInfo {
  /** 配置鍵 */
  key: string
  /** 配置值 */
  value: ConfigValue
  /** 描述 */
  description: string | null
  /** 類別 */
  category: ConfigCategory
  /** 範圍 */
  scope: ConfigScope
  /** 城市代碼（如適用） */
  cityCode: string | null
  /** 版本號 */
  version: number
  /** 是否啟用 */
  isActive: boolean
  /** 更新時間 */
  updatedAt: Date
  /** 更新者 */
  updatedBy: string
}

/**
 * 配置歷史記錄
 */
export interface ConfigHistoryInfo {
  /** 版本號 */
  version: number
  /** 變更前的值 */
  previousValue: ConfigValue
  /** 變更後的值 */
  newValue: ConfigValue
  /** 變更者 */
  changedBy: {
    id: string
    name: string | null
    email: string
  }
  /** 變更原因 */
  changeReason: string | null
  /** 變更時間 */
  createdAt: Date
}

/**
 * 建立配置參數
 */
export interface CreateConfigParams {
  /** 配置鍵 */
  key: string
  /** 配置值 */
  value: ConfigValue
  /** 描述 */
  description?: string
  /** 類別 */
  category: ConfigCategory
  /** 範圍 */
  scope?: ConfigScope
  /** 城市代碼 */
  cityCode?: string
  /** 建立者 ID */
  createdBy: string
}

/**
 * 更新配置參數
 */
export interface UpdateConfigParams {
  /** 配置鍵 */
  key: string
  /** 新配置值 */
  value: ConfigValue
  /** 更新者 ID */
  updatedBy: string
  /** 變更原因 */
  changeReason?: string
}

/**
 * 回滾配置參數
 */
export interface RollbackConfigParams {
  /** 配置鍵 */
  key: string
  /** 目標版本號 */
  targetVersion: number
  /** 回滾者 ID */
  rolledBackBy: string
  /** 回滾原因 */
  reason: string
}

// ============================================================
// Custom Errors
// ============================================================

/**
 * 系統配置操作錯誤
 */
export class SystemConfigError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: Record<string, unknown>
  ) {
    super(message)
    this.name = 'SystemConfigError'
  }
}

// ============================================================
// Service Class
// ============================================================

/**
 * 系統配置管理服務
 *
 * @description
 *   提供系統配置的完整管理功能，包括版本控制和回滾機制。
 *   所有變更都會記錄到歷史表和審計日誌中。
 *
 * @example
 * ```typescript
 * // 獲取配置
 * const aiConfig = await SystemConfigService.get('ai.model.temperature')
 *
 * // 更新配置
 * await SystemConfigService.update({
 *   key: 'ai.model.temperature',
 *   value: { temperature: 0.7 },
 *   updatedBy: 'user-1',
 *   changeReason: 'Improve response creativity'
 * })
 *
 * // 回滾配置
 * await SystemConfigService.rollback({
 *   key: 'ai.model.temperature',
 *   targetVersion: 2,
 *   rolledBackBy: 'admin-1',
 *   reason: 'Revert due to performance issues'
 * })
 * ```
 */
export class SystemConfigService {
  /**
   * 根據鍵獲取配置
   *
   * @description
   *   獲取指定鍵的配置值。只返回啟用狀態的配置。
   *
   * @param key - 配置鍵
   * @returns Promise<T | null> - 配置值或 null
   *
   * @example
   * ```typescript
   * const config = await SystemConfigService.get<{ temperature: number }>(
   *   'ai.model.temperature'
   * )
   * console.log(config?.temperature) // 0.7
   * ```
   */
  static async get<T = ConfigValue>(key: string): Promise<T | null> {
    const config = await prisma.systemConfig.findFirst({
      where: { key, isActive: true },
    })

    return config?.value as T | null
  }

  /**
   * 根據鍵獲取完整配置資訊
   *
   * @description
   *   獲取指定鍵的完整配置資訊，包括元數據。
   *
   * @param key - 配置鍵
   * @returns Promise<ConfigInfo | null> - 配置資訊或 null
   */
  static async getByKey(key: string): Promise<ConfigInfo | null> {
    const config = await prisma.systemConfig.findFirst({
      where: { key },
    })

    if (!config) return null

    return {
      key: config.key,
      value: config.value as ConfigValue,
      description: config.description,
      category: config.category,
      scope: config.scope,
      cityCode: config.cityCode,
      version: config.version,
      isActive: config.isActive,
      updatedAt: config.updatedAt,
      updatedBy: config.updatedBy,
    }
  }

  /**
   * 根據類別獲取配置列表
   *
   * @description
   *   獲取指定類別的所有啟用配置。
   *
   * @param category - 配置類別
   * @returns Promise<ConfigInfo[]> - 配置列表
   *
   * @example
   * ```typescript
   * const aiConfigs = await SystemConfigService.getByCategory('AI_MODEL')
   * ```
   */
  static async getByCategory(category: ConfigCategory): Promise<ConfigInfo[]> {
    const configs = await prisma.systemConfig.findMany({
      where: { category, isActive: true },
      orderBy: { key: 'asc' },
    })

    return configs.map((c) => ({
      key: c.key,
      value: c.value as ConfigValue,
      description: c.description,
      category: c.category,
      scope: c.scope,
      cityCode: c.cityCode,
      version: c.version,
      isActive: c.isActive,
      updatedAt: c.updatedAt,
      updatedBy: c.updatedBy,
    }))
  }

  /**
   * 根據範圍獲取配置列表
   *
   * @description
   *   獲取指定範圍的所有啟用配置。
   *
   * @param scope - 配置範圍
   * @param cityCode - 城市代碼（當範圍為 CITY 時需要）
   * @returns Promise<ConfigInfo[]> - 配置列表
   */
  static async getByScope(
    scope: ConfigScope,
    cityCode?: string
  ): Promise<ConfigInfo[]> {
    const whereClause: Prisma.SystemConfigWhereInput = {
      scope,
      isActive: true,
    }

    if (scope === 'CITY' && cityCode) {
      whereClause.cityCode = cityCode
    }

    const configs = await prisma.systemConfig.findMany({
      where: whereClause,
      orderBy: { key: 'asc' },
    })

    return configs.map((c) => ({
      key: c.key,
      value: c.value as ConfigValue,
      description: c.description,
      category: c.category,
      scope: c.scope,
      cityCode: c.cityCode,
      version: c.version,
      isActive: c.isActive,
      updatedAt: c.updatedAt,
      updatedBy: c.updatedBy,
    }))
  }

  /**
   * 獲取所有配置
   *
   * @description
   *   獲取系統中所有配置（可選擇是否包含停用的配置）。
   *
   * @param includeInactive - 是否包含停用的配置
   * @returns Promise<ConfigInfo[]> - 配置列表
   */
  static async getAll(includeInactive = false): Promise<ConfigInfo[]> {
    const whereClause: Prisma.SystemConfigWhereInput = includeInactive
      ? {}
      : { isActive: true }

    const configs = await prisma.systemConfig.findMany({
      where: whereClause,
      orderBy: [{ category: 'asc' }, { key: 'asc' }],
    })

    return configs.map((c) => ({
      key: c.key,
      value: c.value as ConfigValue,
      description: c.description,
      category: c.category,
      scope: c.scope,
      cityCode: c.cityCode,
      version: c.version,
      isActive: c.isActive,
      updatedAt: c.updatedAt,
      updatedBy: c.updatedBy,
    }))
  }

  /**
   * 建立新配置
   *
   * @description
   *   建立新的系統配置項目。配置鍵必須唯一。
   *
   * @param params - 建立配置參數
   * @throws {SystemConfigError} 當配置鍵已存在時
   *
   * @example
   * ```typescript
   * await SystemConfigService.create({
   *   key: 'notification.email.enabled',
   *   value: { enabled: true, recipients: ['admin@example.com'] },
   *   description: 'Email notification settings',
   *   category: 'NOTIFICATION',
   *   scope: 'GLOBAL',
   *   createdBy: 'admin-1'
   * })
   * ```
   */
  static async create(params: CreateConfigParams): Promise<void> {
    const {
      key,
      value,
      description,
      category,
      scope = 'GLOBAL',
      cityCode,
      createdBy,
    } = params

    // 檢查配置鍵是否已存在
    const existing = await prisma.systemConfig.findFirst({
      where: { key },
    })

    if (existing) {
      throw new SystemConfigError(
        `Configuration key already exists: ${key}`,
        'DUPLICATE_KEY',
        { key }
      )
    }

    // 驗證城市範圍配置必須有城市代碼
    if (scope === 'CITY' && !cityCode) {
      throw new SystemConfigError(
        'City code is required for CITY scope configuration',
        'MISSING_CITY_CODE',
        { key, scope }
      )
    }

    await prisma.$transaction(async (tx) => {
      // 建立配置
      const config = await tx.systemConfig.create({
        data: {
          key,
          value: value as Prisma.InputJsonValue,
          description,
          category,
          scope,
          cityCode,
          updatedBy: createdBy,
        },
      })

      // 記錄審計日誌
      await tx.auditLog.create({
        data: {
          userId: createdBy,
          userName: 'System',
          action: 'CREATE',
          resourceType: 'system-config',
          resourceId: config.id,
          resourceName: key,
          description: `Created system configuration: ${key}`,
          metadata: {
            key,
            category,
            scope,
            cityCode,
          },
          status: 'SUCCESS',
        },
      })
    })
  }

  /**
   * 更新配置
   *
   * @description
   *   更新現有配置的值。會自動記錄到歷史表中並增加版本號。
   *
   * @param params - 更新配置參數
   * @throws {SystemConfigError} 當配置不存在時
   *
   * @example
   * ```typescript
   * await SystemConfigService.update({
   *   key: 'ai.model.temperature',
   *   value: { temperature: 0.8 },
   *   updatedBy: 'admin-1',
   *   changeReason: 'Increase creativity for better responses'
   * })
   * ```
   */
  static async update(params: UpdateConfigParams): Promise<void> {
    const { key, value, updatedBy, changeReason } = params

    await prisma.$transaction(async (tx) => {
      // 獲取當前配置
      const current = await tx.systemConfig.findFirst({
        where: { key },
      })

      if (!current) {
        throw new SystemConfigError(
          `Configuration not found: ${key}`,
          'CONFIG_NOT_FOUND',
          { key }
        )
      }

      // 儲存到歷史
      await tx.configHistory.create({
        data: {
          configId: current.id,
          version: current.version,
          previousValue: current.value as Prisma.InputJsonValue,
          newValue: value as Prisma.InputJsonValue,
          changedBy: updatedBy,
          changeReason,
        },
      })

      // 更新配置
      await tx.systemConfig.update({
        where: { id: current.id },
        data: {
          value: value as Prisma.InputJsonValue,
          version: { increment: 1 },
          updatedBy,
        },
      })

      // 記錄審計日誌
      await tx.auditLog.create({
        data: {
          userId: updatedBy,
          userName: 'System',
          action: 'UPDATE',
          resourceType: 'system-config',
          resourceId: current.id,
          resourceName: key,
          description: `Updated system configuration: ${key}`,
          metadata: {
            key,
            previousVersion: current.version,
            newVersion: current.version + 1,
            changeReason,
          },
          status: 'SUCCESS',
        },
      })
    })
  }

  /**
   * 切換配置啟用狀態
   *
   * @description
   *   啟用或停用指定配置。
   *
   * @param key - 配置鍵
   * @param isActive - 是否啟用
   * @param updatedBy - 更新者 ID
   * @throws {SystemConfigError} 當配置不存在時
   */
  static async setActive(
    key: string,
    isActive: boolean,
    updatedBy: string
  ): Promise<void> {
    const config = await prisma.systemConfig.findFirst({
      where: { key },
    })

    if (!config) {
      throw new SystemConfigError(
        `Configuration not found: ${key}`,
        'CONFIG_NOT_FOUND',
        { key }
      )
    }

    await prisma.$transaction(async (tx) => {
      await tx.systemConfig.update({
        where: { id: config.id },
        data: { isActive, updatedBy },
      })

      await tx.auditLog.create({
        data: {
          userId: updatedBy,
          userName: 'System',
          action: 'CONFIGURE',
          resourceType: 'system-config',
          resourceId: config.id,
          resourceName: key,
          description: `${isActive ? 'Enabled' : 'Disabled'} system configuration: ${key}`,
          metadata: { key, isActive },
          status: 'SUCCESS',
        },
      })
    })
  }

  /**
   * 獲取配置歷史
   *
   * @description
   *   獲取指定配置的所有變更歷史，按版本號降序排列。
   *
   * @param key - 配置鍵
   * @returns Promise<ConfigHistoryInfo[]> - 歷史記錄列表
   *
   * @example
   * ```typescript
   * const history = await SystemConfigService.getHistory('ai.model.temperature')
   * history.forEach(h => {
   *   console.log(`Version ${h.version}: ${h.changeReason}`)
   * })
   * ```
   */
  static async getHistory(key: string): Promise<ConfigHistoryInfo[]> {
    const config = await prisma.systemConfig.findFirst({
      where: { key },
      select: { id: true },
    })

    if (!config) return []

    const history = await prisma.configHistory.findMany({
      where: { configId: config.id },
      include: {
        changer: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { version: 'desc' },
    })

    return history.map((h) => ({
      version: h.version,
      previousValue: h.previousValue as ConfigValue,
      newValue: h.newValue as ConfigValue,
      changedBy: h.changer,
      changeReason: h.changeReason,
      createdAt: h.createdAt,
    }))
  }

  /**
   * 回滾配置到指定版本
   *
   * @description
   *   將配置回滾到歷史中的某個版本。回滾操作本身也會記錄到歷史中。
   *
   * @param params - 回滾參數
   * @throws {SystemConfigError} 當配置或目標版本不存在時
   *
   * @example
   * ```typescript
   * await SystemConfigService.rollback({
   *   key: 'ai.model.temperature',
   *   targetVersion: 2,
   *   rolledBackBy: 'admin-1',
   *   reason: 'Revert due to performance regression'
   * })
   * ```
   */
  static async rollback(params: RollbackConfigParams): Promise<void> {
    const { key, targetVersion, rolledBackBy, reason } = params

    await prisma.$transaction(async (tx) => {
      // 獲取當前配置
      const config = await tx.systemConfig.findFirst({
        where: { key },
      })

      if (!config) {
        throw new SystemConfigError(
          `Configuration not found: ${key}`,
          'CONFIG_NOT_FOUND',
          { key }
        )
      }

      // 獲取目標版本的歷史記錄
      const targetHistory = await tx.configHistory.findFirst({
        where: {
          configId: config.id,
          version: targetVersion,
        },
      })

      if (!targetHistory) {
        throw new SystemConfigError(
          `Version ${targetVersion} not found for ${key}`,
          'VERSION_NOT_FOUND',
          { key, targetVersion }
        )
      }

      // 要恢復的值是目標歷史記錄的 previousValue
      // （即該版本變更之前的值）
      const restoreValue = targetHistory.previousValue as Prisma.InputJsonValue

      // 先將當前值儲存到歷史
      await tx.configHistory.create({
        data: {
          configId: config.id,
          version: config.version,
          previousValue: config.value as Prisma.InputJsonValue,
          newValue: restoreValue,
          changedBy: rolledBackBy,
          changeReason: `Rollback to version ${targetVersion}: ${reason}`,
        },
      })

      // 更新配置
      await tx.systemConfig.update({
        where: { id: config.id },
        data: {
          value: restoreValue,
          version: { increment: 1 },
          updatedBy: rolledBackBy,
        },
      })

      // 記錄審計日誌
      await tx.auditLog.create({
        data: {
          userId: rolledBackBy,
          userName: 'System',
          action: 'UPDATE',
          resourceType: 'system-config',
          resourceId: config.id,
          resourceName: key,
          description: `Rolled back system configuration: ${key} to version ${targetVersion}`,
          metadata: {
            key,
            targetVersion,
            reason,
            newVersion: config.version + 1,
            rollback: true,
          },
          status: 'SUCCESS',
        },
      })
    })
  }

  /**
   * 刪除配置
   *
   * @description
   *   永久刪除配置及其所有歷史記錄。此操作不可逆。
   *
   * @param key - 配置鍵
   * @param deletedBy - 刪除者 ID
   * @throws {SystemConfigError} 當配置不存在時
   */
  static async delete(key: string, deletedBy: string): Promise<void> {
    const config = await prisma.systemConfig.findFirst({
      where: { key },
    })

    if (!config) {
      throw new SystemConfigError(
        `Configuration not found: ${key}`,
        'CONFIG_NOT_FOUND',
        { key }
      )
    }

    await prisma.$transaction(async (tx) => {
      // 記錄審計日誌（在刪除前）
      await tx.auditLog.create({
        data: {
          userId: deletedBy,
          userName: 'System',
          action: 'DELETE',
          resourceType: 'system-config',
          resourceId: config.id,
          resourceName: key,
          description: `Deleted system configuration: ${key}`,
          metadata: {
            key,
            category: config.category,
            scope: config.scope,
            lastValue: config.value,
          },
          status: 'SUCCESS',
        },
      })

      // 刪除配置（會級聯刪除歷史）
      await tx.systemConfig.delete({
        where: { id: config.id },
      })
    })
  }
}
