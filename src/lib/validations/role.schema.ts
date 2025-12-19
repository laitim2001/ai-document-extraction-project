/**
 * @fileoverview 角色驗證 Schema
 * @description
 *   使用 Zod 定義角色相關的驗證 Schema。
 *   用於前端表單驗證和後端 API 輸入驗證。
 *
 *   驗證規則：
 *   - Name: 必填、2-50 字元、支援中英文和空格
 *   - Description: 可選、最大 255 字元
 *   - Permissions: 必填、至少選擇一個權限
 *
 * @module src/lib/validations/role.schema
 * @author Development Team
 * @since Epic 1 - Story 1.7 (Custom Role Management)
 * @lastModified 2025-12-18
 *
 * @dependencies
 *   - zod - Schema 驗證庫
 *   - @/types/permissions - 權限常量
 *
 * @related
 *   - src/services/role.service.ts - 角色服務
 *   - src/app/api/admin/roles/route.ts - 角色 API
 *   - src/components/features/admin/roles - 角色管理組件
 */

import { z } from 'zod'
import { getAllPermissions } from '@/types/permissions'

// ============================================================
// Constants
// ============================================================

/** 角色名稱最小長度 */
const ROLE_NAME_MIN_LENGTH = 2

/** 角色名稱最大長度 */
const ROLE_NAME_MAX_LENGTH = 50

/** 角色描述最大長度 */
const ROLE_DESCRIPTION_MAX_LENGTH = 255

// ============================================================
// Helper Functions
// ============================================================

/**
 * 驗證權限代碼是否有效
 */
const validPermissions = getAllPermissions()

// ============================================================
// Create Role Schema
// ============================================================

/**
 * 建立角色 Schema
 *
 * @description
 *   用於驗證新增角色的輸入資料。
 *   支援中英文角色名稱、權限選擇。
 */
export const createRoleSchema = z.object({
  /** 角色名稱（支援中英文） */
  name: z
    .string()
    .min(ROLE_NAME_MIN_LENGTH, `角色名稱至少需要 ${ROLE_NAME_MIN_LENGTH} 個字元`)
    .max(ROLE_NAME_MAX_LENGTH, `角色名稱不能超過 ${ROLE_NAME_MAX_LENGTH} 字元`)
    .regex(
      /^[a-zA-Z\u4e00-\u9fa5\s\-_]+$/,
      '角色名稱只能包含中英文字母、空格、連字符和底線'
    ),

  /** 角色描述（可選） */
  description: z
    .string()
    .max(
      ROLE_DESCRIPTION_MAX_LENGTH,
      `描述不能超過 ${ROLE_DESCRIPTION_MAX_LENGTH} 字元`
    )
    .optional()
    .nullable(),

  /** 權限列表（至少選擇一個） */
  permissions: z
    .array(
      z.string().refine(
        (val) => validPermissions.includes(val as typeof validPermissions[number]),
        { message: '無效的權限代碼' }
      )
    )
    .min(1, '請至少選擇一個權限'),
})

/** 建立角色輸入類型 */
export type CreateRoleInput = z.infer<typeof createRoleSchema>

// ============================================================
// Update Role Schema
// ============================================================

/**
 * 更新角色 Schema
 *
 * @description
 *   用於驗證更新角色的輸入資料。
 *   所有欄位都是可選的，只更新提供的欄位。
 */
export const updateRoleSchema = z.object({
  /** 角色名稱（可選） */
  name: z
    .string()
    .min(ROLE_NAME_MIN_LENGTH, `角色名稱至少需要 ${ROLE_NAME_MIN_LENGTH} 個字元`)
    .max(ROLE_NAME_MAX_LENGTH, `角色名稱不能超過 ${ROLE_NAME_MAX_LENGTH} 字元`)
    .regex(
      /^[a-zA-Z\u4e00-\u9fa5\s\-_]+$/,
      '角色名稱只能包含中英文字母、空格、連字符和底線'
    )
    .optional(),

  /** 角色描述（可選） */
  description: z
    .string()
    .max(
      ROLE_DESCRIPTION_MAX_LENGTH,
      `描述不能超過 ${ROLE_DESCRIPTION_MAX_LENGTH} 字元`
    )
    .optional()
    .nullable(),

  /** 權限列表（可選，但如果提供必須至少有一個） */
  permissions: z
    .array(
      z.string().refine(
        (val) => validPermissions.includes(val as typeof validPermissions[number]),
        { message: '無效的權限代碼' }
      )
    )
    .min(1, '請至少選擇一個權限')
    .optional(),
})

/** 更新角色輸入類型 */
export type UpdateRoleInput = z.infer<typeof updateRoleSchema>

// ============================================================
// Role ID Schema
// ============================================================

/**
 * 角色 ID 參數 Schema
 *
 * @description
 *   用於驗證 URL 參數中的角色 ID。
 */
export const roleIdParamSchema = z.object({
  id: z.string().cuid('無效的角色 ID'),
})

/** 角色 ID 參數類型 */
export type RoleIdParam = z.infer<typeof roleIdParamSchema>

// ============================================================
// Role Name Check Schema
// ============================================================

/**
 * 角色名稱檢查 Schema
 *
 * @description
 *   用於驗證角色名稱是否已存在的查詢。
 */
export const checkRoleNameSchema = z.object({
  /** 角色名稱 */
  name: z
    .string()
    .min(1, '請輸入角色名稱')
    .transform((val) => val.trim()),

  /** 排除的角色 ID（編輯時使用） */
  excludeId: z.string().cuid().optional(),
})

/** 角色名稱檢查輸入類型 */
export type CheckRoleNameInput = z.infer<typeof checkRoleNameSchema>
