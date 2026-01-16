/**
 * @fileoverview API 錯誤響應國際化工具
 * @description
 *   提供國際化的 RFC 7807 格式錯誤響應。
 *   根據請求的 Accept-Language header 返回對應語言的錯誤訊息。
 *
 * @module src/lib/i18n-api-error
 * @author Development Team
 * @since Epic 17 - Story 17.3 (Validation Internationalization)
 * @lastModified 2026-01-17
 *
 * @features
 *   - RFC 7807 Problem Details 格式
 *   - Accept-Language header 解析
 *   - 欄位級錯誤支援
 *   - 業務錯誤支援
 *
 * @dependencies
 *   - next-intl/server - Server-side 翻譯
 */

import { getTranslations } from 'next-intl/server'
import { headers } from 'next/headers'
import { NextResponse } from 'next/server'

import {
  locales,
  defaultLocale,
  isValidLocale,
  type Locale,
} from '@/i18n/config'

/**
 * API 錯誤類型定義
 */
export type ApiErrorType =
  | 'unauthorized'
  | 'forbidden'
  | 'notFound'
  | 'validation'
  | 'conflict'
  | 'rateLimit'
  | 'internal'
  | 'serviceUnavailable'

/**
 * 業務錯誤類型定義
 */
export type BusinessErrorType =
  | 'variableResolution'
  | 'identificationFailed'
  | 'extractionFailed'
  | 'mappingNotFound'
  | 'configurationError'
  | 'processingTimeout'
  | 'duplicateEntry'
  | 'dependencyError'
  | 'dataIntegrity'

/**
 * RFC 7807 Problem Details 格式
 */
export interface ProblemDetails {
  type: string
  title: string
  status: number
  detail: string
  instance?: string
  errors?: Record<string, string[]>
}

/**
 * 錯誤類型到 HTTP 狀態碼映射
 */
const ERROR_STATUS_MAP: Record<ApiErrorType, number> = {
  unauthorized: 401,
  forbidden: 403,
  notFound: 404,
  validation: 400,
  conflict: 409,
  rateLimit: 429,
  internal: 500,
  serviceUnavailable: 503,
}

/**
 * 業務錯誤對應的 HTTP 狀態碼（預設為 400）
 */
const BUSINESS_ERROR_STATUS_MAP: Record<BusinessErrorType, number> = {
  variableResolution: 400,
  identificationFailed: 422,
  extractionFailed: 422,
  mappingNotFound: 404,
  configurationError: 500,
  processingTimeout: 408,
  duplicateEntry: 409,
  dependencyError: 409,
  dataIntegrity: 422,
}

/**
 * 從 Accept-Language header 解析語言
 *
 * @param header - Accept-Language header 值
 * @returns 解析後的 Locale
 */
function parseAcceptLanguage(header: string | null): Locale {
  if (!header) return defaultLocale

  const preferredLocales = header
    .split(',')
    .map((lang) => lang.split(';')[0].trim())

  for (const preferred of preferredLocales) {
    // 完全匹配
    if (isValidLocale(preferred)) {
      return preferred as Locale
    }
    // 語言代碼匹配（如 zh 匹配 zh-TW）
    const langCode = preferred.split('-')[0]
    const matched = locales.find((l) => l.startsWith(langCode))
    if (matched) {
      return matched
    }
  }

  return defaultLocale
}

/**
 * 從請求中取得 locale
 */
async function getLocaleFromRequest(): Promise<Locale> {
  const headersList = await headers()
  const acceptLanguage = headersList.get('accept-language')
  return parseAcceptLanguage(acceptLanguage)
}

/**
 * 建立國際化錯誤響應
 *
 * @param errorType - 錯誤類型
 * @param options - 選項
 * @returns NextResponse 包含國際化錯誤訊息
 *
 * @example
 * // 在 API route 中使用
 * export async function GET() {
 *   const user = await getUser();
 *   if (!user) {
 *     return createLocalizedError('notFound', {
 *       instance: '/api/v1/users/123',
 *     });
 *   }
 * }
 */
export async function createLocalizedError(
  errorType: ApiErrorType,
  options?: {
    instance?: string
    errors?: Record<string, string[]>
    detail?: string
  }
): Promise<NextResponse<ProblemDetails>> {
  const locale = await getLocaleFromRequest()
  const t = await getTranslations({ locale, namespace: 'errors' })

  const status = ERROR_STATUS_MAP[errorType]
  const title = t(`api.${errorType}.title`)
  const detail = options?.detail || t(`api.${errorType}.detail`)

  const problemDetails: ProblemDetails = {
    type: `https://api.example.com/errors/${errorType}`,
    title,
    status,
    detail,
    ...(options?.instance && { instance: options.instance }),
    ...(options?.errors && { errors: options.errors }),
  }

  return NextResponse.json(problemDetails, { status })
}

/**
 * 建立驗證錯誤響應
 *
 * @param fieldErrors - 欄位錯誤映射
 * @param instance - 請求實例路徑
 * @returns NextResponse 包含驗證錯誤詳情
 *
 * @example
 * export async function POST(request: Request) {
 *   const result = schema.safeParse(await request.json());
 *   if (!result.success) {
 *     return createValidationError(
 *       formatZodErrors(result.error),
 *       request.url
 *     );
 *   }
 * }
 */
export async function createValidationError(
  fieldErrors: Record<string, string[]>,
  instance?: string
): Promise<NextResponse<ProblemDetails>> {
  return createLocalizedError('validation', {
    instance,
    errors: fieldErrors,
  })
}

/**
 * 建立業務邏輯錯誤響應
 *
 * @param errorType - 業務錯誤類型
 * @param params - 錯誤訊息參數
 * @param options - 額外選項
 * @returns NextResponse 包含國際化業務錯誤訊息
 *
 * @example
 * export async function POST(request: Request) {
 *   try {
 *     await processDocument(doc);
 *   } catch (error) {
 *     return createBusinessError('extractionFailed', {
 *       reason: error.message,
 *     });
 *   }
 * }
 */
export async function createBusinessError(
  errorType: BusinessErrorType,
  params?: Record<string, string | number>,
  options?: {
    instance?: string
  }
): Promise<NextResponse<ProblemDetails>> {
  const locale = await getLocaleFromRequest()
  const t = await getTranslations({ locale, namespace: 'errors' })

  const status = BUSINESS_ERROR_STATUS_MAP[errorType]
  const title = t(`business.${errorType}.title`)
  const detail = t(`business.${errorType}.detail`, params)

  const problemDetails: ProblemDetails = {
    type: `https://api.example.com/errors/business/${errorType}`,
    title,
    status,
    detail,
    ...(options?.instance && { instance: options.instance }),
  }

  return NextResponse.json(problemDetails, { status })
}

/**
 * 建立網路/認證錯誤響應
 *
 * @param errorKey - 錯誤 key（對應 errors.json 中的路徑）
 * @param status - HTTP 狀態碼
 * @param instance - 請求實例路徑
 * @returns NextResponse 包含國際化錯誤訊息
 */
export async function createAuthError(
  errorKey: 'sessionExpired' | 'invalidToken' | 'accountDisabled',
  instance?: string
): Promise<NextResponse<ProblemDetails>> {
  const locale = await getLocaleFromRequest()
  const t = await getTranslations({ locale, namespace: 'errors' })

  const detail = t(`auth.${errorKey}`)

  const problemDetails: ProblemDetails = {
    type: `https://api.example.com/errors/auth/${errorKey}`,
    title: t('api.unauthorized.title'),
    status: 401,
    detail,
    ...(instance && { instance }),
  }

  return NextResponse.json(problemDetails, { status: 401 })
}
