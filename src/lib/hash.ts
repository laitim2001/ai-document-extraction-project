/**
 * @fileoverview Pattern Hash 生成工具
 * @description
 *   提供模式 Hash 生成功能，用於識別和去重相同的修正模式：
 *   - SHA256 Hash 生成
 *   - 值正規化
 *   - 代表性模式提取
 *
 * @module src/lib/hash
 * @since Epic 4 - Story 4.3
 * @lastModified 2025-12-19
 *
 * @features
 *   - 模式 Hash 生成（用於去重）
 *   - 值正規化處理
 *   - 代表性模式提取
 */

import crypto from 'crypto';

// ============================================================
// Hash 生成
// ============================================================

/**
 * 生成模式 Hash
 *
 * @description
 *   使用 SHA256 算法生成模式的唯一標識符
 *   用於識別相同的修正模式，實現去重
 *   Hash 輸入包含：forwarderId + fieldName + 正規化的模式值
 *
 * @param forwarderId - Forwarder ID
 * @param fieldName - 欄位名稱
 * @param patterns - 模式值陣列（原始值和修正值）
 * @returns 16 字元的 Hash 字串
 *
 * @example
 * ```typescript
 * generatePatternHash('fwd-1', 'amount', [
 *   { originalValue: '100', correctedValue: '1000' }
 * ])
 * // 'a1b2c3d4e5f6g7h8'
 * ```
 */
export function generatePatternHash(
  forwarderId: string,
  fieldName: string,
  patterns: Array<{ originalValue: string; correctedValue: string }>
): string {
  // 正規化並排序模式
  const normalizedPatterns = patterns
    .map((p) => `${normalizeValue(p.originalValue)}→${normalizeValue(p.correctedValue)}`)
    .sort()
    .join('|');

  // 組合並生成 Hash
  const input = [forwarderId, fieldName, normalizedPatterns].join('::');

  return crypto.createHash('sha256').update(input).digest('hex').substring(0, 16);
}

/**
 * 生成簡單模式 Hash（單一原始值-修正值對）
 *
 * @param forwarderId - Forwarder ID
 * @param fieldName - 欄位名稱
 * @param originalPattern - 原始值模式
 * @param correctedPattern - 修正值模式
 * @returns 16 字元的 Hash 字串
 */
export function generateSimplePatternHash(
  forwarderId: string,
  fieldName: string,
  originalPattern: string,
  correctedPattern: string
): string {
  return generatePatternHash(forwarderId, fieldName, [
    { originalValue: originalPattern, correctedValue: correctedPattern },
  ]);
}

// ============================================================
// 值正規化
// ============================================================

/**
 * 正規化值
 *
 * @description
 *   移除多餘空白、轉小寫，用於 Hash 計算
 *   確保相似的值生成相同的 Hash
 *
 * @param value - 原始值
 * @returns 正規化後的值
 */
export function normalizeValue(value: string | null | undefined): string {
  if (!value) return '';

  return value
    .toLowerCase()
    .replace(/\s+/g, ' ') // 多個空白合併為一個
    .trim();
}

/**
 * 正規化用於比較的值
 *
 * @description
 *   更嚴格的正規化，用於相似度比較
 *   移除所有非字母數字字元
 *
 * @param value - 原始值
 * @returns 正規化後的值
 */
export function normalizeForComparison(value: string | null | undefined): string {
  if (!value) return '';

  return value
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]/g, '') // 保留字母、數字、中文
    .trim();
}

// ============================================================
// 代表性模式提取
// ============================================================

/**
 * 從一組值中提取代表性模式
 *
 * @description
 *   分析一組相似值，找出最具代表性的值
 *   用於模式記錄的顯示和規則建議
 *
 * @param values - 值陣列
 * @returns 最具代表性的值
 *
 * @example
 * ```typescript
 * extractRepresentativePattern(['Hello', 'hello', 'HELLO', 'Hello'])
 * // 'Hello' (出現最多次的原始形式)
 * ```
 */
export function extractRepresentativePattern(values: string[]): string {
  if (values.length === 0) return '';
  if (values.length === 1) return values[0];

  // 計算每個正規化值的出現頻率
  const frequency = new Map<string, { count: number; original: string }>();

  for (const value of values) {
    const normalized = normalizeValue(value);
    const existing = frequency.get(normalized);

    if (existing) {
      existing.count++;
    } else {
      frequency.set(normalized, { count: 1, original: value });
    }
  }

  // 找出最常見的值
  let maxCount = 0;
  let representative = values[0];

  for (const [, data] of frequency) {
    if (data.count > maxCount) {
      maxCount = data.count;
      representative = data.original;
    }
  }

  return representative;
}

/**
 * 從修正配對中提取代表性模式
 *
 * @param pairs - 修正配對陣列
 * @returns 代表性的原始值和修正值
 */
export function extractRepresentativePair(
  pairs: Array<{ originalValue: string | null; correctedValue: string }>
): { originalPattern: string; correctedPattern: string } {
  const originals = pairs.map((p) => p.originalValue || '').filter((v) => v !== '');
  const corrected = pairs.map((p) => p.correctedValue).filter((v) => v !== '');

  return {
    originalPattern: extractRepresentativePattern(originals),
    correctedPattern: extractRepresentativePattern(corrected),
  };
}

// ============================================================
// 工具函數
// ============================================================

/**
 * 檢查兩個 Hash 是否相同
 *
 * @param hash1 - 第一個 Hash
 * @param hash2 - 第二個 Hash
 * @returns 是否相同
 */
export function isHashEqual(hash1: string, hash2: string): boolean {
  return hash1.toLowerCase() === hash2.toLowerCase();
}

/**
 * 生成隨機 Hash（用於測試）
 *
 * @param length - Hash 長度
 * @returns 隨機 Hash 字串
 */
export function generateRandomHash(length: number = 16): string {
  return crypto.randomBytes(Math.ceil(length / 2)).toString('hex').substring(0, length);
}
