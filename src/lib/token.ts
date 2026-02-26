/**
 * @fileoverview Token 產生工具
 * @description
 *   提供安全的 Token 產生功能，用於：
 *   - 郵件驗證 Token
 *   - 密碼重設 Token
 *   - 其他需要安全隨機 Token 的場景
 *
 * @module src/lib/token
 * @author Development Team
 * @since Epic 18 - Story 18.1
 * @lastModified 2026-01-19
 *
 * @dependencies
 *   - crypto (Node.js 內建模組)
 */

import { randomBytes } from 'crypto'

/**
 * 產生安全的隨機 Token
 *
 * @description
 *   使用 crypto.randomBytes 產生加密安全的隨機 Token。
 *   輸出為十六進制字串，長度為參數的兩倍（例如 32 bytes → 64 字元）。
 *
 * @param length - Token 長度（位元組數），預設 32
 * @returns 十六進制格式的 Token 字串
 *
 * @example
 * ```typescript
 * const token = generateToken(32); // 產生 64 字元的 Token
 * ```
 */
export function generateToken(length: number = 32): string {
  return randomBytes(length).toString('hex')
}

/**
 * 產生 URL 安全的 Token
 *
 * @description
 *   產生適合放在 URL 中的 Token（Base64 URL Safe 編碼）。
 *   移除 +, /, = 等可能在 URL 中造成問題的字元。
 *
 * @param length - Token 長度（位元組數），預設 32
 * @returns URL 安全的 Token 字串
 *
 * @example
 * ```typescript
 * const urlSafeToken = generateUrlSafeToken(32);
 * const verifyUrl = `https://example.com/verify?token=${urlSafeToken}`;
 * ```
 */
export function generateUrlSafeToken(length: number = 32): string {
  return randomBytes(length)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')
}

/**
 * 計算 Token 過期時間
 *
 * @description
 *   根據指定的小時數計算過期時間戳。
 *
 * @param hours - 有效時間（小時）
 * @returns 過期時間的 Date 物件
 *
 * @example
 * ```typescript
 * const expiry = getTokenExpiry(24); // 24 小時後過期
 * ```
 */
export function getTokenExpiry(hours: number): Date {
  return new Date(Date.now() + hours * 60 * 60 * 1000)
}

/**
 * 檢查 Token 是否已過期
 *
 * @param expiresAt - 過期時間
 * @returns 是否已過期
 *
 * @example
 * ```typescript
 * if (isTokenExpired(user.emailVerificationExpires)) {
 *   // Token 已過期，需要重新發送
 * }
 * ```
 */
export function isTokenExpired(expiresAt: Date | null | undefined): boolean {
  if (!expiresAt) return true
  return new Date() > new Date(expiresAt)
}
