/**
 * @fileoverview 文件預覽組件模組匯出
 * @module src/components/features/document-preview
 * @since Epic 13 - Story 13.1, 13.2
 * @lastModified 2026-01-03
 *
 * @exports
 *   Story 13.1 - PDF 預覽與欄位高亮:
 *   - DynamicPDFViewer - SSR 安全的動態載入版本（推薦使用）
 *   - PDFControls - 導航和縮放控制工具列
 *   - FieldHighlightOverlay - 欄位高亮覆蓋層
 *   - PDFLoadingSkeleton - 載入骨架屏
 *   - PDFErrorDisplay - 錯誤顯示組件
 *
 *   Story 13.2 - 欄位提取結果面板:
 *   - FieldCard - 單個欄位卡片組件
 *   - FieldFilters - 過濾器組件
 *   - ExtractedFieldsPanel - 欄位結果主面板
 *
 * @note
 *   PDFViewer 不在此處 export，因為 pdfjs-dist 無法在 SSR 環境中執行。
 *   請使用 DynamicPDFViewer，它會在客戶端動態載入 PDFViewer。
 *   如需直接使用 PDFViewer，請從 './PDFViewer' 直接 import（僅限客戶端組件）。
 *
 * @bugfix FIX-008 (2026-01-03)
 *   移除 PDFViewer 的 barrel export 以避免 SSR 錯誤。
 */

// ============================================================
// Story 13.1 - PDF 預覽與欄位高亮
// ============================================================

// NOTE: PDFViewer 不在此 export - 使用 DynamicPDFViewer 代替
// 原因: pdfjs-dist 模組無法在 Next.js SSR 環境中評估
export { DynamicPDFViewer } from './DynamicPDFViewer'
export { PDFControls } from './PDFControls'
export { FieldHighlightOverlay } from './FieldHighlightOverlay'
export { PDFLoadingSkeleton } from './PDFLoadingSkeleton'
export { PDFErrorDisplay } from './PDFErrorDisplay'

// ============================================================
// Story 13.2 - 欄位提取結果面板
// ============================================================

export { FieldCard } from './FieldCard'
export { FieldFilters } from './FieldFilters'
export { ExtractedFieldsPanel } from './ExtractedFieldsPanel'

// Types re-export for convenience
export type {
  ExtractedField,
  FieldSource,
  ConfidenceLevel,
  FieldCategory,
  FieldBoundingBox,
  FieldFilterState,
  ExtractionMetadata,
  ExtractionResult,
} from '@/types/extracted-field'

export {
  FIELD_SOURCE_LABELS,
  CONFIDENCE_THRESHOLDS,
  DEFAULT_CATEGORIES,
  DEFAULT_FILTER_STATE,
  getConfidenceLevelFromScore,
} from '@/types/extracted-field'
