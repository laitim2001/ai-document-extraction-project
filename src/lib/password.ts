/**
 * @fileoverview 密碼工具函數
 * @description
 *   提供密碼相關的安全操作，包含：
 *   - 密碼強度驗證
 *   - bcrypt 加密和比對
 *   - 密碼要求配置
 *
 * @module src/lib/password
 * @author Development Team
 * @since Epic 18 - Story 18.1
 * @lastModified 2026-01-19
 *
 * @dependencies
 *   - bcryptjs - 密碼加密庫
 */

import bcrypt from 'bcryptjs'

// 從環境變數讀取 salt rounds，預設 12
const SALT_ROUNDS = parseInt(process.env.BCRYPT_SALT_ROUNDS || '12', 10)

/**
 * 密碼強度驗證結果
 */
export interface PasswordStrengthResult {
  /** 是否通過所有驗證 */
  isValid: boolean
  /** 密碼強度分數 (0-4) */
  score: number
  /** 驗證錯誤訊息列表 */
  errors: string[]
  /** 改進建議 */
  suggestions: string[]
}

/**
 * 密碼要求配置
 */
export const PASSWORD_REQUIREMENTS = {
  /** 最小長度 */
  minLength: 8,
  /** 是否要求大寫字母 */
  requireUppercase: true,
  /** 是否要求小寫字母 */
  requireLowercase: true,
  /** 是否要求數字 */
  requireNumber: true,
  /** 是否要求特殊字元（可選） */
  requireSpecialChar: false,
} as const

/**
 * 驗證密碼強度
 *
 * @description
 *   根據密碼要求配置驗證密碼強度，返回驗證結果。
 *   密碼必須滿足以下條件：
 *   - 至少 8 個字元
 *   - 包含至少一個小寫字母
 *   - 包含至少一個大寫字母
 *   - 包含至少一個數字
 *
 * @param password - 要驗證的密碼
 * @returns 密碼強度驗證結果
 *
 * @example
 * ```typescript
 * const result = validatePasswordStrength('Password123');
 * if (!result.isValid) {
 *   console.log('密碼不符合要求:', result.errors);
 * }
 * ```
 */
export function validatePasswordStrength(password: string): PasswordStrengthResult {
  const errors: string[] = []
  const suggestions: string[] = []
  let score = 0

  // 長度檢查
  if (password.length < PASSWORD_REQUIREMENTS.minLength) {
    errors.push(`Password must be at least ${PASSWORD_REQUIREMENTS.minLength} characters`)
  } else {
    score++
    if (password.length >= 12) score++
  }

  // 小寫字母檢查
  if (PASSWORD_REQUIREMENTS.requireLowercase && !/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter')
  } else if (/[a-z]/.test(password)) {
    score++
  }

  // 大寫字母檢查
  if (PASSWORD_REQUIREMENTS.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter')
  } else if (/[A-Z]/.test(password)) {
    score++
  }

  // 數字檢查
  if (PASSWORD_REQUIREMENTS.requireNumber && !/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number')
  } else if (/[0-9]/.test(password)) {
    score++
  }

  // 特殊字元檢查（可選）
  if (PASSWORD_REQUIREMENTS.requireSpecialChar && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    errors.push('Password must contain at least one special character')
  }

  // 建議
  if (password.length > 0 && password.length < 12) {
    suggestions.push('Consider using a longer password for better security')
  }
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    suggestions.push('Adding special characters would increase password strength')
  }

  return {
    isValid: errors.length === 0,
    score: Math.min(score, 4),
    errors,
    suggestions,
  }
}

/**
 * 加密密碼
 *
 * @description
 *   使用 bcrypt 對密碼進行加密。
 *   預設使用 12 rounds 的 salt，可透過環境變數 BCRYPT_SALT_ROUNDS 調整。
 *
 * @param password - 明文密碼
 * @returns 加密後的密碼 hash
 *
 * @example
 * ```typescript
 * const hashedPassword = await hashPassword('myPassword123');
 * // 存儲到資料庫
 * ```
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS)
}

/**
 * 驗證密碼
 *
 * @description
 *   比對明文密碼和加密後的密碼是否匹配。
 *
 * @param password - 明文密碼
 * @param hashedPassword - 加密後的密碼 hash
 * @returns 是否匹配
 *
 * @example
 * ```typescript
 * const isValid = await verifyPassword('myPassword123', hashedPassword);
 * if (isValid) {
 *   // 密碼正確
 * }
 * ```
 */
export async function verifyPassword(
  password: string,
  hashedPassword: string
): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword)
}
