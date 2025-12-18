'use client'

/**
 * @fileoverview 升級案例篩選組件
 * @description
 *   提供升級案例列表的篩選功能：
 *   - 按狀態篩選（PENDING, IN_PROGRESS, RESOLVED, CANCELLED）
 *   - 按原因篩選（4 種原因）
 *
 * @module src/components/features/escalation/EscalationFilters
 * @since Epic 3 - Story 3.8 (Super User 處理升級案例)
 * @lastModified 2025-12-18
 *
 * @dependencies
 *   - @/components/ui/select - shadcn Select 組件
 *   - @/types/escalation - 類型和配置
 */

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { X } from 'lucide-react'
import { ESCALATION_STATUS_CONFIG, ESCALATION_REASONS } from '@/types/escalation'
import type { EscalationStatus, EscalationReason } from '@prisma/client'

// ============================================================
// Types
// ============================================================

interface EscalationFiltersProps {
  /** 目前選擇的狀態 */
  status?: EscalationStatus
  /** 目前選擇的原因 */
  reason?: EscalationReason
  /** 狀態變更回調 */
  onStatusChange: (status: EscalationStatus | undefined) => void
  /** 原因變更回調 */
  onReasonChange: (reason: EscalationReason | undefined) => void
  /** 清除所有篩選回調 */
  onClearFilters: () => void
}

// ============================================================
// Component
// ============================================================

/**
 * 升級案例篩選組件
 *
 * @example
 * ```tsx
 * const [filters, setFilters] = useState({
 *   status: undefined,
 *   reason: undefined,
 * })
 *
 * <EscalationFilters
 *   status={filters.status}
 *   reason={filters.reason}
 *   onStatusChange={(status) => setFilters(f => ({ ...f, status }))}
 *   onReasonChange={(reason) => setFilters(f => ({ ...f, reason }))}
 *   onClearFilters={() => setFilters({ status: undefined, reason: undefined })}
 * />
 * ```
 */
export function EscalationFilters({
  status,
  reason,
  onStatusChange,
  onReasonChange,
  onClearFilters,
}: EscalationFiltersProps) {
  const hasFilters = status !== undefined || reason !== undefined

  return (
    <div className="flex items-center gap-4">
      {/* 狀態篩選 */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">狀態：</span>
        <Select
          value={status || 'all'}
          onValueChange={(value) =>
            onStatusChange(value === 'all' ? undefined : (value as EscalationStatus))
          }
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="全部" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部</SelectItem>
            {(Object.keys(ESCALATION_STATUS_CONFIG) as EscalationStatus[]).map(
              (statusKey) => (
                <SelectItem key={statusKey} value={statusKey}>
                  {ESCALATION_STATUS_CONFIG[statusKey].label}
                </SelectItem>
              )
            )}
          </SelectContent>
        </Select>
      </div>

      {/* 原因篩選 */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">原因：</span>
        <Select
          value={reason || 'all'}
          onValueChange={(value) =>
            onReasonChange(value === 'all' ? undefined : (value as EscalationReason))
          }
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="全部" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部</SelectItem>
            {ESCALATION_REASONS.map((reasonConfig) => (
              <SelectItem key={reasonConfig.value} value={reasonConfig.value}>
                {reasonConfig.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* 清除篩選按鈕 */}
      {hasFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onClearFilters}
          className="h-8 px-2 text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4 mr-1" />
          清除篩選
        </Button>
      )}
    </div>
  )
}
