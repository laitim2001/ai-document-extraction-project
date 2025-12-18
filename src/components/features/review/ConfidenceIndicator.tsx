/**
 * @fileoverview 信心度形狀指示器組件
 * @description
 *   使用不同形狀視覺化信心度等級（WCAG 2.1 AA 合規）：
 *   - High: ✓ Check 勾號
 *   - Medium: ○ Circle 圓圈
 *   - Low: △ AlertTriangle 三角警告
 *
 * @module src/components/features/review/ConfidenceIndicator
 * @since Epic 3 - Story 3.3 (信心度顏色編碼顯示)
 * @lastModified 2025-12-18
 *
 * @dependencies
 *   - lucide-react - Icon 組件
 *   - @/lib/utils - cn 工具函數
 */

import type { ConfidenceLevel } from '@/types/confidence'
import { Check, Circle, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'

// ============================================================
// Types
// ============================================================

interface ConfidenceIndicatorProps {
  /** 信心度等級 */
  level: ConfidenceLevel
  /** 尺寸 */
  size?: 'sm' | 'default' | 'lg'
  /** 額外的 CSS 類名 */
  className?: string
}

// ============================================================
// Constants
// ============================================================

const SIZE_MAP = {
  sm: 'h-3 w-3',
  default: 'h-4 w-4',
  lg: 'h-5 w-5',
} as const

// ============================================================
// Component
// ============================================================

/**
 * 信心度形狀指示器
 *
 * @description
 *   使用 lucide-react 圖標顯示信心度等級，
 *   配合顏色和數字形成三重編碼，確保色盲用戶也能辨識。
 *
 * @example
 * ```tsx
 * <ConfidenceIndicator level="high" />
 * <ConfidenceIndicator level="medium" size="sm" />
 * <ConfidenceIndicator level="low" size="lg" className="mr-2" />
 * ```
 */
export function ConfidenceIndicator({
  level,
  size = 'default',
  className,
}: ConfidenceIndicatorProps) {
  const iconClass = cn(SIZE_MAP[size], className)

  switch (level) {
    case 'high':
      return (
        <Check
          className={cn(iconClass, 'text-[hsl(var(--confidence-high))]')}
          aria-label="高信心度"
        />
      )
    case 'medium':
      return (
        <Circle
          className={cn(iconClass, 'text-[hsl(var(--confidence-medium))]')}
          aria-label="中信心度"
        />
      )
    case 'low':
      return (
        <AlertTriangle
          className={cn(iconClass, 'text-[hsl(var(--confidence-low))]')}
          aria-label="低信心度"
        />
      )
  }
}
