/**
 * @fileoverview PDF 工具列組件
 * @description
 *   提供 PDF 導航和縮放控制：
 *   - 上一頁/下一頁按鈕
 *   - 當前頁碼顯示
 *   - 縮放控制（放大/縮小/重置）
 *
 * @module src/components/features/review/PdfViewer
 * @since Epic 3 - Story 3.2 (並排 PDF 審核介面)
 * @lastModified 2025-12-18
 */

'use client'

import { Button } from '@/components/ui/button'
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'

// ============================================================
// Types
// ============================================================

interface PdfToolbarProps {
  /** 當前頁碼 */
  currentPage: number
  /** 總頁數 */
  pageCount: number
  /** 縮放等級 (0.5 - 3.0) */
  zoomLevel: number
  /** 上一頁回調 */
  onPrevPage: () => void
  /** 下一頁回調 */
  onNextPage: () => void
  /** 放大回調 */
  onZoomIn: () => void
  /** 縮小回調 */
  onZoomOut: () => void
  /** 重置縮放回調 */
  onZoomReset: () => void
}

// ============================================================
// Component
// ============================================================

/**
 * PDF 工具列組件
 *
 * @example
 * ```tsx
 * <PdfToolbar
 *   currentPage={1}
 *   pageCount={10}
 *   zoomLevel={1}
 *   onPrevPage={() => {}}
 *   onNextPage={() => {}}
 *   onZoomIn={() => {}}
 *   onZoomOut={() => {}}
 *   onZoomReset={() => {}}
 * />
 * ```
 */
export function PdfToolbar({
  currentPage,
  pageCount,
  zoomLevel,
  onPrevPage,
  onNextPage,
  onZoomIn,
  onZoomOut,
  onZoomReset,
}: PdfToolbarProps) {
  return (
    <div className="flex items-center justify-between px-4 py-2 border-b bg-background">
      {/* 翻頁控制 */}
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={onPrevPage}
          disabled={currentPage <= 1}
          aria-label="上一頁"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        <span className="text-sm min-w-[80px] text-center tabular-nums">
          {currentPage} / {pageCount}
        </span>

        <Button
          variant="ghost"
          size="icon"
          onClick={onNextPage}
          disabled={currentPage >= pageCount}
          aria-label="下一頁"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* 縮放控制 */}
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={onZoomOut}
          disabled={zoomLevel <= 0.5}
          aria-label="縮小"
        >
          <ZoomOut className="h-4 w-4" />
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={onZoomReset}
          className="min-w-[60px] tabular-nums"
          title="點擊重置為 100%"
        >
          {Math.round(zoomLevel * 100)}%
        </Button>

        <Button
          variant="ghost"
          size="icon"
          onClick={onZoomIn}
          disabled={zoomLevel >= 3}
          aria-label="放大"
        >
          <ZoomIn className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
