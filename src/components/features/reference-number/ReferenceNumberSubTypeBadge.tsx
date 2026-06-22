'use client'

/**
 * @fileoverview Reference Number 文件子類型標籤組件
 * @description
 *   顯示 Reference Number 文件子類型（文件方向）的 Badge 組件。
 *   使用 i18n 翻譯顯示子類型名稱。子類型與 type 為正交獨立維度。
 *
 * @module src/components/features/reference-number/ReferenceNumberSubTypeBadge
 * @since CHANGE-086 (Reference Number documentSubType dimension)
 * @lastModified 2026-06-21
 *
 * @dependencies
 *   - next-intl - 國際化
 *   - @/components/ui/badge - Badge 基礎組件
 */

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

// ============================================================
// Types
// ============================================================

interface ReferenceNumberSubTypeBadgeProps {
  /** Reference Number 文件子類型 */
  subType: string
  /** 額外的 CSS 類名 */
  className?: string
}

// ============================================================
// Constants
// ============================================================

const SUB_TYPE_STYLES: Record<string, string> = {
  IMPORT: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  EXPORT: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  BOTH: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  UNKNOWN: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
}

// ============================================================
// Component
// ============================================================

/**
 * Reference Number 文件子類型標籤
 *
 * @param props - 組件屬性
 * @returns React 元素
 */
export function ReferenceNumberSubTypeBadge({
  subType,
  className,
}: ReferenceNumberSubTypeBadgeProps) {
  const t = useTranslations('referenceNumber')

  const style = SUB_TYPE_STYLES[subType] ?? SUB_TYPE_STYLES.UNKNOWN

  return (
    <Badge variant="outline" className={cn(style, 'font-normal', className)}>
      {t(`subTypes.${subType}` as Parameters<typeof t>[0])}
    </Badge>
  )
}
