/**
 * @fileoverview 成本估算服務
 * @description
 *   提供批量文件處理的成本估算功能：
 *   - Azure Document Intelligence 成本計算
 *   - GPT-5.2 Vision 成本計算
 *   - 批量成本聚合和明細
 *
 * @module src/services/cost-estimation
 * @since Epic 0 - Story 0.2
 * @lastModified 2025-12-24
 *
 * @features
 *   - 根據文件類型和頁數估算處理成本
 *   - 支援批量文件成本聚合
 *   - 提供成本明細和統計資訊
 *
 * @dependencies
 *   - Prisma Client - 數據庫查詢
 *   - processing-router.service - 路由決策
 *
 * @related
 *   - src/services/processing-router.service.ts - 處理路由服務
 *   - src/components/features/historical-data/ProcessingConfirmDialog.tsx - 確認對話框
 */

import { DetectedFileType, ProcessingMethod } from '@prisma/client'
import { COST_CONFIG } from './processing-router.service'

// ============================================================
// Types
// ============================================================

/**
 * 單個處理方式的成本統計
 */
export interface MethodCostBreakdown {
  /** 處理方式 */
  method: ProcessingMethod
  /** 描述 */
  description: string
  /** 文件數量 */
  fileCount: number
  /** 估計總頁數 */
  estimatedPages: number
  /** 每頁成本 */
  costPerPage: number
  /** 估計總成本（USD） */
  estimatedCost: number
}

/**
 * 批量成本估算結果
 */
export interface BatchCostEstimation {
  /** Azure DI 成本明細 */
  azureDI: MethodCostBreakdown
  /** GPT Vision 成本明細 */
  gptVision: MethodCostBreakdown
  /** 總文件數 */
  totalFiles: number
  /** 總頁數估計 */
  totalPages: number
  /** 總成本估計（USD） */
  totalCost: number
  /** 貨幣單位 */
  currency: 'USD'
}

/**
 * 文件資訊（用於成本估算）
 */
export interface FileForCostEstimation {
  id: string
  detectedType: DetectedFileType | null
  /** 文件元數據中的頁數（可選） */
  pageCount?: number
}

// ============================================================
// Constants
// ============================================================

/**
 * 預設每個文件的頁數（用於無法確定頁數時）
 */
export const DEFAULT_PAGES_PER_FILE = 2

// ============================================================
// Core Functions
// ============================================================

/**
 * 從文件元數據中提取頁數
 *
 * @param file - 文件資訊
 * @returns 頁數
 */
export function getFilePageCount(file: FileForCostEstimation): number {
  return file.pageCount ?? DEFAULT_PAGES_PER_FILE
}

/**
 * 計算單個文件的處理成本
 *
 * @param file - 文件資訊
 * @returns 成本資訊
 */
export function estimateFileCost(file: FileForCostEstimation): {
  method: ProcessingMethod | null
  pageCount: number
  cost: number
} {
  if (!file.detectedType) {
    return { method: null, pageCount: 0, cost: 0 }
  }

  const pageCount = getFilePageCount(file)

  // 決定處理方式
  let method: ProcessingMethod
  let costPerPage: number

  switch (file.detectedType) {
    case DetectedFileType.NATIVE_PDF:
      method = ProcessingMethod.AZURE_DI
      costPerPage = COST_CONFIG.AZURE_DI.perPage
      break
    case DetectedFileType.SCANNED_PDF:
    case DetectedFileType.IMAGE:
      method = ProcessingMethod.GPT_VISION
      costPerPage = COST_CONFIG.GPT_VISION.perPage
      break
    default:
      return { method: null, pageCount: 0, cost: 0 }
  }

  return {
    method,
    pageCount,
    cost: pageCount * costPerPage,
  }
}

/**
 * 估算批量文件的處理成本
 *
 * @description
 *   遍歷所有文件，根據類型計算成本，
 *   並生成詳細的成本明細報告。
 *
 * @param files - 文件列表
 * @returns 批量成本估算結果
 *
 * @example
 * ```typescript
 * const files = [
 *   { id: '1', detectedType: 'NATIVE_PDF', pageCount: 3 },
 *   { id: '2', detectedType: 'SCANNED_PDF' },
 * ]
 * const estimation = estimateBatchCost(files)
 * // estimation.azureDI.estimatedCost = 0.03 (3 pages * $0.01)
 * // estimation.gptVision.estimatedCost = 0.06 (2 pages * $0.03)
 * ```
 */
export function estimateBatchCost(
  files: FileForCostEstimation[]
): BatchCostEstimation {
  // 初始化統計
  let azureDIFileCount = 0
  let azureDIPages = 0
  let gptVisionFileCount = 0
  let gptVisionPages = 0

  // 遍歷文件
  for (const file of files) {
    if (!file.detectedType) {
      continue
    }

    const pageCount = getFilePageCount(file)

    switch (file.detectedType) {
      case DetectedFileType.NATIVE_PDF:
        azureDIFileCount++
        azureDIPages += pageCount
        break
      case DetectedFileType.SCANNED_PDF:
      case DetectedFileType.IMAGE:
        gptVisionFileCount++
        gptVisionPages += pageCount
        break
    }
  }

  // 計算成本
  const azureDICost = azureDIPages * COST_CONFIG.AZURE_DI.perPage
  const gptVisionCost = gptVisionPages * COST_CONFIG.GPT_VISION.perPage

  return {
    azureDI: {
      method: ProcessingMethod.AZURE_DI,
      description: COST_CONFIG.AZURE_DI.description,
      fileCount: azureDIFileCount,
      estimatedPages: azureDIPages,
      costPerPage: COST_CONFIG.AZURE_DI.perPage,
      estimatedCost: azureDICost,
    },
    gptVision: {
      method: ProcessingMethod.GPT_VISION,
      description: COST_CONFIG.GPT_VISION.description,
      fileCount: gptVisionFileCount,
      estimatedPages: gptVisionPages,
      costPerPage: COST_CONFIG.GPT_VISION.perPage,
      estimatedCost: gptVisionCost,
    },
    totalFiles: azureDIFileCount + gptVisionFileCount,
    totalPages: azureDIPages + gptVisionPages,
    totalCost: azureDICost + gptVisionCost,
    currency: 'USD',
  }
}

/**
 * 格式化成本顯示
 *
 * @param cost - 成本金額
 * @param currency - 貨幣單位（預設 USD）
 * @returns 格式化的成本字串
 *
 * @example
 * ```typescript
 * formatCost(0.15) // Returns: "$0.15"
 * formatCost(1.5) // Returns: "$1.50"
 * ```
 */
export function formatCost(cost: number, currency: string = 'USD'): string {
  const symbol = currency === 'USD' ? '$' : currency
  return `${symbol}${cost.toFixed(2)}`
}

/**
 * 生成成本估算摘要文字
 *
 * @param estimation - 批量成本估算結果
 * @returns 摘要文字
 */
export function generateCostSummary(estimation: BatchCostEstimation): string {
  const lines: string[] = []

  lines.push(`總文件數: ${estimation.totalFiles}`)
  lines.push(`預估總頁數: ${estimation.totalPages}`)
  lines.push('')

  if (estimation.azureDI.fileCount > 0) {
    lines.push(`Azure Document Intelligence:`)
    lines.push(`  - 文件數: ${estimation.azureDI.fileCount}`)
    lines.push(`  - 預估頁數: ${estimation.azureDI.estimatedPages}`)
    lines.push(`  - 預估成本: ${formatCost(estimation.azureDI.estimatedCost)}`)
    lines.push('')
  }

  if (estimation.gptVision.fileCount > 0) {
    lines.push(`GPT-5.2 Vision:`)
    lines.push(`  - 文件數: ${estimation.gptVision.fileCount}`)
    lines.push(`  - 預估頁數: ${estimation.gptVision.estimatedPages}`)
    lines.push(`  - 預估成本: ${formatCost(estimation.gptVision.estimatedCost)}`)
    lines.push('')
  }

  lines.push(`總預估成本: ${formatCost(estimation.totalCost)}`)

  return lines.join('\n')
}

/**
 * 計算實際處理成本
 *
 * @description
 *   根據實際處理結果計算成本，用於處理完成後記錄。
 *
 * @param method - 使用的處理方式
 * @param actualPages - 實際頁數
 * @returns 實際成本（USD）
 */
export function calculateActualCost(
  method: ProcessingMethod,
  actualPages: number
): number {
  const config = COST_CONFIG[method]
  return actualPages * config.perPage
}
