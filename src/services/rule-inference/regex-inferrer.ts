/**
 * @fileoverview 正則模式推斷器
 * @description
 *   從修正值中推斷正則表達式模式。
 *   支援多種常見格式的識別：
 *   - 發票號碼格式
 *   - 日期格式
 *   - 金額格式
 *   - 代碼格式（貨櫃號、提單號等）
 *   - 通用結構模式
 *
 * @module src/services/rule-inference/regex-inferrer
 * @since Epic 4 - Story 4.4 (規則升級建議生成)
 * @lastModified 2025-12-19
 *
 * @features
 *   - 多種預定義模式識別
 *   - 通用結構分析
 *   - 信心度評估
 *
 * @dependencies
 *   - @/types/suggestion - InferredRule, CorrectionSample 類型
 */

import { InferredRule, CorrectionSample } from '@/types/suggestion'

// ============================================================
// Types
// ============================================================

/**
 * 模式推斷結果
 */
interface PatternInferenceResult {
  pattern: string
  confidence: number
  explanation: string
}

// ============================================================
// Main Function
// ============================================================

/**
 * 正則模式推斷
 *
 * @description
 *   嘗試從修正值中推斷正則表達式模式。
 *   會依序嘗試多種預定義模式，找到匹配率 >= 80% 的模式。
 *
 * @param samples - 修正樣本陣列
 * @returns 推斷的規則，若無法推斷則返回 null
 *
 * @example
 * ```typescript
 * const samples = [
 *   { originalValue: '', correctedValue: 'INV123456' },
 *   { originalValue: '', correctedValue: 'INV234567' },
 * ];
 * const result = await inferRegexPattern(samples);
 * // { type: 'REGEX', pattern: '^[A-Z]{3}\\d{6}$', confidence: 1, ... }
 * ```
 */
export async function inferRegexPattern(
  samples: CorrectionSample[]
): Promise<InferredRule | null> {
  const correctedValues = samples.map((s) => s.correctedValue)

  // 嘗試不同的模式推斷策略
  const strategies = [
    inferInvoiceNumberPattern,
    inferDatePattern,
    inferAmountPattern,
    inferCodePattern,
    inferGenericPattern,
  ]

  for (const strategy of strategies) {
    const result = strategy(correctedValues)
    if (result && result.confidence >= 0.7) {
      return {
        type: 'REGEX',
        ...result,
      }
    }
  }

  return null
}

// ============================================================
// Pattern Inference Strategies
// ============================================================

/**
 * 發票號碼模式推斷
 *
 * @param values - 修正值陣列
 * @returns 模式推斷結果，若無法匹配則返回 null
 */
function inferInvoiceNumberPattern(values: string[]): PatternInferenceResult | null {
  // 常見發票號碼格式
  const patterns = [
    { regex: /^[A-Z]{2,3}-\d{6,10}$/, desc: '前綴-數字 (如: INV-123456)' },
    { regex: /^[A-Z]{1,3}\d{6,12}$/, desc: '前綴數字 (如: INV123456)' },
    { regex: /^\d{8,14}$/, desc: '純數字 (如: 20241215001)' },
    { regex: /^[A-Z]{2}\d{2}[A-Z]\d{6,8}$/, desc: '台灣統一發票格式' },
  ]

  for (const { regex, desc } of patterns) {
    const matchCount = values.filter((v) => regex.test(v)).length
    const matchRate = matchCount / values.length

    if (matchRate >= 0.8) {
      return {
        pattern: regex.source,
        confidence: matchRate,
        explanation: `發票號碼格式: ${desc}`,
      }
    }
  }

  return null
}

/**
 * 日期模式推斷
 *
 * @param values - 修正值陣列
 * @returns 模式推斷結果，若無法匹配則返回 null
 */
function inferDatePattern(values: string[]): PatternInferenceResult | null {
  const patterns = [
    { regex: /^\d{4}-\d{2}-\d{2}$/, desc: 'ISO 日期 (YYYY-MM-DD)' },
    { regex: /^\d{2}\/\d{2}\/\d{4}$/, desc: '日期 (DD/MM/YYYY)' },
    { regex: /^\d{4}\/\d{2}\/\d{2}$/, desc: '日期 (YYYY/MM/DD)' },
    { regex: /^\d{8}$/, desc: '壓縮日期 (YYYYMMDD)' },
  ]

  for (const { regex, desc } of patterns) {
    const matchCount = values.filter((v) => regex.test(v)).length
    const matchRate = matchCount / values.length

    if (matchRate >= 0.8) {
      return {
        pattern: regex.source,
        confidence: matchRate,
        explanation: `日期格式: ${desc}`,
      }
    }
  }

  return null
}

/**
 * 金額模式推斷
 *
 * @param values - 修正值陣列
 * @returns 模式推斷結果，若無法匹配則返回 null
 */
function inferAmountPattern(values: string[]): PatternInferenceResult | null {
  const patterns = [
    { regex: /^\$?\d{1,3}(,\d{3})*(\.\d{2})?$/, desc: '美元格式 (如: $1,234.56)' },
    {
      regex: /^\d{1,3}(,\d{3})*(\.\d{2})?\s*(USD|EUR|GBP|TWD|CNY)$/,
      desc: '金額含幣別',
    },
    { regex: /^\d+(\.\d{2})?$/, desc: '純數字金額' },
  ]

  for (const { regex, desc } of patterns) {
    const matchCount = values.filter((v) => regex.test(v)).length
    const matchRate = matchCount / values.length

    if (matchRate >= 0.8) {
      return {
        pattern: regex.source,
        confidence: matchRate,
        explanation: `金額格式: ${desc}`,
      }
    }
  }

  return null
}

/**
 * 代碼模式推斷（貨櫃號、提單號等）
 *
 * @param values - 修正值陣列
 * @returns 模式推斷結果，若無法匹配則返回 null
 */
function inferCodePattern(values: string[]): PatternInferenceResult | null {
  const patterns = [
    { regex: /^[A-Z]{4}\d{7}$/, desc: '貨櫃號 (如: ABCD1234567)' },
    { regex: /^[A-Z]{3,5}\d{9,12}$/, desc: '追蹤號' },
    { regex: /^[A-Z0-9]{10,20}$/, desc: '通用代碼' },
  ]

  for (const { regex, desc } of patterns) {
    const matchCount = values.filter((v) => regex.test(v)).length
    const matchRate = matchCount / values.length

    if (matchRate >= 0.8) {
      return {
        pattern: regex.source,
        confidence: matchRate,
        explanation: `代碼格式: ${desc}`,
      }
    }
  }

  return null
}

/**
 * 通用模式推斷
 *
 * @description
 *   嘗試從值中提取共同的結構模式。
 *   分析字符類型分佈，找出最常見的結構。
 *
 * @param values - 修正值陣列
 * @returns 模式推斷結果，若無法匹配則返回 null
 */
function inferGenericPattern(values: string[]): PatternInferenceResult | null {
  if (values.length < 2) return null

  // 分析字符類型分佈
  const structures = values.map((v) => {
    return v
      .replace(/[A-Z]/g, 'A')
      .replace(/[a-z]/g, 'a')
      .replace(/\d/g, '0')
      .replace(/[^Aa0]/g, 'X')
  })

  // 找出最常見的結構
  const structureCount = new Map<string, number>()
  for (const s of structures) {
    structureCount.set(s, (structureCount.get(s) || 0) + 1)
  }

  let maxCount = 0
  let commonStructure = ''
  for (const [structure, count] of structureCount) {
    if (count > maxCount) {
      maxCount = count
      commonStructure = structure
    }
  }

  const matchRate = maxCount / values.length

  if (matchRate >= 0.7 && commonStructure.length >= 3) {
    // 將結構轉換為正則
    const pattern = commonStructure
      .replace(/A+/g, (m) => `[A-Z]{${m.length}}`)
      .replace(/a+/g, (m) => `[a-z]{${m.length}}`)
      .replace(/0+/g, (m) => `\\d{${m.length}}`)
      .replace(/X/g, '.')

    return {
      pattern: `^${pattern}$`,
      confidence: matchRate * 0.8, // 降低一些信心度因為是推斷的
      explanation: `推斷的通用模式（結構: ${commonStructure}）`,
    }
  }

  return null
}
