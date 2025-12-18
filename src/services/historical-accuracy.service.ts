/**
 * @fileoverview 歷史準確率服務
 * @description
 *   管理欄位提取的歷史準確率數據：
 *   - 查詢特定欄位的歷史準確率
 *   - 查詢特定 Forwarder 所有欄位的準確率
 *   - 記錄欄位修正事件以更新準確率
 *   - 按時間週期聚合準確率數據
 *
 *   歷史準確率用於信心度計算的加權因素之一（15% 權重）。
 *   樣本數量影響歷史準確率的可信度：
 *   - <100 樣本：與預設值混合
 *   - ≥100 樣本：完全信任歷史數據
 *
 * @module src/services/historical-accuracy
 * @since Epic 2 - Story 2.5 (Confidence Score Calculation)
 * @lastModified 2025-12-18
 *
 * @dependencies
 *   - @/lib/prisma - Prisma 客戶端
 *   - @/types/confidence - 準確率類型定義
 *
 * @related
 *   - src/lib/confidence/calculator.ts - 使用歷史準確率計算信心度
 *   - src/services/confidence.service.ts - 整合準確率服務
 *   - prisma/schema.prisma - FieldCorrectionHistory model
 */

import { prisma } from '@/lib/prisma'
import type {
  HistoricalAccuracyData,
  ForwarderFieldAccuracy,
} from '@/types/confidence'

// ============================================================
// Constants
// ============================================================

/** 默認歷史準確率（無數據時使用） */
const DEFAULT_ACCURACY = 85

/** 默認樣本數量（無數據時使用） */
const DEFAULT_SAMPLE_SIZE = 0

// ============================================================
// Query Functions
// ============================================================

/**
 * 獲取特定欄位的歷史準確率
 *
 * @description
 *   查詢指定欄位在指定 Forwarder 下的歷史準確率。
 *   優先返回最近的統計數據。
 *   如果沒有數據，返回預設值。
 *
 * @param fieldName - 欄位名稱
 * @param forwarderId - Forwarder ID（可選，NULL 表示通用規則）
 * @returns 歷史準確率數據
 *
 * @example
 *   const accuracy = await getHistoricalAccuracy('invoice_number', 'fw_123')
 *   // { accuracy: 92.5, sampleSize: 150 }
 */
export async function getHistoricalAccuracy(
  fieldName: string,
  forwarderId?: string | null
): Promise<HistoricalAccuracyData> {
  try {
    // 查詢最近的準確率記錄
    const history = await prisma.fieldCorrectionHistory.findFirst({
      where: {
        fieldName,
        forwarderId: forwarderId ?? null,
      },
      orderBy: {
        periodEnd: 'desc',
      },
    })

    if (!history) {
      return {
        accuracy: DEFAULT_ACCURACY,
        sampleSize: DEFAULT_SAMPLE_SIZE,
      }
    }

    return {
      accuracy: history.accuracy,
      sampleSize: history.totalExtractions,
    }
  } catch (error) {
    console.error(
      `[HistoricalAccuracy] Error fetching accuracy for field ${fieldName}:`,
      error
    )
    return {
      accuracy: DEFAULT_ACCURACY,
      sampleSize: DEFAULT_SAMPLE_SIZE,
    }
  }
}

/**
 * 獲取 Forwarder 所有欄位的歷史準確率
 *
 * @description
 *   批量查詢指定 Forwarder 下所有欄位的歷史準確率。
 *   用於文件級別的信心度計算。
 *
 * @param forwarderId - Forwarder ID
 * @returns 欄位名稱到準確率數據的映射
 *
 * @example
 *   const accuracies = await getForwarderFieldAccuracy('fw_123')
 *   // { invoice_number: { accuracy: 92.5, sampleSize: 150 }, ... }
 */
export async function getForwarderFieldAccuracy(
  forwarderId: string
): Promise<ForwarderFieldAccuracy> {
  try {
    // 查詢該 Forwarder 所有欄位的最新準確率
    const histories = await prisma.fieldCorrectionHistory.findMany({
      where: {
        forwarderId,
      },
      orderBy: {
        periodEnd: 'desc',
      },
      distinct: ['fieldName'],
    })

    const result: ForwarderFieldAccuracy = {}

    for (const history of histories) {
      result[history.fieldName] = {
        accuracy: history.accuracy,
        sampleSize: history.totalExtractions,
      }
    }

    return result
  } catch (error) {
    console.error(
      `[HistoricalAccuracy] Error fetching forwarder accuracy for ${forwarderId}:`,
      error
    )
    return {}
  }
}

/**
 * 獲取通用欄位的歷史準確率
 *
 * @description
 *   查詢不特定於任何 Forwarder 的通用準確率數據。
 *
 * @returns 欄位名稱到準確率數據的映射
 */
export async function getUniversalFieldAccuracy(): Promise<ForwarderFieldAccuracy> {
  try {
    const histories = await prisma.fieldCorrectionHistory.findMany({
      where: {
        forwarderId: null,
      },
      orderBy: {
        periodEnd: 'desc',
      },
      distinct: ['fieldName'],
    })

    const result: ForwarderFieldAccuracy = {}

    for (const history of histories) {
      result[history.fieldName] = {
        accuracy: history.accuracy,
        sampleSize: history.totalExtractions,
      }
    }

    return result
  } catch (error) {
    console.error('[HistoricalAccuracy] Error fetching universal accuracy:', error)
    return {}
  }
}

// ============================================================
// Record Functions
// ============================================================

/**
 * 記錄欄位修正事件
 *
 * @description
 *   當用戶確認或修正提取結果時，記錄該事件以更新歷史準確率。
 *   自動處理週期聚合，將修正記錄到當前週期。
 *
 * @param fieldName - 欄位名稱
 * @param forwarderId - Forwarder ID（可選）
 * @param wasCorrect - 提取是否正確（true = 正確，false = 被修正）
 *
 * @example
 *   // 用戶確認提取正確
 *   await recordFieldCorrection('invoice_number', 'fw_123', true)
 *
 *   // 用戶修正了提取結果
 *   await recordFieldCorrection('total_amount', 'fw_123', false)
 */
export async function recordFieldCorrection(
  fieldName: string,
  forwarderId: string | null,
  wasCorrect: boolean
): Promise<void> {
  try {
    // 計算當前週期的起止時間
    const now = new Date()
    const periodStart = getPeriodStart(now)
    const periodEnd = getPeriodEnd(periodStart)

    // 先查找是否存在記錄
    const existing = await prisma.fieldCorrectionHistory.findFirst({
      where: {
        fieldName,
        forwarderId: forwarderId,
        periodStart,
      },
    })

    if (existing) {
      // 更新現有記錄
      const newTotalExtractions = existing.totalExtractions + 1
      const newCorrectExtractions = existing.correctExtractions + (wasCorrect ? 1 : 0)
      const newAccuracy = (newCorrectExtractions / newTotalExtractions) * 100

      await prisma.fieldCorrectionHistory.update({
        where: { id: existing.id },
        data: {
          totalExtractions: newTotalExtractions,
          correctExtractions: newCorrectExtractions,
          accuracy: Math.round(newAccuracy * 100) / 100,
        },
      })
    } else {
      // 創建新記錄
      await prisma.fieldCorrectionHistory.create({
        data: {
          forwarderId,
          fieldName,
          totalExtractions: 1,
          correctExtractions: wasCorrect ? 1 : 0,
          accuracy: wasCorrect ? 100 : 0,
          periodStart,
          periodEnd,
        },
      })
    }
  } catch (error) {
    console.error(
      `[HistoricalAccuracy] Error recording correction for field ${fieldName}:`,
      error
    )
    throw error
  }
}

/**
 * 批量記錄欄位修正事件
 *
 * @description
 *   一次性記錄多個欄位的修正結果，用於文件級別的審核確認。
 *
 * @param corrections - 修正記錄陣列
 *
 * @example
 *   await recordFieldCorrections([
 *     { fieldName: 'invoice_number', forwarderId: 'fw_123', wasCorrect: true },
 *     { fieldName: 'total_amount', forwarderId: 'fw_123', wasCorrect: false },
 *   ])
 */
export async function recordFieldCorrections(
  corrections: Array<{
    fieldName: string
    forwarderId: string | null
    wasCorrect: boolean
  }>
): Promise<void> {
  // 使用 Promise.all 並行處理，但使用 allSettled 避免單個失敗影響其他
  const results = await Promise.allSettled(
    corrections.map((c) => recordFieldCorrection(c.fieldName, c.forwarderId, c.wasCorrect))
  )

  // 記錄任何失敗
  const failures = results.filter((r) => r.status === 'rejected')
  if (failures.length > 0) {
    console.error(
      `[HistoricalAccuracy] ${failures.length} corrections failed:`,
      failures
    )
  }
}

// ============================================================
// Aggregation Functions
// ============================================================

/**
 * 聚合歷史準確率數據
 *
 * @description
 *   將多個週期的數據聚合為單一統計結果。
 *   用於生成長期準確率報告。
 *
 * @param fieldName - 欄位名稱
 * @param forwarderId - Forwarder ID（可選）
 * @param startDate - 開始日期
 * @param endDate - 結束日期
 * @returns 聚合後的準確率數據
 */
export async function aggregateHistoricalAccuracy(
  fieldName: string,
  forwarderId: string | null,
  startDate: Date,
  endDate: Date
): Promise<HistoricalAccuracyData> {
  try {
    const histories = await prisma.fieldCorrectionHistory.findMany({
      where: {
        fieldName,
        forwarderId: forwarderId ?? null,
        periodStart: { gte: startDate },
        periodEnd: { lte: endDate },
      },
    })

    if (histories.length === 0) {
      return {
        accuracy: DEFAULT_ACCURACY,
        sampleSize: DEFAULT_SAMPLE_SIZE,
      }
    }

    // 計算總和
    const totals = histories.reduce(
      (acc, h) => ({
        totalExtractions: acc.totalExtractions + h.totalExtractions,
        correctExtractions: acc.correctExtractions + h.correctExtractions,
      }),
      { totalExtractions: 0, correctExtractions: 0 }
    )

    const accuracy =
      totals.totalExtractions > 0
        ? (totals.correctExtractions / totals.totalExtractions) * 100
        : DEFAULT_ACCURACY

    return {
      accuracy: Math.round(accuracy * 100) / 100,
      sampleSize: totals.totalExtractions,
    }
  } catch (error) {
    console.error(
      `[HistoricalAccuracy] Error aggregating accuracy for field ${fieldName}:`,
      error
    )
    return {
      accuracy: DEFAULT_ACCURACY,
      sampleSize: DEFAULT_SAMPLE_SIZE,
    }
  }
}

// ============================================================
// Helper Functions
// ============================================================

/**
 * 計算週期開始時間
 *
 * @param date - 參考日期
 * @returns 週期開始時間（當月第一天）
 */
function getPeriodStart(date: Date): Date {
  const start = new Date(date)
  start.setDate(1)
  start.setHours(0, 0, 0, 0)
  return start
}

/**
 * 計算週期結束時間
 *
 * @param periodStart - 週期開始時間
 * @returns 週期結束時間（下月第一天前一毫秒）
 */
function getPeriodEnd(periodStart: Date): Date {
  const end = new Date(periodStart)
  end.setMonth(end.getMonth() + 1)
  end.setMilliseconds(-1)
  return end
}

/**
 * 檢查是否有足夠樣本量
 *
 * @param sampleSize - 樣本數量
 * @param threshold - 閾值（預設 100）
 * @returns 是否有足夠樣本
 */
export function hasSufficientSamples(
  sampleSize: number,
  threshold: number = 100
): boolean {
  return sampleSize >= threshold
}
