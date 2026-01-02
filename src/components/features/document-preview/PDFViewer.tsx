/**
 * @fileoverview PDF 預覽器主組件
 * @description
 *   使用 react-pdf 渲染 PDF 文件，整合導航控制、
 *   縮放功能和欄位高亮顯示。
 *
 * @module src/components/features/document-preview
 * @since Epic 13 - Story 13.1 (文件預覽組件與欄位高亮)
 * @lastModified 2025-01-02
 *
 * @features
 *   - PDF 渲染 (使用 react-pdf)
 *   - 頁面導航和縮放控制
 *   - 欄位高亮層整合
 *   - 載入和錯誤狀態處理
 *   - 效能優化 (Worker 分離)
 *
 * @dependencies
 *   - react-pdf v7.x
 *   - pdfjs-dist v3.x
 */

'use client'

import * as React from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'

import { cn } from '@/lib/utils'
import { type BoundingBox, type PageDimensions } from '@/lib/pdf'
import { PDFControls } from './PDFControls'
import { PDFLoadingSkeleton } from './PDFLoadingSkeleton'
import { PDFErrorDisplay } from './PDFErrorDisplay'
import { FieldHighlightOverlay } from './FieldHighlightOverlay'

// ============================================================
// PDF.js Worker 設定
// ============================================================

// 設定 PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/legacy/build/pdf.worker.min.mjs`

// ============================================================
// Types
// ============================================================

interface PDFViewerProps {
  /** PDF 文件 URL 或 ArrayBuffer */
  file: string | ArrayBuffer
  /** 欄位邊界框陣列 (用於高亮顯示) */
  boundingBoxes?: BoundingBox[]
  /** 選中的欄位 ID */
  selectedFieldId?: string
  /** 欄位點擊回調 */
  onFieldClick?: (fieldId: string, fieldName: string) => void
  /** 文件載入完成回調 */
  onLoadSuccess?: (numPages: number) => void
  /** 文件載入錯誤回調 */
  onLoadError?: (error: Error) => void
  /** 頁面變更回調 */
  onPageChange?: (page: number) => void
  /** 初始頁碼 */
  initialPage?: number
  /** 初始縮放倍率 */
  initialScale?: number
  /** 自定義 CSS 類名 */
  className?: string
  /** 是否顯示控制工具列 */
  showControls?: boolean
  /** 是否顯示欄位高亮 */
  showHighlights?: boolean
}

interface PDFViewerState {
  numPages: number
  currentPage: number
  scale: number
  pageDimensions: PageDimensions
  isLoading: boolean
  error: Error | null
  hoveredFieldId: string | undefined
}

// ============================================================
// Constants
// ============================================================

const DEFAULT_SCALE = 1.0
const DEFAULT_PAGE = 1

// ============================================================
// Component
// ============================================================

/**
 * @component PDFViewer
 * @description PDF 預覽器組件，整合渲染、導航、縮放和欄位高亮功能
 */
export function PDFViewer({
  file,
  boundingBoxes = [],
  selectedFieldId,
  onFieldClick,
  onLoadSuccess,
  onLoadError,
  onPageChange,
  initialPage = DEFAULT_PAGE,
  initialScale = DEFAULT_SCALE,
  className,
  showControls = true,
  showHighlights = true,
}: PDFViewerProps) {
  const containerRef = React.useRef<HTMLDivElement>(null)
  const [state, setState] = React.useState<PDFViewerState>({
    numPages: 0,
    currentPage: initialPage,
    scale: initialScale,
    pageDimensions: { width: 0, height: 0 },
    isLoading: true,
    error: null,
    hoveredFieldId: undefined,
  })

  // --- Document Handlers ---

  const handleDocumentLoadSuccess = React.useCallback(
    (pdf: { numPages: number }) => {
      setState((prev) => ({
        ...prev,
        numPages: pdf.numPages,
        isLoading: false,
        error: null,
      }))
      onLoadSuccess?.(pdf.numPages)
    },
    [onLoadSuccess]
  )

  const handleDocumentLoadError = React.useCallback(
    (error: Error) => {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error,
      }))
      onLoadError?.(error)
    },
    [onLoadError]
  )

  // --- Page Handlers ---

  const handlePageLoadSuccess = React.useCallback(
    (page: { width: number; height: number }) => {
      setState((prev) => ({
        ...prev,
        pageDimensions: {
          width: page.width,
          height: page.height,
        },
      }))
    },
    []
  )

  // --- Control Handlers ---

  const handlePageChange = React.useCallback(
    (page: number) => {
      setState((prev) => ({ ...prev, currentPage: page }))
      onPageChange?.(page)
    },
    [onPageChange]
  )

  const handleScaleChange = React.useCallback((scale: number) => {
    setState((prev) => ({ ...prev, scale }))
  }, [])

  const handleRetry = React.useCallback(() => {
    setState((prev) => ({
      ...prev,
      isLoading: true,
      error: null,
    }))
  }, [])

  // --- Field Handlers ---

  const handleFieldClick = React.useCallback(
    (fieldId: string, fieldName: string) => {
      onFieldClick?.(fieldId, fieldName)
    },
    [onFieldClick]
  )

  const handleFieldHover = React.useCallback((fieldId: string | undefined) => {
    setState((prev) => ({ ...prev, hoveredFieldId: fieldId }))
  }, [])

  // --- Render ---

  // 錯誤狀態
  if (state.error) {
    return (
      <div className={cn('flex flex-col h-full', className)}>
        <PDFErrorDisplay
          error={state.error}
          onRetry={handleRetry}
          className="flex-1"
        />
      </div>
    )
  }

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* 控制工具列 */}
      {showControls && (
        <PDFControls
          currentPage={state.currentPage}
          totalPages={state.numPages}
          scale={state.scale}
          onPageChange={handlePageChange}
          onScaleChange={handleScaleChange}
          disabled={state.isLoading}
        />
      )}

      {/* PDF 渲染區 */}
      <div
        ref={containerRef}
        className={cn(
          'flex-1 overflow-auto',
          'flex justify-center items-start',
          'bg-muted/20 p-4'
        )}
      >
        <Document
          file={file}
          onLoadSuccess={handleDocumentLoadSuccess}
          onLoadError={handleDocumentLoadError}
          loading={<PDFLoadingSkeleton />}
          error={<PDFErrorDisplay error="無法載入 PDF 文件" />}
          className="relative"
        >
          {/* PDF 頁面容器 */}
          <div className="relative shadow-lg">
            <Page
              pageNumber={state.currentPage}
              scale={state.scale}
              onLoadSuccess={handlePageLoadSuccess}
              loading={<PDFLoadingSkeleton showIcon={false} loadingText="載入頁面中..." />}
              renderTextLayer
              renderAnnotationLayer
              className="bg-white"
            />

            {/* 欄位高亮層 */}
            {showHighlights &&
              boundingBoxes.length > 0 &&
              state.pageDimensions.width > 0 && (
                <FieldHighlightOverlay
                  boundingBoxes={boundingBoxes}
                  pageDimensions={state.pageDimensions}
                  scale={state.scale}
                  currentPage={state.currentPage}
                  selectedFieldId={selectedFieldId}
                  hoveredFieldId={state.hoveredFieldId}
                  onFieldClick={handleFieldClick}
                  onFieldHover={handleFieldHover}
                />
              )}
          </div>
        </Document>
      </div>
    </div>
  )
}

PDFViewer.displayName = 'PDFViewer'
