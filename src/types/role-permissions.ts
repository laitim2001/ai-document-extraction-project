/**
 * @fileoverview 角色權限映射配置
 * @description
 *   定義系統中 6 個預定義角色及其權限配置。
 *   此配置用於種子數據創建和運行時權限驗證。
 *
 *   角色層級：
 *   - System Admin: 完全系統存取
 *   - Super User: 規則和 Forwarder 管理
 *   - Data Processor: 基礎發票處理（預設角色）
 *   - City Manager: 城市級別管理
 *   - Regional Manager: 多城市管理
 *   - Auditor: 只讀審計存取
 *
 * @module src/types/role-permissions
 * @author Development Team
 * @since Epic 1 - Story 1.2 (User Database & Role Foundation)
 * @lastModified 2025-12-18
 */

import { PERMISSIONS, type Permission } from './permissions'

/**
 * 系統角色名稱常量
 */
export const ROLE_NAMES = {
  /** 系統管理員 - 擁有所有權限 */
  SYSTEM_ADMIN: 'System Admin',
  /** 超級用戶 - 可管理規則和 Forwarder */
  SUPER_USER: 'Super User',
  /** 數據處理員 - 基礎發票處理權限（新用戶預設角色）*/
  DATA_PROCESSOR: 'Data Processor',
  /** 城市經理 - 管理本城市用戶和數據 */
  CITY_MANAGER: 'City Manager',
  /** 區域經理 - 管理多城市用戶和數據 */
  REGIONAL_MANAGER: 'Regional Manager',
  /** 審計員 - 只讀報表和審計日誌 */
  AUDITOR: 'Auditor',
} as const

/**
 * 角色名稱類型
 */
export type RoleName = (typeof ROLE_NAMES)[keyof typeof ROLE_NAMES]

/**
 * 新用戶預設角色
 */
export const DEFAULT_ROLE: RoleName = ROLE_NAMES.DATA_PROCESSOR

/**
 * 角色權限映射配置
 * 定義每個角色擁有的權限列表
 */
export const ROLE_PERMISSIONS: Record<RoleName, readonly Permission[]> = {
  /**
   * Data Processor（數據處理員）
   * - 基礎發票處理權限
   * - 這是新用戶的預設角色
   */
  [ROLE_NAMES.DATA_PROCESSOR]: [
    PERMISSIONS.INVOICE_VIEW,
    PERMISSIONS.INVOICE_CREATE,
    PERMISSIONS.INVOICE_REVIEW,
  ],

  /**
   * City Manager（城市經理）
   * - 發票完整操作權限
   * - 報表查看和導出
   * - 本城市用戶管理
   * - Forwarder 查看
   */
  [ROLE_NAMES.CITY_MANAGER]: [
    PERMISSIONS.INVOICE_VIEW,
    PERMISSIONS.INVOICE_CREATE,
    PERMISSIONS.INVOICE_REVIEW,
    PERMISSIONS.INVOICE_APPROVE,
    PERMISSIONS.REPORT_VIEW,
    PERMISSIONS.REPORT_EXPORT,
    PERMISSIONS.USER_VIEW,
    PERMISSIONS.USER_MANAGE_CITY,
    PERMISSIONS.FORWARDER_VIEW,
  ],

  /**
   * Regional Manager（區域經理）
   * - 發票完整操作權限
   * - 報表查看和導出
   * - 管轄區域用戶管理
   * - Forwarder 查看
   */
  [ROLE_NAMES.REGIONAL_MANAGER]: [
    PERMISSIONS.INVOICE_VIEW,
    PERMISSIONS.INVOICE_CREATE,
    PERMISSIONS.INVOICE_REVIEW,
    PERMISSIONS.INVOICE_APPROVE,
    PERMISSIONS.REPORT_VIEW,
    PERMISSIONS.REPORT_EXPORT,
    PERMISSIONS.USER_VIEW,
    PERMISSIONS.USER_MANAGE_REGION,
    PERMISSIONS.FORWARDER_VIEW,
  ],

  /**
   * Super User（超級用戶）
   * - 發票完整操作權限
   * - 報表查看和導出
   * - 規則管理和批准
   * - Forwarder 管理
   */
  [ROLE_NAMES.SUPER_USER]: [
    PERMISSIONS.INVOICE_VIEW,
    PERMISSIONS.INVOICE_CREATE,
    PERMISSIONS.INVOICE_REVIEW,
    PERMISSIONS.INVOICE_APPROVE,
    PERMISSIONS.REPORT_VIEW,
    PERMISSIONS.REPORT_EXPORT,
    PERMISSIONS.RULE_VIEW,
    PERMISSIONS.RULE_MANAGE,
    PERMISSIONS.RULE_APPROVE,
    PERMISSIONS.FORWARDER_VIEW,
    PERMISSIONS.FORWARDER_MANAGE,
  ],

  /**
   * Auditor（審計員）
   * - 報表查看和導出
   * - 審計日誌查看和導出
   * - 只讀權限，無操作權限
   */
  [ROLE_NAMES.AUDITOR]: [
    PERMISSIONS.REPORT_VIEW,
    PERMISSIONS.REPORT_EXPORT,
    PERMISSIONS.AUDIT_VIEW,
    PERMISSIONS.AUDIT_EXPORT,
  ],

  /**
   * System Admin（系統管理員）
   * - 擁有所有系統權限
   */
  [ROLE_NAMES.SYSTEM_ADMIN]: Object.values(PERMISSIONS),
} as const

/**
 * 角色描述配置
 * 用於 UI 顯示和種子數據
 */
export const ROLE_DESCRIPTIONS: Record<RoleName, string> = {
  [ROLE_NAMES.SYSTEM_ADMIN]: '系統管理員 - 擁有所有系統權限',
  [ROLE_NAMES.SUPER_USER]: '超級用戶 - 可管理規則和 Forwarder 配置',
  [ROLE_NAMES.DATA_PROCESSOR]: '數據處理員 - 基礎發票處理和審核權限',
  [ROLE_NAMES.CITY_MANAGER]: '城市經理 - 管理本城市用戶和數據',
  [ROLE_NAMES.REGIONAL_MANAGER]: '區域經理 - 管理多城市用戶和數據',
  [ROLE_NAMES.AUDITOR]: '審計員 - 只讀報表和審計日誌存取',
} as const

/**
 * 角色排序順序（用於 UI 顯示）
 * 數字越小越優先
 */
export const ROLE_SORT_ORDER: Record<RoleName, number> = {
  [ROLE_NAMES.SYSTEM_ADMIN]: 1,
  [ROLE_NAMES.SUPER_USER]: 2,
  [ROLE_NAMES.REGIONAL_MANAGER]: 3,
  [ROLE_NAMES.CITY_MANAGER]: 4,
  [ROLE_NAMES.DATA_PROCESSOR]: 5,
  [ROLE_NAMES.AUDITOR]: 6,
} as const

/**
 * 獲取角色的權限列表
 * @param roleName - 角色名稱
 * @returns 權限陣列的副本
 */
export function getPermissionsForRole(roleName: RoleName): Permission[] {
  return [...ROLE_PERMISSIONS[roleName]]
}

/**
 * 檢查角色是否擁有特定權限
 * @param roleName - 角色名稱
 * @param permission - 要檢查的權限
 * @returns 是否擁有該權限
 */
export function roleHasPermission(
  roleName: RoleName,
  permission: Permission
): boolean {
  return ROLE_PERMISSIONS[roleName].includes(permission)
}

/**
 * 檢查字串是否為有效的角色名稱
 * @param value - 要檢查的字串
 * @returns 是否為有效角色名稱
 */
export function isValidRoleName(value: string): value is RoleName {
  return Object.values(ROLE_NAMES).includes(value as RoleName)
}

/**
 * 獲取所有角色名稱列表
 * @returns 角色名稱陣列
 */
export function getAllRoleNames(): RoleName[] {
  return Object.values(ROLE_NAMES)
}

/**
 * 獲取排序後的角色列表
 * @returns 按優先順序排序的角色名稱陣列
 */
export function getSortedRoleNames(): RoleName[] {
  return getAllRoleNames().sort(
    (a, b) => ROLE_SORT_ORDER[a] - ROLE_SORT_ORDER[b]
  )
}
