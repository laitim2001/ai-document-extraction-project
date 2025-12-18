/**
 * @fileoverview 系統權限常量定義
 * @description
 *   定義所有系統權限常量，遵循 resource:action[:scope] 模式。
 *   這些權限用於 RBAC 系統中的細粒度存取控制。
 *
 *   權限分類：
 *   - 發票操作 (invoice:*)
 *   - 報表操作 (report:*)
 *   - 規則管理 (rule:*)
 *   - Forwarder 管理 (forwarder:*)
 *   - 用戶管理 (user:*)
 *   - 系統管理 (system:*)
 *   - 審計操作 (audit:*)
 *
 * @module src/types/permissions
 * @author Development Team
 * @since Epic 1 - Story 1.2 (User Database & Role Foundation)
 * @lastModified 2025-12-18
 */

/**
 * 系統權限常量
 * 所有權限遵循 resource:action[:scope] 模式
 */
export const PERMISSIONS = {
  // ===========================================
  // Invoice Operations（發票操作）
  // ===========================================
  /** 查看發票 */
  INVOICE_VIEW: 'invoice:view',
  /** 創建/上傳發票 */
  INVOICE_CREATE: 'invoice:create',
  /** 審核發票 */
  INVOICE_REVIEW: 'invoice:review',
  /** 批准發票 */
  INVOICE_APPROVE: 'invoice:approve',

  // ===========================================
  // Report Operations（報表操作）
  // ===========================================
  /** 查看報表 */
  REPORT_VIEW: 'report:view',
  /** 導出報表 */
  REPORT_EXPORT: 'report:export',

  // ===========================================
  // Rule Management（規則管理）
  // ===========================================
  /** 查看映射規則 */
  RULE_VIEW: 'rule:view',
  /** 管理映射規則 */
  RULE_MANAGE: 'rule:manage',
  /** 批准規則變更 */
  RULE_APPROVE: 'rule:approve',

  // ===========================================
  // Forwarder Management（Forwarder 管理）
  // ===========================================
  /** 查看 Forwarder */
  FORWARDER_VIEW: 'forwarder:view',
  /** 管理 Forwarder */
  FORWARDER_MANAGE: 'forwarder:manage',

  // ===========================================
  // User Management（用戶管理）
  // ===========================================
  /** 查看用戶列表 */
  USER_VIEW: 'user:view',
  /** 管理所有用戶（全域）*/
  USER_MANAGE: 'user:manage',
  /** 管理本城市用戶 */
  USER_MANAGE_CITY: 'user:manage:city',
  /** 管理管轄區域用戶 */
  USER_MANAGE_REGION: 'user:manage:region',

  // ===========================================
  // System Administration（系統管理）
  // ===========================================
  /** 系統配置 */
  SYSTEM_CONFIG: 'system:config',
  /** 系統監控 */
  SYSTEM_MONITOR: 'system:monitor',

  // ===========================================
  // Audit Operations（審計操作）
  // ===========================================
  /** 查看審計日誌 */
  AUDIT_VIEW: 'audit:view',
  /** 導出審計日誌 */
  AUDIT_EXPORT: 'audit:export',
} as const

/**
 * 權限類型
 * 從 PERMISSIONS 常量中提取所有權限值的聯合類型
 */
export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS]

/**
 * 權限值陣列（用於驗證）
 */
const ALL_PERMISSIONS = Object.values(PERMISSIONS)

/**
 * 類型守衛：檢查字串是否為有效權限
 * @param value - 要檢查的字串
 * @returns 是否為有效權限
 */
export function isValidPermission(value: string): value is Permission {
  return ALL_PERMISSIONS.includes(value as Permission)
}

/**
 * 獲取所有權限列表
 * @returns 所有權限的陣列
 */
export function getAllPermissions(): Permission[] {
  return [...ALL_PERMISSIONS]
}

/**
 * 權限分組（用於 UI 顯示）
 */
export const PERMISSION_GROUPS = {
  invoice: {
    label: '發票操作',
    permissions: [
      PERMISSIONS.INVOICE_VIEW,
      PERMISSIONS.INVOICE_CREATE,
      PERMISSIONS.INVOICE_REVIEW,
      PERMISSIONS.INVOICE_APPROVE,
    ],
  },
  report: {
    label: '報表操作',
    permissions: [PERMISSIONS.REPORT_VIEW, PERMISSIONS.REPORT_EXPORT],
  },
  rule: {
    label: '規則管理',
    permissions: [
      PERMISSIONS.RULE_VIEW,
      PERMISSIONS.RULE_MANAGE,
      PERMISSIONS.RULE_APPROVE,
    ],
  },
  forwarder: {
    label: 'Forwarder 管理',
    permissions: [PERMISSIONS.FORWARDER_VIEW, PERMISSIONS.FORWARDER_MANAGE],
  },
  user: {
    label: '用戶管理',
    permissions: [
      PERMISSIONS.USER_VIEW,
      PERMISSIONS.USER_MANAGE,
      PERMISSIONS.USER_MANAGE_CITY,
      PERMISSIONS.USER_MANAGE_REGION,
    ],
  },
  system: {
    label: '系統管理',
    permissions: [PERMISSIONS.SYSTEM_CONFIG, PERMISSIONS.SYSTEM_MONITOR],
  },
  audit: {
    label: '審計操作',
    permissions: [PERMISSIONS.AUDIT_VIEW, PERMISSIONS.AUDIT_EXPORT],
  },
} as const
