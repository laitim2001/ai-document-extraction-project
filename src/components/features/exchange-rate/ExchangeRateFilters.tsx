'use client'

/**
 * @fileoverview Exchange Rate 篩選器組件
 * @description
 *   提供 Exchange Rate 列表的篩選功能：
 *   - 年份選擇
 *   - 來源貨幣（CurrencySelect）
 *   - 目標貨幣（CurrencySelect）
 *   - 啟用狀態
 *   - 來源類型（MANUAL/IMPORTED/AUTO_INVERSE）
 *   - 清除所有篩選
 *
 * @module src/components/features/exchange-rate/ExchangeRateFilters
 * @since Epic 21 - Story 21.6 (Management Page - List & Filter)
 * @lastModified 2026-02-06
 *
 * @dependencies
 *   - next-intl - 國際化
 *   - @/components/ui/select - 下拉選擇
 *   - @/components/ui/button - 按鈕
 *   - ./CurrencySelect - 貨幣選擇
 */

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { CurrencySelect } from './CurrencySelect'

// ============================================================
// Types
// ============================================================

/** 來源類型 */
export type ExchangeRateSourceType = 'MANUAL' | 'IMPORTED' | 'AUTO_INVERSE'

export interface ExchangeRateFilterValues {
  year?: number
  fromCurrency?: string
  toCurrency?: string
  isActive?: boolean
  source?: ExchangeRateSourceType
}

interface ExchangeRateFiltersProps {
  /** 當前篩選條件 */
  filters: ExchangeRateFilterValues
  /** 篩選條件變更回調 */
  onFiltersChange: (
    filters: Partial<ExchangeRateFilterValues> & { page?: number }
  ) => void
}

// ============================================================
// Constants
// ============================================================

const CURRENT_YEAR = new Date().getFullYear()
const YEARS = Array.from({ length: 10 }, (_, i) => CURRENT_YEAR - i)

const SOURCE_OPTIONS = ['MANUAL', 'IMPORTED', 'AUTO_INVERSE'] as const

// ============================================================
// Component
// ============================================================

/**
 * Exchange Rate 篩選器
 *
 * @param props - 組件屬性
 * @returns React 元素
 */
export function ExchangeRateFilters({
  filters,
  onFiltersChange,
}: ExchangeRateFiltersProps) {
  const t = useTranslations('exchangeRate')

  const handleClear = React.useCallback(() => {
    onFiltersChange({
      year: undefined,
      fromCurrency: undefined,
      toCurrency: undefined,
      isActive: undefined,
      source: undefined,
      page: 1,
    })
  }, [onFiltersChange])

  const hasActiveFilters =
    !!filters.year ||
    !!filters.fromCurrency ||
    !!filters.toCurrency ||
    filters.isActive !== undefined ||
    !!filters.source

  return (
    <div className="flex flex-wrap items-end gap-4">
      {/* 年份 */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium">{t('filters.year')}</label>
        <Select
          value={filters.year?.toString() ?? ''}
          onValueChange={(value) =>
            onFiltersChange({
              year: value ? Number(value) : undefined,
              page: 1,
            })
          }
        >
          <SelectTrigger className="w-[120px]">
            <SelectValue placeholder={t('filters.all')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">{t('filters.all')}</SelectItem>
            {YEARS.map((year) => (
              <SelectItem key={year} value={year.toString()}>
                {year}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* 來源貨幣 */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium">{t('filters.fromCurrency')}</label>
        <CurrencySelect
          value={filters.fromCurrency}
          onChange={(value) =>
            onFiltersChange({
              fromCurrency: value || undefined,
              page: 1,
            })
          }
          placeholder={t('filters.all')}
          className="w-[200px]"
        />
      </div>

      {/* 目標貨幣 */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium">{t('filters.toCurrency')}</label>
        <CurrencySelect
          value={filters.toCurrency}
          onChange={(value) =>
            onFiltersChange({
              toCurrency: value || undefined,
              page: 1,
            })
          }
          placeholder={t('filters.all')}
          className="w-[200px]"
        />
      </div>

      {/* 狀態 */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium">{t('filters.status')}</label>
        <Select
          value={
            filters.isActive === undefined
              ? ''
              : filters.isActive.toString()
          }
          onValueChange={(value) =>
            onFiltersChange({
              isActive: value === '' ? undefined : value === 'true',
              page: 1,
            })
          }
        >
          <SelectTrigger className="w-[120px]">
            <SelectValue placeholder={t('filters.all')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">{t('filters.all')}</SelectItem>
            <SelectItem value="true">{t('filters.active')}</SelectItem>
            <SelectItem value="false">{t('filters.inactive')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* 來源類型 */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium">{t('filters.source')}</label>
        <Select
          value={filters.source ?? ''}
          onValueChange={(value) =>
            onFiltersChange({
              source: (value || undefined) as ExchangeRateSourceType | undefined,
              page: 1,
            })
          }
        >
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder={t('filters.all')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">{t('filters.all')}</SelectItem>
            {SOURCE_OPTIONS.map((source) => (
              <SelectItem key={source} value={source}>
                {t(`source.${source}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* 清除按鈕 */}
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
