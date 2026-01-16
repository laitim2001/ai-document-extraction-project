/**
 * @fileoverview 數字格式化國際化工具
 * @description
 *   提供數字的國際化格式化功能，使用 Intl.NumberFormat API。
 *   支援千位分隔符、百分比、緊湊表示等格式。
 *
 * @module src/lib/i18n-number
 * @author Development Team
 * @since Epic 17 - Story 17.4 (Date/Number/Currency Formatting)
 * @lastModified 2026-01-17
 */

import type { Locale } from '@/i18n/config'

/**
 * 語言到 Intl locale 映射
 */
const INTL_LOCALE_MAP: Record<Locale, string> = {
  'en': 'en-US',
  'zh-TW': 'zh-TW',
  'zh-CN': 'zh-CN',
}

/**
 * 格式化數字（帶千位分隔符）
 *
 * @param value - 數值
 * @param locale - 語言代碼
 * @param options - Intl.NumberFormat 選項
 * @returns 格式化後的數字字串
 *
 * @example
 * formatNumber(1234567, 'zh-TW')     // → "1,234,567"
 * formatNumber(1234567.89, 'zh-TW')  // → "1,234,567.89"
 */
export function formatNumber(
  value: number,
  locale: Locale,
  options?: Intl.NumberFormatOptions
): string {
  return new Intl.NumberFormat(INTL_LOCALE_MAP[locale], options).format(value)
}

/**
 * 格式化百分比
 *
 * @param value - 數值（0-100 或 0-1）
 * @param locale - 語言代碼
 * @param isDecimal - 是否為小數形式（0-1），預設 false
 * @param decimals - 小數位數，預設 1
 * @returns 格式化後的百分比字串
 *
 * @example
 * formatPercent(95.5, 'zh-TW')           // → "95.5%"
 * formatPercent(0.955, 'zh-TW', true)    // → "95.5%"
 */
export function formatPercent(
  value: number,
  locale: Locale,
  isDecimal: boolean = false,
  decimals: number = 1
): string {
  const normalizedValue = isDecimal ? value : value / 100

  return new Intl.NumberFormat(INTL_LOCALE_MAP[locale], {
    style: 'percent',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(normalizedValue)
}

/**
 * 格式化緊湊數字（如 1.2K、1.5M）
 *
 * @param value - 數值
 * @param locale - 語言代碼
 * @returns 緊湊格式的數字字串
 *
 * @example
 * formatCompact(1234, 'en')      // → "1.2K"
 * formatCompact(1234567, 'en')   // → "1.2M"
 * formatCompact(1234, 'zh-TW')   // → "1234"（中文沒有 K/M）
 */
export function formatCompact(
  value: number,
  locale: Locale
): string {
  return new Intl.NumberFormat(INTL_LOCALE_MAP[locale], {
    notation: 'compact',
    compactDisplay: 'short',
  }).format(value)
}

/**
 * 格式化整數（無小數）
 *
 * @example
 * formatInteger(1234567, 'zh-TW')  // → "1,234,567"
 */
export function formatInteger(
  value: number,
  locale: Locale
): string {
  return formatNumber(Math.round(value), locale, {
    maximumFractionDigits: 0,
  })
}

/**
 * 格式化小數（固定小數位數）
 *
 * @example
 * formatDecimal(1234.5, 'zh-TW', 2)  // → "1,234.50"
 */
export function formatDecimal(
  value: number,
  locale: Locale,
  decimals: number = 2
): string {
  return formatNumber(value, locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

/**
 * 獲取 Intl locale 字串
 */
export function getIntlLocale(locale: Locale): string {
  return INTL_LOCALE_MAP[locale]
}
