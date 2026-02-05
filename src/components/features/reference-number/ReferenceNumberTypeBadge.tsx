'use client'

/**
 * @fileoverview Reference Number 類型標籤組件
 * @description
 *   顯示 Reference Number 類型的 Badge 組件。
 *   使用 i18n 翻譯顯示類型名稱。
 *
 * @module src/components/features/reference-number/ReferenceNumberTypeBadge
 * @since Epic 20 - Story 20.5 (Management Page - List & Filter)
 * @lastModified 2026-02-05
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

interface ReferenceNumberTypeBadgeProps {
  /** Reference Number 類型 */
  type: string
  /** 額外的 CSS 類名 */
  className?: string
}

// ============================================================
// Constants
// ============================================================

const TYPE_STYLES: Record<string, string> = {
  SHIPMENT: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  DELIVERY: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  BOOKING: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200',
  CONTAINER: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  HAWB: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200',
  MAWB: 'bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-200',
  BL: 'bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200',
  CUSTOMS: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  OTHER: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
}

// ============================================================
// Component
// ============================================================

/**
 * Reference Number 類型標籤
 *
 * @param props - 組件屬性
 * @returns React 元素
 */
export function ReferenceNumberTypeBadge({
  type,
  className,
}: ReferenceNumberTypeBadgeProps) {
  const t = useTranslations('referenceNumber')

  const style = TYPE_STYLES[type] ?? TYPE_STYLES.OTHER

  return (
    <Badge variant="outline" className={cn(style, 'font-normal', className)}>
      {t(`types.${type}` as Parameters<typeof t>[0])}
    </Badge>
  )
}
