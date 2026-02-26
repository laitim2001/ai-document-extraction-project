'use client'

/**
 * @fileoverview 處理狀態徽章組件（國際化版本）
 * @description
 *   顯示文件處理狀態的徽章，包含：
 *   - 狀態圖標
 *   - 狀態標籤（根據 locale 自動切換語言）
 *   - 處理中動畫
 *   - 完整國際化支援
 *
 * @module src/components/features/document/ProcessingStatus
 * @author Development Team
 * @since Epic 2 - Story 2.7 (Processing Status Tracking & Display)
 * @lastModified 2026-01-17
 *
 * @features
 *   - 11 種狀態視覺化
 *   - 處理中旋轉動畫
 *   - 可配置尺寸
 *   - i18n 國際化支援
 *
 * @dependencies
 *   - next-intl - 國際化
 *   - lucide-react - 圖標
 *   - @/lib/document-status - 狀態配置
 *   - @/lib/utils - cn utility
 *
 * @related
 *   - src/lib/document-status.ts - 狀態配置
 *   - src/components/features/document/DocumentListTable.tsx - 表格組件
 *   - messages/{locale}/documents.json - 翻譯檔案
 */

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import { Loader2 } from 'lucide-react'
import { getStatusConfig, type DocumentStatusKey } from '@/lib/document-status'

// ============================================================
// Types
// ============================================================

export interface ProcessingStatusProps {
  /** 狀態鍵值 */
  status: DocumentStatusKey | string
  /** 是否顯示標籤 */
  showLabel?: boolean
  /** 尺寸 */
  size?: 'sm' | 'md' | 'lg'
  /** 自定義 className */
  className?: string
}

// ============================================================
// Constants
// ============================================================

const sizeClasses = {
  sm: 'text-xs gap-1',
  md: 'text-sm gap-1.5',
  lg: 'text-base gap-2',
} as const

const iconSizes = {
  sm: 'h-3 w-3',
  md: 'h-4 w-4',
  lg: 'h-5 w-5',
} as const

// ============================================================
// Component
// ============================================================

/**
 * 處理狀態徽章組件
 *
 * @description
 *   顯示文件處理狀態的徽章，處理中狀態會顯示旋轉動畫
 *
 * @example
 * ```tsx
 * <ProcessingStatus status="OCR_PROCESSING" />
 * // 顯示: 🔄 OCR 處理中（帶旋轉動畫）
 *
 * <ProcessingStatus status="COMPLETED" showLabel={false} />
 * // 只顯示圖標
 * ```
 */
export function ProcessingStatus({
  status,
  showLabel = true,
  size = 'md',
  className,
}: ProcessingStatusProps) {
  const t = useTranslations('documents')
  const config = getStatusConfig(status)
  const Icon = config.icon

  // 使用翻譯獲取狀態標籤，fallback 到 config.label
  const statusLabel = t.has(`status.${status}`) ? t(`status.${status}`) : config.label

  return (
    <div
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 font-medium',
        config.bgColor,
        config.textColor,
        sizeClasses[size],
        className
      )}
    >
      {config.isProcessing ? (
        <Loader2 className={cn(iconSizes[size], 'animate-spin')} />
      ) : (
        <Icon className={iconSizes[size]} />
      )}
      {showLabel && <span>{statusLabel}</span>}
    </div>
  )
}
