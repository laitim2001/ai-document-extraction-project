/**
 * @fileoverview 欄位高亮覆蓋層組件
 * @description
 *   在 PDF 頁面上方渲染欄位位置高亮框，
 *   支援信心度顏色編碼和點擊互動。
 *
 * @module src/components/features/document-preview
 * @since Epic 13 - Story 13.1 (文件預覽組件與欄位高亮)
 * @lastModified 2025-01-02
 *
 * @features
 *   - PDF 座標自動轉換為螢幕座標
 *   - 信心度顏色編碼 (綠/黃/紅)
 *   - 點擊高亮觸發回調
 *   - requestAnimationFrame 效能優化
 *   - 懸停效果
 *
 * @dependencies
 *   - src/lib/pdf/coordinate-transform.ts
 */

'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'
import {
  type BoundingBox,
  type ScreenBoundingBox,
  type PageDimensions,
  transformBoundingBoxes,
  getConfidenceColors,
  getConfidenceLevel,
} from '@/lib/pdf'

// ============================================================
// Types
// ============================================================

interface FieldHighlightOverlayProps {
  /** 欄位邊界框陣列 */
  boundingBoxes: BoundingBox[]
  /** 頁面尺寸 (PDF 單位) */
  pageDimensions: PageDimensions
  /** 當前縮放倍率 */
  scale: number
  /** 當前顯示頁碼 (1-based) */
  currentPage: number
  /** 選中的欄位 ID */
  selectedFieldId?: string
  /** 懸停的欄位 ID */
  hoveredFieldId?: string
  /** 欄位點擊回調 */
  onFieldClick?: (fieldId: string, fieldName: string) => void
  /** 欄位懸停回調 */
  onFieldHover?: (fieldId: string | undefined) => void
  /** 自定義 CSS 類名 */
  className?: string
  /** 是否禁用互動 */
  disabled?: boolean
}

// ============================================================
// Sub-components
// ============================================================

interface HighlightBoxProps {
  box: ScreenBoundingBox
  isSelected: boolean
  isHovered: boolean
  onClick?: () => void
  onMouseEnter?: () => void
  onMouseLeave?: () => void
  disabled?: boolean
}

/**
 * 單一高亮框組件
 */
function HighlightBox({
  box,
  isSelected,
  isHovered,
  onClick,
  onMouseEnter,
  onMouseLeave,
  disabled = false,
}: HighlightBoxProps) {
  const { backgroundColor, borderColor } = getConfidenceColors(box.confidence)
  const confidenceLevel = getConfidenceLevel(box.confidence)

  // 選中或懸停時增強樣式
  const enhancedOpacity = isSelected || isHovered ? 1 : 0.7
  const borderWidth = isSelected ? 2 : 1

  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      className={cn(
        'absolute cursor-pointer transition-all duration-150',
        'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1',
        disabled && 'cursor-default pointer-events-none'
      )}
      style={{
        left: `${box.rect.left}px`,
        top: `${box.rect.top}px`,
        width: `${box.rect.width}px`,
        height: `${box.rect.height}px`,
        backgroundColor,
        border: `${borderWidth}px solid ${borderColor}`,
        opacity: enhancedOpacity,
        zIndex: isSelected ? 10 : isHovered ? 5 : 1,
      }}
      onClick={(e) => {
        e.stopPropagation()
        if (!disabled && onClick) {
          onClick()
        }
      }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && !disabled && onClick) {
          e.preventDefault()
          onClick()
        }
      }}
      aria-label={`${box.fieldName} - 信心度 ${box.confidence}%`}
      data-field-id={box.fieldId}
      data-confidence={confidenceLevel}
    >
      {/* 懸停時顯示欄位名稱提示 */}
      {isHovered && (
        <div
          className={cn(
            'absolute -top-6 left-0 px-2 py-0.5 rounded text-xs',
            'bg-popover text-popover-foreground shadow-md',
            'whitespace-nowrap z-20'
          )}
        >
          {box.fieldName}
          <span className="ml-1 text-muted-foreground">
            ({box.confidence}%)
          </span>
        </div>
      )}
    </div>
  )
}

// ============================================================
// Component
// ============================================================

/**
 * @component FieldHighlightOverlay
 * @description 欄位高亮覆蓋層，顯示 PDF 頁面上的欄位位置
 */
export function FieldHighlightOverlay({
  boundingBoxes,
  pageDimensions,
  scale,
  currentPage,
  selectedFieldId,
  hoveredFieldId,
  onFieldClick,
  onFieldHover,
  className,
  disabled = false,
}: FieldHighlightOverlayProps) {
  const [screenBoxes, setScreenBoxes] = React.useState<ScreenBoundingBox[]>([])
  const rafRef = React.useRef<number | null>(null)

  // 使用 requestAnimationFrame 優化座標轉換
  React.useEffect(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current)
    }

    rafRef.current = requestAnimationFrame(() => {
      const transformed = transformBoundingBoxes(
        boundingBoxes,
        pageDimensions,
        scale,
        currentPage
      )
      setScreenBoxes(transformed)
    })

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current)
      }
    }
  }, [boundingBoxes, pageDimensions, scale, currentPage])

  // --- Handlers ---

  const handleFieldClick = React.useCallback(
    (fieldId: string, fieldName: string) => {
      if (onFieldClick) {
        onFieldClick(fieldId, fieldName)
      }
    },
    [onFieldClick]
  )

  const handleFieldHover = React.useCallback(
    (fieldId: string | undefined) => {
      if (onFieldHover) {
        onFieldHover(fieldId)
      }
    },
    [onFieldHover]
  )

  // 如果沒有邊界框或頁面尺寸無效，不渲染
  if (screenBoxes.length === 0 || pageDimensions.width <= 0 || pageDimensions.height <= 0) {
    return null
  }

  return (
    <div
      className={cn(
        'absolute inset-0 pointer-events-none',
        className
      )}
      style={{
        width: `${pageDimensions.width * scale}px`,
        height: `${pageDimensions.height * scale}px`,
      }}
    >
      {/* 高亮框容器 - 啟用指標事件 */}
      <div className="relative w-full h-full pointer-events-auto">
        {screenBoxes.map((box) => (
          <HighlightBox
            key={box.fieldId}
            box={box}
            isSelected={box.fieldId === selectedFieldId}
            isHovered={box.fieldId === hoveredFieldId}
            onClick={() => handleFieldClick(box.fieldId, box.fieldName)}
            onMouseEnter={() => handleFieldHover(box.fieldId)}
            onMouseLeave={() => handleFieldHover(undefined)}
            disabled={disabled}
          />
        ))}
      </div>
    </div>
  )
}

FieldHighlightOverlay.displayName = 'FieldHighlightOverlay'
