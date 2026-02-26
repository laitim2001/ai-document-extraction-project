/**
 * @fileoverview 處理路徑 Badge 組件（國際化版本）
 * @description
 *   顯示處理路徑類型的 Badge 組件：
 *   - AUTO_APPROVE: 自動通過
 *   - QUICK_REVIEW: 快速審核（閃電圖標）
 *   - FULL_REVIEW: 完整審核（搜尋圖標）
 *   - MANUAL_REQUIRED: 需人工處理
 *   - 完整國際化支援
 *
 * @module src/components/features/review/ProcessingPathBadge
 * @since Epic 3 - Story 3.1
 * @lastModified 2026-01-17
 *
 * @dependencies
 *   - next-intl - 國際化
 *   - @/components/ui/badge - shadcn Badge 組件
 *   - lucide-react - 圖標
 *   - @prisma/client - ProcessingPath 枚舉
 */

'use client'

import { useTranslations } from 'next-intl'
import { ProcessingPath } from '@prisma/client'
import { Badge } from '@/components/ui/badge'
import { Zap, Search, CheckCircle, AlertTriangle } from 'lucide-react'

// ============================================================
// Types
// ============================================================

interface ProcessingPathBadgeProps {
  /** 處理路徑 */
  path: ProcessingPath
}

// ============================================================
// Config
// ============================================================

const PATH_CONFIG = {
  [ProcessingPath.AUTO_APPROVE]: {
    i18nKey: 'autoApprove',
    icon: CheckCircle,
    variant: 'secondary' as const,
  },
  [ProcessingPath.QUICK_REVIEW]: {
    i18nKey: 'quickReview',
    icon: Zap,
    variant: 'default' as const,
  },
  [ProcessingPath.FULL_REVIEW]: {
    i18nKey: 'fullReview',
    icon: Search,
    variant: 'outline' as const,
  },
  [ProcessingPath.MANUAL_REQUIRED]: {
    i18nKey: 'manualRequired',
    icon: AlertTriangle,
    variant: 'destructive' as const,
  },
} as const

// ============================================================
// Component
// ============================================================

/**
 * 處理路徑 Badge 組件
 * 根據處理路徑類型顯示對應的標籤和圖標
 *
 * @example
 * ```tsx
 * <ProcessingPathBadge path={ProcessingPath.QUICK_REVIEW} />
 * <ProcessingPathBadge path={ProcessingPath.FULL_REVIEW} />
 * ```
 */
export function ProcessingPathBadge({ path }: ProcessingPathBadgeProps) {
  const t = useTranslations('review')
  const config = PATH_CONFIG[path]
  const Icon = config.icon

  return (
    <Badge variant={config.variant}>
      <Icon className="h-3 w-3 mr-1" />
      {t(`processingPath.${config.i18nKey}`)}
    </Badge>
  )
}
