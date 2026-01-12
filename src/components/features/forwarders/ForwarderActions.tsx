'use client'

/**
 * @fileoverview Forwarder 操作組件
 * @description
 *   提供 Forwarder 的操作功能，包括停用/啟用對話框。
 *   包含確認對話框、規則處理選項和狀態管理。
 *
 * @module src/components/features/forwarders/ForwarderActions
 * @author Development Team
 * @since Epic 5 - Story 5.5 (新增/停用貨代商配置)
 * @lastModified 2025-12-19
 *
 * @features
 *   - 停用確認對話框
 *   - 啟用確認對話框
 *   - 規則處理選項
 *   - 狀態變更回調
 *
 * @dependencies
 *   - @/components/ui - shadcn/ui 組件
 *   - @/types/forwarder - 類型定義
 */

import * as React from 'react'
import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, AlertTriangle, CheckCircle2, Power, PowerOff } from 'lucide-react'
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
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { FORWARDER_ACTION_DIALOGS, type ForwarderStatus } from '@/types/forwarder'

// ============================================================
// Types
// ============================================================

interface ForwarderActionsProps {
  /** Forwarder ID */
  forwarderId: string
  /** Forwarder 名稱 */
  forwarderName: string
  /** 當前狀態 */
  status: ForwarderStatus
  /** 活躍規則數量 */
  activeRulesCount?: number
  /** 已停用規則數量 */
  deprecatedRulesCount?: number
  /** 狀態變更後回調 */
  onStatusChange?: () => void
  /** 渲染觸發器（自定義按鈕） */
  trigger?: React.ReactNode
}

interface DeactivateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  forwarderId: string
  forwarderName: string
  activeRulesCount: number
  onSuccess?: () => void
}

interface ActivateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  forwarderId: string
  forwarderName: string
  deprecatedRulesCount: number
  onSuccess?: () => void
}

// ============================================================
// Sub-components
// ============================================================

/**
 * 停用確認對話框
 */
function DeactivateDialog({
  open,
  onOpenChange,
  forwarderId,
  forwarderName,
  activeRulesCount,
  onSuccess,
}: DeactivateDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reason, setReason] = useState('')
  const [deactivateRules, setDeactivateRules] = useState(true)

  const handleDeactivate = async () => {
    setIsSubmitting(true)
    setError(null)

    try {
      const response = await fetch(`/api/companies/${forwarderId}/deactivate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reason: reason.trim() || undefined,
          deactivateRules,
        }),
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(result.error?.detail || '停用失敗')
      }

      onOpenChange(false)
      onSuccess?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : '停用失敗，請稍後重試')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleOpenChange = (newOpen: boolean) => {
    if (!isSubmitting) {
      onOpenChange(newOpen)
      if (!newOpen) {
        // 重置表單
        setReason('')
        setDeactivateRules(true)
        setError(null)
      }
    }
  }

  const config = FORWARDER_ACTION_DIALOGS.deactivate

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            {config.title}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-4">
              <p>
                確定要停用 <strong>{forwarderName}</strong> 嗎？
              </p>
              <p className="text-sm text-muted-foreground">{config.description}</p>

              {/* 錯誤提示 */}
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {/* 規則處理選項 */}
              {activeRulesCount > 0 && (
                <div className="rounded-lg border bg-muted/50 p-3">
                  <div className="flex items-start gap-3">
                    <Checkbox
                      id="deactivate-rules"
                      checked={deactivateRules}
                      onCheckedChange={(checked) => setDeactivateRules(checked === true)}
                      disabled={isSubmitting}
                    />
                    <div className="space-y-1">
                      <Label
                        htmlFor="deactivate-rules"
                        className="text-sm font-medium leading-none cursor-pointer"
                      >
                        同時停用相關規則
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        將 {activeRulesCount} 個活躍規則標記為已停用
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* 停用原因 */}
              <div className="space-y-2">
                <Label htmlFor="reason" className="text-sm font-medium">
                  停用原因（選填）
                </Label>
                <Textarea
                  id="reason"
                  placeholder="請輸入停用原因..."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  disabled={isSubmitting}
                  rows={2}
                />
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isSubmitting}>取消</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault()
              handleDeactivate()
            }}
            disabled={isSubmitting}
            className="bg-amber-600 hover:bg-amber-700"
          >
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {config.confirmText}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

/**
 * 啟用確認對話框
 */
function ActivateDialog({
  open,
  onOpenChange,
  forwarderId,
  forwarderName,
  deprecatedRulesCount,
  onSuccess,
}: ActivateDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reactivateRules, setReactivateRules] = useState(false)

  const handleActivate = async () => {
    setIsSubmitting(true)
    setError(null)

    try {
      const response = await fetch(`/api/companies/${forwarderId}/activate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reactivateRules,
        }),
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(result.error?.detail || '啟用失敗')
      }

      onOpenChange(false)
      onSuccess?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : '啟用失敗，請稍後重試')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleOpenChange = (newOpen: boolean) => {
    if (!isSubmitting) {
      onOpenChange(newOpen)
      if (!newOpen) {
        // 重置表單
        setReactivateRules(false)
        setError(null)
      }
    }
  }

  const config = FORWARDER_ACTION_DIALOGS.activate

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-500" />
            {config.title}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-4">
              <p>
                確定要啟用 <strong>{forwarderName}</strong> 嗎？
              </p>
              <p className="text-sm text-muted-foreground">{config.description}</p>

              {/* 錯誤提示 */}
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {/* 規則處理選項 */}
              {deprecatedRulesCount > 0 && (
                <div className="rounded-lg border bg-muted/50 p-3">
                  <div className="flex items-start gap-3">
                    <Checkbox
                      id="reactivate-rules"
                      checked={reactivateRules}
                      onCheckedChange={(checked) => setReactivateRules(checked === true)}
                      disabled={isSubmitting}
                    />
                    <div className="space-y-1">
                      <Label
                        htmlFor="reactivate-rules"
                        className="text-sm font-medium leading-none cursor-pointer"
                      >
                        同時恢復相關規則
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        將 {deprecatedRulesCount} 個已停用規則恢復為活躍
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isSubmitting}>取消</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault()
              handleActivate()
            }}
            disabled={isSubmitting}
            className="bg-green-600 hover:bg-green-700"
          >
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {config.confirmText}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

// ============================================================
// Main Component
// ============================================================

/**
 * @component ForwarderActions
 * @description
 *   Forwarder 操作組件，提供停用/啟用功能。
 *   根據當前狀態顯示對應的操作按鈕和對話框。
 */
export function ForwarderActions({
  forwarderId,
  forwarderName,
  status,
  activeRulesCount = 0,
  deprecatedRulesCount = 0,
  onStatusChange,
  trigger,
}: ForwarderActionsProps) {
  const router = useRouter()
  const [showDeactivate, setShowDeactivate] = useState(false)
  const [showActivate, setShowActivate] = useState(false)

  const handleSuccess = useCallback(() => {
    router.refresh()
    onStatusChange?.()
  }, [router, onStatusChange])

  // 根據狀態決定可用操作
  const canDeactivate = status === 'ACTIVE'
  const canActivate = status === 'INACTIVE' || status === 'PENDING'

  // 如果提供了自定義觸發器，則由父組件控制
  if (trigger) {
    return (
      <>
        {React.cloneElement(trigger as React.ReactElement, {
          onClick: () => {
            if (canDeactivate) {
              setShowDeactivate(true)
            } else if (canActivate) {
              setShowActivate(true)
            }
          },
        })}

        <DeactivateDialog
          open={showDeactivate}
          onOpenChange={setShowDeactivate}
          forwarderId={forwarderId}
          forwarderName={forwarderName}
          activeRulesCount={activeRulesCount}
          onSuccess={handleSuccess}
        />

        <ActivateDialog
          open={showActivate}
          onOpenChange={setShowActivate}
          forwarderId={forwarderId}
          forwarderName={forwarderName}
          deprecatedRulesCount={deprecatedRulesCount}
          onSuccess={handleSuccess}
        />
      </>
    )
  }

  // 預設按鈕樣式
  return (
    <>
      {canDeactivate && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowDeactivate(true)}
          className="text-amber-600 hover:text-amber-700 hover:bg-amber-50"
        >
          <PowerOff className="mr-2 h-4 w-4" />
          停用
        </Button>
      )}

      {canActivate && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowActivate(true)}
          className="text-green-600 hover:text-green-700 hover:bg-green-50"
        >
          <Power className="mr-2 h-4 w-4" />
          啟用
        </Button>
      )}

      <DeactivateDialog
        open={showDeactivate}
        onOpenChange={setShowDeactivate}
        forwarderId={forwarderId}
        forwarderName={forwarderName}
        activeRulesCount={activeRulesCount}
        onSuccess={handleSuccess}
      />

      <ActivateDialog
        open={showActivate}
        onOpenChange={setShowActivate}
        forwarderId={forwarderId}
        forwarderName={forwarderName}
        deprecatedRulesCount={deprecatedRulesCount}
        onSuccess={handleSuccess}
      />
    </>
  )
}
