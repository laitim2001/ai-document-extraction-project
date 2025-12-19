/**
 * @fileoverview 版本對比對話框組件
 * @description
 *   版本對比功能的主要對話框，包含：
 *   - 載入狀態與錯誤處理
 *   - 差異查看器整合
 *   - 回滾操作整合
 *   - 對話框狀態管理
 *
 * @module src/components/features/rule-version/VersionCompareDialog
 * @since Epic 4 - Story 4.7 (規則版本歷史管理)
 * @lastModified 2025-12-19
 *
 * @dependencies
 *   - @/components/ui - shadcn/ui 組件
 *   - @/hooks/useVersions - 版本 Hooks
 */

'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { AlertCircle, RotateCcw } from 'lucide-react'
import { useVersionCompare, useManualRollback } from '@/hooks/useVersions'
import { VersionDiffViewer } from './VersionDiffViewer'
import { RollbackConfirmDialog } from './RollbackConfirmDialog'
import { toast } from 'sonner'

// ============================================================
// Types
// ============================================================

interface VersionCompareDialogProps {
  /** 規則 ID */
  ruleId: string
  /** 版本 1 ID */
  versionId1: string | null
  /** 版本 2 ID */
  versionId2: string | null
  /** 是否開啟對話框 */
  open: boolean
  /** 對話框開關狀態變更處理 */
  onOpenChange: (open: boolean) => void
  /** 回滾成功回調 */
  onRollbackSuccess?: () => void
}

// ============================================================
// Component
// ============================================================

/**
 * 版本對比對話框
 *
 * @description
 *   顯示兩個版本之間的差異，並提供回滾操作功能。
 *   整合 VersionDiffViewer 顯示差異，RollbackConfirmDialog 處理回滾確認。
 *
 * @example
 * ```tsx
 * <VersionCompareDialog
 *   ruleId="rule-123"
 *   versionId1="ver-1"
 *   versionId2="ver-2"
 *   open={isOpen}
 *   onOpenChange={setIsOpen}
 *   onRollbackSuccess={handleRollbackSuccess}
 * />
 * ```
 */
export function VersionCompareDialog({
  ruleId,
  versionId1,
  versionId2,
  open,
  onOpenChange,
  onRollbackSuccess,
}: VersionCompareDialogProps) {
  const [rollbackDialogOpen, setRollbackDialogOpen] = useState(false)
  const [rollbackTargetVersion, setRollbackTargetVersion] = useState<{
    id: string
    version: number
  } | null>(null)

  // 版本對比查詢
  const {
    data: compareData,
    isLoading,
    error,
  } = useVersionCompare(
    ruleId,
    versionId1 ?? undefined,
    versionId2 ?? undefined,
    open && !!versionId1 && !!versionId2
  )

  // 回滾 Mutation
  const { mutate: rollback, isPending: isRollingBack } =
    useManualRollback(ruleId)

  /**
   * 處理回滾按鈕點擊
   */
  const handleRollbackClick = (versionId: string, versionNumber: number) => {
    setRollbackTargetVersion({ id: versionId, version: versionNumber })
    setRollbackDialogOpen(true)
  }

  /**
   * 處理回滾確認
   */
  const handleRollbackConfirm = (reason?: string) => {
    if (!rollbackTargetVersion) return

    rollback(
      {
        targetVersionId: rollbackTargetVersion.id,
        reason,
      },
      {
        onSuccess: (result) => {
          toast.success(`成功回滾到版本 ${result.toVersion}`)
          setRollbackDialogOpen(false)
          setRollbackTargetVersion(null)
          onOpenChange(false)
          onRollbackSuccess?.()
        },
        onError: (err) => {
          toast.error(`回滾失敗: ${err.message}`)
        },
      }
    )
  }

  /**
   * 渲染載入狀態
   */
  const renderLoading = () => (
    <div className="space-y-4">
      <Skeleton className="h-8 w-48" />
      <div className="border rounded-lg p-4">
        <Skeleton className="h-32" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Skeleton className="h-48" />
        <Skeleton className="h-48" />
      </div>
    </div>
  )

  /**
   * 渲染錯誤狀態
   */
  const renderError = () => (
    <Alert variant="destructive">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>載入失敗</AlertTitle>
      <AlertDescription>
        {error?.message || '無法載入版本對比數據'}
      </AlertDescription>
    </Alert>
  )

  /**
   * 渲染內容
   */
  const renderContent = () => {
    if (isLoading) return renderLoading()
    if (error) return renderError()
    if (!compareData) return null

    const { version1, version2, differences, patternDiff, summaryText } =
      compareData

    return (
      <div className="space-y-6">
        {/* 差異摘要 */}
        <div className="p-4 bg-muted rounded-lg">
          <h4 className="font-medium mb-2">變更摘要</h4>
          <p className="text-sm text-muted-foreground">{summaryText}</p>
        </div>

        {/* 差異查看器 */}
        <VersionDiffViewer
          version1={version1}
          version2={version2}
          differences={differences}
          patternDiff={patternDiff}
        />

        {/* 回滾操作區 */}
        <div className="flex items-center justify-between pt-4 border-t">
          <div className="text-sm text-muted-foreground">
            選擇要回滾的目標版本
          </div>
          <div className="flex gap-2">
            {!version1.isActive && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleRollbackClick(version1.id, version1.version)}
                disabled={isRollingBack}
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                回滾到版本 {version1.version}
              </Button>
            )}
            {!version2.isActive && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleRollbackClick(version2.id, version2.version)}
                disabled={isRollingBack}
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                回滾到版本 {version2.version}
              </Button>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>版本對比</DialogTitle>
            <DialogDescription>
              比較兩個版本之間的差異，查看變更內容
            </DialogDescription>
          </DialogHeader>
          {renderContent()}
        </DialogContent>
      </Dialog>

      {/* 回滾確認對話框 */}
      <RollbackConfirmDialog
        open={rollbackDialogOpen}
        onOpenChange={setRollbackDialogOpen}
        onConfirm={handleRollbackConfirm}
        isLoading={isRollingBack}
        targetVersion={rollbackTargetVersion?.version}
      />
    </>
  )
}
