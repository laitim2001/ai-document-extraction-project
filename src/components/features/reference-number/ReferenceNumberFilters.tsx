'use client'

/**
 * @fileoverview Reference Number 篩選器組件
 * @description
 *   提供 Reference Number 列表的篩選功能：
 *   - 文字搜尋（號碼模糊搜尋）
 *   - 年份選擇
 *   - 地區選擇（RegionSelect）
 *   - 類型選擇（ReferenceNumberType）
 *   - 狀態選擇（ReferenceNumberStatus）
 *   - 清除所有篩選
 *
 * @module src/components/features/reference-number/ReferenceNumberFilters
 * @since Epic 20 - Story 20.5 (Management Page - List & Filter)
 * @lastModified 2026-02-05
 *
 * @dependencies
 *   - next-intl - 國際化
 *   - @/components/ui/input - 輸入框
 *   - @/components/ui/button - 按鈕
 *   - @/components/ui/select - 下拉選擇
 *   - @/components/features/region/RegionSelect - 地區選擇
 */

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { RegionSelect } from '@/components/features/region/RegionSelect'
import { Search, X } from 'lucide-react'
import {
  REFERENCE_NUMBER_TYPE_OPTIONS,
  REFERENCE_NUMBER_STATUS_OPTIONS,
} from '@/types/reference-number'

// ============================================================
// Types
// ============================================================

interface FilterValues {
  year?: number
  regionId?: string
  type?: string
  status?: string
  search?: string
}

interface ReferenceNumberFiltersProps {
  /** 當前篩選條件 */
  filters: FilterValues
  /** 篩選條件變更回調 */
  onFiltersChange: (filters: Partial<FilterValues> & { page?: number }) => void
}

// ============================================================
// Constants
// ============================================================

const CURRENT_YEAR = new Date().getFullYear()
const YEARS = Array.from({ length: 10 }, (_, i) => CURRENT_YEAR - i)
const ALL_VALUE = '__all__'

// ============================================================
// Component
// ============================================================

/**
 * Reference Number 篩選器
 *
 * @param props - 組件屬性
 * @returns React 元素
 */
export function ReferenceNumberFilters({
  filters,
  onFiltersChange,
}: ReferenceNumberFiltersProps) {
  const t = useTranslations('referenceNumber')
  const [searchValue, setSearchValue] = React.useState(filters.search ?? '')

  // 同步外部 search 值
  React.useEffect(() => {
    setSearchValue(filters.search ?? '')
  }, [filters.search])

  const handleSearch = React.useCallback(() => {
    onFiltersChange({ search: searchValue || undefined, page: 1 })
  }, [searchValue, onFiltersChange])

  const handleClear = React.useCallback(() => {
    setSearchValue('')
    onFiltersChange({
      year: undefined,
      regionId: undefined,
      type: undefined,
      status: undefined,
      search: undefined,
      page: 1,
    })
  }, [onFiltersChange])

  const hasActiveFilters =
    !!filters.year ||
    !!filters.regionId ||
    !!filters.type ||
    !!filters.status ||
    !!filters.search

  return (
    <div className="flex flex-wrap items-end gap-4">
      {/* 搜尋 */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium">{t('filters.search')}</label>
        <div className="flex items-center gap-2">
          <Input
            placeholder={t('filters.searchPlaceholder')}
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSearch()
            }}
            className="w-[200px]"
          />
          <Button variant="outline" size="icon" onClick={handleSearch}>
            <Search className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* 年份 */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium">{t('filters.year')}</label>
        <Select
          value={filters.year?.toString() ?? ALL_VALUE}
          onValueChange={(value) =>
            onFiltersChange({
              year: value === ALL_VALUE ? undefined : Number(value),
              page: 1,
            })
          }
        >
          <SelectTrigger className="w-[120px]">
            <SelectValue placeholder={t('filters.all')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_VALUE}>{t('filters.all')}</SelectItem>
            {YEARS.map((year) => (
              <SelectItem key={year} value={year.toString()}>
                {year}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* 地區 */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium">{t('filters.region')}</label>
        <RegionSelect
          value={filters.regionId}
          onChange={(value) =>
            onFiltersChange({
              regionId: value || undefined,
              page: 1,
            })
          }
          placeholder={t('filters.all')}
          className="w-[180px]"
        />
      </div>

      {/* 類型 */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium">{t('filters.type')}</label>
        <Select
          value={filters.type ?? ALL_VALUE}
          onValueChange={(value) =>
            onFiltersChange({
              type: value === ALL_VALUE ? undefined : value,
              page: 1,
            })
          }
        >
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder={t('filters.all')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_VALUE}>{t('filters.all')}</SelectItem>
            {REFERENCE_NUMBER_TYPE_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {t(`types.${option.value}` as Parameters<typeof t>[0])}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* 狀態 */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium">{t('filters.status')}</label>
        <Select
          value={filters.status ?? ALL_VALUE}
          onValueChange={(value) =>
            onFiltersChange({
              status: value === ALL_VALUE ? undefined : value,
              page: 1,
            })
          }
        >
          <SelectTrigger className="w-[120px]">
            <SelectValue placeholder={t('filters.all')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_VALUE}>{t('filters.all')}</SelectItem>
            {REFERENCE_NUMBER_STATUS_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {t(`statuses.${option.value}` as Parameters<typeof t>[0])}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* 清除 */}
      {hasActiveFilters && (
        <div className="space-y-1.5">
          <label className="text-sm font-medium invisible">Action</label>
          <Button variant="ghost" size="sm" onClick={handleClear}>
            <X className="h-4 w-4 mr-1" />
            {t('filters.clear')}
          </Button>
        </div>
      )}
    </div>
  )
}
