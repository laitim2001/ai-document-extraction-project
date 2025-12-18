/**
 * @fileoverview 信心度 Badge 組件
 * @description
 *   顯示信心度分數的 Badge 組件，支援三重編碼：
 *   - 顏色：綠（高）/ 黃（中）/ 紅（低）
 *   - 形狀：✓（高）/ ○（中）/ △（低）
 *   - 數字：實際百分比
 *
 *   功能特點：
 *   - 使用 CSS HSL 變數支援主題切換
 *   - 低信心度時顯示脈動動畫
 *   - 支援多種尺寸和變體
 *   - WCAG 2.1 AA 無障礙合規
 *
 * @module src/components/features/review/ConfidenceBadge
 * @since Epic 3 - Story 3.1
 * @lastModified 2025-12-18
 *
 * @dependencies
 *   - @/components/ui/badge - shadcn Badge 組件
 *   - @/lib/confidence - 信心度閾值和工具函數
 *   - ./ConfidenceIndicator - 形狀指示器組件
 */

'use client'

import { Badge } from '@/components/ui/badge'
import { getConfidenceLevel, CONFIDENCE_THRESHOLDS } from '@/lib/confidence'
import { ConfidenceIndicator } from './ConfidenceIndicator'
import { cn } from '@/lib/utils'

// ============================================================
// Types
// ============================================================

interface ConfidenceBadgeProps {
  /** 信心度分數 (0-100) */
  score: number
  /** 是否顯示圖標 */
  showIcon?: boolean
  /** 是否顯示標籤而非百分比 */
  showLabel?: boolean
  /** 尺寸 */
  size?: 'sm' | 'default' | 'lg'
  /** 變體樣式 */
  variant?: 'badge' | 'inline' | 'pill'
  /** 額外的 CSS 類名 */
  className?: string
}

// ============================================================
// Constants
// ============================================================

const SIZE_CLASSES = {
  sm: 'text-xs px-1.5 py-0 h-5',
  default: 'text-sm px-2 py-0.5 h-6',
  lg: 'text-base px-3 py-1 h-8',
} as const

const COLOR_CLASSES = {
  high: 'bg-[hsl(var(--confidence-high-bg))] text-[hsl(var(--confidence-high-text))] border-[hsl(var(--confidence-high))]',
  medium:
    'bg-[hsl(var(--confidence-medium-bg))] text-[hsl(var(--confidence-medium-text))] border-[hsl(var(--confidence-medium))]',
  low: 'bg-[hsl(var(--confidence-low-bg))] text-[hsl(var(--confidence-low-text))] border-[hsl(var(--confidence-low))]',
} as const

// ============================================================
// Component
// ============================================================

/**
 * 信心度 Badge 組件
 *
 * @description
 *   使用三重編碼（顏色、形狀、數字）顯示信心度，
 *   支援多種樣式變體和尺寸。
 *
 * @example
 * ```tsx
 * <ConfidenceBadge score={85} />
 * <ConfidenceBadge score={65} showIcon={false} />
 * <ConfidenceBadge score={45} size="sm" />
 * <ConfidenceBadge score={92} showLabel variant="pill" />
 * ```
 */
export function ConfidenceBadge({
  score,
  showIcon = true,
  showLabel = false,
  size = 'default',
  variant = 'badge',
  className,
}: ConfidenceBadgeProps) {
  const level = getConfidenceLevel(score)
  const config = CONFIDENCE_THRESHOLDS[level]
  const colorClass = COLOR_CLASSES[level]

  // Inline 變體 - 無背景的行內顯示
  if (variant === 'inline') {
    return (
      <span className={cn('inline-flex items-center gap-1', className)}>
        {showIcon && <ConfidenceIndicator level={level} size={size} />}
        <span
          className={cn(
            'font-medium',
            level === 'high' && 'text-[hsl(var(--confidence-high-text))]',
            level === 'medium' && 'text-[hsl(var(--confidence-medium-text))]',
            level === 'low' && 'text-[hsl(var(--confidence-low-text))]'
          )}
        >
          {score}%
        </span>
      </span>
    )
  }

  // Badge/Pill 變體
  return (
    <Badge
      variant="outline"
      className={cn(
        SIZE_CLASSES[size],
        colorClass,
        'font-medium',
        variant === 'pill' && 'rounded-full',
        // 低信心度脈動動畫
        level === 'low' && 'confidence-low-attention',
        className
      )}
    >
      {showIcon && (
        <ConfidenceIndicator level={level} size={size} className="mr-1" />
      )}
      {showLabel ? config.labelZh : `${score}%`}
    </Badge>
  )
}
