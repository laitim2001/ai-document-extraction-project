'use client'

/**
 * @fileoverview 修正類型選擇器組件
 * @description
 *   提供 NORMAL（正常修正）和 EXCEPTION（特例修正）的選擇介面：
 *   - 使用 Radio Group 進行單選
 *   - 當選擇 EXCEPTION 時顯示原因輸入欄
 *   - 提供清晰的視覺提示區分兩種類型
 *
 * @module src/components/features/review/CorrectionTypeSelector
 * @since Epic 3 - Story 3.6 (修正類型標記)
 * @lastModified 2025-12-18
 *
 * @dependencies
 *   - @/components/ui/radio-group - 單選按鈕組
 *   - @/components/ui/label - 標籤
 *   - @/components/ui/textarea - 文字輸入
 */

import * as React from 'react'
import { CheckCircle2, AlertTriangle } from 'lucide-react'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

// ============================================================
// Types
// ============================================================

export type CorrectionType = 'NORMAL' | 'EXCEPTION'

interface CorrectionTypeSelectorProps {
  /** 當前選擇的類型 */
  value: CorrectionType
  /** 類型變更回呼 */
  onChange: (type: CorrectionType) => void
  /** 特例原因（僅當類型為 EXCEPTION 時使用） */
  exceptionReason?: string
  /** 特例原因變更回呼 */
  onExceptionReasonChange?: (reason: string) => void
  /** 是否禁用 */
  disabled?: boolean
  /** 額外的 className */
  className?: string
}

// ============================================================
// Component
// ============================================================

/**
 * 修正類型選擇器
 *
 * @description 用於選擇修正類型的 Radio Group 組件。
 *   - NORMAL: 正常修正，會被記錄用於學習
 *   - EXCEPTION: 特例修正，不會影響學習統計
 *
 * @example
 * ```tsx
 * <CorrectionTypeSelector
 *   value={correctionType}
 *   onChange={setCorrectionType}
 *   exceptionReason={reason}
 *   onExceptionReasonChange={setReason}
 * />
 * ```
 */
export function CorrectionTypeSelector({
  value,
  onChange,
  exceptionReason = '',
  onExceptionReasonChange,
  disabled = false,
  className,
}: CorrectionTypeSelectorProps) {
  return (
    <div className={cn('space-y-4', className)}>
      <RadioGroup
        value={value}
        onValueChange={(val: string) => onChange(val as CorrectionType)}
        disabled={disabled}
        className="space-y-3"
      >
        {/* NORMAL 選項 */}
        <div
          className={cn(
            'flex items-start space-x-3 rounded-lg border p-4 transition-colors',
            value === 'NORMAL'
              ? 'border-blue-500 bg-blue-50'
              : 'border-border hover:border-blue-300'
          )}
        >
          <RadioGroupItem value="NORMAL" id="type-normal" className="mt-0.5" />
          <div className="flex-1">
            <Label
              htmlFor="type-normal"
              className="flex items-center gap-2 font-medium cursor-pointer"
            >
              <CheckCircle2 className="h-4 w-4 text-blue-600" />
              正常修正
            </Label>
            <p className="text-sm text-muted-foreground mt-1">
              此修正將被記錄用於系統學習，幫助改善未來的自動識別準確度。
              當相同欄位累積足夠修正次數時，系統會自動建議新的映射規則。
            </p>
          </div>
        </div>

        {/* EXCEPTION 選項 */}
        <div
          className={cn(
            'flex items-start space-x-3 rounded-lg border p-4 transition-colors',
            value === 'EXCEPTION'
              ? 'border-amber-500 bg-amber-50'
              : 'border-border hover:border-amber-300'
          )}
        >
          <RadioGroupItem
            value="EXCEPTION"
            id="type-exception"
            className="mt-0.5"
          />
          <div className="flex-1">
            <Label
              htmlFor="type-exception"
              className="flex items-center gap-2 font-medium cursor-pointer"
            >
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              特例修正
            </Label>
            <p className="text-sm text-muted-foreground mt-1">
              此修正為特殊案例，不會影響系統學習統計。
              適用於一次性錯誤、特殊格式、或不應作為規則參考的情況。
            </p>
          </div>
        </div>
      </RadioGroup>

      {/* 特例原因輸入（僅當選擇 EXCEPTION 時顯示） */}
      {value === 'EXCEPTION' && (
        <div className="pl-7 space-y-2 animate-in slide-in-from-top-2 duration-200">
          <Label htmlFor="exception-reason" className="text-sm">
            特例原因（選填）
          </Label>
          <Textarea
            id="exception-reason"
            placeholder="說明為何此修正為特例情況..."
            value={exceptionReason}
            onChange={(e) => onExceptionReasonChange?.(e.target.value)}
            disabled={disabled}
            className="min-h-[80px] resize-none"
            maxLength={500}
          />
          <p className="text-xs text-muted-foreground text-right">
            {exceptionReason.length}/500
          </p>
        </div>
      )}
    </div>
  )
}
