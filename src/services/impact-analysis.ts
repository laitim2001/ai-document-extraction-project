/**
 * @fileoverview 規則影響分析服務
 * @description
 *   分析規則變更對歷史數據的影響，包括：
 *   - 計算受影響的文件數量和統計數據
 *   - 識別高風險案例
 *   - 生成時間軸分析數據
 *   - 支援多種提取類型的模式應用
 *
 * @module src/services/impact-analysis
 * @since Epic 4 - Story 4.5
 * @lastModified 2025-12-19
 *
 * @dependencies
 *   - prisma - 資料庫存取
 *   - types/impact - 影響分析類型定義
 */

import { prisma } from '@/lib/prisma'
import type {
  ImpactAnalysisResult,
  ImpactStatistics,
  RiskCase,
  TimelineItem,
  RiskLevel,
  FieldMappingValue,
  KeywordRuleConfig
} from '@/types/impact'

/**
 * 影響分析服務
 * 分析規則變更對歷史數據的影響
 */
export class ImpactAnalysisService {
  /**
   * 執行影響分析
   * @param suggestionId - 規則建議 ID
   * @returns 影響分析結果
   */
  async analyze(suggestionId: string): Promise<ImpactAnalysisResult> {
    // 獲取建議詳情
    const suggestion = await prisma.ruleSuggestion.findUnique({
      where: { id: suggestionId },
      include: {
        forwarder: {
          select: { id: true, name: true }
        }
      }
    })

    if (!suggestion) {
      throw new Error(`Suggestion ${suggestionId} not found`)
    }

    // 獲取最近 90 天的相關文件
    const ninetyDaysAgo = new Date()
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)

    const documents = await prisma.document.findMany({
      where: {
        forwarderId: suggestion.forwarderId,
        createdAt: { gte: ninetyDaysAgo }
      },
      include: {
        ocrResult: {
          select: { extractedText: true }
        },
        extractionResult: {
          select: { fieldMappings: true }
        },
        corrections: {
          where: { fieldName: suggestion.fieldName }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    // 計算統計數據
    const statistics = this.calculateStatistics(documents, suggestion)

    // 識別風險案例
    const riskCases = this.identifyRiskCases(documents, suggestion)

    // 生成時間軸數據
    const timeline = this.generateTimeline(documents, suggestion)

    return {
      suggestion: {
        id: suggestion.id,
        fieldName: suggestion.fieldName,
        forwarderName: suggestion.forwarder.name,
        currentPattern: suggestion.currentPattern,
        suggestedPattern: suggestion.suggestedPattern,
        extractionType: suggestion.extractionType
      },
      statistics,
      riskCases,
      timeline,
      analysisDate: new Date().toISOString()
    }
  }

  /**
   * 計算統計數據
   */
  private calculateStatistics(
    documents: DocumentWithRelations[],
    suggestion: SuggestionWithForwarder
  ): ImpactStatistics {
    let totalAffected = 0
    let estimatedImprovement = 0
    let estimatedRegression = 0
    let unchanged = 0

    for (const doc of documents) {
      // 獲取提取結果中的欄位值
      const fieldValue = this.getFieldValue(doc, suggestion.fieldName)
      const correction = doc.corrections[0]

      // 跳過沒有提取結果且沒有修正的文件
      if (!fieldValue && !correction) continue

      totalAffected++

      // 獲取實際值（修正值優先）
      const actualValue = correction?.correctedValue || fieldValue

      // 獲取原始文字
      const rawText = doc.ocrResult?.extractedText || ''

      // 模擬當前規則結果
      const currentResult = this.applyPattern(
        rawText,
        suggestion.currentPattern,
        suggestion.extractionType
      )

      // 模擬新規則結果
      const newResult = this.applyPattern(
        rawText,
        suggestion.suggestedPattern,
        suggestion.extractionType
      )

      const currentAccurate = currentResult === actualValue
      const newAccurate = newResult === actualValue

      if (!currentAccurate && newAccurate) {
        estimatedImprovement++
      } else if (currentAccurate && !newAccurate) {
        estimatedRegression++
      } else {
        unchanged++
      }
    }

    const improvementRate = totalAffected > 0
      ? (estimatedImprovement / totalAffected) * 100
      : 0

    const regressionRate = totalAffected > 0
      ? (estimatedRegression / totalAffected) * 100
      : 0

    return {
      totalAffected,
      estimatedImprovement,
      estimatedRegression,
      unchanged,
      improvementRate: Math.round(improvementRate * 10) / 10,
      regressionRate: Math.round(regressionRate * 10) / 10
    }
  }

  /**
   * 識別風險案例
   */
  private identifyRiskCases(
    documents: DocumentWithRelations[],
    suggestion: SuggestionWithForwarder
  ): RiskCase[] {
    const riskCases: RiskCase[] = []

    for (const doc of documents) {
      const fieldValue = this.getFieldValue(doc, suggestion.fieldName)
      const correction = doc.corrections[0]

      // 獲取實際值
      const actualValue = correction?.correctedValue || fieldValue
      if (!actualValue) continue

      // 獲取原始文字
      const rawText = doc.ocrResult?.extractedText || ''

      // 模擬當前規則結果
      const currentResult = this.applyPattern(
        rawText,
        suggestion.currentPattern,
        suggestion.extractionType
      )

      // 模擬新規則結果
      const newResult = this.applyPattern(
        rawText,
        suggestion.suggestedPattern,
        suggestion.extractionType
      )

      // 判斷風險等級
      const riskLevel = this.assessRiskLevel(currentResult, newResult, actualValue)

      if (riskLevel) {
        riskCases.push({
          documentId: doc.id,
          fileName: doc.fileName,
          currentValue: currentResult,
          predictedValue: newResult,
          riskLevel: riskLevel.level,
          reason: riskLevel.reason
        })
      }
    }

    // 按風險等級排序，高風險在前
    const levelOrder: Record<RiskLevel, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 }
    riskCases.sort((a, b) => levelOrder[a.riskLevel] - levelOrder[b.riskLevel])

    return riskCases.slice(0, 20) // 最多返回 20 個風險案例
  }

  /**
   * 評估風險等級
   */
  private assessRiskLevel(
    currentResult: string | null,
    newResult: string | null,
    actualValue: string
  ): { level: RiskLevel; reason: string } | null {
    const currentAccurate = currentResult === actualValue
    const newAccurate = newResult === actualValue

    // 惡化案例：當前正確 → 新規則錯誤
    if (currentAccurate && !newAccurate) {
      if (!newResult) {
        return { level: 'HIGH', reason: '新規則無法提取（當前規則可正確提取）' }
      }
      return { level: 'HIGH', reason: '新規則產生錯誤結果' }
    }

    // 當前錯誤 → 新規則仍錯誤（可能惡化更嚴重）
    if (!currentAccurate && !newAccurate && newResult && currentResult) {
      // 比較哪個更接近實際值
      const currentSimilarity = this.calculateSimilarity(currentResult, actualValue)
      const newSimilarity = this.calculateSimilarity(newResult, actualValue)

      if (newSimilarity < currentSimilarity - 0.2) {
        return { level: 'MEDIUM', reason: '新規則結果偏離更遠' }
      }
    }

    // 格式變化（可能的兼容性問題）
    if (newAccurate && currentAccurate && newResult !== currentResult) {
      return { level: 'LOW', reason: '提取格式可能變化' }
    }

    return null // 無風險
  }

  /**
   * 生成時間軸數據
   */
  private generateTimeline(
    documents: DocumentWithRelations[],
    suggestion: SuggestionWithForwarder
  ): TimelineItem[] {
    const timeline: Map<string, TimelineItem> = new Map()

    for (const doc of documents) {
      const date = doc.createdAt.toISOString().split('T')[0]

      if (!timeline.has(date)) {
        timeline.set(date, {
          date,
          affectedCount: 0,
          improvedCount: 0,
          regressedCount: 0
        })
      }

      const item = timeline.get(date)!
      item.affectedCount++

      const fieldValue = this.getFieldValue(doc, suggestion.fieldName)
      const correction = doc.corrections[0]
      const actualValue = correction?.correctedValue || fieldValue

      if (actualValue) {
        const rawText = doc.ocrResult?.extractedText || ''

        const currentResult = this.applyPattern(
          rawText,
          suggestion.currentPattern,
          suggestion.extractionType
        )
        const newResult = this.applyPattern(
          rawText,
          suggestion.suggestedPattern,
          suggestion.extractionType
        )

        const currentAccurate = currentResult === actualValue
        const newAccurate = newResult === actualValue

        if (!currentAccurate && newAccurate) {
          item.improvedCount++
        } else if (currentAccurate && !newAccurate) {
          item.regressedCount++
        }
      }
    }

    // 轉換為數組並按日期排序
    return Array.from(timeline.values())
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-30) // 最近 30 天
  }

  /**
   * 從文件中獲取指定欄位的值
   */
  private getFieldValue(doc: DocumentWithRelations, fieldName: string): string | null {
    if (!doc.extractionResult?.fieldMappings) return null

    const fieldMappings = doc.extractionResult.fieldMappings as Record<string, FieldMappingValue>
    const field = fieldMappings[fieldName]

    return field?.value || null
  }

  /**
   * 應用模式提取
   */
  private applyPattern(
    text: string,
    pattern: string | null,
    extractionType: string
  ): string | null {
    if (!pattern || !text) return null

    try {
      switch (extractionType) {
        case 'REGEX':
          const regex = new RegExp(pattern)
          const match = text.match(regex)
          return match ? match[0] : null

        case 'KEYWORD':
          const config = JSON.parse(pattern) as KeywordRuleConfig
          return this.applyKeywordRules(text, config.rules)

        default:
          return null
      }
    } catch {
      return null
    }
  }

  /**
   * 應用關鍵字規則
   */
  private applyKeywordRules(
    text: string,
    rules: KeywordRuleConfig['rules']
  ): string {
    let result = text

    for (const rule of rules) {
      if (rule.action === 'remove_prefix' && rule.value && result.startsWith(rule.value)) {
        result = result.slice(rule.value.length)
      } else if (rule.action === 'remove_suffix' && rule.value && result.endsWith(rule.value)) {
        result = result.slice(0, -rule.value.length)
      } else if (rule.action === 'normalize' && rule.pattern) {
        result = result.replace(new RegExp(rule.pattern, 'g'), '')
      } else if (rule.action === 'extract' && rule.pattern) {
        const extractMatch = result.match(new RegExp(rule.pattern))
        result = extractMatch ? extractMatch[0] : result
      }
    }

    return result
  }

  /**
   * 計算字串相似度
   */
  private calculateSimilarity(str1: string, str2: string): number {
    const s1 = str1.toLowerCase()
    const s2 = str2.toLowerCase()

    if (s1 === s2) return 1

    const longer = s1.length > s2.length ? s1 : s2
    const shorter = s1.length > s2.length ? s2 : s1

    if (longer.length === 0) return 1

    return (longer.length - this.editDistance(longer, shorter)) / longer.length
  }

  /**
   * 編輯距離
   */
  private editDistance(s1: string, s2: string): number {
    const m = s1.length
    const n = s2.length
    const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0))

    for (let i = 0; i <= m; i++) dp[i][0] = i
    for (let j = 0; j <= n; j++) dp[0][j] = j

    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (s1[i - 1] === s2[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1]
        } else {
          dp[i][j] = Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]) + 1
        }
      }
    }

    return dp[m][n]
  }
}

// 內部類型定義
interface DocumentWithRelations {
  id: string
  fileName: string
  createdAt: Date
  ocrResult: {
    extractedText: string
  } | null
  extractionResult: {
    fieldMappings: unknown
  } | null
  corrections: {
    fieldName: string
    originalValue: string | null
    correctedValue: string
  }[]
}

interface SuggestionWithForwarder {
  id: string
  fieldName: string
  currentPattern: string | null
  suggestedPattern: string
  extractionType: string
  forwarder: {
    id: string
    name: string
  }
}

export const impactAnalysisService = new ImpactAnalysisService()
