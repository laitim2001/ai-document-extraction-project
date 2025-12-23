/**
 * @fileoverview PDF 檢視器組件導出
 * @module src/components/features/review/PdfViewer
 * @since Epic 3 - Story 3.2
 * @lastModified 2025-12-23
 *
 * @important
 *   注意：不直接導出 PdfViewer，因為它依賴 pdfjs-dist 無法在 SSR 中運行。
 *   pdfjs-dist ESM 模組依賴瀏覽器 API（如 window、document），
 *   在 Node.js 環境執行會導致 "Object.defineProperty called on non-object" 錯誤。
 *
 *   即使使用 dynamic import 創建 DynamicPdfViewer，如果 barrel export 中
 *   包含 PdfViewer 的靜態導出，webpack 仍會在構建時加載所有導出，
 *   導致 SSR 錯誤。
 *
 *   解決方案：
 *   - 只導出 DynamicPdfViewer（使用 next/dynamic 並禁用 SSR）
 *   - 如需直接使用 PdfViewer，請從 './PdfViewer/PdfViewer' 直接導入
 */

// 注意：不要從此 barrel 導出 PdfViewer！
// 如需使用 PdfViewer，請直接從 './PdfViewer/PdfViewer' 導入
export { DynamicPdfViewer } from './DynamicPdfViewer'
export type { PdfViewerProps } from './DynamicPdfViewer'
export { PdfToolbar } from './PdfToolbar'
export { PdfHighlightOverlay } from './PdfHighlightOverlay'
export { PdfLoadingSkeleton } from './PdfLoadingSkeleton'
