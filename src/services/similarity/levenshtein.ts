/**
 * @fileoverview Levenshtein 距離算法實現
 * @description
 *   實現 Levenshtein 編輯距離算法用於字串相似度比較：
 *   - 基礎編輯距離計算
 *   - 相似度百分比計算
 *   - 帶閾值的優化計算（提前終止）
 *
 * @module src/services/similarity/levenshtein
 * @since Epic 4 - Story 4.3
 * @lastModified 2025-12-19
 *
 * @features
 *   - Levenshtein 編輯距離計算
 *   - 相似度正規化（0-1）
 *   - 閾值優化提前終止
 */

import type { SimilarityResult } from '@/types/pattern';

// ============================================================
// 核心算法
// ============================================================

/**
 * 計算兩個字串之間的 Levenshtein 編輯距離
 *
 * @description
 *   使用動態規劃計算將 str1 轉換為 str2 所需的最少編輯操作數
 *   支援的操作：插入、刪除、替換
 *
 * @param str1 - 第一個字串
 * @param str2 - 第二個字串
 * @returns 編輯距離（非負整數）
 *
 * @example
 * ```typescript
 * levenshteinDistance('kitten', 'sitting') // 3
 * levenshteinDistance('hello', 'hello')    // 0
 * ```
 */
export function levenshteinDistance(str1: string, str2: string): number {
  const m = str1.length;
  const n = str2.length;

  // 空字串處理
  if (m === 0) return n;
  if (n === 0) return m;

  // 創建距離矩陣
  const dp: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0));

  // 初始化第一行和第一列
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  // 填充距離矩陣
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1, // 刪除
          dp[i][j - 1] + 1, // 插入
          dp[i - 1][j - 1] + 1 // 替換
        );
      }
    }
  }

  return dp[m][n];
}

/**
 * 計算兩個字串的 Levenshtein 相似度
 *
 * @description
 *   基於編輯距離計算相似度，返回 0-1 之間的值
 *   1 表示完全相同，0 表示完全不同
 *   計算前會進行正規化（轉小寫、去除首尾空白）
 *
 * @param str1 - 第一個字串
 * @param str2 - 第二個字串
 * @returns 相似度值（0-1）
 *
 * @example
 * ```typescript
 * levenshteinSimilarity('hello', 'hello')  // 1
 * levenshteinSimilarity('hello', 'hallo')  // 0.8
 * levenshteinSimilarity('abc', 'xyz')      // 0
 * ```
 */
export function levenshteinSimilarity(str1: string, str2: string): number {
  // 空字串處理
  if (!str1 && !str2) return 1;
  if (!str1 || !str2) return 0;

  // 正規化：轉小寫、去除首尾空白
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();

  // 完全相同
  if (s1 === s2) return 1;

  // 長度為零處理
  if (s1.length === 0 || s2.length === 0) return 0;

  const distance = levenshteinDistance(s1, s2);
  const maxLength = Math.max(s1.length, s2.length);

  return 1 - distance / maxLength;
}

/**
 * 帶閾值的相似度計算（優化版本）
 *
 * @description
 *   使用早期終止優化，當確定無法達到閾值時提前返回
 *   適用於需要批量比較的場景
 *
 * @param str1 - 第一個字串
 * @param str2 - 第二個字串
 * @param threshold - 相似度閾值（0-1）
 * @returns 相似度結果，包含相似度值和是否匹配
 *
 * @example
 * ```typescript
 * calculateSimilarityWithThreshold('hello', 'hallo', 0.7)
 * // { similarity: 0.8, isMatch: true }
 *
 * calculateSimilarityWithThreshold('abc', 'xyz', 0.5)
 * // { similarity: 0, isMatch: false }
 * ```
 */
export function calculateSimilarityWithThreshold(
  str1: string,
  str2: string,
  threshold: number
): SimilarityResult {
  // 正規化
  const s1 = (str1 || '').toLowerCase().trim();
  const s2 = (str2 || '').toLowerCase().trim();

  // 快速檢查：空字串
  if (!s1 && !s2) {
    return { similarity: 1, isMatch: true };
  }
  if (!s1 || !s2) {
    return { similarity: 0, isMatch: false };
  }

  // 快速檢查：完全相同
  if (s1 === s2) {
    return { similarity: 1, isMatch: true };
  }

  // 快速檢查：長度差異過大
  const lengthDiff = Math.abs(s1.length - s2.length);
  const maxLength = Math.max(s1.length, s2.length);
  const minPossibleSimilarity = 1 - lengthDiff / maxLength;

  if (minPossibleSimilarity < threshold) {
    return { similarity: minPossibleSimilarity, isMatch: false };
  }

  // 完整計算
  const similarity = levenshteinSimilarity(s1, s2);
  return {
    similarity,
    isMatch: similarity >= threshold,
  };
}

/**
 * 批量計算相似度並找出匹配項
 *
 * @description
 *   對一組字串進行相似度計算，找出與目標相似的項目
 *
 * @param target - 目標字串
 * @param candidates - 候選字串陣列
 * @param threshold - 相似度閾值（預設 0.8）
 * @returns 匹配的候選項，按相似度降序排列
 *
 * @example
 * ```typescript
 * findSimilarStrings('hello', ['hallo', 'world', 'hell'], 0.7)
 * // [{ value: 'hallo', similarity: 0.8 }, { value: 'hell', similarity: 0.8 }]
 * ```
 */
export function findSimilarStrings(
  target: string,
  candidates: string[],
  threshold: number = 0.8
): Array<{ value: string; similarity: number }> {
  const results: Array<{ value: string; similarity: number }> = [];

  for (const candidate of candidates) {
    const { similarity, isMatch } = calculateSimilarityWithThreshold(target, candidate, threshold);

    if (isMatch) {
      results.push({ value: candidate, similarity });
    }
  }

  // 按相似度降序排列
  return results.sort((a, b) => b.similarity - a.similarity);
}
