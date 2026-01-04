/**
 * @fileoverview 處理路由服務
 * @description
 *   根據文件類型自動選擇最佳 AI 處理方式：
 *   - NATIVE_PDF → DUAL_PROCESSING（GPT Vision 分類 + Azure DI 數據）- CHANGE-001
 *   - SCANNED_PDF → GPT-5.2 Vision（完整處理：OCR + 分類 + 提取）
 *   - IMAGE → GPT-5.2 Vision（完整處理：OCR + 分類 + 提取）
 *
 * @module src/services/processing-router
 * @since Epic 0 - Story 0.2
 * @lastModified 2025-12-27
 *
 * @features
 *   - 根據 DetectedFileType 自動路由到對應處理服務
 *   - 支援批量文件路由決策
 *   - 返回處理方式和預估成本
 *   - CHANGE-001: Native PDF 雙重處理模式
 *
 * @dependencies
 *   - Prisma Client - 數據庫操作
 *   - cost-estimation.service - 成本估算
 *
 * @related
 *   - src/services/cost-estimation.service.ts - 成本估算服務
 *   - src/services/batch-processor.service.ts - 批量處理執行器
 *   - claudedocs/4-changes/feature-changes/CHANGE-001-native-pdf-dual-processing.md
 */

import { DetectedFileType, ProcessingMethod } from '@prisma/client'

// ============================================================
// Types
// ============================================================

/**
 * 處理路由結果
 */
export interface ProcessingRoute {
  /** 文件 ID */
  fileId: string
  /** 選擇的處理方式 */
  method: ProcessingMethod
  /** 文件類型 */
  detectedType: DetectedFileType
  /** 預估成本（USD） */
  estimatedCost: number
}

/**
 * 批量路由結果
 */
export interface BatchRoutingResult {
  /** 所有文件的路由結果 */
  routes: ProcessingRoute[]
  /** Azure DI 處理的文件統計 */
  azureDI: {
    fileCount: number
    fileIds: string[]
  }
  /** GPT Vision 處理的文件統計 */
  gptVision: {
    fileCount: number
    fileIds: string[]
  }
  /** CHANGE-001: 雙重處理的文件統計 */
  dualProcessing: {
    fileCount: number
    fileIds: string[]
  }
  /** 總預估成本 */
  totalEstimatedCost: number
}

/**
 * 處理文件資訊（用於路由決策）
 */
export interface FileForRouting {
  id: string
  detectedType: DetectedFileType | null
  pageCount?: number
}

// ============================================================
// Constants
// ============================================================

/**
 * 成本配置
 * @description
 *   - AZURE_DI: 僅數據提取（原生 PDF）
 *   - GPT_VISION: 完整處理（掃描 PDF、圖片）
 *   - DUAL_PROCESSING: GPT Vision（分類）+ Azure DI（數據）- CHANGE-001
 */
export const COST_CONFIG = {
  AZURE_DI: {
    perPage: 0.01, // USD per page
    description: 'Azure Document Intelligence',
    avgPagesPerFile: 2, // 預設每個文件的頁數
  },
  GPT_VISION: {
    perPage: 0.03, // USD per page (平均值)
    description: 'GPT-5.2 Vision',
    avgPagesPerFile: 2, // 預設每個文件的頁數
  },
  DUAL_PROCESSING: {
    perPage: 0.02, // USD per page (GPT Vision 分類 ~$0.01 + Azure DI 數據 ~$0.01)
    description: 'Dual Processing (GPT Vision + Azure DI)',
    avgPagesPerFile: 2, // 預設每個文件的頁數
  },
} as const

// ============================================================
// Core Functions
// ============================================================

/**
 * 根據文件類型決定處理方式
 *
 * @description
 *   路由規則（CHANGE-001 更新）：
 *   - NATIVE_PDF: 使用 DUAL_PROCESSING（GPT Vision 分類 + Azure DI 數據）
 *   - SCANNED_PDF: 使用 GPT Vision（完整處理：OCR + 分類 + 提取）
 *   - IMAGE: 使用 GPT Vision（完整處理：OCR + 分類 + 提取）
 *
 * @param detectedType - 檢測到的文件類型
 * @returns 處理方式
 * @throws 如果文件類型未知
 *
 * @example
 * ```typescript
 * const method = determineProcessingMethod('NATIVE_PDF')
 * // Returns: ProcessingMethod.DUAL_PROCESSING
 * ```
 */
export function determineProcessingMethod(
  detectedType: DetectedFileType
): ProcessingMethod {
  switch (detectedType) {
    // CHANGE-001: Native PDF 使用雙重處理
    // 第一階段：GPT Vision 分類（documentIssuer, documentFormat）
    // 第二階段：Azure DI 數據提取（invoiceData, lineItems）
    case DetectedFileType.NATIVE_PDF:
      return ProcessingMethod.DUAL_PROCESSING

    // 掃描 PDF 和圖片使用 GPT Vision 完整處理
    case DetectedFileType.SCANNED_PDF:
    case DetectedFileType.IMAGE:
      return ProcessingMethod.GPT_VISION

    default:
      throw new Error(`Unknown file type: ${detectedType}`)
  }
}

/**
 * 根據處理方式估算成本
 *
 * @param method - 處理方式
 * @param pageCount - 頁數（可選，預設使用平均值）
 * @returns 預估成本（USD）
 */
export function estimateCostByMethod(
  method: ProcessingMethod,
  pageCount?: number
): number {
  const config = COST_CONFIG[method]
  const pages = pageCount ?? config.avgPagesPerFile
  return pages * config.perPage
}

/**
 * 為單個文件生成處理路由
 *
 * @param file - 文件資訊
 * @returns 處理路由結果
 * @throws 如果文件沒有 detectedType
 */
export function routeFile(file: FileForRouting): ProcessingRoute {
  if (!file.detectedType) {
    throw new Error(`File ${file.id} has no detected type`)
  }

  const method = determineProcessingMethod(file.detectedType)
  const estimatedCost = estimateCostByMethod(method, file.pageCount)

  return {
    fileId: file.id,
    method,
    detectedType: file.detectedType,
    estimatedCost,
  }
}

/**
 * 為批量文件生成處理路由
 *
 * @description
 *   遍歷所有文件，根據類型分配處理方式，
 *   並統計各種處理方式的文件數量和成本。
 *   CHANGE-001: 新增 DUAL_PROCESSING 統計
 *
 * @param files - 文件列表
 * @returns 批量路由結果
 *
 * @example
 * ```typescript
 * const files = [
 *   { id: '1', detectedType: 'NATIVE_PDF' },
 *   { id: '2', detectedType: 'SCANNED_PDF' },
 * ]
 * const result = routeBatch(files)
 * // result.dualProcessing.fileCount = 1 (NATIVE_PDF)
 * // result.gptVision.fileCount = 1 (SCANNED_PDF)
 * ```
 */
export function routeBatch(files: FileForRouting[]): BatchRoutingResult {
  const routes: ProcessingRoute[] = []
  const azureDI: { fileCount: number; fileIds: string[] } = {
    fileCount: 0,
    fileIds: [],
  }
  const gptVision: { fileCount: number; fileIds: string[] } = {
    fileCount: 0,
    fileIds: [],
  }
  // CHANGE-001: 新增雙重處理統計
  const dualProcessing: { fileCount: number; fileIds: string[] } = {
    fileCount: 0,
    fileIds: [],
  }
  let totalEstimatedCost = 0

  for (const file of files) {
    // 跳過沒有 detectedType 的文件
    if (!file.detectedType) {
      continue
    }

    const route = routeFile(file)
    routes.push(route)
    totalEstimatedCost += route.estimatedCost

    // 統計分組（CHANGE-001: 新增 DUAL_PROCESSING）
    switch (route.method) {
      case ProcessingMethod.AZURE_DI:
        azureDI.fileCount++
        azureDI.fileIds.push(file.id)
        break
      case ProcessingMethod.GPT_VISION:
        gptVision.fileCount++
        gptVision.fileIds.push(file.id)
        break
      case ProcessingMethod.DUAL_PROCESSING:
        dualProcessing.fileCount++
        dualProcessing.fileIds.push(file.id)
        break
    }
  }

  return {
    routes,
    azureDI,
    gptVision,
    dualProcessing,
    totalEstimatedCost,
  }
}

/**
 * 獲取處理方式的描述資訊
 *
 * @param method - 處理方式
 * @returns 描述和成本資訊
 */
export function getProcessingMethodInfo(method: ProcessingMethod): {
  description: string
  costPerPage: number
} {
  const config = COST_CONFIG[method]
  return {
    description: config.description,
    costPerPage: config.perPage,
  }
}
