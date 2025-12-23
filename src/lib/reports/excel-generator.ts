/**
 * @fileoverview Excel 報告生成器
 * @description
 *   生成規則測試結果的 Excel 報告，包含：
 *   - 摘要工作表：測試資訊和結果統計
 *   - 詳情工作表：所有測試案例詳情（含顏色編碼）
 *
 * @module src/lib/reports/excel-generator
 * @since Epic 5 - Story 5.4 (測試規則變更效果)
 * @lastModified 2025-12-22
 * @refactor REFACTOR-001 (Forwarder → Company)
 *
 * @dependencies
 *   - exceljs - Excel 生成庫
 *   - @prisma/client - TestChangeType enum
 */

import ExcelJS from 'exceljs'
import type { TestChangeType } from '@prisma/client'

// ============================================================
// Types
// ============================================================

/**
 * 報告數據結構（與 PDF 生成器共用）
 * @refactor REFACTOR-001 (Forwarder → Company)
 */
export interface ReportData {
  /** 測試任務資訊 */
  task: {
    id: string
    rule: {
      fieldName: string
      extractionType: string
    }
    /** Company 資訊 (REFACTOR-001: 原 forwarder) */
    company: {
      name: string
      code: string | null
    }
    totalDocuments: number
    startedAt: Date | null
    completedAt: Date | null
  }
  /** 測試結果摘要 */
  results: {
    improved: number
    regressed: number
    unchanged: number
    bothWrong: number
    bothRight: number
    improvementRate: number
    regressionRate: number
    netImprovement: number
  }
  /** 測試詳情列表 */
  details: {
    document: { fileName: string }
    originalResult: string | null
    originalConfidence: number | null
    testResult: string | null
    testConfidence: number | null
    actualValue: string | null
    changeType: TestChangeType
  }[]
  /** 報告產生時間 */
  generatedAt: Date
  /** 報告產生者 */
  generatedBy: string
}

// ============================================================
// Helper Functions
// ============================================================

/**
 * 取得變更類型的標籤
 *
 * @param type - 變更類型
 * @returns 變更類型標籤
 */
function getChangeTypeLabel(type: TestChangeType): string {
  const labels: Record<TestChangeType, string> = {
    IMPROVED: '改善',
    REGRESSED: '惡化',
    BOTH_RIGHT: '都對',
    BOTH_WRONG: '都錯',
    UNCHANGED: '無變化',
  }
  return labels[type]
}

/**
 * 取得變更類型的背景顏色（ARGB 格式）
 *
 * @param type - 變更類型
 * @returns 顏色代碼
 */
function getChangeTypeColor(type: TestChangeType): string {
  const colors: Record<TestChangeType, string> = {
    IMPROVED: 'FFD4EDDA', // Light green
    REGRESSED: 'FFF8D7DA', // Light red
    BOTH_RIGHT: 'FFD1ECF1', // Light blue
    BOTH_WRONG: 'FFFFF3CD', // Light yellow
    UNCHANGED: 'FFFFFFFF', // White
  }
  return colors[type]
}

/**
 * 格式化日期為台灣格式
 *
 * @param date - 日期物件
 * @returns 格式化後的日期字串
 */
function formatDate(date: Date | null): string {
  if (!date) return 'N/A'
  return date.toLocaleString('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

/**
 * 格式化信心度為百分比
 *
 * @param confidence - 信心度 (0-1)
 * @returns 格式化後的百分比字串
 */
function formatConfidence(confidence: number | null): string {
  if (confidence === null || confidence === undefined) return ''
  return `${(confidence * 100).toFixed(1)}%`
}

// ============================================================
// Main Export
// ============================================================

/**
 * 生成 Excel 測試報告
 *
 * @description
 *   使用 ExcelJS 生成包含兩個工作表的 Excel 報告：
 *   1. 摘要工作表 - 基本資訊和結果統計
 *   2. 詳情工作表 - 所有測試案例詳情，根據變更類型顏色編碼
 *
 * @param data - 報告數據
 * @returns Excel Buffer
 *
 * @example
 *   const excelBuffer = await generateExcelReport({
 *     task: { id: '...', rule: {...}, company: {...}, ... },
 *     results: { improved: 10, regressed: 2, ... },
 *     details: [...],
 *     generatedAt: new Date(),
 *     generatedBy: 'User Name'
 *   });
 */
export async function generateExcelReport(data: ReportData): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = data.generatedBy
  workbook.created = data.generatedAt

  // ========================================
  // 摘要工作表
  // ========================================
  const summarySheet = workbook.addWorksheet('摘要')

  summarySheet.columns = [
    { header: '項目', key: 'item', width: 20 },
    { header: '值', key: 'value', width: 40 },
  ]

  // REFACTOR-001: Forwarder → Company
  summarySheet.addRows([
    {
      item: 'Company',
      value: `${data.task.company.name}${data.task.company.code ? ` (${data.task.company.code})` : ''}`,
    },
    { item: '欄位名稱', value: data.task.rule.fieldName },
    { item: '提取類型', value: data.task.rule.extractionType },
    { item: '測試文件數', value: data.task.totalDocuments },
    { item: '開始時間', value: formatDate(data.task.startedAt) },
    { item: '完成時間', value: formatDate(data.task.completedAt) },
    { item: '', value: '' },
    { item: '改善數量', value: data.results.improved },
    {
      item: '改善率',
      value: `${(data.results.improvementRate * 100).toFixed(1)}%`,
    },
    { item: '惡化數量', value: data.results.regressed },
    {
      item: '惡化率',
      value: `${(data.results.regressionRate * 100).toFixed(1)}%`,
    },
    { item: '都對數量', value: data.results.bothRight },
    { item: '都錯數量', value: data.results.bothWrong },
    { item: '無變化數量', value: data.results.unchanged },
    { item: '淨改善', value: data.results.netImprovement },
    { item: '', value: '' },
    { item: '報告產生時間', value: formatDate(data.generatedAt) },
    { item: '產生者', value: data.generatedBy },
  ])

  // 摘要工作表樣式
  summarySheet.getRow(1).font = { bold: true }
  summarySheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE0E0E0' },
  }

  // ========================================
  // 詳情工作表
  // ========================================
  const detailsSheet = workbook.addWorksheet('測試詳情')

  detailsSheet.columns = [
    { header: '序號', key: 'index', width: 8 },
    { header: '文件名稱', key: 'fileName', width: 40 },
    { header: '原規則結果', key: 'originalResult', width: 25 },
    { header: '原信心度', key: 'originalConfidence', width: 12 },
    { header: '新規則結果', key: 'testResult', width: 25 },
    { header: '新信心度', key: 'testConfidence', width: 12 },
    { header: '實際值', key: 'actualValue', width: 25 },
    { header: '變化類型', key: 'changeType', width: 12 },
  ]

  // 添加數據行
  data.details.forEach((detail, index) => {
    const row = detailsSheet.addRow({
      index: index + 1,
      fileName: detail.document.fileName,
      originalResult: detail.originalResult ?? '',
      originalConfidence: formatConfidence(detail.originalConfidence),
      testResult: detail.testResult ?? '',
      testConfidence: formatConfidence(detail.testConfidence),
      actualValue: detail.actualValue ?? '',
      changeType: getChangeTypeLabel(detail.changeType),
    })

    // 根據變更類型設置背景顏色
    const color = getChangeTypeColor(detail.changeType)
    row.eachCell((cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: color },
      }
    })
  })

  // 詳情工作表標題行樣式
  detailsSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
  detailsSheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF4472C4' },
  }

  // 設置自動篩選
  if (data.details.length > 0) {
    detailsSheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: data.details.length + 1, column: 8 },
    }
  }

  // 凍結標題行
  detailsSheet.views = [{ state: 'frozen', ySplit: 1 }]

  // 生成 Buffer
  const buffer = await workbook.xlsx.writeBuffer()
  return Buffer.from(buffer)
}
