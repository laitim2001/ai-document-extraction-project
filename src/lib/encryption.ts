/**
 * @fileoverview AES-256-GCM 加密工具
 * @description
 *   提供安全的加密和解密功能，用於保護敏感資料：
 *   - AES-256-GCM 對稱加密
 *   - scrypt 金鑰派生
 *   - 安全的 IV 和 Salt 生成
 *
 * @module src/lib/encryption
 * @since Epic 10 - Story 10.2 (Webhook Configuration Management)
 * @lastModified 2025-12-20
 *
 * @features
 *   - AES-256-GCM 加密/解密
 *   - scrypt 金鑰派生
 *   - 自動 IV 和 Salt 管理
 *   - 令牌遮蔽顯示
 *
 * @dependencies
 *   - crypto - Node.js 內建加密模組
 *
 * @security
 *   - 使用 AES-256-GCM 提供認證加密
 *   - 每次加密使用隨機 IV 確保安全性
 *   - 使用 scrypt 派生金鑰增加破解難度
 */

import crypto from 'crypto';

// ============================================================
// Constants
// ============================================================

/** 加密算法 */
const ALGORITHM = 'aes-256-gcm';

/** IV 長度（位元組）- GCM 建議使用 12 bytes */
const IV_LENGTH = 12;

/** Salt 長度（位元組） */
const SALT_LENGTH = 16;

/** 認證標籤長度（位元組） */
const AUTH_TAG_LENGTH = 16;

/** scrypt 參數 - N（CPU/記憶體成本） */
const SCRYPT_N = 16384;

/** scrypt 參數 - r（區塊大小） */
const SCRYPT_R = 8;

/** scrypt 參數 - p（並行度） */
const SCRYPT_P = 1;

/** 派生金鑰長度（位元組） */
const KEY_LENGTH = 32;

// ============================================================
// Types
// ============================================================

/**
 * 加密結果介面
 */
interface EncryptionResult {
  /** Base64 編碼的加密資料（包含 salt + iv + authTag + ciphertext） */
  encrypted: string;
  /** 是否成功 */
  success: boolean;
}

/**
 * 解密結果介面
 */
interface DecryptionResult {
  /** 解密後的明文 */
  decrypted: string;
  /** 是否成功 */
  success: boolean;
}

// ============================================================
// Key Derivation
// ============================================================

/**
 * 從主金鑰派生加密金鑰
 *
 * @description
 *   使用 scrypt 算法從環境變數中的主金鑰派生出實際的加密金鑰。
 *   scrypt 是記憶體密集型算法，可有效抵禦暴力攻擊。
 *
 * @param masterKey - 主金鑰（通常來自環境變數）
 * @param salt - 鹽值（每次加密隨機生成）
 * @returns 派生的 32 位元組金鑰
 */
function deriveKey(masterKey: string, salt: Buffer): Buffer {
  return crypto.scryptSync(masterKey, salt, KEY_LENGTH, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
  });
}

/**
 * 獲取主金鑰
 *
 * @description
 *   從環境變數獲取主加密金鑰。
 *   如果未設定，會拋出錯誤以防止使用不安全的預設值。
 *
 * @returns 主金鑰字串
 * @throws 如果環境變數未設定
 */
function getMasterKey(): string {
  const key = process.env.ENCRYPTION_MASTER_KEY;

  if (!key) {
    throw new Error(
      'ENCRYPTION_MASTER_KEY environment variable is not set. ' +
        'Please set a secure encryption key in your environment.'
    );
  }

  // 驗證金鑰長度（至少 32 字元以確保安全性）
  if (key.length < 32) {
    throw new Error(
      'ENCRYPTION_MASTER_KEY must be at least 32 characters long for adequate security.'
    );
  }

  return key;
}

// ============================================================
// Encryption Functions
// ============================================================

/**
 * 加密明文
 *
 * @description
 *   使用 AES-256-GCM 加密明文。輸出格式：
 *   Base64(salt[16] + iv[12] + authTag[16] + ciphertext[...])
 *
 * @param plaintext - 要加密的明文
 * @returns 加密結果，包含 Base64 編碼的加密資料
 *
 * @example
 * ```typescript
 * const result = encrypt('my-secret-token');
 * if (result.success) {
 *   console.log('Encrypted:', result.encrypted);
 * }
 * ```
 */
export function encrypt(plaintext: string): EncryptionResult {
  try {
    const masterKey = getMasterKey();

    // 生成隨機 salt 和 IV
    const salt = crypto.randomBytes(SALT_LENGTH);
    const iv = crypto.randomBytes(IV_LENGTH);

    // 派生加密金鑰
    const key = deriveKey(masterKey, salt);

    // 創建加密器
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv, {
      authTagLength: AUTH_TAG_LENGTH,
    });

    // 加密資料
    const encrypted = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);

    // 獲取認證標籤
    const authTag = cipher.getAuthTag();

    // 組合結果：salt + iv + authTag + ciphertext
    const combined = Buffer.concat([salt, iv, authTag, encrypted]);

    return {
      encrypted: combined.toString('base64'),
      success: true,
    };
  } catch (error) {
    console.error('Encryption failed:', error);
    return {
      encrypted: '',
      success: false,
    };
  }
}

/**
 * 解密密文
 *
 * @description
 *   解密由 encrypt 函數產生的密文。
 *   會驗證認證標籤以確保資料完整性。
 *
 * @param ciphertext - Base64 編碼的加密資料
 * @returns 解密結果，包含解密後的明文
 *
 * @example
 * ```typescript
 * const result = decrypt(encryptedData);
 * if (result.success) {
 *   console.log('Decrypted:', result.decrypted);
 * }
 * ```
 */
export function decrypt(ciphertext: string): DecryptionResult {
  try {
    const masterKey = getMasterKey();

    // 解碼 Base64
    const combined = Buffer.from(ciphertext, 'base64');

    // 驗證最小長度
    const minLength = SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH;
    if (combined.length < minLength) {
      throw new Error('Invalid ciphertext: too short');
    }

    // 提取各部分
    let offset = 0;

    const salt = combined.subarray(offset, offset + SALT_LENGTH);
    offset += SALT_LENGTH;

    const iv = combined.subarray(offset, offset + IV_LENGTH);
    offset += IV_LENGTH;

    const authTag = combined.subarray(offset, offset + AUTH_TAG_LENGTH);
    offset += AUTH_TAG_LENGTH;

    const encrypted = combined.subarray(offset);

    // 派生解密金鑰
    const key = deriveKey(masterKey, salt);

    // 創建解密器
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, {
      authTagLength: AUTH_TAG_LENGTH,
    });

    // 設置認證標籤
    decipher.setAuthTag(authTag);

    // 解密資料
    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]);

    return {
      decrypted: decrypted.toString('utf8'),
      success: true,
    };
  } catch (error) {
    console.error('Decryption failed:', error);
    return {
      decrypted: '',
      success: false,
    };
  }
}

// ============================================================
// Utility Functions
// ============================================================

/**
 * 遮蔽令牌用於顯示
 *
 * @description
 *   將令牌遮蔽，只顯示前後各若干字元，
 *   中間以星號替代，用於安全的日誌記錄或 UI 顯示。
 *
 * @param token - 要遮蔽的令牌
 * @param visibleChars - 前後顯示的字元數（預設 4）
 * @returns 遮蔽後的令牌
 *
 * @example
 * ```typescript
 * maskToken('abcdefghijklmnop')
 * // 'abcd********mnop'
 * ```
 */
export function maskToken(token: string, visibleChars: number = 4): string {
  if (token.length <= visibleChars * 2) {
    return '*'.repeat(token.length);
  }

  const prefix = token.substring(0, visibleChars);
  const suffix = token.substring(token.length - visibleChars);
  const maskedLength = token.length - visibleChars * 2;

  return `${prefix}${'*'.repeat(Math.min(maskedLength, 8))}${suffix}`;
}

/**
 * 驗證加密資料格式
 *
 * @description
 *   檢查字串是否為有效的加密資料格式。
 *   用於在解密前進行快速驗證。
 *
 * @param data - 要驗證的資料
 * @returns 是否為有效的加密資料格式
 *
 * @example
 * ```typescript
 * if (isValidEncryptedFormat(data)) {
 *   const result = decrypt(data);
 * }
 * ```
 */
export function isValidEncryptedFormat(data: string): boolean {
  if (!data || typeof data !== 'string') {
    return false;
  }

  try {
    // 嘗試解碼 Base64
    const decoded = Buffer.from(data, 'base64');

    // 驗證最小長度
    const minLength = SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH + 1;
    return decoded.length >= minLength;
  } catch {
    return false;
  }
}

/**
 * 生成安全的隨機令牌
 *
 * @description
 *   生成加密安全的隨機令牌，可用於 API 金鑰、
 *   認證令牌等場景。
 *
 * @param length - 令牌長度（位元組，最終為 hex 編碼所以字元數為 2 倍）
 * @returns 隨機令牌（hex 編碼）
 *
 * @example
 * ```typescript
 * const token = generateSecureToken(32);
 * // 'a1b2c3d4e5f6...' (64 characters)
 * ```
 */
export function generateSecureToken(length: number = 32): string {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * 安全比較兩個字串
 *
 * @description
 *   使用固定時間比較演算法比較兩個字串，
 *   防止計時攻擊。
 *
 * @param a - 第一個字串
 * @param b - 第二個字串
 * @returns 兩個字串是否相等
 *
 * @example
 * ```typescript
 * if (secureCompare(providedToken, storedToken)) {
 *   // 驗證通過
 * }
 * ```
 */
export function secureCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);

  if (bufA.length !== bufB.length) {
    return false;
  }

  return crypto.timingSafeEqual(bufA, bufB);
}
