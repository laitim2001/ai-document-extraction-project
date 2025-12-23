/**
 * @fileoverview 修正模式分析器
 * @description
 *   分析用戶的修正模式，用於：
 *   - 統計相同模式的修正次數
 *   - 檢測是否達到規則建議閾值
 *   - 獲取最常見的修正模式
 *
 * @module src/lib/learning/correctionAnalyzer
 * @since Epic 3 - Story 3.6 (修正類型標記)
 * @lastModified 2025-12-22
 * @refactor REFACTOR-001 (Forwarder → Company)
 *
 * @features
 *   - AC2: 正常修正處理 - 記錄學習統計
 *   - AC4: 觸發規則升級建議 - 檢查修正閾值
 *
 * @dependencies
 *   - @/lib/prisma - 資料庫客戶端
 *   - @prisma/client - Prisma 類型
 */

import { prisma } from '@/lib/prisma'
import { CorrectionType } from '@prisma/client'

// ============================================================
// Constants
// ============================================================

/** 觸發規則建議的修正次數閾值 */
export const CORRECTION_THRESHOLD = 3

/** 分析週期（天） */
export const ANALYSIS_PERIOD_DAYS = 30

// ============================================================
// Types
// ============================================================

/**
 * 修正模式介面
 * @refactor REFACTOR-001: forwarderId → companyId
 */
export interface CorrectionPattern {
  /** Company ID */
  companyId: string
  /** 欄位名稱 */
  fieldName: string
  /** 原始值模式 */
  originalPattern: string | null
  /** 修正後的值 */
  correctedPattern: string
  /** 修正次數 */
  count: number
}

// ============================================================
// Functions
// ============================================================

/**
 * 分析修正模式
 *
 * @description
 *   根據文件 ID 和欄位資訊，分析該修正的模式並統計次數。
 *   只計算 NORMAL 類型的修正。
 *
 * @param documentId - 文件 ID
 * @param fieldName - 欄位名稱
 * @param originalValue - 原始值
 * @param correctedValue - 修正後的值
 * @returns 修正模式資訊，若無法分析則返回 null
 * @refactor REFACTOR-001: forwarderId → companyId
 *
 * @example
 * ```typescript
 * const pattern = await analyzeCorrectionPattern(
 *   'doc-123',
 *   'invoiceNumber',
 *   'INV123',
 *   'INV-123'
 * )
 * // { companyId: 'cmp-1', fieldName: 'invoiceNumber', count: 3 }
 * ```
 */
export async function analyzeCorrectionPattern(
  documentId: string,
  fieldName: string,
  originalValue: string | null,
  correctedValue: string
): Promise<CorrectionPattern | null> {
  // REFACTOR-001: 獲取文件的 Company (原 Forwarder)
  const document = await prisma.document.findUnique({
    where: { id: documentId },
    select: { companyId: true },
  })

  if (!document?.companyId) {
    return null
  }

  // 計算分析期間
  const since = new Date()
  since.setDate(since.getDate() - ANALYSIS_PERIOD_DAYS)

  // REFACTOR-001: 統計相同模式的修正次數 (companyId)
  const count = await prisma.correction.count({
    where: {
      document: { companyId: document.companyId },
      fieldName,
      correctedValue,
      correctionType: CorrectionType.NORMAL,
      createdAt: { gte: since },
    },
  })

  return {
    companyId: document.companyId,
    fieldName,
    originalPattern: originalValue,
    correctedPattern: correctedValue,
    count: count + 1, // 加上當前修正
  }
}

/**
 * 檢查是否達到修正閾值
 *
 * @description
 *   檢查特定 Company 的特定欄位是否達到觸發規則建議的閾值。
 *   只計算 NORMAL 類型的修正。
 *
 * @param companyId - Company ID
 * @param fieldName - 欄位名稱
 * @returns 是否達到閾值
 * @refactor REFACTOR-001: forwarderId → companyId
 *
 * @example
 * ```typescript
 * const shouldTrigger = await checkCorrectionThreshold('cmp-1', 'invoiceNumber')
 * if (shouldTrigger) {
 *   // 創建規則建議
 * }
 * ```
 */
export async function checkCorrectionThreshold(
  companyId: string,
  fieldName: string
): Promise<boolean> {
  const since = new Date()
  since.setDate(since.getDate() - ANALYSIS_PERIOD_DAYS)

  // REFACTOR-001: companyId 取代 forwarderId
  const count = await prisma.correction.count({
    where: {
      document: { companyId },
      fieldName,
      correctionType: CorrectionType.NORMAL,
      createdAt: { gte: since },
    },
  })

  return count >= CORRECTION_THRESHOLD
}

/**
 * 獲取最常見的修正模式
 *
 * @description
 *   獲取特定 Company 和欄位的最常見修正值。
 *   用於生成規則建議時確定建議的映射模式。
 *
 * @param companyId - Company ID
 * @param fieldName - 欄位名稱
 * @returns 最常見的修正值和次數，若無則返回 null
 * @refactor REFACTOR-001: forwarderId → companyId
 *
 * @example
 * ```typescript
 * const pattern = await getMostCommonCorrection('cmp-1', 'invoiceNumber')
 * // { correctedValue: 'INV-123', count: 5 }
 * ```
 */
export async function getMostCommonCorrection(
  companyId: string,
  fieldName: string
): Promise<{ correctedValue: string; count: number } | null> {
  const since = new Date()
  since.setDate(since.getDate() - ANALYSIS_PERIOD_DAYS)

  // REFACTOR-001: companyId 取代 forwarderId
  const result = await prisma.correction.groupBy({
    by: ['correctedValue'],
    where: {
      document: { companyId },
      fieldName,
      correctionType: CorrectionType.NORMAL,
      createdAt: { gte: since },
    },
    _count: { correctedValue: true },
    orderBy: { _count: { correctedValue: 'desc' } },
    take: 1,
  })

  if (result.length === 0) {
    return null
  }

  return {
    correctedValue: result[0].correctedValue,
    count: result[0]._count.correctedValue,
  }
}

/**
 * 獲取欄位修正統計
 *
 * @description
 *   獲取特定 Company 所有欄位的修正統計資料。
 *   用於儀表板顯示和規則管理。
 *
 * @param companyId - Company ID
 * @returns 按欄位分組的修正統計
 * @refactor REFACTOR-001: forwarderId → companyId
 */
export async function getFieldCorrectionStats(
  companyId: string
): Promise<Array<{ fieldName: string; totalCount: number; normalCount: number; exceptionCount: number }>> {
  const since = new Date()
  since.setDate(since.getDate() - ANALYSIS_PERIOD_DAYS)

  // REFACTOR-001: 獲取所有修正記錄按欄位分組 (companyId)
  const stats = await prisma.correction.groupBy({
    by: ['fieldName', 'correctionType'],
    where: {
      document: { companyId },
      createdAt: { gte: since },
    },
    _count: true,
  })

  // 整合統計資料
  const fieldStats = new Map<string, { totalCount: number; normalCount: number; exceptionCount: number }>()

  for (const stat of stats) {
    const existing = fieldStats.get(stat.fieldName) || {
      totalCount: 0,
      normalCount: 0,
      exceptionCount: 0,
    }

    existing.totalCount += stat._count
    if (stat.correctionType === CorrectionType.NORMAL) {
      existing.normalCount += stat._count
    } else {
      existing.exceptionCount += stat._count
    }

    fieldStats.set(stat.fieldName, existing)
  }

  return Array.from(fieldStats.entries()).map(([fieldName, counts]) => ({
    fieldName,
    ...counts,
  }))
}
