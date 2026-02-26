/**
 * @fileoverview PDF 控制工具列組件 (i18n version)
 * @description
 *   提供 PDF 瀏覽控制功能，包含:
 *   - 頁面導航 (上一頁/下一頁/跳轉)
 *   - 縮放控制 (放大/縮小/重置)
 *   - 頁面資訊顯示
 *   - Full i18n support
 *
 * @module src/components/features/document-preview
 * @since Epic 13 - Story 13.1 (文件預覽組件與欄位高亮)
 * @lastModified 2026-01-17
 *
 * @features
 *   - 頁面上下導航
 *   - 縮放控制 (25% - 300%)
 *   - 快捷鍵支援
 *   - 無障礙支援
 */

'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Maximize2,
} from 'lucide-react'

// ============================================================
// Types
// ============================================================

interface PDFControlsProps {
  /** 當前頁碼 (1-based) */
  currentPage: number
  /** 總頁數 */
  totalPages: number
  /** 當前縮放倍率 */
  scale: number
  /** 頁面變更回調 */
  onPageChange: (page: number) => void
  /** 縮放變更回調 */
  onScaleChange: (scale: number) => void
  /** 自定義 CSS 類名 */
  className?: string
  /** 是否禁用控制 */
  disabled?: boolean
}

// ============================================================
// Constants
// ============================================================

/** 最小縮放倍率 */
const MIN_SCALE = 0.25

/** 最大縮放倍率 */
const MAX_SCALE = 3.0

/** 縮放步進值 */
const SCALE_STEP = 0.25

/** 預設縮放值 */
const DEFAULT_SCALE = 1.0

// ============================================================
// Component
// ============================================================

/**
 * @component PDFControls
 * @description PDF 控制工具列，提供頁面導航和縮放功能
 */
export function PDFControls({
  currentPage,
  totalPages,
  scale,
  onPageChange,
  onScaleChange,
  className,
  disabled = false,
}: PDFControlsProps) {
  const t = useTranslations('documentPreview')
  const [pageInput, setPageInput] = React.useState(String(currentPage))

  // 同步頁碼輸入框
  React.useEffect(() => {
    setPageInput(String(currentPage))
  }, [currentPage])

  // --- Handlers ---

  const handlePreviousPage = () => {
    if (currentPage > 1) {
      onPageChange(currentPage - 1)
    }
  }

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      onPageChange(currentPage + 1)
    }
  }

  const handlePageInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPageInput(e.target.value)
  }

  const handlePageInputBlur = () => {
    const page = parseInt(pageInput, 10)
    if (!isNaN(page) && page >= 1 && page <= totalPages) {
      onPageChange(page)
    } else {
      setPageInput(String(currentPage))
    }
  }

  const handlePageInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handlePageInputBlur()
    }
  }

  const handleZoomIn = () => {
    const newScale = Math.min(scale + SCALE_STEP, MAX_SCALE)
    onScaleChange(newScale)
  }

  const handleZoomOut = () => {
    const newScale = Math.max(scale - SCALE_STEP, MIN_SCALE)
    onScaleChange(newScale)
  }

  const handleResetZoom = () => {
    onScaleChange(DEFAULT_SCALE)
  }

  const handleFitWidth = () => {
    // 這裡可以根據容器寬度計算適合的縮放比例
    // 暫時設定為 1.0，實際實現需要傳入容器尺寸
    onScaleChange(1.0)
  }

  // --- Render ---

  return (
    <TooltipProvider>
      <div
        className={cn(
          'flex items-center justify-between gap-4 px-4 py-2',
          'bg-background border-b',
          className
        )}
      >
        {/* 頁面導航區 */}
        <div className="flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={handlePreviousPage}
                disabled={disabled || currentPage <= 1}
                aria-label={t('controls.navigation.previousPage')}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t('controls.navigation.previousPage')}</TooltipContent>
          </Tooltip>

          <div className="flex items-center gap-1 text-sm">
            <Input
              type="text"
              value={pageInput}
              onChange={handlePageInputChange}
              onBlur={handlePageInputBlur}
              onKeyDown={handlePageInputKeyDown}
              disabled={disabled}
              className="w-12 h-8 text-center"
              aria-label={t('controls.navigation.pageNumber')}
            />
            <span className="text-muted-foreground">/ {totalPages}</span>
          </div>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleNextPage}
                disabled={disabled || currentPage >= totalPages}
                aria-label={t('controls.navigation.nextPage')}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t('controls.navigation.nextPage')}</TooltipContent>
          </Tooltip>
        </div>

        {/* 縮放控制區 */}
        <div className="flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleZoomOut}
                disabled={disabled || scale <= MIN_SCALE}
                aria-label={t('controls.zoom.zoomOut')}
              >
                <ZoomOut className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t('controls.zoom.zoomOut')}</TooltipContent>
          </Tooltip>

          <span className="text-sm text-muted-foreground w-14 text-center">
            {Math.round(scale * 100)}%
          </span>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleZoomIn}
                disabled={disabled || scale >= MAX_SCALE}
                aria-label={t('controls.zoom.zoomIn')}
              >
                <ZoomIn className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t('controls.zoom.zoomIn')}</TooltipContent>
          </Tooltip>

          <div className="h-4 w-px bg-border mx-1" />

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleResetZoom}
                disabled={disabled}
                aria-label={t('controls.zoom.resetZoom')}
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t('controls.zoom.resetZoom')}</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleFitWidth}
                disabled={disabled}
                aria-label={t('controls.zoom.fitWidth')}
              >
                <Maximize2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t('controls.zoom.fitWidth')}</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </TooltipProvider>
  )
}

PDFControls.displayName = 'PDFControls'
