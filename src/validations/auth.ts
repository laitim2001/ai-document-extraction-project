/**
 * @fileoverview 認證相關驗證 Schema
 * @description
 *   提供用戶認證相關的 Zod 驗證 Schema，包含：
 *   - 註冊表單驗證
 *   - 登入表單驗證
 *   - 密碼重設驗證
 *
 * @module src/validations/auth
 * @author Development Team
 * @since Epic 18 - Story 18.1
 * @lastModified 2026-01-19
 *
 * @dependencies
 *   - zod - Schema 驗證庫
 *   - @/lib/password - 密碼要求常數
 */

import { z } from 'zod'
import { PASSWORD_REQUIREMENTS } from '@/lib/password'

/**
 * 註冊請求 Schema
 *
 * @description
 *   驗證用戶註冊表單的輸入資料，包含：
 *   - 姓名: 2-100 字元
 *   - 電子郵件: 有效格式
 *   - 密碼: 符合強度要求
 *   - 確認密碼: 與密碼一致
 */
export const registerSchema = z
  .object({
    name: z
      .string()
      .min(2, 'Name must be at least 2 characters')
      .max(100, 'Name must be less than 100 characters')
      .trim(),
    email: z
      .string()
      .email('Please enter a valid email address')
      .max(255, 'Email must be less than 255 characters')
      .toLowerCase()
      .trim(),
    password: z
      .string()
      .min(
        PASSWORD_REQUIREMENTS.minLength,
        `Password must be at least ${PASSWORD_REQUIREMENTS.minLength} characters`
      )
      .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
      .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
      .regex(/[0-9]/, 'Password must contain at least one number'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })

/**
 * 註冊輸入類型
 */
export type RegisterInput = z.infer<typeof registerSchema>

/**
 * 登入請求 Schema
 *
 * @description
 *   驗證用戶登入表單的輸入資料。
 */
export const loginSchema = z.object({
  email: z
    .string()
    .email('Please enter a valid email address')
    .toLowerCase()
    .trim(),
  password: z.string().min(1, 'Password is required'),
})

/**
 * 登入輸入類型
 */
export type LoginInput = z.infer<typeof loginSchema>

/**
 * 密碼重設請求 Schema（發送重設郵件）
 *
 * @description
 *   用於 Story 18-3 密碼重設功能。
 */
export const forgotPasswordSchema = z.object({
  email: z
    .string()
    .email('Please enter a valid email address')
    .toLowerCase()
    .trim(),
})

/**
 * 密碼重設請求類型
 */
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>

/**
 * 重設密碼 Schema（設定新密碼）
 *
 * @description
 *   用於 Story 18-3 密碼重設功能。
 */
export const resetPasswordSchema = z
  .object({
    token: z.string().min(1, 'Reset token is required'),
    password: z
      .string()
      .min(
        PASSWORD_REQUIREMENTS.minLength,
        `Password must be at least ${PASSWORD_REQUIREMENTS.minLength} characters`
      )
      .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
      .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
      .regex(/[0-9]/, 'Password must contain at least one number'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })

/**
 * 重設密碼輸入類型
 */
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>

/**
 * 郵件驗證 Schema
 *
 * @description
 *   用於 Story 18-4 郵件驗證功能。
 */
export const verifyEmailSchema = z.object({
  token: z.string().min(1, 'Verification token is required'),
})

/**
 * 郵件驗證輸入類型
 */
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>
