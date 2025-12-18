/**
 * @fileoverview 信心度指示器組件
 * @description
 *   以進度條形式顯示信心度分數，顏色根據等級自動變化。
 *   支援顯示標籤和分數值。
 *
 * @module src/components/features/confidence/ConfidenceIndicator
 * @since Epic 2 - Story 2.5 (Confidence Score Calculation)
 * @lastModified 2025-12-18
 */

'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'
import {
  getConfidenceLevel,
  formatScore,
  CONFIDENCE_THRESHOLDS,
} from '@/lib/confidence'

// ============================================================
// Types
// ============================================================

export interface ConfidenceIndicatorProps {
  /** 信心度分數 (0-100) */
  score: number
  /** 是否顯示標籤 */
  showLabel?: boolean
  /** 是否顯示分數值 */
  showScore?: boolean
  /** 顯示語言 */
  locale?: 'en' | 'zh'
  /** 自定義 className */
  className?: string
  /** 進度條高度 */
  height?: 'sm' | 'md' | 'lg'
}

// ============================================================
// Constants
// ============================================================

const heightClasses = {
  sm: 'h-1',
  md: 'h-2',
  lg: 'h-3',
} as const

const levelColorClasses = {
  high: 'bg-green-500',
  medium: 'bg-yellow-500',
  low: 'bg-red-500',
} as const

const levelBgClasses = {
  high: 'bg-green-100',
  medium: 'bg-yellow-100',
  low: 'bg-red-100',
} as const

// ============================================================
// Component
// ============================================================

/**
 * 信心度指示器組件
 *
 * @example
 *   <ConfidenceIndicator score={85} showLabel showScore />
 *   // 顯示帶標籤和分數的進度條
 *
 * @example
 *   <ConfidenceIndicator score={65} height="lg" />
 *   // 顯示大尺寸進度條
 */
export function ConfidenceIndicator({
  score,
  showLabel = false,
  showScore = true,
  locale = 'en',
  className,
  height = 'md',
}: ConfidenceIndicatorProps) {
  const level = getConfidenceLevel(score)
  const config = CONFIDENCE_THRESHOLDS[level]
  const label = locale === 'zh' ? config.labelZh : config.label

  return (
    <div className={cn('w-full', className)}>
      {/* Header: Label and Score */}
      {(showLabel || showScore) && (
        <div className="flex items-center justify-between mb-1">
          {showLabel && (
            <span
              className="text-sm font-medium"
              style={{ color: config.color }}
            >
              {label}
            </span>
          )}
          {showScore && (
            <span className="text-sm text-muted-foreground">
              {formatScore(score)}
            </span>
          )}
        </div>
      )}

      {/* Progress Bar */}
      <div
        className={cn(
          'w-full rounded-full overflow-hidden',
          levelBgClasses[level],
          heightClasses[height]
        )}
      >
        <div
          className={cn(
            'h-full rounded-full transition-all duration-300',
            levelColorClasses[level]
          )}
          style={{ width: `${Math.min(100, Math.max(0, score))}%` }}
        />
      </div>
    </div>
  )
}

/**
 * 迷你信心度指示器 - 僅顯示進度條
 */
export function MiniConfidenceIndicator({
  score,
  className,
}: Pick<ConfidenceIndicatorProps, 'score' | 'className'>) {
  const level = getConfidenceLevel(score)

  return (
    <div
      className={cn(
        'w-16 h-1.5 rounded-full overflow-hidden',
        levelBgClasses[level],
        className
      )}
    >
      <div
        className={cn('h-full rounded-full', levelColorClasses[level])}
        style={{ width: `${Math.min(100, Math.max(0, score))}%` }}
      />
    </div>
  )
}
