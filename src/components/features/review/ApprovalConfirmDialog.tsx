'use client'

/**
 * @fileoverview 審核確認對話框組件
 * @description
 *   提供審核確認前的最終確認對話框，包含：
 *   - 確認提示訊息
 *   - 可選的備註輸入
 *   - 確認/取消操作
 *
 * @module src/components/features/review/ApprovalConfirmDialog
 * @since Epic 3 - Story 3.4 (確認提取結果)
 * @lastModified 2025-12-18
 *
 * @dependencies
 *   - @/components/ui/alert-dialog - 對話框組件
 *   - @/components/ui/textarea - 文字輸入
 */

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { CheckCircle, Loader2 } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'

// ============================================================
// Types
// ============================================================

interface ApprovalConfirmDialogProps {
  /** 對話框開啟狀態 */
  open: boolean
  /** 關閉對話框回呼 */
  onOpenChange: (open: boolean) => void
  /** 確認回呼（傳入備註） */
  onConfirm: (notes?: string) => void
  /** 確認欄位數量 */
  fieldCount: number
  /** 是否正在提交 */
  isSubmitting?: boolean
  /** 處理路徑（用於顯示不同訊息） */
  processingPath?: 'AUTO_APPROVE' | 'QUICK_REVIEW' | 'FULL_REVIEW' | 'MANUAL_REQUIRED'
}

// ============================================================
// Component
// ============================================================

/**
 * 審核確認對話框
 *
 * @description 在使用者點擊「確認無誤」按鈕後顯示，
 *   提供最終確認機會並允許添加備註。
 *
 * @example
 * ```tsx
 * <ApprovalConfirmDialog
 *   open={showDialog}
 *   onOpenChange={setShowDialog}
 *   onConfirm={(notes) => handleApprove(notes)}
 *   fieldCount={15}
 *   isSubmitting={isApproving}
 *   processingPath="QUICK_REVIEW"
 * />
 * ```
 */
export function ApprovalConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
  fieldCount,
  isSubmitting = false,
  processingPath,
}: ApprovalConfirmDialogProps) {
  // --- Hooks ---
  const t = useTranslations('review')

  // --- State ---
  const [notes, setNotes] = React.useState('')

  // --- Handlers ---
  const handleConfirm = () => {
    onConfirm(notes.trim() || undefined)
  }

  const handleOpenChange = (newOpen: boolean) => {
    if (!isSubmitting) {
      onOpenChange(newOpen)
      if (!newOpen) {
        setNotes('')
      }
    }
  }

  // --- Render ---
  const getPathDescription = () => {
    switch (processingPath) {
      case 'QUICK_REVIEW':
        return t('approval.quickReviewMode')
      case 'FULL_REVIEW':
        return t('approval.fullReviewMode')
      default:
        return t('approval.review')
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            {t('approval.confirmTitle')}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <p>
                {t('approval.confirmDesc', { mode: getPathDescription() })}
                {t('approval.fieldsConfirmed', { count: fieldCount })}
              </p>
              <p className="text-xs text-muted-foreground">
                {t('approval.afterConfirm')}
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>

        {/* 備註輸入 */}
        <div className="space-y-2">
          <Label htmlFor="approval-notes" className="text-sm">
            {t('approval.reviewNotes')}
          </Label>
          <Textarea
            id="approval-notes"
            placeholder={t('approval.notesPlaceholder')}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={isSubmitting}
            className="min-h-[80px] resize-none"
            maxLength={1000}
          />
          <p className="text-xs text-muted-foreground text-right">
            {notes.length}/1000
          </p>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isSubmitting}>
            {t('approval.cancel')}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={isSubmitting}
            className="bg-green-600 hover:bg-green-700"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t('approval.confirming')}
              </>
            ) : (
              <>
                <CheckCircle className="mr-2 h-4 w-4" />
                {t('reviewActions.confirm')}
              </>
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
