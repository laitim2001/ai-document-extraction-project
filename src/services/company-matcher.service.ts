/**
 * @fileoverview 公司匹配服務
 * @description
 *   負責公司名稱的模糊匹配和識別：
 *   - 精確匹配（正規化後）
 *   - 名稱變體匹配
 *   - 模糊匹配（Levenshtein 距離）
 *   - 匹配結果快取
 *
 * @module src/services/company-matcher
 * @since Epic 0 - Story 0.3
 * @lastModified 2025-12-23
 *
 * @features
 *   - 三階段匹配策略（精確 → 變體 → 模糊）
 *   - 90% 匹配閾值配置
 *   - 結果快取機制
 *   - 可能重複公司建議
 *
 * @dependencies
 *   - Prisma Client - 數據庫操作
 *   - src/lib/utils/string - 字串工具函數
 *
 * @related
 *   - src/services/company-auto-create.service.ts - 自動建立服務
 *   - src/types/company.ts - 公司類型定義
 */

import { prisma } from '@/lib/prisma'
import { CompanyStatus } from '@prisma/client'
import {
  normalizeCompanyName,
  calculateCompanyNameSimilarity,
} from '@/lib/utils/string'

// ============================================================
// Types
// ============================================================

/**
 * 匹配類型
 */
export type MatchType = 'EXACT' | 'VARIANT' | 'FUZZY' | 'NONE'

/**
 * 匹配結果
 */
export interface CompanyMatchResult {
  /** 是否找到匹配 */
  matched: boolean
  /** 匹配的公司 ID */
  companyId: string | null
  /** 匹配的公司名稱 */
  companyName: string | null
  /** 匹配分數（0-1） */
  matchScore: number
  /** 匹配類型 */
  matchType: MatchType
  /** 匹配的名稱變體（如果是變體匹配） */
  matchedVariant?: string
}

/**
 * 可能重複的公司
 */
export interface PossibleDuplicate {
  /** 公司 ID */
  id: string
  /** 公司名稱 */
  name: string
  /** 匹配分數 */
  matchScore: number
  /** 匹配的名稱或變體 */
  matchedName: string
}

/**
 * 匹配服務配置
 */
export interface MatcherConfig {
  /** 模糊匹配閾值（預設 0.9 = 90%） */
  fuzzyThreshold?: number
  /** 重複建議閾值（預設 0.7 = 70%） */
  duplicateSuggestionThreshold?: number
  /** 最大建議數量 */
  maxSuggestions?: number
  /** 是否使用快取 */
  useCache?: boolean
}

// ============================================================
// Constants
// ============================================================

/** 預設模糊匹配閾值（90%） */
export const DEFAULT_FUZZY_THRESHOLD = 0.9

/** 預設重複建議閾值（70%） */
export const DEFAULT_DUPLICATE_SUGGESTION_THRESHOLD = 0.7

/** 預設最大建議數量 */
export const DEFAULT_MAX_SUGGESTIONS = 5

/** 快取過期時間（毫秒）：5 分鐘 */
const CACHE_TTL_MS = 5 * 60 * 1000

// ============================================================
// Cache Implementation
// ============================================================

interface CacheEntry<T> {
  value: T
  expiry: number
}

/**
 * 簡單的記憶體快取
 */
class MatcherCache {
  private cache = new Map<string, CacheEntry<CompanyMatchResult>>()

  /**
   * 取得快取
   */
  get(key: string): CompanyMatchResult | null {
    const entry = this.cache.get(key)
    if (!entry) return null

    if (Date.now() > entry.expiry) {
      this.cache.delete(key)
      return null
    }

    return entry.value
  }

  /**
   * 設定快取
   */
  set(key: string, value: CompanyMatchResult): void {
    this.cache.set(key, {
      value,
      expiry: Date.now() + CACHE_TTL_MS,
    })
  }

  /**
   * 清除快取
   */
  clear(): void {
    this.cache.clear()
  }

  /**
   * 移除特定鍵
   */
  delete(key: string): void {
    this.cache.delete(key)
  }

  /**
   * 清理過期項目
   */
  cleanup(): void {
    const now = Date.now()
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiry) {
        this.cache.delete(key)
      }
    }
  }
}

// 單例快取實例
const matcherCache = new MatcherCache()

// ============================================================
// Core Functions
// ============================================================

/**
 * 查找匹配的公司
 *
 * @description
 *   執行三階段匹配策略：
 *   1. 精確匹配：正規化名稱後精確比對
 *   2. 變體匹配：檢查名稱變體列表
 *   3. 模糊匹配：使用 Levenshtein 距離計算相似度
 *
 * @param name - 要匹配的公司名稱
 * @param config - 匹配配置
 * @returns 匹配結果
 *
 * @example
 * ```typescript
 * const result = await findMatchingCompany('ABC Logistics Ltd.')
 * if (result.matched) {
 *   console.log(`Found: ${result.companyName} (${result.matchScore * 100}%)`)
 * }
 * ```
 */
export async function findMatchingCompany(
  name: string,
  config: MatcherConfig = {}
): Promise<CompanyMatchResult> {
  const {
    fuzzyThreshold = DEFAULT_FUZZY_THRESHOLD,
    useCache = true,
  } = config

  // 正規化輸入名稱
  const normalizedInput = normalizeCompanyName(name)

  // 檢查快取
  if (useCache) {
    const cached = matcherCache.get(normalizedInput)
    if (cached) {
      return cached
    }
  }

  // 預設結果：無匹配
  const noMatchResult: CompanyMatchResult = {
    matched: false,
    companyId: null,
    companyName: null,
    matchScore: 0,
    matchType: 'NONE',
  }

  // 獲取所有非合併狀態的公司
  const companies = await prisma.company.findMany({
    where: {
      status: { not: CompanyStatus.MERGED },
    },
    select: {
      id: true,
      name: true,
      nameVariants: true,
    },
  })

  // 階段 1：精確匹配（正規化後）
  for (const company of companies) {
    const normalizedCompanyName = normalizeCompanyName(company.name)
    if (normalizedInput === normalizedCompanyName) {
      const result: CompanyMatchResult = {
        matched: true,
        companyId: company.id,
        companyName: company.name,
        matchScore: 1,
        matchType: 'EXACT',
      }
      if (useCache) matcherCache.set(normalizedInput, result)
      return result
    }
  }

  // 階段 2：名稱變體匹配
  for (const company of companies) {
    for (const variant of company.nameVariants) {
      const normalizedVariant = normalizeCompanyName(variant)
      if (normalizedInput === normalizedVariant) {
        const result: CompanyMatchResult = {
          matched: true,
          companyId: company.id,
          companyName: company.name,
          matchScore: 1,
          matchType: 'VARIANT',
          matchedVariant: variant,
        }
        if (useCache) matcherCache.set(normalizedInput, result)
        return result
      }
    }
  }

  // 階段 3：模糊匹配
  let bestMatch: CompanyMatchResult = noMatchResult

  for (const company of companies) {
    // 檢查主名稱相似度
    const mainScore = calculateCompanyNameSimilarity(name, company.name)
    if (mainScore > fuzzyThreshold && mainScore > bestMatch.matchScore) {
      bestMatch = {
        matched: true,
        companyId: company.id,
        companyName: company.name,
        matchScore: mainScore,
        matchType: 'FUZZY',
      }
    }

    // 檢查名稱變體相似度
    for (const variant of company.nameVariants) {
      const variantScore = calculateCompanyNameSimilarity(name, variant)
      if (variantScore > fuzzyThreshold && variantScore > bestMatch.matchScore) {
        bestMatch = {
          matched: true,
          companyId: company.id,
          companyName: company.name,
          matchScore: variantScore,
          matchType: 'FUZZY',
          matchedVariant: variant,
        }
      }
    }
  }

  // 快取結果
  if (useCache) {
    matcherCache.set(normalizedInput, bestMatch)
  }

  return bestMatch
}

/**
 * 查找可能重複的公司
 *
 * @description
 *   查找與給定名稱相似但未達到精確匹配閾值的公司，
 *   用於在審核頁面顯示可能的重複建議。
 *
 * @param name - 要檢查的公司名稱
 * @param config - 匹配配置
 * @returns 可能重複的公司列表
 *
 * @example
 * ```typescript
 * const duplicates = await findPossibleDuplicates('ABC Logistics')
 * // [{ id: '...', name: 'ABC Logistics Ltd.', matchScore: 0.85 }]
 * ```
 */
export async function findPossibleDuplicates(
  name: string,
  config: MatcherConfig = {}
): Promise<PossibleDuplicate[]> {
  const {
    duplicateSuggestionThreshold = DEFAULT_DUPLICATE_SUGGESTION_THRESHOLD,
    maxSuggestions = DEFAULT_MAX_SUGGESTIONS,
  } = config

  const duplicates: PossibleDuplicate[] = []

  // 獲取所有非合併狀態的公司
  const companies = await prisma.company.findMany({
    where: {
      status: { not: CompanyStatus.MERGED },
    },
    select: {
      id: true,
      name: true,
      nameVariants: true,
    },
  })

  // 計算相似度
  for (const company of companies) {
    // 檢查主名稱
    const mainScore = calculateCompanyNameSimilarity(name, company.name)
    if (mainScore >= duplicateSuggestionThreshold) {
      duplicates.push({
        id: company.id,
        name: company.name,
        matchScore: mainScore,
        matchedName: company.name,
      })
      continue // 已添加，不需要再檢查變體
    }

    // 檢查名稱變體
    for (const variant of company.nameVariants) {
      const variantScore = calculateCompanyNameSimilarity(name, variant)
      if (variantScore >= duplicateSuggestionThreshold) {
        duplicates.push({
          id: company.id,
          name: company.name,
          matchScore: variantScore,
          matchedName: variant,
        })
        break // 找到一個匹配的變體就夠了
      }
    }
  }

  // 按相似度排序並限制數量
  return duplicates
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, maxSuggestions)
}

/**
 * 批量匹配公司名稱
 *
 * @description
 *   批量處理多個公司名稱的匹配，
 *   優化數據庫查詢次數。
 *
 * @param names - 要匹配的公司名稱列表
 * @param config - 匹配配置
 * @returns 匹配結果映射（名稱 → 結果）
 */
export async function batchMatchCompanies(
  names: string[],
  config: MatcherConfig = {}
): Promise<Map<string, CompanyMatchResult>> {
  const results = new Map<string, CompanyMatchResult>()

  // 獲取所有公司一次
  const companies = await prisma.company.findMany({
    where: {
      status: { not: CompanyStatus.MERGED },
    },
    select: {
      id: true,
      name: true,
      nameVariants: true,
    },
  })

  const {
    fuzzyThreshold = DEFAULT_FUZZY_THRESHOLD,
    useCache = true,
  } = config

  for (const name of names) {
    const normalizedInput = normalizeCompanyName(name)

    // 檢查快取
    if (useCache) {
      const cached = matcherCache.get(normalizedInput)
      if (cached) {
        results.set(name, cached)
        continue
      }
    }

    // 執行匹配
    let bestMatch: CompanyMatchResult = {
      matched: false,
      companyId: null,
      companyName: null,
      matchScore: 0,
      matchType: 'NONE',
    }

    // 階段 1 & 2：精確和變體匹配
    for (const company of companies) {
      const normalizedCompanyName = normalizeCompanyName(company.name)
      if (normalizedInput === normalizedCompanyName) {
        bestMatch = {
          matched: true,
          companyId: company.id,
          companyName: company.name,
          matchScore: 1,
          matchType: 'EXACT',
        }
        break
      }

      for (const variant of company.nameVariants) {
        const normalizedVariant = normalizeCompanyName(variant)
        if (normalizedInput === normalizedVariant) {
          bestMatch = {
            matched: true,
            companyId: company.id,
            companyName: company.name,
            matchScore: 1,
            matchType: 'VARIANT',
            matchedVariant: variant,
          }
          break
        }
      }
      if (bestMatch.matched) break
    }

    // 階段 3：模糊匹配（如果沒有精確匹配）
    if (!bestMatch.matched) {
      for (const company of companies) {
        const mainScore = calculateCompanyNameSimilarity(name, company.name)
        if (mainScore > fuzzyThreshold && mainScore > bestMatch.matchScore) {
          bestMatch = {
            matched: true,
            companyId: company.id,
            companyName: company.name,
            matchScore: mainScore,
            matchType: 'FUZZY',
          }
        }

        for (const variant of company.nameVariants) {
          const variantScore = calculateCompanyNameSimilarity(name, variant)
          if (variantScore > fuzzyThreshold && variantScore > bestMatch.matchScore) {
            bestMatch = {
              matched: true,
              companyId: company.id,
              companyName: company.name,
              matchScore: variantScore,
              matchType: 'FUZZY',
              matchedVariant: variant,
            }
          }
        }
      }
    }

    // 快取並存儲結果
    if (useCache) {
      matcherCache.set(normalizedInput, bestMatch)
    }
    results.set(name, bestMatch)
  }

  return results
}

// ============================================================
// Cache Management
// ============================================================

/**
 * 清除匹配快取
 *
 * @description
 *   當公司資料發生變更時（新增、合併、刪除），
 *   應該清除快取以確保匹配結果的準確性。
 */
export function clearMatcherCache(): void {
  matcherCache.clear()
}

/**
 * 從快取中移除特定公司
 *
 * @param companyName - 公司名稱
 */
export function invalidateCacheForCompany(companyName: string): void {
  const normalizedName = normalizeCompanyName(companyName)
  matcherCache.delete(normalizedName)
}

/**
 * 清理過期的快取項目
 */
export function cleanupExpiredCache(): void {
  matcherCache.cleanup()
}
