/**
 * @fileoverview 加密服務 - 敏感資料加密/解密
 * @description
 *   提供 AES-256-CBC 加密/解密功能，用於保護敏感資料，
 *   例如 SharePoint Client Secret 等認證資訊。
 *
 *   ## 安全設計
 *   - 使用 AES-256-CBC 對稱加密
 *   - 每次加密使用隨機 IV（初始化向量）
 *   - 加密結果格式: `iv:ciphertext`（皆為 hex 編碼）
 *   - 加密金鑰從環境變數讀取，不硬編碼
 *
 *   ## 使用場景
 *   - SharePoint Client Secret 儲存加密
 *   - API Key 相關敏感資料加密
 *   - 其他需要可逆加密的場景
 *
 * @module src/services/encryption.service
 * @author Development Team
 * @since Epic 9 - Story 9.1 (SharePoint 文件監控 API)
 * @lastModified 2025-12-20
 *
 * @features
 *   - AES-256-CBC 對稱加密
 *   - 隨機 IV 生成確保相同明文產生不同密文
 *   - 環境變數金鑰管理
 *
 * @dependencies
 *   - crypto - Node.js 內建加密模組
 *
 * @related
 *   - src/services/sharepoint-document.service.ts - 使用此服務解密 Client Secret
 *   - prisma/schema.prisma - SharePointConfig.clientSecret 欄位
 *
 * @example
 *   const encryptionService = new EncryptionService();
 *   const encrypted = encryptionService.encrypt('my-secret');
 *   const decrypted = encryptionService.decrypt(encrypted);
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

// ============================================================
// Types
// ============================================================

/**
 * 加密服務配置
 */
export interface EncryptionServiceConfig {
  /** 加密金鑰（32 bytes hex 字串，可選，預設從環境變數讀取） */
  encryptionKey?: string;
}

// ============================================================
// Constants
// ============================================================

/** 加密演算法 */
const ALGORITHM = 'aes-256-cbc';

/** 加密金鑰長度（bytes） */
const KEY_LENGTH = 32;

/** IV 長度（bytes） */
const IV_LENGTH = 16;

// ============================================================
// Error Class
// ============================================================

/**
 * 加密服務錯誤
 */
export class EncryptionError extends Error {
  constructor(
    message: string,
    public code: 'MISSING_KEY' | 'INVALID_KEY' | 'INVALID_FORMAT' | 'DECRYPTION_FAILED'
  ) {
    super(message);
    this.name = 'EncryptionError';
  }
}

// ============================================================
// Service
// ============================================================

/**
 * 加密服務
 *
 * @description
 *   使用 AES-256-CBC 演算法加密/解密敏感資料。
 *   加密金鑰從環境變數 ENCRYPTION_KEY 讀取。
 *
 * @example
 *   const service = new EncryptionService();
 *   const encrypted = service.encrypt('secret-value');
 *   console.log(encrypted); // 格式: iv:ciphertext (hex)
 *   const decrypted = service.decrypt(encrypted);
 *   console.log(decrypted); // 'secret-value'
 */
export class EncryptionService {
  private readonly algorithm = ALGORITHM;
  private readonly key: Buffer;

  /**
   * 建立加密服務實例
   *
   * @param config - 服務配置（可選）
   * @throws {EncryptionError} 當加密金鑰未設定或格式不正確時
   */
  constructor(config?: EncryptionServiceConfig) {
    const keyHex = config?.encryptionKey ?? process.env.ENCRYPTION_KEY;

    if (!keyHex) {
      throw new EncryptionError(
        'ENCRYPTION_KEY environment variable is required',
        'MISSING_KEY'
      );
    }

    this.key = Buffer.from(keyHex, 'hex');

    if (this.key.length !== KEY_LENGTH) {
      throw new EncryptionError(
        `ENCRYPTION_KEY must be ${KEY_LENGTH} bytes (${KEY_LENGTH * 2} hex characters), got ${this.key.length} bytes`,
        'INVALID_KEY'
      );
    }
  }

  /**
   * 加密字串
   *
   * @description
   *   使用 AES-256-CBC 加密明文，每次呼叫會使用隨機 IV，
   *   確保相同明文會產生不同密文。
   *
   * @param plaintext - 要加密的明文字串
   * @returns 加密結果，格式: `iv:ciphertext`（皆為 hex 編碼）
   *
   * @example
   *   const encrypted = service.encrypt('my-secret-key');
   *   // 返回: '1a2b3c...（32 字元 IV）:4d5e6f...（密文）'
   */
  encrypt(plaintext: string): string {
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(this.algorithm, this.key, iv);
    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return `${iv.toString('hex')}:${encrypted}`;
  }

  /**
   * 解密字串
   *
   * @description
   *   解密由 encrypt 方法產生的密文。
   *
   * @param ciphertext - 加密結果，格式: `iv:encrypted`（皆為 hex 編碼）
   * @returns 解密後的明文
   * @throws {EncryptionError} 當密文格式不正確或解密失敗時
   *
   * @example
   *   const decrypted = service.decrypt('1a2b3c...:4d5e6f...');
   *   // 返回原始明文
   */
  decrypt(ciphertext: string): string {
    const parts = ciphertext.split(':');

    if (parts.length !== 2) {
      throw new EncryptionError(
        'Invalid ciphertext format: expected "iv:encrypted"',
        'INVALID_FORMAT'
      );
    }

    const [ivHex, encrypted] = parts;

    if (!ivHex || !encrypted) {
      throw new EncryptionError(
        'Invalid ciphertext format: IV or encrypted data is empty',
        'INVALID_FORMAT'
      );
    }

    try {
      const iv = Buffer.from(ivHex, 'hex');

      if (iv.length !== IV_LENGTH) {
        throw new EncryptionError(
          `Invalid IV length: expected ${IV_LENGTH} bytes, got ${iv.length} bytes`,
          'INVALID_FORMAT'
        );
      }

      const decipher = createDecipheriv(this.algorithm, this.key, iv);
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch (error) {
      if (error instanceof EncryptionError) {
        throw error;
      }
      throw new EncryptionError(
        `Decryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'DECRYPTION_FAILED'
      );
    }
  }

  /**
   * 驗證加密金鑰格式
   *
   * @description
   *   靜態方法，用於在配置時驗證金鑰格式是否正確。
   *
   * @param keyHex - 要驗證的金鑰（hex 編碼）
   * @returns 驗證結果
   */
  static validateKey(keyHex: string): { valid: boolean; error?: string } {
    if (!keyHex) {
      return { valid: false, error: 'Key is required' };
    }

    try {
      const key = Buffer.from(keyHex, 'hex');

      if (key.length !== KEY_LENGTH) {
        return {
          valid: false,
          error: `Key must be ${KEY_LENGTH} bytes (${KEY_LENGTH * 2} hex characters), got ${key.length} bytes`,
        };
      }

      return { valid: true };
    } catch {
      return { valid: false, error: 'Invalid hex string' };
    }
  }

  /**
   * 生成新的加密金鑰
   *
   * @description
   *   生成一個隨機的 256 位元加密金鑰，可用於設定 ENCRYPTION_KEY 環境變數。
   *
   * @returns 隨機生成的金鑰（hex 編碼）
   *
   * @example
   *   const newKey = EncryptionService.generateKey();
   *   console.log(`ENCRYPTION_KEY=${newKey}`);
   */
  static generateKey(): string {
    return randomBytes(KEY_LENGTH).toString('hex');
  }
}
