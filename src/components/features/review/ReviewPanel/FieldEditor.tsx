/**
 * @fileoverview 欄位編輯器組件
 * @description
 *   提供欄位內聯編輯功能，支援：
 *   - 點擊切換編輯/顯示模式
 *   - 即時欄位驗證（Zod）
 *   - 快捷鍵支援（Enter 儲存、Escape 取消）
 *   - 視覺反饋（驗證錯誤、修改狀態）
 *
 * @module src/components/features/review/ReviewPanel/FieldEditor
 * @since Epic 3 - Story 3.5 (修正提取結果)
 * @lastModified 2025-12-18
 *
 * @dependencies
 *   - @/components/ui/input - shadcn Input 組件
 *   - ../validation/fieldSchemas - 欄位驗證規則
 *   - ../validation/ValidationMessage - 驗證訊息顯示
 */

'use client'

import * as React from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { validateFieldValue } from '../validation'
import { ValidationMessage } from '../validation/ValidationMessage'
import { Check, X, Pencil } from 'lucide-react'

// ============================================================
// Types
// ============================================================

interface FieldEditorProps {
  /** 欄位 ID */
  fieldId: string
  /** 欄位名稱（用於驗證規則判斷） */
  fieldName: string
  /** 當前值 */
  value: string | null
  /** 儲存回調 */
  onSave: (newValue: string) => void
  /** 取消回調 */
  onCancel: () => void
  /** 是否處於編輯模式 */
  isEditing: boolean
  /** 開始編輯回調 */
  onStartEdit: () => void
  /** 是否禁用 */
  disabled?: boolean
  /** 額外的 CSS 類別 */
  className?: string
}

// ============================================================
// Component
// ============================================================

/**
 * 欄位編輯器組件
 *
 * @description
 *   提供欄位的內聯編輯功能。
 *   - 非編輯狀態：顯示值 + 編輯按鈕
 *   - 編輯狀態：輸入框 + 確認/取消按鈕 + 即時驗證
 *
 * @example
 * ```tsx
 * <FieldEditor
 *   fieldId="field-1"
 *   fieldName="invoiceDate"
 *   value="2024-01-15"
 *   isEditing={editingFieldId === 'field-1'}
 *   onStartEdit={() => setEditingFieldId('field-1')}
 *   onSave={(val) => handleSave('field-1', val)}
 *   onCancel={() => setEditingFieldId(null)}
 * />
 * ```
 */
export function FieldEditor({
  fieldId,
  fieldName,
  value,
  onSave,
  onCancel,
  isEditing,
  onStartEdit,
  disabled = false,
  className,
}: FieldEditorProps) {
  // --- State ---
  const [editValue, setEditValue] = React.useState(value ?? '')
  const [validationError, setValidationError] = React.useState<string | null>(null)
  const [isValidated, setIsValidated] = React.useState(false)
  const inputRef = React.useRef<HTMLInputElement>(null)

  // --- Effects ---

  // 進入編輯模式時聚焦輸入框
  React.useEffect(() => {
    if (isEditing) {
      setEditValue(value ?? '')
      setValidationError(null)
      setIsValidated(false)
      // 延遲聚焦以確保 DOM 已渲染
      const timer = setTimeout(() => {
        inputRef.current?.focus()
        inputRef.current?.select()
      }, 50)
      return () => clearTimeout(timer)
    }
  }, [isEditing, value])

  // --- Handlers ---

  /**
   * 驗證輸入值
   */
  const validateInput = React.useCallback(
    (val: string): boolean => {
      const result = validateFieldValue(fieldName, val)
      if (!result.valid) {
        setValidationError(result.error ?? '驗證失敗')
        setIsValidated(false)
        return false
      }
      setValidationError(null)
      setIsValidated(true)
      return true
    },
    [fieldName]
  )

  /**
   * 處理輸入變化
   */
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    setEditValue(newValue)
    // 即時驗證
    validateInput(newValue)
  }

  /**
   * 處理儲存
   */
  const handleSave = () => {
    // 儲存前再次驗證
    if (!validateInput(editValue)) {
      return
    }

    // 如果值沒有變化，直接取消
    if (editValue === (value ?? '')) {
      onCancel()
      return
    }

    onSave(editValue)
  }

  /**
   * 處理取消
   */
  const handleCancel = () => {
    setEditValue(value ?? '')
    setValidationError(null)
    setIsValidated(false)
    onCancel()
  }

  /**
   * 處理鍵盤事件
   */
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSave()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      handleCancel()
    }
  }

  // --- Render ---

  // 編輯模式
  if (isEditing) {
    return (
      <div className={cn('flex flex-col gap-1', className)}>
        <div className="flex items-center gap-1">
          <Input
            ref={inputRef}
            value={editValue}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            className={cn(
              'h-7 text-sm flex-1',
              validationError && 'border-destructive focus-visible:ring-destructive'
            )}
            aria-invalid={!!validationError}
            aria-describedby={validationError ? `${fieldId}-error` : undefined}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-green-600 hover:text-green-700 hover:bg-green-50"
            onClick={handleSave}
            disabled={!!validationError}
            title="儲存 (Enter)"
          >
            <Check className="h-4 w-4" />
            <span className="sr-only">儲存</span>
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            onClick={handleCancel}
            title="取消 (Escape)"
          >
            <X className="h-4 w-4" />
            <span className="sr-only">取消</span>
          </Button>
        </div>
        <ValidationMessage
          error={validationError}
          success={isValidated && !validationError && editValue !== ''}
        />
      </div>
    )
  }

  // 顯示模式
  return (
    <div
      className={cn(
        'group flex items-center justify-between gap-2 min-h-[28px]',
        !disabled && 'cursor-pointer',
        className
      )}
      onClick={disabled ? undefined : onStartEdit}
      onKeyDown={(e) => {
        if (!disabled && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault()
          onStartEdit()
        }
      }}
      role={disabled ? undefined : 'button'}
      tabIndex={disabled ? undefined : 0}
    >
      <span
        className={cn(
          'text-sm truncate',
          !value && 'text-muted-foreground italic'
        )}
      >
        {value || '（空）'}
      </span>
      {!disabled && (
        <Pencil
          className={cn(
            'h-3.5 w-3.5 text-muted-foreground shrink-0',
            'opacity-0 group-hover:opacity-100 transition-opacity'
          )}
        />
      )}
    </div>
  )
}
