/**
 * @fileoverview PDF 高亮覆蓋層組件
 * @description
 *   在 PDF 頁面上顯示欄位高亮框：
 *   - 根據欄位位置資訊定位
 *   - 使用百分比座標（相對於頁面）
 *   - 自動滾動到高亮位置
 *   - 動畫效果（脈動）
 *
 * @module src/components/features/review/PdfViewer
 * @since Epic 3 - Story 3.2 (並排 PDF 審核介面)
 * @lastModified 2025-12-18
 */

'use client'

import { useEffect, useRef } from 'react'
import type { FieldSourcePosition } from '@/types/review'
import { cn } from '@/lib/utils'

// ============================================================
// Types
// ============================================================

interface PdfHighlightOverlayProps {
  /** 欄位位置資訊（百分比座標） */
  position: FieldSourcePosition
}

// ============================================================
// Component
// ============================================================

/**
 * PDF 高亮覆蓋層組件
 *
 * @example
 * ```tsx
 * <PdfHighlightOverlay
 *   position={{
 *     page: 1,
 *     x: 0.1,
 *     y: 0.2,
 *     width: 0.3,
 *     height: 0.05
 *   }}
 * />
 * ```
 */
export function PdfHighlightOverlay({ position }: PdfHighlightOverlayProps) {
  const overlayRef = useRef<HTMLDivElement>(null)

  // 計算像素位置（使用百分比）
  const style = {
    left: `${position.x * 100}%`,
    top: `${position.y * 100}%`,
    width: `${position.width * 100}%`,
    height: `${position.height * 100}%`,
  }

  // 自動滾動到高亮位置
  useEffect(() => {
    if (overlayRef.current) {
      overlayRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
        inline: 'center',
      })
    }
  }, [position])

  return (
    <div
      ref={overlayRef}
      data-testid="pdf-highlight"
      className={cn(
        'absolute pointer-events-none',
        'border-2 border-primary',
        'bg-primary/20',
        'rounded-sm',
        'animate-pulse'
      )}
      style={style}
    >
      {/* 四角標記 */}
      <div className="absolute -top-1 -left-1 w-2 h-2 bg-primary rounded-full" />
      <div className="absolute -top-1 -right-1 w-2 h-2 bg-primary rounded-full" />
      <div className="absolute -bottom-1 -left-1 w-2 h-2 bg-primary rounded-full" />
      <div className="absolute -bottom-1 -right-1 w-2 h-2 bg-primary rounded-full" />
    </div>
  )
}
