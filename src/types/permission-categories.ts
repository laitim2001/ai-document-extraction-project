/**
 * @fileoverview 權限分類與詳細資訊定義
 * @description
 *   為權限選擇器 UI 提供分類結構化的權限資訊，
 *   包含每個權限的名稱、描述和分類。
 *
 *   用於：
 *   - PermissionSelector 組件的分類顯示
 *   - 角色編輯對話框中的權限選擇
 *   - 權限說明文字展示
 *
 * @module src/types/permission-categories
 * @author Development Team
 * @since Epic 1 - Story 1.7 (Custom Role Management)
 * @lastModified 2025-12-18
 *
 * @dependencies
 *   - ./permissions - 基礎權限常量
 */

import { PERMISSIONS, type Permission } from './permissions'

/**
 * 單個權限的詳細資訊
 */
export interface PermissionInfo {
  /** 權限代碼 (如 'invoice:view') */
  code: Permission
  /** 權限顯示名稱 */
  name: string
  /** 權限詳細描述 */
  description: string
}

/**
 * 權限分類
 */
export interface PermissionCategory {
  /** 分類 ID */
  id: string
  /** 分類顯示名稱 */
  label: string
  /** 分類描述 */
  description: string
  /** 該分類下的所有權限 */
  permissions: PermissionInfo[]
}

/**
 * 所有權限的詳細資訊映射
 * 用於快速查找權限的名稱和描述
 */
export const PERMISSION_INFO_MAP: Record<Permission, Omit<PermissionInfo, 'code'>> = {
  // Invoice Operations
  [PERMISSIONS.INVOICE_VIEW]: {
    name: '查看發票',
    description: '檢視發票列表及詳細內容',
  },
  [PERMISSIONS.INVOICE_CREATE]: {
    name: '建立發票',
    description: '上傳和建立新的發票記錄',
  },
  [PERMISSIONS.INVOICE_REVIEW]: {
    name: '審核發票',
    description: '對發票進行分類審核和修正',
  },
  [PERMISSIONS.INVOICE_APPROVE]: {
    name: '批准發票',
    description: '最終批准發票分類結果',
  },

  // Report Operations
  [PERMISSIONS.REPORT_VIEW]: {
    name: '查看報表',
    description: '檢視統計報表和儀表板',
  },
  [PERMISSIONS.REPORT_EXPORT]: {
    name: '匯出報表',
    description: '將報表資料匯出為 Excel/CSV 格式',
  },

  // Rule Management
  [PERMISSIONS.RULE_VIEW]: {
    name: '查看規則',
    description: '檢視映射規則和分類設定',
  },
  [PERMISSIONS.RULE_MANAGE]: {
    name: '管理規則',
    description: '新增、編輯和刪除映射規則',
  },
  [PERMISSIONS.RULE_APPROVE]: {
    name: '批准規則',
    description: '批准規則變更申請',
  },

  // Forwarder Management
  [PERMISSIONS.FORWARDER_VIEW]: {
    name: '查看 Forwarder',
    description: '檢視 Forwarder 列表和詳細資訊',
  },
  [PERMISSIONS.FORWARDER_MANAGE]: {
    name: '管理 Forwarder',
    description: '新增、編輯和停用 Forwarder',
  },

  // User Management
  [PERMISSIONS.USER_VIEW]: {
    name: '查看用戶',
    description: '檢視用戶列表和基本資訊',
  },
  [PERMISSIONS.USER_MANAGE]: {
    name: '管理用戶（全域）',
    description: '管理系統內所有用戶的角色和狀態',
  },
  [PERMISSIONS.USER_MANAGE_CITY]: {
    name: '管理用戶（城市）',
    description: '管理所在城市的用戶',
  },
  [PERMISSIONS.USER_MANAGE_REGION]: {
    name: '管理用戶（區域）',
    description: '管理管轄區域內的用戶',
  },

  // System Administration
  [PERMISSIONS.SYSTEM_CONFIG]: {
    name: '系統設定',
    description: '修改系統配置和全域參數',
  },
  [PERMISSIONS.SYSTEM_MONITOR]: {
    name: '系統監控',
    description: '檢視系統運行狀態和效能指標',
  },

  // Audit Operations
  [PERMISSIONS.AUDIT_VIEW]: {
    name: '查看審計',
    description: '檢視系統操作審計記錄',
  },
  [PERMISSIONS.AUDIT_EXPORT]: {
    name: '匯出審計',
    description: '匯出審計記錄用於稽核',
  },

  // Admin Operations
  [PERMISSIONS.ADMIN_VIEW]: {
    name: '查看管理員資源',
    description: '檢視歷史數據批次和管理功能',
  },
  [PERMISSIONS.ADMIN_MANAGE]: {
    name: '管理管理員資源',
    description: '執行批次控制和管理操作',
  },
}

/**
 * 權限分類列表
 * 用於 PermissionSelector 組件的 Accordion 顯示
 */
export const PERMISSION_CATEGORIES: PermissionCategory[] = [
  {
    id: 'invoice',
    label: '發票操作',
    description: '發票的查看、建立、審核和批准權限',
    permissions: [
      { code: PERMISSIONS.INVOICE_VIEW, ...PERMISSION_INFO_MAP[PERMISSIONS.INVOICE_VIEW] },
      { code: PERMISSIONS.INVOICE_CREATE, ...PERMISSION_INFO_MAP[PERMISSIONS.INVOICE_CREATE] },
      { code: PERMISSIONS.INVOICE_REVIEW, ...PERMISSION_INFO_MAP[PERMISSIONS.INVOICE_REVIEW] },
      { code: PERMISSIONS.INVOICE_APPROVE, ...PERMISSION_INFO_MAP[PERMISSIONS.INVOICE_APPROVE] },
    ],
  },
  {
    id: 'report',
    label: '報表操作',
    description: '統計報表的查看和匯出權限',
    permissions: [
      { code: PERMISSIONS.REPORT_VIEW, ...PERMISSION_INFO_MAP[PERMISSIONS.REPORT_VIEW] },
      { code: PERMISSIONS.REPORT_EXPORT, ...PERMISSION_INFO_MAP[PERMISSIONS.REPORT_EXPORT] },
    ],
  },
  {
    id: 'rule',
    label: '規則管理',
    description: '映射規則的查看、管理和批准權限',
    permissions: [
      { code: PERMISSIONS.RULE_VIEW, ...PERMISSION_INFO_MAP[PERMISSIONS.RULE_VIEW] },
      { code: PERMISSIONS.RULE_MANAGE, ...PERMISSION_INFO_MAP[PERMISSIONS.RULE_MANAGE] },
      { code: PERMISSIONS.RULE_APPROVE, ...PERMISSION_INFO_MAP[PERMISSIONS.RULE_APPROVE] },
    ],
  },
  {
    id: 'forwarder',
    label: 'Forwarder 管理',
    description: 'Forwarder 的查看和管理權限',
    permissions: [
      { code: PERMISSIONS.FORWARDER_VIEW, ...PERMISSION_INFO_MAP[PERMISSIONS.FORWARDER_VIEW] },
      { code: PERMISSIONS.FORWARDER_MANAGE, ...PERMISSION_INFO_MAP[PERMISSIONS.FORWARDER_MANAGE] },
    ],
  },
  {
    id: 'user',
    label: '用戶管理',
    description: '用戶帳號的查看和管理權限',
    permissions: [
      { code: PERMISSIONS.USER_VIEW, ...PERMISSION_INFO_MAP[PERMISSIONS.USER_VIEW] },
      { code: PERMISSIONS.USER_MANAGE, ...PERMISSION_INFO_MAP[PERMISSIONS.USER_MANAGE] },
      { code: PERMISSIONS.USER_MANAGE_CITY, ...PERMISSION_INFO_MAP[PERMISSIONS.USER_MANAGE_CITY] },
      { code: PERMISSIONS.USER_MANAGE_REGION, ...PERMISSION_INFO_MAP[PERMISSIONS.USER_MANAGE_REGION] },
    ],
  },
  {
    id: 'system',
    label: '系統管理',
    description: '系統設定和監控權限',
    permissions: [
      { code: PERMISSIONS.SYSTEM_CONFIG, ...PERMISSION_INFO_MAP[PERMISSIONS.SYSTEM_CONFIG] },
      { code: PERMISSIONS.SYSTEM_MONITOR, ...PERMISSION_INFO_MAP[PERMISSIONS.SYSTEM_MONITOR] },
    ],
  },
  {
    id: 'audit',
    label: '審計操作',
    description: '審計記錄的查看和匯出權限',
    permissions: [
      { code: PERMISSIONS.AUDIT_VIEW, ...PERMISSION_INFO_MAP[PERMISSIONS.AUDIT_VIEW] },
      { code: PERMISSIONS.AUDIT_EXPORT, ...PERMISSION_INFO_MAP[PERMISSIONS.AUDIT_EXPORT] },
    ],
  },
  {
    id: 'admin',
    label: '管理員操作',
    description: '管理員專用功能的查看和操作權限',
    permissions: [
      { code: PERMISSIONS.ADMIN_VIEW, ...PERMISSION_INFO_MAP[PERMISSIONS.ADMIN_VIEW] },
      { code: PERMISSIONS.ADMIN_MANAGE, ...PERMISSION_INFO_MAP[PERMISSIONS.ADMIN_MANAGE] },
    ],
  },
]

/**
 * 根據權限代碼獲取權限詳細資訊
 * @param code - 權限代碼
 * @returns 權限資訊，若找不到則返回 null
 */
export function getPermissionInfo(code: string): PermissionInfo | null {
  const info = PERMISSION_INFO_MAP[code as Permission]
  if (!info) {
    return null
  }
  return {
    code: code as Permission,
    ...info,
  }
}

/**
 * 根據權限代碼列表獲取權限詳細資訊
 * @param codes - 權限代碼陣列
 * @returns 權限資訊陣列（過濾掉無效的權限）
 */
export function getPermissionInfoList(codes: string[]): PermissionInfo[] {
  return codes
    .map((code) => getPermissionInfo(code))
    .filter((info): info is PermissionInfo => info !== null)
}

/**
 * 獲取分類下的所有權限代碼
 * @param categoryId - 分類 ID
 * @returns 該分類的權限代碼陣列
 */
export function getCategoryPermissionCodes(categoryId: string): Permission[] {
  const category = PERMISSION_CATEGORIES.find((c) => c.id === categoryId)
  return category ? category.permissions.map((p) => p.code) : []
}

/**
 * 檢查權限列表是否包含某分類的所有權限
 * @param permissions - 權限代碼陣列
 * @param categoryId - 分類 ID
 * @returns 是否包含該分類的所有權限
 */
export function hasAllCategoryPermissions(permissions: string[], categoryId: string): boolean {
  const categoryPermissions = getCategoryPermissionCodes(categoryId)
  return categoryPermissions.every((p) => permissions.includes(p))
}

/**
 * 檢查權限列表是否包含某分類的部分權限
 * @param permissions - 權限代碼陣列
 * @param categoryId - 分類 ID
 * @returns 是否包含該分類的部分權限
 */
export function hasSomeCategoryPermissions(permissions: string[], categoryId: string): boolean {
  const categoryPermissions = getCategoryPermissionCodes(categoryId)
  return categoryPermissions.some((p) => permissions.includes(p))
}
