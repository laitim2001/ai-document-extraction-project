/**
 * @fileoverview 統一的國際化格式化 Hook
 * @description
 *   整合日期、數字和貨幣格式化，提供統一的 API。
 *
 * @module src/hooks/use-localized-format
 * @author Development Team
 * @since Epic 17 - Story 17.4 (Date/Number/Currency Formatting)
 * @lastModified 2026-01-17
 */

'use client'

import { useLocale } from 'next-intl'
import { useMemo } from 'react'
import {
  formatShortDate,
  formatMediumDate,
  formatLongDate,
  formatDateTime,
  formatRelativeTime,
  formatTime,
  formatDate,
} from '@/lib/i18n-date'
import {
  formatNumber,
  formatPercent,
  formatCompact,
  formatInteger,
  formatDecimal,
} from '@/lib/i18n-number'
import {
  formatCurrency,
  formatCurrencyRange,
  getCurrencySymbol,
  getCurrencyName,
  getCurrencyOptions,
  type CurrencyCode,
  type CurrencyFormatOptions,
} from '@/lib/i18n-currency'
import type { Locale } from '@/i18n/config'

/**
 * 統一的國際化格式化 Hook
 *
 * @returns 格式化函數集合
 *
 * @example
 * function MyComponent() {
 *   const format = useLocalizedFormat();
 *
 *   return (
 *     <div>
 *       <p>日期：{format.date.medium(createdAt)}</p>
 *       <p>金額：{format.currency(1234.56, 'USD')}</p>
 *       <p>數量：{format.number(1000000)}</p>
 *       <p>百分比：{format.percent(95.5)}</p>
 *     </div>
 *   );
 * }
 */
export function useLocalizedFormat() {
  const locale = useLocale() as Locale

  return useMemo(
    () => ({
      /** 當前語言 */
      locale,

      // =====================
      // 日期格式化
      // =====================
      date: {
        /** 短日期格式（如 2026/01/16 或 01/16/2026） */
        short: (date: Date | string | number) => formatShortDate(date, locale),
        /** 中等日期格式（如 2026年1月16日 或 Jan 16, 2026） */
        medium: (date: Date | string | number) => formatMediumDate(date, locale),
        /** 長日期格式（如 2026年1月16日 或 January 16, 2026） */
        long: (date: Date | string | number) => formatLongDate(date, locale),
        /** 日期時間格式 */
        datetime: (date: Date | string | number) => formatDateTime(date, locale),
        /** 相對時間（如 2 小時前） */
        relative: (date: Date | string | number) => formatRelativeTime(date, locale),
        /** 僅時間（如 14:30 或 2:30 PM） */
        time: (date: Date | string | number) => formatTime(date, locale),
        /** 自訂格式 */
        format: (date: Date | string | number, formatStr: string) =>
          formatDate(date, formatStr, locale),
      },

      // =====================
      // 數字格式化
      // =====================
      /** 格式化數字（帶千位分隔符） */
      number: (value: number, options?: Intl.NumberFormatOptions) =>
        formatNumber(value, locale, options),
      /** 格式化整數 */
      integer: (value: number) => formatInteger(value, locale),
      /** 格式化小數 */
      decimal: (value: number, decimals?: number) => formatDecimal(value, locale, decimals),
      /** 格式化百分比 */
      percent: (value: number, isDecimal?: boolean, decimals?: number) =>
        formatPercent(value, locale, isDecimal, decimals),
      /** 格式化緊湊數字（如 1.2K、1.5M） */
      compact: (value: number) => formatCompact(value, locale),

      // =====================
      // 貨幣格式化
      // =====================
      /** 格式化貨幣 */
      currency: (
        value: number,
        currency: CurrencyCode,
        options?: CurrencyFormatOptions
      ) => formatCurrency(value, currency, locale, options),
      /** 格式化貨幣範圍 */
      currencyRange: (min: number, max: number, currency: CurrencyCode) =>
        formatCurrencyRange(min, max, currency, locale),
      /** 獲取貨幣符號 */
      currencySymbol: getCurrencySymbol,
      /** 獲取貨幣名稱 */
      currencyName: (currency: CurrencyCode) => getCurrencyName(currency, locale),
      /** 獲取貨幣選項列表 */
      currencyOptions: () => getCurrencyOptions(locale),
    }),
    [locale]
  )
}

// Re-export types for convenience
export type { CurrencyCode, CurrencyFormatOptions }
