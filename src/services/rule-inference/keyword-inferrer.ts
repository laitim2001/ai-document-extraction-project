/**
 * @fileoverview 關鍵字模式推斷器
 * @description
 *   分析原始值和修正值之間的關係，推斷關鍵字提取規則。
 *   支援多種轉換模式識別：
 *   - 前綴移除
 *   - 後綴移除
 *   - 格式變更（移除分隔符）
 *   - 子串提取
 *
 * @module src/services/rule-inference/keyword-inferrer
 * @since Epic 4 - Story 4.4 (規則升級建議生成)
 * @lastModified 2025-12-19
 *
 * @features
 *   - 轉換模式分析
 *   - 一致性檢測
 *   - 規則配置生成
 *
 * @dependencies
 *   - @/types/suggestion - InferredRule, CorrectionSample 類型
 */

import { InferredRule, CorrectionSample } from '@/types/suggestion'

// ============================================================
// Types
// ============================================================

/**
 * 轉換類型
 */
type TransformationType =
  | 'prefix_removal'
  | 'suffix_removal'
  | 'format_change'
  | 'extraction'
  | 'unknown'

/**
 * 轉換分析結果
 */
interface Transformation {
  type: TransformationType
  removedPrefix?: string
  removedSuffix?: string
  extractedPattern?: string
  confidence: number
  description: string
}

/**
 * 關鍵字規則配置
 */
interface KeywordConfig {
  type: 'keyword'
  rules: {
    action: string
    value?: string
    pattern?: string
  }[]
}

// ============================================================
// Main Function
// ============================================================

/**
 * 關鍵字模式推斷
 *
 * @description
 *   分析原始值和修正值之間的關係，推斷關鍵字提取規則。
 *   會分析每個樣本的轉換模式，找出一致的模式。
 *
 * @param samples - 修正樣本陣列
 * @returns 推斷的規則，若無法推斷則返回 null
 *
 * @example
 * ```typescript
 * const samples = [
 *   { originalValue: 'PREFIX-123', correctedValue: '123' },
 *   { originalValue: 'PREFIX-456', correctedValue: '456' },
 * ];
 * const result = await inferKeywordPattern(samples);
 * // { type: 'KEYWORD', pattern: '{"type":"keyword","rules":[...]}', ... }
 * ```
 */
export async function inferKeywordPattern(
  samples: CorrectionSample[]
): Promise<InferredRule | null> {
  // 過濾掉沒有原始值的樣本
  const validSamples = samples.filter((s) => s.originalValue && s.originalValue.length > 0)

  if (validSamples.length === 0) {
    return null
  }

  // 分析修正模式
  const transformations = validSamples.map((s) =>
    analyzeTransformation(s.originalValue, s.correctedValue)
  )

  // 檢查是否有一致的轉換模式
  const consistentTransform = findConsistentTransformation(transformations)

  if (!consistentTransform) {
    return null
  }

  // 生成關鍵字規則
  const keywordConfig = generateKeywordConfig(consistentTransform, validSamples)

  return {
    type: 'KEYWORD',
    pattern: JSON.stringify(keywordConfig),
    confidence: consistentTransform.confidence,
    explanation: consistentTransform.description,
  }
}

// ============================================================
// Transformation Analysis
// ============================================================

/**
 * 分析單一修正的轉換類型
 *
 * @param original - 原始值
 * @param corrected - 修正值
 * @returns 轉換分析結果
 */
function analyzeTransformation(original: string, corrected: string): Transformation {
  // 檢查前綴移除
  if (original.endsWith(corrected)) {
    const prefix = original.slice(0, -corrected.length)
    return {
      type: 'prefix_removal',
      removedPrefix: prefix,
      confidence: 0.9,
      description: `移除前綴: "${prefix}"`,
    }
  }

  // 檢查後綴移除
  if (original.startsWith(corrected)) {
    const suffix = original.slice(corrected.length)
    return {
      type: 'suffix_removal',
      removedSuffix: suffix,
      confidence: 0.9,
      description: `移除後綴: "${suffix}"`,
    }
  }

  // 檢查修正值是否為原始值的子串
  if (original.includes(corrected)) {
    return {
      type: 'extraction',
      extractedPattern: corrected,
      confidence: 0.8,
      description: `從原始值中提取: "${corrected}"`,
    }
  }

  // 檢查格式變更（如移除分隔符）
  const normalizedOriginal = original.replace(/[-\s_.]/g, '')
  const normalizedCorrected = corrected.replace(/[-\s_.]/g, '')
  if (
    normalizedOriginal === normalizedCorrected ||
    normalizedOriginal.includes(normalizedCorrected)
  ) {
    return {
      type: 'format_change',
      confidence: 0.85,
      description: '格式標準化（移除分隔符）',
    }
  }

  return {
    type: 'unknown',
    confidence: 0,
    description: '無法識別轉換模式',
  }
}

/**
 * 找出一致的轉換模式
 *
 * @param transforms - 轉換分析結果陣列
 * @returns 一致的轉換模式，若無一致模式則返回 null
 */
function findConsistentTransformation(transforms: Transformation[]): Transformation | null {
  if (transforms.length === 0) return null

  // 按類型分組
  const byType = new Map<TransformationType, Transformation[]>()
  for (const t of transforms) {
    const existing = byType.get(t.type) || []
    existing.push(t)
    byType.set(t.type, existing)
  }

  // 找出最常見且有意義的類型
  let bestType: TransformationType | null = null
  let bestCount = 0

  for (const [type, items] of byType) {
    if (type !== 'unknown' && items.length > bestCount) {
      bestCount = items.length
      bestType = type
    }
  }

  if (!bestType || bestCount / transforms.length < 0.7) {
    return null
  }

  const items = byType.get(bestType)!
  const representative = items[0]

  // 對於前綴/後綴移除，檢查一致性
  if (bestType === 'prefix_removal') {
    const prefixes = new Set(items.map((t) => t.removedPrefix))
    if (prefixes.size === 1) {
      return {
        ...representative,
        confidence: (bestCount / transforms.length) * representative.confidence,
      }
    }
    // 有多個不同的前綴，降低信心度
    return {
      ...representative,
      confidence: (bestCount / transforms.length) * representative.confidence * 0.7,
      description: `移除前綴（有 ${prefixes.size} 種變體）`,
    }
  }

  if (bestType === 'suffix_removal') {
    const suffixes = new Set(items.map((t) => t.removedSuffix))
    if (suffixes.size === 1) {
      return {
        ...representative,
        confidence: (bestCount / transforms.length) * representative.confidence,
      }
    }
    return {
      ...representative,
      confidence: (bestCount / transforms.length) * representative.confidence * 0.7,
      description: `移除後綴（有 ${suffixes.size} 種變體）`,
    }
  }

  return {
    ...representative,
    confidence: (bestCount / transforms.length) * representative.confidence,
  }
}

// ============================================================
// Config Generation
// ============================================================

/**
 * 生成關鍵字配置
 *
 * @param transform - 轉換模式
 * @param samples - 修正樣本陣列
 * @returns 關鍵字規則配置
 */
function generateKeywordConfig(
  transform: Transformation,
  samples: CorrectionSample[]
): KeywordConfig {
  const rules: KeywordConfig['rules'] = []

  switch (transform.type) {
    case 'prefix_removal':
      rules.push({
        action: 'remove_prefix',
        value: transform.removedPrefix,
      })
      break

    case 'suffix_removal':
      rules.push({
        action: 'remove_suffix',
        value: transform.removedSuffix,
      })
      break

    case 'format_change':
      rules.push({
        action: 'normalize',
        pattern: '[-\\s_.]',
      })
      break

    case 'extraction':
      // 嘗試找出提取模式
      const extractionPattern = findExtractionPattern(samples)
      if (extractionPattern) {
        rules.push({
          action: 'extract',
          pattern: extractionPattern,
        })
      }
      break
  }

  return { type: 'keyword', rules }
}

/**
 * 找出提取模式
 *
 * @param samples - 修正樣本陣列
 * @returns 提取模式正則，若無法識別則返回 null
 */
function findExtractionPattern(samples: CorrectionSample[]): string | null {
  // 簡化實現：找出修正值在原始值中的位置模式
  const positions = samples
    .filter((s) => s.originalValue.includes(s.correctedValue))
    .map((s) => {
      const idx = s.originalValue.indexOf(s.correctedValue)
      const beforeChar = idx > 0 ? s.originalValue[idx - 1] : '^'
      const afterChar =
        idx + s.correctedValue.length < s.originalValue.length
          ? s.originalValue[idx + s.correctedValue.length]
          : '$'
      return { beforeChar, afterChar }
    })

  if (positions.length === 0) {
    return null
  }

  // 檢查是否有一致的邊界字符
  const beforeChars = new Set(positions.map((p) => p.beforeChar))
  const afterChars = new Set(positions.map((p) => p.afterChar))

  if (beforeChars.size === 1 && afterChars.size === 1) {
    const before = positions[0].beforeChar
    const after = positions[0].afterChar
    return `(?<=${before === '^' ? '' : escapeRegex(before)}).*?(?=${after === '$' ? '' : escapeRegex(after)})`
  }

  return null
}

/**
 * 轉義正則特殊字符
 *
 * @param str - 需要轉義的字串
 * @returns 轉義後的字串
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
