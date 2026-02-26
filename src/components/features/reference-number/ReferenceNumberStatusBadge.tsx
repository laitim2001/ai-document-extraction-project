'use client'

/**
 * @fileoverview Reference Number 狀態標籤組件
 * @description
 *   顯示 Reference Number 狀態的 Badge 組件。
 *   使用顏色編碼區分不同狀態。
 *
 * @module src/components/features/reference-number/ReferenceNumberStatusBadge
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

interface ReferenceNumberStatusBadgeProps {
  /** Reference Number 狀態 */
  status: string
  /** 額外的 CSS 類名 */
  className?: string
}

// ============================================================
// Constants
// ============================================================

const STATUS_STYLES: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  EXPIRED: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
  CANCELLED: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
}

// ============================================================
// Component
// ============================================================

/**
 * Reference Number 狀態標籤
 *
 * @param props - 組件屬性
 * @returns React 元素
 */
export function ReferenceNumberStatusBadge({
  status,
  className,
}: ReferenceNumberStatusBadgeProps) {
  const t = useTranslations('referenceNumber')

  const style = STATUS_STYLES[status] ?? STATUS_STYLES.EXPIRED

  return (
    <Badge variant="outline" className={cn(style, 'font-normal', className)}>
      {t(`statuses.${status}` as Parameters<typeof t>[0])}
    </Badge>
  )
}
