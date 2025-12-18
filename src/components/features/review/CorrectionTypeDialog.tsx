'use client'

/**
 * @fileoverview 修正類型選擇對話框
 * @description
 *   在儲存修正前顯示的對話框，用於：
 *   - 顯示待儲存的修正項目列表
 *   - 為每個修正選擇類型（NORMAL/EXCEPTION）
 *   - 支援批量設定（全部正常/全部特例）
 *   - 確認後觸發實際儲存
 *
 * @module src/components/features/review/CorrectionTypeDialog
 * @since Epic 3 - Story 3.6 (修正類型標記)
 * @lastModified 2025-12-18
 *
 * @dependencies
 *   - @/components/ui/dialog - 對話框組件
 *   - @/components/ui/button - 按鈕
 *   - @/components/features/review/CorrectionTypeSelector - 類型選擇器
 */

import * as React from 'react'
import { Save, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  CorrectionTypeSelector,
  type CorrectionType,
} from './CorrectionTypeSelector'
import { cn } from '@/lib/utils'

// ============================================================
// Types
// ============================================================

/**
 * 單個修正項目的資料結構
 */
export interface CorrectionItem {
  /** 欄位名稱 */
  fieldName: string
  /** 欄位顯示標籤 */
  fieldLabel: string
  /** 原始值 */
  originalValue: string | null
  /** 修正後的值 */
  correctedValue: string
}

/**
 * 修正類型設定
 */
export interface CorrectionTypeSetting {
  /** 修正類型 */
  correctionType: CorrectionType
  /** 特例原因（僅當類型為 EXCEPTION 時） */
  exceptionReason?: string
}

/**
 * 帶類型設定的修正項目
 */
export interface CorrectionWithType extends CorrectionItem, CorrectionTypeSetting {}

interface CorrectionTypeDialogProps {
  /** 對話框開啟狀態 */
  open: boolean
  /** 關閉對話框回呼 */
  onOpenChange: (open: boolean) => void
  /** 待儲存的修正項目列表 */
  corrections: CorrectionItem[]
  /** 確認儲存回呼（傳入帶類型設定的修正列表） */
  onConfirm: (corrections: CorrectionWithType[]) => void
  /** 是否正在提交 */
  isSubmitting?: boolean
}

// ============================================================
// Component
// ============================================================

/**
 * 修正類型選擇對話框
 *
 * @description 在儲存修正前顯示，讓使用者為每個修正選擇類型。
 *   支援單獨設定或批量設定修正類型。
 *
 * @example
 * ```tsx
 * <CorrectionTypeDialog
 *   open={showDialog}
 *   onOpenChange={setShowDialog}
 *   corrections={pendingCorrections}
 *   onConfirm={handleSaveWithTypes}
 *   isSubmitting={isSaving}
 * />
 * ```
 */
export function CorrectionTypeDialog({
  open,
  onOpenChange,
  corrections,
  onConfirm,
  isSubmitting = false,
}: CorrectionTypeDialogProps) {
  // --- State ---
  // 為每個修正項目儲存類型設定
  const [typeSettings, setTypeSettings] = React.useState<
    Map<string, CorrectionTypeSetting>
  >(new Map())

  // 目前展開的項目（用於詳細設定）
  const [expandedField, setExpandedField] = React.useState<string | null>(null)

  // --- Effects ---
  // 當對話框開啟或修正項目變更時，初始化類型設定
  React.useEffect(() => {
    if (open) {
      const initialSettings = new Map<string, CorrectionTypeSetting>()
      corrections.forEach((c) => {
        initialSettings.set(c.fieldName, {
          correctionType: 'NORMAL',
          exceptionReason: '',
        })
      })
      setTypeSettings(initialSettings)
      setExpandedField(corrections.length === 1 ? corrections[0].fieldName : null)
    }
  }, [open, corrections])

  // --- Handlers ---
  const handleTypeChange = (fieldName: string, type: CorrectionType) => {
    setTypeSettings((prev) => {
      const newMap = new Map(prev)
      const current = newMap.get(fieldName) || {
        correctionType: 'NORMAL',
        exceptionReason: '',
      }
      newMap.set(fieldName, {
        ...current,
        correctionType: type,
        // 清除原因當切換到 NORMAL
        exceptionReason: type === 'NORMAL' ? '' : current.exceptionReason,
      })
      return newMap
    })
  }

  const handleReasonChange = (fieldName: string, reason: string) => {
    setTypeSettings((prev) => {
      const newMap = new Map(prev)
      const current = newMap.get(fieldName) || {
        correctionType: 'EXCEPTION',
        exceptionReason: '',
      }
      newMap.set(fieldName, {
        ...current,
        exceptionReason: reason,
      })
      return newMap
    })
  }

  const handleSetAllType = (type: CorrectionType) => {
    setTypeSettings((prev) => {
      const newMap = new Map(prev)
      corrections.forEach((c) => {
        const current = newMap.get(c.fieldName)
        newMap.set(c.fieldName, {
          correctionType: type,
          exceptionReason: type === 'NORMAL' ? '' : current?.exceptionReason || '',
        })
      })
      return newMap
    })
  }

  const handleConfirm = () => {
    const correctionsWithType: CorrectionWithType[] = corrections.map((c) => {
      const setting = typeSettings.get(c.fieldName) || {
        correctionType: 'NORMAL' as CorrectionType,
        exceptionReason: '',
      }
      return {
        ...c,
        ...setting,
      }
    })
    onConfirm(correctionsWithType)
  }

  const handleOpenChange = (newOpen: boolean) => {
    if (!isSubmitting) {
      onOpenChange(newOpen)
    }
  }

  // --- Computed ---
  const normalCount = Array.from(typeSettings.values()).filter(
    (s) => s.correctionType === 'NORMAL'
  ).length
  const exceptionCount = corrections.length - normalCount

  // --- Render ---
  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Save className="h-5 w-5 text-primary" />
            儲存修正 - 選擇修正類型
          </DialogTitle>
          <DialogDescription>
            請為以下 {corrections.length} 個修正選擇類型。正常修正會用於系統學習，特例修正則不會影響學習統計。
          </DialogDescription>
        </DialogHeader>

        {/* 批量操作按鈕 */}
        {corrections.length > 1 && (
          <div className="flex items-center gap-2 py-2">
            <span className="text-sm text-muted-foreground">批量設定：</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleSetAllType('NORMAL')}
              disabled={isSubmitting}
              className="gap-1"
            >
              <CheckCircle2 className="h-3.5 w-3.5 text-blue-600" />
              全部正常
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleSetAllType('EXCEPTION')}
              disabled={isSubmitting}
              className="gap-1"
            >
              <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
              全部特例
            </Button>
            <div className="flex-1" />
            <div className="flex items-center gap-2 text-sm">
              <Badge variant="secondary" className="gap-1">
                <CheckCircle2 className="h-3 w-3 text-blue-600" />
                正常: {normalCount}
              </Badge>
              <Badge variant="secondary" className="gap-1">
                <AlertTriangle className="h-3 w-3 text-amber-600" />
                特例: {exceptionCount}
              </Badge>
            </div>
          </div>
        )}

        <Separator />

        {/* 修正項目列表 */}
        <ScrollArea className="max-h-[400px] pr-4">
          <div className="space-y-4">
            {corrections.map((correction, index) => {
              const setting = typeSettings.get(correction.fieldName)
              const isExpanded = expandedField === correction.fieldName

              return (
                <div
                  key={correction.fieldName}
                  className={cn(
                    'rounded-lg border p-4 transition-colors',
                    setting?.correctionType === 'EXCEPTION'
                      ? 'border-amber-200 bg-amber-50/50'
                      : 'border-border'
                  )}
                >
                  {/* 項目標題列 */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-muted-foreground">
                        #{index + 1}
                      </span>
                      <span className="font-medium">{correction.fieldLabel}</span>
                      <Badge
                        variant={
                          setting?.correctionType === 'EXCEPTION'
                            ? 'outline'
                            : 'default'
                        }
                        className={cn(
                          'text-xs',
                          setting?.correctionType === 'EXCEPTION'
                            ? 'border-amber-500 text-amber-700'
                            : 'bg-blue-100 text-blue-700 hover:bg-blue-100'
                        )}
                      >
                        {setting?.correctionType === 'EXCEPTION' ? '特例' : '正常'}
                      </Badge>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setExpandedField(isExpanded ? null : correction.fieldName)
                      }
                      disabled={isSubmitting}
                    >
                      {isExpanded ? '收合' : '詳細設定'}
                    </Button>
                  </div>

                  {/* 值變更顯示 */}
                  <div className="flex items-center gap-2 text-sm mb-3">
                    <span className="text-muted-foreground line-through">
                      {correction.originalValue || '(空)'}
                    </span>
                    <span className="text-muted-foreground">→</span>
                    <span className="font-medium text-primary">
                      {correction.correctedValue}
                    </span>
                  </div>

                  {/* 快速類型切換（收合狀態） */}
                  {!isExpanded && (
                    <div className="flex gap-2">
                      <Button
                        variant={
                          setting?.correctionType === 'NORMAL'
                            ? 'default'
                            : 'outline'
                        }
                        size="sm"
                        onClick={() =>
                          handleTypeChange(correction.fieldName, 'NORMAL')
                        }
                        disabled={isSubmitting}
                        className={cn(
                          'gap-1',
                          setting?.correctionType === 'NORMAL' &&
                            'bg-blue-600 hover:bg-blue-700'
                        )}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        正常
                      </Button>
                      <Button
                        variant={
                          setting?.correctionType === 'EXCEPTION'
                            ? 'default'
                            : 'outline'
                        }
                        size="sm"
                        onClick={() =>
                          handleTypeChange(correction.fieldName, 'EXCEPTION')
                        }
                        disabled={isSubmitting}
                        className={cn(
                          'gap-1',
                          setting?.correctionType === 'EXCEPTION' &&
                            'bg-amber-600 hover:bg-amber-700'
                        )}
                      >
                        <AlertTriangle className="h-3.5 w-3.5" />
                        特例
                      </Button>
                    </div>
                  )}

                  {/* 展開的詳細設定 */}
                  {isExpanded && (
                    <div className="mt-4 animate-in slide-in-from-top-2 duration-200">
                      <CorrectionTypeSelector
                        value={setting?.correctionType || 'NORMAL'}
                        onChange={(type) =>
                          handleTypeChange(correction.fieldName, type)
                        }
                        exceptionReason={setting?.exceptionReason || ''}
                        onExceptionReasonChange={(reason) =>
                          handleReasonChange(correction.fieldName, reason)
                        }
                        disabled={isSubmitting}
                      />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </ScrollArea>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isSubmitting}
          >
            取消
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isSubmitting}
            className="gap-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                儲存中...
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                確認儲存 ({corrections.length} 項)
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
