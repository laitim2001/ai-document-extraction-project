/**
 * @fileoverview 規則模擬服務
 * @description
 *   對歷史數據執行規則模擬測試，包括：
 *   - 獲取樣本文件
 *   - 對每個文件執行模擬
 *   - 計算準確率變化
 *   - 分類結果（改善/惡化/無變化）
 *
 * @module src/services/rule-simulation
 * @since Epic 4 - Story 4.5
 * @lastModified 2025-12-19
 *
 * @dependencies
 *   - prisma - 資料庫存取
 *   - types/impact - 模擬測試類型定義
 */

import { prisma } from '@/lib/prisma'
import type {
  SimulationRequest,
  SimulationResult,
  SimulationCase,
  SimulationSummary,
  FieldMappingValue,
  KeywordRuleConfig
} from '@/types/impact'
import { randomUUID } from 'crypto'

/**
 * 規則模擬服務
 * 對歷史數據執行規則模擬測試
 */
export class RuleSimulationService {
  /**
   * 執行模擬測試
   * @param suggestionId - 規則建議 ID
   * @param options - 模擬選項
   * @returns 模擬結果
   */
  async simulate(
    suggestionId: string,
    options: SimulationRequest = {}
  ): Promise<SimulationResult> {
    const startTime = Date.now()

    const {
      sampleSize = 100,
      dateRange,
      includeUnverified = false
    } = options

    // 獲取建議詳情
    const suggestion = await prisma.ruleSuggestion.findUnique({
      where: { id: suggestionId },
      include: {
        company: true
      }
    })

    if (!suggestion) {
      throw new Error(`Suggestion ${suggestionId} not found`)
    }

    // REFACTOR-001: 驗證 companyId 和 company 存在
    if (!suggestion.companyId || !suggestion.company) {
      throw new Error(`Suggestion ${suggestionId} has no associated company`)
    }

    // 類型斷言確保 TypeScript 知道這些值不為 null
    const validatedSuggestion = suggestion as typeof suggestion & {
      companyId: string
      company: NonNullable<typeof suggestion.company>
    }

    // 構建日期範圍
    let startDate: Date
    let endDate = new Date()

    if (dateRange) {
      startDate = new Date(dateRange.start)
      endDate = new Date(dateRange.end)
    } else {
      startDate = new Date()
      startDate.setDate(startDate.getDate() - 30) // 默認最近 30 天
    }

    // 獲取樣本文件
    const documents = await this.getSampleDocuments(
      validatedSuggestion.companyId,
      validatedSuggestion.fieldName,
      startDate,
      endDate,
      sampleSize,
      includeUnverified
    )

    // 對每個文件執行模擬
    const cases: SimulationCase[] = []

    for (const doc of documents) {
      const simulationCase = this.simulateDocument(doc, validatedSuggestion)
      cases.push(simulationCase)
    }

    // 分類結果
    const results = {
      improved: cases.filter(c => c.changeType === 'improved'),
      regressed: cases.filter(c => c.changeType === 'regressed'),
      unchanged: cases.filter(c => c.changeType === 'unchanged')
    }

    // 計算摘要
    const summary = this.calculateSummary(cases)

    const duration = Date.now() - startTime

    return {
      simulationId: randomUUID(),
      suggestionId,
      totalTested: cases.length,
      results,
      summary,
      executedAt: new Date().toISOString(),
      duration
    }
  }

  /**
   * 獲取樣本文件
   */
  private async getSampleDocuments(
    forwarderId: string,
    fieldName: string,
    startDate: Date,
    endDate: Date,
    sampleSize: number,
    includeUnverified: boolean
  ): Promise<DocumentWithRelations[]> {
    // 基本查詢條件
    const baseWhere = {
      forwarderId,
      createdAt: {
        gte: startDate,
        lte: endDate
      }
    }

    // 如果不包含未驗證的，需要有修正記錄
    // 由於 Prisma 不支援直接在 where 中過濾 Json 欄位的內容，
    // 我們先獲取所有文件，然後在應用層過濾
    const documents = await prisma.document.findMany({
      where: baseWhere,
      include: {
        ocrResult: {
          select: { extractedText: true }
        },
        extractionResult: {
          select: { fieldMappings: true }
        },
        corrections: {
          where: { fieldName }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: sampleSize * 2 // 獲取更多以便過濾
    })

    // 過濾有效的樣本
    let filteredDocs = documents.filter(doc => {
      // 必須有 OCR 結果和提取結果
      if (!doc.ocrResult || !doc.extractionResult) return false

      // 檢查是否有該欄位的值
      const fieldMappings = doc.extractionResult.fieldMappings as Record<string, FieldMappingValue> | null
      const hasFieldValue = fieldMappings && fieldMappings[fieldName]?.value

      // 如果不包含未驗證的，需要有修正記錄或欄位值
      if (!includeUnverified) {
        return doc.corrections.length > 0 || hasFieldValue
      }

      return hasFieldValue || doc.corrections.length > 0
    })

    // 限制樣本數量
    filteredDocs = filteredDocs.slice(0, sampleSize)

    return filteredDocs.map(doc => ({
      id: doc.id,
      fileName: doc.fileName,
      createdAt: doc.createdAt,
      ocrResult: doc.ocrResult,
      extractionResult: doc.extractionResult,
      corrections: doc.corrections
    }))
  }

  /**
   * 對單一文件執行模擬
   */
  private simulateDocument(
    document: DocumentWithRelations,
    suggestion: SuggestionData
  ): SimulationCase {
    // 獲取欄位值
    const fieldValue = this.getFieldValue(document, suggestion.fieldName)
    const correction = document.corrections[0]

    // 原始提取值
    const originalExtracted = fieldValue

    // 實際值（用戶確認/修正後）
    const actualValue = correction?.correctedValue || fieldValue

    // 獲取原始文字
    const rawText = document.ocrResult?.extractedText || ''

    // 應用當前規則
    const currentRuleResult = this.applyRule(
      rawText,
      suggestion.currentPattern,
      suggestion.extractionType
    )

    // 應用新規則
    const newRuleResult = this.applyRule(
      rawText,
      suggestion.suggestedPattern,
      suggestion.extractionType
    )

    // 判斷準確性
    const currentAccurate = actualValue !== null && currentRuleResult === actualValue
    const newAccurate = actualValue !== null && newRuleResult === actualValue

    // 確定變化類型
    let changeType: 'improved' | 'regressed' | 'unchanged'
    if (!currentAccurate && newAccurate) {
      changeType = 'improved'
    } else if (currentAccurate && !newAccurate) {
      changeType = 'regressed'
    } else {
      changeType = 'unchanged'
    }

    return {
      documentId: document.id,
      fileName: document.fileName,
      originalExtracted,
      currentRuleResult,
      newRuleResult,
      actualValue,
      currentAccurate,
      newAccurate,
      changeType
    }
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
   * 應用規則
   */
  private applyRule(
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

        case 'POSITION':
          // 位置提取需要 PDF 座標，這裡簡化處理
          return null

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
      switch (rule.action) {
        case 'remove_prefix':
          if (rule.value && result.startsWith(rule.value)) {
            result = result.slice(rule.value.length)
          }
          break
        case 'remove_suffix':
          if (rule.value && result.endsWith(rule.value)) {
            result = result.slice(0, -rule.value.length)
          }
          break
        case 'normalize':
          if (rule.pattern) {
            result = result.replace(new RegExp(rule.pattern, 'g'), '')
          }
          break
        case 'extract':
          if (rule.pattern) {
            const extractMatch = result.match(new RegExp(rule.pattern))
            result = extractMatch ? extractMatch[0] : result
          }
          break
      }
    }

    return result
  }

  /**
   * 計算摘要統計
   */
  private calculateSummary(cases: SimulationCase[]): SimulationSummary {
    const totalTested = cases.length
    const improvedCount = cases.filter(c => c.changeType === 'improved').length
    const regressedCount = cases.filter(c => c.changeType === 'regressed').length
    const unchangedCount = cases.filter(c => c.changeType === 'unchanged').length

    // 計算準確率
    const casesWithActual = cases.filter(c => c.actualValue !== null)
    const currentAccurateCount = casesWithActual.filter(c => c.currentAccurate).length
    const newAccurateCount = casesWithActual.filter(c => c.newAccurate).length

    const accuracyBefore = casesWithActual.length > 0
      ? (currentAccurateCount / casesWithActual.length) * 100
      : null

    const accuracyAfter = casesWithActual.length > 0
      ? (newAccurateCount / casesWithActual.length) * 100
      : null

    const accuracyChange = accuracyBefore !== null && accuracyAfter !== null
      ? accuracyAfter - accuracyBefore
      : null

    return {
      totalTested,
      improvedCount,
      regressedCount,
      unchangedCount,
      accuracyBefore: accuracyBefore !== null ? Math.round(accuracyBefore * 10) / 10 : null,
      accuracyAfter: accuracyAfter !== null ? Math.round(accuracyAfter * 10) / 10 : null,
      accuracyChange: accuracyChange !== null ? Math.round(accuracyChange * 10) / 10 : null
    }
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

interface SuggestionData {
  id: string
  fieldName: string
  currentPattern: string | null
  suggestedPattern: string
  extractionType: string
  companyId: string | null // REFACTOR-001: 允許 null
  company: {
    id: string
    name: string
  } | null // REFACTOR-001: 允許 null
}

export const ruleSimulationService = new RuleSimulationService()
