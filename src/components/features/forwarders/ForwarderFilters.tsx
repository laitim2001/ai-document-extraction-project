'use client'

/**
 * @fileoverview Forwarder 篩選器組件（國際化版本）
 * @description
 *   提供搜尋和狀態篩選功能。
 *   支援 URL 參數同步和 debounced 搜尋。
 *   - 完整國際化支援
 *
 * @module src/components/features/forwarders/ForwarderFilters
 * @author Development Team
 * @since Epic 5 - Story 5.1 (Forwarder Profile List)
 * @lastModified 2026-01-17
 *
 * @dependencies
 *   - next-intl - 國際化
 *   - @/components/ui - shadcn/ui 組件
 */

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Search, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

// ============================================================
// Types
// ============================================================

interface ForwarderFiltersProps {
  /** 當前搜尋關鍵字 */
  search: string
  /** 當前狀態篩選 */
  status: 'all' | 'active' | 'inactive'
  /** 搜尋變更回調 */
  onSearchChange: (search: string) => void
  /** 狀態篩選變更回調 */
  onStatusChange: (status: 'all' | 'active' | 'inactive') => void
  /** 是否正在載入 */
  isLoading?: boolean
}

// ============================================================
// Component
// ============================================================

/**
 * Forwarder 篩選器組件
 *
 * @description
 *   提供以下篩選功能：
 *   - 關鍵字搜尋（name, code）
 *   - 狀態篩選（全部 / 啟用 / 停用）
 *   - 清除所有篩選
 *
 * @example
 *   <ForwarderFilters
 *     search={params.search || ''}
 *     status={statusFilter}
 *     onSearchChange={setSearch}
 *     onStatusChange={setStatusFilter}
 *   />
 */
export function ForwarderFilters({
  search,
  status,
  onSearchChange,
  onStatusChange,
  isLoading = false,
}: ForwarderFiltersProps) {
  const t = useTranslations('companies')

  // 本地搜尋狀態（用於即時顯示）
  const [localSearch, setLocalSearch] = React.useState(search)

  // 同步外部搜尋值
  React.useEffect(() => {
    setLocalSearch(search)
  }, [search])

  // 處理搜尋輸入變更
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setLocalSearch(value)
    onSearchChange(value)
  }

  // 清除搜尋
  const clearSearch = () => {
    setLocalSearch('')
    onSearchChange('')
  }

  // 是否有任何篩選條件
  const hasFilters = search || status !== 'all'

  // 清除所有篩選
  const clearAllFilters = () => {
    setLocalSearch('')
    onSearchChange('')
    onStatusChange('all')
  }

  // Status options with i18n
  const statusOptions = [
    { value: 'all', labelKey: 'list.filters.allStatus' },
    { value: 'active', labelKey: 'status.active' },
    { value: 'inactive', labelKey: 'status.inactive' },
  ]

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      {/* 搜尋和篩選區域 */}
      <div className="flex flex-1 flex-wrap items-center gap-2">
        {/* 搜尋輸入框 */}
        <div className="relative w-full max-w-xs">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder={t('list.searchPlaceholder')}
            value={localSearch}
            onChange={handleSearchChange}
            className="pl-8 pr-8"
            disabled={isLoading}
            aria-label="Search forwarders"
          />
          {localSearch && (
            <Button
              variant="ghost"
              size="sm"
              className="absolute right-0 top-0 h-full px-2 hover:bg-transparent"
              onClick={clearSearch}
              aria-label="Clear search"
            >
              <X className="h-4 w-4 text-muted-foreground" />
            </Button>
          )}
        </div>

        {/* 狀態篩選 */}
        <Select
          value={status}
          onValueChange={(value) =>
            onStatusChange(value as 'all' | 'active' | 'inactive')
          }
          disabled={isLoading}
        >
          <SelectTrigger className="w-[140px]" aria-label="Filter by status">
            <SelectValue placeholder={t('list.filters.allStatus')} />
          </SelectTrigger>
          <SelectContent>
            {statusOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {t(option.labelKey)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* 清除篩選按鈕 */}
        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearAllFilters}
            disabled={isLoading}
            aria-label="Clear all filters"
          >
            <X className="mr-1 h-4 w-4" />
            {t('list.filters.clear')}
          </Button>
        )}
      </div>
    </div>
  )
}
