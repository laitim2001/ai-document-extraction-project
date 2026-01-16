/**
 * @fileoverview 國際化日期格式化 Hook
 * @description
 *   提供簡化的日期格式化 API，自動使用當前語言。
 *
 * @module src/hooks/use-localized-date
 * @author Development Team
 * @since Epic 17 - Story 17.4 (Date/Number/Currency Formatting)
 * @lastModified 2026-01-17
 */

'use client'

import { useLocale } from 'next-intl'
import { useCallback, useMemo } from 'react'
import {
  formatDate,
  formatShortDate,
  formatMediumDate,
  formatLongDate,
  formatDateTime,
  formatRelativeTime,
  formatTime,
  DATE_FORMATS,
} from '@/lib/i18n-date'
import type { Locale } from '@/i18n/config'

/**
 * 國際化日期格式化 Hook
 *
 * @returns 日期格式化函數集合
 *
 * @example
 * function MyComponent() {
 *   const date = useLocalizedDate();
 *
 *   return (
 *     <div>
 *       <p>建立時間：{date.medium(createdAt)}</p>
 *       <p>更新時間：{date.relative(updatedAt)}</p>
 *     </div>
 *   );
 * }
 */
export function useLocalizedDate() {
  const locale = useLocale() as Locale
  const formats = DATE_FORMATS[locale]

  const short = useCallback(
    (date: Date | string | number) => formatShortDate(date, locale),
    [locale]
  )

  const medium = useCallback(
    (date: Date | string | number) => formatMediumDate(date, locale),
    [locale]
  )

  const long = useCallback(
    (date: Date | string | number) => formatLongDate(date, locale),
    [locale]
  )

  const datetime = useCallback(
    (date: Date | string | number) => formatDateTime(date, locale),
    [locale]
  )

  const relative = useCallback(
    (date: Date | string | number) => formatRelativeTime(date, locale),
    [locale]
  )

  const time = useCallback(
    (date: Date | string | number) => formatTime(date, locale),
    [locale]
  )

  const format = useCallback(
    (date: Date | string | number, formatStr: string) =>
      formatDate(date, formatStr, locale),
    [locale]
  )

  return useMemo(
    () => ({
      short,
      medium,
      long,
      datetime,
      relative,
      time,
      format,
      formats,
      locale,
    }),
    [short, medium, long, datetime, relative, time, format, formats, locale]
  )
}
