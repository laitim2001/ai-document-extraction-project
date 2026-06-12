/**
 * @fileoverview ReDoS-safe 正則表達式執行工具（RE2 線性時間引擎）
 * @description
 *   統一封裝「對使用者提供的正則表達式安全執行」的入口，取代各處直接
 *   `new RegExp(userPattern)` 對任意大小文本執行所造成的 ReDoS（Regular
 *   Expression Denial of Service）風險。
 *
 *   防護機制（FIX-069，方案 B）：
 *   1. pattern 限長（`MAX_REGEX_PATTERN_LENGTH`）— 第一道輕量閘。
 *   2. flags 白名單（gimsuy）— 拒絕未知 flag。
 *   3. 改用 RE2 引擎（`re2-wasm`）執行 — 線性時間、無 catastrophic
 *      backtracking，從根本消除 ReDoS（原生 V8 RegExp 為同步不可中斷，
 *      `try/catch` 無法中止已陷入 backtracking 的執行）。
 *   4. RE2 不支援的語法（backreference `\1`、lookahead `(?=)` 等）或
 *      Unicode 模式不相容的 pattern → 建構時 throw，統一轉為
 *      `SafeRegexError`，由呼叫端回應使用者「pattern 不被支援」而非 crash。
 *
 *   ⚠️ RE2 僅在 Unicode 模式運作，本工具強制附加 `u` flag。少數在非 Unicode
 *   模式合法、但 Unicode 模式非法的 pattern 會被拒絕（屬 RE2 固有特性）。
 *
 * @module src/lib/safe-regex
 * @author Development Team
 * @since FIX-069 (ReDoS — 安全 regex 執行工具)
 * @lastModified 2026-06-11
 *
 * @dependencies
 *   - re2-wasm - Google RE2 的 WebAssembly 綁定（線性時間 regex 引擎）
 */

import { RE2 } from 're2-wasm'

/**
 * 使用者正則表達式 pattern 的最大長度。
 * 超過即拒絕，作為防護的第一道輕量閘。
 */
export const MAX_REGEX_PATTERN_LENGTH = 1000

/** 允許的 regex flags（RE2 支援的子集：global / ignoreCase / multiline / dotAll / unicode / sticky）。 */
const ALLOWED_FLAGS = new Set(['g', 'i', 'm', 's', 'u', 'y'])

/** SafeRegexError 錯誤代碼。 */
export type SafeRegexErrorCode =
  | 'EMPTY_PATTERN'
  | 'PATTERN_TOO_LONG'
  | 'INVALID_FLAGS'
  | 'UNSUPPORTED_PATTERN'

/**
 * 安全 regex 執行錯誤。
 * 呼叫端可依 `code` 對應回應（建議 400 / 422 + RFC 7807）。
 */
export class SafeRegexError extends Error {
  constructor(
    message: string,
    public code: SafeRegexErrorCode
  ) {
    super(message)
    this.name = 'SafeRegexError'
  }
}

/**
 * 正規化並驗證 flags：拒絕白名單外的 flag，並強制附加 RE2 必需的 `u`（Unicode）flag。
 * @throws SafeRegexError 當含有不支援的 flag（INVALID_FLAGS）
 */
function normalizeFlags(flags?: string): string {
  const set = new Set<string>()
  for (const flag of flags ?? '') {
    if (!ALLOWED_FLAGS.has(flag)) {
      throw new SafeRegexError(`Unsupported regex flag: ${flag}`, 'INVALID_FLAGS')
    }
    set.add(flag)
  }
  // RE2 僅在 Unicode 模式運作，強制附加 u flag。
  set.add('u')
  return Array.from(set).join('')
}

/**
 * 建立 ReDoS-safe 的 RE2 正則實例（線性時間、無 catastrophic backtracking）。
 *
 * 回傳的 `RE2` 物件可作為原生 `RegExp` 的 drop-in 替代，支援 `.exec()`、
 * `.test()`，並可被 `String.prototype.match()` 等透過 well-known symbol 使用。
 *
 * @param expression 使用者提供的正則表達式字串
 * @param flags 正則 flags（會經白名單過濾並強制附加 `u`）
 * @returns RE2 正則實例
 * @throws SafeRegexError pattern 為空 / 過長 / flags 非法 / RE2 不支援的語法
 */
export function createSafeRegex(expression: string, flags?: string): RE2 {
  if (typeof expression !== 'string' || expression.length === 0) {
    throw new SafeRegexError('Regular expression is empty', 'EMPTY_PATTERN')
  }
  if (expression.length > MAX_REGEX_PATTERN_LENGTH) {
    throw new SafeRegexError(
      `Regular expression exceeds maximum length of ${MAX_REGEX_PATTERN_LENGTH} characters`,
      'PATTERN_TOO_LONG'
    )
  }

  const normalizedFlags = normalizeFlags(flags)

  try {
    return new RE2(expression, normalizedFlags)
  } catch (error) {
    // RE2 對 backreference / lookahead / Unicode 不相容語法會 throw SyntaxError。
    throw new SafeRegexError(
      `Pattern not supported by the safe regex engine: ${
        error instanceof Error ? error.message : String(error)
      }`,
      'UNSUPPORTED_PATTERN'
    )
  }
}

/**
 * 驗證使用者 regex 的語法 / 長度 / flags 是否可被安全引擎接受（不執行匹配）。
 *
 * 供前端提交前驗證或後端 schema refine 使用。
 *
 * @param expression 正則表達式字串
 * @param flags 正則 flags
 * @returns `{ valid: true }` 或 `{ valid: false, code, message }`
 */
export function validateSafeRegex(
  expression: string,
  flags?: string
): { valid: true } | { valid: false; code: SafeRegexErrorCode; message: string } {
  try {
    createSafeRegex(expression, flags)
    return { valid: true }
  } catch (error) {
    if (error instanceof SafeRegexError) {
      return { valid: false, code: error.code, message: error.message }
    }
    return {
      valid: false,
      code: 'UNSUPPORTED_PATTERN',
      message: error instanceof Error ? error.message : String(error),
    }
  }
}
