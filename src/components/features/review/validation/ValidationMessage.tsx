/**
 * @fileoverview 驗證訊息顯示組件
 * @description
 *   顯示欄位驗證的結果訊息，包含錯誤和成功狀態。
 *   使用圖示和顏色提供視覺反饋。
 *
 * @module src/components/features/review/validation/ValidationMessage
 * @since Epic 3 - Story 3.5 (修正提取結果)
 * @lastModified 2025-12-18
 */

'use client'

import { cn } from '@/lib/utils'
import { AlertCircle, CheckCircle2 } from 'lucide-react'

// ============================================================
// Types
// ============================================================

interface ValidationMessageProps {
  /** 錯誤訊息 */
  error?: string | null
  /** 是否顯示成功狀態 */
  success?: boolean
  /** 額外的 CSS 類別 */
  className?: string
}

// ============================================================
// Component
// ============================================================

/**
 * 驗證訊息組件
 *
 * @description 顯示欄位驗證結果，支援錯誤和成功兩種狀態
 *
 * @example
 * ```tsx
 * // 錯誤訊息
 * <ValidationMessage error="日期格式必須為 YYYY-MM-DD" />
 *
 * // 成功訊息
 * <ValidationMessage success />
 *
 * // 無訊息（不渲染）
 * <ValidationMessage />
 * ```
 */
export function ValidationMessage({ error, success, className }: ValidationMessageProps) {
  if (!error && !success) return null

  return (
    <div
      className={cn(
        'flex items-center gap-1 text-xs mt-1',
        error && 'text-destructive',
        success && 'text-green-600',
        className
      )}
    >
      {error ? (
        <>
          <AlertCircle className="h-3 w-3 flex-shrink-0" />
          <span>{error}</span>
        </>
      ) : success ? (
        <>
          <CheckCircle2 className="h-3 w-3 flex-shrink-0" />
          <span>格式正確</span>
        </>
      ) : null}
    </div>
  )
}
