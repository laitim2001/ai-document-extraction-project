/**
 * @fileoverview 報告生成模組入口
 * @description
 *   提供 PDF 和 Excel 報告生成功能的統一導出。
 *   包含規則測試結果報告和階層式術語報告。
 *
 * @module src/lib/reports
 * @since Epic 5 - Story 5.4 (測試規則變更效果)
 * @lastModified 2025-12-27
 *
 * @exports
 *   - generatePDFReport - PDF 報告生成函數
 *   - generateExcelReport - Excel 報告生成函數
 *   - generateHierarchicalTermsExcel - 階層式術語 Excel 報告
 *   - generateReportFileName - 報告文件名生成
 *   - ReportData - 報告數據結構類型
 *   - HierarchicalTermsReportData - 階層式術語報告數據類型
 */

export { generatePDFReport, type ReportData } from './pdf-generator'
export { generateExcelReport } from './excel-generator'
export {
  generateHierarchicalTermsExcel,
  generateReportFileName,
  type HierarchicalTermsReportData,
  type HierarchicalTermsExportOptions,
} from './hierarchical-terms-excel'
