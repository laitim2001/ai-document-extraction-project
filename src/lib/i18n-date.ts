/**
 * @fileoverview 日期格式化國際化工具
 * @description
 *   提供日期和時間的國際化格式化功能，整合 date-fns 多語言支援。
 *   支援相對時間、各種日期格式和時區處理。
 *
 * @module src/lib/i18n-date
 * @author Development Team
 * @since Epic 17 - Story 17.4 (Date/Number/Currency Formatting)
 * @lastModified 2026-01-17
 *
 * @features
 *   - 多語言日期格式化
 *   - 相對時間（如「2 小時前」）
 *   - 自訂日期格式
 *   - 時區支援
 *
 * @dependencies
 *   - date-fns - 日期處理庫
 *   - date-fns/locale - 語言包
 */

import {
  format,
  formatDistanceToNow,
  parseISO,
  isValid,
} from 'date-fns'
import { zhTW, enUS, zhCN } from 'date-fns/locale'
import type { Locale } from '@/i18n/config'

/**
 * 語言到 date-fns locale 映射
 */
const LOCALE_MAP: Record<Locale, typeof enUS> = {
  'en': enUS,
  'zh-TW': zhTW,
  'zh-CN': zhCN,
}

/**
 * 預設日期格式配置
 */
export const DATE_FORMATS: Record<Locale, {
  short: string
  medium: string
  long: string
  full: string
  time: string
  datetime: string
}> = {
  'en': {
    short: 'MM/dd/yyyy',
    medium: 'MMM d, yyyy',
    long: 'MMMM d, yyyy',
    full: 'EEEE, MMMM d, yyyy',
    time: 'h:mm a',
    datetime: 'MMM d, yyyy h:mm a',
  },
  'zh-TW': {
    short: 'yyyy/MM/dd',
    medium: 'yyyy年M月d日',
    long: 'yyyy年M月d日',
    full: 'yyyy年M月d日 EEEE',
    time: 'HH:mm',
    datetime: 'yyyy年M月d日 HH:mm',
  },
  'zh-CN': {
    short: 'yyyy/MM/dd',
    medium: 'yyyy年M月d日',
    long: 'yyyy年M月d日',
    full: 'yyyy年M月d日 EEEE',
    time: 'HH:mm',
    datetime: 'yyyy年M月d日 HH:mm',
  },
}

/**
 * 解析日期輸入（支援多種格式）
 */
function parseDate(date: Date | string | number): Date {
  if (date instanceof Date) return date
  if (typeof date === 'number') return new Date(date)
  if (typeof date === 'string') {
    const parsed = parseISO(date)
    if (isValid(parsed)) return parsed
    return new Date(date)
  }
  return new Date()
}

/**
 * 格式化日期
 *
 * @param date - 日期（Date、ISO 字串或時間戳）
 * @param formatStr - 格式字串（date-fns 格式）
 * @param locale - 語言代碼
 * @returns 格式化後的日期字串
 *
 * @example
 * formatDate(new Date(), 'yyyy年M月d日', 'zh-TW')
 * // → "2026年1月16日"
 */
export function formatDate(
  date: Date | string | number,
  formatStr: string,
  locale: Locale
): string {
  const dateObj = parseDate(date)
  if (!isValid(dateObj)) return ''

  return format(dateObj, formatStr, { locale: LOCALE_MAP[locale] })
}

/**
 * 格式化短日期
 *
 * @example
 * formatShortDate(new Date(), 'zh-TW') // → "2026/01/16"
 * formatShortDate(new Date(), 'en')    // → "01/16/2026"
 */
export function formatShortDate(
  date: Date | string | number,
  locale: Locale
): string {
  return formatDate(date, DATE_FORMATS[locale].short, locale)
}

/**
 * 格式化中等日期
 *
 * @example
 * formatMediumDate(new Date(), 'zh-TW') // → "2026年1月16日"
 * formatMediumDate(new Date(), 'en')    // → "Jan 16, 2026"
 */
export function formatMediumDate(
  date: Date | string | number,
  locale: Locale
): string {
  return formatDate(date, DATE_FORMATS[locale].medium, locale)
}

/**
 * 格式化長日期
 *
 * @example
 * formatLongDate(new Date(), 'zh-TW') // → "2026年1月16日"
 * formatLongDate(new Date(), 'en')    // → "January 16, 2026"
 */
export function formatLongDate(
  date: Date | string | number,
  locale: Locale
): string {
  return formatDate(date, DATE_FORMATS[locale].long, locale)
}

/**
 * 格式化完整日期時間
 *
 * @example
 * formatDateTime(new Date(), 'zh-TW') // → "2026年1月16日 14:30"
 * formatDateTime(new Date(), 'en')    // → "Jan 16, 2026 2:30 PM"
 */
export function formatDateTime(
  date: Date | string | number,
  locale: Locale
): string {
  return formatDate(date, DATE_FORMATS[locale].datetime, locale)
}

/**
 * 格式化相對時間
 *
 * @param date - 日期
 * @param locale - 語言代碼
 * @returns 相對時間字串
 *
 * @example
 * formatRelativeTime(twoHoursAgo, 'zh-TW') // → "2 小時前"
 * formatRelativeTime(twoHoursAgo, 'en')    // → "2 hours ago"
 */
export function formatRelativeTime(
  date: Date | string | number,
  locale: Locale
): string {
  const dateObj = parseDate(date)
  if (!isValid(dateObj)) return ''

  return formatDistanceToNow(dateObj, {
    addSuffix: true,
    locale: LOCALE_MAP[locale],
  })
}

/**
 * 格式化時間（僅時間部分）
 *
 * @example
 * formatTime(new Date(), 'zh-TW') // → "14:30"
 * formatTime(new Date(), 'en')    // → "2:30 PM"
 */
export function formatTime(
  date: Date | string | number,
  locale: Locale
): string {
  return formatDate(date, DATE_FORMATS[locale].time, locale)
}

/**
 * 獲取 date-fns locale 物件
 */
export function getDateFnsLocale(locale: Locale) {
  return LOCALE_MAP[locale]
}
