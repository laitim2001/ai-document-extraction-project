/**
 * @fileoverview 處理路由服務
 * @description
 *   根據文件類型自動選擇最佳 AI 處理方式：
 *   - NATIVE_PDF → Azure Document Intelligence（成本較低，原生 PDF 效果好）
 *   - SCANNED_PDF → GPT-5.2 Vision（圖片識別更準確）
 *   - IMAGE → GPT-5.2 Vision（圖片識別更準確）
 *
 * @module src/services/processing-router
 * @since Epic 0 - Story 0.2
 * @lastModified 2025-12-24
 *
 * @features
 *   - 根據 DetectedFileType 自動路由到對應處理服務
 *   - 支援批量文件路由決策
 *   - 返回處理方式和預估成本
 *
 * @dependencies
 *   - Prisma Client - 數據庫操作
 *   - cost-estimation.service - 成本估算
 *
 * @related
 *   - src/services/cost-estimation.service.ts - 成本估算服務
 *   - src/services/batch-processor.service.ts - 批量處理執行器
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
} as const

// ============================================================
// Core Functions
// ============================================================

/**
 * 根據文件類型決定處理方式
 *
 * @description
 *   路由規則：
 *   - NATIVE_PDF: 使用 Azure DI（成本低、效果好）
 *   - SCANNED_PDF: 使用 GPT Vision（圖片識別準確）
 *   - IMAGE: 使用 GPT Vision（圖片識別準確）
 *
 * @param detectedType - 檢測到的文件類型
 * @returns 處理方式
 * @throws 如果文件類型未知
 *
 * @example
 * ```typescript
 * const method = determineProcessingMethod('NATIVE_PDF')
 * // Returns: ProcessingMethod.AZURE_DI
 * ```
 */
export function determineProcessingMethod(
  detectedType: DetectedFileType
): ProcessingMethod {
  switch (detectedType) {
    case DetectedFileType.NATIVE_PDF:
      return ProcessingMethod.AZURE_DI

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
 * // result.azureDI.fileCount = 1
 * // result.gptVision.fileCount = 1
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
  let totalEstimatedCost = 0

  for (const file of files) {
    // 跳過沒有 detectedType 的文件
    if (!file.detectedType) {
      continue
    }

    const route = routeFile(file)
    routes.push(route)
    totalEstimatedCost += route.estimatedCost

    // 統計分組
    if (route.method === ProcessingMethod.AZURE_DI) {
      azureDI.fileCount++
      azureDI.fileIds.push(file.id)
    } else {
      gptVision.fileCount++
      gptVision.fileIds.push(file.id)
    }
  }

  return {
    routes,
    azureDI,
    gptVision,
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
