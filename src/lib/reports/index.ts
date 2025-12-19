/**
 * @fileoverview 報告生成模組入口
 * @description
 *   提供 PDF 和 Excel 報告生成功能的統一導出。
 *   用於規則測試結果報告的生成和下載。
 *
 * @module src/lib/reports
 * @since Epic 5 - Story 5.4 (測試規則變更效果)
 * @lastModified 2025-12-19
 *
 * @exports
 *   - generatePDFReport - PDF 報告生成函數
 *   - generateExcelReport - Excel 報告生成函數
 *   - ReportData - 報告數據結構類型
 */

export { generatePDFReport, type ReportData } from './pdf-generator'
export { generateExcelReport } from './excel-generator'
