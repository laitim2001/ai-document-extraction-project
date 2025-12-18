/**
 * @fileoverview 審核操作按鈕組件
 * @description
 *   審核面板底部的操作按鈕區域：
 *   - 確認無誤按鈕
 *   - 儲存修正按鈕
 *   - 升級案例按鈕
 *   - 未儲存修改提示
 *
 * @module src/components/features/review/ReviewPanel
 * @since Epic 3 - Story 3.2 (並排 PDF 審核介面)
 * @lastModified 2025-12-18
 */

'use client'

import { Button } from '@/components/ui/button'
import { Check, Save, ArrowUpRight, Loader2 } from 'lucide-react'

// ============================================================
// Types
// ============================================================

interface ReviewActionsProps {
  /** 確認無誤回調 */
  onApprove: () => void
  /** 儲存修正回調 */
  onSaveCorrections: () => void
  /** 升級案例回調 */
  onEscalate: () => void
  /** 是否有未儲存的修改 */
  hasPendingChanges: boolean
  /** 是否正在提交 */
  isSubmitting?: boolean
}

// ============================================================
// Component
// ============================================================

/**
 * 審核操作按鈕組件
 *
 * @example
 * ```tsx
 * <ReviewActions
 *   onApprove={handleApprove}
 *   onSaveCorrections={handleSave}
 *   onEscalate={handleEscalate}
 *   hasPendingChanges={true}
 *   isSubmitting={false}
 * />
 * ```
 */
export function ReviewActions({
  onApprove,
  onSaveCorrections,
  onEscalate,
  hasPendingChanges,
  isSubmitting,
}: ReviewActionsProps) {
  return (
    <div className="p-4 border-t bg-muted/30">
      <div className="flex items-center gap-3">
        {/* 確認無誤 */}
        <Button
          onClick={onApprove}
          disabled={hasPendingChanges || isSubmitting}
          className="flex-1"
        >
          {isSubmitting ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Check className="h-4 w-4 mr-2" />
          )}
          確認無誤
        </Button>

        {/* 儲存修正 */}
        <Button
          variant="secondary"
          onClick={onSaveCorrections}
          disabled={!hasPendingChanges || isSubmitting}
          className="flex-1"
        >
          {isSubmitting ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          儲存修正
        </Button>

        {/* 升級案例 */}
        <Button
          variant="outline"
          onClick={onEscalate}
          disabled={isSubmitting}
        >
          <ArrowUpRight className="h-4 w-4 mr-2" />
          升級
        </Button>
      </div>

      {hasPendingChanges && (
        <p className="text-xs text-muted-foreground mt-2 text-center">
          有未儲存的修改
        </p>
      )}
    </div>
  )
}
