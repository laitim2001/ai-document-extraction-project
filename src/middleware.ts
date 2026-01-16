/**
 * @fileoverview Next.js Middleware for i18n and authentication
 * @description
 *   結合 next-intl 語言偵測和 NextAuth 認證的中間件。
 *   處理語言路由重定向和認證保護。
 *
 *   路由處理順序：
 *   1. 跳過靜態資源和 API 路由
 *   2. 處理 i18n 語言偵測和重定向
 *   3. 處理認證保護（需登入的路由）
 *
 *   路由分類：
 *   - 公開路由：/[locale]/auth/*、/api/auth/*
 *   - 受保護路由：/[locale]/dashboard/*、/api/v1/*
 *
 * @module src/middleware
 * @author Development Team
 * @since Epic 17 - Story 17.1 (i18n Infrastructure Setup)
 * @lastModified 2026-01-16
 *
 * @features
 *   - Accept-Language header 語言偵測
 *   - Cookie 語言偏好持久化
 *   - 舊路徑自動重定向
 *   - 與 NextAuth 認證整合
 *
 * @dependencies
 *   - next-intl/middleware - i18n 中間件
 *   - next-auth - 認證中間件
 *
 * @related
 *   - src/i18n/config.ts - 語言配置
 *   - src/lib/auth.config.ts - Edge 認證配置
 */

import createIntlMiddleware from 'next-intl/middleware'
import NextAuth from 'next-auth'
import { NextRequest, NextResponse } from 'next/server'
import { locales, defaultLocale, type Locale } from './i18n/config'
import { authConfig } from '@/lib/auth.config'

// 建立 next-intl 中間件
const intlMiddleware = createIntlMiddleware({
  locales,
  defaultLocale,
  localePrefix: 'always',
  localeDetection: true,
})

// 建立 NextAuth 中間件
const { auth } = NextAuth(authConfig)

/**
 * 從路徑中提取 locale 和剩餘路徑
 */
function extractLocaleFromPath(pathname: string): { locale: Locale | null; restPath: string } {
  for (const loc of locales) {
    if (pathname.startsWith(`/${loc}/`) || pathname === `/${loc}`) {
      return {
        locale: loc,
        restPath: pathname.slice(`/${loc}`.length) || '/',
      }
    }
  }
  return { locale: null, restPath: pathname }
}

/**
 * 檢查路徑是否為受保護路由
 */
function isProtectedRoute(pathname: string): boolean {
  const { restPath } = extractLocaleFromPath(pathname)
  return restPath.startsWith('/dashboard') || restPath.startsWith('/invoices')
}

/**
 * 檢查路徑是否為認證路由
 */
function isAuthRoute(pathname: string): boolean {
  const { restPath } = extractLocaleFromPath(pathname)
  return restPath.startsWith('/auth')
}

/**
 * 主中間件函數
 */
export default async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // 1. 跳過靜態資源、API 路由和 Next.js 內部路徑
  if (
    pathname.startsWith('/api') ||
    pathname.startsWith('/_next') ||
    pathname.includes('.') ||
    pathname.startsWith('/favicon')
  ) {
    return NextResponse.next()
  }

  // 2. 處理 i18n 路由
  // 檢查路徑是否已有 locale 前綴
  const { locale } = extractLocaleFromPath(pathname)

  if (!locale) {
    // 沒有 locale 前綴，需要重定向
    // 從 cookie 或 Accept-Language 取得偏好語言
    const cookieLocale = request.cookies.get('NEXT_LOCALE')?.value
    const acceptLanguage = request.headers.get('accept-language')

    let detectedLocale: Locale = defaultLocale

    if (cookieLocale && locales.includes(cookieLocale as Locale)) {
      detectedLocale = cookieLocale as Locale
    } else if (acceptLanguage) {
      // 解析 Accept-Language header
      const preferredLocales = acceptLanguage.split(',').map((lang) => lang.split(';')[0].trim())

      for (const preferred of preferredLocales) {
        // 完全匹配
        if (locales.includes(preferred as Locale)) {
          detectedLocale = preferred as Locale
          break
        }
        // 語言代碼匹配（如 zh 匹配 zh-TW）
        const langCode = preferred.split('-')[0]
        const matched = locales.find((l) => l.startsWith(langCode))
        if (matched) {
          detectedLocale = matched
          break
        }
      }
    }

    // 重定向到帶 locale 的路徑
    const redirectUrl = new URL(`/${detectedLocale}${pathname}`, request.url)
    return NextResponse.redirect(redirectUrl)
  }

  // 3. 有 locale 前綴，使用 next-intl middleware 處理
  const intlResponse = intlMiddleware(request)

  // 4. 處理認證邏輯
  // 取得認證狀態
  const session = await auth()
  const isLoggedIn = !!session?.user

  // 檢查是否為受保護路由
  if (isProtectedRoute(pathname)) {
    if (!isLoggedIn) {
      // 未登入，重定向到登入頁面
      const loginUrl = new URL(`/${locale}/auth/login`, request.url)
      loginUrl.searchParams.set('callbackUrl', pathname)
      return NextResponse.redirect(loginUrl)
    }
  }

  // 檢查是否為認證路由（已登入用戶）
  if (isAuthRoute(pathname) && isLoggedIn) {
    // 已登入，重定向到儀表板
    const dashboardUrl = new URL(`/${locale}/dashboard`, request.url)
    return NextResponse.redirect(dashboardUrl)
  }

  // 處理根路徑 /[locale]
  const { restPath } = extractLocaleFromPath(pathname)
  if (restPath === '/') {
    if (isLoggedIn) {
      const dashboardUrl = new URL(`/${locale}/dashboard`, request.url)
      return NextResponse.redirect(dashboardUrl)
    } else {
      const loginUrl = new URL(`/${locale}/auth/login`, request.url)
      return NextResponse.redirect(loginUrl)
    }
  }

  return intlResponse
}

export const config = {
  // 匹配所有路徑，除了 API、靜態檔案和 Next.js 內部路徑
  matcher: ['/((?!api|_next|.*\\..*).*)'],
}
