'use client'

/**
 * @fileoverview 規則批准對話框
 * @description
 *   規則建議批准確認對話框，提供：
 *   - 批准備註輸入（選填）
 *   - 生效日期選擇（選填）
 *   - 確認/取消操作
 *
 * @module src/components/features/rule-review/ApproveDialog
 * @since Epic 4 - Story 4.6 (審核學習規則)
 * @lastModified 2025-12-19
 *
 * @dependencies
 *   - @/components/ui/dialog - shadcn Dialog 組件
 *   - @/components/ui/button - shadcn Button 組件
 *   - @/components/ui/input - shadcn Input 組件
 *   - @/components/ui/textarea - shadcn Textarea 組件
 */

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Loader2, Check, AlertCircle } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'

// ============================================================
// Types
// ============================================================

interface ApproveDialogProps {
  /** 對話框開啟狀態 */
  open: boolean
  /** 對話框狀態變更回調 */
  onOpenChange: (open: boolean) => void
  /** 確認批准回調 */
  onConfirm: (data: { notes?: string; effectiveDate?: string }) => void
  /** 是否正在載入 */
  isLoading: boolean
}

// ============================================================
// Component
// ============================================================

/**
 * 規則批准對話框
 *
 * @description
 *   提供批准規則建議的確認界面，支援：
 *   - AC2: 可選填批准備註
 *   - AC2: 可選填生效日期
 *
 * @example
 * ```tsx
 * <ApproveDialog
 *   open={showApproveDialog}
 *   onOpenChange={setShowApproveDialog}
 *   onConfirm={handleApprove}
 *   isLoading={approve.isPending}
 * />
 * ```
 */
export function ApproveDialog({
  open,
  onOpenChange,
  onConfirm,
  isLoading,
}: ApproveDialogProps) {
  const [notes, setNotes] = useState('')
  const [effectiveDate, setEffectiveDate] = useState('')

  const handleConfirm = () => {
    onConfirm({
      notes: notes.trim() || undefined,
      effectiveDate: effectiveDate || undefined,
    })
  }

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      // 關閉時重置表單
      setNotes('')
      setEffectiveDate('')
    }
    onOpenChange(newOpen)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Check className="h-5 w-5 text-green-600" />
            確認批准規則
          </DialogTitle>
          <DialogDescription>
            批准此規則建議後，將創建或更新對應的映射規則並立即生效。
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              此操作將創建新版本的映射規則，並可能影響後續的文件處理結果。
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <Label htmlFor="notes">審核備註 (選填)</Label>
            <Textarea
              id="notes"
              placeholder="輸入批准備註，例如：經測試確認準確率達標..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={isLoading}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="effectiveDate">生效日期 (選填)</Label>
            <Input
              id="effectiveDate"
              type="date"
              value={effectiveDate}
              onChange={(e) => setEffectiveDate(e.target.value)}
              disabled={isLoading}
              min={new Date().toISOString().split('T')[0]}
            />
            <p className="text-xs text-muted-foreground">
              留空則立即生效，選擇日期則於該日期零時生效
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isLoading}
          >
            取消
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isLoading}
            className="bg-green-600 hover:bg-green-700"
          >
            {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            確認批准
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
