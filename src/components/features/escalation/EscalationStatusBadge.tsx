'use client'

/**
 * @fileoverview 升級狀態 Badge 組件
 * @description
 *   顯示升級案例狀態的標籤組件：
 *   - PENDING: 待處理（琥珀色）
 *   - IN_PROGRESS: 處理中（藍色）
 *   - RESOLVED: 已解決（綠色）
 *   - CANCELLED: 已取消（灰色）
 *
 * @module src/components/features/escalation/EscalationStatusBadge
 * @since Epic 3 - Story 3.8 (Super User 處理升級案例)
 * @lastModified 2025-12-18
 *
 * @dependencies
 *   - @/components/ui/badge - shadcn Badge 組件
 *   - @/types/escalation - 狀態配置
 */

import { Badge } from '@/components/ui/badge'
import { ESCALATION_STATUS_CONFIG } from '@/types/escalation'
import { cn } from '@/lib/utils'
import type { EscalationStatus } from '@prisma/client'

// ============================================================
// Types
// ============================================================

interface EscalationStatusBadgeProps {
  /** 升級狀態 */
  status: EscalationStatus
  /** 額外的 className */
  className?: string
}

// ============================================================
// Component
// ============================================================

/**
 * 升級狀態 Badge
 *
 * @example
 * ```tsx
 * <EscalationStatusBadge status="PENDING" />
 * <EscalationStatusBadge status="RESOLVED" className="ml-2" />
 * ```
 */
export function EscalationStatusBadge({
  status,
  className,
}: EscalationStatusBadgeProps) {
  const config = ESCALATION_STATUS_CONFIG[status]

  return (
    <Badge
      variant="outline"
      className={cn(config.color, config.bgColor, 'border-0', className)}
    >
      {config.label}
    </Badge>
  )
}
