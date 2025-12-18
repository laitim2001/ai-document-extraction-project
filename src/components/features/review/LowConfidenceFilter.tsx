/**
 * @fileoverview 低信心度篩選組件
 * @description
 *   提供切換開關來篩選顯示低信心度欄位（AC3）：
 *   - 開關控制是否只顯示低信心度欄位
 *   - 顯示低信心度欄位數量統計
 *   - 開啟時有視覺強調效果
 *
 * @module src/components/features/review/LowConfidenceFilter
 * @since Epic 3 - Story 3.3 (信心度顏色編碼顯示)
 * @lastModified 2025-12-18
 *
 * @dependencies
 *   - @/components/ui/switch - 開關組件
 *   - @/components/ui/label - 標籤組件
 *   - lucide-react - 圖標
 */

'use client'

import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'

// ============================================================
// Types
// ============================================================

interface LowConfidenceFilterProps {
  /** 是否啟用篩選 */
  enabled: boolean
  /** 切換回調 */
  onToggle: (enabled: boolean) => void
  /** 低信心度欄位數量 */
  lowConfidenceCount: number
  /** 總欄位數量 */
  totalCount: number
  /** 額外的 CSS 類名 */
  className?: string
}

// ============================================================
// Component
// ============================================================

/**
 * 低信心度篩選切換組件
 *
 * @description
 *   用於審核面板頂部，讓使用者快速篩選只顯示需要關注的低信心度欄位。
 *   當啟用時，組件外觀會變為紅色系強調狀態。
 *
 * @example
 * ```tsx
 * const [showLowOnly, setShowLowOnly] = useState(false)
 *
 * <LowConfidenceFilter
 *   enabled={showLowOnly}
 *   onToggle={setShowLowOnly}
 *   lowConfidenceCount={5}
 *   totalCount={20}
 * />
 * ```
 */
export function LowConfidenceFilter({
  enabled,
  onToggle,
  lowConfidenceCount,
  totalCount,
  className,
}: LowConfidenceFilterProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-between p-3 rounded-lg',
        'bg-muted/50 border transition-colors',
        enabled &&
          'border-[hsl(var(--confidence-low))] bg-[hsl(var(--confidence-low-bg))]',
        className
      )}
    >
      <div className="flex items-center gap-2">
        <AlertTriangle
          className={cn(
            'h-4 w-4',
            enabled
              ? 'text-[hsl(var(--confidence-low))]'
              : 'text-muted-foreground'
          )}
        />
        <Label
          htmlFor="low-confidence-filter"
          className="text-sm cursor-pointer"
        >
          僅顯示低信心度欄位
        </Label>
        <span className="text-xs text-muted-foreground">
          ({lowConfidenceCount}/{totalCount})
        </span>
      </div>

      <Switch
        id="low-confidence-filter"
        checked={enabled}
        onCheckedChange={onToggle}
      />
    </div>
  )
}
