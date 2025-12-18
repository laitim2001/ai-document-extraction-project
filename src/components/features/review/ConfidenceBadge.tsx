/**
 * @fileoverview 信心度 Badge 組件
 * @description
 *   顯示信心度分數的 Badge 組件，支援三重編碼：
 *   - 顏色：綠（高）/ 黃（中）/ 紅（低）
 *   - 形狀：✓（高）/ ○（中）/ △（低）
 *   - 數字：實際百分比
 *
 * @module src/components/features/review/ConfidenceBadge
 * @since Epic 3 - Story 3.1
 * @lastModified 2025-12-18
 *
 * @dependencies
 *   - @/components/ui/badge - shadcn Badge 組件
 *   - @/lib/utils - cn 工具函數
 */

import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

// ============================================================
// Types
// ============================================================

interface ConfidenceBadgeProps {
  /** 信心度分數 (0-100) */
  score: number
  /** 是否顯示圖標 */
  showIcon?: boolean
  /** 尺寸 */
  size?: 'sm' | 'default'
}

// ============================================================
// Config
// ============================================================

const CONFIDENCE_CONFIG = {
  high: {
    icon: '✓',
    label: '高',
    className: 'bg-green-100 text-green-800 border-green-200 hover:bg-green-100',
  },
  medium: {
    icon: '○',
    label: '中',
    className:
      'bg-yellow-100 text-yellow-800 border-yellow-200 hover:bg-yellow-100',
  },
  low: {
    icon: '△',
    label: '低',
    className: 'bg-red-100 text-red-800 border-red-200 hover:bg-red-100',
  },
} as const

// ============================================================
// Component
// ============================================================

/**
 * 信心度 Badge 組件
 * 使用三重編碼（顏色、形狀、數字）顯示信心度
 *
 * @example
 * ```tsx
 * <ConfidenceBadge score={85} />
 * <ConfidenceBadge score={65} showIcon={false} />
 * <ConfidenceBadge score={45} size="sm" />
 * ```
 */
export function ConfidenceBadge({
  score,
  showIcon = true,
  size = 'default',
}: ConfidenceBadgeProps) {
  // 決定信心度等級
  const level = score >= 90 ? 'high' : score >= 70 ? 'medium' : 'low'
  const config = CONFIDENCE_CONFIG[level]

  return (
    <Badge
      variant="outline"
      className={cn(config.className, size === 'sm' && 'text-xs px-1.5 py-0')}
    >
      {showIcon && <span className="mr-1">{config.icon}</span>}
      {score}%
    </Badge>
  )
}
