'use client'

/**
 * @fileoverview 升級狀態 Badge 組件（國際化版本）
 * @description
 *   顯示升級案例狀態的標籤組件：
 *   - PENDING: 待處理（琥珀色）
 *   - IN_PROGRESS: 處理中（藍色）
 *   - RESOLVED: 已解決（綠色）
 *   - CANCELLED: 已取消（灰色）
 *   - 完整國際化支援
 *
 * @module src/components/features/escalation/EscalationStatusBadge
 * @since Epic 3 - Story 3.8 (Super User 處理升級案例)
 * @lastModified 2026-01-17
 *
 * @dependencies
 *   - next-intl - 國際化
 *   - @/components/ui/badge - shadcn Badge 組件
 *   - @/types/escalation - 狀態配置
 */

import { useTranslations } from 'next-intl'
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

// 狀態翻譯 key 映射
const STATUS_I18N_KEYS: Record<EscalationStatus, string> = {
  PENDING: 'pending',
  IN_PROGRESS: 'inProgress',
  RESOLVED: 'resolved',
  CANCELLED: 'cancelled',
}

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
  const t = useTranslations('escalation')
  const config = ESCALATION_STATUS_CONFIG[status]

  // 使用翻譯獲取狀態標籤
  const statusLabel = t(`status.${STATUS_I18N_KEYS[status]}`)

  return (
    <Badge
      variant="outline"
      className={cn(config.color, config.bgColor, 'border-0', className)}
    >
      {statusLabel}
    </Badge>
  )
}
