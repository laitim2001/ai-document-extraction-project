/**
 * @fileoverview i18n 國際化配置常數
 * @description
 *   定義支援的語言清單、預設語言和語言名稱映射。
 *   所有 i18n 相關功能都應使用此檔案定義的常數。
 *
 * @module src/i18n/config
 * @author Development Team
 * @since Epic 17 - Story 17.1 (i18n Infrastructure Setup)
 * @lastModified 2026-01-16
 *
 * @features
 *   - 支援語言清單定義
 *   - 預設語言設定
 *   - 語言顯示名稱映射
 *
 * @related
 *   - src/i18n/request.ts - Server-side locale 請求
 *   - src/i18n/routing.ts - 路由配置
 *   - src/middleware.ts - 語言偵測中間件
 */

/** 支援的語言代碼列表 */
export const locales = ['en', 'zh-TW', 'zh-CN'] as const

/** 語言代碼類型 */
export type Locale = (typeof locales)[number]

/** 預設語言（fallback） */
export const defaultLocale: Locale = 'en'

/** 語言顯示名稱映射 */
export const localeNames: Record<Locale, string> = {
  en: 'English',
  'zh-TW': '繁體中文',
  'zh-CN': '简体中文',
}

/** 語言對應的 HTML lang 屬性值 */
export const localeHtmlLang: Record<Locale, string> = {
  en: 'en',
  'zh-TW': 'zh-Hant-TW',
  'zh-CN': 'zh-Hans-CN',
}

/** 判斷是否為有效的 locale */
export function isValidLocale(locale: string): locale is Locale {
  return locales.includes(locale as Locale)
}
