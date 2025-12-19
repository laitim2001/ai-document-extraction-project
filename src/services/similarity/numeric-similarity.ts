/**
 * @fileoverview 數值相似度計算算法
 * @description
 *   實現數值欄位的相似度比較：
 *   - 支援多種數值格式解析
 *   - 計算數值相對差異
 *   - 檢測數值轉換模式（乘法、加法）
 *
 * @module src/services/similarity/numeric-similarity
 * @since Epic 4 - Story 4.3
 * @lastModified 2025-12-19
 *
 * @features
 *   - 多格式數值解析（貨幣、千分位等）
 *   - 數值相似度計算
 *   - 轉換模式檢測（匯率、固定調整等）
 */

import type { NumericSimilarityResult, NumericTransformPattern } from '@/types/pattern';

// ============================================================
// 數值解析
// ============================================================

/**
 * 解析數值字串
 *
 * @description
 *   支援多種數值格式的解析：
 *   - 貨幣符號：$1234、€1234、¥1234
 *   - 千分位格式：1,234.56（美式）、1.234,56（歐式）
 *   - 帶單位：1234 USD、1234.56 KG
 *
 * @param value - 數值字串
 * @returns 解析後的數值，無法解析時返回 null
 *
 * @example
 * ```typescript
 * parseNumericValue('$1,234.56')    // 1234.56
 * parseNumericValue('1.234,56 EUR') // 1234.56
 * parseNumericValue('abc')          // null
 * ```
 */
export function parseNumericValue(value: string): number | null {
  if (!value || typeof value !== 'string') return null;

  // 移除貨幣符號和字母（保留數字和分隔符）
  let cleaned = value
    .replace(/[$€£¥₩₹₽฿₫₱₦₨₵₣₤]/g, '') // 貨幣符號
    .replace(/[A-Za-z]/g, '') // 字母（單位）
    .replace(/\s/g, '') // 空白
    .trim();

  // 空字串處理
  if (!cleaned) return null;

  // 處理千分位分隔符
  const commaCount = (cleaned.match(/,/g) || []).length;
  const dotCount = (cleaned.match(/\./g) || []).length;

  if (commaCount > 0 && dotCount === 1 && cleaned.indexOf('.') > cleaned.lastIndexOf(',')) {
    // 美式格式：1,234.56
    cleaned = cleaned.replace(/,/g, '');
  } else if (dotCount > 0 && commaCount === 1 && cleaned.indexOf(',') > cleaned.lastIndexOf('.')) {
    // 歐式格式：1.234,56
    cleaned = cleaned.replace(/\./g, '').replace(',', '.');
  } else if (commaCount > 0 && dotCount === 0) {
    // 僅有千分位：1,234
    cleaned = cleaned.replace(/,/g, '');
  } else if (dotCount > 0 && commaCount === 0 && dotCount > 1) {
    // 多個點作為千分位：1.234.567
    const parts = cleaned.split('.');
    const lastPart = parts.pop();
    cleaned = parts.join('') + '.' + lastPart;
  }

  // 處理負數
  const isNegative = cleaned.startsWith('-') || cleaned.startsWith('(');
  cleaned = cleaned.replace(/[()-]/g, '');

  const num = parseFloat(cleaned);
  if (isNaN(num)) return null;

  return isNegative ? -num : num;
}

// ============================================================
// 相似度計算
// ============================================================

/**
 * 計算數值相似度
 *
 * @description
 *   計算兩個數值字串之間的相似度
 *   基於相對差異計算，返回 0-1 之間的值
 *
 * @param value1 - 第一個數值字串
 * @param value2 - 第二個數值字串
 * @returns 相似度結果，包含相似度值和是否為數值
 *
 * @example
 * ```typescript
 * numericSimilarity('100', '100')
 * // { similarity: 1, isNumeric: true }
 *
 * numericSimilarity('100', '110')
 * // { similarity: 0.909, isNumeric: true }
 *
 * numericSimilarity('abc', '123')
 * // { similarity: 0, isNumeric: false }
 * ```
 */
export function numericSimilarity(value1: string, value2: string): NumericSimilarityResult {
  const num1 = parseNumericValue(value1);
  const num2 = parseNumericValue(value2);

  // 非數值情況
  if (num1 === null || num2 === null) {
    return { similarity: 0, isNumeric: false };
  }

  // 完全相同
  if (num1 === num2) {
    return { similarity: 1, isNumeric: true };
  }

  // 其中一個為零
  if (num1 === 0 || num2 === 0) {
    // 如果另一個也接近零，相似度較高
    const other = num1 === 0 ? num2 : num1;
    if (Math.abs(other) < 1) {
      return { similarity: 1 - Math.abs(other), isNumeric: true };
    }
    return { similarity: 0, isNumeric: true };
  }

  // 計算相對差異
  const maxVal = Math.max(Math.abs(num1), Math.abs(num2));
  const diff = Math.abs(num1 - num2);
  const similarity = Math.max(0, 1 - diff / maxVal);

  return { similarity, isNumeric: true };
}

/**
 * 判斷是否可能為數值欄位
 *
 * @param value - 要檢查的值
 * @returns 是否可能為數值
 */
export function isPossiblyNumeric(value: string): boolean {
  return parseNumericValue(value) !== null;
}

// ============================================================
// 模式檢測
// ============================================================

/**
 * 檢測數值轉換模式
 *
 * @description
 *   分析一組原始值-修正值配對，檢測是否存在一致的數值轉換規則
 *   支援檢測：
 *   - 乘法模式（如匯率轉換）
 *   - 加法模式（如固定調整）
 *
 * @param pairs - 原始值與修正值配對陣列
 * @returns 轉換模式檢測結果
 *
 * @example
 * ```typescript
 * // 檢測匯率轉換 (USD -> TWD, 1:30)
 * detectNumericTransformPattern([
 *   { original: '100', corrected: '3000' },
 *   { original: '200', corrected: '6000' }
 * ])
 * // { hasPattern: true, type: 'multiply', factor: 30 }
 *
 * // 檢測固定調整
 * detectNumericTransformPattern([
 *   { original: '100', corrected: '110' },
 *   { original: '200', corrected: '210' }
 * ])
 * // { hasPattern: true, type: 'add', factor: 10 }
 * ```
 */
export function detectNumericTransformPattern(
  pairs: Array<{ original: string; corrected: string }>
): NumericTransformPattern {
  // 轉換為數值配對
  const numericPairs = pairs
    .map((p) => ({
      orig: parseNumericValue(p.original),
      corr: parseNumericValue(p.corrected),
    }))
    .filter((p): p is { orig: number; corr: number } => p.orig !== null && p.corr !== null);

  // 需要至少 2 對數值才能檢測模式
  if (numericPairs.length < 2) {
    return { hasPattern: false, type: 'none' };
  }

  // 過濾掉原始值為 0 的配對（避免除以零）
  const validPairs = numericPairs.filter((p) => p.orig !== 0);

  if (validPairs.length < 2) {
    return { hasPattern: false, type: 'none' };
  }

  // 檢查乘法模式（如：匯率轉換）
  const ratios = validPairs.map((p) => p.corr / p.orig);
  const avgRatio = ratios.reduce((a, b) => a + b, 0) / ratios.length;
  const ratioVariance = ratios.reduce((sum, r) => sum + Math.pow(r - avgRatio, 2), 0) / ratios.length;
  const ratioStdDev = Math.sqrt(ratioVariance);

  // 變異係數小於 5% 視為穩定模式
  if (avgRatio !== 0 && ratioStdDev / Math.abs(avgRatio) < 0.05) {
    return {
      hasPattern: true,
      type: 'multiply',
      factor: Math.round(avgRatio * 10000) / 10000, // 保留 4 位小數
    };
  }

  // 檢查加法模式（如：固定調整）
  const diffs = numericPairs.map((p) => p.corr - p.orig);
  const avgDiff = diffs.reduce((a, b) => a + b, 0) / diffs.length;
  const diffVariance = diffs.reduce((sum, d) => sum + Math.pow(d - avgDiff, 2), 0) / diffs.length;
  const diffStdDev = Math.sqrt(diffVariance);

  // 差異的標準差小於平均差異的 5% 視為穩定模式
  if (avgDiff !== 0 && diffStdDev / Math.abs(avgDiff) < 0.05) {
    return {
      hasPattern: true,
      type: 'add',
      factor: Math.round(avgDiff * 100) / 100, // 保留 2 位小數
    };
  }

  // 差異很小（接近零）且穩定
  if (Math.abs(avgDiff) < 0.01 && diffStdDev < 0.01) {
    return {
      hasPattern: true,
      type: 'add',
      factor: 0,
    };
  }

  return { hasPattern: false, type: 'none' };
}

/**
 * 格式化數值為標準顯示格式
 *
 * @param value - 數值
 * @param options - 格式化選項
 * @returns 格式化後的字串
 */
export function formatNumericValue(
  value: number,
  options?: {
    decimals?: number;
    thousandSeparator?: boolean;
    prefix?: string;
    suffix?: string;
  }
): string {
  const { decimals = 2, thousandSeparator = true, prefix = '', suffix = '' } = options || {};

  let formatted = value.toFixed(decimals);

  if (thousandSeparator) {
    const parts = formatted.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    formatted = parts.join('.');
  }

  return `${prefix}${formatted}${suffix}`;
}
