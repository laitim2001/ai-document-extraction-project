/**
 * @fileoverview System Settings 系統設定服務層
 * @description
 *   提供 System Settings 的 CRUD 操作和預設值管理功能。
 *
 *   主要功能：
 *   - getAll: 列出所有設定（支援 category 篩選）
 *   - get: 取得單一設定（含預設值 fallback）
 *   - set: 建立或更新設定（upsert）
 *   - bulkSet: 批次 upsert 設定（使用 transaction）
 *   - delete: 刪除自訂設定（恢復為預設值）
 *   - getDefaults: 取得所有預設值映射
 *
 *   設計決策：
 *   - 預設值使用 hardcoded map，不存入 DB
 *   - get() 若 DB 無資料但存在預設值，回傳預設值
 *   - bulkSet() 使用 Prisma transaction 確保一致性
 *   - 匯出 singleton instance 供其他模組使用
 *
 * @module src/services/system-settings.service
 * @since CHANGE-050 - System Settings Hub
 * @lastModified 2026-02-26
 *
 * @dependencies
 *   - @/lib/prisma - 資料庫 ORM
 *
 * @related
 *   - src/app/api/admin/settings/route.ts - 設定列表與批次更新 API
 *   - src/app/api/admin/settings/[key]/route.ts - 單一設定 API
 *   - src/hooks/use-system-settings.ts - 前端 React Query hooks
 *   - prisma/schema.prisma - SystemSetting 模型定義
 */

import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import type { SystemSetting } from '@prisma/client'

// ============================================================================
// Types
// ============================================================================

/**
 * 預設設定值結構
 */
interface DefaultSettingValue {
  value: unknown
  category: string
}

/**
 * 批次更新輸入項
 */
interface BulkSetItem {
  key: string
  value: unknown
  category?: string
}

// ============================================================================
// Constants
// ============================================================================

/**
 * 系統設定預設值映射
 *
 * @description
 *   當 DB 中不存在對應 key 時，使用此映射提供預設值。
 *   預設值不會自動寫入 DB，僅作為 fallback。
 */
const SYSTEM_SETTING_DEFAULTS: Record<string, DefaultSettingValue> = {
  'system.name': { value: 'AI Document Extraction', category: 'general' },
  'system.defaultLocale': { value: 'en', category: 'general' },
  'system.timezone': { value: 'Asia/Hong_Kong', category: 'general' },
  'system.dateFormat': { value: 'YYYY-MM-DD', category: 'general' },
  'notifications.emailEnabled': { value: true, category: 'notifications' },
  'notifications.alertThreshold': { value: 'warning', category: 'notifications' },
  'notifications.digestFrequency': { value: 'daily', category: 'notifications' },
  'notifications.recipients': { value: [], category: 'notifications' },
  'retention.documentDays': { value: 365, category: 'retention' },
  'retention.logDays': { value: 90, category: 'retention' },
  'retention.auditDays': { value: 730, category: 'retention' },
  'retention.tempFileDays': { value: 7, category: 'retention' },
}

// ============================================================================
// Service Class
// ============================================================================

/**
 * 系統設定服務
 *
 * @description
 *   管理系統層級的 key-value 設定，支援預設值 fallback 機制。
 *   所有設定值以 JSON 格式存入 DB。
 */
export class SystemSettingsService {
  // =====================
  // Query Methods
  // =====================

  /**
   * 取得所有設定
   *
   * @param category - 可選的分類篩選
   * @returns 設定列表
   */
  async getAll(category?: string): Promise<SystemSetting[]> {
    const where = category ? { category } : {}

    return prisma.systemSetting.findMany({
      where,
      orderBy: [{ category: 'asc' }, { key: 'asc' }],
    })
  }

  /**
   * 取得單一設定
   *
   * @description
   *   優先從 DB 查詢，若不存在則嘗試回傳預設值。
   *   若 DB 和預設值都沒有，回傳 null。
   *
   * @param key - 設定鍵
   * @returns 設定資料或 null
   */
  async get(key: string): Promise<SystemSetting | null> {
    const setting = await prisma.systemSetting.findUnique({
      where: { key },
    })

    if (setting) {
      return setting
    }

    // Fallback 到預設值
    const defaultSetting = SYSTEM_SETTING_DEFAULTS[key]
    if (defaultSetting) {
      return {
        id: '',
        key,
        value: defaultSetting.value as SystemSetting['value'],
        category: defaultSetting.category,
        updatedBy: null,
        updatedAt: new Date(),
        createdAt: new Date(),
      }
    }

    return null
  }

  // =====================
  // Mutation Methods
  // =====================

  /**
   * 建立或更新單一設定（upsert）
   *
   * @param key - 設定鍵
   * @param value - 設定值（JSON 相容類型）
   * @param category - 分類（可選，預設使用預設值的分類或 'general'）
   * @param updatedBy - 更新者 ID
   * @returns 建立或更新後的設定
   */
  async set(
    key: string,
    value: unknown,
    category?: string,
    updatedBy?: string
  ): Promise<SystemSetting> {
    const resolvedCategory =
      category ?? SYSTEM_SETTING_DEFAULTS[key]?.category ?? 'general'

    return prisma.systemSetting.upsert({
      where: { key },
      update: {
        value: value as Prisma.InputJsonValue,
        category: resolvedCategory,
        updatedBy: updatedBy ?? null,
      },
      create: {
        key,
        value: value as Prisma.InputJsonValue,
        category: resolvedCategory,
        updatedBy: updatedBy ?? null,
      },
    })
  }

  /**
   * 批次建立或更新設定（transaction）
   *
   * @description
   *   使用 Prisma transaction 確保所有 upsert 操作的一致性。
   *
   * @param settings - 設定列表
   * @param updatedBy - 更新者 ID
   * @returns 更新的設定數量
   */
  async bulkSet(
    settings: BulkSetItem[],
    updatedBy?: string
  ): Promise<number> {
    const operations = settings.map((item) => {
      const resolvedCategory =
        item.category ?? SYSTEM_SETTING_DEFAULTS[item.key]?.category ?? 'general'

      return prisma.systemSetting.upsert({
        where: { key: item.key },
        update: {
          value: item.value as Prisma.InputJsonValue,
          category: resolvedCategory,
          updatedBy: updatedBy ?? null,
        },
        create: {
          key: item.key,
          value: item.value as Prisma.InputJsonValue,
          category: resolvedCategory,
          updatedBy: updatedBy ?? null,
        },
      })
    })

    const results = await prisma.$transaction(operations)
    return results.length
  }

  /**
   * 刪除設定（恢復為預設值）
   *
   * @description
   *   從 DB 中刪除自訂設定。若該 key 存在預設值，
   *   後續 get() 呼叫會回傳預設值。
   *
   * @param key - 設定鍵
   */
  async delete(key: string): Promise<void> {
    await prisma.systemSetting.deleteMany({
      where: { key },
    })
  }

  // =====================
  // Utility Methods
  // =====================

  /**
   * 取得所有預設值映射
   *
   * @returns 預設值 map（key → { value, category }）
   */
  getDefaults(): Record<string, DefaultSettingValue> {
    return { ...SYSTEM_SETTING_DEFAULTS }
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

export const systemSettingsService = new SystemSettingsService()
