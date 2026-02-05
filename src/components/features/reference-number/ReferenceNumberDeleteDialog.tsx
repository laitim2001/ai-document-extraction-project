'use client'

/**
 * @fileoverview Reference Number 刪除確認對話框
 * @description
 *   提供刪除 Reference Number 的確認對話框。
 *   使用 AlertDialog 組件，整合 useDeleteReferenceNumber hook。
 *
 * @module src/components/features/reference-number/ReferenceNumberDeleteDialog
 * @since Epic 20 - Story 20.5 (Management Page - List & Filter)
 * @lastModified 2026-02-05
 *
 * @dependencies
 *   - next-intl - 國際化
 *   - @/components/ui/alert-dialog - 確認對話框
 *   - @/hooks/use-reference-numbers - Reference Number 操作 Hook
 *   - @/hooks/use-toast - Toast 通知
 */

import * as React from 'react'
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
import { useDeleteReferenceNumber } from '@/hooks/use-reference-numbers'
import { useToast } from '@/hooks/use-toast'

// ============================================================
// Types
// ============================================================

interface ReferenceNumberDeleteDialogProps {
  /** 要刪除的 Reference Number ID（null 表示關閉） */
  id: string | null
  /** 關閉對話框回調 */
  onClose: () => void
}

// ============================================================
// Component
// ============================================================

/**
 * Reference Number 刪除確認對話框
 *
 * @param props - 組件屬性
 * @returns React 元素
 */
export function ReferenceNumberDeleteDialog({
  id,
  onClose,
}: ReferenceNumberDeleteDialogProps) {
  const t = useTranslations('referenceNumber')
  const { toast } = useToast()
  const deleteMutation = useDeleteReferenceNumber()

  const handleConfirm = React.useCallback(async () => {
    if (!id) return

    try {
      await deleteMutation.mutateAsync(id)
      toast({
        title: t('toast.deleteSuccess'),
        description: t('toast.deleteSuccessDesc'),
      })
      onClose()
    } catch (err) {
      toast({
        variant: 'destructive',
        title: t('toast.deleteFailed'),
        description: err instanceof Error ? err.message : String(err),
      })
    }
  }, [id, deleteMutation, toast, t, onClose])

  return (
    <AlertDialog
      open={!!id}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('deleteDialog.title')}</AlertDialogTitle>
          <AlertDialogDescription>
            {t('deleteDialog.description')}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t('deleteDialog.cancel')}</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {deleteMutation.isPending
              ? t('deleteDialog.deleting')
              : t('deleteDialog.confirm')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
