/**
 * @fileoverview 字串工具函數
 * @description
 *   提供字串處理相關的工具函數：
 *   - Levenshtein 距離計算
 *   - 相似度計算
 *   - 名稱正規化
 *
 * @module src/lib/utils/string
 * @since Epic 0 - Story 0.3
 * @lastModified 2025-12-23
 *
 * @features
 *   - Levenshtein 編輯距離算法
 *   - 字串相似度百分比計算
 *   - 公司名稱正規化（處理縮寫）
 */

// ============================================================
// Levenshtein Distance Algorithm
// ============================================================

/**
 * 計算兩個字串之間的 Levenshtein 編輯距離
 *
 * @description
 *   Levenshtein 距離是衡量兩個字串差異的指標，
 *   表示從一個字串轉換到另一個字串所需的最少編輯操作數
 *   （插入、刪除、替換）。
 *
 * @param a - 第一個字串
 * @param b - 第二個字串
 * @returns 編輯距離（非負整數）
 *
 * @example
 * ```typescript
 * levenshteinDistance('kitten', 'sitting') // 3
 * levenshteinDistance('hello', 'hello')    // 0
 * levenshteinDistance('abc', '')           // 3
 * ```
 */
export function levenshteinDistance(a: string, b: string): number {
  // 邊界條件處理
  if (a.length === 0) return b.length
  if (b.length === 0) return a.length

  // 使用動態規劃計算編輯距離
  const matrix: number[][] = []

  // 初始化第一列
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i]
  }

  // 初始化第一行
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j
  }

  // 填充矩陣
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1]
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // 替換
          matrix[i][j - 1] + 1, // 插入
          matrix[i - 1][j] + 1 // 刪除
        )
      }
    }
  }

  return matrix[b.length][a.length]
}

// ============================================================
// Similarity Calculation
// ============================================================

/**
 * 計算兩個字串的相似度（0-1 範圍）
 *
 * @description
 *   基於 Levenshtein 距離計算相似度百分比。
 *   相似度 = 1 - (距離 / 最大長度)
 *
 * @param a - 第一個字串
 * @param b - 第二個字串
 * @returns 相似度（0-1），1 表示完全相同
 *
 * @example
 * ```typescript
 * calculateStringSimilarity('hello', 'hello')  // 1.0
 * calculateStringSimilarity('hello', 'hallo')  // 0.8
 * calculateStringSimilarity('abc', 'xyz')      // 0.0
 * ```
 */
export function calculateStringSimilarity(a: string, b: string): number {
  // 空字串處理
  if (a.length === 0 && b.length === 0) return 1
  if (a.length === 0 || b.length === 0) return 0

  const distance = levenshteinDistance(a, b)
  const maxLength = Math.max(a.length, b.length)

  return 1 - distance / maxLength
}

// ============================================================
// Company Name Normalization
// ============================================================

/**
 * 常見公司名稱縮寫和變體的正規表達式
 */
const COMPANY_SUFFIX_PATTERNS: RegExp[] = [
  // 有限公司變體
  /\b(ltd\.?|limited)\b/gi,
  // 股份有限公司變體
  /\b(inc\.?|incorporated)\b/gi,
  // 公司變體
  /\b(corp\.?|corporation)\b/gi,
  /\b(co\.?|company)\b/gi,
  // 合夥企業
  /\b(llc|l\.l\.c\.)\b/gi,
  /\b(llp|l\.l\.p\.)\b/gi,
  // 國際/集團
  /\b(intl\.?|international)\b/gi,
  /\b(grp\.?|group)\b/gi,
  // 物流相關
  /\b(logistics|freight|forwarding|shipping|transport|cargo)\b/gi,
  // 服務相關
  /\b(services?|solutions?)\b/gi,
  // 地區標識
  /\b(pvt\.?|private)\b/gi,
  /\b(pte\.?)\b/gi,
  // 其他常見後綴
  /\b(pty\.?|proprietary)\b/gi,
  /\b(gmbh|ag|sa|nv|bv)\b/gi,
]

/**
 * 正規化公司名稱以進行比對
 *
 * @description
 *   移除常見的公司名稱後綴和縮寫，
 *   統一大小寫和空白，以便進行模糊匹配。
 *
 * @param name - 原始公司名稱
 * @returns 正規化後的名稱
 *
 * @example
 * ```typescript
 * normalizeCompanyName('ABC Logistics Ltd.')    // 'abc'
 * normalizeCompanyName('XYZ Corp. International') // 'xyz'
 * normalizeCompanyName('Test Company Inc')      // 'test'
 * ```
 */
export function normalizeCompanyName(name: string): string {
  let normalized = name.toLowerCase().trim()

  // 移除所有常見後綴
  for (const pattern of COMPANY_SUFFIX_PATTERNS) {
    normalized = normalized.replace(pattern, '')
  }

  // 移除多餘空白和特殊字符
  normalized = normalized
    .replace(/[.,\-_&()]/g, ' ') // 替換特殊字符為空格
    .replace(/\s+/g, ' ') // 合併多個空白
    .trim()

  return normalized
}

/**
 * 計算正規化後的公司名稱相似度
 *
 * @description
 *   先正規化兩個公司名稱，再計算相似度。
 *   這樣可以忽略常見的公司名稱後綴差異。
 *
 * @param name1 - 第一個公司名稱
 * @param name2 - 第二個公司名稱
 * @returns 相似度（0-1）
 *
 * @example
 * ```typescript
 * calculateCompanyNameSimilarity('ABC Ltd.', 'ABC Limited')  // ~1.0
 * calculateCompanyNameSimilarity('XYZ Corp', 'XYZ Inc')      // ~1.0
 * ```
 */
export function calculateCompanyNameSimilarity(
  name1: string,
  name2: string
): number {
  const normalized1 = normalizeCompanyName(name1)
  const normalized2 = normalizeCompanyName(name2)

  return calculateStringSimilarity(normalized1, normalized2)
}
