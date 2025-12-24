/**
 * @fileoverview PDF 檢視器主組件
 * @description
 *   使用 react-pdf 渲染 PDF 文件，支援：
 *   - 縮放控制（0.5x - 3x）
 *   - 翻頁導航
 *   - 欄位高亮顯示
 *   - 響應式寬度調整
 *
 * @module src/components/features/review/PdfViewer
 * @since Epic 3 - Story 3.2 (並排 PDF 審核介面)
 * @lastModified 2025-12-18
 */

'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import { useReviewStore } from '@/stores/reviewStore'
import { PdfToolbar } from './PdfToolbar'
import { PdfHighlightOverlay } from './PdfHighlightOverlay'
import { PdfLoadingSkeleton } from './PdfLoadingSkeleton'
import { cn } from '@/lib/utils'

import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'

// 設置 PDF.js worker (使用 legacy 版本以兼容 Next.js 15)
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/legacy/build/pdf.worker.min.mjs`

// ============================================================
// Types
// ============================================================

interface PdfViewerProps {
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
 * PDF 檢視器組件
 *
 * @example
 * ```tsx
 * <PdfViewer
 *   url="https://storage.blob.core.windows.net/documents/invoice.pdf"
 *   pageCount={5}
 * />
 * ```
 */
export function PdfViewer({ url, pageCount, className }: PdfViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Store 狀態
  const {
    currentPage,
    zoomLevel,
    selectedFieldPosition,
    setCurrentPage,
    setZoomLevel,
  } = useReviewStore()

  // --- 監聽容器寬度變化 ---
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const resizeObserver = new ResizeObserver((entries) => {
      const { width } = entries[0].contentRect
      setContainerWidth(width)
    })

    resizeObserver.observe(container)
    return () => resizeObserver.disconnect()
  }, [])

  // --- 計算頁面寬度 ---
  // 預留 padding 空間（左右各 24px = 48px）
  const pageWidth = containerWidth > 0 ? (containerWidth - 48) * zoomLevel : undefined

  // --- 事件處理器 ---
  const handleLoadSuccess = useCallback(() => {
    setIsLoading(false)
    setError(null)
  }, [])

  const handleLoadError = useCallback((err: Error) => {
    setIsLoading(false)
    setError('無法載入 PDF 文件')
    console.error('PDF load error:', err)
  }, [])

  const handlePrevPage = useCallback(() => {
    setCurrentPage(Math.max(1, currentPage - 1))
  }, [currentPage, setCurrentPage])

  const handleNextPage = useCallback(() => {
    setCurrentPage(Math.min(pageCount, currentPage + 1))
  }, [currentPage, pageCount, setCurrentPage])

  const handleZoomIn = useCallback(() => {
    setZoomLevel(zoomLevel + 0.1)
  }, [zoomLevel, setZoomLevel])

  const handleZoomOut = useCallback(() => {
    setZoomLevel(zoomLevel - 0.1)
  }, [zoomLevel, setZoomLevel])

  const handleZoomReset = useCallback(() => {
    setZoomLevel(1)
  }, [setZoomLevel])

  // --- Render ---
  return (
    <div className={cn('flex flex-col h-full', className)} data-testid="pdf-viewer">
      {/* 工具列 */}
      <PdfToolbar
        currentPage={currentPage}
        pageCount={pageCount}
        zoomLevel={zoomLevel}
        onPrevPage={handlePrevPage}
        onNextPage={handleNextPage}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onZoomReset={handleZoomReset}
      />

      {/* PDF 內容區 */}
      <div
        ref={containerRef}
        className="relative flex-1 overflow-auto bg-muted/30 p-6"
      >
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
            <PdfLoadingSkeleton />
          </div>
        )}

        {error ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-destructive">{error}</p>
          </div>
        ) : (
          <div className="relative flex justify-center">
            <Document
              file={url}
              onLoadSuccess={handleLoadSuccess}
              onLoadError={handleLoadError}
              loading={<PdfLoadingSkeleton />}
            >
              <div className="relative shadow-lg bg-white">
                <Page
                  pageNumber={currentPage}
                  width={pageWidth}
                  renderTextLayer={true}
                  renderAnnotationLayer={false}
                  loading={<PdfLoadingSkeleton />}
                />

                {/* 高亮覆蓋層 */}
                {selectedFieldPosition &&
                  selectedFieldPosition.page === currentPage && (
                    <PdfHighlightOverlay
                      position={selectedFieldPosition}
                    />
                  )}
              </div>
            </Document>
          </div>
        )}
      </div>
    </div>
  )
}
