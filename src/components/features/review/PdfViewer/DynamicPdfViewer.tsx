/**
 * @fileoverview 動態載入的 PDF 檢視器
 * @description
 *   使用 next/dynamic 動態導入 PdfViewer 組件，避免 SSR 問題。
 *   pdfjs-dist 只能在客戶端運行，因此需要禁用 SSR。
 *
 * @module src/components/features/review/PdfViewer/DynamicPdfViewer
 * @since Epic 3 - Story 3.2 (並排 PDF 審核介面)
 * @lastModified 2025-12-23
 *
 * @dependencies
 *   - next/dynamic - 動態導入
 *   - ./PdfViewer - 原始 PDF 檢視器組件
 *
 * @related
 *   - src/app/(dashboard)/review/[id]/page.tsx - 審核詳情頁面
 */

'use client'

import dynamic from 'next/dynamic'
import type { ComponentType } from 'react'
import { PdfLoadingSkeleton } from './PdfLoadingSkeleton'

// ============================================================
// Types
// ============================================================

/**
 * PDF 檢視器組件屬性
 *
 * @description
 *   從 PdfViewer 組件重新導出類型，供外部使用。
 *   由於 PdfViewer 不能直接從 barrel export 導出（SSR 問題），
 *   我們在此處提供類型定義以保持類型安全。
 */
export interface PdfViewerProps {
  /** PDF 文件 URL */
  url: string
  /** 總頁數 */
  pageCount: number
  /** 額外的 CSS 類名 */
  className?: string
}

// ============================================================
// Component
// ============================================================

/**
 * 動態載入的 PDF 檢視器
 *
 * @description
 *   使用 next/dynamic 包裝 PdfViewer，禁用 SSR 以避免
 *   pdfjs-dist ESM 模組在 Node.js 環境的錯誤。
 *
 * @example
 * ```tsx
 * import { DynamicPdfViewer } from '@/components/features/review/PdfViewer'
 *
 * <DynamicPdfViewer
 *   url="https://storage.blob.core.windows.net/documents/invoice.pdf"
 *   pageCount={5}
 * />
 * ```
 */
const DynamicPdfViewer: ComponentType<PdfViewerProps> = dynamic(
  () => import('./PdfViewer').then((mod) => ({ default: mod.PdfViewer })),
  {
    ssr: false,
    loading: () => <PdfLoadingSkeleton />,
  }
)

export { DynamicPdfViewer }
