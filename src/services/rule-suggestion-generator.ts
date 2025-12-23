/**
 * @fileoverview 規則建議生成服務
 * @description
 *   從 CANDIDATE 狀態的修正模式生成規則升級建議。
 *   包含以下核心功能：
 *   - 從修正模式生成建議
 *   - 規則推斷與信心度計算
 *   - 影響分析與風險識別
 *   - Super User 通知
 *
 * @module src/services/rule-suggestion-generator
 * @since Epic 4 - Story 4.4 (規則升級建議生成)
 * @lastModified 2025-12-19
 *
 * @features
 *   - AC1: 自動生成規則升級建議
 *   - AC2: 通知 Super User 審核
 *   - 批量處理 CANDIDATE 模式
 *   - 預期影響計算
 *
 * @dependencies
 *   - @/lib/prisma - 資料庫客戶端
 *   - @/services/rule-inference - 規則推斷引擎
 *   - @/services/notification.service - 通知服務
 *   - @/types/suggestion - 建議相關類型
 */

import { prisma } from '@/lib/prisma'
import { ruleInferenceEngine } from './rule-inference'
import { notifySuperUsers, NOTIFICATION_TYPES } from './notification.service'
import {
  InferredRule,
  ExpectedImpact,
  RiskItem,
  CorrectionSample,
  BatchProcessResult,
} from '@/types/suggestion'

// ============================================================
// Types
// ============================================================

/**
 * 生成結果
 */
export interface GenerationResult {
  /** 建議 ID */
  suggestionId: string
  /** 推斷的規則 */
  inferredRule: InferredRule
  /** 預期影響 */
  impact: ExpectedImpact
}

// ============================================================
// Rule Suggestion Generator
// ============================================================

/**
 * 規則建議生成服務
 *
 * @description
 *   從 CANDIDATE 狀態的修正模式生成規則升級建議。
 *   包含規則推斷、影響分析、建議創建和通知發送。
 *
 * @example
 * ```typescript
 * // 從單一模式生成建議
 * const result = await ruleSuggestionGenerator.generateFromPattern('pattern-id');
 *
 * // 批量處理所有候選模式
 * const batchResult = await ruleSuggestionGenerator.processAllCandidates();
 * ```
 */
export class RuleSuggestionGenerator {
  /**
   * 從修正模式生成建議
   *
   * @param patternId - 修正模式 ID
   * @returns 生成結果
   * @throws 當模式不存在或狀態不正確時拋出錯誤
   */
  async generateFromPattern(patternId: string): Promise<GenerationResult> {
    // 1. 獲取模式及相關修正
    const pattern = await prisma.correctionPattern.findUnique({
      where: { id: patternId },
      include: {
        company: true,
        corrections: {
          include: {
            document: {
              select: {
                id: true,
                fileName: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    })

    if (!pattern) {
      throw new Error(`Pattern ${patternId} not found`)
    }

    if (pattern.status !== 'CANDIDATE') {
      throw new Error(`Pattern ${patternId} is not in CANDIDATE status`)
    }

    // 檢查是否已有建議
    const existingSuggestion = await prisma.ruleSuggestion.findUnique({
      where: { patternId },
    })

    if (existingSuggestion) {
      throw new Error(`Suggestion already exists for pattern ${patternId}`)
    }

    // 2. 推斷最佳規則
    const samples: CorrectionSample[] = pattern.corrections.map((c) => ({
      originalValue: c.originalValue || '',
      correctedValue: c.correctedValue,
      context: c.extractionContext as CorrectionSample['context'],
    }))

    const inferredRule = await ruleInferenceEngine.inferBestRule(samples)

    // 3. 獲取現有規則（如果有）
    const existingRule = await prisma.mappingRule.findFirst({
      where: {
        companyId: pattern.companyId,
        fieldName: pattern.fieldName,
        status: 'ACTIVE',
      },
      select: {
        extractionPattern: true,
      },
    })

    // 從 extractionPattern (Json) 中提取 pattern 字串
    const currentPatternString = existingRule?.extractionPattern
      ? JSON.stringify(existingRule.extractionPattern)
      : null

    // 4. 計算預期影響
    const impact = await this.calculateImpact(
      pattern.companyId,
      pattern.fieldName,
      inferredRule,
      currentPatternString
    )

    // 5. 創建建議記錄
    const suggestion = await prisma.ruleSuggestion.create({
      data: {
        companyId: pattern.companyId,
        fieldName: pattern.fieldName,
        extractionType: inferredRule.type,
        currentPattern: currentPatternString,
        suggestedPattern: inferredRule.pattern,
        confidence: inferredRule.confidence,
        source: 'AUTO_LEARNING',
        correctionCount: pattern.occurrenceCount,
        expectedImpact: impact as object,
        status: 'PENDING',
        priority: this.calculatePriority(pattern.occurrenceCount, inferredRule.confidence),
        patternId: pattern.id,
        sampleCases: {
          create: pattern.corrections.slice(0, 5).map((c) => ({
            documentId: c.document.id,
            originalValue: c.originalValue || '',
            correctedValue: c.correctedValue,
          })),
        },
      },
    })

    // 6. 更新模式狀態
    await prisma.correctionPattern.update({
      where: { id: pattern.id },
      data: { status: 'SUGGESTED' },
    })

    // 7. 發送通知
    await this.notifySuperUsers(suggestion.id, pattern.fieldName, pattern.occurrenceCount)

    return {
      suggestionId: suggestion.id,
      inferredRule,
      impact,
    }
  }

  /**
   * 批量處理 CANDIDATE 模式
   *
   * @returns 批量處理結果
   */
  async processAllCandidates(): Promise<BatchProcessResult> {
    const candidates = await prisma.correctionPattern.findMany({
      where: {
        status: 'CANDIDATE',
        suggestion: null, // 尚未生成建議
      },
      orderBy: { occurrenceCount: 'desc' },
      take: 50, // 批次處理上限
    })

    let succeeded = 0
    let failed = 0
    const errors: string[] = []

    for (const candidate of candidates) {
      try {
        await this.generateFromPattern(candidate.id)
        succeeded++
      } catch (error) {
        failed++
        errors.push(
          `Pattern ${candidate.id}: ${error instanceof Error ? error.message : 'Unknown error'}`
        )
      }
    }

    return {
      processed: candidates.length,
      succeeded,
      failed,
      errors,
    }
  }

  /**
   * 計算預期影響
   *
   * @param companyId - Company ID
   * @param fieldName - 欄位名稱
   * @param rule - 推斷的規則
   * @param currentPattern - 現有規則模式
   * @returns 預期影響分析
   */
  private async calculateImpact(
    companyId: string,
    fieldName: string,
    rule: InferredRule,
    currentPattern: string | null
  ): Promise<ExpectedImpact> {
    // 查詢最近 30 天的相關文件及其修正記錄
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const documents = await prisma.document.findMany({
      where: {
        companyId,
        createdAt: { gte: thirtyDaysAgo },
      },
      include: {
        corrections: {
          where: { fieldName },
          select: {
            originalValue: true,
            correctedValue: true,
          },
        },
        extractionResult: {
          select: {
            fieldMappings: true,
          },
        },
      },
      take: 100,
    })

    // 轉換文件數據以便模擬
    const documentsForSimulation = documents.map((doc) => {
      // 從 extractionResult.fieldMappings 中提取欄位值
      const fieldMappings = doc.extractionResult?.fieldMappings as Record<
        string,
        { value?: string | null }
      > | null
      const extractedValue = fieldMappings?.[fieldName]?.value ?? null

      return {
        corrections: doc.corrections,
        extractedFields: [{ value: extractedValue }],
      }
    })

    // 計算當前準確率
    let currentAccuracy: number | null = null
    if (currentPattern) {
      const totalWithCorrections = documentsForSimulation.filter(
        (d) => d.corrections.length > 0
      ).length
      const totalDocuments = documentsForSimulation.length
      if (totalDocuments > 0) {
        currentAccuracy = ((totalDocuments - totalWithCorrections) / totalDocuments) * 100
      }
    }

    // 模擬新規則應用
    const simulationResults = this.simulateRule(documentsForSimulation, rule, fieldName)

    // 識別潛在風險
    const potentialRisks = this.identifyRisks(rule, simulationResults)

    // 預測準確率
    const predictedAccuracy =
      simulationResults.tested > 0
        ? (simulationResults.matched / simulationResults.tested) * 100
        : rule.confidence * 100

    // 計算預估改善
    const estimatedImprovement =
      currentAccuracy !== null
        ? predictedAccuracy - currentAccuracy
        : predictedAccuracy - 80 // 假設基準為 80%

    return {
      affectedDocuments: documents.length,
      estimatedImprovement: Math.max(0, estimatedImprovement),
      currentAccuracy,
      predictedAccuracy,
      potentialRisks,
      simulationSummary: simulationResults,
    }
  }

  /**
   * 模擬規則應用
   *
   * @param documents - 文件列表
   * @param rule - 推斷的規則
   * @param fieldName - 欄位名稱
   * @returns 模擬結果
   */
  private simulateRule(
    documents: Array<{
      corrections: Array<{ originalValue: string | null; correctedValue: string }>
      extractedFields: Array<{ value: string | null }>
    }>,
    rule: InferredRule,
    _fieldName: string
  ): { tested: number; matched: number; improved: number; degraded: number } {
    let tested = 0
    let matched = 0
    let improved = 0
    let degraded = 0

    for (const doc of documents) {
      const correction = doc.corrections[0]
      if (!correction) continue

      tested++

      // 嘗試使用新規則提取
      const extracted = this.tryExtract(rule, correction.originalValue || '')

      if (extracted === correction.correctedValue) {
        matched++
        improved++
      } else if (extracted === doc.extractedFields[0]?.value) {
        // 與現有結果相同
      } else if (extracted) {
        // 提取到了不同的值
        degraded++
      }
    }

    return { tested, matched, improved, degraded }
  }

  /**
   * 嘗試使用規則提取
   *
   * @param rule - 規則
   * @param value - 原始值
   * @returns 提取的值，若失敗則返回 null
   */
  private tryExtract(rule: InferredRule, value: string): string | null {
    try {
      switch (rule.type) {
        case 'REGEX': {
          const regex = new RegExp(rule.pattern)
          const match = value.match(regex)
          return match ? match[0] : null
        }

        case 'KEYWORD': {
          const config = JSON.parse(rule.pattern)
          let result = value
          for (const r of config.rules) {
            if (r.action === 'remove_prefix' && result.startsWith(r.value)) {
              result = result.slice(r.value.length)
            } else if (r.action === 'remove_suffix' && result.endsWith(r.value)) {
              result = result.slice(0, -r.value.length)
            }
          }
          return result
        }

        default:
          return null
      }
    } catch {
      return null
    }
  }

  /**
   * 識別潛在風險
   *
   * @param rule - 推斷的規則
   * @param simulation - 模擬結果
   * @returns 風險項目列表
   */
  private identifyRisks(
    rule: InferredRule,
    simulation: { degraded: number; tested: number }
  ): RiskItem[] {
    const risks: RiskItem[] = []

    // 檢查退化率
    if (simulation.tested > 0 && simulation.degraded / simulation.tested > 0.1) {
      risks.push({
        type: 'false_positive',
        severity: 'high',
        description: `${Math.round((simulation.degraded / simulation.tested) * 100)}% 的測試案例可能產生錯誤結果`,
        affectedCount: simulation.degraded,
      })
    }

    // 檢查低信心度
    if (rule.confidence < 0.7) {
      risks.push({
        type: 'coverage_gap',
        severity: 'medium',
        description: `規則信心度較低 (${Math.round(rule.confidence * 100)}%)，可能無法覆蓋所有情況`,
      })
    }

    // 檢查規則類型風險
    if (rule.type === 'AI_PROMPT') {
      risks.push({
        type: 'format_change',
        severity: 'low',
        description: 'AI 提取規則可能產生不一致的結果格式',
      })
    }

    return risks
  }

  /**
   * 計算優先級
   *
   * @param occurrenceCount - 出現次數
   * @param confidence - 信心度
   * @returns 優先級分數 (0-100)
   */
  private calculatePriority(occurrenceCount: number, confidence: number): number {
    // 基於出現次數和信心度計算優先級
    // 高出現次數 + 高信心度 = 高優先級
    const countScore = Math.min(occurrenceCount / 10, 1) * 50
    const confidenceScore = confidence * 50
    return Math.round(countScore + confidenceScore)
  }

  /**
   * 通知 Super Users
   *
   * @param suggestionId - 建議 ID
   * @param fieldName - 欄位名稱
   * @param correctionCount - 修正次數
   */
  private async notifySuperUsers(
    suggestionId: string,
    fieldName: string,
    correctionCount: number
  ): Promise<void> {
    await notifySuperUsers({
      type: NOTIFICATION_TYPES.RULE_SUGGESTION,
      title: '新的規則升級建議',
      message: `系統發現「${fieldName}」欄位有 ${correctionCount} 次相似修正，已自動生成規則升級建議。`,
      data: {
        suggestionId,
        actionUrl: `/rules/suggestions/${suggestionId}`,
        actionLabel: '查看建議',
        priority: 'high',
      },
    })
  }
}

// 導出單例
export const ruleSuggestionGenerator = new RuleSuggestionGenerator()
