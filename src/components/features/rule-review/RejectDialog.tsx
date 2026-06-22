'use client'

/**
 * @fileoverview 規則拒絕對話框
 * @description
 *   規則建議拒絕確認對話框，提供：
 *   - 拒絕原因選擇（必填）
 *   - 詳細說明輸入（必填）
 *   - 確認/取消操作
 *
 * @module src/components/features/rule-review/RejectDialog
 * @since Epic 4 - Story 4.6 (審核學習規則)
 * @lastModified 2026-06-22
 *
 * @dependencies
 *   - next-intl - i18n 翻譯（review 命名空間，CHANGE-088 Phase 3）
 *   - @/components/ui/dialog - shadcn Dialog 組件
 *   - @/components/ui/button - shadcn Button 組件
 *   - @/components/ui/textarea - shadcn Textarea 組件
 *   - @/components/ui/radio-group - shadcn RadioGroup 組件
 *   - @/types/review - 拒絕原因類型
 */

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Loader2, X } from 'lucide-react'
import { REJECTION_REASONS, RejectionReason } from '@/types/review'

// ============================================================
// Types
// ============================================================

interface RejectDialogProps {
  /** 對話框開啟狀態 */
  open: boolean
  /** 對話框狀態變更回調 */
  onOpenChange: (open: boolean) => void
  /** 確認拒絕回調 */
  onConfirm: (data: { reason: RejectionReason; reasonDetail: string }) => void
  /** 是否正在載入 */
  isLoading: boolean
}

// ============================================================
// Component
// ============================================================

/**
 * 規則拒絕對話框
 *
 * @description
 *   提供拒絕規則建議的確認界面，支援：
 *   - AC3: 必須選擇拒絕原因
 *   - AC3: 必須填寫詳細說明
 *
 * @example
 * ```tsx
 * <RejectDialog
 *   open={showRejectDialog}
 *   onOpenChange={setShowRejectDialog}
 *   onConfirm={handleReject}
 *   isLoading={reject.isPending}
 * />
 * ```
 */
export function RejectDialog({
  open,
  onOpenChange,
  onConfirm,
  isLoading,
}: RejectDialogProps) {
  const t = useTranslations('review')
  const [reason, setReason] = useState<RejectionReason>('OTHER')
  const [reasonDetail, setReasonDetail] = useState('')

  const isValid = reasonDetail.trim().length > 0

  const handleConfirm = () => {
    if (!isValid) return
    onConfirm({
      reason,
      reasonDetail: reasonDetail.trim(),
    })
  }

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      // 關閉時重置表單
      setReason('OTHER')
      setReasonDetail('')
    }
    onOpenChange(newOpen)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <X className="h-5 w-5 text-destructive" />
            {t('rejection.title')}
          </DialogTitle>
          <DialogDescription>
            {t('rejection.description')}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="space-y-3">
            <Label>{t('rejection.reasonLabel')}</Label>
            <RadioGroup
              value={reason}
              onValueChange={(v) => setReason(v as RejectionReason)}
              disabled={isLoading}
            >
              {REJECTION_REASONS.map((r) => (
                <div key={r.value} className="flex items-start space-x-3 py-1">
                  <RadioGroupItem
                    value={r.value}
                    id={r.value}
                    className="mt-1"
                  />
                  <Label
                    htmlFor={r.value}
                    className="cursor-pointer font-normal leading-relaxed"
                  >
                    <span className="font-medium">
                      {t(`rejection.reasons.${r.value}.label`)}
                    </span>
                    <span className="text-sm text-muted-foreground ml-2">
                      - {t(`rejection.reasons.${r.value}.description`)}
                    </span>
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reasonDetail">{t('rejection.detailLabel')}</Label>
            <Textarea
              id="reasonDetail"
              placeholder={t('rejection.detailPlaceholder')}
              value={reasonDetail}
              onChange={(e) => setReasonDetail(e.target.value)}
              disabled={isLoading}
              rows={4}
            />
            {!isValid && reasonDetail.length > 0 && (
              <p className="text-xs text-destructive">
                {t('rejection.detailEmpty')}
              </p>
            )}
            {reasonDetail.length === 0 && (
              <p className="text-xs text-muted-foreground">
                {t('rejection.detailRequired')}
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isLoading}
          >
            {t('rejection.cancel')}
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={isLoading || !isValid}
          >
            {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {t('rejection.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
