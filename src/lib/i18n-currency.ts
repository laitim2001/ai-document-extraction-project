/**
 * @fileoverview 貨幣格式化國際化工具
 * @description
 *   提供貨幣的國際化格式化功能，支援多種貨幣代碼。
 *   使用 Intl.NumberFormat API 確保符合地區習慣。
 *
 * @module src/lib/i18n-currency
 * @author Development Team
 * @since Epic 17 - Story 17.4 (Date/Number/Currency Formatting)
 * @lastModified 2026-01-17
 */

import type { Locale } from '@/i18n/config'

/**
 * 支援的貨幣代碼
 */
export type CurrencyCode =
  | 'USD'  // 美元
  | 'TWD'  // 新台幣
  | 'CNY'  // 人民幣
  | 'HKD'  // 港幣
  | 'JPY'  // 日圓
  | 'EUR'  // 歐元
  | 'GBP'  // 英鎊

/**
 * 語言到 Intl locale 映射
 */
const INTL_LOCALE_MAP: Record<Locale, string> = {
  'en': 'en-US',
  'zh-TW': 'zh-TW',
  'zh-CN': 'zh-CN',
}

/**
 * 貨幣符號映射（自定義顯示）
 */
export const CURRENCY_SYMBOLS: Record<CurrencyCode, string> = {
  'USD': '$',
  'TWD': 'NT$',
  'CNY': '¥',
  'HKD': 'HK$',
  'JPY': '¥',
  'EUR': '€',
  'GBP': '£',
}

/**
 * 貨幣名稱映射
 */
export const CURRENCY_NAMES: Record<Locale, Record<CurrencyCode, string>> = {
  'en': {
    USD: 'US Dollar',
    TWD: 'New Taiwan Dollar',
    CNY: 'Chinese Yuan',
    HKD: 'Hong Kong Dollar',
    JPY: 'Japanese Yen',
    EUR: 'Euro',
    GBP: 'British Pound',
  },
  'zh-TW': {
    USD: '美元',
    TWD: '新台幣',
    CNY: '人民幣',
    HKD: '港幣',
    JPY: '日圓',
    EUR: '歐元',
    GBP: '英鎊',
  },
  'zh-CN': {
    USD: '美元',
    TWD: '新台币',
    CNY: '人民币',
    HKD: '港币',
    JPY: '日元',
    EUR: '欧元',
    GBP: '英镑',
  },
}

/**
 * 貨幣格式化選項
 */
export interface CurrencyFormatOptions {
  /** 是否顯示貨幣符號（預設 true） */
  showSymbol?: boolean
  /** 小數位數（預設根據貨幣決定） */
  decimals?: number
}

/**
 * 格式化貨幣
 *
 * @param value - 金額
 * @param currency - 貨幣代碼
 * @param locale - 語言代碼
 * @param options - 格式化選項
 * @returns 格式化後的貨幣字串
 *
 * @example
 * formatCurrency(1234.56, 'USD', 'en')     // → "$1,234.56"
 * formatCurrency(1234.56, 'TWD', 'zh-TW')  // → "NT$1,234.56"
 * formatCurrency(1234, 'JPY', 'zh-TW')     // → "¥1,234"
 */
export function formatCurrency(
  value: number,
  currency: CurrencyCode,
  locale: Locale,
  options?: CurrencyFormatOptions
): string {
  const { showSymbol = true, decimals } = options || {}

  // JPY 不需要小數位
  const defaultDecimals = currency === 'JPY' ? 0 : 2
  const fractionDigits = decimals ?? defaultDecimals

  if (showSymbol) {
    return new Intl.NumberFormat(INTL_LOCALE_MAP[locale], {
      style: 'currency',
      currency,
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    }).format(value)
  }

  // 不顯示符號時，僅格式化數字
  return new Intl.NumberFormat(INTL_LOCALE_MAP[locale], {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value)
}

/**
 * 獲取貨幣符號
 *
 * @example
 * getCurrencySymbol('USD')  // → "$"
 * getCurrencySymbol('TWD')  // → "NT$"
 */
export function getCurrencySymbol(currency: CurrencyCode): string {
  return CURRENCY_SYMBOLS[currency]
}

/**
 * 獲取貨幣名稱
 *
 * @example
 * getCurrencyName('USD', 'zh-TW')  // → "美元"
 * getCurrencyName('USD', 'en')     // → "US Dollar"
 */
export function getCurrencyName(currency: CurrencyCode, locale: Locale): string {
  return CURRENCY_NAMES[locale][currency]
}

/**
 * 格式化金額範圍
 *
 * @example
 * formatCurrencyRange(100, 500, 'USD', 'en')  // → "$100 - $500"
 */
export function formatCurrencyRange(
  min: number,
  max: number,
  currency: CurrencyCode,
  locale: Locale
): string {
  const formattedMin = formatCurrency(min, currency, locale)
  const formattedMax = formatCurrency(max, currency, locale)
  return `${formattedMin} - ${formattedMax}`
}

/**
 * 獲取所有支援的貨幣選項
 *
 * @example
 * getCurrencyOptions('zh-TW')
 * // → [{ code: 'USD', name: '美元', symbol: '$' }, ...]
 */
export function getCurrencyOptions(locale: Locale): Array<{
  code: CurrencyCode
  name: string
  symbol: string
}> {
  const codes: CurrencyCode[] = ['USD', 'TWD', 'CNY', 'HKD', 'JPY', 'EUR', 'GBP']
  return codes.map((code) => ({
    code,
    name: getCurrencyName(code, locale),
    symbol: getCurrencySymbol(code),
  }))
}
