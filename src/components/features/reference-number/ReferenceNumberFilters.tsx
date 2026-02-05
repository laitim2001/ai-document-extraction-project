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
      <div className="flex items-center gap-2">
        <Input
          placeholder={t('filters.searchPlaceholder')}
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSearch()
          }}
          className="w-64"
        />
        <Button variant="outline" size="icon" onClick={handleSearch}>
          <Search className="h-4 w-4" />
        </Button>
      </div>

      {/* 年份 */}
      <Select
        value={filters.year?.toString() ?? ''}
        onValueChange={(value) =>
          onFiltersChange({
            year: value ? Number(value) : undefined,
            page: 1,
          })
        }
      >
        <SelectTrigger className="w-32">
          <SelectValue placeholder={t('filters.year')} />
        </SelectTrigger>
        <SelectContent>
          {YEARS.map((year) => (
            <SelectItem key={year} value={year.toString()}>
              {year}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* 地區 */}
      <div className="w-48">
        <RegionSelect
          value={filters.regionId}
          onChange={(value) =>
            onFiltersChange({
              regionId: value || undefined,
              page: 1,
            })
          }
          placeholder={t('filters.region')}
        />
      </div>

      {/* 類型 */}
      <Select
        value={filters.type ?? ''}
        onValueChange={(value) =>
          onFiltersChange({
            type: value || undefined,
            page: 1,
          })
        }
      >
        <SelectTrigger className="w-36">
          <SelectValue placeholder={t('filters.type')} />
        </SelectTrigger>
        <SelectContent>
          {REFERENCE_NUMBER_TYPE_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {t(`types.${option.value}` as Parameters<typeof t>[0])}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* 狀態 */}
      <Select
        value={filters.status ?? ''}
        onValueChange={(value) =>
          onFiltersChange({
            status: value || undefined,
            page: 1,
          })
        }
      >
        <SelectTrigger className="w-32">
          <SelectValue placeholder={t('filters.status')} />
        </SelectTrigger>
        <SelectContent>
          {REFERENCE_NUMBER_STATUS_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {t(`statuses.${option.value}` as Parameters<typeof t>[0])}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* 清除 */}
      {hasActiveFilters && (
        <Button variant="ghost" size="sm" onClick={handleClear}>
          <X className="h-4 w-4 mr-1" />
          {t('filters.clear')}
        </Button>
      )}
    </div>
  )
}
