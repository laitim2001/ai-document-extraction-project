'use client'

/**
 * @fileoverview 升級原因 Badge 組件
 * @description
 *   顯示升級案例原因的標籤組件：
 *   - UNKNOWN_FORWARDER: 無法識別 Forwarder
 *   - RULE_NOT_APPLICABLE: 映射規則不適用
 *   - POOR_QUALITY: 文件品質問題
 *   - OTHER: 其他
 *
 * @module src/components/features/escalation/EscalationReasonBadge
 * @since Epic 3 - Story 3.8 (Super User 處理升級案例)
 * @lastModified 2025-12-18
 *
 * @dependencies
 *   - @/components/ui/badge - shadcn Badge 組件
 *   - @/types/escalation - 原因配置
 *   - lucide-react - 圖示
 */

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
  UNKNOWN_FORWARDER: HelpCircle,
  RULE_NOT_APPLICABLE: FileX,
  POOR_QUALITY: AlertTriangle,
  OTHER: MoreHorizontal,
}

// ============================================================
// Component
// ============================================================

/**
 * 升級原因 Badge
 *
 * @example
 * ```tsx
 * <EscalationReasonBadge reason="UNKNOWN_FORWARDER" />
 * <EscalationReasonBadge reason="POOR_QUALITY" showIcon />
 * ```
 */
export function EscalationReasonBadge({
  reason,
  showIcon = false,
  className,
}: EscalationReasonBadgeProps) {
  const config = ESCALATION_REASON_CONFIG[reason]
  const Icon = REASON_ICONS[reason]

  return (
    <Badge
      variant="secondary"
      className={cn('gap-1', className)}
    >
      {showIcon && <Icon className="h-3 w-3" />}
      {config.label}
    </Badge>
  )
}
