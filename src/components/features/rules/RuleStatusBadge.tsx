'use client'

/**
 * @fileoverview 規則狀態 Badge 組件（國際化版本）
 * @description
 *   顯示映射規則狀態的標籤組件：
 *   - ACTIVE: 生效中（綠色）
 *   - DRAFT: 草稿（灰色）
 *   - PENDING_REVIEW: 待審核（琥珀色）
 *   - DEPRECATED: 已棄用（紅色）
 *   - 完整國際化支援
 *
 * @module src/components/features/rules/RuleStatusBadge
 * @since Epic 4 - Story 4.1 (映射規則列表與查看)
 * @lastModified 2026-01-17
 *
 * @dependencies
 *   - next-intl - 國際化
 *   - @/components/ui/badge - shadcn Badge 組件
 *   - @/types/rule - 狀態配置
 */

import { useTranslations } from 'next-intl'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { RuleStatus } from '@prisma/client'

// ============================================================
// Types
// ============================================================

interface RuleStatusBadgeProps {
  /** 規則狀態 */
  status: RuleStatus
  /** 額外的 className */
  className?: string
}

// ============================================================
// Status Configuration
// ============================================================

const STATUS_CONFIG: Record<
  RuleStatus,
  { i18nKey: string; color: string; bgColor: string }
> = {
  ACTIVE: {
    i18nKey: 'active',
    color: 'text-green-700 dark:text-green-400',
    bgColor: 'bg-green-100 dark:bg-green-900/30',
  },
  DRAFT: {
    i18nKey: 'draft',
    color: 'text-slate-600 dark:text-slate-400',
    bgColor: 'bg-slate-100 dark:bg-slate-800',
  },
  PENDING_REVIEW: {
    i18nKey: 'pendingReview',
    color: 'text-amber-700 dark:text-amber-400',
    bgColor: 'bg-amber-100 dark:bg-amber-900/30',
  },
  DEPRECATED: {
    i18nKey: 'deprecated',
    color: 'text-red-700 dark:text-red-400',
    bgColor: 'bg-red-100 dark:bg-red-900/30',
  },
}

// ============================================================
// Component
// ============================================================

/**
 * 規則狀態 Badge
 *
 * @example
 * ```tsx
 * <RuleStatusBadge status="ACTIVE" />
 * <RuleStatusBadge status="PENDING_REVIEW" className="ml-2" />
 * ```
 */
export function RuleStatusBadge({ status, className }: RuleStatusBadgeProps) {
  const t = useTranslations('rules')
  const config = STATUS_CONFIG[status]

  return (
    <Badge
      variant="outline"
      className={cn(config.color, config.bgColor, 'border-0', className)}
    >
      {t(`ruleStatus.${config.i18nKey}`)}
    </Badge>
  )
}
