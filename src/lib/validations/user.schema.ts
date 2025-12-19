/**
 * @fileoverview 用戶驗證 Schema
 * @description
 *   使用 Zod 定義用戶相關的驗證 Schema。
 *   用於前端表單驗證和後端 API 輸入驗證。
 *
 *   驗證規則：
 *   - Email: 必填、有效格式、最大 255 字元
 *   - Name: 必填、2-100 字元、支援中英文
 *   - RoleIds: 至少選擇一個角色
 *   - CityId: 可選，需為有效 UUID（如果有值）
 *
 * @module src/lib/validations/user.schema
 * @author Development Team
 * @since Epic 1 - Story 1.4 (Add User & Role Assignment)
 * @lastModified 2025-12-18
 *
 * @dependencies
 *   - zod - Schema 驗證庫
 *
 * @related
 *   - src/services/user.service.ts - 用戶服務
 *   - src/app/api/admin/users/route.ts - 用戶 API
 *   - src/components/features/admin/AddUserDialog.tsx - 新增用戶對話框
 */

import { z } from 'zod'

// ============================================================
// Create User Schema
// ============================================================

/**
 * 建立用戶 Schema
 *
 * @description
 *   用於驗證新增用戶的輸入資料。
 *   支援中英文姓名、Azure AD 相容的 Email 格式。
 */
export const createUserSchema = z.object({
  /** 電子郵件（必須與 Azure AD 帳號一致） */
  email: z
    .string()
    .min(1, '請輸入電子郵件')
    .email('請輸入有效的電子郵件格式')
    .max(255, '電子郵件不能超過 255 字元')
    .transform((val) => val.toLowerCase().trim()),

  /** 用戶名稱（支援中英文） */
  name: z
    .string()
    .min(2, '名稱至少需要 2 個字元')
    .max(100, '名稱不能超過 100 字元')
    .regex(
      /^[a-zA-Z\u4e00-\u9fa5\s\-\.]+$/,
      '名稱只能包含中英文字母、空格、連字符和句點'
    ),

  /** 角色 ID 列表（至少選擇一個） */
  roleIds: z
    .array(z.string().cuid('無效的角色 ID'))
    .min(1, '請至少選擇一個角色'),

  /** 城市 ID（可選，City Manager 需要） */
  cityId: z
    .string()
    .cuid('無效的城市 ID')
    .optional()
    .nullable(),
})

/** 建立用戶輸入類型 */
export type CreateUserInput = z.infer<typeof createUserSchema>

// ============================================================
// Update User Schema
// ============================================================

/**
 * 更新用戶 Schema
 *
 * @description
 *   用於驗證更新用戶的輸入資料。
 *   所有欄位都是可選的，只更新提供的欄位。
 */
export const updateUserSchema = z.object({
  /** 用戶名稱（可選） */
  name: z
    .string()
    .min(2, '名稱至少需要 2 個字元')
    .max(100, '名稱不能超過 100 字元')
    .regex(
      /^[a-zA-Z\u4e00-\u9fa5\s\-\.]+$/,
      '名稱只能包含中英文字母、空格、連字符和句點'
    )
    .optional(),

  /** 角色 ID 列表（可選，但如果提供必須至少有一個） */
  roleIds: z
    .array(z.string().cuid('無效的角色 ID'))
    .min(1, '請至少選擇一個角色')
    .optional(),

  /** 城市 ID（可選） */
  cityId: z
    .string()
    .cuid('無效的城市 ID')
    .optional()
    .nullable(),
})

/** 更新用戶輸入類型 */
export type UpdateUserInput = z.infer<typeof updateUserSchema>

// ============================================================
// User Status Schema
// ============================================================

/**
 * 用戶狀態 Schema
 *
 * @description
 *   用於驗證更新用戶狀態的輸入。
 */
export const updateUserStatusSchema = z.object({
  /** 用戶狀態 */
  status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED'], {
    message: '無效的用戶狀態',
  }),
})

/** 更新用戶狀態輸入類型 */
export type UpdateUserStatusInput = z.infer<typeof updateUserStatusSchema>

// ============================================================
// Email Check Schema
// ============================================================

/**
 * 電子郵件檢查 Schema
 *
 * @description
 *   用於驗證電子郵件是否已存在的查詢。
 */
export const checkEmailSchema = z.object({
  email: z
    .string()
    .min(1, '請輸入電子郵件')
    .email('請輸入有效的電子郵件格式')
    .transform((val) => val.toLowerCase().trim()),
})

/** 電子郵件檢查輸入類型 */
export type CheckEmailInput = z.infer<typeof checkEmailSchema>
