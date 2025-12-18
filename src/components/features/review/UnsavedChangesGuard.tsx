/**
 * @fileoverview 未儲存變更警告組件
 * @description
 *   提供未儲存變更的警告機制，包含：
 *   - 瀏覽器關閉/重新整理警告（beforeunload）
 *   - 頁面導航警告對話框
 *   - 與 reviewStore 整合
 *
 * @module src/components/features/review/UnsavedChangesGuard
 * @since Epic 3 - Story 3.5 (修正提取結果)
 * @lastModified 2025-12-18
 *
 * @dependencies
 *   - @/stores/reviewStore - 狀態管理
 *   - @/components/ui/alert-dialog - 對話框組件
 */

'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, Save, X } from 'lucide-react'
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
import { Button } from '@/components/ui/button'
import { useReviewStore } from '@/stores/reviewStore'

// ============================================================
// Types
// ============================================================

interface UnsavedChangesGuardProps {
  /** 子元素 */
  children: React.ReactNode
  /** 儲存回呼（如提供，會顯示儲存選項） */
  onSave?: () => Promise<void>
  /** 是否正在儲存 */
  isSaving?: boolean
  /** 自定義警告訊息 */
  message?: string
}

interface UnsavedChangesDialogProps {
  /** 對話框開啟狀態 */
  open: boolean
  /** 關閉對話框回呼 */
  onOpenChange: (open: boolean) => void
  /** 繼續離開回呼 */
  onLeave: () => void
  /** 儲存並離開回呼 */
  onSaveAndLeave?: () => void
  /** 待儲存項目數量 */
  pendingCount: number
  /** 是否正在儲存 */
  isSaving?: boolean
  /** 自定義訊息 */
  message?: string
}

// ============================================================
// Dialog Component
// ============================================================

/**
 * 未儲存變更對話框
 */
export function UnsavedChangesDialog({
  open,
  onOpenChange,
  onLeave,
  onSaveAndLeave,
  pendingCount,
  isSaving = false,
  message,
}: UnsavedChangesDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-amber-600">
            <AlertTriangle className="h-5 w-5" />
            未儲存的變更
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2">
              <p>
                {message || `您有 ${pendingCount} 個未儲存的欄位修正。`}
              </p>
              <p className="text-xs text-muted-foreground">
                如果離開此頁面，這些修正將會遺失。
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter className="flex-col sm:flex-row gap-2">
          <AlertDialogCancel disabled={isSaving}>
            繼續編輯
          </AlertDialogCancel>

          {onSaveAndLeave && (
            <Button
              variant="outline"
              onClick={onSaveAndLeave}
              disabled={isSaving}
              className="border-green-600 text-green-600 hover:bg-green-50"
            >
              <Save className="mr-2 h-4 w-4" />
              {isSaving ? '儲存中...' : '儲存並離開'}
            </Button>
          )}

          <AlertDialogAction
            onClick={onLeave}
            disabled={isSaving}
            className="bg-destructive hover:bg-destructive/90"
          >
            <X className="mr-2 h-4 w-4" />
            放棄變更
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

// ============================================================
// Guard Component
// ============================================================

/**
 * 未儲存變更警告組件
 *
 * @description
 *   監聽 reviewStore 的 hasPendingChanges 狀態，
 *   在使用者嘗試離開頁面時顯示警告。
 *
 *   功能：
 *   - 瀏覽器 beforeunload 事件（關閉/重新整理）
 *   - 可選的儲存並離開功能
 *
 * @example
 * ```tsx
 * <UnsavedChangesGuard onSave={handleSave} isSaving={isSaving}>
 *   <ReviewPanel />
 * </UnsavedChangesGuard>
 * ```
 */
export function UnsavedChangesGuard({
  children,
  onSave: _onSave,
  isSaving: _isSaving = false,
  message: _message,
}: UnsavedChangesGuardProps) {
  // Note: _onSave, _isSaving, _message 保留用於未來整合對話框功能
  const { hasPendingChanges } = useReviewStore()
  const hasChanges = hasPendingChanges()

  // --- beforeunload 事件處理 ---
  React.useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasChanges) {
        e.preventDefault()
        // 現代瀏覽器會顯示標準訊息，忽略自訂訊息
        e.returnValue = ''
        return ''
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [hasChanges])

  return <>{children}</>
}

// ============================================================
// Hook for programmatic navigation
// ============================================================

/**
 * 未儲存變更導航 Hook
 *
 * @description
 *   提供程式化導航時的未儲存變更檢查。
 *   使用時需要在組件中渲染對話框。
 *
 * @example
 * ```tsx
 * function ReviewPage() {
 *   const {
 *     showDialog,
 *     dialogProps,
 *     navigateTo,
 *     confirmLeave,
 *   } = useUnsavedChangesNavigation()
 *
 *   const handleBack = () => {
 *     navigateTo('/review')
 *   }
 *
 *   return (
 *     <>
 *       <Button onClick={handleBack}>返回列表</Button>
 *       {showDialog && <UnsavedChangesDialog {...dialogProps} />}
 *     </>
 *   )
 * }
 * ```
 */
export function useUnsavedChangesNavigation(options?: {
  onSave?: () => Promise<void>
  isSaving?: boolean
}) {
  const router = useRouter()
  const { hasPendingChanges, getPendingCorrections, resetChanges } = useReviewStore()
  const [showDialog, setShowDialog] = React.useState(false)
  const [pendingNavigation, setPendingNavigation] = React.useState<string | null>(null)

  const hasChanges = hasPendingChanges()
  const pendingCount = getPendingCorrections().length

  /**
   * 嘗試導航到指定路徑
   * 如果有未儲存變更，顯示對話框
   */
  const navigateTo = React.useCallback(
    (path: string) => {
      if (hasChanges) {
        setPendingNavigation(path)
        setShowDialog(true)
      } else {
        router.push(path)
      }
    },
    [hasChanges, router]
  )

  /**
   * 確認離開（放棄變更）
   */
  const confirmLeave = React.useCallback(() => {
    resetChanges()
    setShowDialog(false)
    if (pendingNavigation) {
      router.push(pendingNavigation)
      setPendingNavigation(null)
    }
  }, [pendingNavigation, resetChanges, router])

  /**
   * 儲存並離開
   */
  const saveAndLeave = React.useCallback(async () => {
    if (options?.onSave) {
      await options.onSave()
      setShowDialog(false)
      if (pendingNavigation) {
        router.push(pendingNavigation)
        setPendingNavigation(null)
      }
    }
  }, [options, pendingNavigation, router])

  /**
   * 取消導航
   */
  const cancelNavigation = React.useCallback(() => {
    setShowDialog(false)
    setPendingNavigation(null)
  }, [])

  return {
    /** 是否顯示對話框 */
    showDialog,
    /** 對話框屬性 */
    dialogProps: {
      open: showDialog,
      onOpenChange: (open: boolean) => {
        if (!open) cancelNavigation()
      },
      onLeave: confirmLeave,
      onSaveAndLeave: options?.onSave ? saveAndLeave : undefined,
      pendingCount,
      isSaving: options?.isSaving,
    },
    /** 導航到指定路徑（會檢查未儲存變更） */
    navigateTo,
    /** 確認離開 */
    confirmLeave,
    /** 儲存並離開 */
    saveAndLeave,
    /** 取消導航 */
    cancelNavigation,
    /** 是否有未儲存變更 */
    hasChanges,
    /** 待儲存項目數量 */
    pendingCount,
  }
}
