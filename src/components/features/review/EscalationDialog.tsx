'use client'

/**
 * @fileoverview 案例升級對話框組件（國際化版本）
 * @description
 *   提供案例升級的對話框介面：
 *   - 顯示升級原因選項（4 種）
 *   - 某些原因需要填寫詳情說明
 *   - 確認後觸發升級流程
 *   - 完整國際化支援
 *
 * @module src/components/features/review/EscalationDialog
 * @since Epic 3 - Story 3.7 (升級複雜案例)
 * @lastModified 2026-01-17
 * @refactor REFACTOR-001 (Forwarder → Company)
 *
 * @dependencies
 *   - next-intl - 國際化
 *   - @/components/ui/* - shadcn/ui 組件
 *   - @/types/escalation - 升級類型定義
 *   - lucide-react - 圖示
 */

import * as React from 'react'
import { useTranslations } from 'next-intl'
import {
  HelpCircle,
  FileX,
  AlertTriangle,
  MoreHorizontal,
  Loader2,
  AlertCircle,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import {
  ESCALATION_REASONS,
  type EscalateRequest,
  type EscalationReasonConfig,
} from '@/types/escalation'
import type { EscalationReason } from '@prisma/client'

// ============================================================
// Types
// ============================================================

interface EscalationDialogProps {
  /** 對話框開啟狀態 */
  open: boolean
  /** 開啟狀態變更回呼 */
  onOpenChange: (open: boolean) => void
  /** 確認升級回呼 */
  onConfirm: (data: EscalateRequest) => void
  /** 文件名稱（顯示用） */
  documentName: string
  /** 是否正在提交 */
  isSubmitting?: boolean
}

// ============================================================
// Constants
// ============================================================

/**
 * 升級原因對應的圖示
 */
const REASON_ICONS: Record<EscalationReason, React.ElementType> = {
  UNKNOWN_FORWARDER: HelpCircle, // 保留向後兼容
  UNKNOWN_COMPANY: HelpCircle, // REFACTOR-001: 新增公司識別
  RULE_NOT_APPLICABLE: FileX,
  POOR_QUALITY: AlertTriangle,
  OTHER: MoreHorizontal,
}

/**
 * 升級原因翻譯 key 映射
 */
const REASON_I18N_KEYS: Record<EscalationReason, string> = {
  UNKNOWN_FORWARDER: 'unknownCompany',
  UNKNOWN_COMPANY: 'unknownCompany',
  RULE_NOT_APPLICABLE: 'mappingNotApplicable',
  POOR_QUALITY: 'documentQuality',
  OTHER: 'other',
}

/**
 * placeholder 翻譯 key 映射
 */
const PLACEHOLDER_I18N_KEYS: Record<string, string> = {
  UNKNOWN_COMPANY: 'unidentified',
  UNKNOWN_FORWARDER: 'unidentified',
  RULE_NOT_APPLICABLE: 'mappingRules',
  POOR_QUALITY: 'documentQuality',
  OTHER: 'other',
}

// ============================================================
// Component
// ============================================================

/**
 * 案例升級對話框
 *
 * @description 用於將複雜案例升級給 Super User 處理的對話框。
 *   用戶需要選擇升級原因，某些原因需要填寫詳細說明。
 *
 * @example
 * ```tsx
 * <EscalationDialog
 *   open={showDialog}
 *   onOpenChange={setShowDialog}
 *   onConfirm={handleEscalate}
 *   documentName="invoice-001.pdf"
 *   isSubmitting={isPending}
 * />
 * ```
 */
export function EscalationDialog({
  open,
  onOpenChange,
  onConfirm,
  documentName,
  isSubmitting = false,
}: EscalationDialogProps) {
  const t = useTranslations('escalation')

  // --- State ---
  const [selectedReason, setSelectedReason] =
    React.useState<EscalationReason | null>(null)
  const [reasonDetail, setReasonDetail] = React.useState('')

  // --- Derived State ---
  const selectedReasonConfig = ESCALATION_REASONS.find(
    (r) => r.value === selectedReason
  )

  const canSubmit =
    selectedReason &&
    (!selectedReasonConfig?.requiresDetail || reasonDetail.trim().length > 0)

  // --- Handlers ---
  const handleConfirm = () => {
    if (!selectedReason) return

    onConfirm({
      reason: selectedReason,
      reasonDetail: reasonDetail.trim() || undefined,
    })
  }

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      // 關閉時重置狀態
      setSelectedReason(null)
      setReasonDetail('')
    }
    onOpenChange(newOpen)
  }

  const handleReasonChange = (value: string) => {
    setSelectedReason(value as EscalationReason)
    // 切換原因時清空詳情
    setReasonDetail('')
  }

  // 取得 placeholder 翻譯
  const getPlaceholderText = (reason: EscalationReason | null): string => {
    if (!reason) return t('dialog.placeholders.default')
    const key = PLACEHOLDER_I18N_KEYS[reason] || 'default'
    return t(`dialog.placeholders.${key}`)
  }

  // --- Render ---
  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-amber-600" />
            {t('dialog.title')}
          </DialogTitle>
          <DialogDescription>
            {t('dialog.description')}
          </DialogDescription>
        </DialogHeader>

        {/* 文件資訊 */}
        <div className="rounded-lg border bg-muted/50 p-3">
          <p className="text-sm">
            <span className="text-muted-foreground">{t('dialog.document')}</span>
            <span className="font-medium">{documentName}</span>
          </p>
        </div>

        {/* 原因選擇 */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">{t('dialog.selectReason')}</Label>
          <RadioGroup
            value={selectedReason || ''}
            onValueChange={handleReasonChange}
            className="space-y-3"
          >
            {ESCALATION_REASONS.map((reason: EscalationReasonConfig) => {
              const Icon = REASON_ICONS[reason.value]
              const isSelected = selectedReason === reason.value
              const i18nKey = REASON_I18N_KEYS[reason.value]

              return (
                <div
                  key={reason.value}
                  className={cn(
                    'flex items-start space-x-3 rounded-lg border p-4 transition-colors cursor-pointer',
                    isSelected
                      ? 'border-amber-500 bg-amber-50'
                      : 'hover:bg-muted/50'
                  )}
                  onClick={() => handleReasonChange(reason.value)}
                >
                  <RadioGroupItem
                    value={reason.value}
                    id={reason.value}
                    className="mt-0.5"
                  />
                  <div className="flex-1">
                    <Label
                      htmlFor={reason.value}
                      className="flex items-center gap-2 cursor-pointer"
                    >
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{t(`reasons.${i18nKey}`)}</span>
                      {reason.requiresDetail && (
                        <span className="text-xs text-muted-foreground">
                          {t('dialog.required')}
                        </span>
                      )}
                    </Label>
                    <p className="text-sm text-muted-foreground mt-1">
                      {t(`reasons.${i18nKey}Desc`)}
                    </p>
                  </div>
                </div>
              )
            })}
          </RadioGroup>
        </div>

        {/* 詳情輸入（當選擇的原因需要詳情時顯示） */}
        {selectedReasonConfig && (
          <div className="space-y-2 animate-in slide-in-from-top-2 duration-200">
            <Label htmlFor="detail" className="text-sm">
              {t('dialog.detailedDescription')}
              {selectedReasonConfig.requiresDetail && (
                <span className="text-destructive ml-1">*</span>
              )}
            </Label>
            <Textarea
              id="detail"
              value={reasonDetail}
              onChange={(e) => setReasonDetail(e.target.value)}
              placeholder={getPlaceholderText(selectedReason)}
              className="min-h-[80px] resize-none"
              maxLength={1000}
              disabled={isSubmitting}
            />
            <div className="flex justify-between items-center">
              {selectedReasonConfig.requiresDetail && !reasonDetail.trim() && (
                <p className="text-xs text-destructive">{t('dialog.provideDescription')}</p>
              )}
              <p className="text-xs text-muted-foreground ml-auto">
                {reasonDetail.length}/1000
              </p>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isSubmitting}
          >
            {t('dialog.cancel')}
          </Button>
          <Button
            variant="default"
            className="bg-amber-600 hover:bg-amber-700"
            onClick={handleConfirm}
            disabled={!canSubmit || isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {t('dialog.submitting')}
              </>
            ) : (
              t('dialog.confirmEscalation')
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

