'use client'

/**
 * @fileoverview 升級原因 Badge 組件（國際化版本）
 * @description
 *   顯示升級案例原因的標籤組件：
 *   - UNKNOWN_COMPANY: 無法識別 Company (REFACTOR-001: 原 UNKNOWN_FORWARDER)
 *   - RULE_NOT_APPLICABLE: 映射規則不適用
 *   - POOR_QUALITY: 文件品質問題
 *   - OTHER: 其他
 *   - 完整國際化支援
 *
 * @module src/components/features/escalation/EscalationReasonBadge
 * @since Epic 3 - Story 3.8 (Super User 處理升級案例)
 * @lastModified 2026-01-17
 * @refactor REFACTOR-001 (Forwarder → Company)
 *
 * @dependencies
 *   - next-intl - 國際化
 *   - @/components/ui/badge - shadcn Badge 組件
 *   - @/types/escalation - 原因配置
 *   - lucide-react - 圖示
 */

import { useTranslations } from 'next-intl'
import { Badge } from '@/components/ui/badge'
import { ESCALATION_REASON_CONFIG } from '@/types/escalation'
import { cn } from '@/lib/utils'
import {
  HelpCircle,
  FileX,
  AlertTriangle,
  MoreHorizontal,
} from 'lucide-react'
import type { EscalationReason } from '@prisma/client'

// ============================================================
// Types
// ============================================================

interface EscalationReasonBadgeProps {
  /** 升級原因 */
  reason: EscalationReason
  /** 是否顯示圖示 */
  showIcon?: boolean
  /** 額外的 className */
  className?: string
}

// ============================================================
// Constants
// ============================================================

/**
 * 原因對應的圖示組件
 */
const REASON_ICONS: Record<EscalationReason, React.ElementType> = {
  UNKNOWN_FORWARDER: HelpCircle, // 保留向後兼容
  UNKNOWN_COMPANY: HelpCircle, // REFACTOR-001: 新增公司識別
  RULE_NOT_APPLICABLE: FileX,
  POOR_QUALITY: AlertTriangle,
  OTHER: MoreHorizontal,
}

// ============================================================
// Component
// ============================================================

// 原因翻譯 key 映射
const REASON_I18N_KEYS: Record<EscalationReason, string> = {
  UNKNOWN_FORWARDER: 'unknownCompany',
  UNKNOWN_COMPANY: 'unknownCompany',
  RULE_NOT_APPLICABLE: 'mappingNotApplicable',
  POOR_QUALITY: 'documentQuality',
  OTHER: 'other',
}

/**
 * 升級原因 Badge
 *
 * @example
 * ```tsx
 * <EscalationReasonBadge reason="UNKNOWN_COMPANY" />
 * <EscalationReasonBadge reason="POOR_QUALITY" showIcon />
 * ```
 */
export function EscalationReasonBadge({
  reason,
  showIcon = false,
  className,
}: EscalationReasonBadgeProps) {
  const t = useTranslations('escalation')
  const Icon = REASON_ICONS[reason]

  // 使用翻譯獲取原因標籤
  const reasonLabel = t(`reasons.${REASON_I18N_KEYS[reason]}`)

  return (
    <Badge
      variant="secondary"
      className={cn('gap-1', className)}
    >
      {showIcon && <Icon className="h-3 w-3" />}
      {reasonLabel}
    </Badge>
  )
}
