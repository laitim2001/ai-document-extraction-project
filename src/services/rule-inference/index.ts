/**
 * @fileoverview 規則推斷引擎主入口
 * @description
 *   根據修正樣本自動推斷最佳的提取規則。
 *   支援多種推斷策略：
 *   - 正則表達式推斷 (Regex)
 *   - 關鍵字模式推斷 (Keyword)
 *   - 位置模式推斷 (Position)
 *   - AI 提示詞生成 (AI_PROMPT) - 降級策略
 *
 * @module src/services/rule-inference
 * @since Epic 4 - Story 4.4 (規則升級建議生成)
 * @lastModified 2025-12-19
 *
 * @features
 *   - 多策略候選規則生成
 *   - 信心度評估與排序
 *   - 替代方案保留
 *   - AI 降級策略
 *
 * @dependencies
 *   - @/types/suggestion - InferredRule, CorrectionSample 類型
 *   - ./regex-inferrer - 正則推斷
 *   - ./keyword-inferrer - 關鍵字推斷
 *   - ./position-inferrer - 位置推斷
 */

import { InferredRule, CorrectionSample } from '@/types/suggestion'
import { inferRegexPattern } from './regex-inferrer'
import { inferKeywordPattern } from './keyword-inferrer'
import { inferPositionPattern } from './position-inferrer'

// ============================================================
// Rule Inference Engine
// ============================================================

/**
 * 規則推斷引擎
 *
 * @description
 *   根據修正樣本推斷最佳的提取規則。
 *   會嘗試多種推斷策略，並根據信心度選擇最佳候選。
 *
 * @example
 * ```typescript
 * const samples = [
 *   { originalValue: 'INV-123456', correctedValue: 'INV123456' },
 *   { originalValue: 'INV-234567', correctedValue: 'INV234567' },
 * ];
 * const rule = await ruleInferenceEngine.inferBestRule(samples);
 * console.log(rule.type, rule.pattern, rule.confidence);
 * ```
 */
export class RuleInferenceEngine {
  /**
   * 推斷最佳規則
   *
   * @param samples - 修正樣本陣列
   * @returns 推斷的規則，包含類型、模式、信心度和替代方案
   * @throws 當沒有提供樣本時拋出錯誤
   */
  async inferBestRule(samples: CorrectionSample[]): Promise<InferredRule> {
    if (samples.length === 0) {
      throw new Error('No samples provided for rule inference')
    }

    // 獲取所有候選規則
    const candidates = await this.getAllCandidates(samples)

    // 按信心度排序
    candidates.sort((a, b) => b.confidence - a.confidence)

    // 返回最佳候選，並附上替代方案
    const best = candidates[0]
    if (candidates.length > 1) {
      best.alternatives = candidates.slice(1, 4) // 最多 3 個替代方案
    }

    return best
  }

  /**
   * 獲取所有候選規則
   *
   * @param samples - 修正樣本陣列
   * @returns 候選規則陣列
   */
  private async getAllCandidates(samples: CorrectionSample[]): Promise<InferredRule[]> {
    const candidates: InferredRule[] = []

    // 嘗試正則推斷
    const regexCandidate = await inferRegexPattern(samples)
    if (regexCandidate) {
      candidates.push(regexCandidate)
    }

    // 嘗試關鍵字推斷
    const keywordCandidate = await inferKeywordPattern(samples)
    if (keywordCandidate) {
      candidates.push(keywordCandidate)
    }

    // 嘗試位置推斷（需要上下文）
    const samplesWithContext = samples.filter((s) => s.context?.boundingBox)
    if (samplesWithContext.length >= 2) {
      const positionCandidate = await inferPositionPattern(samplesWithContext)
      if (positionCandidate) {
        candidates.push(positionCandidate)
      }
    }

    // 如果沒有候選，返回默認的 AI_PROMPT 類型
    if (candidates.length === 0) {
      candidates.push({
        type: 'AI_PROMPT',
        pattern: this.generateDefaultPrompt(samples),
        confidence: 0.5,
        explanation: '無法推斷明確規則，建議使用 AI 提取',
      })
    }

    return candidates
  }

  /**
   * 生成默認 AI 提示詞
   *
   * @param samples - 修正樣本陣列
   * @returns JSON 格式的提示詞
   */
  private generateDefaultPrompt(samples: CorrectionSample[]): string {
    const correctedValues = samples.map((s) => s.correctedValue)
    const commonPattern = this.findCommonPattern(correctedValues)

    return JSON.stringify({
      instruction: `提取符合以下模式的值: ${commonPattern}`,
      examples: samples.slice(0, 3).map((s) => ({
        input: s.originalValue,
        output: s.correctedValue,
      })),
    })
  }

  /**
   * 尋找共同模式描述
   *
   * @param values - 值陣列
   * @returns 模式描述文字
   */
  private findCommonPattern(values: string[]): string {
    // 簡單的模式描述
    const hasNumbers = values.every((v) => /\d/.test(v))
    const hasLetters = values.every((v) => /[a-zA-Z]/.test(v))
    const avgLength = Math.round(values.reduce((sum, v) => sum + v.length, 0) / values.length)

    const parts: string[] = []
    if (hasNumbers && hasLetters) {
      parts.push('字母數字混合')
    } else if (hasNumbers) {
      parts.push('純數字')
    } else if (hasLetters) {
      parts.push('純字母')
    }
    parts.push(`約 ${avgLength} 字元`)

    return parts.join('，')
  }
}

// 導出單例
export const ruleInferenceEngine = new RuleInferenceEngine()

// 重新導出子模組
export { inferRegexPattern } from './regex-inferrer'
export { inferKeywordPattern } from './keyword-inferrer'
export { inferPositionPattern } from './position-inferrer'
