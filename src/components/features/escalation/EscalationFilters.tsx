'use client'

/**
 * @fileoverview 升級案例篩選組件（國際化版本）
 * @description
 *   提供升級案例列表的篩選功能：
 *   - 按狀態篩選（PENDING, IN_PROGRESS, RESOLVED, CANCELLED）
 *   - 按原因篩選（4 種原因）
 *   - 完整國際化支援
 *
 * @module src/components/features/escalation/EscalationFilters
 * @since Epic 3 - Story 3.8 (Super User 處理升級案例)
 * @lastModified 2026-01-17
 *
 * @dependencies
 *   - next-intl - 國際化
 *   - @/components/ui/select - shadcn Select 組件
 *   - @/types/escalation - 類型和配置
 */

import { useTranslations } from 'next-intl'
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
// 狀態翻譯 key 映射
const STATUS_I18N_KEYS: Record<EscalationStatus, string> = {
  PENDING: 'pending',
  IN_PROGRESS: 'inProgress',
  RESOLVED: 'resolved',
  CANCELLED: 'cancelled',
}

// 原因翻譯 key 映射
const REASON_I18N_KEYS: Record<EscalationReason, string> = {
  UNKNOWN_FORWARDER: 'unknownCompany',
  UNKNOWN_COMPANY: 'unknownCompany',
  RULE_NOT_APPLICABLE: 'mappingNotApplicable',
  POOR_QUALITY: 'documentQuality',
  OTHER: 'other',
}

export function EscalationFilters({
  status,
  reason,
  onStatusChange,
  onReasonChange,
  onClearFilters,
}: EscalationFiltersProps) {
  const t = useTranslations('escalation')
  const hasFilters = status !== undefined || reason !== undefined

  return (
    <div className="flex items-center gap-4">
      {/* 狀態篩選 */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">{t('filters.status')}</span>
        <Select
          value={status || 'all'}
          onValueChange={(value) =>
            onStatusChange(value === 'all' ? undefined : (value as EscalationStatus))
          }
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder={t('filters.all')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('filters.all')}</SelectItem>
            {(Object.keys(ESCALATION_STATUS_CONFIG) as EscalationStatus[]).map(
              (statusKey) => (
                <SelectItem key={statusKey} value={statusKey}>
                  {t(`status.${STATUS_I18N_KEYS[statusKey]}`)}
                </SelectItem>
              )
            )}
          </SelectContent>
        </Select>
      </div>

      {/* 原因篩選 */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">{t('filters.reason')}</span>
        <Select
          value={reason || 'all'}
          onValueChange={(value) =>
            onReasonChange(value === 'all' ? undefined : (value as EscalationReason))
          }
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder={t('filters.all')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('filters.all')}</SelectItem>
            {ESCALATION_REASONS.map((reasonConfig) => (
              <SelectItem key={reasonConfig.value} value={reasonConfig.value}>
                {t(`reasons.${REASON_I18N_KEYS[reasonConfig.value]}`)}
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
          {t('filters.clearFilters')}
        </Button>
      )}
    </div>
  )
}
