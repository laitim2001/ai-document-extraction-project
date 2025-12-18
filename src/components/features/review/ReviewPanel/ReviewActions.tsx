/**
 * @fileoverview 審核操作按鈕組件
 * @description
 *   審核面板底部的操作按鈕區域：
 *   - 確認無誤按鈕（含 Tooltip 提示）
 *   - 儲存修正按鈕
 *   - 升級案例按鈕
 *   - 未儲存修改提示
 *   - 根據處理路徑顯示不同樣式
 *
 * @module src/components/features/review/ReviewPanel
 * @since Epic 3 - Story 3.2 (並排 PDF 審核介面)
 * @lastModified 2025-12-18
 */

'use client'

import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Check, Save, ArrowUpRight, Loader2, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ProcessingPath } from '@prisma/client'

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
  /** 處理路徑（影響按鈕樣式） */
  processingPath?: ProcessingPath
  /** 總欄位數 */
  fieldCount?: number
}

// ============================================================
// Component
// ============================================================

/**
 * 審核操作按鈕組件
 *
 * @description
 *   Story 3.4 增強：
 *   - 確認按鈕加入 Tooltip 說明
 *   - 根據 processingPath 調整按鈕樣式
 *   - QUICK_REVIEW 時確認按鈕更醒目
 *
 * @example
 * ```tsx
 * <ReviewActions
 *   onApprove={handleApprove}
 *   onSaveCorrections={handleSave}
 *   onEscalate={handleEscalate}
 *   hasPendingChanges={true}
 *   isSubmitting={false}
 *   processingPath="QUICK_REVIEW"
 *   fieldCount={15}
 * />
 * ```
 */
export function ReviewActions({
  onApprove,
  onSaveCorrections,
  onEscalate,
  hasPendingChanges,
  isSubmitting,
  processingPath,
  fieldCount = 0,
}: ReviewActionsProps) {
  // 判斷確認按鈕是否可用
  const isApproveDisabled = hasPendingChanges || isSubmitting

  // 根據處理路徑確定按鈕樣式
  const isQuickReview = processingPath === 'QUICK_REVIEW'

  // 生成確認按鈕的 Tooltip 內容
  const getApproveTooltipContent = () => {
    if (isSubmitting) {
      return '正在確認中...'
    }
    if (hasPendingChanges) {
      return '請先儲存修改後再確認'
    }
    return `確認 ${fieldCount} 個欄位無誤，文件將標記為已核准`
  }

  return (
    <div className="p-4 border-t bg-muted/30">
      {/* 處理路徑提示 */}
      {processingPath && (
        <div
          className={cn(
            'mb-3 px-3 py-1.5 rounded-md text-xs flex items-center gap-2',
            isQuickReview
              ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
              : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
          )}
        >
          <AlertCircle className="h-3.5 w-3.5" />
          {isQuickReview ? (
            <span>快速審核模式：僅需確認需關注欄位</span>
          ) : (
            <span>完整審核模式：請詳細檢查所有欄位</span>
          )}
        </div>
      )}

      <div className="flex items-center gap-3">
        {/* 確認無誤 */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex-1">
                <Button
                  onClick={onApprove}
                  disabled={isApproveDisabled}
                  className={cn(
                    'w-full',
                    !isApproveDisabled && isQuickReview && 'bg-green-600 hover:bg-green-700'
                  )}
                >
                  {isSubmitting ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4 mr-2" />
                  )}
                  確認無誤
                </Button>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>{getApproveTooltipContent()}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/* 儲存修正 */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex-1">
                <Button
                  variant="secondary"
                  onClick={onSaveCorrections}
                  disabled={!hasPendingChanges || isSubmitting}
                  className="w-full"
                >
                  {isSubmitting ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  儲存修正
                </Button>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>
                {hasPendingChanges
                  ? '儲存目前的修改'
                  : '沒有需要儲存的修改'}
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/* 升級案例 */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                onClick={onEscalate}
                disabled={isSubmitting}
              >
                <ArrowUpRight className="h-4 w-4 mr-2" />
                升級
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>升級至主管處理</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {hasPendingChanges && (
        <p className="text-xs text-amber-600 dark:text-amber-400 mt-2 text-center flex items-center justify-center gap-1">
          <AlertCircle className="h-3 w-3" />
          有未儲存的修改
        </p>
      )}
    </div>
  )
}
