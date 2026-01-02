/**
 * @fileoverview 動態載入 PDF 預覽器
 * @description
 *   使用 next/dynamic 動態載入 PDFViewer 組件，
 *   避免 SSR 時載入 pdfjs-dist 導致的錯誤。
 *
 * @module src/components/features/document-preview
 * @since Epic 13 - Story 13.1 (文件預覽組件與欄位高亮)
 * @lastModified 2025-01-02
 *
 * @features
 *   - SSR 安全的動態載入
 *   - 載入狀態顯示
 */

'use client'

import type { ComponentType } from 'react'
import dynamic from 'next/dynamic'
import { PDFLoadingSkeleton } from './PDFLoadingSkeleton'

// ============================================================
// Types
// ============================================================

import type { BoundingBox } from '@/lib/pdf'

interface PDFViewerProps {
  file: string | ArrayBuffer
  boundingBoxes?: BoundingBox[]
  selectedFieldId?: string
  onFieldClick?: (fieldId: string, fieldName: string) => void
  onLoadSuccess?: (numPages: number) => void
  onLoadError?: (error: Error) => void
  onPageChange?: (page: number) => void
  initialPage?: number
  initialScale?: number
  className?: string
  showControls?: boolean
  showHighlights?: boolean
}

// ============================================================
// Dynamic Import
// ============================================================

/**
 * 動態載入的 PDFViewer 組件
 *
 * @description
 *   使用 next/dynamic 確保 pdfjs-dist 僅在客戶端載入，
 *   避免 SSR 相關錯誤。
 *
 * @example
 * ```tsx
 * import { DynamicPDFViewer } from '@/components/features/document-preview';
 *
 * function MyComponent() {
 *   return (
 *     <DynamicPDFViewer
 *       file="/path/to/document.pdf"
 *       showControls
 *       showHighlights
 *     />
 *   );
 * }
 * ```
 */
export const DynamicPDFViewer: ComponentType<PDFViewerProps> = dynamic(
  () => import('./PDFViewer').then((mod) => ({ default: mod.PDFViewer })),
  {
    ssr: false,
    loading: () => <PDFLoadingSkeleton loadingText="載入預覽器中..." />,
  }
)

DynamicPDFViewer.displayName = 'DynamicPDFViewer'
