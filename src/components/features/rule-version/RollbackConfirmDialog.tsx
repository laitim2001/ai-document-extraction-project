/**
 * @fileoverview 回滾確認對話框組件
 * @description
 *   顯示回滾確認對話框，包含：
 *   - 回滾操作警告
 *   - 回滾原因輸入（選填）
 *   - 確認/取消按鈕
 *   - 載入狀態顯示
 *
 * @module src/components/features/rule-version/RollbackConfirmDialog
 * @since Epic 4 - Story 4.7 (規則版本歷史管理)
 * @lastModified 2025-12-19
 *
 * @dependencies
 *   - @/components/ui - shadcn/ui 組件
 */

'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
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
import { Loader2, AlertTriangle } from 'lucide-react'

// ============================================================
// Types
// ============================================================

interface RollbackConfirmDialogProps {
  /** 是否開啟對話框 */
  open: boolean
  /** 對話框開關狀態變更處理 */
  onOpenChange: (open: boolean) => void
  /** 確認回滾處理 */
  onConfirm: (reason?: string) => void
  /** 是否正在載入 */
  isLoading: boolean
  /** 目標版本號 */
  targetVersion?: number
}

// ============================================================
// Component
// ============================================================

/**
 * 回滾確認對話框
 *
 * @description
 *   在執行回滾操作前顯示確認對話框，讓用戶確認操作並可選填回滾原因。
 *
 * @example
 * ```tsx
 * <RollbackConfirmDialog
 *   open={isOpen}
 *   onOpenChange={setIsOpen}
 *   onConfirm={handleConfirmRollback}
 *   isLoading={isPending}
 *   targetVersion={3}
 * />
 * ```
 */
export function RollbackConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
  isLoading,
  targetVersion,
}: RollbackConfirmDialogProps) {
  const t = useTranslations('rules')
  const tc = useTranslations('common')
  const [reason, setReason] = useState('')

  /**
   * 處理確認按鈕點擊
   */
  const handleConfirm = () => {
    onConfirm(reason.trim() || undefined)
  }

  /**
   * 處理對話框關閉
   */
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      // 關閉時清空輸入
      setReason('')
    }
    onOpenChange(newOpen)
  }

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
            {t('ruleVersion.rollbackDialog.title')}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2">
              <p>
                {t('ruleVersion.rollbackDialog.confirmQuestion', {
                  version: targetVersion ?? '',
                })}
              </p>
              <p className="text-sm">
                {t('ruleVersion.rollbackDialog.description', {
                  version: targetVersion ?? '',
                })}
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-2 py-2">
          <Label htmlFor="rollback-reason">
            {t('ruleVersion.rollbackDialog.reasonLabel')}
          </Label>
          <Textarea
            id="rollback-reason"
            placeholder={t('ruleVersion.rollbackDialog.reasonPlaceholder')}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            maxLength={500}
            disabled={isLoading}
          />
          <p className="text-xs text-muted-foreground text-right">
            {reason.length}/500
          </p>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>
            {tc('actions.cancel')}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={isLoading}
            className="bg-primary"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t('ruleVersion.rollbackDialog.processing')}
              </>
            ) : (
              t('ruleVersion.rollbackDialog.confirm')
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
