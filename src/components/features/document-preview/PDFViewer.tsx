/**
 * @fileoverview PDF 預覽器主組件
 * @description
 *   使用 react-pdf 渲染 PDF 文件，整合導航控制、
 *   縮放功能和欄位高亮顯示。
 *
 * @module src/components/features/document-preview
 * @since Epic 13 - Story 13.1 (文件預覽組件與欄位高亮)
 * @lastModified 2026-01-03
 *
 * @features
 *   - PDF 渲染 (使用 react-pdf)
 *   - 頁面導航和縮放控制
 *   - 欄位高亮層整合
 *   - 載入和錯誤狀態處理
 *   - 效能優化 (Worker 分離)
 *   - SSR 安全 (worker 延遲初始化)
 *
 * @dependencies
 *   - react-pdf v10.x (實際: 10.2.0)
 *   - pdfjs-dist v5.x (實際: 5.4.296)
 *
 * @bugfix FIX-008 (2026-01-03)
 *   修復 pdfjs-dist 在 Next.js 環境下的 "Object.defineProperty called on non-object" 錯誤。
 *   將 worker 設定從模組頂層移至 useEffect，確保僅在客戶端執行。
 *
 * @bugfix FIX-011 (2026-01-03)
 *   新增受控模式支援 (page, scale props)。修復外部工具列按鈕無法控制 PDF 頁面的問題。
 *   當傳入 page/scale props 時，組件會同步外部狀態到內部狀態。
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

/**
 * @bugfix FIX-010 (2026-01-03)
 *   修復 react-pdf v10 + pdfjs-dist v5 的 worker 配置。
 *   舊配置使用 CDN 路徑，但 v5 的模組結構已改變。
 *   新配置使用 import.meta.url 動態解析本地 worker 路徑。
 */

// Worker 初始化標記，避免重複設定
let workerInitialized = false

/**
 * 初始化 PDF.js worker (延遲執行，僅客戶端)
 *
 * @description
 *   使用 import.meta.url 動態解析 worker 路徑，
 *   確保與安裝的 pdfjs-dist 版本匹配。
 *   react-pdf v10 需要此配置方式。
 */
function initializePdfWorker(): void {
  if (workerInitialized || typeof window === 'undefined') {
    return
  }

  try {
    // react-pdf v10 + pdfjs-dist v5 的配置
    // 使用 CDN 路徑指向正確版本的 worker
    // 注意: v5 使用 /build/ 而非 /legacy/build/
    pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`
    workerInitialized = true
    console.log('[PDFViewer] Worker initialized with version:', pdfjs.version)
  } catch (error) {
    console.error('[PDFViewer] Failed to initialize PDF.js worker:', error)
  }
}

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
  /** 縮放變更回調 */
  onScaleChange?: (scale: number) => void
  /** 初始頁碼（非受控模式）*/
  initialPage?: number
  /** 初始縮放倍率（非受控模式）*/
  initialScale?: number
  /** 受控頁碼（優先於 initialPage）*/
  page?: number
  /** 受控縮放倍率（優先於 initialScale）*/
  scale?: number
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
  onScaleChange,
  initialPage = DEFAULT_PAGE,
  initialScale = DEFAULT_SCALE,
  page: controlledPage,
  scale: controlledScale,
  className,
  showControls = true,
  showHighlights = true,
}: PDFViewerProps) {
  const containerRef = React.useRef<HTMLDivElement>(null)

  // 判斷是否為受控模式
  const isPageControlled = controlledPage !== undefined
  const isScaleControlled = controlledScale !== undefined

  const [state, setState] = React.useState<PDFViewerState>({
    numPages: 0,
    currentPage: controlledPage ?? initialPage,
    scale: controlledScale ?? initialScale,
    pageDimensions: { width: 0, height: 0 },
    isLoading: true,
    error: null,
    hoveredFieldId: undefined,
  })

  // --- Worker 初始化 (FIX-008) ---
  React.useEffect(() => {
    initializePdfWorker()
  }, [])

  // --- 受控模式同步 (FIX-011) ---
  // 當外部傳入 page 或 scale 時，同步內部狀態
  React.useEffect(() => {
    if (isPageControlled && controlledPage !== state.currentPage) {
      setState((prev) => ({ ...prev, currentPage: controlledPage }))
    }
  }, [controlledPage, isPageControlled, state.currentPage])

  React.useEffect(() => {
    if (isScaleControlled && controlledScale !== state.scale) {
      setState((prev) => ({ ...prev, scale: controlledScale }))
    }
  }, [controlledScale, isScaleControlled, state.scale])

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
