/**
 * @fileoverview 信心度徽章組件
 * @description
 *   顯示信心度等級的徽章，根據分數自動選擇顏色和標籤。
 *   支援三種等級：高（綠）、中（黃）、低（紅）。
 *
 * @module src/components/features/confidence/ConfidenceBadge
 * @since Epic 2 - Story 2.5 (Confidence Score Calculation)
 * @lastModified 2025-12-18
 */

'use client'

import * as React from 'react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import {
  getConfidenceLevel,
  CONFIDENCE_THRESHOLDS,
  formatScore,
} from '@/lib/confidence'
import type { ConfidenceLevel } from '@/types/confidence'

// ============================================================
// Types
// ============================================================

export interface ConfidenceBadgeProps {
  /** 信心度分數 (0-100) */
  score: number
  /** 是否顯示分數數值 */
  showScore?: boolean
  /** 顯示語言 */
  locale?: 'en' | 'zh'
  /** 自定義 className */
  className?: string
  /** 尺寸 */
  size?: 'sm' | 'md' | 'lg'
}

// ============================================================
// Constants
// ============================================================

const sizeClasses = {
  sm: 'text-xs px-2 py-0.5',
  md: 'text-sm px-2.5 py-0.5',
  lg: 'text-base px-3 py-1',
} as const

const levelToVariant: Record<ConfidenceLevel, 'confidence-high' | 'confidence-medium' | 'confidence-low'> = {
  high: 'confidence-high',
  medium: 'confidence-medium',
  low: 'confidence-low',
}

// ============================================================
// Component
// ============================================================

/**
 * 信心度徽章組件
 *
 * @example
 *   <ConfidenceBadge score={95} showScore />
 *   // 顯示: "High Confidence 95%"
 *
 * @example
 *   <ConfidenceBadge score={75} locale="zh" />
 *   // 顯示: "中信心"
 */
export function ConfidenceBadge({
  score,
  showScore = false,
  locale = 'en',
  className,
  size = 'md',
}: ConfidenceBadgeProps) {
  const level = getConfidenceLevel(score)
  const config = CONFIDENCE_THRESHOLDS[level]
  const variant = levelToVariant[level]

  const label = locale === 'zh' ? config.labelZh : config.label
  const displayText = showScore ? `${label} ${formatScore(score)}` : label

  return (
    <Badge
      variant={variant}
      className={cn(sizeClasses[size], className)}
    >
      {displayText}
    </Badge>
  )
}

/**
 * 簡化版信心度徽章 - 僅顯示分數
 */
export function ConfidenceScoreBadge({
  score,
  className,
  size = 'md',
}: Omit<ConfidenceBadgeProps, 'showScore' | 'locale'>) {
  const level = getConfidenceLevel(score)
  const variant = levelToVariant[level]

  return (
    <Badge
      variant={variant}
      className={cn(sizeClasses[size], className)}
    >
      {formatScore(score)}
    </Badge>
  )
}
