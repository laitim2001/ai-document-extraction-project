'use client'

/**
 * @fileoverview 規則篩選組件（國際化版本）
 * @description
 *   提供映射規則列表的篩選功能：
 *   - Forwarder 選擇
 *   - 欄位名稱搜索（防抖）
 *   - 狀態篩選
 *   - 類別篩選
 *   - 清除所有篩選
 *   - 完整國際化支援
 *
 * @module src/components/features/rules/RuleFilters
 * @since Epic 4 - Story 4.1 (映射規則列表與查看)
 * @lastModified 2026-01-17
 *
 * @dependencies
 *   - next-intl - 國際化
 *   - @/components/ui/* - shadcn UI 組件
 *   - @/hooks/useForwarderList - Forwarder 列表 Hook
 *   - @/hooks/use-debounce - 防抖 Hook
 */

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { X, Search } from 'lucide-react'
import { useForwarderList } from '@/hooks/useForwarderList'
import { useDebounce } from '@/hooks/use-debounce'
import { RULE_STATUSES, FIELD_CATEGORIES } from '@/types/rule'
import type { RuleStatus } from '@prisma/client'

// ============================================================
// Types
// ============================================================

interface RuleFiltersProps {
  /** 當前選中的 Forwarder ID */
  forwarderId?: string
  /** 欄位名稱搜索 */
  fieldName?: string
  /** 狀態篩選 */
  status?: RuleStatus
  /** 類別篩選 */
  category?: string
  /** Forwarder 變更回調 */
  onForwarderChange: (value: string | undefined) => void
  /** 欄位名稱變更回調 */
  onFieldNameChange: (value: string | undefined) => void
  /** 狀態變更回調 */
  onStatusChange: (value: RuleStatus | undefined) => void
  /** 類別變更回調 */
  onCategoryChange?: (value: string | undefined) => void
}

// ============================================================
// Component
// ============================================================

/**
 * 規則篩選組件
 *
 * @example
 * ```tsx
 * <RuleFilters
 *   forwarderId={filters.forwarderId}
 *   fieldName={filters.fieldName}
 *   status={filters.status}
 *   onForwarderChange={(v) => handleFilterChange('forwarderId', v)}
 *   onFieldNameChange={(v) => handleFilterChange('fieldName', v)}
 *   onStatusChange={(v) => handleFilterChange('status', v)}
 * />
 * ```
 */
// 規則狀態翻譯 key 映射
const STATUS_I18N_KEYS: Record<RuleStatus, string> = {
  ACTIVE: 'active',
  DRAFT: 'draft',
  PENDING_REVIEW: 'pendingReview',
  DEPRECATED: 'deprecated',
}

export function RuleFilters({
  forwarderId,
  fieldName,
  status,
  category,
  onForwarderChange,
  onFieldNameChange,
  onStatusChange,
  onCategoryChange,
}: RuleFiltersProps) {
  const t = useTranslations('rules')

  // --- Hooks ---
  const { data: forwarders, isLoading: forwardersLoading } = useForwarderList()

  // --- State ---
  const [fieldNameInput, setFieldNameInput] = useState(fieldName || '')
  const debouncedFieldName = useDebounce(fieldNameInput, 300)

  // --- Effects ---
  // 處理防抖搜索
  useEffect(() => {
    onFieldNameChange(debouncedFieldName || undefined)
  }, [debouncedFieldName, onFieldNameChange])

  // 同步外部 fieldName 變更（只在外部值變更時同步，避免迴圈）
  useEffect(() => {
    if (fieldName !== fieldNameInput && fieldName !== undefined) {
      setFieldNameInput(fieldName)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fieldName])

  // --- Computed ---
  const hasFilters = forwarderId || fieldName || status || category

  // --- Handlers ---
  const clearFilters = () => {
    onForwarderChange(undefined)
    onFieldNameChange(undefined)
    onStatusChange(undefined)
    onCategoryChange?.(undefined)
    setFieldNameInput('')
  }

  // --- Render ---
  return (
    <div className="flex items-end gap-4 flex-wrap">
      {/* Forwarder 篩選 */}
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">{t('ruleFilters.forwarder')}</Label>
        <Select
          value={forwarderId || 'all'}
          onValueChange={(v) => onForwarderChange(v === 'all' ? undefined : v)}
          disabled={forwardersLoading}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder={t('ruleFilters.all')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('ruleFilters.allForwarders')}</SelectItem>
            <SelectItem value="universal">{t('ruleFilters.universalRules')}</SelectItem>
            {forwarders?.map((fw) => (
              <SelectItem key={fw.id} value={fw.id}>
                {fw.name} ({fw.code})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* 欄位名稱搜索 */}
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">{t('ruleFilters.fieldName')}</Label>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t('ruleFilters.searchField')}
            value={fieldNameInput}
            onChange={(e) => setFieldNameInput(e.target.value)}
            className="w-[180px] pl-8"
          />
        </div>
      </div>

      {/* 狀態篩選 */}
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">{t('ruleFilters.status')}</Label>
        <Select
          value={status || 'all'}
          onValueChange={(v) =>
            onStatusChange(v === 'all' ? undefined : (v as RuleStatus))
          }
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder={t('ruleFilters.all')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('ruleFilters.allStatuses')}</SelectItem>
            {RULE_STATUSES.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {t(`ruleStatus.${STATUS_I18N_KEYS[s.value]}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* 類別篩選 */}
      {onCategoryChange && (
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">{t('ruleFilters.category')}</Label>
          <Select
            value={category || 'all'}
            onValueChange={(v) =>
              onCategoryChange(v === 'all' ? undefined : v)
            }
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder={t('ruleFilters.all')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('ruleFilters.allCategories')}</SelectItem>
              {FIELD_CATEGORIES.map((cat) => (
                <SelectItem key={cat.value} value={cat.value}>
                  {cat.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* 清除篩選 */}
      {hasFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={clearFilters}
          className="text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4 mr-1" />
          {t('ruleFilters.clearFilters')}
        </Button>
      )}
    </div>
  )
}
