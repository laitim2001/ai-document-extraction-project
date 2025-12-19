/**
 * @fileoverview 規則建議觸發器
 * @description
 *   當修正次數達到閾值時，自動創建規則建議並通知 Super User。
 *   連結到 Epic 4 的規則管理功能。
 *
 * @module src/lib/learning/ruleSuggestionTrigger
 * @since Epic 3 - Story 3.6 (修正類型標記)
 * @lastModified 2025-12-18
 *
 * @features
 *   - AC4: 觸發規則升級建議
 *   - 創建 RuleSuggestion 記錄
 *   - 通知 Super User
 *
 * @dependencies
 *   - @/lib/prisma - 資料庫客戶端
 *   - @/lib/learning/correctionAnalyzer - 修正分析器
 *   - @/services/notificationService - 通知服務
 */

import { prisma } from '@/lib/prisma'
import { SuggestionStatus } from '@prisma/client'
import {
  checkCorrectionThreshold,
  getMostCommonCorrection,
} from './correctionAnalyzer'
import { notifySuperUsers } from '@/services/notification.service'

// ============================================================
// Types
// ============================================================

/**
 * 觸發結果介面
 */
export interface TriggerResult {
  /** 是否觸發了新建議 */
  triggered: boolean
  /** 建議 ID（若有） */
  suggestionId?: string
  /** 結果訊息 */
  message: string
}

// ============================================================
// Functions
// ============================================================

/**
 * 觸發規則建議檢查
 *
 * @description
 *   檢查特定文件欄位的修正是否達到閾值，若達到則：
 *   1. 獲取最常見的修正模式
 *   2. 檢查是否已存在相同建議
 *   3. 創建新的規則建議（或更新現有計數）
 *   4. 通知 Super User
 *
 * @param documentId - 文件 ID
 * @param fieldName - 欄位名稱
 * @param suggestedByUserId - 建議者用戶 ID（可選，用於記錄誰觸發了建議）
 * @returns 觸發結果
 *
 * @example
 * ```typescript
 * const result = await triggerRuleSuggestionCheck('doc-123', 'invoiceNumber', 'user-456')
 * if (result.triggered) {
 *   console.log('New rule suggestion created:', result.suggestionId)
 * }
 * ```
 */
export async function triggerRuleSuggestionCheck(
  documentId: string,
  fieldName: string,
  suggestedByUserId?: string
): Promise<TriggerResult> {
  // 獲取文件的 Forwarder
  const document = await prisma.document.findUnique({
    where: { id: documentId },
    select: {
      forwarderId: true,
      forwarder: { select: { name: true } },
    },
  })

  if (!document?.forwarderId) {
    return { triggered: false, message: 'No forwarder associated' }
  }

  // 檢查是否達到閾值
  const shouldTrigger = await checkCorrectionThreshold(
    document.forwarderId,
    fieldName
  )

  if (!shouldTrigger) {
    return { triggered: false, message: 'Threshold not reached' }
  }

  // 獲取最常見的修正模式
  const pattern = await getMostCommonCorrection(document.forwarderId, fieldName)

  if (!pattern) {
    return { triggered: false, message: 'No correction pattern found' }
  }

  // 檢查是否已存在相同的建議
  const existingSuggestion = await prisma.ruleSuggestion.findFirst({
    where: {
      forwarderId: document.forwarderId,
      fieldName,
      suggestedPattern: pattern.correctedValue,
      status: {
        in: [SuggestionStatus.PENDING, SuggestionStatus.APPROVED],
      },
    },
  })

  if (existingSuggestion) {
    // 更新計數
    await prisma.ruleSuggestion.update({
      where: { id: existingSuggestion.id },
      data: { correctionCount: pattern.count },
    })

    return {
      triggered: false,
      suggestionId: existingSuggestion.id,
      message: 'Suggestion already exists, count updated',
    }
  }

  // 如果沒有提供 suggestedByUserId，嘗試從最近的修正中獲取
  let suggesterId = suggestedByUserId
  if (!suggesterId) {
    const latestCorrection = await prisma.correction.findFirst({
      where: {
        document: { forwarderId: document.forwarderId },
        fieldName,
      },
      orderBy: { createdAt: 'desc' },
      select: { correctedBy: true },
    })
    suggesterId = latestCorrection?.correctedBy
  }

  // 如果仍然無法獲取建議者，則無法創建建議
  if (!suggesterId) {
    return {
      triggered: false,
      message: 'Cannot determine suggester user ID',
    }
  }

  // 創建新的規則建議
  const suggestion = await prisma.ruleSuggestion.create({
    data: {
      forwarderId: document.forwarderId,
      fieldName,
      extractionType: 'KEYWORD', // 預設使用 KEYWORD 類型，後續可透過規則推斷更新
      suggestedPattern: pattern.correctedValue,
      correctionCount: pattern.count,
      suggestedBy: suggesterId,
    },
  })

  // 通知 Super User
  try {
    await notifySuperUsers({
      type: 'RULE_SUGGESTION',
      title: '新的規則建議',
      message: `${document.forwarder?.name || 'Unknown'} 的 ${fieldName} 欄位有新的映射建議`,
      data: {
        suggestionId: suggestion.id,
        forwarderId: document.forwarderId,
        fieldName,
        suggestedPattern: pattern.correctedValue,
        correctionCount: pattern.count,
      },
    })
  } catch (error) {
    // 通知失敗不應影響主流程
    console.error('Failed to send notification:', error)
  }

  return {
    triggered: true,
    suggestionId: suggestion.id,
    message: 'Rule suggestion created and notifications sent',
  }
}

/**
 * 批量觸發規則建議檢查
 *
 * @description
 *   對多個欄位同時進行規則建議檢查。
 *   用於批量修正後的統一處理。
 *
 * @param documentId - 文件 ID
 * @param fieldNames - 欄位名稱列表
 * @param suggestedByUserId - 建議者用戶 ID（可選）
 * @returns 所有觸發結果
 */
export async function batchTriggerRuleSuggestionCheck(
  documentId: string,
  fieldNames: string[],
  suggestedByUserId?: string
): Promise<TriggerResult[]> {
  const results: TriggerResult[] = []

  for (const fieldName of fieldNames) {
    const result = await triggerRuleSuggestionCheck(documentId, fieldName, suggestedByUserId)
    results.push(result)
  }

  return results
}

/**
 * 獲取待審核的規則建議
 *
 * @description
 *   獲取指定 Forwarder 的所有待審核規則建議。
 *   用於 Epic 4 的規則管理介面。
 *
 * @param forwarderId - Forwarder ID（可選，不傳則獲取所有）
 * @returns 待審核的規則建議列表
 */
export async function getPendingRuleSuggestions(forwarderId?: string) {
  return prisma.ruleSuggestion.findMany({
    where: {
      status: SuggestionStatus.PENDING,
      ...(forwarderId && { forwarderId }),
    },
    include: {
      forwarder: {
        select: { name: true, code: true },
      },
    },
    orderBy: [
      { correctionCount: 'desc' },
      { createdAt: 'desc' },
    ],
  })
}
