/**
 * @fileoverview Zod 驗證訊息國際化工具
 * @description
 *   提供 Zod 4.x schema 驗證訊息的國際化支援，包括：
 *   - 整合 Zod 內建 locales (zhTW, zhCN, en)
 *   - 自定義錯誤映射（Error Map）
 *   - 欄位名稱翻譯
 *
 * @module src/lib/i18n-zod
 * @author Development Team
 * @since Epic 17 - Story 17.3 (Validation Internationalization)
 * @lastModified 2026-01-17
 *
 * @features
 *   - Zod 4.x 內建 locale 整合
 *   - 自定義 ErrorMap 支援
 *   - 變數替換 ({field}, {min}, {max})
 *   - 支援 Server 和 Client 端
 *
 * @dependencies
 *   - zod - Schema 驗證
 *   - next-intl - 國際化框架
 */

import { z, locales as zodLocales, config as zodConfig } from 'zod'
import type { core } from 'zod'

/**
 * 翻譯函數類型（支援變數替換）
 */
export type TranslateFunction = (
  key: string,
  params?: Record<string, string | number>
) => string

/**
 * Zod 內建 locale 類型
 */
type ZodLocaleFactory = () => { localeError: core.$ZodErrorMap }

/**
 * Zod 內建 locale 映射
 */
const ZOD_LOCALE_MAP: Record<string, ZodLocaleFactory> = {
  en: zodLocales.en,
  'zh-TW': zodLocales.zhTW,
  'zh-CN': zodLocales.zhCN,
}

/**
 * 設定 Zod 全域 locale
 *
 * @param locale - 語言代碼 (en, zh-TW, zh-CN)
 *
 * @example
 * // 在 app 初始化時設定
 * setZodLocale('zh-TW');
 *
 * // 之後的所有 Zod 驗證都會使用繁體中文錯誤訊息
 * const result = schema.safeParse(data);
 */
export function setZodLocale(locale: string): void {
  const localeFactory = ZOD_LOCALE_MAP[locale] || ZOD_LOCALE_MAP['en']
  const { localeError } = localeFactory()
  zodConfig({ localeError })
}

/**
 * 取得特定 locale 的 Zod ErrorMap
 *
 * @param locale - 語言代碼
 * @returns Zod ErrorMap
 */
export function getZodErrorMap(locale: string): core.$ZodErrorMap {
  const localeFactory = ZOD_LOCALE_MAP[locale] || ZOD_LOCALE_MAP['en']
  const { localeError } = localeFactory()
  return localeError
}

/**
 * 建立自定義 Zod 錯誤映射（搭配 next-intl 翻譯）
 *
 * @param t - 翻譯函數（來自 useTranslations 或 getTranslations）
 * @param fieldLabels - 欄位名稱映射（可選）
 * @returns Zod ErrorMap
 *
 * @example
 * const t = useTranslations('validation');
 * const errorMap = createZodErrorMap(t, { name: '名稱', email: '電郵' });
 * z.config({ localeError: errorMap });
 */
export function createZodErrorMap(
  t: TranslateFunction,
  fieldLabels?: Record<string, string>
): core.$ZodErrorMap {
  return (issue) => {
    const path = issue.path ?? []
    const pathKey = String(path[0] ?? '')
    const field = fieldLabels?.[pathKey] || pathKey || 'Field'

    let message: string | undefined

    switch (issue.code) {
      case 'invalid_type':
        if (issue.input === undefined || issue.input === null) {
          message = t('required', { field })
        } else {
          message = t('invalidType')
        }
        break

      case 'too_small':
        if (issue.origin === 'string') {
          message =
            issue.minimum === 1
              ? t('required', { field })
              : t('minLength', { field, min: String(issue.minimum) })
        } else if (issue.origin === 'array') {
          message = t('arrayMinLength', { min: String(issue.minimum) })
        } else {
          message = t('min', { field, min: String(issue.minimum) })
        }
        break

      case 'too_big':
        if (issue.origin === 'string') {
          message = t('maxLength', { field, max: String(issue.maximum) })
        } else if (issue.origin === 'array') {
          message = t('arrayMaxLength', { max: String(issue.maximum) })
        } else {
          message = t('max', { field, max: String(issue.maximum) })
        }
        break

      case 'invalid_format':
        if (issue.format === 'email') {
          message = t('email')
        } else if (issue.format === 'url') {
          message = t('url')
        } else if (issue.format === 'uuid') {
          message = t('uuid')
        } else if (issue.format === 'cuid') {
          message = t('cuid')
        } else if (issue.format === 'regex') {
          message = t('regex', { field })
        } else {
          message = t('pattern', { field })
        }
        break

      case 'invalid_value':
        message = t('invalidEnum')
        break

      case 'custom':
        // 自定義錯誤使用 issue.params?.message 作為翻譯 key
        const customKey = issue.params?.key as string | undefined
        if (customKey && customKey.startsWith('custom.')) {
          message = t(customKey)
        }
        break

      default:
        // 使用預設訊息
        message = undefined
    }

    return message ? { message } : undefined
  }
}

/**
 * 從 Zod 錯誤中提取格式化的錯誤訊息
 *
 * @param error - Zod 錯誤物件
 * @returns 欄位錯誤映射
 */
export function formatZodErrors(
  error: z.ZodError
): Record<string, string[]> {
  const errors: Record<string, string[]> = {}

  // 直接從 issues 中提取錯誤
  for (const issue of error.issues) {
    const path = issue.path.join('.') || '_root'
    if (!errors[path]) {
      errors[path] = []
    }
    errors[path].push(issue.message)
  }

  return errors
}

/**
 * 驗證並取得國際化錯誤訊息
 *
 * @param schema - Zod schema
 * @param data - 要驗證的資料
 * @param locale - 語言代碼
 * @returns 驗證結果或格式化的錯誤
 */
export function validateWithLocale<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
  locale: string
): { success: true; data: T } | { success: false; errors: Record<string, string[]> } {
  // 暫時設定 locale
  const previousConfig = { ...zodConfig() }
  setZodLocale(locale)

  try {
    const result = schema.safeParse(data)

    if (result.success) {
      return { success: true, data: result.data }
    }

    return {
      success: false,
      errors: formatZodErrors(result.error),
    }
  } finally {
    // 恢復之前的配置
    zodConfig(previousConfig)
  }
}
